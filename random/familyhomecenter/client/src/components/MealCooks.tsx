import { useEffect, useState } from 'react';
import { api, type FamilyMember, type MealCook, type MealCookRule, type MealSlot } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { useActing } from '../pages/CamerasPage.js';
import { MemberAvatar } from './MemberAvatar.js';

/**
 * 👩‍🍳 Who's cooking: a parent sets someone to plan and make a meal — once, or on a repeating
 * schedule ("dinner every Tuesday & Thursday"). The Meal Plan shows it on each meal; when nothing's
 * planned yet, the cook gets a button to pick what to make. Server: routes/mealCooks.ts.
 */
export const MEAL_COOKS_CHANGED = 'meal-cooks-changed';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOT_NAME: Record<MealSlot, string> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner' };

export function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const niceDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** "every Tuesday & Thursday", "every weekday", "every day". */
export function everyLabel(weekdays: string | null): string {
  const days = (weekdays ?? '').split(',').filter(Boolean).map(Number).sort();
  if (days.length === 7) return 'every day';
  if (days.join() === '1,2,3,4,5') return 'every weekday';
  if (days.join() === '0,6') return 'every weekend';
  const names = days.map((d) => WEEKDAYS_LONG[d]);
  return `every ${names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0] ?? ''}`;
}

export function useMealCooks(start: string, end: string): MealCook[] {
  const [cooks, setCooks] = useState<MealCook[]>([]);
  useEffect(() => {
    const load = () => api.get<MealCook[]>(`/meal-cooks?start=${start}&end=${end}`).then(setCooks).catch(() => setCooks([]));
    load();
    window.addEventListener(MEAL_COOKS_CHANGED, load);
    return () => window.removeEventListener(MEAL_COOKS_CHANGED, load);
  }, [start, end]);
  return cooks;
}

const changed = () => window.dispatchEvent(new Event(MEAL_COOKS_CHANGED));

