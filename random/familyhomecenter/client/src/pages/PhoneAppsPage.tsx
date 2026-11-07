import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

/**
 * 📲 Phone apps — install the family's own phone apps (📱 SMB Sync, random/smbsync_app) from the Pi.
 * Android installs straight from here; an iPhone needs the .ipa signed with an Apple ID from a
 * computer (Sideloadly / AltStore) — Apple doesn't allow installing from a web page without a paid
 * developer account. A parent fills the Pi from the app's GitHub build or uploads a file.
 * See docs/PHONE_APPS.md.
 */
interface Stored {
  file: string;
  size: number;
  savedAt: string;
  source: 'github' | 'upload';
}

interface PhoneApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  releaseUrl: string;
  android: Stored | null;
  ios: Stored | null;
}

const isAndroid = /Android/i.test(navigator.userAgent);
const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function mb(n: number) {
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function PhoneAppsPage() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [apps, setApps] = useState<PhoneApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .get<{ apps: PhoneApp[] }>('/apps')
      .then((r) => setApps(r.apps))
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="phone-apps-page">
      <h1>📲 Phone apps</h1>
      <p className="hint">
        Open this page on the phone (on the home Wi-Fi): <code>{location.origin}/#/apps</code>
      </p>
      {error && <div className="settings-login__error">{error}</div>}
      {!apps && !error && <p>Loading…</p>}
      {apps?.map((a) => <AppCard key={a.id} app={a} isParent={isParent} onChanged={load} />)}
    </div>
  );
}

function AppCard({ app, isParent, onChanged }: { app: PhoneApp; isParent: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const androidFile = useRef<HTMLInputElement>(null);
  const iosFile = useRef<HTMLInputElement>(null);

  const fetchLatest = async () => {
    setBusy('Getting the latest build from GitHub…');
    setMsg(null);
    try {
      const r = await api.post<{ results: { android: string; ios: string } }>(`/apps/${app.id}/fetch`);
      setMsg(`Android: ${r.results.android} · iPhone: ${r.results.ios}`);
      onChanged();
    } catch (e) {
      const m = (e as Error).message;
      setMsg(m === 'Parent login required' ? 'A parent needs to log in first (⚙️ Settings).' : m);
    } finally {
      setBusy(null);
    }
  };

  const upload = async (platform: 'android' | 'ios', file: File | undefined) => {
    if (!file) return;
    setBusy(`Uploading ${file.name}…`);
    setMsg(null);
    try {
      const resp = await fetch(`/api/apps/${app.id}/${platform}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || `Upload failed: ${resp.status}`);
      setMsg(`${file.name} is on the Pi now.`);
      onChanged();
    } catch (e) {
      const m = (e as Error).message;
      setMsg(m === 'Parent login required' ? 'A parent needs to log in first (⚙️ Settings).' : m);
    } finally {
      setBusy(null);
      if (androidFile.current) androidFile.current.value = '';
      if (iosFile.current) iosFile.current.value = '';
    }
  };

  const nothing = !app.android && !app.ios;

  return (
    <section className="panel phone-apps-page__app">
      <h2>
        {app.icon} {app.name}
      </h2>
      <p>{app.description}</p>

      {nothing && (
        <p className="hint">
          Nothing on the Pi yet. {isParent ? 'Use “Get the latest build” below.' : 'Ask a parent to put it here.'}
        </p>
      )}

      <div className="phone-apps-page__platforms">
        <div className={`phone-apps-page__platform${isAndroid ? ' is-this-phone' : ''}`}>
          <h3>🤖 Android</h3>
          {app.android ? (
            <>
              <a className="phone-apps-page__get" href={`/api/apps/${app.id}/android/download`} download>
                ⬇️ Install on Android
              </a>
              <p className="hint">
                {mb(app.android.size)} · {when(app.android.savedAt)}
              </p>
              <ol className="phone-apps-page__steps">
                <li>Tap the button on the phone, then open the download.</li>
                <li>If asked, allow your browser to “install unknown apps”, go back, and tap Install.</li>
                <li>
                  Updating: same button. If Android says it “conflicts with an existing package”, uninstall the old
                  one first (docs/PHONE_APPS.md → Updates).
                </li>
              </ol>
            </>
          ) : (
            <p className="hint">Not on the Pi yet.</p>
          )}
        </div>

        <div className={`phone-apps-page__platform${isIos ? ' is-this-phone' : ''}`}>
          <h3>🍎 iPhone</h3>
          {app.ios ? (
            <>
              <a className="phone-apps-page__get" href={`/api/apps/${app.id}/ios/download`} download>
                ⬇️ Download for iPhone (.ipa)
              </a>
              <p className="hint">
                {mb(app.ios.size)} · {when(app.ios.savedAt)}
              </p>
              <ol className="phone-apps-page__steps">
                <li>
                  Apple doesn't let an iPhone install apps from a web page, so download this on a <strong>Windows PC or
                  Mac</strong>, not the phone.
                </li>
                <li>
                  Install <strong>Sideloadly</strong> (sideloadly.io) on that computer, plug the iPhone in, drag the .ipa
                  in, sign in with your Apple ID, Start.
                </li>
                <li>
                  On the iPhone: Settings → General → VPN &amp; Device Management → trust your Apple ID; and Settings →
                  Privacy &amp; Security → Developer Mode on.
                </li>
                <li>With a free Apple ID, do it again every 7 days (Sideloadly can refresh it automatically).</li>
              </ol>
            </>
          ) : (
            <p className="hint">Not on the Pi yet.</p>
          )}
        </div>
      </div>

      {isParent && (
        <div className="phone-apps-page__admin">
          <h3>For parents</h3>
          <div className="phone-apps-page__buttons">
            <button type="button" onClick={fetchLatest} disabled={!!busy}>
              🔄 Get the latest build from GitHub
            </button>
            <button type="button" className="secondary" onClick={() => androidFile.current?.click()} disabled={!!busy}>
              ⬆️ Upload .apk
            </button>
            <button type="button" className="secondary" onClick={() => iosFile.current?.click()} disabled={!!busy}>
              ⬆️ Upload .ipa
            </button>
          </div>
          <input
            ref={androidFile}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            hidden
            onChange={(e) => upload('android', e.target.files?.[0])}
          />
          <input ref={iosFile} type="file" accept=".ipa" hidden onChange={(e) => upload('ios', e.target.files?.[0])} />
          {busy && <p>{busy}</p>}
          {msg && <p className="hint">{msg}</p>}
          <p className="hint">
            Builds come from{' '}
            <a href={app.releaseUrl} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{' '}
            (made automatically whenever the app's code changes). Older copies stay in{' '}
            <code>server/data/apps/{app.id}/</code>.
          </p>
        </div>
      )}
    </section>
  );
}
