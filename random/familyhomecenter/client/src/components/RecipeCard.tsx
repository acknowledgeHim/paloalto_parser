import { useState } from 'react';
import type { Recipe } from '../api/client.js';
import { scaleQuantity } from '../utils/units.js';

interface Props {
  recipe: Recipe;
  onEdit: (r: Recipe) => void;
}

export function RecipeCard({ recipe, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [desiredServings, setDesiredServings] = useState(recipe.servings);
  const factor = desiredServings / recipe.servings;

  return (
    <div className="panel recipe-card">
      <div className="recipe-card__header" onClick={() => setExpanded((v) => !v)}>
        {recipe.thumbnail_url && <img className="recipe-card__thumb" src={recipe.thumbnail_url} alt="" />}
        <div className="recipe-card__title">
          {recipe.title}
          <span className="hint"> · serves {recipe.servings}</span>
        </div>
        <button
          type="button"
          className="task-card__edit"
          aria-label="Edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(recipe);
          }}
        >
          ✎
        </button>
      </div>
      {expanded && (
        <div className="recipe-card__body">
          <label className="member-form__label member-form__label--inline">
            Scale to
            <input
              type="number"
              min={1}
              value={desiredServings}
              onChange={(e) => setDesiredServings(Math.max(1, Number(e.target.value) || 1))}
            />
            servings
          </label>
          <ul className="recipe-card__ingredients">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id}>
                {scaleQuantity(ing.quantity, factor) ?? ''} {ing.name}
              </li>
            ))}
          </ul>
          {recipe.instructions && <p className="recipe-card__instructions">{recipe.instructions}</p>}
        </div>
      )}
    </div>
  );
}
