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
              <CheckCheck className='notifications-h-4-1' /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <Tabs
        className='notifications-mb-4-1'
        options={[
          { key: 'all', label: 'All', count: items.length },
          { key: 'unread', label: 'Unread', count: unread.length },
        ]}
        value={tab}
        onChange={(key) => setTab(key as 'all' | 'unread')}
      />

      {notifications.isLoading ? (
        <div className='notifications-flex-1'>
          <Spinner className='notifications-h-6-1' />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Bell className='notifications-h-5-1' />}
          title={tab === 'unread' ? 'No unread notifications' : "You're all caught up"}
          description="Updates about your applications, placements, and logs will appear here."
        />
      ) : (
        <Card className='notifications-overflow-hidden-1'>
          <div className='notifications-divide-y-1'>
            {visible.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (!notification.read_at) markRead.mutate(notification.id);
                  navigate(notification.link ?? '/dashboard');
                }}
                className={cn(
                  'notifications-flex-2',
                  !notification.read_at && 'notifications-bg-indigo-5040-1',
                )}
              >
                <span
                  className={cn(
                    'notifications-mt-15-1',
                    notification.read_at ? 'notifications-bg-slate-200-1' : 'notifications-bg-indigo-500-1',
                  )}
                />
                <div className='notifications-min-w-0-1'>
                  <div className='notifications-flex-3'>
                    <p className='notifications-text-sm-1'>{notification.title}</p>
                    <span className='notifications-text-xs-1'>{formatDateTime(notification.created_at)}</span>
                  </div>
                  <p className='notifications-mt-1-1'>{notification.body}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
