import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type EarnedReward, type FamilyMember, type Prize, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { amountLabel, prizeEmoji, prizeRewardLabel, taskRewardEmoji, taskRewardText } from '../utils/prizes.js';
import { formatHours, goalLabel } from '../utils/tasks.js';
import { taskIcon } from '../utils/taskIcons.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { PrizeForm } from '../components/PrizeBankSettings.js';

function prizeCostLabel(prize: Prize, taskTitle: string | undefined): string {
  if (prize.cost_type === 'stars') return `${prize.star_cost} ⭐`;
  if (prize.progress?.parts?.length) return prize.progress.parts.map((p) => `${p.title} ${amountLabel(p.needed, p.unit)}`).join(' + ');
  return `Do "${taskTitle ?? 'a task'}" ${prize.required_count}×`;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * The Prize Bank, laid out like the Family Board: a column for each kid with their stars and money,
 * their prize boxes and how far along each one is, what they've earned to enjoy, and the jobs that
 * earn rewards. Parents add and change prizes and tick "Redeemed" right here; redeemed prizes move to
 * each kid's 📜 Past prizes page.
 */
export function PrizeBankPage() {
  const { activeProfile, members, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [today, setToday] = useState<Task[]>([]);
  // Bumped after anything changes, so every column reloads.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api.get<Task[]>('/tasks?all=true').then(setTasks).catch(console.error);
    api.get<Task[]>('/tasks').then(setToday).catch(console.error);
  }, [version]);

  const kids = members.filter((m) => m.is_parent !== 1);
  const columns = kids.length ? kids : members;
  const changed = () => {
    setVersion((v) => v + 1);
    refresh();
    window.dispatchEvent(new Event('approvals-changed'));
  };

  return (
    <div className="prize-bank-page">
      <h1>Prize Bank</h1>
      {columns.length === 0 && <div className="empty-state">Add your family in Settings to start a Prize Bank.</div>}
      <div className="family-board__columns">
        {columns.map((m) => (
          <PrizeColumn
            key={m.id}
            member={m}
            isParent={isParent}
            canClaim={isParent || activeProfile?.id === m.id}
            actingId={activeProfile?.id ?? null}
            tasks={tasks}
            today={today}
            version={version}
            onChanged={changed}
          />
        ))}
      </div>
    </div>
  );
}

