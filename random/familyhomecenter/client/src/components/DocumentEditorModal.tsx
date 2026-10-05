import { useEffect, useRef, useState } from 'react';
import { api, type PhotoDetail } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { ConfirmButton } from './ConfirmButton.js';
import { PhotoPicker } from './PhotoPicker.js';
import { schoolProject, sectionsByDay, yearInReview, type TemplateSection } from '../utils/documentTemplates.js';

/** GET /photo-documents/:id (server/src/routes/photoDocuments.ts). */
interface SavedDocument {
  id: string;
  title: string;
  cover: { id: string | null; path: string; caption: string } | null;
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
  /** Writing prompt shown in the empty text box (from a template) — not saved. */
  prompt?: string;
}

/** Options for "sections by day" / Year in review: leave out blurry shots and extra duplicates. */
const BEST_PHOTOS_ONLY = { excludeBlurry: true, excludeDuplicates: true };

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
  const [cover, setCover] = useState<{ id: string | null; path: string | null; caption: string } | null>(null);
  const [pickingCover, setPickingCover] = useState(false);
  // New documents start by picking a template (or Blank); the trip/year ones ask a little first.
  const [templateStep, setTemplateStep] = useState<'choose' | 'trip' | 'year' | null>(documentId ? null : 'choose');
  const [byDayOpen, setByDayOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [perDay, setPerDay] = useState(6);
  const [bestOnly, setBestOnly] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear() - (new Date().getMonth() < 2 ? 1 : 0));
  const [perMonth, setPerMonth] = useState(6);
  const [building, setBuilding] = useState(false);
  const details = useRef<PhotoDetail[] | null>(null);

  const snapshot = JSON.stringify({
    title,
    cover,
    sections: sections.map(({ key: _k, prompt: _p, photos, ...s }) => ({ ...s, photos: photos.map(({ key: _pk, ...p }) => p) })),
  });
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
        setCover(doc.cover ? { id: doc.cover.id, path: doc.cover.path, caption: doc.cover.caption } : null);
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

  /** Every photo's date/path/quality — fetched once, only when a template or "by day" needs it. */
  const loadDetails = async (): Promise<PhotoDetail[]> => {
    if (!details.current) details.current = await api.get<PhotoDetail[]>('/photos/details');
    return details.current;
  };

  const toEditorSections = (list: TemplateSection[]): EditorSection[] =>
    list.map((t) => ({
      key: key(),
      heading: t.heading,
      text: t.text,
      prompt: t.prompt,
      columns: t.columns,
      photos: t.photoIds.map((id) => ({ key: key(), id, path: null, caption: '' })),
    }));

  /** Runs a template/"by day" builder; `replace` swaps out the (still-empty) starting section. */
  const build = async (make: (photos: PhotoDetail[]) => TemplateSection[], replace: boolean, emptyMessage: string) => {
    setError(null);
    setBuilding(true);
    try {
      const made = make(await loadDetails());
      if (made.length === 0) {
        setError(emptyMessage);
        return false;
      }
      setSections((cur) => {
        const keep = replace ? cur.filter((s) => s.heading || s.text || s.photos.length) : cur;
        return [...keep, ...toEditorSections(made)];
      });
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBuilding(false);
    }
  };

  const quality = bestOnly ? BEST_PHOTOS_ONLY : { excludeBlurry: false, excludeDuplicates: false };

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
      cover: cover ? { id: cover.id, path: cover.path, caption: cover.caption } : null,
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

            {templateStep === 'choose' && (
              <div className="doc-editor__templates">
                <span className="member-form__label">Start with</span>
                <div className="doc-editor__template-buttons">
                  <button type="button" className="secondary" onClick={() => setTemplateStep(null)}>📄 Blank</button>
                  <button type="button" className="secondary" onClick={() => setTemplateStep('trip')}>🧳 Trip journal</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setSections(toEditorSections(schoolProject()));
                      setTemplateStep(null);
                    }}
                  >
                    🔬 School project
                  </button>
                  <button type="button" className="secondary" onClick={() => setTemplateStep('year')}>🗓️ Year in review</button>
                </div>
              </div>
            )}
            {templateStep === 'trip' && (
              <div className="doc-editor__templates">
                <span className="member-form__label">Trip journal — a section for each day, with that day's pictures</span>
                <div className="task-form__row">
                  <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} aria-label="Trip start" />
                  <span className="hint">to</span>
                  <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} aria-label="Trip end" />
                </div>
                <ByDayOptions perDay={perDay} setPerDay={setPerDay} bestOnly={bestOnly} setBestOnly={setBestOnly} />
                <div className="task-form__row">
                  <button
                    type="button"
                    disabled={!rangeStart || !rangeEnd || building}
                    onClick={async () => {
                      if (await build((ph) => sectionsByDay(ph, rangeStart, rangeEnd, perDay, quality), true, 'No photos were taken between those dates.')) {
                        setTemplateStep(null);
                      }
                    }}
                  >
                    {building ? 'Building…' : 'Make the sections'}
                  </button>
                  <button type="button" className="secondary" onClick={() => setTemplateStep('choose')}>Back</button>
                </div>
              </div>
            )}
            {templateStep === 'year' && (
              <div className="doc-editor__templates">
                <span className="member-form__label">Year in review — a section for each month</span>
                <div className="task-form__row">
                  <label className="member-form__label member-form__label--inline">
                    Year
                    <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
                  </label>
                  <label className="member-form__label member-form__label--inline">
                    Pictures per month
                    <select value={perMonth} onChange={(e) => setPerMonth(Number(e.target.value))}>
                      {[3, 6, 9, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
                <label className="movie-maker__check">
                  <input type="checkbox" checked={bestOnly} onChange={(e) => setBestOnly(e.target.checked)} />
                  Skip blurry photos and extra duplicates
                </label>
                <p className="hint">Pictures are spread across each month, start to finish.</p>
                <div className="task-form__row">
                  <button
                    type="button"
                    disabled={building}
                    onClick={async () => {
                      if (await build((ph) => yearInReview(ph, year, perMonth, quality), true, `No photos from ${year}.`)) {
                        if (!title.trim()) setTitle(`Our ${year}`);
                        setTemplateStep(null);
                      }
                    }}
                  >
                    {building ? 'Building…' : 'Make the sections'}
                  </button>
                  <button type="button" className="secondary" onClick={() => setTemplateStep('choose')}>Back</button>
                </div>
              </div>
            )}

            <div className="doc-editor__cover">
              <span className="member-form__label">Cover photo (optional — a big picture on its own first page)</span>
              {cover ? (
                <div className="doc-editor__cover-row">
                  {cover.id ? (
                    <img src={`/api/photos/${cover.id}/image`} alt="" />
                  ) : (
                    <div className="doc-editor__missing">Photo no longer in the library</div>
                  )}
                  <div className="doc-editor__cover-fields">
                    <input placeholder="Cover caption (optional)" value={cover.caption} onChange={(e) => setCover({ ...cover, caption: e.target.value })} />
                    <div className="task-form__row">
                      <button type="button" className="secondary" onClick={() => setPickingCover(true)}>Change</button>
                      <button type="button" className="secondary" onClick={() => setCover(null)}>Remove</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button type="button" className="secondary doc-editor__cover-add" onClick={() => setPickingCover(true)}>🖼️ Choose a cover photo</button>
              )}
            </div>

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
                  placeholder={section.prompt ?? 'Write about this group of pictures (optional)'}
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

            <div className="task-form__row">
              <button type="button" className="secondary" onClick={() => setSections((cur) => [...cur, newSection()])}>
                ＋ Add a section
              </button>
              <button type="button" className="secondary" onClick={() => setByDayOpen((v) => !v)}>
                📅 Add sections by day…
              </button>
            </div>
            {byDayOpen && (
              <div className="doc-editor__templates">
                <span className="member-form__label">A new section for each day in this range, with that day's pictures</span>
                <div className="task-form__row">
                  <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} aria-label="From" />
                  <span className="hint">to</span>
                  <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} aria-label="To" />
                </div>
                <ByDayOptions perDay={perDay} setPerDay={setPerDay} bestOnly={bestOnly} setBestOnly={setBestOnly} />
                <div className="task-form__row">
                  <button
                    type="button"
                    disabled={!rangeStart || !rangeEnd || building}
                    onClick={async () => {
                      if (await build((ph) => sectionsByDay(ph, rangeStart, rangeEnd, perDay, quality), false, 'No photos were taken between those dates.')) {
                        setByDayOpen(false);
                      }
                    }}
                  >
                    {building ? 'Adding…' : 'Add the sections'}
                  </button>
                  <button type="button" className="secondary" onClick={() => setByDayOpen(false)}>Cancel</button>
                </div>
              </div>
            )}
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

      {pickingCover && (
        <PhotoPicker
          title="Choose a cover photo (the first one picked is used)"
          alreadyAdded={new Set()}
          onAdd={(ids) => {
            if (ids[0]) setCover((cur) => ({ id: ids[0], path: null, caption: cur?.caption ?? '' }));
            setPickingCover(false);
          }}
          onClose={() => setPickingCover(false)}
        />
      )}

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

function ByDayOptions({
  perDay,
  setPerDay,
  bestOnly,
  setBestOnly,
}: {
  perDay: number;
  setPerDay: (n: number) => void;
  bestOnly: boolean;
  setBestOnly: (b: boolean) => void;
}) {
  return (
    <>
      <label className="member-form__label member-form__label--inline">
        Pictures per day
        <select value={perDay} onChange={(e) => setPerDay(Number(e.target.value))}>
          <option value={4}>Up to 4</option>
          <option value={6}>Up to 6</option>
          <option value={12}>Up to 12</option>
          <option value={0}>All of them</option>
        </select>
      </label>
      <label className="movie-maker__check">
        <input type="checkbox" checked={bestOnly} onChange={(e) => setBestOnly(e.target.checked)} />
        Skip blurry photos and extra duplicates
      </label>
    </>
  );
}
