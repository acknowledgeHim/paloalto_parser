import { useEffect, useState, type FormEvent } from 'react';
import { api, type FamilyMember } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { ConfirmButton } from '../components/ConfirmButton.js';

// ---- API shapes (server/src/routes/internet.ts) ----

interface MemberState {
  paused: boolean;
  reason: 'paused' | 'schedule' | 'allowed' | null;
  until: string | null;
  schedule_label: string | null;
  filtered: boolean;
  mode: 'open' | 'filtered' | 'approved';
}

interface OverviewMember extends Pick<FamilyMember, 'id' | 'name' | 'color' | 'avatar'> {
  is_parent: number;
  state: MemberState;
}

interface Device {
  id: string;
  client: string;
  name: string;
  family_member_id: string | null;
}

interface Schedule {
  id: string;
  family_member_id: string;
  label: string;
  days: string;
  start_time: string;
  end_time: string;
  enabled: number;
}

interface Site {
  id: string;
  domain: string;
  kind: 'allow' | 'block';
}

interface MemberSite {
  id: string;
  family_member_id: string;
  domain: string;
}

interface BlockedSite {
  site: string;
  examples: string[];
  count: number;
  last_seen: string;
  approved: boolean;
}

interface Overview {
  configured: boolean;
  pihole: {
    reachable: boolean;
    error: string | null;
    blocking?: string;
    queries_today?: number;
    blocked_today?: number;
    percent_blocked?: number;
    active_clients?: number;
  };
  sync: { at: string | null; error: string | null };
  gravity: { running: boolean; finished_at: string | null; error: string | null };
  members: OverviewMember[];
  devices: Device[];
  schedules: Schedule[];
  sites: Site[];
  member_sites: MemberSite[];
  filter_categories: Array<{ key: string; label: string }>;
  enabled_filter_categories: string[];
}

interface NetworkDevice {
  client: string;
  mac: string | null;
  ip: string | null;
  hostname: string | null;
  vendor: string | null;
  last_query: string | null;
}

interface AuthStatus {
  is_admin: boolean;
  admin_gate_active: boolean;
}

