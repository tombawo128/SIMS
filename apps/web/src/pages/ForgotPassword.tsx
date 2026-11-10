import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, Field, Input } from '@/components/ui';
import { errorMessage } from '@/lib/utils';

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We will email you a secure link to choose a new password.">
      {sent ? (
        <div className='forgot-password-space-y-4-1'>
          <Alert tone="success" title="Check your email">
            If an account exists for <strong>{email}</strong>, a reset link is on its way.
          </Alert>
          <Link to="/login" className='forgot-password-block-1'>
            <Button className='forgot-password-w-full-1'>Back to sign in</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className='forgot-password-space-y-4-1'>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@university.edu"
            />
          </Field>
          <Button type="submit" className='forgot-password-w-full-1' loading={submitting}>
            Send reset link
          </Button>
          <p className='forgot-password-text-center-1'>
            <Link to="/login" className='forgot-password-font-medium-1'>
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
