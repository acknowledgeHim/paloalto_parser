import { useState, type FormEvent } from 'react';
import { api, type KbArticle } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface Props {
  /** null = adding a new article. */
  article: KbArticle | null;
  onClose: () => void;
  onSaved: (article: KbArticle) => void;
}

/** Just the article's own text fields — attaching pictures/videos happens separately, from the
 *  article card, once it exists (see KnowledgeBasePage's media upload). */
export function KbArticleFormModal({ article, onClose, onSaved }: Props) {
  const { activeProfile } = useFamilyMembers();
  const [title, setTitle] = useState(article?.title ?? '');
  const [category, setCategory] = useState(article?.category ?? '');
  const [body, setBody] = useState(article?.body ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body_ = { title: title.trim(), category: category.trim() || null, body: body.trim() || null };
      const saved = article
        ? await api.patch<KbArticle>(`/knowledge-base/${article.id}`, body_)
        : await api.post<KbArticle>('/knowledge-base', { ...body_, created_by_id: activeProfile?.id ?? null });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message || 'Could not save this article');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{article ? 'Edit article' : 'Add article'}</h2>
        <input autoFocus placeholder="Title (e.g. Shut off the main water valve)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Category (e.g. Plumbing, Electrical, Safety)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <textarea
          placeholder="Steps — one per line works well"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && <div className="settings-login__error">{error}</div>}
        <div className="task-form__row">
          <button type="submit" disabled={saving}>{article ? 'Save' : 'Add'}</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
