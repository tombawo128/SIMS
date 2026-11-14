import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Plus,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  APPLICATION_STATUS_LABELS,
  LOG_STATUS_LABELS,
  POSTING_TYPE_LABELS,
  formatDate,
} from '@sims/shared';
import type { AppNotification } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { useApplications } from '@/hooks/useApplications';
import {
  usePendingLogs,
  usePlacements,
} from '@/hooks/usePlacements';
import {
  useCompanyStats,
  useFacultyStats,
  usePlatformStats,
  useUniversityStats,
} from '@/hooks/useDashboardStats';
import { useCompanies, useUniversities } from '@/hooks/useLookups';
import { usePostings } from '@/hooks/usePostings';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

export function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role;
  const isStaff = role === 'faculty_supervisor';
  const canSeeApplications = role !== 'platform_admin';

  const applications = useApplications(canSeeApplications);
  const placements = usePlacements();
  const pendingLogs = usePendingLogs(isStaff);
  const notifications = useNotifications(profile?.id);

  const companyStats = useCompanyStats(role === 'company_admin' || role === 'site_supervisor');
  const universityStats = useUniversityStats(role === 'coordinator');
  const facultyStats = useFacultyStats(role === 'faculty_supervisor');
  const platformStats = usePlatformStats(role === 'platform_admin');
  const universities = useUniversities();
  const companies = useCompanies();
  const recommended = usePostings(
    { search: '', type: '', location: '', remoteOnly: false },
  );

  if (!profile) return null;

  const firstName = profile.full_name.split(' ')[0] || 'there';
  const roleDescription: Record<string, string> = {
    student: 'Track your applications, placement, weekly logs, and evaluations.',
    coordinator: 'Monitor placements, applications, and faculty assignments across your university.',
    faculty_supervisor: 'Review weekly logs, log check-ins, and record final grades.',
    site_supervisor: 'Review applications and supervise your interns.',
    company_admin: 'Manage opportunities and oversee every placement at your company.',
    platform_admin: 'Manage universities, companies, and platform-wide activity.',
  };

  const activeApplications = (applications.data ?? []).filter((application) =>
    ['submitted', 'under_review', 'shortlisted'].includes(application.status),
  );
  const activePlacement = (placements.data ?? []).find((placement) => placement.status === 'active');
  const placementsWithoutFaculty = (placements.data ?? []).filter(
    (placement) => placement.status === 'active' && !placement.faculty_supervisor_id,
  );
  const unreadNotifications = (notifications.data ?? []).filter(
    (notification: AppNotification) => !notification.read_at,
  ).length;

  const studentPostings = (recommended.data ?? []).slice(0, 3);
  const recentApplications = (applications.data ?? []).slice(0, 5);
  const visibleLogs = (pendingLogs.data ?? []).slice(0, 5);

  const cards: { label: string; value: string | number; hint?: string; icon: JSX.Element }[] =
    role === 'student'
      ? [
          {
            label: 'Applications',
            value: applications.isLoading || applications.isError ? '—' : applications.data?.length ?? 0,
            hint: applications.isLoading
              ? 'Loading applications…'
              : applications.isError
                ? 'Applications could not be loaded'
                : `${activeApplications.length} in progress`,
            icon: <FileCheck2 className='dashboard-h-5-1' />,
          },
          {
            label: 'Active placement',
            value: placements.isLoading || placements.isError ? '—' : activePlacement ? 1 : 0,
            hint: placements.isLoading
              ? 'Loading placement…'
              : placements.isError
                ? 'Placement data could not be loaded'
                : activePlacement?.company?.name ?? 'No active placement yet',
            icon: <ClipboardList className='dashboard-h-5-1' />,
          },
          {
            label: 'Unread updates',
            value: notifications.isLoading || notifications.isError ? '—' : unreadNotifications,
            hint: notifications.isLoading
              ? 'Loading notifications…'
              : notifications.isError
                ? 'Notifications could not be loaded'
                : 'Notifications',
            icon: <Users className='dashboard-h-5-1' />,
          },
          {
            label: 'Completed',
            value: placements.isLoading || placements.isError
              ? '—'
              : (placements.data ?? []).filter((placement) => placement.status === 'completed').length,
            hint: placements.isLoading
              ? 'Loading placements…'
              : placements.isError
                ? 'Placement data could not be loaded'
                : 'Placements',
            icon: <GraduationCap className='dashboard-h-5-1' />,
          },
        ]
      : role === 'coordinator'
        ? [
            {
              label: 'Students',
              value: universityStats.data?.students ?? '—',
              icon: <Users className='dashboard-h-5-1' />,
            },
            {
              label: 'Active placements',
              value: universityStats.data?.active_placements ?? '—',
              icon: <ClipboardList className='dashboard-h-5-1' />,
            },
            {
              label: 'Pending applications',
              value: universityStats.data?.pending_applications ?? '—',
              icon: <FileCheck2 className='dashboard-h-5-1' />,
            },
            {
              label: 'Logs awaiting review',
              value: universityStats.data?.pending_logs ?? '—',
              icon: <ClipboardList className='dashboard-h-5-1' />,
            },
            {
              label: 'Need a faculty supervisor',
              value: universityStats.data?.placements_without_faculty ?? '—',
              icon: <UserCheck className='dashboard-h-5-1' />,
            },
            {
              label: 'Completed placements',
              value: universityStats.data?.completed_placements ?? '—',
              icon: <GraduationCap className='dashboard-h-5-1' />,
            },
          ]
        : role === 'faculty_supervisor'
          ? [
              {
                label: 'My placements',
                value: facultyStats.data?.placements ?? '—',
                icon: <ClipboardList className='dashboard-h-5-1' />,
              },
              {
                label: 'Students',
                value: facultyStats.data?.students ?? '—',
                icon: <Users className='dashboard-h-5-1' />,
              },
              {
                label: 'Logs awaiting review',
                value: facultyStats.data?.pending_logs ?? '—',
                icon: <FileCheck2 className='dashboard-h-5-1' />,
              },
              {
                label: 'Check-ins logged',
                value: facultyStats.data?.check_ins ?? '—',
                icon: <CalendarDays className='dashboard-h-5-1' />,
              },
            ]
          : role === 'platform_admin'
            ? [
                {
                  label: 'Universities',
                  value: platformStats.data?.universities ?? '—',
                  icon: <GraduationCap className='dashboard-h-5-1' />,
                },
                {
                  label: 'Companies',
                  value: platformStats.data?.companies ?? '—',
                  icon: <Building2 className='dashboard-h-5-1' />,
                },
                {
                  label: 'Active placements',
                  value: platformStats.data?.active_placements ?? '—',
                  icon: <ClipboardList className='dashboard-h-5-1' />,
                },
                {
                  label: 'Published postings',
                  value: platformStats.data?.published_postings ?? '—',
                  icon: <Briefcase className='dashboard-h-5-1' />,
                },
              ]
            : [
                {
                  label: 'Published postings',
                  value: companyStats.data?.published_postings ?? '—',
                  icon: <Briefcase className='dashboard-h-5-1' />,
                },
                {
                  label: 'New applications',
                  value: companyStats.data?.new_applications ?? '—',
                  icon: <FileCheck2 className='dashboard-h-5-1' />,
                },
                {
                  label: 'Active placements',
                  value: companyStats.data?.active_placements ?? '—',
                  icon: <ClipboardList className='dashboard-h-5-1' />,
                },
                {
                  label: 'Logs awaiting review',
                  value: companyStats.data?.pending_logs ?? '—',
                  icon: <ClipboardList className='dashboard-h-5-1' />,
                },
              ];

  const primaryAction =
    role === 'company_admin' || role === 'site_supervisor' ? (
      <Link to="/manage/postings/new">
        <Button>
          <Plus className='dashboard-h-4-1' /> New posting
        </Button>
      </Link>
    ) : role === 'coordinator' || role === 'faculty_supervisor' ? (
      <Link to="/placements">
        <Button variant="secondary">View placements</Button>
      </Link>
    ) : role === 'platform_admin' ? (
      <Link to="/tenants">
        <Button variant="secondary">Manage tenants</Button>
      </Link>
    ) : (
      <Link to="/postings">
        <Button>
          Browse opportunities <ArrowRight className='dashboard-h-4-1' />
        </Button>
      </Link>
    );

  return (
    <div>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={roleDescription[role ?? 'student']}
        actions={primaryAction}
      />

      {role === 'faculty_supervisor' ? (
        <div className='dashboard-mb-6-1'>
          <Card>
            <CardHeader
              title="Logs awaiting review"
              description="Daily entries combined into weekly reports that need your approval."
              actions={
                <Link to="/placements" className='dashboard-text-xs-1'>
                  All placements
                </Link>
              }
            />
            {visibleLogs.length === 0 ? (
              <EmptyState title="No logs awaiting review" description="New submissions will appear here." />
            ) : (
              <div className='dashboard-divide-y-1'>
                {visibleLogs.map((log) => (
                  <Link
                    key={log.id}
                    to={`/placements/${log.placement_id}`}
                    className='dashboard-flex-1'
                  >
                    <div className='dashboard-min-w-0-1'>
                      <p className='dashboard-truncate-1'>
                        Week {log.week_number} · {log.placement?.student?.full_name ?? 'Student'}
                      </p>
                      <p className='dashboard-truncate-2'>
                        {log.placement?.posting?.title ?? 'Placement'} · submitted {formatDate(log.submitted_at)}
                      </p>
                    </div>
                    <Badge tone="amber">{LOG_STATUS_LABELS.submitted}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      <div className='dashboard-grid-1'>
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} icon={card.icon} />
        ))}
      </div>

      <div className='dashboard-mt-6-1'>
        <div className='dashboard-space-y-6-1'>
          {role === 'student' ? (
            <>
              {activePlacement ? (
                <Card>
                  <CardHeader
                    title="Current placement"
                    description={`${activePlacement.company?.name ?? 'Company'} · ${activePlacement.posting?.title ?? 'Placement'}`}
                    actions={
                      <Link to={`/placements/${activePlacement.id}`}>
                        <Button size="sm" variant="secondary">
                          Open placement
                        </Button>
                      </Link>
                    }
                  />
                  <div className='dashboard-grid-2'>
                    <div>
                      <p className='dashboard-text-xs-2'>Dates</p>
                      <p className='dashboard-mt-1-1'>
                        {formatDate(activePlacement.start_date)} – {formatDate(activePlacement.end_date)}
                      </p>
                    </div>
                    <div>
                      <p className='dashboard-text-xs-2'>Site supervisor</p>
                      <p className='dashboard-mt-1-1'>
                        {activePlacement.site_supervisor?.full_name ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className='dashboard-text-xs-2'>Faculty supervisor</p>
                      <p className='dashboard-mt-1-1'>
                        {activePlacement.faculty_supervisor?.full_name ?? 'Not assigned'}
                      </p>
                    </div>
                  </div>
                </Card>
              ) : null}

              <Card>
                <CardHeader
                  title="Recommended opportunities"
                  description="Published roles visible to your university."
                  actions={
                    <Link to="/postings" className='dashboard-text-xs-1'>
                      Browse all
                    </Link>
                  }
                />
                {studentPostings.length === 0 ? (
                  <EmptyState
                    title="No opportunities yet"
                    description="New postings from partner companies will show up here."
                    action={
                      <Link to="/postings">
                        <Button size="sm" variant="secondary">Refresh opportunities</Button>
                      </Link>
                    }
                  />
                ) : (
                  <div className='dashboard-divide-y-1'>
                    {studentPostings.map((posting) => (
                      <Link
                        key={posting.id}
                        to={`/postings/${posting.id}`}
                        className='dashboard-flex-1'
                      >
                        <div className='dashboard-min-w-0-1'>
                          <p className='dashboard-truncate-1'>{posting.title}</p>
                          <p className='dashboard-truncate-2'>
                            {posting.company?.name ?? 'Company'} · {POSTING_TYPE_LABELS[posting.type]} ·{' '}
                            {posting.is_remote ? 'Remote' : posting.location}
                          </p>
                        </div>
                        <Badge tone="blue">{POSTING_TYPE_LABELS[posting.type]}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : role === 'platform_admin' ? (
            <>
              <Card>
                <CardHeader
                  title="Universities"
                  description="Tenant workspaces on the platform."
                  actions={
                    <Link to="/tenants" className='dashboard-text-xs-1'>
                      Manage
                    </Link>
                  }
                />
                <div className='dashboard-divide-y-1'>
                  {(universities.data ?? []).map((university) => (
                    <div key={university.id} className='dashboard-flex-2'>
                      <div>
                        <p className='dashboard-text-sm-1'>{university.name}</p>
                        <p className='dashboard-text-xs-2'>{university.domain ?? university.slug}</p>
                      </div>
                      <StatusBadge status={university.status} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader
                  title="Companies"
                  description="Employer workspaces on the platform."
                  actions={
                    <Link to="/tenants" className='dashboard-text-xs-1'>
                      Manage
                    </Link>
                  }
                />
                <div className='dashboard-divide-y-1'>
                  {(companies.data ?? []).map((company) => (
                    <div key={company.id} className='dashboard-flex-2'>
                      <div>
                        <p className='dashboard-text-sm-1'>{company.name}</p>
                        <p className='dashboard-text-xs-2'>{company.industry ?? company.slug}</p>
                      </div>
                      <StatusBadge status={company.status} />
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <>
              {role === 'coordinator' && placementsWithoutFaculty.length > 0 ? (
                <Card>
                  <CardHeader
                    title="Placements without a faculty supervisor"
                    description="Assign a faculty supervisor to keep supervision on track."
                  />
                  <div className='dashboard-divide-y-1'>
                    {placementsWithoutFaculty.map((placement) => (
                      <Link
                        key={placement.id}
                        to={`/placements/${placement.id}`}
                        className='dashboard-flex-1'
                      >
                        <div>
                          <p className='dashboard-text-sm-1'>
                            {placement.student?.full_name ?? 'Student'}
                          </p>
                          <p className='dashboard-text-xs-2'>
                            {placement.company?.name} · {placement.posting?.title}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          Assign
                        </Button>
                      </Link>
                    ))}
                  </div>
                </Card>
              ) : null}

              <Card>
                <CardHeader
                  title="Recent applications"
                  description="Applications you can access based on your role."
                  actions={
                    <Link to="/applications" className='dashboard-text-xs-1'>
                      View all
                    </Link>
                  }
                />
                {recentApplications.length === 0 ? (
                  <EmptyState title="No applications yet" />
                ) : (
                  <div className='dashboard-divide-y-1'>
                    {recentApplications.map((application) => (
                      <Link
                        key={application.id}
                        to="/applications"
                        className='dashboard-flex-1'
                      >
                        <div className='dashboard-min-w-0-1'>
                          <p className='dashboard-truncate-1'>
                            {application.student?.full_name ?? 'Applicant'}
                          </p>
                          <p className='dashboard-truncate-2'>
                            {application.posting?.title} · {application.company?.name}
                          </p>
                        </div>
                        <Badge tone="slate">{APPLICATION_STATUS_LABELS[application.status]}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>

        <div className='dashboard-space-y-6-2'>
          {role !== 'platform_admin' ? (
            <Card>
              <CardHeader title="Quick actions" />
              <div className='dashboard-space-y-2-1'>
                {role === 'student' ? (
                  <>
                    <QuickLink to="/postings" icon={<Briefcase className='dashboard-h-4-1' />} label="Browse opportunities" />
                    <QuickLink to="/applications" icon={<FileCheck2 className='dashboard-h-4-1' />} label="My applications" />
                    <QuickLink to="/placements" icon={<ClipboardList className='dashboard-h-4-1' />} label="My placement" />
                  </>
                ) : role === 'company_admin' || role === 'site_supervisor' ? (
                  <>
                    <QuickLink to="/manage/postings" icon={<Briefcase className='dashboard-h-4-1' />} label="Manage postings" />
                    <QuickLink to="/applications" icon={<FileCheck2 className='dashboard-h-4-1' />} label="Review applications" />
                    <QuickLink to="/placements" icon={<ClipboardList className='dashboard-h-4-1' />} label="Placements" />
                  </>
                ) : role === 'coordinator' ? (
                  <>
                    <QuickLink to="/people" icon={<Users className='dashboard-h-4-1' />} label="Students & faculty" />
                    <QuickLink to="/applications" icon={<FileCheck2 className='dashboard-h-4-1' />} label="Applications" />
                    <QuickLink to="/placements" icon={<ClipboardList className='dashboard-h-4-1' />} label="Placements" />
                  </>
                ) : (
                  <>
                    <QuickLink to="/placements" icon={<ClipboardList className='dashboard-h-4-1' />} label="My placements" />
                    <QuickLink to="/people" icon={<Users className='dashboard-h-4-1' />} label="Students" />
                    <QuickLink to="/applications" icon={<FileCheck2 className='dashboard-h-4-1' />} label="Applications" />
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Platform totals" />
              <div className='dashboard-space-y-3-1'>
                <Row label="Students" value={platformStats.data?.students ?? '—'} />
                <Row label="Applications" value={platformStats.data?.applications ?? '—'} />
                <Row label="Completed placements" value={platformStats.data?.completed_placements ?? '—'} />
              </div>
            </Card>
          )}

          {role !== 'platform_admin' ? (
            <Card>
              <CardHeader title="Notifications" description="Recent updates for you." />
              {(notifications.data ?? []).length === 0 ? (
                <EmptyState title="Nothing new" description="You are up to date." />
              ) : (
                <div className='dashboard-divide-y-1'>
                  {(notifications.data ?? []).slice(0, 4).map((notification) => (
                    <Link
                      key={notification.id}
                      to={notification.link ?? '/notifications'}
                      className='dashboard-block-1'
                    >
                      <p className='dashboard-text-sm-1'>{notification.title}</p>
                      <p className='dashboard-mt-05-1'>{notification.body}</p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: JSX.Element; label: string }) {
  return (
    <Link
      to={to}
      className='dashboard-flex-3'
    >
      <span className='dashboard-text-slate-400-1'>{icon}</span>
      {label}
      <ArrowRight className='dashboard-ml-auto-1' />
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className='dashboard-flex-4'>
      <span className='dashboard-text-slate-500-1'>{label}</span>
      <span className='dashboard-font-semibold-1'>{value}</span>
    </div>
  );
}
