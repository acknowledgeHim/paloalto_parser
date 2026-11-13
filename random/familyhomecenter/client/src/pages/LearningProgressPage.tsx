import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { GRADE_SHORT } from '../utils/learning.js';
import { LEVELS } from '../utils/typing.js';
import { RoundBar, type RoundInfo } from './LessonsPage.js';

/**
 * 📈 Learning progress: for one kid, how far they are in each subject (🔁 this round's lessons at
 * their grade, and every lesson ever), a day-by-day chart, and every lesson with each try they made
 * — when, the score, passed or not, tokens. Plus practice rounds and typing lessons.
 */

type LessonSubject = 'grammar' | 'math' | 'history' | 'science' | 'handson';
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
  practice: Record<PracticeSubject, PracticeRow[]>;
  typing: Array<{ level: number; at: string; wpm: number; accuracy: number; passed: number; tokens: number }>;
  typing_games?: Array<{ mode: string; n: number; best_wpm: number | null; best_score: number | null; last: string; tokens: number | null }>;
  /** 🎯 math topic practice: each topic tried, by grade; and every grade's topics */
  math_topics?: Array<{ grade: number; topic: string; rounds: number; best: number; total: number; last: string; tokens: number; paid: number }>;
  math_grade_topics?: string[][];
}
interface PracticeRow {
  grade: number;
  at: string;
  correct: number;
  total: number;
  tokens: number;
  /** 🎯 a round of just this topic (null = mixed) */
  topic?: string | null;
  /** 🔤 spelling: the words it got wrong */
  missed?: Array<{ right: string; given: string }>;
}
const TYPING_GAMES: Record<string, string> = { balloon: '🎈 Balloons', race: '🏎️ Race', whack: '🔨 Whack', meteor: '☄️ Meteors', tower: '🗼 Tower', snake: '🐍 Snake', story: '📖 Story', daily: '📅 Daily challenge', shop: '🛒 Shop' };

const LESSON_NAMES: Record<LessonSubject, string> = { grammar: '📖 Grammar lessons', math: '📖 Math lessons', history: '🇺🇸 US History', science: '🔬 Science', handson: '🔧 Hands-on' };
const PRACTICE_NAMES: Record<PracticeSubject, string> = { spelling: '🔤 Spelling', spellcheck: '🔍 Spot the misspellings', grammar: '📝 Grammar', math: '➗ Math' };
type Tab = LessonSubject | 'spelling' | 'practice' | 'typing';

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

  return (
    <div className="learning-page progress-page">
      <h1>📈 Learning progress</h1>
      <p className="hint">Every lesson tried and passed, each try (when, the score, tokens), and the 🔁 round at their grade. Tap a lesson to see each try.</p>
      {!activeProfile && <p className="hint">Pick who you are up top first.</p>}
      {choices.length > 1 && (
        <div className="learning-grades" role="radiogroup" aria-label="Whose progress">
          {choices.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={m.id === memberId} className={`learning-grade${m.id === memberId ? ' is-on' : ''}`} onClick={() => setWho(m.id)}>
              <MemberAvatar member={m} size={28} /> {m.name}
            </button>
          ))}
        </div>
      )}
      {memberId && <LearningProgress key={memberId} memberId={memberId} />}
    </div>
  );
}

/** 📈 One kid's learning progress — on the 📈 Progress page and on their profile page (👤 /person/:id). */
export function LearningProgress({ memberId }: { memberId: string }) {
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('math');

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .get<Progress>(`/learning/progress/${memberId}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [memberId]);

  if (error) return <div className="settings-login__error">{error}</div>;
  if (!data) return <p className="hint">Loading…</p>;
  return (
    <div className="progress-view">
      {data.member.grade === null && !data.member.is_parent && <p className="hint">No school grade set yet — a parent sets it in 📚 Learning → ⚙️ Grades & tokens.</p>}
      <Summary data={data} onPick={setTab} />
      <div className="learning-grades progress-tabs" role="tablist" aria-label="Subject">
        {(['math', 'grammar', 'science', 'history', 'handson', 'spelling', 'typing', 'practice'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`learning-grade${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>
            {t === 'practice' ? '🎯 Other practice' : t === 'typing' ? '⌨️ Typing' : t === 'spelling' ? '🔤 Spelling' : LESSON_NAMES[t]}
          </button>
        ))}
      </div>
      {tab === 'practice' ? (
        <PracticeView data={data} />
      ) : tab === 'typing' ? (
        <TypingView data={data} />
      ) : tab === 'spelling' ? (
        <SpellingView data={data} />
      ) : (
        <LessonSubjectView key={tab} data={data} subject={tab} />
      )}
    </div>
  );
}

