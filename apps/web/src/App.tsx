import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from '@/components/Layout';
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from '@/components/guards';

const Landing = lazy(() => import('@/pages/Landing').then((m) => ({ default: m.Landing })));
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('@/pages/Signup').then((m) => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const WorkspaceAnalytics = lazy(() => import('@/pages/WorkspaceAnalytics').then((m) => ({ default: m.WorkspaceAnalytics })));
const Postings = lazy(() => import('@/pages/Postings').then((m) => ({ default: m.Postings })));
const PostingDetail = lazy(() => import('@/pages/PostingDetail').then((m) => ({ default: m.PostingDetail })));
const Applications = lazy(() => import('@/pages/Applications').then((m) => ({ default: m.Applications })));
const Placements = lazy(() => import('@/pages/Placements').then((m) => ({ default: m.Placements })));
const PlacementDetail = lazy(() => import('@/pages/PlacementDetail').then((m) => ({ default: m.PlacementDetail })));
const ManagePostings = lazy(() => import('@/pages/ManagePostings').then((m) => ({ default: m.ManagePostings })));
const PostingEditor = lazy(() => import('@/pages/PostingEditor').then((m) => ({ default: m.PostingEditor })));
const People = lazy(() => import('@/pages/People').then((m) => ({ default: m.People })));
const Tenants = lazy(() => import('@/pages/Tenants').then((m) => ({ default: m.Tenants })));
const Users = lazy(() => import('@/pages/Users').then((m) => ({ default: m.Users })));
const RecycleBin = lazy(() => import('@/pages/RecycleBin').then((m) => ({ default: m.RecycleBin })));
const ProfilePage = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })));
const Notifications = lazy(() => import('@/pages/Notifications').then((m) => ({ default: m.Notifications })));
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })));
const ActivityLogs = lazy(() => import('@/pages/AdminConsole').then((m) => ({ default: m.ActivityLogs })));
const AdminManagement = lazy(() => import('@/pages/AdminConsole').then((m) => ({ default: m.AdminManagement })));
const AdminAnalytics = lazy(() => import('@/pages/AdminConsole').then((m) => ({ default: m.Analytics })));
const Broadcasts = lazy(() => import('@/pages/AdminConsole').then((m) => ({ default: m.Broadcasts })));
const SystemAlerts = lazy(() => import('@/pages/AdminConsole').then((m) => ({ default: m.SystemAlerts })));
const ComplianceDataManagement = lazy(() => import('@/pages/AdminGovernance').then((m) => ({ default: m.ComplianceDataManagement })));
const SupportModeration = lazy(() => import('@/pages/AdminGovernance').then((m) => ({ default: m.SupportModeration })));
const SecurityAuthentication = lazy(() => import('@/pages/AdminGovernance').then((m) => ({ default: m.SecurityAuthentication })));

const WORKFLOW_ROLES = [
  'student',
  'faculty_supervisor',
  'coordinator',
  'site_supervisor',
  'company_admin',
] as const;

export function App() {
  return (
    <>
      <Analytics />
      <Suspense fallback={<div className="app-route-loading" role="status" aria-live="polite">Loading page…</div>}>
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
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/notifications" element={<Notifications />} />

              <Route element={<RoleRoute allow={['coordinator', 'company_admin']} />}>
                <Route path="/analytics" element={<WorkspaceAnalytics />} />
              </Route>

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
                <Route path="/users" element={<Users />} />
                <Route path="/recycle-bin" element={<RecycleBin />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/admin/broadcasts" element={<Broadcasts />} />
                <Route path="/admin/activity-logs" element={<ActivityLogs />} />
                <Route path="/admin/system-alerts" element={<SystemAlerts />} />
                <Route path="/admin/management" element={<AdminManagement />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/compliance" element={<ComplianceDataManagement />} />
                <Route path="/admin/support" element={<SupportModeration />} />
                <Route path="/admin/security" element={<SecurityAuthentication />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
