import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';

/**
 * 🔑 Passwords — each person's own vault in Vaultwarden (scripts/setup-vaultwarden.sh,
 * docs/PASSWORDS_SETUP.md). This page asks for your Family Home Center password again every time,
 * then opens your vault, which asks for your own master password. The vault is encrypted with that
 * master password on your device, so nobody else — parents included — can open it, and this app
 * never sees what's in it.
 */
const UNLOCK_MS = 2 * 60_000;

export function PasswordsPage() {
  const { activeProfile } = useFamilyMembers();
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [vaultUrl, setVaultUrl] = useState<string>(`https://${location.hostname}:8443`);
  /** Is Vaultwarden answering on the Pi? null = still checking. */
  const [running, setRunning] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get<{ url: string | null; running: boolean }>('/passwords/info')
      .then((r) => {
        if (r.url) setVaultUrl(r.url);
        setRunning(r.running);
      })
      .catch(() => setRunning(null));
  }, []);

  // A different person picked up top, or a couple of minutes gone by: ask again.
  useEffect(() => {
    setUnlocked(false);
    setPassword('');
    setError(null);
  }, [activeProfile?.id]);
  useEffect(() => {
    if (!unlocked) return;
    const t = setTimeout(() => setUnlocked(false), UNLOCK_MS);
    return () => clearTimeout(t);
  }, [unlocked]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    setChecking(true);
    setError(null);
    try {
      await api.post('/auth/verify', { family_member_id: activeProfile.id, password });
      setUnlocked(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPassword('');
      setChecking(false);
    }
  };

  if (!activeProfile) {
    return (
      <div className="passwords-page">
        <h1>🔑 Passwords</h1>
        <p className="empty-state">Pick who you are up top first — everyone has their own.</p>
      </div>
    );
  }

  if (!activeProfile.has_password) {
    return (
      <div className="passwords-page">
        <h1>🔑 Passwords</h1>
        <section className="panel">
          <p>
            {activeProfile.name}, set a Family Home Center password first, so nobody else can get to your
            passwords from here. A parent can do it in <Link to="/settings">Settings</Link> → your profile.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="passwords-page">
      <h1>🔑 Passwords</h1>
      {!unlocked ? (
        <section className="panel passwords-page__lock">
          <MemberAvatar member={activeProfile} size={56} />
          <h2>Hi {activeProfile.name} — type your password again</h2>
          <form onSubmit={submit} className="passwords-page__form">
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Your Family Home Center password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" disabled={checking || !password}>
              {checking ? 'Checking…' : 'Unlock'}
            </button>
          </form>
          {error && <div className="settings-login__error">{error === 'no_password' ? 'Set a password in Settings first.' : error}</div>}
          <p className="hint">Only you can see your passwords — not even a parent can open someone else's.</p>
        </section>
      ) : (
        <>
          {running === false && (
            <section className="panel passwords-page__missing">
              <h2>The password vault isn't running on the Pi yet</h2>
              <p>A parent sets it up once, on the Pi:</p>
              <pre className="device-cert__cmd">cd ~/paloalto_parser/random/familyhomecenter{'\n'}git pull{'\n'}sudo ./scripts/setup-vaultwarden.sh</pre>
              <p className="hint">
                It ends with “Done: https://…:8443”. If it was set up before, check it's running:{' '}
                <code>sudo docker ps</code> (should list vaultwarden) — and <code>sudo docker logs vaultwarden</code>. Steps:
                docs/PASSWORDS_SETUP.md.
              </p>
            </section>
          )}
          <section className="panel passwords-page__open">
            <a className="passwords-page__go" href={vaultUrl} target="_blank" rel="noopener noreferrer">
              🔑 Open {activeProfile.name}'s passwords
            </a>
            <p className="hint">
              Opens your vault in a new tab. It asks for your <strong>master password</strong> — the one only you
              know. This page locks itself again in 2 minutes.
            </p>
            <p className="hint">
              Page won't open? Check it's <code>{vaultUrl}</code> (https, port 8443 — the setup script prints it). A
              certificate warning means this device needs the Pi's certificate (Settings → 🔒 This device's certificate);
              “can't be reached” means Caddy isn't serving that address — see docs/PASSWORDS_SETUP.md → Troubleshooting.
            </p>
            <button type="button" className="link-button" onClick={() => setUnlocked(false)}>
              🔒 Lock now
            </button>
          </section>
          <section className="panel">
            <h2>First time?</h2>
            <ol className="passwords-page__steps">
              <li>
                Open your passwords → <strong>Create account</strong>. Any email-looking name works (e.g.{' '}
                <code>{activeProfile.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@home.family</code>) — nothing is
                emailed.
              </li>
              <li>
                Pick a <strong>master password</strong> you'll remember — a short sentence is great. Write it down
                somewhere safe: if it's forgotten, nobody can get that vault back, not even a parent.
              </li>
              <li>
                In the vault's <strong>Settings</strong>, set <strong>Vault timeout</strong> to <strong>“On refresh”</strong> (or 1
                minute), so it locks again when you leave.
              </li>
              <li>
                On your phone or computer: install <strong>Bitwarden</strong> (app or browser extension). At the login
                screen choose <strong>Self-hosted</strong> and enter <code>{vaultUrl}</code> — then it fills in your
                passwords for you.
              </li>
            </ol>
            <p className="hint">
              It's the Pi's https address, so the device needs the Pi's certificate first — Settings → 🔒 This
              device's certificate.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
