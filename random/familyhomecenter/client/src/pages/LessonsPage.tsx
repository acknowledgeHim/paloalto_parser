import { Fragment, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { LAB_LINE, LABS } from '../labs/catalog.js';
import { useDraft } from '../utils/autosave.js';
import { LimitNote, useActivityClock, useLimit } from '../utils/limits.js';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { GRADE_SHORT } from '../utils/learning.js';

/** 🧪 the science labs load only when a lesson shows one */
const ScienceLab = lazy(() => import('../labs/index.js'));
export function LabSlot({ id }: { id: string }) {
  return (
    <Suspense fallback={<p className="hint">🧪 Loading the lab…</p>}>
      <ScienceLab id={id} />
    </Suspense>
  );
}

type Subject = 'grammar' | 'math' | 'history' | 'science';
interface ListItem {
  id: string;
  grade: number;
  topic: string;
  title: string;
  tokens: number;
  tokens_set: number | null;
  hidden: boolean;
  builtin: boolean;
  questions: number;
  done: { passed: number; best: number; total: number; paid: number } | null;
  /** 🔁 its tokens are already paid this round */
  paid_this_round?: boolean;
  passed_today?: boolean;
  /** 🔁 repeatable lessons pay up to pay_times a round */
  pay_times?: number;
  times_paid?: number;
}
/** 🔁 a kid's round in a subject: every lesson at their grade pays once, then they all pay again */
export interface RoundInfo {
  number: number;
  grade: number;
  started_at: string | null;
  total: number;
  paid: number;
  passed_today: number;
}
interface List {
  settings: { tokens: number; pass_pct: number };
  grades: string[];
  member: { grade: number | null; is_parent: boolean } | null;
  round: RoundInfo | null;
  lessons: ListItem[];
}
interface QuizQ {
  q: string;
  choices: string[];
  answer?: number;
  why?: string;
}
interface Lesson {
  id: string;
  subject: Subject;
  grade: number;
  topic: string;
  title: string;
  body: string;
  tokens: number;
  tokens_set: number | null;
  pay_times?: number;
  hidden: boolean;
  builtin: boolean;
  quiz: QuizQ[];
  no_tokens_why?: string | null;
}
interface QuizResult {
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  pass_pct: number;
  tokens: number;
  no_tokens_why: string | null;
  round: { number: number; total: number; paid: number; new_round: boolean } | null;
  items: Array<{ q: string; choices: string[]; answer: number; given: number | null; ok: boolean; why: string | null }>;
}

export interface LessonsConfig {
  subject: Subject;
  title: string;
  intro: string;
  /** a link to the practice game, if any */
  practice?: { to: string; label: string };
}
export const GRAMMAR_LESSONS: LessonsConfig = {
  subject: 'grammar',
  title: '📖 Grammar lessons',
  intro: 'Each lesson explains a rule in plain words, with examples. Then a short quiz — pass it to earn 💎 tokens.',
  practice: { to: '/grammar', label: '📝 Practise: find the mistakes' },
};
export const MATH_LESSONS: LessonsConfig = {
  subject: 'math',
  title: '📖 Math lessons',
  intro: 'Each lesson explains an idea or rule in plain words, with worked examples. Then a short quiz — pass it to earn 💎 tokens.',
  practice: { to: '/math', label: '➗ Practise: 10 problems' },
};
export const HISTORY_LESSONS: LessonsConfig = {
  subject: 'history',
  title: '🇺🇸 US History',
  intro:
    'The Declaration of Independence, the Constitution, the Revolutionary War, the Civil War, and World Wars I and II. Read the lesson first, then take the quiz to earn 💎 tokens. Higher grades go into more detail.',
};
export const SCIENCE_LESSONS: LessonsConfig = {
  subject: 'science',
  title: '🔬 Science',
  intro:
    '⚡ Physics, 🧪 chemistry, 🧬 biology and 🌍 earth & space. Many lessons have a 🧪 lab to try — play with it, do its 🎯 goals, then take the quiz to earn 💎 tokens.',
  practice: { to: '/science/labs', label: '🧪 All the labs' },
};

/** **bold** inside a line */
function inline(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}
/** The lesson text: "## " headings, "- " bullets, "1. " steps, ✅/❌ examples, paragraphs. */
export function LessonBody({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  return (
    <div className="lesson-body">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        const out: ReactNode[] = [];
        let list: { ordered: boolean; items: string[] } | null = null;
        const flush = () => {
          if (!list) return;
          const items = list.items.map((x, k) => <li key={k}>{inline(x)}</li>);
          out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
          list = null;
        };
        let para: string[] = [];
        const flushPara = () => {
          if (para.length) out.push(<p key={out.length}>{para.map((x, k) => <Fragment key={k}>{k > 0 && <br />}{inline(x)}</Fragment>)}</p>);
          para = [];
        };
        for (const raw of lines) {
          const l = raw.trim();
          const lab = LAB_LINE.exec(l);
          if (lab) {
            flushPara();
            flush();
            out.push(<LabSlot key={out.length} id={lab[1]} />);
            continue;
          }
          const bullet = /^[-•]\s+(.*)$/.exec(l);
          const step = /^\d+\.\s+(.*)$/.exec(l);
          if (l.startsWith('## ')) {
            flushPara();
            flush();
            out.push(<h3 key={out.length}>{inline(l.slice(3))}</h3>);
          } else if (bullet || step) {
            flushPara();
            const ordered = Boolean(step);
            if (list && list.ordered !== ordered) flush();
            list ??= { ordered, items: [] };
            list.items.push((bullet ?? step)![1]);
          } else if (/^(✅|❌)/.test(l)) {
            flushPara();
            flush();
            out.push(
              <div key={out.length} className={`lesson-example ${l.startsWith('✅') ? 'is-ok' : 'is-wrong'}`}>
                {inline(l)}
              </div>
            );
          } else {
            flush();
            para.push(l);
          }
        }
        flushPara();
        flush();
        return <Fragment key={i}>{out}</Fragment>;
      })}
    </div>
  );
}

