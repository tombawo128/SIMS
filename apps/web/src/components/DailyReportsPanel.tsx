import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Plus, Send } from 'lucide-react';
import { formatDate } from '@sims/shared';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import { Alert, Button, Card, CardHeader, EmptyState, Field, Input, Textarea, useToast } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

type DailyReport = {
  id: string;
  placement_id: string;
  student_id: string;
  report_date: string;
  week_number: number;
  hours: number;
  tasks: string;
  learning_outcomes: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  submitted_at: string | null;
  supervisor_comment: string | null;
};

type WeeklySummary = { week_number: number; status: string };

function weekForDate(date: string, startDate: string) {
  const day = 86400000;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const selected = new Date(`${date}T00:00:00Z`).getTime();
  return Math.floor((selected - start) / (7 * day)) + 1;
}

export function DailyReportsPanel({
  placementId,
  startDate,
  endDate,
  isStudent,
  weeklyLogs,
}: {
  placementId: string;
  startDate: string;
  endDate: string;
  isStudent: boolean;
  weeklyLogs: WeeklySummary[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [reportDate, setReportDate] = useState(today < startDate ? startDate : today > endDate ? endDate : today);
  const [hours, setHours] = useState('8');
  const [tasks, setTasks] = useState('');
  const [outcomes, setOutcomes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState('');

  const reportsQuery = useQuery({
    queryKey: ['daily-reports', placementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('placement_id', placementId)
        .order('report_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DailyReport[];
    },
  });

  const saveReport = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_daily_report', {
        p_placement_id: placementId,
        p_report_date: reportDate,
        p_hours: Number(hours),
        p_tasks: tasks.trim(),
        p_learning_outcomes: outcomes.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['daily-reports', placementId] });
      await queryClient.invalidateQueries({ queryKey: ['placement', placementId] });
      setEditingId(null);
      setTasks('');
      setOutcomes('');
      toast({ title: 'Daily report saved', tone: 'success' });
    },
  });

  const submitWeek = useMutation({
    mutationFn: async (weekNumber: number) => {
      const { error } = await supabase.rpc('submit_weekly_report', {
        p_placement_id: placementId,
        p_week_number: weekNumber,
      });
      if (error) throw error;
    },
    onSuccess: async (_data, weekNumber) => {
      await queryClient.invalidateQueries({ queryKey: ['daily-reports', placementId] });
      await queryClient.invalidateQueries({ queryKey: ['placement', placementId] });
      await queryClient.invalidateQueries({ queryKey: ['placements'] });
      toast({ title: `Week ${weekNumber} submitted to your faculty supervisor`, tone: 'success' });
    },
  });

  const reports = reportsQuery.data ?? [];
  const grouped = useMemo(() => {
    const map = new Map<number, DailyReport[]>();
    for (const report of reports) {
      const list = map.get(report.week_number) ?? [];
      list.push(report);
      map.set(report.week_number, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [reports]);

  const currentWeek = weekForDate(reportDate, startDate);
  const weekStatus = weeklyLogs.find((log) => log.week_number === currentWeek)?.status;
  const canEditWeek = !['submitted', 'approved'].includes(weekStatus ?? '');
  const save = async () => {
    setErrorText('');
    if (!reportDate || !tasks.trim() || Number(hours) < 0 || Number(hours) > 24 || !Number.isFinite(Number(hours))) {
      setErrorText('Choose a valid date, enter 0–24 hours, and describe the work completed.');
      return;
    }
    try { await saveReport.mutateAsync(); } catch (error) { setErrorText(errorMessage(error)); }
  };

  const edit = (report: DailyReport) => {
    setEditingId(report.id);
    setReportDate(report.report_date);
    setHours(String(report.hours));
    setTasks(report.tasks);
    setOutcomes(report.learning_outcomes);
    setErrorText('');
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {isStudent ? (
        <Card>
          <CardHeader title={editingId ? 'Edit daily report' : 'Daily internship report'} description="Record what you worked on each day. Submit the complete week when your entries are ready." />
          {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, padding: 16 }}>
            <Field label="Report date" htmlFor="daily-report-date">
              <Input id="daily-report-date" type="date" min={startDate} max={endDate} value={reportDate} disabled={Boolean(editingId)} onChange={(event) => setReportDate(event.target.value)} />
            </Field>
            <Field label="Hours worked" htmlFor="daily-report-hours">
              <Input id="daily-report-hours" type="number" min="0" max="24" step="0.5" value={hours} onChange={(event) => setHours(event.target.value)} />
            </Field>
            <div style={{ alignSelf: 'end', paddingBottom: 8, fontSize: 13, color: '#64748b' }}>Week {currentWeek} · {weekStatus ? `Weekly status: ${weekStatus.replace('_', ' ')}` : 'Not submitted'}</div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 12 }}>
            <Field label="Work completed" htmlFor="daily-report-tasks">
              <Textarea id="daily-report-tasks" rows={3} value={tasks} onChange={(event) => setTasks(event.target.value)} placeholder="Describe the tasks, activities, and work completed today." />
            </Field>
            <Field label="Skills or learning outcomes" htmlFor="daily-report-outcomes">
              <Textarea id="daily-report-outcomes" rows={2} value={outcomes} onChange={(event) => setOutcomes(event.target.value)} placeholder="What did you learn or practice?" />
            </Field>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={save} loading={saveReport.isPending} disabled={!canEditWeek}><Plus size={16} /> Save daily report</Button>
              {editingId ? <Button variant="secondary" onClick={() => { setEditingId(null); setHours('8'); setTasks(''); setOutcomes(''); setErrorText(''); }}>Cancel edit</Button> : null}
            </div>
            {!canEditWeek ? <Alert tone="info">This week has already been submitted. You cannot change its daily entries.</Alert> : null}
          </div>
        </Card>
      ) : null}

      {reportsQuery.isLoading ? <Card>Loading daily reports…</Card> : reportsQuery.isError ? <Alert tone="danger">Could not load daily reports. Refresh and try again.</Alert> : reports.length === 0 ? (
        <EmptyState icon={<ClipboardList size={20} />} title="No daily reports yet" description="Daily entries will appear here as the student records their internship activities." />
      ) : grouped.map(([week, entries]) => {
        const status = weeklyLogs.find((log) => log.week_number === week)?.status ?? 'draft';
        const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);
        const locked = ['submitted', 'approved'].includes(status);
        return (
          <Card key={week}>
            <CardHeader
              title={`Week ${week} · ${totalHours} hours`}
              description={`${entries.length} daily entr${entries.length === 1 ? 'y' : 'ies'} · ${status.replace('_', ' ')}`}
              actions={isStudent && !locked ? (
                <Button size="sm" onClick={() => { setErrorText(''); submitWeek.mutate(week, { onError: (error) => setErrorText(errorMessage(error)) }); }} loading={submitWeek.isPending} disabled={submitWeek.isPending}>
                  <Send size={15} /> Submit week
                </Button>
              ) : <StatusBadge status={status} label={status.replace('_', ' ')} />}
            />
            {errorText ? <div style={{ padding: 12 }}><Alert tone="danger">{errorText}</Alert></div> : null}
            <div style={{ display: 'grid', gap: 0 }}>
              {entries.map((entry) => (
                <div key={entry.id} style={{ padding: 16, borderTop: '1px solid #e2e8f0', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={15} /> {formatDate(entry.report_date)} · {entry.hours} hours</strong>
                    <StatusBadge status={entry.status} label={entry.status.replace('_', ' ')} />
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{entry.tasks}</p>
                  {entry.learning_outcomes ? <p style={{ color: '#64748b', whiteSpace: 'pre-wrap' }}>Learning: {entry.learning_outcomes}</p> : null}
                  {entry.supervisor_comment ? <Alert tone={entry.status === 'needs_revision' ? 'warning' : 'info'}>{entry.supervisor_comment}</Alert> : null}
                  {isStudent && !locked && ['draft', 'needs_revision'].includes(entry.status) ? <Button size="sm" variant="secondary" onClick={() => edit(entry)}>Edit entry</Button> : null}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
