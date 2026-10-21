import { useEffect, useState } from 'react';
import { api, type MealPoll, type MealSlot, type Recipe } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { localDate } from '../utils/daylight.js';
import { MemberAvatar } from './MemberAvatar.js';

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner' };
const dayLabel = (d: string) =>
  d === localDate() ? 'Tonight' : new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

/** Tell the Meals tab (and Home) a vote changed, for their "open votes" counts. */
export const MEAL_POLLS_CHANGED = 'meal-polls-changed';

/**
 * 🗳️ What's for dinner? A parent offers 2–4 choices; everyone taps their pick (and can change it);
 * closing the vote puts the winner — with its recipe — on the meal plan. A tie is a coin flip.
 */
export function MealVoteTab() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [polls, setPolls] = useState<MealPoll[]>([]);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.get<MealPoll[]>('/meal-polls').then(setPolls).catch(console.error);
  useEffect(() => {
    load();
  }, []);
  const acting = activeProfile?.id ?? null;
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
      window.dispatchEvent(new Event(MEAL_POLLS_CHANGED));
    } catch (err) {
      setError((err as Error).message || 'That didn’t work');
    }
  };
  const vote = (poll: MealPoll, optionId: string | null) =>
    activeProfile
      ? run(() => api.post(`/meal-polls/${poll.id}/vote`, { family_member_id: activeProfile.id, option_id: optionId, acting_member_id: acting }))
      : setError('Pick who you are (top right) to vote');
  const close = (poll: MealPoll) => run(() => api.post(`/meal-polls/${poll.id}/close`, { acting_member_id: acting }));
  const remove = (poll: MealPoll) => {
    if (window.confirm('Remove this vote?')) void run(() => api.delete(`/meal-polls/${poll.id}?acting_member_id=${acting ?? ''}`));
  };

  const open = polls.filter((p) => !p.closed_at);
  const closed = polls.filter((p) => p.closed_at);

  return (
    <div className="meal-vote">
      {error && <div className="settings-login__error">{error}</div>}
      {isParent && !making && (
        <button type="button" onClick={() => setMaking(true)}>
          ＋ New vote
        </button>
      )}
      {making && (
        <NewVoteForm
          onCancel={() => setMaking(false)}
          onSaved={() => {
            setMaking(false);
            void load();
            window.dispatchEvent(new Event(MEAL_POLLS_CHANGED));
          }}
        />
      )}
      {open.length === 0 && !making && <div className="empty-state">No votes open right now.{isParent ? ' Start one with ＋ New vote.' : ''}</div>}
      {open.map((poll) => {
        const mine = poll.votes.find((v) => v.family_member_id === activeProfile?.id)?.option_id;
        const most = Math.max(1, ...poll.options.map((o) => o.votes));
        const waitingOn = members.filter((m) => !poll.votes.some((v) => v.family_member_id === m.id));
        return (
          <section key={poll.id} className="panel meal-vote__poll">
            <h2>
              🗳️ {poll.question || `What's for ${poll.slot}?`}
              <span className="hint"> · {SLOT_LABEL[poll.slot]} · {dayLabel(poll.date)}</span>
            </h2>
            <div className="meal-vote__options">
              {poll.options.map((o) => {
                const voters = members.filter((m) => poll.votes.some((v) => v.family_member_id === m.id && v.option_id === o.id));
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`meal-vote__option ${mine === o.id ? 'meal-vote__option--mine' : ''}`}
                    onClick={() => vote(poll, mine === o.id ? null : o.id)}
                  >
                    {o.thumbnail_url ? <img src={o.thumbnail_url} alt="" className="meal-vote__thumb" /> : <span className="meal-vote__emoji">{o.emoji || '🍽️'}</span>}
                    <span className="meal-vote__title">{o.title}</span>
                    <span className="progress-bar meal-vote__bar">
                      <span className="progress-bar__fill" style={{ width: `${(o.votes / most) * 100}%`, display: 'block' }} />
                    </span>
                    <span className="meal-vote__voters">
                      {voters.map((m) => (
                        <MemberAvatar key={m.id} member={m} size={22} />
                      ))}
                      {o.votes === 0 && <span className="hint">no votes yet</span>}
                    </span>
                    {mine === o.id && <span className="meal-vote__check">✓ Your pick</span>}
                  </button>
                );
              })}
            </div>
            {waitingOn.length > 0 && (
              <p className="hint">
                Still to vote: {waitingOn.map((m) => m.name).join(', ')}
              </p>
            )}
            {isParent && (
              <div className="task-form__row">
                <button type="button" onClick={() => close(poll)}>
                  🏆 Close the vote — put the winner on the meal plan
                </button>
                <button type="button" className="link-button" onClick={() => remove(poll)}>
                  Remove
                </button>
              </div>
            )}
          </section>
        );
      })}
      {closed.length > 0 && (
        <section className="panel">
          <h2>🏆 Decided</h2>
          <ul className="meal-vote__closed">
            {closed.map((p) => {
              const w = p.options.find((o) => o.id === p.winner_option_id);
              return (
                <li key={p.id}>
                  {SLOT_LABEL[p.slot]} {dayLabel(p.date)}: <strong>{w?.emoji ?? ''} {w?.title ?? '—'}</strong>
                  <span className="hint"> · {w?.votes ?? 0} vote{w?.votes === 1 ? '' : 's'} · on the meal plan</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function NewVoteForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const { activeProfile } = useFamilyMembers();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [date, setDate] = useState(localDate());
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<Array<{ title: string; recipe_id: string; emoji: string }>>([
    { title: '', recipe_id: '', emoji: '' },
    { title: '', recipe_id: '', emoji: '' },
    { title: '', recipe_id: '', emoji: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<Recipe[]>('/recipes').then(setRecipes).catch(() => setRecipes([]));
  }, []);
  const setOpt = (i: number, patch: Partial<(typeof options)[number]>) => setOptions((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const save = async () => {
    setError(null);
    try {
      await api.post('/meal-polls', {
        date,
        slot,
        question: question.trim() || null,
        options: options.filter((o) => o.title.trim() || o.recipe_id).map((o) => ({ title: o.title.trim(), recipe_id: o.recipe_id || null, emoji: o.emoji.trim() || null })),
        acting_member_id: activeProfile?.id ?? null,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message || 'Could not start the vote');
    }
  };
  return (
    <section className="panel meal-vote__form">
      <h2>🗳️ New vote</h2>
      <div className="task-form__row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Day" />
        <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)} aria-label="Meal">
          <option value="breakfast">🌅 Breakfast</option>
          <option value="lunch">☀️ Lunch</option>
          <option value="dinner">🌙 Dinner</option>
        </select>
      </div>
      <input placeholder={`Question (optional) — e.g. "Friday treat dinner?"`} value={question} onChange={(e) => setQuestion(e.target.value)} />
      <p className="hint">The choices: pick a recipe, or just type one (e.g. "Pizza night 🍕").</p>
      {options.map((o, i) => (
        <div key={i} className="task-form__row meal-vote__form-row">
          <input className="meal-vote__form-emoji" placeholder="🍝" value={o.emoji} onChange={(e) => setOpt(i, { emoji: e.target.value })} aria-label="Emoji" />
          <select
            value={o.recipe_id}
            onChange={(e) => setOpt(i, { recipe_id: e.target.value, title: e.target.value ? recipes.find((r) => r.id === e.target.value)?.title ?? '' : o.title })}
            aria-label="Recipe"
          >
            <option value="">— type it in —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <input placeholder={`Choice ${i + 1}`} value={o.title} onChange={(e) => setOpt(i, { title: e.target.value })} />
          {options.length > 2 && (
            <button type="button" className="link-button" aria-label="Remove this choice" onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}>
              ✕
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button type="button" className="secondary" onClick={() => setOptions((os) => [...os, { title: '', recipe_id: '', emoji: '' }])}>
          + Another choice
        </button>
      )}
      {error && <div className="settings-login__error">{error}</div>}
      <div className="task-form__row">
        <button type="button" onClick={save}>
          🗳️ Start the vote
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
