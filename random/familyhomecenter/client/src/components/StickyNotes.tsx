import { useEffect, useState } from 'react';
import { api, type StickyNote } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from './MemberAvatar.js';
import { DrawPad } from './DrawPad.js';

export const NOTE_COLORS = ['#fff3a3', '#ffd6e7', '#c9f2d0', '#cfe8ff', '#ffe0b8', '#e6dcff'];
export const NOTES_CHANGED = 'notes-changed';

export function useStickyNotes(pollMs = 60_000): [StickyNote[], () => void] {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const load = () => {
    api.get<StickyNote[]>('/notes').then(setNotes).catch(() => {});
  };
  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    window.addEventListener(NOTES_CHANGED, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(NOTES_CHANGED, load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [notes, load];
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

/** One note on the fridge. */
export function NoteCard({ note, onDone, i = 0 }: { note: StickyNote; onDone?: () => void; i?: number }) {
  const { members } = useFamilyMembers();
  const author = members.find((m) => m.id === note.author_id) ?? null;
  const forWho = members.find((m) => m.id === note.for_member_id) ?? null;
  return (
    <div className="sticky-note" style={{ background: note.color ?? NOTE_COLORS[0], rotate: `${((i * 41) % 7) - 3}deg` }}>
      {forWho && <div className="sticky-note__for">For {forWho.name}</div>}
      {note.text && <div className="sticky-note__text">{note.text}</div>}
      {note.drawing && <img className="sticky-note__drawing" src={note.drawing} alt="A drawing" />}
      <div className="sticky-note__by">
        {author && <MemberAvatar member={author} size={18} />} {author?.name ?? ''} · {ago(note.created_at)}
        {onDone && (
          <button type="button" className="link-button sticky-note__done" onClick={onDone} title="Take it down">
            ✓ Done
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 📝 Sticky notes, like on the fridge: "Mom, I'm at Jake's", a drawing for Dad… They show on Home
 * and on the screensaver until someone taps ✓ Done (kept, just taken down).
 */
export function NotesBoard({ compact = false }: { compact?: boolean }) {
  const { members, activeProfile } = useFamilyMembers();
  const [notes, load] = useStickyNotes();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [drawing, setDrawing] = useState<string | null>(null);
  const [draw, setDraw] = useState(false);
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [forId, setForId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const changed = () => {
    load();
    window.dispatchEvent(new Event(NOTES_CHANGED));
  };
  const post = async () => {
    setError(null);
    try {
      await api.post('/notes', { text, drawing, color, author_id: activeProfile?.id ?? null, for_member_id: forId || null });
      setText('');
      setDrawing(null);
      setDraw(false);
      setWriting(false);
      changed();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const done = async (n: StickyNote) => {
    try {
      await api.post(`/notes/${n.id}/done`, { acting_member_id: activeProfile?.id ?? null });
      changed();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const shown = compact ? notes.slice(0, 6) : notes;
  return (
    <section className="panel notes-board">
      <h2>
        📝 Notes
        {!writing && (
          <button type="button" className="secondary notes-board__add" onClick={() => setWriting(true)}>
            ＋ Note
          </button>
        )}
      </h2>
      {writing && (
        <div className="notes-board__form" style={{ background: color }}>
          <textarea rows={3} autoFocus placeholder={`e.g. "I'm at Jake's — back by 5!"`} value={text} onChange={(e) => setText(e.target.value)} />
          {draw ? (
            <DrawPad onChange={setDrawing} height={160} background={color} />
          ) : (
            <button type="button" className="link-button" onClick={() => setDraw(true)}>
              🖍️ Draw instead
            </button>
          )}
          <div className="task-form__row">
            {NOTE_COLORS.map((c) => (
              <button key={c} type="button" aria-label="Note color" className={`draw-pad__ink ${color === c ? 'draw-pad__ink--on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
            <select value={forId} onChange={(e) => setForId(e.target.value)} aria-label="For">
              <option value="">For everyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  For {m.name}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="settings-login__error">{error}</div>}
          <div className="task-form__row">
            <button type="button" onClick={post} disabled={!text.trim() && !drawing}>
              📌 Put it up
            </button>
            <button type="button" className="secondary" onClick={() => setWriting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {!writing && error && <div className="settings-login__error">{error}</div>}
      {notes.length === 0 && !writing && <div className="empty-state">No notes up. ＋ Note to leave one for the family.</div>}
      <div className="notes-board__grid">
        {shown.map((n, i) => (
          <NoteCard key={n.id} note={n} i={i} onDone={() => done(n)} />
        ))}
      </div>
      {compact && notes.length > shown.length && <a href="#/notes" className="hint">All {notes.length} notes →</a>}
    </section>
  );
}

export function NotesPage() {
  return (
    <div>
      <h1>📝 Notes</h1>
      <NotesBoard />
    </div>
  );
}
