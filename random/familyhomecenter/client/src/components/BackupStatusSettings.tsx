import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { SystemBackupControls } from './BackupJobs.js';

interface RunStatus {
  result: string;
  message: string;
  finished_at: string | null;
  backup_drive_used_pct?: number | null;
}
interface BackupStatus {
  status_dir: string;
  configured: boolean;
  nightly: RunStatus | null;
  check: RunStatus | null;
  app_backup: { name: string; at: string } | null;
  share: { dir: string; size_bytes: number; free_bytes: number } | null;
}

const HOUR = 3600_000;
const TB = 1e12;
const size = (b: number) => (b >= TB ? `${(b / TB).toFixed(1)} TB` : `${Math.round(b / 1e9)} GB`);

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const h = Math.round(ms / HOUR);
  const when = new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `${when} (${h < 1 ? 'just now' : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`})`;
}

/** ok / warning / failed, and "too old" when a run hasn't happened when it should have. */
function badge(s: RunStatus | null, maxAgeH: number): { icon: string; cls: string; note?: string } {
  if (!s) return { icon: '⚪', cls: '' };
  const age = s.finished_at ? (Date.now() - Date.parse(s.finished_at)) / HOUR : Infinity;
  if (s.result === 'failed') return { icon: '❌', cls: 'is-bad' };
  if (age > maxAgeH) return { icon: '⚠️', cls: 'is-warn', note: `Hasn't run for over ${Math.round(maxAgeH / 24)} days. Is the Pi's backup timer on?` };
  if (s.result === 'ok') return { icon: '✅', cls: 'is-ok' };
  return { icon: '⚠️', cls: 'is-warn' };
}

/**
 * ⚙️ Settings → 💾 Backups: how the Pi's nightly backup to the backup drive went, the weekly check
 * and drive health (docs/STORAGE_DRIVES.md), the app's newest own backup (docs/BACKUP.md), and
 * the share drive's free space. Read-only.
 */
export function BackupStatusSettings() {
  const [s, setS] = useState<BackupStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () =>
    api
      .get<BackupStatus>('/settings/backup-status')
      .then((x) => {
        setS(x);
        setErr(null);
      })
      .catch((e) => setErr((e as Error).message));
  useEffect(() => {
    void load();
  }, []);

  const nightly = badge(s?.nightly ?? null, 36);
  const check = badge(s?.check ?? null, 9 * 24);
  const sharePct = s?.share ? Math.round((1 - s.share.free_bytes / s.share.size_bytes) * 100) : null;
  return (
    <section className="panel backup-status">
      <h2>💾 Backups</h2>
      {err && <p className="hint">{err}</p>}
      {!s && !err && <p className="hint">Checking…</p>}
      {s && (
        <>
          {!s.configured ? (
            <p className="hint">
              The Pi's nightly backup to a backup drive isn't set up yet (nothing in <code>{s.status_dir}</code>). See{' '}
              <code>docs/STORAGE_DRIVES.md</code> to set it up.
            </p>
          ) : (
            <>
              <div className={`backup-status__row ${nightly.cls}`}>
                <strong>{nightly.icon} Nightly backup</strong>
                <span>{s.nightly ? ago(s.nightly.finished_at) : 'no result yet'}</span>
                {s.nightly?.message && <span className="hint">{s.nightly.message}</span>}
                {nightly.note && <span className="hint">{nightly.note}</span>}
                {s.nightly?.backup_drive_used_pct != null && (
                  <span className="hint">
                    Backup drive {s.nightly.backup_drive_used_pct}% full
                    <meter min={0} max={100} high={85} optimum={0} value={s.nightly.backup_drive_used_pct} />
                  </span>
                )}
              </div>
              <div className={`backup-status__row ${check.cls}`}>
                <strong>{check.icon} Weekly check & drive health</strong>
                <span>{s.check ? ago(s.check.finished_at) : 'no result yet (runs on Sundays)'}</span>
                {s.check?.message && <span className="hint">{s.check.message}</span>}
                {check.note && <span className="hint">{check.note}</span>}
              </div>
            </>
          )}
          {s.share && sharePct !== null && (
            <div className={`backup-status__row ${sharePct >= 85 ? 'is-warn' : ''}`}>
              <strong>💽 Share drive ({s.share.dir})</strong>
              <span>
                {size(s.share.free_bytes)} free of {size(s.share.size_bytes)} ({sharePct}% used)
                <meter min={0} max={100} high={80} optimum={0} value={sharePct} />
              </span>
              {sharePct >= 80 && <span className="hint">Keep the share under about 80% so the backup drive has room for its history.</span>}
            </div>
          )}
          <div className="backup-status__row">
            <strong>{s.app_backup ? '🗂️' : '⚪'} The app's own backup (database, uploads, settings)</strong>
            <span>{s.app_backup ? ago(s.app_backup.at) : 'none yet'}</span>
            <span className="hint">
              In <code>server/data/backups/</code>. The nightly backup makes one each night. Without it, see <code>docs/BACKUP.md</code>.
            </span>
          </div>
          <SystemBackupControls onChanged={() => void load()} />
          <button type="button" className="secondary" onClick={() => void load()}>
            ↻ Check again
          </button>
        </>
      )}
    </section>
  );
}
