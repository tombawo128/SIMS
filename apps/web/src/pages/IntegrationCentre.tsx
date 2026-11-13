import { useState } from 'react';
import {
  Activity, ArrowUpRight, BookOpen, Check, ChevronRight, Code2, Copy,
  ExternalLink, Globe2, KeyRound, Link2, LockKeyhole, Plus, Radio,
  RefreshCw, ShieldCheck, Webhook, Workflow, X,
} from 'lucide-react';
import { PageHeader, Card, CardHeader, Button, Badge, Alert, EmptyState, useToast } from '@/components/ui';

type Section = 'overview' | 'api' | 'webhooks' | 'sso' | 'embed' | 'logs';

const navigation: { id: Section; label: string; icon: typeof Code2 }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'api', label: 'API management', icon: KeyRound },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'sso', label: 'Single sign-on', icon: LockKeyhole },
  { id: 'embed', label: 'Embed tools', icon: Code2 },
  { id: 'logs', label: 'Integration logs', icon: Radio },
];

const apiExample = `curl -X GET "https://api.sims.example/v1/placements" \\\
  -H "Authorization: Bearer YOUR_API_KEY" \\\
  -H "Accept: application/json"`;

const embedExample = `<iframe
  src="https://sims.example/embed/opportunities?tenant=YOUR_TENANT"
  title="SIMS internship opportunities"
  width="100%"
  height="640"
  loading="lazy">
</iframe>`;

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
  const { toast } = useToast();

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
      <PageHeader
        title="Integration Centre"
        description="Connect university and company systems to SIMS through secure, managed integrations."
        actions={<Badge tone="blue">Platform administration</Badge>}
      />

      <section className="integration-hero">
        <div className="integration-hero__content">
          <span className="integration-eyebrow"><Globe2 size={14} /> SIMS CONNECTIVITY</span>
          <h2>One platform. Connected organisations.</h2>
          <p>Manage API access, event notifications, single sign-on and embeddable SIMS experiences from one administration workspace.</p>
          <div className="integration-hero__meta">
            <span><i className="integration-dot" /> Integration services are not configured</span>
            <span><ShieldCheck size={15} /> Tenant-scoped access model</span>
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
              <button key={item.id} type="button" className={section === item.id ? 'integration-nav__item is-active' : 'integration-nav__item'} onClick={() => setSection(item.id)}>
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
            <div><span className="integration-eyebrow">CONFIGURATION</span><h2>{title}</h2></div>
            <Badge tone="slate">Not connected</Badge>
          </div>

          {section === 'overview' ? (
            <>
              <div className="integration-stats">
                <article><span className="integration-stat-icon"><Link2 size={18} /></span><strong>0</strong><small>Connected systems</small></article>
                <article><span className="integration-stat-icon"><KeyRound size={18} /></span><strong>0</strong><small>Active API credentials</small></article>
                <article><span className="integration-stat-icon"><Webhook size={18} /></span><strong>0</strong><small>Active webhooks</small></article>
                <article><span className="integration-stat-icon"><Activity size={18} /></span><strong>—</strong><small>Events delivered</small></article>
              </div>
              <div className="integration-card-grid">
                <Card><div className="integration-feature"><span><KeyRound /></span><div><h3>API management</h3><p>Issue organisation-scoped credentials and control access to approved SIMS resources.</p><button onClick={() => setSection('api')}>Explore API access <ArrowUpRight size={15} /></button></div></div></Card>
                <Card><div className="integration-feature"><span><Webhook /></span><div><h3>Webhooks</h3><p>Notify external systems when applications, placements or report statuses change.</p><button onClick={() => setSection('webhooks')}>Configure webhooks <ArrowUpRight size={15} /></button></div></div></Card>
                <Card><div className="integration-feature"><span><LockKeyhole /></span><div><h3>Single sign-on</h3><p>Plan secure sign-in with an organisation identity provider using OIDC or SAML.</p><button onClick={() => setSection('sso')}>Explore SSO <ArrowUpRight size={15} /></button></div></div></Card>
                <Card><div className="integration-feature"><span><Code2 /></span><div><h3>Embed tools</h3><p>Display approved SIMS opportunities on an organisation's existing website.</p><button onClick={() => setSection('embed')}>View embed tools <ArrowUpRight size={15} /></button></div></div></Card>
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
              <Alert tone="info" title="API credentials are not enabled yet">This screen documents the planned management workflow. No API key is generated or stored by this page. A server-side credential service and scoped API endpoints must be implemented before activation.</Alert>
              <Card><CardHeader title="API credentials" description="Each organisation should receive its own revocable credential with explicit scopes." actions={<Button disabled><Plus size={15} /> Create API key</Button>} /><EmptyState icon={<KeyRound />} title="No API credentials" description="Credentials will appear here after the secure API key service is implemented." /></Card>
              <Card><CardHeader title="Example API request" description="Illustrative request format only — the endpoint is not live." actions={<Button size="sm" variant="secondary" onClick={() => void copyText(apiExample, 'API request example')}>{copied === 'API request example' ? <Check size={14} /> : <Copy size={14} />} Copy</Button>} /><pre className="integration-code"><code>{apiExample}</code></pre></Card>
              <Card><CardHeader title="Planned permission scopes" /><div className="integration-scope-list"><span><code>placements:read</code><small>Read placements belonging to the connected tenant.</small></span><span><code>applications:read</code><small>Read permitted application records.</small></span><span><code>opportunities:write</code><small>Create or update approved opportunity records.</small></span><span><code>reports:read</code><small>Read approved reporting data.</small></span></div></Card>
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
              <Alert tone="info" title="No integration events recorded">Audit and delivery events will appear here after integration services are activated.</Alert>
              <Card><CardHeader title="Integration activity" description="Monitor authentication, API requests, webhook delivery and configuration changes." actions={<Button size="sm" variant="secondary" disabled><RefreshCw size={14} /> Refresh</Button>} /><EmptyState icon={<Activity />} title="No integration activity" description="There are no integration logs to display yet." /></Card>
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
