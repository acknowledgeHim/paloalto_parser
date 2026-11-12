import { execFile } from 'node:child_process';

/**
 * 💾 Controls for the Pi's own nightly backup (docs/STORAGE_DRIVES.md §9): it runs as root from
 * systemd, so the app can only *read* its state (systemctl show works for anyone) and start it or
 * change its time through `sudo -n` for exactly these commands, allowed by one sudoers line
 * (docs/STORAGE_DRIVES.md §9f). Without that line the buttons say how to set it up.
 */
const SYSTEMCTL = '/usr/bin/systemctl';
const SCHEDULE = '/usr/local/sbin/fhc-backup-schedule';
const UNITS = { backup: 'fhc-backup.service', check: 'fhc-backup-check.service' } as const;

function run(cmd: string, args: string[], timeout = 15_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) =>
    execFile(cmd, args, { timeout }, (e, out, err) => resolve({ code: e ? (typeof (e as { code?: unknown }).code === 'number' ? ((e as { code: number }).code) : -1) : 0, out: String(out), err: String(err || (e && !err ? e.message : '')) }))
  );
}
function props(text: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const l of text.split('\n')) {
    const i = l.indexOf('=');
    if (i > 0) o[l.slice(0, i)] = l.slice(i + 1);
  }
  return o;
}
const unixTime = (v: string | undefined) => (v && /^@\d+$/.test(v) ? new Date(Number(v.slice(1)) * 1000).toISOString() : null);

export interface SystemBackupInfo {
  /** is fhc-backup.timer installed? */
  installed: boolean;
  /** HH:MM it's set to run (from the timer), if it's a simple daily time */
  time: string | null;
  next_run: string | null;
  last_trigger: string | null;
  backup_state: string | null;
  check_state: string | null;
}

export async function systemBackupInfo(): Promise<SystemBackupInfo> {
  const [t, b, c] = await Promise.all([
    run(SYSTEMCTL, ['show', 'fhc-backup.timer', '--timestamp=unix', '--property=LoadState,TimersCalendar,NextElapseUSecRealtime,LastTriggerUSec']),
    run(SYSTEMCTL, ['show', UNITS.backup, '--property=ActiveState']),
    run(SYSTEMCTL, ['show', UNITS.check, '--property=ActiveState']),
  ]);
  const tp = props(t.out);
  const installed = t.code === 0 && tp.LoadState === 'loaded';
  const cal = /OnCalendar=\S+\s+(\d{1,2}):(\d{2})/.exec(tp.TimersCalendar ?? '');
  return {
    installed,
    time: cal ? `${cal[1].padStart(2, '0')}:${cal[2]}` : null,
    next_run: unixTime(tp.NextElapseUSecRealtime),
    last_trigger: unixTime(tp.LastTriggerUSec),
    backup_state: b.code === 0 ? props(b.out).ActiveState ?? null : null,
    check_state: c.code === 0 ? props(c.out).ActiveState ?? null : null,
  };
}

const needsSetup = (err: string) => /password is required|not allowed|may not run|not in the sudoers|no tty present|a terminal is required/i.test(err);
export type ControlResult = { ok: true } | { ok: false; setup: boolean; error: string };

/** ▶ Start the nightly backup (or the 🩺 check) now. */
export async function startSystem(what: keyof typeof UNITS): Promise<ControlResult> {
  const r = await run('sudo', ['-n', SYSTEMCTL, 'start', '--no-block', UNITS[what]]);
  if (r.code === 0) return { ok: true };
  return { ok: false, setup: needsSetup(r.err), error: r.err.trim().slice(0, 500) || `exit ${r.code}` };
}

/** ⏰ Change the nightly time (HH:MM). */
export async function setSystemTime(time: string): Promise<ControlResult> {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, setup: false, error: 'Use a time like 02:30' };
  const r = await run('sudo', ['-n', SCHEDULE, time]);
  if (r.code === 0) return { ok: true };
  return { ok: false, setup: needsSetup(r.err) || /No such file|command not found/i.test(r.err), error: r.err.trim().slice(0, 500) || `exit ${r.code}` };
}

export interface PiBackupRun {
  /** is fhc-backup.service there at all? */
  installed: boolean;
  /** running right now */
  active: boolean;
  /** when it last finished (ok or not) */
  last_end: string | null;
}

/** Is the Pi's own nightly backup running, and when did it last finish? (📦 app backups wait for it.) */
export async function piBackupRun(): Promise<PiBackupRun> {
  const r = await run(SYSTEMCTL, ['show', UNITS.backup, '--timestamp=unix', '--property=LoadState,ActiveState,ExecMainExitTimestamp,InactiveEnterTimestamp']);
  const p = props(r.out);
  const installed = r.code === 0 && p.LoadState === 'loaded';
  const ends = [unixTime(p.ExecMainExitTimestamp), unixTime(p.InactiveEnterTimestamp)].filter((x): x is string => Boolean(x)).sort();
  return {
    installed,
    active: installed && (p.ActiveState === 'active' || p.ActiveState === 'activating' || p.ActiveState === 'deactivating' || p.ActiveState === 'reloading'),
    last_end: installed ? ends[ends.length - 1] ?? null : null,
  };
}
