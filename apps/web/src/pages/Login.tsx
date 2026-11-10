import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdminSignupAvailable } from '@/hooks/useAdminConsole';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, Field, Input } from '@/components/ui';
import { errorMessage } from '@/lib/utils';

/** Turns raw auth errors into messages people can act on. */
function friendlyError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (text.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox for the confirmation link.';
  }
  return message;
}

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const availability = useAdminSignupAvailable();
  const adminAvailable = availability.data === true;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (caught) {
      setError(friendlyError(errorMessage(caught)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your university, company, student, or administrator workspace.">
      <form onSubmit={handleSubmit} className='login-space-y-4-1'>
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@university.edu"
          />
        </Field>

        <Field label="Password" htmlFor="password" required>
          <div className='login-password'>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className='login-password__input'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              className='login-password__toggle'
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className='login-h-4-1' /> : <Eye className='login-h-4-1' />}
            </button>
          </div>
        </Field>

        <div className='login-flex-1'>
          <Link to="/forgot-password" className='login-text-xs-1'>
            Forgot password?
          </Link>
          <Link to="/signup" className='login-text-xs-2'>
            Student sign up
          </Link>
        </div>

        <Button type="submit" className='login-w-full-1' loading={submitting}>
          Sign in
        </Button>

        {adminAvailable ? (
          <div className='login-admin-note'>
            <span className='login-admin-note__icon'>
              <ShieldCheck className='login-h-4-1' />
            </span>
            <p className='login-admin-note__text'>
              Setting up the platform?{' '}
              <Link to="/signup?mode=admin" className='login-admin-note__link'>
                Create an administrator account
              </Link>
            </p>
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}