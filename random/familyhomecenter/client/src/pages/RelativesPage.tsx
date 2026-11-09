import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Person } from '../api/client.js';
import { PhotoPicker } from '../components/PhotoPicker.js';
import { ThumbYear } from '../components/ThumbYear.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { useSectionAccess } from '../state/SectionAccess.js';

interface Relative {
  id: string;
  name: string;
  nickname: string | null;
  relation: string | null;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  death_place: string | null;
  about: string | null;
  person_id: string | null;
  family_member_id: string | null;
  hidden: boolean;
  age: number | null;
  living: boolean;
  next_birthday: { days: number; year: number; age: number | null } | null;
  member: { id: string; name: string } | null;
  person: { id: string; name: string } | null;
  photo_count?: number;
  cover_photo_id?: string | null;
}
interface Memory {
  id: string;
  text: string;
  author_member_id: string | null;
  author_name: string | null;
  hidden: number;
  created_at: string;
}
interface Detail extends Relative {
  memories: Memory[];
  photos: Array<{ id: string; taken_at: string; from_face: boolean; tagged: boolean }>;
  movies: Array<{ id: string; title: string; year: number | null; recorded_at: string | null }>;
}

/** "1950-04-21" → "April 21, 1950"; "0000-04-21" (year not known) → "April 21". */
function showDate(d: string | null) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y || 2000, m - 1, day);
  return dt.toLocaleDateString(undefined, y ? { year: 'numeric', month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric' });
}
function lifeLine(r: Relative) {
  const born = r.birth_date ? `Born ${showDate(r.birth_date)}${r.birth_place ? ` in ${r.birth_place}` : ''}` : '';
  const died = r.death_date ? `died ${showDate(r.death_date)}${r.death_place ? ` in ${r.death_place}` : ''}` : '';
  const age = r.age != null ? (r.living ? ` · ${r.age} years old` : ` · lived to ${r.age}`) : '';
  return [born, died].filter(Boolean).join(', ') + age;
}

/** 👪 Family → Relatives: family living or not — dates, memories, and the photos and home movies they're in. */
export function RelativesPage() {
  const { id } = useParams<{ id: string }>();
  return id ? <RelativeView id={id} /> : <RelativesList />;
}

function RelativesList() {
  const { activeProfile, members } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [list, setList] = useState<Relative[] | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const { canSee } = useSectionAccess();
  const nav = useNavigate();

  useEffect(() => {
    api.get<Relative[]>(`/relatives${showHidden ? '?all=1' : ''}`).then(setList).catch(() => setList([]));
  }, [showHidden]);

  const shown = (list ?? []).filter((r) => !q || `${r.name} ${r.nickname ?? ''} ${r.relation ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const soon = [...(list ?? [])].filter((r) => !r.hidden && r.next_birthday && r.next_birthday.days <= 30).sort((a, b) => a.next_birthday!.days - b.next_birthday!.days);

  return (
    <div className="relatives-page">
      <h1>👪 Relatives</h1>
      <p className="hint">Family, living or not: birthdays, memories, and the photos and home movies they’re in. Birthdays show on Home on the day.</p>
      {soon.length > 0 && (
        <p className="relatives__soon">
          🎂 Coming up:{' '}
          {soon.slice(0, 6).map((r, i) => (
            <span key={r.id}>
              {i > 0 && ' · '}
              <Link to={`/relatives/${r.id}`}>{r.nickname || r.name}</Link> {r.next_birthday!.days === 0 ? 'today!' : r.next_birthday!.days === 1 ? 'tomorrow' : `in ${r.next_birthday!.days} days`}
            </span>
          ))}
        </p>
      )}
      <div className="relatives__bar">
        <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search relatives" />
        {isParent && (
          <>
            <button type="button" onClick={() => setAdding(true)}>
              ＋ Add a relative
            </button>
            <label className="relatives__check">
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show hidden
            </label>
          </>
        )}
      </div>
      {list === null && <p className="hint">Loading…</p>}
      {list && list.length === 0 && <p className="hint">{isParent ? 'Nobody yet — add grandparents, aunts, uncles, cousins…' : 'Nobody yet — a parent can add relatives.'}</p>}
      <div className="relatives__grid">
        {shown.map((r) => (
          <Link key={r.id} to={`/relatives/${r.id}`} className={`panel relatives__card${r.hidden ? ' is-hidden' : ''}`}>
            {r.cover_photo_id && canSee('photos') ? (
              <img src={`/api/photos/${r.cover_photo_id}/image`} alt="" loading="lazy" className="relatives__cover" />
            ) : (
              <div className="relatives__cover relatives__cover--none">{r.living ? '🙂' : '🕊️'}</div>
            )}
            <div>
              <strong>{r.name}</strong>
              {r.nickname && <span className="hint"> “{r.nickname}”</span>}
              {r.relation && <div className="hint">{r.relation}</div>}
              <div className="hint">{lifeLine(r)}</div>
              {r.member && <div className="hint">👤 {r.member.name}’s profile</div>}
              {r.hidden && <div className="hint">🙈 hidden</div>}
            </div>
          </Link>
        ))}
      </div>
      {adding && (
        <RelativeForm
          onClose={() => setAdding(false)}
          onSaved={(r) => {
            setAdding(false);
            nav(`/relatives/${r.id}`);
          }}
        />
      )}
    </div>
  );
}

function RelativeForm({ relative, onClose, onSaved }: { relative?: Relative; onClose: () => void; onSaved: (r: Relative) => void }) {
  const { activeProfile, members } = useFamilyMembers();
  const [people, setPeople] = useState<Person[]>([]);
  const [all, setAll] = useState<Relative[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState(() => ({
    name: relative?.name ?? '',
    nickname: relative?.nickname ?? '',
    relation: relative?.relation ?? '',
    birth_date: relative?.birth_date?.startsWith('0000') ? '' : relative?.birth_date ?? '',
    birth_md: relative?.birth_date?.startsWith('0000') ? relative.birth_date.slice(5) : '',
    birth_place: relative?.birth_place ?? '',
    died: Boolean(relative?.death_date),
    death_date: relative?.death_date?.startsWith('0000') ? '' : relative?.death_date ?? '',
    death_place: relative?.death_place ?? '',
    about: relative?.about ?? '',
    person_id: relative?.person_id ?? '',
    family_member_id: relative?.family_member_id ?? '',
    no_year: Boolean(relative?.birth_date?.startsWith('0000')),
  }));
  useEffect(() => {
    api.get<Person[]>('/faces/people').then(setPeople).catch(() => {});
    api.get<Relative[]>('/relatives?all=1').then(setAll).catch(() => {});
  }, []);
  const linkedTo = useMemo(() => new Map(all.filter((r) => r.family_member_id && r.id !== relative?.id).map((r) => [r.family_member_id!, r.name])), [all, relative?.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let birth = d.birth_date || null;
    if (d.no_year) {
      if (!/^\d{2}-\d{2}$/.test(d.birth_md) && d.birth_md) return setError('Birthday without the year: month-day, like 04-21');
      birth = d.birth_md ? `0000-${d.birth_md}` : null;
    }
    const body = {
      name: d.name,
      nickname: d.nickname,
      relation: d.relation,
      birth_date: birth,
      birth_place: d.birth_place,
      death_date: d.died ? d.death_date || null : null,
      death_place: d.died ? d.death_place : '',
      about: d.about,
      person_id: d.person_id || null,
      family_member_id: d.family_member_id || null,
      acting_member_id: activeProfile?.id ?? null,
    };
    try {
      onSaved(relative ? await api.put<Relative>(`/relatives/${relative.id}`, body) : await api.post<Relative>('/relatives', body));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form relatives__form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{relative ? `Edit ${relative.name}` : '＋ Add a relative'}</h2>
        <label>
          Name
          <input value={d.name} onChange={set('name')} required maxLength={100} autoFocus placeholder="e.g. Josephine Miller" />
        </label>
        <label>
          What the kids call them
          <input value={d.nickname} onChange={set('nickname')} maxLength={60} placeholder="e.g. Grandma Jo" />
        </label>
        <label>
          How they’re related
          <input value={d.relation} onChange={set('relation')} maxLength={100} placeholder="e.g. Mom’s mom" />
        </label>
        <fieldset>
          <legend>🎂 Born</legend>
          <label className="relatives__check">
            <input type="checkbox" checked={d.no_year} onChange={set('no_year')} /> Don’t know the year
          </label>
          {d.no_year ? (
            <input value={d.birth_md} onChange={set('birth_md')} placeholder="month-day, e.g. 04-21" maxLength={5} aria-label="Birthday month and day" />
          ) : (
            <input type="date" value={d.birth_date} onChange={set('birth_date')} aria-label="Birthday" />
          )}
          <input value={d.birth_place} onChange={set('birth_place')} maxLength={120} placeholder="Where (optional)" aria-label="Where they were born" />
        </fieldset>
        <label className="relatives__check">
          <input type="checkbox" checked={d.died} onChange={set('died')} /> 🕊️ Has passed away
        </label>
        {d.died && (
          <fieldset>
            <legend>🕊️ Died</legend>
            <input type="date" value={d.death_date} onChange={set('death_date')} aria-label="Date they died" />
            <input value={d.death_place} onChange={set('death_place')} maxLength={120} placeholder="Where (optional)" aria-label="Where they died" />
          </fieldset>
        )}
        <label>
          About them
          <textarea value={d.about} onChange={set('about')} rows={4} maxLength={20000} placeholder="Where they grew up, their work, what they loved…" />
        </label>
        <label>
          👥 Their face in Photos (face recognition)
          <select value={d.person_id} onChange={set('person_id')}>
            <option value="">— not linked —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.confirmed_count} photo{p.confirmed_count === 1 ? '' : 's'})
              </option>
            ))}
          </select>
          <span className="hint">Every photo with this face counts as one of theirs.</span>
        </label>
        <label>
          👤 Someone in the household?
          <select value={d.family_member_id} onChange={set('family_member_id')}>
            <option value="">— no —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id} disabled={linkedTo.has(m.id)}>
                {m.name}
                {linkedTo.has(m.id) ? ` (linked to ${linkedTo.get(m.id)})` : ''}
              </option>
            ))}
          </select>
          <span className="hint">Link a parent’s or kid’s profile to their own entry here: that gives them a birthday and their “photos of me” on Home.</span>
        </label>
        {error && <div className="settings-login__error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}

function RelativeView({ id }: { id: string }) {
  const { activeProfile, members } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const { canSee } = useSectionAccess();
  const [r, setR] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [memory, setMemory] = useState('');
  const [editMem, setEditMem] = useState<{ id: string; text: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [moviePick, setMoviePick] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acting = activeProfile?.id ?? null;

  const load = () =>
    api
      .get<Detail>(`/relatives/${id}${isParent ? '?all=1' : ''}`)
      .then(setR)
      .catch(() => setMissing(true));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const run = async (f: () => Promise<unknown>) => {
    setError(null);
    try {
      await f();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (missing) return <p className="hint">Not found. <Link to="/relatives">‹ Relatives</Link></p>;
  if (!r) return <p className="hint">Loading…</p>;
  const photos = canSee('photos') ? r.photos : [];
  const shownMemories = r.memories.filter((m) => !m.hidden || isParent);

  return (
    <div className="relatives-page">
      <p>
        <Link to="/relatives">‹ Relatives</Link>
      </p>
      <header className="relatives__head">
        {photos[0] ? <img src={`/api/photos/${photos[photos.length - 1].id}/image`} alt="" className="relatives__cover relatives__cover--big" /> : <div className="relatives__cover relatives__cover--big relatives__cover--none">{r.living ? '🙂' : '🕊️'}</div>}
        <div>
          <h1>
            {r.name}
            {r.nickname && <span className="hint"> “{r.nickname}”</span>}
          </h1>
          {r.relation && <div>{r.relation}</div>}
          <div className="hint">{lifeLine(r)}</div>
          {r.next_birthday && r.next_birthday.days <= 30 && (
            <div>
              🎂 {r.next_birthday.days === 0 ? 'Birthday today!' : `Birthday in ${r.next_birthday.days} day${r.next_birthday.days === 1 ? '' : 's'}`}
              {r.next_birthday.age ? (r.living ? ` — turning ${r.next_birthday.age}` : ` — would have been ${r.next_birthday.age}`) : ''}
            </div>
          )}
          {r.member && <div className="hint">👤 {r.member.name}’s profile</div>}
          {r.person && <div className="hint">👥 Face in Photos: {r.person.name}</div>}
          {isParent && (
            <div className="relatives__actions">
              <button type="button" className="secondary" onClick={() => setEditing(true)}>
                ✏️ Edit
              </button>
              <button type="button" className="link-button" onClick={() => void run(() => api.put(`/relatives/${r.id}`, { hidden: !r.hidden, acting_member_id: acting }))}>
                {r.hidden ? '👁️ Show again' : '🙈 Hide'}
              </button>
            </div>
          )}
        </div>
      </header>
      {error && <div className="settings-login__error">{error}</div>}

      {r.about && (
        <section className="panel">
          <h2>About</h2>
          <p className="relatives__about">{r.about}</p>
        </section>
      )}

      <section className="panel">
        <h2>💬 Memories</h2>
        {shownMemories.length === 0 && <p className="hint">No memories yet — add the first one.</p>}
        {shownMemories.map((m) => {
          const mine = isParent || (acting && m.author_member_id === acting);
          return (
            <div key={m.id} className={`relatives__memory${m.hidden ? ' is-hidden' : ''}`}>
              {editMem?.id === m.id ? (
                <>
                  <textarea value={editMem.text} onChange={(e) => setEditMem({ ...editMem, text: e.target.value })} rows={3} maxLength={10000} />
                  <button type="button" onClick={() => void run(() => api.put(`/relatives/memories/${m.id}`, { text: editMem.text, acting_member_id: acting })).then(() => setEditMem(null))}>
                    Save
                  </button>
                  <button type="button" className="link-button" onClick={() => setEditMem(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <p>{m.text}</p>
                  <div className="hint">
                    — {m.author_name ?? 'someone'}, {new Date(m.created_at).toLocaleDateString()}
                    {m.hidden ? ' · 🙈 hidden' : ''}
                    {mine && (
                      <>
                        {' · '}
                        <button type="button" className="link-button" onClick={() => setEditMem({ id: m.id, text: m.text })}>
                          edit
                        </button>
                        {' · '}
                        <button type="button" className="link-button" onClick={() => void run(() => api.put(`/relatives/memories/${m.id}`, { hidden: !m.hidden, acting_member_id: acting }))}>
                          {m.hidden ? 'show' : 'hide'}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <form
          className="relatives__add-memory"
          onSubmit={(e) => {
            e.preventDefault();
            if (memory.trim()) void run(() => api.post(`/relatives/${r.id}/memories`, { text: memory, acting_member_id: acting })).then(() => setMemory(''));
          }}
        >
          <textarea value={memory} onChange={(e) => setMemory(e.target.value)} rows={3} maxLength={10000} placeholder={`A memory of ${r.nickname || r.name}…`} />
          <button type="submit" disabled={!memory.trim()}>
            ＋ Add memory
          </button>
        </form>
      </section>

      {canSee('photos') && (
        <section className="panel">
          <h2>📷 Photos ({photos.length})</h2>
          <p className="hint">
            {r.person ? `Every photo with ${r.person.name}’s face (from 👥 People), plus any tagged here. ` : 'Link their face in ✏️ Edit to bring in every photo they’re in, or tag photos here. '}
            ✕ takes a photo off this page only — the photo itself isn’t touched.
          </p>
          <button type="button" className="secondary" onClick={() => setPicking(true)}>
            ＋ Tag photos
          </button>
          <div className="relatives__photos">
            {photos.map((p, i) => (
              <div key={p.id} className="relatives__photo">
                <button type="button" onClick={() => setViewing(i)} title={new Date(p.taken_at).toLocaleDateString()}>
                  <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
                  <ThumbYear photoId={p.id} />
                </button>
                <button type="button" className="relatives__untag" title="Take off this page" onClick={() => void run(() => api.post(`/relatives/${r.id}/photos`, { remove: [p.id], acting_member_id: acting }))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {canSee('movie-library') && (
        <section className="panel">
          <h2>🎬 Home movies ({r.movies.length})</h2>
          <button type="button" className="secondary" onClick={() => setMoviePick(true)}>
            ＋ Tag home movies
          </button>
          <ul className="relatives__movies">
            {r.movies.map((m) => (
              <li key={m.id}>
                <button type="button" className="link-button" onClick={() => setPlaying(m.id)}>
                  ▶ {m.title}
                </button>
                <span className="hint"> {m.recorded_at ? new Date(m.recorded_at).toLocaleDateString() : m.year ?? ''}</span>{' '}
                <button type="button" className="link-button" title="Take off this page" onClick={() => void run(() => api.post(`/relatives/${r.id}/movies`, { remove: [m.id], acting_member_id: acting }))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <RelativeForm
          relative={r}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
      {picking && (
        <PhotoPicker
          title={`Tag photos of ${r.nickname || r.name}`}
          alreadyAdded={new Set(r.photos.map((p) => p.id))}
          onAdd={(add) => {
            setPicking(false);
            void run(() => api.post(`/relatives/${r.id}/photos`, { add, acting_member_id: acting }));
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {moviePick && (
        <MoviePicker
          already={new Set(r.movies.map((m) => m.id))}
          onAdd={(add) => {
            setMoviePick(false);
            void run(() => api.post(`/relatives/${r.id}/movies`, { add, acting_member_id: acting }));
          }}
          onClose={() => setMoviePick(false)}
        />
      )}
      {viewing !== null && photos[viewing] && (
        <div className="photo-lightbox" onClick={() => setViewing(null)}>
          <img src={`/api/photos/${photos[viewing].id}/image`} alt="" />
          <div className="on-this-day__caption">{new Date(photos[viewing].taken_at).toLocaleDateString()}</div>
          <button className="photo-lightbox__close" onClick={() => setViewing(null)}>
            ✕
          </button>
          {photos.length > 1 && (
            <>
              <button
                className="photo-lightbox__nav photo-lightbox__nav--prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewing((viewing - 1 + photos.length) % photos.length);
                }}
              >
                ‹
              </button>
              <button
                className="photo-lightbox__nav photo-lightbox__nav--next"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewing((viewing + 1) % photos.length);
                }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
      {playing && (
        <div className="photo-lightbox" onClick={() => setPlaying(null)}>
          <video src={`/api/movie-library/${playing}/stream`} controls autoPlay onClick={(e) => e.stopPropagation()} className="relatives__video" />
          <button className="photo-lightbox__close" onClick={() => setPlaying(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

interface LibraryMovie {
  id: string;
  title: string;
  folder: string;
  year: number | null;
  recorded_at: string | null;
}

/** Pick home movies from 🎬 Movies, by searching their names and folders. */
function MoviePicker({ already, onAdd, onClose }: { already: Set<string>; onAdd: (ids: string[]) => void; onClose: () => void }) {
  const [movies, setMovies] = useState<LibraryMovie[] | null>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    api
      .get<{ movies: LibraryMovie[] }>('/movie-library')
      .then((l) => setMovies(l.movies))
      .catch(() => setMovies([]));
  }, []);
  const shown = (movies ?? []).filter((m) => !q || `${m.title} ${m.folder} ${m.year ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 200);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel task-form relatives__form" onClick={(e) => e.stopPropagation()}>
        <h2>🎬 Tag home movies</h2>
        <input type="search" placeholder="Search by name, folder or year…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search movies" />
        {movies === null && <p className="hint">Loading…</p>}
        <div className="relatives__movie-list">
          {shown.map((m) => (
            <label key={m.id} className="relatives__check">
              <input
                type="checkbox"
                disabled={already.has(m.id)}
                checked={already.has(m.id) || picked.includes(m.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))}
              />{' '}
              {m.title} <span className="hint">{m.folder} {m.year ?? ''}</span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={!picked.length} onClick={() => onAdd(picked)}>
            Tag {picked.length || ''}
          </button>
        </div>
      </div>
    </div>
  );
}
