import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { AccountGate } from '@/components/AccountGate';
import { Button, FullPageSpinner } from '@/components/ui';

export function ProtectedRoute() {
  const { session, profile, loading, profileError, signout, refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');

  if (loading) {
    return (
      <div className='route-loading'>
        <FullPageSpinner label="Signing you in" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!profile) {
    return (
      <div className='route-error-wrap'>
        <div className='route-error-card'>
          <h1 className='route-error-title'>Profile unavailable</h1>
          <p className='route-error-text'>
            {retryError || profileError || 'Your account is signed in, but no profile is attached yet.'}
          </p>
          <Button
            className='route-error-action'
            onClick={async () => {
              setRetryError('');
              setRetrying(true);
              try {
                await refreshProfile();
              } catch (error) {
                setRetryError(error instanceof Error ? error.message : 'Could not reload your profile. Try again.');
              } finally {
                setRetrying(false);
              }
            }}
            loading={retrying}
          >
            Retry profile
          </Button>
          <Button
            className='route-error-action'
            variant="secondary"
            onClick={() => {
              void signout();
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const status = profile.account_status ?? "active"

  if (status !== 'active') {
    return <AccountGate status={status} />;
  }

  return <Outlet />;
}

export function RoleRoute({ allow }: { allow: UserRole[] }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!allow.includes(profile.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className='route-loading'>
        <FullPageSpinner />
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
