import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, Field, FullPageSpinner, Input } from '@/components/ui';
import { errorMessage } from '@/lib/utils';

export function ResetPassword() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) return <FullPageSpinner label="Checking your reset link" />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <AuthShell title="Reset link needed" subtitle="Open the reset link from your email to continue.">
        <Alert tone="warning" title="This link is not valid or has expired">
          Request a new password reset email and open the link on this device.
        </Alert>
        <Link to="/forgot-password" className="mt-5 block">
          <Button className="w-full">Request a new link</Button>
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Your new password is ready to use.">
        <Alert tone="success" title="All set">
          You are still signed in. Continue to your dashboard.
        </Alert>
        <Button className="mt-5 w-full" onClick={() => navigate('/dashboard', { replace: true })}>
          Go to dashboard
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label="New password" htmlFor="password" required>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" required>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" loading={submitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
