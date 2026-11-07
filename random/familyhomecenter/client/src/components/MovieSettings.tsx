import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

interface Folder {
  location: string;
  local: string;
  via: string | null;
  problem: string | null;
}
interface Copies {
  on: boolean;
  running: string | null;
  percent: number | null;
  waiting: number;
  made: number;
  failed: Array<{ file: string; error: string }>;
}
interface Info {
  mp4_copies: Copies;
  library: Folder;
  videos: Folder;
  ffmpeg: boolean;
  server_user: string;
}

/**
 * Settings → 🎬 Movies: the folder the 🎬 Movies section lists, and where videos from the
 * 📥 Inbox / 📤 Add photos are filed (by year). Shows whether the Family Home Center can read each
 * one — and if not, why (not mounted, not allowed for the server's user, NAS not answering…).
 */
export function MovieSettings() {
  const [info, setInfo] = useState<Info | null>(null);
  const [lib, setLib] = useState('');
  const [vids, setVids] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get<Info>('/movie-library/settings')
      .then((i) => {
        setInfo(i);
        setLib(i.library.location);
        setVids(i.videos.location);
      })
      .catch((e) => setError((e as Error).message));
  useEffect(() => {
    void load();
  }, []);

  const save = async (body: Record<string, string | boolean>) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api.patch('/movie-library/settings', body);
      setMsg('Saved ✓');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const status = (f: Folder) =>
    f.problem ? (
      <div className="settings-login__error">⚠️ {f.problem}</div>
    ) : (
      <p className="hint">
        ✅ Readable{f.local !== f.location ? <> — on the Pi that's <code>{f.local}</code></> : ''}
        {f.via ? <> (share {f.via})</> : ''}
      </p>
    );

  return (
    <section className="panel">
      <h2>🎬 Movies</h2>
      {!info ? (
        error ? <div className="settings-login__error">{error}</div> : <p>Loading…</p>
      ) : (
        <>
          <p className="hint">
            Write a folder on the Pi (<code>/mnt/movies</code>) or the location on the share (<code>/share/media/movies</code>,{' '}
            <code>//nas/media/movies</code>) — a share location is found through the share mounted on the Pi. Nothing in these folders is ever changed or
            deleted. The Family Home Center reads them as the user <code>{info.server_user || 'pi'}</code>. See docs/MOVIES_LIBRARY.md.
          </p>

          <h3>🎬 Movies section</h3>
          <p className="hint">
            Every video in this folder and its folders is listed on <Link to="/movies">🎬 Movies</Link>.
          </p>
          <label className="camera-storage__inline">
            Movies folder
            <input value={lib} onChange={(e) => setLib(e.target.value)} style={{ flex: 1, minWidth: '16em' }} aria-label="Movies folder" />
            {lib !== info.library.location && (
              <button type="button" className="secondary" disabled={busy} onClick={() => void save({ dir: lib })}>
                Save
              </button>
            )}
          </label>
          {status(info.library)}

          <h3>🎞️ .mp4 copies of .mpg videos</h3>
          <label className="privacy-toggle">
            <input type="checkbox" checked={info.mp4_copies.on} disabled={busy} onChange={(e) => void save({ mp4_copies: e.target.checked })} />
            <span>
              <strong>Make an .mp4 copy of each .mpg</strong>
              <span className="hint">
                {' '}
                — so old camcorder / DVD videos play in the browser. The copy goes next to the original (<code>Name.mpg</code> → <code>Name.mp4</code>), which
                is kept exactly as it is and can still be downloaded. A file that's already called <code>Name.mp4</code> is never replaced. One at a time, in
                the background (slow on a Pi — about as long as the video).
              </span>
            </span>
          </label>
          {info.mp4_copies.on && (
            <p className="hint">
              {info.mp4_copies.running ? (
                <>
                  ⏳ Copying <code>{info.mp4_copies.running}</code>
                  {info.mp4_copies.percent != null ? ` — ${info.mp4_copies.percent}%` : ''}
                  {info.mp4_copies.waiting > 1 ? ` · ${info.mp4_copies.waiting - 1} more waiting` : ''}
                </>
              ) : (
                'Nothing waiting to be copied.'
              )}
              {info.mp4_copies.made ? ` · ${info.mp4_copies.made} made since the server started` : ''}
            </p>
          )}
          {info.mp4_copies.failed.length > 0 && (
            <details>
              <summary className="settings-login__error">⚠️ {info.mp4_copies.failed.length} couldn't be copied</summary>
              <ul>
                {info.mp4_copies.failed.map((f) => (
                  <li key={f.file}>
                    <code>{f.file}</code> — {f.error}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <h3>📥 Home videos from the Inbox</h3>
          <p className="hint">
            Videos from the 📥 Inbox and 📤 Add photos go here, in a folder for the year they were recorded (<code>2025</code>). Every video is moved as it is
            (the same file, so date, location and camera details all stay). A <code>.mov</code> plays in the browser as it is, and 🎬 Movies can also
            download it as an <code>.mp4</code>. Put it inside the movies folder above so they show up in 🎬 Movies too.
          </p>
          <label className="camera-storage__inline">
            Home videos folder
            <input value={vids} onChange={(e) => setVids(e.target.value)} style={{ flex: 1, minWidth: '16em' }} aria-label="Home videos folder" />
            {vids !== info.videos.location && (
              <button type="button" className="secondary" disabled={busy} onClick={() => void save({ video_dir: vids })}>
                Save
              </button>
            )}
          </label>
          {status(info.videos)}
          {!info.ffmpeg && (
            <div className="settings-login__error">
              Videos wait in the Inbox until ffmpeg is installed on the Family Home Center: <code>sudo apt install -y ffmpeg</code>
            </div>
          )}

          <div className="task-form__row">
            <button type="button" className="secondary" disabled={busy} onClick={() => void load()}>
              🔄 Check again
            </button>
            {msg && <span className="hint">{msg}</span>}
          </div>
          {error && <div className="settings-login__error">{error}</div>}
        </>
      )}
    </section>
  );
}
