import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { BonusLine } from '../components/LearningBonus.js';
import { GRADE_SHORT, noTokensWhy, tiersText, useLearning, type Tier } from '../utils/learning.js';
import { useDraft } from '../utils/autosave.js';
import { LimitNote, useActivityClock, useLimit } from '../utils/limits.js';

interface Start {
  round_id: string;
  grade: number;
  items: Array<{ words: string[]; mistakes: number }>;
  tokens: Tier[] | null;
  no_tokens_why: string | null;
}
interface Checked {
  words: string[];
  fixes: Array<{ i: number; right: string }>;
  tapped: number[];
  ok: boolean;
  tip: string;
}
interface Finish {
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  tokens: number;
  /** 🎁 the day's bonus, paid by this round */
  bonus?: number;
  no_tokens_why: string | null;
  items: Checked[];
}

export interface TapGame {
  subject: 'grammar' | 'spellcheck';
  title: string;
  /** "mistake" / "misspelled word" */
  noun: string;
  how: string[];
}
export const GRAMMAR_GAME: TapGame = {
  subject: 'grammar',
  title: '📝 Grammar',
  noun: 'mistake',
  how: [
    'Read the sentence (or paragraph) and tap every word that’s wrong. It tells you how many to find.',
    'A wrong word might be the wrong form (“goed”), a mix-up (“their” / “there”), a missing capital, or a word that shouldn’t be there at all.',
    'Check shows the fixes and a tip. Higher grades have short paragraphs with two or three mistakes.',
  ],
};
export const SPELLCHECK_GAME: TapGame = {
  subject: 'spellcheck',
  title: '🔍 Spot the misspellings',
  noun: 'misspelled word',
  how: ['Read the paragraph and tap every word that’s spelled wrong. It tells you how many to find.', 'Check shows the right spelling. Higher grades: harder words, longer paragraphs, more to find.'],
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** 📚 Learning: a "tap the mistakes" game (📝 Grammar, 🔍 Spot the misspellings). 10 items a round. */
export function TapMistakesPage({ game }: { game: TapGame }) {
  const { activeProfile } = useFamilyMembers();
  const { settings, person, reload } = useLearning(activeProfile?.id);
  const [grade, setGrade] = useState<number | null>(null);
  const [round, setRound] = useState<Start | null>(null);
  const [result, setResult] = useState<Finish | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 💾 a round in progress: the round, every item's taps, and how many are checked */
  const saved = useDraft<{ round: Start; taps: number[][]; done: number }>(activeProfile?.id, `tap-${game.subject}`);
  const [startAt, setStartAt] = useState<{ taps: number[][]; done: number } | null>(null);
  // ⏰ a parent's daily limit: a round already going is always finished
  const limit = useLimit(activeProfile?.id, game.subject);
  useActivityClock(activeProfile?.id, game.subject, round !== null, limit.setStatus);

  useEffect(() => {
    if (person && grade === null) setGrade(person.grade ?? 0);
  }, [person, grade]);

  const g = grade ?? 0;
  const rewards = settings?.rewards[game.subject];
  const why = settings ? noTokensWhy(person, rewards, g, settings.grades) : null;

  const start = async () => {
    if (!activeProfile) return;
    setError(null);
    setResult(null);
    try {
      const r = await api.post<Start>(`/learning/${game.subject}/start`, { member_id: activeProfile.id, grade: g, acting_member_id: activeProfile.id });
      saved.save({ round: r, taps: r.items.map(() => []), done: 0 });
      setStartAt(null);
      setRound(r);
      void limit.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const finish = async (r: Start, answers: number[][]) => {
    try {
      setResult(await api.post<Finish>(`/learning/round/${r.round_id}/finish`, { answers, acting_member_id: activeProfile?.id }));
      reload();
      void limit.reload();
      saved.save(null);
    } catch (e) {
      setError((e as Error).message);
      if (/expired|already finished/.test((e as Error).message)) saved.save(null);
    }
    setRound(null);
  };
  /** 💾 carry on with the saved round, at the first item not checked yet */
  const resume = () => {
    const d = saved.draft;
    if (!d) return;
    setError(null);
    setResult(null);
    if (d.done >= d.round.items.length) return void finish(d.round, d.taps);
    setStartAt({ taps: d.taps, done: d.done });
    setRound(d.round);
  };

  if (round) {
    return (
      <TapRound
        game={game}
        round={round}
        gradeName={settings?.grades[round.grade] ?? ''}
        actingId={activeProfile?.id}
        startAt={startAt}
        onProgress={(taps, done, now) => (now ? saved.save : saved.saveSoon)({ round, taps, done })}
        onDone={(answers) => void finish(round, answers)}
        onQuit={() => setRound(null)}
      />
    );
  }

  const sub = person?.subjects[game.subject];
  return (
    <div className="learning-page">
      <h1>{game.title}</h1>
      {!activeProfile && <p className="hint">Pick who you are up top first.</p>}

      {result && (
        <section className="panel learning-result">
          <h2>
            {result.pct === 100 ? '🌟 Perfect!' : result.passed ? '🎉 Passed!' : '💪 Keep practising!'} {result.correct} / {result.total} right ({result.pct}%)
          </h2>
          {result.tokens > 0 ? <p className="learning-result__tokens">+{result.tokens} 💎 tokens</p> : result.no_tokens_why ? <p className="hint">{result.no_tokens_why}</p> : null}
          {result.bonus ? <p className="learning-result__tokens">🎁 +{result.bonus} 💎 bonus — all of today's tokens earned!</p> : null}
          <ol className="tap-results">
            {result.items.map((it, i) => (
              <li key={i} className={it.ok ? 'is-ok' : 'is-wrong'}>
                {it.ok ? '✅ ' : '❌ '}
                <Fixed item={it} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {activeProfile && settings && (
        <section className="panel">
          <h2>Pick a grade</h2>
          <div className="learning-grades" role="radiogroup" aria-label="Grade">
            {settings.grades.map((name, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={g === i}
                title={name}
                className={`learning-grade${g === i ? ' is-on' : ''}${person?.grade === i ? ' is-mine' : ''}`}
                onClick={() => setGrade(i)}
              >
                {GRADE_SHORT[i]}
              </button>
            ))}
          </div>
          <p>
            <strong>{settings.grades[g]}</strong>
            {person?.grade != null && !person.is_parent ? <span className="hint"> · your grade: {settings.grades[person.grade]}</span> : null}
          </p>
          <p className={why ? 'hint' : 'learning-earn'}>
            {why ?? (
              <>
                💎 Earn: {tiersText(rewards!.tiers)} · {Math.max(0, rewards!.per_day - (sub?.paid_today ?? 0))} of {rewards!.per_day} paying round{rewards!.per_day === 1 ? '' : 's'} left today
              </>
            )}
          </p>
          {person && !person.is_parent && <BonusLine bonus={person.bonus} />}
          {saved.draft && (
            <div className="learning-resume">
              <span>
                💾 You have a round going: {settings.grades[saved.draft.round.grade]}, {saved.draft.done} of {saved.draft.round.items.length} done
              </span>
              <button type="button" className="learning-go" onClick={resume}>
                ▶ Keep going
              </button>
            </div>
          )}
          <LimitNote status={limit.status} />
          <button type="button" className={saved.draft ? 'secondary' : 'learning-go'} disabled={!!limit.status?.over} onClick={() => void start()}>
            {saved.draft ? '↻ Start a new' : '▶ Start'} 10
          </button>
          {error && <div className="settings-login__error">{error}</div>}
        </section>
      )}

      {sub && sub.recent.length > 0 && settings && (
        <section className="panel">
          <h2>Lately</h2>
          <ul className="hint">
            {sub.recent.map((r, i) => (
              <li key={i}>
                {new Date(r.at).toLocaleDateString()} · {settings.grades[r.grade]} · {r.correct}/{r.total}
                {r.tokens ? ` · +${r.tokens} 💎` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>How it works</h2>
        <ul className="hint">
          {game.how.map((h) => (
            <li key={h}>{h}</li>
          ))}
          <li>Try any grade. Tokens come from your own grade or higher (a parent sets your grade).</li>
        </ul>
        {game.subject === 'grammar' && (
          <p>
            <Link to="/grammar/lessons">📖 Grammar lessons</Link> — the rules in plain words, with a quiz for 💎.
          </p>
        )}
        {person?.is_parent && <Link to="/learning/settings">⚙️ Grades & tokens</Link>}
      </section>
    </div>
  );
}

/** The text with each mistake shown fixed: ~~wrong~~ right. Missed ones and wrong taps marked. */
function Fixed({ item }: { item: Checked }) {
  const fix = new Map(item.fixes.map((f) => [f.i, f.right]));
  const tapped = new Set(item.tapped);
  return (
    <span className="tap-fixed">
      {item.words.map((w, k) => {
        const right = fix.get(k);
        if (right === undefined)
          return (
            <span key={k} className={tapped.has(k) ? 'tap-word is-falsetap' : 'tap-word'} title={tapped.has(k) ? 'This one was fine' : undefined}>
              {w}{' '}
            </span>
          );
        return (
          <span key={k} className={`tap-word ${tapped.has(k) ? 'is-found' : 'is-missed'}`}>
            <s>{w}</s>
            {right ? <> {right}</> : null}{' '}
          </span>
        );
      })}
      {item.tip && <span className="tap-tip">💡 {item.tip}</span>}
    </span>
  );
}

function TapRound({
  game,
  round,
  gradeName,
  actingId,
  startAt,
  onProgress,
  onDone,
  onQuit,
}: {
  game: TapGame;
  round: Start;
  gradeName: string;
  actingId?: string;
  /** 💾 carrying on: the taps so far and how many items are checked (it starts at the next one) */
  startAt?: { taps: number[][]; done: number } | null;
  /** 💾 taps changed (now = an item was just checked: save straight away) */
  onProgress?: (taps: number[][], done: number, now: boolean) => void;
  onDone: (answers: number[][]) => void;
  onQuit: () => void;
}) {
  const [i, setI] = useState(() => Math.min(startAt?.done ?? 0, round.items.length - 1));
  const [taps, setTaps] = useState<number[][]>(() => round.items.map((_, k) => startAt?.taps[k] ?? []));
  const [checked, setChecked] = useState<Checked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const item = round.items[i];
  const mine = taps[i];

  const toggle = (k: number) => {
    if (checked) return;
    const next = taps.map((x, j) => (j !== i ? x : x.includes(k) ? x.filter((y) => y !== k) : [...x, k]));
    setTaps(next);
    onProgress?.(next, i, false);
  };
  const check = async () => {
    setError(null);
    try {
      setChecked(await api.post<Checked>(`/learning/round/${round.round_id}/check`, { index: i, tapped: mine, acting_member_id: actingId }));
      onProgress?.(taps, i + 1, true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const next = () => {
    setChecked(null);
    if (i + 1 >= round.items.length) onDone(taps);
    else setI(i + 1);
  };

  return (
    <div className="learning-page">
      <section className="panel tap-round">
        <div className="spelling-round__top">
          <span>
            {game.title} · {gradeName} · <strong>{i + 1}</strong> of {round.items.length}
          </span>
          <button type="button" className="link-button" onClick={onQuit}>
            ✕ Stop
          </button>
        </div>
        <p className="tap-round__ask">
          Tap the <strong>{plural(item.mistakes, game.noun)}</strong>
          {!checked && (
            <span className="hint">
              {' '}
              · tapped {mine.length} of {item.mistakes}
            </span>
          )}
        </p>
        {!checked ? (
          <p className="tap-round__text">
            {item.words.map((w, k) => (
              <button key={k} type="button" className={`tap-word${mine.includes(k) ? ' is-tapped' : ''}`} aria-pressed={mine.includes(k)} onClick={() => toggle(k)}>
                {w}
              </button>
            ))}
          </p>
        ) : (
          <div className={`tap-round__checked ${checked.ok ? 'is-ok' : 'is-wrong'}`}>
            <div className="spelling-round__verdict">{checked.ok ? '✅ All found!' : '❌ Not quite'}</div>
            <p className="tap-round__text">
              <Fixed item={checked} />
            </p>
          </div>
        )}
        {error && <div className="settings-login__error">{error}</div>}
        <div className="tap-round__actions">
          {!checked ? (
            <button type="button" onClick={() => void check()}>
              ✓ Check
            </button>
          ) : (
            <button type="button" onClick={next} autoFocus>
              {i + 1 >= round.items.length ? 'See how I did ›' : 'Next ›'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
