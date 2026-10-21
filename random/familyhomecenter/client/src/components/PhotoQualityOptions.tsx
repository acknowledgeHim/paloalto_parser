import type { PhotoQualityFilter } from '../utils/photoDetails.js';

/**
 * The blurry/duplicate photo options, shared by every photo picker and the Photos page. Based on a
 * background analysis of each photo (server/src/services/photoAnalysis.ts) — "possibly", since a
 * deliberately soft photo can look blurry to it, and photos not analyzed yet are always included.
 */
export function PhotoQualityOptions({
  value,
  onChange,
  showDuplicates = true,
}: {
  value: PhotoQualityFilter;
  onChange: (v: PhotoQualityFilter) => void;
  showDuplicates?: boolean;
}) {
  return (
    <div className="task-form__row photo-quality-options">
      <label className="member-form__label member-form__label--inline">
        Blurry photos
        <select
          value={value.excludeBlurry ? 'exclude' : 'include'}
          onChange={(e) => onChange({ ...value, excludeBlurry: e.target.value === 'exclude' })}
        >
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
      </label>
      {showDuplicates && (
        <label className="member-form__label member-form__label--inline">
          Duplicates
          <select
            value={value.excludeDuplicates ? 'best' : 'all'}
            onChange={(e) => onChange({ ...value, excludeDuplicates: e.target.value === 'best' })}
          >
            <option value="all">Include all</option>
            <option value="best">Keep only the best of each</option>
          </select>
        </label>
      )}
    </div>
  );
}

/** Little corner tags on a photo tile — kept tiny so the photo still shows. Short words; the full meaning on hover. */
export function PhotoQualityTags({ p }: { p: { blurry: boolean | null; dup_group?: string | null; dup_best?: boolean } }) {
  if (!p.blurry && !(p.dup_group && !p.dup_best)) return null;
  return (
    <span className="photo-quality-tags">
      {p.blurry && <span title="Possibly blurry">Blurry</span>}
      {p.dup_group && !p.dup_best && <span title="Duplicate — a sharper or bigger copy of this shot is kept">Dup</span>}
    </span>
  );
}

/** US state names → their two letters, for the tiny 📍 tag. */
const US: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
  Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};

/** Tiny year and 📍 place tags along the bottom of a photo tile (when they're known). */
export function PhotoInfoTags({
  p,
}: {
  p: { taken_at?: string; year_fixed?: number | null; country?: string | null; state?: string | null; place_source?: 'gps' | 'set' | null };
}) {
  const year = p.taken_at ? new Date(p.taken_at).getFullYear() : null;
  const where = p.state ? US[p.state] ?? p.state : p.country ?? null;
  const full = p.state ? `${p.state}${p.country && p.country !== 'United States' ? `, ${p.country}` : ''}` : p.country;
  if (!year && !where) return null;
  return (
    <span className="photo-info-tags">
      {year && <span title={p.year_fixed ? `Taken ${year} (year set by hand)` : `Taken ${year}`}>{year}{p.year_fixed ? '✍' : ''}</span>}
      {where && <span title={`${full}${p.place_source === 'set' ? ' (set by hand)' : ' (from GPS)'}`}>📍{where}</span>}
    </span>
  );
}