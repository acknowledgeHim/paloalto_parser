import { useEffect, useState } from 'react';
import { api, type EarnedReward, type Prize, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { amountLabel, prizeEmoji, prizeRewardLabel, taskRewardEmoji, taskRewardText } from '../utils/prizes.js';
import { formatHours, goalLabel } from '../utils/tasks.js';
import { taskIcon } from '../utils/taskIcons.js';
import { PrizeForm } from '../components/PrizeBankSettings.js';

function prizeCostLabel(prize: Prize, taskTitle: string | undefined): string {
  if (prize.cost_type === 'stars') return `${prize.star_cost} ⭐`;
  if (prize.progress?.parts?.length) return prize.progress.parts.map((p) => `${p.title} ${amountLabel(p.needed, p.unit)}`).join(' + ');
  return `Do "${taskTitle ?? 'a task'}" ${prize.required_count}×`;
}

export function PrizeBankPage() {
  const { activeProfile, members, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  // A parent can look at (and set up) any kid's Prize Bank; everyone else sees their own.
  const [viewId, setViewId] = useState<string | null>(null);
  const viewed =
    (isParent && members.find((m) => m.id === viewId)) ||
    (activeProfile?.is_parent === 1 && members.find((m) => m.is_parent !== 1)) ||
    activeProfile;
  // A prize being added ('new') or changed (its id), parents only.
  const [editing, setEditing] = useState<string | null>(null);
  // What they've earned that isn't money or stars ("Movie time"), until a parent marks it used.
  const [earned, setEarned] = useState<EarnedReward[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tasksById, setTasksById] = useState<Record<string, Task>>({});
  // Today's list (for done / waiting on each job that pays something).
  const [today, setToday] = useState<Task[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    const path = viewed ? `/prizes?family_member_id=${viewed.id}` : '/prizes';
    api.get<Prize[]>(path).then(setPrizes).catch(console.error);
    if (viewed) api.get<EarnedReward[]>(`/prizes/earned?family_member_id=${viewed.id}`).then(setEarned).catch(console.error);
    else setEarned([]);
    api
      .get<Task[]>('/tasks?all=true')
      .then((tasks) => setTasksById(Object.fromEntries(tasks.map((t) => [t.id, t]))))
      .catch(console.error);
    api.get<Task[]>('/tasks').then(setToday).catch(console.error);
  };
  useEffect(load, [viewed?.id]);

  const redeem = async (prize: Prize) => {
    if (!activeProfile || !viewed) return;
    setError(null);
    setRedeeming(prize.id);
    try {
      const r = await api.post<{ pending?: boolean }>(`/prizes/${prize.id}/redeem`, { family_member_id: viewed.id, acting_member_id: activeProfile.id });
      if (r?.pending) setNotice(`${prize.title}: claimed — waiting for a parent's OK ⏳`);
      window.dispatchEvent(new Event('approvals-changed'));
      load();
      refresh();
    } catch (err) {
      setError((err as Error).message || 'Could not redeem that prize');
    } finally {
      setRedeeming(null);
    }
  };

  const markUsed = async (r: EarnedReward, used: boolean) => {
    setError(null);
    try {
      await api.post(`/prizes/earned/${r.id}/use`, { used });
      load();
    } catch (err) {
      setError((err as Error).message || 'Only a parent can do that');
    }
  };
  // Chores / to-dos that pay something (money, stars or "Movie time"), for whoever's picked: theirs,
  // ones anyone can claim, and rotating ones they take turns on. Finished one-time jobs are left out.
  const rewardJobs = Object.values(tasksById)
    .filter((t) => t.active && t.reward_type && !t.finished)
    .filter((t) => !viewed || t.assignee_ids.length === 0 || t.assignee_ids.includes(viewed.id) || t.rotation_ids?.includes(viewed.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  const allJobs = Object.values(tasksById).sort((a, b) => a.title.localeCompare(b.title));
  const todayById = Object.fromEntries(today.map((t) => [t.id, t]));
  const jobStatus = (t: Task): string | null => {
    const d = todayById[t.id];
    if (!d) return null;
    const mine = (id: string | null) => !viewed || id === viewed.id;
    if (d.completions.some((c) => mine(c.completed_by_id))) return '✓ Done today';
    if (d.pending?.some((p) => mine(p.family_member_id))) return "⏳ Waiting for a parent's OK";
    return 'On today’s list';
  };
  const toEnjoy = earned.filter((r) => !r.used_at);
  const enjoyed = earned.filter((r) => r.used_at);

  return (
    <div className="prize-bank-page">
      <h1>Prize Bank</h1>

      {isParent && members.length > 0 && (
        <div className="task-form__row prize-bank-page__who">
          <label className="member-form__label--inline">
            Prizes for{' '}
            <select value={viewed?.id ?? ''} onChange={(e) => { setViewId(e.target.value); setEditing(null); }}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          {editing !== 'new' && (
            <button type="button" className="secondary" onClick={() => setEditing('new')}>
              + Add a prize{viewed ? ` for ${viewed.name}` : ''}
            </button>
          )}
        </div>
      )}
      {isParent && editing === 'new' && (
        <PrizeForm prize={null} tasks={allJobs} forMemberId={viewed?.id} onDone={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
      )}

      {!viewed && (
        <div className="empty-state">Pick your name up top to see your stars, earnings, and what you can redeem.</div>
      )}

      {viewed && (
        <div className="panel prize-bank-page__balance">
          <div>
            <div className="prize-bank-page__balance-value">⭐ {viewed.star_balance ?? 0}</div>
            <div className="hint">stars</div>
          </div>
          <div>
            <div className="prize-bank-page__balance-value">${(viewed.money_balance ?? 0).toFixed(2)}</div>
            <div className="hint">earned</div>
          </div>
        </div>
      )}

      {error && <div className="settings-login__error">{error}</div>}
      {notice && <div className="panel prize-bank-page__notice">{notice}</div>}

      {viewed && earned.length > 0 && (
        <section className="panel prize-earned">
          <h2>🎁 Earned</h2>
          {toEnjoy.length === 0 && <div className="hint">Nothing waiting right now.</div>}
          <ul className="prize-earned__list">
            {toEnjoy.map((r) => (
              <li key={r.id} className="prize-earned__item">
                <span className="prize-earned__emoji" aria-hidden="true">{r.emoji ?? '🎁'}</span>
                <span className="prize-earned__text">
                  <strong>{r.text}</strong>
                  <span className="hint"> · earned {new Date(r.earned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </span>
                {isParent && (
                  <button type="button" className="secondary" onClick={() => markUsed(r, true)}>
                    ✓ Used
                  </button>
                )}
              </li>
            ))}
          </ul>
          {enjoyed.length > 0 && (
            <details className="prize-earned__done">
              <summary className="hint">Already enjoyed ({enjoyed.length})</summary>
              <ul className="prize-earned__list">
                {enjoyed.map((r) => (
                  <li key={r.id} className="prize-earned__item prize-earned__item--used">
                    <span className="prize-earned__emoji" aria-hidden="true">{r.emoji ?? '🎁'}</span>
                    <span className="prize-earned__text">
                      {r.text}
                      <span className="hint"> · used {new Date(r.used_at!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </span>
                    {isParent && (
                      <button type="button" className="link-button" onClick={() => markUsed(r, false)}>
                        Not yet
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {rewardJobs.length > 0 && (
        <section className="panel prize-jobs">
          <h2>💪 Jobs that earn rewards</h2>
          <ul className="prize-jobs__list">
            {rewardJobs.map((t) => {
              const status = jobStatus(t);
              const goal = goalLabel(t);
              return (
                <li key={t.id} className="prize-jobs__item">
                  <span aria-hidden="true">{taskIcon(t)}</span>
                  <span className="prize-jobs__name">
                    <strong>{t.title}</strong>
                    {goal && <span className="hint"> · {goal}</span>}
                    {status && <span className="hint"> · {status}</span>}
                  </span>
                  <span className="badge badge--reward">
                    {taskRewardEmoji(t)} {taskRewardText(t)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="prize-bank-page__prizes">
        {prizes.length === 0 && <div className="empty-state">No prizes yet — a parent can add some here or in Settings.</div>}
        {prizes.map((prize) => {
          const pct = prize.progress && prize.progress.needed > 0
            ? Math.min(100, Math.round((Math.max(0, prize.progress.current) / prize.progress.needed) * 100))
            : 0;
          if (isParent && editing === prize.id) {
            return (
              <PrizeForm key={prize.id} prize={prize} tasks={allJobs} onDone={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
            );
          }
          return (
            <div key={prize.id} className="panel prize-card">
              <div className="prize-card__title">
                <span className="prize-card__emoji" aria-hidden="true">{prizeEmoji(prize)}</span> {prize.title}
              </div>
              {prizeRewardLabel(prize) && prize.title !== prizeRewardLabel(prize)?.slice(1) && (
                <div className="prize-card__reward">{prizeRewardLabel(prize)}</div>
              )}
              <div className="hint">{prizeCostLabel(prize, prize.task_id ? tasksById[prize.task_id]?.title : undefined)}</div>
              {viewed && prize.progress?.parts?.length ? (
                <ul className="prize-card__parts">
                  {prize.progress.parts.map((part) => {
                    const task = tasksById[part.task_id];
                    const show = (n: number) => (part.unit === 'hours' ? formatHours(n) : String(Math.floor(n)));
                    return (
                      <li key={part.task_id}>
                        <span className="prize-card__part-name">
                          <span aria-hidden="true">{task ? taskIcon(task) : part.kind === 'chore' ? '🧹' : '📝'}</span> {part.title}
                        </span>
                        <div className="progress-bar">
                          <div className="progress-bar__fill" style={{ width: `${Math.min(100, (part.current / part.needed) * 100)}%` }} />
                        </div>
                        <span className="hint">
                          {show(part.current)} / {show(part.needed)}
                          {part.unit === 'hours' ? ' h' : '×'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : viewed && prize.progress && (
                <>
                  <div className="progress-bar">
                    <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="hint">
                    {Math.max(0, prize.progress.current)} / {prize.progress.needed}
                  </div>
                </>
              )}
              {viewed && (prize.waiting ?? 0) > 0 && (
                <div className="badge badge--waiting">⏳ Claimed — waiting for a parent's OK{(prize.waiting ?? 0) > 1 ? ` (${prize.waiting})` : ''}</div>
              )}
              {isParent && (
                <button type="button" className="link-button" onClick={() => setEditing(prize.id)}>
                  ✎ Edit · add jobs
                </button>
              )}
              {viewed && (
                <button
                  type="button"
                  disabled={!prize.eligible || redeeming === prize.id}
                  onClick={() => redeem(prize)}
                >
                  {prize.eligible ? 'Redeem' : 'Not yet'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