// ---- Formatting ----

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "3:30 PM" today, "Sat 7:00 AM" otherwise. */
function fmtUntil(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${DAY_NAMES[d.getDay()]} ${time}`;
}

/** "Sun–Thu", "Every day", "Weekends", or a plain list. */
function fmtDays(days: string): string {
  const set = days.split(',').filter(Boolean).map(Number).sort();
  const key = set.join(',');
  if (key === '0,1,2,3,4,5,6') return 'Every day';
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  if (key === '0,1,2,3,4') return 'Sun–Thu (school nights)';
  return set.map((d) => DAY_NAMES[d]).join(', ');
}

function statusText(s: MemberState): string {
  if (s.reason === 'paused') return s.until ? `Paused until ${fmtUntil(s.until)}` : 'Paused until resumed';
  if (s.reason === 'schedule') return `${s.schedule_label || 'Scheduled block'} until ${s.until ? fmtUntil(s.until) : '…'}`;
  if (s.reason === 'allowed') return `Allowed until ${s.until ? fmtUntil(s.until) : '…'}`;
  return 'Internet on';
}

// ---- Page ----

/**
 * Per-person internet controls, enforced by Pi-hole (server/src/services/internetControl.ts):
 * pause/resume, bedtime-style schedules, a kid web filter, and always-allowed/blocked sites.
 * Anyone can see who's paused and why; only a parent can change anything (same gate as Settings).
 */
export function InternetPage() {
  const { members, activeProfile } = useFamilyMembers();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null);

  const load = () => api.get<Overview>('/internet/overview').then(setOverview).catch((err) => setMessage({ kind: 'error', text: err.message }));

  useEffect(() => {
    load();
    // Keeps statuses current as schedules start/end and timed pauses run out.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get<AuthStatus>('/auth/status').then(setAuth).catch(() => setAuth(null));
  }, [activeProfile?.id]);

  const noParentYet = members.every((m) => m.is_parent !== 1);
  const canManage = Boolean(
    auth?.is_admin || (auth && !auth.admin_gate_active && (noParentYet || activeProfile?.is_parent === 1))
  );

  /** Runs a change, then reloads; a Pi-hole hiccup comes back as a warning (the change is saved).
   *  Resolves to whether the change itself went through, so a form only clears on success. */
  const act: Act = async (fn) => {
    setMessage(null);
    let ok = true;
    try {
      const result = await fn();
      if (result && result.warning) setMessage({ kind: 'warning', text: `Saved, but Pi-hole didn't take it yet: ${result.warning}` });
    } catch (err) {
      ok = false;
      setMessage({ kind: 'error', text: (err as Error).message });
    }
    await load();
    return ok;
  };

  if (!overview) return <div className="empty-state">Loading…</div>;

  if (!overview.configured) {
    return (
      <div className="internet-page">
        <h1>Internet</h1>
        <section className="panel">
          <p>
            Internet controls work through <strong>Pi-hole</strong>, which isn't connected yet. Set
            <code> PIHOLE_URL</code> and <code>PIHOLE_PASSWORD</code> in <code>.env</code> and restart —
            see <code>docs/PIHOLE_SETUP.md</code> for the whole setup, including your router.
          </p>
        </section>
      </div>
    );
  }

  const kids = overview.members.filter((m) => m.is_parent !== 1);
  const ph = overview.pihole;

  return (
    <div className="internet-page">
      <div className="internet-page__header">
        <h1>Internet</h1>
        {canManage && kids.length > 0 && (
          <div className="internet-page__header-actions">
            <button type="button" onClick={() => act(async () => { for (const k of kids) await api.post(`/internet/members/${k.id}/pause`, {}); })}>
              ⏸ Pause all kids
            </button>
            <button type="button" className="secondary" onClick={() => act(async () => { for (const k of kids) await api.post(`/internet/members/${k.id}/resume`, {}); })}>
              ▶ Resume all kids
            </button>
          </div>
        )}
      </div>

      <div className="internet-page__status hint">
        {ph.reachable ? (
          <>
            Pi-hole: <strong>{ph.blocking === 'enabled' ? 'blocking on' : `blocking ${ph.blocking}`}</strong> ·{' '}
            {ph.queries_today?.toLocaleString()} lookups today, {ph.percent_blocked?.toFixed(1)}% blocked ·{' '}
            {ph.active_clients} active device{ph.active_clients === 1 ? '' : 's'}
          </>
        ) : (
          <span className="internet-page__bad">Can't reach Pi-hole: {ph.error}</span>
        )}
        {overview.gravity.running && <> · Updating blocklists…</>}
      </div>
      {ph.reachable && (ph.active_clients ?? 0) <= 2 && (
        <div className="internet-page__notice">
          Pi-hole only sees {ph.active_clients} device{ph.active_clients === 1 ? '' : 's'}. That usually
          means your router is passing everyone's lookups along as its own, so per-person rules can't
          tell devices apart. See "Router setup" in docs/PIHOLE_SETUP.md.
        </div>
      )}
      {overview.sync.error && <div className="settings-login__error">Last sync with Pi-hole failed: {overview.sync.error}</div>}
      {overview.gravity.error && <div className="settings-login__error">Blocklist update failed: {overview.gravity.error}</div>}
      {message && (
        <div className={message.kind === 'error' ? 'settings-login__error' : 'internet-page__notice'}>{message.text}</div>
      )}
      {!canManage && (
        <p className="hint">Parents: pick your profile up top (and log in) to change any of this.</p>
      )}

      <div className="internet-page__people">
        {/* Kids always; a parent only once they have a device here (most won't have any rules). */}
        {overview.members.filter((m) => m.is_parent !== 1 || overview.devices.some((d) => d.family_member_id === m.id)).map((m) => (
          <PersonCard
            key={m.id}
            member={m}
            devices={overview.devices.filter((d) => d.family_member_id === m.id)}
            schedules={overview.schedules.filter((s) => s.family_member_id === m.id)}
            approvedSites={overview.member_sites.filter((s) => s.family_member_id === m.id)}
            canManage={canManage}
            act={act}
          />
        ))}
      </div>

      <DevicesSection overview={overview} canManage={canManage} act={act} />
      <FilterSection overview={overview} canManage={canManage} act={act} />
    </div>
  );
}

