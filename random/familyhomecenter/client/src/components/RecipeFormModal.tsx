import { useState, type FormEvent } from 'react';
import { api, type Recipe } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { IngredientListEditor, type IngredientRow } from './IngredientListEditor.js';
import { RECIPE_CATEGORIES } from '../utils/recipeCategories.js';

interface Props {
  /** null = creating a new recipe. */
  recipe: Recipe | null;
  onClose: () => void;
  onSaved: () => void;
}

const PRESET_CATEGORIES = RECIPE_CATEGORIES.slice(0, -1); // all but the "Other" catch-all

function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mode, setMode] = useState<'none' | 'preset' | 'custom'>(
    value === '' ? 'none' : PRESET_CATEGORIES.includes(value) ? 'preset' : 'custom'
  );

  const handleSelect = (v: string) => {
    if (v === '') {
      setMode('none');
      onChange('');
    } else if (v === 'Other') {
      setMode('custom');
      onChange('');
    } else {
      setMode('preset');
      onChange(v);
    }
  };

  return (
    <div className="task-form__row">
      <select value={mode === 'preset' ? value : mode === 'custom' ? 'Other' : ''} onChange={(e) => handleSelect(e.target.value)}>
        <option value="">No category</option>
        {PRESET_CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
        <option value="Other">Other</option>
      </select>
      {mode === 'custom' && <input placeholder="Category name" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

export function RecipeFormModal({ recipe, onClose, onSaved }: Props) {
  const { activeProfile } = useFamilyMembers();
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [servings, setServings] = useState(recipe?.servings ?? 4);
  const [category, setCategory] = useState(recipe?.category ?? '');
  const [instructions, setInstructions] = useState(recipe?.instructions ?? '');
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    recipe?.ingredients.map((i) => ({ name: i.name, quantity: i.quantity ?? '' })) ?? [{ name: '', quantity: '' }]
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const body = {
      title: title.trim(),
      servings,
      category: category.trim() || null,
      instructions: instructions.trim() || null,
      ingredients: ingredients.filter((i) => i.name.trim()),
    };
    if (recipe) {
      await api.patch(`/recipes/${recipe.id}`, body);
    } else {
      await api.post('/recipes', { ...body, created_by_id: activeProfile?.id ?? null });
    }
    onSaved();
  };

  const remove = async () => {
    if (!recipe) return;
    await api.delete(`/recipes/${recipe.id}`);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{recipe ? 'Edit recipe' : 'Add a recipe'}</h2>
        <input autoFocus placeholder="Recipe title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="task-form__row">
          <label className="member-form__label member-form__label--inline">
            Servings
            <input
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
        <label className="member-form__label">Category</label>
        <CategoryPicker value={category} onChange={setCategory} />
        <label className="member-form__label">Ingredients</label>
        <IngredientListEditor ingredients={ingredients} onChange={setIngredients} />
        <textarea
          placeholder="Instructions (optional)"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div className="task-form__row">
          <button type="submit">{recipe ? 'Save' : 'Add'}</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
        {recipe && (
          <button type="button" className="secondary task-form__delete" onClick={remove}>
            Delete this recipe
          </button>
        )}
      </form>
    </div>
  );
}
