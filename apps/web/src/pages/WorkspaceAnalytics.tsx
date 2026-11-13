import { useMemo } from 'react';
import { Briefcase, CheckCircle2, GraduationCap, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePlacements } from '@/hooks/usePlacements';
import { useApplications } from '@/hooks/useApplications';
import { useCompanyStats, useUniversityStats } from '@/hooks/useDashboardStats';
import { Alert, Card, CardHeader, EmptyState, PageHeader, Spinner, StatCard } from '@/components/ui';

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

export function WorkspaceAnalytics() {
  const { profile } = useAuth();
  const isUniversity = profile?.role === 'coordinator';
  const isCompany = profile?.role === 'company_admin';
  const placementsQuery = usePlacements();
  const applicationsQuery = useApplications();
  const universityStats = useUniversityStats(isUniversity);
  const companyStats = useCompanyStats(isCompany);
  const placements = placementsQuery.data ?? [];
  const applications = applicationsQuery.data ?? [];

  const gradeStats = useMemo(() => {
    const graded = placements.filter((item) => item.final_grade !== null);
    const average = graded.length
      ? graded.reduce((sum, item) => sum + Number(item.final_grade), 0) / graded.length
      : null;
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
  }, [placements]);

  const programCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const placement of placements) {
      const program = placement.student?.student_profile?.program?.trim() || 'Program not set';
      counts.set(program, (counts.get(program) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [placements]);

  if (!profile || (!isUniversity && !isCompany)) return <EmptyState title="Analytics unavailable" description="This workspace is available to university coordinators and company administrators." />;
  if (placementsQuery.isLoading || applicationsQuery.isLoading || (isUniversity && universityStats.isLoading) || (isCompany && companyStats.isLoading)) return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (placementsQuery.isError || applicationsQuery.isError || (isUniversity && universityStats.isError) || (isCompany && companyStats.isError)) return <Alert tone="danger">Analytics could not be loaded. Check your access and refresh the page.</Alert>;

  const active = placements.filter((p) => p.status === 'active').length;
  const completed = placements.filter((p) => p.status === 'completed').length;
  const students = new Set(placements.map((p) => p.student_id)).size;
  const maxBand = Math.max(1, ...gradeStats.bands.map((band) => band.value));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <PageHeader
        title={isUniversity ? 'University analytics' : 'Company analytics'}
        description={isUniversity ? 'Student participation, placement progress, weekly supervision, and official internship grades.' : 'Your interns, placement activity, application pipeline, and university-issued final internship grades.'}
      />

      {isUniversity ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
          <StatCard label="Total students" value={universityStats.data?.students ?? 0} icon={<Users size={19} />} hint="Students registered at your university" />
          <StatCard label="Faculty supervisors" value={universityStats.data?.faculty ?? 0} icon={<GraduationCap size={19} />} />
          <StatCard label="Active placements" value={universityStats.data?.active_placements ?? active} icon={<BriefcaseBusiness size={19} />} />
          <StatCard label="Completed placements" value={universityStats.data?.completed_placements ?? completed} icon={<CheckCircle2 size={19} />} />
          <StatCard label="Pending applications" value={universityStats.data?.pending_applications ?? 0} />
          <StatCard label="Weekly reports awaiting review" value={universityStats.data?.pending_logs ?? 0} />
          <StatCard label="Placements without faculty" value={universityStats.data?.placements_without_faculty ?? 0} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
          <StatCard label="Students hosted" value={students} icon={<Users size={19} />} hint="Unique students with placements at your company" />
          <StatCard label="Active placements" value={active} icon={<BriefcaseBusiness size={19} />} />
          <StatCard label="Completed placements" value={completed} icon={<CheckCircle2 size={19} />} />
          <StatCard label="Total opportunities" value={companyStats.data?.total_postings ?? 0} />
          <StatCard label="Published opportunities" value={companyStats.data?.published_postings ?? 0} />
          <StatCard label="New applications" value={companyStats.data?.new_applications ?? applications.length} />
          <StatCard label="Pending weekly reports" value={companyStats.data?.pending_logs ?? 0} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <Card>
          <CardHeader title="Final grade performance" description="Official grades recorded by assigned university faculty supervisors. Companies can view but cannot edit these grades." />
          <div style={{ padding: 16, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <strong style={{ fontSize: 32 }}>{gradeStats.average === null ? '—' : gradeStats.average.toFixed(1)}</strong>
              <span style={{ color: '#64748b', fontSize: 13 }}>average out of 100 · {gradeStats.graded} graded students</span>
            </div>
            {gradeStats.bands.map((band) => <MetricBar key={band.label} label={band.label} value={band.value} max={maxBand} />)}
            {gradeStats.graded === 0 ? <p style={{ color: '#64748b', fontSize: 13 }}>Final grades will appear here after the university supervisor completes grading.</p> : null}
          </div>
        </Card>

        <Card>
          <CardHeader title={isUniversity ? 'Placements by student program' : 'Your placement portfolio'} description={isUniversity ? 'Programs represented among students with placements.' : 'Current distribution of students hosted by your company.'} />
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            {isUniversity ? programCounts.length ? programCounts.map(([program, count]) => <MetricBar key={program} label={program} value={count} max={Math.max(1, ...programCounts.map((x) => x[1]))} />) : <p style={{ color: '#64748b' }}>No placement program data yet.</p> : (
              <>
                <MetricBar label="Active" value={active} max={Math.max(1, placements.length)} />
                <MetricBar label="Completed" value={completed} max={Math.max(1, placements.length)} />
                <MetricBar label="Other statuses" value={placements.length - active - completed} max={Math.max(1, placements.length)} />
              </>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={isUniversity ? 'Student and placement overview' : 'Student grade register'} description={isUniversity ? 'Students with placements, active supervision, and completed internships.' : 'Final grades are read-only for company users and are entered by the assigned university faculty supervisor.'} />
        {placements.length === 0 ? <EmptyState title="No placements yet" description="Placement records will appear here when applications are accepted." /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Student','Opportunity','Status','Faculty supervisor','Final grade'].map((label) => <th key={label} style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{label}</th>)}</tr></thead>
              <tbody>{placements.map((placement) => <tr key={placement.id}>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{placement.student?.full_name ?? 'Student'}<div style={{ color: '#64748b' }}>{placement.student?.email}</div></td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{placement.posting?.title ?? '—'}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', textTransform: 'capitalize' }}>{placement.status}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{placement.faculty_supervisor?.full_name ?? 'Not assigned'}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{placement.final_grade === null ? 'Pending' : `${Number(placement.final_grade).toFixed(1)} / 100`}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
