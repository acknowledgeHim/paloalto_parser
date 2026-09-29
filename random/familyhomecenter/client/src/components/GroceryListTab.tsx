import { useEffect, useState, type FormEvent } from 'react';
import { api, type GroceryItem, type Meal } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from './MemberAvatar.js';

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
 * A running "need to buy" list, separate from any one meal's own ingredients — anyone can add an
 * item, optionally saying how much and linking it to an upcoming meal. Checking an item off just
 * removes it (no purchased-history kept). See services/groceryEmail.ts on the server for the
 * optional nightly digest this feeds.
 */
export function GroceryListTab() {
  const { members, activeProfile } = useFamilyMembers();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [requestedById, setRequestedById] = useState(activeProfile?.id ?? '');
  const [mealId, setMealId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.get<GroceryItem[]>('/grocery').then(setItems).catch(console.error);
  };
  useEffect(load, []);
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

  const gotIt = async (id: string) => {
    await api.delete(`/grocery/${id}`);
    load();
  };

  const requesterFor = (id: string | null) => (id ? members.find((m) => m.id === id) ?? null : null);
  const mealFor = (id: string | null) => (id ? meals.find((m) => m.id === id) ?? null : null);

  // Anyone can add, but only who requested it (or a parent) can check it off — same household-
  // trust, client-side-only rule as task completion elsewhere; see routes/grocery.ts for why this
  // can't be enforced server-side for a kid with no password.
  const canRemove = (item: GroceryItem) =>
    Boolean(activeProfile && (activeProfile.is_parent === 1 || activeProfile.id === item.requested_by_id));

  return (
    <div className="grocery-tab">
      <section className="panel">
        <h2>Grocery List</h2>
        {items.length === 0 && <div className="empty-state">Nothing on the list right now.</div>}
        {items.length > 0 && (
          <ul className="grocery-tab__list">
            {items.map((item) => {
              const meal = mealFor(item.meal_id);
              const requester = requesterFor(item.requested_by_id);
              const removable = canRemove(item);
              return (
                <li key={item.id} className="grocery-tab__row">
                  <button
                    type="button"
                    className="grocery-tab__check"
                    aria-label={`Got ${item.name}`}
                    onClick={() => gotIt(item.id)}
                    disabled={!removable}
                    title={removable ? undefined : 'Only whoever asked for this, or a parent, can check it off'}
                  >
                    ✓
                  </button>
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
                </li>
              );
            })}
          </ul>
        )}

        <form className="task-form grocery-tab__form" onSubmit={submit}>
          <input autoFocus placeholder="Item (e.g. Milk)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="task-form__row">
            <input placeholder="How much? (optional)" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <select value={requestedById} onChange={(e) => setRequestedById(e.target.value)}>
              <option value="">Who's asking?</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <select value={mealId} onChange={(e) => setMealId(e.target.value)}>
            <option value="">Not for a specific meal</option>
            {meals.map((m) => (
              <option key={m.id} value={m.id}>{mealLabel(m)}</option>
            ))}
          </select>
          {error && <div className="settings-login__error">{error}</div>}
          <button type="submit">Add to list</button>
        </form>
      </section>
    </div>
  );
}
