import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

interface TokenSettingsData {
  tokens_per_star: number;
  parents_dress_free: boolean;
}

/**
 * Settings → 💎 Tokens: the app's own currency (separate from Prize Bank ⭐ stars). Whether parents
 * dress up free, and how many tokens a ⭐ star swaps for. Where tokens are earned is set per activity.
 */
export function TokenSettings() {
  const [s, setS] = useState<TokenSettingsData | null>(null);
  const [rate, setRate] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<TokenSettingsData>('/tokens/settings')
      .then((x) => {
        setS(x);
        setRate(String(x.tokens_per_star));
      })
      .catch(() => {});
  }, []);
  const put = async (patch: Partial<TokenSettingsData>) => {
    setStatus('Saving…');
    try {
      const x = await api.put<TokenSettingsData>('/tokens/settings', patch);
      setS(x);
      setRate(String(x.tokens_per_star));
      setStatus('Saved ✓');
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  return (
    <section className="panel">
      <h2>💎 Tokens</h2>
      <p className="hint">Tokens are earned and spent inside the Family Home Center (👕 Dress up, 🎮 Games). They're separate from Prize Bank ⭐ stars.</p>
      <label className="typing-stars__toggle">
        <input type="checkbox" checked={s?.parents_dress_free ?? true} disabled={!s} onChange={(e) => void put({ parents_dress_free: e.target.checked })} />
        👑 Parents dress up free — every 👕 Dress up piece (and Hill Hopper ride) costs parents nothing. Off: parents buy pieces with tokens like everyone else.
      </label>
      <label className="learning-settings__perday">
        ⭐ → 💎 swap: 1 star =
        <input type="number" min={0} max={100} value={rate} disabled={!s} onChange={(e) => setRate(e.target.value)} />
        tokens (0 = no swapping)
        <button type="button" className="secondary" disabled={!s || rate === String(s.tokens_per_star)} onClick={() => void put({ tokens_per_star: Math.round(Number(rate) || 0) })}>
          Save
        </button>
      </label>
      {status && <p className="hint">{status}</p>}
      <p className="hint">
        What earns tokens: <Link to="/typing">⌨️ Typing</Link> → 💎 Tokens · <Link to="/learning/settings">📚 Learning → ⚙️ Grades & tokens</Link> · chores and to-dos can pay
        💎 too. Give or take tokens from someone's 💎 wallet on 🎮 Games or 👕 Dress up.
      </p>
    </section>
  );
}
