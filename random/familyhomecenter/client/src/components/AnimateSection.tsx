import { useEffect, useState } from 'react';
import { api, type LivingEffect, type LivingOverlay, type Movie } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { ConfirmButton } from './ConfirmButton.js';
import { PhotoPicker } from './PhotoPicker.js';
import { fmtMadeOn, OwnedListControls, sortOwned, type OwnedSort } from './OwnedListControls.js';
import { AreaPainter, isPainted, REGION_EFFECTS, type PaintedArea } from './AreaPainter.js';

/**
 * Photos → ✨ Animate: "living photos" — one photo made into a short clip that loops, with a slow
 * zoom toward the faces, a gentle drift, or a 3-D depth effect, and optionally sparkles, snow,
 * hearts, bubbles, or petals drifting over it (made on the Pi: server/src/services/livingPhoto.ts).
 * Saved like a movie, so it can be watched, downloaded, played as the screensaver — or used as
 * someone's avatar.
 */

export const EFFECTS: Array<{ id: LivingEffect; label: string; hint: string }> = [
  { id: 'zoom', label: '🔍 Zoom to faces', hint: 'Slowly moves in on the people, then back out' },
  { id: 'drift', label: '🌊 Gentle drift', hint: 'A slow side-to-side pan across the photo' },
  { id: 'depth', label: '🌄 3-D depth', hint: 'Glides into the scene: near things move more than far ones' },
  { id: 'still', label: '📷 Still', hint: 'The photo stays put; only painted areas and floating things move' },
];

export const OVERLAYS: Array<{ id: LivingOverlay; label: string }> = [
  { id: 'none', label: 'Nothing' },
  { id: 'sparkles', label: '✨ Sparkles' },
  { id: 'snow', label: '❄️ Snow' },
  { id: 'rain', label: '🌧️ Rain' },
  { id: 'hearts', label: '💖 Hearts' },
  { id: 'bubbles', label: '🫧 Bubbles' },
  { id: 'petals', label: '🌸 Petals' },
];

const LENGTHS = [5, 8, 12];

/** What floats across the little preview (just a hint of the real thing). */
const PREVIEW_PARTICLE: Record<LivingOverlay, string> = { none: '', sparkles: '✨', snow: '❄️', rain: '╱', hearts: '💖', bubbles: '○', petals: '🌸' };

export function livingLabel(m: Movie): string {
  if (!m.living) return '';
  const effect = EFFECTS.find((e) => e.id === m.living!.effect)?.label ?? '';
  const overlay = m.living.overlay !== 'none' ? ` + ${OVERLAYS.find((o) => o.id === m.living!.overlay)?.label ?? ''}` : '';
  const areas = (m.living.regions ?? []).map((r) => ` + ${REGION_EFFECTS.find((e) => e.id === r.effect)?.label ?? r.effect}`).join('');
  return effect + areas + overlay;
}

