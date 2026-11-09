import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { type LearningSettings, type SubjectRewards } from '../utils/learning.js';
import { say } from '../utils/speech.js';

/** Names for each subject's settings. Subjects without an entry show by their id. */
export const SUBJECT_LABELS: Record<string, string> = {
  spelling: '🔤 Spelling',
  spellcheck: '🔍 Spot the misspellings',
  grammar: '📝 Grammar',
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
  const [grades, setGrades] = useState<Record<string, number | null>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    api.get<LearningSettings>('/learning/settings').then((s) => {
      setSettings(s);
      setDraft(s.rewards);
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
      const s = await api.put<LearningSettings>('/learning/settings', { rewards: draft });
      setSettings(s);
      setDraft(s.rewards);
      setStatus('Saved ✓');
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  const upd = (subject: string, patch: Partial<SubjectRewards>) => setDraft({ ...draft, [subject]: { ...draft[subject], ...patch } });

  return (
    <div className="learning-page">
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
          </section>
        );
      })}
      <div className="typing-stars__actions">
        <button type="button" onClick={() => void save()}>
          Save tokens
        </button>
        {status && <span className="hint">{status}</span>}
      </div>

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
