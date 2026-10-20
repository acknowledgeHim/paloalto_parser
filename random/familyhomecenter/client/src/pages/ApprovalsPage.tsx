import { useEffect, useState } from 'react';
import { api, type PendingJob, type PendingPrizeClaim } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { taskIcon } from '../utils/taskIcons.js';
import { prizeEmoji, prizeRewardLabel, taskRewardEmoji, taskRewardText } from '../utils/prizes.js';
import { formatHours, formatMinutes } from '../utils/tasks.js';
import { timeOfDayLabel } from '../utils/timeOfDay.js';

interface Approvals {
  jobs: PendingJob[];
  prizes: PendingPrizeClaim[];
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * ✅ To approve (parents): what the kids checked off that needs a parent's OK, and prizes they've
 * claimed that do — a quick ✓ Yes / ✗ No for each, grouped by kid.
 */
export function ApprovalsPage() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [data, setData] = useState<Approvals | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<Approvals>('/approvals').then(setData).catch((e) => setError((e as Error).message));
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const decide = async (kind: 'job' | 'chunk' | 'prize', id: string, ok: boolean) => {
    setBusy(id);
    setError(null);
    try {
      setData(await api.post<Approvals>(`/approvals/${kind}/${id}`, { ok, acting_member_id: activeProfile?.id ?? null }));
      window.dispatchEvent(new Event('approvals-changed'));
    } catch (e) {
      setError((e as Error).message);
      load();
    } finally {
      setBusy(null);
    }
  };

  if (!isParent) return <div className="empty-state">Pick a parent up top to approve what the kids have done.</div>;
  if (!data) return <div className="empty-state">Loading…</div>;

  const people = members.filter((m) => data.jobs.some((j) => j.family_member_id === m.id) || data.prizes.some((p) => p.family_member_id === m.id));
  const total = data.jobs.length + data.prizes.length;

  return (
    <div className="approvals-page">
      <h1>✅ To approve</h1>
      {error && <div className="settings-login__error">{error}</div>}
      {total === 0 && <div className="empty-state">All caught up — nothing waiting for an OK. 🎉</div>}
      {people.map((m) => {
        const jobs = data.jobs.filter((j) => j.family_member_id === m.id);
        const prizes = data.prizes.filter((p) => p.family_member_id === m.id);
        const yesAll = async () => {
          for (const j of jobs) await decide(j.chunk != null ? 'chunk' : 'job', j.id, true);
          for (const p of prizes) await decide('prize', p.id, true);
        };
        return (
          <section key={m.id} className="panel approvals-page__person" style={{ borderTopColor: m.color }}>
            <div className="approvals-page__head">
              <MemberAvatar member={m} size={36} />
              <h2>{m.name}</h2>
              <span className="hint">{jobs.length + prizes.length} waiting</span>
              {jobs.length + prizes.length > 1 && (
                <button type="button" className="secondary" onClick={yesAll} disabled={busy !== null}>
                  ✓ Yes to all
                </button>
              )}
            </div>
            {jobs.map((j) => (
              <div key={j.id} className="approvals-page__item">
                <span className="approvals-page__icon" aria-hidden="true">{taskIcon(j)}</span>
                <div className="approvals-page__what">
                  <strong>
                    {j.title}
                    {j.chunk != null && (j.goal_type === 'hours' ? ` · ${formatMinutes(j.chunk)}` : ` · ${j.chunk} time${j.chunk === 1 ? '' : 's'}${j.goal_minutes ? ` (${formatMinutes(j.chunk * j.goal_minutes)})` : ''}`)}
                  </strong>
                  <div className="hint">
                    {j.kind === 'chore' ? 'Chore' : 'To-do'} · done {when(j.created_at)}
                    {j.time_of_day ? ` · ${timeOfDayLabel(j.time_of_day)}` : ''}
                    {j.chunk == null && j.goal_type === 'hours' && j.goal_amount ? ` · all ${formatHours(j.goal_amount)} h` : ''}
                    {j.chunk == null && j.goal_type === 'times' && j.goal_amount ? ` · all ${j.goal_amount} times` : ''}
                    {j.chunk != null && j.goal_type === 'hours' && j.goal_amount ? ` · of ${formatHours(j.goal_amount)} h` : ''}
                    {j.chunk != null && j.goal_type === 'times' && j.goal_amount ? ` · of ${j.goal_amount} times` : ''}
                    {taskRewardText(j) ? ` · pays ${taskRewardEmoji(j)} ${taskRewardText(j)}` : ''}
                  </div>
                </div>
                <div className="approvals-page__buttons">
                  <button type="button" className="approvals-page__yes" onClick={() => decide(j.chunk != null ? 'chunk' : 'job', j.id, true)} disabled={busy === j.id}>
                    ✓ Yes
                  </button>
                  <button type="button" className="secondary approvals-page__no" onClick={() => decide(j.chunk != null ? 'chunk' : 'job', j.id, false)} disabled={busy === j.id}>
                    ✗ No
                  </button>
                </div>
              </div>
            ))}
            {prizes.map((p) => (
              <div key={p.id} className="approvals-page__item">
                <span className="approvals-page__icon" aria-hidden="true">{prizeEmoji(p)}</span>
                <div className="approvals-page__what">
                  <strong>Prize: {p.title}</strong>
                  <div className="hint">
                    claimed {when(p.redeemed_at)}
                    {p.cost_type === 'stars' && p.star_cost ? ` · ${p.star_cost} ⭐ held` : ''}
                    {prizeRewardLabel(p) ? ` · pays ${prizeRewardLabel(p)}` : ''}
                  </div>
                </div>
                <div className="approvals-page__buttons">
                  <button type="button" className="approvals-page__yes" onClick={() => decide('prize', p.id, true)} disabled={busy === p.id}>
                    ✓ Yes
                  </button>
                  <button type="button" className="secondary approvals-page__no" onClick={() => decide('prize', p.id, false)} disabled={busy === p.id}>
                    ✗ No
                  </button>
                </div>
              </div>
            ))}
          </section>
        );
      })}
      {total > 0 && (
        <p className="hint">
          ✓ Yes: it counts as done (and pays its reward). ✗ No: it goes back to not done for them to finish — for a chunk of an
          hours or times job, just that chunk comes off. A prize ✗ No gives back any stars it cost.
        </p>
      )}
    </div>
  );
}
