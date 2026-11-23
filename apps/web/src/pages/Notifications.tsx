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
  Alert,
  Button,
  Card,
  EmptyState,
  Spinner,
  Tabs,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/utils';

export function Notifications() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const notifications = useNotifications(profile?.id);
  const markRead = useMarkNotificationRead(profile?.id);
  const markAll = useMarkAllNotificationsRead(profile?.id);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const { toast } = useToast();

  const items = notifications.data ?? [];
  const unread = items.filter((item) => !item.read_at);
  const visible = tab === 'unread' ? unread : items;

  return (
    <section className="notifications-page">
      <section className="page-hero notifications-hero">
        <div><span className="page-hero__eyebrow">YOUR ACTIVITY</span><h1>Notifications</h1><p>Important updates from applications, placements, weekly reports and evaluations.</p></div>
        <div className="page-hero__aside"><strong>{unread.length}</strong><span>unread updates</span><small>{items.length} total notifications</small>{unread.length ? <Button size="sm" variant="secondary" onClick={() => markAll.mutate(undefined, { onError: (error) => toast({ title: 'Could not mark notifications as read', description: error.message, tone: 'error' }) })} loading={markAll.isPending} disabled={markAll.isPending}><CheckCheck size={15}/> Mark all read</Button> : null}</div>
      </section>

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
      ) : notifications.isError ? (
        <Alert tone="danger" title="Could not load notifications">
          Your notifications could not be retrieved. <Button size="sm" variant="secondary" onClick={() => void notifications.refetch()} loading={notifications.isFetching}>Retry</Button>
        </Alert>
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
                  if (!notification.read_at) {
                    markRead.mutate(notification.id, {
                      onError: (error) => toast({ title: 'Could not mark notification as read', description: error.message, tone: 'error' }),
                    });
                  }
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
    </section>
  );
}
