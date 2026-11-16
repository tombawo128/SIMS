import type {
  AccountStatus,
  ApplicationStatus,
  CheckInType,
  EvaluationType,
  PlacementStatus,
  PostingStatus,
  PostingType,
  UserRole,
  WeeklyLogStatus,
} from './types';

export const DEMO_PASSWORD = 'Password123!';

// Hard cap on general (platform) administrator accounts. The manage-admins Edge
// Function enforces the same limit server-side; the UI hides the create option
// once the cap is reached and restores it when an administrator is deleted.
export const MAX_PLATFORM_ADMINS = 2;

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  faculty_supervisor: 'Faculty Supervisor',
  coordinator: 'Internship Coordinator',
  site_supervisor: 'Site Supervisor',
  company_admin: 'Company Admin',
  platform_admin: 'Platform Admin',
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  pending: 'Pending approval',
  active: 'Active',
  suspended: 'Suspended',
  blocked: 'Blocked',
};

export const POSTING_TYPE_LABELS: Record<PostingType, string> = {
  internship: 'Internship',
  graduate_job: 'Graduate Job',
  part_time: 'Part-time',
};

export const POSTING_STATUS_LABELS: Record<PostingStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const PLACEMENT_STATUS_LABELS: Record<PlacementStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const LOG_STATUS_LABELS: Record<WeeklyLogStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  needs_revision: 'Needs Revision',
};

export const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  midterm: 'Midterm',
  final: 'Final',
};

export const CHECK_IN_TYPE_LABELS: Record<CheckInType, string> = {
  visit: 'Site visit',
  call: 'Phone call',
  email: 'Email',
};

export type BadgeTone = 'slate' | 'blue' | 'amber' | 'violet' | 'emerald' | 'rose';

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'accepted':
    case 'approved':
    case 'published':
    case 'active':
    case 'completed':
      return 'emerald';
    case 'submitted':
    case 'under_review':
    case 'needs_revision':
      return 'amber';
    case 'shortlisted':
      return 'violet';
    case 'rejected':
    case 'withdrawn':
    case 'closed':
    case 'cancelled':
      return 'rose';
    case 'draft':
    case 'suspended':
    default:
      return 'slate';
  }
}

export function accountStatusTone(status: AccountStatus): BadgeTone {
  switch (status) {
    case 'active':
      return 'emerald';
    case 'pending':
      return 'amber';
    case 'blocked':
      return 'rose';
    case 'suspended':
    default:
      return 'slate';
  }
}

export function isUniversityRole(role: UserRole): boolean {
  return role === 'student' || role === 'faculty_supervisor' || role === 'coordinator';
}

export function isCompanyRole(role: UserRole): boolean {
  return role === 'site_supervisor' || role === 'company_admin';
}

export function isStaffRole(role: UserRole): boolean {
  return role !== 'student';
}

export type NavIcon =
  | 'dashboard'
  | 'briefcase'
  | 'file-text'
  | 'placements'
  | 'users'
  | 'team'
  | 'building'
  | 'user'
  | 'school'
  | 'settings';

export interface NavItem {
  label: string;
  to: string;
  icon: NavIcon;
}

const DASHBOARD: NavItem = { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' };
const OPPORTUNITIES: NavItem = { label: 'Opportunities', to: '/postings', icon: 'briefcase' };
const APPLICATIONS: NavItem = { label: 'Applications', to: '/applications', icon: 'file-text' };
const PLACEMENTS: NavItem = { label: 'Placements', to: '/placements', icon: 'placements' };
const PROFILE: NavItem = { label: 'Profile', to: '/profile', icon: 'user' };
const SETTINGS: NavItem = { label: 'Settings', to: '/settings', icon: 'settings' };
const SETTINGS: NavItem = { label: 'Settings', to: '/settings', icon: 'settings' };

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  student: [DASHBOARD, OPPORTUNITIES, { ...APPLICATIONS, label: 'My Applications' }, { ...PLACEMENTS, label: 'My Placement' }, PROFILE, SETTINGS],
  faculty_supervisor: [
    DASHBOARD,
    OPPORTUNITIES,
    { label: 'Students', to: '/people', icon: 'users' },
    APPLICATIONS,
    PLACEMENTS,
    PROFILE,
    SETTINGS,
  ],
  coordinator: [
    DASHBOARD,
    OPPORTUNITIES,
    { label: 'Students & Faculty', to: '/people', icon: 'users' },
    APPLICATIONS,
    PLACEMENTS,
    { label: 'Analytics', to: '/analytics', icon: 'dashboard' },
    PROFILE,
    SETTINGS,
  ],
  site_supervisor: [
    DASHBOARD,
    { label: 'Our Postings', to: '/manage/postings', icon: 'briefcase' },
    APPLICATIONS,
    PLACEMENTS,
    PROFILE,
    SETTINGS,
  ],
  company_admin: [
    DASHBOARD,
    { label: 'Our Postings', to: '/manage/postings', icon: 'briefcase' },
    APPLICATIONS,
    PLACEMENTS,
    { label: 'Team', to: '/people', icon: 'team' },
    { label: 'Analytics', to: '/analytics', icon: 'dashboard' },
    PROFILE,
    SETTINGS,
  ],
  platform_admin: [
    DASHBOARD,
    { label: 'Users', to: '/users', icon: 'users' },
    { label: 'Universities & Companies', to: '/tenants', icon: 'school' },
    { label: 'System-wide Announcements', to: '/admin/broadcasts', icon: 'file-text' },
    { label: 'Activity Logs', to: '/admin/activity-logs', icon: 'placements' },
    { label: 'Internal System Alerts', to: '/admin/system-alerts', icon: 'briefcase' },
    { label: 'Admin Management', to: '/admin/management', icon: 'team' },
    { label: 'Analytics', to: '/admin/analytics', icon: 'dashboard' },
    PROFILE,
    SETTINGS,
  ],
};

export const DEMO_ACCOUNTS: { email: string; label: string }[] = [
  { email: 'admin@sims.dev', label: 'Platform Admin' },
  { email: 'coordinator@baystate.edu', label: 'Coordinator - Bay State University' },
  { email: 'coordinator@northbridge.edu', label: 'Coordinator - Northbridge Tech' },
  { email: 'faculty1@baystate.edu', label: 'Faculty Supervisor - Bay State' },
  { email: 'faculty3@northbridge.edu', label: 'Faculty Supervisor - Northbridge' },
  { email: 'student1@baystate.edu', label: 'Student - Bay State' },
  { email: 'student3@northbridge.edu', label: 'Student - Northbridge' },
  { email: 'supervisor1@acme.com', label: 'Site Supervisor - Acme Software' },
  { email: 'admin@acme.com', label: 'Company Admin - Acme Software' },
];

export const RUBRIC_CRITERIA = [
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'technical_skill', label: 'Technical skill' },
  { key: 'communication', label: 'Communication' },
  { key: 'initiative', label: 'Initiative' },
] as const;

export const APP_NAME = 'SIMS';
export const APP_TAGLINE = 'Internships & early-career opportunities, one platform.';
