import { useEffect, useRef, useState } from 'react';
import { api, type KbArticle, type KbMedia } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { KbArticleFormModal } from '../components/KbArticleFormModal.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { downscaleImageToDataUrl } from '../utils/images.js';

const IMAGE_MAX_DIMENSION = 1600; // a how-to photo needs more detail than a small avatar

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** youtube.com/watch?v=, youtu.be/, or an already-/embed/ link → an embeddable URL; else null. */
function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith('/embed/')) return url;
    }
    return null;
  } catch {
    return null;
  }
}

function MediaItem({ media, canManage, onDelete }: { media: KbMedia; canManage: boolean; onDelete: () => void }) {
  let content: React.ReactNode;
  if (media.kind === 'image') {
    content = <img className="kb-page__media-image" src={`/api/kb-media/${media.file_name}`} alt="" />;
  } else if (media.kind === 'video') {
    content = <video className="kb-page__media-video" src={`/api/kb-media/${media.file_name}`} controls />;
  } else {
    const embed = media.external_url ? youtubeEmbedUrl(media.external_url) : null;
    content = embed ? (
      <iframe
        className="kb-page__media-video"
        src={embed}
        title="Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    ) : (
      <a href={media.external_url ?? '#'} target="_blank" rel="noreferrer" className="link-button">
        {media.external_url}
      </a>
    );
  }
  return (
    <div className="kb-page__media-item">
      {content}
      {canManage && (
        <ConfirmButton
          label="✕"
          ariaLabel="Remove this media"
          confirmLabel="Remove this?"
          onConfirm={onDelete}
          className="kb-page__media-remove"
        />
      )}
    </div>
  );
}

function ArticleCard({
  article,
  canManage,
  onEdit,
  onChange,
}: {
  article: KbArticle;
  canManage: boolean;
  onEdit: () => void;
  onChange: () => void;
}) {
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const remove = async () => {
    await api.delete(`/knowledge-base/${article.id}`);
    onChange();
  };

  const removeMedia = async (mediaId: string) => {
    await api.delete(`/knowledge-base/${article.id}/media/${mediaId}`);
    onChange();
  };

  const addImage = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data_url = await downscaleImageToDataUrl(file, IMAGE_MAX_DIMENSION);
      await api.post(`/knowledge-base/${article.id}/media`, { kind: 'image', data_url });
      onChange();
    } catch (err) {
      setError((err as Error).message || 'Could not add that photo');
    } finally {
      setBusy(false);
    }
  };

  const addVideo = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data_url = await readFileAsDataUrl(file);
      await api.post(`/knowledge-base/${article.id}/media`, { kind: 'video', data_url });
      onChange();
    } catch (err) {
      setError((err as Error).message || 'Could not add that video — try keeping clips short (~1 min)');
    } finally {
      setBusy(false);
    }
  };

  const addLink = async () => {
    if (!linkUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/knowledge-base/${article.id}/media`, { kind: 'video_link', external_url: linkUrl.trim() });
      setLinkUrl('');
      setAddingLink(false);
      onChange();
    } catch (err) {
      setError((err as Error).message || 'Could not add that link');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel kb-page__card">
      <div className="contacts-page__card-header">
        <div>
          <h2>{article.title}</h2>
          {article.category && <span className="badge">{article.category}</span>}
        </div>
        {canManage && (
          <div className="task-form__row">
            <button type="button" className="task-card__edit" aria-label="Edit" onClick={onEdit}>✎</button>
            <ConfirmButton
              label="✕"
              ariaLabel={`Delete ${article.title}`}
              confirmLabel={`Delete "${article.title}"?`}
              onConfirm={remove}
              className="task-card__edit"
            />
          </div>
        )}
      </div>

      {article.body && <p className="kb-page__body">{article.body}</p>}

      {article.media.length > 0 && (
        <div className="kb-page__media-grid">
          {article.media.map((m) => (
            <MediaItem key={m.id} media={m} canManage={canManage} onDelete={() => removeMedia(m.id)} />
          ))}
        </div>
      )}

      {canManage && (
        <div className="kb-page__media-add">
          <div className="task-form__row">
            <button type="button" className="secondary" onClick={() => imageInput.current?.click()} disabled={busy}>
              + Photo
            </button>
            <button type="button" className="secondary" onClick={() => videoInput.current?.click()} disabled={busy}>
              + Video
            </button>
            <button type="button" className="secondary" onClick={() => setAddingLink((v) => !v)} disabled={busy}>
              + Video link
            </button>
          </div>
          {addingLink && (
            <div className="task-form__row">
              <input placeholder="YouTube (or other video) URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
              <button type="button" onClick={addLink} disabled={busy}>Add</button>
            </div>
          )}
          {error && <div className="settings-login__error">{error}</div>}
          <input ref={imageInput} type="file" accept="image/*" hidden onChange={(e) => addImage(e.target.files?.[0] ?? null)} />
          <input ref={videoInput} type="file" accept="video/*" hidden onChange={(e) => addVideo(e.target.files?.[0] ?? null)} />
        </div>
      )}
    </section>
  );
}

/**
 * Household how-to guides — "shut off the main water valve", "reset a tripped breaker" — anyone
 * can read (important in an actual emergency), but only a parent can add/edit/remove an article
 * or its media (see routes/knowledgeBase.ts's requireAdmin gates).
 */
export function KnowledgeBasePage() {
  const { activeProfile } = useFamilyMembers();
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [modalArticle, setModalArticle] = useState<KbArticle | null | undefined>(undefined);

  const canManage = activeProfile?.is_parent === 1;

  const load = () => {
    api.get<KbArticle[]>('/knowledge-base').then(setArticles).catch(console.error);
  };
  useEffect(load, []);

  return (
    <div className="kb-page">
      <div className="tasks-page__header">
        {canManage && (
          <button type="button" className="icon-button" aria-label="Add article" onClick={() => setModalArticle(null)}>+</button>
        )}
        <h1>Knowledge Base</h1>
      </div>
      <p className="hint">How-to guides for the house — everyone can read these, only a parent can add or change one.</p>

      {articles.length === 0 && <div className="empty-state">Nothing here yet{canManage ? ' — add one above.' : '.'}</div>}
      <div className="kb-page__grid">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} canManage={canManage} onEdit={() => setModalArticle(a)} onChange={load} />
        ))}
      </div>

      {modalArticle !== undefined && (
        <KbArticleFormModal
          article={modalArticle}
          onClose={() => setModalArticle(undefined)}
          onSaved={() => {
            setModalArticle(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