function PrizeColumn({
  member,
  isParent,
  canClaim,
  actingId,
  tasks,
  today,
  version,
  onChanged,
}: {
  member: FamilyMember;
  isParent: boolean;
  canClaim: boolean;
  actingId: string | null;
  tasks: Task[];
  today: Task[];
  version: number;
  onChanged: () => void;
}) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [earned, setEarned] = useState<EarnedReward[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.get<Prize[]>(`/prizes?family_member_id=${member.id}`).then(setPrizes).catch(console.error);
    api.get<EarnedReward[]>(`/prizes/earned?family_member_id=${member.id}`).then(setEarned).catch(console.error);
  }, [member.id, version]);

  const act = async (id: string, run: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    setBusy(id);
    try {
      await run();
      onChanged();
    } catch (err) {
      setError((err as Error).message || 'That didn’t work');
    } finally {
      setBusy(null);
    }
  };
  const claim = (prize: Prize) =>
    act(prize.id, async () => {
      const r = await api.post<{ pending?: boolean }>(`/prizes/${prize.id}/redeem`, { family_member_id: member.id, acting_member_id: actingId ?? member.id });
      if (r?.pending) setNotice(`${prize.title}: claimed — waiting for a parent's OK ⏳`);
    });
  const setRedeemed = (prize: Prize, redeemed: boolean) =>
    act(prize.id, () => api.post(`/prizes/${prize.id}/redeemed`, { family_member_id: member.id, acting_member_id: actingId, redeemed }));
  const markUsed = (r: EarnedReward, used: boolean) => act(r.id, () => api.post(`/prizes/earned/${r.id}/use`, { used }));

  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const current = prizes.filter((p) => !p.done);
  const pastCount = prizes.reduce((n, p) => n + (p.redeemed_count ?? 0), 0);
  const toEnjoy = earned.filter((r) => !r.used_at);

  // Chores / to-dos that pay something, for this kid: theirs, ones anyone can claim, and rotating
  // ones they take turns on. Finished one-time jobs are left out.
  const rewardJobs = tasks
    .filter((t) => t.active && t.reward_type && !t.finished)
    .filter((t) => t.assignee_ids.length === 0 || t.assignee_ids.includes(member.id) || t.rotation_ids?.includes(member.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  const todayById = Object.fromEntries(today.map((t) => [t.id, t]));
  const jobStatus = (t: Task): string | null => {
    const d = todayById[t.id];
    if (!d) return null;
    if (d.completions.some((c) => c.completed_by_id === member.id)) return '✓ done today';
    if (d.pending?.some((p) => p.family_member_id === member.id)) return '⏳ waiting for OK';
    return 'today';
  };

  return (
    <section className="panel person-column prize-column">
      <h2>
        <span className="person-column__link">
          <MemberAvatar member={member} /> {member.name}
        </span>
      </h2>
      <div className="prize-column__balances">
        <span title="Stars">⭐ {member.star_balance ?? 0}</span>
        <span title="Earned Prize Bank money, not yet in the bank">${(member.money_balance ?? 0).toFixed(2)}</span>
        <Link to={`/person/${member.id}/bank`} className="hint">🏦 Bank</Link>
        <Link to={`/prizes/past/${member.id}`} className="hint">📜 Past prizes{pastCount ? ` (${pastCount})` : ''}</Link>
      </div>

      {error && <div className="settings-login__error">{error}</div>}
      {notice && <div className="hint prize-bank-page__notice">{notice}</div>}

      <h3>🎁 Prize boxes</h3>
      {current.length === 0 && editing !== 'new' && <div className="empty-state">No prize boxes right now.</div>}
      {current.map((prize) => {
        if (isParent && editing === prize.id) {
          return (
            <PrizeForm key={prize.id} prize={prize} tasks={tasks} onDone={() => { setEditing(null); onChanged(); }} onCancel={() => setEditing(null)} />
          );
        }
        const pct = prize.progress && prize.progress.needed > 0
          ? Math.min(100, Math.round((Math.max(0, prize.progress.current) / prize.progress.needed) * 100))
          : 0;
        const reward = prizeRewardLabel(prize);
        const waiting = prize.waiting ?? 0;
        return (
          <div key={prize.id} className="prize-card prize-card--compact">
            <div className="prize-card__title">
              <span className="prize-card__emoji" aria-hidden="true">{prizeEmoji(prize)}</span> {prize.title}
            </div>
            {reward && prize.title !== reward.slice(1) && <div className="prize-card__reward">{reward}</div>}
            <div className="hint">{prizeCostLabel(prize, prize.task_id ? byId[prize.task_id]?.title : undefined)}</div>
            {prize.progress?.parts?.length ? (
              <ul className="prize-card__parts">
                {prize.progress.parts.map((part) => {
                  const task = byId[part.task_id];
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
            ) : prize.progress && (
              <>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="hint">
                  {Math.max(0, prize.progress.current)} / {prize.progress.needed}
                </div>
              </>
            )}
            {waiting > 0 && <div className="badge badge--waiting">⏳ Claimed — waiting for a parent's OK{waiting > 1 ? ` (${waiting})` : ''}</div>}
            {!prize.once && (prize.redeemed_count ?? 0) > 0 && (
              <div className="hint">
                🔁 Redeemed {prize.redeemed_count}× · last {shortDate(prize.last_redeemed_at!)}
                {isParent && (
                  <>
                    {' '}
                    <button type="button" className="link-button" disabled={busy === prize.id} onClick={() => setRedeemed(prize, false)}>
                      ↶ undo last
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="task-form__row prize-card__actions">
              {isParent ? (
                <label className="checkbox prize-card__redeemed">
                  <input type="checkbox" checked={false} disabled={busy === prize.id} onChange={() => setRedeemed(prize, true)} />
                  Redeemed
                </label>
              ) : (
                canClaim &&
                waiting === 0 && (
                  <button type="button" disabled={!prize.eligible || busy === prize.id} onClick={() => claim(prize)}>
                    {prize.eligible ? 'Redeem' : 'Not yet'}
                  </button>
                )
              )}
              {isParent && (
                <button type="button" className="link-button" onClick={() => setEditing(prize.id)}>
                  ✎ Edit · add jobs
                </button>
              )}
            </div>
          </div>
        );
      })}
      {isParent &&
        (editing === 'new' ? (
          <PrizeForm prize={null} tasks={tasks} forMemberId={member.id} onDone={() => { setEditing(null); onChanged(); }} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className="secondary" onClick={() => setEditing('new')}>
            + Add a prize box for {member.name}
          </button>
        ))}

      {toEnjoy.length > 0 && (
        <>
          <h3>🎉 Earned to enjoy</h3>
          <ul className="prize-earned__list">
            {toEnjoy.map((r) => (
              <li key={r.id} className="prize-earned__item">
                <span className="prize-earned__emoji" aria-hidden="true">{r.emoji ?? '🎁'}</span>
                <span className="prize-earned__text">
                  <strong>{r.text}</strong>
                  <span className="hint"> · {shortDate(r.earned_at)}</span>
                </span>
                {isParent && (
                  <button type="button" className="secondary" disabled={busy === r.id} onClick={() => markUsed(r, true)}>
                    ✓ Used
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {rewardJobs.length > 0 && (
        <>
          <h3>💪 Jobs that earn rewards</h3>
          <ul className="prize-jobs__list">
            {rewardJobs.map((t) => {
              const status = jobStatus(t);
              const goal = goalLabel(t);
              return (
                <li key={t.id} className="prize-jobs__item">
                  <span aria-hidden="true">{taskIcon(t)}</span>
                  <span className="prize-jobs__name">
                    {t.title}
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
        </>
      )}
    </section>
  );
}
