import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { TokenWallet } from '../components/TokenWallet.js';
import { useCollapsibleSections } from '../hooks/useCollapsibleSections.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface ShelfGame {
  id: string;
  emoji: string;
  name: string;
  stars: number;
  blurb: string;
  unlocked: boolean;
  owned: boolean;
  /** 🎟️ plays left — given by a parent or bought (null = none, or the game is theirs) */
  plays_left: number | null;
  /** 0 = unlocking is for good; N = unlocking buys N plays (a parent sets it per game) */
  plays_per_unlock: number;
  best: number | null;
}
interface Shelf {
  token_balance: number;
  plays_free: boolean;
  games: ShelfGame[];
}

const playsText = (n: number) => `${n} play${n === 1 ? '' : 's'}`;

/** ⚙️ a game's price, plays per unlock, and 🔓 its extras' prices (server: routes/games.ts) */
interface GameRule {
  cost: number;
  plays: number;
  features?: Record<string, number>;
}
const FEATURE_NAMES: Record<string, string> = { jump: '🦘 Jump', obstacles: '⚠️ Obstacles', glide: '🪂 Glider', 'big-map': '🗺️ Bigger land', fun: '🎡 Fun places' };

/**
 * 🎮 Games: each game is unlocked with 💎 tokens — for good, or for a number of plays a parent sets per
 * game (then unlocked again). Parents play free, and can unlock (or refund) a game for a kid.
 */
