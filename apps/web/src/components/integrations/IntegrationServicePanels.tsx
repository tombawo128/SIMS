import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Copy, ExternalLink, Plus, RefreshCw, Webhook, LockKeyhole, Code2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, useToast } from '@/components/ui';

type Connection = {
  id: string;
  name: string;
  organization_name: string;
  organization_type: 'university' | 'company';
  status: 'active' | 'suspended';
};

type Webhook = {
  id: string;
  integration_id: string;
  name: string;
  endpoint_url: string;
  events: string[];
  status: 'active' | 'suspended';
  created_at: string;
};

type Delivery = {
  id: string;
  webhook_id: string;
  event_type: string;
  status: 'pending' | 'processing' | 'delivered' | 'failed';
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  created_at: string;
  delivered_at: string | null;
};

type SsoConfig = {
  id: string;
  integration_id: string;
  protocol: 'oidc' | 'saml';
  issuer_url: string;
  client_id: string | null;
  metadata_url: string | null;
  email_domains: string[];
  status: 'draft' | 'pending_verification' | 'active' | 'disabled';
};

type Embed = {
  id: string;
  integration_id: string;
  public_token: string;
  title: string;
  allowed_origins: string[];
  status: 'active' | 'suspended';
};

const webhookEvents = [
  'application.submitted',
  'application.status_changed',
  'placement.created',
  'placement.status_changed',
  'placement.completed',
  'weekly_report.submitted',
  'weekly_report.reviewed',
  'evaluation.completed',
];

const functionError = (error: { message: string } | null, data: { error?: string } | null) => {
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
};

function connectionLabel(connection: Connection) {
  return `${connection.organization_name} — ${connection.name}`;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'active' || status === 'delivered' ? 'emerald'
    : status === 'failed' || status === 'disabled' || status === 'suspended' ? 'amber'
      : 'slate';
  return <Badge tone={tone}>{status.replaceAll('_', ' ')}</Badge>;
}

