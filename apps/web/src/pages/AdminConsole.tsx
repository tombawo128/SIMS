import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, BarChart3, BellRing, Megaphone, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { PageHeader, Card, CardHeader, Button, Input, Textarea, Select, Field, Alert, Badge, EmptyState, Spinner, StatCard, Table, Th, Td, useToast } from '@/components/ui';
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
      toast({ title: 'Broadcast sent', description: result.recipients_count + ' active users received the message.', tone: 'success' });
    },
    onError: (error: Error) => setErrorText(error.message),
  });

  return (
    <div className='admin-console'>
      <PageHeader title='Broadcasts' description='Send platform-wide announcements and review previous messages.' />
      <div className='admin-console__split'>
        <Card>
          <CardHeader title='Compose a broadcast' description='Messages appear in recipients’ SIMS notifications.' />
          <div className='admin-console__form'>
            {errorText ? <Alert tone='danger' title='Broadcast was not sent'>{errorText}</Alert> : null}
            <Field label='Message title' required>
              <Input maxLength={160} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder='Important platform update' />
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
                <Send size={16} /> Send broadcast
              </Button>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title='Sending rules' />
          <div className='admin-console__note-list'>
            <p><Badge tone='emerald'>Active accounts</Badge> Only active accounts in the selected audience receive the message.</p>
            <p><Badge tone='blue'>In-app delivery</Badge> The message is delivered through the existing SIMS notification centre.</p>
            <p><Badge tone='slate'>Audit trail</Badge> Each broadcast is recorded with its recipient count and sender.</p>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title='Broadcast history' description='Most recent 50 broadcasts.' actions={<Button size='sm' variant='secondary' onClick={() => void history.refetch()}><RefreshCw size={14} /> Refresh</Button>} />
        {history.isLoading ? <div className='admin-console__loading'><Spinner /></div> : history.isError ? <Alert tone='danger'>Could not load broadcast history: {(history.error as Error).message}</Alert> : !history.data?.length ? <EmptyState title='No broadcasts yet' description='Messages you send will appear here.' /> : (
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
      <PageHeader title='Activity Logs' description='Review administrative and platform activity recorded by SIMS.' actions={<Button variant='secondary' size='sm' onClick={() => void logs.refetch()}><RefreshCw size={14} /> Refresh</Button>} />
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
      toast({ title: 'System alert created', tone: 'success' });
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
      toast({ title: 'Alert marked as resolved', tone: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Could not resolve alert', description: error.message, tone: 'error' }),
  });
  const openCount = (alerts.data ?? []).filter(alert => !alert.resolved_at).length;
  const tone = (severity: string) => severity === 'critical' ? 'rose' : severity === 'warning' ? 'amber' : 'blue';

  return (
    <div className='admin-console'>
      <PageHeader title='System Alerts' description='Create operational notices and track issues that need administrator attention.' />
      <div className='admin-console__split'>
        <Card>
          <CardHeader title='Create an alert' description='Alerts are visible to platform administrators.' />
          <div className='admin-console__form'>
            {errorText ? <Alert tone='danger'>{errorText}</Alert> : null}
            <Field label='Alert title' required><Input maxLength={180} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder='Scheduled maintenance' /></Field>
            <Field label='Details' required><Textarea rows={5} maxLength={5000} value={form.message} onChange={e => setForm(v => ({ ...v, message: e.target.value }))} placeholder='Describe the issue or system notice…' /></Field>
            <div className='admin-console__form-grid'>
              <Field label='Severity'><Select value={form.severity} onChange={e => setForm(v => ({ ...v, severity: e.target.value }))}><option value='info'>Informational</option><option value='warning'>Warning</option><option value='critical'>Critical</option></Select></Field>
              <Field label='Source'><Input value={form.source} onChange={e => setForm(v => ({ ...v, source: e.target.value }))} /></Field>
            </div>
            <div className='admin-console__form-footer'><span className='admin-console__muted'>Open alerts: {openCount}</span><Button onClick={() => createAlert.mutate()} loading={createAlert.isPending} disabled={!form.title.trim() || !form.message.trim()}>Create alert</Button></div>
          </div>
        </Card>
        <Card>
          <CardHeader title='Alert status' />
          <div className='admin-console__alert-summary'>
            <div><strong>{openCount}</strong><span>Open</span></div>
            <div><strong>{(alerts.data ?? []).length - openCount}</strong><span>Resolved</span></div>
            <div><strong>{(alerts.data ?? []).filter(a => a.severity === 'critical' && !a.resolved_at).length}</strong><span>Critical</span></div>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title='Alert register' description='Latest 100 system alerts.' actions={<Button size='sm' variant='secondary' onClick={() => void alerts.refetch()}><RefreshCw size={14} /> Refresh</Button>} />
        {alerts.isLoading ? <div className='admin-console__loading'><Spinner /></div> : alerts.isError ? <Alert tone='danger'>{(alerts.error as Error).message}</Alert> : !alerts.data?.length ? <EmptyState icon={<AlertTriangle />} title='No system alerts' description='New alerts will appear here.' /> : (
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
  return <div className='admin-console'><PageHeader title='Admin Management' description='Manage platform-wide administrator accounts and access.' /><GeneralAdmins /></div>;
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
    ['Students', stats.students ?? 0], ['University staff', stats.university_staff ?? 0],
    ['Company staff', stats.company_staff ?? 0], ['Platform admins', stats.platform_admins ?? 0],
  ], [stats]);
  const maxUsers = Math.max(1, ...userBreakdown.map(([, value]) => Number(value)));
  return (
    <div className='admin-console'>
      <PageHeader title='Analytics' description='Platform-wide operational metrics across users, organizations, and internship activity.' actions={<Button size='sm' variant='secondary' onClick={() => void analytics.refetch()}><RefreshCw size={14} /> Refresh data</Button>} />
      {analytics.isLoading ? <div className='admin-console__loading'><Spinner /></div> : analytics.isError ? <Alert tone='danger' title='Could not load analytics'>{(analytics.error as Error).message}</Alert> : (
        <>
          <div className='admin-console__stats'>
            <StatCard label='Total users' value={count(stats.users_total)} icon={<Activity />} hint='Non-archived accounts' />
            <StatCard label='Active users' value={count(stats.active_users)} icon={<ShieldCheck />} />
            <StatCard label='Pending approvals' value={count(stats.pending_users)} icon={<BellRing />} />
            <StatCard label='Organizations' value={count((stats.universities ?? 0) + (stats.companies ?? 0))} icon={<BarChart3 />} hint={count(stats.universities) + ' universities · ' + count(stats.companies) + ' companies'} />
            <StatCard label='Applications' value={count(stats.applications)} />
            <StatCard label='Placements' value={count(stats.placements)} />
            <StatCard label='Job postings' value={count(stats.job_postings)} />
            <StatCard label='Broadcasts sent' value={count(stats.broadcasts)} icon={<Megaphone />} />
          </div>
          <div className='admin-console__split'>
            <Card><CardHeader title='User composition' description='Accounts grouped by platform role.' /><div className='admin-console__bars'>{userBreakdown.map(([label, value]) => <div className='admin-console__bar-row' key={label as string}><div><span>{label}</span><strong>{count(Number(value))}</strong></div><div className='admin-console__bar-track'><span style={{ width: ((Number(value) / maxUsers) * 100) + '%' }} /></div></div>)}</div></Card>
            <Card><CardHeader title='Account status' description='Current approval and access state.' /><div className='admin-console__status-grid'><div><strong>{count(stats.active_users)}</strong><span>Active</span></div><div><strong>{count(stats.pending_users)}</strong><span>Pending</span></div><div><strong>{count((stats.users_total ?? 0) - (stats.active_users ?? 0) - (stats.pending_users ?? 0))}</strong><span>Other / archived</span></div></div></Card>
          </div>
          <p className='admin-console__muted'>Metrics are live database counts. Refresh to request the latest snapshot.</p>
        </>
      )}
    </div>
  );
}
