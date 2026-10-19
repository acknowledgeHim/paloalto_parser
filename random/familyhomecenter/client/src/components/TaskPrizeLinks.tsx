import { useEffect, useState } from 'react';
import { api, type Prize, type PrizeRequirement, type Task } from '../api/client.js';
import { amountLabel, prizeEmoji } from '../utils/prizes.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

/** A prize's jobs, including an older single-job prize that only has task_id / required_count. */
function jobsOf(p: Prize): PrizeRequirement[] {
  if (p.requirements?.length) return p.requirements;
  return p.task_id && p.required_count ? [{ task_id: p.task_id, amount: p.required_count }] : [];
}

/**
 * 🎁 Counts toward a prize (parents, in a saved job's form): the prizes this job is part of, and
 * adding it to another one — or to a new prize — with how much of it is needed. A prize can need
 * several jobs; each one is added from its own form (or in Settings → Prize Bank — prizes).
 */
export function TaskPrizeLinks({ task }: { task: Task }) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [pick, setPick] = useState('');
  const [amount, setAmount] = useState('1');
  const [newTitle, setNewTitle] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const { members } = useFamilyMembers();
  const unit = task.goal_type === 'hours' ? 'hours' : 'times';
  // The kids this job is for: the prizes offered are theirs (or everyone's), and a new prize is for them.
  const people = [...new Set([...task.assignee_ids, ...(task.rotation_ids ?? [])])];
  const forPeople = (p: Prize) => !p.member_ids?.length || people.length === 0 || p.member_ids.some((id) => people.includes(id));
  const whoFor = (p: Prize) =>
    p.member_ids?.length ? ` (${members.filter((m) => p.member_ids!.includes(m.id)).map((m) => m.name).join(', ')})` : '';

  const load = () => {
    api.get<Prize[]>('/prizes').then((all) => setPrizes(all.filter((p) => p.cost_type === 'task_count'))).catch(console.error);
  };
  useEffect(load, [task.id]);

  const linked = prizes.filter((p) => jobsOf(p).some((r) => r.task_id === task.id));
  const others = prizes.filter((p) => !linked.includes(p) && forPeople(p));

  const add = async () => {
    setStatus(null);
    const n = Math.round(Number(amount) * 2) / 2;
    if (!(n > 0)) return setStatus(unit === 'hours' ? 'How many hours of it?' : 'How many times?');
    try {
      if (pick === 'new') {
        if (!newTitle.trim()) return setStatus('Type the prize, e.g. "Movie night"');
        await api.post('/prizes', {
          title: newTitle.trim(),
          cost_type: 'task_count',
          reward_kind: 'custom',
          needs_approval: true,
          member_ids: people,
          requirements: [{ task_id: task.id, amount: n }],
        });
        setStatus(`New prize "${newTitle.trim()}" ✓ — open other chores / to-dos to add them to it too`);
        setNewTitle('');
      } else {
        const prize = prizes.find((p) => p.id === pick);
        if (!prize) return;
        await api.patch(`/prizes/${prize.id}`, { requirements: [...jobsOf(prize), { task_id: task.id, amount: n }] });
        setStatus(`Added to "${prize.title}" ✓`);
      }
      setPick('');
      setAmount('1');
      load();
    } catch (err) {
      setStatus((err as Error).message || 'Could not add it');
    }
  };

  const remove = async (prize: Prize) => {
    setStatus(null);
    const rest = jobsOf(prize).filter((r) => r.task_id !== task.id);
    if (rest.length === 0) return setStatus(`"${prize.title}" needs at least one job — remove the prize in Settings instead`);
    try {
      await api.patch(`/prizes/${prize.id}`, { requirements: rest });
      load();
    } catch (err) {
      setStatus((err as Error).message || 'Could not take it off');
    }
  };

  return (
    <div className="task-prize-links">
      <label className="member-form__label">🎁 Counts toward a prize</label>
      {linked.length > 0 && (
        <ul className="task-prize-links__list">
          {linked.map((p) => {
            const mine = jobsOf(p).find((r) => r.task_id === task.id)!;
            const otherCount = jobsOf(p).length - 1;
            return (
              <li key={p.id}>
                <span aria-hidden="true">{prizeEmoji(p)}</span> <strong>{p.title}</strong>
                <span className="hint">{whoFor(p)}</span>
                <span className="hint">
                  {' '}· needs this {amountLabel(mine.amount, unit)}
                  {otherCount > 0 ? ` + ${otherCount} other job${otherCount > 1 ? 's' : ''}` : ''}
                </span>{' '}
                <button type="button" className="link-button" onClick={() => remove(p)}>Take off</button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="task-form__row">
        <select value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{linked.length ? 'Add to another prize…' : 'Add to a prize…'}</option>
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {prizeEmoji(p)} {p.title}
              {whoFor(p)}
            </option>
          ))}
          <option value="new">＋ A new prize…</option>
        </select>
        {pick && (
          <>
            <input
              type="number"
              min={unit === 'hours' ? 0.5 : 1}
              step={unit === 'hours' ? 0.5 : 1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label={unit === 'hours' ? 'Hours needed' : 'Times needed'}
              style={{ width: '5em' }}
            />
            <span className="hint">{unit === 'hours' ? 'hours' : 'times'}</span>
          </>
        )}
      </div>
      {pick === 'new' && (
        <input placeholder='The prize, e.g. "Movie night" or "Pick a restaurant"' value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
      )}
      {pick && (
        <div className="task-form__row">
          <button type="button" onClick={add}>🎁 Add</button>
        </div>
      )}
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
