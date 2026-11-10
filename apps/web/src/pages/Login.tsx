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
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            Forgot password?
          </Link>
          <Link to="/signup" className="text-xs font-medium text-slate-500 hover:text-slate-800">
            Student sign up
          </Link>
        </div>

        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>

      <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <KeyRound className="h-4 w-4 text-slate-400" />
          Demo accounts
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          Password for every demo account: <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">{DEMO_PASSWORD}</code>
        </p>
        <div className="mt-3 grid gap-1">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
              }}
              className="flex flex-col rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-xs font-medium text-slate-700">{account.label}</span>
              <span className="text-[11px] text-slate-400">{account.email}</span>
            </button>
          ))}
        </div>
      </details>
    </AuthShell>
  );
}
