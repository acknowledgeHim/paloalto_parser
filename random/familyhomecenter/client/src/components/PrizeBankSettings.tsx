import { useEffect, useState, type FormEvent } from 'react';
import { api, type Prize, type Task } from '../api/client.js';

function RewardRow({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const [rewardType, setRewardType] = useState<'none' | 'stars' | 'money'>(task.reward_type ?? 'none');
  const [amount, setAmount] = useState(task.reward_amount ?? (task.reward_type === 'stars' ? 1 : 1));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/tasks/${task.id}/reward`, {
        reward_type: rewardType === 'none' ? null : rewardType,
        reward_amount: rewardType === 'none' ? null : amount,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="task-form__row prize-settings__row">
      <span className="prize-settings__task-title">{task.title}</span>
      <select value={rewardType} onChange={(e) => setRewardType(e.target.value as 'none' | 'stars' | 'money')}>
        <option value="none">No reward</option>
        <option value="stars">Stars</option>
        <option value="money">Money</option>
      </select>
      {rewardType !== 'none' && (
        <input
          type="number"
          min={rewardType === 'stars' ? 1 : 0.01}
          step={rewardType === 'stars' ? 1 : 0.01}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
        />
      )}
      <button type="button" className="secondary" onClick={save} disabled={saving}>Save</button>
    </div>
  );
}

export function PrizeBankSettings() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [title, setTitle] = useState('');
  const [costType, setCostType] = useState<'stars' | 'task_count'>('stars');
  const [starCost, setStarCost] = useState(5);
  const [taskId, setTaskId] = useState('');
  const [requiredCount, setRequiredCount] = useState(3);

  const load = () => {
    // Rewards apply to extra to-dos only — routine chores are expected, unpaid duties.
    api.get<Task[]>('/tasks?all=true').then((t) => setTasks(t.filter((x) => x.active && x.kind === 'todo')));
    api.get<Prize[]>('/prizes').then(setPrizes);
  };
  useEffect(load, []);

  const addPrize = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (costType === 'task_count' && !taskId) return;
    await api.post('/prizes', {
      title: title.trim(),
      cost_type: costType,
      star_cost: costType === 'stars' ? starCost : undefined,
      task_id: costType === 'task_count' ? taskId : undefined,
      required_count: costType === 'task_count' ? requiredCount : undefined,
    });
    setTitle('');
    load();
  };

  const removePrize = async (id: string) => {
    await api.delete(`/prizes/${id}`);
    load();
  };

  const taskTitle = (id: string | null) => tasks.find((t) => t.id === id)?.title ?? '(deleted task)';

  return (
    <>
      <section className="panel">
        <h2>Prize Bank — extra to-do rewards</h2>
        <p className="hint">
          Set what an extra to-do pays out when completed — routine chores stay unpaid duties and
          don't show up here. Everyday to-do creation stays open to the whole family — only reward
          amounts are protected here.
        </p>
        {tasks.length === 0 && <div className="empty-state">No extra to-dos yet — add one from the Chores &amp; To-dos page.</div>}
        {tasks.map((t) => (
          <RewardRow key={t.id} task={t} onSaved={load} />
        ))}
      </section>

      <section className="panel">
        <h2>Prize Bank — prizes</h2>
        <ul className="settings-page__member-list">
          {prizes.map((p) => (
            <li key={p.id}>
              {p.title} —{' '}
              {p.cost_type === 'stars' ? `${p.star_cost} ⭐` : `do "${taskTitle(p.task_id)}" ${p.required_count}×`}
              <button className="link-button" onClick={() => removePrize(p.id)}>Remove</button>
            </li>
          ))}
        </ul>
        <form className="task-form" onSubmit={addPrize}>
          <input placeholder="Prize title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="task-form__row">
            <select value={costType} onChange={(e) => setCostType(e.target.value as 'stars' | 'task_count')}>
              <option value="stars">Costs stars</option>
              <option value="task_count">Do a specific to-do N times</option>
            </select>
          </div>
          {costType === 'stars' ? (
            <label className="member-form__label member-form__label--inline">
              Star cost
              <input type="number" min={1} value={starCost} onChange={(e) => setStarCost(Number(e.target.value) || 1)} />
            </label>
          ) : (
            <div className="task-form__row">
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">Pick a to-do…</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <label className="member-form__label member-form__label--inline">
                × times
                <input type="number" min={1} value={requiredCount} onChange={(e) => setRequiredCount(Number(e.target.value) || 1)} />
              </label>
            </div>
          )}
          <button type="submit">Add prize</button>
        </form>
      </section>
    </>
  );
}
