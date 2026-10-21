import { useRef, useState } from 'react';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface Row {
  name: string;
  state: 'waiting' | 'sending' | 'filed' | 'duplicate' | 'error';
  dest?: string | null;
  note?: string | null;
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
      set(i, { state: 'sending' });
      try {
        const r = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: {
            'Content-Type': f.type || 'application/octet-stream',
            'x-filename': encodeURIComponent(f.name),
            'x-last-modified': String(f.lastModified || ''),
            'x-acting-member': activeProfile?.id ?? '',
          },
          body: f,
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) set(i, { state: 'error', note: body.note || body.error || `Failed (${r.status})` });
        else {
          set(i, { state: body.result, dest: body.dest, note: body.note });
          if (body.result === 'filed') added++;
        }
      } catch (e) {
        set(i, { state: 'error', note: (e as Error).message });
      }
    }
    setBusy(false);
    if (added) onAdded();
  };

  const folder = (dest?: string | null) => (dest ? dest.split('/').slice(0, -1).join(' / ') : '');
  const done = rows.filter((r) => r.state === 'filed').length;
  const dup = rows.filter((r) => r.state === 'duplicate').length;
  const bad = rows.filter((r) => r.state === 'error').length;

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal-panel panel add-photos" onClick={(e) => e.stopPropagation()}>
        <h2>📤 Add photos</h2>
        <p className="hint">Pick pictures from this device. Each goes into the photo library under the year and month it was taken (e.g. 2025 / August).</p>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) void send(files);
          }}
        />
        <button type="button" onClick={() => input.current?.click()} disabled={busy}>
          {rows.length ? '＋ Pick more' : '📷 Pick photos'}
        </button>
        {rows.length > 0 && (
          <>
            <p className="add-photos__sum">
              {done} added{dup ? ` · ${dup} already there` : ''}
              {bad ? ` · ${bad} didn't work` : ''}
              {busy ? ` · sending ${rows.filter((r) => r.state === 'waiting' || r.state === 'sending').length}…` : ''}
            </p>
            <ul className="add-photos__list">
              {rows.map((r, i) => (
                <li key={i} className={`add-photos__row add-photos__row--${r.state}`}>
                  <span className="add-photos__name">{r.name}</span>
                  <span>
                    {r.state === 'waiting' && '⏳'}
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
        <div className="task-form__row">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            {busy ? 'Sending…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
