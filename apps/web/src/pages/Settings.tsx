import { useEffect, useState, type FormEvent } from 'react';
import { Bell, BellRing, Building2, Check, ChevronRight, KeyRound, Laptop, LockKeyhole, LogOut, Mail, ShieldCheck, UserCog, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import { Alert, Button, Field, Input, useToast } from '@/components/ui';

type Preferences = { in_app_notifications: boolean; application_updates: boolean; supervision_updates: boolean; system_announcements: boolean };
const DEFAULT_PREFERENCES: Preferences = { in_app_notifications: true, application_updates: true, supervision_updates: true, system_announcements: true };
const preferenceOptions = [
  { key: 'application_updates' as const, title: 'Applications and opportunities', description: 'Application status, shortlisting, offers and recruitment activity.', icon: Mail, tone: 'blue' },
  { key: 'supervision_updates' as const, title: 'Internship supervision', description: 'Weekly reports, supervisor requests, evaluations and final grades.', icon: UserCog, tone: 'violet' },
  { key: 'system_announcements' as const, title: 'System announcements', description: 'Important notices and service updates from the SIMS team.', icon: BellRing, tone: 'amber' },
];
const roleLabel = (role: string) => role.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

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
      const { data, error } = await supabase.from('profiles').select('notification_preferences').eq('id', profile.id).maybeSingle();
      if (cancelled) return;
      if (error) setPreferencesError(error.message);
      else if (data?.notification_preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...data.notification_preferences });
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
      const { error } = await supabase.from('profiles').update({ notification_preferences: next }).eq('id', profile.id);
      if (error) throw error;
      toast({ title: 'Notification preferences saved', tone: 'success' });
    } catch (caught) {
      setPreferences(previous);
      setPreferencesError(errorMessage(caught));
    } finally { setSavingPreference(false); }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    if (password.next.length < 8) return setPasswordError('Use at least 8 characters for your new password.');
    if (password.next !== password.confirm) return setPasswordError('The passwords do not match.');
    setSavingPassword(true);
    try {
      await updatePassword(password.next);
      setPassword({ next: '', confirm: '' });
      toast({ title: 'Password updated successfully', tone: 'success' });
    } catch (caught) { setPasswordError(errorMessage(caught)); }
    finally { setSavingPassword(false); }
  };

  const signOutOtherSessions = async () => {
    setSigningOutOthers(true);
    setSecurityError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast({ title: 'Other sessions signed out', description: 'This device remains signed in.', tone: 'success' });
    } catch (caught) { setSecurityError(errorMessage(caught)); }
    finally { setSigningOutOthers(false); }
  };

  const workspace = profile.university?.name ?? profile.company?.name ?? 'Platform administration';
  const initials = (profile.full_name || profile.email || 'S').split(/[\\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

  return (
    <div className="settings-page">
      <style>{`
        .settings-page{max-width:1160px;margin:0 auto;padding-bottom:36px;color:var(--text,#172033)}
        .settings-hero{position:relative;overflow:hidden;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:30px 32px;margin-bottom:24px;border:1px solid var(--border,#e2e8f0);border-radius:22px;background:linear-gradient(115deg,#f7faff,#f2f6ff 58%,#f8f5ff)}
        .settings-hero:after{content:"";position:absolute;width:250px;height:250px;border-radius:50%;right:7%;top:-175px;background:rgba(99,130,230,.12);pointer-events:none}
        .settings-eyebrow{display:flex;align-items:center;gap:8px;color:#53698f;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
        .settings-hero h1{margin:10px 0 7px;font-size:clamp(25px,3vw,34px);letter-spacing:-.04em;line-height:1.12;color:#17243c}
        .settings-hero p{max-width:560px;margin:0;color:#64748b;font-size:14px;line-height:1.65}
        .settings-hero-mark{position:relative;z-index:1;display:grid;place-items:center;width:66px;height:66px;flex:0 0 66px;border:1px solid #dce5f7;border-radius:19px;background:#ffffffc9;color:#526fa8}
        .settings-layout{display:grid;grid-template-columns:minmax(0,1fr) 286px;gap:22px;align-items:start}
        .settings-main{display:grid;gap:20px;min-width:0}
        .settings-card,.settings-aside-card{border:1px solid var(--border,#e2e8f0);border-radius:18px;background:var(--surface,#fff);box-shadow:0 3px 14px rgba(15,23,42,.035)}
        .settings-card{padding:23px}
        .settings-card-head{display:flex;align-items:flex-start;gap:13px;margin-bottom:21px}
        .settings-icon{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:13px;background:#eef3ff;color:#526da7}
        .settings-card-head h2{margin:1px 0 5px;font-size:16px;font-weight:750;color:var(--text,#172033)}
        .settings-card-head p{margin:0;color:var(--muted,#64748b);font-size:13px;line-height:1.55}
        .settings-master{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 18px;border:1px solid #dbe5f6;border-radius:14px;background:#f7f9fe;margin-bottom:13px}
        .settings-master-copy,.settings-row-copy,.settings-session-copy{display:flex;align-items:center;gap:12px;min-width:0}
        .settings-master-symbol{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#e7efff;color:#4d6da9;flex:0 0 38px}
        .settings-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 4px;border-bottom:1px solid var(--border,#edf0f5)}
        .settings-row:last-child{border-bottom:0;padding-bottom:2px}
        .settings-row-copy strong,.settings-master-copy strong{display:block;font-size:13px;font-weight:700;color:var(--text,#172033)}
        .settings-row-copy small,.settings-master-copy small{display:block;margin-top:4px;color:var(--muted,#64748b);font-size:12px;line-height:1.5}
        .settings-row-icon{display:grid;place-items:center;width:35px;height:35px;flex:0 0 35px;border-radius:10px}
        .settings-row-icon.blue{background:#edf5ff;color:#3976c8}.settings-row-icon.violet{background:#f2edff;color:#7856c7}.settings-row-icon.amber{background:#fff5e5;color:#b77b21}
        .settings-switch{position:relative;width:42px;height:24px;flex:0 0 42px}
        .settings-switch input{position:absolute;opacity:0;width:1px;height:1px}
        .settings-switch span{position:absolute;inset:0;border-radius:20px;background:#cbd5e1;transition:background .18s;cursor:pointer}
        .settings-switch span:before{content:"";position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0003;transition:transform .18s}
        .settings-switch input:checked+span{background:#5478ba}.settings-switch input:checked+span:before{transform:translateX(18px)}
        .settings-switch input:focus-visible+span{outline:3px solid #5478ba40;outline-offset:2px}.settings-switch input:disabled+span{opacity:.45;cursor:not-allowed}
        .settings-security-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}
        .settings-form-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px}
        .settings-form-actions small{color:var(--muted,#64748b);font-size:12px}
        .settings-session{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:22px;padding:17px 0 0;border-top:1px solid var(--border,#edf0f5)}
        .settings-session-copy strong{display:block;font-size:13px}.settings-session-copy small{display:block;margin-top:4px;color:var(--muted,#64748b);font-size:12px}
        .settings-aside{display:grid;gap:16px;position:sticky;top:18px}
        .settings-profile{padding:21px}.settings-avatar{display:grid;place-items:center;width:54px;height:54px;border-radius:17px;background:linear-gradient(135deg,#dce8ff,#ece5ff);color:#4f6598;font-weight:800;font-size:18px;margin-bottom:14px}
        .settings-profile h3{margin:0 0 4px;font-size:15px;font-weight:750}.settings-profile>p{margin:0;color:var(--muted,#64748b);font-size:12px;overflow-wrap:anywhere}
        .settings-role{display:inline-flex;margin-top:13px;padding:6px 9px;border-radius:8px;background:#eff4ff;color:#4e689e;font-size:11px;font-weight:700}
        .settings-meta{display:grid;gap:13px;margin-top:19px;padding-top:17px;border-top:1px solid var(--border,#edf0f5)}
        .settings-meta-item{display:flex;gap:10px;align-items:flex-start;color:#64748b}.settings-meta-item svg{margin-top:1px;flex:0 0 auto;color:#8292ae}
        .settings-meta-item small{display:block;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;font-weight:700}
        .settings-meta-item strong{display:block;margin-top:3px;font-size:12px;font-weight:650;color:var(--text,#334155);overflow-wrap:anywhere}
        .settings-aside-card{padding:18px}.settings-help-title{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:750;margin-bottom:8px}
        .settings-aside-card p{margin:0;color:var(--muted,#64748b);font-size:12px;line-height:1.6}
        .settings-profile-link{display:inline-flex;align-items:center;gap:5px;margin-top:13px;color:#4d6fae;font-size:12px;font-weight:700;text-decoration:none}.settings-profile-link:hover{text-decoration:underline}
        @media(max-width:900px){.settings-layout{grid-template-columns:1fr}.settings-aside{position:static;grid-template-columns:1fr 1fr}.settings-profile{grid-row:span 2}}
        @media(max-width:620px){.settings-hero{padding:23px 20px;border-radius:17px}.settings-hero-mark{width:48px;height:48px;flex-basis:48px}.settings-card{padding:18px}.settings-aside{grid-template-columns:1fr}.settings-profile{grid-row:auto}.settings-security-grid{grid-template-columns:1fr}.settings-session{align-items:flex-start;flex-direction:column}.settings-form-actions{align-items:flex-start;flex-direction:column}}
        @media(prefers-reduced-motion:reduce){.settings-switch span,.settings-switch span:before{transition:none}}
      `}</style>

      <header className="settings-hero">
        <div>
          <div className="settings-eyebrow"><UserRound size={14} /> Account centre</div>
          <h1>Settings</h1>
          <p>Manage your preferences, protect your account and keep your SIMS workspace working the way you need it.</p>
        </div>
        <div className="settings-hero-mark" aria-hidden="true"><UserCog size={30} /></div>
      </header>

      <div className="settings-layout">
        <main className="settings-main">
          <section className="settings-card" aria-labelledby="settings-notifications-title">
            <div className="settings-card-head">
              <div className="settings-icon"><Bell size={20} /></div>
              <div><h2 id="settings-notifications-title">Notification preferences</h2><p>Choose the updates that appear in your SIMS notification centre.</p></div>
            </div>
            {preferencesError ? <Alert tone="danger">{preferencesError}</Alert> : null}
            {loadingPreferences ? <p role="status">Loading your notification preferences…</p> : <>
              <div className="settings-master">
                <div className="settings-master-copy"><div className="settings-master-symbol"><BellRing size={18} /></div><div><strong>In-app notifications</strong><small>Master control for optional SIMS updates.</small></div></div>
                <label className="settings-switch"><input type="checkbox" aria-label="Enable all in-app notifications" checked={preferences.in_app_notifications} disabled={savingPreference} onChange={(event) => void savePreferences({ ...preferences, in_app_notifications: event.target.checked })} /><span /></label>
              </div>
              {preferenceOptions.map((option) => {
                const Icon = option.icon;
                return <div className="settings-row" key={option.key} style={{ opacity: preferences.in_app_notifications ? 1 : .52 }}>
                  <div className="settings-row-copy"><div className={`settings-row-icon ${option.tone}`}><Icon size={17} /></div><div><strong>{option.title}</strong><small>{option.description}</small></div></div>
                  <label className="settings-switch"><input type="checkbox" aria-label={`Enable ${option.title.toLowerCase()}`} checked={preferences[option.key]} disabled={savingPreference || !preferences.in_app_notifications} onChange={(event) => void savePreferences({ ...preferences, [option.key]: event.target.checked })} /><span /></label>
                </div>;
              })}
              {savingPreference ? <p style={{ margin: '12px 0 0', color: 'var(--muted,#64748b)', fontSize: 11 }}>Saving your changes…</p> : null}
            </>}
          </section>

          <section className="settings-card" aria-labelledby="settings-security-title">
            <div className="settings-card-head"><div className="settings-icon"><ShieldCheck size={20} /></div><div><h2 id="settings-security-title">Security and password</h2><p>Use a strong password and review where your account is signed in.</p></div></div>
            <form onSubmit={changePassword}>
              {passwordError ? <Alert tone="danger">{passwordError}</Alert> : null}
              <div className="settings-security-grid">
                <Field label="New password" htmlFor="settings-new-password" required><Input id="settings-new-password" type="password" autoComplete="new-password" minLength={8} value={password.next} onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))} placeholder="At least 8 characters" /></Field>
                <Field label="Confirm new password" htmlFor="settings-confirm-password" required><Input id="settings-confirm-password" type="password" autoComplete="new-password" minLength={8} value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} placeholder="Enter password again" /></Field>
              </div>
              <div className="settings-form-actions"><small>Choose a password you do not use on other websites.</small><Button type="submit" loading={savingPassword}><KeyRound size={15} /> Update password</Button></div>
            </form>
            <div className="settings-session">
              <div className="settings-session-copy"><div className="settings-row-icon blue"><Laptop size={17} /></div><div><strong>Other active sessions</strong><small>Sign out other devices while keeping this one connected.</small></div></div>
              <Button variant="secondary" onClick={() => void signOutOtherSessions()} loading={signingOutOthers}><LogOut size={15} /> Sign out others</Button>
            </div>
            {securityError ? <div style={{ marginTop: 14 }}><Alert tone="danger">{securityError}</Alert></div> : null}
          </section>
        </main>

        <aside className="settings-aside">
          <section className="settings-aside-card settings-profile">
            <div className="settings-avatar" aria-hidden="true">{initials || 'S'}</div>
            <h3>{profile.full_name || 'SIMS account'}</h3><p>{profile.email}</p>
            <span className="settings-role">{roleLabel(profile.role)}</span>
            <div className="settings-meta">
              <div className="settings-meta-item"><Building2 size={15} /><span><small>Workspace</small><strong>{workspace}</strong></span></div>
              <div className="settings-meta-item"><LockKeyhole size={15} /><span><small>Account access</small><strong>Authenticated account</strong></span></div>
            </div>
            <Link to="/profile" className="settings-profile-link">Manage profile details <ChevronRight size={14} /></Link>
          </section>
          <section className="settings-aside-card"><div className="settings-help-title"><ShieldCheck size={17} /> Your account, your control</div><p>Notification choices apply to optional SIMS updates. Essential account and security functions remain available.</p></section>
          <section className="settings-aside-card"><div className="settings-help-title"><Check size={17} /> Need to update your details?</div><p>Your name and organisation details are maintained in your profile and may be managed by your workspace administrator.</p><Link to="/profile" className="settings-profile-link">Open profile <ChevronRight size={14} /></Link></section>
        </aside>
      </div>
    </div>
  );
}
