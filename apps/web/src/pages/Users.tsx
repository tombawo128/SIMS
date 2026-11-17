import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldAlert,
  Trash2,
  Undo2,
  UserCheck,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import {
  ACCOUNT_STATUS_LABELS,
  ROLE_LABELS,
  accountStatusTone,
  formatDate,
  formatDateTime,
  toCsv,
  type AccountStatus,
  type AdminUser,
  type UserRole,
} from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import {
  useAdminUsers,
  useDeleteUser,
  useSetUserStatus,
} from '@/hooks/useAdminConsole';
import { cn, downloadCsv, errorMessage } from '@/lib/utils';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  StatCard,
  Table,
  Tabs,
  Td,
  Th,
  useToast,
} from '@/components/ui';

type StatusTab = 'all' | AccountStatus;
type SortKey = 'newest' | 'name' | 'status';

const STATUS_ORDER: Record<AccountStatus, number> = {
  pending: 0,
  active: 1,
  suspended: 2,
  blocked: 3,
};

const STATUS_VERB: Record<AccountStatus, string> = {
  active: 'approved',
  pending: 'marked pending',
  suspended: 'suspended',
  blocked: 'blocked',
};

const ROLE_TONE: Record<UserRole, 'blue' | 'violet' | 'emerald' | 'amber' | 'slate' | 'rose'> = {
  student: 'blue',
  faculty_supervisor: 'violet',
  coordinator: 'violet',
  site_supervisor: 'emerald',
  company_admin: 'emerald',
  platform_admin: 'rose',
};

interface UndoState {
  user: AdminUser;
  previous: AccountStatus;
  label: string;
}

