import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, Field, Input } from '@/components/ui';
import { errorMessage } from '@/lib/utils';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your university, company, or student workspace.">
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
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
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
      </form>

      <details className='login-mt-6-1'>
        <summary className='login-flex-2'>
          <KeyRound className='login-h-4-1' />
          Demo accounts
        </summary>
        <p className='login-mt-2-1'>
          Password for every demo account: <code className='login-rounded-1'>{DEMO_PASSWORD}</code>
        </p>
        <div className='login-mt-3-1'>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
              }}
              className='login-flex-3'
            >
              <span className='login-text-xs-3'>{account.label}</span>
              <span className='login-text-11px-1'>{account.email}</span>
            </button>
          ))}
        </div>
      </details>
    </AuthShell>
  );
}
