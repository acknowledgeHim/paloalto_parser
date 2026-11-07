import { useRef, useState } from 'react';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { mediaDate } from '../utils/mediaDate.js';

interface Row {
  name: string;
  state: 'waiting' | 'checking' | 'sending' | 'filed' | 'duplicate' | 'skipped' | 'error';
  dest?: string | null;
  note?: string | null;
  taken?: string | null;
}

const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayStart = (s: string) => (s ? new Date(`${s}T00:00:00`) : null);
const dayEnd = (s: string) => (s ? new Date(`${s}T23:59:59.999`) : null);
const shortDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Quick picks for "only taken between". */
function presets(): Array<{ label: string; from: string; to: string }> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const back = (days: number) => ymd(new Date(y, m, now.getDate() - days));
  return [
    { label: 'Today', from: ymd(now), to: ymd(now) },
    { label: 'Last 7 days', from: back(6), to: ymd(now) },
    { label: 'This month', from: ymd(new Date(y, m, 1)), to: ymd(now) },
    { label: 'Last month', from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) },
    { label: 'This year', from: `${y}-01-01`, to: ymd(now) },
  ];
}

/**
 * 📤 Add photos — pick pictures on this phone/tablet/computer and they go into the photo library,
 * each into its <YEAR>/<Month> folder by the date it was taken. A photo that's already there isn't
 * added twice.
 */
