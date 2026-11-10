import { useState } from 'react';
import { Lock, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { MAX_PLATFORM_ADMINS, formatDate } from '@sims/shared';
import type { InviteResult, PlatformAdmin } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import {
  useCreatePlatformAdmin,
  useDeletePlatformAdmin,
  usePlatformAdmins,
} from '@/hooks/usePlatformAdmins';
import { cn, errorMessage } from '@/lib/utils';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Spinner,
  useToast,
} from '@/components/ui';

export function GeneralAdmins() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const adminsQuery = usePlatformAdmins();
  const createAdmin = useCreatePlatformAdmin();
  const deleteAdmin = useDeletePlatformAdmin();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '' });
  const [createError, setCreateError] = useState('');
  const [result, setResult] = useState<InviteResult | null>(null);

  const [deleting, setDeleting] = useState<PlatformAdmin | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const admins = adminsQuery.data ?? [];
  const count = admins.length;
  const canCreate = count < MAX_PLATFORM_ADMINS;
  const slotsLeft = Math.max(0, MAX_PLATFORM_ADMINS - count);

  const openCreate = () => {
    setForm({ fullName: '', email: '' });
    setCreateError('');
    setResult(null);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    setCreateError('');
    if (!form.fullName.trim() || !form.email.trim()) {
      setCreateError('Enter a name and email.');
      return;
    }
    try {
      const created = await createAdmin.mutateAsync({
        email: form.email.trim(),
        full_name: form.fullName.trim(),
      });
      setResult(created);
      toast({
        title: 'General administrator created',
        description: `Share the temporary password with ${created.email}.`,
        tone: 'success',
      });
    } catch (caught) {
      setCreateError(errorMessage(caught));
    }
  };

  const openDelete = (admin: PlatformAdmin) => {
    setDeleting(admin);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError('');
    try {
      await deleteAdmin.mutateAsync(deleting.id);
      toast({
        title: 'Administrator removed',
        description: `${deleting.full_name} no longer has platform access. A slot is now free.`,
        tone: 'info',
      });
      setDeleting(null);
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    }
  };

  return (
    <div className='admins'>
      <Card className='admins-quota'>
        <div className='admins-quota__info'>
          <span className='admins-quota__icon'>
            <ShieldCheck className='admins-icon' />
          </span>
          <div className='admins-quota__text'>
            <h2 className='admins-quota__title'>General administrators</h2>
            <p className='admins-quota__desc'>
              Platform-wide accounts that oversee every university and company. A maximum of{' '}
              {MAX_PLATFORM_ADMINS} can exist at once.
            </p>
          </div>
        </div>

        <div className='admins-quota__side'>
          <div
            className='admins-quota__meter'
            role='img'
            aria-label={`${count} of ${MAX_PLATFORM_ADMINS} administrator slots used`}
          >
            <span className='admins-quota__slots'>
              {Array.from({ length: MAX_PLATFORM_ADMINS }).map((_, index) => (
                <span
                  key={index}
                  className={cn('admins-slot', index < count && 'admins-slot--filled')}
                />
              ))}
            </span>
            <span className='admins-quota__count'>
              {count} / {MAX_PLATFORM_ADMINS}
            </span>
          </div>

          {canCreate ? (
            <Button onClick={openCreate}>
              <UserPlus className='admins-icon-sm' /> Create general admin
            </Button>
          ) : (
            <span className='admins-full'>
              <Lock className='admins-icon-sm' /> Both slots filled
            </span>
          )}
        </div>
      </Card>

      {!canCreate ? (
        <p className='admins-hint'>
          The administrator limit is reached. Delete an administrator below to free a slot and the
          create option will return.
        </p>
      ) : null}

      {adminsQuery.isLoading ? (
        <div className='admins-loading'>
          <Spinner className='admins-icon-lg' />
        </div>
      ) : adminsQuery.isError ? (
        <Alert tone='danger' title='Could not load general administrators'>
          <div className='admins-error'>
            <p>
              Make sure the platform-admins database migration and the manage-admins Edge Function
              are deployed, then try again.
            </p>
            <Button size='sm' variant='secondary' onClick={() => adminsQuery.refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : admins.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className='admins-icon-lg' />}
          title='No general administrators'
          description='Create the first platform-wide administrator to get started.'
          action={
            canCreate ? (
              <Button size='sm' onClick={openCreate}>
                <UserPlus className='admins-icon-sm' /> Create general admin
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className='admins-list'>
          {admins.map((admin) => {
            const isSelf = admin.id === profile?.id;
            return (
              <Card key={admin.id} className='admin-row'>
                <div className='admin-row__main'>
                  <Avatar name={admin.full_name} className='admin-row__avatar' />
                  <div className='admin-row__identity'>
                    <p className='admin-row__name'>
                      <span className='admin-row__name-text'>{admin.full_name}</span>
                      {isSelf ? <Badge tone='blue'>You</Badge> : null}
                    </p>
                    <p className='admin-row__email'>{admin.email}</p>
                  </div>
                </div>

                <div className='admin-row__meta'>
                  <Badge tone='violet'>General admin</Badge>
                  <span className='admin-row__date'>Added {formatDate(admin.created_at)}</span>
                </div>

                <div className='admin-row__actions'>
                  {isSelf ? (
                    <span className='admin-row__self'>Currently signed in</span>
                  ) : (
                    <Button size='sm' variant='danger' onClick={() => openDelete(admin)}>
                      <Trash2 className='admins-icon-sm' /> Delete
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title='Create general administrator'
        description={
          result
            ? 'Account created. Share these credentials over a secure channel.'
            : `Add a platform-wide administrator. ${slotsLeft} ${slotsLeft === 1 ? 'slot' : 'slots'} available.`
        }
        footer={
          result ? (
            <Button onClick={() => setCreateOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant='secondary' onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitCreate} loading={createAdmin.isPending}>
                Create account
              </Button>
            </>
          )
        }
      >
        <div className='admins-modal'>
          {createError ? <Alert tone='danger'>{createError}</Alert> : null}
          {result ? (
            <Alert tone='success' title='Administrator created'>
              <div className='admins-credentials'>
                <p>
                  Email: <strong>{result.email}</strong>
                </p>
                <p>
                  Temporary password: <code className='admins-code'>{result.temporary_password}</code>
                </p>
                <p className='admins-credentials__note'>
                  The new administrator should sign in and change this password from their profile.
                </p>
              </div>
            </Alert>
          ) : (
            <>
              <Field label='Full name' htmlFor='admin-name' required>
                <Input
                  id='admin-name'
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder='Dana Whitfield'
                />
              </Field>
              <Field label='Email' htmlFor='admin-email' required>
                <Input
                  id='admin-email'
                  type='email'
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder='admin@sims.dev'
                />
              </Field>
              <div className='admins-modal__note'>
                <Badge tone='violet'>General admin</Badge>
                <span>
                  Full platform access across all tenants. The account is created by the manage-admins
                  function with a temporary password.
                </span>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title='Remove administrator'
        description={deleting ? `Permanently remove ${deleting.full_name} from the platform.` : undefined}
        size='sm'
        footer={
          <>
            <Button variant='secondary' onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant='danger' onClick={confirmDelete} loading={deleteAdmin.isPending}>
              <Trash2 className='admins-icon-sm' /> Delete account
            </Button>
          </>
        }
      >
        <div className='admins-modal'>
          {deleteError ? <Alert tone='danger'>{deleteError}</Alert> : null}
          <Alert tone='warning' title='This cannot be undone'>
            {deleting ? (
              <p>
                <strong>{deleting.full_name}</strong> ({deleting.email}) will lose all platform access
                and their account will be deleted. A slot will open up, so you can create a new
                administrator afterwards.
              </p>
            ) : null}
          </Alert>
        </div>
      </Modal>
    </div>
  );
}