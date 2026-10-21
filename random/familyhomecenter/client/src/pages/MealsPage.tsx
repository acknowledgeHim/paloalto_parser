import { useEffect, useState } from 'react';
import { api, type MealPoll } from '../api/client.js';
import { MealPlanTab } from '../components/MealPlanTab.js';
import { RecipesTab } from '../components/RecipesTab.js';
import { ConverterTab } from '../components/ConverterTab.js';
import { GroceryListTab } from '../components/GroceryListTab.js';
import { MealVoteTab, MEAL_POLLS_CHANGED } from '../components/MealVoteTab.js';

type Tab = 'plan' | 'vote' | 'recipes' | 'grocery' | 'converter';

/** How many 🗳️ meal votes are open — for the tab's badge. */
export function useOpenMealPolls(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () =>
      api
        .get<MealPoll[]>('/meal-polls')
        .then((ps) => setN(ps.filter((p) => !p.closed_at).length))
        .catch(() => setN(0));
    load();
    window.addEventListener(MEAL_POLLS_CHANGED, load);
    return () => window.removeEventListener(MEAL_POLLS_CHANGED, load);
  }, []);
  return n;
}

export function MealsPage() {
  // Straight to the vote when one's open (and the link from Home says so).
  const [tab, setTab] = useState<Tab>(() => (window.location.hash.includes('vote') ? 'vote' : 'plan'));
  const openVotes = useOpenMealPolls();

  return (
    <div className="meals-page">
      <h1>Meals</h1>
      <div className="meals-page__tabs">
        <button type="button" className={tab === 'plan' ? '' : 'secondary'} onClick={() => setTab('plan')}>Meal Plan</button>
        <button type="button" className={tab === 'vote' ? '' : 'secondary'} onClick={() => setTab('vote')}>
          🗳️ Vote
          {openVotes > 0 && <span className="navbar__badge">{openVotes}</span>}
        </button>
        <button type="button" className={tab === 'recipes' ? '' : 'secondary'} onClick={() => setTab('recipes')}>Recipes</button>
        <button type="button" className={tab === 'grocery' ? '' : 'secondary'} onClick={() => setTab('grocery')}>Grocery List</button>
        <button type="button" className={tab === 'converter' ? '' : 'secondary'} onClick={() => setTab('converter')}>Converter</button>
      </div>
      {tab === 'plan' && <MealPlanTab />}
      {tab === 'vote' && <MealVoteTab />}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'grocery' && <GroceryListTab />}
      {tab === 'converter' && <ConverterTab />}
    </div>
  );
}
