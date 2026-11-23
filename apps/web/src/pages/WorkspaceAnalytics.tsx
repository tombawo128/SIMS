import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, CheckCircle2, Download, GraduationCap, Users } from 'lucide-react';
import type { Application, Placement } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { usePlacements } from '@/hooks/usePlacements';
import { useApplications } from '@/hooks/useApplications';
import { useCompanyStats, useUniversityStats } from '@/hooks/useDashboardStats';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Card, CardHeader, EmptyState, Spinner, StatCard } from '@/components/ui';

type WeeklyReport = { id: string; placement_id: string; week_number: number; status: string; submitted_at: string | null };
type DailyReport = { id: string; placement_id: string; report_date: string; week_number: number; status: string };
type EvaluationRow = { id: string; placement_id: string; type: string; overall_score: number | null };

function MetricBar({ label, value, max, suffix = '' }: { label: string; value: number; max: number; suffix?: string }) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
        <span>{label}</span><strong>{value}{suffix}</strong>
      </div>
      <div style={{ height: 9, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', borderRadius: 99, background: '#2563eb' }} />
      </div>
    </div>
  );
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  // Prevent spreadsheet formula execution when CSV fields contain untrusted values.
  const safeText = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `\"${safeText.replace(/\"/g, '\"\"')}\"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceAnalytics() {
  const { profile } = useAuth();
  const isUniversity = profile?.role === 'coordinator';
  const isCompany = profile?.role === 'company_admin';
  const analyticsEnabled = isUniversity || isCompany;
  const placementsQuery = usePlacements(analyticsEnabled);
  const applicationsQuery = useApplications(analyticsEnabled);
  const universityStats = useUniversityStats(isUniversity);
  const companyStats = useCompanyStats(isCompany);
  const weeklyQuery = useQuery({
    queryKey: ['analytics-weekly-reports'],
    enabled: isUniversity || isCompany,
    queryFn: async () => {
      const pageSize = 1000;
      const rows: WeeklyReport[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase.from('weekly_logs')
          .select('id,placement_id,week_number,status,submitted_at')
          .order('id', { ascending: true }).range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as WeeklyReport[]));
        if (!data || data.length < pageSize) break;
      }
      return rows;
    },
  });
  const dailyQuery = useQuery({
    queryKey: ['analytics-daily-reports'],
    enabled: isUniversity || isCompany,
    queryFn: async () => {
      const pageSize = 1000;
      const rows: DailyReport[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase.from('daily_reports')
          .select('id,placement_id,report_date,week_number,status')
          .order('id', { ascending: true }).range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as DailyReport[]));
        if (!data || data.length < pageSize) break;
      }
      return rows;
    },
  });
  const evaluationsQuery = useQuery({
    queryKey: ['analytics-evaluations'],
    enabled: isUniversity || isCompany,
    queryFn: async () => {
      const pageSize = 1000;
      const rows: EvaluationRow[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase.from('evaluations')
          .select('id,placement_id,type,overall_score')
          .order('id', { ascending: true }).range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as EvaluationRow[]));
        if (!data || data.length < pageSize) break;
      }
      return rows;
    },
  });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [department, setDepartment] = useState('all');
  const [program, setProgram] = useState('all');
  const placements = (placementsQuery.data ?? []) as Placement[];
  const applications = (applicationsQuery.data ?? []) as Application[];
  const weeklyReports = weeklyQuery.data ?? [];
  const dailyReports = dailyQuery.data ?? [];
  const evaluations = evaluationsQuery.data ?? [];

  const departments = useMemo(() => [...new Set(placements.map((p) => p.student?.department).filter((v): v is string => Boolean(v)))].sort(), [placements]);
  const programs = useMemo(() => [...new Set(placements.map((p) => p.student?.student_profile?.program).filter((v): v is string => Boolean(v)))].sort(), [placements]);

  const filteredPlacements = useMemo(() => placements.filter((p) => {
    const created = p.created_at.slice(0, 10);
    return (!startDate || created >= startDate)
      && (!endDate || created <= endDate)
      && (department === 'all' || p.student?.department === department)
      && (program === 'all' || p.student?.student_profile?.program === program);
  }), [placements, startDate, endDate, department, program]);
  const placementIds = useMemo(() => new Set(filteredPlacements.map((p) => p.id)), [filteredPlacements]);
  const filteredApplications = useMemo(() => applications.filter((a) => {
    const created = a.created_at.slice(0, 10);
    return (!startDate || created >= startDate) && (!endDate || created <= endDate)
      && (department === 'all' || a.student?.department === department)
      && (program === 'all' || a.student?.student_profile?.program === program);
  }), [applications, startDate, endDate, department, program]);
  const filteredWeekly = weeklyReports.filter((r) => placementIds.has(r.placement_id));
  const filteredDaily = dailyReports.filter((r) => placementIds.has(r.placement_id));
  const filteredEvaluations = evaluations.filter((r) => placementIds.has(r.placement_id));

  const gradeStats = useMemo(() => {
    const graded = filteredPlacements.filter((item) => item.final_grade !== null);
    const average = graded.length ? graded.reduce((sum, item) => sum + Number(item.final_grade), 0) / graded.length : null;
    return {
      graded: graded.length,
      average,
      bands: [
        { label: 'Excellent · 80–100', value: graded.filter((p) => Number(p.final_grade) >= 80).length },
        { label: 'Good · 70–79', value: graded.filter((p) => Number(p.final_grade) >= 70 && Number(p.final_grade) < 80).length },
        { label: 'Satisfactory · 60–69', value: graded.filter((p) => Number(p.final_grade) >= 60 && Number(p.final_grade) < 70).length },
        { label: 'Below 60', value: graded.filter((p) => Number(p.final_grade) < 60).length },
      ],
    };
  }, [filteredPlacements]);

  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPlacements.forEach((p) => {
      const key = p.student?.department || 'Department not set';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredPlacements]);
  const programCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPlacements.forEach((p) => {
      const key = p.student?.student_profile?.program || 'Program not set';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredPlacements]);
  const supervisorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPlacements.forEach((p) => {
      const supervisor = isUniversity ? p.faculty_supervisor : p.site_supervisor;
      const key = supervisor?.full_name || 'Not assigned';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredPlacements, isUniversity]);
  const applicationStages = ['submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn']
    .map((status) => ({ label: status.replace('_', ' '), value: filteredApplications.filter((a) => a.status === status).length }));
  const active = filteredPlacements.filter((p) => p.status === 'active').length;
  const completed = filteredPlacements.filter((p) => p.status === 'completed').length;
  const students = new Set(filteredPlacements.map((p) => p.student_id)).size;
  const pendingWeekly = filteredWeekly.filter((r) => r.status === 'submitted').length;
  const placementsWithoutDailyReports = filteredPlacements.filter((p) => p.status === 'active' && !filteredDaily.some((r) => r.placement_id === p.id)).length;
  const placementsWithoutWeeklySubmissions = filteredPlacements.filter((p) => p.status === 'active' && !filteredWeekly.some((r) => r.placement_id === p.id)).length;
  const approvedWeekly = filteredWeekly.filter((r) => r.status === 'approved').length;
  const needsRevision = filteredWeekly.filter((r) => r.status === 'needs_revision').length;
  const gradedEvaluations = filteredEvaluations.filter((e) => e.overall_score !== null);
  const evaluationAverage = gradedEvaluations.length ? gradedEvaluations.reduce((sum, e) => sum + Number(e.overall_score), 0) / gradedEvaluations.length : null;
  const maxBand = Math.max(1, ...gradeStats.bands.map((band) => band.value));
  const loading = placementsQuery.isLoading || applicationsQuery.isLoading || weeklyQuery.isLoading || dailyQuery.isLoading || evaluationsQuery.isLoading
    || (isUniversity && universityStats.isLoading) || (isCompany && companyStats.isLoading);
  const hasError = placementsQuery.isError || applicationsQuery.isError || weeklyQuery.isError || dailyQuery.isError || evaluationsQuery.isError
    || (isUniversity && universityStats.isError) || (isCompany && companyStats.isError);

  if (!profile || (!isUniversity && !isCompany)) return <EmptyState title="Analytics unavailable" description="This workspace is available to university coordinators and company administrators." />;
  if (loading) return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (hasError) return (
    <Alert tone="danger" title="Analytics could not be loaded">
      Check your workspace access and retry the report queries.
      <div style={{ marginTop: 10 }}>
        <Button size="sm" variant="secondary" onClick={() => {
          void placementsQuery.refetch();
          void applicationsQuery.refetch();
          void weeklyQuery.refetch();
          void dailyQuery.refetch();
          void evaluationsQuery.refetch();
          if (isUniversity) void universityStats.refetch();
          if (isCompany) void companyStats.refetch();
        }}>Retry analytics</Button>
      </div>
    </Alert>
  );

  return (
    <section className="analytics-workspace">
      <section className="page-hero">
        <div><span className="page-hero__eyebrow">PERFORMANCE AND REPORTING</span><h1>{isUniversity ? 'University insights' : 'Company insights'}.</h1><p>{isUniversity ? 'Understand department performance, supervision workload, reporting compliance and official grades.' : 'Monitor your internship pipeline, student performance, reporting compliance and placement outcomes.'}</p></div>
        <div className="page-hero__aside"><strong>{filteredPlacements.length}</strong><span>placements in current view</span><small>Metrics respond to the filters below</small></div>
      </section>

      <Card className="analytics-filter-panel">
        <CardHeader title="Refine your report" description="Filter placement-based reports by creation date, student department, and programme." />
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>From date<input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} style={{ padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>To date<input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} style={{ padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Department<select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}><option value="all">All departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Programme<select value={program} onChange={(e) => setProgram(e.target.value)} style={{ padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}><option value="all">All programmes</option>{programs.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <div style={{ display: 'flex', alignItems: 'end' }}><button type="button" onClick={() => { setStartDate(''); setEndDate(''); setDepartment('all'); setProgram('all'); }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Clear filters</button></div>
        </div>
      </Card>

      {isUniversity ? (
        <div className="analytics-workspace__metrics-grid">
          <StatCard label="Total students" value={universityStats.data?.students ?? 0} icon={<Users size={19} />} hint="All registered students at your university" />
          <StatCard label="Faculty supervisors" value={universityStats.data?.faculty ?? 0} icon={<GraduationCap size={19} />} />
          <StatCard label="Filtered placements" value={filteredPlacements.length} icon={<Briefcase size={19} />} />
          <StatCard label="Active placements" value={active} />
          <StatCard label="Completed placements" value={completed} icon={<CheckCircle2 size={19} />} />
          <StatCard label="Pending applications" value={filteredApplications.filter((a) => ['submitted', 'under_review'].includes(a.status)).length} />
          <StatCard label="Weekly reports awaiting review" value={pendingWeekly} />
          <StatCard label="Placements without faculty" value={filteredPlacements.filter((p) => !p.faculty_supervisor_id).length} />
        </div>
      ) : (
        <div className="analytics-workspace__metrics-grid">
          <StatCard label="Students hosted" value={students} icon={<Users size={19} />} hint="Unique students in the filtered portfolio" />
          <StatCard label="Active placements" value={active} icon={<Briefcase size={19} />} />
          <StatCard label="Completed placements" value={completed} icon={<CheckCircle2 size={19} />} />
          <StatCard label="Total opportunities" value={companyStats.data?.total_postings ?? 0} />
          <StatCard label="Published opportunities" value={companyStats.data?.published_postings ?? 0} />
          <StatCard label="Applications in filter" value={filteredApplications.length} />
          <StatCard label="Weekly reports pending review" value={pendingWeekly} />
        </div>
      )}

      <div className="analytics-workspace__reports-grid">
        <Card>
          <CardHeader title="Final grade performance" description="Official grades recorded by assigned university faculty supervisors. Company users have read-only access." />
          <div style={{ padding: 16, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><strong style={{ fontSize: 32 }}>{gradeStats.average === null ? '—' : gradeStats.average.toFixed(1)}</strong><span style={{ color: '#64748b', fontSize: 13 }}>average / 100 · {gradeStats.graded} graded</span></div>
            {gradeStats.bands.map((band) => <MetricBar key={band.label} label={band.label} value={band.value} max={maxBand} />)}
            {!gradeStats.graded && <p style={{ color: '#64748b', fontSize: 13 }}>No final grades in the selected scope yet.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Weekly reporting status" description="Report workflow status for the placements in the current filter." />
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            <MetricBar label="Daily reports recorded" value={filteredDaily.length} max={Math.max(1, filteredDaily.length)} />
            <MetricBar label="Placements with no daily reports" value={placementsWithoutDailyReports} max={Math.max(1, active)} />
            <MetricBar label="Placements with no weekly submission" value={placementsWithoutWeeklySubmissions} max={Math.max(1, active)} />
            <MetricBar label="Weekly reports approved" value={approvedWeekly} max={Math.max(1, filteredWeekly.length)} />
            <MetricBar label="Awaiting supervisor review" value={pendingWeekly} max={Math.max(1, filteredWeekly.length)} />
            <MetricBar label="Returned for revision" value={needsRevision} max={Math.max(1, filteredWeekly.length)} />
            <p style={{ color: '#64748b', fontSize: 12 }}>{filteredWeekly.length} weekly submissions tracked.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title={isUniversity ? 'Placements by department' : 'Internship portfolio by department'} description="Distribution of placed students across departments." />
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            {departmentCounts.length ? departmentCounts.map(([name, count]) => <MetricBar key={name} label={name} value={count} max={Math.max(1, ...departmentCounts.map((x) => x[1]))} />) : <p style={{ color: '#64748b' }}>No department data available.</p>}
          </div>
        </Card>
        {isUniversity && <Card>
          <CardHeader title="Placements by programme" description="Student programmes represented in the filtered placements." />
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            {programCounts.length ? programCounts.map(([name, count]) => <MetricBar key={name} label={name} value={count} max={Math.max(1, ...programCounts.map((x) => x[1]))} />) : <p style={{ color: '#64748b' }}>No programme data available.</p>}
          </div>
        </Card>}
        <Card>
          <CardHeader title="Application pipeline" description="Application status distribution in the selected date and student filters." />
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            {applicationStages.map((stage) => <MetricBar key={stage.label} label={stage.label} value={stage.value} max={Math.max(1, ...applicationStages.map((s) => s.value))} />)}
          </div>
        </Card>
        <Card>
          <CardHeader
            title={isUniversity ? 'Faculty supervisor workload' : 'Site supervisor workload'}
            description={isUniversity ? 'Number of placements assigned to each university faculty supervisor.' : 'Number of hosted placements assigned to each company site supervisor.'}
          />
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            {supervisorCounts.length ? supervisorCounts.map(([name, count]) => <MetricBar key={name} label={name} value={count} max={Math.max(1, ...supervisorCounts.map((x) => x[1]))} />) : <p style={{ color: '#64748b' }}>No supervisor assignments yet.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Evaluation performance" description="Average score from submitted midterm and final evaluations." />
          <div style={{ padding: 16, display: 'grid', gap: 8 }}>
            <strong style={{ fontSize: 30 }}>{evaluationAverage === null ? '—' : evaluationAverage.toFixed(1)}</strong>
            <span style={{ color: '#64748b', fontSize: 13 }}>{gradedEvaluations.length} scored evaluations · {filteredEvaluations.filter((e) => e.type === 'midterm').length} midterm · {filteredEvaluations.filter((e) => e.type === 'final').length} final</span>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={isUniversity ? 'Student and placement register' : 'Student grade register'} description={isUniversity ? 'Placement, faculty assignment, and official grade records.' : 'Final grades are read-only for company users and are entered by assigned university faculty supervisors.'} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 12px' }}>
          <button type="button" onClick={() => downloadCsv(isUniversity ? 'sims-university-placement-register.csv' : 'sims-company-placement-register.csv', [
            ['Student', 'Email', 'Department', 'Programme', 'Opportunity', 'Status', isUniversity ? 'Faculty supervisor' : 'Site supervisor', 'Final grade', 'Created at'],
            ...filteredPlacements.map((p) => [p.student?.full_name, p.student?.email, p.student?.department, p.student?.student_profile?.program, p.posting?.title, p.status, isUniversity ? p.faculty_supervisor?.full_name : p.site_supervisor?.full_name, p.final_grade, p.created_at]),
          ])} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}><Download size={16} /> Export CSV</button>
        </div>
        {filteredPlacements.length === 0 ? <EmptyState title="No placements match these filters" description="Change or clear the filters to see more records." /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Student', 'Department / programme', 'Opportunity', 'Status', isUniversity ? 'Faculty supervisor' : 'Site supervisor', 'Final grade'].map((label) => <th key={label} style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{label}</th>)}</tr></thead>
              <tbody>{filteredPlacements.map((placement) => <tr key={placement.id}>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{placement.student?.full_name ?? 'Student'}<div style={{ color: '#64748b' }}>{placement.student?.email}</div></td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{placement.student?.department ?? '—'}<div style={{ color: '#64748b' }}>{placement.student?.student_profile?.program ?? '—'}</div></td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{placement.posting?.title ?? '—'}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', textTransform: 'capitalize' }}>{placement.status}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{(isUniversity ? placement.faculty_supervisor?.full_name : placement.site_supervisor?.full_name) ?? 'Not assigned'}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{placement.final_grade === null ? 'Pending' : `${Number(placement.final_grade).toFixed(1)} / 100`}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
