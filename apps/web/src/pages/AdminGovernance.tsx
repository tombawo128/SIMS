import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Activity, AlertCircle, Archive, ArrowUpRight, CheckCircle2, CircleHelp, Database, FileSearch, Fingerprint, LifeBuoy, LockKeyhole, RefreshCw, ShieldCheck, ShieldAlert, Server, Ticket, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, EmptyState, Spinner, Table, Th, Td, Alert } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const when = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function AdminModuleHeader({ title, description, icon }: { title: string; description: string; icon: ReactNode }) {
  return <section className='page-hero admin-page-hero admin-module-hero'><div><span className='page-hero__eyebrow'>SIMS ADMINISTRATION</span><h1>{title}</h1><p>{description}</p></div><span className='admin-module-hero__icon'>{icon}</span></section>;
}

type HealthCheck = { label: string; detail: string; ok: boolean; count: number | null; error?: string };

export function ComplianceDataManagement() {
  const health = useQuery({
    queryKey: ['admin-compliance-health'],
    queryFn: async (): Promise<HealthCheck[]> => {
      const checks = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('universities').select('id', { count: 'exact', head: true }),
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
        supabase.from('system_alerts').select('id', { count: 'exact', head: true }).is('resolved_at', null),
        supabase.from('deleted_entities').select('id', { count: 'exact', head: true }).is('restored_at', null),
      ]);
      const labels = [
        ['User profile data', 'Profiles table and Data API'],
        ['University directory', 'University records and Data API'],
        ['Company directory', 'Company records and Data API'],
        ['Audit trail', 'Administrative audit log access'],
        ['System alerts', 'Open operational alerts'],
        ['Archive register', 'Unrestored archived records'],
      ];
      return checks.map((result, index) => ({
        label: labels[index][0], detail: labels[index][1], ok: !result.error,
        count: result.count ?? null, error: result.error?.message,
      }));
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });
  const audit = useQuery({
    queryKey: ['admin-compliance-recent-audit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs')
        .select('id,actor_id,entity,action,created_at')
        .order('created_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });
  const checks = health.data ?? [];
  const failed = checks.filter(item => !item.ok).length;
  const openAlerts = checks.find(item => item.label === 'System alerts')?.count ?? 0;
  const archived = checks.find(item => item.label === 'Archive register')?.count ?? 0;

  return <div className='admin-console admin-module-page'>
    <AdminModuleHeader title='Compliance & data management' description='Monitor core data access, review the audit trail and keep archived records under administrative control.' icon={<ShieldCheck size={23} />} />
    <section className='admin-module-summary'>
      <article><span className='admin-module-summary__icon'><Server size={18}/></span><div><small>Core data services</small><strong>{health.isLoading ? 'Checking…' : health.isError || failed ? 'Attention required' : 'Responding'}</strong><p>Live read checks against SIMS data tables</p></div></article>
      <article><span className='admin-module-summary__icon'><TriangleAlert size={18}/></span><div><small>Open system alerts</small><strong>{health.isLoading ? '—' : openAlerts.toLocaleString()}</strong><p>Unresolved operational alerts</p></div></article>
      <article><span className='admin-module-summary__icon'><Archive size={18}/></span><div><small>Archived records</small><strong>{health.isLoading ? '—' : archived.toLocaleString()}</strong><p>Available in the recycle bin</p></div></article>
    </section>
    <Card>
      <CardHeader title='System health & service checks' description='A successful check confirms the SIMS application can read that core data source. This is not a full infrastructure or uptime monitor.' actions={<Button size='sm' variant='secondary' onClick={() => void health.refetch()} loading={health.isFetching}><RefreshCw size={14}/> Refresh checks</Button>} />
      {health.isLoading ? <div className='admin-console__loading'><Spinner/></div> : health.isError ? <Alert tone='danger' title='Health checks failed'>{(health.error as Error).message}</Alert> : <div className='admin-module-health-list'>
        {checks.map(item => <div className='admin-module-health-row' key={item.label}><span className={item.ok ? 'admin-module-health-dot is-ok' : 'admin-module-health-dot is-error'}>{item.ok ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}</span><div><strong>{item.label}</strong><small>{item.ok ? item.detail : item.error}</small></div><span className={item.ok ? 'admin-module-status is-ok' : 'admin-module-status is-error'}>{item.ok ? 'Accessible' : 'Check failed'}</span>{item.count !== null ? <b>{item.count.toLocaleString()}</b> : null}</div>)}
      </div>}
    </Card>
    <section className='admin-module-grid'>
      <Card><CardHeader title='Data governance' description='Safe access to existing retention and recovery controls.'/><div className='admin-module-action-list'>
        <Link to='/recycle-bin' className='admin-module-action'><span><Archive size={18}/></span><div><strong>Archived records</strong><small>Review and restore archived users, universities and companies.</small></div><ArrowUpRight size={16}/></Link>
        <Link to='/admin/activity-logs' className='admin-module-action'><span><FileSearch size={18}/></span><div><strong>Audit trail</strong><small>Inspect administrative actions and changes recorded by SIMS.</small></div><ArrowUpRight size={16}/></Link>
        <Link to='/admin/system-alerts' className='admin-module-action'><span><AlertCircle size={18}/></span><div><strong>Operational alerts</strong><small>Review and resolve internal system alerts.</small></div><ArrowUpRight size={16}/></Link>
      </div></Card>
      <Card><CardHeader title='Recent audit activity' description='Latest eight administrative events.'/>
        {audit.isLoading ? <div className='admin-console__loading'><Spinner/></div> : audit.isError ? <Alert tone='danger'>{(audit.error as Error).message}</Alert> : !audit.data?.length ? <EmptyState icon={<Activity/>} title='No audit events' description='Recorded administrative actions will appear here.'/> : <div className='admin-module-audit-list'>{audit.data.map(row => <div key={row.id}><span><Activity size={15}/></span><div><strong>{row.action.replaceAll('_',' ')}</strong><small>{row.entity} · {row.actor_id ? row.actor_id.slice(0,8)+'…' : 'System'}</small></div><time>{when(row.created_at)}</time></div>)}</div>}
      </Card>
    </section>
    <p className='admin-module-footnote'>Health checks cover application-level database access only. Backup schedules, storage availability, edge-function uptime and formal compliance certification are not verified by this page.</p>
  </div>;
}

export function SupportModeration() {
  return <div className='admin-console admin-module-page'>
    <AdminModuleHeader title='Support & moderation' description='A central workspace for user support, ticket triage and content safety review.' icon={<LifeBuoy size={23}/>} />
    <section className='admin-module-summary'>
      <article><span className='admin-module-summary__icon'><Ticket size={18}/></span><div><small>Support tickets</small><strong>Not connected</strong><p>Ticket intake and assignment are not yet configured</p></div></article>
      <article><span className='admin-module-summary__icon'><ShieldAlert size={18}/></span><div><small>Moderation queue</small><strong>Not connected</strong><p>No content-report queue is currently configured</p></div></article>
      <article><span className='admin-module-summary__icon'><CircleHelp size={18}/></span><div><small>Existing admin support</small><strong>Available</strong><p>System alerts and activity records</p></div></article>
    </section>
    <section className='admin-module-grid'>
      <Card><CardHeader title='Support ticket management' description='The intended workflow for user-reported issues.'/><div className='admin-module-feature'>
        <span className='admin-module-feature__icon'><Ticket size={21}/></span><Badge tone='amber'>Backend required</Badge>
        <h3>Ticket inbox</h3><p>Ticket submission, categories, priority, assignment, threaded replies, status changes and resolution history need a dedicated support-ticket data model and user-facing intake.</p>
        <ul><li>Track open, in-progress and resolved tickets</li><li>Assign cases to an administrator</li><li>Keep staff replies and internal notes separate</li><li>Record response and resolution timestamps</li></ul>
      </div></Card>
      <Card><CardHeader title='Content moderation' description='The intended workflow for reported content.'/><div className='admin-module-feature'>
        <span className='admin-module-feature__icon'><ShieldAlert size={21}/></span><Badge tone='amber'>Backend required</Badge>
        <h3>Moderation review queue</h3><p>SIMS does not currently have a content-report table or moderation actions connected to its content records. This queue must be wired before moderators can take action.</p>
        <ul><li>Capture reported content and reason</li><li>Review evidence and reporter context</li><li>Dismiss, escalate or action a report</li><li>Keep a complete moderation decision trail</li></ul>
      </div></Card>
    </section>
    <Card><CardHeader title='Available administrator tools' description='Existing tools that can help investigate operational issues today.'/><div className='admin-module-action-list'>
      <Link to='/admin/system-alerts' className='admin-module-action'><span><AlertCircle size={18}/></span><div><strong>System alerts</strong><small>Record and resolve internal platform incidents.</small></div><ArrowUpRight size={16}/></Link>
      <Link to='/admin/activity-logs' className='admin-module-action'><span><Activity size={18}/></span><div><strong>Activity logs</strong><small>Review administrative actions and platform changes.</small></div><ArrowUpRight size={16}/></Link>
    </div></Card>
    <div className='admin-module-notice'><AlertCircle size={17}/><p><strong>Important:</strong> This section is a transparent control-centre shell, not a live ticketing or moderation system. No tickets or moderation reports are being fabricated or stored in browser-only state.</p></div>
  </div>;
}

export function SecurityAuthentication() {
  const audit = useQuery({
    queryKey: ['admin-security-audit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs')
        .select('id,actor_id,entity,action,metadata,created_at')
        .order('created_at', { ascending: false }).limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  return <div className='admin-console admin-module-page'>
    <AdminModuleHeader title='Security & authentication' description='Review application audit activity and access the secure controls for SSO and authentication monitoring.' icon={<LockKeyhole size={23}/>} />
    <section className='admin-module-summary'>
      <article><span className='admin-module-summary__icon'><Fingerprint size={18}/></span><div><small>SSO configuration</small><strong>External control</strong><p>Managed through Supabase Auth</p></div></article>
      <article><span className='admin-module-summary__icon'><ShieldAlert size={18}/></span><div><small>Failed login tracking</small><strong>Not exposed</strong><p>Auth audit events are not available in the SIMS client</p></div></article>
      <article><span className='admin-module-summary__icon'><Activity size={18}/></span><div><small>Application audit</small><strong>{audit.isLoading ? 'Loading…' : audit.isError ? 'Unavailable' : (audit.data?.length ?? 0).toLocaleString()}</strong><p>Latest application-level audit events loaded</p></div></article>
    </section>
    <section className='admin-module-grid'>
      <Card><CardHeader title='Single Sign-On (SSO)' description='Configure identity-provider settings through the trusted authentication control plane.'/><div className='admin-module-feature'>
        <span className='admin-module-feature__icon'><Fingerprint size={21}/></span><Badge tone='blue'>Supabase Auth</Badge>
        <h3>SAML identity providers</h3><p>Provider registration, metadata, domain mapping and enable/disable operations are owned by Supabase Auth. SIMS does not write directly to the private auth schema.</p>
        <a className='admin-module-external' href='https://supabase.com/dashboard/project/bdndnacbasmfndzylwpb/auth/providers' target='_blank' rel='noreferrer'>Open authentication provider settings <ArrowUpRight size={15}/></a>
      </div></Card>
      <Card><CardHeader title='Failed login attempts' description='Authentication security events and suspicious sign-in activity.'/><div className='admin-module-feature'>
        <span className='admin-module-feature__icon'><ShieldAlert size={21}/></span><Badge tone='amber'>Integration required</Badge>
        <h3>Authentication event feed</h3><p>Supabase stores authentication audit events separately from the public SIMS audit trail. The current project database returned no auth audit entries during inspection, so SIMS cannot currently show or count failed attempts.</p>
        <p className='admin-module-feature__hint'>A privileged server-side reader and confirmed failed-login event mapping are required before this can be enabled safely. Do not expose service-role credentials in the browser.</p>
        <a className='admin-module-external' href='https://supabase.com/dashboard/project/bdndnacbasmfndzylwpb' target='_blank' rel='noreferrer'>Open Supabase project dashboard <ArrowUpRight size={15}/></a>
      </div></Card>
    </section>
    <Card><CardHeader title='Recent application audit events' description='This is the public SIMS audit trail, not the private authentication audit log.' actions={<Button size='sm' variant='secondary' onClick={() => void audit.refetch()} loading={audit.isFetching}><RefreshCw size={14}/> Refresh</Button>}/>
      {audit.isLoading ? <div className='admin-console__loading'><Spinner/></div> : audit.isError ? <Alert tone='danger' title='Audit events unavailable'>{(audit.error as Error).message}</Alert> : !audit.data?.length ? <EmptyState icon={<Activity/>} title='No application audit events' description='Application events will appear here when recorded.'/> : <Table><thead><tr><Th>Action</Th><Th>Area</Th><Th>Actor</Th><Th>Date</Th></tr></thead><tbody>{audit.data.map(row=><tr key={row.id}><Td><Badge tone='blue'>{row.action.replaceAll('_',' ')}</Badge></Td><Td>{row.entity}</Td><Td><code>{row.actor_id ? row.actor_id.slice(0,8)+'…' : 'System'}</code></Td><Td>{when(row.created_at)}</Td></tr>)}</tbody></Table>}
    </Card>
    <p className='admin-module-footnote'>No SSO settings are changed from this screen. Authentication secrets, provider metadata and service-role credentials remain outside the public SIMS client.</p>
  </div>;
}
