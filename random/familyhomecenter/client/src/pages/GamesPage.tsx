import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface ShelfGame {
  id: string;
  emoji: string;
  name: string;
  stars: number;
  blurb: string;
  unlocked: boolean;
  best: number | null;
}
interface Shelf {
  star_balance: number;
  plays_free: boolean;
  games: ShelfGame[];
}

/**
 * 🎮 Games: each game is unlocked once with Prize Bank stars, then played as much as you like.
 * Parents play free, and can unlock (or refund) a game for a kid.
 */
export function GamesPage() {
  const { members, activeProfile, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const kids = members.filter((m) => m.is_parent !== 1);
  const [shelves, setShelves] = useState<Record<string, Shelf>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const people = activeProfile ? [activeProfile, ...(isParent ? kids.filter((k) => k.id !== activeProfile.id) : [])] : isParent ? kids : [];
  const load = () =>
    Promise.all(people.map((p) => api.get<Shelf>(`/games?member=${p.id}`).then((s) => [p.id, s] as const)))
      .then((all) => setShelves(Object.fromEntries(all)))
      .catch((e) => setError((e as Error).message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id, members.length]);

  const act = async (path: string, memberId: string, gameId: string) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.post<Shelf>(`/games/${memberId}/${path}`, { game_id: gameId, acting_member_id: activeProfile?.id ?? null });
      setShelves((all) => ({ ...all, [memberId]: s }));
      void refresh(); // star balances
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mine = activeProfile ? shelves[activeProfile.id] : undefined;

  return (
    <div className="games-page">
      <h1>🎮 Games</h1>
      {!activeProfile && <p className="hint">Pick who's playing (your name, up top) to play.</p>}

      {activeProfile && mine && (
        <>
          <p className="hint">
            {mine.plays_free ? 'Parents play free.' : <>⭐ {mine.star_balance} stars to spend · unlock a game once, then play it as much as you like. Earn stars with chores and to-dos.</>}
          </p>
          <div className="games-page__grid">
            {mine.games.map((g) => (
              <div key={g.id} className={`panel games-card${g.unlocked ? '' : ' games-card--locked'}`}>
                <div className="games-card__emoji">{g.unlocked ? g.emoji : '🔒'}</div>
                <h2>{g.name}</h2>
                <p className="hint">{g.blurb}</p>
                {g.best ? <p>🏆 Your best: <strong>{g.best} m</strong></p> : null}
                {g.unlocked ? (
                  <Link className="button" to={`/games/${g.id}`}>
                    ▶ Play
                  </Link>
                ) : (
                  <button type="button" disabled={busy || mine.star_balance < g.stars} onClick={() => void act('unlock', activeProfile.id, g.id)}>
                    {mine.star_balance < g.stars ? `${g.stars} ⭐ — ${g.stars - mine.star_balance} more to go` : `🔓 Unlock for ${g.stars} ⭐`}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {isParent && kids.length > 0 && (
        <section className="panel">
          <h2>Kids' games</h2>
          <p className="hint">Unlock a game for a kid (it uses their stars), or give the stars back. Their scores and progress are kept either way.</p>
          {kids.map((k) => {
            const s = shelves[k.id];
            if (!s) return null;
            return (
              <div key={k.id} className="games-page__kid">
                <span className="games-page__kid-name">
                  <MemberAvatar member={k} size={28} /> {k.name} · ⭐ {s.star_balance}
                </span>
                {s.games.map((g) =>
                  g.unlocked ? (
                    <button key={g.id} type="button" className="secondary" disabled={busy} onClick={() => window.confirm(`Lock ${g.name} again and give ${k.name} back ${g.stars} ⭐?`) && void act('refund', k.id, g.id)}>
                      {g.emoji} {g.name} ✓ · ↶ refund
                    </button>
                  ) : (
                    <button key={g.id} type="button" className="secondary" disabled={busy || s.star_balance < g.stars} onClick={() => void act('unlock', k.id, g.id)}>
                      🔓 {g.name} ({g.stars} ⭐)
                    </button>
                  )
                )}
              </div>
            );
          })}
        </section>
      )}
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}
