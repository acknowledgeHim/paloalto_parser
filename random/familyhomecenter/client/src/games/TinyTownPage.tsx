import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { LimitNote, useActivityClock, useLimit } from '../utils/limits.js';
import { startPlay } from './plays.js';
import { TinyTownRun } from './TinyTownRun.js';
import { EARTH_LANDS, FULL, MOON_COINS, SMALL, cleanTown, newEarth, newMoonTown, newTown, report, type Town } from './townLogic.js';
import { PrizePanel, prizeLeftText, spendPrize, type Prizes } from './prizes.js';
import { EarthView } from './EarthView.js';

const GAME = 'tiny-town';
/** Towns kept per person (🏆 🗺️ 2 more lands: 5). */
const SLOTS = 3;
const MORE_SLOTS = 5;

interface Save {
  towns: Town[];
  /** 🏆 🌙 the Moon base */
  moon?: Town | null;
  /** 🏆 🌍 the Earth's four lands */
  earth?: Town[];
}
/** Where a town is kept: a slot ('0'…'4'), 'moon', or 'earth:0'…'earth:3'. */
type Where = string;
interface PlayInfo {
  owned: boolean;
  plays_left: number | null;
  save: Partial<Save> | null;
  best: number | null;
  top: Array<{ member_id: string; score: number }>;
  features?: Record<string, { name: string; cost: number; owned: boolean }>;
  /** 💎 the token shop: each thing's price for them (parents: 0) and the 🪙 a bag gives */
  shop?: Record<string, { name: string; cost: number; coins: number }>;
  token_balance?: number;
  /** 🏆 prize lands earned with lessons: 🌙 moon, 🌍 earth, 🗺️ more-lands */
  prizes?: Prizes;
}

const NAMES = ['Maple Hollow', 'Sunny Creek', 'Pine Ridge', 'Willow Bend', 'Cloverfield', 'Pebble Bay', 'Honey Hill', 'Fox Glen', 'Bluebell Vale', 'Oak Harbor'];

