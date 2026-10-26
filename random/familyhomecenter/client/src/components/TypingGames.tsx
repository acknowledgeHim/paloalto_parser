import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type FamilyMember } from '../api/client.js';
import { MemberAvatar } from './MemberAvatar.js';
import { useTypeCatcher, type Earned, type SaveRound } from './typingInput.js';
import { KEY_ROWS, STORY_ENDINGS, dailyText, makeStory, wpmOf } from '../utils/typing.js';

/**
 * ⌨️ More typing games (pages/TypingPage.tsx): 🔨 Whack-a-Key and ☄️ Meteor Defense (single letters,
 * from lesson 1), 🧱 Tower Builder and 🐍 Word Snake (words), 📖 Silly Story and 🏆 the Daily
 * Challenge (whole sentences — open once every lesson is passed, or for a parent).
 */

const accuracyOf = (right: number, wrong: number) => Math.round((right / Math.max(1, right + wrong)) * 1000) / 10;
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** "+2 ⭐ New best" / "games have paid for today" under a finished round. */
function EarnedLine({ earned }: { earned: Earned | null }) {
  if (!earned) return null;
  if (earned.stars > 0) return <p className="typing-result__stars">+{earned.stars} ⭐ {earned.reason}</p>;
  return earned.reason ? <p className="hint">{earned.reason}</p> : null;
}

function BestLine({ best, stars, unit = '' }: { best: number; stars: number; unit?: string }) {
  return (
    <span className="hint">
      Best {Math.round(best)}
      {unit}
      {stars > 0 ? ` · beat it for +${stars} ⭐` : ''}
    </span>
  );
}

/** The start / game-over card laid over a game's play area. */
function Overlay({
  state,
  title,
  intro,
  score,
  best,
  earned,
  onStart,
}: {
  state: 'ready' | 'playing' | 'over';
  title: string;
  intro: string;
  score: number;
  best: number;
  earned: Earned | null;
  onStart: () => void;
}) {
  if (state === 'playing') return null;
  return (
    <div className="balloon__overlay">
      {state === 'over' ? (
        <>
          <div className="typing-result__big">{title.split(' ')[0]}</div>
          <h2>{score > best && score >= 10 ? 'New best!' : 'Game over'}</h2>
          <p>
            Score <strong>{score}</strong>
          </p>
          <EarnedLine earned={earned} />
        </>
      ) : (
        <>
          <h2>{title}</h2>
          <p>{intro}</p>
        </>
      )}
      <button type="button" onClick={onStart}>
        {state === 'ready' ? '▶ Start' : '↻ Play again'}
      </button>
    </div>
  );
}

// ---- 🔨 Whack-a-Key ----

interface Mole {
  key: string;
  downAt: number;
}

