import { useEffect, useState } from 'react';
import { api, type JournalEntry, type JournalPerson } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from './MemberAvatar.js';

/**
 * 🫙 Who a gratitude-jar note is about: household members and 👪 relatives. Names in the note tag
 * them on their own (the server matches them); a ✋ tag was picked by hand.
 */
export const SLIP_COLORS = ['#fff3bf', '#d3f9d8', '#d0ebff', '#ffdeeb', '#e5dbff', '#ffe8cc'];
const key = (p: { kind: string; id: string }) => `${p.kind}:${p.id}`;

/** Everyone a note can be about: members, then relatives (not hidden). */
export function usePeopleChoices(): JournalPerson[] {
  const { members } = useFamilyMembers();
  const [relatives, setRelatives] = useState<Array<{ id: string; name: string; nickname: string | null }>>([]);
  useEffect(() => {
    api
      .get<Array<{ id: string; name: string; nickname: string | null }>>('/relatives')
      .then(setRelatives)
      .catch(() => setRelatives([]));
  }, []);
  return [
    ...members.map((m) => ({ kind: 'member' as const, id: m.id, name: m.name, auto: false })),
    ...relatives.map((r) => ({ kind: 'relative' as const, id: r.id, name: r.nickname || r.name, auto: false })),
  ];
}

/** The chips for who it's about, with ✕ to take one off and a picker to add someone. */
export function PeopleChips({
  people,
  choices,
  onRemove,
  onAdd,
  label = 'About',
}: {
  people: JournalPerson[];
  choices: JournalPerson[];
  onRemove?: (p: JournalPerson) => void;
  onAdd?: (p: JournalPerson) => void;
  label?: string;
}) {
  const { members } = useFamilyMembers();
  const have = new Set(people.map(key));
  const left = choices.filter((c) => !have.has(key(c)));
  return (
    <div className="jar-people">
      <span className="hint">💛 {label}:</span>
      {people.length === 0 && !onAdd && <span className="hint">—</span>}
      {people.map((p) => (
        <span key={key(p)} className="jar-people__chip" title={p.auto ? 'Their name is in the note' : 'Picked by hand'}>
          {p.kind === 'member' ? <MemberAvatar member={members.find((m) => m.id === p.id) ?? null} size={16} /> : '👪'} {p.name}
          {onRemove && (
            <button type="button" className="link-button" aria-label={`Not about ${p.name}`} onClick={() => onRemove(p)}>
              ✕
            </button>
          )}
        </span>
      ))}
      {onAdd && left.length > 0 && (
        <select
          aria-label="Add someone it's about"
          value=""
          onChange={(e) => {
            const c = left.find((x) => key(x) === e.target.value);
            if (c) onAdd(c);
          }}
        >
          <option value="">＋ someone</option>
          {left.map((c) => (
            <option key={key(c)} value={key(c)}>
              {c.kind === 'relative' ? '👪 ' : ''}
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** 🫙 A section for a person's page: the jar notes about them. */
export function ThankfulFor({ kind, id, name }: { kind: 'member' | 'relative'; id: string; name: string }) {
  const { members } = useFamilyMembers();
  const [notes, setNotes] = useState<JournalEntry[] | null>(null);
  useEffect(() => {
    api
      .get<JournalEntry[]>(`/journal/jar/about?kind=${kind}&id=${encodeURIComponent(id)}`)
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [kind, id]);
  if (!notes?.length) return null;
  const by = (mid: string) => members.find((m) => m.id === mid) ?? null;
  return (
    <section className="panel">
      <h2>
        🫙 Thankful for {name} ({notes.length})
      </h2>
      <div className="jar__slips">
        {notes.map((s, i) => (
          <div key={s.id} className="jar__slip" style={{ background: SLIP_COLORS[s.id.charCodeAt(0) % SLIP_COLORS.length], rotate: `${((i * 37) % 7) - 3}deg` }}>
            <div>{s.text}</div>
            <div className="hint">
              <MemberAvatar member={by(s.family_member_id)} size={18} /> {by(s.family_member_id)?.name ?? ''} ·{' '}
              {new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
