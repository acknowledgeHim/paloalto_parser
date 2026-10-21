import { useEffect, useState } from 'react';
import { api, type FamilyMember, type HeightRow } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { DressedAvatar } from '../components/DressedAvatar.js';
import { shrinkPhoto } from '../utils/pictures.js';
import { localDate } from '../utils/daylight.js';

export const feetInches = (n: number) => {
  const ft = Math.floor(n / 12);
  const inch = Math.round((n - ft * 12) * 4) / 4;
  return `${ft}′ ${inch}″`;
};
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/**
 * 📏 Height chart: measure everyone now and then (with a photo if you like) and watch them grow —
 * a door frame with everyone's latest mark, and a growth chart over the years.
 */
export function HeightsPage() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [rows, setRows] = useState<HeightRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [photoOf, setPhotoOf] = useState<HeightRow | null>(null);
  const load = () => api.get<HeightRow[]>('/heights').then(setRows).catch(console.error);
  useEffect(() => {
    load();
  }, []);
  const people = members.filter((m) => rows.some((r) => r.family_member_id === m.id));
  const latest = (m: FamilyMember) => rows.filter((r) => r.family_member_id === m.id).pop();
  const hide = async (r: HeightRow) => {
    if (!window.confirm('Take this measurement off the chart?')) return;
    await api.post(`/heights/${r.id}/hide`, { acting_member_id: activeProfile?.id ?? null }).catch((e) => window.alert(e.message));
    load();
  };

  return (
    <div className="heights-page">
      <div className="family-board__head">
        <h1>📏 Height chart</h1>
        {(isParent || activeProfile) && !adding && (
          <button type="button" onClick={() => setAdding(true)}>
            ＋ Measure someone
          </button>
        )}
      </div>
      {adding && (
        <AddHeight
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}
      {rows.length === 0 && !adding && <div className="empty-state">No measurements yet — stand against the wall and ＋ Measure someone!</div>}
      {rows.length > 0 && (
        <div className="heights__top">
          <DoorFrame people={people.map((m) => ({ member: m, inches: latest(m)!.inches }))} />
          <section className="panel heights__chart-panel">
            <h2>Growing up</h2>
            <GrowthChart rows={rows} members={people} />
          </section>
        </div>
      )}
      <div className="family-board__columns">
        {people.map((m) => {
          const mine = rows.filter((r) => r.family_member_id === m.id);
          const first = mine[0];
          const last = mine[mine.length - 1];
          return (
            <section key={m.id} className="panel person-column">
              <h2>
                <span className="person-column__link">
                  <MemberAvatar member={m} /> {m.name}
                </span>
              </h2>
              <div className="heights__now">{feetInches(last.inches)}</div>
              {mine.length > 1 && (
                <div className="hint">
                  Grew {Math.round((last.inches - first.inches) * 4) / 4}″ since {shortDate(first.date)}
                </div>
              )}
              <ul className="heights__list">
                {[...mine].reverse().map((r, i, all) => {
                  const prev = all[i + 1];
                  return (
                    <li key={r.id}>
                      <span>
                        <strong>{feetInches(r.inches)}</strong> <span className="hint">{new Date(`${r.date}T12:00:00`).toLocaleDateString()}</span>
                        {prev && r.inches > prev.inches && <span className="heights__grew"> +{Math.round((r.inches - prev.inches) * 4) / 4}″</span>}
                        {r.note && <span className="hint"> · {r.note}</span>}
                      </span>
                      {r.has_photo === 1 && (
                        <button type="button" className="link-button" onClick={() => setPhotoOf(r)}>
                          📷
                        </button>
                      )}
                      {isParent && (
                        <button type="button" className="link-button" aria-label="Take off the chart" onClick={() => hide(r)}>
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {photoOf && (
        <div className="modal-overlay" onClick={() => setPhotoOf(null)}>
          <img className="heights__photo" src={`/api/heights/${photoOf.id}/photo`} alt="" />
        </div>
      )}
    </div>
  );
}

/** Everyone standing against a door frame, with a pencil mark at their height. */
function DoorFrame({ people }: { people: Array<{ member: FamilyMember; inches: number }> }) {
  const top = Math.max(72, ...people.map((p) => p.inches + 6));
  const ticks = Array.from({ length: Math.floor(top / 6) + 1 }, (_, i) => i * 6);
  return (
    <section className="panel heights__door" aria-label="Door frame">
      <div className="heights__frame">
        {ticks.map((t) => (
          <div key={t} className="heights__tick" style={{ bottom: `${(t / top) * 100}%` }}>
            <span>{t % 12 === 0 ? `${t / 12}′` : ''}</span>
          </div>
        ))}
        {people.map((p, i) => (
          <div key={p.member.id} className="heights__mark" style={{ bottom: `${(p.inches / top) * 100}%`, ['--c' as string]: p.member.color, left: `${18 + ((i * 63) % 60)}%` }}>
            <DressedAvatar member={p.member} size={30} />
            <span className="heights__mark-label">
              {p.member.name} {feetInches(p.inches)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Height over time, a line per person. */
function GrowthChart({ rows, members }: { rows: HeightRow[]; members: FamilyMember[] }) {
  const W = 640;
  const H = 300;
  const pad = { l: 44, r: 16, t: 12, b: 28 };
  const times = rows.map((r) => Date.parse(r.date));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times, t0 + 86400_000 * 30);
  const lo = Math.floor(Math.min(...rows.map((r) => r.inches)) / 6) * 6 - 2;
  const hi = Math.ceil(Math.max(...rows.map((r) => r.inches)) / 6) * 6 + 2;
  const x = (d: string) => pad.l + ((Date.parse(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (n: number) => H - pad.b - ((n - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const years = [];
  for (let yr = new Date(t0).getFullYear() + 1; yr <= new Date(t1).getFullYear(); yr++) years.push(yr);
  const gridIn = [];
  for (let n = Math.ceil(lo / 6) * 6; n <= hi; n += 6) gridIn.push(n);
  return (
    <svg className="heights__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Growth chart">
      {gridIn.map((n) => (
        <g key={n}>
          <line x1={pad.l} x2={W - pad.r} y1={y(n)} y2={y(n)} className="heights__grid" />
          <text x={pad.l - 6} y={y(n) + 4} textAnchor="end" className="heights__axis">
            {feetInches(n).replace(' 0″', '')}
          </text>
        </g>
      ))}
      {years.map((yr) => {
        const xx = x(`${yr}-01-01`);
        return (
          <g key={yr}>
            <line x1={xx} x2={xx} y1={pad.t} y2={H - pad.b} className="heights__grid" />
            <text x={xx} y={H - 8} textAnchor="middle" className="heights__axis">
              {yr}
            </text>
          </g>
        );
      })}
      {members.map((m) => {
        const mine = rows.filter((r) => r.family_member_id === m.id);
        return (
          <g key={m.id} style={{ color: m.color }}>
            <polyline points={mine.map((r) => `${x(r.date)},${y(r.inches)}`).join(' ')} className="heights__line" />
            {mine.map((r) => (
              <circle key={r.id} cx={x(r.date)} cy={y(r.inches)} r={4.5} className="heights__dot">
                <title>
                  {m.name}: {feetInches(r.inches)} on {r.date}
                </title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function AddHeight({ onDone }: { onDone: () => void }) {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const choices = isParent ? members : members.filter((m) => m.id === activeProfile?.id);
  const [who, setWho] = useState(choices.find((m) => m.is_parent !== 1)?.id ?? choices[0]?.id ?? '');
  const [date, setDate] = useState(localDate());
  const [ft, setFt] = useState('4');
  const [inch, setInch] = useState('0');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    try {
      await api.post('/heights', {
        family_member_id: who,
        date,
        inches: Number(ft) * 12 + Number(inch),
        note,
        photo,
        acting_member_id: activeProfile?.id ?? null,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <section className="panel">
      <h2>📏 New measurement</h2>
      <div className="task-form__row">
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who">
          {choices.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
      </div>
      <div className="task-form__row">
        <input type="number" min={1} max={7} value={ft} onChange={(e) => setFt(e.target.value)} style={{ width: '5em' }} aria-label="Feet" />
        <span>ft</span>
        <input type="number" min={0} max={11.75} step={0.25} value={inch} onChange={(e) => setInch(e.target.value)} style={{ width: '6em' }} aria-label="Inches" />
        <span>in</span>
      </div>
      <input placeholder='Note (optional) — e.g. "first day of 3rd grade"' value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="secondary heights__photo-pick">
        📷 {photo ? 'Photo added ✓' : 'Add a photo (optional)'}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) shrinkPhoto(f).then(setPhoto).catch((err) => setError(err.message));
          }}
        />
      </label>
      {error && <div className="settings-login__error">{error}</div>}
      <div className="task-form__row">
        <button type="button" onClick={save}>
          Save
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </section>
  );
}
