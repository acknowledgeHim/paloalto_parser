/*
 * Family Home Center — Copyright (c) 2026 the Family Home Center authors.
 * All rights reserved. Proprietary and confidential; see the LICENSE file.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

interface RomRow {
  id: string;
  title: string;
  system: 'nes' | 'snes';
  size: number;
  archived: boolean;
  sort: number;
  created_at: string;
}

const SYSTEM_LABEL: Record<string, string> = { nes: '🎮 NES', snes: '👾 SNES' };
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/**
 * 🎮 Parent-only panel to manage "classic games" — the .nes / .sfc / .smc ROM files a parent uploads and
 * the kids play in the browser. Each one becomes its own game on the shelf (price, show/hide and plays
 * are set in the panels above, like any game). Here a parent uploads, renames, reorders, or archives
 * them (archiving only hides a game from the list — the file is never deleted), and hides the whole
 * section from the kids at once. Calls onChange after anything that adds/removes a game so the shelves
 * and the cost/show-hide panels pick it up.
 */
export function ClassicGamesAdmin({ onChange }: { onChange: () => void }) {
  const [roms, setRoms] = useState<RomRow[] | null>(null);
  const [sectionHidden, setSectionHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = () =>
    Promise.all([api.get<RomRow[]>('/games/roms'), api.get<{ hidden: boolean }>('/games/classic-section')])
      .then(([list, sec]) => {
        setRoms(list);
        setSectionHidden(sec.hidden);
      })
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    void reload();
  }, []);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    setNote(null);
    let added = 0;
    try {
      for (const f of Array.from(files)) {
        const resp = await fetch('/api/games/roms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(f.name) },
          body: f,
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || `${f.name}: upload failed (${resp.status})`);
        }
        added += 1;
      }
      setNote(`Added ${added} game${added === 1 ? '' : 's'} ✓`);
      await reload();
      onChange();
    } catch (e) {
      setError((e as Error).message);
      if (added > 0) {
        await reload();
        onChange();
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const patch = async (id: string, body: { title?: string; archived?: boolean; sort?: number }, refreshShelf = false) => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/games/roms/${id}`, body);
      await reload();
      if (refreshShelf) onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    if (!roms) return;
    const a = roms[idx];
    const b = roms[idx + dir];
    if (!a || !b) return;
    // swap their sort values (fall back to indices if they're equal)
    const aSort = a.sort === b.sort ? idx : a.sort;
    const bSort = a.sort === b.sort ? idx + dir : b.sort;
    void (async () => {
      setBusy(true);
      try {
        await api.put(`/games/roms/${a.id}`, { sort: bSort });
        await api.put(`/games/roms/${b.id}`, { sort: aSort });
        await reload();
        onChange();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    })();
  };

  const toggleSection = async (hidden: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.put<{ hidden: boolean }>('/games/classic-section', { hidden });
      setSectionHidden(r.hidden);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const active = (roms ?? []).filter((r) => !r.archived);
  const archived = (roms ?? []).filter((r) => r.archived);

  return (
    <section className="panel classic-admin">
      <h2>🎮 Classic games (NES &amp; SNES)</h2>
      <p className="hint">
        Add your own game files and the kids play them right here in the browser. Each one becomes its own game above, so it costs 💎 tokens and you set its
        price and show/hide like any game. <strong>Upload only games you own.</strong> Supported: <code>.nes</code> (NES) and <code>.sfc</code> / <code>.smc</code>{' '}
        (SNES). Removing a game just takes it off the list — the file is kept.
      </p>

      <label className="privacy-toggle classic-admin__section">
        <input type="checkbox" checked={sectionHidden} disabled={busy} onChange={(e) => void toggleSection(e.target.checked)} />
        <span>🙈 Hide all classic games from the kids (you still see them)</span>
      </label>

      <div className="classic-admin__upload">
        <input
          ref={fileRef}
          type="file"
          accept=".nes,.sfc,.smc"
          multiple
          disabled={busy}
          onChange={(e) => void upload(e.target.files)}
          aria-label="Upload NES or SNES game files"
        />
        {busy && <span className="hint">Working…</span>}
        {note && <span className="hint">{note}</span>}
      </div>

      {roms === null ? (
        <p className="hint">Loading…</p>
      ) : active.length === 0 && archived.length === 0 ? (
        <p className="hint">No classic games yet — add a <code>.nes</code>, <code>.sfc</code> or <code>.smc</code> file above.</p>
      ) : (
        <div className="classic-admin__list">
          {active.map((r, i) => (
            <div key={r.id} className="classic-admin__row">
              <span className="classic-admin__sys">{SYSTEM_LABEL[r.system] ?? r.system}</span>
              <input
                className="classic-admin__title"
                defaultValue={r.title}
                disabled={busy}
                aria-label={`${r.title} name`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== r.title) void patch(r.id, { title: v }, true);
                }}
              />
              <span className="hint">{fmtSize(r.size)}</span>
              <span className="classic-admin__moves">
                <button type="button" className="link-button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${r.title} up`}>
                  ↑
                </button>
                <button type="button" className="link-button" disabled={busy || i === active.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${r.title} down`}>
                  ↓
                </button>
              </span>
              <button type="button" className="link-button" disabled={busy} onClick={() => void patch(r.id, { archived: true }, true)}>
                ✕ Remove
              </button>
            </div>
          ))}
          {archived.length > 0 && (
            <details className="classic-admin__archived">
              <summary>Removed games ({archived.length}) — files kept, bring any back</summary>
              {archived.map((r) => (
                <div key={r.id} className="classic-admin__row">
                  <span className="classic-admin__sys">{SYSTEM_LABEL[r.system] ?? r.system}</span>
                  <span className="classic-admin__title">{r.title}</span>
                  <span className="hint">{fmtSize(r.size)}</span>
                  <button type="button" className="secondary" disabled={busy} onClick={() => void patch(r.id, { archived: false }, true)}>
                    ↩ Bring back
                  </button>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
      {error && <div className="settings-login__error">{error}</div>}
    </section>
  );
}
