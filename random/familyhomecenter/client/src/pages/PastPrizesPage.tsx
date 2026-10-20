import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type EarnedReward, type PastPrize } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { prizeEmoji } from '../utils/prizes.js';
import { MemberAvatar } from '../components/MemberAvatar.js';

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** What a redeemed prize paid: "$5.00 → bank", "10 ⭐", or nothing for "Movie night". */
function paidLabel(p: PastPrize): string | null {
  if (p.paid_money) return `$${p.paid_money.toFixed(2)}${p.bank_transaction_id ? ' → bank' : ''}`;
  if (p.paid_stars) return `${p.paid_stars} ⭐`;
  return null;
}

/**
 * 📜 Past prizes: a kid's redeemed prize boxes, newest first, so the Prize Bank only shows what
 * they're still working toward — plus the rewards they've already enjoyed. A parent can untick
 * "Redeemed" to undo one (what it paid comes back out, and the prize box goes back on the board).
 */
export function PastPrizesPage() {
  const { id } = useParams<{ id: string }>();
  const { activeProfile, members, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const member = members.find((m) => m.id === id);
  const [past, setPast] = useState<PastPrize[]>([]);
  const [earned, setEarned] = useState<EarnedReward[]>([]);
  const enjoyed = earned.filter((r) => r.used_at);
  // Rewards from to-dos ("Movie time") not used yet.
  const toEnjoy = earned.filter((r) => !r.used_at);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    api.get<PastPrize[]>(`/prizes/history?family_member_id=${id}`).then(setPast).catch(console.error);
    api
      .get<EarnedReward[]>(`/prizes/earned?family_member_id=${id}`)
      .then(setEarned)
      .catch(console.error);
  };
  useEffect(load, [id]);

  const undo = async (p: PastPrize) => {
    if (!window.confirm(`Untick "${p.title}"? ${paidLabel(p) ? `The ${paidLabel(p)} it paid is taken back, and it` : 'It'} goes back on the Prize Bank.`)) return;
    setError(null);
    try {
      await api.post(`/prizes/redemptions/${p.id}/undo`, { acting_member_id: activeProfile?.id ?? null });
      load();
      refresh();
    } catch (err) {
      setError((err as Error).message || 'Only a parent can do that');
    }
  };
  const notUsed = (r: EarnedReward) => setUsed(r, false);
  const setUsed = async (r: EarnedReward, used: boolean) => {
    setError(null);
    try {
      await api.post(`/prizes/earned/${r.id}/use`, { used });
      load();
    } catch (err) {
      setError((err as Error).message || 'Only a parent can do that');
    }
  };

  return (
    <div className="prize-bank-page">
      <p>
        <Link to="/prizes">← Prize Bank</Link>
      </p>
      <h1>
        {member && <MemberAvatar member={member} />} 📜 {member ? `${member.name}'s past prizes` : 'Past prizes'}
      </h1>
      {error && <div className="settings-login__error">{error}</div>}

      <section className="panel">
        <h2>🎁 Redeemed prize boxes</h2>
        {past.length === 0 && <div className="empty-state">Nothing redeemed yet.</div>}
        <ul className="prize-earned__list">
          {past.map((p) => (
            <li key={p.id} className="prize-earned__item">
              <span className="prize-earned__emoji" aria-hidden="true">{prizeEmoji({ emoji: p.emoji, reward_kind: p.reward_kind })}</span>
              <span className="prize-earned__text">
                <strong>{p.title}</strong>
                {paidLabel(p) && <span className="hint"> · {paidLabel(p)}</span>}
                <span className="hint"> · {longDate(p.redeemed_at)}</span>
              </span>
              {isParent ? (
                <label className="checkbox">
                  <input type="checkbox" checked onChange={() => undo(p)} />
                  Redeemed
                </label>
              ) : (
                <span className="hint">✓ Redeemed</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {toEnjoy.length > 0 && (
        <section className="panel">
          <h2>🎉 Earned to enjoy</h2>
          <p className="hint">Rewards from chores and to-dos, until a parent marks them used.</p>
          <ul className="prize-earned__list">
            {toEnjoy.map((r) => (
              <li key={r.id} className="prize-earned__item">
                <span className="prize-earned__emoji" aria-hidden="true">{r.emoji ?? '🎁'}</span>
                <span className="prize-earned__text">
                  <strong>{r.text}</strong>
                  <span className="hint"> · earned {longDate(r.earned_at)}</span>
                </span>
                {isParent && (
                  <button type="button" className="secondary" onClick={() => setUsed(r, true)}>
                    ✓ Used
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {enjoyed.length > 0 && (
        <section className="panel">
          <h2>🎉 Already enjoyed</h2>
          <ul className="prize-earned__list">
            {enjoyed.map((r) => (
              <li key={r.id} className="prize-earned__item prize-earned__item--used">
                <span className="prize-earned__emoji" aria-hidden="true">{r.emoji ?? '🎁'}</span>
                <span className="prize-earned__text">
                  {r.text}
                  <span className="hint"> · used {longDate(r.used_at!)}</span>
                </span>
                {isParent && (
                  <button type="button" className="link-button" onClick={() => notUsed(r)}>
                    Not yet
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
