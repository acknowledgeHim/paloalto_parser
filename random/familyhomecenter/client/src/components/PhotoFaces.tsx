import { useEffect, useState } from 'react';
import { api, type Face, type Person } from '../api/client.js';

/**
 * The faces in one photo, along the bottom of the photo viewer: a confirmed face shows its name; a
 * suggestion shows "Sam?" with ✓ / ✗; an unnamed face gets a quick "Who's this?" box. Tap a
 * confirmed name to change it (or "Not Sam" to un-name it). "+ Someone else" tags a person whose
 * face wasn't found (back of the head, side view…) — shown as a chip with × to take it off. Shows
 * nothing until there are faces here or people named somewhere.
 */
const ADDING = -1; // `naming` value for the "+ Someone else" box
export function PhotoFaces({ photoId, people, onChange }: { photoId: string; people: Person[]; onChange: () => void }) {
  const [faces, setFaces] = useState<Face[]>([]);
  const [naming, setNaming] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [tagged, setTagged] = useState<string[]>([]);
  const load = () =>
    Promise.all([
      api.get<Face[]>(`/faces/in-photo/${photoId}`).then(setFaces).catch(() => setFaces([])),
      api.get<string[]>(`/faces/tagged/${photoId}`).then(setTagged).catch(() => setTagged([])),
    ]);
  useEffect(() => {
    setNaming(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId]);

  if (faces.length === 0 && tagged.length === 0 && people.length === 0) return null;
  const personName = (id: string | null) => people.find((p) => p.id === id)?.name ?? '?';
  const run = async (fn: () => Promise<unknown>) => {
    await fn().catch(() => {});
    await load();
    onChange();
  };

  return (
    <div className="photo-faces" onClick={(e) => e.stopPropagation()}>
      {faces.map((f) => (
        <div key={f.id} className={`photo-faces__face ${f.confirmed ? '' : f.suggested_person_id ? 'photo-faces__face--suggested' : 'photo-faces__face--unknown'}`}>
          <img src={`/api/faces/${f.id}/image`} alt="" />
          {f.confirmed && f.person_id && naming !== f.id && (
            <button type="button" title="Change who this is" onClick={() => { setNaming(f.id); setName(personName(f.person_id)); }}>
              {personName(f.person_id)} ✎
            </button>
          )}
          {!f.confirmed && f.suggested_person_id && (
            <>
              <span>{personName(f.suggested_person_id)}?</span>
              <button type="button" aria-label="Yes" onClick={() => run(() => api.post('/faces/assign', { face_ids: [f.id], person_id: f.suggested_person_id }))}>✓</button>
              <button type="button" aria-label="No" onClick={() => run(() => api.post('/faces/reject', { face_ids: [f.id], person_id: f.suggested_person_id }))}>✗</button>
            </>
          )}
          {!f.confirmed && !f.suggested_person_id && naming !== f.id && (
            <button type="button" className="photo-faces__who" onClick={() => { setNaming(f.id); setName(''); }}>Who's this?</button>
          )}
          {!f.confirmed && naming !== f.id && (
            <button type="button" aria-label="Ignore this face" title="Not a face / don't name" onClick={() => run(() => api.post('/faces/ignore', { face_ids: [f.id] }))}>🚫</button>
          )}
          {naming === f.id && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = name.trim();
                if (!n) return;
                const was = f.confirmed ? f.person_id : null;
                if (was && n.toLowerCase() === personName(was).toLowerCase()) return setNaming(null);
                // Renaming a confirmed face: also tell it "not the old person", so they stop suggesting it.
                run(async () => {
                  if (was) await api.post('/faces/reject', { face_ids: [f.id], person_id: was });
                  await api.post('/faces/assign', { face_ids: [f.id], name: n });
                }).then(() => setNaming(null));
              }}
            >
              <input autoFocus list="photo-faces-people" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              <datalist id="photo-faces-people">
                {people.map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
              <button type="submit" disabled={!name.trim()}>✓</button>
              {f.confirmed && f.person_id && (
                <button
                  type="button"
                  title={`Not ${personName(f.person_id)} — back to unnamed`}
                  onClick={() => run(() => api.post('/faces/reject', { face_ids: [f.id], person_id: f.person_id })).then(() => setNaming(null))}
                >
                  Not {personName(f.person_id)}
                </button>
              )}
              <button type="button" aria-label="Cancel" onClick={() => setNaming(null)}>✕</button>
            </form>
          )}
        </div>
      ))}
      {tagged.map((id) => {
        const p = people.find((x) => x.id === id);
        return (
          <div key={`tag-${id}`} className="photo-faces__face" title="Tagged by hand">
            {p?.cover_face_id ? <img src={`/api/faces/${p.cover_face_id}/image`} alt="" /> : <span className="photo-faces__blank">👤</span>}
            <span>{p?.name ?? '?'}</span>
            <button type="button" aria-label={`Take ${p?.name ?? 'them'} off this photo`} onClick={() => run(() => api.post('/faces/untag', { photo_id: photoId, person_id: id }))}>×</button>
          </div>
        );
      })}
      {naming === ADDING ? (
        <div className="photo-faces__face">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) run(() => api.post('/faces/tag', { photo_id: photoId, name: name.trim() })).then(() => setNaming(null));
            }}
          >
            <input autoFocus list="photo-faces-people" value={name} onChange={(e) => setName(e.target.value)} placeholder="Who else is here?" />
            <datalist id="photo-faces-people">
              {people.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
            <button type="submit" disabled={!name.trim()}>✓</button>
            <button type="button" aria-label="Cancel" onClick={() => setNaming(null)}>✕</button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          className="photo-faces__add"
          title="Add someone whose face wasn't found — back of the head, side view…"
          onClick={() => { setNaming(ADDING); setName(''); }}
        >
          + Someone else
        </button>
      )}
    </div>
  );
}
