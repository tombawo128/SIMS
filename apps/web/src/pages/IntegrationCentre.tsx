import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Activity, ArrowUpRight, BookOpen, Check, ChevronRight, Code2, Copy,
  ExternalLink, Globe2, KeyRound, Link2, LockKeyhole, Plus, Radio,
  RefreshCw, ShieldCheck, Webhook, Workflow,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Alert, EmptyState, useToast } from '@/components/ui';

type Section = 'overview' | 'api' | 'webhooks' | 'sso' | 'embed' | 'logs';
type IntegrationConnection = {
  id: string; name: string; organization_type: 'university' | 'company';
  organization_name: string; status: 'active' | 'suspended'; created_at: string;
};
type IntegrationApiKey = {
  id: string; integration_id: string; name: string; key_prefix: string;
  scopes: string[]; expires_at: string | null; last_used_at: string | null;
  revoked_at: string | null; created_at: string;
};
type IntegrationAuditEvent = {
  id: number; actor_id: string | null; entity: string; entity_id: string | null;
  action: string; metadata: Record<string, unknown>; created_at: string;
};
const integrationScopes = [
  { value: 'organisation:read', label: 'Organisation details' },
  { value: 'opportunities:read', label: 'Published opportunities' },
  { value: 'applications:read', label: 'Applications' },
  { value: 'placements:read', label: 'Placements and grades' },
];

const navigation: { id: Section; label: string; icon: typeof Code2 }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'api', label: 'API management', icon: KeyRound },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'sso', label: 'Single sign-on', icon: LockKeyhole },
  { id: 'embed', label: 'Embed tools', icon: Code2 },
  { id: 'logs', label: 'Integration logs', icon: Radio },
];

const apiExample = `curl -X GET "https://YOUR_PROJECT_REF.supabase.co/functions/v1/integration-api/v1/placements" \\\
  -H "Authorization: Bearer YOUR_API_KEY" \\\
  -H "Accept: application/json"`;

const embedExample = `<iframe
  src="https://sims.example/embed/opportunities?tenant=YOUR_TENANT"
  title="SIMS internship opportunities"
  width="100%"
  height="640"
  loading="lazy">
</iframe>`;

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isKeyExpired(key: IntegrationApiKey) {
  return Boolean(key.expires_at && new Date(key.expires_at).getTime() <= Date.now());
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="integration-empty">
      <span className="integration-empty__icon"><Workflow size={22} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      <Badge tone="amber">Backend setup required</Badge>
    </div>
  );
}

