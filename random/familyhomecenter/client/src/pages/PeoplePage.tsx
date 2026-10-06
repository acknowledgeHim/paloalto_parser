import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Face, type FaceStatus, type Person } from '../api/client.js';

/**
 * Photos → 👥 People: face recognition (server/src/services/faces/). Name a few faces, and the app
 * suggests the rest for someone to confirm or reject — nothing is tagged without a person saying
 * so. Everything happens on the Pi: no photo, face, or faceprint ever leaves it.
 */
export function PeoplePage() {
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<Face[][]>([]);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [tab, setTab] = useState<'groups' | 'photos'>('groups');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get<FaceStatus>('/faces/status').then(setStatus).catch(() => {});
    api.get<Person[]>('/faces/people').then(setPeople).catch(() => {});
    api.get<Face[][]>('/faces/groups').then(setGroups).catch(() => {});
  };
  useEffect(() => {
    load();
    // Keep the scan progress (and new faces) coming in while it works through the library.
    const t = setInterval(() => api.get<FaceStatus>('/faces/status').then(setStatus).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
    load();
  };

  const toggleEnabled = async (enabled: boolean) => {
    setBusy(true);
    await act(() => api.put('/faces/enabled', { enabled }));
    setBusy(false);
  };

  if (!status) return <div className="empty-state">Loading…</div>;
  const person = people.find((p) => p.id === openPerson);

  return (
    <div className="people-page">
      <div className="photos-page__toolbar">
        <h1>👥 People</h1>
        <Link to="/photos" className="movie-maker__download">← Photos</Link>
      </div>
      {error && <div className="settings-login__error">{error}</div>}

      {!status.enabled ? (
        <section className="panel">
          <h2>Find people in your photos</h2>
          <p>
            Turn this on and the Pi looks for faces in your photos. Name a few, and it suggests who's
            who in the rest for you to confirm.
          </p>
          <p className="hint">
            <strong>Private:</strong> it all happens on this Pi — no photos, faces, or anything about
            them are ever sent anywhere. Turning it on downloads two small face models once (about
            40 MB) unless they're already here (see docs/PHOTOS_SETUP.md to copy them in by hand).
            The first pass over a big library takes a while (hours on a Pi), quietly in the background.
          </p>
          <button type="button" onClick={() => toggleEnabled(true)} disabled={busy}>
            {busy ? 'Getting ready… (downloading the face models)' : 'Turn on face recognition'}
          </button>
          <p className="hint">Parents only.</p>
        </section>
      ) : (
        <p className="hint people-page__status">
          Looked at {status.scanned.toLocaleString()} of {status.total.toLocaleString()} photos
          {status.scanned < status.total ? ' (still going, in the background)' : ''} · {status.faces.toLocaleString()} faces found ·{' '}
          <button type="button" className="link-button" onClick={() => toggleEnabled(false)} disabled={busy}>Turn off</button>
          {status.ignored > 0 && (
            <>
              {' · '}
              {status.ignored} ignored{' '}
              <button type="button" className="link-button" onClick={() => act(() => api.post('/faces/unignore-all'))}>Bring back</button>
            </>
          )}
          {status.error && <span className="internet-page__bad"> · Last problem: {status.error}</span>}
        </p>
      )}

      {status.enabled && person && (
        <PersonDetail person={person} people={people} onClose={() => setOpenPerson(null)} act={act} />
      )}

      {status.enabled && !person && (
        <>
          {people.length > 0 && (
            <section className="panel">
              <h2>People</h2>
              <div className="people-grid">
                {people.map((p) => (
                  <button key={p.id} type="button" className="people-card" onClick={() => setOpenPerson(p.id)}>
                    {p.cover_face_id ? <img src={`/api/faces/${p.cover_face_id}/image`} alt="" /> : <div className="people-card__blank">?</div>}
                    <strong>{p.name}</strong>
                    <span className="hint">{p.photo_count} photo{p.photo_count === 1 ? '' : 's'}</span>
                    {p.suggested_count > 0 && <span className="people-card__check">{p.suggested_count} to check</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="people-tabs">
            <button type="button" className={tab === 'groups' ? '' : 'secondary'} onClick={() => setTab('groups')}>Who's this? (groups)</button>
            <button type="button" className={tab === 'photos' ? '' : 'secondary'} onClick={() => setTab('photos')}>Name faces photo by photo</button>
          </div>

          {tab === 'photos' && <PhotoByPhoto people={people} onChange={load} />}

          {tab === 'groups' && (
            <section className="panel">
              <h2>Who's this?</h2>
              <p className="hint">
                Unnamed faces that look like the same person. Tap faces to pick which ones you're naming
                (all are picked to start), then type who it is. Not the same person at all? <strong>Different
                people</strong> sends them to be named one by one under <em>photo by photo</em>.
              </p>
              {groups.length === 0 && (
                <p className="empty-state">
                  {status.faces === 0
                    ? 'No faces found yet — give the scan a little time.'
                    : 'No groups right now — everyone found either has a name or a suggestion, or is easier to name photo by photo.'}
                </p>
              )}
              {groups.map((g) => (
                <NameGroup key={g.map((f) => f.id).join(',')} faces={g} people={people} act={act} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

type Act = (fn: () => Promise<unknown>) => Promise<void>;

function NameGroup({ faces, people, act }: { faces: Face[]; people: Person[]; act: Act }) {
  // Which faces this name applies to — all to start; tap to take one out (or back in).
  const [picked, setPicked] = useState<Set<number>>(() => new Set(faces.map((f) => f.id)));
  const [name, setName] = useState('');
  const chosen = faces.filter((f) => picked.has(f.id));
  const ids = chosen.map((f) => f.id);
  const toggle = (id: number) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="people-group">
      <div className="people-faces">
        {faces.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`people-face ${picked.has(f.id) ? 'people-face--picked' : 'people-face--off'}`}
            title={picked.has(f.id) ? 'Picked — tap to leave out' : 'Left out — tap to pick'}
            onClick={() => toggle(f.id)}
          >
            <img src={`/api/faces/${f.id}/image`} alt="" loading="lazy" />
            {picked.has(f.id) && <span className="people-face__tick">✓</span>}
          </button>
        ))}
      </div>
      <div className="task-form__row people-group__tools">
        <button type="button" className="link-button" onClick={() => setPicked(new Set(faces.map((f) => f.id)))}>All</button>
        <button type="button" className="link-button" onClick={() => setPicked(new Set())}>None</button>
        <span className="hint">{chosen.length} of {faces.length} picked</span>
      </div>
      <form
        className="task-form__row people-group__name"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && ids.length) act(() => api.post('/faces/assign', { face_ids: ids, name: name.trim() }));
        }}
      >
        <input placeholder="Who is this?" list="people-names" value={name} onChange={(e) => setName(e.target.value)} />
        <datalist id="people-names">
          {people.map((p) => <option key={p.id} value={p.name} />)}
        </datalist>
        <button type="submit" disabled={!name.trim() || ids.length === 0}>
          Name {ids.length > 1 ? `these ${ids.length}` : 'this one'}
        </button>
      </form>
      <div className="task-form__row people-group__tools">
        <button
          type="button"
          className="secondary"
          title="These aren't all the same person — name them one at a time instead"
          onClick={() => act(() => api.post('/faces/separate', { face_ids: faces.map((f) => f.id) }))}
        >
          Different people
        </button>
        <button
          type="button"
          className="secondary"
          disabled={ids.length === 0}
          title="Not a face, or someone you don't need to name (a stranger in the background, a poster…)"
          onClick={() => act(() => api.post('/faces/ignore', { face_ids: ids }))}
        >
          🚫 Ignore picked ({ids.length})
        </button>
      </div>
    </div>
  );
}

/**
 * Going through photos one at a time: the photo with each face boxed and numbered, and beside it
 * each face's name (confirm/reject a suggestion, type a new one, or ignore it). Includes the small
 * and turned-away faces that are left out of automatic grouping.
 */
function PhotoByPhoto({ people, onChange }: { people: Person[]; onChange: () => void }) {
  const [queue, setQueue] = useState<Array<{ photo_id: string; faces: number }> | null>(null);
  const [index, setIndex] = useState(0);
  const [faces, setFaces] = useState<Face[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [highlight, setHighlight] = useState<number | null>(null);

  const loadQueue = () => api.get<Array<{ photo_id: string; faces: number }>>('/faces/queue').then(setQueue).catch(() => setQueue([]));
  useEffect(() => {
    loadQueue();
  }, []);
  const current = queue?.[Math.min(index, (queue?.length ?? 1) - 1)];
  const loadFaces = () => {
    if (!current) return setFaces([]);
    api.get<Face[]>(`/faces/in-photo/${current.photo_id}`).then(setFaces).catch(() => setFaces([]));
  };
  useEffect(() => {
    setNames({});
    loadFaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.photo_id]);

  const run = async (fn: () => Promise<unknown>) => {
    await fn().catch(() => {});
    loadFaces();
    onChange();
  };
  const go = (delta: number) => {
    if (!queue?.length) return;
    // Refresh the queue as we go (finished photos drop out), keeping our place.
    const nextIndex = Math.max(0, Math.min(queue.length - 1, index + delta));
    const target = queue[nextIndex]?.photo_id;
    api.get<Array<{ photo_id: string; faces: number }>>('/faces/queue').then((q) => {
      setQueue(q);
      const at = target ? q.findIndex((p) => p.photo_id === target) : -1;
      setIndex(at >= 0 ? at : Math.min(nextIndex, Math.max(0, q.length - 1)));
    });
  };
  const personName = (id: string | null) => people.find((p) => p.id === id)?.name ?? '?';

  if (!queue) return <p className="hint">Loading…</p>;
  if (!current) return <section className="panel"><p className="empty-state">Every face found so far has a name. 🎉</p></section>;

  return (
    <section className="panel">
      <div className="people-pbp__nav">
        <button type="button" className="secondary" onClick={() => go(-1)} disabled={index === 0}>‹ Previous</button>
        <span className="hint">Photo {Math.min(index, queue.length - 1) + 1} of {queue.length} with faces to name</span>
        <button type="button" onClick={() => go(1)} disabled={index >= queue.length - 1}>Next photo ›</button>
      </div>
      <div className="people-pbp">
        <div className="people-pbp__photo">
          <img src={`/api/photos/${current.photo_id}/image`} alt="" />
          {faces.map((f, i) => (
            <div
              key={f.id}
              className={`people-pbp__box ${f.confirmed ? 'people-pbp__box--named' : ''} ${highlight === f.id ? 'people-pbp__box--hl' : ''}`}
              style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
            >
              <span>{i + 1}</span>
            </div>
          ))}
        </div>
        <ol className="people-pbp__faces">
          {faces.map((f, i) => (
            <li key={f.id} onMouseEnter={() => setHighlight(f.id)} onMouseLeave={() => setHighlight(null)}>
              <span className="people-pbp__n">{i + 1}</span>
              <img src={`/api/faces/${f.id}/image`} alt="" />
              <div className="people-pbp__who">
                {f.confirmed ? (
                  <>
                    <strong>{personName(f.person_id)}</strong>
                    <button type="button" className="link-button" onClick={() => run(() => api.post('/faces/reject', { face_ids: [f.id], person_id: f.person_id }))}>
                      Not {personName(f.person_id)}
                    </button>
                  </>
                ) : (
                  <>
                    {f.suggested_person_id && (
                      <div className="people-pbp__suggest">
                        <span>{personName(f.suggested_person_id)}?</span>
                        <button type="button" onClick={() => run(() => api.post('/faces/assign', { face_ids: [f.id], person_id: f.suggested_person_id }))}>✓ Yes</button>
                        <button type="button" className="secondary" onClick={() => run(() => api.post('/faces/reject', { face_ids: [f.id], person_id: f.suggested_person_id }))}>✗ No</button>
                      </div>
                    )}
                    <form
                      className="people-pbp__name"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const n = (names[f.id] ?? '').trim();
                        if (n) run(() => api.post('/faces/assign', { face_ids: [f.id], name: n }));
                      }}
                    >
                      <input
                        list="people-names-pbp"
                        placeholder={f.suggested_person_id ? 'Or someone else…' : 'Who is this?'}
                        value={names[f.id] ?? ''}
                        onChange={(e) => setNames((cur) => ({ ...cur, [f.id]: e.target.value }))}
                      />
                      <button type="submit" disabled={!(names[f.id] ?? '').trim()}>Save</button>
                    </form>
                    <button type="button" className="link-button" title="Not a face, or someone you don't need to name" onClick={() => run(() => api.post('/faces/ignore', { face_ids: [f.id] }))}>
                      🚫 Ignore
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
        <datalist id="people-names-pbp">
          {people.map((p) => <option key={p.id} value={p.name} />)}
        </datalist>
      </div>
    </section>
  );
}

function PersonDetail({ person, people, onClose, act }: { person: Person; people: Person[]; onClose: () => void; act: Act }) {
  const [detail, setDetail] = useState<{ confirmed: Face[]; suggested: Face[] } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const load = () => api.get<{ confirmed: Face[]; suggested: Face[] }>(`/faces/people/${person.id}`).then(setDetail).catch(() => {});
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id, people]);
  const run = (fn: () => Promise<unknown>) => act(fn).then(load);

  return (
    <section className="panel">
      <div className="people-detail__head">
        <button type="button" className="secondary" onClick={onClose}>← All people</button>
        {renaming === null ? (
          <h2>{person.name}</h2>
        ) : (
          <form
            className="task-form__row"
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming.trim()) run(() => api.patch(`/faces/people/${person.id}`, { name: renaming.trim() })).then(() => setRenaming(null));
            }}
          >
            <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} />
            <button type="submit">Save</button>
          </form>
        )}
        <span className="people-detail__actions">
          <button type="button" className="link-button" onClick={() => setRenaming(person.name)}>Rename</button>
          <Link className="link-button" to={`/photos?person=${person.id}`}>See their photos</Link>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              if (window.confirm(`Forget "${person.name}"? Their faces go back to unnamed; photos aren't touched.`)) {
                act(() => api.delete(`/faces/people/${person.id}`)).then(onClose);
              }
            }}
          >
            Forget this person
          </button>
        </span>
      </div>

      {detail && detail.suggested.length > 0 && (
        <>
          <h3>Is this {person.name}? ({detail.suggested.length})</h3>
          <div className="task-form__row">
            <button type="button" onClick={() => run(() => api.post('/faces/assign', { face_ids: detail.suggested.map((f) => f.id), person_id: person.id }))}>
              ✓ Yes to all
            </button>
          </div>
          <div className="people-faces">
            {detail.suggested.map((f) => (
              <div key={f.id} className="people-face people-face--suggested">
                <img src={`/api/faces/${f.id}/image`} alt="" loading="lazy" />
                <span className="people-face__actions">
                  <button type="button" aria-label="Yes" onClick={() => run(() => api.post('/faces/assign', { face_ids: [f.id], person_id: person.id }))}>✓</button>
                  <button type="button" aria-label="No" onClick={() => run(() => api.post('/faces/reject', { face_ids: [f.id], person_id: person.id }))}>✗</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>{person.name} ({detail?.confirmed.length ?? 0})</h3>
      <p className="hint">The more photos of {person.name} you confirm — especially from different ages — the better the suggestions.</p>
      <div className="people-faces">
        {detail?.confirmed.map((f) => (
          <div key={f.id} className="people-face">
            <img src={`/api/faces/${f.id}/image`} alt="" loading="lazy" />
            <span className="people-face__actions">
              <button type="button" aria-label="Not them" title={`Not ${person.name}`} onClick={() => run(() => api.post('/faces/reject', { face_ids: [f.id], person_id: person.id }))}>✗</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
