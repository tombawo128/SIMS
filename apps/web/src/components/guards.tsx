import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { Button, FullPageSpinner } from '@/components/ui';

export function ProtectedRoute() {
  const { session, profile, loading, profileError, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <FullPageSpinner label="Signing you in" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">
            {profileError ?? 'Your account is signed in, but no profile is attached yet.'}
          </p>
          <Button
            className="mt-5"
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
      <div className="flex min-h-screen items-center justify-center">
        <FullPageSpinner />
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