export function IntegrationCentre() {
  const [section, setSection] = useState<Section>('overview');
  const [copied, setCopied] = useState('');
  const [orgType, setOrgType] = useState<'university' | 'company'>('university');
  const [orgId, setOrgId] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [keyName, setKeyName] = useState('Production API key');
  const [keyConnectionId, setKeyConnectionId] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['organisation:read', 'opportunities:read']);
  const [keyExpiry, setKeyExpiry] = useState('');
  const [oneTimeSecret, setOneTimeSecret] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const integrationData = useQuery({
    queryKey: ['integration-centre-data'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'list' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { connections: IntegrationConnection[]; api_keys: IntegrationApiKey[] };
    },
  });
  const logsQuery = useQuery({
    queryKey: ['integration-centre-audit-events'],
    enabled: section === 'logs',
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs')
        .select('id,actor_id,entity,entity_id,action,metadata,created_at')
        .in('entity', ['integration_connection', 'integration_api_key', 'integration_api_request'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as IntegrationAuditEvent[];
    },
  });
  const organizations = useQuery({
    queryKey: ['integration-organisations', orgType],
    queryFn: async () => {
      const { data, error } = await supabase.from(orgType === 'university' ? 'universities' : 'companies')
        .select('id,name').eq('status', 'active').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const createConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-admin', {
        body: { action: 'create_connection', name: connectionName.trim(), organization_type: orgType, organization_id: orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setConnectionName('');
      setOrgId('');
      void queryClient.invalidateQueries({ queryKey: ['integration-centre-data'] });
      toast({ title: 'Organisation system registered', description: 'The integration connection is ready for API credentials.', tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Could not register system', description: error.message, tone: 'error' }),
  });
  const createApiKey = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-admin', {
        body: { action: 'create_api_key', name: keyName.trim(), integration_id: keyConnectionId, scopes: selectedScopes, expires_at: keyExpiry || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { secret: string; api_key: IntegrationApiKey };
    },
    onSuccess: (data) => {
      setOneTimeSecret(data.secret);
      setKeyName('Production API key');
      setKeyExpiry('');
      void queryClient.invalidateQueries({ queryKey: ['integration-centre-data'] });
      toast({ title: 'API credential created', description: 'Copy the secret now. It will not be shown again.', tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Could not create API credential', description: error.message, tone: 'error' }),
  });
  const revokeApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'revoke_api_key', key_id: keyId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['integration-centre-data'] });
      toast({ title: 'API credential revoked', description: 'Requests using this key will be rejected.', tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Could not revoke API credential', description: error.message, tone: 'error' }),
  });
  const setConnectionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' }) => {
      const { data, error } = await supabase.functions.invoke('integration-admin', { body: { action: 'set_connection_status', integration_id: id, status } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['integration-centre-data'] }),
    onError: (error: Error) => toast({ title: 'Could not update connection', description: error.message, tone: 'error' }),
  });
  const connections = integrationData.data?.connections ?? [];
  const apiKeys = integrationData.data?.api_keys ?? [];
  const today = localDateValue(new Date());
  const maxExpiry = new Date();
  maxExpiry.setFullYear(maxExpiry.getFullYear() + 1);
  const maxExpiryDate = localDateValue(maxExpiry);
  const revokeKey = (key: IntegrationApiKey) => {
    if (!window.confirm(`Revoke the API credential "${key.name}"? Any system using it will immediately lose access.`)) return;
    revokeApiKey.mutate(key.id);
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast({ title: 'Copied to clipboard', description: label, tone: 'success' });
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      toast({ title: 'Clipboard unavailable', description: 'Copy the example manually.', tone: 'error' });
    }
  };

  const title = navigation.find(item => item.id === section)?.label ?? 'Integration Centre';

  return (
    <div className="integration-centre">
      <section className="integration-hero">
        <div className="integration-hero__content">
          <span className="integration-eyebrow"><Globe2 size={14} /> SIMS CONNECTIVITY</span>
          <h1>Bring every organisation system together.</h1>
          <p>A secure control centre for registering university and company systems, issuing scoped API credentials and managing access to SIMS data.</p>
          <div className="integration-hero__meta">
            <span><i className="integration-dot" /> {connections.filter(item => item.status === 'active').length} active connection(s)</span>
            <span><ShieldCheck size={15} /> Tenant-scoped access model</span>
            <span><Badge tone="blue">Platform administration</Badge></span>
          </div>
        </div>
        <div className="integration-hero__art" aria-hidden="true">
          <div className="integration-orbit integration-orbit--one" />
          <div className="integration-orbit integration-orbit--two" />
          <div className="integration-node integration-node--main"><GraduationCapFallback /></div>
          <div className="integration-node integration-node--top"><BuildingIcon /></div>
          <div className="integration-node integration-node--bottom"><Code2 size={18} /></div>
          <div className="integration-node integration-node--right"><Webhook size={18} /></div>
        </div>
      </section>

      <div className="integration-layout">
        <aside className="integration-nav" aria-label="Integration sections">
          <p className="integration-nav__label">WORKSPACE</p>
          {navigation.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" aria-current={section === item.id ? 'page' : undefined} className={section === item.id ? 'integration-nav__item is-active' : 'integration-nav__item'} onClick={() => setSection(item.id)}>
                <Icon size={17} /><span>{item.label}</span><ChevronRight size={15} />
              </button>
            );
          })}
          <div className="integration-nav__help">
            <BookOpen size={17} />
            <strong>Integration guide</strong>
            <span>Technical setup documentation will live here.</span>
          </div>
        </aside>

        <div className="integration-main">
          <div className="integration-section-heading">
            <div><span className="integration-eyebrow">WORKSPACE / CONFIGURATION</span><h2>{title}</h2></div>
            <Badge tone={section === "overview" ? "blue" : "slate"}>{section === "overview" ? "Integration workspace" : "Configuration"}</Badge>
          </div>

          {section === 'overview' ? (
            <>
              <div className="integration-stats">
                <article><span className="integration-stat-icon"><Link2 size={18} /></span><strong>{connections.filter(item => item.status === 'active').length}</strong><small>Active connections</small><em>Organisation systems</em></article>
                <article><span className="integration-stat-icon"><KeyRound size={18} /></span><strong>{apiKeys.filter(key => !key.revoked_at && !isKeyExpired(key)).length}</strong><small>Active API keys</small><em>Credentials in use</em></article>
                <article><span className="integration-stat-icon"><ShieldCheck size={18} /></span><strong>{connections.filter(item => item.status === 'suspended').length}</strong><small>Suspended systems</small><em>Access paused</em></article>
                <article><span className="integration-stat-icon"><Code2 size={18} /></span><strong>{integrationScopes.length}</strong><small>Available scopes</small><em>Read-only permissions</em></article>
              </div>

              <div className="integration-overview-grid">
                <Card>
                  <CardHeader title="Register a system" description="Connect an active SIMS university or company tenant." />
                  <form className="integration-form integration-form--register" onSubmit={event => { event.preventDefault(); createConnection.mutate(); }}>
                    <label>Organisation type
                      <select value={orgType} onChange={event => { setOrgType(event.target.value as 'university' | 'company'); setOrgId(''); }}>
                        <option value="university">University</option><option value="company">Company</option>
                      </select>
                    </label>
                    <label>Organisation
                      <select value={orgId} onChange={event => setOrgId(event.target.value)} required disabled={organizations.isLoading || organizations.isError || !(organizations.data?.length)}>
                        <option value="">Choose an active {orgType}</option>
                        {(organizations.data ?? []).map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                      </select>
                    </label>
                    <label className="integration-form__wide">Connected system name
                      <input value={connectionName} onChange={event => setConnectionName(event.target.value)} minLength={2} maxLength={100} placeholder="e.g. University student portal" required />
                    </label>
                    {organizations.isLoading ? <p className="integration-muted integration-form__wide">Loading active organisations…</p> : null}
                    {organizations.isError ? <div className="integration-form__wide"><Alert tone="danger">Could not load organisations. <Button size="sm" variant="secondary" onClick={() => void organizations.refetch()}>Retry</Button></Alert></div> : null}
                    <div className="integration-form__actions integration-form__wide">
                      <span>One connection is assigned to one organisation.</span>
                      <Button type="submit" disabled={!orgId || connectionName.trim().length < 2 || createConnection.isPending} loading={createConnection.isPending}><Plus size={15} /> Register system</Button>
                    </div>
                  </form>
                </Card>
                <Card>
                  <CardHeader title="Connected systems" description="Monitor registered organisation connections and access status." actions={<Badge tone="slate">{connections.length} total</Badge>} />
                  {integrationData.isLoading ? <p className="integration-muted integration-systems-state">Loading registered systems…</p> : integrationData.isError ? <div className="integration-systems-state"><Alert tone="danger" title="Could not load integrations">{(integrationData.error as Error).message} <Button size="sm" variant="secondary" onClick={() => void integrationData.refetch()}>Retry</Button></Alert></div> : (
                    <div className="integration-connection-list">
                      {connections.length === 0 ? (
                        <div className="integration-systems-empty">
                          <span><Link2 size={20} /></span>
                          <strong>No systems connected yet</strong>
                          <p>Your registered university and company systems will appear here. Create the first connection using the form.</p>
                        </div>
                      ) : connections.map(connection => (
                        <div className="integration-connection-row" key={connection.id}>
                          <div><strong>{connection.name}</strong><small>{connection.organization_name} · {connection.organization_type}</small></div>
                          <Badge tone={connection.status === 'active' ? 'emerald' : 'amber'}>{connection.status}</Badge>
                          <Button size="sm" variant="secondary" onClick={() => setConnectionStatus.mutate({ id: connection.id, status: connection.status === 'active' ? 'suspended' : 'active' })} disabled={setConnectionStatus.isPending}>{connection.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
              <div className="integration-card-grid">
                <Card><div className="integration-feature"><span><KeyRound /></span><div><h3>API management</h3><p>Issue organisation-scoped credentials and control access to approved SIMS resources.</p><button type="button" onClick={() => setSection('api')}>Explore API access <ArrowUpRight size={15} /></button></div></div></Card>
                <Card><div className="integration-feature"><span><Webhook /></span><div><h3>Webhooks</h3><p>Notify external systems when applications, placements or report statuses change.</p><button type="button" onClick={() => setSection('webhooks')}>Configure webhooks <ArrowUpRight size={15} /></button></div></div></Card>
                <Card><div className="integration-feature"><span><LockKeyhole /></span><div><h3>Single sign-on</h3><p>Plan secure sign-in with an organisation identity provider using OIDC or SAML.</p><button type="button" onClick={() => setSection('sso')}>Explore SSO <ArrowUpRight size={15} /></button></div></div></Card>
                <Card><div className="integration-feature"><span><Code2 /></span><div><h3>Embed tools</h3><p>Display approved SIMS opportunities on an organisation's existing website.</p><button type="button" onClick={() => setSection('embed')}>View embed tools <ArrowUpRight size={15} /></button></div></div></Card>
              </div>
              <Card>
                <CardHeader title="Recommended setup sequence" description="A practical rollout path for each university or company." />
                <div className="integration-steps">
                  <div><b>01</b><span><strong>Register the organisation</strong><small>Confirm tenant ownership, domain and integration contact.</small></span><Badge tone="slate">Foundation</Badge></div>
                  <div><b>02</b><span><strong>Define data permissions</strong><small>Agree which records and events the external system may access.</small></span><Badge tone="slate">Security</Badge></div>
                  <div><b>03</b><span><strong>Connect the system</strong><small>Configure API credentials, webhooks or single sign-on.</small></span><Badge tone="slate">Connection</Badge></div>
                  <div><b>04</b><span><strong>Test and activate</strong><small>Validate delivery, access boundaries and audit events before launch.</small></span><Badge tone="slate">Go-live</Badge></div>
                </div>
              </Card>
            </>
          ) : null}


          {section === 'api' ? (
            <div className="integration-stack">
              <Alert tone="info" title="API credentials are managed securely">Keys are generated server-side, stored only as SHA-256 hashes, and displayed once. Each key is limited to one organisation and its selected scopes.</Alert>
              <Card>
                <CardHeader title="Create API credential" description="Use a separate key for each external application. Revoke keys immediately if they are exposed." />
                <form className="integration-form" onSubmit={event => { event.preventDefault(); createApiKey.mutate(); }}>
                  <label>Organisation connection
                    <select value={keyConnectionId} onChange={event => setKeyConnectionId(event.target.value)} required>
                      <option value="">Choose a registered connection</option>
                      {connections.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.organization_name} — {item.name}</option>)}
                    </select>
                  </label>
                  <label>Credential name
                    <input value={keyName} onChange={event => setKeyName(event.target.value)} minLength={2} maxLength={100} required />
                  </label>
                  <label>Expiry date (optional, maximum 12 months)
                    <input type="date" value={keyExpiry} min={today} max={maxExpiryDate} onChange={event => setKeyExpiry(event.target.value)} />
                  </label>
                  <fieldset><legend>Permission scopes</legend>
                    <div className="integration-scope-checks">
                      {integrationScopes.map(scope => <label key={scope.value}><input type="checkbox" checked={selectedScopes.includes(scope.value)} onChange={event => setSelectedScopes(current => event.target.checked ? [...current, scope.value] : current.filter(item => item !== scope.value))} />{scope.label}<code>{scope.value}</code></label>)}
                    </div>
                  </fieldset>
                  <div className="integration-form__actions"><span>Read-only access in this first API release.</span><Button type="submit" disabled={!keyConnectionId || keyName.trim().length < 2 || selectedScopes.length === 0 || createApiKey.isPending || Boolean(oneTimeSecret)} loading={createApiKey.isPending}><KeyRound size={15} /> Generate API key</Button></div>
                </form>
                {oneTimeSecret ? <div className="integration-secret-panel"><strong>Copy your new API key now</strong><p>This is the only time SIMS will display the full secret. Save or dismiss it before generating another key.</p><code>{oneTimeSecret}</code><Button size="sm" onClick={() => void copyText(oneTimeSecret, 'New API key')}>{copied === 'New API key' ? <Check size={14} /> : <Copy size={14} />} Copy secret</Button><button type="button" onClick={() => setOneTimeSecret('')}>I have saved it</button></div> : null}
              </Card>
              <Card>
                <CardHeader title="Issued credentials" description="Only key prefixes are visible. Full secrets are never retrievable." actions={<Button size="sm" variant="secondary" onClick={() => void integrationData.refetch()}><RefreshCw size={14} /> Refresh</Button>} />
                {integrationData.isLoading ? <p className="integration-muted">Loading API credentials…</p> : integrationData.isError ? <Alert tone="danger">Could not load API credentials. <Button size="sm" variant="secondary" onClick={() => void integrationData.refetch()}>Retry</Button></Alert> : apiKeys.length === 0 ? <EmptyState icon={<KeyRound />} title="No API credentials" description="Register a system and generate its first API key." /> : <div className="integration-key-list">{apiKeys.map(key => {
                  const connection = connections.find(item => item.id === key.integration_id);
                  return <div className="integration-key-row" key={key.id}>
                    <div><strong>{key.name}</strong><small>{connection?.organization_name ?? 'Organisation'} · {key.key_prefix}…</small><div className="integration-key-scopes">{key.scopes.map(scope => <code key={scope}>{scope}</code>)}</div></div>
                    <div className="integration-key-meta"><Badge tone={key.revoked_at ? 'slate' : isKeyExpired(key) ? 'amber' : 'emerald'}>{key.revoked_at ? 'Revoked' : isKeyExpired(key) ? 'Expired' : 'Active'}</Badge><small>{key.expires_at ? 'Expires '+new Date(key.expires_at).toLocaleDateString() : 'No expiry'}</small><small>{key.last_used_at ? 'Last used '+new Date(key.last_used_at).toLocaleString() : 'Never used'}</small></div>
                    {!key.revoked_at ? <Button size="sm" variant="secondary" onClick={() => revokeKey(key)} disabled={revokeApiKey.isPending}>Revoke</Button> : null}
                  </div>;
                })}</div>}
              </Card>
              <Card><CardHeader title="API request example" description="The API gateway enforces the credential's organisation and permission scopes." actions={<Button size="sm" variant="secondary" onClick={() => void copyText(apiExample, 'API request example')}>{copied === 'API request example' ? <Check size={14} /> : <Copy size={14} />} Copy</Button>} /><pre className="integration-code"><code>{apiExample}</code></pre><div className="integration-note">Available endpoints: /v1/organisation, /v1/opportunities, /v1/applications and /v1/placements. Read-only access, maximum 100 records per request.</div></Card>
            </div>
          ) : null}
          {section === 'webhooks' ? (
            <div className="integration-stack">
              <Alert tone="info" title="Webhook delivery is not active">Endpoint registration, signing secrets, retry handling and delivery logs require backend services. The controls below are intentionally inactive until those services exist.</Alert>
              <Card><CardHeader title="Registered endpoints" description="Send signed event payloads to an organisation-owned HTTPS endpoint." actions={<Button disabled><Plus size={15} /> Add endpoint</Button>} /><EmptyState icon={<Webhook />} title="No webhook endpoints" description="Configured endpoints and their delivery health will appear here." /></Card>
              <Card><CardHeader title="Available event catalogue" description="Events planned for the first integration release." /><div className="integration-event-list">{['application.submitted','application.status_changed','placement.created','placement.completed','weekly_report.submitted','weekly_report.reviewed','evaluation.completed'].map(event => <div key={event}><code>{event}</code><Badge tone="slate">Planned</Badge></div>)}</div></Card>
            </div>
          ) : null}

          {section === 'sso' ? (
            <div className="integration-stack">
              <Alert tone="info" title="SSO providers are not connected">OpenID Connect should be implemented first, followed by SAML 2.0 for institutions that require it. Provider secrets must be stored server-side.</Alert>
              <Card><CardHeader title="Identity provider" description="Connect the organisation's identity provider to SIMS." /><div className="integration-provider-grid"><article><span className="integration-provider-mark">OIDC</span><strong>OpenID Connect</strong><small>Recommended first implementation</small><Badge tone="amber">Not configured</Badge></article><article><span className="integration-provider-mark">SAML</span><strong>SAML 2.0</strong><small>For enterprise and institutional identity</small><Badge tone="slate">Planned</Badge></article></div><div className="integration-disabled-actions"><Button disabled>Configure identity provider</Button><span>Requires callback handling, domain verification and server-side secret storage.</span></div></Card>
              <Card><CardHeader title="Domain verification" description="Restrict organisation sign-in to verified email domains." /><ComingSoon title="No verified domains" description="Domain ownership checks and account-to-tenant mapping will be added with SSO." /></Card>
            </div>
          ) : null}

          {section === 'embed' ? (
            <div className="integration-stack">
              <Alert tone="info" title="Embeds are examples only">The snippet below is a proposed integration format. A public, tenant-aware embed route and content security policy must be added before organisations can use it.</Alert>
              <Card><CardHeader title="Opportunity listing embed" description="An example iframe organisations could place on their careers or student portal." actions={<Button size="sm" variant="secondary" onClick={() => void copyText(embedExample, 'Embed snippet')}>{copied === 'Embed snippet' ? <Check size={14} /> : <Copy size={14} />} Copy snippet</Button>} /><pre className="integration-code"><code>{embedExample}</code></pre><div className="integration-note"><ExternalLink size={15} /> Tenant ID, allowed origin and displayed fields must be configured before publishing.</div></Card>
              <Card><CardHeader title="Branding controls" description="Future white-label options for connected organisations." /><div className="integration-brand-options"><span>Organisation logo <Badge tone="slate">Planned</Badge></span><span>Accent colour <Badge tone="slate">Planned</Badge></span><span>Custom domain <Badge tone="slate">Planned</Badge></span></div></Card>
            </div>
          ) : null}

          {section === 'logs' ? (
            <div className="integration-stack">
              {logsQuery.isError ? <Alert tone="danger" title="Integration activity could not be loaded">Check platform administrator access and retry.</Alert> : null}
              <Card>
                <CardHeader
                  title="Integration activity"
                  description="Recent connection and API-credential administration events. API request and webhook delivery telemetry are not yet part of this read-only API release."
                  actions={<Button size="sm" variant="secondary" onClick={() => void logsQuery.refetch()} loading={logsQuery.isFetching}><RefreshCw size={14} /> Refresh</Button>}
                />
                {logsQuery.isLoading ? (
                  <div className="integration-empty">Loading integration activity…</div>
                ) : logsQuery.data?.length ? (
                  <div className="integration-activity-list">
                    {logsQuery.data.map((event) => (
                      <article className="integration-activity-row" key={event.id}>
                        <span className="integration-activity-row__icon"><Activity size={16} /></span>
                        <div className="integration-activity-row__body">
                          <strong>{event.action.replaceAll('_', ' ')}</strong>
                          <span>
                            {event.entity.replaceAll('_', ' ')}
                            {typeof event.metadata.path === 'string' ? ` · ${event.metadata.path}` : ''}
                            {typeof event.metadata.status_code === 'number' ? ` · HTTP ${event.metadata.status_code}` : ''}
                            {event.entity_id ? ` · ${event.entity_id}` : ''}
                          </span>
                          <small>{new Date(event.created_at).toLocaleString()} · {event.actor_id ? `Actor ${event.actor_id}` : 'System or API event'}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<Activity />} title="No integration activity yet" description="Connection and credential changes will appear here when they occur." />
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GraduationCapFallback() {
  return <span className="integration-main-glyph">S</span>;
}
function BuildingIcon() {
  return <span className="integration-building-glyph">ORG</span>;
}
