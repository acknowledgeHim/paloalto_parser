import { useEffect, useState, type FormEvent } from 'react';
import { api, type GroceryItem, type Meal } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from './MemberAvatar.js';
import { useActing } from '../pages/CamerasPage.js';

const UPCOMING_MEAL_DAYS = 14;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mealLabel(meal: Meal): string {
  const date = new Date(`${meal.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const slot = meal.slot[0].toUpperCase() + meal.slot.slice(1);
  return `${meal.title} — ${slot}, ${date}`;
}

/**
 * A running "need to buy" list, separate from any one meal's own ingredients — anyone can type an
 * item in (no recipe needed), optionally saying how much and linking it to an upcoming meal. It
 * stays on the list until a parent marks it ✓ Purchased or ✕ Ignore; marked-off items are kept
 * under "Marked off" (who, when) and a parent can put one back. See services/groceryEmail.ts on
 * the server for the nightly digest this feeds.
 */
export function GroceryListTab() {
  const { members, activeProfile } = useFamilyMembers();
  const acting = useActing();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [done, setDone] = useState<GroceryItem[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [requestedById, setRequestedById] = useState(activeProfile?.id ?? '');
  const [mealId, setMealId] = useState('');
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.get<GroceryItem[]>('/grocery').then(setItems).catch(console.error);
    api.get<GroceryItem[]>('/grocery?done=1').then(setDone).catch(console.error);
  };
  useEffect(load, []);
  useEffect(() => {
    if (activeProfile?.id) setRequestedById(activeProfile.id);
  }, [activeProfile?.id]);
  useEffect(() => {
    const start = toDateStr(new Date());
    const end = toDateStr(new Date(Date.now() + UPCOMING_MEAL_DAYS * 86400_000));
    api.get<Meal[]>(`/meals?start=${start}&end=${end}`).then(setMeals).catch(console.error);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await api.post('/grocery', {
        name: name.trim(),
        quantity: quantity.trim() || null,
        requested_by_id: requestedById || null,
        meal_id: mealId || null,
      });
      setName('');
      setQuantity('');
      setMealId('');
      load();
    } catch (err) {
      setError((err as Error).message || 'Could not add that');
    }
  };

  const mark = async (id: string, status: 'purchased' | 'ignored' | null) => {
    setError(null);
    try {
      await api.post(`/grocery/${id}/mark`, { status, acting_member_id: acting.id || null });
    } catch (err) {
      setError((err as Error).message);
    }
    load();
  };

  const memberFor = (id: string | null) => (id ? members.find((m) => m.id === id) ?? null : null);
  const mealFor = (id: string | null) => (id ? meals.find((m) => m.id === id) ?? null : null);

  return (
    <div className="grocery-tab">
      <section className="panel">
        <h2>🛒 Grocery List</h2>
        <form className="task-form grocery-tab__form" onSubmit={submit}>
          <div className="task-form__row grocery-tab__add">
            <input autoFocus placeholder="Add an item — e.g. Milk" value={name} onChange={(e) => setName(e.target.value)} aria-label="Item" className="grocery-tab__add-name" />
            <input placeholder="How much? (optional)" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="How much" />
            <button type="submit" disabled={!name.trim()}>＋ Add</button>
          </div>
          <button type="button" className="link-button grocery-tab__more" onClick={() => setMore(!more)}>
            {more ? 'Fewer options' : 'Who’s asking / for a meal…'}
          </button>
          {more && (
            <div className="task-form__row">
              <select value={requestedById} onChange={(e) => setRequestedById(e.target.value)} aria-label="Who's asking">
                <option value="">Who's asking?</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <select value={mealId} onChange={(e) => setMealId(e.target.value)} aria-label="For a meal">
                <option value="">Not for a specific meal</option>
                {meals.map((m) => (
                  <option key={m.id} value={m.id}>{mealLabel(m)}</option>
                ))}
              </select>
            </div>
          )}
        </form>
        {error && <div className="settings-login__error">{error}</div>}

        {items.length === 0 && <div className="empty-state">Nothing on the list right now.</div>}
        {items.length > 0 && (
          <>
            {!acting.isParent && <p className="hint">Items stay on the list until a parent marks them purchased or ignored.</p>}
            <ul className="grocery-tab__list">
              {items.map((item) => {
                const meal = mealFor(item.meal_id);
                const requester = memberFor(item.requested_by_id);
                return (
                  <li key={item.id} className="grocery-tab__row">
                    <div className="grocery-tab__item">
                      <div className="grocery-tab__item-name">
                        {item.name}
                        {item.quantity && <span className="hint"> — {item.quantity}</span>}
                      </div>
                      {(requester || meal) && (
                        <div className="hint grocery-tab__item-meta">
                          {requester && (
                            <span className="grocery-tab__requester">
                              <MemberAvatar member={requester} size={16} /> {requester.name}
                            </span>
                          )}
                          {meal && <span>{requester ? ' · ' : ''}For {mealLabel(meal)}</span>}
                        </div>
                      )}
                    </div>
                    {acting.isParent && (
                      <span className="grocery-tab__marks">
                        <button type="button" className="grocery-tab__bought" onClick={() => mark(item.id, 'purchased')} aria-label={`Purchased ${item.name}`}>
                          ✓ Purchased
                        </button>
                        <button type="button" className="secondary" onClick={() => mark(item.id, 'ignored')} aria-label={`Ignore ${item.name}`}>
                          ✕ Ignore
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {done.length > 0 && (
          <details className="grocery-tab__done">
            <summary>Marked off ({done.length}{done.length === 50 ? '+' : ''})</summary>
            <ul className="grocery-tab__list">
              {done.map((item) => {
                const by = memberFor(item.done_by_id);
                return (
                  <li key={item.id} className="grocery-tab__row grocery-tab__row--done">
                    <div className="grocery-tab__item">
                      <div className="grocery-tab__item-name">
                        {item.name}
                        {item.quantity && <span className="hint"> — {item.quantity}</span>}
                      </div>
                      <div className="hint">
                        {item.status === 'purchased' ? '✓ Purchased' : '✕ Ignored'}
                        {item.done_at && ` ${new Date(item.done_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}
                        {by && ` by ${by.name}`}
                      </div>
                    </div>
                    {acting.isParent && (
                      <button type="button" className="secondary" onClick={() => mark(item.id, null)}>
                        ↩ Back on the list
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
