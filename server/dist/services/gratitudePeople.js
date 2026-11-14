import { db } from '../db.js';
/** First names that are also everyday words: these only match written with a capital letter. */
const COMMON = new Set('will may grace hope joy mark rose art bill faith june april august sunny summer dawn ray pat sky frank honey buddy chip skip bob sue penny holly rich gene drew sage river reed hunter'.split(' '));
function termsFor(name, nickname) {
    const out = new Set();
    for (const raw of [name, nickname ?? '']) {
        const t = raw.trim();
        if (t.length >= 2)
            out.add(t);
        const first = t.split(/\s+/)[0];
        if (first && first.length >= 3)
            out.add(first);
    }
    return [...out];
}
function candidates() {
    const members = db.prepare('SELECT id, name FROM family_members').all();
    const relatives = db.prepare('SELECT id, name, nickname, family_member_id FROM relatives WHERE hidden = 0').all();
    return [
        ...members.map((m) => ({ kind: 'member', id: m.id, name: m.name, member_id: m.id, terms: termsFor(m.name, null) })),
        ...relatives.map((r) => ({ kind: 'relative', id: r.id, name: r.nickname || r.name, member_id: r.family_member_id, terms: termsFor(r.name, r.nickname) })),
    ];
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Is this name/term in the text as a whole word ("Grandma's" counts, "Roses" doesn't match Rose)? */
function mentions(text, term) {
    // names that are also everyday words ("will", "may") only count written with a capital
    const common = COMMON.has(term.toLowerCase());
    const word = common ? term[0].toUpperCase() + term.slice(1) : term;
    return new RegExp(`(^|[^\\p{L}])${escape(word)}(?![\\p{L}])`, common ? 'u' : 'iu').test(text);
}
/** People whose name is in the text (not the writer, nor a relative who is the writer). */
export function matchPeople(text, writerId, list = candidates()) {
    if (!text)
        return [];
    return list.filter((c) => !(writerId && c.member_id === writerId) && c.terms.some((t) => mentions(text, t)));
}
/** Who each of these notes is about: name matches, plus tags by hand, minus untags. */
export function peopleFor(entries) {
    const list = candidates();
    const byKey = new Map(list.map((c) => [`${c.kind}:${c.id}`, c]));
    const rows = new Map();
    const ids = entries.map((e) => e.id);
    for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        for (const r of db.prepare(`SELECT entry_id, person_kind, person_id, tagged FROM journal_entry_people WHERE entry_id IN (${chunk.map(() => '?').join(',')})`).all(...chunk))
            rows.set(r.entry_id, [...(rows.get(r.entry_id) ?? []), r]);
    }
    const out = new Map();
    for (const e of entries) {
        const set = new Map();
        for (const c of matchPeople(e.text, e.family_member_id, list))
            set.set(`${c.kind}:${c.id}`, { kind: c.kind, id: c.id, name: c.name, auto: true });
        for (const r of rows.get(e.id) ?? []) {
            const key = `${r.person_kind}:${r.person_id}`;
            if (!r.tagged)
                set.delete(key);
            else if (byKey.has(key))
                set.set(key, { kind: r.person_kind, id: r.person_id, name: byKey.get(key).name, auto: false });
        }
        out.set(e.id, [...set.values()]);
    }
    return out;
}
/** Tag (or untag) someone on a note. */
export function setPerson(entryId, kind, personId, tagged, by) {
    db.prepare(`INSERT INTO journal_entry_people (entry_id, person_kind, person_id, tagged, set_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(entry_id, person_kind, person_id) DO UPDATE SET tagged = excluded.tagged, set_by = excluded.set_by, updated_at = excluded.updated_at`).run(entryId, kind, personId, tagged ? 1 : 0, by, new Date().toISOString());
}
/** Does this person exist (so a tag points at someone real)? */
export function personExists(kind, id) {
    return Boolean(db.prepare(kind === 'member' ? 'SELECT 1 FROM family_members WHERE id = ?' : 'SELECT 1 FROM relatives WHERE id = ?').get(id));
}
/** The same person seen from the other side: a relative's household member, or a member's relative(s). */
export function linkedKeys(kind, id) {
    const keys = new Set([`${kind}:${id}`]);
    if (kind === 'relative') {
        const m = db.prepare('SELECT family_member_id FROM relatives WHERE id = ?').get(id)?.family_member_id;
        if (m)
            keys.add(`member:${m}`);
    }
    else
        for (const r of db.prepare('SELECT id FROM relatives WHERE family_member_id = ?').all(id))
            keys.add(`relative:${r.id}`);
    return keys;
}
