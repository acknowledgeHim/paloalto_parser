import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { DressedAvatar } from './DressedAvatar.js';
import { MemberAvatar } from './MemberAvatar.js';

interface FamilyWeek {
  start: string;
  end: string;
  people: Array<{
    id: string;
    done: number;
    total: number;
    days: Array<{ date: string; done: number; total: number }>;
    stars: number;
    money: number;
    prizes: string[];
    rewards: string[];
    top: Array<{ title: string; n: number }>;
  }>;
  gratitude: Array<{ family_member_id: string; text: string }>;
  meals: Array<{ title: string; emoji: string | null; date: string }>;
  heights: Array<{ family_member_id: string; inches: number; date: string }>;
  journalDays: number;
}

const SLIDE_MS = 6500;
const PHOTO_MS = 3500;
const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });

const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });

/**
 * Something nice to say about each person's own week — never compared with anyone else's: a
 * headline for how it went, and a few shout-outs (days they finished everything, their best day,
 * getting stronger as the week went on, the job they kept at).
 */
export function cheerFor(p: FamilyWeek['people'][number]): { headline: string; shoutouts: string[] } {
  const pct = p.total ? p.done / p.total : 0;
  const headline =
    pct >= 0.9
      ? '🌟 Superstar week!'
      : pct >= 0.7
        ? '💪 Awesome effort!'
        : pct >= 0.4
          ? '👍 Nice work this week!'
          : p.done > 0
            ? '🌱 Every job counts — great start!'
            : '😊 Next week is a fresh start!';
  const out: string[] = [];
  const fullDays = p.days.filter((d) => d.total > 0 && d.done === d.total).length;
  if (fullDays) out.push(`✅ Finished everything on ${fullDays} day${fullDays === 1 ? '' : 's'}`);
  const best = [...p.days].sort((a, b) => b.done - a.done)[0];
  if (best && best.done >= 2) out.push(`🏅 Best day: ${dayName(best.date)} — ${best.done} jobs`);
  const half = (ds: typeof p.days) => ds.reduce((n, d) => n + d.done, 0) / Math.max(1, ds.length);
  if (half(p.days.slice(4)) > half(p.days.slice(0, 3)) && p.done >= 3) out.push('📈 Got stronger as the week went on');
  const kept = p.top.find((t) => t.n >= 2);
  if (kept) out.push(`🔁 Kept at it: ${kept.title} ×${kept.n}`);
  if (!out.length && p.done) out.push(`✨ ${p.done} job${p.done === 1 ? '' : 's'} done — thank you!`);
  return { headline, shoutouts: out.slice(0, 3) };
}

/** How much of their week got done, as a ring that fills up. */
function Ring({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="recap__ring" viewBox="0 0 84 84" aria-label={`${pct}% done`}>
      <circle cx="42" cy="42" r={r} className="recap__ring-bg" />
      <circle cx="42" cy="42" r={r} className="recap__ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      <text x="42" y="47" textAnchor="middle">
        {pct}%
      </text>
    </svg>
  );
}

/**
 * 🎞️ This week: the family's week as a little story — everyone's own week with something nice to say
 * about it (never a ranking), the gratitude jar, meals we voted on, who grew, and the week's photos. Plays by
 * itself (the weekend screensaver), or step through it on Fun ▾ → 🎞️ This week.
 */