/** 📖 Lessons for a subject: pick one, read it, take the quiz. Parents can edit, add and hide lessons. */
/** 💾 the lesson someone has open: how far down they'd read, and their quiz answers so far */
interface LessonDraft {
  id: string;
  quiz: boolean;
  picked: Array<number | null>;
  scroll: number;
}

export function LessonsPage({ config }: { config: LessonsConfig }) {
  const { activeProfile } = useFamilyMembers();
  const [list, setList] = useState<List | null>(null);
  const [grade, setGrade] = useState<number | 'all' | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isParent = activeProfile?.is_parent === 1;
  const saved = useDraft<LessonDraft>(activeProfile?.id, `lesson-${config.subject}`);
  // ⏰ a parent's daily limit on lessons: one that's open is always finished
  const activity = `lessons-${config.subject}`;
  const limit = useLimit(activeProfile?.id, activity);
  useActivityClock(activeProfile?.id, activity, open !== null, limit.setStatus);
  const openLesson = async (id: string) => {
    setError(null);
    if (activeProfile && !isParent) {
      try {
        limit.setStatus(await api.post(`/limits/${activeProfile.id}/start`, { activity, acting_member_id: activeProfile.id }));
      } catch (e) {
        setError((e as Error).message);
        void limit.reload();
        return;
      }
    }
    setOpen(id);
  };
  // 💾 Left in the middle of a lesson (closed, or tapped away)? Open it again, once.
  const reopened = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (saved.draft === undefined || reopened.current === activeProfile?.id) return;
    reopened.current = activeProfile?.id;
    if (saved.draft && !open) setOpen(saved.draft.id);
  }, [saved.draft, activeProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => {
    const q = new URLSearchParams({ subject: config.subject });
    if (activeProfile) q.set('member_id', activeProfile.id);
    if (showHidden) q.set('all', '1');
    api
      .get<List>(`/learning/lessons?${q}`)
      .then(setList)
      .catch((e) => setError((e as Error).message));
  };
  useEffect(load, [config.subject, activeProfile?.id, showHidden]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (list && grade === null) setGrade(list.member?.grade != null && !list.member.is_parent ? nearestGrade(list, list.member.grade) : 'all');
  }, [list, grade]);

  if (editing)
    return (
      <LessonEditor
        subject={config.subject}
        id={editing === 'new' ? null : editing}
        grades={list?.grades ?? []}
        defaultTokens={list?.settings.tokens ?? 1}
        onDone={(id) => {
          setEditing(null);
          if (id) setOpen(id);
          load();
        }}
      />
    );
  if (open)
    return (
      <LessonView
        id={open}
        config={config}
        grades={list?.grades ?? []}
        isParent={isParent}
        onEdit={() => setEditing(open)}
        saved={saved.draft?.id === open ? saved.draft : null}
        onSave={(d, now) => (now ? saved.save : saved.saveSoon)(d)}
        onBack={() => {
          saved.save(null);
          setOpen(null);
          load();
          void limit.reload();
        }}
      />
    );

  const grades = [...new Set(list?.lessons.map((l) => l.grade) ?? [])].sort((a, b) => a - b);
  const shown = (list?.lessons ?? []).filter((l) => grade === 'all' || grade === null || l.grade === grade);
  const topics = [...new Set(shown.map((l) => l.topic))];
  return (
    <div className="learning-page">
      <h1>{config.title}</h1>
      <p className="hint">{config.intro}</p>
      {config.practice && (
        <p>
          <Link to={config.practice.to}>{config.practice.label}</Link>
        </p>
      )}
      {error && <div className="settings-login__error">{error}</div>}
      {!error && <LimitNote status={limit.status} />}
      {list && (
        <section className="panel">
          <div className="learning-grades" role="radiogroup" aria-label="Grade">
            <button type="button" role="radio" aria-checked={grade === 'all'} className={`learning-grade${grade === 'all' ? ' is-on' : ''}`} onClick={() => setGrade('all')}>
              All
            </button>
            {grades.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={grade === g}
                title={list.grades[g]}
                className={`learning-grade${grade === g ? ' is-on' : ''}${list.member?.grade === g ? ' is-mine' : ''}`}
                onClick={() => setGrade(g)}
              >
                {GRADE_SHORT[g]}
              </button>
            ))}
          </div>
          {list.member?.grade != null && !list.member.is_parent && (
            <p className="hint">
              Your grade: {list.grades[list.member.grade]}. Lessons at your grade or higher earn 💎 for passing the quiz with {list.settings.pass_pct}% right — once each round. Pass every{' '}
              {list.grades[list.member.grade]} lesson and a new round starts: they all pay again.
            </p>
          )}
          {list.round && list.round.total > 0 && <RoundBar round={list.round} grades={list.grades} />}
          {isParent && (
            <div className="lesson-parent-bar">
              <button type="button" onClick={() => setEditing('new')}>
                ＋ New lesson
              </button>
              <label>
                <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show hidden lessons
              </label>
              <Link to="/learning/settings">⚙️ Tokens & pass mark</Link>
            </div>
          )}
        </section>
      )}
      {topics.map((t) => (
        <section key={t} className="panel">
          <h2>{t || 'Lessons'}</h2>
          <div className="lesson-cards">
            {shown
              .filter((l) => l.topic === t)
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`lesson-card${l.hidden ? ' is-hidden' : ''}${l.done?.passed ? ' is-done' : ''}${l.paid_this_round ? ' is-paid' : ''}`}
                  onClick={() => void openLesson(l.id)}
                >
                  <span className="lesson-card__grade">{list?.grades[l.grade]}</span>
                  <strong>{l.title}</strong>
                  <span className="lesson-card__meta">
                    {l.passed_today ? '✅ Passed today' : l.done?.passed ? '✅ Passed' : l.done ? `Tried · best ${l.done.best}/${l.done.total}` : `${l.questions} question${l.questions === 1 ? '' : 's'}`}
                    {list?.round && l.paid_this_round
                      ? ` · 💎 earned this round${(l.pay_times ?? 1) > 1 ? ` (${l.pay_times}×)` : ''}`
                      : list?.round && (l.pay_times ?? 1) > 1 && l.tokens > 0 && l.grade >= list.round.grade
                        ? ` · 💎 ${l.tokens} · 🔁 ${l.times_paid ?? 0} of ${l.pay_times} times this round`
                      : l.tokens > 0 && (list?.round ? l.grade >= list.round.grade : !l.done?.paid)
                        ? ` · 💎 ${l.tokens}`
                        : ''}
                    {!list?.round && l.done?.paid ? ` · +${l.done.paid} 💎 earned` : ''}
                    {l.hidden ? ' · 🙈 hidden' : ''}
                  </span>
                </button>
              ))}
          </div>
        </section>
      ))}
      {list && !shown.length && <p className="hint">No lessons here yet.</p>}
    </div>
  );
}

