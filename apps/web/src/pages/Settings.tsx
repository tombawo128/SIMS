import { useEffect, useState, type FormEvent } from 'react';
import { Bell, KeyRound, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  useToast,
} from '@/components/ui';

type Preferences = {
  in_app_notifications: boolean;
  application_updates: boolean;
  supervision_updates: boolean;
  system_announcements: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  in_app_notifications: true,
  application_updates: true,
  supervision_updates: true,
  system_announcements: true,
};

const preferenceOptions: { key: keyof Omit<Preferences, 'in_app_notifications'>; title: string; description: string }[] = [
  {
    key: 'application_updates',
    title: 'Applications and opportunities',
    description: 'Application status changes, shortlisting, acceptance and recruitment updates.',
  },
  {
    key: 'supervision_updates',
    title: 'Internship supervision',
    description: 'Weekly report reviews, supervisor requests, evaluations and final grades.',
  },
  {
    key: 'system_announcements',
    title: 'System announcements',
    description: 'Platform-wide notices and important service announcements.',
  },
];

export function SettingsPage() {
  const { profile, updatePassword } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferencesError, setPreferencesError] = useState('');
  const [password, setPassword] = useState({ next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [securityError, setSecurityError] = useState('');

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const load = async () => {
      setLoadingPreferences(true);
      setPreferencesError('');
      const { data, error } = await supabase
        .from('user_settings')
        .select('in_app_notifications, application_updates, supervision_updates, system_announcements')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setPreferencesError(error.message);
      } else if (data) {
        setPreferences({
          in_app_notifications: data.in_app_notifications,
          application_updates: data.application_updates,
          supervision_updates: data.supervision_updates,
          system_announcements: data.system_announcements,
        });
      }
      setLoadingPreferences(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  if (!profile) return null;

  const savePreferences = async (next: Preferences) => {
    const previous = preferences;
    setPreferences(next);
    setSavingPreference(true);
    setPreferencesError('');
    try {
      const { error } = await supabase.from('user_settings').upsert(
        { user_id: profile.id, ...next },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      toast({ title: 'Notification preferences saved', tone: 'success' });
    } catch (caught) {
      setPreferences(previous);
      setPreferencesError(errorMessage(caught));
    } finally {
      setSavingPreference(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    if (password.next.length < 8) {
      setPasswordError('Use at least 8 characters for your new password.');
      return;
    }
    if (password.next !== password.confirm) {
      setPasswordError('The passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(password.next);
      setPassword({ next: '', confirm: '' });
      toast({ title: 'Password updated successfully', tone: 'success' });
    } catch (caught) {
      setPasswordError(errorMessage(caught));
    } finally {
      setSavingPassword(false);
    }
  };

  const signOutOtherSessions = async () => {
    setSigningOutOthers(true);
    setSecurityError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast({ title: 'Other sessions signed out', description: 'This device remains signed in.', tone: 'success' });
    } catch (caught) {
      setSecurityError(errorMessage(caught));
    } finally {
      setSigningOutOthers(false);
    }
  };

  const workspace = profile.university?.name ?? profile.company?.name ?? 'Platform administration';

  return (
    <div className='profile-space-y-6-1'>
      <PageHeader title="Settings" description="Manage your SIMS account security and notification preferences." />

      <Card>
        <CardHeader
          title={<><Bell size={18} style={{ display: 'inline', marginRight: 8 }} />Notification preferences</>}
          description="Choose which in-app notifications you receive. Critical account and security controls remain available in SIMS."
        />
        {preferencesError ? <Alert tone="danger">{preferencesError}</Alert> : null}
        {loadingPreferences ? <Alert tone="info">Loading your preferences…</Alert> : (
          <div style={{ display: 'grid', gap: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 14, border: '1px solid var(--border, #e2e8f0)', borderRadius: 12 }}>
              <span>
                <strong>All in-app notifications</strong>
                <span style={{ display: 'block', color: 'var(--muted, #64748b)', fontSize: 13, marginTop: 4 }}>Master switch for optional SIMS notifications.</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.in_app_notifications}
                disabled={savingPreference}
                onChange={(event) => void savePreferences({ ...preferences, in_app_notifications: event.target.checked })}
              />
            </label>
            {preferenceOptions.map((option) => (
              <label key={option.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 14, border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, opacity: preferences.in_app_notifications ? 1 : 0.55 }}>
                <span>
                  <strong>{option.title}</strong>
                  <span style={{ display: 'block', color: 'var(--muted, #64748b)', fontSize: 13, marginTop: 4 }}>{option.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={preferences[option.key]}
                  disabled={savingPreference || !preferences.in_app_notifications}
                  onChange={(event) => void savePreferences({ ...preferences, [option.key]: event.target.checked })}
                />
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title={<><ShieldCheck size={18} style={{ display: 'inline', marginRight: 8 }} />Account security</>}
          description="Update your password or end sessions on other devices."
        />
        <form onSubmit={changePassword} className='profile-space-y-4-1'>
          {passwordError ? <Alert tone="danger">{passwordError}</Alert> : null}
          <div className='profile-grid-2'>
            <Field label="New password" htmlFor="settings-new-password" required>
              <Input id="settings-new-password" type="password" autoComplete="new-password" minLength={8} value={password.next} onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))} />
            </Field>
            <Field label="Confirm new password" htmlFor="settings-confirm-password" required>
              <Input id="settings-confirm-password" type="password" autoComplete="new-password" minLength={8} value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} />
            </Field>
          </div>
          <Button type="submit" loading={savingPassword}><KeyRound size={16} /> Update password</Button>
        </form>
        <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', marginTop: 20, paddingTop: 18 }}>
          {securityError ? <Alert tone="danger">{securityError}</Alert> : null}
          <Button variant="secondary" onClick={() => void signOutOtherSessions()} loading={signingOutOthers}>
            <LogOut size={16} /> Sign out other devices
          </Button>
          <p style={{ color: 'var(--muted, #64748b)', fontSize: 13, marginTop: 8 }}>Your current device stays signed in.</p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={<><UserRound size={18} style={{ display: 'inline', marginRight: 8 }} />Account information</>}
          description="Your account identity and organisation are managed by your SIMS administrator."
        />
        <div className='profile-grid-2'>
          <div><span className='stat-card__hint'>Email address</span><p>{profile.email}</p></div>
          <div><span className='stat-card__hint'>Account role</span><p>{profile.role.replaceAll('_', ' ')}</p></div>
          <div><span className='stat-card__hint'>Workspace</span><p>{workspace}</p></div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Link to="/profile" className='profile-link-1'>Manage profile details and student information</Link>
        </div>
      </Card>
    </div>
  );
}