export function RecapStory({ fullScreen = false, onDone, onExit }: { fullScreen?: boolean; onDone?: () => void; onExit?: () => void }) {
  const { members } = useFamilyMembers();
  const [week, setWeek] = useState<FamilyWeek | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string }>>([]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    api.get<FamilyWeek>('/reports/family-week').then(setWeek).catch(() => onDone?.());
    api.get<Array<{ id: string }>>('/photos/recent?days=7').then((p) => setPhotos(p.slice(0, 10))).catch(() => setPhotos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slides: Array<{ key: string; ms: number; body: ReactNode }> = [];
  if (week) {
    const who = (id: string) => members.find((m) => m.id === id) ?? null;
    const totalDone = week.people.reduce((n, p) => n + p.done, 0);
    slides.push({
      key: 'title',
      ms: SLIDE_MS,
      body: (
        <div className="recap__title">
          <div className="recap__kicker">🎞️ Our week</div>
          <h1>
            {shortDay(week.start)} – {shortDay(week.end)}
          </h1>
          <div className="recap__avatars">
            {members.map((m) => (
              <DressedAvatar key={m.id} member={m} size={64} />
            ))}
          </div>
          <p className="recap__big">
            <strong>{totalDone}</strong> jobs done together 💪
          </p>
        </div>
      ),
    });
    for (const p of week.people) {
      const m = who(p.id);
      if (!m) continue;
      const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      const cheer = cheerFor(p);
      slides.push({
        key: `p-${p.id}`,
        ms: SLIDE_MS,
        body: (
          <div className="recap__person" style={{ ['--c' as string]: m.color }}>
            <DressedAvatar member={m} size={130} />
            <h2>{m.name}</h2>
            <div className="recap__cheer">{cheer.headline}</div>
            <div className="recap__status">
              <Ring pct={pct} />
              <p className="recap__big">
                <strong>{p.done}</strong> of {p.total} jobs
              </p>
            </div>
            <div className="recap__bars">
              {p.days.map((d) => (
                <div key={d.date} className="recap__bar">
                  <div className="recap__bar-fill" style={{ height: `${d.total ? (d.done / d.total) * 100 : 0}%` }} />
                  <span>{weekday(d.date)}</span>
                </div>
              ))}
            </div>
            <div className="recap__chips">
              {p.stars > 0 && <span>+{p.stars} ⭐</span>}
              {p.money > 0 && <span>+${p.money.toFixed(2)}</span>}
              {p.prizes.map((x) => (
                <span key={x}>{x}</span>
              ))}
              {p.rewards.map((x, k) => (
                <span key={k}>{x}</span>
              ))}
            </div>
            {cheer.shoutouts.length > 0 && (
              <ul className="recap__shoutouts">
                {cheer.shoutouts.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        ),
      });
    }
    if (week.gratitude.length) {
      slides.push({
        key: 'jar',
        ms: SLIDE_MS + 1500,
        body: (
          <div className="recap__list">
            <div className="recap__kicker">🫙 We were thankful for…</div>
            <div className="recap__slips">
              {week.gratitude.slice(-8).map((g, k) => (
                <div key={k} className="recap__slip" style={{ rotate: `${((k * 37) % 7) - 3}deg` }}>
                  “{g.text}”
                  <span>
                    <MemberAvatar member={who(g.family_member_id)} size={20} /> {who(g.family_member_id)?.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ),
      });
    }
    if (week.meals.length || week.heights.length) {
      slides.push({
        key: 'more',
        ms: SLIDE_MS,
        body: (
          <div className="recap__list">
            {week.meals.length > 0 && (
              <>
                <div className="recap__kicker">🗳️ We voted for…</div>
                <div className="recap__chips recap__chips--big">
                  {week.meals.map((m, k) => (
                    <span key={k}>
                      {m.emoji ?? '🍽️'} {m.title}
                    </span>
                  ))}
                </div>
              </>
            )}
            {week.heights.length > 0 && (
              <>
                <div className="recap__kicker">📏 Growing!</div>
                <div className="recap__chips recap__chips--big">
                  {week.heights.map((h, k) => (
                    <span key={k}>
                      {who(h.family_member_id)?.name}: {Math.floor(h.inches / 12)}′ {Math.round((h.inches % 12) * 4) / 4}″
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ),
      });
    }
    photos.forEach((p, k) =>
      slides.push({
        key: `ph-${p.id}`,
        ms: PHOTO_MS,
        body: (
          <div className="recap__photo">
            {k === 0 && <div className="recap__kicker recap__kicker--over">📷 This week's pictures</div>}
            <img src={`/api/photos/${p.id}/image`} alt="" />
          </div>
        ),
      })
    );
    slides.push({
      key: 'end',
      ms: 4000,
      body: (
        <div className="recap__title">
          <h1>See you next week! 👋</h1>
          {week.journalDays > 0 && <p className="recap__small">📔 {week.journalDays} journal pages written this week</p>}
        </div>
      ),
    });
  }

  const last = slides.length - 1;
  useEffect(() => {
    if (!week || paused || !slides[i]) return;
    const t = setTimeout(() => {
      if (i < last) setI(i + 1);
      else if (onDone) onDone();
      else setPaused(true);
    }, slides[i].ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, week, paused, slides.length]);

  if (!week) return <div className={`recap ${fullScreen ? 'recap--full' : ''}`} onClick={onExit} />;
  const slide = slides[Math.min(i, last)];
  return (
    <div className={`recap ${fullScreen ? 'recap--full' : ''} ${paused ? 'recap--paused' : ''}`} onClick={onExit}>
      <div className="recap__progress">
        {slides.map((s, k) => (
          <span key={s.key} className={k < i ? 'recap__seg recap__seg--done' : k === i ? 'recap__seg recap__seg--now' : 'recap__seg'} style={k === i ? { animationDuration: `${s.ms}ms` } : undefined} />
        ))}
      </div>
      <div className="recap__slide" key={slide.key}>
        {slide.body}
      </div>
      {!fullScreen && (
        <div className="recap__controls">
          <button type="button" className="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
            ‹ Back
          </button>
          <button type="button" className="secondary" onClick={() => setPaused(!paused)}>
            {paused ? '▶️ Play' : '⏸ Pause'}
          </button>
          <button type="button" className="secondary" onClick={() => (i < last ? setI(i + 1) : (setI(0), setPaused(false)))}>
            {i < last ? 'Next ›' : '↻ Again'}
          </button>
        </div>
      )}
    </div>
  );
}

export function RecapPage() {
  return (
    <div className="recap-page">
      <h1>🎞️ This week</h1>
      <RecapStory />
    </div>
  );
}
