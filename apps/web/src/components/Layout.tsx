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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">{APP_NAME}</p>
          <p className="text-[11px] text-slate-400">Internships & opportunities</p>
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
        <p className="truncate text-xs font-medium text-white">{tenant}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">{ROLE_LABELS[profile.role]}</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_BY_ROLE[profile.role].map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-400/20'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} className="bg-indigo-500/20 text-indigo-100" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{profile.full_name}</p>
            <p className="truncate text-[11px] text-slate-400">{profile.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:text-slate-800"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unread ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unread ? (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="max-h-96 overflow-y-auto">
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
                      'block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50',
                      !item.read_at && 'bg-indigo-50/40',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!item.read_at ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-transparent" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.body}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications');
                }}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
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
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-slate-950 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative h-full w-72 max-w-[82%] bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {profile.university?.name ?? profile.company?.name ?? 'Platform'}
              </p>
              <h1 className="truncate text-sm font-semibold text-slate-900">{title}</h1>
            </div>

            <NotificationBell />

            <Link
              to="/profile"
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm transition hover:border-slate-300 sm:flex"
            >
              <Avatar name={profile.full_name} className="h-7 w-7 text-[10px]" />
              <span className="max-w-[10rem] truncate text-xs font-medium text-slate-700">
                {profile.full_name}
              </span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
