import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { DailyLimitSettings } from '../components/DailyLimitSettings.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useCollapsibleSections } from '../hooks/useCollapsibleSections.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { type LearningBonus, type LearningSettings, type SubjectRewards } from '../utils/learning.js';
import { say } from '../utils/speech.js';

/** Names for each subject's settings. Subjects without an entry show by their id. */
export const SUBJECT_LABELS: Record<string, string> = {
  spelling: '🔤 Spelling',
  spellcheck: '🔍 Spot the misspellings',
  grammar: '📝 Grammar',
  math: '➗ Math',
};

/**
 * 📚 Learning → ⚙️ Grades & tokens (parents): each kid's school grade, and for each game the
 * "% right → 💎 tokens" levels (the lowest is the pass mark) and how many rounds a day can pay.
 */
export function LearningSettingsPage() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const kids = members.filter((m) => m.is_parent !== 1);
  const [settings, setSettings] = useState<LearningSettings | null>(null);
  const [draft, setDraft] = useState<Record<string, SubjectRewards> | null>(null);
  const [bonus, setBonus] = useState<LearningBonus>({ tokens: 0, subjects: ['spelling', 'grammar', 'math'] });
  const [grades, setGrades] = useState<Record<string, number | null>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null | undefined>(undefined);
  // Every section folds down to its heading (tap to open); which are open is remembered.
  const [pageEl, setPageEl] = useState<HTMLDivElement | null>(null);
  useCollapsibleSections(pageEl, 'familyhomecenter.learning-settings.open');

  useEffect(() => {
    api.get<LearningSettings>('/learning/settings').then((s) => {
      setSettings(s);
      setDraft(s.rewards);
      if (s.bonus) setBonus(s.bonus);
    });
    api.get<{ engine: string | null }>('/learning/speech').then((x) => setEngine(x.engine)).catch(() => setEngine(null));
  }, []);
  useEffect(() => {
    Promise.all(kids.map((k) => api.get<{ grade: number | null }>(`/learning/people/${k.id}`).then((p) => [k.id, p.grade] as const))).then((all) =>
      setGrades(Object.fromEntries(all))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  if (!isParent) return <div className="panel">Only a parent can change these.</div>;
  if (!settings || !draft) return <p>Loading…</p>;

  const setGrade = async (id: string, g: number) => {
    setStatus(null);
    try {
      const r = await api.put<{ grade: number }>(`/learning/people/${id}/grade`, { grade: g, acting_member_id: activeProfile?.id ?? null });
      setGrades((x) => ({ ...x, [id]: r.grade }));
      setStatus('Saved ✓');
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  const save = async () => {
    setStatus('Saving…');
    try {
      const s = await api.put<LearningSettings>('/learning/settings', { rewards: draft, bonus, acting_member_id: activeProfile?.id ?? null });
      setSettings(s);
      setDraft(s.rewards);
      if (s.bonus) setBonus(s.bonus);
      setStatus('Saved ✓');
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  const upd = (subject: string, patch: Partial<SubjectRewards>) => setDraft({ ...draft, [subject]: { ...draft[subject], ...patch } });

  return (
    <div className="learning-page" ref={setPageEl}>
      <h1>📚 Learning · ⚙️ Grades & tokens</h1>

      <section className="panel">
        <h2>🎒 Each kid's grade</h2>
        <p className="hint">They can practise any grade. Only their own grade or higher earns 💎 tokens.</p>
        {kids.map((k) => (
          <div key={k.id} className="learning-settings__kid">
            <span>
              <MemberAvatar member={k} size={28} /> {k.name}
            </span>
            <select value={grades[k.id] ?? ''} onChange={(e) => void setGrade(k.id, Number(e.target.value))}>
              {grades[k.id] == null && <option value="">— pick a grade —</option>}
              {settings.grades.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        ))}
        {!kids.length && <p className="hint">No kids in the family yet.</p>}
      </section>

      {Object.keys(draft).map((subject) => {
        const r = draft[subject];
        return (
          <section key={subject} className="panel">
            <h2>{SUBJECT_LABELS[subject] ?? subject} — 💎 tokens</h2>
            <p className="hint">
              A round is 10 items. Tokens for the % right: the highest level reached pays. The lowest level is the pass mark.
            </p>
            {r.tiers.map((t, i) => (
              <div key={i} className="typing-speed-stars__row">
                <select
                  value={t.pct}
                  aria-label="Percent right"
                  onChange={(e) => upd(subject, { tiers: r.tiers.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)) })}
                >
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => (
                    <option key={p} value={p}>
                      {p}% right ({p / 10} of 10)
                    </option>
                  ))}
                </select>
                <span>=</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={t.tokens}
                  aria-label="Tokens"
                  onChange={(e) => upd(subject, { tiers: r.tiers.map((x, j) => (j === i ? { ...x, tokens: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x)) })}
                />
                <span>💎</span>
                <button type="button" className="link-button" onClick={() => upd(subject, { tiers: r.tiers.filter((_, j) => j !== i) })}>
                  ✕ remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const last = r.tiers[r.tiers.length - 1];
                upd(subject, { tiers: [...r.tiers, { pct: Math.min(100, (last?.pct ?? 60) + 10), tokens: (last?.tokens ?? 0) + 1 }] });
              }}
            >
              + Add a level
            </button>
            <label className="learning-settings__perday">
              Rounds a day that can pay tokens:{' '}
              <input type="number" min={0} max={100} value={r.per_day} onChange={(e) => upd(subject, { per_day: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
            </label>
            {subject === 'math' && (
              <label className="learning-settings__perday">
                🎯 Each topic pays (per 🔁 lap):{' '}
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={r.topic_pay_times ?? 1}
                  onChange={(e) => upd(subject, { topic_pay_times: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                />{' '}
                time{(r.topic_pay_times ?? 1) === 1 ? '' : 's'}
                <span className="hint">
                  {' '}
                  — 🎯 topic rounds (just Fractions, say) pay by the levels above, but not by the day: each topic pays this many times, then again once the kid has earned every
                  topic at their grade (a new 🔁 lap). They don't count toward the rounds a day or the 🎁 bonus.
                </span>
              </label>
            )}
          </section>
        );
      })}
      <section className="panel">
        <h2>🎁 Daily bonus</h2>
        <p className="hint">
          Extra 💎 once a day for a kid who earns all of the day's tokens (every paying round) in each subject ticked here. 0 = no bonus. A ticked subject set to pay
          nothing is left out.
        </p>
        <label className="learning-settings__perday">
          Bonus:{' '}
          <input type="number" min={0} max={1000} value={bonus.tokens} onChange={(e) => setBonus({ ...bonus, tokens: Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0))) })} /> 💎
        </label>
        <div>
          {Object.keys(draft).map((subject) => (
            <label key={subject} className="learning-settings__perday">
              <input
                type="checkbox"
                checked={bonus.subjects.includes(subject)}
                onChange={(e) => setBonus({ ...bonus, subjects: e.target.checked ? [...bonus.subjects, subject] : bonus.subjects.filter((x) => x !== subject) })}
              />{' '}
              {SUBJECT_LABELS[subject] ?? subject}
              {draft[subject].per_day ? ` (${draft[subject].per_day} round${draft[subject].per_day === 1 ? '' : 's'})` : ' (pays nothing)'}
            </label>
          ))}
        </div>
      </section>
      <div className="typing-stars__actions">
        <button type="button" onClick={() => void save()}>
          Save tokens
        </button>
        {status && <span className="hint">{status}</span>}
      </div>

      <LessonTokenSettings />

      <DailyLimitSettings />

      <section className="panel">
        <h2>🗣️ Speaking the words</h2>
        <p className="hint">
          Phones, tablets and most computers speak with their own voice. Screens without one (Chromium on the Pi, often) use the Family Home Center's voice:{' '}
          {engine === undefined ? 'checking…' : engine ? `✅ installed (${engine === 'pico' ? 'Pico' : 'eSpeak'}).` : '❌ not installed.'}
        </p>
        {engine === null && (
          <p className="hint">
            Install on the Family Home Center: <code>sudo apt install -y libttspico-utils</code> (a nicer voice) or <code>sudo apt install -y espeak-ng</code>, then restart it.
          </p>
        )}
        <button type="button" className="secondary" onClick={() => void say(['Hello!', 'This is how the spelling words will sound.']).catch((e) => setStatus((e as Error).message))}>
          🔊 Test the voice on this screen
        </button>
      </section>
    </div>
  );
}

type LessonSubject = 'grammar' | 'math' | 'history' | 'science';
const LESSON_LABELS: Record<LessonSubject, string> = { grammar: '📖 Grammar lessons', math: '📖 Math lessons', history: '🇺🇸 US History', science: '🔬 Science' };
interface LessonRow {
  id: string;
  grade: number;
  title: string;
  topic: string;
  tokens_set: number | null;
  hidden: boolean;
}

/** 📖 Lessons: tokens for passing each lesson's quiz (the subject's usual amount, or per lesson), and the pass mark. */
function LessonTokenSettings() {
  const { activeProfile } = useFamilyMembers();
  const [settings, setSettings] = useState<Record<LessonSubject, { tokens: number; pass_pct: number }> | null>(null);
  const [lessons, setLessons] = useState<Record<string, LessonRow[]>>({});
  const [grades, setGrades] = useState<string[]>([]);
  const [changed, setChanged] = useState<Record<string, number | null>>({});
  const [status, setStatus] = useState<string | null>(null);

  const load = () => {
    api.get<Record<LessonSubject, { tokens: number; pass_pct: number }>>('/learning/lessons/settings').then(setSettings).catch(() => {});
    for (const s of Object.keys(LESSON_LABELS))
      api
        .get<{ grades: string[]; lessons: LessonRow[] }>(`/learning/lessons?subject=${s}&all=1`)
        .then((r) => {
          setGrades(r.grades);
          setLessons((x) => ({ ...x, [s]: r.lessons }));
        })
        .catch(() => {});
  };
  useEffect(load, []);
  if (!settings) return null;

  const save = async () => {
    setStatus('Saving…');
    try {
      await api.put('/learning/lessons/settings', settings);
      for (const [id, tokens] of Object.entries(changed)) await api.put(`/learning/lessons/${id}`, { tokens, acting_member_id: activeProfile?.id ?? null });
      setChanged({});
      load();
      setStatus('Saved ✓');
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  return (
    <section className="panel">
      <h2>📖 Lessons — 💎 tokens</h2>
      <p className="hint">
        Passing a lesson's quiz pays once per lesson, for lessons at the kid's grade or higher. Each lesson pays the usual amount for its subject unless you set
        its own. Edit the lessons themselves (what's read and quizzed) on each lesson page with ✏️ Edit.
      </p>
      {(Object.keys(LESSON_LABELS) as LessonSubject[]).map((s) => (
        <div key={s} className="lesson-settings__subject">
          <h3>{LESSON_LABELS[s]}</h3>
          <label className="learning-settings__perday">
            Usual amount per lesson:
            <input type="number" min={0} max={1000} value={settings[s].tokens} onChange={(e) => setSettings({ ...settings, [s]: { ...settings[s], tokens: Math.max(0, Math.round(Number(e.target.value) || 0)) } })} /> 💎
          </label>
          <label className="learning-settings__perday">
            Pass mark:
            <select value={settings[s].pass_pct} onChange={(e) => setSettings({ ...settings, [s]: { ...settings[s], pass_pct: Number(e.target.value) } })}>
              {[50, 60, 67, 70, 75, 80, 90, 100].map((p) => (
                <option key={p} value={p}>
                  {p}% right
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary>Set a different amount for single lessons ({(lessons[s] ?? []).length})</summary>
            <div className="lesson-settings__list">
              {(lessons[s] ?? []).map((l) => {
                const v = l.id in changed ? changed[l.id] : l.tokens_set;
                return (
                  <div key={l.id} className="lesson-settings__row">
                    <span>
                      <span className="hint">{grades[l.grade]} · </span>
                      {l.title}
                      {l.hidden ? ' 🙈' : ''}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      placeholder={`${settings[s].tokens} (usual)`}
                      value={v ?? ''}
                      aria-label={`Tokens for ${l.title}`}
                      onChange={(e) => setChanged({ ...changed, [l.id]: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    />
                  </div>
                );
              })}
            </div>
            <p className="hint">Leave a box empty to use the usual amount.</p>
          </details>
        </div>
      ))}
      <div className="typing-stars__actions">
        <button type="button" onClick={() => void save()}>
          Save lesson tokens
        </button>
        {status && <span className="hint">{status}</span>}
      </div>
    </section>
  );
}
