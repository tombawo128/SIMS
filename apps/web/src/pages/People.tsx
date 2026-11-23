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
  Spinner,
  Table,
  Tabs,
  Td,
  Th,
  useToast,
} from '@/components/ui';

type TabKey = 'students' | 'faculty' | 'team';

function localDateStamp() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

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

  const facultyStudents = useMemo(
    () => (placements.data ?? [])
      .filter((placement) => placement.faculty_supervisor_id === profile?.id)
      .map((placement) => ({
        id: placement.id,
        full_name: placement.student?.full_name ?? 'Student',
        email: placement.student?.email ?? '',
        placementId: placement.id,
        title: placement.posting?.title ?? 'Placement',
        company: placement.company?.name ?? '',
      })),
    [placements.data, profile?.id],
  );

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
    downloadCsv(`students-${localDateStamp()}.csv`, csv);
  };

  return (
    <section className="people-page">
      <section className="page-hero page-hero--people">
        <div><span className="page-hero__eyebrow">PEOPLE AND SUPERVISION</span><h1>{isCoordinator ? 'Your university community' : isCompanyAdmin ? 'Your company team' : 'Students under your supervision'}</h1><p>{isCoordinator ? 'Manage the people involved in placements across your university.' : isCompanyAdmin ? 'Keep your supervisors and company team organised.' : 'Access the students assigned to your faculty supervision.'}</p></div>
        <div className="page-hero__aside"><strong>{isCoordinator ? everyone.length : isCompanyAdmin ? (team.data ?? []).length : facultyStudents.length}</strong><span>{isCoordinator ? 'university members' : isCompanyAdmin ? 'team members' : 'assigned students'}</span><small>People connected to your workspace</small></div>
      </section>
      <div className="people-page__actions">
        {isCoordinator ? <><Button variant="secondary" onClick={exportStudents} disabled={!students.length}><Download className='people-h-4-1' /> Export students</Button><Button onClick={() => openInvite('faculty_supervisor')}><UserPlus className='people-h-4-1' /> Invite faculty</Button></> : isCompanyAdmin ? <Button onClick={() => openInvite('site_supervisor')}><UserPlus className='people-h-4-1' /> Invite site supervisor</Button> : null}
      </div> 
{isCoordinator ? (
        <Tabs
          className='people-mb-4-1'
          options={tabs.map((item) => ({ key: item.key, label: item.label, count: item.count }))}
          value={tab}
          onChange={(key) => setTab(key as TabKey)}
        />
      ) : null}

      <div className='people-mb-4-2'>
        <div className='people-relative-1'>
          <Search className='people-pointer-events-none-1' />
          <Input
            className='people-pl-9-1'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email"
          />
        </div>
      </div>

      {isCoordinator && tab === 'students' ? (
        people.isLoading ? (
          <Loading />
        ) : people.isError ? (
          <Alert tone="danger" title="Could not load university members">
            {errorMessage(people.error)} <Button size="sm" variant="secondary" onClick={() => void people.refetch()}>Try again</Button>
          </Alert>
        ) : (
          <Card className='people-overflow-hidden-1'>
            {students.filter((student) => filter(student.full_name, student.email)).length === 0 ? (
              <EmptyState
                icon={<Users className='people-h-5-1' />}
                title="No students found"
                description="Students appear here after they sign up with your university."
              />
            ) : (
              <Table className='people-border-0-1'>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Student ID</Th>
                    <Th>Program</Th>
                    <Th>Skills</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody className='people-divide-y-1'>
                  {students
                    .filter((student) => filter(student.full_name, student.email))
                    .map((student) => (
                      <tr key={student.id} className='people-bg-slate-5070-1'>
                        <Td>
                          <div className='people-flex-1'>
                            <Avatar name={student.full_name} />
                            <div>
                              <p className='people-text-sm-1'>{student.full_name}</p>
                              <p className='people-text-xs-1'>{student.email}</p>
                            </div>
                          </div>
                        </Td>
                        <Td className='people-text-sm-2'>
                          {student.student_profile?.student_id ?? '—'}
                        </Td>
                        <Td className='people-text-sm-2'>
                          {student.student_profile?.program ?? '—'}
                          {student.student_profile?.year ? (
                            <span className='people-text-xs-2'> · Year {student.student_profile.year}</span>
                          ) : null}
                        </Td>
                        <Td>
                          <div className='people-flex-2'>
                            {(student.student_profile?.skills ?? []).slice(0, 4).map((skill) => (
                              <Badge key={skill} tone="blue">
                                {skill}
                              </Badge>
                            ))}
                            {(student.student_profile?.skills ?? []).length === 0 ? (
                              <span className='people-text-xs-2'>—</span>
                            ) : null}
                          </div>
                        </Td>
                        <Td className='people-text-xs-1'>{formatDate(student.created_at)}</Td>
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
        ) : people.isError ? (
          <Alert tone="danger" title="Could not load faculty supervisors">
            {errorMessage(people.error)} <Button size="sm" variant="secondary" onClick={() => void people.refetch()}>Try again</Button>
          </Alert>
        ) : (
          <Card className='people-overflow-hidden-1'>
            {facultyMembers.filter((faculty) => filter(faculty.full_name, faculty.email)).length === 0 ? (
              <EmptyState
                icon={<Users className='people-h-5-1' />}
                title="No faculty supervisors yet"
                description="Invite faculty so you can assign them to placements."
                action={
                  <Button size="sm" onClick={() => openInvite('faculty_supervisor')}>
                    Invite faculty
                  </Button>
                }
              />
            ) : (
              <Table className='people-border-0-1'>
                <thead>
                  <tr>
                    <Th>Faculty supervisor</Th>
                    <Th>Role</Th>
                    <Th>Joined</Th>
                    <Th className='people-text-right-1'>Actions</Th>
                  </tr>
                </thead>
                <tbody className='people-divide-y-1'>
                  {facultyMembers
                    .filter((faculty) => filter(faculty.full_name, faculty.email))
                    .map((faculty) => (
                      <tr key={faculty.id} className='people-bg-slate-5070-1'>
                        <Td>
                          <div className='people-flex-1'>
                            <Avatar name={faculty.full_name} />
                            <div>
                              <p className='people-text-sm-1'>{faculty.full_name}</p>
                              <p className='people-text-xs-1'>{faculty.email}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone="violet">{ROLE_LABELS[faculty.role]}</Badge>
                        </Td>
                        <Td className='people-text-xs-1'>{formatDate(faculty.created_at)}</Td>
                        <Td className='people-text-right-1'>
                          <a href={`mailto:${faculty.email}`}>
                            <Button size="sm" variant="ghost">
                              <Mail className='people-h-35-1' /> Email
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
        <div className='people-space-y-4-1'>
          <Card className='people-overflow-hidden-1'>
            {team.isLoading ? (
              <Loading />
            ) : team.isError ? (
              <Alert tone="danger" title="Could not load company team">
                {errorMessage(team.error)} <Button size="sm" variant="secondary" onClick={() => void team.refetch()}>Try again</Button>
              </Alert>
            ) : (team.data ?? []).filter((member) => filter(member.full_name, member.email)).length === 0 ? (
              <EmptyState
                icon={<Users className='people-h-5-1' />}
                title="No team members found"
                description="Invite site supervisors to review applications and supervise interns."
                action={
                  <Button size="sm" onClick={() => openInvite('site_supervisor')}>
                    Invite site supervisor
                  </Button>
                }
              />
            ) : (
              <Table className='people-border-0-1'>
                <thead>
                  <tr>
                    <Th>Team member</Th>
                    <Th>Role</Th>
                    <Th>Joined</Th>
                    <Th className='people-text-right-1'>Actions</Th>
                  </tr>
                </thead>
                <tbody className='people-divide-y-1'>
                  {(team.data ?? [])
                    .filter((member) => filter(member.full_name, member.email))
                    .map((member) => (
                      <tr key={member.id} className='people-bg-slate-5070-1'>
                        <Td>
                          <div className='people-flex-1'>
                            <Avatar name={member.full_name} />
                            <div>
                              <p className='people-text-sm-1'>{member.full_name}</p>
                              <p className='people-text-xs-1'>{member.email}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone={member.role === 'company_admin' ? 'emerald' : 'blue'}>
                            {ROLE_LABELS[member.role]}
                          </Badge>
                        </Td>
                        <Td className='people-text-xs-1'>{formatDate(member.created_at)}</Td>
                        <Td className='people-text-right-1'>
                          <a href={`mailto:${member.email}`}>
                            <Button size="sm" variant="ghost">
                              <Mail className='people-h-35-1' /> Email
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
        ) : placements.isError ? (
          <Alert tone="danger" title="Could not load assigned placements">
            {errorMessage(placements.error)} <Button size="sm" variant="secondary" onClick={() => void placements.refetch()}>Try again</Button>
          </Alert>
        ) : facultyStudents.filter((student) => filter(student.full_name, student.email)).length === 0 ? (
          <EmptyState
            icon={<Users className='people-h-5-1' />}
            title="No students assigned"
            description="Your coordinator will assign you to placements. Students will then appear here."
          />
        ) : (
          <div className='people-grid-1'>
            {facultyStudents
              .filter((student) => filter(student.full_name, student.email))
              .map((student) => (
                <Card key={student.id} className='people-p-5-1'>
                  <div className='people-flex-1'>
                    <Avatar name={student.full_name} />
                    <div className='people-min-w-0-1'>
                      <p className='people-truncate-1'>{student.full_name}</p>
                      <p className='people-truncate-2'>{student.email}</p>
                    </div>
                  </div>
                  <p className='people-mt-3-1'>
                    {student.title} · {student.company}
                  </p>
                  <Link to={`/placements/${student.placementId}`} className='people-mt-3-2'>
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
        <div className='people-space-y-4-1'>
          {inviteError ? <Alert tone="danger">{inviteError}</Alert> : null}

          {inviteResult ? (
            <Alert tone="success" title="Account created">
              <div className='people-space-y-1-1'>
                <p>Email: <strong>{inviteResult.email}</strong></p>
                <p>
                  Temporary password:{' '}
                  <code className='people-rounded-1'>{inviteResult.temporary_password}</code>
                </p>
                <p className='people-text-xs-3'>The user should sign in and change this password from their profile.</p>
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
              <p className='people-text-xs-1'>
                The account is created in your {inviteRole === 'faculty_supervisor' ? 'university' : 'company'} tenant
                with the {ROLE_LABELS[inviteRole]} role.
              </p>
            </>
          )}
        </div>
      </Modal>
    </section>
  );
}

function Loading() {
  return (
    <div className='people-flex-3'>
      <Spinner className='people-h-6-1' />
    </div>
  );
}
