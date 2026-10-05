import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { ConfirmButton } from './ConfirmButton.js';
import { PhotoPicker } from './PhotoPicker.js';

/** GET /photo-documents/:id (server/src/routes/photoDocuments.ts). */
interface SavedDocument {
  id: string;
  title: string;
  sections: Array<{
    heading: string;
    text: string;
    columns: 1 | 2 | 3;
    photos: Array<{ id: string | null; path: string; caption: string }>;
  }>;
}

interface EditorPhoto {
  key: number;
  /** null = no longer in the photo library (kept, by path, unless removed). */
  id: string | null;
  path: string | null;
  caption: string;
}

interface EditorSection {
  key: number;
  heading: string;
  text: string;
  columns: 1 | 2 | 3;
  photos: EditorPhoto[];
}

interface Props {
  /** Id of the document to edit; omit to start a new one. */
  documentId?: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Builds a photo document: an overall title, then sections — each an optional heading, some text,
 * and a group of pictures (each with an optional caption) laid out 1, 2, or 3 to a row. Saved to
 * the server; the .docx itself is generated on download (server/src/services/photoDocument.ts).
 */
export function DocumentEditorModal({ documentId, onClose, onSaved }: Props) {
  const { activeProfile } = useFamilyMembers();
  const nextKey = useRef(1);
  const key = () => nextKey.current++;
  const newSection = (): EditorSection => ({ key: key(), heading: '', text: '', columns: 2, photos: [] });

  const [title, setTitle] = useState('');
  const [sections, setSections] = useState<EditorSection[]>(() => [newSection()]);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [pickingFor, setPickingFor] = useState<number | null>(null); // section key
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // What was last loaded/saved, to know whether closing would lose anything.
  const [baseline, setBaseline] = useState<string | null>(null);

  const snapshot = JSON.stringify({ title, sections: sections.map(({ key: _k, photos, ...s }) => ({ ...s, photos: photos.map(({ key: _p, ...p }) => p) })) });
  const dirty = baseline !== null && snapshot !== baseline;

  useEffect(() => {
    if (!documentId) {
      setBaseline(snapshot);
      return;
    }
    api
      .get<SavedDocument>(`/photo-documents/${documentId}`)
      .then((doc) => {
        setTitle(doc.title);
        setSections(
          doc.sections.length
            ? doc.sections.map((s) => ({
                key: key(),
                heading: s.heading,
                text: s.text,
                columns: s.columns,
                photos: s.photos.map((p) => ({ key: key(), id: p.id, path: p.path, caption: p.caption })),
              }))
            : [newSection()]
        );
      })
      .catch((err) => setError(`Couldn't load this document: ${(err as Error).message}`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Baseline for an existing document once its content has landed in state.
  useEffect(() => {
    if (documentId && !loading && baseline === null) setBaseline(snapshot);
  }, [documentId, loading, baseline, snapshot]);

  const updateSection = (sectionKey: number, patch: Partial<EditorSection>) =>
    setSections((cur) => cur.map((s) => (s.key === sectionKey ? { ...s, ...patch } : s)));

  const moveSection = (index: number, delta: number) =>
    setSections((cur) => {
      const target = index + delta;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const updatePhoto = (sectionKey: number, photoKey: number, patch: Partial<EditorPhoto>) =>
    setSections((cur) =>
      cur.map((s) => (s.key === sectionKey ? { ...s, photos: s.photos.map((p) => (p.key === photoKey ? { ...p, ...patch } : p)) } : s))
    );

  const movePhoto = (sectionKey: number, index: number, delta: number) =>
    setSections((cur) =>
      cur.map((s) => {
        if (s.key !== sectionKey) return s;
        const target = index + delta;
        if (target < 0 || target >= s.photos.length) return s;
        const photos = [...s.photos];
        [photos[index], photos[target]] = [photos[target], photos[index]];
        return { ...s, photos };
      })
    );

  const removePhoto = (sectionKey: number, photoKey: number) =>
    setSections((cur) => cur.map((s) => (s.key === sectionKey ? { ...s, photos: s.photos.filter((p) => p.key !== photoKey) } : s)));

  const addPhotos = (sectionKey: number, ids: string[]) => {
    setSections((cur) =>
      cur.map((s) =>
        s.key === sectionKey ? { ...s, photos: [...s.photos, ...ids.map((id) => ({ key: key(), id, path: null, caption: '' }))] } : s
      )
    );
    setPickingFor(null);
  };

  const photoCount = sections.reduce((n, s) => n + s.photos.length, 0);

  const save = async (thenDownload: boolean) => {
    if (!title.trim()) {
      setError('Give the document a title');
      return;
    }
    setError(null);
    setSaving(true);
    const payload = {
      title: title.trim(),
      created_by_id: activeProfile?.id ?? null,
      sections: sections.map((s) => ({
        heading: s.heading,
        text: s.text,
        columns: s.columns,
        photos: s.photos.map((p) => ({ id: p.id, path: p.path, caption: p.caption })),
      })),
    };
    try {
      const saved = documentId
        ? await api.put<{ id: string }>(`/photo-documents/${documentId}`, payload)
        : await api.post<{ id: string }>('/photo-documents', payload);
      if (thenDownload) {
        const a = document.createElement('a');
        a.href = `/api/photo-documents/${saved.id}/download`;
        a.click();
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message || "Couldn't save the document");
    } finally {
      setSaving(false);
    }
  };

  const pickingSection = sections.find((s) => s.key === pickingFor);

  return (
    // Like the movie maker, no close-on-backdrop-click: this takes real effort to fill in.
    <div className="modal-overlay">
      <div className="modal-panel task-form movie-maker doc-editor">
        <h2>{documentId ? 'Edit document' : 'New document'}</h2>
        {loading ? (
          <p className="hint">Loading…</p>
        ) : (
          <>
            <input
              className="doc-editor__title"
              autoFocus={!documentId}
              placeholder="Document title (e.g. Our Summer 2026)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {sections.map((section, index) => (
              <section key={section.key} className="doc-editor__section">
                <div className="doc-editor__section-head">
                  <strong>Section {index + 1}</strong>
                  <span className="doc-editor__section-actions">
                    <button type="button" className="secondary" aria-label="Move section up" disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button>
                    <button type="button" className="secondary" aria-label="Move section down" disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button>
                    {sections.length > 1 && (
                      <ConfirmButton
                        label="✕"
                        ariaLabel={`Remove section ${index + 1}`}
                        confirmLabel="Remove section?"
                        yesLabel="Yes, remove"
                        onConfirm={() => setSections((cur) => cur.filter((s) => s.key !== section.key))}
                        className="task-card__edit"
                      />
                    )}
                  </span>
                </div>
                <input
                  placeholder="Section heading (optional, e.g. Day at the beach)"
                  value={section.heading}
                  onChange={(e) => updateSection(section.key, { heading: e.target.value })}
                />
                <textarea
                  rows={4}
                  placeholder="Write about this group of pictures (optional)"
                  value={section.text}
                  onChange={(e) => updateSection(section.key, { text: e.target.value })}
                />
                <div className="task-form__row doc-editor__photo-controls">
                  <button type="button" onClick={() => setPickingFor(section.key)}>＋ Add pictures</button>
                  <label className="member-form__label member-form__label--inline">
                    Layout
                    <select
                      value={section.columns}
                      onChange={(e) => updateSection(section.key, { columns: Number(e.target.value) as 1 | 2 | 3 })}
                    >
                      <option value={1}>Large — 1 per row</option>
                      <option value={2}>2 per row</option>
                      <option value={3}>3 per row</option>
                    </select>
                  </label>
                </div>
                {section.photos.length > 0 && (
                  <div className="doc-editor__photos">
                    {section.photos.map((photo, pi) => (
                      <div key={photo.key} className="doc-editor__photo">
                        {photo.id ? (
                          <img src={`/api/photos/${photo.id}/image`} alt="" loading="lazy" />
                        ) : (
                          <div className="doc-editor__missing">Photo no longer in the library</div>
                        )}
                        <textarea
                          rows={2}
                          placeholder="Caption (optional)"
                          value={photo.caption}
                          onChange={(e) => updatePhoto(section.key, photo.key, { caption: e.target.value })}
                        />
                        <div className="doc-editor__photo-actions">
                          <button type="button" className="secondary" aria-label="Move earlier" disabled={pi === 0} onClick={() => movePhoto(section.key, pi, -1)}>◀</button>
                          <button type="button" className="secondary" aria-label="Move later" disabled={pi === section.photos.length - 1} onClick={() => movePhoto(section.key, pi, 1)}>▶</button>
                          <button type="button" className="secondary" aria-label="Remove picture" onClick={() => removePhoto(section.key, photo.key)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            <button type="button" className="secondary" onClick={() => setSections((cur) => [...cur, newSection()])}>
              ＋ Add a section
            </button>
          </>
        )}

        {error && <div className="settings-login__error">{error}</div>}
        <p className="hint">
          {sections.length} section{sections.length === 1 ? '' : 's'} · {photoCount} picture{photoCount === 1 ? '' : 's'}.
          Downloads as a Word document (.docx) — pictures are turned the right way up and sized to fit the page.
        </p>
        <div className="task-form__row">
          <button type="button" disabled={saving || loading || !title.trim()} onClick={() => save(false)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="secondary" disabled={saving || loading || !title.trim()} onClick={() => save(true)}>
            Save &amp; download
          </button>
          {dirty ? (
            <ConfirmButton label="Close" ariaLabel="Close without saving" confirmLabel="Close without saving?" yesLabel="Yes, close" onConfirm={onClose} className="secondary" />
          ) : (
            <button type="button" className="secondary" onClick={onClose}>Close</button>
          )}
        </div>
      </div>

      {pickingSection && (
        <PhotoPicker
          title={`Add pictures to ${pickingSection.heading.trim() || `section ${sections.indexOf(pickingSection) + 1}`}`}
          alreadyAdded={new Set(pickingSection.photos.map((p) => p.id).filter((id): id is string => Boolean(id)))}
          onAdd={(ids) => addPhotos(pickingSection.key, ids)}
          onClose={() => setPickingFor(null)}
        />
      )}
    </div>
  );
}
