import { useState } from 'react';
import { MealPlanTab } from '../components/MealPlanTab.js';
import { RecipesTab } from '../components/RecipesTab.js';
import { ConverterTab } from '../components/ConverterTab.js';

type Tab = 'plan' | 'recipes' | 'converter';

export function MealsPage() {
  const [tab, setTab] = useState<Tab>('plan');

  return (
    <div className="meals-page">
      <h1>Meals</h1>
      <div className="meals-page__tabs">
        <button type="button" className={tab === 'plan' ? '' : 'secondary'} onClick={() => setTab('plan')}>Meal Plan</button>
        <button type="button" className={tab === 'recipes' ? '' : 'secondary'} onClick={() => setTab('recipes')}>Recipes</button>
        <button type="button" className={tab === 'converter' ? '' : 'secondary'} onClick={() => setTab('converter')}>Converter</button>
      </div>
      {tab === 'plan' && <MealPlanTab />}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'converter' && <ConverterTab />}
    </div>
  );
}
