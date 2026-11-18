import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_SCOPES = ['organisation:read', 'opportunities:read', 'applications:read', 'placements:read'];
const ALLOWED_WEBHOOK_EVENTS = [
  'application.submitted', 'application.status_changed', 'placement.created',
  'placement.status_changed', 'placement.completed', 'weekly_report.submitted',
  'weekly_report.reviewed', 'evaluation.completed',
];
type Action = 'list' | 'create_connection' | 'create_api_key' | 'revoke_api_key' | 'set_connection_status'
  | 'list_webhooks' | 'create_webhook' | 'set_webhook_status' | 'process_webhooks'
  | 'list_sso_configs' | 'save_sso_config' | 'set_sso_status'
  | 'list_embeds' | 'create_embed' | 'set_embed_status';
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return 'sims_live_' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer { const copy = new Uint8Array(bytes.byteLength); copy.set(bytes); return copy.buffer; }

async function encryptIntegrationSecret(value: string) {
  const configuredKey = Deno.env.get('INTEGRATION_SECRET_ENCRYPTION_KEY');
  if (!configuredKey) throw new Error('INTEGRATION_SECRET_ENCRYPTION_KEY is not configured');
  let rawKey: Uint8Array;
  try {
    rawKey = Uint8Array.from(atob(configuredKey), char => char.charCodeAt(0));
  } catch {
    throw new Error('INTEGRATION_SECRET_ENCRYPTION_KEY must be base64-encoded');
  }
  if (rawKey.length !== 32) throw new Error('INTEGRATION_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(rawKey), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

function isPublicIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = parts;
  return a !== 0 && a !== 10 && a !== 127 && a < 224
    && !(a === 100 && b >= 64 && b <= 127)
    && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && (b === 0 || b === 168))
    && !(a === 198 && (b === 18 || b === 19 || b === 51))
    && !(a === 203 && b === 0);
}

function isPublicIpv6(address: string) {
  const value = address.toLowerCase();
  return value !== '::' && value !== '::1'
    && !value.startsWith('fc') && !value.startsWith('fd')
    && !value.startsWith('fe8') && !value.startsWith('fe9')
    && !value.startsWith('fea') && !value.startsWith('feb')
    && !value.startsWith('ff') && !value.startsWith('::ffff:');
}

