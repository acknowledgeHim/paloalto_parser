import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { GRADE_SHORT } from '../utils/learning.js';
import { LEVELS } from '../utils/typing.js';
import { RoundBar, type RoundInfo } from './LessonsPage.js';

/**
 * 📈 Learning progress: for one kid, how far they are in each subject (🔁 this round's lessons at
 * their grade, and every lesson ever), a day-by-day chart, and every lesson with each try they made
 * — when, the score, passed or not, tokens. Plus practice rounds and typing lessons.
 */

type LessonSubject = 'grammar' | 'math' | 'history';
type PracticeSubject = 'spelling' | 'spellcheck' | 'grammar' | 'math';
interface Try {
  at: string;
  correct: number;
  total: number;
  passed: number;
  tokens: number;
}
interface LessonRow {
  id: string;
  grade: number;
  topic: string;
  title: string;
  hidden: boolean;
  tries: Try[];
}
interface RoundFull {
  number: number;
  grade: number;
  started_at: string | null;
  lesson_ids: string[];
  paid_ids: string[];
  passed_today: number;
}
interface Progress {
  member: { id: string; grade: number | null; is_parent: boolean };
  grades: string[];
  lessons: Record<LessonSubject, { round: RoundFull | null; rounds: Array<{ grade: number; lessons: number; at: string }>; lessons: LessonRow[] }>;
  practice: Record<PracticeSubject, Array<{ grade: number; at: string; correct: number; total: number; tokens: number }>>;
  typing: Array<{ level: number; at: string; wpm: number; accuracy: number; passed: number; tokens: number }>;
}

const LESSON_NAMES: Record<LessonSubject, string> = { grammar: '📖 Grammar lessons', math: '📖 Math lessons', history: '🇺🇸 US History' };
const PRACTICE_NAMES: Record<PracticeSubject, string> = { spelling: '🔤 Spelling', spellcheck: '🔍 Spot the misspellings', grammar: '📝 Grammar', math: '➗ Math' };
type Tab = LessonSubject | 'practice' | 'typing';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function LearningProgressPage() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1;
  const kids = members.filter((m) => m.is_parent !== 1);
  // Kids see their own; parents pick any kid.
  const choices = isParent ? kids : activeProfile ? [activeProfile] : [];
  const [who, setWho] = useState<string | null>(null);
  const memberId = who && choices.some((c) => c.id === who) ? who : choices[0]?.id ?? null;
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('math');

  useEffect(() => {
    setData(null);
    setError(null);
    if (!memberId) return;
    api
      .get<Progress>(`/learning/progress/${memberId}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [memberId]);

  return (
    <div className="learning-page progress-page">
      <h1>📈 Learning progress</h1>
      <p className="hint">Every lesson tried and passed, each try (when, the score, tokens), and the 🔁 round at their grade. Tap a lesson to see each try.</p>
      {!activeProfile && <p className="hint">Pick who you are up top first.</p>}
      {choices.length > 1 && (
        <div className="learning-grades" role="radiogroup" aria-label="Whose progress">
          {choices.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={m.id === memberId} className={`learning-grade${m.id === memberId ? ' is-on' : ''}`} onClick={() => setWho(m.id)}>
              {m.avatar && m.avatar !== 'image' ? `${m.avatar} ` : ''}
              {m.name}
            </button>
          ))}
        </div>
      )}
      {error && <div className="settings-login__error">{error}</div>}
      {data && (
        <>
          {data.member.grade === null && !data.member.is_parent && <p className="hint">No school grade set yet — a parent sets it in 📚 Learning → ⚙️ Grades & tokens.</p>}
          <Summary data={data} onPick={setTab} />
          <div className="learning-grades progress-tabs" role="tablist" aria-label="Subject">
            {(['math', 'grammar', 'history', 'practice', 'typing'] as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={`learning-grade${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>
                {t === 'practice' ? '🎯 Practice rounds' : t === 'typing' ? '⌨️ Typing' : LESSON_NAMES[t]}
              </button>
            ))}
          </div>
          {tab === 'practice' ? <PracticeView data={data} /> : tab === 'typing' ? <TypingView data={data} /> : <LessonSubjectView key={tab} data={data} subject={tab} />}
        </>
      )}
    </div>
  );
}

