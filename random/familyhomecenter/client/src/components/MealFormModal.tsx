import { useEffect, useState, type FormEvent } from 'react';
import { api, type Meal, type MealSlot, type Recipe } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { IngredientListEditor, type IngredientRow } from './IngredientListEditor.js';
import { RECIPE_CATEGORIES } from '../utils/recipeCategories.js';

/** Groups recipes by category for the picker below, in RECIPE_CATEGORIES order (uncategorized
 *  recipes group under "Other", same as the spending/category graphs elsewhere in the app). */
function groupByCategory(recipes: Recipe[]): Array<[string, Recipe[]]> {
  const byCategory = new Map<string, Recipe[]>();
  for (const r of recipes) {
    const key = r.category?.trim() || 'Other';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(r);
  }
  const order = [...RECIPE_CATEGORIES, ...Array.from(byCategory.keys()).filter((c) => !RECIPE_CATEGORIES.includes(c))];
  return order.filter((c) => byCategory.has(c)).map((c) => [c, byCategory.get(c)!]);
}

interface Props {
  /** null = creating a new meal. */
  meal: Meal | null;
  defaultDate: string;
  defaultSlot: MealSlot;
  onClose: () => void;
  onSaved: () => void;
}

const SLOT_OPTIONS: Array<{ value: MealSlot; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

export function MealFormModal({ meal, defaultDate, defaultSlot, onClose, onSaved }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [date, setDate] = useState(meal?.date ?? defaultDate);
  const [slot, setSlot] = useState<MealSlot>(meal?.slot ?? defaultSlot);
  const [assigneeId, setAssigneeId] = useState(meal?.assignee_id ?? '');
  const [title, setTitle] = useState(meal?.title ?? '');
  const [notes, setNotes] = useState(meal?.notes ?? '');
  const [recipeIds, setRecipeIds] = useState<string[]>(meal?.recipes.map((r) => r.id) ?? []);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    meal?.ingredients.map((i) => ({ name: i.name, quantity: i.quantity ?? '' })) ?? []
  );

  useEffect(() => {
    api.get<Recipe[]>('/recipes').then(setRecipes).catch(console.error);
  }, []);

  const toggleRecipe = (id: string) => {
    setRecipeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // A title isn't required if you picked recipe(s) — default to their names joined together.
    const finalTitle = title.trim() || recipes.filter((r) => recipeIds.includes(r.id)).map((r) => r.title).join(' + ');
    if (!finalTitle) return;
    const body = {
      date,
      slot,
      assignee_id: assigneeId || null,
      title: finalTitle,
      notes: notes.trim() || null,
      recipe_ids: recipeIds,
      ingredients: ingredients.filter((i) => i.name.trim()),
    };
    if (meal) {
      await api.patch(`/meals/${meal.id}`, body);
    } else {
      await api.post('/meals', { ...body, created_by_id: activeProfile?.id ?? null });
    }
    onSaved();
  };

  const remove = async () => {
    if (!meal) return;
    await api.delete(`/meals/${meal.id}`);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{meal ? 'Edit meal' : 'Add a meal'}</h2>
        <div className="task-form__row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
            {SLOT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Whole family</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input
          placeholder="What's for this meal? (optional if picking a recipe below)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {recipes.length > 0 && (
          <div>
            <label className="member-form__label">Recipes (optional — adds their ingredients automatically)</label>
            {groupByCategory(recipes).map(([category, group]) => (
              <div key={category} className="meal-form__recipe-group">
                <div className="meal-form__recipe-group-label">{category}</div>
                <div className="task-form__row chip-list">
                  {group.map((r) => (
                    <label key={r.id} className="checkbox">
                      <input type="checkbox" checked={recipeIds.includes(r.id)} onChange={() => toggleRecipe(r.id)} />
                      {r.title}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <label className="member-form__label">Other ingredients needed (optional)</label>
        <IngredientListEditor ingredients={ingredients} onChange={setIngredients} />

        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="task-form__row">
          <button type="submit">{meal ? 'Save' : 'Add'}</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
        {meal && (
          <button type="button" className="secondary task-form__delete" onClick={remove}>
            Delete this meal
          </button>
        )}
      </form>
    </div>
  );
}