export function AddPhotos({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { activeProfile } = useFamilyMembers();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  // 📅 Only add what was taken between these days (both optional).
  const [useRange, setUseRange] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const set = (i: number, r: Partial<Row>) => setRows((all) => all.map((x, k) => (k === i ? { ...x, ...r } : x)));

  const send = async (files: File[]) => {
    const start = rows.length;
    setRows((all) => [...all, ...files.map((f) => ({ name: f.name, state: 'waiting' as const }))]);
    setBusy(true);
    let added = 0;
    for (let k = 0; k < files.length; k++) {
      const f = files[k];
      const i = start + k;
      try {
        const ranged = useRange && (from || to);
        if (ranged) {
          // Read the date on this device first, so what's outside the dates isn't sent at all.
          set(i, { state: 'checking' });
          const taken = await mediaDate(f);
          const lo = dayStart(from);
          const hi = dayEnd(to);
          if (taken && ((lo && taken < lo) || (hi && taken > hi))) {
            set(i, { state: 'skipped', taken: taken.toISOString() });
            continue;
          }
        }
        set(i, { state: 'sending' });
        const r = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: {
            'Content-Type': f.type || 'application/octet-stream',
            'x-filename': encodeURIComponent(f.name),
            'x-last-modified': String(f.lastModified || ''),
            'x-acting-member': activeProfile?.id ?? '',
            // The server checks again with the date it files by (for files this device couldn't read).
            ...(ranged ? { 'x-only-from': from, 'x-only-to': to } : {}),
          },
          body: f,
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) set(i, { state: 'error', note: body.note || body.error || `Failed (${r.status})` });
        else {
          set(i, { state: body.result, dest: body.dest, note: body.note, taken: body.taken_at });
          if (body.result === 'filed') added++;
        }
      } catch (e) {
        set(i, { state: 'error', note: (e as Error).message });
      }
    }
    setBusy(false);
    if (added) onAdded();
  };

  const folder = (dest?: string | null) => (dest ? dest.split('/').filter(Boolean).slice(0, -1).join(' / ') : '');
  const done = rows.filter((r) => r.state === 'filed').length;
  const dup = rows.filter((r) => r.state === 'duplicate').length;
  const bad = rows.filter((r) => r.state === 'error').length;
  const skipped = rows.filter((r) => r.state === 'skipped').length;
  const rangeText = useRange && (from || to) ? (from && to ? (from === to ? shortDate(`${from}T12:00`) : `${shortDate(`${from}T12:00`)} – ${shortDate(`${to}T12:00`)}`) : from ? `from ${shortDate(`${from}T12:00`)}` : `up to ${shortDate(`${to}T12:00`)}`) : '';

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal-panel panel add-photos" onClick={(e) => e.stopPropagation()}>
        <h2>📤 Add photos</h2>
        <p className="hint">Pick pictures and videos from this device. Each picture goes into the photo library under the year and month it was taken (e.g. 2025 / August); videos go to the movies folder by year (a .mov becomes an .mp4).</p>
        <label className="privacy-toggle">
          <input type="checkbox" checked={useRange} onChange={(e) => setUseRange(e.target.checked)} disabled={busy} />
          <span>
            <strong>📅 Only add ones taken between…</strong>
            <span className="hint"> — pick a big batch (or everything); only those taken on these days are sent</span>
          </span>
        </label>
        {useRange && (
          <div className="add-photos__range">
            <label>
              From <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} disabled={busy} />
            </label>
            <label>
              To <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} disabled={busy} />
            </label>
            <div className="add-photos__presets">
              {presets().map((p) => (
                <button key={p.label} type="button" className={from === p.from && to === p.to ? '' : 'secondary'} disabled={busy} onClick={() => { setFrom(p.from); setTo(p.to); }}>
                  {p.label}
                </button>
              ))}
            </div>
            {isIos && (
              <p className="hint">
                On iPhone: in the picker, tap <strong>Photos</strong> or an album, then drag a finger across the thumbnails to select many at once. To send a date range
                without picking, use the Shortcut below.
              </p>
            )}
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*,video/*,.heic,.heif,.mov,.mp4"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) void send(files);
          }}
        />
        <button type="button" onClick={() => input.current?.click()} disabled={busy}>
          {rows.length ? '＋ Pick more' : '📷 Pick photos & videos'}
        </button>
        {rangeText && <p className="hint">Only adding ones taken {from && to ? 'on ' : ''}{rangeText}.</p>}
        {rows.length > 0 && (
          <>
            <p className="add-photos__sum">
              {done} added{dup ? ` · ${dup} already there` : ''}
              {skipped ? ` · ${skipped} outside the dates (not sent)` : ''}
              {bad ? ` · ${bad} didn't work` : ''}
              {busy ? ` · sending ${rows.filter((r) => r.state === 'waiting' || r.state === 'checking' || r.state === 'sending').length}…` : ''}
            </p>
            <ul className="add-photos__list">
              {rows.map((r, i) => (
                <li key={i} className={`add-photos__row add-photos__row--${r.state}`}>
                  <span className="add-photos__name">{r.name}</span>
                  <span>
                    {r.state === 'waiting' && '⏳'}
                    {r.state === 'checking' && 'Checking the date…'}
                    {r.state === 'skipped' && `Skipped — taken ${shortDate(r.taken)}`}
                    {r.state === 'sending' && 'Sending…'}
                    {r.state === 'filed' && `✓ ${folder(r.dest)}`}
                    {r.state === 'duplicate' && `Already there (${folder(r.dest)})`}
                    {r.state === 'error' && `⚠️ ${r.note}`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <IphoneShortcutHelp />
        <div className="task-form__row">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            {busy ? 'Sending…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 📲 How to send a date range straight from an iPhone with the Shortcuts app — no picking, and it
 * can run by itself (e.g. every night, or when the phone starts charging at home). Full version
 * with screenshots-free steps: docs/IPHONE_UPLOAD.md.
 */
function IphoneShortcutHelp() {
  const url = `${location.origin}/api/photos/upload`;
  const [copied, setCopied] = useState(false);
  return (
    <details className="add-photos__shortcut">
      <summary>📲 iPhone: send a date range with a Shortcut (no picking)</summary>
      <p className="hint">Make it once in the <strong>Shortcuts</strong> app; then tap it (or let it run on its own) and it asks for the dates.</p>
      <ol>
        <li>
          <strong>+</strong> new shortcut → add <strong>Ask for Input</strong> (Input Type: <em>Date</em>, prompt “From”), and a second one for “To”.
        </li>
        <li>
          Add <strong>Find Photos</strong> → <em>Add Filter</em>: <code>Date Taken</code> <code>is between</code> <em>Provided Input</em> and <em>Provided Input</em>{' '}
          (the From and To answers). Turn off <em>Limit</em>. Add a filter <code>Is Hidden</code> <code>is not</code> on, if you like.
        </li>
        <li>
          Add <strong>Repeat with Each</strong> (items: <em>Photos</em>). Inside it add <strong>Get Contents of URL</strong>:
          <ul>
            <li>
              URL:{' '}
              <code>{url}</code>{' '}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {});
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </li>
            <li>Method: <strong>POST</strong> · Request Body: <strong>File</strong> → <em>Repeat Item</em></li>
            <li>
              Headers: <code>x-filename</code> = <em>Repeat Item → Name</em>, and <code>x-taken</code> = <em>Repeat Item → Date Taken</em> (format: ISO 8601)
            </li>
          </ul>
        </li>
        <li>Run it on the home Wi-Fi. Photos go to <code>YEAR/Month</code>, videos to the movies folder (a .mov becomes an .mp4); ones already there aren't added twice.</li>
      </ol>
      <p className="hint">
        To run it by itself: Shortcuts → <strong>Automation</strong> → <em>Charger: is connected</em> (or a time of day), and change the two “Ask for Input” steps to{' '}
        <strong>Adjust Date</strong> (Current Date, subtract 2 days) and <strong>Current Date</strong>.
      </p>
    </details>
  );
}
