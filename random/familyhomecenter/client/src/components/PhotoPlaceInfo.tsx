import { useEffect, useState } from 'react';
import { api, type PhotoPlace, type PlaceLists } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

let listsPromise: Promise<PlaceLists> | null = null;
export const usePlaceLists = () => {
  const [lists, setLists] = useState<PlaceLists | null>(null);
  useEffect(() => {
    listsPromise ??= api.get<PlaceLists>('/photos/places/lists');
    listsPromise.then(setLists).catch(() => (listsPromise = null));
  }, []);
  return lists;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }));
export const placeLabel = (p: { country?: string | null; state?: string | null }) =>
  p.state ? `${p.state}${p.country && p.country !== 'United States' ? `, ${p.country}` : ''}` : p.country ?? '';

/**
 * 📍 In the photo viewer: where and when it was taken — from the photo's GPS/date, or what someone
 * set — and ✏️ to set the country (and state, in the US) and the year when it's missing or wrong.
 * Only kept in the family database; the photo file itself is never changed.
 */
export function PhotoPlaceInfo({ photoId, onChanged }: { photoId: string; onChanged?: (p: PhotoPlace) => void }) {
  const { activeProfile } = useFamilyMembers();
  const lists = usePlaceLists();
  const [place, setPlace] = useState<PhotoPlace | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ country_code: '', state: '', year: '', month: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let stale = false;
    setPlace(null);
    setEditing(false);
    setError(null);
    api
      .get<PhotoPlace>(`/photos/${photoId}/place`)
      .then((p) => !stale && setPlace(p))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [photoId]);

  if (!place) return null;
  const taken = new Date(place.taken_at);
  const photoSays = new Date(place.photo_taken_at);
  const where = placeLabel(place);

  const open = () => {
    setForm({
      // No place yet: start on the United States (most of ours are) — still changeable.
      country_code: place.country_code ?? 'US',
      state: place.state ?? '',
      year: String(place.year_fixed ?? taken.getFullYear()),
      month: place.month_fixed ? String(place.month_fixed) : '',
    });
    setError(null);
    setEditing(true);
  };
  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const p = await api.put<PhotoPlace>(`/photos/${photoId}/place`, { ...body, acting_member_id: activeProfile?.id ?? null });
      setPlace(p);
      setEditing(false);
      onChanged?.(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const submit = () => {
    const y = Number(form.year);
    // The year only counts as "set by hand" when it differs from what the photo says (or a month was picked).
    const yearChanged = form.year && (y !== photoSays.getFullYear() || form.month);
    save({
      country_code: form.country_code || null,
      state: form.country_code === 'US' ? form.state || null : null,
      year: yearChanged ? y : null,
      month: yearChanged && form.month ? Number(form.month) : null,
    });
  };

  return (
    <div className="photo-place" onClick={(e) => e.stopPropagation()}>
      {!editing ? (
        <div className="photo-place__pill">
          <span title={place.place_source === 'gps' ? 'From the photo’s GPS' : place.place_source === 'set' ? 'Set by the family' : ''}>
            📍 {where || <span className="photo-place__none">No location</span>}
            {place.place_source === 'set' && <span className="photo-place__tag"> ✍️</span>}
          </span>
          <span
            title={
              place.year_fixed
                ? `Set by hand — the photo says ${photoSays.toLocaleDateString()}`
                : place.date_from === 'folder'
                  ? 'No date inside the photo — from the folder it’s in'
                  : place.date_from === 'file'
                    ? 'No date inside the photo — the file’s own date (may be when it was copied)'
                    : 'From the photo'
            }
          >
            📅 {taken.toLocaleDateString(
              undefined,
              (place.year_fixed && !place.month_fixed) || (place.date_from === 'folder' && !place.year_fixed)
                ? { year: 'numeric', month: 'short' }
                : { year: 'numeric', month: 'short', day: 'numeric' }
            )}
            {place.year_fixed ? <span className="photo-place__tag"> ✍️</span> : null}
            {!place.year_fixed && place.date_from === 'folder' && <span className="photo-place__tag"> 📁</span>}
            {!place.year_fixed && place.date_from === 'file' && <span className="photo-place__tag"> ❔</span>}
          </span>
          {place.lat != null && place.lon != null && (
            <a
              className="photo-place__link"
              href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=14/${place.lat}/${place.lon}`}
              target="_blank"
              rel="noreferrer"
              title="Opens OpenStreetMap in a new tab"
            >
              {place.lat.toFixed(4)}, {place.lon.toFixed(4)} ↗
            </a>
          )}
          <button type="button" className="photo-place__edit" onClick={open} aria-label="Set where and when it was taken">
            ✏️
          </button>
        </div>
      ) : (
        <div className="photo-place__form">
          <strong>Where and when was this taken?</strong>
          <div className="photo-place__row">
            <select value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value, state: e.target.value === 'US' ? form.state : '' })} aria-label="Country">
              <option value="">{place.place_source === 'gps' ? 'Country (from GPS)' : 'Country — not set'}</option>
              {lists?.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            {form.country_code === 'US' && (
              <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} aria-label="State">
                <option value="">State — not set</option>
                {lists?.states.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="photo-place__row">
            <input type="number" min={1826} max={new Date().getFullYear() + 1} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} aria-label="Year" style={{ width: '7em' }} />
            <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} aria-label="Month">
              <option value="">Month — as the photo says</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <span className="photo-place__hint">
            The photo says {photoSays.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            {place.lat != null ? ' and has GPS' : ' and has no GPS'}. Saved here only — the photo file isn't changed.
          </span>
          {error && <span className="photo-place__error">{error}</span>}
          <div className="photo-place__row">
            <button type="button" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {(place.place_source === 'set' || place.year_fixed) && (
              <button type="button" className="secondary" disabled={saving} onClick={() => save({ country_code: null, state: null, year: null, month: null })}>
                Use what the photo says
              </button>
            )}
            <button type="button" className="secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
