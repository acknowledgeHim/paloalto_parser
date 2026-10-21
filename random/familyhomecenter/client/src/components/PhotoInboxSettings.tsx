import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useActing } from '../pages/CamerasPage.js';

interface Filing {
  id: string;
  at: string;
  source: 'inbox' | 'upload';
  original_name: string;
  dest_path: string | null;
  taken_at: string | null;
  date_from: 'photo' | 'phone' | 'file' | null;
  result: 'filed' | 'duplicate' | 'error';
  note: string | null;
}
interface Inbox {
  inbox_dir: string;
  exists: boolean;
  auto: boolean;
  writable: boolean;
  waiting: number;
  other: number;
  recent: Filing[];
  totals: Array<{ result: string; n: number }>;
}

const FROM: Record<string, string> = { photo: 'date from the photo', phone: 'date from the phone', file: 'file date (the photo had none)' };

/**
 * Settings → 📁 Photo library → 📥 Inbox: a folder on the share where a phone's sync app drops new
 * photos; every 5 minutes they're moved into <YEAR>/<Month>. Also lists what 📤 Add photos filed.
 */
export function PhotoInboxSettings() {
  const acting = useActing();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [dir, setDir] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api
      .get<Inbox>(`/photos/inbox?${acting.q}`)
      .then((i) => {
        setInbox(i);
        setDir(i.inbox_dir);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting.id]);
  const body = (x: Record<string, unknown>) => ({ ...x, acting_member_id: acting.id || null });
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!inbox) return error ? <div className="settings-login__error">{error}</div> : null;
  const total = (r: string) => inbox.totals.find((t) => t.result === r)?.n ?? 0;

  return (
    <div className="photo-inbox">
      <h3>📥 Inbox — new photos filed by year and month</h3>
      <p className="hint">
        A phone's sync app (PhotoSync, FolderSync, Syncthing…) uploads new photos into this folder on the share. Every 5 minutes they're moved into{' '}
        <code>YEAR/Month</code> by the date they were taken — an existing month folder is used whether it's called “Aug” or “August”; new ones get the full
        name (“August”). A photo that's already there goes to <code>Inbox/Duplicates</code>. Nothing is ever deleted. 📤 Add photos on the Photos page files
        the same way.
      </p>
      {!inbox.writable && (
        <div className="settings-login__error">
          The Family Home Center can't write to the photos folder. Check the share account can write, and that the mount isn't read-only (see the commands
          above).
        </div>
      )}
      <label className="camera-storage__inline">
        Inbox folder
        <input value={dir} onChange={(e) => setDir(e.target.value)} style={{ flex: 1, minWidth: '16em' }} aria-label="Inbox folder" />
        {dir !== inbox.inbox_dir && (
          <button type="button" className="secondary" disabled={busy} onClick={() => run(async () => void (await api.patch('/photos/inbox', body({ inbox_dir: dir }))))}>
            Save
          </button>
        )}
      </label>
      <p className="hint">
        {inbox.exists ? `${inbox.waiting} photo${inbox.waiting === 1 ? '' : 's'} waiting` : 'The Inbox folder will be made the first time you sort'}
        {inbox.other ? ` · ${inbox.other} other file${inbox.other === 1 ? '' : 's'} (videos etc.) left as they are` : ''} · so far {total('filed')} filed,{' '}
        {total('duplicate')} duplicates{total('error') ? `, ${total('error')} problems` : ''}
      </p>
      <label className="privacy-toggle">
        <input type="checkbox" checked={inbox.auto} onChange={(e) => run(async () => void (await api.patch('/photos/inbox', body({ auto: e.target.checked }))))} />
        <span>
          <strong>Sort the Inbox automatically</strong>
          <span className="hint"> — every 5 minutes (a photo still being copied in waits for the next round)</span>
        </span>
      </label>
      <div className="task-form__row">
        <button
          type="button"
          className="secondary"
          disabled={busy || !inbox.writable}
          onClick={() =>
            run(async () => {
              const r = await api.post<{ filed: number; duplicates: number; errors: number; left: number }>('/photos/inbox/sort-now', body({}));
              return `${r.filed} filed · ${r.duplicates} duplicate${r.duplicates === 1 ? '' : 's'}${r.errors ? ` · ${r.errors} problems` : ''}${r.left ? ` · ${r.left} left (still copying, or not a photo)` : ''}`;
            })
          }
        >
          {busy ? 'Sorting…' : '📥 Sort the Inbox now'}
        </button>
        {msg && <span className="hint">{msg}</span>}
      </div>
      {error && <div className="settings-login__error">{error}</div>}
      {inbox.recent.length > 0 && (
        <details className="photo-inbox__log">
          <summary>Recently filed ({inbox.recent.length})</summary>
          <ul>
            {inbox.recent.map((f) => (
              <li key={f.id}>
                <span className="hint">{new Date(f.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>{' '}
                {f.source === 'upload' ? '📤' : '📥'} {f.original_name} →{' '}
                {f.result === 'filed' ? (
                  <code>{f.dest_path}</code>
                ) : f.result === 'duplicate' ? (
                  <>already there (<code>{f.dest_path}</code>)</>
                ) : (
                  <span className="internet-page__bad">⚠️ {f.note}</span>
                )}
                {f.date_from && f.result !== 'error' && <span className="hint"> · {FROM[f.date_from]}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
