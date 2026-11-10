import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { LimitNote, useActivityClock, useLimit } from '../utils/limits.js';
import { startPlay } from './plays.js';
import { TinyTownRun } from './TinyTownRun.js';
import { FULL, SMALL, cleanTown, newTown, report, type Town } from './townLogic.js';

const GAME = 'tiny-town';
/** Towns kept per person. */
const SLOTS = 3;

interface Save {
  towns: Town[];
}
interface PlayInfo {
  owned: boolean;
  plays_left: number | null;
  save: Partial<Save> | null;
  best: number | null;
  top: Array<{ member_id: string; score: number }>;
  features?: Record<string, { name: string; cost: number; owned: boolean }>;
}

const NAMES = ['Maple Hollow', 'Sunny Creek', 'Pine Ridge', 'Willow Bend', 'Cloverfield', 'Pebble Bay', 'Honey Hill', 'Fox Glen', 'Bluebell Vale', 'Oak Harbor'];

/** 🏘️ Tiny Town: your towns, the 💎 extras, and the family's biggest towns. */
export function TinyTownPage() {
  const { members, activeProfile: me, refresh: refreshMembers } = useFamilyMembers();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [towns, setTowns] = useState<Town[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
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
        setTowns((i.save?.towns ?? []).map(cleanTown).filter((x): x is Town => x !== null).slice(0, SLOTS));
      })
      .catch((e) => setError((e as Error).message));
  };
  useEffect(load, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const has = (f: string) => info?.features?.[f]?.owned ?? false;
  const region = has('big-map') ? FULL : SMALL;

  /** Keep the towns (and a new best, if the biggest town is bigger than ever). */
  const store = async (next: Town[], keepalive = false) => {
    setTowns(next);
    if (!me) return;
    const peak = Math.max(0, ...next.map((x) => x.peak));
    const score = peak > sentBest.current ? peak : 0;
    const body = { score, detail: score ? { town: next.find((x) => x.peak === peak)?.name } : undefined, save: { towns: next }, acting_member_id: me.id };
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
  const townsRef = useRef(towns);
  townsRef.current = towns;
  const saveTown = (slot: number, town: Town, keepalive = false) => {
    const next = [...townsRef.current];
    next[slot] = town;
    void store(next, keepalive);
  };

  const open = async (slot: number, town?: Town) => {
    if (!me) return;
    setError(null);
    try {
      const left = await startPlay(GAME, me.id);
      setInfo((i) => (i ? { ...i, plays_left: left } : i));
      if (town) await store([...townsRef.current.slice(0, slot), town, ...townsRef.current.slice(slot + 1)]);
      setTimeUp(null);
      setPlaying(slot);
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
      setInfo((i) => (i ? { ...i, features: r.features } : i));
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

  if (playing !== null && towns[playing]) {
    return (
      <TinyTownRun
        key={playing}
        town={towns[playing]}
        region={region}
        owned={{ fun: has('fun') }}
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
          {Array.from({ length: SLOTS }, (_, slot) => {
            const t = towns[slot];
            if (!t)
              return (
                <div key={slot} className="town-slot is-empty">
                  <span className="town-slot__emoji">🌱</span>
                  <strong>Empty land</strong>
                  <button
                    type="button"
                    disabled={!canPlay}
                    onClick={() => {
                      const name = window.prompt('Name your town:', NAMES[Math.floor(Math.random() * NAMES.length)]);
                      if (name === null) return;
                      void open(slot, newTown(name.trim() || 'My town', Math.floor(Math.random() * 2 ** 31)));
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
                <button type="button" disabled={!canPlay} onClick={() => void open(slot)}>
                  ▶ Play
                </button>
                <button
                  type="button"
                  className="link-button"
                  disabled={!canPlay}
                  onClick={() => {
                    if (!window.confirm(`Start over on new land? ${t.name} (${r.pop} people) will be gone for good.`)) return;
                    const name = window.prompt('Name your new town:', NAMES[Math.floor(Math.random() * NAMES.length)]);
                    if (name === null) return;
                    void open(slot, newTown(name.trim() || 'My town', Math.floor(Math.random() * 2 ** 31)));
                  }}
                >
                  🔄 Start over
                </button>
              </div>
            );
          })}
        </div>
        {error && <div className="settings-login__error">{error}</div>}
      </section>

      <section className="panel">
        <h2>🔓 Extras</h2>
        {unlock('big-map', 'more than twice the land to build on (all your towns)')}
        {unlock('fun', '🎡 fun park, 🦁 zoo, 🐠 aquarium and 🏰 castle — make the whole town happier')}
      </section>

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
