import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  FileText,
  GraduationCap,
  Settings,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  Users,
  Archive,
  UsersRound,
  X,
  ChevronRight,
  Database,
  LifeBuoy,
  LockKeyhole,
  Webhook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { APP_NAME, NAV_BY_ROLE, ROLE_LABELS, type NavIcon } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { Avatar, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';


// Simple icon map
const iconMap: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  briefcase: Briefcase,
  'file-text': FileText,
  placements: ClipboardList,
  users: Users,
  team: UsersRound,
  building: Building2,
  user: UserRound,
  school: GraduationCap,
  settings: Settings,
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signout } = useAuth();
  if (!profile) return null;
  const tenant = profile.university?.name ?? profile.company?.name ?? 'Platform administration';
  return (
    <div className="sidebar">
      <div className="sidebar__tenant">
        <p className="sidebar__tenant-name">{tenant}</p>
        <p className="sidebar__tenant-role">{ROLE_LABELS[profile.role]}</p>
      </div>
      <nav className="sidebar__nav">
        {NAV_BY_ROLE[profile.role].map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => cn('nav-link', isActive ? 'nav-link--active' : 'nav-link--inactive')}
            >
              <Icon className="nav-link__icon" />
              {item.label}
            </NavLink>
          );
        })}
        {profile.role === 'platform_admin' && (
          <>
            <NavLink to="/admin/compliance" onClick={onNavigate} className={({ isActive }) => cn('nav-link', isActive ? 'nav-link--active' : 'nav-link--inactive')}>
              <Database className="nav-link__icon" /> Compliance &amp; data
            </NavLink>
            <NavLink to="/admin/support" onClick={onNavigate} className={({ isActive }) => cn('nav-link', isActive ? 'nav-link--active' : 'nav-link--inactive')}>
              <LifeBuoy className="nav-link__icon" /> Support &amp; moderation
            </NavLink>
            <NavLink to="/admin/security" onClick={onNavigate} className={({ isActive }) => cn('nav-link', isActive ? 'nav-link--active' : 'nav-link--inactive')}>
              <LockKeyhole className="nav-link__icon" /> Security &amp; authentication
            </NavLink>
            <NavLink to="/admin/integrations" onClick={onNavigate} className={({ isActive }) => cn('nav-link', isActive ? 'nav-link--active' : 'nav-link--inactive')}>
              <Webhook className="nav-link__icon" /> Integration Centre
            </NavLink>
            <NavLink to="/recycle-bin" onClick={onNavigate} className={({ isActive }) => cn('nav-link', isActive ? 'nav-link--active' : 'nav-link--inactive')}>
              <Archive className="nav-link__icon" /> Recycle Bin
            </NavLink>
          </>
        )}
      </nav>
      <div className="sidebar__footer">
        <div className="sidebar__user">
          <Avatar name={profile.full_name} className="avatar--sidebar" />
          <div className="layout-fill">
            <p className="sidebar__user-name">{profile.full_name}</p>
            <p className="sidebar__user-email">{profile.email}</p>
          </div>
          <button type="button" onClick={() => void signout()} className="sidebar__signout" aria-label="Sign out" title="Sign out">
            <LogOut className="icon" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Simplified notification bell component – placeholder implementation
function NotificationBell() {
  const { toast } = useToast();
  const unread = 0; // placeholder: real count logic omitted for brevity
  return (
    <div className="bell">
      <button
        type="button"
        className="bell__button"
        aria-label="Notifications"
        aria-expanded={false}
        aria-controls="notification-dropdown"
        onClick={() => toast({ title: 'Info', description: 'Notifications not implemented yet.' })}
      >
        <Bell className="icon" />
        {unread ? <span className="bell__badge">{unread}</span> : null}
      </button>
    </div>
  );
}

export function Layout() {
  const { profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!profile) return null;

  const routeLabels: Record<string, string> = {
    '/dashboard': 'Overview',
    '/postings': 'Opportunities',
    '/applications': 'Applications',
    '/placements': 'Placements',
    '/people': 'People',
    '/analytics': 'Workspace analytics',
    '/profile': 'My profile',
    '/settings': 'Settings',
    '/notifications': 'Notifications',
    '/users': 'Platform users',
    '/tenants': 'Organisations',
    '/recycle-bin': 'Recycle bin',
    '/admin/analytics': 'Platform analytics',
    '/admin/management': 'Administration',
    '/admin/broadcasts': 'Broadcasts',
    '/admin/activity-logs': 'Activity logs',
    '/admin/system-alerts': 'System alerts',
    '/admin/compliance': 'Compliance & data management',
    '/admin/support': 'Support & moderation',
    '/admin/security': 'Security & authentication',
    '/admin/integrations': 'Integration Centre',
    '/manage/postings': 'Manage opportunities',
  };
  const currentLabel =
    routeLabels[location.pathname] ??
    (location.pathname.startsWith('/postings/') ? 'Opportunity details' :
      location.pathname.startsWith('/placements/') ? 'Placement details' :
        location.pathname.includes('/edit') || location.pathname.endsWith('/new') ? 'Opportunity editor' :
          'Workspace');

  return (
    <div className="app-shell workspace-shell">
      <aside className="app-sidebar workspace-sidebar" aria-label="Primary navigation">
        <SidebarContent />
      </aside>
      {mobileOpen && (
        <div className="mobile-nav">
          <button type="button" className="mobile-nav__backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
          <aside className="mobile-nav__panel" aria-label="Mobile navigation">
            <button type="button" onClick={() => setMobileOpen(false)} className="mobile-nav__close" aria-label="Close navigation">
              <X className="icon-lg" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <div className="app-content workspace-content">
        <header className="app-header workspace-topbar">
          <div className="workspace-topbar__left">
            <button type="button" onClick={() => setMobileOpen(true)} className="app-header__menu" aria-label="Open navigation">
              <Menu className="icon" />
            </button>
            <div className="layout-fill">
              <p className="app-header__tenant">{profile.university?.name ?? profile.company?.name ?? 'Platform'}</p>
            </div>
            <div className="workspace-breadcrumb">
              <span className="workspace-breadcrumb__role">{ROLE_LABELS[profile.role]}</span>
              <span className="workspace-breadcrumb__divider">/</span>
              <strong>{currentLabel}</strong>
            </div>
          </div>
          <div className="workspace-topbar__right">
            <Link to="/profile" className="workspace-account">
              <Avatar name={profile.full_name} className="avatar--sm" />
              <span><strong>{profile.full_name}</strong><small>Account</small></span>
              <ChevronRight size={15} />
            </Link>
            <NotificationBell />
          </div>
        </header>
        <main className="app-main workspace-main">
          <div className="workspace-main__inner">
            <Outlet />
          </div>
        </main>
        <footer className="workspace-footer">
          <span>{APP_NAME}</span>
          <span>Internship management workspace</span>
        </footer>
      </div>
    </div>
  );
}
