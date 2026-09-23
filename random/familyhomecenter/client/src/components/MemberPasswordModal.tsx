import { useEffect, useState, type FormEvent } from 'react';
import { api, type FamilyMember } from '../api/client.js';

interface Props {
  member: FamilyMember;
  onClose: () => void;
  /** Called after a successful change — the member's has_password flag may have changed. */
  onChanged: () => void;
}

/**
 * Self-service password set/change/remove — deliberately not admin-gated (see
 * PUT /:id/password on the server): anyone can set a first password for themselves; changing or
 * removing one needs the current password. This is how a parent gets "their own login" and how a
 * kid can optionally add one, without needing another parent's permission first.
 *
 * A verified admin session (logged-in parent, or the legacy recovery login) skips the "current
 * password" prompt entirely — this is how a parent resets a kid's forgotten password, or another
 * parent's, straight from the 🔑 icon (server enforces this too; see PUT /:id/password).
 */
export function MemberPasswordModal({ member, onClose, onChanged }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ is_admin: boolean }>('/auth/status').then((s) => setIsAdmin(s.is_admin)).catch(() => {});
  }, []);

  const needsCurrentPassword = member.has_password && !isAdmin;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.put(`/family-members/${member.id}/password`, {
        current_password: needsCurrentPassword ? currentPassword : undefined,
        new_password: newPassword || null,
      });
      onChanged();
    } catch (err) {
      setError((err as Error).message || 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{member.has_password ? `Change ${member.name}'s password` : `Set a password for ${member.name}`}</h2>
        {member.has_password && isAdmin && (
          <p className="hint">You're logged in as a parent, so you can set a new password (or remove it, leaving it blank) without the current one.</p>
        )}
        {needsCurrentPassword && (
          <input
            autoFocus
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        )}
        <input
          autoFocus={!needsCurrentPassword}
          type="password"
          placeholder={member.has_password ? 'New password (leave blank to remove it)' : 'New password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && <div className="settings-login__error">{error}</div>}
        <div className="task-form__row">
          <button type="submit" disabled={saving}>Save</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
