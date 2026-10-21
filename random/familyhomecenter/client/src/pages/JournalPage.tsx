import { useEffect, useState } from 'react';
import { api, type FamilyMember, type JournalEntry } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { DrawPad } from '../components/DrawPad.js';

const MOODS = ['🤩', '😀', '🙂', '😐', '😴', '😢', '😡', '🤒'];
const SLIP_COLORS = ['#fff3bf', '#d3f9d8', '#d0ebff', '#ffdeeb', '#e5dbff', '#ffe8cc'];
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const VIEW_KEY = 'familyhomecenter.journal.view';

/**
 * 📔 Journal & 🫙 Gratitude jar. Each kid writes (or draws) a little each day, with how they feel —
 * just for them and parents. The jar is the whole family's: one thing you're thankful for, on a
 * paper slip; 🎲 pulls one out. On the same day next year, "On this day" brings them back.
 */
export function JournalPage() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [view, setViewState] = useState<'journal' | 'jar'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'jar' ? 'jar' : 'journal';
    } catch {
      return 'journal';
    }
  });
  const setView = (v: 'journal' | 'jar') => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* fine */
    }
  };
  // Whose journal: yourself, or (a parent) anyone.
  const [whoId, setWhoId] = useState<string | null>(null);
  const who = members.find((m) => m.id === (whoId ?? activeProfile?.id)) ?? null;

  return (
    <div className="journal-page">
      <div className="family-board__head">
        <h1>{view === 'journal' ? '📔 Journal' : '🫙 Gratitude jar'}</h1>
        <div className="family-board__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'journal'} className={`family-board__tab ${view === 'journal' ? 'family-board__tab--active' : ''}`} onClick={() => setView('journal')}>
            📔 Journal
          </button>
          <button type="button" role="tab" aria-selected={view === 'jar'} className={`family-board__tab ${view === 'jar' ? 'family-board__tab--active' : ''}`} onClick={() => setView('jar')}>
            🫙 Gratitude jar
          </button>
        </div>
      </div>
      {!activeProfile && <div className="empty-state">Pick who you are (top right) to write.</div>}
      {view === 'journal' && activeProfile && (
        <>
          {isParent && (
            <div className="family-board__tabs dress-up__people">
              {members.map((m) => (
                <button key={m.id} type="button" className={`family-board__tab ${m.id === who?.id ? 'family-board__tab--active' : ''}`} onClick={() => setWhoId(m.id)}>
                  <MemberAvatar member={m} size={20} /> {m.name}
                </button>
              ))}
            </div>
          )}
          {who && <Journal member={who} />}
        </>
      )}
      {view === 'jar' && <Jar />}
    </div>
  );
}