/** 🔁 How far along this round is: X of Y lessons at their grade passed for tokens. */
export function RoundBar({ round, grades }: { round: RoundInfo; grades: string[] }) {
  const pct = round.total ? Math.round((round.paid / round.total) * 100) : 0;
  const left = round.total - round.paid;
  return (
    <div className="lesson-round">
      <div className="lesson-round__label">
        <strong>
          🔁 Round {round.number}: {round.paid} of {round.total} {grades[round.grade]} lessons passed
        </strong>
        <span className="hint">
          {left === 0 ? 'all done!' : `${left} to go — then every lesson pays again`}
          {round.passed_today ? ` · ${round.passed_today} passed today` : ''}
        </span>
      </div>
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={round.total} aria-valuenow={round.paid} aria-label={`Round ${round.number}`}>
        <span className="progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The grade with lessons closest to (at or above) theirs. */
function nearestGrade(list: List, g: number): number | 'all' {
  const have = [...new Set(list.lessons.map((l) => l.grade))].sort((a, b) => a - b);
  return have.find((x) => x >= g) ?? have[have.length - 1] ?? 'all';
}

function LessonView({
  id,
  config,
  grades,
  isParent,
  saved,
  onSave,
  onEdit,
  onBack,
}: {
  id: string;
  config: LessonsConfig;
  grades: string[];
  isParent: boolean;
  /** 💾 where they were in this lesson last time */
  saved: LessonDraft | null;
  onSave: (d: LessonDraft | null, now: boolean) => void;
  onEdit: () => void;
  onBack: () => void;
}) {
  const { activeProfile } = useFamilyMembers();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [picked, setPicked] = useState<Array<number | null>>([]);
  const start = useRef(saved);
  const spot = useRef({ quiz: false, picked: [] as Array<number | null> });
  spot.current = { quiz: quizOpen, picked };
  const lastScroll = useRef(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Lesson>(`/learning/lessons/${id}${activeProfile ? `?member_id=${activeProfile.id}` : ''}`)
      .then((l) => {
        setLesson(l);
        const s = start.current;
        start.current = null;
        if (s && s.id === id && s.picked.length === l.quiz.length) {
          // 💾 back where they were: the quiz answers picked, and how far down they'd read
          setPicked(s.picked);
          setQuizOpen(s.quiz);
          lastScroll.current = s.scroll;
          setTimeout(() => window.scrollTo(0, s.scroll), 60);
        } else {
          setPicked(l.quiz.map(() => null));
          onSave({ id, quiz: false, picked: l.quiz.map(() => null), scroll: 0 }, true);
        }
      })
      .catch((e) => setError((e as Error).message));
    window.scrollTo(0, 0);
  }, [id, activeProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 💾 keep their spot: quiz answers straight away, scrolling now and then
  const loaded = lesson !== null;
  useEffect(() => {
    if (!loaded) return;
    onSave({ id, quiz: quizOpen, picked, scroll: lastScroll.current }, true);
  }, [quizOpen, picked]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loaded) return;
    const onScroll = () => {
      lastScroll.current = window.scrollY;
      onSave({ id, ...spot.current, scroll: window.scrollY }, false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loaded, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!activeProfile) return setError('Pick who you are up top first');
    setError(null);
    try {
      setResult(await api.post<QuizResult>(`/learning/lessons/${id}/quiz`, { member_id: activeProfile.id, answers: picked, acting_member_id: activeProfile.id }));
      onSave(null, true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!lesson) return <div className="learning-page">{error ? <div className="settings-login__error">{error}</div> : <p>Loading…</p>}</div>;
  return (
    <div className="learning-page">
      <div className="lesson-top">
        <button type="button" className="link-button" onClick={onBack}>
          ‹ {config.title}
        </button>
        {isParent && (
          <button type="button" className="secondary" onClick={onEdit}>
            ✏️ Edit
          </button>
        )}
      </div>
      <section className="panel">
        <p className="hint">
          {lesson.topic} · {grades[lesson.grade]}
          {lesson.tokens > 0 ? ` · 💎 ${lesson.tokens} for passing${(lesson.pay_times ?? 1) > 1 ? ` · 🔁 up to ${lesson.pay_times}× a round` : ''}` : ''}
          {lesson.hidden ? ' · 🙈 hidden from kids' : ''}
        </p>
        <h1>{lesson.title}</h1>
        <LessonBody text={lesson.body} />
      </section>

      {lesson.quiz.length > 0 && !quizOpen && !result && (
        <section className="panel">
          <p>{lesson.no_tokens_why ? <span className="hint">{lesson.no_tokens_why}</span> : lesson.tokens > 0 ? `Pass the quiz for +${lesson.tokens} 💎` : null}</p>
          <button type="button" className="learning-go" onClick={() => setQuizOpen(true)}>
            📝 Take the quiz ({lesson.quiz.length} question{lesson.quiz.length === 1 ? '' : 's'})
          </button>
        </section>
      )}

      {quizOpen && !result && (
        <section className="panel lesson-quiz">
          <h2>📝 Quiz</h2>
          {lesson.quiz.map((q, i) => (
            <fieldset key={i} className="lesson-quiz__q">
              <legend>
                {i + 1}. {q.q}
              </legend>
              <div className="lesson-quiz__choices">
                {q.choices.map((c, k) => (
                  <label key={k} className={`lesson-quiz__choice${picked[i] === k ? ' is-on' : ''}`}>
                    <input type="radio" name={`q${i}`} checked={picked[i] === k} onChange={() => setPicked((p) => p.map((x, j) => (j === i ? k : x)))} />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {error && <div className="settings-login__error">{error}</div>}
          <button type="button" className="learning-go" disabled={picked.some((x) => x === null)} onClick={() => void submit()}>
            ✓ Check my answers
          </button>
          {picked.some((x) => x === null) && <p className="hint">Answer every question first.</p>}
        </section>
      )}

      {result && (
        <section className="panel learning-result">
          <h2>
            {result.pct === 100 ? '🌟 Perfect!' : result.passed ? '🎉 Passed!' : '💪 Not yet — read it again and retry'} {result.correct} / {result.total} right
          </h2>
          {result.tokens > 0 ? <p className="learning-result__tokens">+{result.tokens} 💎 tokens</p> : result.no_tokens_why ? <p className="hint">{result.no_tokens_why}</p> : null}
          {result.round?.new_round ? (
            <p className="learning-bonus is-done">🎉 You passed every lesson at your grade! Round {result.round.number} starts — every lesson pays 💎 again.</p>
          ) : result.round && result.round.total > 0 ? (
            <p className="hint">
              🔁 Round {result.round.number}: {result.round.paid} of {result.round.total} lessons at your grade done.
            </p>
          ) : null}
          {!result.passed && <p className="hint">Passing needs {result.pass_pct}% right.</p>}
          <ol className="tap-results">
            {result.items.map((it, i) => (
              <li key={i} className={it.ok ? 'is-ok' : 'is-wrong'}>
                <div>{it.q}</div>
                {it.ok ? '✅ ' : '❌ '}
                <strong>{it.choices[it.answer]}</strong>
                {!it.ok && it.given !== null && <span className="hint"> — you picked “{it.choices[it.given]}”</span>}
                {it.why && <div className="tap-tip">💡 {it.why}</div>}
              </li>
            ))}
          </ol>
          <div className="tap-round__actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setResult(null);
                setPicked(lesson.quiz.map(() => null));
                setQuizOpen(false);
                window.scrollTo(0, 0);
              }}
            >
              ↻ Read again / retry
            </button>
            <button type="button" onClick={onBack}>
              Back to lessons ›
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** ✏️ Parents: write or change a lesson — its text and quiz, tokens, and whether kids see it. */
function LessonEditor({ subject, id, grades, defaultTokens, onDone }: { subject: Subject; id: string | null; grades: string[]; defaultTokens: number; onDone: (id: string | null) => void }) {
  const { activeProfile } = useFamilyMembers();
  const [d, setD] = useState<Lesson | null>(
    id
      ? null
      : { id: '', subject, grade: 5, topic: '', title: '', body: '', tokens: defaultTokens, tokens_set: null, hidden: false, builtin: false, quiz: [{ q: '', choices: ['', ''], answer: 0 }] }
  );
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    if (id)
      api
        .get<Lesson>(`/learning/lessons/${id}?edit=1`)
        .then(setD)
        .catch((e) => setStatus((e as Error).message));
  }, [id]);
  if (!d) return <div className="learning-page">{status ?? 'Loading…'}</div>;

  const setQ = (i: number, patch: Partial<QuizQ>) => setD({ ...d, quiz: d.quiz.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const save = async () => {
    setStatus('Saving…');
    const body = {
      grade: d.grade,
      topic: d.topic,
      title: d.title,
      body: d.body,
      tokens: d.tokens_set,
      pay_times: d.pay_times ?? 1,
      hidden: d.hidden,
      quiz: d.quiz.map((q) => ({ ...q, choices: q.choices.filter((c) => c.trim()) })),
      acting_member_id: activeProfile?.id,
    };
    try {
      if (id) {
        await api.put(`/learning/lessons/${id}`, body);
        onDone(id);
      } else {
        const r = await api.post<{ id: string }>('/learning/lessons', { ...body, subject });
        onDone(r.id);
      }
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  return (
    <div className="learning-page">
      <div className="lesson-top">
        <button type="button" className="link-button" onClick={() => onDone(null)}>
          ‹ Cancel
        </button>
      </div>
      <section className="panel lesson-editor">
        <h1>{id ? '✏️ Edit lesson' : '＋ New lesson'}</h1>
        <label>
          Title
          <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={200} />
        </label>
        <div className="lesson-editor__row">
          <label>
            Grade
            <select value={d.grade} onChange={(e) => setD({ ...d, grade: Number(e.target.value) })}>
              {grades.map((g, i) => (
                <option key={i} value={i}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            Topic (groups lessons)
            <input value={d.topic} onChange={(e) => setD({ ...d, topic: e.target.value })} maxLength={100} placeholder="e.g. 🏛️ The Constitution" />
          </label>
        </div>
        <p className="hint">Kids at this grade or lower earn tokens from it; older kids can still read it for practice.</p>
        <label>
          What to read
          <textarea value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} rows={16} />
        </label>
        <p className="hint">
          Write it like a note: <code>## </code> starts a heading, <code>- </code> a bullet, <code>1. </code> a numbered step, <code>**words**</code> bold, ✅ / ❌ a right / wrong example.
          A blank line starts a new paragraph. A line <code>🧪 lab: pendulum</code> puts a science lab in the lesson.
        </p>
        <details>
          <summary>🧪 Labs you can put in a lesson</summary>
          <ul className="hint">
            {LABS.map((l) => (
              <li key={l.id}>
                <code>🧪 lab: {l.id}</code> — {l.name} ({l.about})
              </li>
            ))}
          </ul>
        </details>
        <details>
          <summary>Preview</summary>
          <LessonBody text={d.body} />
        </details>

        <h2>📝 Quiz</h2>
        {d.quiz.map((q, i) => (
          <fieldset key={i} className="lesson-editor__q">
            <legend>Question {i + 1}</legend>
            <input value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} placeholder="The question" maxLength={600} />
            {q.choices.map((c, k) => (
              <div key={k} className="lesson-editor__choice">
                <input type="radio" name={`right${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} aria-label="This is the right answer" title="The right answer" />
                <input value={c} onChange={(e) => setQ(i, { choices: q.choices.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Choice ${k + 1}`} maxLength={300} />
                {q.choices.length > 2 && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setQ(i, { choices: q.choices.filter((_, j) => j !== k), answer: (q.answer ?? 0) === k ? 0 : (q.answer ?? 0) > k ? (q.answer ?? 0) - 1 : q.answer })}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <p className="hint">The dot marks the right answer.</p>
            {q.choices.length < 8 && (
              <button type="button" className="link-button" onClick={() => setQ(i, { choices: [...q.choices, ''] })}>
                + a choice
              </button>
            )}
            <input value={q.why ?? ''} onChange={(e) => setQ(i, { why: e.target.value })} placeholder="Why (shown after answering — optional)" maxLength={600} />
            <button type="button" className="link-button" onClick={() => setD({ ...d, quiz: d.quiz.filter((_, j) => j !== i) })}>
              ✕ Remove this question
            </button>
          </fieldset>
        ))}
        <button type="button" className="secondary" onClick={() => setD({ ...d, quiz: [...d.quiz, { q: '', choices: ['', ''], answer: 0 }] })}>
          + Add a question
        </button>

        <h2>💎 Tokens and who sees it</h2>
        <label className="learning-settings__perday">
          <input type="checkbox" checked={d.tokens_set === null} onChange={(e) => setD({ ...d, tokens_set: e.target.checked ? null : defaultTokens })} /> Use the usual amount ({defaultTokens} 💎)
        </label>
        {d.tokens_set !== null && (
          <label className="learning-settings__perday">
            Passing this lesson pays
            <input type="number" min={0} max={1000} value={d.tokens_set} onChange={(e) => setD({ ...d, tokens_set: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /> 💎
          </label>
        )}
        <label className="learning-settings__perday">
          🔁 Passing pays tokens
          <input
            type="number"
            min={1}
            max={50}
            value={d.pay_times ?? 1}
            onChange={(e) => setD({ ...d, pay_times: Math.min(50, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
            aria-label="Times it pays each round"
          />
          time{(d.pay_times ?? 1) === 1 ? '' : 's'} each round
        </label>
        <p className="hint">
          1 = the usual: once, until every lesson at the kid's grade is passed and a new round starts. More = a repeatable lesson: retaking and passing it pays again, up to that many times a round.
        </p>
        <label className="learning-settings__perday">
          <input type="checkbox" checked={d.hidden} onChange={(e) => setD({ ...d, hidden: e.target.checked })} /> 🙈 Hide from kids (it's kept — un-tick to show it again)
        </label>
        {status && <p className="hint">{status}</p>}
        <div className="tap-round__actions">
          <button type="button" onClick={() => void save()}>
            Save lesson
          </button>
          <button type="button" className="secondary" onClick={() => onDone(null)}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