/** One line per subject: this round at their grade, and all the lessons at their grade ever passed. */
function Summary({ data, onPick }: { data: Progress; onPick: (t: Tab) => void }) {
  const g = data.member.grade;
  return (
    <section className="panel progress-summary">
      {(['math', 'grammar', 'history'] as LessonSubject[]).map((s) => {
        const sub = data.lessons[s];
        const atGrade = g === null ? [] : sub.lessons.filter((l) => l.grade === g && !l.hidden);
        const ever = atGrade.filter((l) => l.tries.some((t) => t.passed)).length;
        const r = sub.round;
        return (
          <button key={s} type="button" className="progress-summary__row" onClick={() => onPick(s)}>
            <span className="progress-summary__name">{LESSON_NAMES[s]}</span>
            {r && r.lesson_ids.length > 0 ? (
              <RoundBar round={toRoundInfo(r)} grades={data.grades} />
            ) : (
              <span className="hint">{g === null ? 'no grade set' : 'no lessons with tokens at this grade'}</span>
            )}
            {g !== null && atGrade.length > 0 && (
              <span className="hint">
                Ever passed: {ever} of {atGrade.length} {data.grades[g]} lessons
                {sub.rounds.length ? ` · ${sub.rounds.length} round${sub.rounds.length === 1 ? '' : 's'} finished` : ''}
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
const toRoundInfo = (r: RoundFull): RoundInfo => ({ number: r.number, grade: r.grade, started_at: r.started_at, total: r.lesson_ids.length, paid: r.paid_ids.length, passed_today: r.passed_today });

/** 📊 The last 30 days: tries a day, passed ones and not-yet ones stacked. */
function DayChart({ points, label }: { points: Array<{ at: string; ok: boolean }>; label: string }) {
  const days = useMemo(() => {
    const out: Array<{ key: string; date: Date; ok: number; no: number }> = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      out.push({ key: dayKey(d), date: d, ok: 0, no: 0 });
    }
    const idx = new Map(out.map((d, i) => [d.key, i]));
    for (const p of points) {
      const i = idx.get(dayKey(new Date(p.at)));
      if (i !== undefined) out[i][p.ok ? 'ok' : 'no']++;
    }
    return out;
  }, [points]);
  const max = Math.max(1, ...days.map((d) => d.ok + d.no));
  const W = 600;
  const H = 140;
  const top = 10;
  const bottom = 22;
  const bw = W / days.length;
  const y = (n: number) => ((H - top - bottom) * n) / max;
  const total = days.reduce((a, d) => a + d.ok + d.no, 0);
  return (
    <figure className="progress-chart">
      <figcaption>
        <strong>{label}: the last 30 days</strong>
        <span className="progress-legend">
          <span className="progress-key is-ok" /> passed <span className="progress-key is-no" /> not yet
        </span>
      </figcaption>
      {total === 0 ? (
        <p className="hint">Nothing in the last 30 days.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${total} in the last 30 days`}>
          <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} className="progress-chart__axis" />
          <text x={2} y={top} className="progress-chart__tick">
            {max}
          </text>
          {days.map((d, i) => {
            const x = i * bw + 3;
            const w = bw - 6;
            const hOk = y(d.ok);
            const hNo = y(d.no);
            const base = H - bottom;
            const tip = `${d.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${d.ok} passed, ${d.no} not yet`;
            return (
              <g key={d.key}>
                <title>{tip}</title>
                <rect x={i * bw} y={top} width={bw} height={H - top - bottom} fill="transparent" />
                {d.ok > 0 && <rect x={x} y={base - hOk} width={w} height={hOk} rx={3} className="progress-bar-ok" />}
                {d.no > 0 && <rect x={x} y={base - hOk - hNo - (d.ok ? 2 : 0)} width={w} height={hNo} rx={3} className="progress-bar-no" />}
                {(i % 7 === 2 || i === days.length - 1) && (
                  <text x={i === days.length - 1 ? W - 2 : i * bw + bw / 2} y={H - 6} textAnchor={i === days.length - 1 ? 'end' : 'middle'} className="progress-chart__tick">
                    {i === days.length - 1 ? 'today' : d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </figure>
  );
}

/** Which 🔁 round a try was in (by when the rounds started). */
const roundOf = (at: string, rounds: Array<{ at: string }>) => 1 + rounds.filter((r) => r.at < at).length;

function LessonSubjectView({ data, subject }: { data: Progress; subject: LessonSubject }) {
  const sub = data.lessons[subject];
  const have = [...new Set(sub.lessons.map((l) => l.grade))].sort((a, b) => a - b);
  const g = data.member.grade;
  const [grade, setGrade] = useState<number | 'all'>(g !== null && have.includes(g) ? g : 'all');
  const [open, setOpen] = useState<string | null>(null);
  const shown = sub.lessons.filter((l) => grade === 'all' || l.grade === grade);
  const topics = [...new Set(shown.map((l) => l.topic))];
  const paidNow = new Set(sub.round?.paid_ids ?? []);
  const points = sub.lessons.flatMap((l) => l.tries.map((t) => ({ at: t.at, ok: t.passed === 1 })));
  const tried = shown.filter((l) => l.tries.length).length;
  const passed = shown.filter((l) => l.tries.some((t) => t.passed)).length;
  return (
    <section className="panel">
      <DayChart points={points} label={`${LESSON_NAMES[subject]} tries`} />
      <div className="learning-grades" role="radiogroup" aria-label="Grade">
        <button type="button" role="radio" aria-checked={grade === 'all'} className={`learning-grade${grade === 'all' ? ' is-on' : ''}`} onClick={() => setGrade('all')}>
          All
        </button>
        {have.map((x) => (
          <button key={x} type="button" role="radio" aria-checked={grade === x} title={data.grades[x]} className={`learning-grade${grade === x ? ' is-on' : ''}${g === x ? ' is-mine' : ''}`} onClick={() => setGrade(x)}>
            {GRADE_SHORT[x]}
          </button>
        ))}
      </div>
      <p className="progress-count">
        <strong>{passed}</strong> passed · <strong>{tried - passed}</strong> tried, not passed yet · <strong>{shown.length - tried}</strong> not tried
        {grade !== 'all' ? ` (${data.grades[grade]})` : ''}
      </p>
      <div className="progress-bar progress-bar--split" aria-hidden="true">
        <span className="progress-bar__fill is-ok" style={{ width: `${shown.length ? (passed / shown.length) * 100 : 0}%` }} />
        <span className="progress-bar__fill is-no" style={{ width: `${shown.length ? ((tried - passed) / shown.length) * 100 : 0}%` }} />
      </div>
      {topics.map((t) => (
        <Fragment key={t}>
          <h3 className="progress-topic">{t || 'Lessons'}</h3>
          <table className="progress-table">
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Status</th>
                <th>Tries</th>
                <th>Best</th>
                <th>Last try</th>
              </tr>
            </thead>
            <tbody>
              {shown
                .filter((l) => l.topic === t)
                .map((l) => {
                  const ok = l.tries.some((x) => x.passed);
                  const best = l.tries.reduce<Try | null>((b, x) => (!b || x.correct / x.total > b.correct / b.total ? x : b), null);
                  const isOpen = open === l.id;
                  return (
                    <Fragment key={l.id}>
                      <tr className={`progress-row${l.tries.length ? ' is-tried' : ''}${isOpen ? ' is-open' : ''}`} onClick={() => l.tries.length && setOpen(isOpen ? null : l.id)}>
                        <td>
                          {l.tries.length ? (isOpen ? '▾ ' : '▸ ') : ''}
                          {l.title}
                          {grade === 'all' && <span className="hint"> · {GRADE_SHORT[l.grade]}</span>}
                          {l.hidden && <span className="hint"> · 🙈</span>}
                        </td>
                        <td>
                          {ok ? '✅ Passed' : l.tries.length ? '🟡 Tried' : '⬜ Not tried'}
                          {paidNow.has(l.id) && <span className="hint"> · 💎 this round</span>}
                        </td>
                        <td>{l.tries.length || ''}</td>
                        <td>{best ? `${best.correct}/${best.total}` : ''}</td>
                        <td>{l.tries[0] ? when(l.tries[0].at) : ''}</td>
                      </tr>
                      {isOpen && (
                        <tr className="progress-history">
                          <td colSpan={5}>
                            <ol>
                              {[...l.tries].reverse().map((x, i) => (
                                <li key={i}>
                                  {when(x.at)} — {x.correct}/{x.total} {x.passed ? '✅ passed' : '❌ not yet'}
                                  {x.tokens ? ` · +${x.tokens} 💎` : ''}
                                  {sub.rounds.length ? ` · round ${roundOf(x.at, sub.rounds)}` : ''}
                                </li>
                              ))}
                            </ol>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </Fragment>
      ))}
      {!shown.length && <p className="hint">No lessons here.</p>}
      {sub.rounds.length > 0 && (
        <p className="hint">
          🔁 Rounds finished:{' '}
          {sub.rounds.map((r, i) => (
            <Fragment key={r.at}>
              {i > 0 && ' · '}
              {new Date(r.at).toLocaleDateString()} ({r.lessons} {data.grades[r.grade]} lessons)
            </Fragment>
          ))}
        </p>
      )}
    </section>
  );
}

/** 🎯 Practice rounds (10 random items): % right each time, newest last. */
function PracticeView({ data }: { data: Progress }) {
  const [open, setOpen] = useState<PracticeSubject | null>(null);
  const all = (Object.keys(PRACTICE_NAMES) as PracticeSubject[]).flatMap((s) => data.practice[s].map((r) => ({ at: r.at, ok: r.tokens > 0 || r.correct / r.total >= 0.8 })));
  return (
    <section className="panel">
      <DayChart points={all} label="🎯 Practice rounds" />
      <p className="hint">Green = a round that earned tokens or got 80%+ right.</p>
      {(Object.keys(PRACTICE_NAMES) as PracticeSubject[]).map((s) => {
        const rows = data.practice[s];
        const last = rows.slice(0, 30).reverse();
        const avg = last.length ? Math.round((last.reduce((a, r) => a + r.correct / r.total, 0) / last.length) * 100) : null;
        return (
          <div key={s} className="progress-practice">
            <button type="button" className="link-button progress-practice__head" onClick={() => setOpen(open === s ? null : s)}>
              {open === s ? '▾' : '▸'} {PRACTICE_NAMES[s]} — {rows.length} round{rows.length === 1 ? '' : 's'}
              {avg !== null ? ` · last ${last.length}: ${avg}% right on average` : ''}
            </button>
            {last.length > 0 && (
              <div className="progress-spark" role="img" aria-label={`${PRACTICE_NAMES[s]}: % right in the last ${last.length} rounds`}>
                {last.map((r, i) => (
                  <span
                    key={i}
                    className={r.tokens > 0 ? 'is-ok' : ''}
                    style={{ height: `${Math.max(4, (r.correct / r.total) * 100)}%` }}
                    title={`${when(r.at)} · ${GRADE_SHORT[r.grade]} · ${r.correct}/${r.total}${r.tokens ? ` · +${r.tokens} 💎` : ''}`}
                  />
                ))}
              </div>
            )}
            {open === s && (
              <table className="progress-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Grade</th>
                    <th>Score</th>
                    <th>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{when(r.at)}</td>
                      <td>{data.grades[r.grade]}</td>
                      <td>
                        {r.correct}/{r.total}
                      </td>
                      <td>{r.tokens ? `+${r.tokens} 💎` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** ⌨️ Typing lessons, in order: tried / passed, best speed, and each try. */
function TypingView({ data }: { data: Progress }) {
  const [open, setOpen] = useState<number | null>(null);
  const byLevel = new Map<number, Progress['typing']>();
  for (const t of data.typing) byLevel.set(t.level, [...(byLevel.get(t.level) ?? []), t]);
  const passed = LEVELS.filter((l) => byLevel.get(l.n)?.some((t) => t.passed)).length;
  return (
    <section className="panel">
      <DayChart points={data.typing.map((t) => ({ at: t.at, ok: t.passed === 1 }))} label="⌨️ Typing lesson tries" />
      <p className="progress-count">
        <strong>{passed}</strong> of {LEVELS.length} typing lessons passed
      </p>
      <div className="progress-bar progress-bar--split" aria-hidden="true">
        <span className="progress-bar__fill is-ok" style={{ width: `${(passed / LEVELS.length) * 100}%` }} />
      </div>
      <table className="progress-table">
        <thead>
          <tr>
            <th>Lesson</th>
            <th>Status</th>
            <th>Tries</th>
            <th>Best speed</th>
            <th>Last try</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((l) => {
            const tries = byLevel.get(l.n) ?? [];
            const ok = tries.some((t) => t.passed);
            const isOpen = open === l.n;
            return (
              <Fragment key={l.n}>
                <tr className={`progress-row${tries.length ? ' is-tried' : ''}`} onClick={() => tries.length && setOpen(isOpen ? null : l.n)}>
                  <td>
                    {tries.length ? (isOpen ? '▾ ' : '▸ ') : ''}
                    {l.n}. {l.name}
                  </td>
                  <td>{ok ? '✅ Passed' : tries.length ? '🟡 Tried' : '⬜ Not tried'}</td>
                  <td>{tries.length || ''}</td>
                  <td>{tries.length ? `${Math.max(...tries.map((t) => t.wpm))} wpm` : ''}</td>
                  <td>{tries[0] ? when(tries[0].at) : ''}</td>
                </tr>
                {isOpen && (
                  <tr className="progress-history">
                    <td colSpan={5}>
                      <ol>
                        {[...tries].reverse().map((t, i) => (
                          <li key={i}>
                            {when(t.at)} — {t.wpm} wpm, {t.accuracy}% right {t.passed ? '✅ passed' : '❌ not yet'}
                            {t.tokens ? ` · +${t.tokens} 💎` : ''}
                          </li>
                        ))}
                      </ol>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
