import { useState } from 'react';
import { api, type FamilyMember } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { DressedAvatar } from './DressedAvatar.js';

export const PLACES: Array<{ id: string; emoji: string; label: string }> = [
  { id: 'home', emoji: '🏠', label: 'Home' },
  { id: 'school', emoji: '🏫', label: 'School' },
  { id: 'work', emoji: '💼', label: 'Work' },
  { id: 'practice', emoji: '⚽', label: 'Practice' },
  { id: 'friend', emoji: '🧑‍🤝‍🧑', label: "At a friend's" },
  { id: 'out', emoji: '🚗', label: 'Out' },
  { id: 'away', emoji: '✈️', label: 'Away' },
  { id: 'sleeping', emoji: '😴', label: 'Sleeping' },
];
export const placeOf = (m: Pick<FamilyMember, 'presence'>) => PLACES.find((p) => p.id === m.presence) ?? null;

const since = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

/**
 * 🏠 Who's home: everyone's avatar with where they are. Tap yours on the way out (a parent can tap
 * anyone's) and pick 🏫 School, ⚽ Practice… — with a few words if you like.
 */
export function WhosHome({ readOnly = false }: { readOnly?: boolean }) {
  const { members, activeProfile, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [picking, setPicking] = useState<FamilyMember | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canSet = (m: FamilyMember) => !readOnly && (isParent || activeProfile?.id === m.id);
  const set = async (m: FamilyMember, presence: string | null) => {
    setError(null);
    try {
      await api.put(`/presence/${m.id}`, { presence, note, acting_member_id: activeProfile?.id ?? null });
      setPicking(null);
      setNote('');
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  if (!members.length) return null;
  return (
    <div className={`whos-home ${readOnly ? 'whos-home--readonly' : ''}`}>
      {!readOnly && <span className="whos-home__title">Who's home</span>}
      {members.map((m) => {
        const p = placeOf(m);
        return (
          <button
            key={m.id}
            type="button"
            className={`whos-home__person ${p && p.id !== 'home' ? 'whos-home__person--away' : ''}`}
            disabled={!canSet(m)}
            title={p ? `${m.name}: ${p.label}${m.presence_note ? ` — ${m.presence_note}` : ''} (since ${since(m.presence_at)})` : `${m.name}: tap to say where you are`}
            onClick={() => {
              setNote(m.presence_note ?? '');
              setPicking(m);
            }}
          >
            <DressedAvatar member={m} size={readOnly ? 44 : 34} />
            <span className="whos-home__place">{p?.emoji ?? '❔'}</span>
            <span className="whos-home__name">
              {m.name}
              {m.presence_note && <span className="whos-home__note">{m.presence_note}</span>}
            </span>
          </button>
        );
      })}
      {picking && (
        <div className="modal-overlay" onClick={() => setPicking(null)}>
          <div className="modal-panel panel whos-home__picker" onClick={(e) => e.stopPropagation()}>
            <h2>Where's {picking.name}?</h2>
            <div className="whos-home__places">
              {PLACES.map((p) => (
                <button key={p.id} type="button" className={picking.presence === p.id ? '' : 'secondary'} onClick={() => set(picking, p.id)}>
                  <span className="whos-home__big">{p.emoji}</span> {p.label}
                </button>
              ))}
            </div>
            <input placeholder={`A few words (optional) — e.g. "at Jake's, back by 5"`} value={note} onChange={(e) => setNote(e.target.value)} />
            {error && <div className="settings-login__error">{error}</div>}
            <div className="task-form__row">
              <button type="button" className="link-button" onClick={() => set(picking, null)}>
                Clear
              </button>
              <button type="button" className="secondary" onClick={() => setPicking(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