/** The maker, as a pop-over: for the Animate tab's "+", and the ✨ button on a photo in the viewer. */
export function AnimateMakerModal({ photoId: initialPhotoId, onClose, onMade }: { photoId?: string; onClose: () => void; onMade: () => void }) {
  const { activeProfile } = useFamilyMembers();
  const [photoId, setPhotoId] = useState<string | null>(initialPhotoId ?? null);
  const [picking, setPicking] = useState(!initialPhotoId);
  const [effect, setEffect] = useState<LivingEffect>('zoom');
  const [overlay, setOverlay] = useState<LivingOverlay>('none');
  const [seconds, setSeconds] = useState(8);
  const [title, setTitle] = useState('');
  const [areas, setAreas] = useState<PaintedArea[]>([]);
  const [painting, setPainting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = async () => {
    if (!photoId) return;
    setBusy(true);
    setError(null);
    try {
      const regions = areas
        .filter(isPainted)
        .map((a) => ({ effect: a.effect, direction: a.direction, mask: a.mask.toDataURL('image/png') }));
      if (effect === 'still' && !regions.length && overlay === 'none') {
        throw new Error('With Still, paint an area to animate or pick something to float over it.');
      }
      await api.post('/movies/living', { photo_id: photoId, effect, overlay, seconds, regions, title: title.trim(), created_by_id: activeProfile?.id ?? null });
      onMade();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel task-form living-maker" onClick={(e) => e.stopPropagation()}>
        <h2>✨ Make a living photo</h2>
        {photoId ? (
          <div className="living-maker__top">
            <div className={`living-preview living-preview--${effect}`} style={{ animationDuration: `${seconds}s` }}>
              <img src={`/api/photos/${photoId}/image`} alt="" style={{ animationDuration: `${seconds}s` }} />
              {overlay !== 'none' && (
                <div className={`living-preview__particles living-preview__particles--${overlay}`}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-(i * 0.73) % 4}s` }}>{PREVIEW_PARTICLE[overlay]}</span>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="link-button" onClick={() => setPicking(true)}>Choose a different photo</button>
            <p className="hint">The preview is just a hint. The real clip is smoother and loops seamlessly.</p>
          </div>
        ) : (
          <button type="button" onClick={() => setPicking(true)}>📷 Choose a photo</button>
        )}

        <section className="living-maker__section">
          <h3>Movement</h3>
          <div className="living-maker__cards">
            {EFFECTS.map((e) => (
              <button key={e.id} type="button" className={`living-maker__card ${effect === e.id ? 'living-maker__card--on' : ''}`} onClick={() => setEffect(e.id)}>
                <strong>{e.label}</strong>
                <span className="hint">{e.hint}</span>
              </button>
            ))}
          </div>
        </section>

        {photoId && (
          <section className="living-maker__section">
            <h3>Animated areas (optional)</h3>
            {!painting ? (
              <>
                <p className="hint">
                  Make just part of it move: 💧 water, 🔥 flames, 🌿 leaves swaying, 🌫️ shimmer, ☁️ clouds, 💡 twinkling lights.
                  {areas.length > 0 && ` ${areas.filter(isPainted).length} painted.`}
                </p>
                <button type="button" className="secondary" onClick={() => setPainting(true)}>
                  🖌️ {areas.length ? 'Change painted areas' : 'Paint areas to animate'}
                </button>
              </>
            ) : (
              <>
                <AreaPainter key={photoId} photoId={photoId} areas={areas} setAreas={setAreas} />
                <button type="button" onClick={() => setPainting(false)}>Done painting</button>
              </>
            )}
          </section>
        )}

        <section className="living-maker__section">
          <h3>Floating over it</h3>
          <div className="living-maker__chips">
            {OVERLAYS.map((o) => (
              <button key={o.id} type="button" className={overlay === o.id ? '' : 'secondary'} onClick={() => setOverlay(o.id)}>{o.label}</button>
            ))}
          </div>
        </section>

        <section className="living-maker__section">
          <h3>Length</h3>
          <div className="living-maker__chips">
            {LENGTHS.map((s) => (
              <button key={s} type="button" className={seconds === s ? '' : 'secondary'} onClick={() => setSeconds(s)}>{s} seconds</button>
            ))}
          </div>
          <label className="member-form__label">
            Title (optional)
            <input value={title} maxLength={120} placeholder="e.g. Grandma's birthday" onChange={(e) => setTitle(e.target.value)} />
          </label>
        </section>

        {error && <div className="settings-login__error">{error}</div>}
        <p className="hint">Takes a few minutes on the Pi (3-D and painted areas take longest; the first 3-D one also downloads a 27 MB depth model once). Keep using the app; it shows up under ✨ Animate when it's ready.</p>
        <div className="task-form__row">
          <button type="button" onClick={make} disabled={!photoId || busy}>{busy ? 'Starting…' : '✨ Make it'}</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>

        {picking && (
          <PhotoPicker
            title="Choose a photo to bring to life (the first one picked is used)"
            alreadyAdded={new Set()}
            onAdd={(ids) => {
              if (ids[0] && ids[0] !== photoId) {
                setPhotoId(ids[0]);
                setAreas([]); // painted for the old photo
              }
              setPicking(false);
            }}
            onClose={() => {
              setPicking(false);
              if (!photoId) onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

export function AnimateSection() {
  const { members, activeProfile, refresh } = useFamilyMembers();
  const [clips, setClips] = useState<Movie[]>([]);
  const [making, setMaking] = useState(false);
  const [playing, setPlaying] = useState<Movie | null>(null);
  const [menu, setMenu] = useState<{ id: string; kind: 'avatar' | 'screensaver' } | null>(null);
  const [sort, setSort] = useState<OwnedSort>('newest');
  const [owner, setOwner] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const canManage = (m: Movie) => isParent || (m.created_by_id ? m.created_by_id === activeProfile?.id : false);
  // Whose avatar you can set: your own, or anyone's as a parent.
  const avatarFor = isParent ? members : members.filter((m) => m.id === activeProfile?.id);
  const creatorName = (m: Movie) => members.find((x) => x.id === m.created_by_id)?.name ?? null;

  const load = () =>
    api
      .get<Movie[]>('/movies')
      .then((all) => setClips(all.filter((m) => m.living)))
      .catch(console.error);
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!clips.some((m) => m.status === 'rendering')) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [clips]);

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setMenu(null);
      if (done) setNotice(done);
    } catch (err) {
      setError((err as Error).message);
    }
    load();
  };

  const groups = sortOwned(clips, { sort, owner, members, length: (m) => m.living?.seconds ?? 0 });

  return (
    <section className="panel movie-maker__section living-section">
      <div className="tasks-page__header">
        <button type="button" className="icon-button" aria-label="Make a living photo" onClick={() => setMaking(true)}>+</button>
        <h2>Living photos</h2>
      </div>
      <p className="hint">
        Bring one photo to life: a short clip that loops, with a slow zoom, a drift, or a 3-D look, and
        sparkles, snow, hearts and more if you like. Tip: tap ✨ on any photo in the viewer to start from it.
      </p>
      {error && <div className="settings-login__error">{error}</div>}
      {notice && <div className="living-section__notice">{notice}</div>}
      {clips.length === 0 && <div className="empty-state">No living photos yet. Tap + to make one.</div>}
      {clips.length > 0 && (
        <OwnedListControls
          sort={sort}
          onSort={setSort}
          owner={owner}
          onOwner={setOwner}
          members={members}
          lengthLabel={['Longest', 'Shortest']}
          count={groups.reduce((n, g) => n + g.items.length, 0)}
          noun="living photo"
        />
      )}
      {groups.map((g) => (
        <div key={g.label ?? 'all'} className="owned-group">
          {g.label && <h3 className="owned-group__label">{g.label} <span className="hint">({g.items.length})</span></h3>}
          <ul className="movie-maker__movie-list">
            {g.items.map((m) => (
              <li key={m.id}>
                <div className="movie-maker__movie-row">
                  <button type="button" className="living-section__thumb" disabled={m.status !== 'ready'} onClick={() => setPlaying(m)} aria-label={`Watch ${m.title}`}>
                    <img src={`/api/photos/${m.living!.photo_id}/image`} alt="" loading="lazy" />
                    {m.status === 'ready' && <span>▶</span>}
                  </button>
                  <div className="movie-maker__movie-info living-section__info">
                    <span className="movie-maker__movie-title">✨ {m.title}</span>
                    <span className="owned-meta">
                      <span>⏱️ {m.living!.seconds}s loop</span>
                      <span>📅 {fmtMadeOn(m.created_at)}</span>
                      <span>👤 {creatorName(m) ?? 'Nobody in particular'}</span>
                      {m.status === 'failed' && <span className="internet-page__bad">Failed</span>}
                    </span>
                    <span className="hint">{livingLabel(m)}</span>
                  </div>
                  <div className="task-form__row">
                    {m.status === 'ready' && (
                      <a className="movie-maker__download" href={`/api/movies-media/${m.file_name}`} download={`${m.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'living photo'}.mp4`}>
                        ⬇ Download
                      </a>
                    )}
                    {m.status === 'ready' && avatarFor.length > 0 && (
                      <button type="button" className="secondary" onClick={() => setMenu(menu?.id === m.id && menu.kind === 'avatar' ? null : { id: m.id, kind: 'avatar' })}>
                        🙂 Avatar
                      </button>
                    )}
                    {m.status === 'ready' && isParent && (
                      <button type="button" className="secondary" onClick={() => setMenu(menu?.id === m.id && menu.kind === 'screensaver' ? null : { id: m.id, kind: 'screensaver' })}>
                        📺 Screensaver
                      </button>
                    )}
                    {canManage(m) && (
                      <ConfirmButton
                        label="✕"
                        ariaLabel={`Delete ${m.title}`}
                        confirmLabel={`Delete "${m.title}"?`}
                        onConfirm={() => act(() => api.delete(`/movies/${m.id}`))}
                        className="task-card__edit"
                      />
                    )}
                  </div>
                </div>
                {menu?.id === m.id && menu.kind === 'avatar' && (
                  <div className="movie-maker__screensaver-menu">
                    <span>Make it the avatar for:</span>
                    {avatarFor.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() =>
                          act(async () => {
                            await api.post(`/family-members/${x.id}/avatar-from-movie`, { movie_id: m.id });
                            await refresh();
                          }, `✨ ${x.name}'s avatar is now "${m.title}".`)
                        }
                      >
                        {x.name}
                      </button>
                    ))}
                    <button type="button" className="secondary" onClick={() => setMenu(null)}>Cancel</button>
                  </div>
                )}
                {menu?.id === m.id && menu.kind === 'screensaver' && (
                  <div className="movie-maker__screensaver-menu">
                    <span>Play "{m.title}" as the screensaver:</span>
                    {([['Today', 1], ['For a week', 7], ['Until I turn it off', null]] as const).map(([label, days]) => (
                      <button key={label} type="button" onClick={() => act(() => api.put('/movies/screensaver', { movie_id: m.id, days, sound: false }), `📺 "${m.title}" is on the screensaver.`)}>
                        {label}
                      </button>
                    ))}
                    <button type="button" className="secondary" onClick={() => setMenu(null)}>Cancel</button>
                  </div>
                )}
                {m.status === 'rendering' && (
                  <div className="movie-maker__movie-progress">
                    <div className="progress-bar">
                      <div className="progress-bar__fill" style={{ width: `${m.progress_percent ?? 0}%` }} />
                    </div>
                    <span className="hint">
                      {(m.progress_percent ?? 0) === 0 ? 'Waiting its turn…' : `Bringing it to life… ${Math.round(m.progress_percent ?? 0)}%`}
                    </span>
                  </div>
                )}
                {m.error && m.status === 'failed' && <p className="hint">{m.error}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {making && (
        <AnimateMakerModal
          onClose={() => setMaking(false)}
          onMade={() => {
            setMaking(false);
            load();
          }}
        />
      )}

      {playing && (
        <div className="modal-overlay" onClick={() => setPlaying(null)}>
          <div className="modal-panel movie-maker__player" onClick={(e) => e.stopPropagation()}>
            <h2>{playing.title}</h2>
            <video className="movie-maker__video" src={`/api/movies-media/${playing.file_name}`} autoPlay loop muted playsInline controls />
            <button type="button" className="secondary" onClick={() => setPlaying(null)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}
