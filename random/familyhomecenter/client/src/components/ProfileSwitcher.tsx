import { useState, type FormEvent } from 'react';
import { api, type FamilyMember } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from './MemberAvatar.js';
import { MemberPasswordModal } from './MemberPasswordModal.js';

/** Inline password prompt shown in place of the roster when switching to a protected profile. */
function LoginPrompt({ member, onClose, onSuccess }: { member: FamilyMember; onClose: () => void; onSuccess: (m: FamilyMember) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/login', { family_member_id: member.id, password });
      onSuccess(member);
    } catch (err) {
      setError((err as Error).message || 'Incorrect password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="profile-switcher__login" onSubmit={submit}>
      <div className="profile-switcher__login-title"><MemberAvatar member={member} /> {member.name}</div>
      <input
        autoFocus
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div className="settings-login__error">{error}</div>}
      <div className="task-form__row">
        <button type="submit" disabled={submitting}>Log in</button>
        <button type="button" className="secondary" onClick={onClose}>Back</button>
      </div>
    </form>
  );
}

/** Lets whoever is standing at the screen say "I'm Jamie" — no password needed unless they've set one. */
export function ProfileSwitcher() {
  const { members, activeProfile, setActiveProfile, refresh } = useFamilyMembers();
  const [open, setOpen] = useState(false);
  const [loginTarget, setLoginTarget] = useState<FamilyMember | null>(null);
  const [passwordModalTarget, setPasswordModalTarget] = useState<FamilyMember | null>(null);

  const pick = (m: FamilyMember) => {
    if (m.has_password) {
      setLoginTarget(m);
      return;
    }
    setActiveProfile(m);
    setOpen(false);
  };

  const onLoginSuccess = (m: FamilyMember) => {
    setActiveProfile(m);
    setLoginTarget(null);
    setOpen(false);
  };

  const clear = async () => {
    await api.post('/auth/logout').catch(() => {});
    setActiveProfile(null);
    setOpen(false);
  };

  return (
    <div className="profile-switcher">
      <button className="profile-switcher__current" onClick={() => setOpen((o) => !o)}>
        <MemberAvatar member={activeProfile} />
        {activeProfile ? activeProfile.name : "Who's this?"}
      </button>
      {open && (
        <div className="profile-switcher__menu">
          {loginTarget ? (
            <LoginPrompt member={loginTarget} onClose={() => setLoginTarget(null)} onSuccess={onLoginSuccess} />
          ) : (
            <>
              {members.map((m) => (
                <div key={m.id} className="profile-switcher__row">
                  <button onClick={() => pick(m)}>
                    <MemberAvatar member={m} />
                    {m.name}
                    {m.has_password && <span className="profile-switcher__lock" aria-hidden="true">🔒</span>}
                  </button>
                  <button
                    type="button"
                    className="profile-switcher__key"
                    aria-label={m.has_password ? `Change ${m.name}'s password` : `Set a password for ${m.name}`}
                    onClick={() => setPasswordModalTarget(m)}
                  >
                    🔑
                  </button>
                </div>
              ))}
              <button className="profile-switcher__clear" onClick={clear}>
                Clear
              </button>
            </>
          )}
        </div>
      )}
      {passwordModalTarget && (
        <MemberPasswordModal
          member={passwordModalTarget}
          onClose={() => setPasswordModalTarget(null)}
          onChanged={() => {
            setPasswordModalTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