type Act = (fn: () => Promise<{ warning?: string | null } | void>) => Promise<boolean>;

// ---- One person ----

function PersonCard({
  member,
  devices,
  schedules,
  approvedSites,
  canManage,
  act,
}: {
  member: OverviewMember;
  devices: Device[];
  schedules: Schedule[];
  approvedSites: MemberSite[];
  canManage: boolean;
  act: Act;
}) {
  const [addingSchedule, setAddingSchedule] = useState(false);
  const s = member.state;
  const base = `/internet/members/${member.id}`;
  const blocked = s.paused;

  return (
    <section className={`panel internet-person ${blocked ? 'internet-person--paused' : ''}`}>
      <div className="internet-person__head">
        <MemberAvatar member={member} size={36} />
        <div className="internet-person__name">
          <strong>{member.name}</strong>
          <span className={`badge ${blocked ? 'internet-badge--off' : 'internet-badge--on'}`}>{statusText(s)}</span>
        </div>
      </div>

      {devices.length === 0 ? (
        <p className="hint">No devices yet — add them under Devices below.</p>
      ) : (
        <p className="hint">{devices.map((d) => d.name).join(' · ')}</p>
      )}

      {canManage && devices.length > 0 && (
        <div className="internet-person__actions">
          {blocked ? (
            <>
              <button type="button" onClick={() => act(() => api.post(`${base}/resume`, {}))}>▶ Resume</button>
              {s.reason === 'schedule' && (
                <>
                  <button type="button" className="secondary" onClick={() => act(() => api.post(`${base}/resume`, { minutes: 30 }))}>+30 min</button>
                  <button type="button" className="secondary" onClick={() => act(() => api.post(`${base}/resume`, { minutes: 60 }))}>+1 hr</button>
                </>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => act(() => api.post(`${base}/pause`, {}))}>⏸ Pause</button>
              <button type="button" className="secondary" onClick={() => act(() => api.post(`${base}/pause`, { minutes: 30 }))}>30 min</button>
              <button type="button" className="secondary" onClick={() => act(() => api.post(`${base}/pause`, { minutes: 60 }))}>1 hr</button>
              <button type="button" className="secondary" onClick={() => act(() => api.post(`${base}/pause`, { minutes: 120 }))}>2 hr</button>
            </>
          )}
        </div>
      )}

      <label className="internet-person__mode">
        <span>Web access</span>
        <select value={s.mode} disabled={!canManage} onChange={(e) => act(() => api.patch(base, { mode: e.target.value }))}>
          <option value="open">Open (ads blocked only)</option>
          <option value="filtered">Kid web filter</option>
          <option value="approved">Approved sites only</option>
        </select>
      </label>
      {s.mode === 'approved' && (
        <ApprovedSites memberId={member.id} sites={approvedSites} canManage={canManage} act={act} />
      )}

      <div className="internet-person__schedules">
        {schedules.map((sch) => (
          <div key={sch.id} className={`internet-schedule ${sch.enabled ? '' : 'internet-schedule--off'}`}>
            <span>
              <strong>{sch.label || 'No internet'}</strong> · {fmtDays(sch.days)} · {fmtClock(sch.start_time)}–{fmtClock(sch.end_time)}
            </span>
            {canManage && (
              <span className="internet-schedule__actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => act(() => api.put(`/internet/schedules/${sch.id}`, { ...sch, days: sch.days.split(',').map(Number), enabled: !sch.enabled }))}
                >
                  {sch.enabled ? 'Turn off' : 'Turn on'}
                </button>
                <ConfirmButton
                  label="✕"
                  ariaLabel={`Delete ${sch.label || 'schedule'}`}
                  confirmLabel="Delete?"
                  onConfirm={() => { act(() => api.delete(`/internet/schedules/${sch.id}`)); }}
                  className="task-card__edit"
                />
              </span>
            )}
          </div>
        ))}
        {canManage && !addingSchedule && (
          <button type="button" className="link-button" onClick={() => setAddingSchedule(true)}>+ Add a schedule (e.g. bedtime)</button>
        )}
        {canManage && addingSchedule && (
          <ScheduleForm
            onCancel={() => setAddingSchedule(false)}
            onSave={async (values) => {
              if (await act(() => api.post('/internet/schedules', { family_member_id: member.id, ...values }))) {
                setAddingSchedule(false);
              }
            }}
          />
        )}
      </div>
    </section>
  );
}

/** A kid's own approved list, plus "what's being blocked?" to find the extra domains a site needs
 *  (YouTube, for one, won't play without ytimg.com and googlevideo.com). */
function ApprovedSites({
  memberId,
  sites,
  canManage,
  act,
}: {
  memberId: string;
  sites: MemberSite[];
  canManage: boolean;
  act: Act;
}) {
  const [domain, setDomain] = useState('');
  const [blocked, setBlocked] = useState<BlockedSite[] | null>(null);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const base = `/internet/members/${memberId}/sites`;

  const loadBlocked = async () => {
    setLoadingBlocked(true);
    setBlockedError(null);
    try {
      setBlocked(await api.get<BlockedSite[]>(`/internet/members/${memberId}/blocked`));
    } catch (err) {
      setBlockedError((err as Error).message);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const approve = async (site: string) => {
    if (await act(() => api.post(base, { domain: site }))) {
      setBlocked((cur) => cur?.map((b) => (b.site === site ? { ...b, approved: true } : b)) ?? null);
    }
  };

  return (
    <div className="internet-approved">
      {sites.length === 0 ? (
        <p className="hint">Nothing approved yet — everything's blocked except the household "Always allowed" list.</p>
      ) : (
        <div className="internet-approved__chips">
          {sites.map((site) => (
            <span key={site.id} className="internet-approved__chip">
              {site.domain}
              {canManage && (
                <button type="button" aria-label={`Remove ${site.domain}`} onClick={() => act(() => api.delete(`${base}/${site.id}`))}>
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {canManage && (
        <>
          <form
            className="internet-approved__add"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(() => api.post(base, { domain }))) setDomain('');
            }}
          >
            <input placeholder="Approve a site (e.g. pbskids.org)" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <button type="submit" disabled={!domain.trim()}>Approve</button>
          </form>
          <button type="button" className="link-button" onClick={loadBlocked} disabled={loadingBlocked}>
            {loadingBlocked ? 'Checking…' : blocked ? '↻ Refresh what\'s being blocked' : "What's being blocked?"}
          </button>
          {blockedError && <p className="hint internet-page__bad">{blockedError}</p>}
          {blocked && blocked.length === 0 && <p className="hint">Nothing blocked recently.</p>}
          {blocked && blocked.length > 0 && (
            <>
              <p className="hint">
                Recent lookups that were blocked. A site that only half-works usually needs one or
                two of these too.
              </p>
              <ul className="internet-blocked-list">
                {blocked.map((b) => (
                  <li key={b.site}>
                    <span>
                      <strong>{b.site}</strong>{' '}
                      <span className="hint">
                        {b.count}× · {fmtUntil(b.last_seen)}
                        {b.examples.some((x) => x !== b.site) ? ` · ${b.examples.filter((x) => x !== b.site).join(', ')}` : ''}
                      </span>
                    </span>
                    {b.approved ? (
                      <span className="hint">Approved ✓</span>
                    ) : (
                      <button type="button" className="secondary" onClick={() => approve(b.site)}>Approve</button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ScheduleForm({
  onSave,
  onCancel,
}: {
  onSave: (v: { label: string; days: number[]; start_time: string; end_time: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('Bedtime');
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));
  const [start, setStart] = useState('21:00');
  const [end, setEnd] = useState('07:00');

  const toggleDay = (d: number) =>
    setDays((cur) => {
      const next = new Set(cur);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ label: label.trim(), days: [...days], start_time: start, end_time: end });
  };

  return (
    <form className="internet-schedule-form" onSubmit={submit}>
      <input placeholder="Name (e.g. Bedtime, Homework)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="internet-schedule-form__days">
        {DAY_NAMES.map((n, i) => (
          <button key={n} type="button" className={days.has(i) ? '' : 'secondary'} onClick={() => toggleDay(i)}>
            {n}
          </button>
        ))}
      </div>
      <div className="internet-schedule-form__times">
        <label>No internet from <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
        <label>until <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
      </div>
      <p className="hint">Days are when it starts — an end time earlier than the start runs to the next morning.</p>
      <div className="task-form__row">
        <button type="submit" disabled={days.size === 0}>Save</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ---- Devices ----

function DevicesSection({ overview, canManage, act }: { overview: Overview; canManage: boolean; act: Act }) {
  const [found, setFound] = useState<NetworkDevice[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [manualClient, setManualClient] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualOwner, setManualOwner] = useState('');

  const ownerName = (id: string | null) => overview.members.find((m) => m.id === id)?.name ?? 'Nobody';

  const find = async () => {
    setFinding(true);
    try {
      setFound(await api.get<NetworkDevice[]>('/internet/network-devices'));
    } catch {
      setFound([]);
    } finally {
      setFinding(false);
    }
  };

  const ownerSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!canManage}>
      <option value="">Nobody (no rules)</option>
      {overview.members.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );

  return (
    <section className="panel internet-section">
      <h2>Devices</h2>
      <p className="hint">
        Rules follow a person's devices. Phones and tablets often use a "private" Wi-Fi address that
        can change — turn that off for your home Wi-Fi on the kids' devices so they stay recognized.
      </p>
      {overview.devices.length === 0 && <p className="empty-state">No devices added yet.</p>}
      <ul className="internet-device-list">
        {overview.devices.map((d) => (
          <li key={d.id}>
            <span className="internet-device-list__name">
              <strong>{d.name}</strong> <span className="hint">{d.client}</span>
            </span>
            {canManage ? (
              <>
                {ownerSelect(d.family_member_id ?? '', (v) => act(() => api.patch(`/internet/devices/${d.id}`, { family_member_id: v || null })))}
                <ConfirmButton
                  label="✕"
                  ariaLabel={`Remove ${d.name}`}
                  confirmLabel={`Remove ${d.name}?`}
                  onConfirm={() => { act(() => api.delete(`/internet/devices/${d.id}`)); }}
                  className="task-card__edit"
                />
              </>
            ) : (
              <span className="hint">{ownerName(d.family_member_id)}</span>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <>
          <h3>Add a device</h3>
          <button type="button" className="secondary" onClick={find} disabled={finding}>
            {finding ? 'Looking…' : '🔎 Find devices Pi-hole has seen'}
          </button>
          {found && found.length === 0 && <p className="hint">Nothing new found — try adding one by hand below.</p>}
          {found && found.length > 0 && (
            <ul className="internet-device-list internet-device-list--found">
              {found.map((d) => (
                <FoundDeviceRow
                  key={d.client}
                  device={d}
                  ownerSelect={ownerSelect}
                  onAdd={async (name, owner) => {
                    if (await act(() => api.post('/internet/devices', { client: d.client, name, family_member_id: owner || null }))) {
                      setFound((cur) => cur?.filter((x) => x.client !== d.client) ?? null);
                    }
                  }}
                />
              ))}
            </ul>
          )}
          <form
            className="internet-manual-device"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(() => api.post('/internet/devices', { client: manualClient, name: manualName, family_member_id: manualOwner || null }))) {
                setManualClient('');
                setManualName('');
              }
            }}
          >
            <input placeholder="MAC (AA:BB:CC:DD:EE:FF) or IP" value={manualClient} onChange={(e) => setManualClient(e.target.value)} />
            <input placeholder="Name (e.g. Sam's iPad)" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            {ownerSelect(manualOwner, setManualOwner)}
            <button type="submit" disabled={!manualClient.trim() || !manualName.trim()}>Add</button>
          </form>
        </>
      )}
    </section>
  );
}

function FoundDeviceRow({
  device,
  ownerSelect,
  onAdd,
}: {
  device: NetworkDevice;
  ownerSelect: (value: string, onChange: (v: string) => void) => JSX.Element;
  onAdd: (name: string, owner: string) => Promise<void>;
}) {
  const [name, setName] = useState(device.hostname?.replace(/\.(lan|local|home)$/i, '') ?? '');
  const [owner, setOwner] = useState('');
  return (
    <li>
      <span className="internet-device-list__name">
        <strong>{device.hostname ?? device.vendor ?? 'Unknown device'}</strong>{' '}
        <span className="hint">
          {[device.ip, device.mac, device.vendor, device.last_query && `seen ${fmtUntil(device.last_query)}`].filter(Boolean).join(' · ')}
        </span>
      </span>
      <input placeholder="Name it" value={name} onChange={(e) => setName(e.target.value)} />
      {ownerSelect(owner, setOwner)}
      <button type="button" disabled={!name.trim()} onClick={() => onAdd(name.trim(), owner)}>Add</button>
    </li>
  );
}

// ---- Kid filter: categories and sites ----

function FilterSection({ overview, canManage, act }: { overview: Overview; canManage: boolean; act: Act }) {
  const enabled = new Set(overview.enabled_filter_categories);
  const toggle = (key: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(key);
    else next.delete(key);
    act(() => api.put('/internet/filter-categories', { keys: [...next] }));
  };

  return (
    <section className="panel internet-section">
      <h2>Kid web filter</h2>
      <p className="hint">Applies to kids set to "Kid web filter" above. Ad and tracker blocking applies to every device either way.</p>
      <div className="internet-filter-categories">
        {overview.filter_categories.map((c) => (
          <label key={c.key}>
            <input type="checkbox" checked={enabled.has(c.key)} disabled={!canManage} onChange={(e) => toggle(c.key, e.target.checked)} />
            Block {c.label.charAt(0).toLowerCase() + c.label.slice(1)}
          </label>
        ))}
      </div>

      <div className="internet-sites">
        <SiteList
          title="Always allowed"
          hint="Works for every kid even when filtered, paused, at bedtime, or on approved-sites-only — e.g. school sites."
          kind="allow"
          sites={overview.sites.filter((s) => s.kind === 'allow')}
          canManage={canManage}
          act={act}
        />
        <SiteList
          title="Blocked for kids"
          hint="Blocks the site and everything under it (www., m., …) for filtered kids."
          kind="block"
          sites={overview.sites.filter((s) => s.kind === 'block')}
          canManage={canManage}
          act={act}
        />
      </div>

      {canManage && (
        <p className="hint">
          Something off in Pi-hole (e.g. after reinstalling it)?{' '}
          <button type="button" className="link-button" onClick={() => act(() => api.post('/internet/repair'))}>
            Repair Pi-hole setup
          </button>
        </p>
      )}
    </section>
  );
}

function SiteList({
  title,
  hint,
  kind,
  sites,
  canManage,
  act,
}: {
  title: string;
  hint: string;
  kind: 'allow' | 'block';
  sites: Site[];
  canManage: boolean;
  act: Act;
}) {
  const [domain, setDomain] = useState('');
  return (
    <div>
      <h3>{title}</h3>
      <p className="hint">{hint}</p>
      {sites.length === 0 && <p className="hint">None.</p>}
      <ul className="internet-site-list">
        {sites.map((s) => (
          <li key={s.id}>
            <span>{s.domain}</span>
            {canManage && (
              <button type="button" className="link-button" aria-label={`Remove ${s.domain}`} onClick={() => act(() => api.delete(`/internet/sites/${s.id}`))}>
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <form
          className="task-form__row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act(() => api.post('/internet/sites', { domain, kind }))) setDomain('');
          }}
        >
          <input placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <button type="submit" disabled={!domain.trim()}>Add</button>
        </form>
      )}
    </div>
  );
}