/** The "👩‍🍳 Ben is cooking" line on one meal, with a parent's quick change for that day. */
export function CookLine({ date, slot, cook, planned, onPlan }: { date: string; slot: MealSlot; cook: MealCook | undefined; planned: boolean; onPlan: () => void }) {
  const { members, activeProfile } = useFamilyMembers();
  const acting = useActing();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who = (cook?.member_ids ?? []).map((id) => members.find((m) => m.id === id)).filter((m): m is FamilyMember => Boolean(m));
  const mine = Boolean(activeProfile && cook?.member_ids.includes(activeProfile.id));

  const setOnce = async (memberId: string | null) => {
    setError(null);
    try {
      await api.post('/meal-cooks/rules', { member_id: memberId, slot, date, acting_member_id: acting.id || null });
      setEditing(false);
      changed();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!who.length && !acting.isParent) return null;
  return (
    <div className={`meal-cook ${mine ? 'meal-cook--mine' : ''}`}>
      {who.length > 0 ? (
        <span className="meal-cook__who">
          👩‍🍳 {who.map((m) => (
            <span key={m.id} className="meal-cook__person">
              <MemberAvatar member={m} size={18} /> {m.name}
            </span>
          ))}
          <span className="hint">{mine ? ` — you're cooking ${SLOT_NAME[slot]}!` : ` ${who.length > 1 ? 'are' : 'is'} cooking`}</span>
        </span>
      ) : cook ? (
        <span className="hint">👩‍🍳 Nobody's set to cook this time</span>
      ) : (
        <span className="hint">👩‍🍳 No cook set</span>
      )}
      {who.length > 0 && !planned && (
        <button type="button" className={mine ? '' : 'secondary'} onClick={onPlan}>
          {mine ? '＋ Pick what to make' : '＋ Plan it'}
        </button>
      )}
      {acting.isParent && !editing && (
        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          {who.length ? 'Change' : 'Set a cook'}
        </button>
      )}
      {editing && (
        <span className="meal-cook__edit">
          <select defaultValue="" onChange={(e) => e.target.value && setOnce(e.target.value === '-' ? null : e.target.value)} aria-label="Who's cooking">
            <option value="">Who's cooking this one?</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            {who.length > 0 && <option value="-">Nobody this time</option>}
          </select>
          <button type="button" className="link-button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </span>
      )}
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}

/** The 👩‍🍳 Cooks panel: the next two weeks at a glance, the schedules, and (parents) adding one. */
export function CooksPanel() {
  const { members } = useFamilyMembers();
  const acting = useActing();
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 13);
  const cooks = useMealCooks(dayStr(today), dayStr(end));
  const [rules, setRules] = useState<MealCookRule[]>([]);
  const [adding, setAdding] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const [mode, setMode] = useState<'every' | 'once'>('every');
  const [days, setDays] = useState<number[]>([]);
  const [date, setDate] = useState(dayStr(today));
  const [startDate, setStartDate] = useState(dayStr(today));
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadRules = () => api.get<MealCookRule[]>('/meal-cooks/rules').then(setRules).catch(() => setRules([]));
  useEffect(() => {
    void loadRules();
    window.addEventListener(MEAL_COOKS_CHANGED, loadRules);
    return () => window.removeEventListener(MEAL_COOKS_CHANGED, loadRules);
  }, []);

  const name = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? 'someone' : 'Nobody');
  const save = async () => {
    setError(null);
    try {
      await api.post(
        '/meal-cooks/rules',
        mode === 'once'
          ? { member_id: memberId, slot, date, acting_member_id: acting.id || null }
          : { member_id: memberId, slot, weekdays: days, start_date: startDate, end_date: endDate || null, acting_member_id: acting.id || null }
      );
      setAdding(false);
      setDays([]);
      setMemberId('');
      changed();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const stop = async (id: string) => {
    setError(null);
    try {
      await api.post(`/meal-cooks/rules/${id}/stop`, { acting_member_id: acting.id || null });
      changed();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const upcoming = cooks.filter((c) => c.member_ids.length > 0);
  const schedules = rules.filter((r) => !r.date);
  const onceRules = rules.filter((r) => r.date).sort((a, b) => (a.date! < b.date! ? -1 : 1));
  if (!acting.isParent && upcoming.length === 0) return null;

  return (
    <section className="panel meal-cooks">
      <h2>👩‍🍳 Who's cooking</h2>
      <p className="hint">A cook plans the meal (picks what to make) and helps make it. Set it once, or on a schedule like every Tuesday & Thursday.</p>
      {upcoming.length > 0 ? (
        <ul className="meal-cooks__upcoming">
          {upcoming.map((c) => (
            <li key={`${c.date}-${c.slot}`}>
              <span className="meal-cooks__date">{c.date === dayStr(today) ? 'Today' : niceDate(c.date)}</span>
              <span className="hint">{SLOT_NAME[c.slot]}</span>
              <span>
                {c.member_ids.map((id) => {
                  const m = members.find((x) => x.id === id);
                  return m ? (
                    <span key={id} className="meal-cook__person">
                      <MemberAvatar member={m} size={18} /> {m.name}
                    </span>
                  ) : null;
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Nobody's set to cook in the next two weeks.</p>
      )}

      {acting.isParent && (
        <>
          {(schedules.length > 0 || onceRules.length > 0) && (
            <>
              <h3>Schedules</h3>
              <ul className="meal-cooks__rules">
                {schedules.map((r) => (
                  <li key={r.id}>
                    <span>
                      <strong>{name(r.member_id)}</strong> — {SLOT_NAME[r.slot]} {everyLabel(r.weekdays)}
                      <span className="hint">
                        {r.start_date && r.start_date > dayStr(today) ? ` · from ${niceDate(r.start_date)}` : ''}
                        {r.end_date ? ` · until ${niceDate(r.end_date)}` : ''}
                      </span>
                    </span>
                    <button type="button" className="secondary" onClick={() => stop(r.id)}>
                      Stop
                    </button>
                  </li>
                ))}
                {onceRules.map((r) => (
                  <li key={r.id}>
                    <span>
                      <strong>{name(r.member_id)}</strong> — {SLOT_NAME[r.slot]} on {niceDate(r.date!)}
                      {!r.member_id && <span className="hint"> (skips the schedule that day)</span>}
                    </span>
                    <button type="button" className="secondary" onClick={() => stop(r.id)}>
                      Call off
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)}>
              ＋ Set a cook
            </button>
          ) : (
            <div className="meal-cooks__form">
              <div className="task-form__row">
                <select value={memberId} onChange={(e) => setMemberId(e.target.value)} aria-label="Who">
                  <option value="">Who?</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)} aria-label="Which meal">
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
                <select value={mode} onChange={(e) => setMode(e.target.value as 'every' | 'once')} aria-label="How often">
                  <option value="every">Every week on…</option>
                  <option value="once">Just once, on…</option>
                </select>
              </div>
              {mode === 'every' ? (
                <>
                  <div className="meal-cooks__days" role="group" aria-label="Days">
                    {WEEKDAYS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        className={days.includes(i) ? '' : 'secondary'}
                        aria-pressed={days.includes(i)}
                        onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="task-form__row">
                    <label className="meal-cooks__inline">
                      Starting <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </label>
                    <label className="meal-cooks__inline">
                      Until <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      <span className="hint">(optional)</span>
                    </label>
                  </div>
                </>
              ) : (
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
              )}
              <div className="task-form__row">
                <button type="button" onClick={save} disabled={!memberId || (mode === 'every' && days.length === 0)}>
                  Save
                </button>
                <button type="button" className="secondary" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <div className="settings-login__error">{error}</div>}
    </section>
  );
}
