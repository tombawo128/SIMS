import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, Briefcase, Building2, Clock3, FileText, GraduationCap, Megaphone, RefreshCw, Send, ShieldCheck, Users } from 'lucide-react';
import { Card, CardHeader, Button, Input, Textarea, Select, Field, Alert, Badge, EmptyState, Spinner, StatCard, Table, Th, Td, useToast } from '@/components/ui';
import { GeneralAdmins } from '@/components/GeneralAdmins';
import { supabase } from '@/lib/supabase';

type Broadcast = {
  id: string; title: string; body: string; audience_role: string | null;
  link: string | null; recipients_count: number; created_at: string;
};
type ActivityLog = {
  id: number; actor_id: string | null; entity: string; entity_id: string | null;
  action: string; metadata: Record<string, unknown> | null; created_at: string;
};
type SystemAlert = {
  id: string; title: string; message: string; severity: 'info' | 'warning' | 'critical';
  source: string; resolved_at: string | null; created_at: string;
};
type Analytics = Record<string, number>;

const roles = [
  { value: 'student', label: 'Students' },
  { value: 'coordinator', label: 'Coordinators' },
  { value: 'faculty_supervisor', label: 'Faculty supervisors' },
  { value: 'company_admin', label: 'Company administrators' },
  { value: 'site_supervisor', label: 'Site supervisors' },
  { value: 'platform_admin', label: 'Platform administrators' },
];
const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));
const count = (value?: number) => (value ?? 0).toLocaleString();

function AdminHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <section className='page-hero admin-page-hero'><div><span className='page-hero__eyebrow'>SIMS ADMINISTRATION</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className='admin-page-hero__actions'>{actions}</div> : null}</section>;
}

