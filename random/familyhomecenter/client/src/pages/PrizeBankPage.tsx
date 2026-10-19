import { useEffect, useState } from 'react';
import { api, type EarnedReward, type Prize, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { amountLabel, prizeEmoji, prizeRewardLabel } from '../utils/prizes.js';
import { formatHours } from '../utils/tasks.js';
import { taskIcon } from '../utils/taskIcons.js';

function prizeCostLabel(prize: Prize, taskTitle: string | undefined): string {
  if (prize.cost_type === 'stars') return `${prize.star_cost} ⭐`;
  if (prize.progress?.parts?.length) return prize.progress.parts.map((p) => `${p.title} ${amountLabel(p.needed, p.unit)}`).join(' + ');
  return `Do "${taskTitle ?? 'a task'}" ${prize.required_count}×`;
}

export function PrizeBankPage() {
  const { activeProfile, members, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  // What they've earned that isn't money or stars ("Movie time"), until a parent marks it used.
  const [earned, setEarned] = useState<EarnedReward[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tasksById, setTasksById] = useState<Record<string, Task>>({});
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const path = activeProfile ? `/prizes?family_member_id=${activeProfile.id}` : '/prizes';
    api.get<Prize[]>(path).then(setPrizes).catch(console.error);
    if (activeProfile) api.get<EarnedReward[]>(`/prizes/earned?family_member_id=${activeProfile.id}`).then(setEarned).catch(console.error);
    else setEarned([]);
    api
      .get<Task[]>('/tasks?all=true')
      .then((tasks) => setTasksById(Object.fromEntries(tasks.map((t) => [t.id, t]))))
      .catch(console.error);
  };
  useEffect(load, [activeProfile?.id]);

  const redeem = async (prize: Prize) => {
    if (!activeProfile) return;
    setError(null);
    setRedeeming(prize.id);
    try {
      await api.post(`/prizes/${prize.id}/redeem`, { family_member_id: activeProfile.id });
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
  const toEnjoy = earned.filter((r) => !r.used_at);
  const enjoyed = earned.filter((r) => r.used_at);

  return (
    <div className="prize-bank-page">
      <h1>Prize Bank</h1>

      {!activeProfile && (
        <div className="empty-state">Pick your name up top to see your stars, earnings, and what you can redeem.</div>
      )}

      {activeProfile && (
        <div className="panel prize-bank-page__balance">
          <div>
            <div className="prize-bank-page__balance-value">⭐ {activeProfile.star_balance ?? 0}</div>
            <div className="hint">stars</div>
          </div>
          <div>
            <div className="prize-bank-page__balance-value">${(activeProfile.money_balance ?? 0).toFixed(2)}</div>
            <div className="hint">earned</div>
          </div>
        </div>
      )}

      {error && <div className="settings-login__error">{error}</div>}

      {activeProfile && earned.length > 0 && (
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

      <div className="prize-bank-page__prizes">
        {prizes.length === 0 && <div className="empty-state">No prizes set up yet — a parent can add some in Settings.</div>}
        {prizes.map((prize) => {
          const pct = prize.progress && prize.progress.needed > 0
            ? Math.min(100, Math.round((Math.max(0, prize.progress.current) / prize.progress.needed) * 100))
            : 0;
          return (
            <div key={prize.id} className="panel prize-card">
              <div className="prize-card__title">
                <span className="prize-card__emoji" aria-hidden="true">{prizeEmoji(prize)}</span> {prize.title}
              </div>
              {prizeRewardLabel(prize) && prize.title !== prizeRewardLabel(prize)?.slice(1) && (
                <div className="prize-card__reward">{prizeRewardLabel(prize)}</div>
              )}
              <div className="hint">{prizeCostLabel(prize, prize.task_id ? tasksById[prize.task_id]?.title : undefined)}</div>
              {activeProfile && prize.progress?.parts?.length ? (
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
              ) : activeProfile && prize.progress && (
                <>
                  <div className="progress-bar">
                    <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="hint">
                    {Math.max(0, prize.progress.current)} / {prize.progress.needed}
                  </div>
                </>
              )}
              {activeProfile && (
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
