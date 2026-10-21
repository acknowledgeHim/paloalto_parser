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

/**
 * 🎞️ This week: the family's week as a little story — everyone's jobs, stars and prizes, the star
 * of the week, the gratitude jar, meals we voted on, who grew, and the week's photos. Plays by
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
      slides.push({
        key: `p-${p.id}`,
        ms: SLIDE_MS,
        body: (
          <div className="recap__person" style={{ ['--c' as string]: m.color }}>
            <DressedAvatar member={m} size={130} />
            <h2>{m.name}</h2>
            <p className="recap__big">
              <strong>{p.done}</strong> of {p.total} jobs · {pct}%
            </p>
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
                <span key={x}>🏆 {x}</span>
              ))}
              {p.rewards.map((x, k) => (
                <span key={k}>{x}</span>
              ))}
            </div>
            {p.top.length > 0 && <p className="recap__small">Most done: {p.top.map((t) => `${t.title}${t.n > 1 ? ` ×${t.n}` : ''}`).join(' · ')}</p>}
          </div>
        ),
      });
    }
    const ranked = week.people.filter((p) => p.total >= 3 && who(p.id) && who(p.id)!.is_parent !== 1).sort((a, b) => b.done / b.total - a.done / a.total || b.done - a.done);
    if (ranked[0]) {
      const m = who(ranked[0].id)!;
      slides.push({
        key: 'star',
        ms: SLIDE_MS,
        body: (
          <div className="recap__star">
            <div className="recap__kicker">🌟 Star of the week</div>
            <div className="recap__star-burst">
              <DressedAvatar member={m} size={150} />
            </div>
            <h2>{m.name}!</h2>
            <p className="recap__big">
              {ranked[0].done} of {ranked[0].total} jobs done
            </p>
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
