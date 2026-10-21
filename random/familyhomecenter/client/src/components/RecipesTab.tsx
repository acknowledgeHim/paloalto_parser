import { useEffect, useState, type FormEvent } from 'react';
import { api, type Recipe, type RecipeSearchResult } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { RecipeCard } from './RecipeCard.js';
import { RecipeFormModal } from './RecipeFormModal.js';
import { RecipePdfImport } from './RecipePdfImport.js';

const NONE = '\u0000none';

export function RecipesTab() {
  const { activeProfile } = useFamilyMembers();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [modalRecipe, setModalRecipe] = useState<Recipe | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Being added right now (the button shows "Added ✓" once it's in My recipes — and goes back if it's deleted).
  // Browsing My recipes: a category tab ('' = all, NONE = no category) and a search.
  const [cat, setCat] = useState('');
  const [find, setFind] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);
  // A search result opened to read before deciding to add it.
  const [peek, setPeek] = useState<RecipeSearchResult | null>(null);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const isAdded = (sourceId: string) => recipes.some((x) => x.source === 'themealdb' && x.source_id === sourceId);

  const load = () => api.get<Recipe[]>('/recipes').then(setRecipes).catch(console.error);
  useEffect(() => {
    load();
  }, []);

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
    setAdding((ids) => new Set(ids).add(r.source_id));
    try {
      await api.post('/recipes/import', { ...r, created_by_id: activeProfile?.id ?? null });
      await load();
    } finally {
      setAdding((ids) => {
        const next = new Set(ids);
        next.delete(r.source_id);
        return next;
      });
    }
  };

  const catOf = (r: Recipe) => r.category?.trim() || NONE;
  const counts = new Map<string, number>();
  for (const r of recipes) counts.set(catOf(r), (counts.get(catOf(r)) ?? 0) + 1);
  const categories = [...counts].sort(([a], [b]) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b)));
  const words = find.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = recipes
    .filter((r) => !cat || catOf(r) === cat)
    .filter((r) => {
      const text = [r.title, r.category, r.author, r.origin, ...r.ingredients.map((i) => i.name)].join(' ').toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const AddButton = ({ r }: { r: RecipeSearchResult }) => (
    <button type="button" className="secondary" disabled={isAdded(r.source_id) || adding.has(r.source_id)} onClick={() => importResult(r)}>
      {isAdded(r.source_id) ? 'Added ✓' : adding.has(r.source_id) ? 'Adding…' : 'Add to my recipes'}
    </button>
  );

  return (
    <div className="recipes-tab">
      <div className="tasks-page__header">
        <button type="button" className="icon-button" aria-label="Add a recipe" onClick={() => setModalRecipe('new')}>
          +
        </button>
        <h2>My recipes</h2>
        <button type="button" className="secondary recipes-tab__pdf" onClick={() => setPdfOpen(true)}>
          📕 Import from a PDF
        </button>
      </div>
      {pdfOpen && <RecipePdfImport onClose={() => setPdfOpen(false)} onSaved={load} />}
      {recipes.length === 0 && <div className="empty-state">No recipes yet — add your own or search online below.</div>}
      {recipes.length > 0 && (
        <div className="recipes-browse">
          <input
            type="search"
            className="recipes-browse__search"
            placeholder="🔍 Search my recipes — name, ingredient, or who it's from"
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
          <div className="recipes-browse__cats" role="tablist" aria-label="Categories">
            {[['', `All (${recipes.length})`], ...categories.map(([c, n]) => [c, `${c === NONE ? 'No category' : c} (${n})`])].map(([c, label]) => (
              <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? 'recipes-browse__cat recipes-browse__cat--on' : 'recipes-browse__cat'} onClick={() => setCat(c)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {recipes.length > 0 && shown.length === 0 && (
        <div className="empty-state">No recipes match{find.trim() ? ` "${find.trim()}"` : ''}{cat ? ` in ${cat === NONE ? 'No category' : cat}` : ''}.</div>
      )}
      {shown.map((r) => (
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
            <div className="recipe-card__header recipe-card__header--peek" onClick={() => setPeek(r)} title="See the whole recipe">
              {r.thumbnail_url && <img className="recipe-card__thumb" src={r.thumbnail_url} alt="" />}
              <div className="recipe-card__title">
                {r.title}
                <span className="hint"> · {r.ingredients.length} ingredients</span>
                {r.category && <span className="badge">{r.category}</span>}
                <div className="hint">👀 Tap to see the whole recipe</div>
              </div>
              <span onClick={(e) => e.stopPropagation()}>
                <AddButton r={r} />
              </span>
            </div>
          </div>
        ))}
      </section>

      {peek && (
        <div className="modal-overlay" onClick={() => setPeek(null)}>
          <div className="modal-panel panel recipe-peek" role="dialog" aria-label={peek.title} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="recipe-peek__close" aria-label="Close" onClick={() => setPeek(null)}>
              ✕
            </button>
            {peek.thumbnail_url && <img className="recipe-peek__photo" src={peek.thumbnail_url} alt="" />}
            <h2>{peek.title}</h2>
            {peek.category && <span className="badge">{peek.category}</span>}
            <h3>🧂 Ingredients ({peek.ingredients.length})</h3>
            <ul className="recipe-card__ingredients">
              {peek.ingredients.map((ing, i) => (
                <li key={i}>
                  {ing.quantity ?? ''} {ing.name}
                </li>
              ))}
            </ul>
            {peek.instructions && (
              <>
                <h3>👩‍🍳 How to make it</h3>
                <p className="recipe-card__instructions">{peek.instructions}</p>
              </>
            )}
            <div className="recipe-peek__actions">
              <AddButton r={peek} />
              <button type="button" className="secondary" onClick={() => setPeek(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
