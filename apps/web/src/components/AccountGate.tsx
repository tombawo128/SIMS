import { useState } from 'react';
import { Clock3, GraduationCap, LogOut, RefreshCw, ShieldAlert, ShieldX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ACCOUNT_STATUS_LABELS, APP_NAME, accountStatusTone } from '@sims/shared';
import type { AccountStatus } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const COPY: Record<
  Exclude<AccountStatus, 'active'>,
  { icon: LucideIcon; title: string; body: string; tone: 'pending' | 'suspended' | 'blocked' }
> = {
  pending: {
    icon: Clock3,
    title: 'Your account is awaiting approval',
    body: 'Thanks for signing up. A general administrator needs to approve your account before you can access SIMS. You will be able to sign in and use the platform as soon as it is approved.',
    tone: 'pending',
  },
  suspended: {
    icon: ShieldAlert,
    title: 'Your account is suspended',
    body: 'Access to SIMS has been temporarily suspended for your account. Contact the platform team to resolve this and restore access.',
    tone: 'suspended',
  },
  blocked: {
    icon: ShieldX,
    title: 'Your account is blocked',
    body: 'This account has been blocked and can no longer access SIMS. If you believe this is a mistake, contact the platform team.',
    tone: 'blocked',
  },
};

export function AccountGate({ status }: { status: Exclude<AccountStatus, 'active'> }) {
  const { profile, signout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const copy = COPY[status];
  if (!copy) return null;
  const Icon = copy.icon;

  const checkAgain = async () => {
    setChecking(true);
    setCheckError('');
    try {
      await refreshProfile();
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : 'Could not refresh your account status. Try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={cn('gate', `gate--${copy.tone}`)}>
      <div className='gate__aurora gate__aurora--1' />
      <div className='gate__aurora gate__aurora--2' />
      <div className='gate__grain' />

      <div className='gate__card'>
        <div className='gate__brand'>
          <span className='gate__brand-logo'>
            <GraduationCap className='gate__brand-icon' />
          </span>
          <span className='gate__brand-name'>{APP_NAME}</span>
        </div>

        <div className='gate__icon-wrap'>
          <span className='gate__pulse' />
          <span className='gate__icon'>
            <Icon className='gate__icon-svg' />
          </span>
        </div>

        <Badge tone={accountStatusTone(status)} className='gate__badge'>
          {ACCOUNT_STATUS_LABELS[status]}
        </Badge>

        <h1 className='gate__title'>{copy.title}</h1>
        <p className='gate__body'>{copy.body}</p>

        {profile?.email ? (
          <p className='gate__account'>
            Signed in as <span className='gate__account-email'>{profile.email}</span>
          </p>
        ) : null}

        {checkError ? <p className='gate__body' role="alert">{checkError}</p> : null}

        <div className='gate__actions'>
          {status === 'pending' ? (
            <Button onClick={checkAgain} loading={checking} className='gate__check'>
              <RefreshCw className='gate__action-icon' /> Check again
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              void signout();
            }}
          >
            <LogOut className='gate__action-icon' /> Sign out
          </Button>
        </div>

        <p className='gate__footnote'>
          {status === 'pending'
            ? 'Approval usually happens quickly. Keep this page open and check again, or sign out and return later.'
            : 'Need help? Reach out to your institution or the SIMS platform team.'}
        </p>
      </div>
    </div>
  );
}
