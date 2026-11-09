import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { startPlay } from './plays.js';
import { BrickTumbleRun, SKINS, skinOf, type BrickResult } from './BrickTumbleRun.js';

interface Save {
  skin: string;
  startLevel: number;
}
interface PlayInfo {
  owned: boolean;
  plays_left: number | null;
  save: Partial<Save> | null;
  best: number | null;
  top: Array<{ member_id: string; score: number }>;
}

const GAME = 'brick-tumble';

/** 🧱 Brick Tumble: pick a look and a starting speed, then play. */
export function BrickTumblePage() {
  const { members, activeProfile: me } = useFamilyMembers();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [save, setSave] = useState<Save>({ skin: 'bright', startLevel: 1 });
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | null>(null); // the game's seed while playing
  const [last, setLast] = useState<{ r: BrickResult; newBest: boolean; newLooks: string[] } | null>(null);

  useEffect(() => {
    if (!me) return;
    api
      .get<PlayInfo>(`/games/${GAME}/play/${me.id}`)
      .then((i) => {
        setInfo(i);
        setSave({ skin: i.save?.skin ?? 'bright', startLevel: i.save?.startLevel ?? 1 });
      })
      .catch((e) => setError((e as Error).message));
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const best = info?.best ?? 0;
  const skin = skinOf(save.skin);
  const usable = (id: string) => skinOf(id).needs <= best;

  const store = async (next: Save, result?: BrickResult) => {
    setSave(next);
    if (!me) return;
    try {
      const r = await api.post<{ best: number | null }>(`/games/${GAME}/play/${me.id}/result`, {
        score: result?.score ?? 0,
        detail: result ? { rows: result.rows, level: result.level, big: result.bigClears, why: result.why, start: next.startLevel } : undefined,
        save: next,
        acting_member_id: me.id,
      });
      setInfo((i) => (i ? { ...i, best: r.best } : i));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!me) {
    return (
      <div className="panel">
        <h1>🧱 Brick Tumble</h1>
        <p>Pick who's playing (your name, up top) first.</p>
      </div>
    );
  }
  if (error && !info) {
    return (
      <div className="panel">
        <h1>🧱 Brick Tumble</h1>
        <div className="settings-login__error">{error}</div>
        <Link to="/games">← Games</Link>
      </div>
    );
  }
  if (!info) return <p>Loading…</p>;

  if (playing != null) {
    return (
      <BrickTumbleRun
        skin={usable(skin.id) ? skin : SKINS[0]}
        startLevel={save.startLevel}
        best={best || null}
        seed={playing}
        onEnd={(r) => {
          setPlaying(null);
          const newBest = r.score > best;
          setLast({ r, newBest, newLooks: SKINS.filter((s) => s.needs > best && s.needs <= r.score).map((s) => `${s.emoji} ${s.name}`) });
          void store(save, r);
          // Reload the family list so a new best shows.
          api.get<PlayInfo>(`/games/${GAME}/play/${me.id}`).then((i) => setInfo(i)).catch(() => {});
        }}
      />
    );
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const nextSkin = SKINS.find((s) => s.needs > best);

  return (
    <div className="hill-garage">
      <div className="hill-garage__head">
        <h1>🧱 Brick Tumble</h1>
        <Link to="/games">← Games</Link>
      </div>

      {last && (
        <section className="panel hill-garage__result">
          <h2>{last.newBest && last.r.score > 0 ? '🏆 New best!' : last.r.why === 'quit' ? '✕ Stopped.' : '🧱 Topped out!'}</h2>
          <p>
            <strong>{last.r.score}</strong> points · {last.r.rows} rows · level {last.r.level}
            {last.r.bigClears ? ` · ${last.r.bigClears} × four rows at once!` : ''}
          </p>
          {last.newLooks.length > 0 && <p>🎨 New look unlocked: {last.newLooks.join(', ')} — pick it below!</p>}
        </section>
      )}

      <section className="panel hill-garage__driver">
        <MemberAvatar member={me} size={72} />
        <div>
          <div className="hill-garage__name">{me.name}</div>
          <div className="hint">Best {best} points</div>
        </div>
        <div className="hill-garage__go-wrap">
          <button
            type="button"
            className="hill-garage__go"
            disabled={!info.owned && !info.plays_left}
            onClick={async () => {
              setError(null);
              try {
                const left = await startPlay(GAME, me.id); // 🎟️ uses a play, if it's plays a parent gave
                setInfo((i) => (i ? { ...i, plays_left: left } : i));
                setLast(null);
                setPlaying(Math.floor(Math.random() * 1e9));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            ▶ Play!
          </button>
          {!info.owned && (
            <div className="hint">
              {info.plays_left ? `🎟️ ${info.plays_left} play${info.plays_left === 1 ? '' : 's'} left` : '🎟️ No plays left — unlock it in 🎮 Games, or ask a parent for more'}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>🐢 Starting speed</h2>
        <div className="brick-levels" role="radiogroup" aria-label="Starting level">
          {[1, 3, 5, 7, 10].map((l) => (
            <button key={l} type="button" role="radio" aria-checked={save.startLevel === l} className={`hill-garage__ride${save.startLevel === l ? ' is-on' : ''}`} onClick={() => void store({ ...save, startLevel: l })}>
              <span>{l === 1 ? '🐢' : l === 3 ? '🐇' : l === 5 ? '🐎' : l === 7 ? '🐆' : '🚀'}</span>
              Level {l}
            </button>
          ))}
        </div>
        <p className="hint">It gets faster every 10 rows. Starting higher scores more points per row from the start.</p>
      </section>

      <section className="panel">
        <h2>🎨 Brick look</h2>
        <div className="hill-garage__worlds">
          {SKINS.map((s) => {
            const have = s.needs <= best;
            const on = skin.id === s.id && have;
            return (
              <div key={s.id} className={`hill-garage__world${on ? ' is-on' : ''}${have ? '' : ' is-locked'}`}>
                <div className="brick-skin" style={{ background: `linear-gradient(${s.bg[0]}, ${s.bg[1]})` }}>
                  {s.colors.slice(0, 4).map((c, i) => (
                    <span key={i} style={{ background: c }}>
                      {s.marks?.[i] ?? ''}
                    </span>
                  ))}
                </div>
                <strong>
                  {s.emoji} {s.name}
                </strong>
                {on ? (
                  <span className="hill-garage__world-on">✓ Using this</span>
                ) : have ? (
                  <button type="button" className="secondary" onClick={() => void store({ ...save, skin: s.id })}>
                    Use this
                  </button>
                ) : (
                  <span className="hint">🔒 Score {s.needs.toLocaleString()} to unlock</span>
                )}
              </div>
            );
          })}
        </div>
        {nextSkin && <p className="hint">Next look at {nextSkin.needs.toLocaleString()} points — {(nextSkin.needs - best).toLocaleString()} to go.</p>}
      </section>

      {info.top.length > 0 && (
        <section className="panel">
          <h2>🏆 Family best</h2>
          <ol className="hill-garage__top">
            {info.top.map((t) => {
              const m = byId.get(t.member_id);
              return (
                <li key={t.member_id}>
                  <MemberAvatar member={m ?? null} size={28} /> {m?.name ?? '—'} <strong>{t.score}</strong>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="panel">
        <h2>How to play</h2>
        <ul className="hint">
          <li>Bricks fall into the well. Fill a whole row from side to side and it disappears. If the pile reaches the top, the game's over.</li>
          <li>
            <strong>Keys:</strong> ← → (or A D) move · ↑ / W / X turn · Z / Q turn the other way · ↓ / S faster · Space drops it · C / Shift puts it on hold for later · P / Esc pauses.
          </li>
          <li>
            <strong>Mouse or finger on the well:</strong> tap to turn (tap the left edge to turn the other way), drag sideways to move, drag down to speed it up, flick down to drop it.
            Right-click = hold. Or use the buttons under the game.
          </li>
          <li>Points: 1 row 100, 2 rows 300, 3 rows 500, all 4 at once 800 — times the level. Clearing rows with brick after brick adds a bonus. Dropping adds a little too.</li>
          <li>The faint outline shows where the brick will land.</li>
        </ul>
      </section>
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}
