import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useUniversities } from '@/hooks/useLookups';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, Field, Input, Select, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/utils';

export function Signup() {
  const { signUpStudent } = useAuth();
  const navigate = useNavigate();
  const universities = useUniversities();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    universityId: '',
    studentId: '',
    program: '',
    year: '3',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (!form.universityId) {
      setError('Select your university.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUpStudent({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        universityId: form.universityId,
        studentId: form.studentId.trim(),
        program: form.program.trim(),
        year: Number(form.year),
      });
      if (result.needsConfirmation) {
        setNeedsConfirmation(true);
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (needsConfirmation) {
    return (
      <AuthShell title="Check your inbox" subtitle="Confirm your email to finish creating your student account.">
        <Alert tone="success" title="Account created">
          We sent a confirmation link to <strong>{form.email}</strong>. After confirming, return here and sign in.
        </Alert>
        <Link to="/login" className='signup-mt-5-1'>
          <Button className='signup-w-full-1'>Go to sign in</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      title="Create a student account"
      subtitle="Find internships and graduate roles from every partner university and company."
    >
      <form onSubmit={handleSubmit} className='signup-space-y-4-1'>
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className='signup-grid-1'>
          <Field label="Full name" htmlFor="fullName" required className='signup-col-span-2-1'>
            <Input
              id="fullName"
              required
              value={form.fullName}
              onChange={(event) => update('fullName', event.target.value)}
              placeholder="Ava Thompson"
            />
          </Field>

          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="you@university.edu"
            />
          </Field>

          <Field label="Password" htmlFor="password" required hint="At least 8 characters.">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <Field label="University" htmlFor="university" required className='signup-col-span-2-1'>
            {universities.isLoading ? (
              <div className='signup-flex-1'>
                <Spinner className='signup-h-4-1' /> Loading universities…
              </div>
            ) : (
              <Select
                id="university"
                required
                value={form.universityId}
                onChange={(event) => update('universityId', event.target.value)}
              >
                <option value="">Select your university</option>
                {(universities.data ?? []).map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Student ID" htmlFor="studentId">
            <Input
              id="studentId"
              value={form.studentId}
              onChange={(event) => update('studentId', event.target.value)}
              placeholder="BSU-2024-001"
            />
          </Field>

          <Field label="Program" htmlFor="program">
            <Input
              id="program"
              value={form.program}
              onChange={(event) => update('program', event.target.value)}
              placeholder="Computer Science"
            />
          </Field>

          <Field label="Year of study" htmlFor="year" className='signup-col-span-2-1'>
            <Select id="year" value={form.year} onChange={(event) => update('year', event.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <p className='signup-text-xs-1'>
          Staff and company accounts are created by invitation from your university coordinator, company admin, or
          the platform team.
        </p>

        <Button type="submit" className='signup-w-full-1' loading={submitting}>
          Create account
        </Button>

        <p className='signup-text-center-1'>
          Already have an account?{' '}
          <Link to="/login" className='signup-font-medium-1'>
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
