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

/** Little corner tags on a photo tile. */
export function PhotoQualityTags({ p }: { p: { blurry: boolean | null; dup_group?: string | null; dup_best?: boolean } }) {
  if (!p.blurry && !(p.dup_group && !p.dup_best)) return null;
  return (
    <span className="photo-quality-tags">
      {p.blurry && <span>Possibly blurry</span>}
      {p.dup_group && !p.dup_best && <span>Duplicate</span>}
    </span>
  );
}
