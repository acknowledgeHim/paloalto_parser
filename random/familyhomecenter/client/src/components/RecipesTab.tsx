import { useEffect, useState, type FormEvent } from 'react';
import { api, type Recipe, type RecipeSearchResult } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { RecipeCard } from './RecipeCard.js';
import { RecipeFormModal } from './RecipeFormModal.js';

export function RecipesTab() {
  const { activeProfile } = useFamilyMembers();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [modalRecipe, setModalRecipe] = useState<Recipe | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const load = () => {
    api.get<Recipe[]>('/recipes').then(setRecipes).catch(console.error);
  };
  useEffect(load, []);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await api.get<RecipeSearchResult[]>(`/recipes/search-online?q=${encodeURIComponent(query.trim())}`));
    } catch (err) {
      setSearchError((err as Error).message || 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const importResult = async (r: RecipeSearchResult) => {
    await api.post('/recipes/import', { ...r, created_by_id: activeProfile?.id ?? null });
    setImportedIds((ids) => new Set(ids).add(r.source_id));
    load();
  };

  return (
    <div className="recipes-tab">
      <div className="tasks-page__header">
        <button type="button" className="icon-button" aria-label="Add a recipe" onClick={() => setModalRecipe('new')}>
          +
        </button>
        <h2>My recipes</h2>
      </div>
      {recipes.length === 0 && <div className="empty-state">No recipes yet — add your own or search online below.</div>}
      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} onEdit={setModalRecipe} />
      ))}

      <section className="panel">
        <h2>Find recipes online</h2>
        <p className="hint">Free search via TheMealDB — no account or API key needed.</p>
        <form className="task-form__row" onSubmit={search}>
          <input placeholder='Search e.g. "chicken curry"' value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
        </form>
        {searchError && <div className="settings-login__error">{searchError}</div>}
        {results.map((r) => (
          <div key={r.source_id} className="recipe-card recipe-card--search">
            <div className="recipe-card__header">
              {r.thumbnail_url && <img className="recipe-card__thumb" src={r.thumbnail_url} alt="" />}
              <div className="recipe-card__title">
                {r.title}
                <span className="hint"> · {r.ingredients.length} ingredients</span>
                {r.category && <span className="badge">{r.category}</span>}
              </div>
              <button type="button" className="secondary" disabled={importedIds.has(r.source_id)} onClick={() => importResult(r)}>
                {importedIds.has(r.source_id) ? 'Added ✓' : 'Add to my recipes'}
              </button>
            </div>
          </div>
        ))}
      </section>

      {modalRecipe && (
        <RecipeFormModal
          recipe={modalRecipe === 'new' ? null : modalRecipe}
          onClose={() => setModalRecipe(null)}
          onSaved={() => {
            setModalRecipe(null);
            load();
          }}
        />
      )}
    </div>
  );
}
