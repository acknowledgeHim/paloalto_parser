import { useEffect, useState } from 'react';
import { api, type Prize, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

function prizeCostLabel(prize: Prize, taskTitle: string | undefined): string {
  if (prize.cost_type === 'stars') return `${prize.star_cost} ⭐`;
  return `Do "${taskTitle ?? 'a task'}" ${prize.required_count}×`;
}

export function PrizeBankPage() {
  const { activeProfile, refresh } = useFamilyMembers();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tasksById, setTasksById] = useState<Record<string, Task>>({});
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const path = activeProfile ? `/prizes?family_member_id=${activeProfile.id}` : '/prizes';
    api.get<Prize[]>(path).then(setPrizes).catch(console.error);
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

  return (
    <div className="prize-bank-page">
      <h1>Prize Bank</h1>

      {!activeProfile && (
        <div className="empty-state">Pick your name up top to see your stars, earnings, and what you can redeem.</div>
      )}

      {activeProfile && (
        <div className="panel prize-bank-page__balance">
          <div>
            <div className="prize-bank-page__balance-value">⭐ {activeProfile.star_balance}</div>
            <div className="hint">stars</div>
          </div>
          <div>
            <div className="prize-bank-page__balance-value">${activeProfile.money_balance.toFixed(2)}</div>
            <div className="hint">earned</div>
          </div>
        </div>
      )}

      {error && <div className="settings-login__error">{error}</div>}

      <div className="prize-bank-page__prizes">
        {prizes.length === 0 && <div className="empty-state">No prizes set up yet — a parent can add some in Settings.</div>}
        {prizes.map((prize) => {
          const pct = prize.progress && prize.progress.needed > 0
            ? Math.min(100, Math.round((Math.max(0, prize.progress.current) / prize.progress.needed) * 100))
            : 0;
          return (
            <div key={prize.id} className="panel prize-card">
              <div className="prize-card__title">{prize.title}</div>
              <div className="hint">{prizeCostLabel(prize, prize.task_id ? tasksById[prize.task_id]?.title : undefined)}</div>
              {activeProfile && prize.progress && (
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
