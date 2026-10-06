import { useEffect, useState } from 'react';
import { api, type Face, type Person } from '../api/client.js';

/**
 * The faces in one photo, along the bottom of the photo viewer: a confirmed face shows its name; a
 * suggestion shows "Sam?" with ✓ / ✗; an unnamed face gets a quick "Who's this?" box. Shows nothing
 * when face recognition is off or the photo hasn't been looked at yet.
 */
export function PhotoFaces({ photoId, people, onChange }: { photoId: string; people: Person[]; onChange: () => void }) {
  const [faces, setFaces] = useState<Face[]>([]);
  const [naming, setNaming] = useState<number | null>(null);
  const [name, setName] = useState('');
  const load = () => api.get<Face[]>(`/faces/in-photo/${photoId}`).then(setFaces).catch(() => setFaces([]));
  useEffect(() => {
    setNaming(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId]);

  if (faces.length === 0) return null;
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
          {f.confirmed && f.person_id && <span>{personName(f.person_id)}</span>}
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
                if (name.trim()) run(() => api.post('/faces/assign', { face_ids: [f.id], name: name.trim() })).then(() => setNaming(null));
              }}
            >
              <input autoFocus list="photo-faces-people" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              <datalist id="photo-faces-people">
                {people.map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
              <button type="submit" disabled={!name.trim()}>✓</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
