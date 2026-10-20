import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type FamilyMember, type Prize, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { amountLabel, prizeEmoji, prizeRewardLabel } from '../utils/prizes.js';
import { formatHours } from '../utils/tasks.js';
import { FloorplanView } from '../components/FloorplanView.js';
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
  // 👥 Board (a column per kid) or 🏠 Map (the floor plan, with just the prize-box jobs).
  const [view, setView] = useState<'board' | 'map'>(() => {
    try {
      return localStorage.getItem('familyhomecenter.prizes.view') === 'map' ? 'map' : 'board';
    } catch {
      return 'board';
    }
  });
  const pickView = (v: 'board' | 'map') => {
    setView(v);
    try {
      localStorage.setItem('familyhomecenter.prizes.view', v);
    } catch {
      /* fine — just not remembered */
    }
  };

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
    window.dispatchEvent(new Event('prizes-changed'));
  };

  return (
    <div className="prize-bank-page">
      <div className="family-board__head">
        <h1>Prize Bank</h1>
        <div className="family-board__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'board'} className={`family-board__tab ${view === 'board' ? 'family-board__tab--active' : ''}`} onClick={() => pickView('board')}>
            👥 Board
          </button>
          <button type="button" role="tab" aria-selected={view === 'map'} className={`family-board__tab ${view === 'map' ? 'family-board__tab--active' : ''}`} onClick={() => pickView('map')}>
            🏠 Map
          </button>
        </div>
      </div>
      {columns.length === 0 && <div className="empty-state">Add your family in Settings to start a Prize Bank.</div>}
      {view === 'map' && <FloorplanView tasks={today} jobs="prize" onChange={changed} />}
      {view === 'board' && <div className="family-board__columns">
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
      </div>}
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
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.get<Prize[]>(`/prizes?family_member_id=${member.id}`).then(setPrizes).catch(console.error);
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

  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const current = prizes.filter((p) => !p.done);
  const pastCount = prizes.reduce((n, p) => n + (p.redeemed_count ?? 0), 0);

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
      {current.length === 0 && <div className="empty-state">No prize boxes right now.</div>}
      {current.map((prize) => {
        const pct = prize.progress && prize.progress.needed > 0
          ? Math.min(100, Math.round((Math.max(0, prize.progress.current) / prize.progress.needed) * 100))
          : 0;
        const reward = prizeRewardLabel(prize);
        const waiting = prize.waiting ?? 0;
        return (
          <div key={prize.id} className="prize-card prize-card--compact">
            <div className="prize-card__title">
              <span className="prize-card__emoji" aria-hidden="true">{prizeEmoji(prize)}</span> {prize.title}
              {isParent && (
                <button type="button" className="task-card__edit prize-card__edit" aria-label={`Edit ${prize.title}`} title="Edit · add jobs" onClick={() => setEditing(prize.id)}>
                  ✎
                </button>
              )}
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
      {isParent && (
        <button type="button" className="secondary prize-column__add" onClick={() => setEditing('new')}>
          + Add a prize box
        </button>
      )}
      {/* Adding or changing a prize box opens in a pop-up — roomier than the column. */}
      {isParent && editing && (editing === 'new' || prizes.some((p) => p.id === editing)) && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-panel panel prize-form-modal" onClick={(e) => e.stopPropagation()}>
            <PrizeForm
              prize={editing === 'new' ? null : prizes.find((p) => p.id === editing) ?? null}
              tasks={tasks}
              forMemberId={member.id}
              onDone={() => { setEditing(null); onChanged(); }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

    </section>
  );
}