export function Broadcasts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', link: '' });
  const [errorText, setErrorText] = useState('');
  const history = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_broadcasts')
        .select('id,title,body,audience_role,link,recipients_count,created_at')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Broadcast[];
    },
  });
  const publish = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('publish_admin_broadcast', {
        p_title: form.title.trim(), p_body: form.body.trim(),
        p_audience_role: form.audience === 'all' ? null : form.audience,
        p_link: form.link.trim() || null,
      });
      if (error) throw error;
      return data as { id: string; recipients_count: number };
    },
    onSuccess: (result) => {
      setForm({ title: '', body: '', audience: 'all', link: '' });
      setErrorText('');
      void queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] });
      toast({ title: 'Announcement published', description: result.recipients_count + ' active users received the message.', tone: 'success' });
    },
    onError: (error: Error) => setErrorText(error.message),
  });

  return (
    <div className='admin-console'>
      <AdminHeader title='System-wide announcements' description='Publish official announcements to all active users or a selected role.' />
      <div className='admin-console__split'>
        <Card>
          <CardHeader title='Compose an announcement' description='Announcements are delivered through recipients’ SIMS notification centre.' />
          <div className='admin-console__form'>
            {errorText ? <Alert tone='danger' title='Announcement was not published'>{errorText}</Alert> : null}
            <Field label='Message title' required>
              <Input maxLength={160} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder='Important university or platform update' />
            </Field>
            <Field label='Message' required hint='Up to 5,000 characters.'>
              <Textarea rows={6} maxLength={5000} value={form.body} onChange={e => setForm(v => ({ ...v, body: e.target.value }))} placeholder='Write the announcement for users…' />
            </Field>
            <Field label='Audience'>
              <Select value={form.audience} onChange={e => setForm(v => ({ ...v, audience: e.target.value }))}>
                <option value='all'>All active users</option>
                {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
              </Select>
            </Field>
            <Field label='Optional link' hint='Use an internal SIMS route, for example /notifications.'>
              <Input value={form.link} onChange={e => setForm(v => ({ ...v, link: e.target.value }))} placeholder='/notifications' />
            </Field>
            <div className='admin-console__form-footer'>
              <span className='admin-console__muted'>{form.body.length}/5000 characters</span>
              <Button onClick={() => publish.mutate()} loading={publish.isPending} disabled={!form.title.trim() || !form.body.trim()}>
                <Send size={16} /> Publish announcement
              </Button>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title='Announcement delivery' />
          <div className='admin-console__note-list'>
            <p><Badge tone='emerald'>Active accounts</Badge> Only active accounts in the selected audience receive the message.</p>
            <p><Badge tone='blue'>In-app delivery</Badge> The message is delivered through the existing SIMS notification centre.</p>
            <p><Badge tone='slate'>Audit trail</Badge> Each announcement is recorded with its recipient count and sender.</p>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title='Announcement history' description='Most recent 50 announcements.' actions={<Button size='sm' variant='secondary' onClick={() => void history.refetch()}><RefreshCw size={14} /> Refresh</Button>} />
        {history.isLoading ? <div className='admin-console__loading'><Spinner /></div> : history.isError ? <Alert tone='danger'>Could not load broadcast history: {(history.error as Error).message}</Alert> : !history.data?.length ? <EmptyState title='No announcements yet' description='Announcements you publish will appear here.' /> : (
          <Table>
            <thead><tr><Th>Message</Th><Th>Audience</Th><Th>Recipients</Th><Th>Sent</Th></tr></thead>
            <tbody>{history.data.map(item => <tr key={item.id}><Td><strong>{item.title}</strong><p className='admin-console__cell-sub'>{item.body}</p></Td><Td>{item.audience_role ? roles.find(r => r.value === item.audience_role)?.label ?? item.audience_role : 'All active users'}</Td><Td>{count(item.recipients_count)}</Td><Td>{dateTime(item.created_at)}</Td></tr>)}</tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export function ActivityLogs() {
  const logs = useQuery({
    queryKey: ['platform-activity-logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs')
        .select('id,actor_id,entity,entity_id,action,metadata,created_at')
        .order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
  });
  return (
    <div className='admin-console'>
      <AdminHeader title='Activity logs' description='Review administrative and platform activity recorded by SIMS.' actions={<Button variant='secondary' size='sm' onClick={() => void logs.refetch()}><RefreshCw size={14} /> Refresh</Button>} />
      <Card>
        <CardHeader title='Recent activity' description='Latest 200 audit events, newest first.' />
        {logs.isLoading ? <div className='admin-console__loading'><Spinner /></div> : logs.isError ? <Alert tone='danger' title='Could not load activity logs'>{(logs.error as Error).message}</Alert> : !logs.data?.length ? <EmptyState icon={<Activity />} title='No activity recorded' description='Administrative actions will appear here as they occur.' /> : (
          <Table>
            <thead><tr><Th>Action</Th><Th>Entity</Th><Th>Actor ID</Th><Th>Details</Th><Th>Date</Th></tr></thead>
            <tbody>{logs.data.map(log => <tr key={log.id}><Td><Badge tone='blue'>{log.action.replaceAll('_', ' ')}</Badge></Td><Td>{log.entity}<span className='admin-console__cell-sub'>{log.entity_id ?? '—'}</span></Td><Td><code>{log.actor_id ? log.actor_id.slice(0, 8) + '…' : 'System'}</code></Td><Td className='admin-console__metadata'>{log.metadata ? JSON.stringify(log.metadata) : '—'}</Td><Td>{dateTime(log.created_at)}</Td></tr>)}</tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export function SystemAlerts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', message: '', severity: 'info', source: 'admin' });
  const [errorText, setErrorText] = useState('');
  const alerts = useQuery({
    queryKey: ['platform-system-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_alerts')
        .select('id,title,message,severity,source,resolved_at,created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as SystemAlert[];
    },
  });
  const createAlert = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_system_alert', {
        p_title: form.title.trim(), p_message: form.message.trim(),
        p_severity: form.severity, p_source: form.source.trim() || 'admin',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setForm({ title: '', message: '', severity: 'info', source: 'admin' });
      setErrorText('');
      void queryClient.invalidateQueries({ queryKey: ['platform-system-alerts'] });
      toast({ title: 'Internal system alert created', tone: 'success' });
    },
    onError: (error: Error) => setErrorText(error.message),
  });
  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('resolve_system_alert', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-system-alerts'] });
      toast({ title: 'Internal alert marked as resolved', tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Could not resolve internal alert', description: error.message, tone: 'error' }),
  });
  const openCount = (alerts.data ?? []).filter(alert => !alert.resolved_at).length;
  const tone = (severity: string) => severity === 'critical' ? 'rose' : severity === 'warning' ? 'amber' : 'blue';

  return (
    <div className='admin-console'>
      <AdminHeader title='Internal system alerts' description='Track operational, security and technical issues for platform administrators.' />
      <div className='admin-console__split'>
        <Card>
          <CardHeader title='Create an internal alert' description='Internal alerts are restricted to platform administrators and are not sent to general users.' />
          <div className='admin-console__form'>
            {errorText ? <Alert tone='danger'>{errorText}</Alert> : null}
            <Field label='Alert title' required><Input maxLength={180} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder='Scheduled maintenance' /></Field>
            <Field label='Details' required><Textarea rows={5} maxLength={5000} value={form.message} onChange={e => setForm(v => ({ ...v, message: e.target.value }))} placeholder='Describe the internal operational or technical issue…' /></Field>
            <div className='admin-console__form-grid'>
              <Field label='Severity'><Select value={form.severity} onChange={e => setForm(v => ({ ...v, severity: e.target.value }))}><option value='info'>Informational</option><option value='warning'>Warning</option><option value='critical'>Critical</option></Select></Field>
              <Field label='Source'><Input value={form.source} onChange={e => setForm(v => ({ ...v, source: e.target.value }))} /></Field>
            </div>
            <div className='admin-console__form-footer'><span className='admin-console__muted'>Open alerts: {openCount}</span><Button onClick={() => createAlert.mutate()} loading={createAlert.isPending} disabled={!form.title.trim() || !form.message.trim()}>Create alert</Button></div>
          </div>
        </Card>
        <Card>
          <CardHeader title='Internal alert status' />
          <div className='admin-console__alert-summary'>
            <div><strong>{openCount}</strong><span>Open</span></div>
            <div><strong>{(alerts.data ?? []).length - openCount}</strong><span>Resolved</span></div>
            <div><strong>{(alerts.data ?? []).filter(a => a.severity === 'critical' && !a.resolved_at).length}</strong><span>Critical</span></div>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title='Internal alert register' description='Latest 100 internal system alerts.' actions={<Button size='sm' variant='secondary' onClick={() => void alerts.refetch()}><RefreshCw size={14} /> Refresh</Button>} />
        {alerts.isLoading ? <div className='admin-console__loading'><Spinner /></div> : alerts.isError ? <Alert tone='danger'>{(alerts.error as Error).message}</Alert> : !alerts.data?.length ? <EmptyState icon={<AlertTriangle />} title='No internal alerts' description='New internal system alerts will appear here.' /> : (
          <div className='admin-console__alert-list'>{alerts.data.map(alert => <article className='admin-console__alert-item' key={alert.id}>
            <div className='admin-console__alert-main'><div className='admin-console__alert-heading'><strong>{alert.title}</strong><Badge tone={tone(alert.severity) as 'rose' | 'amber' | 'blue'}>{alert.severity}</Badge><Badge tone={alert.resolved_at ? 'emerald' : 'amber'}>{alert.resolved_at ? 'Resolved' : 'Open'}</Badge></div><p>{alert.message}</p><span className='admin-console__cell-sub'>{alert.source} · {dateTime(alert.created_at)}{alert.resolved_at ? ' · Resolved ' + dateTime(alert.resolved_at) : ''}</span></div>
            {!alert.resolved_at ? <Button size='sm' variant='secondary' onClick={() => resolveAlert.mutate(alert.id)} loading={resolveAlert.isPending}>Resolve</Button> : null}
          </article>)}</div>
        )}
      </Card>
    </div>
  );
}

export function AdminManagement() {
  return <div className='admin-console'><AdminHeader title='Administrator access' description='Manage platform-wide administrator accounts and access.' /><GeneralAdmins /></div>;
}

export function Analytics() {
  const analytics = useQuery({
    queryKey: ['platform-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_platform_analytics');
      if (error) throw error;
      return (data ?? {}) as Analytics;
    },
  });
  const stats = analytics.data ?? {};
  const userBreakdown = useMemo(() => [
    { label: 'Students', value: stats.students ?? 0, tone: 'students', icon: <Users size={17} />, detail: 'Student accounts' },
    { label: 'University staff', value: stats.university_staff ?? 0, tone: 'university', icon: <GraduationCap size={17} />, detail: 'Coordinators and faculty' },
    { label: 'Company staff', value: stats.company_staff ?? 0, tone: 'company', icon: <Building2 size={17} />, detail: 'Company and site teams' },
    { label: 'Platform admins', value: stats.platform_admins ?? 0, tone: 'admins', icon: <ShieldCheck size={17} />, detail: 'Platform administrators' },
  ], [stats]);
  const totalRoleUsers = userBreakdown.reduce((sum, item) => sum + Number(item.value), 0);
  const total = stats.users_total ?? 0;
  const active = stats.active_users ?? 0;
  const pending = stats.pending_users ?? 0;
  const other = Math.max(0, total - active - pending);
  const unclassified = Math.max(0, total - totalRoleUsers);
  const organizationTotal = (stats.universities ?? 0) + (stats.companies ?? 0);
  const percent = (value: number, denominator: number) => denominator > 0 ? Math.round((value / denominator) * 100) : 0;
  const roleSegments = [
    ...userBreakdown.map((item) => ({ tone: item.tone, share: percent(Number(item.value), totalRoleUsers) })),
    ...(unclassified ? [{ tone: 'other', share: percent(unclassified, total) }] : []),
  ];
  let roleOffset = 0;
  const roleGradient = roleSegments.length
    ? 'conic-gradient(' + roleSegments.map((item) => {
        const start = roleOffset;
        roleOffset += item.share;
        return 'var(--analytics-' + item.tone + ') ' + start + '% ' + roleOffset + '%';
      }).join(', ') + ')'
    : 'conic-gradient(#e8edf3 0% 100%)';

  return (
    <div className='admin-console analytics-page'>
      <AdminHeader
        title='Platform analytics'
        description='A live operational view of SIMS accounts, organisations and internship activity.'
        actions={<Button size='sm' variant='secondary' onClick={() => void analytics.refetch()} loading={analytics.isFetching}><RefreshCw size={14} /> Refresh data</Button>}
      />
      {analytics.isLoading ? <div className='admin-console__loading'><Spinner /></div> : analytics.isError ? (
        <Alert tone='danger' title='Analytics could not be loaded'>{(analytics.error as Error).message}</Alert>
      ) : (
        <>
          <section className='analytics-page__overview'>
            <div className='analytics-page__overview-copy'>
              <span className='analytics-page__eyebrow'>SYSTEM SNAPSHOT</span>
              <h2>SIMS, in focus.</h2>
              <p>Platform-wide totals from the live database. Figures update when this report is refreshed.</p>
            </div>
            <div className='analytics-page__overview-meta'><span className='analytics-page__live-dot' /> Live database data</div>
          </section>

          <section className='analytics-page__metrics' aria-label='Platform key metrics'>
            <StatCard className='analytics-page__metric--users' label='Total users' value={count(total)} icon={<Users size={20} />} hint='All registered accounts' />
            <StatCard className='analytics-page__metric--active' label='Active users' value={count(active)} icon={<ShieldCheck size={20} />} hint={percent(active, total) + '% of all accounts'} />
            <StatCard className='analytics-page__metric--pending' label='Pending approvals' value={count(pending)} icon={<Clock3 size={20} />} hint='Awaiting administrator review' />
            <StatCard className='analytics-page__metric--orgs' label='Organizations' value={count(organizationTotal)} icon={<Building2 size={20} />} hint={count(stats.universities) + ' universities · ' + count(stats.companies) + ' companies'} />
          </section>

          <section className='analytics-page__section-heading'>
            <div><span className='analytics-page__section-kicker'>WORKFLOW</span><h2>Internship activity</h2><p>Recorded activity across the core SIMS workflow.</p></div>
          </section>
          <section className='analytics-page__workflow-grid' aria-label='Internship activity metrics'>
            <article className='analytics-page__workflow-card analytics-page__workflow-card--postings'><span className='analytics-page__workflow-icon'><Megaphone size={19} /></span><div><span>Job postings</span><strong>{count(stats.job_postings)}</strong><small>Opportunities published</small></div></article>
            <article className='analytics-page__workflow-card analytics-page__workflow-card--applications'><span className='analytics-page__workflow-icon'><FileText size={19} /></span><div><span>Applications</span><strong>{count(stats.applications)}</strong><small>Student applications submitted</small></div></article>
            <article className='analytics-page__workflow-card analytics-page__workflow-card--placements'><span className='analytics-page__workflow-icon'><Briefcase size={19} /></span><div><span>Placements</span><strong>{count(stats.placements)}</strong><small>Internship placements recorded</small></div></article>
            <article className='analytics-page__workflow-card analytics-page__workflow-card--announcements'><span className='analytics-page__workflow-icon'><Send size={19} /></span><div><span>Announcements</span><strong>{count(stats.broadcasts)}</strong><small>Platform announcements sent</small></div></article>
          </section>

          <section className='analytics-page__detail-grid'>
            <Card>
              <CardHeader title='Account groups' description='Color-coded breakdown by SIMS account role.' />
              <div className='analytics-page__composition analytics-page__composition--redesigned'>
                <div className='analytics-page__donut-wrap'>
                  <div className='analytics-page__donut' style={{ background: roleGradient }}>
                    <div className='analytics-page__donut-center'><strong>{count(totalRoleUsers)}</strong><span>Role accounts</span></div>
                  </div>
                  <p>Role distribution</p>
                </div>
                <div className='analytics-page__role-list'>
                  {userBreakdown.map((item) => {
                    const value = Number(item.value);
                    const share = percent(value, totalRoleUsers);
                    return (
                      <div className={'analytics-page__role analytics-page__role--' + item.tone} key={item.label}>
                        <div className='analytics-page__role-heading'>
                          <span className='analytics-page__role-label'><i className={'analytics-page__legend analytics-page__legend--' + item.tone} />{item.icon}{item.label}</span>
                          <strong>{count(value)} <small>{share}%</small></strong>
                        </div>
                        <div className='analytics-page__track'><span className={'analytics-page__fill analytics-page__fill--' + item.tone} style={{ width: share + '%' }} /></div>
                        <small className='analytics-page__role-detail'>{item.detail}</small>
                      </div>
                    );
                  })}
                  {unclassified > 0 ? (
                    <div className='analytics-page__role analytics-page__role--other'>
                      <div className='analytics-page__role-heading'><span className='analytics-page__role-label'><i className='analytics-page__legend analytics-page__legend--other' />Other / unclassified</span><strong>{count(unclassified)} <small>{percent(unclassified, total)}%</small></strong></div>
                      <div className='analytics-page__track'><span className='analytics-page__fill analytics-page__fill--other' style={{ width: percent(unclassified, total) + '%' }} /></div>
                    </div>
                  ) : null}
                  {!totalRoleUsers ? <p className='analytics-page__empty-note'>Role counts will appear when user records are available.</p> : null}
                </div>
              </div>
              <div className='analytics-page__card-foot'>Colors identify account roles consistently across this report.</div>
            </Card>

            <Card>
              <CardHeader title='Account status' description='Current approval and access state.' />
              <div className='analytics-page__status analytics-page__status--redesigned'>
                <div className='analytics-page__status-total'><span>Total accounts</span><strong>{count(total)}</strong><small>Across all roles</small></div>
                <div className='analytics-page__status-list'>
                  <div><span><i className='analytics-page__status-dot analytics-page__status-dot--active' />Active</span><strong>{count(active)}</strong></div>
                  <div><span><i className='analytics-page__status-dot analytics-page__status-dot--pending' />Pending</span><strong>{count(pending)}</strong></div>
                  <div><span><i className='analytics-page__status-dot analytics-page__status-dot--other' />Other / archived</span><strong>{count(other)}</strong></div>
                </div>
                <div className='analytics-page__status-track' aria-label='Account status distribution'>
                  <span className='analytics-page__status-segment--active' style={{ width: percent(active, total) + '%' }} />
                  <span className='analytics-page__status-segment--pending' style={{ width: percent(pending, total) + '%' }} />
                  <span className='analytics-page__status-segment--other' style={{ width: percent(other, total) + '%' }} />
                </div>
              </div>
              <div className='analytics-page__card-foot'>Status values reflect the latest database snapshot.</div>
            </Card>
          </section>

          <section className='analytics-page__organizations'>
            <div className='analytics-page__section-heading'><div><span className='analytics-page__section-kicker'>NETWORK</span><h2>Organization network</h2><p>Registered institutions and employers on SIMS.</p></div></div>
            <div className='analytics-page__organization-grid'>
              <article className='analytics-page__organization-card analytics-page__organization-card--university'><span><GraduationCap size={20} /></span><div><small>Universities</small><strong>{count(stats.universities)}</strong><p>Academic institutions</p></div></article>
              <article className='analytics-page__organization-card analytics-page__organization-card--company'><span><Building2 size={20} /></span><div><small>Companies</small><strong>{count(stats.companies)}</strong><p>Employer organizations</p></div></article>
            </div>
          </section>

          <p className='analytics-page__footnote'>All figures are returned by the SIMS analytics database function. No estimated or sample values are displayed.</p>
        </>
      )}
    </div>
  );
}
