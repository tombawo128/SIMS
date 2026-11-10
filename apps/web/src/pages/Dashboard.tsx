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
  const isStaff = role !== 'student' && role !== 'platform_admin';
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
            value: applications.data?.length ?? 0,
            hint: `${activeApplications.length} in progress`,
            icon: <FileCheck2 className="h-5 w-5" />,
          },
          {
            label: 'Active placement',
            value: activePlacement ? 1 : 0,
            hint: activePlacement?.company?.name ?? 'No active placement yet',
            icon: <ClipboardList className="h-5 w-5" />,
          },
          {
            label: 'Unread updates',
            value: unreadNotifications,
            hint: 'Notifications',
            icon: <Users className="h-5 w-5" />,
          },
          {
            label: 'Completed',
            value: (placements.data ?? []).filter((placement) => placement.status === 'completed').length,
            hint: 'Placements',
            icon: <GraduationCap className="h-5 w-5" />,
          },
        ]
      : role === 'coordinator'
        ? [
            {
              label: 'Students',
              value: universityStats.data?.students ?? '—',
              icon: <Users className="h-5 w-5" />,
            },
            {
              label: 'Active placements',
              value: universityStats.data?.active_placements ?? '—',
              icon: <ClipboardList className="h-5 w-5" />,
            },
            {
              label: 'Pending applications',
              value: universityStats.data?.pending_applications ?? '—',
              icon: <FileCheck2 className="h-5 w-5" />,
            },
            {
              label: 'Logs awaiting review',
              value: universityStats.data?.pending_logs ?? '—',
              icon: <ClipboardList className="h-5 w-5" />,
            },
            {
              label: 'Need a faculty supervisor',
              value: universityStats.data?.placements_without_faculty ?? '—',
              icon: <UserCheck className="h-5 w-5" />,
            },
            {
              label: 'Completed placements',
              value: universityStats.data?.completed_placements ?? '—',
              icon: <GraduationCap className="h-5 w-5" />,
            },
          ]
        : role === 'faculty_supervisor'
          ? [
              {
                label: 'My placements',
                value: facultyStats.data?.placements ?? '—',
                icon: <ClipboardList className="h-5 w-5" />,
              },
              {
                label: 'Students',
                value: facultyStats.data?.students ?? '—',
                icon: <Users className="h-5 w-5" />,
              },
              {
                label: 'Logs awaiting review',
                value: facultyStats.data?.pending_logs ?? '—',
                icon: <FileCheck2 className="h-5 w-5" />,
              },
              {
                label: 'Check-ins logged',
                value: facultyStats.data?.check_ins ?? '—',
                icon: <CalendarDays className="h-5 w-5" />,
              },
            ]
          : role === 'platform_admin'
            ? [
                {
                  label: 'Universities',
                  value: platformStats.data?.universities ?? '—',
                  icon: <GraduationCap className="h-5 w-5" />,
                },
                {
                  label: 'Companies',
                  value: platformStats.data?.companies ?? '—',
                  icon: <Building2 className="h-5 w-5" />,
                },
                {
                  label: 'Active placements',
                  value: platformStats.data?.active_placements ?? '—',
                  icon: <ClipboardList className="h-5 w-5" />,
                },
                {
                  label: 'Published postings',
                  value: platformStats.data?.published_postings ?? '—',
                  icon: <Briefcase className="h-5 w-5" />,
                },
              ]
            : [
                {
                  label: 'Published postings',
                  value: companyStats.data?.published_postings ?? '—',
                  icon: <Briefcase className="h-5 w-5" />,
                },
                {
                  label: 'New applications',
                  value: companyStats.data?.new_applications ?? '—',
                  icon: <FileCheck2 className="h-5 w-5" />,
                },
                {
                  label: 'Active placements',
                  value: companyStats.data?.active_placements ?? '—',
                  icon: <ClipboardList className="h-5 w-5" />,
                },
                {
                  label: 'Logs awaiting review',
                  value: companyStats.data?.pending_logs ?? '—',
                  icon: <ClipboardList className="h-5 w-5" />,
                },
              ];

  const primaryAction =
    role === 'company_admin' || role === 'site_supervisor' ? (
      <Link to="/manage/postings/new">
        <Button>
          <Plus className="h-4 w-4" /> New posting
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
          Browse opportunities <ArrowRight className="h-4 w-4" />
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

      {role !== 'platform_admin' && role !== 'student' ? (
        <div className="mb-6">
          <Card>
            <CardHeader
              title="Logs awaiting review"
              description="Submitted weekly logs from placements you can access."
              actions={
                <Link to="/placements" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  All placements
                </Link>
              }
            />
            {visibleLogs.length === 0 ? (
              <EmptyState title="No logs awaiting review" description="New submissions will appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleLogs.map((log) => (
                  <Link
                    key={log.id}
                    to={`/placements/${log.placement_id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        Week {log.week_number} · {log.placement?.student?.full_name ?? 'Student'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} icon={card.icon} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
                  <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-500">Dates</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {formatDate(activePlacement.start_date)} – {formatDate(activePlacement.end_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Site supervisor</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {activePlacement.site_supervisor?.full_name ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Faculty supervisor</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
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
                    <Link to="/postings" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
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
                  <div className="divide-y divide-slate-100">
                    {studentPostings.map((posting) => (
                      <Link
                        key={posting.id}
                        to={`/postings/${posting.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{posting.title}</p>
                          <p className="truncate text-xs text-slate-500">
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
                    <Link to="/tenants" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      Manage
                    </Link>
                  }
                />
                <div className="divide-y divide-slate-100">
                  {(universities.data ?? []).map((university) => (
                    <div key={university.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{university.name}</p>
                        <p className="text-xs text-slate-500">{university.domain ?? university.slug}</p>
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
                    <Link to="/tenants" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      Manage
                    </Link>
                  }
                />
                <div className="divide-y divide-slate-100">
                  {(companies.data ?? []).map((company) => (
                    <div key={company.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{company.name}</p>
                        <p className="text-xs text-slate-500">{company.industry ?? company.slug}</p>
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
                  <div className="divide-y divide-slate-100">
                    {placementsWithoutFaculty.map((placement) => (
                      <Link
                        key={placement.id}
                        to={`/placements/${placement.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {placement.student?.full_name ?? 'Student'}
                          </p>
                          <p className="text-xs text-slate-500">
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
                    <Link to="/applications" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      View all
                    </Link>
                  }
                />
                {recentApplications.length === 0 ? (
                  <EmptyState title="No applications yet" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentApplications.map((application) => (
                      <Link
                        key={application.id}
                        to="/applications"
                        className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {application.student?.full_name ?? 'Applicant'}
                          </p>
                          <p className="truncate text-xs text-slate-500">
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

        <div className="space-y-6">
          {role !== 'platform_admin' ? (
            <Card>
              <CardHeader title="Quick actions" />
              <div className="space-y-2 p-4">
                {role === 'student' ? (
                  <>
                    <QuickLink to="/postings" icon={<Briefcase className="h-4 w-4" />} label="Browse opportunities" />
                    <QuickLink to="/applications" icon={<FileCheck2 className="h-4 w-4" />} label="My applications" />
                    <QuickLink to="/placements" icon={<ClipboardList className="h-4 w-4" />} label="My placement" />
                  </>
                ) : role === 'company_admin' || role === 'site_supervisor' ? (
                  <>
                    <QuickLink to="/manage/postings" icon={<Briefcase className="h-4 w-4" />} label="Manage postings" />
                    <QuickLink to="/applications" icon={<FileCheck2 className="h-4 w-4" />} label="Review applications" />
                    <QuickLink to="/placements" icon={<ClipboardList className="h-4 w-4" />} label="Placements" />
                  </>
                ) : role === 'coordinator' ? (
                  <>
                    <QuickLink to="/people" icon={<Users className="h-4 w-4" />} label="Students & faculty" />
                    <QuickLink to="/applications" icon={<FileCheck2 className="h-4 w-4" />} label="Applications" />
                    <QuickLink to="/placements" icon={<ClipboardList className="h-4 w-4" />} label="Placements" />
                  </>
                ) : (
                  <>
                    <QuickLink to="/placements" icon={<ClipboardList className="h-4 w-4" />} label="My placements" />
                    <QuickLink to="/people" icon={<Users className="h-4 w-4" />} label="Students" />
                    <QuickLink to="/applications" icon={<FileCheck2 className="h-4 w-4" />} label="Applications" />
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Platform totals" />
              <div className="space-y-3 p-5 text-sm">
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
                <div className="divide-y divide-slate-100">
                  {(notifications.data ?? []).slice(0, 4).map((notification) => (
                    <Link
                      key={notification.id}
                      to={notification.link ?? '/notifications'}
                      className="block px-5 py-3 transition hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{notification.body}</p>
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
      className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400" />
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
