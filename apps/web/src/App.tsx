import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from '@/components/guards';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { ResetPassword } from '@/pages/ResetPassword';
import { Dashboard } from '@/pages/Dashboard';
import { WorkspaceAnalytics } from '@/pages/WorkspaceAnalytics';
import { Postings } from '@/pages/Postings';
import { PostingDetail } from '@/pages/PostingDetail';
import { Applications } from '@/pages/Applications';
import { Placements } from '@/pages/Placements';
import { PlacementDetail } from '@/pages/PlacementDetail';
import { ManagePostings } from '@/pages/ManagePostings';
import { PostingEditor } from '@/pages/PostingEditor';
import { People } from '@/pages/People';
import { Tenants } from '@/pages/Tenants';
import { Users } from '@/pages/Users';
import { RecycleBin } from '@/pages/RecycleBin';
import { ProfilePage } from '@/pages/Profile';
import { Notifications } from '@/pages/Notifications';
import { NotFound } from '@/pages/NotFound';
import { ActivityLogs, AdminManagement, Analytics, Broadcasts, SystemAlerts } from '@/pages/AdminConsole';
import { IntegrationCentre } from '@/pages/IntegrationCentre';

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
              <Route path="/admin/analytics" element={<Analytics />} />
              <Route path="/admin/integrations" element={<IntegrationCentre />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
