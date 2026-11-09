import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { GRADE_SHORT, noTokensWhy, tiersText, useLearning, type Tier } from '../utils/learning.js';
import { useDraft } from '../utils/autosave.js';
import { LimitNote, useActivityClock, useLimit } from '../utils/limits.js';

/** 💾 a round in progress: the round, and the answers checked so far */
interface MathDraft {
  round: Start;
  answers: string[];
}

interface Problem {
  q: string;
  topic: string;
  note: string | null;
  choices: string[] | null;
}
interface Start {
  round_id: string;
  grade: number;
  problems: Problem[];
  tokens: Tier[] | null;
  no_tokens_why: string | null;
}
interface Checked {
  q: string;
  given: string;
  ok: boolean;
  right: string;
  hint: string;
  topic: string;
}
interface Finish {
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  tokens: number;
  no_tokens_why: string | null;
  items: Checked[];
}

/** ➗ Math (📚 Learning): 10 problems at a grade, made fresh each time. K–5 arithmetic; 6 Pre-Algebra … 12 Calculus. */
export function MathPage() {
  const { activeProfile } = useFamilyMembers();
  const { settings, person, reload } = useLearning(activeProfile?.id);
  const [grade, setGrade] = useState<number | null>(null);
  const [round, setRound] = useState<Start | null>(null);
  const [result, setResult] = useState<Finish | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<{ course: string[]; topics: string[][] } | null>(null);
  const saved = useDraft<MathDraft>(activeProfile?.id, 'math');
  const [startAnswers, setStartAnswers] = useState<string[]>([]);
  // ⏰ a parent's daily limit: a round already going is always finished
  const limit = useLimit(activeProfile?.id, 'math');
  useActivityClock(activeProfile?.id, 'math', round !== null, limit.setStatus);

  useEffect(() => {
    if (person && grade === null) setGrade(person.grade ?? 0);
  }, [person, grade]);
  useEffect(() => {
    api.get<{ course: string[]; topics: string[][] }>('/learning/math/topics').then(setTopics).catch(() => {});
  }, []);

  const g = grade ?? 0;
  const rewards = settings?.rewards.math;
  const why = settings ? noTokensWhy(person, rewards, g, settings.grades) : null;

  const start = async () => {
    if (!activeProfile) return;
    setError(null);
    setResult(null);
    try {
      const r = await api.post<Start>('/learning/math/start', { member_id: activeProfile.id, grade: g, acting_member_id: activeProfile.id });
      saved.save({ round: r, answers: [] });
      setStartAnswers([]);
      setRound(r);
      void limit.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const finish = async (r: Start, answers: string[]) => {
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
  /** 💾 carry on with the saved round, at the first problem not checked yet */
  const resume = () => {
    const d = saved.draft;
    if (!d) return;
    setError(null);
    setResult(null);
    if (d.answers.length >= d.round.problems.length) return void finish(d.round, d.answers);
    setStartAnswers(d.answers);
    setRound(d.round);
  };

  if (round) {
    return (
      <MathRound
        round={round}
        gradeName={settings?.grades[round.grade] ?? ''}
        actingId={activeProfile?.id}
        startAnswers={startAnswers}
        onProgress={(answers) => saved.save({ round, answers })}
        onDone={(answers) => void finish(round, answers)}
        onQuit={() => setRound(null)}
      />
    );
  }

  const sub = person?.subjects.math;
  return (
    <div className="learning-page">
      <h1>➗ Math</h1>
      {!activeProfile && <p className="hint">Pick who you are up top first.</p>}

      {result && (
        <section className="panel learning-result">
          <h2>
            {result.pct === 100 ? '🌟 Perfect!' : result.passed ? '🎉 Passed!' : '💪 Keep practising!'} {result.correct} / {result.total} right ({result.pct}%)
          </h2>
          {result.tokens > 0 ? <p className="learning-result__tokens">+{result.tokens} 💎 tokens</p> : result.no_tokens_why ? <p className="hint">{result.no_tokens_why}</p> : null}
          <ol className="tap-results">
            {result.items.map((it, i) => (
              <li key={i} className={it.ok ? 'is-ok' : 'is-wrong'}>
                <div className="math-q math-q--small">{it.q}</div>
                {it.ok ? '✅ ' : '❌ '}
                <strong>{it.right}</strong>
                {!it.ok && <span className="hint"> — you said “{it.given || '(nothing)'}” · 💡 {it.hint}</span>}
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
            {topics?.course[g] ? <strong> · {topics.course[g]}</strong> : null}
            {person?.grade != null && !person.is_parent ? <span className="hint"> · your grade: {settings.grades[person.grade]}</span> : null}
          </p>
          {topics && <p className="hint">{topics.topics[g].join(' · ')}</p>}
          <p className={why ? 'hint' : 'learning-earn'}>
            {why ?? (
              <>
                💎 Earn: {tiersText(rewards!.tiers)} · {Math.max(0, rewards!.per_day - (sub?.paid_today ?? 0))} of {rewards!.per_day} paying round{rewards!.per_day === 1 ? '' : 's'} left today
              </>
            )}
          </p>
          {saved.draft && (
            <div className="learning-resume">
              <span>
                💾 You have a round going: {settings.grades[saved.draft.round.grade]}, {saved.draft.answers.length} of {saved.draft.round.problems.length} problems done
              </span>
              <button type="button" className="learning-go" onClick={resume}>
                ▶ Keep going
              </button>
            </div>
          )}
          <LimitNote status={limit.status} />
          <button type="button" className={saved.draft ? 'secondary' : 'learning-go'} disabled={!!limit.status?.over} onClick={() => void start()}>
            {saved.draft ? '↻ Start 10 new problems' : '▶ Start 10 problems'}
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
          <li>10 problems, mixed. Type the answer (or tap one) and Check — you'll see the right answer and a tip.</li>
          <li>Fractions like 3/4 or −2/3 are fine, and so are decimals — any equal form counts.</li>
          <li>6th grade is Pre-Algebra, then Algebra, Algebra II, Geometry, Trigonometry, Pre-Calculus and Calculus in 12th.</li>
          <li>Try any grade. Tokens come from your own grade or higher (a parent sets your grade).</li>
        </ul>
        <p>
          <Link to="/math/lessons">📖 Math lessons</Link> — rules, formulas and theorems in plain words, with a quiz for 💎.
        </p>
        {person?.is_parent && <Link to="/learning/settings">⚙️ Grades & tokens</Link>}
      </section>
    </div>
  );
}

function MathRound({
  round,
  gradeName,
  actingId,
  startAnswers = [],
  onProgress,
  onDone,
  onQuit,
}: {
  round: Start;
  gradeName: string;
  actingId?: string;
  /** 💾 carrying on: the answers already checked (it starts at the next problem) */
  startAnswers?: string[];
  onProgress?: (answers: string[]) => void;
  onDone: (answers: string[]) => void;
  onQuit: () => void;
}) {
  const [i, setI] = useState(() => Math.min(startAnswers.length, round.problems.length - 1));
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answers = useRef<string[]>([...startAnswers]);
  const input = useRef<HTMLInputElement>(null);
  const p = round.problems[i];

  useEffect(() => {
    setTyped('');
    setChecked(null);
    input.current?.focus();
  }, [i]);

  const check = async (answer: string) => {
    if (checked) return;
    setError(null);
    answers.current[i] = answer;
    try {
      setChecked(await api.post<Checked>(`/learning/round/${round.round_id}/check`, { index: i, answer, acting_member_id: actingId }));
      onProgress?.(round.problems.slice(0, i + 1).map((_, k) => answers.current[k] ?? ''));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const next = () => {
    if (i + 1 >= round.problems.length) onDone(round.problems.map((_, k) => answers.current[k] ?? ''));
    else setI(i + 1);
  };

  return (
    <div className="learning-page">
      <section className="panel tap-round">
        <div className="spelling-round__top">
          <span>
            ➗ {gradeName} · <strong>{i + 1}</strong> of {round.problems.length} · <span className="hint">{p.topic}</span>
          </span>
          <button type="button" className="link-button" onClick={onQuit}>
            ✕ Stop
          </button>
        </div>
        <div className="math-q">{p.q}</div>
        {p.note && <p className="hint">{p.note}</p>}
        {!checked ? (
          p.choices ? (
            <div className="math-choices">
              {p.choices.map((c) => (
                <button key={c} type="button" className="secondary" onClick={() => void check(c)}>
                  {c}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="spelling-round__form"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.trim()) void check(typed.trim());
              }}
            >
              <input
                ref={input}
                className="spelling-round__input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                inputMode="text"
                aria-label="Your answer"
                placeholder="Answer…"
                maxLength={30}
              />
              <button type="submit">✓ Check</button>
            </form>
          )
        ) : (
          <div className={`spelling-round__shown ${checked.ok ? 'is-ok' : 'is-wrong'}`}>
            <div className="spelling-round__verdict">{checked.ok ? '✅ Right!' : '❌ Not quite'}</div>
            <div className="spelling-round__word">{checked.right}</div>
            {!checked.ok && <div className="hint">You said: {checked.given}</div>}
            <p className="tap-tip">💡 {checked.hint}</p>
            <button type="button" onClick={next} autoFocus>
              {i + 1 >= round.problems.length ? 'See how I did ›' : 'Next ›'}
            </button>
          </div>
        )}
        {error && <div className="settings-login__error">{error}</div>}
      </section>
    </div>
  );
}
