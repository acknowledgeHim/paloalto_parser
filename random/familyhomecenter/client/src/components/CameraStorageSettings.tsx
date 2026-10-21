import { useEffect, useState } from 'react';
import { api, type CameraStorage } from '../api/client.js';
import { useActing } from '../pages/CamerasPage.js';

const gb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(0, Math.round(n / 1e6))} MB`);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

interface Part {
  part: number;
  first: string;
  last: string;
  bytes: number;
  clip_count: number;
}

/**
 * Settings → 📹 Cameras → 💾 Storage: how full the Pi is (with a warning below the minimum free),
 * compressing clips after a day, backing up to an SMB share, downloading older clips as zips, and
 * removing them — only when a parent says so. Nothing is ever removed by itself.
 */
export function CameraStorageSettings() {
  const acting = useActing();
  const [st, setSt] = useState<CameraStorage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [smb, setSmb] = useState({ share: '', folder: '', user: '', domain: '', pass: '' });
  const [days, setDays] = useState(30);
  const [onlySaved, setOnlySaved] = useState(true);
  const [parts, setParts] = useState<Part[] | null>(null);
  const body = (x: Record<string, unknown> = {}) => ({ ...x, acting_member_id: acting.id || null });

  const load = () =>
    api
      .get<CameraStorage>(`/cameras/storage?${acting.q}`)
      .then((s) => {
        setSt(s);
        setSmb((x) => ({ ...x, share: s.smb.share, folder: s.smb.folder, user: s.smb.user, domain: s.smb.domain }));
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting.id]);
  useEffect(() => setParts(null), [days]);

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setError(null);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const patch = (x: Record<string, unknown>) => api.patch('/cameras/storage', body(x));
  const saveSmb = () =>
    run('save', async () => {
      await patch({ smb_share: smb.share, smb_folder: smb.folder, smb_user: smb.user, smb_domain: smb.domain, smb_pass: smb.pass });
      setSmb((x) => ({ ...x, pass: '' }));
      return 'Saved ✓';
    });
  const test = () =>
    run('test', async () => {
      await patch({ smb_share: smb.share, smb_folder: smb.folder, smb_user: smb.user, smb_domain: smb.domain, smb_pass: smb.pass });
      setSmb((x) => ({ ...x, pass: '' }));
      return (await api.post<{ message: string }>('/cameras/storage/test-smb', body())).message;
    });
  const backupNow = () => run('backup', async () => (await api.post<{ message: string }>('/cameras/storage/backup-now', body())).message);
  const findParts = () => run('parts', async () => setParts(await api.get<Part[]>(`/cameras/storage/download-parts?days=${days}&${acting.q}`)));
  const remove = () =>
    run('remove', async () => {
      const dry = await api.post<{ clips: number; bytes: number; skipped: number }>('/cameras/storage/remove', body({ days, only_saved: onlySaved, dry_run: true }));
      if (!dry.clips) {
        return dry.skipped
          ? `Nothing to remove: ${dry.skipped} clip${dry.skipped === 1 ? '' : 's'} older than ${days} days ${dry.skipped === 1 ? "hasn't" : "haven't"} been backed up or downloaded yet.`
          : `No clips older than ${days} days.`;
      }
      const ok = window.confirm(
        `Remove ${dry.clips} clip${dry.clips === 1 ? '' : 's'} older than ${days} days from the Pi (${gb(dry.bytes)})?` +
          (onlySaved ? '\n\nThey have all been backed up to the share or downloaded.' : '\n\n⚠️ Some may NOT be backed up or downloaded — they will be gone for good.') +
          (dry.skipped ? `\n\n${dry.skipped} not yet backed up/downloaded will be kept.` : '') +
          '\n\nCopies on the backup share are never touched.'
      );
      if (!ok) return 'Nothing removed.';
      const r = await api.post<{ clips: number; bytes: number }>('/cameras/storage/remove', body({ days, only_saved: onlySaved }));
      return `Removed ${r.clips} clip${r.clips === 1 ? '' : 's'} — ${gb(r.bytes)} freed ✓`;
    });

  if (!st) return error ? <div className="settings-login__error">{error}</div> : null;
  const usedPct = st.total_bytes ? Math.round(((st.total_bytes - st.free_bytes) / st.total_bytes) * 100) : 0;
  const veryLow = st.free_bytes < 1e9;

  return (
    <div className="camera-storage">
      <h3>💾 Storage</h3>
      {st.low && (
        <div className="camera-storage__warn" role="alert">
          <strong>⚠️ The Pi is getting full — {gb(st.free_bytes)} free</strong> (the warning shows under {st.min_free_gb} GB). Camera clips use{' '}
          {gb(st.clips.bytes)}. Back them up or download the older ones below, then remove them. Nothing is removed unless you do it.
          {veryLow && <div>New movement isn't being saved until there's at least 1 GB free.</div>}
        </div>
      )}
      <div className="camera-storage__meter" aria-label={`${usedPct}% used`}>
        <div style={{ width: `${usedPct}%` }} className={st.low ? 'camera-storage__meter-fill--low' : ''} />
      </div>
      <p className="hint">
        {gb(st.free_bytes)} free of {gb(st.total_bytes)} · camera clips: {st.clips.count} ({gb(st.clips.bytes)}) · 🎬 {st.clips.compressed} compressed ·{' '}
        ☁️ {st.clips.backed_up} backed up · ⬇️ {st.downloaded} downloaded
        {st.oldest_at ? ` · oldest ${day(st.oldest_at)}` : ''}
      </p>
      <label className="camera-storage__inline">
        Warn me when less than
        <input
          type="number"
          min={1}
          step={1}
          defaultValue={st.min_free_gb}
          style={{ width: '6em' }}
          onBlur={(e) => Number(e.target.value) !== st.min_free_gb && run('min', async () => void (await patch({ min_free_gb: Number(e.target.value) })))}
          aria-label="Minimum free GB"
        />
        GB is free
      </label>
      <label className="privacy-toggle">
        <input type="checkbox" checked={st.compress} onChange={(e) => run('compress', async () => void (await patch({ compress: e.target.checked })))} />
        <span>
          <strong>Compress clips older than a day</strong>
          <span className="hint"> — the pictures become one small video (usually 80–95% smaller), still playable here. Every 10 minutes.</span>
        </span>
      </label>
      {st.clips.failed > 0 && (
        <div className="settings-login__error">
          {st.clips.failed} clip{st.clips.failed === 1 ? '' : 's'} couldn't be compressed ({st.clips.last_error}). Is ffmpeg installed on the Pi? (sudo apt install ffmpeg)
        </div>
      )}

      <h4>☁️ Back up to a network share (SMB)</h4>
      {!st.smb.smbclient && <div className="settings-login__error">The Pi needs smbclient first: sudo apt install smbclient</div>}
      <div className="camera-storage__smb">
        <input placeholder="Share — e.g. //192.168.1.20/backups" value={smb.share} onChange={(e) => setSmb({ ...smb, share: e.target.value })} aria-label="Share" />
        <input placeholder="Folder on the share (optional) — e.g. family/cameras" value={smb.folder} onChange={(e) => setSmb({ ...smb, folder: e.target.value })} aria-label="Folder" />
        <input placeholder="Username" value={smb.user} onChange={(e) => setSmb({ ...smb, user: e.target.value })} aria-label="Username" autoComplete="off" />
        <input
          type="password"
          placeholder={st.smb.has_password ? '•••••• saved (type to change)' : 'Password'}
          value={smb.pass}
          onChange={(e) => setSmb({ ...smb, pass: e.target.value })}
          aria-label="Password"
          autoComplete="new-password"
        />
        <input placeholder="Domain / workgroup (usually blank)" value={smb.domain} onChange={(e) => setSmb({ ...smb, domain: e.target.value })} aria-label="Domain" />
      </div>
      <div className="task-form__row">
        <button type="button" onClick={saveSmb} disabled={!!busy}>
          Save
        </button>
        <button type="button" className="secondary" onClick={test} disabled={!!busy || !smb.share}>
          {busy === 'test' ? 'Testing…' : '🔌 Test'}
        </button>
        <button type="button" className="secondary" onClick={backupNow} disabled={!!busy || !st.smb.share}>
          {busy === 'backup' ? 'Backing up…' : `☁️ Back up now${st.clips.to_back_up ? ` (${st.clips.to_back_up})` : ''}`}
        </button>
      </div>
      <label className="privacy-toggle">
        <input type="checkbox" checked={st.smb.auto} disabled={!st.smb.share} onChange={(e) => run('auto', async () => void (await patch({ smb_auto: e.target.checked })))} />
        <span>
          <strong>Back up automatically</strong>
          <span className="hint"> — every hour, each compressed clip (over a day old) not yet on the share. Copies on the share are never removed from here.</span>
        </span>
      </label>
      {st.smb.status && (
        <p className="hint">
          Last backup {when(st.smb.status.at)}: {st.smb.status.sent} sent
          {st.smb.status.failed ? `, ${st.smb.status.failed} failed` : ''}
          {st.smb.status.error ? ` — ⚠️ ${st.smb.status.error}` : ' ✓'}
        </p>
      )}

      <h4>🧹 Free up space</h4>
      <label className="camera-storage__inline">
        Clips older than
        <input type="number" min={0} value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))} style={{ width: '6em' }} aria-label="Days" />
        days
      </label>
      <div className="task-form__row">
        <button type="button" className="secondary" onClick={findParts} disabled={!!busy}>
          ⬇️ Download as zip…
        </button>
        <button type="button" className="secondary" onClick={remove} disabled={!!busy || st.on_network_share}>
          {busy === 'remove' ? 'Removing…' : '🗑️ Remove from the Pi…'}
        </button>
      </div>
      {parts && (
        <div className="camera-storage__parts">
          {parts.length === 0 && <span className="hint">No clips older than {days} days.</span>}
          {parts.map((p) => (
            <a key={p.part} className="secondary" href={`/api/cameras/storage/download.zip?days=${days}&part=${p.part}&${acting.q}`} download onClick={() => setTimeout(load, 5000)}>
              ⬇️ {parts.length > 1 ? `Part ${p.part}: ` : ''}
              {day(p.first)} – {day(p.last)} · {p.clip_count} clips · {gb(p.bytes)}
            </a>
          ))}
          {parts.length > 1 && <span className="hint">Split so each zip is under 3.5 GB (opens anywhere).</span>}
        </div>
      )}
      <label className="privacy-toggle">
        <input type="checkbox" checked={onlySaved} onChange={(e) => setOnlySaved(e.target.checked)} />
        <span>
          <strong>Only remove clips already backed up or downloaded</strong>
          <span className="hint"> (recommended)</span>
        </span>
      </label>
      {st.on_network_share && <p className="hint">The clips are on a network share, so they're never removed from here.</p>}
      {msg && <div className="hint camera-storage__msg">{msg}</div>}
      {error && <div className="settings-login__error">{error}</div>}

      {st.purges.length > 0 && (
        <>
          <h4>📜 Removed so far</h4>
          <ul className="camera-storage__log">
            {st.purges.map((p) => (
              <li key={p.id}>
                <strong>{when(p.at)}</strong> — {p.clips} clip{p.clips === 1 ? '' : 's'}
                {p.cameras ? ` (${p.cameras}` : ' ('}
                {p.first_at ? `; ${day(p.first_at)}${p.last_at && day(p.last_at) !== day(p.first_at) ? ` – ${day(p.last_at)}` : ''}` : ''}), {gb(p.bytes)} · {p.note}
                {p.backed_up < p.clips ? ` · ${p.clips - p.backed_up} had not been backed up/downloaded` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
