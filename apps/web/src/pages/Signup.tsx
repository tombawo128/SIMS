
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Info, ShieldCheck } from 'lucide-react';
import { MAX_PLATFORM_ADMINS } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { useUniversities } from '@/hooks/useLookups';
import { useAdminSignupAvailable } from '@/hooks/useAdminConsole';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, Field, Input, Select, Spinner } from '@/components/ui';
import { cn, errorMessage } from '@/lib/utils';

type Mode = 'student' | 'admin';

export function Signup() {
  const { signUpStudent, signUpAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const universities = useUniversities();
  const availability = useAdminSignupAvailable();

  // Undefined means the availability check has not completed or failed.
  // Only an explicit false means the administrator limit has been reached.
  const adminAvailable = availability.data !== false;

  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('mode') === 'admin' ? 'admin' : 'student',
  );

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    universityId: '',
    studentId: '',
    program: '',
    year: '3',
  });

  const [adminForm, setAdminForm] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateAdmin = (key: keyof typeof adminForm, value: string) => {
    setAdminForm((current) => ({ ...current, [key]: value }));
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (submitting) return;

    if (mode === 'admin') {
      if (!adminAvailable) {
        setError(
          'The maximum number of platform administrators has been reached.',
        );
        void availability.refetch();
        return;
      }

      if (adminForm.password.length < 8) {
        setError('Use at least 8 characters for your password.');
        return;
      }

      setSubmitting(true);

      try {
        const result = await signUpAdmin({
          email: adminForm.email.trim(),
          password: adminForm.password,
          fullName: adminForm.fullName.trim(),
        });

        if (result.needsConfirmation) {
          setNeedsConfirmation(true);
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch (caught) {
        setError(errorMessage(caught));
        void availability.refetch();
      } finally {
        setSubmitting(false);
      }

      return;
    }

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
    const wasAdmin = mode === 'admin';

    return (
      <AuthShell
        title="Check your inbox"
        subtitle={`Confirm your email to finish creating your ${wasAdmin ? 'administrator' : 'student'
          } account.`}
      >
        <Alert tone="success" title="Account created">
          We sent a confirmation link to{' '}
          <strong>{wasAdmin ? adminForm.email : form.email}</strong>.{' '}
          {wasAdmin
            ? 'After confirming, sign in to start managing the platform.'
            : 'After confirming, sign in — a general administrator will approve your account before you can use SIMS.'}
        </Alert>

        <Link to="/login" className="signup-mt-5-1">
          <Button className="signup-w-full-1">
            Go to sign in
          </Button>
        </Link>
      </AuthShell>
    );
  }

  const isAdmin = mode === 'admin';

  return (
    <AuthShell
      wide
      title={
        isAdmin
          ? 'Create an administrator account'
          : 'Create a student account'
      }
      subtitle={
        isAdmin
          ? 'Bootstrap a general administrator with full oversight of the platform.'
          : 'Find internships and graduate roles from every partner university and company.'
      }
    >
      {/* Account type selector */}
      <div
        className="signup-mode"
        role="group"
        aria-label="Account type"
      >
        <button
          type="button"
          onClick={() => switchMode('student')}
          aria-pressed={!isAdmin}
          className={cn(
            'signup-mode__btn',
            !isAdmin && 'signup-mode__btn--active',
          )}
        >
          <GraduationCap className="signup-mode__icon" />
          Student
        </button>

        <button
          type="button"
          onClick={() => switchMode('admin')}
          aria-pressed={isAdmin}
          className={cn(
            'signup-mode__btn',
            isAdmin && 'signup-mode__btn--active',
          )}
        >
          <ShieldCheck className="signup-mode__icon" />
          Administrator
        </button>
      </div>

      <form onSubmit={handleSubmit} className="signup-space-y-4-1">
        {error && <Alert tone="danger">{error}</Alert>}

        {/* Administrator registration */}
        {isAdmin ? (
          <>
            {!adminAvailable && (
              <Alert tone="info" title="Administrator registration unavailable">
                The maximum of {MAX_PLATFORM_ADMINS} platform administrators
                has been reached. You cannot create another administrator
                account.
              </Alert>
            )}

            {availability.isLoading && (
              <div className="signup-flex-1">
                <Spinner className="signup-h-4-1" />
                Checking administrator availability…
              </div>
            )}

            {availability.isError && (
              <Alert tone="info">
                We could not verify administrator availability. The server
                will verify your registration request before creating an
                account.
              </Alert>
            )}

            <div className="signup-admin-note">
              <span className="signup-admin-note__icon">
                <ShieldCheck className="signup-h-4-1" />
              </span>

              <div className="signup-admin-note__text">
                <p className="signup-admin-note__title">
                  Full platform access
                </p>

                <p className="signup-admin-note__body">
                  General administrators approve new accounts, manage every
                  user, and oversee all universities and companies. Only{' '}
                  {MAX_PLATFORM_ADMINS} administrator accounts can exist.
                </p>
              </div>
            </div>

            <div className="signup-grid-1">
              <Field
                label="Full name"
                htmlFor="admin-name"
                required
                className="signup-col-span-2-1"
              >
                <Input
                  id="admin-name"
                  required
                  value={adminForm.fullName}
                  onChange={(event) =>
                    updateAdmin('fullName', event.target.value)
                  }
                  placeholder="Dana Whitfield"
                />
              </Field>

              <Field label="Email" htmlFor="admin-email" required>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={adminForm.email}
                  onChange={(event) =>
                    updateAdmin('email', event.target.value)
                  }
                  placeholder="admin@platform.dev"
                />
              </Field>

              <Field
                label="Password"
                htmlFor="admin-password"
                required
                hint="At least 8 characters."
              >
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={adminForm.password}
                  onChange={(event) =>
                    updateAdmin('password', event.target.value)
                  }
                  placeholder="••••••••"
                />
              </Field>
            </div>

            <Button
              type="submit"
              className="signup-w-full-1"
              loading={submitting}
              disabled={!adminAvailable || submitting}
            >
              <ShieldCheck className="signup-h-4-1" />
              Create administrator account
            </Button>
          </>
        ) : (
          /* Student registration */
          <>
            <div className="signup-grid-1">
              <Field
                label="Full name"
                htmlFor="fullName"
                required
                className="signup-col-span-2-1"
              >
                <Input
                  id="fullName"
                  required
                  value={form.fullName}
                  onChange={(event) =>
                    update('fullName', event.target.value)
                  }
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
                  onChange={(event) =>
                    update('email', event.target.value)
                  }
                  placeholder="you@university.edu"
                />
              </Field>

              <Field
                label="Password"
                htmlFor="password"
                required
                hint="At least 8 characters."
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(event) =>
                    update('password', event.target.value)
                  }
                  placeholder="••••••••"
                />
              </Field>

              <Field
                label="University"
                htmlFor="university"
                required
                className="signup-col-span-2-1"
              >
                {universities.isLoading ? (
                  <div className="signup-flex-1">
                    <Spinner className="signup-h-4-1" />
                    Loading universities…
                  </div>
                ) : (
                  <Select
                    id="university"
                    required
                    value={form.universityId}
                    onChange={(event) =>
                      update('universityId', event.target.value)
                    }
                  >
                    <option value="">Select your university</option>

                    {(universities.data ?? []).map((university) => (
                      <option
                        key={university.id}
                        value={university.id}
                      >
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
                  onChange={(event) =>
                    update('studentId', event.target.value)
                  }
                  placeholder="BSU-2024-001"
                />
              </Field>

              <Field label="Program" htmlFor="program">
                <Input
                  id="program"
                  value={form.program}
                  onChange={(event) =>
                    update('program', event.target.value)
                  }
                  placeholder="Computer Science"
                />
              </Field>

              <Field
                label="Year of study"
                htmlFor="year"
                className="signup-col-span-2-1"
              >
                <Select
                  id="year"
                  value={form.year}
                  onChange={(event) =>
                    update('year', event.target.value)
                  }
                >
                  {[1, 2, 3, 4, 5, 6].map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="signup-approval">
              <Info className="signup-approval__icon" />
              <p className="signup-approval__text">
                New accounts need approval. After you sign up, a general
                administrator reviews and approves your account before you
                can sign in and use SIMS.
              </p>
            </div>

            <p className="signup-text-xs-1">
              Staff and company accounts are created by invitation from your
              university coordinator, company admin, or the platform team.
            </p>

            <Button
              type="submit"
              className="signup-w-full-1"
              loading={submitting}
            >
              Create account
            </Button>
          </>
        )}

        <p className="signup-text-center-1">
          Already have an account?{' '}
          <Link to="/login" className="signup-font-medium-1">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
