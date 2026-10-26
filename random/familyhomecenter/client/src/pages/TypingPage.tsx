import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { api, type FamilyMember } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import {
  FINGER_COLORS,
  FINGER_NAMES,
  KEY_ROWS,
  LEVELS,
  PASS_ACCURACY,
  SENTENCES,
  fingerFor,
  gameWords,
  lessonText,
  needsShift,
  wpmOf,
  type Level,
} from '../utils/typing.js';

/**
 * ⌨️ Typing — learn to type from the home row up (📘 Lessons), then play 🎈 Balloon Pop and 🏁 Race.
 * Progress is saved per person, and a parent picks the ⭐ each lesson and game is worth (server:
 * routes/typing.ts). Works with a real keyboard, or a tablet's on-screen one.
 */

interface Progress {
  levels: Array<{ level: number; best_wpm: number; best_accuracy: number; passed: number; tries: number }>;
  best_wpm: number;
  balloon_best: number;
  race_best_wpm: number;
  stars_today: number;
  paid_games_today: number;
  recent: Array<{ at: string; mode: string; level: number; wpm: number; accuracy: number; score: number; passed: number; stars: number }>;
}

interface Rewards {
  levels: number[];
  balloon_best: number;
  race_best: number;
  games_per_day: number;
}

interface RoundResult {
  mode: 'lesson' | 'balloon' | 'race';
  level: number;
  wpm: number;
  accuracy: number;
  chars: number;
  seconds: number;
  score: number;
  passed: boolean;
}

type Tab = 'lessons' | 'balloon' | 'race' | 'stars';

