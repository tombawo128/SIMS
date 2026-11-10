import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDateTime } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  Tabs,
} from '@/components/ui';
import { cn } from '@/lib/utils';

export function Notifications() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const notifications = useNotifications(profile?.id);
  const markRead = useMarkNotificationRead(profile?.id);
  const markAll = useMarkAllNotificationsRead(profile?.id);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const items = notifications.data ?? [];
  const unread = items.filter((item) => !item.read_at);
  const visible = tab === 'unread' ? unread : items;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Application updates, log reviews, evaluations, and placement changes."
        actions={
          unread.length ? (
            <Button variant="secondary" onClick={() => markAll.mutate()} loading={markAll.isPending}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <Tabs
        className="mb-4"
        options={[
          { key: 'all', label: 'All', count: items.length },
          { key: 'unread', label: 'Unread', count: unread.length },
        ]}
        value={tab}
        onChange={(key) => setTab(key as 'all' | 'unread')}
      />

      {notifications.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title={tab === 'unread' ? 'No unread notifications' : "You're all caught up"}
          description="Updates about your applications, placements, and logs will appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-100">
            {visible.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (!notification.read_at) markRead.mutate(notification.id);
                  navigate(notification.link ?? '/dashboard');
                }}
                className={cn(
                  'flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50',
                  !notification.read_at && 'bg-indigo-50/40',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    notification.read_at ? 'bg-slate-200' : 'bg-indigo-500',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                    <span className="text-xs text-slate-400">{formatDateTime(notification.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
