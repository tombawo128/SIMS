import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Alert, Card } from '@/components/ui';
import { APP_NAME } from '@sims/shared';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // await signIn(email, password);
      navigate('/dashboard');
    } catch {
      setError('Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">Sign in to {APP_NAME}</h2>
        {error && <Alert tone="danger">{error}</Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="email" placeholder="Email" type="email" />
          <Input name="password" placeholder="Password" type="password" />
          <Button type="submit" variant="primary" className="w-full">
            Sign In
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          Don’t have an account?{' '}
          <Link to="/signup" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