/** 🏘️ Tiny Town: your towns, the 💎 extras, and the family's biggest towns. */
export function TinyTownPage() {
  const { members, activeProfile: me, refresh: refreshMembers } = useFamilyMembers();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [towns, setTowns] = useState<Town[]>([]);
  const [moon, setMoon] = useState<Town | null>(null);
  const [earth, setEarth] = useState<Town[]>([]);
  const [playing, setPlaying] = useState<Where | null>(null);
  /** 🌍 looking at the whole Earth */
  const [earthOpen, setEarthOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = useLimit(me?.id, `game:${GAME}`);
  const [timeUp, setTimeUp] = useState<string | null>(null);
  useActivityClock(me?.id, `game:${GAME}`, playing !== null, (s) => {
    limit.setStatus(s);
    // ⏰ Only running out of *minutes* stops a town that's open (it has no end of its own).
    if (s.minutes !== null && s.used_minutes >= s.minutes) setTimeUp(s.over ?? '⏰ That’s all the time for today.');
  });
  const sentBest = useRef(0);

  const load = () => {
    if (!me) return;
    api
      .get<PlayInfo>(`/games/${GAME}/play/${me.id}`)
      .then((i) => {
        setInfo(i);
        sentBest.current = i.best ?? 0;
        const ok = (l: unknown[] | undefined) => (l ?? []).map(cleanTown).filter((x): x is Town => x !== null);
        setTowns(ok(i.save?.towns).slice(0, MORE_SLOTS));
        setMoon(i.save?.moon ? cleanTown(i.save.moon) : null);
        const e = ok(i.save?.earth);
        setEarth(e.length === EARTH_LANDS.length ? e : []);
      })
      .catch((e) => setError((e as Error).message));
  };
  useEffect(load, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const has = (f: string) => info?.features?.[f]?.owned ?? false;
  const region = has('big-map') ? FULL : SMALL;

  const all = useRef<Save>({ towns: [], moon: null, earth: [] });
  all.current = { towns, moon, earth };
  /** Keep the towns (and a new best, if the biggest town is bigger than ever). */
  const store = async (next: Save, keepalive = false) => {
    all.current = next;
    setTowns(next.towns);
    setMoon(next.moon ?? null);
    setEarth(next.earth ?? []);
    if (!me) return;
    const every = [...next.towns, ...(next.moon ? [next.moon] : []), ...(next.earth ?? [])];
    const peak = Math.max(0, ...every.map((x) => x.peak));
    const score = peak > sentBest.current ? peak : 0;
    const body = { score, detail: score ? { town: every.find((x) => x.peak === peak)?.name } : undefined, save: next, acting_member_id: me.id };
    if (score) sentBest.current = peak;
    if (keepalive) {
      void fetch(`/api/games/${GAME}/play/${me.id}/result`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true, credentials: 'include' }).catch(() => {});
      return;
    }
    try {
      const r = await api.post<{ best: number | null }>(`/games/${GAME}/play/${me.id}/result`, body);
      setInfo((i) => (i ? { ...i, best: r.best } : i));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const townAt = (w: Where): Town | undefined => {
    const a = all.current;
    if (w === 'moon') return a.moon ?? undefined;
    if (w.startsWith('earth:')) return a.earth?.[Number(w.slice(6))];
    return a.towns[Number(w)];
  };
  const withTown = (w: Where, town: Town): Save => {
    const a = all.current;
    if (w === 'moon') return { ...a, moon: town };
    if (w.startsWith('earth:')) {
      const e = [...(a.earth ?? [])];
      e[Number(w.slice(6))] = town;
      return { ...a, earth: e };
    }
    const t = [...a.towns];
    t[Number(w)] = town;
    return { ...a, towns: t };
  };
  const saveTown = (w: Where, town: Town, keepalive = false) => void store(withTown(w, town), keepalive);
  /** 🏆 which prize a land needs (null: one of the usual 3) */
  const prizeOf = (w: Where) => (w === 'moon' ? 'moon' : w.startsWith('earth:') ? 'earth' : Number(w) >= SLOTS ? 'more-lands' : null);

  /** Open a town (or make a new one first, or a whole new 🌍 Earth): a play, and a 🏆 visit if it's a prize land. */
  const open = async (w: Where, town?: Town) => {
    if (!me) return;
    setError(null);
    try {
      const pz = prizeOf(w);
      if (pz && !info?.prizes?.[pz]?.ready) throw new Error(`${info?.prizes?.[pz]?.name ?? 'That'}: none left — earn more with 📚 lessons`);
      const left = await startPlay(GAME, me.id);
      setInfo((i) => (i ? { ...i, plays_left: left } : i));
      if (pz) {
        const prizes = await spendPrize(GAME, me.id, pz);
        setInfo((i) => (i ? { ...i, prizes } : i));
      }
      if (town) await store(withTown(w, town));
      setTimeUp(null);
      setPlaying(w);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const buyFeature = async (f: string) => {
    if (!me) return;
    const x = info?.features?.[f];
    if (x && !window.confirm(`Unlock ${x.name} for ${x.cost} 💎?`)) return;
    setError(null);
    try {
      const r = await api.post<{ features: PlayInfo['features'] }>(`/games/${GAME}/play/${me.id}/feature`, { feature: f, acting_member_id: me.id });
      setInfo((i) => (i ? { ...i, features: r.features, token_balance: (r as { token_balance?: number }).token_balance ?? i.token_balance } : i));
      void refreshMembers();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!me) {
    return (
      <div className="panel">
        <h1>🏘️ Tiny Town</h1>
        <p>Pick who's playing (your name, up top) first.</p>
      </div>
    );
  }
  if (error && !info) {
    return (
      <div className="panel">
        <h1>🏘️ Tiny Town</h1>
        <div className="settings-login__error">{error}</div>
        <Link to="/games">← Games</Link>
      </div>
    );
  }
  if (!info) return <p>Loading…</p>;

  const playingTown = playing !== null ? townAt(playing) : undefined;
  if (playing !== null && playingTown) {
    return (
      <TinyTownRun
        key={playing}
        town={playingTown}
        region={playing === 'moon' || playing.startsWith('earth:') ? FULL : region}
        owned={{ fun: has('fun') }}
        shop={{
          items: info.shop ?? {},
          balance: info.token_balance ?? 0,
          buy: async (item) => {
            try {
              const r = await api.post<{ coins: number; token_balance: number }>(`/games/${GAME}/play/${me.id}/buy`, { item, acting_member_id: me.id });
              setInfo((i) => (i ? { ...i, token_balance: r.token_balance } : i));
              void refreshMembers();
              return { coins: r.coins };
            } catch (e) {
              window.alert((e as Error).message);
              return null;
            }
          },
        }}
        timeUp={timeUp}
        onSave={(t) => saveTown(playing, t, true)}
        onExit={(t) => {
          saveTown(playing, t);
          setPlaying(null);
          void limit.reload();
        }}
      />
    );
  }

  const canPlay = (info.owned || !!info.plays_left) && !limit.status?.over;
  const pz = info.prizes ?? {};
  const slots = pz['more-lands']?.ready || towns.length > SLOTS ? MORE_SLOTS : SLOTS;
  const ask = (fallback: string) => window.prompt('Name your town:', fallback);

  if (earthOpen && earth.length) {
    return (
      <EarthView
        lands={earth}
        canOpen={canPlay && !!pz.earth?.ready}
        why={!pz.earth?.ready ? `${pz.earth?.name ?? '🌍'}: ${prizeLeftText(pz.earth!)}` : null}
        onOpen={(k) => {
          setEarthOpen(false);
          void open(`earth:${k}`);
        }}
        onBack={() => setEarthOpen(false)}
      />
    );
  }
  const byId = new Map(members.map((m) => [m.id, m]));
  const unlock = (f: string, what: string) => {
    const x = info.features?.[f];
    if (!x) return null;
    return x.owned ? (
      <p>✅ {x.name}: {what}</p>
    ) : (
      <p>
        <button type="button" className="secondary hill-garage__unlock" onClick={() => void buyFeature(f)}>
          🔓 Unlock {x.name} — {x.cost} 💎
        </button>{' '}
        <span className="hint">{what}</span>
      </p>
    );
  };

  return (
    <div className="hill-garage">
      <div className="hill-garage__head">
        <h1>🏘️ Tiny Town</h1>
        <Link to="/games">← Games</Link>
      </div>

      <section className="panel hill-garage__driver">
        <MemberAvatar member={me} size={72} />
        <div>
          <div className="hill-garage__name">{me.name}</div>
          <div className="hint">Biggest town: {info.best ?? 0} people</div>
          <LimitNote status={limit.status} />
          {!info.owned && (
            <div className="hint">
              {info.plays_left ? `🎟️ ${info.plays_left} play${info.plays_left === 1 ? '' : 's'} left` : '🎟️ No plays left — unlock it in 🎮 Games, or ask a parent for more'}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>🗺️ Your towns</h2>
        <div className="town-slots">
          {Array.from({ length: slots }, (_, slot) => {
            const t = towns[slot];
            const extra = slot >= SLOTS;
            const extraOk = !extra || !!pz['more-lands']?.ready;
            if (!t)
              return (
                <div key={slot} className="town-slot is-empty">
                  <span className="town-slot__emoji">{extra ? '🗺️' : '🌱'}</span>
                  <strong>{extra ? `🏆 Land ${slot + 1}` : 'Empty land'}</strong>
                  <button
                    type="button"
                    disabled={!canPlay || !extraOk}
                    onClick={() => {
                      const name = window.prompt('Name your town:', NAMES[Math.floor(Math.random() * NAMES.length)]);
                      if (name === null) return;
                      void open(String(slot), newTown(name.trim() || 'My town', Math.floor(Math.random() * 2 ** 31)));
                    }}
                  >
                    ＋ Start a town
                  </button>
                </div>
              );
            const r = report(t);
            return (
              <div key={slot} className="town-slot">
                <span className="town-slot__emoji">{r.pop >= 400 ? '🌆' : r.pop >= 100 ? '🏙️' : r.pop > 0 ? '🏘️' : '🌱'}</span>
                <strong>{t.name}</strong>
                <span className="hint">
                  👥 {r.pop} · 🪙 {t.coins.toLocaleString()} · 📅 day {t.day}
                </span>
                {extra && <span className="hint">🏆 {prizeLeftText(pz['more-lands'] ?? ({} as never))}</span>}
                <button type="button" disabled={!canPlay || !extraOk} onClick={() => void open(String(slot))}>
                  ▶ Play
                </button>
                <button
                  type="button"
                  className="link-button"
                  disabled={!canPlay || !extraOk}
                  onClick={() => {
                    if (!window.confirm(`Start over on new land? ${t.name} (${r.pop} people) will be gone for good.`)) return;
                    const name = window.prompt('Name your new town:', NAMES[Math.floor(Math.random() * NAMES.length)]);
                    if (name === null) return;
                    void open(String(slot), newTown(name.trim() || 'My town', Math.floor(Math.random() * 2 ** 31)));
                  }}
                >
                  🔄 Start over
                </button>
              </div>
            );
          })}
          {pz.moon && (
            <div className={`town-slot town-slot--moon${moon ? '' : ' is-empty'}`}>
              <span className="town-slot__emoji">🌙</span>
              <strong>{moon ? moon.name : 'Moon base'}</strong>
              <span className="hint">🏆 {prizeLeftText(pz.moon)}</span>
              {moon && (
                <span className="hint">
                  👥 {report(moon).pop} · 🪙 {moon.coins.toLocaleString()} · 📅 day {moon.day}
                </span>
              )}
              <button
                type="button"
                disabled={!canPlay || !pz.moon.ready}
                onClick={() => {
                  if (moon) return void open('moon');
                  const name = ask('Moon Base Alpha');
                  if (name === null) return;
                  void open('moon', newMoonTown(name.trim() || 'Moon base', Math.floor(Math.random() * 2 ** 31)));
                }}
              >
                {moon ? '▶ Play' : `🚀 Land on the Moon (+🪙 ${MOON_COINS.toLocaleString()})`}
              </button>
              {!pz.moon.ready && <span className="hint">🎯 Earn it below</span>}
            </div>
          )}
          {pz.earth && (
            <div className={`town-slot town-slot--earth${earth.length ? '' : ' is-empty'}`}>
              <span className="town-slot__emoji">🌍</span>
              <strong>The whole Earth</strong>
              <span className="hint">🏆 {prizeLeftText(pz.earth)}</span>
              {earth.length > 0 && <span className="hint">👥 {earth.reduce((a, x) => a + report(x).pop, 0)} people on {EARTH_LANDS.length} lands</span>}
              <button
                type="button"
                disabled={!canPlay || !pz.earth.ready}
                onClick={() => {
                  if (earth.length) return setEarthOpen(true);
                  void (async () => {
                    const world = newEarth(Math.floor(Math.random() * 2 ** 30));
                    await store({ ...all.current, earth: world });
                    setEarthOpen(true);
                  })();
                }}
              >
                {earth.length ? '🔭 See the Earth' : '🌍 Make the Earth'}
              </button>
              {!pz.earth.ready && <span className="hint">🎯 Earn it below</span>}
            </div>
          )}
        </div>
        {error && <div className="settings-login__error">{error}</div>}
      </section>

      <PrizePanel prizes={info.prizes} hint="Each time you open a prize land counts as one visit." />

      <section className="panel">
        <h2>🔓 Extras</h2>
        {unlock('big-map', 'more than twice the land to build on (all your towns)')}
        {unlock('fun', '🎡 fun park, 🦁 zoo, 🐠 aquarium and 🏰 castle — make the whole town happier')}
      </section>

      {info.shop && Object.keys(info.shop).length > 0 && (
        <section className="panel">
          <h2>💎 Token shop</h2>
          <p className="hint">
            Spend the 💎 tokens you earn (📚 Learning, ⌨️ Typing, chores) inside your town — you have <strong>{info.token_balance ?? 0} 💎</strong>. Pick them from the
            💎 Token shop under the map while you play.
          </p>
          <ul className="town-shop">
            {Object.entries(info.shop).map(([id, it]) => (
              <li key={id}>
                {it.name} — <strong>{it.cost ? `${it.cost} 💎` : 'free'}</strong>
                {it.coins ? '' : ' each'}
              </li>
            ))}
          </ul>
        </section>
      )}

      {info.top.length > 0 && (
        <section className="panel">
          <h2>🏆 Family's biggest towns</h2>
          <ol className="hill-garage__top">
            {info.top.map((x) => {
              const m = byId.get(x.member_id);
              return (
                <li key={x.member_id}>
                  <MemberAvatar member={m ?? null} size={28} /> {m?.name ?? '—'} <strong>{x.score}</strong> people
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="panel">
        <h2>How to play</h2>
        <ul className="hint">
          <li>
            <strong>Roads first:</strong> pick 🛣️ Road and drag to draw. Everything except parks and nature needs a road right next to it (up, down, left or right). Roads
            over water become bridges.
          </li>
          <li>
            <strong>Homes:</strong> put 🏠 houses along the roads. People move in when they're happy (45+), there's ⚡ power and 💧 water, and there are 💼 jobs. Full,
            happy houses grow into 🏡 big houses and then 🏘️ townhouses.
          </li>
          <li>
            <strong>Jobs:</strong> 🏪 shops, 🚜 farms, ☕ cafés, 🏭 factories and 🏢 offices. Factories are noisy, so keep them away from homes.
          </li>
          <li>
            <strong>Money:</strong> people who work pay taxes 🪙 each day. Services cost a little each day to run. Taxes can go from 0% to 20%: more money, but less
            happy people.
          </li>
          <li>
            <strong>Happiness:</strong> 🌳 parks, 🎠 playgrounds, schools and clinics nearby make people happier. Pick 🔍 Look and tap a home to see exactly why, or
            press 😊 to see the whole town.
          </li>
          <li>Bigger towns open new buildings, up to a 🚀 rocket base at 1,000 people. 🚜 Clear gives half the price back.</li>
          <li>⏸ ▶ ⏩ change how fast the days go. Your town saves by itself.</li>
        </ul>
      </section>
    </div>
  );
}
