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

  const [form, setForm] = useState({ fullName: '', phone: '' });
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
    setForm({ fullName: profile.full_name, phone: profile.phone ?? '' });
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
        .update({ full_name: form.fullName.trim(), phone: form.phone.trim() || null })
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Personal details" description="Visible to your university or company workspace." />
            <form onSubmit={saveProfile} className="space-y-4 px-5 py-5">
              {profileError ? <Alert tone="danger">{profileError}</Alert> : null}
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <Button type="submit" loading={savingProfile}>
                <Save className="h-4 w-4" /> Save profile
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
                      <FileText className="h-3.5 w-3.5" /> View CV
                    </Button>
                  ) : undefined
                }
              />
              <form onSubmit={saveStudentDetails} className="space-y-4 px-5 py-5">
                {studentError ? <Alert tone="danger">{studentError}</Alert> : null}
                <div className="grid gap-4 sm:grid-cols-2">
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

                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-sm font-medium text-slate-800">CV</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    PDF or Word up to 5 MB. {studentProfile.data?.cv_path ? 'A CV is on file.' : 'No CV uploaded yet.'}
                  </p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadNewCv(file);
                    }}
                  />
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    type="button"
                    loading={uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" /> {studentProfile.data?.cv_path ? 'Replace CV' : 'Upload CV'}
                  </Button>
                </div>

                <Button type="submit" loading={savingStudent}>
                  <Save className="h-4 w-4" /> Save student details
                </Button>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Password" description="Choose a strong password with at least 8 characters." />
            <form onSubmit={changePassword} className="space-y-4 px-5 py-5">
              {passwordError ? <Alert tone="danger">{passwordError}</Alert> : null}
              <div className="grid gap-4 sm:grid-cols-2">
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
                <KeyRound className="h-4 w-4" /> Update password
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={profile.full_name} className="h-12 w-12 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{profile.full_name}</p>
                <p className="truncate text-xs text-slate-500">{profile.email}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Role</span>
                <Badge tone="violet">{ROLE_LABELS[profile.role]}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Workspace</span>
                <span className="text-right text-slate-800">{tenant}</span>
              </div>
              {isStudent && studentProfile.data?.student_id ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Student ID</span>
                  <span className="text-slate-800">{studentProfile.data.student_id}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Roles and tenant assignments can only be changed by a platform or tenant administrator.
            </div>
          </Card>

          {isStudent && studentProfile.isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
