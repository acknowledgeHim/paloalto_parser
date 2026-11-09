import { useEffect, useState } from 'react';
import { api, type FamilyMember } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

export interface Wallet {
  token_balance: number;
  star_balance: number;
  tokens_per_star: number;
  log: Array<{ delta: number; reason: string; by_member_id: string | null; at: string }>;
}

/**
 * 💎 Someone's tokens: the app's own currency (typing, chores set to pay tokens, swapping ⭐ stars),
 * spent on 👕 Dress up and 🎮 Games. Prize Bank ⭐ stars stay separate. Swap stars → tokens; parents
 * can give or take tokens and set the swap rate.
 */
export function TokenWallet({ member, onChange, refreshKey }: { member: FamilyMember; onChange?: (w: Wallet) => void; refreshKey?: unknown }) {
  const { members, activeProfile, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const mayUse = isParent || activeProfile?.id === member.id;
  const [w, setW] = useState<Wallet | null>(null);
  const [swap, setSwap] = useState('5');
  const [give, setGive] = useState('10');
  const [why, setWhy] = useState('');
  const [rate, setRate] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Wallet>(`/tokens/${member.id}`)
      .then((x) => {
        setW(x);
        setRate(String(x.tokens_per_star));
      })
      .catch((e) => setError((e as Error).message));
  }, [member.id, refreshKey]);

  const run = async (fn: () => Promise<Wallet>) => {
    setBusy(true);
    setError(null);
    try {
      const x = await fn();
      setW(x);
      onChange?.(x);
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const acting = activeProfile?.id ?? null;
  const name = (id: string | null) => (id ? members.find((m) => m.id === id)?.name : null);

  if (!w) return error ? <div className="settings-login__error">{error}</div> : null;
  const swapN = Math.round(Number(swap) || 0);
  const isKid = member.is_parent !== 1;

  return (
    <section className="panel token-wallet">
      <div className="token-wallet__top">
        <div className="token-wallet__balance">
          💎 <strong>{w.token_balance}</strong> token{w.token_balance === 1 ? '' : 's'}
          <span className="hint"> · {member.name}</span>
        </div>
        <button type="button" className="link-button" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : mayUse && isKid ? 'Get more · history' : 'History'}
        </button>
      </div>
      <p className="hint">Tokens are earned in ⌨️ Typing (and chores set to pay tokens) and spent in 👕 Dress up and 🎮 Games. Prize Bank ⭐ stars are separate.</p>
      {open && (
        <>
          {!isParent && isKid && mayUse && w.tokens_per_star > 0 && (
            <p className="hint">⭐ → 💎 A parent can swap your Prize Bank stars for tokens ({w.tokens_per_star} 💎 per ⭐ · you have {w.star_balance} ⭐) — ask one.</p>
          )}
          {isParent && isKid && w.tokens_per_star > 0 && (
            <div className="token-wallet__row">
              <span>
                👑 ⭐ → 💎 Swap {member.name}’s stars for tokens ({w.tokens_per_star} 💎 per ⭐ · {w.star_balance} ⭐ to swap):
              </span>
              <input type="number" min={1} max={w.star_balance} value={swap} onChange={(e) => setSwap(e.target.value)} aria-label="Stars to swap" />
              <button
                type="button"
                className="secondary"
                disabled={busy || swapN < 1 || swapN > w.star_balance}
                onClick={() =>
                  window.confirm(`Swap ${swapN} ⭐ for ${swapN * w.tokens_per_star} 💎? Stars can't be swapped back.`) &&
                  void run(() => api.post<Wallet>(`/tokens/${member.id}/swap`, { stars: swapN, acting_member_id: acting }))
                }
              >
                Swap
              </button>
            </div>
          )}
          {isParent && isKid && (
            <div className="token-wallet__row">
              <span>👑 Give or take away:</span>
              <input type="number" value={give} onChange={(e) => setGive(e.target.value)} aria-label="Tokens" />
              <input type="text" placeholder="Why (optional)" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={100} />
              <button
                type="button"
                className="secondary"
                disabled={busy || !Math.round(Number(give))}
                onClick={() => void run(() => api.post<Wallet>(`/tokens/${member.id}/adjust`, { delta: Math.round(Number(give)), reason: why, acting_member_id: acting }))}
              >
                + Give
              </button>
              <button
                type="button"
                className="link-button"
                disabled={busy || !Math.round(Number(give))}
                onClick={() => void run(() => api.post<Wallet>(`/tokens/${member.id}/adjust`, { delta: -Math.abs(Math.round(Number(give))), reason: why, acting_member_id: acting }))}
              >
                − Take away
              </button>
            </div>
          )}
          {isParent && (
            <div className="token-wallet__row">
              <span>👑 Swap rate for everyone: 1 ⭐ =</span>
              <input type="number" min={0} max={100} value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Tokens per star" />
              <span>💎 (0 = no swapping)</span>
              <button
                type="button"
                className="secondary"
                disabled={busy || String(w.tokens_per_star) === rate}
                onClick={() =>
                  void run(async () => {
                    await api.put('/tokens/settings', { tokens_per_star: Math.round(Number(rate) || 0) });
                    return api.get<Wallet>(`/tokens/${member.id}`);
                  })
                }
              >
                Save
              </button>
            </div>
          )}
          {w.log.length > 0 ? (
            <ul className="token-wallet__log">
              {w.log.map((l, i) => (
                <li key={i}>
                  <strong className={l.delta > 0 ? 'token-wallet__plus' : 'token-wallet__minus'}>
                    {l.delta > 0 ? '+' : ''}
                    {l.delta} 💎
                  </strong>{' '}
                  {l.reason}
                  <span className="hint">
                    {' '}
                    · {new Date(l.at).toLocaleDateString()}
                    {name(l.by_member_id) && name(l.by_member_id) !== member.name ? ` · by ${name(l.by_member_id)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No tokens yet — they come from ⌨️ Typing.</p>
          )}
        </>
      )}
      {error && <div className="settings-login__error">{error}</div>}
    </section>
  );
}
