import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type CameraClip, type CameraInfo } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

const STATUS: Record<string, string> = {
  ok: '🟢 Working',
  off: '⚪ Off',
  starting: '⏳ Starting…',
  'needs-https': '⚠️ Needs HTTPS — see docs/ANDROID_TABLET_SETUP.md',
  denied: '⚠️ Camera not allowed on the tablet — allow it in the kiosk app',
  'no-camera': '⚠️ No camera found on the tablet',
  error: '⚠️ The camera had a problem — try turning it off and on',
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : when(iso);
};

/** Who's asking — the server checks it's a parent (their login, or the parent picked up top). */
export function useActing() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const id = activeProfile?.id ?? '';
  return { isParent, id, q: id ? `acting_member_id=${encodeURIComponent(id)}` : '' };
}

/**
 * 📹 Cameras (parents only): every tablet that's been made a camera — turn it on or off, watch it
 * live, and look back at the movement it saved.
 */
export function CamerasPage() {
  const acting = useActing();
  const [cams, setCams] = useState<CameraInfo[] | null>(null);
  const [clips, setClips] = useState<CameraClip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [big, setBig] = useState<CameraInfo | null>(null);
  const [playing, setPlaying] = useState<CameraClip | null>(null);
  const [only, setOnly] = useState('');

  const load = () => {
    api
      .get<{ cameras: CameraInfo[] }>(`/cameras?${acting.q}`)
      .then((r) => {
        setCams(r.cameras);
        setError(null);
      })
      .catch((e) => setError(e.message));
    api.get<CameraClip[]>(`/cameras/clips?${acting.q}&device=${only}`).then(setClips).catch(() => {});
  };
  useEffect(() => {
    if (!acting.isParent) return;
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting.isParent, acting.id, only]);

  if (!acting.isParent) {
    return (
      <div className="cameras-page">
        <h1>📹 Cameras</h1>
        <div className="empty-state">Cameras are for parents — pick a parent up top.</div>
      </div>
    );
  }

  const change = async (c: CameraInfo, patch: Record<string, unknown>) => {
    try {
      const next = await api.patch<CameraInfo>(`/cameras/${c.id}`, { ...patch, acting_member_id: acting.id || null });
      setCams((all) => all?.map((x) => (x.id === c.id ? next : x)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const hideClip = async (clip: CameraClip) => {
    if (!window.confirm('Take this clip off the list? (The pictures stay saved on the Pi.)')) return;
    await api.post(`/cameras/clips/${clip.id}/hide`, { acting_member_id: acting.id || null }).catch((e) => setError(e.message));
    setPlaying(null);
    load();
  };
  const nameOf = (id: string) => cams?.find((c) => c.id === id)?.name ?? 'Camera';

  return (
    <div className="cameras-page">
      <div className="family-board__head">
        <h1>📹 Cameras</h1>
        <Link to="/settings" className="hint">
          ⚙️ Add a tablet in Settings → 📹 Cameras
        </Link>
      </div>
      {error && <div className="settings-login__error">{error}</div>}
      {cams?.length === 0 && (
        <div className="empty-state">
          No cameras yet. On the tablet, open Settings → 📹 Cameras → “Use this device as a camera”. Directions: docs/ANDROID_TABLET_SETUP.md.
        </div>
      )}
      <div className="cameras-grid">
        {cams?.map((c) => (
          <section key={c.id} className="panel camera-tile">
            <h2>
              {c.name} <span className="hint">{c.online ? '' : `· offline (seen ${ago(c.last_seen_at)})`}</span>
            </h2>
            <div className="camera-tile__view">
              {c.enabled && c.online && c.status === 'ok' ? (
                <button type="button" className="camera-tile__open" onClick={() => setBig(c)} aria-label={`Watch ${c.name} big`}>
                  <img src={`/api/cameras/${c.id}/live?${acting.q}`} alt={`${c.name} live`} />
                  <span className="camera-tile__live">● LIVE</span>
                </button>
              ) : (
                <div className="camera-tile__off">{!c.enabled ? '📷 Camera off' : !c.online ? '📴 Tablet offline' : STATUS[c.status ?? ''] ?? '⏳'}</div>
              )}
            </div>
            <div className="hint">{c.enabled ? STATUS[c.status ?? ''] ?? '' : ''}</div>
            <div className="camera-tile__controls">
              <label className="privacy-toggle">
                <input type="checkbox" checked={c.enabled === 1} onChange={(e) => change(c, { enabled: e.target.checked })} />
                Camera on
              </label>
              <label className="privacy-toggle">
                <input type="checkbox" checked={c.motion === 1} onChange={(e) => change(c, { motion: e.target.checked })} />
                Save movement (and email)
              </label>
              <select value={c.facing} onChange={(e) => change(c, { facing: e.target.value })} aria-label="Which camera">
                <option value="user">Front camera</option>
                <option value="environment">Back camera</option>
              </select>
              {c.motion === 1 && (
                <label className="camera-tile__sens">
                  Sensitivity
                  <input type="range" min={1} max={100} defaultValue={c.sensitivity} onPointerUp={(e) => change(c, { sensitivity: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => change(c, { sensitivity: Number((e.target as HTMLInputElement).value) })} />
                </label>
              )}
              <label className="privacy-toggle">
                <input type="checkbox" checked={c.show_badge === 1} onChange={(e) => change(c, { show_badge: e.target.checked })} />
                Show “📹 Camera on” on the tablet
              </label>
            </div>
            <div className="hint">
              {c.clip_count} clip{c.clip_count === 1 ? '' : 's'}
              {c.last_clip_at ? ` · last movement ${ago(c.last_clip_at)}` : ''}
            </div>
          </section>
        ))}
      </div>

      {(cams?.length ?? 0) > 0 && (
        <section className="panel">
          <div className="family-board__head">
            <h2>🎞️ Movement</h2>
            {(cams?.length ?? 0) > 1 && (
              <select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Which camera">
                <option value="">All cameras</option>
                {cams?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {clips.length === 0 && <div className="empty-state">Nothing saved yet. Turn on “Save movement” on a camera.</div>}
          <div className="camera-clips">
            {clips.map((clip) => (
              <button key={clip.id} type="button" className="camera-clip" onClick={() => setPlaying(clip)}>
                <img src={`/api/cameras/clips/${clip.id}/frames/1.jpg?${acting.q}`} alt="" loading="lazy" />
                <span>
                  <strong>{nameOf(clip.device_id)}</strong>
                  <br />
                  {when(clip.started_at)} · {Math.max(1, Math.round((Date.parse(clip.ended_at) - Date.parse(clip.started_at)) / 1000))}s
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {big && (
        <div className="photo-lightbox" role="dialog" aria-label={`${big.name} live`} onClick={() => setBig(null)}>
          <img src={`/api/cameras/${big.id}/live?${acting.q}`} alt="" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="photo-lightbox__close" aria-label="Close" onClick={() => setBig(null)}>
            ✕
          </button>
          <div className="kb-page__lightbox-count">● {big.name} — live</div>
        </div>
      )}
      {playing && <ClipPlayer clip={playing} q={acting.q} name={nameOf(playing.device_id)} onHide={() => hideClip(playing)} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/** Plays a clip's pictures (about one a second, sped up 2×), with a slider to look frame by frame. */
function ClipPlayer({ clip, q, name, onHide, onClose }: { clip: CameraClip; q: string; name: string; onHide: () => void; onClose: () => void }) {
  const [n, setN] = useState(1);
  const [play, setPlay] = useState(true);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setN((x) => (x >= clip.frames ? 1 : x + 1)), 500);
    return () => clearInterval(t);
  }, [play, clip.frames]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  // Load the next few ahead so playback doesn't flicker.
  useEffect(() => {
    for (let k = n + 1; k <= Math.min(clip.frames, n + 4); k++) new Image().src = `/api/cameras/clips/${clip.id}/frames/${k}.jpg?${q}`;
  }, [n, clip, q]);
  return (
    <div className="photo-lightbox camera-player" role="dialog" aria-label="Movement clip" onClick={onClose}>
      <img src={`/api/cameras/clips/${clip.id}/frames/${n}.jpg?${q}`} alt="" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="photo-lightbox__close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <div className="camera-player__bar" onClick={(e) => e.stopPropagation()}>
        <span>
          {name} · {when(clip.started_at)}
        </span>
        <button type="button" className="secondary" onClick={() => setPlay(!play)}>
          {play ? '⏸' : '▶️'}
        </button>
        <input type="range" min={1} max={clip.frames} value={n} onChange={(e) => (setPlay(false), setN(Number(e.target.value)))} aria-label="Frame" />
        <span>
          {n}/{clip.frames}
        </span>
        <a className="secondary camera-player__save" href={`/api/cameras/clips/${clip.id}/frames/${n}.jpg?${q}`} download={`${name}-${clip.started_at.slice(0, 19)}-${n}.jpg`}>
          ⬇️
        </a>
        <button type="button" className="secondary" onClick={onHide}>
          Take off list
        </button>
      </div>
    </div>
  );
}
