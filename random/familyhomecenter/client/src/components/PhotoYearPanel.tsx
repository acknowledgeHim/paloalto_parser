import { useState } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { PHOTO_YEARS_CHANGED } from './ThumbYear.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }));

/**
 * 📅 Set the year (and maybe month) on the selected photos at once — for old ones whose date is just
 * when they were copied. Kept in the family database only; the photo files are never changed.
 */
export function PhotoYearPanel({
  photoIds,
  onDone,
}: {
  photoIds: string[];
  onDone: (changed: Array<{ id: string; taken_at: string; year_fixed: number | null }>) => void;
}) {
  const { activeProfile } = useFamilyMembers();
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (y: number | null) => {
    setSaving(true);
    setError(null);
    try {
      const r = await api.put<{ updated: number; photos: Array<{ id: string; taken_at: string; year_fixed: number | null }> }>('/photos/dates', {
        photo_ids: photoIds,
        year: y,
        month: y && month ? Number(month) : null,
        acting_member_id: activeProfile?.id ?? null,
      });
      window.dispatchEvent(new Event(PHOTO_YEARS_CHANGED));
      onDone(r.photos);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const y = Number(year);
  const ok = /^\d{4}$/.test(year) && y >= 1826 && y <= new Date().getFullYear() + 1;
  return (
    <div className="panel photo-year-panel">
      <strong>
        📅 When were {photoIds.length === 1 ? 'this photo' : `these ${photoIds.length} photos`} taken?
      </strong>
      <div className="photo-place__row">
        <input type="number" inputMode="numeric" min={1826} max={new Date().getFullYear() + 1} placeholder="Year, e.g. 1987" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year" />
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          <option value="">Month — keep each photo's</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <button type="button" disabled={!ok || saving} onClick={() => void save(y)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="secondary" disabled={saving} onClick={() => void save(null)} title="Take off a year set by hand">
          ↺ Use each photo's own date
        </button>
      </div>
      <p className="hint">Only the year (and month, if you pick one) changes; the day stays. Sorting, On this day, years-ago and movies all use it. The photo files aren't changed.</p>
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}
