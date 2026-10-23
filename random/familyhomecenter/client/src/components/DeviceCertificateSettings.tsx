import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Settings → This device's certificate: one button that downloads Caddy's root certificate in the
 * right form for the device you're holding, plus the few taps that device needs to trust it. A web
 * page can't install a certificate by itself — every OS insists the person confirms — so this gets
 * it as close to one tap as each one allows. After that, https://<pi> opens with no warning.
 */
interface CertInfo {
  available: boolean;
  name?: string;
  fingerprint?: string;
  expires?: string;
  problems?: string[];
  copy_path?: string;
}

type Platform = 'ios' | 'android' | 'windows' | 'mac' | 'chromeos' | 'linux';

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'ios', label: 'iPhone / iPad' },
  { key: 'android', label: 'Android' },
  { key: 'windows', label: 'Windows' },
  { key: 'mac', label: 'Mac' },
  { key: 'chromeos', label: 'Chromebook' },
  { key: 'linux', label: 'Linux' },
];

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh/.test(ua)) return 'mac';
  return 'linux';
}

const STEPS: Record<Platform, string[]> = {
  ios: [
    'Use Safari (other browsers on iPhone can’t install it). Tap the button, then Allow.',
    'Open the Settings app → “Profile Downloaded” near the top → Install → enter your passcode → Install.',
    'Settings → General → About → Certificate Trust Settings → turn on “Caddy Local Authority”.',
  ],
  android: [
    'Tap the button — it saves FamilyHomeCenter.crt to Downloads.',
    'Settings → Security (or Security & privacy) → More security settings → Encryption & credentials → Install a certificate → CA certificate → Install anyway.',
    'Pick FamilyHomeCenter.crt from Downloads. (Tip: search Settings for “CA certificate”.)',
  ],
  windows: [
    'Click the button and open the downloaded FamilyHomeCenter.crt.',
    'Install Certificate → Current User → “Place all certificates in the following store” → Browse → Trusted Root Certification Authorities → Next → Finish → Yes.',
    'Close and reopen the browser. (Firefox: if it still warns, Settings → search “certificates” → View Certificates → Authorities → Import.)',
  ],
  mac: [
    'Click the button and open the downloaded FamilyHomeCenter.crt — Keychain Access adds it.',
    'In Keychain Access, double-click the “Caddy Local Authority” certificate → Trust → When using this certificate: Always Trust. Close the window and enter your password.',
    'Reopen the browser.',
  ],
  chromeos: [
    'Click the button — it saves FamilyHomeCenter.crt to Downloads.',
    'Settings → Privacy and security → Security → Manage certificates → Authorities → Import → pick the file.',
    'Tick “Trust this certificate for identifying websites” → OK.',
  ],
  linux: [
    'Click the button to save FamilyHomeCenter.crt.',
    'Chrome: Settings → Privacy and security → Security → Manage certificates → Authorities → Import, tick “identifying websites”. Firefox: Settings → search “certificates” → View Certificates → Authorities → Import.',
    'System-wide (Debian/Ubuntu): sudo cp FamilyHomeCenter.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates',
  ],
};

export function DeviceCertificateSettings() {
  const [info, setInfo] = useState<CertInfo | null>(null);
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const detected = detectPlatform();

  useEffect(() => {
    api.get<CertInfo>('/device-cert/info').then(setInfo).catch(() => setInfo({ available: false }));
  }, []);

  const href = platform === 'ios' ? '/api/device-cert/familyhomecenter.mobileconfig' : '/api/device-cert/root.crt';
  const httpsUrl = `https://${location.hostname}`;

  return (
    <section className="panel device-cert">
      <h2>🔒 This device's certificate</h2>
      <p className="hint">
        The camera, microphone and home-screen app need the https address ({httpsUrl}). It uses the
        Pi's own certificate, so each device warns until it's told to trust it — once. Do this on
        each phone, tablet or computer.
      </p>
      {info === null && <p className="hint">Checking…</p>}
      {info && !info.available && (
        <div className="device-cert__missing">
          <p className="empty-state">The app can't get the Pi's certificate yet.</p>
          {info.problems && info.problems.length > 0 && (
            <ul className="hint">
              {info.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <p className="hint">
            Caddy keeps it in a folder only Caddy can read, so copy it where the app can (run on the
            Pi), then reload this page — no restart needed:
          </p>
          <pre className="device-cert__cmd">
            sudo install -m 644 /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt {info.copy_path ?? 'server/data/caddy-root.crt'}
          </pre>
          <p className="hint">
            If that says the file isn't there, Caddy isn't set up yet — see docs/ANDROID_TABLET_SETUP.md,
            step 2. You can remove CADDY_ROOT_CERT from .env; the copy is found by itself.
          </p>
        </div>
      )}
      {info?.available && (
        <>
          <div className="device-cert__platforms" role="group" aria-label="Which device">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={platform === p.key ? '' : 'secondary'}
                onClick={() => setPlatform(p.key)}
              >
                {p.label}
                {p.key === detected ? ' (this one)' : ''}
              </button>
            ))}
          </div>
          <a className="device-cert__get" href={href} download={platform === 'ios' ? undefined : 'FamilyHomeCenter.crt'}>
            📥 Get the certificate for {PLATFORMS.find((p) => p.key === platform)?.label}
          </a>
          <ol className="device-cert__steps">
            {STEPS[platform].map((s) => (
              <li key={s}>{s}</li>
            ))}
            <li>
              Then open <a href={httpsUrl}>{httpsUrl}</a> — no warning means it worked.
            </li>
          </ol>
          <details className="device-cert__check">
            <summary>Check it's the right certificate</summary>
            <p className="hint">
              Name: {info.name}
              <br />
              Good until: {info.expires ? new Date(info.expires).toLocaleDateString() : '—'}
              <br />
              SHA-256: <code>{info.fingerprint}</code>
            </p>
            <p className="hint">
              It's only the public half — safe to hand out. It makes this device trust sites the
              Pi's Caddy vouches for; remove it any time from the same settings screen.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