function Journal({ member }: { member: FamilyMember }) {
  const { activeProfile } = useFamilyMembers();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [back, setBack] = useState<JournalEntry[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [drawing, setDrawing] = useState<string | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [padKey, setPadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const acting = activeProfile?.id ?? '';
  const load = () => {
    api.get<JournalEntry[]>(`/journal?family_member_id=${member.id}&acting_member_id=${acting}`).then(setEntries).catch((e) => setError(e.message));
    api
      .get<JournalEntry[]>(`/journal/on-this-day?family_member_id=${member.id}&acting_member_id=${acting}`)
      .then((r) => setBack(r.filter((e) => e.kind === 'journal')))
      .catch(() => setBack([]));
  };
  useEffect(load, [member.id]);
  const save = async () => {
    setError(null);
    try {
      await api.post('/journal', { family_member_id: member.id, kind: 'journal', text, mood, drawing, acting_member_id: activeProfile?.id ?? null });
      setText('');
      setMood(null);
      setDrawing(null);
      setDrawOpen(false);
      setPadKey((k) => k + 1);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const hide = async (e: JournalEntry) => {
    if (!window.confirm('Take this page out of the journal?')) return;
    await api.post(`/journal/${e.id}/hide`, { acting_member_id: activeProfile?.id ?? null }).catch(() => {});
    load();
  };
  return (
    <>
      {back.length > 0 && (
        <section className="panel journal__back">
          <h2>📅 On this day</h2>
          {back.map((e) => (
            <JournalCard key={e.id} entry={e} label={`${new Date().getFullYear() - Number(e.date.slice(0, 4))} year${new Date().getFullYear() - Number(e.date.slice(0, 4)) === 1 ? '' : 's'} ago`} />
          ))}
        </section>
      )}
      <section className="panel journal__write">
        <h2>
          <MemberAvatar member={member} size={28} /> Today, {member.name} feels…
        </h2>
        <div className="journal__moods">
          {MOODS.map((m) => (
            <button key={m} type="button" className={`journal__mood ${mood === m ? 'journal__mood--on' : ''}`} onClick={() => setMood(mood === m ? null : m)}>
              {m}
            </button>
          ))}
        </div>
        <textarea rows={4} placeholder="What happened today? What was the best part?" value={text} onChange={(e) => setText(e.target.value)} />
        {drawOpen ? (
          <DrawPad key={padKey} onChange={setDrawing} />
        ) : (
          <button type="button" className="secondary" onClick={() => setDrawOpen(true)}>
            🖍️ Draw a picture
          </button>
        )}
        {error && <div className="settings-login__error">{error}</div>}
        <div className="task-form__row">
          <button type="button" onClick={save} disabled={!text.trim() && !drawing}>
            📔 Save today's page
          </button>
        </div>
        <p className="hint">Just for {member.name} and parents.</p>
      </section>
      {entries.map((e) => (
        <JournalCard key={e.id} entry={e} onHide={() => hide(e)} />
      ))}
      {entries.length === 0 && <div className="empty-state">No pages yet — write the first one!</div>}
    </>
  );
}

function JournalCard({ entry, label, onHide }: { entry: JournalEntry; label?: string; onHide?: () => void }) {
  return (
    <article className="panel journal__entry">
      <header>
        <span className="journal__entry-mood">{entry.mood ?? '📔'}</span>
        <strong>{longDate(entry.date)}</strong>
        {label && <span className="hint"> · {label}</span>}
        {onHide && (
          <button type="button" className="link-button" onClick={onHide}>
            Take out
          </button>
        )}
      </header>
      {entry.text && <p className="journal__text">{entry.text}</p>}
      {entry.drawing && <img className="journal__drawing" src={entry.drawing} alt="A drawing" />}
    </article>
  );
}

function Jar() {
  const { members, activeProfile } = useFamilyMembers();
  const [slips, setSlips] = useState<JournalEntry[]>([]);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<JournalEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.get<JournalEntry[]>('/journal/jar').then(setSlips).catch(console.error);
  useEffect(() => {
    load();
  }, []);
  const add = async () => {
    if (!activeProfile) return setError('Pick who you are (top right) first');
    setError(null);
    try {
      await api.post('/journal', { family_member_id: activeProfile.id, kind: 'gratitude', text, acting_member_id: activeProfile.id });
      setText('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const pick = () => setPicked(slips[Math.floor(Math.random() * slips.length)] ?? null);
  const by = (id: string) => members.find((m) => m.id === id) ?? null;
  return (
    <>
      <section className="panel jar__add">
        <div className="jar__visual" aria-hidden="true">
          🫙<span className="jar__count">{slips.length}</span>
        </div>
        <div className="jar__form">
          <h2>I'm thankful for…</h2>
          <div className="task-form__row">
            <input value={text} placeholder="e.g. Grandma's pancakes" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && text.trim() && add()} />
            <button type="button" disabled={!text.trim()} onClick={add}>
              Put it in the jar
            </button>
          </div>
          {error && <div className="settings-login__error">{error}</div>}
          {slips.length > 0 && (
            <button type="button" className="secondary" onClick={pick}>
              🎲 Pull one out
            </button>
          )}
        </div>
      </section>
      {picked && (
        <div className="modal-overlay" onClick={() => setPicked(null)}>
          <div className="jar__picked" style={{ background: SLIP_COLORS[picked.id.charCodeAt(0) % SLIP_COLORS.length] }}>
            <div className="jar__picked-text">“{picked.text}”</div>
            <div className="hint">
              <MemberAvatar member={by(picked.family_member_id)} size={22} /> {by(picked.family_member_id)?.name} · {longDate(picked.date)}
            </div>
          </div>
        </div>
      )}
      <div className="jar__slips">
        {slips.map((s, i) => (
          <div key={s.id} className="jar__slip" style={{ background: SLIP_COLORS[s.id.charCodeAt(0) % SLIP_COLORS.length], rotate: `${((i * 37) % 7) - 3}deg` }}>
            <div>{s.text}</div>
            <div className="hint">
              <MemberAvatar member={by(s.family_member_id)} size={18} /> {by(s.family_member_id)?.name ?? ''} · {new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
