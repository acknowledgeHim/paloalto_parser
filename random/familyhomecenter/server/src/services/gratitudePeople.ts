import { db } from '../db.js';

/**
 * 🫙 Who a gratitude-jar note is about: family members (their 👤 page) and 👪 relatives (theirs).
 * A name in the note (or a relative's nickname, like "Grandma") tags them on its own. That match is
 * worked out each time from the note's words, so old notes and people added later match too. Someone
 * can also be tagged by hand, or untagged from a match that's wrong ("Will" in "I will …"). Those
 * choices are rows in journal_entry_people; nothing else is changed.
 */
export type PersonKind = 'member' | 'relative';
export interface TaggedPerson {
  kind: PersonKind;
  id: string;
  name: string;
  /** true = found by name in the note (not tagged by hand) */
  auto: boolean;
}
interface Candidate {
  kind: PersonKind;
  id: string;
  name: string;
  /** the household member a relative is (a note about either shows on both pages) */
  member_id: string | null;
  terms: string[];
}

/** First names that are also everyday words: these only match written with a capital letter. */
const COMMON = new Set(
  'will may grace hope joy mark rose art bill faith june april august sunny summer dawn ray pat sky frank honey buddy chip skip bob sue penny holly rich gene drew sage river reed hunter'.split(
    ' '
  )
);

function termsFor(name: string, nickname: string | null): string[] {
  const out = new Set<string>();
  for (const raw of [name, nickname ?? '']) {
    const t = raw.trim();
    if (t.length >= 2) out.add(t);
    const first = t.split(/\s+/)[0];
    if (first && first.length >= 3) out.add(first);
  }
  return [...out];
}

function candidates(): Candidate[] {
  const members = db.prepare('SELECT id, name FROM family_members').all() as Array<{ id: string; name: string }>;
  const relatives = db.prepare('SELECT id, name, nickname, family_member_id FROM relatives WHERE hidden = 0').all() as Array<{
    id: string;
    name: string;
    nickname: string | null;
    family_member_id: string | null;
  }>;
  return [
    ...members.map((m) => ({ kind: 'member' as const, id: m.id, name: m.name, member_id: m.id, terms: termsFor(m.name, null) })),
    ...relatives.map((r) => ({ kind: 'relative' as const, id: r.id, name: r.nickname || r.name, member_id: r.family_member_id, terms: termsFor(r.name, r.nickname) })),
  ];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Is this name/term in the text as a whole word ("Grandma's" counts, "Roses" doesn't match Rose)? */
function mentions(text: string, term: string): boolean {
  // names that are also everyday words ("will", "may") only count written with a capital
  const common = COMMON.has(term.toLowerCase());
  const word = common ? term[0].toUpperCase() + term.slice(1) : term;
  return new RegExp(`(^|[^\\p{L}])${escape(word)}(?![\\p{L}])`, common ? 'u' : 'iu').test(text);
}

/** People whose name is in the text (not the writer, nor a relative who is the writer). */
export function matchPeople(text: string | null, writerId?: string, list = candidates()): Candidate[] {
  if (!text) return [];
  return list.filter((c) => !(writerId && c.member_id === writerId) && c.terms.some((t) => mentions(text, t)));
}

interface Row {
  entry_id: string;
  person_kind: PersonKind;
  person_id: string;
  tagged: number;
}
/** Who each of these notes is about: name matches, plus tags by hand, minus untags. */
export function peopleFor(entries: Array<{ id: string; family_member_id: string; text: string | null }>): Map<string, TaggedPerson[]> {
  const list = candidates();
  const byKey = new Map(list.map((c) => [`${c.kind}:${c.id}`, c]));
  const rows = new Map<string, Row[]>();
  const ids = entries.map((e) => e.id);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    for (const r of db.prepare(`SELECT entry_id, person_kind, person_id, tagged FROM journal_entry_people WHERE entry_id IN (${chunk.map(() => '?').join(',')})`).all(...chunk) as Row[])
      rows.set(r.entry_id, [...(rows.get(r.entry_id) ?? []), r]);
  }
  const out = new Map<string, TaggedPerson[]>();
  for (const e of entries) {
    const set = new Map<string, TaggedPerson>();
    for (const c of matchPeople(e.text, e.family_member_id, list)) set.set(`${c.kind}:${c.id}`, { kind: c.kind, id: c.id, name: c.name, auto: true });
    for (const r of rows.get(e.id) ?? []) {
      const key = `${r.person_kind}:${r.person_id}`;
      if (!r.tagged) set.delete(key);
      else if (byKey.has(key)) set.set(key, { kind: r.person_kind, id: r.person_id, name: byKey.get(key)!.name, auto: false });
    }
    out.set(e.id, [...set.values()]);
  }
  return out;
}

/** Tag (or untag) someone on a note. */
export function setPerson(entryId: string, kind: PersonKind, personId: string, tagged: boolean, by: string | null) {
  db.prepare(
    `INSERT INTO journal_entry_people (entry_id, person_kind, person_id, tagged, set_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(entry_id, person_kind, person_id) DO UPDATE SET tagged = excluded.tagged, set_by = excluded.set_by, updated_at = excluded.updated_at`
  ).run(entryId, kind, personId, tagged ? 1 : 0, by, new Date().toISOString());
}

/** Does this person exist (so a tag points at someone real)? */
export function personExists(kind: PersonKind, id: string): boolean {
  return Boolean(db.prepare(kind === 'member' ? 'SELECT 1 FROM family_members WHERE id = ?' : 'SELECT 1 FROM relatives WHERE id = ?').get(id));
}

/** The same person seen from the other side: a relative's household member, or a member's relative(s). */
export function linkedKeys(kind: PersonKind, id: string): Set<string> {
  const keys = new Set([`${kind}:${id}`]);
  if (kind === 'relative') {
    const m = (db.prepare('SELECT family_member_id FROM relatives WHERE id = ?').get(id) as { family_member_id: string | null } | undefined)?.family_member_id;
    if (m) keys.add(`member:${m}`);
  } else for (const r of db.prepare('SELECT id FROM relatives WHERE family_member_id = ?').all(id) as Array<{ id: string }>) keys.add(`relative:${r.id}`);
  return keys;
}
