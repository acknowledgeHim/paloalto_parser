export interface IngredientRow {
  name: string;
  quantity: string;
}

interface Props {
  ingredients: IngredientRow[];
  onChange: (next: IngredientRow[]) => void;
}

/** Reusable dynamic add/remove list of {quantity, name} rows — used by both recipe and meal forms. */
export function IngredientListEditor({ ingredients, onChange }: Props) {
  const update = (i: number, patch: Partial<IngredientRow>) => {
    onChange(ingredients.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const remove = (i: number) => onChange(ingredients.filter((_, idx) => idx !== i));
  const add = () => onChange([...ingredients, { name: '', quantity: '' }]);

  return (
    <div className="ingredient-editor">
      {ingredients.map((row, i) => (
        <div key={i} className="ingredient-editor__row">
          <input
            placeholder="Quantity"
            value={row.quantity}
            onChange={(e) => update(i, { quantity: e.target.value })}
            className="ingredient-editor__qty"
          />
          <input
            placeholder="Ingredient"
            value={row.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <button type="button" className="icon-button ingredient-editor__remove" aria-label="Remove ingredient" onClick={() => remove(i)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={add}>+ Add ingredient</button>
    </div>
  );
}
