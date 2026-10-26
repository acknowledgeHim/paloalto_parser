import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Time online for one person (Internet page → 📈 Time online, and their own profile page): minutes
 * per day with their daily limit as a line, what time of day they're on, and time on each site.
 * Times are estimates from Pi-hole's lookups — see services/internetUsage.ts.
 */
export interface UsageHistory {
  member_id: string;
  name: string;
  from: string;
  to: string;
  limit: { weekday: number | null; weekend: number | null };
  days: Array<{ day: string; minutes: number }>;
  total_minutes: number;
  hours: number[];
  sites: Array<{ site: string; minutes: number; lookups: number }>;
  blocked: Array<{ site: string; blocked: number }>;
  detail_since: string | null;
  has_devices: boolean;
}

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
}

export function fmtUsage(m: number): string {
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

const asDate = (day: string) => new Date(`${day}T12:00:00`);
const isWeekend = (day: string) => [0, 6].includes(asDate(day).getDay());

function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function InternetUsageCharts({
  memberId,
  color = 'var(--accent)',
  hideWhenUnused = false,
  onLoaded,
}: {
  memberId: string;
  color?: string;
  /** Profile page: show nothing for someone with no devices and no time recorded. */
  hideWhenUnused?: boolean;
  onLoaded?: (h: UsageHistory | null) => void;
}) {
  const [range, setRange] = useState(7);
  /** A day picked by tapping its bar — the hours and sites below are then just for that day. */
  const [day, setDay] = useState<string | null>(null);
  const [history, setHistory] = useState<UsageHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllSites, setShowAllSites] = useState(false);

  const from = day ?? daysAgo(range - 1);
  const to = day ?? localDay(new Date());

  useEffect(() => {
    let live = true;
    api
      .get<UsageHistory>(`/internet/members/${memberId}/history?from=${from}&to=${to}`)
      .then((h) => {
        if (!live) return;
        setHistory(h);
        setError(null);
        onLoaded?.(h);
      })
      .catch((err) => {
        if (!live) return;
        setError((err as Error).message);
        onLoaded?.(null);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, from, to]);

  // Whole-range figures stay put while a single day is picked, so the day bars don't vanish.
  const [rangeHistory, setRangeHistory] = useState<UsageHistory | null>(null);
  useEffect(() => {
    if (!day && history && history.from === from && history.to === to) setRangeHistory(history);
  }, [history, day, from, to]);

  if (error) return hideWhenUnused ? null : <p className="hint">{error}</p>;
  if (!history) return hideWhenUnused ? null : <p className="hint">Loading…</p>;
  const days = (rangeHistory ?? history).days;
  if (hideWhenUnused && !history.has_devices && !days.some((d) => d.minutes > 0)) return null;

  const limitFor = (d: string) => (isWeekend(d) ? history.limit.weekend : history.limit.weekday);
  const maxDay = Math.max(30, ...days.map((d) => d.minutes), ...days.map((d) => limitFor(d.day) ?? 0));
  const rangeTotal = days.reduce((n, d) => n + d.minutes, 0);
  const busiest = days.reduce<{ day: string; minutes: number } | null>((b, d) => (!b || d.minutes > b.minutes ? d : b), null);
  const maxHour = Math.max(1, ...history.hours);
  const sites = showAllSites ? history.sites : history.sites.slice(0, 10);
  const maxSite = Math.max(1, ...history.sites.map((s) => s.minutes));
  const labelEvery = days.length > 31 ? 14 : days.length > 10 ? 5 : 1;
  const dayName = (d: string) =>
    asDate(d).toLocaleDateString([], days.length > 10 ? { month: 'numeric', day: 'numeric' } : { weekday: 'short' });

  return (
    <div className="usage">
      <div className="usage__ranges" role="group" aria-label="How far back">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            className={!day && range === r.days ? '' : 'secondary'}
            onClick={() => {
              setDay(null);
              setRange(r.days);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="usage__summary">
        <div>
          <strong>{fmtUsage(rangeTotal)}</strong>
          <span className="hint">online{range === 1 ? ' today' : ` in ${range} days`}</span>
        </div>
        {range > 1 && (
          <div>
            <strong>{fmtUsage(Math.round(rangeTotal / Math.max(1, days.length)))}</strong>
            <span className="hint">a day on average</span>
          </div>
        )}
        {range > 1 && busiest && busiest.minutes > 0 && (
          <div>
            <strong>{fmtUsage(busiest.minutes)}</strong>
            <span className="hint">most — {asDate(busiest.day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>

      {range > 1 && (
        <>
          <div className="usage__days" style={{ ['--usage-color' as string]: color }}>
            {days.map((d, i) => {
              const limit = limitFor(d.day);
              const over = limit !== null && d.minutes > limit;
              return (
                <button
                  key={d.day}
                  type="button"
                  className={`usage__day ${day === d.day ? 'usage__day--picked' : ''}`}
                  title={`${d.day}: ${fmtUsage(d.minutes)}${limit !== null ? ` (limit ${fmtUsage(limit)})` : ''} — tap for that day`}
                  aria-label={`${d.day}: ${fmtUsage(d.minutes)}`}
                  onClick={() => setDay(day === d.day ? null : d.day)}
                >
                  {days.length <= 14 && <span className="usage__value">{d.minutes ? fmtUsage(d.minutes) : ''}</span>}
                  <span className="usage__track">
                    {limit !== null && <span className="usage__limit" style={{ bottom: `${(limit / maxDay) * 100}%` }} />}
                    {d.minutes > 0 && (
                      <span
                        className={`usage__bar ${over ? 'usage__bar--over' : ''}`}
                        style={{ height: `${Math.max(3, (d.minutes / maxDay) * 100)}%` }}
                      />
                    )}
                  </span>
                  <span className="usage__label">{i % labelEvery === 0 || days.length - 1 === i ? dayName(d.day) : ''}</span>
                </button>
              );
            })}
          </div>
          <p className="hint usage__legend">
            {(history.limit.weekday !== null || history.limit.weekend !== null) && <>Dashed line = daily limit (red = went over). </>}
            Tap a day to see just that day.
          </p>
        </>
      )}

      {day && (
        <p className="usage__picked">
          <strong>{asDate(day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</strong> —{' '}
          {fmtUsage(history.total_minutes)} online{' '}
          <button type="button" className="link-button" onClick={() => setDay(null)}>
            ✕ back to {range} days
          </button>
        </p>
      )}

      <h3 className="usage__heading">🕒 Time of day</h3>
      {history.hours.some((m) => m > 0) ? (
        <div className="usage__hours" style={{ ['--usage-color' as string]: color }}>
          {history.hours.map((m, h) => (
            <div key={h} className="usage__hour" title={`${hourLabel(h)}: ${fmtUsage(m)}`}>
              <span className="usage__track">
                {m > 0 && <span className="usage__bar" style={{ height: `${Math.max(4, (m / maxHour) * 100)}%` }} />}
              </span>
              <span className="usage__label">{h % 3 === 0 ? hourLabel(h) : ''}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint">Nothing yet{history.detail_since ? '' : ' — this starts filling in from now on'}.</p>
      )}

      <h3 className="usage__heading">🌐 Time on each site</h3>
      {history.sites.length === 0 ? (
        <p className="hint">Nothing yet{history.detail_since ? '' : ' — this starts filling in from now on'}.</p>
      ) : (
        <>
          <ul className="usage__sites">
            {sites.map((s) => (
              <li key={s.site}>
                <span className="usage__site-name">{s.site}</span>
                <span className="usage__site-bar">
                  <span style={{ width: `${(s.minutes / maxSite) * 100}%`, background: color }} />
                </span>
                <span className="usage__site-time">{s.minutes ? fmtUsage(s.minutes) : <span className="hint">{s.lookups} visits</span>}</span>
              </li>
            ))}
          </ul>
          {history.sites.length > 10 && (
            <button type="button" className="link-button" onClick={() => setShowAllSites((v) => !v)}>
              {showAllSites ? 'Show fewer' : `Show all ${history.sites.length}`}
            </button>
          )}
        </>
      )}
      {history.blocked.length > 0 && (
        <details className="usage__blocked">
          <summary>🚫 Blocked {history.blocked.reduce((n, b) => n + b.blocked, 0)} times</summary>
          <ul>
            {history.blocked.map((b) => (
              <li key={b.site}>
                {b.site} <span className="hint">×{b.blocked}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="hint">
        Estimates from the websites each device looks up. A minute can count for two sites at once (a video and a chat).
        {history.detail_since
          ? ` Time per site and time of day are kept from ${asDate(history.detail_since).toLocaleDateString()} on.`
          : ''}
      </p>
    </div>
  );
}
