import { useEffect, useState, type FormEvent } from 'react';
import { EmojiPicker } from './EmojiPicker.js';
import { amountLabel, prizeEmoji, prizeRewardLabel } from '../utils/prizes.js';
import { formatHours } from '../utils/tasks.js';
import { api, type Prize, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TaskFormModal } from './TaskFormModal.js';

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
  const { members } = useFamilyMembers();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  // Every job (chores too) — a prize can be earned by any of them, or several. One-time jobs that
  // are done are only offered if the prize already uses them.
  const [jobs, setJobs] = useState<Task[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const parentIds = new Set(members.filter((m) => m.is_parent === 1).map((m) => m.id));

  const load = () => {
    // Rewards apply to extra to-dos only — routine chores are expected, unpaid duties — and only
    // ones a kid could actually be assigned, so a to-do a parent made for themselves (or shares
    // with a kid) never shows up as something to pay a reward on.
    api
      .get<Task[]>('/tasks?all=true')
      .then((t) => {
        setTasks(t.filter((x) => x.active && x.kind === 'todo' && !x.assignee_ids.some((id) => parentIds.has(id))));
        setJobs([...t].sort((a, b) => a.title.localeCompare(b.title)));
      });
    api.get<Prize[]>('/prizes').then(setPrizes);
  };
  useEffect(load, [members]);

  const removePrize = async (id: string) => {
    await api.delete(`/prizes/${id}`);
    load();
  };

  const taskTitle = (id: string | null) => jobs.find((t) => t.id === id)?.title ?? '(deleted task)';
  const costText = (p: Prize) => {
    if (p.cost_type === 'stars') return `costs ${p.star_cost} ⭐`;
    if (p.requirements?.length) {
      return p.requirements
        .map((r) => {
          const t = jobs.find((x) => x.id === r.task_id);
          return `${t?.title ?? '(deleted)'} ${amountLabel(r.amount, t?.goal_type === 'hours' ? 'hours' : 'times')}`;
        })
        .join(' + ');
    }
    return `do "${taskTitle(p.task_id)}" ${p.required_count}×`;
  };

  return (
    <>
      <section className="panel">
        <h2>Prize Bank — extra to-do rewards</h2>
        <p className="hint">
          Set what an extra to-do pays out when completed — routine chores stay unpaid duties and
          don't show up here, and neither does a to-do assigned to a parent. Everyday to-do
          creation stays open to the whole family — only reward amounts are protected here.
        </p>
        <button type="button" className="secondary" onClick={() => setAddingTask(true)}>
          + Add a Prize Bank to-do
        </button>
        {tasks.length === 0 && <div className="empty-state">No extra to-dos yet — add one above, or from the Chores &amp; To-dos page.</div>}
        {tasks.map((t) => (
          <RewardRow key={t.id} task={t} onSaved={load} />
        ))}
      </section>

      {addingTask && (
        <TaskFormModal task={null} onClose={() => setAddingTask(false)} onSaved={() => { setAddingTask(false); load(); }} />
      )}

      <section className="panel">
        <h2>Prize Bank — prizes</h2>
        <ul className="prize-settings__list">
          {prizes.map((p) =>
            editingId === p.id ? (
              <li key={p.id}>
                <PrizeForm prize={p} tasks={jobs} onDone={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
              </li>
            ) : (
              <li key={p.id} className="prize-settings__item">
                <span className="prize-settings__emoji" aria-hidden="true">{prizeEmoji(p)}</span>
                <span className="prize-settings__what">
                  <strong>{p.title}</strong>
                  {prizeRewardLabel(p) && p.title !== prizeRewardLabel(p)?.slice(1) && <span className="hint"> ({prizeRewardLabel(p)})</span>}
                  <span className="hint"> — {costText(p)}</span>
                </span>
                <button type="button" className="link-button" onClick={() => setEditingId(p.id)}>Edit</button>
                <button type="button" className="link-button" onClick={() => removePrize(p.id)}>Remove</button>
              </li>
            )
          )}
        </ul>
        {editingId === 'new' ? (
          <PrizeForm prize={null} tasks={jobs} onDone={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
        ) : (
          <button type="button" onClick={() => setEditingId('new')}>+ Add a prize</button>
        )}
      </section>
    </>
  );
}

const PRIZE_EMOJI = ['💲', '💵', '⭐', '🎁', '🎬', '🍕', '🍦', '🍔', '🎮', '🎟️', '🏊', '🎳', '🧸', '📚', '🛍️', '🏆'];

/**
 * Adding or changing a prize: its emoji, what you get (money, stars, or something you type — "Movie
 * night"), and how it's earned (stars, or doing one or more chores/to-dos — so much of each).
 */
function PrizeForm({ prize, tasks, onDone, onCancel }: { prize: Prize | null; tasks: Task[]; onDone: () => void; onCancel: () => void }) {
  const [rewardKind, setRewardKind] = useState<'money' | 'stars' | 'custom'>(prize?.reward_kind ?? 'custom');
  const [rewardAmount, setRewardAmount] = useState(String(prize?.reward_amount ?? (prize?.reward_kind === 'money' ? 5 : 10)));
  const [title, setTitle] = useState(prize?.title ?? '');
  const [emoji, setEmoji] = useState<string | null>(prize?.emoji ?? null);
  const [costType, setCostType] = useState<'stars' | 'task_count'>(prize?.cost_type ?? 'task_count');
  const [starCost, setStarCost] = useState(String(prize?.star_cost ?? 5));
  const [reqs, setReqs] = useState<Array<{ task_id: string; amount: string }>>(() => {
    if (prize?.requirements?.length) return prize.requirements.map((r) => ({ task_id: r.task_id, amount: String(r.amount) }));
    if (prize?.task_id) return [{ task_id: prize.task_id, amount: String(prize.required_count ?? 1) }];
    return [{ task_id: '', amount: '1' }];
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const unitOf = (taskId: string) => (tasks.find((t) => t.id === taskId)?.goal_type === 'hours' ? 'hours' : 'times');
  const setReq = (i: number, patch: Partial<{ task_id: string; amount: string }>) =>
    setReqs((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const requirements = reqs.filter((r) => r.task_id).map((r) => ({ task_id: r.task_id, amount: Number(r.amount) }));
    if (rewardKind === 'custom' && !title.trim()) return setError('Type what they get — e.g. "Movie night" or "Pick a restaurant"');
    if (costType === 'task_count' && requirements.length === 0) return setError('Pick at least one chore or to-do');
    if (requirements.some((r) => !(r.amount > 0))) return setError('How much of each job? (a number above 0)');
    const body = {
      title: title.trim(),
      emoji,
      reward_kind: rewardKind,
      reward_amount: rewardKind === 'custom' ? null : Number(rewardAmount),
      cost_type: costType,
      star_cost: costType === 'stars' ? Number(starCost) : null,
      requirements: costType === 'task_count' ? requirements : [],
    };
    setSaving(true);
    try {
      if (prize) await api.patch(`/prizes/${prize.id}`, body);
      else await api.post('/prizes', body);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const defaultEmoji = prizeEmoji({ emoji: null, reward_kind: rewardKind });
  return (
    <form className="task-form prize-form panel" onSubmit={submit}>
      <h3>{prize ? 'Change prize' : 'New prize'}</h3>
      <label className="member-form__label">What they get</label>
      <div className="task-form__row prize-form__row">
        <select value={rewardKind} onChange={(e) => setRewardKind(e.target.value as 'money' | 'stars' | 'custom')}>
          <option value="custom">Something else (type it in)</option>
          <option value="money">Money</option>
          <option value="stars">Stars</option>
        </select>
        {rewardKind === 'money' && (
          <label className="member-form__label--inline">
            $ <input type="number" min={0.01} step={0.01} value={rewardAmount} onChange={(e) => setRewardAmount(e.target.value)} aria-label="Dollars" />
          </label>
        )}
        {rewardKind === 'stars' && (
          <label className="member-form__label--inline">
            <input type="number" min={1} step={1} value={rewardAmount} onChange={(e) => setRewardAmount(e.target.value)} aria-label="Stars" /> ⭐
          </label>
        )}
      </div>
      <input
        placeholder={rewardKind === 'custom' ? 'e.g. Movie night, Pick a restaurant' : 'Name (optional — e.g. "Summer job pay")'}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
      />
      <label className="member-form__label">Emoji</label>
      <EmojiPicker
        value={emoji}
        suggestions={PRIZE_EMOJI.filter((e) => e !== defaultEmoji)}
        onPick={(em) => setEmoji((cur) => (cur === em ? null : em))}
        before={
          <button
            type="button"
            className={`member-form__emoji ${emoji === null ? 'member-form__emoji--selected' : ''}`}
            onClick={() => setEmoji(null)}
            aria-label="Use the default emoji"
            title="Default"
          >
            {defaultEmoji}
          </button>
        }
      />
      <label className="member-form__label">How it's earned</label>
      <div className="task-form__row">
        <select value={costType} onChange={(e) => setCostType(e.target.value as 'stars' | 'task_count')}>
          <option value="task_count">Doing chores / to-dos</option>
          <option value="stars">Spending stars</option>
        </select>
        {costType === 'stars' && (
          <label className="member-form__label--inline">
            <input type="number" min={1} value={starCost} onChange={(e) => setStarCost(e.target.value)} aria-label="Star cost" /> ⭐
          </label>
        )}
      </div>
      {costType === 'task_count' && (
        <div className="prize-form__jobs">
          {reqs.map((r, i) => {
            const unit = unitOf(r.task_id);
            return (
              <div key={i} className="task-form__row prize-form__row">
                <select value={r.task_id} onChange={(e) => setReq(i, { task_id: e.target.value })}>
                  <option value="">Pick a chore or to-do…</option>
                  {tasks
                    .filter((t) => t.id === r.task_id || (!t.finished && !reqs.some((o) => o.task_id === t.id)))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                        {t.goal_type === 'hours' ? ` (${formatHours(t.goal_amount ?? 0)} h job)` : t.goal_type === 'times' ? ` (${t.goal_amount}× job)` : ''}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min={unit === 'hours' ? 0.5 : 1}
                  step={unit === 'hours' ? 0.5 : 1}
                  value={r.amount}
                  onChange={(e) => setReq(i, { amount: e.target.value })}
                  aria-label={unit === 'hours' ? 'Hours' : 'Times'}
                />
                <span>{unit === 'hours' ? 'hours' : 'times'}</span>
                {reqs.length > 1 && (
                  <button type="button" className="link-button" aria-label="Remove this job" onClick={() => setReqs((rs) => rs.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" className="secondary" onClick={() => setReqs((rs) => [...rs, { task_id: '', amount: '1' }])}>
            + Add another job
          </button>
          <p className="hint">
            They need all of these to claim it. An hours job counts the hours they've put in (checked off a bit at a time);
            any other job counts the times they've done it.
          </p>
        </div>
      )}
      {error && <div className="settings-login__error">{error}</div>}
      <div className="task-form__row">
        <button type="submit" disabled={saving}>{prize ? 'Save' : 'Add prize'}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