async function assertSafeWebhookUrl(value: string) {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error('Provide a valid HTTPS webhook URL'); }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || (parsed.port && parsed.port !== '443') || parsed.username || parsed.password
    || !host.includes('.') || host === 'localhost'
    || host.endsWith('.localhost') || host.endsWith('.local')
    || host.endsWith('.internal') || host.endsWith('.test')
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) {
    throw new Error('Webhook endpoints must use a public HTTPS hostname');
  }
  const ipv4 = await Deno.resolveDns(host, 'A').catch(() => [] as string[]);
  const ipv6 = await Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]);
  if (!ipv4.length && !ipv6.length) throw new Error('Webhook hostname did not resolve to a public address');
  if (ipv4.some(address => !isPublicIpv4(address)) || ipv6.some(address => !isPublicIpv6(address))) {
    throw new Error('Webhook hostname resolves to a private or reserved network address');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Integration service is not configured' }, 500);
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Authentication required' }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Invalid or expired session' }, 401);
  const { data: caller, error: callerError } = await admin.from('profiles')
    .select('id, role, account_status, deleted_at').eq('id', authData.user.id).maybeSingle();
  if (callerError || !caller) return json({ error: 'SIMS profile not found' }, 403);
  if (caller.account_status !== 'active' || caller.deleted_at) return json({ error: 'Your account is not active' }, 403);
  if (caller.role !== 'platform_admin') return json({ error: 'Platform administrator access required' }, 403);

  let body: {
    action?: Action; name?: string; organization_type?: 'university' | 'company'; organization_id?: string;
    integration_id?: string; scopes?: string[]; expires_at?: string | null; key_id?: string;
    status?: 'active' | 'suspended' | 'draft' | 'pending_verification' | 'disabled';
    webhook_id?: string; endpoint_url?: string; events?: string[];
    protocol?: 'oidc' | 'saml'; issuer_url?: string; client_id?: string; metadata_url?: string;
    email_domains?: string[]; provider_config?: Record<string, unknown>;
    embed_id?: string; title?: string; allowed_origins?: string[];
  };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (body.action === 'list') {
    const { data: connections, error } = await admin.from('integration_connections')
      .select('id,name,organization_type,university_id,company_id,status,created_at')
      .order('created_at', { ascending: false });
    if (error) return json({ error: 'Could not load integration connections' }, 500);
    const [universitiesResult, companiesResult, keysResult] = await Promise.all([
      admin.from('universities').select('id,name').is('deleted_at', null),
      admin.from('companies').select('id,name').is('deleted_at', null),
      admin.from('integration_api_keys').select('id,integration_id,name,key_prefix,scopes,expires_at,last_used_at,revoked_at,created_at').order('created_at', { ascending: false }),
    ]);
    if (universitiesResult.error || companiesResult.error || keysResult.error) {
      return json({ error: 'Could not load complete integration administration data' }, 500);
    }
    const universities = universitiesResult.data;
    const companies = companiesResult.data;
    const keys = keysResult.data;
    const orgNames = new Map<string, string>();
    (universities ?? []).forEach(item => orgNames.set(item.id, item.name));
    (companies ?? []).forEach(item => orgNames.set(item.id, item.name));
    return json({
      connections: (connections ?? []).map(item => ({
        ...item,
        organization_name: item.organization_type === 'university'
          ? orgNames.get(item.university_id) ?? 'Unknown university'
          : orgNames.get(item.company_id) ?? 'Unknown company',
      })),
      api_keys: keys ?? [],
    });
  }

  if (body.action === 'process_webhooks') {
    const workerSecret = Deno.env.get('INTEGRATION_WEBHOOK_WORKER_SECRET');
    if (!workerSecret) return json({ error: 'Webhook delivery worker is not configured' }, 503);
    const workerResponse = await fetch(`${url}/functions/v1/integration-webhook-worker`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'x-sims-worker-secret': workerSecret,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ limit: 10 }),
    });
    const result = await workerResponse.json().catch(() => ({}));
    if (!workerResponse.ok) return json({ error: result.error ?? 'Webhook delivery worker failed' }, workerResponse.status);
    return json({ delivery: result });
  }

  if (body.action === 'list_webhooks') {
    const [webhooksResult, deliveriesResult] = await Promise.all([
      admin.from('integration_webhooks')
        .select('id,integration_id,name,endpoint_url,events,status,created_at')
        .order('created_at', { ascending: false }),
      admin.from('integration_webhook_deliveries')
        .select('id,webhook_id,event_type,status,attempts,last_status_code,last_error,created_at,delivered_at')
        .order('created_at', { ascending: false }).limit(100),
    ]);
    if (webhooksResult.error || deliveriesResult.error) return json({ error: 'Could not load webhook endpoints and delivery history' }, 500);
    return json({ webhooks: webhooksResult.data ?? [], deliveries: deliveriesResult.data ?? [] });
  }

  if (body.action === 'create_webhook') {
    const name = body.name?.trim();
    const integrationId = body.integration_id;
    const endpoint = body.endpoint_url?.trim();
    const events = Array.isArray(body.events) ? [...new Set(body.events)] : [];
    if (!name || name.length < 2 || name.length > 100 || !integrationId || !endpoint) {
      return json({ error: 'Webhook name, connection and HTTPS endpoint are required' }, 400);
    }
    if (!events.length || events.some(event => !ALLOWED_WEBHOOK_EVENTS.includes(event))) {
      return json({ error: 'Choose one or more supported webhook events' }, 400);
    }
    const { data: connection } = await admin.from('integration_connections')
      .select('id,status').eq('id', integrationId).maybeSingle();
    if (!connection || connection.status !== 'active') return json({ error: 'Integration connection not found or suspended' }, 404);
    try { await assertSafeWebhookUrl(endpoint); } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Webhook endpoint is not allowed' }, 400);
    }
    const secret = `sims_whsec_${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
    let encryptedSecret: string;
    try { encryptedSecret = await encryptIntegrationSecret(secret); } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Webhook encryption is unavailable' }, 503);
    }
    const { data, error } = await admin.from('integration_webhooks').insert({
      integration_id: integrationId, name, endpoint_url: endpoint, events,
      secret_ciphertext: encryptedSecret, created_by: caller.id,
    }).select('id,integration_id,name,endpoint_url,events,status,created_at').single();
    if (error) return json({ error: 'Could not register webhook endpoint' }, 500);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_webhook', entity_id: data.id, action: 'created', metadata: { integration_id: integrationId, events, endpoint_host: new URL(endpoint).hostname } });
    return json({ webhook: data, secret, warning: 'Copy this signing secret now. It cannot be displayed again.' }, 201);
  }

  if (body.action === 'set_webhook_status') {
    if (!body.webhook_id || !['active', 'suspended'].includes(body.status ?? '')) return json({ error: 'Webhook and valid status are required' }, 400);
    const { data, error } = await admin.from('integration_webhooks').update({ status: body.status })
      .eq('id', body.webhook_id).select('id,integration_id,status').maybeSingle();
    if (error) return json({ error: 'Could not update webhook status' }, 500);
    if (!data) return json({ error: 'Webhook endpoint not found' }, 404);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_webhook', entity_id: data.id, action: body.status === 'suspended' ? 'suspended' : 'reactivated', metadata: { integration_id: data.integration_id } });
    return json({ webhook: data });
  }

  if (body.action === 'list_sso_configs') {
    const { data, error } = await admin.from('integration_sso_configs')
      .select('id,integration_id,protocol,issuer_url,client_id,metadata_url,email_domains,status,created_at')
      .order('created_at', { ascending: false });
    if (error) return json({ error: 'Could not load SSO configurations' }, 500);
    return json({ sso_configs: data ?? [] });
  }

  if (body.action === 'save_sso_config') {
    const integrationId = body.integration_id;
    const protocol = body.protocol;
    const issuer = body.issuer_url?.trim();
    const clientId = body.client_id?.trim() ?? null;
    const metadataUrl = body.metadata_url?.trim() ?? null;
    const domains = Array.isArray(body.email_domains) ? [...new Set(body.email_domains.map(value => value.toLowerCase().trim()))] : [];
    if (!integrationId || !['oidc', 'saml'].includes(protocol ?? '') || !issuer || !issuer.startsWith('https://')) {
      return json({ error: 'Connection, supported protocol and HTTPS issuer URL are required' }, 400);
    }
    if (protocol === 'oidc' && (!clientId || typeof body.provider_config?.client_secret !== 'string' || !body.provider_config.client_secret.trim())) {
      return json({ error: 'OIDC client ID and client secret are required' }, 400);
    }
    if (protocol === 'saml' && (!metadataUrl || !metadataUrl.startsWith('https://'))) {
      return json({ error: 'SAML metadata URL must use HTTPS' }, 400);
    }
    if (domains.some(domain => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || domain.includes('..'))) {
      return json({ error: 'Provide valid email domains without @ symbols' }, 400);
    }
    if (!body.provider_config || typeof body.provider_config !== 'object'
      || JSON.stringify(body.provider_config).length > 16000) {
      return json({ error: 'Provider configuration is required and must be under 16 KB' }, 400);
    }
    const { data: connection } = await admin.from('integration_connections').select('id,status').eq('id', integrationId).maybeSingle();
    if (!connection || connection.status !== 'active') return json({ error: 'Integration connection not found or suspended' }, 404);
    let encryptedConfig: string;
    try { encryptedConfig = await encryptIntegrationSecret(JSON.stringify(body.provider_config)); } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'SSO encryption is unavailable' }, 503);
    }
    const { data, error } = await admin.from('integration_sso_configs').upsert({
      integration_id: integrationId, protocol, issuer_url: issuer, client_id: clientId,
      metadata_url: metadataUrl, provider_config_ciphertext: encryptedConfig,
      email_domains: domains, status: 'draft', created_by: caller.id,
    }, { onConflict: 'integration_id' })
      .select('id,integration_id,protocol,issuer_url,client_id,metadata_url,email_domains,status,created_at').single();
    if (error) return json({ error: 'Could not save SSO configuration' }, 500);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_sso_config', entity_id: data.id, action: 'saved', metadata: { integration_id: integrationId, protocol, email_domains: domains } });
    return json({ sso_config: data, status_note: 'Configuration saved as draft. Provider metadata and domain ownership must be verified before activation.' });
  }

  if (body.action === 'set_sso_status') {
    if (!body.integration_id || !['disabled', 'pending_verification'].includes(body.status ?? '')) {
      return json({ error: 'SSO can only be disabled or moved to pending verification from this control' }, 400);
    }
    const { data, error } = await admin.from('integration_sso_configs').update({ status: body.status })
      .eq('integration_id', body.integration_id).select('id,integration_id,status').maybeSingle();
    if (error) return json({ error: 'Could not update SSO status' }, 500);
    if (!data) return json({ error: 'SSO configuration not found' }, 404);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_sso_config', entity_id: data.id, action: body.status, metadata: { integration_id: body.integration_id } });
    return json({ sso_config: data });
  }

  if (body.action === 'list_embeds') {
    const { data, error } = await admin.from('integration_embeds')
      .select('id,integration_id,public_token,title,allowed_origins,display_options,status,created_at')
      .order('created_at', { ascending: false });
    if (error) return json({ error: 'Could not load embed configurations' }, 500);
    return json({ embeds: data ?? [] });
  }

  if (body.action === 'create_embed') {
    const integrationId = body.integration_id;
    const title = body.title?.trim() || 'Internship opportunities';
    const origins = Array.isArray(body.allowed_origins) ? [...new Set(body.allowed_origins.map(value => value.trim()))] : [];
    if (!integrationId || title.length < 2 || title.length > 120 || !origins.length) return json({ error: 'Connection, title and at least one allowed HTTPS origin are required' }, 400);
    if (origins.some(origin => {
      try { const parsed = new URL(origin); return parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.username !== '' || parsed.password !== ''; }
      catch { return true; }
    })) return json({ error: 'Every allowed origin must be an HTTPS origin without a path' }, 400);
    const { data: connection } = await admin.from('integration_connections').select('id,status').eq('id', integrationId).maybeSingle();
    if (!connection || connection.status !== 'active') return json({ error: 'Integration connection not found or suspended' }, 404);
    const publicToken = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const { data, error } = await admin.from('integration_embeds').insert({
      integration_id: integrationId, public_token: publicToken, title, allowed_origins: origins, created_by: caller.id,
    }).select('id,integration_id,public_token,title,allowed_origins,display_options,status,created_at').single();
    if (error) return json({ error: 'Could not create public embed' }, 500);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_embed', entity_id: data.id, action: 'created', metadata: { integration_id: integrationId, allowed_origins: origins } });
    return json({ embed: data }, 201);
  }

  if (body.action === 'set_embed_status') {
    if (!body.embed_id || !['active', 'suspended'].includes(body.status ?? '')) return json({ error: 'Embed and valid status are required' }, 400);
    const { data, error } = await admin.from('integration_embeds').update({ status: body.status })
      .eq('id', body.embed_id).select('id,integration_id,status').maybeSingle();
    if (error) return json({ error: 'Could not update embed status' }, 500);
    if (!data) return json({ error: 'Embed not found' }, 404);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_embed', entity_id: data.id, action: body.status, metadata: { integration_id: data.integration_id } });
    return json({ embed: data });
  }

  if (body.action === 'create_connection') {
    const name = body.name?.trim();
    const kind = body.organization_type;
    const orgId = body.organization_id;
    if (!name || name.length < 2 || name.length > 100 || !orgId || !['university', 'company'].includes(kind ?? '')) {
      return json({ error: 'Provide a valid connection name and organisation' }, 400);
    }
    const table = kind === 'university' ? 'universities' : 'companies';
    const { data: organization } = await admin.from(table).select('id,status,deleted_at').eq('id', orgId).maybeSingle();
    if (!organization || organization.status !== 'active' || organization.deleted_at) return json({ error: 'The selected organisation does not exist or is not active' }, 404);
    const insert = {
      name, organization_type: kind,
      university_id: kind === 'university' ? orgId : null,
      company_id: kind === 'company' ? orgId : null,
      created_by: caller.id,
    };
    const { data, error } = await admin.from('integration_connections').insert(insert)
      .select('id,name,organization_type,university_id,company_id,status,created_at').single();
    if (error) {
      return error.code === '23505'
        ? json({ error: 'A connection with this name already exists for this organisation' }, 409)
        : json({ error: 'Could not register the integration connection' }, 500);
    }
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_connection', entity_id: data.id, action: 'created', metadata: { organization_type: kind, organization_id: orgId, name } });
    return json({ connection: data }, 201);
  }

  if (body.action === 'create_api_key') {
    const name = body.name?.trim();
    const integrationId = body.integration_id;
    const scopes = Array.isArray(body.scopes) ? [...new Set(body.scopes)] : [];
    if (!name || name.length < 2 || name.length > 100 || !integrationId) return json({ error: 'Key name and integration connection are required' }, 400);
    if (!scopes.length || scopes.some(scope => !ALLOWED_SCOPES.includes(scope))) return json({ error: 'Select one or more valid permission scopes' }, 400);
    const { data: connection } = await admin.from('integration_connections').select('id,status').eq('id', integrationId).maybeSingle();
    if (!connection || connection.status !== 'active') return json({ error: 'Integration connection not found or suspended' }, 404);
    let expiresAt: string | null = null;
    if (body.expires_at) {
      const parsed = new Date(body.expires_at);
      if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now() || parsed.getTime() > Date.now() + 366 * 86400000) {
        return json({ error: 'Expiry must be a future date within 12 months' }, 400);
      }
      expiresAt = parsed.toISOString();
    }
    const secret = randomKey();
    const hash = await sha256(secret);
    const prefix = secret.slice(0, 18);
    const { data, error } = await admin.from('integration_api_keys').insert({
      integration_id: integrationId, name, key_prefix: prefix, key_hash: hash,
      scopes, expires_at: expiresAt, created_by: caller.id,
    }).select('id,integration_id,name,key_prefix,scopes,expires_at,created_at').single();
    if (error) return json({ error: 'Could not create API credential' }, 500);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_api_key', entity_id: data.id, action: 'created', metadata: { integration_id: integrationId, scopes, key_prefix: prefix } });
    return json({ api_key: data, secret, warning: 'Copy this secret now. It cannot be displayed again.' }, 201);
  }

  if (body.action === 'revoke_api_key') {
    if (!body.key_id) return json({ error: 'API key id is required' }, 400);
    const { data, error } = await admin.from('integration_api_keys')
      .update({ revoked_at: new Date().toISOString() }).eq('id', body.key_id).is('revoked_at', null)
      .select('id,integration_id').maybeSingle();
    if (error) return json({ error: 'Could not revoke API credential' }, 500);
    if (!data) return json({ error: 'API credential not found or already revoked' }, 404);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_api_key', entity_id: data.id, action: 'revoked', metadata: { integration_id: data.integration_id } });
    return json({ id: data.id, revoked: true });
  }

  if (body.action === 'set_connection_status') {
    if (!body.integration_id || !['active', 'suspended'].includes(body.status ?? '')) return json({ error: 'Connection and valid status are required' }, 400);
    const { data, error } = await admin.from('integration_connections').update({ status: body.status })
      .eq('id', body.integration_id).select('id,status').maybeSingle();
    if (error) return json({ error: 'Could not update connection status' }, 500);
    if (!data) return json({ error: 'Integration connection not found' }, 404);
    await admin.from('audit_logs').insert({ actor_id: caller.id, entity: 'integration_connection', entity_id: data.id, action: body.status === 'suspended' ? 'suspended' : 'reactivated', metadata: {} });
    return json({ connection: data });
  }
  return json({ error: 'Unknown action' }, 400);
});
