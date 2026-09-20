import type { Meal } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from './MemberAvatar.js';

interface Props {
  meal: Meal;
  onEdit: (meal: Meal) => void;
}

export function MealCard({ meal, onEdit }: Props) {
  const { members } = useFamilyMembers();
  const assignee = members.find((m) => m.id === meal.assignee_id);
  const ingredientCount = meal.ingredients.length + meal.recipes.reduce((n, r) => n + r.ingredients.length, 0);

  return (
    <div className="task-card">
      <div className="task-card__body">
        <div className="task-card__title">{meal.title}</div>
        {meal.recipes.length > 0 && (
          <div className="task-card__notes">From: {meal.recipes.map((r) => r.title).join(', ')}</div>
        )}
        {meal.notes && <div className="task-card__notes">{meal.notes}</div>}
        <div className="task-card__meta">
          {assignee ? (
            <span className="task-card__assignee">
              <MemberAvatar member={assignee} size={18} /> {assignee.name}
            </span>
          ) : (
            <span className="badge badge--time">Whole family</span>
          )}
          {ingredientCount > 0 && <span className="badge badge--time">{ingredientCount} ingredients</span>}
          <button type="button" className="task-card__edit" aria-label="Edit" onClick={() => onEdit(meal)}>
            ✎
          </button>
        </div>
      </div>
    </div>
  );
}
