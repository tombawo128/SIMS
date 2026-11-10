import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { Button, FullPageSpinner } from '@/components/ui';

export function ProtectedRoute() {
  const { session, profile, loading, profileError, signOut } = useAuth();

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
            {profileError ?? 'Your account is signed in, but no profile is attached yet.'}
          </p>
          <Button
            className='route-error-action'
            variant="secondary"
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
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