export function WebhooksPanel({ connections }: { connections: Connection[] }) {
  const [connectionId, setConnectionId] = useState('');
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [events, setEvents] = useState<string[]>(['application.submitted', 'placement.created']);
  const [secret, setSecret] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({
    queryKey: ['integration-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'list_webhooks' } });
      functionError(error, data);
      return data as { webhooks: Webhook[]; deliveries: Delivery[] };
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-admin', {
        body: { action: 'create_webhook', integration_id: connectionId, name: name.trim(), endpoint_url: endpoint.trim(), events },
      });
      functionError(error, data);
      return data as { webhook: Webhook; secret: string };
    },
    onSuccess: data => {
      setSecret(data.secret);
      setName('');
      setEndpoint('');
      void queryClient.invalidateQueries({ queryKey: ['integration-webhooks'] });
      toast({ title: 'Webhook registered', description: 'Copy the signing secret now. It is shown once.', tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Webhook registration failed', description: error.message, tone: 'error' }),
  });
  const status = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: 'active' | 'suspended' }) => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'set_webhook_status', webhook_id: id, status: value } });
      functionError(error, data);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['integration-webhooks'] }),
    onError: (error: Error) => toast({ title: 'Could not update webhook', description: error.message, tone: 'error' }),
  });
  const process = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'process_webhooks' } });
      functionError(error, data);
      return data as { delivery: { processed: number; delivered: number; retrying: number; failed: number } };
    },
    onSuccess: data => {
      void queryClient.invalidateQueries({ queryKey: ['integration-webhooks'] });
      toast({ title: 'Webhook queue processed', description: `${data.delivery.delivered} delivered, ${data.delivery.retrying} retrying, ${data.delivery.failed} failed.`, tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Webhook worker unavailable', description: error.message, tone: 'error' }),
  });
  const copySecret = async () => {
    try { await navigator.clipboard.writeText(secret); toast({ title: 'Signing secret copied', tone: 'success' }); }
    catch { toast({ title: 'Clipboard unavailable', description: 'Copy the secret manually.', tone: 'error' }); }
  };
  const webhooks = query.data?.webhooks ?? [];
  const deliveries = query.data?.deliveries ?? [];
  return (
    <div className="integration-stack">
      <Alert tone="info" title="Signed webhook delivery">
        Events are written to a durable queue. Delivery uses HMAC-SHA256 signatures, bounded retries and a public-HTTPS endpoint check. The queue can be processed manually; automatic scheduling still requires a protected Supabase scheduled invocation.
      </Alert>
      <Card>
        <CardHeader title="Register webhook endpoint" description="Use a dedicated HTTPS endpoint for each connected system." />
        <form className="integration-form" onSubmit={event => { event.preventDefault(); create.mutate(); }}>
          <label>Organisation connection
            <select value={connectionId} onChange={event => setConnectionId(event.target.value)} required>
              <option value="">Choose a connection</option>
              {connections.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{connectionLabel(item)}</option>)}
            </select>
          </label>
          <label>Endpoint name<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} placeholder="e.g. University portal" required /></label>
          <label className="integration-form__wide">HTTPS endpoint URL<input type="url" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://example.org/sims/events" required /></label>
          <fieldset className="integration-form__wide"><legend>Events to deliver</legend>
            <div className="integration-scope-checks">
              {webhookEvents.map(eventName => <label key={eventName}><input type="checkbox" checked={events.includes(eventName)} onChange={event => setEvents(current => event.target.checked ? [...current, eventName] : current.filter(item => item !== eventName))} />{eventName}</label>)}
            </div>
          </fieldset>
          <div className="integration-form__actions integration-form__wide">
            <span>Signing secrets are encrypted at rest and shown once.</span>
            <Button type="submit" disabled={!connectionId || name.trim().length < 2 || !endpoint.startsWith('https://') || events.length === 0 || create.isPending} loading={create.isPending}><Plus size={15} /> Add endpoint</Button>
          </div>
        </form>
        {secret ? <div className="integration-secret-panel"><strong>Copy the webhook signing secret</strong><p>Store it in your receiver's secret manager. SIMS will not display it again.</p><code>{secret}</code><Button size="sm" onClick={() => void copySecret()}><Copy size={14} /> Copy secret</Button><button type="button" onClick={() => setSecret('')}>I have saved it</button></div> : null}
      </Card>
      <Card>
        <CardHeader title="Registered endpoints" description="Suspend an endpoint to pause delivery without deleting its history." actions={<Button size="sm" variant="secondary" onClick={() => void query.refetch()} loading={query.isFetching}><RefreshCw size={14} /> Refresh</Button>} />
        {query.isLoading ? <p className="integration-muted">Loading webhook endpoints…</p> : query.isError ? <Alert tone="danger">Could not load webhook endpoints. <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Retry</Button></Alert> : !webhooks.length ? <EmptyState icon={<Webhook />} title="No webhook endpoints" description="Register an HTTPS endpoint to start receiving selected SIMS events." /> : (
          <div className="integration-key-list">{webhooks.map(item => (
            <div className="integration-key-row" key={item.id}>
              <div><strong>{item.name}</strong><small>{connections.find(c => c.id === item.integration_id)?.organization_name ?? 'Organisation'} · {new URL(item.endpoint_url).host}</small><div className="integration-key-scopes">{item.events.map(eventName => <code key={eventName}>{eventName}</code>)}</div></div>
              <div className="integration-key-meta"><StatusBadge status={item.status} /><small>{new Date(item.created_at).toLocaleString()}</small></div>
              <Button size="sm" variant="secondary" onClick={() => status.mutate({ id: item.id, value: item.status === 'active' ? 'suspended' : 'active' })} disabled={status.isPending}>{item.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>
            </div>
          ))}</div>
        )}
      </Card>
      <Card>
        <CardHeader title="Recent delivery history" description="Last 100 delivery attempts across connected systems." actions={<Button size="sm" onClick={() => process.mutate()} loading={process.isPending} disabled={!webhooks.some(item => item.status === 'active')}><Webhook size={14} /> Process pending queue</Button>} />
        {!deliveries.length ? <EmptyState icon={<Activity />} title="No webhook deliveries yet" description="When a selected SIMS event occurs, its delivery will appear here." /> : (
          <div className="integration-key-list">{deliveries.map(item => (
            <div className="integration-key-row" key={item.id}>
              <div><strong>{item.event_type}</strong><small>{webhooks.find(webhook => webhook.id === item.webhook_id)?.name ?? 'Webhook'} · {new Date(item.created_at).toLocaleString()}</small>{item.last_error ? <small className="integration-error-text">{item.last_error}</small> : null}</div>
              <div className="integration-key-meta"><StatusBadge status={item.status} /><small>{item.attempts} attempt(s) {item.last_status_code ? `· HTTP ${item.last_status_code}` : ''}</small></div>
            </div>
          ))}</div>
        )}
      </Card>
    </div>
  );
}

