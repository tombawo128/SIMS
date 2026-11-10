import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { APP_NAME, NAV_BY_ROLE, ROLE_LABELS, formatDateTime, type NavIcon } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { Avatar, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

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
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

  const tenant = profile.university?.name ?? profile.company?.name ?? 'Platform administration';

  return (
    <div className='sidebar'>
      <div className='sidebar__brand'>
        <div className='sidebar__logo'>
          <GraduationCap className='icon-lg' />
        </div>
        <div>
          <p className='sidebar__app-name'>{APP_NAME}</p>
          <p className='sidebar__app-tagline'>Internships & opportunities</p>
        </div>
      </div>

      <div className='sidebar__tenant'>
        <p className='sidebar__tenant-name'>{tenant}</p>
        <p className='sidebar__tenant-role'>{ROLE_LABELS[profile.role]}</p>
      </div>

      <nav className='sidebar__nav'>
        {NAV_BY_ROLE[profile.role].map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'nav-link',
                  isActive
                    ? 'nav-link--active'
                    : 'nav-link--inactive',
                )
              }
            >
              <Icon className='nav-link__icon' />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className='sidebar__footer'>
        <div className='sidebar__user'>
          <Avatar name={profile.full_name} className='avatar--sidebar' />
          <div className='layout-fill'>
            <p className='sidebar__user-name'>{profile.full_name}</p>
            <p className='sidebar__user-email'>{profile.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className='sidebar__signout'
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className='icon' />
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications(profile?.id);
  const markRead = useMarkNotificationRead(profile?.id);
  const markAll = useMarkAllNotificationsRead(profile?.id);

  const items = notifications.data ?? [];
  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className='bell'>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className='bell__button'
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className='icon' />
        {unread ? (
          <span className='bell__badge'>
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className='bell__overlay' onClick={() => setOpen(false)} aria-hidden />
          <div className='bell__dropdown'>
            <div className='bell__dropdown-header'>
              <p className='heading-sm'>Notifications</p>
              {unread ? (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  className='link-action'
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className='bell__list'>
              {items.length === 0 ? (
                <EmptyState title="You're all caught up" description="New activity will appear here." />
              ) : (
                items.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!item.read_at) markRead.mutate(item.id);
                      setOpen(false);
                      navigate(item.link ?? '/notifications');
                    }}
                    className={cn(
                      'bell__item',
                      !item.read_at && 'bell__item--unread',
                    )}
                  >
                    <div className='bell__item-row'>
                      {!item.read_at ? (
                        <span className='bell__dot' />
                      ) : (
                        <span className='bell__dot--read' />
                      )}
                      <div className='bell__item-content'>
                        <p className='bell__item-title'>{item.title}</p>
                        <p className='bell__item-body'>{item.body}</p>
                        <p className='bell__item-time'>{formatDateTime(item.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className='bell__footer'>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications');
                }}
                className='link-action'
              >
                View all notifications
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function Layout() {
  const { profile } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!profile) return null;

  const navItem = NAV_BY_ROLE[profile.role].find(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );
  const title = navItem?.label ?? (location.pathname.startsWith('/notifications') ? 'Notifications' : 'Workspace');

  return (
    <div className='app-shell'>
      <aside className='app-sidebar'>
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className='mobile-nav'>
          <div
            className='mobile-nav__backdrop'
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className='mobile-nav__panel'>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className='mobile-nav__close'
              aria-label="Close navigation"
            >
              <X className='icon-lg' />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className='app-content'>
        <header className='app-header'>
          <div className='app-header__inner'>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className='app-header__menu'
              aria-label="Open navigation"
            >
              <Menu className='icon' />
            </button>

            <div className='layout-fill'>
              <p className='app-header__tenant'>
                {profile.university?.name ?? profile.company?.name ?? 'Platform'}
              </p>
              <h1 className='app-header__title'>{title}</h1>
            </div>

            <NotificationBell />

            <Link
              to="/profile"
              className='app-header__profile'
            >
              <Avatar name={profile.full_name} className='avatar--sm' />
              <span className='app-header__profile-name'>
                {profile.full_name}
              </span>
            </Link>
          </div>
        </header>

        <main className='app-main'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
