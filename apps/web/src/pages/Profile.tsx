import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText, KeyRound, Save, Upload, UserRound } from 'lucide-react';
import { ROLE_LABELS } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { useStudentProfile, useSaveStudentProfile } from '@/hooks/useStudentProfile';
import { supabase } from '@/lib/supabase';
import { openDocument, uploadCv } from '@/lib/storage';
import { errorMessage } from '@/lib/utils';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  useToast,
} from '@/components/ui';

export function ProfilePage() {
  const { profile, refreshProfile, updatePassword } = useAuth();
  const { toast } = useToast();
  const studentProfile = useStudentProfile(profile?.role === 'student' ? profile?.id : undefined);
  const saveStudentProfile = useSaveStudentProfile(profile?.id);

  const [form, setForm] = useState({ fullName: '', phone: '', department: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [studentForm, setStudentForm] = useState({ studentId: '', program: '', year: '', skills: '' });
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentError, setStudentError] = useState('');

  const [password, setPassword] = useState({ next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({ fullName: profile.full_name, phone: profile.phone ?? '', department: profile.department ?? '' });
  }, [profile]);

  useEffect(() => {
    if (!studentProfile.data) return;
    setStudentForm({
      studentId: studentProfile.data.student_id ?? '',
      program: studentProfile.data.program ?? '',
      year: studentProfile.data.year ? String(studentProfile.data.year) : '',
      skills: (studentProfile.data.skills ?? []).join(', '),
    });
  }, [studentProfile.data]);

  if (!profile) return null;

  const isStudent = profile.role === 'student';
  const tenant = profile.university?.name ?? profile.company?.name ?? 'Platform administration';

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError('');
    if (!form.fullName.trim()) {
      setProfileError('Your name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: form.fullName.trim(), phone: form.phone.trim() || null, department: form.department.trim() || null })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: 'Profile updated', tone: 'success' });
    } catch (caught) {
      setProfileError(errorMessage(caught));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveStudentDetails = async (event: FormEvent) => {
    event.preventDefault();
    setStudentError('');
    setSavingStudent(true);
    try {
      await saveStudentProfile.mutateAsync({
        student_id: studentForm.studentId.trim() || null,
        program: studentForm.program.trim() || null,
        year: studentForm.year ? Number(studentForm.year) : null,
        skills: studentForm.skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
        cv_path: studentProfile.data?.cv_path ?? null,
      });
      toast({ title: 'Student details saved', tone: 'success' });
    } catch (caught) {
      setStudentError(errorMessage(caught));
    } finally {
      setSavingStudent(false);
    }
  };

  const uploadNewCv = async (file: File) => {
    setUploading(true);
    setStudentError('');
    try {
      const path = await uploadCv(file, profile.id);
      await saveStudentProfile.mutateAsync({
        student_id: studentForm.studentId.trim() || null,
        program: studentForm.program.trim() || null,
        year: studentForm.year ? Number(studentForm.year) : null,
        skills: studentForm.skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
        cv_path: path,
      });
      toast({ title: 'CV uploaded', tone: 'success' });
      if (fileInput.current) fileInput.current.value = '';
    } catch (caught) {
      setStudentError(errorMessage(caught));
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    if (password.next.length < 8) {
      setPasswordError('Use at least 8 characters.');
      return;
    }
    if (password.next !== password.confirm) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(password.next);
      setPassword({ next: '', confirm: '' });
      toast({ title: 'Password updated', tone: 'success' });
    } catch (caught) {
      setPasswordError(errorMessage(caught));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader title="Profile" description="Manage your personal details, CV, and password." />

      <div className='profile-grid-1'>
        <div className='profile-space-y-6-1'>
          <Card>
            <CardHeader title="Personal details" description="Visible to your university or company workspace." />
            <form onSubmit={saveProfile} className='profile-space-y-4-1'>
              {profileError ? <Alert tone="danger">{profileError}</Alert> : null}
              <div className='profile-grid-2'>
                <Field label="Full name" htmlFor="full-name" required>
                  <Input
                    id="full-name"
                    value={form.fullName}
                    onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  />
                </Field>
                <Field label="Email" htmlFor="email" hint="Contact support to change your email.">
                  <Input id="email" value={profile.email} disabled />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="(555) 010-2030"
                  />
                </Field>
                {profile.role === 'student' || profile.role === 'faculty_supervisor' ? (
                  <Field label="Department" htmlFor="department" hint="Use the same department name for students and their faculty supervisors.">
                    <Input
                      id="department"
                      value={form.department}
                      onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                      placeholder="e.g. Business Information Technology"
                    />
                  </Field>
                ) : null}
              </div>
              <Button type="submit" loading={savingProfile}>
                <Save className='profile-h-4-1' /> Save profile
              </Button>
            </form>
          </Card>

          {isStudent ? (
            <Card>
              <CardHeader
                title="Student details"
                description="Companies see this information on your applications."
                actions={
                  studentProfile.data?.cv_path ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await openDocument('cvs', studentProfile.data!.cv_path!);
                        } catch (caught) {
                          toast({ title: 'Could not open CV', description: errorMessage(caught), tone: 'error' });
                        }
                      }}
                    >
                      <FileText className='profile-h-35-1' /> View CV
                    </Button>
                  ) : undefined
                }
              />
              <form onSubmit={saveStudentDetails} className='profile-space-y-4-1'>
                {studentError ? <Alert tone="danger">{studentError}</Alert> : null}
                {studentProfile.isLoading ? <Alert tone="info">Loading your student details…</Alert> : null}
                {studentProfile.isError ? (
                  <Alert tone="danger" title="Could not load student details">
                    Student information could not be retrieved. Retry before saving changes.
                    <Button size="sm" variant="secondary" onClick={() => void studentProfile.refetch()} loading={studentProfile.isFetching}>Retry</Button>
                  </Alert>
                ) : null}
                <div className='profile-grid-2'>
                  <Field label="Student ID" htmlFor="student-id">
                    <Input
                      id="student-id"
                      value={studentForm.studentId}
                      onChange={(event) => setStudentForm((current) => ({ ...current, studentId: event.target.value }))}
                      placeholder="BSU-2024-001"
                    />
                  </Field>
                  <Field label="Program" htmlFor="program">
                    <Input
                      id="program"
                      value={studentForm.program}
                      onChange={(event) => setStudentForm((current) => ({ ...current, program: event.target.value }))}
                      placeholder="Computer Science"
                    />
                  </Field>
                  <Field label="Year of study" htmlFor="year">
                    <Select
                      id="year"
                      value={studentForm.year}
                      onChange={(event) => setStudentForm((current) => ({ ...current, year: event.target.value }))}
                    >
                      <option value="">Not specified</option>
                      {[1, 2, 3, 4, 5, 6].map((year) => (
                        <option key={year} value={year}>
                          Year {year}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Skills" htmlFor="skills" hint="Comma separated, e.g. TypeScript, SQL, Figma.">
                    <Input
                      id="skills"
                      value={studentForm.skills}
                      onChange={(event) => setStudentForm((current) => ({ ...current, skills: event.target.value }))}
                      placeholder="TypeScript, React, SQL"
                    />
                  </Field>
                </div>

                <div className='profile-rounded-xl-1'>
                  <p className='profile-text-sm-1'>CV</p>
                  <p className='profile-mt-05-1'>
                    PDF or Word up to 5 MB. {studentProfile.data?.cv_path ? 'A CV is on file.' : 'No CV uploaded yet.'}
                  </p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className='profile-hidden-1'
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadNewCv(file);
                    }}
                  />
                  <Button
                    className='profile-mt-3-1'
                    size="sm"
                    variant="secondary"
                    type="button"
                    loading={uploading}
                    disabled={studentProfile.isLoading || studentProfile.isError || savingStudent}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload className='profile-h-35-1' /> {studentProfile.data?.cv_path ? 'Replace CV' : 'Upload CV'}
                  </Button>
                </div>

                <Button type="submit" loading={savingStudent} disabled={studentProfile.isLoading || studentProfile.isError || uploading}>
                  <Save className='profile-h-4-1' /> Save student details
                </Button>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Password" description="Choose a strong password with at least 8 characters." />
            <form onSubmit={changePassword} className='profile-space-y-4-1'>
              {passwordError ? <Alert tone="danger">{passwordError}</Alert> : null}
              <div className='profile-grid-2'>
                <Field label="New password" htmlFor="new-password" required>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password.next}
                    onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))}
                  />
                </Field>
                <Field label="Confirm password" htmlFor="confirm-password" required>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={password.confirm}
                    onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))}
                  />
                </Field>
              </div>
              <Button type="submit" variant="secondary" loading={savingPassword}>
                <KeyRound className='profile-h-4-1' /> Update password
              </Button>
            </form>
          </Card>
        </div>

        <div className='profile-space-y-4-2'>
          <Card className='profile-p-5-1'>
            <div className='profile-flex-1'>
              <Avatar name={profile.full_name} className='profile-h-12-1' />
              <div className='profile-min-w-0-1'>
                <p className='profile-truncate-1'>{profile.full_name}</p>
                <p className='profile-truncate-2'>{profile.email}</p>
              </div>
            </div>
            <div className='profile-mt-4-1'>
              <div className='profile-flex-2'>
                <span className='profile-text-slate-500-1'>Role</span>
                <Badge tone="violet">{ROLE_LABELS[profile.role]}</Badge>
              </div>
              <div className='profile-flex-2'>
                <span className='profile-text-slate-500-1'>Workspace</span>
                <span className='profile-text-right-1'>{tenant}</span>
              </div>
              {isStudent && studentProfile.data?.student_id ? (
                <div className='profile-flex-2'>
                  <span className='profile-text-slate-500-1'>Student ID</span>
                  <span className='profile-text-slate-800-1'>{studentProfile.data.student_id}</span>
                </div>
              ) : null}
            </div>
            <div className='profile-mt-4-2'>
              <UserRound className='profile-mt-05-2' />
              Roles and tenant assignments can only be changed by a platform or tenant administrator.
            </div>
          </Card>

          {isStudent && studentProfile.isLoading ? (
            <div className='profile-flex-3'>
              <Spinner className='profile-h-5-1' />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
