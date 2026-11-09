import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

/**
 * ⏰ Daily limits (server: services/dailyLimits.ts). A parent sets, per kid, how many times and/or
 * minutes a day each activity can be used. Whatever's been started always gets finished — only the
 * next start is stopped.
 */
export interface LimitStatus {
  id: string;
  name: string;
  unit: string;
  times: number | null;
  minutes: number | null;
  used_times: number;
  used_minutes: number;
  /** why the next one can't start today (null = it can) */
  over: string | null;
}

/** Today's limit and use for one activity. `reload()` after finishing something. */
export function useLimit(memberId: string | undefined, activity: string) {
  const [status, setStatus] = useState<LimitStatus | null>(null);
  const load = useCallback(() => {
    if (!memberId) return Promise.resolve(setStatus(null));
    return api
      .get<LimitStatus>(`/limits/${memberId}?activity=${encodeURIComponent(activity)}`)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [memberId, activity]);
  useEffect(() => {
    void load();
  }, [load]);
  return { status, setStatus, reload: load };
}

// Somebody touched, typed or clicked lately (time only counts while the screen is really in use).
let lastInput = Date.now();
if (typeof window !== 'undefined') {
  const mark = () => (lastInput = Date.now());
  for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart']) window.addEventListener(ev, mark, { passive: true, capture: true });
}

/**
 * ⏱️ While `active` (a round, lesson or game is on screen), tells the server every 30 s that it's
 * being used — only while the page is showing and someone's touched it in the last 2 minutes.
 */
export function useActivityClock(memberId: string | undefined, activity: string, active: boolean, onStatus?: (s: LimitStatus) => void) {
  const cb = useRef(onStatus);
  cb.current = onStatus;
  useEffect(() => {
    if (!memberId || !active) return;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const secs = Math.min(30, Math.round((now - last) / 1000));
      last = now;
      if (document.visibilityState !== 'visible' || now - lastInput > 120_000) return;
      api
        .post<LimitStatus>(`/limits/${memberId}/beat`, { activity, seconds: secs, acting_member_id: memberId })
        .then((s) => cb.current?.(s))
        .catch(() => {});
    };
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [memberId, activity, active]);
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** "⏰ 2 of 3 rounds left today · 12 of 30 minutes left" — or why not today. Nothing when there's no limit. */
export function LimitNote({ status }: { status: LimitStatus | null }) {
  if (!status) return null;
  if (status.over) return <p className="limit-note is-over">{status.over}</p>;
  const bits: string[] = [];
  if (status.times !== null) bits.push(`${Math.max(0, status.times - status.used_times)} of ${plural(status.times, status.unit)} left today`);
  if (status.minutes !== null) bits.push(`${Math.max(0, status.minutes - status.used_minutes)} of ${status.minutes} minutes left`);
  if (!bits.length) return null;
  return <p className="limit-note">⏰ {bits.join(' · ')}</p>;
}
