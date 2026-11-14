import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_SCOPES = ['organisation:read', 'opportunities:read', 'applications:read', 'placements:read'];
type Action = 'list' | 'create_connection' | 'create_api_key' | 'revoke_api_key' | 'set_connection_status';
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
  if (caller.role !== 'platform_admin') return json({ error: 'Platform administrator access required' }, 403);

  let body: { action?: Action; name?: string; organization_type?: 'university' | 'company'; organization_id?: string; integration_id?: string; scopes?: string[]; expires_at?: string | null; key_id?: string; status?: 'active' | 'suspended' };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (body.action === 'list') {
    const { data: connections, error } = await admin.from('integration_connections')
      .select('id,name,organization_type,university_id,company_id,status,created_at')
      .order('created_at', { ascending: false });
    if (error) return json({ error: 'Could not load integration connections' }, 500);
    const [{ data: universities }, { data: companies }, { data: keys }] = await Promise.all([
      admin.from('universities').select('id,name').is('deleted_at', null),
      admin.from('companies').select('id,name').is('deleted_at', null),
      admin.from('integration_api_keys').select('id,integration_id,name,key_prefix,scopes,expires_at,last_used_at,revoked_at,created_at').order('created_at', { ascending: false }),
    ]);
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
    if (error) return json({ error: error.code === '23505' ? 'A connection with this name already exists for this organisation' : 'Could not register the integration connection' }, 409);
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
