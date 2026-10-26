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

/** A how-to photo, full screen: ‹ › through the article's photos, ✕ / Esc / tap outside to close. */
function MediaLightbox({ images, index, onIndex, onClose }: { images: KbMedia[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const many = images.length > 1;
  const step = (d: number) => onIndex((index + d + images.length) % images.length);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowLeft') step(-1);
      else if (many && e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const img = images[index];
  if (!img) return null;
  return (
    <div className="photo-lightbox" role="dialog" aria-label="Photo" onClick={onClose}>
      <img src={`/api/kb-media/${img.file_name}`} alt="" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="photo-lightbox__close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      {many && (
        <>
          <button type="button" className="photo-lightbox__nav photo-lightbox__nav--prev" aria-label="Previous photo" onClick={(e) => (e.stopPropagation(), step(-1))}>
            ‹
          </button>
          <button type="button" className="photo-lightbox__nav photo-lightbox__nav--next" aria-label="Next photo" onClick={(e) => (e.stopPropagation(), step(1))}>
            ›
          </button>
          <div className="kb-page__lightbox-count">
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
}

function MediaItem({ media, canManage, onDelete, onOpen }: { media: KbMedia; canManage: boolean; onDelete: () => void; onOpen: () => void }) {
  let content: React.ReactNode;
  if (media.kind === 'image') {
    content = (
      <button type="button" className="kb-page__media-open" aria-label="See it big" onClick={onOpen}>
        <img className="kb-page__media-image" src={`/api/kb-media/${media.file_name}`} alt="" />
        <span className="kb-page__media-zoom" aria-hidden="true">🔍</span>
      </button>
    );
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
  expanded,
  onToggle,
  onEdit,
  onChange,
}: {
  article: KbArticle;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChange: () => void;
}) {
  const [addingLink, setAddingLink] = useState(false);
  // Which of the article's photos is open full screen.
  const [big, setBig] = useState<number | null>(null);
  const images = article.media.filter((m) => m.kind === 'image');
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

  const photos = article.media.filter((m) => m.kind === 'image').length;
  const videos = article.media.length - photos;
  const preview = (article.body ?? '').trim().split('\n')[0];

  return (
    <section className={`panel kb-page__card ${expanded ? 'kb-page__card--open' : 'kb-page__card--collapsed'}`}>
      <div className="contacts-page__card-header">
        <button
          type="button"
          className="kb-page__summary"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <h2>{article.title}</h2>
          <span className="kb-page__meta">
            {article.parents_only === 1 && <span className="badge kb-page__parents">🔒 Parents only</span>}
            {article.category && <span className="badge">{article.category}</span>}
            {photos > 0 && <span className="hint">📷 {photos}</span>}
            {videos > 0 && <span className="hint">🎬 {videos}</span>}
          </span>
          {!expanded && preview && <span className="kb-page__preview">{preview}</span>}
        </button>
        <div className="task-form__row kb-page__card-tools">
          {expanded && canManage && (
            <>
              <button type="button" className="task-card__edit" aria-label="Edit" onClick={onEdit}>✎</button>
              <ConfirmButton
                label="✕"
                ariaLabel={`Delete ${article.title}`}
                confirmLabel={`Delete "${article.title}"?`}
                onConfirm={remove}
                className="task-card__edit"
              />
            </>
          )}
          <button
            type="button"
            className="person-column__expand"
            aria-label={expanded ? `Collapse ${article.title}` : `Expand ${article.title}`}
            onClick={onToggle}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && article.body && <p className="kb-page__body">{article.body}</p>}

      {expanded && article.media.length > 0 && (
        <div className="kb-page__media-grid">
          {article.media.map((m) => (
            <MediaItem
              key={m.id}
              media={m}
              canManage={canManage}
              onDelete={() => removeMedia(m.id)}
              onOpen={() => setBig(images.findIndex((x) => x.id === m.id))}
            />
          ))}
        </div>
      )}
      {big !== null && <MediaLightbox images={images} index={big} onIndex={setBig} onClose={() => setBig(null)} />}

      {expanded && canManage && (
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
  // Collapsed by default (like the Family Board) — titles at a glance, tap one to read it.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canManage = activeProfile?.is_parent === 1;

  const load = () => {
    api.get<KbArticle[]>('/knowledge-base').then(setArticles).catch(console.error);
  };
  // Who's picked up top decides what the server sends (a parent's login gets the 🔒 ones too).
  useEffect(load, [activeProfile?.id]);
  // Before parents have passwords the server can't tell who's asking — hide 🔒 ones from kids here.
  const visible = canManage ? articles : articles.filter((a) => a.parents_only !== 1);

  return (
    <div className="kb-page">
      <div className="tasks-page__header">
        {canManage && (
          <button type="button" className="icon-button" aria-label="Add article" onClick={() => setModalArticle(null)}>+</button>
        )}
        <h1>Knowledge Base</h1>
      </div>
      <p className="hint">
        How-to guides for the house — everyone can read these (except 🔒 Parents only ones), only a parent can add or change one.
        Tap a guide to open it.
      </p>
      {visible.length > 1 && (
        <div className="kb-page__all">
          <button type="button" className="link-button" onClick={() => setOpenIds(new Set(visible.map((a) => a.id)))}>Open all</button>
          <button type="button" className="link-button" onClick={() => setOpenIds(new Set())} disabled={openIds.size === 0}>Close all</button>
        </div>
      )}

      {visible.length === 0 && <div className="empty-state">Nothing here yet{canManage ? ' — add one above.' : '.'}</div>}
      <div className="kb-page__grid">
        {visible.map((a) => (
          <ArticleCard
            key={a.id}
            article={a}
            canManage={canManage}
            expanded={openIds.has(a.id)}
            onToggle={() => toggle(a.id)}
            onEdit={() => setModalArticle(a)} onChange={load} />
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