export function SsoPanel({ connections }: { connections: Connection[] }) {
  const [connectionId, setConnectionId] = useState('');
  const [protocol, setProtocol] = useState<'oidc' | 'saml'>('oidc');
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [metadataUrl, setMetadataUrl] = useState('');
  const [domains, setDomains] = useState('');
  const [providerConfig, setProviderConfig] = useState('{"client_secret":""}');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({
    queryKey: ['integration-sso-configs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'list_sso_configs' } });
      functionError(error, data);
      return (data?.sso_configs ?? []) as SsoConfig[];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      let config: Record<string, unknown>;
      try { config = JSON.parse(providerConfig); } catch { throw new Error('Provider secret/config must be valid JSON.'); }
      const { data, error } = await supabase.functions.invoke('integration-admin', {
        body: {
          action: 'save_sso_config', integration_id: connectionId, protocol,
          issuer_url: issuer.trim(), client_id: protocol === 'oidc' ? clientId.trim() : null,
          metadata_url: protocol === 'saml' ? metadataUrl.trim() : null,
          email_domains: domains.split(',').map(value => value.trim()).filter(Boolean),
          provider_config: config,
        },
      });
      functionError(error, data);
      return data;
    },
    onSuccess: () => {
      setProviderConfig(protocol === 'oidc' ? '{"client_secret":""}' : '{}');
      void queryClient.invalidateQueries({ queryKey: ['integration-sso-configs'] });
      toast({ title: 'SSO configuration saved', description: 'It remains in draft until provider and domain verification is complete.', tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Could not save SSO configuration', description: error.message, tone: 'error' }),
  });
  const changeStatus = useMutation({
    mutationFn: async ({ integrationId, value }: { integrationId: string; value: 'pending_verification' | 'disabled' }) => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'set_sso_status', integration_id: integrationId, status: value } });
      functionError(error, data);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['integration-sso-configs'] }),
    onError: (error: Error) => toast({ title: 'Could not update SSO state', description: error.message, tone: 'error' }),
  });
  const configs = query.data ?? [];
  return (
    <div className="integration-stack">
      <Alert tone="warning" title="SSO configuration is not the same as an active sign-in flow">
        SIMS can securely store tenant IdP settings here, but provider handoff, callback validation, domain proof and account linking still need to be configured and verified against the organisation's real identity provider. Do not mark a provider active before those checks pass.
      </Alert>
      <Card>
        <CardHeader title="Add identity provider" description="Store OIDC or SAML provider details for one organisation connection." />
        <form className="integration-form" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
          <label>Organisation connection<select value={connectionId} onChange={event => setConnectionId(event.target.value)} required><option value="">Choose a connection</option>{connections.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{connectionLabel(item)}</option>)}</select></label>
          <label>Protocol<select value={protocol} onChange={event => setProtocol(event.target.value as 'oidc' | 'saml')}><option value="oidc">OpenID Connect</option><option value="saml">SAML 2.0</option></select></label>
          <label className="integration-form__wide">Issuer URL<input type="url" value={issuer} onChange={event => setIssuer(event.target.value)} placeholder="https://identity.example.org" required /></label>
          {protocol === 'oidc' ? <label>Client ID<input value={clientId} onChange={event => setClientId(event.target.value)} required /></label> : <label>SAML metadata URL<input type="url" value={metadataUrl} onChange={event => setMetadataUrl(event.target.value)} placeholder="https://identity.example.org/metadata" required /></label>}
          <label className="integration-form__wide">Allowed email domains<input value={domains} onChange={event => setDomains(event.target.value)} placeholder="university.edu, students.university.edu" /><small>Comma-separated domains. Do not include the @ symbol.</small></label>
          <label className="integration-form__wide">Provider secret/config JSON<textarea value={providerConfig} onChange={event => setProviderConfig(event.target.value)} rows={4} spellCheck={false} /><small>Example OIDC JSON: {"{"}"client_secret":"your-provider-secret"{"}"}. Values are encrypted before storage.</small></label>
          <div className="integration-form__actions integration-form__wide"><span>Saved configurations start in draft status.</span><Button type="submit" disabled={!connectionId || !issuer.startsWith('https://') || save.isPending} loading={save.isPending}><LockKeyhole size={15} /> Save provider configuration</Button></div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Configured providers" description="Provider secrets are never returned to the browser." actions={<Button size="sm" variant="secondary" onClick={() => void query.refetch()} loading={query.isFetching}><RefreshCw size={14} /> Refresh</Button>} />
        {query.isLoading ? <p className="integration-muted">Loading identity providers…</p> : query.isError ? <Alert tone="danger">Could not load SSO providers. <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Retry</Button></Alert> : !configs.length ? <EmptyState icon={<LockKeyhole />} title="No identity providers configured" description="Add an OIDC or SAML provider for a registered organisation." /> : (
          <div className="integration-key-list">{configs.map(item => (
            <div className="integration-key-row" key={item.id}>
              <div><strong>{item.protocol.toUpperCase()} · {connections.find(c => c.id === item.integration_id)?.organization_name ?? 'Organisation'}</strong><small>{item.issuer_url}</small><div className="integration-key-scopes">{item.email_domains.map(domain => <code key={domain}>{domain}</code>)}</div></div>
              <div className="integration-key-meta"><StatusBadge status={item.status} /></div>
              <div className="integration-key-actions">{item.status === 'draft' || item.status === 'disabled' ? <Button size="sm" variant="secondary" onClick={() => changeStatus.mutate({ integrationId: item.integration_id, value: 'pending_verification' })}>Request verification</Button> : null}{item.status !== 'disabled' ? <Button size="sm" variant="secondary" onClick={() => changeStatus.mutate({ integrationId: item.integration_id, value: 'disabled' })}>Disable</Button> : null}</div>
            </div>
          ))}</div>
        )}
      </Card>
    </div>
  );
}