export function GamesPage() {
  const { members, activeProfile, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const kids = members.filter((m) => m.is_parent !== 1);
  const [shelves, setShelves] = useState<Record<string, Shelf>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [givePlays, setGivePlays] = useState<Record<string, string>>({}); // "kid|game" → how many to give
  const [rules, setRules] = useState<Record<string, GameRule> | null>(null);
  const [rulesNote, setRulesNote] = useState<string | null>(null);
  // The sections under the games fold down to their heading (open ones remembered).
  const [pageEl, setPageEl] = useState<HTMLDivElement | null>(null);
  useCollapsibleSections(pageEl, 'familyhomecenter.games.open');
  useEffect(() => {
    if (isParent) api.get<Record<string, GameRule>>('/games/settings').then(setRules).catch(() => {});
  }, [isParent]);
  const saveRules = async () => {
    if (!rules) return;
    setRulesNote(null);
    try {
      setRules(await api.put<Record<string, GameRule>>('/games/settings', rules));
      setRulesNote('Saved ✓');
      void load();
    } catch (e) {
      setRulesNote((e as Error).message);
    }
  };

  const people = activeProfile ? [activeProfile, ...(isParent ? kids.filter((k) => k.id !== activeProfile.id) : [])] : isParent ? kids : [];
  const load = () =>
    Promise.all(people.map((p) => api.get<Shelf>(`/games?member=${p.id}`).then((s) => [p.id, s] as const)))
      .then((all) => setShelves(Object.fromEntries(all)))
      .catch((e) => setError((e as Error).message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id, members.length]);

  const act = async (path: string, memberId: string, gameId: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.post<Shelf>(`/games/${memberId}/${path}`, { game_id: gameId, acting_member_id: activeProfile?.id ?? null, ...extra });
      setShelves((all) => ({ ...all, [memberId]: s }));
      void refresh(); // token balances
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mine = activeProfile ? shelves[activeProfile.id] : undefined;

  return (
    <div className="games-page" ref={setPageEl}>
      <h1>🎮 Games</h1>
      {!activeProfile && <p className="hint">Pick who's playing (your name, up top) to play.</p>}

      {activeProfile && mine && (
        <>
          {!mine.plays_free && <TokenWallet member={activeProfile} onChange={() => void load()} />}
          <p className="hint">
            {mine.plays_free ? 'Parents play free.' : <>💎 {mine.token_balance} tokens to spend on games. Earn tokens in ⌨️ Typing and 📚 Learning.</>}
          </p>
          <div className="games-page__grid">
            {mine.games.map((g) => (
              <div key={g.id} className={`panel games-card${g.unlocked ? '' : ' games-card--locked'}`}>
                <div className="games-card__emoji">{g.unlocked ? g.emoji : '🔒'}</div>
                <h2>{g.name}</h2>
                <p className="hint">{g.blurb}</p>
                {g.best ? <p>🏆 Your best: <strong>{g.best}</strong></p> : null}
                {!g.owned && g.plays_left != null && (
                  <p>🎟️ {g.plays_left ? `${g.plays_left} play${g.plays_left === 1 ? '' : 's'} left` : 'No plays left'}</p>
                )}
                {g.unlocked && (
                  <Link className="button" to={`/games/${g.id}`}>
                    ▶ Play
                  </Link>
                )}
                {!g.owned && (
                  <button type="button" className={g.unlocked ? 'secondary' : undefined} disabled={busy || mine.token_balance < g.stars} onClick={() => void act('unlock', activeProfile.id, g.id)}>
                    {mine.token_balance < g.stars
                      ? `${g.stars} 💎 to ${g.plays_per_unlock ? `get ${playsText(g.plays_per_unlock)}` : 'keep it'} — ${g.stars - mine.token_balance} more to go`
                      : g.plays_per_unlock
                        ? `🔓 ${g.unlocked ? 'More' : 'Unlock'}: ${playsText(g.plays_per_unlock)} for ${g.stars} 💎`
                        : `🔓 Unlock for good: ${g.stars} 💎`}
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
          <p className="hint">
            Unlock a game for a kid (it uses their 💎 tokens) or give one bought for good back — or 🎟️ give them a number of plays free (each go uses
            one; when they run out it locks again). Their scores and progress are kept either way.
          </p>
          {kids.map((k) => {
            const s = shelves[k.id];
            if (!s) return null;
            return (
              <div key={k.id} className="games-page__kid">
                <span className="games-page__kid-name">
                  <MemberAvatar member={k} size={28} /> {k.name} · 💎 {s.token_balance}
                </span>
                {s.games.map((g) => {
                  const key = `${k.id}|${g.id}`;
                  return (
                    <div key={g.id} className="games-page__kid-game">
                      <strong>
                        {g.emoji} {g.name}
                      </strong>
                      {g.owned ? (
                        <button type="button" className="secondary" disabled={busy} onClick={() => window.confirm(`Lock ${g.name} again and give ${k.name} back what it cost?`) && void act('refund', k.id, g.id)}>
                          ✓ Theirs · ↶ refund
                        </button>
                      ) : (
                        <>
                          <button type="button" className="secondary" disabled={busy || s.token_balance < g.stars} onClick={() => void act('unlock', k.id, g.id)}>
                            🔓 {g.plays_per_unlock ? playsText(g.plays_per_unlock) : 'For good'} ({g.stars} 💎)
                          </button>
                          <span className="games-page__plays">
                            🎟️ {g.plays_left ?? 0} left · give
                            <input
                              type="number"
                              min={1}
                              max={1000}
                              value={givePlays[key] ?? '5'}
                              onChange={(e) => setGivePlays((p) => ({ ...p, [key]: e.target.value }))}
                              aria-label={`Plays of ${g.name} to give ${k.name}`}
                            />
                            <button type="button" className="secondary" disabled={busy || !(Number(givePlays[key] ?? '5') > 0)} onClick={() => void act('passes', k.id, g.id, { plays: Number(givePlays[key] ?? '5'), mode: 'add' })}>
                              plays
                            </button>
                            {(g.plays_left ?? 0) > 0 && (
                              <button type="button" className="link-button" disabled={busy} onClick={() => void act('passes', k.id, g.id, { plays: 0, mode: 'set' })}>
                                take away
                              </button>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}
      {isParent && rules && mine && (
        <section className="panel">
          <h2>⚙️ What each game costs</h2>
          <p className="hint">
            For each game: how many 💎 tokens unlocking it costs, and how many plays that's good for. <strong>0 plays = for good.</strong> With a number, each go
            uses one play and when they're used up the kid earns tokens and unlocks it again. Games a kid already unlocked for good stay theirs (use ↶ refund
            above to take one back). 🔓 Extras inside a game (⛰️ Hill Hopper's 🦘 Jump, 🪂 Glider and ⚠️ Obstacles) are bought once each; 0 makes one free. Anyone who
            already had one switched on keeps it.
          </p>
          <p className="hint">
            ⏰ How many games — or minutes — a day for each kid: <Link to="/learning/settings">📚 Learning → ⚙️ Grades & tokens → Daily limits</Link>.
          </p>
          {mine.games.map((g) => {
            const r = rules[g.id];
            if (!r) return null;
            const set = (k: 'cost' | 'plays', v: string) => setRules({ ...rules, [g.id]: { ...r, [k]: Math.max(0, Math.round(Number(v) || 0)) } });
            return (
              <div key={g.id} className="games-page__rule">
                <strong>
                  {g.emoji} {g.name}
                </strong>
                <label>
                  💎 <input type="number" min={0} max={10000} value={r.cost} onChange={(e) => set('cost', e.target.value)} aria-label={`${g.name} cost in tokens`} />
                </label>
                <label>
                  for <input type="number" min={0} max={10000} value={r.plays} onChange={(e) => set('plays', e.target.value)} aria-label={`${g.name} plays per unlock`} /> plays
                </label>
                <span className="hint">{r.plays ? `= ${playsText(r.plays)} for ${r.cost} 💎` : `= for good, ${r.cost} 💎`}</span>
                {Object.entries(r.features ?? {}).map(([f, cost]) => (
                  <label key={f} className="games-page__extra">
                    🔓 {FEATURE_NAMES[f] ?? f} extra: 💎{' '}
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={cost}
                      onChange={(e) => setRules({ ...rules, [g.id]: { ...r, features: { ...r.features, [f]: Math.max(0, Math.round(Number(e.target.value) || 0)) } } })}
                      aria-label={`${g.name} ${FEATURE_NAMES[f] ?? f} cost in tokens`}
                    />{' '}
                    <span className="hint">{cost ? '' : '(free)'}</span>
                  </label>
                ))}
              </div>
            );
          })}
          <div className="typing-stars__actions">
            <button type="button" onClick={() => void saveRules()}>
              Save
            </button>
            {rulesNote && <span className="hint">{rulesNote}</span>}
          </div>
        </section>
      )}
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}
