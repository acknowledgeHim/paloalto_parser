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

          <section className="panel">
            <h2>Who's this?</h2>
            <p className="hint">
              Faces nobody's named yet, grouped by who they probably are. Tap any face that doesn't
              belong to leave it out, then type who it is.
            </p>
            {groups.length === 0 && (
              <p className="empty-state">
                {status.faces === 0 ? 'No faces found yet — give the scan a little time.' : 'Everyone found so far has a name or a suggestion. 🎉'}
              </p>
            )}
            {groups.map((g) => (
              <NameGroup key={g.map((f) => f.id).join(',')} faces={g} people={people} act={act} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

type Act = (fn: () => Promise<unknown>) => Promise<void>;

function NameGroup({ faces, people, act }: { faces: Face[]; people: Person[]; act: Act }) {
  const [left, setLeft] = useState<Set<number>>(new Set());
  const [name, setName] = useState('');
  const chosen = faces.filter((f) => !left.has(f.id));
  return (
    <div className="people-group">
      <div className="people-faces">
        {faces.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`people-face ${left.has(f.id) ? 'people-face--off' : ''}`}
            title={left.has(f.id) ? 'Left out — tap to include' : 'Tap to leave this one out'}
            onClick={() =>
              setLeft((cur) => {
                const next = new Set(cur);
                if (next.has(f.id)) next.delete(f.id);
                else next.add(f.id);
                return next;
              })
            }
          >
            <img src={`/api/faces/${f.id}/image`} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      <form
        className="task-form__row people-group__name"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && chosen.length) act(() => api.post('/faces/assign', { face_ids: chosen.map((f) => f.id), name: name.trim() }));
        }}
      >
        <input placeholder="Who is this?" list="people-names" value={name} onChange={(e) => setName(e.target.value)} />
        <datalist id="people-names">
          {people.map((p) => <option key={p.id} value={p.name} />)}
        </datalist>
        <button type="submit" disabled={!name.trim() || chosen.length === 0}>
          Save{chosen.length > 1 ? ` (${chosen.length})` : ''}
        </button>
      </form>
    </div>
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
