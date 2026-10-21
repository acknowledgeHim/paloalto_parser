import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useActing } from '../pages/CamerasPage.js';
import { PhotoInboxSettings } from './PhotoInboxSettings.js';

interface Source {
  photos_dir: string;
  real_path: string;
  network: boolean;
  mount: { source: string; mount_point: string; fstype: string; options: string } | null;
  fstab: string | null;
  credentials_file: string | null;
  saved: Notes | null;
}
interface Notes {
  share: string;
  mount_point: string;
  options: string;
  username: string;
  credentials_file: string;
  notes: string;
  saved_at?: string;
}

const EMPTY: Notes = { share: '', mount_point: '', options: '', username: '', credentials_file: '', notes: '' };
const DEFAULT_OPTS = 'iocharset=utf8,vers=3.0,uid=pi,gid=pi,x-systemd.automount,_netdev,rsize=1048576,wsize=1048576,cache=loose';

/**
 * Settings → 📁 Photo library (parents only): where Photos reads from, and — when it's an SMB
 * share — exactly how it's mounted, saved here so it can be set up again the same way if the Pi
 * or the share ever has to be rebuilt. Never stores a password.
 */
export function PhotoSourceSettings() {
  const acting = useActing();
  const [src, setSrc] = useState<Source | null>(null);
  const [form, setForm] = useState<Notes>(EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .get<Source>(`/photos/source?${acting.q}`)
      .then((s) => {
        setSrc(s);
        setForm(s.saved ?? EMPTY);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting.id]);

  if (!src) return error ? <section className="panel"><h2>📁 Photo library</h2><div className="settings-login__error">{error}</div></section> : null;

  const detected: Notes | null =
    src.mount && src.network
      ? {
          share: src.mount.source,
          mount_point: src.mount.mount_point,
          options: (src.fstab?.split(/\s+/)[3] ?? src.mount.options).replace(/(^|,)(username|user)=[^,]*/g, ''),
          username: src.mount.options.match(/(?:^|,)(?:username|user)=([^,]+)/)?.[1] ?? form.username,
          credentials_file: src.credentials_file ?? '',
          notes: form.notes,
        }
      : null;
  const save = async (n: Notes) => {
    setError(null);
    try {
      const r = await api.put<Notes>('/photos/source', { ...n, acting_member_id: acting.id || null });
      setForm(r);
      setSrc((s) => (s ? { ...s, saved: r } : s));
      setMsg('Saved ✓');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const f = form.share ? form : detected ?? form;
  const cred = f.credentials_file || '/etc/samba-family-photos.cred';
  const mp = f.mount_point || '/mnt/family-photos';
  const opts = (f.options || DEFAULT_OPTS).split(',').filter((o) => o && !/^credentials=/.test(o));
  const steps = f.share
    ? [
        'sudo apt install -y cifs-utils',
        `sudo mkdir -p ${mp}`,
        `sudo nano ${cred}`,
        `#   username=${f.username || '<user>'}\n#   password=<the share password>`,
        `sudo chmod 600 ${cred}`,
        `echo '${f.share} ${mp} cifs credentials=${cred},${opts.join(',')} 0 0' | sudo tee -a /etc/fstab`,
        'sudo systemctl daemon-reload && sudo mount -a',
        `ls ${mp} | head`,
        `# In server/.env:  PHOTOS_DIR=${src.photos_dir.startsWith(mp) ? src.photos_dir : mp}`,
        'sudo systemctl restart familyhomecenter',
      ].join('\n')
    : null;

  return (
    <section className="panel">
      <h2>📁 Photo library</h2>
      <p className="hint">Where 📷 Photos reads pictures from. Only parents see this. The photos themselves are only ever read, never changed.</p>
      <dl className="photo-source__facts">
        <dt>Photos folder (PHOTOS_DIR)</dt>
        <dd>
          <code>{src.photos_dir}</code>
        </dd>
        {src.mount && (
          <>
            <dt>{src.network ? 'Network share (mounted now)' : 'On the disk'}</dt>
            <dd>
              <code>{src.mount.source}</code> at <code>{src.mount.mount_point}</code> ({src.mount.fstype})
            </dd>
          </>
        )}
        {src.fstab && (
          <>
            <dt>/etc/fstab line</dt>
            <dd>
              <code className="photo-source__code">{src.fstab}</code>
            </dd>
          </>
        )}
      </dl>
      {!src.network && !form.share && (
        <p className="hint">The photos aren't on a network share right now. If they normally are (and the share is down), fill in how it was set up below.</p>
      )}
      {detected && (!form.share || form.share !== detected.share || form.options !== detected.options) && (
        <button type="button" onClick={() => save({ ...detected, notes: form.notes })}>
          💾 Save what's set up now
        </button>
      )}

      <h3>How to set it up again</h3>
      <div className="camera-storage__smb">
        <input placeholder="Share — e.g. //192.168.1.20/photos" value={form.share} onChange={(e) => setForm({ ...form, share: e.target.value })} aria-label="Photo share" />
        <input placeholder="Mount point — e.g. /mnt/family-photos" value={form.mount_point} onChange={(e) => setForm({ ...form, mount_point: e.target.value })} aria-label="Mount point" />
        <input placeholder="Username on the share" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} aria-label="Photo share username" autoComplete="off" />
        <input placeholder="Credentials file — e.g. /etc/samba-family-photos.cred" value={form.credentials_file} onChange={(e) => setForm({ ...form, credentials_file: e.target.value })} aria-label="Credentials file" />
      </div>
      <div className="photo-source__more">
      <input placeholder={`Mount options — e.g. ${DEFAULT_OPTS}`} value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} aria-label="Mount options" />
      <textarea
        rows={3}
        placeholder="Notes — e.g. which NAS, where the password is kept (not the password itself), anything special"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        aria-label="Notes"
      />
      </div>
      <div className="task-form__row">
        <button type="button" className="secondary" onClick={() => save(form)}>
          Save
        </button>
        {form.saved_at && <span className="hint">Saved {new Date(form.saved_at).toLocaleString()}</span>}
        {msg && <span className="hint">{msg}</span>}
      </div>
      <p className="hint">The password is never saved here — keep it somewhere safe (a password manager). It goes only in the credentials file on the Pi.</p>
      {error && <div className="settings-login__error">{error}</div>}
      {steps && (
        <>
          <h4>Commands to set it up again (on the Pi)</h4>
          <pre className="photo-source__steps">{steps}</pre>
          <button type="button" className="secondary" onClick={() => navigator.clipboard?.writeText(steps).then(() => setMsg('Copied ✓'))}>
            📋 Copy
          </button>
          <p className="hint">More detail: docs/PHOTOS_SETUP.md.</p>
        </>
      )}
      <PhotoInboxSettings />
    </section>
  );
}
