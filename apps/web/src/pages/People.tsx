import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Mail, Search, UserPlus, Users } from 'lucide-react';
import {
  ROLE_LABELS,
  formatDate,
  toCsv,
} from '@sims/shared';
import type { InviteResult, UserRole } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import {
  useCompanyTeam,
  useInviteUser,
  useUniversityPeople,
} from '@/hooks/useLookups';
import { usePlacements } from '@/hooks/usePlacements';
import { downloadCsv, errorMessage } from '@/lib/utils';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Table,
  Tabs,
  Td,
  Th,
  useToast,
} from '@/components/ui';

type TabKey = 'students' | 'faculty' | 'team';

export function People() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('students');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>('faculty_supervisor');
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '' });
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [inviteError, setInviteError] = useState('');

  const invite = useInviteUser();
  const people = useUniversityPeople(
    profile?.role === 'coordinator' ? profile.university_id : undefined,
  );
  const team = useCompanyTeam(profile?.role === 'company_admin' ? profile.company_id : undefined);
  const placements = usePlacements();

  const facultyStudents = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string; email: string; placementId: string; title: string; company: string }>();
    for (const placement of placements.data ?? []) {
      if (placement.faculty_supervisor_id !== profile?.id) continue;
      map.set(placement.student_id, {
        id: placement.student_id,
        full_name: placement.student?.full_name ?? 'Student',
        email: placement.student?.email ?? '',
        placementId: placement.id,
        title: placement.posting?.title ?? 'Placement',
        company: placement.company?.name ?? '',
      });
    }
    return [...map.values()];
  }, [placements.data, profile?.id]);

  if (!profile) return null;

  const isCoordinator = profile.role === 'coordinator';
  const isCompanyAdmin = profile.role === 'company_admin';
  const isFaculty = profile.role === 'faculty_supervisor';

  const everyone = people.data ?? [];
  const facultyMembers = everyone.filter((person) => person.role === 'faculty_supervisor');
  const students = everyone.filter((person) => person.role === 'student');

  const term = search.trim().toLowerCase();
  const filter = (name: string, email: string) =>
    !term || name.toLowerCase().includes(term) || email.toLowerCase().includes(term);

  const tabs: { key: TabKey; label: string; count: number }[] = isCoordinator
    ? [
        { key: 'students', label: 'Students', count: students.length },
        { key: 'faculty', label: 'Faculty supervisors', count: facultyMembers.length },
      ]
    : [];

  const openInvite = (role: UserRole) => {
    setInviteRole(role);
    setInviteForm({ fullName: '', email: '' });
    setInviteResult(null);
    setInviteError('');
    setInviteOpen(true);
  };

  const submitInvite = async () => {
    setInviteError('');
    if (!inviteForm.fullName.trim() || !inviteForm.email.trim()) {
      setInviteError('Enter a name and email.');
      return;
    }
    try {
      const result = await invite.mutateAsync({
        email: inviteForm.email.trim(),
        full_name: inviteForm.fullName.trim(),
        role: inviteRole,
        university_id: inviteRole === 'faculty_supervisor' ? profile.university_id ?? undefined : undefined,
        company_id: inviteRole === 'site_supervisor' ? profile.company_id ?? undefined : undefined,
      });
      setInviteResult(result);
      toast({ title: 'Account created', description: `Share the temporary password with ${result.email}.`, tone: 'success' });
    } catch (caught) {
      setInviteError(errorMessage(caught));
    }
  };

  const exportStudents = () => {
    const csv = toCsv(
      ['Name', 'Email', 'Student ID', 'Program', 'Year', 'Skills'],
      students.map((student) => [
        student.full_name,
        student.email,
        student.student_profile?.student_id,
        student.student_profile?.program,
        student.student_profile?.year,
        (student.student_profile?.skills ?? []).join('; '),
      ]),
    );
    downloadCsv(`students-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div>
      <PageHeader
        title={isCoordinator ? 'Students & faculty' : isCompanyAdmin ? 'Company team' : 'My students'}
        description={
          isCoordinator
            ? 'Everyone enrolled or supervising at your university.'
            : isCompanyAdmin
              ? 'Site supervisors and admins who can review applications and supervise interns.'
              : 'Students assigned to you through active placements.'
        }
        actions={
          isCoordinator ? (
            <>
              <Button variant="secondary" onClick={exportStudents} disabled={!students.length}>
                <Download className="h-4 w-4" /> Export students
              </Button>
              <Button onClick={() => openInvite('faculty_supervisor')}>
                <UserPlus className="h-4 w-4" /> Invite faculty
              </Button>
            </>
          ) : isCompanyAdmin ? (
            <Button onClick={() => openInvite('site_supervisor')}>
              <UserPlus className="h-4 w-4" /> Invite site supervisor
            </Button>
          ) : undefined
        }
      />

      {isCoordinator ? (
        <Tabs
          className="mb-4"
          options={tabs.map((item) => ({ key: item.key, label: item.label, count: item.count }))}
          value={tab}
          onChange={(key) => setTab(key as TabKey)}
        />
      ) : null}

      <div className="mb-4 flex justify-end">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email"
          />
        </div>
      </div>

      {isCoordinator && tab === 'students' ? (
        people.isLoading ? (
          <Loading />
        ) : (
          <Card className="overflow-hidden">
            {students.filter((student) => filter(student.full_name, student.email)).length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No students found"
                description="Students appear here after they sign up with your university."
              />
            ) : (
              <Table className="border-0">
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Student ID</Th>
                    <Th>Program</Th>
                    <Th>Skills</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {students
                    .filter((student) => filter(student.full_name, student.email))
                    .map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/70">
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={student.full_name} />
                            <div>
                              <p className="text-sm font-medium text-slate-900">{student.full_name}</p>
                              <p className="text-xs text-slate-500">{student.email}</p>
                            </div>
                          </div>
                        </Td>
                        <Td className="text-sm text-slate-600">
                          {student.student_profile?.student_id ?? '—'}
                        </Td>
                        <Td className="text-sm text-slate-600">
                          {student.student_profile?.program ?? '—'}
                          {student.student_profile?.year ? (
                            <span className="text-xs text-slate-400"> · Year {student.student_profile.year}</span>
                          ) : null}
                        </Td>
                        <Td>
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {(student.student_profile?.skills ?? []).slice(0, 4).map((skill) => (
                              <Badge key={skill} tone="blue">
                                {skill}
                              </Badge>
                            ))}
                            {(student.student_profile?.skills ?? []).length === 0 ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : null}
                          </div>
                        </Td>
                        <Td className="text-xs text-slate-500">{formatDate(student.created_at)}</Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            )}
          </Card>
        )
      ) : null}

      {isCoordinator && tab === 'faculty' ? (
        people.isLoading ? (
          <Loading />
        ) : (
          <Card className="overflow-hidden">
            {facultyMembers.filter((faculty) => filter(faculty.full_name, faculty.email)).length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No faculty supervisors yet"
                description="Invite faculty so you can assign them to placements."
                action={
                  <Button size="sm" onClick={() => openInvite('faculty_supervisor')}>
                    Invite faculty
                  </Button>
                }
              />
            ) : (
              <Table className="border-0">
                <thead>
                  <tr>
                    <Th>Faculty supervisor</Th>
                    <Th>Role</Th>
                    <Th>Joined</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {facultyMembers
                    .filter((faculty) => filter(faculty.full_name, faculty.email))
                    .map((faculty) => (
                      <tr key={faculty.id} className="hover:bg-slate-50/70">
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={faculty.full_name} />
                            <div>
                              <p className="text-sm font-medium text-slate-900">{faculty.full_name}</p>
                              <p className="text-xs text-slate-500">{faculty.email}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone="violet">{ROLE_LABELS[faculty.role]}</Badge>
                        </Td>
                        <Td className="text-xs text-slate-500">{formatDate(faculty.created_at)}</Td>
                        <Td className="text-right">
                          <a href={`mailto:${faculty.email}`}>
                            <Button size="sm" variant="ghost">
                              <Mail className="h-3.5 w-3.5" /> Email
                            </Button>
                          </a>
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            )}
          </Card>
        )
      ) : null}

      {isCompanyAdmin ? (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            {team.isLoading ? (
              <Loading />
            ) : (team.data ?? []).filter((member) => filter(member.full_name, member.email)).length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No team members found"
                description="Invite site supervisors to review applications and supervise interns."
                action={
                  <Button size="sm" onClick={() => openInvite('site_supervisor')}>
                    Invite site supervisor
                  </Button>
                }
              />
            ) : (
              <Table className="border-0">
                <thead>
                  <tr>
                    <Th>Team member</Th>
                    <Th>Role</Th>
                    <Th>Joined</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(team.data ?? [])
                    .filter((member) => filter(member.full_name, member.email))
                    .map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50/70">
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={member.full_name} />
                            <div>
                              <p className="text-sm font-medium text-slate-900">{member.full_name}</p>
                              <p className="text-xs text-slate-500">{member.email}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone={member.role === 'company_admin' ? 'emerald' : 'blue'}>
                            {ROLE_LABELS[member.role]}
                          </Badge>
                        </Td>
                        <Td className="text-xs text-slate-500">{formatDate(member.created_at)}</Td>
                        <Td className="text-right">
                          <a href={`mailto:${member.email}`}>
                            <Button size="sm" variant="ghost">
                              <Mail className="h-3.5 w-3.5" /> Email
                            </Button>
                          </a>
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      ) : null}

      {isFaculty ? (
        placements.isLoading ? (
          <Loading />
        ) : facultyStudents.filter((student) => filter(student.full_name, student.email)).length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No students assigned"
            description="Your coordinator will assign you to placements. Students will then appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {facultyStudents
              .filter((student) => filter(student.full_name, student.email))
              .map((student) => (
                <Card key={student.id} className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={student.full_name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{student.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{student.email}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {student.title} · {student.company}
                  </p>
                  <Link to={`/placements/${student.placementId}`} className="mt-3 inline-block">
                    <Button size="sm" variant="secondary">
                      Open placement
                    </Button>
                  </Link>
                </Card>
              ))}
          </div>
        )
      ) : null}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={inviteRole === 'faculty_supervisor' ? 'Invite faculty supervisor' : 'Invite site supervisor'}
        description={
          inviteResult
            ? 'Account created. Share these credentials securely.'
            : 'The invite-user Edge Function creates the account with a temporary password.'
        }
        footer={
          inviteResult ? (
            <Button onClick={() => setInviteOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitInvite} loading={invite.isPending}>
                Create account
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {inviteError ? <Alert tone="danger">{inviteError}</Alert> : null}

          {inviteResult ? (
            <Alert tone="success" title="Account created">
              <div className="space-y-1">
                <p>Email: <strong>{inviteResult.email}</strong></p>
                <p>
                  Temporary password:{' '}
                  <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">{inviteResult.temporary_password}</code>
                </p>
                <p className="text-xs">The user should sign in and change this password from their profile.</p>
              </div>
            </Alert>
          ) : (
            <>
              <Field label="Full name" htmlFor="invite-name" required>
                <Input
                  id="invite-name"
                  value={inviteForm.fullName}
                  onChange={(event) => setInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Dr. Morgan Lee"
                />
              </Field>
              <Field label="Email" htmlFor="invite-email" required>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder={inviteRole === 'faculty_supervisor' ? 'name@university.edu' : 'name@company.com'}
                />
              </Field>
              <p className="text-xs text-slate-500">
                The account is created in your {inviteRole === 'faculty_supervisor' ? 'university' : 'company'} tenant
                with the {ROLE_LABELS[inviteRole]} role.
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