export function TypingPage() {
  const { members, activeProfile } = useFamilyMembers();
  const canManage = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [tab, setTab] = useState<Tab>('lessons');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [playing, setPlaying] = useState<Level | null>(null);

  const loadProgress = useCallback(() => {
    if (!activeProfile) return setProgress(null);
    api.get<Progress>(`/typing/${activeProfile.id}`).then(setProgress).catch(() => setProgress(null));
  }, [activeProfile]);
  useEffect(loadProgress, [loadProgress]);
  useEffect(() => {
    api.get<Rewards>('/typing/settings/rewards').then(setRewards).catch(() => {});
  }, []);

  const passed = new Set(progress?.levels.filter((l) => l.passed).map((l) => l.level) ?? []);
  const highestPassed = Math.max(0, ...passed);

  /** Saves a finished round; answers with what it earned (or null when nobody's picked). */
  const save = async (r: RoundResult): Promise<{ stars: number; reason: string | null } | null> => {
    if (!activeProfile) return null;
    try {
      const res = await api.post<{ stars: number; reason: string | null }>(`/typing/${activeProfile.id}/results`, {
        ...r,
        acting_member_id: activeProfile.id,
      });
      loadProgress();
      return res;
    } catch {
      return null;
    }
  };

  return (
    <div className="typing-page">
      <div className="typing-page__head">
        <h1>⌨️ Typing</h1>
        {activeProfile ? (
          <span className="typing-page__who">
            <MemberAvatar member={activeProfile} size={28} /> {activeProfile.name}
            {progress && (
              <span className="hint">
                {' '}
                · {passed.size}/{LEVELS.length} lessons · best {Math.round(progress.best_wpm)} wpm
              </span>
            )}
          </span>
        ) : (
          <span className="hint">Pick who you are up top to save your progress and earn ⭐.</span>
        )}
      </div>

      {!playing && (
        <div className="typing-page__tabs" role="tablist">
          {(
            [
              ['lessons', '📘 Lessons'],
              ['balloon', '🎈 Balloon Pop'],
              ['race', '🏁 Race'],
              ...(canManage ? [['stars', '⭐ Stars']] : []),
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? '' : 'secondary'} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {playing ? (
        <LessonRound
          level={playing}
          stars={rewards?.levels[playing.n - 1] ?? 0}
          alreadyPassed={passed.has(playing.n)}
          onSave={save}
          onExit={() => setPlaying(null)}
          onNext={() => setPlaying(LEVELS[playing.n] ?? null)}
        />
      ) : tab === 'lessons' ? (
        <LessonList progress={progress} rewards={rewards} passed={passed} onPlay={setPlaying} />
      ) : tab === 'balloon' ? (
        <BalloonPop words={gameWords(highestPassed)} best={progress?.balloon_best ?? 0} stars={rewards?.balloon_best ?? 0} onSave={save} />
      ) : tab === 'race' ? (
        <Race
          highestPassed={highestPassed}
          best={progress?.race_best_wpm ?? 0}
          stars={rewards?.race_best ?? 0}
          player={activeProfile}
          family={members.filter((m) => m.id !== activeProfile?.id)}
          onSave={save}
        />
      ) : (
        rewards && <StarSettings rewards={rewards} onSaved={setRewards} />
      )}

      {!playing && progress && progress.recent.length > 0 && tab !== 'stars' && (
        <section className="panel typing-page__recent">
          <h2>Lately</h2>
          <ul>
            {progress.recent.slice(0, 8).map((r) => (
              <li key={r.at}>
                <span>
                  {r.mode === 'lesson' ? `📘 Lesson ${r.level}` : r.mode === 'balloon' ? '🎈 Balloon Pop' : '🏁 Race'}
                  {r.passed && r.mode === 'lesson' ? ' ✓' : ''}
                  {r.passed && r.mode === 'race' ? ' 🏆' : ''}
                </span>
                <span className="hint">
                  {r.mode === 'balloon' ? `${r.score} points · ` : ''}
                  {Math.round(r.wpm)} wpm · {Math.round(r.accuracy)}%{r.stars ? ` · +${r.stars} ⭐` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---- Typing input: a real keyboard, or a tablet's on-screen one ----

/** An invisible box that keeps focus and turns key presses into onChar / onBack. Tap the play area
 *  to bring the on-screen keyboard up on a tablet. */
function useTypeCatcher(onChar: (c: string) => void, onBack?: () => void, active = true) {
  const ref = useRef<HTMLInputElement>(null);
  const focus = () => ref.current?.focus({ preventScroll: true });
  useEffect(() => {
    if (active) focus();
  }, [active]);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      onBack?.();
    } else if (e.key.length === 1) {
      e.preventDefault();
      onChar(e.key);
    }
    // Anything else ('Unidentified' from a tablet keyboard) arrives through onInput.
  };
  const onInput = (e: React.FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data;
    if (data) for (const c of data) onChar(c);
    e.currentTarget.value = '';
  };
  const input = (
    <input
      ref={ref}
      className="typing-catcher"
      aria-label="Type here"
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      onKeyDown={onKeyDown}
      onInput={onInput}
    />
  );
  return { input, focus };
}

// ---- 📘 Lessons ----

function LessonList({
  progress,
  rewards,
  passed,
  onPlay,
}: {
  progress: Progress | null;
  rewards: Rewards | null;
  passed: Set<number>;
  onPlay: (l: Level) => void;
}) {
  const byLevel = new Map(progress?.levels.map((l) => [l.level, l]) ?? []);
  // Lessons open one at a time: the next one after the last passed (all of them, with nobody picked).
  const nextOpen = progress ? Math.max(0, ...passed) + 1 : LEVELS.length;
  return (
    <div className="typing-lessons">
      <p className="hint">
        Pass a lesson with {PASS_ACCURACY}% right and its speed goal to open the next. Fingers rest on the home row:
        left on <kbd>A S D F</kbd>, right on <kbd>J K L ;</kbd> — feel the bumps on F and J.
      </p>
      <div className="typing-lessons__grid">
        {LEVELS.map((l) => {
          const p = byLevel.get(l.n);
          const done = passed.has(l.n);
          const locked = l.n > nextOpen;
          const stars = rewards?.levels[l.n - 1] ?? 0;
          return (
            <button
              key={l.n}
              type="button"
              className={`typing-lesson ${done ? 'typing-lesson--done' : ''} ${locked ? 'typing-lesson--locked' : ''}`}
              disabled={locked}
              onClick={() => onPlay(l)}
            >
              <span className="typing-lesson__n">{locked ? '🔒' : done ? '✓' : l.n}</span>
              <span className="typing-lesson__name">{l.name}</span>
              <span className="typing-lesson__keys">{l.newKeys ? l.newKeys.split('').join(' ').toUpperCase() : ' '}</span>
              <span className="hint">
                {p ? `best ${Math.round(p.best_wpm)} wpm · ${Math.round(p.best_accuracy)}%` : `goal ${l.goalWpm} wpm`}
                {!done && stars > 0 ? ` · +${stars} ⭐` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LessonRound({
  level,
  stars,
  alreadyPassed,
  onSave,
  onExit,
  onNext,
}: {
  level: Level;
  stars: number;
  alreadyPassed: boolean;
  onSave: (r: RoundResult) => Promise<{ stars: number; reason: string | null } | null>;
  onExit: () => void;
  onNext: () => void;
}) {
  const [text, setText] = useState(() => lessonText(level));
  const [pos, setPos] = useState(0);
  const [wrongAt, setWrongAt] = useState<number | null>(null);
  const [keystrokes, setKeystrokes] = useState({ right: 0, wrong: 0 });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<(RoundResult & { earned: { stars: number; reason: string | null } | null }) | null>(null);
  // Whether it was passed before this round started (the list refreshes as soon as it's saved).
  const passedBefore = useRef(alreadyPassed);

  // Read and written straight away, so two quick keys before the screen catches up both count.
  const live = useRef({ pos: 0, right: 0, wrong: 0, startedAt: 0, done: false });
  const restart = () => {
    live.current = { pos: 0, right: 0, wrong: 0, startedAt: 0, done: false };
    passedBefore.current = alreadyPassed;
    setText(lessonText(level));
    setPos(0);
    setWrongAt(null);
    setKeystrokes({ right: 0, wrong: 0 });
    setStartedAt(null);
    setResult(null);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(restart, [level]);
  useEffect(() => {
    if (!startedAt || result) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [startedAt, result]);

  const onChar = (c: string) => {
    const L = live.current;
    if (L.done) return;
    if (!L.startedAt) {
      L.startedAt = Date.now();
      setStartedAt(L.startedAt);
    }
    if (c === text[L.pos]) {
      L.right++;
      L.pos++;
      setKeystrokes({ right: L.right, wrong: L.wrong });
      setWrongAt(null);
      setPos(L.pos);
      if (L.pos >= text.length) {
        L.done = true;
        const ms = Date.now() - L.startedAt;
        const accuracy = Math.round((L.right / Math.max(1, L.right + L.wrong)) * 1000) / 10;
        const wpm = wpmOf(text.length, ms);
        const r: RoundResult = {
          mode: 'lesson',
          level: level.n,
          wpm,
          accuracy,
          chars: text.length,
          seconds: Math.round(ms / 1000),
          score: 0,
          passed: accuracy >= PASS_ACCURACY && wpm >= level.goalWpm,
        };
        setResult({ ...r, earned: null });
        onSave(r).then((earned) => setResult((cur) => (cur ? { ...cur, earned } : cur)));
      }
    } else {
      L.wrong++;
      setKeystrokes({ right: L.right, wrong: L.wrong });
      setWrongAt(L.pos);
    }
  };
  const { input, focus } = useTypeCatcher(onChar, undefined, !result);

  const elapsed = startedAt ? (result ? result.seconds * 1000 : now - startedAt) : 0;
  const liveWpm = wpmOf(pos, elapsed);
  const liveAcc = keystrokes.right + keystrokes.wrong ? Math.round((keystrokes.right / (keystrokes.right + keystrokes.wrong)) * 100) : 100;
  const nextChar = text[pos] ?? '';

  return (
    <section className="panel typing-round" onClick={focus}>
      <div className="typing-round__top">
        <button type="button" className="link-button" onClick={onExit}>
          ‹ All lessons
        </button>
        <strong>
          Lesson {level.n}: {level.name}
        </strong>
        <span className="hint">
          {Math.round(liveWpm)} wpm · {liveAcc}% · goal {level.goalWpm} wpm, {PASS_ACCURACY}%
        </span>
      </div>

      {!result ? (
        <>
          <div className="typing-text" aria-live="off">
            {[...text].map((c, i) => (
              <span
                key={i}
                className={i < pos ? 'typing-text__done' : i === pos ? `typing-text__cur ${wrongAt === i ? 'typing-text__cur--wrong' : ''}` : ''}
              >
                {c === ' ' ? ' ' : c}
              </span>
            ))}
          </div>
          <p className="typing-round__hint">
            {!startedAt ? 'Start typing when you’re ready — ' : ''}
            {nextChar === ' ' ? 'Space: either thumb' : `${nextChar}: ${FINGER_NAMES[fingerFor(nextChar)]}`}
            {needsShift(nextChar) ? ` + Shift with the other hand's little finger` : ''}
          </p>
          <Keyboard next={nextChar} wrong={wrongAt !== null} />
        </>
      ) : (
        <div className="typing-result">
          <div className="typing-result__big">{result.passed ? '🎉' : '💪'}</div>
          <h2>{result.passed ? (passedBefore.current ? 'Passed again!' : 'Lesson passed!') : 'So close — try again!'}</h2>
          <p>
            <strong>{Math.round(result.wpm)}</strong> words a minute · <strong>{Math.round(result.accuracy)}%</strong> right
          </p>
          {!result.passed && (
            <p className="hint">
              {result.accuracy < PASS_ACCURACY ? `Aim for ${PASS_ACCURACY}% right — slow down a little, accuracy first. ` : ''}
              {result.wpm < level.goalWpm ? `Speed goal: ${level.goalWpm} wpm.` : ''}
            </p>
          )}
          {result.earned && result.earned.stars > 0 && <p className="typing-result__stars">+{result.earned.stars} ⭐ {result.earned.reason}</p>}
          {result.passed && !passedBefore.current && stars === 0 && <p className="hint">Next lesson unlocked!</p>}
          <div className="typing-result__actions">
            <button type="button" onClick={restart}>
              ↻ Again
            </button>
            {result.passed && LEVELS[level.n] && (
              <button type="button" onClick={onNext}>
                Next lesson ›
              </button>
            )}
            <button type="button" className="secondary" onClick={onExit}>
              All lessons
            </button>
          </div>
        </div>
      )}
      {input}
    </section>
  );
}

function Keyboard({ next, wrong }: { next: string; wrong: boolean }) {
  const target = next.toLowerCase();
  const shiftedMap: Record<string, string> = { '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', ':': ';', '<': ',', '>': '.', '?': '/' };
  const key = shiftedMap[next] ?? target;
  const shift = needsShift(next);
  const leftHand = fingerFor(next) < 4;
  return (
    <div className={`typing-kb ${wrong ? 'typing-kb--wrong' : ''}`} aria-hidden>
      {KEY_ROWS.map((row, r) => (
        <div key={r} className={`typing-kb__row typing-kb__row--${r}`}>
          {r === 3 && <span className={`typing-kb__key typing-kb__key--wide ${shift && !leftHand ? 'typing-kb__key--next' : ''}`} style={{ ['--f' as string]: FINGER_COLORS[0] }}>⇧</span>}
          {row.map((k) => (
            <span
              key={k}
              className={`typing-kb__key ${k === key ? 'typing-kb__key--next' : ''} ${r === 2 && (k === 'f' || k === 'j') ? 'typing-kb__key--bump' : ''}`}
              style={{ ['--f' as string]: FINGER_COLORS[fingerFor(k)] }}
            >
              {k.toUpperCase()}
            </span>
          ))}
          {r === 3 && <span className={`typing-kb__key typing-kb__key--wide ${shift && leftHand ? 'typing-kb__key--next' : ''}`} style={{ ['--f' as string]: FINGER_COLORS[7] }}>⇧</span>}
        </div>
      ))}
      <div className="typing-kb__row">
        <span className={`typing-kb__key typing-kb__key--space ${next === ' ' ? 'typing-kb__key--next' : ''}`} style={{ ['--f' as string]: FINGER_COLORS[8] }}>
          space
        </span>
      </div>
    </div>
  );
}

// ---- 🎈 Balloon Pop ----

interface Balloon {
  id: number;
  word: string;
  x: number;
  y: number;
  speed: number;
  color: string;
}

const BALLOON_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6'];

function BalloonPop({
  words,
  best,
  stars,
  onSave,
}: {
  words: string[];
  best: number;
  stars: number;
  onSave: (r: RoundResult) => Promise<{ stars: number; reason: string | null } | null>;
}) {
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready');
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const setTypedBoth = (t: string) => {
    typedRef.current = t;
    setTyped(t);
  };
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [miss, setMiss] = useState(false);
  const [earned, setEarned] = useState<{ stars: number; reason: string | null } | null>(null);
  const stats = useRef({ started: 0, right: 0, wrong: 0, chars: 0, nextId: 1, lastSpawn: 0, popped: 0 });
  const live = useRef({ balloons: [] as Balloon[], lives: 3, score: 0 });

  const start = () => {
    stats.current = { started: Date.now(), right: 0, wrong: 0, chars: 0, nextId: 1, lastSpawn: 0, popped: 0 };
    live.current = { balloons: [], lives: 3, score: 0 };
    setBalloons([]);
    setTypedBoth('');
    setScore(0);
    setLives(3);
    setEarned(null);
    setState('playing');
  };

  const finish = useCallback(() => {
    setState('over');
    const s = stats.current;
    const ms = Date.now() - s.started;
    onSave({
      mode: 'balloon',
      level: 0,
      wpm: wpmOf(s.chars, ms),
      accuracy: Math.round((s.right / Math.max(1, s.right + s.wrong)) * 1000) / 10,
      chars: s.chars,
      seconds: Math.round(ms / 1000),
      score: live.current.score,
      passed: false,
    }).then(setEarned);
  }, [onSave]);

  // The game loop: balloons float up; one reaching the top costs a life. Faster as you pop more.
  useEffect(() => {
    if (state !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(100, t - last) / 1000;
      last = t;
      const s = stats.current;
      const level = Math.min(10, Math.floor(s.popped / 5));
      const spawnEvery = Math.max(900, 2600 - level * 180);
      let list = live.current.balloons;
      if (t - s.lastSpawn > spawnEvery && list.length < 6) {
        s.lastSpawn = t;
        const word = words[Math.floor(Math.random() * words.length)];
        list = [
          ...list,
          { id: s.nextId++, word, x: 8 + Math.random() * 76, y: 100, speed: 7 + level * 1.6 + Math.random() * 3, color: BALLOON_COLORS[s.nextId % BALLOON_COLORS.length] },
        ];
      }
      let lost = 0;
      list = list
        .map((b) => ({ ...b, y: b.y - b.speed * dt }))
        .filter((b) => {
          if (b.y < -12) {
            lost++;
            return false;
          }
          return true;
        });
      live.current.balloons = list;
      setBalloons(list);
      if (lost) {
        live.current.lives -= lost;
        setLives(live.current.lives);
        typedRef.current = '';
        setTyped('');
        if (live.current.lives <= 0) {
          finish();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, words, finish]);

  const onChar = (c: string) => {
    if (state !== 'playing') {
      if (c === ' ' || c === 'Enter') start();
      return;
    }
    const s = stats.current;
    const next = (typedRef.current + c).toLowerCase();
    const targets = live.current.balloons.filter((b) => b.word.startsWith(next));
    if (targets.length === 0) {
      s.wrong++;
      setMiss(true);
      setTimeout(() => setMiss(false), 250);
      return;
    }
    s.right++;
    // The highest one that matches (closest to escaping) pops first.
    const hit = targets.sort((a, b) => a.y - b.y)[0];
    if (hit.word === next) {
      s.chars += hit.word.length + 1;
      s.popped++;
      live.current.balloons = live.current.balloons.filter((b) => b.id !== hit.id);
      live.current.score += hit.word.length;
      setBalloons(live.current.balloons);
      setScore(live.current.score);
      setTypedBoth('');
    } else {
      setTypedBoth(next);
    }
  };
  const { input, focus } = useTypeCatcher(onChar, () => setTypedBoth(typedRef.current.slice(0, -1)));

  return (
    <section className="panel balloon" onClick={focus}>
      <div className="balloon__top">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>{'❤️'.repeat(Math.max(0, lives))}</span>
        <span className="hint">
          Best {best}
          {stars > 0 ? ` · beat it for +${stars} ⭐` : ''}
        </span>
      </div>
      <div className={`balloon__sky ${miss ? 'balloon__sky--miss' : ''}`}>
        {balloons.map((b) => {
          const active = typed && b.word.startsWith(typed);
          return (
            <div key={b.id} className="balloon__b" style={{ left: `${b.x}%`, top: `${b.y}%`, ['--c' as string]: b.color }}>
              <span className="balloon__word">
                {active ? (
                  <>
                    <span className="balloon__typed">{typed}</span>
                    {b.word.slice(typed.length)}
                  </>
                ) : (
                  b.word
                )}
              </span>
            </div>
          );
        })}
        {state !== 'playing' && (
          <div className="balloon__overlay">
            {state === 'over' && (
              <>
                <div className="typing-result__big">🎈</div>
                <h2>{score > best && score >= 10 ? 'New best!' : 'Game over'}</h2>
                <p>
                  Score <strong>{score}</strong>
                </p>
                {earned && earned.stars > 0 && <p className="typing-result__stars">+{earned.stars} ⭐ {earned.reason}</p>}
                {earned && !earned.stars && earned.reason && <p className="hint">{earned.reason}</p>}
              </>
            )}
            {state === 'ready' && (
              <>
                <h2>🎈 Balloon Pop</h2>
                <p>Type a balloon's word to pop it before it floats away. Three get away and it's over!</p>
              </>
            )}
            <button type="button" onClick={start}>
              {state === 'ready' ? '▶ Start' : '↻ Play again'}
            </button>
          </div>
        )}
      </div>
      {state === 'playing' && <p className="balloon__typing">{typed || <span className="hint">type a word…</span>}</p>}
      {input}
    </section>
  );
}

// ---- 🏁 Race ----

interface Rival {
  key: string;
  name: string;
  wpm: number;
  icon?: string;
  member?: FamilyMember;
  /** "their best" for family; nothing for the animals. */
  note?: string;
}

const ANIMALS: Rival[] = [
  { key: 'turtle', icon: '🐢', name: 'Turtle', wpm: 8 },
  { key: 'bunny', icon: '🐇', name: 'Bunny', wpm: 15 },
  { key: 'fox', icon: '🦊', name: 'Fox', wpm: 22 },
  { key: 'cheetah', icon: '🐆', name: 'Cheetah', wpm: 32 },
];

/** Who's racing: an animal's emoji, or a family member's avatar. */
function Racer({ rival, size }: { rival: Rival; size: number }) {
  return rival.member ? <MemberAvatar member={rival.member} size={size} /> : <span style={{ fontSize: size * 0.9 }}>{rival.icon}</span>;
}

/** The Easy → Hard scale: words a minute for levels 1–10. */
const SPEED_LEVELS = [5, 8, 11, 15, 19, 23, 28, 34, 41, 50];

function raceText(highestPassed: number): string {
  if (highestPassed >= LEVELS.length - 1) return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
  const words = gameWords(highestPassed);
  const parts: string[] = [];
  while (parts.join(' ').length < 40) parts.push(words[Math.floor(Math.random() * words.length)]);
  return parts.join(' ');
}

function Race({
  highestPassed,
  best,
  stars,
  player,
  family,
  onSave,
}: {
  highestPassed: number;
  best: number;
  stars: number;
  player: FamilyMember | null;
  /** Everyone else — raced at their own best speed once they've typed here. */
  family: FamilyMember[];
  onSave: (r: RoundResult) => Promise<{ stars: number; reason: string | null } | null>;
}) {
  const [bests, setBests] = useState<Record<string, number>>({});
  useEffect(() => {
    api
      .get<Array<{ member_id: string; best_wpm: number }>>('/typing/bests')
      .then((rows) => setBests(Object.fromEntries(rows.map((r) => [r.member_id, r.best_wpm]))))
      .catch(() => {});
  }, []);
  // Family (and yourself) race with their avatars; anyone without a best yet races on the scale.
  const people: Rival[] = [
    ...(player ? [{ key: player.id, name: 'Yourself', wpm: 0, member: player, note: 'your best' }] : []),
    ...family.map((m) => ({ key: m.id, name: m.name, wpm: 0, member: m, note: 'their best' })),
  ];
  const [rival, setRival] = useState<Rival>(ANIMALS[0]);
  /** 'best' = the person's own best speed; a number = a level on the Easy → Hard scale. */
  const [speed, setSpeed] = useState<'best' | number>(2);
  const memberBest = rival.member ? bests[rival.member.id] : undefined;
  const useBest = speed === 'best' && Boolean(memberBest);
  const rivalWpm = useBest ? Math.max(3, Math.round(memberBest!)) : SPEED_LEVELS[(typeof speed === 'number' ? speed : 2) - 1];
  const pickRival = (r: Rival) => {
    setRival(r);
    if (!r.member) setSpeed(SPEED_LEVELS.findIndex((w) => w >= r.wpm) + 1 || SPEED_LEVELS.length);
    else if (bests[r.member.id]) setSpeed('best');
  };
  const [state, setState] = useState<'ready' | 'countdown' | 'racing' | 'done'>('ready');
  const [count, setCount] = useState(3);
  const [text, setText] = useState(() => raceText(highestPassed));
  const [pos, setPos] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<{ won: boolean; wpm: number; accuracy: number } | null>(null);
  const [earned, setEarned] = useState<{ stars: number; reason: string | null } | null>(null);
  const t0 = useRef(0);
  const keys = useRef({ right: 0, wrong: 0 });

  const start = () => {
    setText(raceText(highestPassed));
    setPos(0);
    posRef.current = 0;
    setResult(null);
    setEarned(null);
    keys.current = { right: 0, wrong: 0 };
    setCount(3);
    setState('countdown');
  };
  useEffect(() => {
    if (state !== 'countdown') return;
    if (count === 0) {
      t0.current = Date.now();
      setState('racing');
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [state, count]);
  useEffect(() => {
    if (state !== 'racing') return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [state]);

  const rivalChars = state === 'racing' ? ((rivalWpm * 5) / 60_000) * (now - t0.current) : 0;
  const rivalDone = rivalChars >= text.length;

  const end = (won: boolean, chars: number) => {
    const ms = Date.now() - t0.current;
    const wpm = wpmOf(chars, ms);
    const accuracy = Math.round((keys.current.right / Math.max(1, keys.current.right + keys.current.wrong)) * 1000) / 10;
    setResult({ won, wpm, accuracy });
    setState('done');
    onSave({ mode: 'race', level: rivalWpm, wpm, accuracy, chars, seconds: Math.round(ms / 1000), score: 0, passed: won }).then(setEarned);
  };
  useEffect(() => {
    if (state === 'racing' && rivalDone) end(false, pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, rivalDone]);

  const posRef = useRef(0);
  const onChar = (c: string) => {
    if (state !== 'racing' || posRef.current >= text.length) return;
    if (c === text[posRef.current]) {
      keys.current.right++;
      setWrong(false);
      const next = ++posRef.current;
      setPos(next);
      if (next >= text.length) end(true, next);
    } else {
      keys.current.wrong++;
      setWrong(true);
    }
  };
  const { input, focus } = useTypeCatcher(onChar, undefined, state === 'racing');
  const youPct = (pos / text.length) * 100;
  const rivalPct = Math.min(100, (rivalChars / text.length) * 100);

  return (
    <section className="panel race" onClick={focus}>
      {state === 'ready' || state === 'done' ? (
        <div className="race__pick">
          {result && (
            <div className="typing-result">
              <div className="typing-result__big">{result.won ? '🏆' : <Racer rival={rival} size={64} />}</div>
              <h2>
                {result.won
                  ? rival.name === 'Yourself'
                    ? 'You beat yourself!'
                    : `You beat ${rival.member ? rival.name : `the ${rival.name}`}!`
                  : rival.name === 'Yourself'
                    ? 'Your other self won this time'
                    : `${rival.member ? rival.name : `The ${rival.name}`} won this time`}
              </h2>
              <p>
                <strong>{Math.round(result.wpm)}</strong> words a minute · <strong>{Math.round(result.accuracy)}%</strong> right
              </p>
              {earned && earned.stars > 0 && <p className="typing-result__stars">+{earned.stars} ⭐ {earned.reason}</p>}
              {earned && !earned.stars && earned.reason && <p className="hint">{earned.reason}</p>}
            </div>
          )}
          <h2>{result ? 'Race again?' : '🏁 Pick who to race'}</h2>
          <div className="race__rivals">
            {ANIMALS.map((r) => (
              <button key={r.key} type="button" className={rival.key === r.key ? '' : 'secondary'} onClick={() => pickRival(r)}>
                <Racer rival={r} size={30} /> {r.name}
              </button>
            ))}
          </div>
          {people.length > 0 && (
            <div className="race__rivals">
              {people.map((r) => (
                <button key={r.key} type="button" className={rival.key === r.key ? '' : 'secondary'} onClick={() => pickRival(r)}>
                  <Racer rival={r} size={30} /> {r.name}
                </button>
              ))}
            </div>
          )}
          <div className="race__speed">
            <span className="race__speed-label">How fast?</span>
            {memberBest ? (
              <button type="button" className={useBest ? '' : 'secondary'} onClick={() => setSpeed('best')}>
                {rival.note === 'your best' ? 'Your' : 'Their'} best · {Math.round(memberBest)} wpm
              </button>
            ) : rival.member ? (
              <span className="hint">{rival.name === 'Yourself' ? "You haven't" : `${rival.name} hasn't`} typed here yet — pick a level:</span>
            ) : null}
            <label className="race__scale">
              <span>Easy</span>
              <input
                type="range"
                min={1}
                max={SPEED_LEVELS.length}
                value={typeof speed === 'number' ? speed : SPEED_LEVELS.findIndex((w) => w >= rivalWpm) + 1 || SPEED_LEVELS.length}
                onChange={(e) => setSpeed(Number(e.target.value))}
                aria-label="Rival speed, easy to hard"
              />
              <span>Hard</span>
            </label>
            <span className="race__speed-value">
              {useBest ? rival.note : `Level ${speed}`} · {rivalWpm} wpm
            </span>
          </div>
          <p className="hint">
            {best > 0
              ? `Your best winning speed: ${Math.round(best)} wpm${stars > 0 ? ` — win faster than that for +${stars} ⭐` : ''}`
              : stars > 0
                ? `Win your first race for +${stars} ⭐`
                : ''}
          </p>
          <button type="button" className="race__go" onClick={start}>
            ▶ Go!
          </button>
        </div>
      ) : (
        <>
          <div className="race__track">
            <div className="race__lane">
              <span className="race__runner" style={{ left: `${youPct}%` }}>
                {player ? <MemberAvatar member={player} size={42} /> : <span className="race__flip">🏎️</span>}
              </span>
              <span className="race__flag">🏁</span>
            </div>
            <div className="race__lane">
              <span className={`race__runner ${rival.name === 'Yourself' ? 'race__ghost' : ''}`} style={{ left: `${rivalPct}%` }}>
                {rival.member ? <MemberAvatar member={rival.member} size={42} /> : <span className="race__flip">{rival.icon}</span>}
              </span>
              <span className="race__flag">🏁</span>
            </div>
          </div>
          {state === 'countdown' ? (
            <div className="race__count">{count || 'GO!'}</div>
          ) : (
            <div className="typing-text">
              {[...text].map((c, i) => (
                <span key={i} className={i < pos ? 'typing-text__done' : i === pos ? `typing-text__cur ${wrong ? 'typing-text__cur--wrong' : ''}` : ''}>
                  {c === ' ' ? ' ' : c}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      {input}
    </section>
  );
}

// ---- ⭐ Stars (parents) ----

function StarSettings({ rewards, onSaved }: { rewards: Rewards; onSaved: (r: Rewards) => void }) {
  const [draft, setDraft] = useState(rewards);
  const [status, setStatus] = useState<string | null>(null);
  const num = (v: string) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0)));
  const save = async () => {
    setStatus('Saving…');
    try {
      const saved = await api.put<Rewards>('/typing/settings/rewards', draft);
      onSaved(saved);
      setDraft(saved);
      setStatus('Saved ✓');
    } catch (err) {
      setStatus((err as Error).message);
    }
  };
  return (
    <section className="panel typing-stars">
      <h2>⭐ Stars for typing</h2>
      <p className="hint">
        How many ⭐ go into the Prize Bank. 0 = none. A lesson pays once, the first time it's passed. Changes apply from now on.
      </p>
      <div className="typing-stars__grid">
        {LEVELS.map((l, i) => (
          <label key={l.n}>
            <span>
              {l.n}. {l.name}
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              inputMode="numeric"
              value={draft.levels[i] ?? 0}
              onChange={(e) => setDraft({ ...draft, levels: draft.levels.map((v, j) => (j === i ? num(e.target.value) : v)) })}
            />
          </label>
        ))}
      </div>
      <h3>Games</h3>
      <div className="typing-stars__grid">
        <label>
          <span>🎈 Balloon Pop — new best score</span>
          <input type="number" min={0} inputMode="numeric" value={draft.balloon_best} onChange={(e) => setDraft({ ...draft, balloon_best: num(e.target.value) })} />
        </label>
        <label>
          <span>🏁 Race — win at a new best speed</span>
          <input type="number" min={0} inputMode="numeric" value={draft.race_best} onChange={(e) => setDraft({ ...draft, race_best: num(e.target.value) })} />
        </label>
        <label>
          <span>Game rounds that can pay ⭐ each day</span>
          <input type="number" min={0} inputMode="numeric" value={draft.games_per_day} onChange={(e) => setDraft({ ...draft, games_per_day: num(e.target.value) })} />
        </label>
      </div>
      <div className="typing-stars__actions">
        <button type="button" onClick={save}>
          Save
        </button>
        <button type="button" className="secondary" onClick={() => setDraft({ ...draft, levels: draft.levels.map(() => 0), balloon_best: 0, race_best: 0 })}>
          All 0
        </button>
        {status && <span className="hint">{status}</span>}
      </div>
    </section>
  );
}
