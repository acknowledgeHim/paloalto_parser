import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { LimitNote, useActivityClock, useLimit } from '../utils/limits.js';
import { startPlay } from './plays.js';
import { PrizePanel, spendPrize, type Prizes } from './prizes.js';
import { MazeRun, type MazeResult } from './MazeRun.js';
import type { MazeWord, Mode } from './mazeLogic.js';

const GAME = 'letter-maze';

interface Save {
  /** 🏁 the maze they've got to — the next game can carry on from here */
  level: number;
  /** the grade of words they picked (kids: their grade or lower) */
  grade?: number | null;
  /** letters mode: show the word (off: hear it and spell it) */
  show_word?: boolean;
  powers?: string[];
}
interface PlayInfo {
  owned: boolean;
  plays_left: number | null;
  save: Partial<Save> | null;
  best: number | null;
  top: Array<{ member_id: string; score: number }>;
  prizes?: Prizes;
}
interface WordSet {
  grade: number;
  grade_name: string;
  own_grade: number | null;
  mode: Mode;
  words: MazeWord[];
}
const GRADES = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

/** 🐝 Letter Maze: pick where to start, then munch and spell. */
export function LetterMazePage() {
  const { members, activeProfile: me } = useFamilyMembers();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [save, setSave] = useState<Save>({ level: 1, grade: null, show_word: true, powers: [] });
  const [set, setSet] = useState<WordSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ level: number; shield: boolean } | null>(null);
  const [last, setLast] = useState<{ r: MazeResult; newBest: boolean } | null>(null);
  const limit = useLimit(me?.id, `game:${GAME}`);
  useActivityClock(me?.id, `game:${GAME}`, playing !== null, limit.setStatus);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!me) return;
    api
      .get<PlayInfo>(`/games/${GAME}/play/${me.id}`)
      .then((i) => {
        setInfo(i);
        setSave({ level: i.save?.level ?? 1, grade: i.save?.grade ?? null, show_word: i.save?.show_word ?? true, powers: i.save?.powers ?? [] });
      })
      .catch((e) => setError((e as Error).message));
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWords = (grade: number | null | undefined) => {
    if (!me) return;
    api
      .get<WordSet>(`/games/${GAME}/words/${me.id}${grade != null ? `?grade=${grade}` : ''}`)
      .then(setSet)
      .catch((e) => setError((e as Error).message));
  };
  useEffect(() => {
    if (info) loadWords(save.grade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info !== null, save.grade]);

  const store = async (next: Save, result?: MazeResult) => {
    setSave(next);
    saveRef.current = next;
    if (!me) return;
    try {
      const r = await api.post<{ best: number | null }>(`/games/${GAME}/play/${me.id}/result`, {
        score: result?.score ?? 0,
        detail: result ? { level: result.level, words: result.words, why: result.why, grade: set?.grade } : undefined,
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
        <h1>🐝 Letter Maze</h1>
        <p>Pick who's playing (your name, up top) first.</p>
      </div>
    );
  }
  if (error && !info) {
    return (
      <div className="panel">
        <h1>🐝 Letter Maze</h1>
        <div className="settings-login__error">{error}</div>
        <Link to="/games">← Games</Link>
      </div>
    );
  }
  if (!info || !set) return <p>Loading…</p>;

  if (playing) {
    return (
      <MazeRun
        mode={set.mode}
        words={set.words}
        startLevel={playing.level}
        shield={playing.shield}
        player={{ id: me.id, color: me.color, avatar: me.avatar ?? null }}
        showWord={save.show_word ?? true}
        best={info.best}
        // 🏁 a maze done: kept straight away, so leaving (or the hearts running out) doesn't lose it
        onLevel={(level) => void store({ ...saveRef.current, level: Math.max(saveRef.current.level, level) })}
        onEnd={(r) => {
          setPlaying(null);
          void limit.reload();
          setLast({ r, newBest: r.score > (info.best ?? 0) });
          void store({ ...saveRef.current, level: Math.max(saveRef.current.level, r.level) }, r);
          loadWords(saveRef.current.grade); // fresh words next time
        }}
      />
    );
  }

  const canPlay = (info.owned || !!info.plays_left) && !limit.status?.over;
  const isParent = me.is_parent === 1;
  const maxGrade = isParent || set.own_grade === null ? 12 : set.own_grade;
  const start = async (level: number) => {
    setError(null);
    try {
      const left = await startPlay(GAME, me.id);
      setInfo((i) => (i ? { ...i, plays_left: left } : i));
      let shield = false;
      if ((save.powers ?? []).includes('shield') && info.prizes?.shield?.ready) {
        try {
          const prizes = await spendPrize(GAME, me.id, 'shield');
          setInfo((i) => (i ? { ...i, prizes } : i));
          shield = true;
        } catch {
          /* used up: play without it */
        }
      }
      setLast(null);
      setPlaying({ level, shield });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const byId = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="hill-garage">
      <div className="hill-garage__head">
        <h1>🐝 Letter Maze</h1>
        <Link to="/games">← Games</Link>
      </div>

      {last && (
        <section className="panel hill-garage__result">
          <h2>{last.newBest && last.r.score > 0 ? '🏆 New best!' : last.r.why === 'quit' ? '✕ Stopped.' : '🐝 Out of hearts!'}</h2>
          <p>
            <strong>{last.r.score}</strong> points · {last.r.words} word{last.r.words === 1 ? '' : 's'} spelled · reached maze {last.r.level}
          </p>
        </section>
      )}

      <section className="panel hill-garage__driver">
        <MemberAvatar member={me} size={72} />
        <div>
          <div className="hill-garage__name">{me.name}</div>
          <div className="hint">
            Best {info.best ?? 0} points · 🏁 got to maze {save.level} · 📚 {set.grade_name} words ({set.mode === 'letters' ? 'eat the letters' : 'eat the right spelling'})
          </div>
        </div>
        <div className="hill-garage__go-wrap">
          {save.level > 1 && (
            <button type="button" className="hill-garage__go" disabled={!canPlay} onClick={() => void start(save.level)}>
              ▶ Keep going: maze {save.level}
            </button>
          )}
          <button type="button" className={save.level > 1 ? 'secondary' : 'hill-garage__go'} disabled={!canPlay} onClick={() => void start(1)}>
            {save.level > 1 ? '↺ Start at maze 1' : '▶ Play!'}
          </button>
          <LimitNote status={limit.status} />
          {!info.owned && (
            <div className="hint">
              {info.plays_left ? `🎟️ ${info.plays_left} play${info.plays_left === 1 ? '' : 's'} left` : '🎟️ No plays left — unlock it in 🎮 Games, or ask a parent for more'}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>📚 Words</h2>
        <div className="brick-levels" role="radiogroup" aria-label="Grade of words">
          {GRADES.slice(0, maxGrade + 1).map((label, g) => (
            <button key={g} type="button" role="radio" aria-checked={set.grade === g} className={`hill-garage__ride${set.grade === g ? ' is-on' : ''}`} onClick={() => void store({ ...save, grade: g })}>
              <span>{g <= 5 ? '🔤' : '📖'}</span>
              {label}
            </button>
          ))}
        </div>
        <p className="hint">
          The same spelling words as <Link to="/learning">📚 Learning</Link>.{' '}
          {isParent ? 'Parents can pick any grade.' : set.own_grade === null ? 'A parent can set your grade in 📚 Learning.' : 'Your grade, or an easier one to warm up.'} K–5th: every dot is a
          letter. 6th–12th: the dots are words — some spelled wrong!
        </p>
        {set.mode === 'letters' && (
          <label className="privacy-toggle">
            <input type="checkbox" checked={save.show_word ?? true} onChange={(e) => void store({ ...save, show_word: e.target.checked })} />
            <span>
              👀 Show the word while you spell it <span className="hint">(off: listen with 🔊 and spell it from memory — there’s a peek button)</span>
            </span>
          </label>
        )}
      </section>

      <PrizePanel
        prizes={info.prizes}
        on={save.powers ?? []}
        toggle={(id, v) => void store({ ...save, powers: v ? [...new Set([...(save.powers ?? []), id])] : (save.powers ?? []).filter((x) => x !== id) })}
        hint="Tick it to bring it on your next game — each game with it on uses one."
      />

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
          <li>Move with the arrow keys (or W A S D), swipe on the maze, or use the ▲ ◀ ▼ ▶ buttons.</li>
          <li>🔤 Letters: listen (🔊) and eat the letters of the word in order. Wrong letters just stay where they are.</li>
          <li>📖 Words: read the clue and eat the word that’s spelled right. A wrong one says why and costs 20 points.</li>
          <li>🐝 Bees chase you — a bump costs a ❤️. Eat a 🍯 honey pot and the bees get sleepy: catch them for 200 points!</li>
          <li>Spell 5 words to finish a maze. Each maze is a bit faster, with more bees. Your maze is saved — carry on from it next time.</li>
        </ul>
      </section>
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}
