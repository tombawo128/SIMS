import { Route, Routes } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from '@/components/guards';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { ResetPassword } from '@/pages/ResetPassword';
import { Dashboard } from '@/pages/Dashboard';
import { Postings } from '@/pages/Postings';
import { PostingDetail } from '@/pages/PostingDetail';
import { Applications } from '@/pages/Applications';
import { Placements } from '@/pages/Placements';
import { PlacementDetail } from '@/pages/PlacementDetail';
import { ManagePostings } from '@/pages/ManagePostings';
import { PostingEditor } from '@/pages/PostingEditor';
import { People } from '@/pages/People';
import { Tenants } from '@/pages/Tenants';
import { ProfilePage } from '@/pages/Profile';
import { Notifications } from '@/pages/Notifications';
import { NotFound } from '@/pages/NotFound';

const WORKFLOW_ROLES = [
  'student',
  'faculty_supervisor',
  'coordinator',
  'site_supervisor',
  'company_admin',
] as const;

function ConfigNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="config-notice" role="alert">
      <AlertTriangle className="icon" aria-hidden />
      <p>
        Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env</code>, set{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
      </p>
    </div>
  );
}

export function App() {
  return (
    <>
      <ConfigNotice />
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/postings" element={<Postings />} />
            <Route path="/postings/:id" element={<PostingDetail />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<Notifications />} />

            <Route element={<RoleRoute allow={[...WORKFLOW_ROLES]} />}>
              <Route path="/applications" element={<Applications />} />
              <Route path="/placements" element={<Placements />} />
              <Route path="/placements/:id" element={<PlacementDetail />} />
            </Route>

            <Route element={<RoleRoute allow={['company_admin', 'site_supervisor']} />}>
              <Route path="/manage/postings" element={<ManagePostings />} />
              <Route path="/manage/postings/new" element={<PostingEditor />} />
              <Route path="/manage/postings/:id/edit" element={<PostingEditor />} />
            </Route>

            <Route element={<RoleRoute allow={['coordinator', 'faculty_supervisor', 'company_admin']} />}>
              <Route path="/people" element={<People />} />
            </Route>

            <Route element={<RoleRoute allow={['platform_admin']} />}>
              <Route path="/tenants" element={<Tenants />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
