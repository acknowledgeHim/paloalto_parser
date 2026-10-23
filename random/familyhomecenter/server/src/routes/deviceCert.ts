import { Router } from 'express';
import fs from 'node:fs';
import { X509Certificate } from 'node:crypto';

// Settings → This device's certificate: hands out Caddy's local root certificate (the one behind
// https://<pi-ip> — see docs/ANDROID_TABLET_SETUP.md) so a phone, tablet or computer can trust it
// once and stop warning. It's the public certificate only — no private key — so it's open to
// everyone, which also means a device can fetch it before anyone's logged in on it.
//
// Where it comes from, first that works: CADDY_ROOT_CERT (a file path) → Caddy's admin API on the
// Pi (localhost:2019, on by default) → Caddy's usual file (often not readable by the app's user).
export const deviceCertRouter = Router();

const CADDY_FILE = '/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt';
let cached: { at: number; cert: X509Certificate | null } | null = null;

async function rootCert(): Promise<X509Certificate | null> {
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.cert;
  let pem: string | null = null;
  const fromEnv = process.env.CADDY_ROOT_CERT;
  if (fromEnv) pem = readFile(fromEnv);
  if (!pem) {
    try {
      const resp = await fetch('http://127.0.0.1:2019/pki/ca/local', { signal: AbortSignal.timeout(3000) });
      if (resp.ok) pem = ((await resp.json()) as { root_certificate?: string }).root_certificate ?? null;
    } catch {
      // Caddy not installed / admin API off — try the file next.
    }
  }
  if (!pem) pem = readFile(CADDY_FILE);
  let cert: X509Certificate | null = null;
  try {
    if (pem) cert = new X509Certificate(pem);
  } catch {
    cert = null;
  }
  cached = { at: Date.now(), cert };
  return cert;
}

function readFile(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** A stable UUID from the certificate, so installing the profile again replaces the old one. */
function uuidFrom(hex: string): string {
  const h = hex.replace(/:/g, '').toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`.toUpperCase();
}

/** GET /info — is there a certificate to hand out, and what to check it against. */
deviceCertRouter.get('/info', async (_req, res) => {
  const cert = await rootCert();
  if (!cert) return res.json({ available: false });
  res.json({
    available: true,
    name: cert.subject.replace(/^CN=/m, '').split('\n')[0],
    fingerprint: cert.fingerprint256,
    expires: new Date(cert.validTo).toISOString(),
  });
});

/** GET /root.crt — the certificate itself (DER), for Android, Windows, Mac, Chromebooks. */
deviceCertRouter.get('/root.crt', async (_req, res) => {
  const cert = await rootCert();
  if (!cert) return res.status(404).json({ error: "Caddy's certificate wasn't found on the Pi" });
  res.setHeader('Content-Type', 'application/x-x509-ca-cert');
  res.setHeader('Content-Disposition', 'attachment; filename="FamilyHomeCenter.crt"');
  res.send(cert.raw);
});

/** GET /familyhomecenter.mobileconfig — the same certificate wrapped as an iPhone/iPad profile. */
deviceCertRouter.get('/familyhomecenter.mobileconfig', async (_req, res) => {
  const cert = await rootCert();
  if (!cert) return res.status(404).json({ error: "Caddy's certificate wasn't found on the Pi" });
  const fp = cert.fingerprint256;
  const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadCertificateFileName</key><string>FamilyHomeCenter.crt</string>
      <key>PayloadContent</key><data>${cert.raw.toString('base64')}</data>
      <key>PayloadDescription</key><string>Lets this device open the Family Home Center over https without a warning.</string>
      <key>PayloadDisplayName</key><string>Family Home Center</string>
      <key>PayloadIdentifier</key><string>familyhomecenter.rootca.cert</string>
      <key>PayloadType</key><string>com.apple.security.root</string>
      <key>PayloadUUID</key><string>${uuidFrom(fp.slice(48))}</string>
      <key>PayloadVersion</key><integer>1</integer>
    </dict>
  </array>
  <key>PayloadDisplayName</key><string>Family Home Center certificate</string>
  <key>PayloadIdentifier</key><string>familyhomecenter.rootca</string>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>${uuidFrom(fp)}</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
`;
  res.setHeader('Content-Type', 'application/x-apple-aspen-config');
  res.setHeader('Content-Disposition', 'attachment; filename="FamilyHomeCenter.mobileconfig"');
  res.send(profile);
});