export function WhackAKey({ keys, best, stars, onSave }: { keys: string[]; best: number; stars: number; onSave: SaveRound }) {
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready');
  const [moles, setMoles] = useState<Mole[]>([]);
  const [bonked, setBonked] = useState<Record<string, 'hit' | 'miss'>>({});
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [earned, setEarned] = useState<Earned | null>(null);
  const live = useRef({ moles: [] as Mole[], score: 0, lives: 3, right: 0, wrong: 0, started: 0, lastSpawn: 0 });
  const allowed = new Set(keys);

  const start = () => {
    live.current = { moles: [], score: 0, lives: 3, right: 0, wrong: 0, started: Date.now(), lastSpawn: 0 };
    setMoles([]);
    setScore(0);
    setLives(3);
    setEarned(null);
    setState('playing');
  };

  const finish = useCallback(() => {
    setState('over');
    const L = live.current;
    const ms = Date.now() - L.started;
    onSave({
      mode: 'whack',
      level: 0,
      wpm: wpmOf(L.right, ms),
      accuracy: accuracyOf(L.right, L.wrong),
      chars: L.right,
      seconds: Math.round(ms / 1000),
      score: L.score,
      passed: false,
    }).then(setEarned);
  }, [onSave]);

  const flash = (key: string, kind: 'hit' | 'miss') => {
    setBonked((b) => ({ ...b, [key]: kind }));
    setTimeout(() => setBonked((b) => {
      const next = { ...b };
      delete next[key];
      return next;
    }), 300);
  };

  // Moles pop up on the letters learned so far; one left up too long gets away (a heart).
  // The more you whack, the quicker they duck — and from 10, 25 there are two, then three at once.
  useEffect(() => {
    if (state !== 'playing') return;
    const t = setInterval(() => {
      const L = live.current;
      const now = Date.now();
      const escaped = L.moles.filter((m) => m.downAt <= now);
      let list = L.moles.filter((m) => m.downAt > now);
      const most = L.score < 10 ? 1 : L.score < 25 ? 2 : 3;
      const upFor = Math.max(650, 2100 - L.score * 45);
      if (list.length < most && now - L.lastSpawn > Math.max(250, 900 - L.score * 20)) {
        const free = keys.filter((k) => !list.some((m) => m.key === k));
        if (free.length) {
          L.lastSpawn = now;
          list = [...list, { key: pick(free), downAt: now + upFor }];
        }
      }
      L.moles = list;
      setMoles(list);
      if (escaped.length) {
        L.lives -= escaped.length;
        setLives(L.lives);
        if (L.lives <= 0) finish();
      }
    }, 60);
    return () => clearInterval(t);
  }, [state, keys, finish]);

  const onChar = (c: string) => {
    if (state !== 'playing') {
      if (c === ' ') start();
      return;
    }
    const L = live.current;
    const k = c.toLowerCase();
    const hit = L.moles.find((m) => m.key === k);
    if (hit) {
      L.right++;
      L.score++;
      L.moles = L.moles.filter((m) => m !== hit);
      setMoles(L.moles);
      setScore(L.score);
      flash(k, 'hit');
    } else {
      L.wrong++;
      flash(k, 'miss');
    }
  };
  const { input, focus } = useTypeCatcher(onChar);

  return (
    <section className="panel balloon" onClick={focus}>
      <div className="balloon__top">
        <span>
          Whacked <strong>{score}</strong>
        </span>
        <span>{'❤️'.repeat(Math.max(0, lives))}</span>
        <BestLine best={best} stars={stars} />
      </div>
      <div className="whack">
        <div className="whack__kb" aria-hidden>
          {KEY_ROWS.slice(1).map((row, r) => (
            <div key={r} className={`whack__row whack__row--${r}`}>
              {row.map((k) => {
                const mole = moles.some((m) => m.key === k);
                return (
                  <span
                    key={k}
                    className={`whack__hole ${allowed.has(k) ? '' : 'whack__hole--off'} ${mole ? 'whack__hole--up' : ''} ${
                      bonked[k] ? `whack__hole--${bonked[k]}` : ''
                    }`}
                  >
                    <span className="whack__mole">{bonked[k] === 'hit' ? '💥' : '🐹'}</span>
                    <span className="whack__key">{k.toUpperCase()}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <Overlay
          state={state}
          title="🔨 Whack-a-Key"
          intro="A mole pops up on a key — press that key to bonk it before it hides! Three get away and it's over."
          score={score}
          best={best}
          earned={earned}
          onStart={start}
        />
      </div>
      {input}
    </section>
  );
}

// ---- ☄️ Meteor Defense ----

interface Meteor {
  id: number;
  word: string;
  x: number;
  y: number;
  speed: number;
}

export function MeteorDefense({
  keys,
  words,
  useWords,
  player,
  best,
  stars,
  onSave,
}: {
  keys: string[];
  words: string[];
  /** Words as well as letters (after the top row's been learned). */
  useWords: boolean;
  player: FamilyMember | null;
  best: number;
  stars: number;
  onSave: SaveRound;
}) {
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready');
  const [meteors, setMeteors] = useState<Meteor[]>([]);
  const [booms, setBooms] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [shot, setShot] = useState<{ id: number; x: number; y: number } | null>(null);
  const [typed, setTyped] = useState('');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [miss, setMiss] = useState(false);
  const [earned, setEarned] = useState<Earned | null>(null);
  const live = useRef({ meteors: [] as Meteor[], typed: '', lives: 3, score: 0, destroyed: 0, right: 0, wrong: 0, chars: 0, started: 0, lastSpawn: 0, nextId: 1 });
  const letters = keys.filter((k) => /[a-z]/.test(k));

  const start = () => {
    live.current = { meteors: [], typed: '', lives: 3, score: 0, destroyed: 0, right: 0, wrong: 0, chars: 0, started: Date.now(), lastSpawn: 0, nextId: 1 };
    setMeteors([]);
    setTyped('');
    setScore(0);
    setLives(3);
    setEarned(null);
    setState('playing');
  };

  const finish = useCallback(() => {
    setState('over');
    const L = live.current;
    const ms = Date.now() - L.started;
    onSave({
      mode: 'meteor',
      level: 0,
      wpm: wpmOf(L.chars, ms),
      accuracy: accuracyOf(L.right, L.wrong),
      chars: L.chars,
      seconds: Math.round(ms / 1000),
      score: L.score,
      passed: false,
    }).then(setEarned);
  }, [onSave]);

  // Meteors fall toward the planet; one that lands cracks the shield (a heart). Faster as you go.
  useEffect(() => {
    if (state !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(100, t - last) / 1000;
      last = t;
      const L = live.current;
      const level = Math.min(12, Math.floor(L.destroyed / 6));
      let list = L.meteors;
      if (t - L.lastSpawn > Math.max(700, 2200 - level * 130) && list.length < 7) {
        L.lastSpawn = t;
        const word = useWords && Math.random() < 0.5 ? pick(words) : pick(letters);
        list = [...list, { id: L.nextId++, word, x: 8 + Math.random() * 84, y: -6, speed: (word.length > 1 ? 6 : 9) + level * 1.3 + Math.random() * 3 }];
      }
      let landed = 0;
      list = list
        .map((m) => ({ ...m, y: m.y + m.speed * dt }))
        .filter((m) => {
          if (m.y >= 84) {
            landed++;
            return false;
          }
          return true;
        });
      L.meteors = list;
      setMeteors(list);
      if (landed) {
        L.lives -= landed;
        setLives(L.lives);
        if (!list.some((m) => m.word.startsWith(L.typed))) {
          L.typed = '';
          setTyped('');
        }
        if (L.lives <= 0) {
          finish();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, words, useWords, letters.join(''), finish]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChar = (c: string) => {
    if (state !== 'playing') {
      if (c === ' ') start();
      return;
    }
    const L = live.current;
    let next = (L.typed + c).toLowerCase();
    let targets = L.meteors.filter((m) => m.word.startsWith(next));
    // Half-way through a word but this key starts something else? Switch to that.
    if (!targets.length && L.typed) {
      next = c.toLowerCase();
      targets = L.meteors.filter((m) => m.word.startsWith(next));
    }
    if (!targets.length) {
      L.wrong++;
      setMiss(true);
      setTimeout(() => setMiss(false), 250);
      return;
    }
    L.right++;
    // The lowest one (closest to landing) first.
    const hit = targets.sort((a, b) => b.y - a.y)[0];
    if (hit.word === next) {
      L.chars += hit.word.length + 1;
      L.destroyed++;
      L.score += hit.word.length;
      L.meteors = L.meteors.filter((m) => m.id !== hit.id);
      L.typed = '';
      setMeteors(L.meteors);
      setScore(L.score);
      setTyped('');
      setShot({ id: hit.id, x: hit.x, y: hit.y });
      setBooms((b) => [...b, { id: hit.id, x: hit.x, y: hit.y }]);
      setTimeout(() => setBooms((b) => b.filter((x) => x.id !== hit.id)), 450);
      setTimeout(() => setShot((s) => (s?.id === hit.id ? null : s)), 120);
    } else {
      L.typed = next;
      setTyped(next);
    }
  };
  const { input, focus } = useTypeCatcher(onChar, () => {
    live.current.typed = live.current.typed.slice(0, -1);
    setTyped(live.current.typed);
  });

  return (
    <section className="panel balloon" onClick={focus}>
      <div className="balloon__top">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>{'🛡️'.repeat(Math.max(0, lives))}</span>
        <BestLine best={best} stars={stars} />
      </div>
      <div className={`meteor__space ${miss ? 'balloon__sky--miss' : ''}`}>
        {meteors.map((m) => {
          const active = typed && m.word.startsWith(typed);
          return (
            <div key={m.id} className="meteor__rock" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
              <span className="meteor__fire">☄️</span>
              <span className="meteor__word">
                {active ? (
                  <>
                    <span className="balloon__typed">{typed}</span>
                    {m.word.slice(typed.length)}
                  </>
                ) : (
                  m.word
                )}
              </span>
            </div>
          );
        })}
        {booms.map((b) => (
          <span key={b.id} className="meteor__boom" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
            💥
          </span>
        ))}
        {shot && (
          <svg className="meteor__laser" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line x1="50" y1="88" x2={shot.x} y2={shot.y + 3} />
          </svg>
        )}
        <div className="meteor__planet">
          <span className="meteor__player">{player ? <MemberAvatar member={player} size={44} /> : '🧑‍🚀'}</span>
        </div>
        <Overlay
          state={state}
          title="☄️ Meteor Defense"
          intro={
            useWords
              ? 'Type the letter or word on a meteor to zap it before it lands on your planet. Three hits and the shield breaks!'
              : 'Type the letter on a meteor to zap it before it lands on your planet. Three hits and the shield breaks!'
          }
          score={score}
          best={best}
          earned={earned}
          onStart={start}
        />
      </div>
      {state === 'playing' && useWords && <p className="balloon__typing">{typed || <span className="hint">type a letter or word…</span>}</p>}
      {input}
    </section>
  );
}

// ---- 🧱 Tower Builder ----

const BLOCK_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6'];
const MAX_WOBBLE = 3;

export function TowerBuilder({
  words,
  player,
  best,
  stars,
  onSave,
}: {
  words: string[];
  player: FamilyMember | null;
  best: number;
  stars: number;
  onSave: SaveRound;
}) {
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready');
  const [blocks, setBlocks] = useState<Array<{ word: string; color: string; shift: number }>>([]);
  const [word, setWord] = useState('');
  const [pos, setPos] = useState(0);
  const [wobble, setWobble] = useState(0);
  const [shake, setShake] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1);
  const [earned, setEarned] = useState<Earned | null>(null);
  const live = useRef({ word: '', pos: 0, height: 0, wobble: 0, streak: 0, right: 0, wrong: 0, chars: 0, started: 0, wordAt: 0, wordMs: 0 });

  /** Longer words get longer; a taller tower gets less time (but never under 40%). */
  const nextWord = (height: number) => {
    const w = pick(words);
    const L = live.current;
    L.word = w;
    L.pos = 0;
    L.wordAt = Date.now();
    L.wordMs = (2500 + w.length * 650) * Math.max(0.4, 1 - height * 0.03);
    setWord(w);
    setPos(0);
    setTimeLeft(1);
  };

  const start = () => {
    live.current = { word: '', pos: 0, height: 0, wobble: 0, streak: 0, right: 0, wrong: 0, chars: 0, started: Date.now(), wordAt: 0, wordMs: 0 };
    setBlocks([]);
    setWobble(0);
    setEarned(null);
    nextWord(0);
    setState('playing');
  };

  const finish = useCallback(() => {
    setState('over');
    const L = live.current;
    const ms = Date.now() - L.started;
    onSave({
      mode: 'tower',
      level: 0,
      wpm: wpmOf(L.chars, ms),
      accuracy: accuracyOf(L.right, L.wrong),
      chars: L.chars,
      seconds: Math.round(ms / 1000),
      score: L.height,
      passed: false,
    }).then(setEarned);
  }, [onSave]);

  /** A typo or running out of time: the tower wobbles. Too many wobbles and it falls. */
  const wobbleOnce = () => {
    const L = live.current;
    if (L.wobble >= MAX_WOBBLE) return; // already fallen
    L.wobble++;
    L.streak = 0;
    setWobble(L.wobble);
    setShake((s) => s + 1);
    if (L.wobble >= MAX_WOBBLE) finish();
  };

  useEffect(() => {
    if (state !== 'playing') return;
    const t = setInterval(() => {
      const L = live.current;
      const left = 1 - (Date.now() - L.wordAt) / L.wordMs;
      setTimeLeft(Math.max(0, left));
      if (left <= 0 && L.wobble < MAX_WOBBLE) {
        wobbleOnce();
        if (live.current.wobble < MAX_WOBBLE) nextWord(L.height);
      }
    }, 100);
    return () => clearInterval(t);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChar = (c: string) => {
    if (state !== 'playing') {
      if (c === ' ') start();
      return;
    }
    const L = live.current;
    if (L.wobble >= MAX_WOBBLE) return;
    if (c === ' ' && L.pos === 0) return; // a space between words is fine
    if (c.toLowerCase() === L.word[L.pos]) {
      L.right++;
      L.pos++;
      setPos(L.pos);
      if (L.pos >= L.word.length) {
        L.chars += L.word.length + 1;
        L.height++;
        L.streak++;
        // Five good words in a row steady the tower again.
        if (L.streak >= 5 && L.wobble > 0) {
          L.wobble--;
          L.streak = 0;
          setWobble(L.wobble);
        }
        const placed = L.word;
        setBlocks((b) => [...b, { word: placed, color: BLOCK_COLORS[b.length % BLOCK_COLORS.length], shift: Math.round((Math.random() - 0.5) * 16) }]);
        nextWord(L.height);
      }
    } else {
      L.wrong++;
      wobbleOnce();
    }
  };
  const { input, focus } = useTypeCatcher(onChar);
  const shown = blocks.slice(-9);

  return (
    <section className="panel balloon" onClick={focus}>
      <div className="balloon__top">
        <span>
          Height <strong>{blocks.length}</strong>
        </span>
        <span title="Wobbles">{'🟨'.repeat(Math.max(0, MAX_WOBBLE - wobble))}{'⬛'.repeat(Math.min(MAX_WOBBLE, wobble))}</span>
        <BestLine best={best} stars={stars} unit={best === 1 ? " block" : " blocks"} />
      </div>
      <div className="tower">
        {state === 'playing' && (
          <div className="tower__word">
            <div className="typing-text tower__text">
              {[...word].map((ch, i) => (
                <span key={i} className={i < pos ? 'typing-text__done' : i === pos ? 'typing-text__cur' : ''}>
                  {ch}
                </span>
              ))}
            </div>
            <div className="tower__time">
              <span style={{ width: `${timeLeft * 100}%`, background: timeLeft < 0.25 ? '#d64545' : undefined }} />
            </div>
          </div>
        )}
        <div
          key={shake}
          className={`tower__stack ${shake ? 'tower__stack--shake' : ''} ${state === 'over' ? 'tower__stack--fall' : ''}`}
          style={{ ['--tilt' as string]: `${wobble * 2.5}deg` }}
        >
          <span className="tower__top">{player ? <MemberAvatar member={player} size={40} /> : '🧒'}</span>
          {[...shown].reverse().map((b, i) => (
            <span key={blocks.length - i} className="tower__block" style={{ background: b.color, transform: `translateX(${b.shift}px)` }}>
              {b.word}
            </span>
          ))}
          <span className="tower__ground" />
        </div>
        <Overlay
          state={state}
          title="🧱 Tower Builder"
          intro="Type each word to add a block. A typo or running out of time makes the tower wobble — three wobbles and it falls! Five good words in a row steady it."
          score={blocks.length}
          best={best}
          earned={earned}
          onStart={start}
        />
      </div>
      {input}
    </section>
  );
}

// ---- 🐍 Word Snake ----

interface Food {
  id: number;
  word: string;
  x: number;
  y: number;
  icon: string;
  /** Typed — the snake is on its way. */
  chosen: boolean;
}

const FOOD_ICONS = ['🍎', '🍌', '🍓', '🍇', '🍪', '🧀', '🥕', '🍉', '🍩', '🌽'];
const FIELD_W = 160;
const FIELD_H = 100;

export function WordSnake({ words, best, stars, onSave }: { words: string[]; best: number; stars: number; onSave: SaveRound }) {
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready');
  const [, setFrame] = useState(0);
  const [typed, setTyped] = useState('');
  const [miss, setMiss] = useState(false);
  const [earned, setEarned] = useState<Earned | null>(null);
  const fresh = () => ({
    head: { x: 30, y: 50 },
    dir: 0,
    trail: [] as Array<{ x: number; y: number }>,
    length: 4,
    hunger: 100,
    foods: [] as Food[],
    queue: [] as number[],
    typed: '',
    score: 0,
    right: 0,
    wrong: 0,
    chars: 0,
    started: 0,
    nextId: 1,
  });
  const live = useRef(fresh());

  const addFood = () => {
    const L = live.current;
    const used = new Set(L.foods.map((f) => f.word[0]));
    const choices = words.filter((w) => !used.has(w[0]));
    L.foods.push({
      id: L.nextId++,
      word: pick(choices.length ? choices : words),
      x: 12 + Math.random() * (FIELD_W - 24),
      y: 12 + Math.random() * (FIELD_H - 24),
      icon: pick(FOOD_ICONS),
      chosen: false,
    });
  };

  const start = () => {
    live.current = fresh();
    live.current.started = Date.now();
    for (let i = 0; i < 3; i++) addFood();
    setTyped('');
    setEarned(null);
    setState('playing');
  };

  const finish = useCallback(() => {
    setState('over');
    const L = live.current;
    const ms = Date.now() - L.started;
    onSave({
      mode: 'snake',
      level: 0,
      wpm: wpmOf(L.chars, ms),
      accuracy: accuracyOf(L.right, L.wrong),
      chars: L.chars,
      seconds: Math.round(ms / 1000),
      score: L.score,
      passed: false,
    }).then(setEarned);
  }, [onSave]);

  // The snake slithers about by itself; a typed word sends it to that food. It gets hungrier the
  // longer it is — an empty tummy ends the game.
  useEffect(() => {
    if (state !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(100, t - last) / 1000;
      last = t;
      const L = live.current;
      const target = L.foods.find((f) => f.id === L.queue[0]);
      const speed = target ? 55 : 18;
      if (target) {
        const want = Math.atan2(target.y - L.head.y, target.x - L.head.x);
        let turn = want - L.dir;
        while (turn > Math.PI) turn -= 2 * Math.PI;
        while (turn < -Math.PI) turn += 2 * Math.PI;
        L.dir += Math.max(-6 * dt, Math.min(6 * dt, turn));
      } else {
        L.dir += (Math.random() - 0.5) * 2.5 * dt;
      }
      L.head = { x: L.head.x + Math.cos(L.dir) * speed * dt, y: L.head.y + Math.sin(L.dir) * speed * dt };
      // Bounce off the walls.
      if (L.head.x < 4 || L.head.x > FIELD_W - 4) {
        L.dir = Math.PI - L.dir;
        L.head.x = Math.max(4, Math.min(FIELD_W - 4, L.head.x));
      }
      if (L.head.y < 4 || L.head.y > FIELD_H - 4) {
        L.dir = -L.dir;
        L.head.y = Math.max(4, Math.min(FIELD_H - 4, L.head.y));
      }
      L.trail.unshift({ ...L.head });
      if (L.trail.length > 400) L.trail.length = 400;
      if (target && Math.hypot(target.x - L.head.x, target.y - L.head.y) < 5) {
        L.queue.shift();
        L.foods = L.foods.filter((f) => f.id !== target.id);
        L.length++;
        L.hunger = Math.min(100, L.hunger + 30);
        addFood();
      }
      L.hunger -= (5 + L.length * 0.35) * dt;
      setFrame((f) => f + 1);
      if (L.hunger <= 0) {
        L.hunger = 0;
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, finish]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChar = (c: string) => {
    if (state !== 'playing') {
      if (c === ' ') start();
      return;
    }
    const L = live.current;
    if (c === ' ') return;
    let next = (L.typed + c).toLowerCase();
    const open = L.foods.filter((f) => !f.chosen);
    let targets = open.filter((f) => f.word.startsWith(next));
    if (!targets.length && L.typed) {
      next = c.toLowerCase();
      targets = open.filter((f) => f.word.startsWith(next));
    }
    if (!targets.length) {
      L.wrong++;
      setMiss(true);
      setTimeout(() => setMiss(false), 250);
      return;
    }
    L.right++;
    const done = targets.find((f) => f.word === next);
    if (done) {
      done.chosen = true;
      L.queue.push(done.id);
      L.chars += done.word.length + 1;
      L.score += done.word.length;
      L.typed = '';
    } else {
      L.typed = next;
    }
    setTyped(L.typed);
  };
  const { input, focus } = useTypeCatcher(onChar, () => {
    live.current.typed = live.current.typed.slice(0, -1);
    setTyped(live.current.typed);
  });

  const L = live.current;
  // Body segments every few steps back along the path it took.
  const body = Array.from({ length: L.length }, (_, i) => L.trail[(i + 1) * 5]).filter(Boolean);
  const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / FIELD_W) * 100}%`, top: `${(p.y / FIELD_H) * 100}%` });

  return (
    <section className="panel balloon" onClick={focus}>
      <div className="balloon__top">
        <span>
          Score <strong>{state === 'ready' ? 0 : L.score}</strong> · length {L.length}
        </span>
        <span className="snake__hunger" title="Tummy">
          🍽️ <span><span style={{ width: `${L.hunger}%`, background: L.hunger < 25 ? '#d64545' : undefined }} /></span>
        </span>
        <BestLine best={best} stars={stars} />
      </div>
      <div className={`snake ${miss ? 'balloon__sky--miss' : ''}`}>
        {L.foods.map((f) => {
          const active = !f.chosen && typed && f.word.startsWith(typed);
          return (
            <div key={f.id} className={`snake__food ${f.chosen ? 'snake__food--chosen' : ''}`} style={pct(f)}>
              <span className="snake__icon">{f.icon}</span>
              <span className="meteor__word">
                {active ? (
                  <>
                    <span className="balloon__typed">{typed}</span>
                    {f.word.slice(typed.length)}
                  </>
                ) : (
                  f.word
                )}
              </span>
            </div>
          );
        })}
        {[...body].reverse().map((p, i) => (
          <span key={i} className="snake__seg" style={{ ...pct(p), ['--i' as string]: body.length - i }} />
        ))}
        <span className="snake__head" style={{ ...pct(L.head), transform: `translate(-50%, -50%) rotate(${L.dir}rad)` }}>
          <span className="snake__eyes" />
        </span>
        <Overlay
          state={state}
          title="🐍 Word Snake"
          intro="Type the word next to a snack and the snake goes to eat it. Keep its tummy full — it gets hungrier as it grows!"
          score={L.score}
          best={best}
          earned={earned}
          onStart={start}
        />
      </div>
      {state === 'playing' && <p className="balloon__typing">{typed || <span className="hint">type a snack's word…</span>}</p>}
      {input}
    </section>
  );
}

// ---- Typing out a sentence (Silly Story, Daily Challenge) ----

/** One line of text to type exactly; calls onDone with the keystrokes when it's finished. */
function SentenceTyper({ text, onDone, onFirstKey }: { text: string; onDone: (right: number, wrong: number) => void; onFirstKey?: () => void }) {
  const [pos, setPos] = useState(0);
  const [wrong, setWrong] = useState(false);
  const live = useRef({ pos: 0, right: 0, wrong: 0, done: false });
  useEffect(() => {
    live.current = { pos: 0, right: 0, wrong: 0, done: false };
    setPos(0);
    setWrong(false);
  }, [text]);
  const onChar = (c: string) => {
    const L = live.current;
    if (L.done) return;
    if (L.right + L.wrong === 0) onFirstKey?.();
    if (c === text[L.pos]) {
      L.right++;
      L.pos++;
      setPos(L.pos);
      setWrong(false);
      if (L.pos >= text.length) {
        L.done = true;
        onDone(L.right, L.wrong);
      }
    } else {
      L.wrong++;
      setWrong(true);
    }
  };
  const { input, focus } = useTypeCatcher(onChar);
  return (
    <div onClick={focus}>
      <div className="typing-text">
        {[...text].map((c, i) => (
          <span key={i} className={i < pos ? 'typing-text__done' : i === pos ? `typing-text__cur ${wrong ? 'typing-text__cur--wrong' : ''}` : ''}>
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </div>
      {input}
    </div>
  );
}

/** Shown in place of Tower Builder, Silly Story and the Daily Challenge until every lesson is passed. */
export function SentenceLock({ title, passed, total, nobody }: { title: string; passed: number; total: number; nobody: boolean }) {
  return (
    <section className="panel typing-lock">
      <div className="typing-result__big">🔒</div>
      <h2>{title}</h2>
      {nobody ? (
        <p>Pick who you are up top first.</p>
      ) : (
        <>
          <p>
            This one's for when you know the whole keyboard — it opens when you've passed <strong>all {total} lessons</strong>.
          </p>
          <p className="hint">
            You've passed {passed} of {total} — {total - passed} to go!
          </p>
          <div className="typing-lock__bar">
            <span style={{ width: `${(passed / total) * 100}%` }} />
          </div>
        </>
      )}
    </section>
  );
}

// ---- 📖 Silly Story ----

export function SillyStory({
  player,
  family,
  best,
  stars,
  onSave,
}: {
  player: FamilyMember;
  family: FamilyMember[];
  best: number;
  stars: number;
  onSave: SaveRound;
}) {
  const newStory = () => makeStory(player.name, family.map((m) => m.name));
  const [story, setStory] = useState(newStory);
  const [line, setLine] = useState(0);
  const [result, setResult] = useState<{ wpm: number; accuracy: number; ending: string } | null>(null);
  const [earned, setEarned] = useState<Earned | null>(null);
  const keys = useRef({ right: 0, wrong: 0, chars: 0, started: 0 });

  const again = () => {
    setStory(newStory());
    setLine(0);
    setResult(null);
    setEarned(null);
    keys.current = { right: 0, wrong: 0, chars: 0, started: 0 };
  };

  const lineDone = (right: number, wrong: number) => {
    const K = keys.current;
    K.right += right;
    K.wrong += wrong;
    K.chars += story.sentences[line].length + 1;
    if (line + 1 < story.sentences.length) {
      setLine(line + 1);
      return;
    }
    const ms = Date.now() - K.started;
    const wpm = wpmOf(K.chars, ms);
    const accuracy = accuracyOf(K.right, K.wrong);
    const ending = story.fill(STORY_ENDINGS.find((e) => wpm >= e.wpm)!.text);
    setResult({ wpm, accuracy, ending });
    onSave({ mode: 'story', level: 0, wpm, accuracy, chars: K.chars, seconds: Math.round(ms / 1000), score: 0, passed: accuracy >= 90 }).then(setEarned);
  };

  return (
    <section className="panel story">
      <div className="balloon__top">
        <strong>📖 Silly Story</strong>
        <span className="hint">
          {best > 0 ? `Best ${Math.round(best)} wpm` : 'Type it with 90% right to count'}
          {stars > 0 ? ` · ${best > 0 ? 'beat it' : 'finish one'} for +${stars} ⭐` : ''}
        </span>
      </div>
      <div className="story__page">
        {story.sentences.slice(0, result ? undefined : line).map((s, i) => (
          <span key={i} className="story__line">
            {s}{' '}
          </span>
        ))}
        {result && <span className="story__line story__end">{result.ending}</span>}
        {!result && <span className="story__more">…</span>}
      </div>
      {!result ? (
        <>
          <p className="hint">
            Line {line + 1} of {story.sentences.length} — type it to add it to the story. How fast you type decides how it ends!
          </p>
          <SentenceTyper
            key={line + story.sentences[0]}
            text={story.sentences[line]}
            onFirstKey={() => {
              if (!keys.current.started) keys.current.started = Date.now();
            }}
            onDone={lineDone}
          />
        </>
      ) : (
        <div className="typing-result">
          <p>
            <strong>{Math.round(result.wpm)}</strong> words a minute · <strong>{Math.round(result.accuracy)}%</strong> right
          </p>
          {result.accuracy < 90 && <p className="hint">90% right counts toward your best — slow down a little next time.</p>}
          <EarnedLine earned={earned} />
          <div className="typing-result__actions">
            <button type="button" onClick={again}>
              📖 A new story
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---- 🏆 Daily Challenge ----

export interface DailyBoard {
  enabled: boolean;
  day: string;
  accuracy_needed: number;
  board: Array<{ member_id: string; wpm: number; accuracy: number; net: number; passed: number; tries: number }>;
}

/** Today's results, best first (also on the Family Board). */
export function DailyStandings({ daily, members }: { daily: DailyBoard; members: FamilyMember[] }) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const medals = ['🥇', '🥈', '🥉'];
  const rows = daily.board.filter((r) => byId.has(r.member_id));
  if (!rows.length) return <p className="hint">Nobody's tried today's challenge yet — be the first!</p>;
  return (
    <ol className="daily__board">
      {rows.map((r, i) => {
        const m = byId.get(r.member_id)!;
        return (
          <li key={r.member_id} className={r.passed ? '' : 'daily__row--try'}>
            <span className="daily__rank">{r.passed ? (medals[i] ?? `${i + 1}.`) : '·'}</span>
            <MemberAvatar member={m} size={30} />
            <span className="daily__name">{m.name}</span>
            <span className="daily__score">
              <strong>{Math.round(r.wpm)}</strong> wpm · {Math.round(r.accuracy)}%
              <span className="hint">
                {' '}
                · {r.tries} {r.tries === 1 ? 'try' : 'tries'}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function DailyChallenge({
  player,
  members,
  stars,
  doneToday,
  onSave,
}: {
  player: FamilyMember;
  members: FamilyMember[];
  stars: number;
  doneToday: boolean;
  onSave: SaveRound;
}) {
  const [daily, setDaily] = useState<DailyBoard | null>(null);
  const [state, setState] = useState<'ready' | 'countdown' | 'typing' | 'done'>('ready');
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<{ wpm: number; accuracy: number } | null>(null);
  const [earned, setEarned] = useState<Earned | null>(null);
  const t0 = useRef(0);
  const load = useCallback(() => {
    api.get<DailyBoard>('/typing/daily').then(setDaily).catch(() => {});
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (state !== 'countdown') return;
    if (count === 0) {
      t0.current = Date.now();
      setState('typing');
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [state, count]);

  if (!daily) return null;
  const text = dailyText(daily.day);
  const done = (right: number, wrong: number) => {
    const ms = Date.now() - t0.current;
    const wpm = wpmOf(text.length, ms);
    const accuracy = accuracyOf(right, wrong);
    setResult({ wpm, accuracy });
    setState('done');
    onSave({ mode: 'daily', level: 0, wpm, accuracy, chars: text.length, seconds: Math.round(ms / 1000), score: 0, passed: accuracy >= daily.accuracy_needed })
      .then(setEarned)
      .finally(load);
  };
  const go = () => {
    setResult(null);
    setEarned(null);
    setCount(3);
    setState('countdown');
  };

  return (
    <>
      <section className="panel race">
        <div className="balloon__top">
          <strong>🏆 Today's challenge</strong>
          <span className="hint">
            Everyone types the same thing today — fastest with {daily.accuracy_needed}% right wins.
            {stars > 0 && !doneToday ? ` Finish it for +${stars} ⭐.` : ''}
          </span>
        </div>
        {state === 'countdown' ? (
          <div className="race__count">{count || 'GO!'}</div>
        ) : state === 'typing' ? (
          <SentenceTyper text={text} onDone={done} />
        ) : (
          <div className="race__pick">
            {result ? (
              <div className="typing-result">
                <div className="typing-result__big">{result.accuracy >= daily.accuracy_needed ? '🏆' : '💪'}</div>
                <p>
                  <strong>{Math.round(result.wpm)}</strong> words a minute · <strong>{Math.round(result.accuracy)}%</strong> right
                </p>
                {result.accuracy < daily.accuracy_needed && (
                  <p className="hint">It counts at {daily.accuracy_needed}% right — try again, a little slower.</p>
                )}
                <EarnedLine earned={earned} />
              </div>
            ) : (
              <p className="daily__preview">“{text}”</p>
            )}
            <button type="button" className="race__go" onClick={go}>
              {result ? '↻ Try again' : '▶ Start'}
            </button>
            <p className="hint">Your best try today counts. A new challenge every day.</p>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Today's leaderboard</h2>
        <DailyStandings daily={daily} members={members} />
        <p className="hint">Playing as {player.name}.</p>
      </section>
    </>
  );
}

// ---- 🛒 Shopping Spree (pretend money — nothing to do with the bank or ⭐) ----

const STORE: Array<{ icon: string; name: string; price: number }> = [
  { icon: '🍬', name: 'candy', price: 1 },
  { icon: '🍎', name: 'apple', price: 1 },
  { icon: '🧃', name: 'juice', price: 2 },
  { icon: '🍦', name: 'ice cream', price: 3 },
  { icon: '🖍️', name: 'crayons', price: 4 },
  { icon: '🎈', name: 'balloon', price: 4 },
  { icon: '📚', name: 'book', price: 6 },
  { icon: '⚽', name: 'ball', price: 7 },
  { icon: '🧸', name: 'teddy', price: 9 },
  { icon: '🪁', name: 'kite', price: 10 },
  { icon: '👟', name: 'sneakers', price: 14 },
  { icon: '🎧', name: 'headphones', price: 18 },
  { icon: '🛹', name: 'skateboard', price: 22 },
  { icon: '🎮', name: 'game', price: 28 },
  { icon: '🚲', name: 'bike', price: 35 },
];
const SHOP_START_MONEY = 10;

export function ShoppingSpree({
  words,
  player,
  best,
  onSave,
}: {
  words: string[];
  player: FamilyMember | null;
  best: number;
  onSave: SaveRound;
}) {
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready');
  const [, setFrame] = useState(0);
  const [flash, setFlash] = useState<{ id: number; text: string; kind: 'earn' | 'spend' } | null>(null);
  const [earned, setEarned] = useState<Earned | null>(null);
  const fresh = () => ({
    money: SHOP_START_MONEY,
    spent: 0,
    cart: [] as string[],
    word: '',
    nextWord: '',
    pos: 0,
    wrongNow: false,
    streak: 0,
    grabbing: 0,
    grabAt: 0,
    grabMs: 4000,
    right: 0,
    wrong: 0,
    chars: 0,
    started: 0,
    flashId: 0,
    broke: '',
  });
  const live = useRef(fresh());

  /** The next thing the shopper wants — pricier as the cart fills up. */
  const nextGrab = () => {
    const L = live.current;
    const top = Math.min(STORE.length, 5 + Math.floor(L.cart.length / 2));
    L.grabbing = Math.floor(Math.random() * top);
    L.grabAt = Date.now();
    L.grabMs = Math.max(1400, 4200 - L.cart.length * 110);
  };
  const say = (text: string, kind: 'earn' | 'spend') => {
    const id = ++live.current.flashId;
    setFlash({ id, text, kind });
    setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 700);
  };

  const start = () => {
    live.current = fresh();
    const L = live.current;
    L.started = Date.now();
    L.word = pick(words);
    L.nextWord = pick(words);
    nextGrab();
    setEarned(null);
    setState('playing');
  };

  const finish = useCallback(() => {
    setState('over');
    const L = live.current;
    const ms = Date.now() - L.started;
    onSave({
      mode: 'shop',
      level: 0,
      wpm: wpmOf(L.chars, ms),
      accuracy: accuracyOf(L.right, L.wrong),
      chars: L.chars,
      seconds: Math.round(ms / 1000),
      score: L.spent,
      passed: false,
    }).then(setEarned);
  }, [onSave]);

  // The shopper keeps grabbing things off the shelf and paying for them; can't pay → game over.
  useEffect(() => {
    if (state !== 'playing') return;
    const t = setInterval(() => {
      const L = live.current;
      if (Date.now() - L.grabAt >= L.grabMs) {
        const item = STORE[L.grabbing];
        if (L.money < item.price) {
          L.broke = item.icon;
          setFrame((f) => f + 1);
          finish();
          return;
        }
        L.money -= item.price;
        L.spent += item.price;
        L.cart.push(item.icon);
        say(`-$${item.price}`, 'spend');
        nextGrab();
      }
      setFrame((f) => f + 1);
    }, 100);
    return () => clearInterval(t);
  }, [state, finish]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChar = (c: string) => {
    if (state !== 'playing') {
      if (c === ' ') start();
      return;
    }
    const L = live.current;
    if (c === ' ' && L.pos === 0) return;
    if (c.toLowerCase() === L.word[L.pos]) {
      L.right++;
      L.pos++;
      L.wrongNow = false;
      if (L.pos >= L.word.length) {
        // A dollar a letter, and a bonus for every five words in a row without a slip.
        L.streak++;
        const pay = L.word.length + (L.streak % 5 === 0 ? 5 : 0);
        L.money += pay;
        L.chars += L.word.length + 1;
        say(`+$${pay}${L.streak % 5 === 0 ? ' 🔥' : ''}`, 'earn');
        L.word = L.nextWord;
        L.nextWord = pick(words);
        L.pos = 0;
      }
    } else {
      L.wrong++;
      L.streak = 0;
      L.wrongNow = true;
    }
    setFrame((f) => f + 1);
  };
  const { input, focus } = useTypeCatcher(onChar);

  const L = live.current;
  const want = STORE[L.grabbing];
  const progress = state === 'playing' ? Math.min(1, (Date.now() - L.grabAt) / L.grabMs) : 0;

  return (
    <section className="panel balloon" onClick={focus}>
      <div className="balloon__top">
        <span className={`shop__money ${L.money < (want?.price ?? 0) ? 'shop__money--low' : ''}`}>
          💵 ${state === 'ready' ? SHOP_START_MONEY : L.money}
          {flash && <span className={`shop__flash shop__flash--${flash.kind}`}>{flash.text}</span>}
        </span>
        <span className="hint">
          Spent ${L.spent} · best ${Math.round(best)} · pretend money, just for fun
        </span>
      </div>
      <div className="shop">
        <div className="shop__shelf">
          {STORE.map((item, i) => (
            <span key={item.name} className={`shop__item ${state === 'playing' && i === L.grabbing ? 'shop__item--want' : ''}`}>
              {state === 'playing' && i === L.grabbing && (
                <span className="shop__shopper">{player ? <MemberAvatar member={player} size={34} /> : '🧒'}</span>
              )}
              <span className="shop__icon">{item.icon}</span>
              <span className="shop__price">${item.price}</span>
              {state === 'playing' && i === L.grabbing && (
                <span className="shop__grab">
                  <span style={{ width: `${progress * 100}%` }} />
                </span>
              )}
            </span>
          ))}
        </div>
        {state === 'playing' && (
          <div className="shop__work">
            <p className="hint">
              {player?.name ?? 'Your shopper'} is grabbing {want.icon} for ${want.price} — type to earn more money!
            </p>
            <div className="typing-text tower__text">
              {[...L.word].map((ch, i) => (
                <span key={i} className={i < L.pos ? 'typing-text__done' : i === L.pos ? `typing-text__cur ${L.wrongNow ? 'typing-text__cur--wrong' : ''}` : ''}>
                  {ch}
                </span>
              ))}
              <span className="shop__next"> {L.nextWord}</span>
            </div>
          </div>
        )}
        <div className="shop__cart">
          🛒 {L.cart.length ? L.cart.slice(-24).join('') : <span className="hint">empty</span>}
          {L.cart.length > 24 && <span className="hint"> +{L.cart.length - 24}</span>}
        </div>
        {state !== 'playing' && (
          <div className="balloon__overlay">
            {state === 'over' ? (
              <>
                <div className="typing-result__big">{L.broke || '🛒'}</div>
                <h2>Out of money!</h2>
                <p>
                  {player?.name ?? 'Your shopper'} bought <strong>{L.cart.length}</strong> things for <strong>${L.spent}</strong>
                  {L.spent > best && L.spent > 0 ? ' — a new best!' : ''}
                </p>
                <EarnedLine earned={earned} />
              </>
            ) : (
              <>
                <h2>🛒 Shopping Spree</h2>
                <p>
                  {player?.name ?? 'Your shopper'} keeps grabbing things from the store — and they cost money! Type words to earn a
                  dollar a letter (five in a row without a slip: +$5 bonus). Run out of money and the trip's over.
                </p>
                <p className="hint">Pretend money — it's not your bank or your stars.</p>
              </>
            )}
            <button type="button" onClick={start}>
              {state === 'ready' ? '▶ Start' : '↻ Shop again'}
            </button>
          </div>
        )}
      </div>
      {input}
    </section>
  );
}
