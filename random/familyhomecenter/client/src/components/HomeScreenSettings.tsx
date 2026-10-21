import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { OPEN_BRIEFING } from './MorningBriefing.js';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });

/** Settings → ☀️ Wall screen: the morning briefing (on/off and its hours) and the weekend recap. */
export function HomeScreenSettings() {
  const [s, setS] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<Record<string, string>>('/settings').then(setS).catch(() => setS({}));
  }, []);
  const save = async (patch: Record<string, string>) => {
    setError(null);
    setS((x) => ({ ...(x ?? {}), ...patch }));
    try {
      setS(await api.patch<Record<string, string>>('/settings', patch));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const on = s?.morning_briefing === '1';
  return (
    <section className="panel">
      <h2>☀️ Wall screen</h2>
      <label className="privacy-toggle">
        <input type="checkbox" checked={on} disabled={!s} onChange={(e) => save({ morning_briefing: e.target.checked ? '1' : '' })} />
        <span>
          <strong>Morning briefing</strong>
          <span className="hint">
            {' '}— the first time someone wakes the wall screen in the morning: the weather (umbrella? jacket?), everyone's first jobs, today's
            calendar and meals, and the notes up, with 🔊 to read it out loud. Once a morning.
          </span>
        </span>
      </label>
      {on && (
        <div className="task-form__row">
          <span>Between</span>
          <select value={s?.morning_briefing_start || '5'} onChange={(e) => save({ morning_briefing_start: e.target.value })} aria-label="From">
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <span>and</span>
          <select value={s?.morning_briefing_end || '10'} onChange={(e) => save({ morning_briefing_end: e.target.value })} aria-label="Until">
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={() => window.dispatchEvent(new Event(OPEN_BRIEFING))}>
            👀 Show it now
          </button>
        </div>
      )}
      <label className="privacy-toggle">
        <input type="checkbox" checked={s?.recap_off !== '1'} disabled={!s} onChange={(e) => save({ recap_off: e.target.checked ? '' : '1' })} />
        <span>
          <strong>🎞️ Weekly recap on the weekend screensaver</strong>
          <span className="hint"> — on Saturdays and Sundays the screensaver plays "Our week" every so often between photos.</span>
        </span>
      </label>
      {error && <div className="settings-login__error">{error}</div>}
    </section>
  );
}
