import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { RECIPE_CATEGORIES } from '../utils/recipeCategories.js';

interface Found {
  key: string;
  title: string;
  servings: number | null;
  category: string | null;
  ingredients: Array<{ quantity: string | null; name: string }>;
  instructions: string;
  page: number;
  author: string | null;
  already?: boolean;
}
interface Job {
  id: string;
  name: string;
  state: 'reading' | 'ocr' | 'done' | 'error';
  pages: number;
  page: number;
  ocrPages: number;
  error: string | null;
  recipes: Found[];
}
interface Draft {
  key: string;
  on: boolean;
  open: boolean;
  title: string;
  servings: string;
  category: string;
  author: string;
  page: number;
  ingredients: string;
  instructions: string;
  already: boolean;
}

const bookName = (file: string) =>
  file
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * 📕 Import recipes from a PDF — e.g. a scanned family cookbook. The Pi reads it (with OCR for
 * scanned pages), finds the recipes, and shows them here to check and fix before any are saved.
 * Each saved recipe remembers which book and page it came from, and who it's from.
 */
export function RecipePdfImport({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { activeProfile } = useFamilyMembers();
  const input = useRef<HTMLInputElement>(null);
  const [book, setBook] = useState('');
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const start = async (f: File) => {
    setError(null);
    setDrafts(null);
    setDone(null);
    if (!book) setBook(bookName(f.name));
    setUploading(true);
    try {
      const r = await fetch('/api/recipes/pdf', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'x-filename': encodeURIComponent(f.name) }, body: f });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `Upload failed (${r.status})`);
      setJob({ id: body.id, name: f.name, state: 'reading', pages: 0, page: 0, ocrPages: 0, error: null, recipes: [] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // Check on the reading every 2 seconds until it's done.
  useEffect(() => {
    if (!job || job.state === 'done' || job.state === 'error') return;
    const t = setTimeout(async () => {
      try {
        const j = await api.get<Job>(`/recipes/pdf/${job.id}`);
        setJob(j);
        if (j.state === 'done')
          setDrafts(
            j.recipes.map((r) => ({
              key: r.key,
              on: !r.already,
              open: false,
              title: r.title,
              servings: r.servings ? String(r.servings) : '',
              category: r.category ?? '',
              author: r.author ?? '',
              page: r.page,
              ingredients: r.ingredients.map((i) => [i.quantity, i.name].filter(Boolean).join(' ')).join('\n'),
              instructions: r.instructions,
              already: Boolean(r.already),
            }))
          );
      } catch (e) {
        setError((e as Error).message);
        setJob(null);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [job]);

  const set = (key: string, patch: Partial<Draft>) => setDrafts((all) => all?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null);
  const picked = drafts?.filter((d) => d.on && d.title.trim()) ?? [];
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await api.post<{ created: number }>('/recipes/bulk', {
        created_by_id: activeProfile?.id ?? null,
        recipes: picked.map((d) => ({
          title: d.title,
          servings: d.servings,
          category: d.category,
          author: d.author,
          origin: `${book.trim() || bookName(job?.name ?? 'Cookbook')}, p. ${d.page}`,
          ingredients_text: d.ingredients,
          instructions: d.instructions,
        })),
      });
      setDone(r.created);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reading = job && (job.state === 'reading' || job.state === 'ocr');
  const pct = job && job.state === 'ocr' && job.pages ? Math.round((job.page / job.pages) * 100) : null;

  return (
    <div className="modal-overlay" onClick={() => !reading && !saving && onClose()}>
      <div className="modal-panel panel recipe-pdf" onClick={(e) => e.stopPropagation()}>
        <h2>📕 Import recipes from a PDF</h2>
        {done !== null ? (
          <>
            <p className="recipe-pdf__done">
              ✅ Added {done} recipe{done === 1 ? '' : 's'} to My recipes.
            </p>
            <p className="hint">Each one says which book and page it came from. Add a 📷 picture to any of them with ✎.</p>
            <div className="task-form__row">
              <button type="button" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {!drafts && (
              <>
                <p className="hint">
                  A cookbook PDF — typed or scanned. The Pi reads it (scanned pages with OCR, which takes a little while per page), finds the recipes, and
                  shows them here to check before anything is saved.
                </p>
                <input
                  placeholder="Cookbook name — e.g. Huber Family Cookbook"
                  value={book}
                  onChange={(e) => setBook(e.target.value)}
                  aria-label="Cookbook name"
                />
                <input
                  ref={input}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void start(f);
                  }}
                />
                <button type="button" onClick={() => input.current?.click()} disabled={uploading || Boolean(reading)}>
                  {uploading ? 'Uploading…' : reading ? 'Reading…' : '📄 Pick the PDF'}
                </button>
                {reading && (
                  <div className="recipe-pdf__progress">
                    <span>
                      {job!.state === 'ocr'
                        ? `Reading scanned pages (OCR): page ${job!.page} of ${job!.pages}`
                        : 'Reading the PDF…'}
                    </span>
                    {pct !== null && (
                      <span className="photo-map__progress-bar">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    )}
                    <span className="hint">You can leave this open — it keeps going on the Pi.</span>
                  </div>
                )}
                {job?.state === 'error' && <div className="settings-login__error">{job.error}</div>}
              </>
            )}
            {drafts && (
              <>
                <div className="recipe-pdf__head">
                  <strong>
                    Found {drafts.length} recipe{drafts.length === 1 ? '' : 's'} in {job?.pages} page{job?.pages === 1 ? '' : 's'} · {picked.length} picked
                  </strong>
                  <span className="task-form__row">
                    <button type="button" className="link-button" onClick={() => setDrafts(drafts.map((d) => ({ ...d, on: true })))}>
                      Pick all
                    </button>
                    <button type="button" className="link-button" onClick={() => setDrafts(drafts.map((d) => ({ ...d, on: false })))}>
                      Pick none
                    </button>
                  </span>
                </div>
                <input placeholder="Cookbook name" value={book} onChange={(e) => setBook(e.target.value)} aria-label="Cookbook name" />
                {drafts.length === 0 && (
                  <div className="empty-state">
                    No recipes found. If it's a scanned book, the scan may be too faint to read — try scanning at 300 dpi in black and white.
                  </div>
                )}
                <ul className="recipe-pdf__list">
                  {drafts.map((d) => (
                    <li key={d.key} className={`recipe-pdf__item ${d.on ? '' : 'recipe-pdf__item--off'}`}>
                      <div className="recipe-pdf__row">
                        <input type="checkbox" checked={d.on} onChange={(e) => set(d.key, { on: e.target.checked })} aria-label={`Import ${d.title}`} />
                        <input className="recipe-pdf__title" value={d.title} onChange={(e) => set(d.key, { title: e.target.value })} aria-label="Title" />
                        <span className="hint">p. {d.page}</span>
                        <button type="button" className="secondary" onClick={() => set(d.key, { open: !d.open })}>
                          {d.open ? 'Hide' : 'Check'}
                        </button>
                      </div>
                      <div className="recipe-pdf__meta hint">
                        {d.ingredients.split('\n').filter(Boolean).length} ingredients
                        {d.author ? ` · 👩‍🍳 ${d.author}` : ''}
                        {d.category ? ` · ${d.category}` : ''}
                        {d.already ? ' · ⚠️ My recipes already has one with this name' : ''}
                      </div>
                      {d.open && (
                        <div className="recipe-pdf__edit">
                          <div className="task-form__row">
                            <input placeholder="Who it's from" value={d.author} onChange={(e) => set(d.key, { author: e.target.value })} aria-label="Who it's from" />
                            <select value={d.category} onChange={(e) => set(d.key, { category: e.target.value })} aria-label="Category">
                              <option value="">No category</option>
                              {RECIPE_CATEGORIES.filter((c) => c !== 'Other').map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              placeholder="Serves"
                              value={d.servings}
                              onChange={(e) => set(d.key, { servings: e.target.value })}
                              style={{ width: '6em' }}
                              aria-label="Serves"
                            />
                          </div>
                          <label className="hint">Ingredients — one per line (amount first)</label>
                          <textarea rows={Math.min(12, Math.max(4, d.ingredients.split('\n').length + 1))} value={d.ingredients} onChange={(e) => set(d.key, { ingredients: e.target.value })} />
                          <label className="hint">How to make it</label>
                          <textarea rows={6} value={d.instructions} onChange={(e) => set(d.key, { instructions: e.target.value })} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="task-form__row">
                  <button type="button" onClick={save} disabled={saving || picked.length === 0}>
                    {saving ? 'Saving…' : `Add ${picked.length} recipe${picked.length === 1 ? '' : 's'} to My recipes`}
                  </button>
                  <button type="button" className="secondary" onClick={onClose} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </>
            )}
            {error && <div className="settings-login__error">{error}</div>}
            {!drafts && (
              <div className="task-form__row">
                <button type="button" className="secondary" onClick={onClose}>
                  {reading ? 'Close (keeps reading)' : 'Cancel'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