function localDateStamp() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function Users() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const usersQuery = useAdminUsers(profile?.role === 'platform_admin');
  const setStatus = useSetUserStatus();
  const deleteUser = useDeleteUser();

  const [tab, setTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const undoTimer = useRef<number | null>(null);

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const detailUser = users.find((user) => user.id === detailId) ?? null;

  const counts = useMemo(() => {
    const base = { all: users.length, pending: 0, active: 0, suspended: 0, blocked: 0 };
    for (const user of users) base[user.account_status] += 1;
    return base;
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = users;
    if (tab !== 'all') rows = rows.filter((user) => user.account_status === tab);
    if (roleFilter !== 'all') rows = rows.filter((user) => user.role === roleFilter);
    if (term) {
      rows = rows.filter(
        (user) =>
          user.full_name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          (user.university_name ?? '').toLowerCase().includes(term) ||
          (user.company_name ?? '').toLowerCase().includes(term),
      );
    }
    const sorted = [...rows];
    if (sort === 'name') {
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (sort === 'status') {
      sorted.sort(
        (a, b) =>
          STATUS_ORDER[a.account_status] - STATUS_ORDER[b.account_status] ||
          a.full_name.localeCompare(b.full_name),
      );
    } else {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return sorted;
  }, [users, tab, roleFilter, search, sort]);

  // Clear an undo banner after a short window so it never lingers over the table.
  useEffect(() => {
    if (!undo) return;
    undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    };
  }, [undo]);

  useEffect(() => {
    if (!detailId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detailId]);

  if (profile?.role !== 'platform_admin') {
    return (
      <EmptyState
        icon={<ShieldAlert className='users-icon-lg' />}
        title="Administrators only"
        description="The user directory is available to general administrators."
      />
    );
  }

  const isModeratable = (user: AdminUser) =>
    user.role !== 'platform_admin' && user.id !== profile.id;

  const changeStatus = async (user: AdminUser, status: AccountStatus, silent = false) => {
    const previous = user.account_status;
    if (previous === status) return;
    try {
      await setStatus.mutateAsync({ id: user.id, status });
      if (!silent) {
        const label =
          status === 'active' && previous !== 'pending'
            ? `${user.full_name} reactivated`
            : `${user.full_name} ${STATUS_VERB[status]}`;
        toast({ title: label, tone: 'success' });
        setUndo({ user, previous, label });
      }
    } catch (caught) {
      toast({ title: 'Could not update account', description: errorMessage(caught), tone: 'error' });
    }
  };

  const undoLast = async () => {
    if (!undo) return;
    const { user, previous } = undo;
    setUndo(null);
    try {
      await setStatus.mutateAsync({ id: user.id, status: previous });
      toast({ title: `Restored ${user.full_name}`, tone: 'info' });
    } catch (caught) {
      toast({ title: 'Could not undo', description: errorMessage(caught), tone: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await deleteUser.mutateAsync(target.id);
      toast({ title: `${target.full_name} archived`, description: 'The account was moved to the Recycle Bin and sign-in was blocked.', tone: 'success' });
      setDeleteTarget(null);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
      if (detailId === target.id) setDetailId(null);
    } catch (caught) {
      toast({ title: 'Could not archive account', description: errorMessage(caught), tone: 'error' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleModeratable = filtered.filter(isModeratable);
  const allVisibleSelected =
    visibleModeratable.length > 0 && visibleModeratable.every((user) => selected.has(user.id));

  const toggleSelectAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const user of visibleModeratable) next.delete(user.id);
      } else {
        for (const user of visibleModeratable) next.add(user.id);
      }
      return next;
    });
  };

  const selectedUsers = users.filter((user) => selected.has(user.id) && isModeratable(user));
  const selectedPending = selectedUsers.filter((user) => user.account_status === 'pending');

  const bulkApprove = async () => {
    const targets = selectedPending.length > 0 ? selectedPending : selectedUsers;
    if (targets.length === 0) return;
    try {
      await Promise.all(targets.map((user) => setStatus.mutateAsync({ id: user.id, status: 'active' })));
      toast({
        title: `${targets.length} ${targets.length === 1 ? 'account' : 'accounts'} approved`,
        tone: 'success',
      });
      setSelected(new Set());
    } catch (caught) {
      toast({ title: 'Could not approve accounts', description: errorMessage(caught), tone: 'error' });
    }
  };

  const exportCsv = () => {
    const csv = toCsv(
      ['Name', 'Email', 'Role', 'Status', 'Organization', 'Joined'],
      filtered.map((user) => [
        user.full_name,
        user.email,
        ROLE_LABELS[user.role],
        ACCOUNT_STATUS_LABELS[user.account_status],
        user.university_name ?? user.company_name ?? 'Platform',
        formatDate(user.created_at),
      ]),
    );
    downloadCsv(`sims-users-${localDateStamp()}.csv`, csv);
  };

  const primaryAction = (user: AdminUser) => {
    if (!isModeratable(user)) return null;
    switch (user.account_status) {
      case 'pending':
        return (
          <Button size="sm" onClick={() => changeStatus(user, 'active')} loading={setStatus.isPending}>
            <CheckCircle2 className='users-icon-sm' /> Approve
          </Button>
        );
      case 'active':
        return (
          <Button size="sm" variant="secondary" onClick={() => changeStatus(user, 'suspended')} loading={setStatus.isPending}>
            <PauseCircle className='users-icon-sm' /> Suspend
          </Button>
        );
      case 'suspended':
      case 'blocked':
        return (
          <Button size="sm" variant="secondary" onClick={() => changeStatus(user, 'active')} loading={setStatus.isPending}>
            <PlayCircle className='users-icon-sm' /> {user.account_status === 'blocked' ? 'Unblock' : 'Reactivate'}
          </Button>
        );
    }
  };

  return (
    <main className="users users-page">
      <section className="page-hero">
        <div><span className="page-hero__eyebrow">IDENTITY AND ACCESS</span><h1>Platform users.</h1><p>Review account requests, manage access status and maintain a clear view of every SIMS user.</p></div>
        <div className="page-hero__aside"><strong>{counts.all}</strong><span>registered users</span><small>{counts.pending} awaiting approval</small><Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}><Download size={15}/> Export users</Button></div>
      </section>

      <div className='users-stats'>
        <StatCard
          label="Total users"
          value={counts.all}
          hint="Across the whole platform"
          icon={<UsersIcon className='users-icon' />}
        />
        <StatCard
          label="Pending approval"
          value={counts.pending}
          hint="Waiting for an administrator"
          icon={<Clock3 className='users-icon' />}
          className='users-stat--pending'
        />
        <StatCard
          label="Active"
          value={counts.active}
          hint="Can sign in and use SIMS"
          icon={<UserCheck className='users-icon' />}
          className='users-stat--active'
        />
        <StatCard
          label="Restricted"
          value={counts.suspended + counts.blocked}
          hint={`${counts.suspended} suspended · ${counts.blocked} blocked`}
          icon={<ShieldAlert className='users-icon' />}
          className='users-stat--restricted'
        />
      </div>

      {counts.pending > 0 ? (
        <button type="button" className='users-pending-banner' onClick={() => setTab('pending')}>
          <span className='users-pending-banner__icon'>
            <Clock3 className='users-icon-sm' />
          </span>
          <span className='users-pending-banner__text'>
            <strong>{counts.pending}</strong> {counts.pending === 1 ? 'account is' : 'accounts are'} waiting for
            approval. Review them to grant access.
          </span>
          <span className='users-pending-banner__cta'>
            Review <ChevronRight className='users-icon-sm' />
          </span>
        </button>
      ) : null}

      <Card className='users-panel'>
        <div className='users-toolbar'>
          <div className='users-search'>
            <Search className='users-search__icon' />
            <Input
              className='users-search__input'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or organization"
              aria-label="Search users"
            />
          </div>
          <div className='users-filters'>
            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}
              aria-label="Filter by role"
              className='users-select'
            >
              <option value="all">All roles</option>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              aria-label="Sort users"
              className='users-select'
            >
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="status">Status</option>
            </Select>
          </div>
        </div>

        <Tabs
          className='users-tabs'
          value={tab}
          onChange={(key) => setTab(key as StatusTab)}
          options={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'suspended', label: 'Suspended', count: counts.suspended },
            { key: 'blocked', label: 'Blocked', count: counts.blocked },
          ]}
        />

        {selectedUsers.length > 0 ? (
          <div className='users-bulkbar'>
            <span className='users-bulkbar__count'>{selectedUsers.length} selected</span>
            <div className='users-bulkbar__actions'>
              <Button size="sm" onClick={bulkApprove} loading={setStatus.isPending}>
                <CheckCircle2 className='users-icon-sm' />
                Approve {selectedPending.length > 0 ? `${selectedPending.length} pending` : 'selected'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {usersQuery.isLoading ? (
          <div className='users-loading'>
            <Spinner className='users-icon-lg' />
          </div>
        ) : usersQuery.isError ? (
          <div className='users-error'>
            <Alert tone="danger" title="Could not load users">
              {errorMessage(usersQuery.error)}
            </Alert>
            <Button variant="secondary" onClick={() => void usersQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className='users-icon-lg' />}
            title="No users match"
            description={
              users.length === 0
                ? 'Accounts will appear here as people sign up or are invited.'
                : 'Try a different search, role, or status filter.'
            }
          />
        ) : (
          <Table className='users-table'>
            <thead>
              <tr>
                <Th className='users-th-check'>
                  <input
                    type="checkbox"
                    className='users-checkbox'
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all visible users"
                    disabled={visibleModeratable.length === 0}
                  />
                </Th>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Organization</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th className='users-th-actions'>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const moderatable = isModeratable(user);
                return (
                  <tr key={user.id} className={cn('users-row', selected.has(user.id) && 'users-row--selected')}>
                    <Td className='users-td-check'>
                      <input
                        type="checkbox"
                        className='users-checkbox'
                        checked={selected.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        aria-label={`Select ${user.full_name}`}
                        disabled={!moderatable}
                      />
                    </Td>
                    <Td>
                      <button type="button" className='users-identity' onClick={() => setDetailId(user.id)}>
                        <Avatar name={user.full_name} className='users-avatar' />
                        <span className='users-identity__text'>
                          <span className='users-identity__name'>{user.full_name}</span>
                          <span className='users-identity__email'>{user.email}</span>
                        </span>
                        <ChevronRight className='users-identity__chevron' />
                      </button>
                    </Td>
                    <Td>
                      <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                    </Td>
                    <Td className='users-org'>
                      {user.university_name ?? user.company_name ?? <span className='users-muted'>Platform</span>}
                    </Td>
                    <Td>
                      <Badge tone={accountStatusTone(user.account_status)}>
                        {ACCOUNT_STATUS_LABELS[user.account_status]}
                      </Badge>
                    </Td>
                    <Td className='users-date'>{formatDate(user.created_at)}</Td>
                    <Td className='users-td-actions'>
                      <div className='users-actions'>
                        {primaryAction(user)}
                        {moderatable ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className='users-delete-btn'
                            onClick={() => setDeleteTarget(user)}
                            aria-label={`Archive ${user.full_name}`}
                          >
                            <Archive className='users-icon-sm' /> Archive
                          </Button>
                        ) : (
                          <span className='users-self-note'>
                            {user.id === profile.id ? 'You' : 'General admin'}
                          </span>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {detailUser ? (
        <div className='users-drawer-root'>
          <div className='users-drawer__backdrop' onClick={() => setDetailId(null)} aria-hidden />
          <aside className='users-drawer' role="dialog" aria-modal="true" aria-label={`Details for ${detailUser.full_name}`}>
            <div className='users-drawer__header'>
              <Avatar name={detailUser.full_name} className='users-drawer__avatar' />
              <div className='users-drawer__heading'>
                <h2 className='users-drawer__name'>{detailUser.full_name}</h2>
                <p className='users-drawer__email'>{detailUser.email}</p>
              </div>
              <button
                type="button"
                className='users-drawer__close'
                onClick={() => setDetailId(null)}
                aria-label="Close details"
              >
                <X className='users-icon' />
              </button>
            </div>

            <div className='users-drawer__body'>
              <div className='users-drawer__badges'>
                <Badge tone={accountStatusTone(detailUser.account_status)}>
                  {ACCOUNT_STATUS_LABELS[detailUser.account_status]}
                </Badge>
                <Badge tone={ROLE_TONE[detailUser.role]}>{ROLE_LABELS[detailUser.role]}</Badge>
              </div>

              <dl className='users-detail-grid'>
                <div className='users-detail-grid__item'>
                  <dt>Organization</dt>
                  <dd>{detailUser.university_name ?? detailUser.company_name ?? 'Platform administration'}</dd>
                </div>
                <div className='users-detail-grid__item'>
                  <dt>Joined</dt>
                  <dd>{formatDateTime(detailUser.created_at)}</dd>
                </div>
                <div className='users-detail-grid__item users-detail-grid__item--full'>
                  <dt>Account ID</dt>
                  <dd className='users-mono'>{detailUser.id}</dd>
                </div>
              </dl>

              {detailUser.account_status === 'pending' ? (
                <Alert tone="info" title="Awaiting approval">
                  This account cannot access SIMS until you approve it. Approving grants immediate access.
                </Alert>
              ) : null}

              {isModeratable(detailUser) ? (
                <div className='users-drawer__section'>
                  <h3 className='users-drawer__section-title'>Account access</h3>
                  <div className='users-drawer__actions'>
                    <Button
                      variant={detailUser.account_status === 'active' ? 'secondary' : 'primary'}
                      onClick={() => changeStatus(detailUser, 'active')}
                      loading={setStatus.isPending}
                      disabled={detailUser.account_status === 'active'}
                    >
                      <CheckCircle2 className='users-icon-sm' />
                      {detailUser.account_status === 'pending' ? 'Approve account' : 'Reactivate'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => changeStatus(detailUser, 'suspended')}
                      loading={setStatus.isPending}
                      disabled={detailUser.account_status === 'suspended'}
                    >
                      <PauseCircle className='users-icon-sm' /> Suspend
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => changeStatus(detailUser, 'blocked')}
                      loading={setStatus.isPending}
                      disabled={detailUser.account_status === 'blocked'}
                    >
                      <Ban className='users-icon-sm' /> Block
                    </Button>
                  </div>
                  <p className='users-drawer__hint'>
                    Suspending temporarily removes access; blocking denies access until reversed. The user is notified
                    and the change is recorded in the audit log.
                  </p>
                </div>
              ) : (
                <Alert tone="info" title="Administrator account">
                  {detailUser.id === profile.id
                    ? 'This is your account. Manage administrator accounts from General admins.'
                    : 'General administrators are managed from the General admins tab.'}{' '}
                  <Link to="/tenants" className='users-link'>Open tenants</Link>
                </Alert>
              )}

              {isModeratable(detailUser) ? (
                <div className='users-drawer__danger'>
                  <div>
                    <h3 className='users-drawer__danger-title'>Archive account</h3>
                    <p className='users-drawer__danger-text'>
                      Move this account to the Recycle Bin. Its records are preserved and it can be restored.
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => setDeleteTarget(detailUser)}>
                    <Archive className='users-icon-sm' /> Archive account
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Archive this account?"
        description={deleteTarget ? `${deleteTarget.full_name} · ${deleteTarget.email}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleteUser.isPending}>
              <Trash2 className='users-icon-sm' /> Archive account
            </Button>
          </>
        }
      >
        <Alert tone="warning" title="This account will be archived">
          The account will be moved to the Recycle Bin and blocked from signing in. The profile, applications, placements, and activity history will be preserved. A platform administrator can restore it later.
        </Alert>
      </Modal>

      {undo ? (
        <div className='users-undo' role="status">
          <span className='users-undo__dot' />
          <span className='users-undo__label'>{undo.label}</span>
          <button type="button" className='users-undo__btn' onClick={undoLast}>
            <Undo2 className='users-icon-sm' /> Undo
          </button>
          <button
            type="button"
            className='users-undo__close'
            onClick={() => setUndo(null)}
            aria-label="Dismiss"
          >
            <X className='users-icon-sm' />
          </button>
        </div>
      ) : null}
    </main>
  );
}