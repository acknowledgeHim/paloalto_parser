import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import type { LimitStatus } from '../utils/limits.js';
import { MemberAvatar } from './MemberAvatar.js';

interface Activity {
  id: string;
  name: string;
  unit: string;
}
type Limits = Record<string, { times: number | null; minutes: number | null }>;
interface Settings {
  activities: Activity[];
  limits: Record<string, Limits>;
}

/**
 * ⏰ Parents: per kid, how many times and/or minutes a day each learning activity and game can be
 * used (blank = no limit, 0 = off). Something already started is always finished.
 */
export function DailyLimitSettings() {
  const { members, activeProfile } = useFamilyMembers();
  const kids = members.filter((m) => m.is_parent !== 1);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [kid, setKid] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { times: string; minutes: string }>>({});
  const [today, setToday] = useState<LimitStatus[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api.get<Settings>('/limits/settings').then(setSettings).catch((e) => setStatus((e as Error).message));
  }, []);
  useEffect(() => {
    if (!kid && kids.length) setKid(kids[0].id);
  }, [kid, kids]);
  useEffect(() => {
    if (!settings || !kid) return;
    const mine = settings.limits[kid] ?? {};
    const s = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
    setDraft(Object.fromEntries(settings.activities.map((a) => [a.id, { times: s(mine[a.id]?.times), minutes: s(mine[a.id]?.minutes) }])));
    api.get<LimitStatus[]>(`/limits/${kid}`).then(setToday).catch(() => setToday([]));
  }, [settings, kid]);

  if (!settings) return null;
  if (!kids.length) return null;
  const save = async () => {
    if (!kid) return;
    setStatus('Saving…');
    const limits = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, { times: v.times.trim() === '' ? null : Number(v.times), minutes: v.minutes.trim() === '' ? null : Number(v.minutes) }])
    );
    try {
      setSettings(await api.put<Settings>(`/limits/settings/${kid}`, { limits, acting_member_id: activeProfile?.id ?? null }));
      setStatus('Saved ✓');
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  const used = (id: string) => today.find((t) => t.id === id);
  const set = (id: string, k: 'times' | 'minutes', v: string) => setDraft((d) => ({ ...d, [id]: { ...d[id], [k]: v.replace(/[^0-9]/g, '') } }));

  return (
    <section className="panel">
      <h2>⏰ Daily limits</h2>
      <p className="hint">
        For each kid: how many times a day, and/or how many minutes a day, each one can be used. Leave blank for no limit; 0 turns it off for the day. Whatever
        they’ve started — a round, a lesson, a game — they always get to finish; the limit stops the next one. Minutes only count while the screen is being used.
      </p>
      <div className="limits__kids" role="tablist">
        {kids.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={kid === k.id} className={kid === k.id ? '' : 'secondary'} onClick={() => setKid(k.id)}>
            <MemberAvatar member={k} size={22} /> {k.name}
          </button>
        ))}
      </div>
      <div className="limits__table">
        <div className="limits__row limits__row--head">
          <span />
          <span>Times a day</span>
          <span>Minutes a day</span>
          <span>Today</span>
        </div>
        {settings.activities.map((a) => {
          const u = used(a.id);
          return (
            <div key={a.id} className="limits__row">
              <span>{a.name}</span>
              <input inputMode="numeric" value={draft[a.id]?.times ?? ''} onChange={(e) => set(a.id, 'times', e.target.value)} placeholder="no limit" aria-label={`${a.name}: ${a.unit}s a day`} />
              <input inputMode="numeric" value={draft[a.id]?.minutes ?? ''} onChange={(e) => set(a.id, 'minutes', e.target.value)} placeholder="no limit" aria-label={`${a.name}: minutes a day`} />
              <span className="hint">
                {u ? `${u.used_times} ${a.unit}${u.used_times === 1 ? '' : 's'} · ${u.used_minutes} min` : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="typing-stars__actions">
        <button type="button" onClick={() => void save()}>
          Save limits
        </button>
        {status && <span className="hint">{status}</span>}
      </div>
    </section>
  );
}
