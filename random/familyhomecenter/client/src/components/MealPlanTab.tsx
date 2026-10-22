import { useEffect, useState } from 'react';
import { api, type Meal, type MealSlot } from '../api/client.js';
import { MealCard } from './MealCard.js';
import { MealFormModal } from './MealFormModal.js';
import { CookLine, CooksPanel, useMealCooks } from './MealCooks.js';

const SLOTS: Array<{ id: MealSlot; label: string }> = [
  { id: 'breakfast', label: '🌅 Breakfast' },
  { id: 'lunch', label: '☀️ Lunch' },
  { id: 'dinner', label: '🌙 Dinner' },
];

/** Local date (YYYY-MM-DD) — not toISOString(), which is already tomorrow on a US evening. */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MealPlanTab() {
  const [date, setDate] = useState(toDateStr(new Date()));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [modal, setModal] = useState<{ meal: Meal | null; slot: MealSlot } | null>(null);
  const cooks = useMealCooks(date, date);

  const load = () => {
    api.get<Meal[]>(`/meals?start=${date}&end=${date}`).then(setMeals).catch(console.error);
  };
  useEffect(load, [date]);

  const shiftDay = (delta: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(toDateStr(d));
  };

  const isToday = date === toDateStr(new Date());
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="meal-plan-tab">
      <div className="meal-plan-tab__nav">
        <button type="button" className="secondary" onClick={() => shiftDay(-1)}>‹ Prev</button>
        <div className="meal-plan-tab__date">
          {dateLabel}
          {!isToday && (
            <button type="button" className="link-button" onClick={() => setDate(toDateStr(new Date()))}>
              Today
            </button>
          )}
        </div>
        <button type="button" className="secondary" onClick={() => shiftDay(1)}>Next ›</button>
      </div>

      {SLOTS.map((slot) => {
        const slotMeals = meals.filter((m) => m.slot === slot.id);
        return (
          <section key={slot.id} className="panel meal-plan-tab__slot">
            <div className="tasks-page__header">
              <button
                type="button"
                className="icon-button"
                aria-label={`Add ${slot.label}`}
                onClick={() => setModal({ meal: null, slot: slot.id })}
              >
                +
              </button>
              <h2>{slot.label}</h2>
            </div>
            <CookLine
              date={date}
              slot={slot.id}
              cook={cooks.find((c) => c.slot === slot.id)}
              planned={slotMeals.length > 0}
              onPlan={() => setModal({ meal: null, slot: slot.id })}
            />
            {slotMeals.length === 0 && <div className="empty-state">Nothing planned</div>}
            {slotMeals.map((m) => (
              <MealCard key={m.id} meal={m} onEdit={(meal) => setModal({ meal, slot: meal.slot })} />
            ))}
          </section>
        );
      })}

      <CooksPanel />

      {modal && (
        <MealFormModal
          meal={modal.meal}
          defaultDate={date}
          defaultSlot={modal.slot}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