/** One line per subject: this round at their grade, and all the lessons at their grade ever passed. */
function Summary({ data, onPick }: { data: Progress; onPick: (t: Tab) => void }) {
  const g = data.member.grade;
  return (
    <section className="panel progress-summary">
      {(['math', 'grammar', 'science', 'history', 'handson'] as LessonSubject[]).map((s) => {
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
      <SpellingSummary data={data} onPick={() => onPick('spelling')} />
      <TypingSummary data={data} onPick={() => onPick('typing')} />
    </section>
  );
}

/** 🔤 rounds at their grade, how right lately, and the last week */
function SpellingSummary({ data, onPick }: { data: Progress; onPick: () => void }) {
  const rows = data.practice.spelling;
  const last = rows.slice(0, 10);
  const avg = last.length ? Math.round((last.reduce((a, r) => a + r.correct / r.total, 0) / last.length) * 100) : null;
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const week = rows.filter((r) => r.at >= weekAgo).length;
  return (
    <button type="button" className="progress-summary__row" onClick={onPick}>
      <span className="progress-summary__name">🔤 Spelling</span>
      {rows.length ? (
        <>
          <span>
            <strong>{rows.length}</strong> round{rows.length === 1 ? '' : 's'} · last {last.length}: <strong>{avg}%</strong> right · {week} this week
          </span>
          <div className="progress-bar" aria-hidden="true">
            <span className="progress-bar__fill is-ok" style={{ width: `${avg ?? 0}%`, display: 'block' }} />
          </div>
        </>
      ) : (
        <span className="hint">no spelling rounds yet</span>
      )}
    </button>
  );
}

/** ⌨️ lessons passed of 16, best speed */
function TypingSummary({ data, onPick }: { data: Progress; onPick: () => void }) {
  const passed = new Set(data.typing.filter((t) => t.passed).map((t) => t.level)).size;
  const best = data.typing.filter((t) => t.passed).reduce((m, t) => Math.max(m, t.wpm), 0);
  const games = (data.typing_games ?? []).reduce((a, g) => a + g.n, 0);
  return (
    <button type="button" className="progress-summary__row" onClick={onPick}>
      <span className="progress-summary__name">⌨️ Typing</span>
      <span>
        <strong>{passed}</strong> of {LEVELS.length} lessons passed{best ? ` · best ${best} wpm` : ''}
        {games ? ` · ${games} game${games === 1 ? '' : 's'} played` : ''}
      </span>
      <div className="progress-bar" aria-hidden="true">
        <span className="progress-bar__fill is-ok" style={{ width: `${(passed / LEVELS.length) * 100}%`, display: 'block' }} />
      </div>
    </button>
  );
}

/** 🔤 Spelling: every round (grade, score, tokens, the words missed) and the words to practise. */
function SpellingView({ data }: { data: Progress }) {
  const rows = data.practice.spelling;
  const [open, setOpen] = useState<number | null>(null);
  const byGrade = new Map<number, PracticeRow[]>();
  for (const r of rows) byGrade.set(r.grade, [...(byGrade.get(r.grade) ?? []), r]);
  // Words missed, most often first, with the last time (rows are newest first).
  const missed = new Map<string, { n: number; last: string; tries: string[] }>();
  for (const r of rows)
    for (const w of r.missed ?? []) {
      const k = w.right;
      const m = missed.get(k) ?? { n: 0, last: r.at, tries: [] };
      m.n++;
      if (w.given && m.tries.length < 3 && !m.tries.includes(w.given)) m.tries.push(w.given);
      missed.set(k, m);
    }
  const words = [...missed].sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last));
  const last = rows.slice(0, 30).reverse();
  return (
    <section className="panel">
      <DayChart points={rows.map((r) => ({ at: r.at, ok: r.tokens > 0 || r.correct / r.total >= 0.8 }))} label="🔤 Spelling rounds" />
      <p className="hint">Green = a round that earned tokens or got 80%+ right.</p>
      {last.length > 0 && (
        <>
          <p className="progress-count">% right, the last {last.length} rounds:</p>
          <div className="progress-spark" role="img" aria-label={`Spelling: % right in the last ${last.length} rounds`}>
            {last.map((r, i) => (
              <span key={i} className={r.tokens > 0 ? 'is-ok' : ''} style={{ height: `${Math.max(4, (r.correct / r.total) * 100)}%` }} title={`${when(r.at)} · ${GRADE_SHORT[r.grade]} · ${r.correct}/${r.total}`} />
            ))}
          </div>
        </>
      )}
      {byGrade.size > 0 && (
        <table className="progress-table">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Rounds</th>
              <th>Words right</th>
              <th>Best</th>
              <th>Last</th>
            </tr>
          </thead>
          <tbody>
            {[...byGrade].sort((a, b) => a[0] - b[0]).map(([g, rs]) => {
              const right = rs.reduce((a, r) => a + r.correct, 0);
              const all = rs.reduce((a, r) => a + r.total, 0);
              return (
                <tr key={g}>
                  <td>{data.grades[g]}</td>
                  <td>{rs.length}</td>
                  <td>
                    {Math.round((right / all) * 100)}% ({right}/{all})
                  </td>
                  <td>{Math.max(...rs.map((r) => r.correct))}/10</td>
                  <td>{when(rs[0].at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <h3 className="progress-topic">📝 Words to practise</h3>
      {words.length ? (
        <ul className="progress-words">
          {words.slice(0, 60).map(([w, m]) => (
            <li key={w} title={`last missed ${when(m.last)}`}>
              <strong>{w}</strong>
              {m.n > 1 && <span className="hint"> ×{m.n}</span>}
              {m.tries.length > 0 && <span className="hint"> (wrote {m.tries.join(', ')})</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{rows.length ? 'No words missed — every word right!' : 'No spelling rounds yet.'}</p>
      )}
      <h3 className="progress-topic">Every round</h3>
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
            <Fragment key={i}>
              <tr className={`progress-row${r.missed?.length ? ' is-tried' : ''}`} onClick={() => r.missed?.length && setOpen(open === i ? null : i)}>
                <td>
                  {r.missed?.length ? (open === i ? '▾ ' : '▸ ') : ''}
                  {when(r.at)}
                </td>
                <td>{data.grades[r.grade]}</td>
                <td>
                  {r.correct}/{r.total}
                </td>
                <td>{r.tokens ? `+${r.tokens} 💎` : ''}</td>
              </tr>
              {open === i && (
                <tr className="progress-history">
                  <td colSpan={4}>
                    Missed: {(r.missed ?? []).map((w) => `${w.right}${w.given ? ` (wrote "${w.given}")` : ''}`).join(', ')}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
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
  const subjects = (Object.keys(PRACTICE_NAMES) as PracticeSubject[]).filter((s) => s !== 'spelling');
  const all = subjects.flatMap((s) => data.practice[s].map((r) => ({ at: r.at, ok: r.tokens > 0 || r.correct / r.total >= 0.8 })));
  return (
    <section className="panel">
      <DayChart points={all} label="🎯 Misspellings, grammar and math practice" />
      <p className="hint">Green = a round that earned tokens or got 80%+ right.</p>
      {subjects.map((s) => {
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
                    {s === 'math' && <th>Topic</th>}
                    <th>Score</th>
                    <th>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{when(r.at)}</td>
                      <td>{data.grades[r.grade]}</td>
                      {s === 'math' && <td>{r.topic ? `🎯 ${r.topic}` : 'mixed'}</td>}
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
      <MathTopicsView data={data} />
    </section>
  );
}

/** 🎯 Math topic practice: every topic at their grade (tried or not), then other grades they tried. */
function MathTopicsView({ data }: { data: Progress }) {
  const rows = data.math_topics ?? [];
  const g = data.member.grade;
  const mine = g !== null ? (data.math_grade_topics?.[g] ?? []) : [];
  if (!rows.length && !mine.length) return null;
  const at = (grade: number, topic: string) => rows.find((r) => r.grade === grade && r.topic === topic);
  const list = [
    ...mine.map((topic) => ({ grade: g as number, topic, r: at(g as number, topic) })),
    ...rows.filter((r) => r.grade !== g || !mine.includes(r.topic)).map((r) => ({ grade: r.grade, topic: r.topic, r })),
  ];
  const tried = mine.filter((t) => at(g as number, t)).length;
  return (
    <>
      <h3 className="progress-topic">🎯 Math topics</h3>
      {g !== null && mine.length > 0 && (
        <p className="hint">
          {tried} of {mine.length} {data.grades[g]} topics practised on their own.
        </p>
      )}
      <table className="progress-table">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Grade</th>
            <th>Rounds</th>
            <th>Best</th>
            <th>Tokens</th>
            <th>Last</th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ grade, topic, r }) => (
            <tr key={`${grade}|${topic}`}>
              <td>{topic}</td>
              <td>{GRADE_SHORT[grade]}</td>
              <td>{r?.rounds ?? '—'}</td>
              <td>{r ? `${r.best}/${r.total}` : ''}</td>
              <td>{r?.tokens ? `+${r.tokens} 💎` : ''}</td>
              <td>{r ? when(r.last) : 'not yet'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** ⌨️ Typing lessons, in order: tried / passed, best speed, and each try. */
function TypingView({ data }: { data: Progress }) {
  const games = data.typing_games ?? [];
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
      {games.length > 0 && (
        <>
          <h3 className="progress-topic">🎮 Typing games</h3>
          <table className="progress-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Played</th>
                <th>Best</th>
                <th>Tokens</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.mode}>
                  <td>{TYPING_GAMES[g.mode] ?? g.mode}</td>
                  <td>{g.n}×</td>
                  <td>{g.best_score ? `${g.best_score} pts` : g.best_wpm ? `${g.best_wpm} wpm` : ''}</td>
                  <td>{g.tokens ? `+${g.tokens} 💎` : ''}</td>
                  <td>{when(g.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
