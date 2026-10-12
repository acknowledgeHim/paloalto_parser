import type { FamilyMember } from '../api/client.js';

/**
 * Sorting and filtering for the lists of things people make (movies, documents): by date, title,
 * length, or owner — "owner" also splits the list under each person's name.
 */
export type OwnedSort = 'newest' | 'oldest' | 'title' | 'owner' | 'longest' | 'shortest';

interface Owned {
  title: string;
  created_by_id: string | null;
  created_at: string;
}

/** "🦖 Sam" — their emoji avatar (not an uploaded picture) in front of the name. */
export function ownerLabel(m: FamilyMember): string {
  return m.avatar && m.avatar !== 'image' && m.avatar !== 'video' ? `${m.avatar} ${m.name}` : m.name;
}

/** '' = everyone; NOBODY_OWNER = made by nobody in particular. */
export const NOBODY_OWNER = '-';

export function OwnedListControls({
  sort,
  onSort,
  owner,
  onOwner,
  members,
  lengthLabel,
  count,
  noun,
}: {
  sort: OwnedSort;
  onSort: (s: OwnedSort) => void;
  owner: string;
  onOwner: (id: string) => void;
  members: FamilyMember[];
  /** What "length" means here — e.g. ['Longest', 'Shortest'] or ['Most pictures', 'Fewest pictures']. */
  lengthLabel: [string, string];
  count: number;
  noun: string;
}) {
  return (
    <div className="owned-controls">
      <label className="member-form__label member-form__label--inline">
        Sort
        <select value={sort} onChange={(e) => onSort(e.target.value as OwnedSort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title (A–Z)</option>
          <option value="owner">By owner</option>
          <option value="longest">{lengthLabel[0]}</option>
          <option value="shortest">{lengthLabel[1]}</option>
        </select>
      </label>
      <label className="member-form__label member-form__label--inline">
        Owner
        <select value={owner} onChange={(e) => onOwner(e.target.value)}>
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{ownerLabel(m)}</option>
          ))}
          <option value={NOBODY_OWNER}>Nobody in particular</option>
        </select>
      </label>
      <span className="hint">{count.toLocaleString()} {noun}{count === 1 ? '' : 's'}</span>
    </div>
  );
}

/**
 * The items filtered by owner and sorted — as groups, one per owner (in family order, nobody last)
 * when sorting by owner, otherwise a single unlabeled group.
 */
export function sortOwned<T extends Owned>(
  items: T[],
  { sort, owner, members, length }: { sort: OwnedSort; owner: string; members: FamilyMember[]; length: (item: T) => number }
): Array<{ label: string | null; items: T[] }> {
  const filtered = items.filter((i) => owner === '' || (owner === NOBODY_OWNER ? !i.created_by_id || !members.some((m) => m.id === i.created_by_id) : i.created_by_id === owner));
  const newest = (a: T, b: T) => b.created_at.localeCompare(a.created_at);
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  const compare: Record<OwnedSort, (a: T, b: T) => number> = {
    newest,
    oldest: (a, b) => -newest(a, b),
    title: byTitle,
    owner: newest,
    longest: (a, b) => length(b) - length(a) || newest(a, b),
    shortest: (a, b) => length(a) - length(b) || newest(a, b),
  };
  const sorted = [...filtered].sort(compare[sort]);
  if (sort !== 'owner') return [{ label: null, items: sorted }];
  const groups = members
    .map((m) => ({ label: ownerLabel(m), items: sorted.filter((i) => i.created_by_id === m.id) }))
    .filter((g) => g.items.length);
  const nobody = sorted.filter((i) => !i.created_by_id || !members.some((m) => m.id === i.created_by_id));
  if (nobody.length) groups.push({ label: 'Nobody in particular', items: nobody });
  return groups;
}

/** "Oct 3, 2026" — when something was made. SQLite's "2026-10-03 14:00:00" (UTC) or ISO. */
export function fmtMadeOn(iso: string): string {
  const d = new Date(/T/.test(iso) ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