export function EmbedsPanel({ connections }: { connections: Connection[] }) {
  const [connectionId, setConnectionId] = useState('');
  const [title, setTitle] = useState('Internship opportunities');
  const [origins, setOrigins] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({
    queryKey: ['integration-embeds'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'list_embeds' } });
      functionError(error, data);
      return (data?.embeds ?? []) as Embed[];
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const allowedOrigins = origins.split(',').map(value => value.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke('integration-admin', {
        body: { action: 'create_embed', integration_id: connectionId, title: title.trim(), allowed_origins: allowedOrigins },
      });
      functionError(error, data);
      return data as { embed: Embed };
    },
    onSuccess: () => {
      setOrigins('');
      void queryClient.invalidateQueries({ queryKey: ['integration-embeds'] });
      toast({ title: 'Embed created', description: 'Use the generated iframe URL on the approved website.', tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Could not create embed', description: error.message, tone: 'error' }),
  });
  const status = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: 'active' | 'suspended' }) => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'set_embed_status', embed_id: id, status: value } });
      functionError(error, data);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['integration-embeds'] }),
    onError: (error: Error) => toast({ title: 'Could not update embed', description: error.message, tone: 'error' }),
  });
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const snippet = (embed: Embed) => `<iframe src="${baseUrl}/functions/v1/integration-embed?token=${embed.public_token}" title="${embed.title.replace(/"/g, '&quot;')}" width="100%" height="640" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast({ title: 'Embed snippet copied', tone: 'success' }); }
    catch { toast({ title: 'Clipboard unavailable', description: 'Copy the snippet manually.', tone: 'error' }); }
  };
  const embeds = query.data ?? [];
  return (
    <div className="integration-stack">
      <Alert tone="info" title="Tenant-scoped public opportunity embeds">
        Each embed has a random public token and a strict Content-Security-Policy frame-ancestors allowlist. Only published opportunities visible to the connected tenant are displayed.
      </Alert>
      <Card>
        <CardHeader title="Create opportunity embed" description="Allow only the HTTPS website origins that should be able to frame this embed." />
        <form className="integration-form" onSubmit={event => { event.preventDefault(); create.mutate(); }}>
          <label>Organisation connection<select value={connectionId} onChange={event => setConnectionId(event.target.value)} required><option value="">Choose a connection</option>{connections.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{connectionLabel(item)}</option>)}</select></label>
          <label>Embed title<input value={title} onChange={event => setTitle(event.target.value)} minLength={2} maxLength={120} required /></label>
          <label className="integration-form__wide">Allowed website origins<input value={origins} onChange={event => setOrigins(event.target.value)} placeholder="https://university.edu, https://careers.university.edu" required /><small>Use origins only: HTTPS scheme and hostname, with no path or trailing slash.</small></label>
          <div className="integration-form__actions integration-form__wide"><span>Only the connected organisation's published opportunities are exposed.</span><Button type="submit" disabled={!connectionId || title.trim().length < 2 || !origins.trim() || create.isPending} loading={create.isPending}><Code2 size={15} /> Generate embed</Button></div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Published embeds" description="Copy an iframe snippet or suspend a public embed token." actions={<Button size="sm" variant="secondary" onClick={() => void query.refetch()} loading={query.isFetching}><RefreshCw size={14} /> Refresh</Button>} />
        {query.isLoading ? <p className="integration-muted">Loading embeds…</p> : query.isError ? <Alert tone="danger">Could not load embeds. <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Retry</Button></Alert> : !embeds.length ? <EmptyState icon={<Code2 />} title="No embeds created" description="Create an embed to display tenant-visible opportunities on an approved website." /> : (
          <div className="integration-key-list">{embeds.map(embed => (
            <div className="integration-key-row" key={embed.id}>
              <div><strong>{embed.title}</strong><small>{connections.find(c => c.id === embed.integration_id)?.organization_name ?? 'Organisation'}</small><div className="integration-key-scopes">{embed.allowed_origins.map(origin => <code key={origin}>{origin}</code>)}</div></div>
              <div className="integration-key-meta"><StatusBadge status={embed.status} /></div>
              <div className="integration-key-actions"><Button size="sm" onClick={() => void copy(snippet(embed))}><Copy size={14} /> Copy iframe</Button><Button size="sm" variant="secondary" onClick={() => status.mutate({ id: embed.id, value: embed.status === 'active' ? 'suspended' : 'active' })}>{embed.status === 'active' ? 'Suspend' : 'Reactivate'}</Button></div>
            </div>
          ))}</div>
        )}
      </Card>
      <p className="integration-note"><ExternalLink size={14} /> The embed URL is public by design. Treat the token like a public identifier and rotate it by creating a replacement if it is shared beyond the approved website.</p>
    </div>
  );
}
