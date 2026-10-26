import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

/** Settings → ⌨️ Typing: show or hide the 🏆 Daily Challenge (routes/typing.ts, setting typing_rewards). */
export function TypingSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<{ daily_enabled: boolean }>('/typing/settings/rewards')
      .then((r) => setEnabled(r.daily_enabled))
      .catch(() => {});
  }, []);
  const toggle = async (on: boolean) => {
    setEnabled(on);
    setStatus('Saving…');
    try {
      const saved = await api.put<{ daily_enabled: boolean }>('/typing/settings/rewards', { daily_enabled: on });
      setEnabled(saved.daily_enabled);
      setStatus('Saved ✓');
    } catch (err) {
      setEnabled(!on);
      setStatus((err as Error).message);
    }
  };
  return (
    <section className="panel">
      <h2>⌨️ Typing</h2>
      <label className="typing-stars__toggle">
        <input type="checkbox" checked={enabled ?? true} disabled={enabled === null} onChange={(e) => toggle(e.target.checked)} />
        Show the 🏆 Daily Challenge — everyone types the same thing each day, with a family leaderboard (on the Typing page and
        the Family Board)
      </label>
      {status && <p className="hint">{status}</p>}
      <p className="hint">
        The ⭐ for each lesson and game: <Link to="/typing">Typing</Link> → ⭐ Stars.
      </p>
    </section>
  );
}
