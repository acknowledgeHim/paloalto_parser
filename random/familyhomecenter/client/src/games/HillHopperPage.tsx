import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Closet } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { outfitOf, useOutfitCatalog } from '../utils/outfits.js';
import { MAX_LEVEL, UPGRADE_COST, UPGRADE_KEYS, WORLDS, worldOf, type Upgrades } from './hillPhysics.js';
import { startPlay } from './plays.js';
import { LimitNote, useActivityClock, useLimit } from '../utils/limits.js';
import { HAZARD_COINS, HAZARD_WORLDS } from './hillHazards.js';
import { DEFAULT_CONTROLS, HillHopperRun, JUMP_TAP_LABEL, jumpKeysOf, jumpTapOf, keyName, type Controls, type JumpTap, type RunResult } from './HillHopperRun.js';

interface Save {
  coins: number;
  upgrades: Upgrades;
  vehicle: string | null; // a Dress up vehicle id, or null for the buggy
  /** 🦘 Jump on (Space or tapping the middle of the screen; in Dino Land with obstacles, eggs too) */
  jump?: boolean;
  /** 🪂 Glider on (hold jump in the air; sky coins and cans come with it) */
  glide?: boolean;
  /** Picked in the garage here. Not picked: the game drives whatever vehicle the avatar has on in Dress up. */
  vehicle_picked?: boolean;
  controls: Controls;
  /** 🌍 worlds bought (Green Hills is always there), the one picked, and the best distance in each */
  worlds: string[];
  world: string;
  bests: Record<string, number>;
  /** ⚠️ worlds with obstacles turned on (every world has its own — hillHazards.ts) */
  obstacles: string[];
}
interface PlayInfo {
  owned: boolean;
  plays_left: number | null;
  save: Partial<Save> | null;
  best: number | null;
  top: Array<{ member_id: string; score: number }>;
  /** 🔓 extras bought with 💎: 🦘 jump, ⚠️ obstacles (a parent sets the price; 0 = free) */
  features?: Record<string, { name: string; cost: number; owned: boolean }>;
}

const GAME = 'hill-hopper';
const NO_UPGRADES: Upgrades = { engine: 0, tires: 0, springs: 0, tank: 0, jump: 0, glide: 0 };
const UPGRADE_LABEL: Record<keyof Upgrades, string> = {
  engine: '🔧 Engine — faster, more pull up hills',
  tires: '🛞 Tires — more grip, less spinning',
  springs: '🪀 Springs — smoother over bumps',
  tank: '⛽ Fuel tank — drive longer between cans',
  jump: '🦘 Jump — hop higher',
  glide: '🪂 Glider — glide farther',
};
const WHY: Record<RunResult['why'], string> = {
  crash: '💥 Bonk! Your head hit the ground.',
  tipped: '🙃 Flipped over! Ease off the gas (or brake) when the nose comes up.',
  fuel: '⛽ Out of fuel.',
  quit: '✕ Stopped.',
  squashed: '🦖 Squashed by a dinosaur! Wait for it to jump, then zoom underneath.',
  zapped: '👽 Zapped by the aliens! When the saucer glows, speed up or slow down.',
  bumped: '🛡️ Out of shields! Watch for the warning — then wait, or zoom past.',
};
const MOUSE_LABEL: Record<Controls['mouse'], string> = {
  pedals: 'Click / tap the on-screen pedals',
  buttons: 'Hold the left mouse button for gas, the right one for brake (anywhere on the game)',
  sides: 'Hold the right half of the game for gas, the left half for brake (mouse or finger)',
};

/** ⛰️ Hill Hopper: the garage (upgrades, which ride to drive, best runs), then the run itself. */
export function HillHopperPage() {
  const { members, activeProfile, refresh: refreshMembers } = useFamilyMembers();
  const me = activeProfile;
  const catalog = useOutfitCatalog();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [save, setSave] = useState<Save>({ coins: 0, upgrades: NO_UPGRADES, vehicle: null, controls: DEFAULT_CONTROLS, worlds: ['hills'], world: 'hills', bests: {}, obstacles: [] });
  const [listening, setListening] = useState<'gas' | 'brake' | 'jump' | null>(null);
  const [owned, setOwned] = useState<string[]>([]);
  /** What the avatar has on in 👕 Dress up (fresh from the server, not the profile loaded earlier). */
  const [worn, setWorn] = useState<Partial<Record<string, string>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // ⏰ a parent's daily limit: a run going is always finished; the next one can't start
  const limit = useLimit(me?.id, 'game:hill-hopper');
  useActivityClock(me?.id, 'game:hill-hopper', playing, limit.setStatus);
  const [last, setLast] = useState<{ r: RunResult; newBest: boolean } | null>(null);

  const load = () => {
    if (!me) return;
    api
      .get<PlayInfo>(`/games/${GAME}/play/${me.id}`)
      .then((i) => {
        setInfo(i);
        setSave({
          coins: i.save?.coins ?? 0,
          upgrades: { ...NO_UPGRADES, ...(i.save?.upgrades ?? {}) },
          vehicle: i.save?.vehicle ?? null,
          vehicle_picked: i.save?.vehicle_picked ?? false,
          jump: i.save?.jump ?? false,
          glide: i.save?.glide ?? false,
          controls: { ...DEFAULT_CONTROLS, ...(i.save?.controls ?? {}) },
          worlds: [...new Set(['hills', ...(i.save?.worlds ?? [])])],
          world: i.save?.world ?? 'hills',
          // Runs from before worlds existed were all on Green Hills.
          bests: { hills: i.best ?? 0, ...(i.save?.bests ?? {}) },
          obstacles: i.save?.obstacles ?? [],
        });
      })
      .catch((e) => setError((e as Error).message));
    api
      .get<Closet>(`/outfits/${me.id}`)
      .then((c) => {
        setOwned(c.owned);
        setWorn(c.outfit ?? {});
      })
      .catch(() => setOwned([]));
  };
  useEffect(load, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const vehicles = useMemo(() => (catalog?.items ?? []).filter((i) => i.slot === 'vehicle' && owned.includes(i.id)), [catalog, owned]);
  const wearing = worn ?? (me ? outfitOf(me) : {});
  const emojiOf = (id: string | undefined) => (id ? (catalog?.items.find((i) => i.id === id)?.emoji ?? null) : null);
  const hat = emojiOf(wearing.hat);
  const hand = emojiOf(wearing.hand);
  const world = worldOf(save.worlds.includes(save.world) ? save.world : 'hills');
  // The ride: the one picked in the garage, or else the vehicle the avatar wears in Dress up.
  const rideId = save.vehicle_picked ? save.vehicle : (wearing.vehicle ?? null);
  const vehicleEmoji = catalog?.items.find((i) => i.id === rideId && (owned.includes(i.id) || i.id === wearing.vehicle))?.emoji ?? null;

  const store = async (next: Save, result?: RunResult) => {
    setSave(next);
    if (!me) return;
    try {
      const r = await api.post<{ best: number | null }>(`/games/${GAME}/play/${me.id}/result`, {
        score: result?.distance ?? 0,
        detail: result ? { coins: result.coins, flips: result.flips, why: result.why, world: (result as RunResult & { world?: string }).world } : undefined,
        save: next,
        acting_member_id: me.id,
      });
      setInfo((i) => (i ? { ...i, best: r.best } : i));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // "Press a key…": the next key pressed becomes that pedal's key.
  useEffect(() => {
    if (!listening) return;
    const pick = (e: KeyboardEvent) => {
      e.preventDefault();
      const k = e.key.toLowerCase();
      setListening(null);
      if (k === 'escape') return;
      const c = { ...save.controls, jumpKeys: jumpKeysOf(save.controls) };
      const mine = listening === 'gas' ? 'gasKeys' : listening === 'brake' ? 'brakeKeys' : 'jumpKeys';
      // A key does one thing: take it off the other pedals.
      const next = { ...c, gasKeys: c.gasKeys.filter((x) => x !== k), brakeKeys: c.brakeKeys.filter((x) => x !== k), jumpKeys: c.jumpKeys.filter((x) => x !== k), [mine]: [k] };
      void store({ ...save, controls: next });
    };
    window.addEventListener('keydown', pick);
    return () => window.removeEventListener('keydown', pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  if (!me) {
    return (
      <div className="panel">
        <h1>⛰️ Hill Hopper</h1>
        <p>Pick who's playing (your name, up top) first.</p>
      </div>
    );
  }
  if (error && !info) {
    return (
      <div className="panel">
        <h1>⛰️ Hill Hopper</h1>
        <div className="settings-login__error">{error}</div>
        <Link to="/games">← Games</Link>
      </div>
    );
  }
  if (!info) return <p>Loading…</p>;

  /** 🔓 has this extra (old saves without prices: yes) */
  const has = (f: string) => info?.features?.[f]?.owned ?? true;
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
  const unlockButton = (f: string) => {
    const x = info?.features?.[f];
    if (!x) return null;
    return (
      <button type="button" className="secondary hill-garage__unlock" onClick={() => void buyFeature(f)}>
        🔓 Unlock {x.name} — {x.cost} 💎
      </button>
    );
  };

  if (playing) {
    return (
      <HillHopperRun
        driver={{ id: me.id, name: me.name, color: me.color, avatar: me.avatar ?? null, hat, hand }}
        vehicle={vehicleEmoji}
        upgrades={save.upgrades}
        world={world}
        obstacles={has('obstacles') && save.obstacles.includes(world.id)}
        jump={has('jump') && (save.jump ?? false)}
        glide={has('glide') && (save.glide ?? false)}
        best={save.bests[world.id] || null}
        controls={save.controls}
        onEnd={(r) => {
          setPlaying(false);
          void limit.reload();
          const prevBest = save.bests[world.id] ?? 0;
          setLast({ r, newBest: r.distance > prevBest });
          void store({ ...save, coins: save.coins + r.coins, bests: { ...save.bests, [world.id]: Math.max(prevBest, r.distance) } }, { ...r, world: world.id } as RunResult);
        }}
      />
    );
  }

  const buy = (k: keyof Upgrades) => {
    const lvl = save.upgrades[k] ?? 0;
    const cost = UPGRADE_COST[lvl];
    if (lvl >= MAX_LEVEL || save.coins < cost) return;
    void store({ ...save, coins: save.coins - cost, upgrades: { ...save.upgrades, [k]: lvl + 1 } });
  };
  /** Take a level off (the coins it cost come back), e.g. if the car's too fast or bouncy. */
  const remove = (k: keyof Upgrades) => {
    const lvl = save.upgrades[k] ?? 0;
    if (lvl <= 0) return;
    void store({ ...save, coins: save.coins + UPGRADE_COST[lvl - 1], upgrades: { ...save.upgrades, [k]: lvl - 1 } });
  };
  const byId = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="hill-garage">
      <div className="hill-garage__head">
        <h1>⛰️ Hill Hopper</h1>
        <Link to="/games">← Games</Link>
      </div>

      {last && (
        <section className="panel hill-garage__result">
          <h2>{last.newBest && last.r.distance > 0 ? '🏆 New best!' : WHY[last.r.why]}</h2>
          <p>
            <strong>{last.r.distance} m</strong> · 🪙 {last.r.coins} coins{last.r.flips ? ` · 🔄 ${last.r.flips} flip${last.r.flips > 1 ? 's' : ''}` : ''}
            {last.newBest && last.r.distance > 0 ? ` · ${WHY[last.r.why]}` : ''}
          </p>
        </section>
      )}

      <section className="panel hill-garage__driver">
        <MemberAvatar member={me} size={72} />
        <div>
          <div className="hill-garage__name">{me.name}</div>
          <div className="hint">
            🪙 {save.coins} coins · {world.emoji} {world.name}
            {save.obstacles.includes(world.id) ? ` + ${HAZARD_WORLDS[world.id]?.emoji ?? ''} obstacles` : ''} · Best {save.bests[world.id] ?? 0} m
          </div>
        </div>
        <div className="hill-garage__go-wrap">
          <button
            type="button"
            className="hill-garage__go"
            disabled={(!info.owned && !info.plays_left) || !!limit.status?.over}
            onClick={async () => {
              setError(null);
              try {
                const left = await startPlay(GAME, me.id); // 🎟️ uses a play, if it's plays a parent gave
                setInfo((i) => (i ? { ...i, plays_left: left } : i));
                setLast(null);
                setPlaying(true);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            ▶ Drive!
          </button>
          <LimitNote status={limit.status} />
          {!info.owned && (
            <div className="hint">
              {info.plays_left ? `🎟️ ${info.plays_left} play${info.plays_left === 1 ? '' : 's'} left` : '🎟️ No plays left — unlock it in 🎮 Games, or ask a parent for more'}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>🌍 Worlds</h2>
        <div className="hill-garage__worlds">
          {WORLDS.map((w) => {
            const have = save.worlds.includes(w.id);
            const on = world.id === w.id;
            return (
              <div key={w.id} className={`hill-garage__world${on ? ' is-on' : ''}${have ? '' : ' is-locked'}`}>
                <div className="hill-garage__world-emoji">{w.emoji}</div>
                <strong>{w.name}</strong>
                <span className="hint">{w.blurb}</span>
                {have && save.bests[w.id] ? <span className="hint">🏁 Best {save.bests[w.id]} m</span> : null}
                {w.coinMul > 1 && <span className="hint">🪙 ×{w.coinMul} coins</span>}
                {have && HAZARD_WORLDS[w.id] && !has('obstacles') && (
                  <div className="hill-garage__obstacles">
                    <span className="hint">
                      {HAZARD_WORLDS[w.id].emoji} Obstacles — {HAZARD_WORLDS[w.id].text} 🪙 ×{HAZARD_COINS}
                    </span>
                    {unlockButton('obstacles')}
                    <span className="hint">(once, for every world)</span>
                  </div>
                )}
                {have && HAZARD_WORLDS[w.id] && has('obstacles') && (
                  <label className="privacy-toggle hill-garage__obstacles">
                    <input
                      type="checkbox"
                      checked={save.obstacles.includes(w.id)}
                      onChange={(e) =>
                        void store({ ...save, world: w.id, obstacles: e.target.checked ? [...save.obstacles, w.id] : save.obstacles.filter((x) => x !== w.id) })
                      }
                    />
                    <span>
                      {HAZARD_WORLDS[w.id].emoji} Add obstacles <span className="hint">— {HAZARD_WORLDS[w.id].text} 🪙 ×{HAZARD_COINS}</span>
                    </span>
                  </label>
                )}
                {on ? (
                  <span className="hill-garage__world-on">✓ Driving here</span>
                ) : have ? (
                  <button type="button" className="secondary" onClick={() => void store({ ...save, world: w.id })}>
                    Drive here
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={save.coins < w.coins}
                    onClick={() => void store({ ...save, coins: save.coins - w.coins, worlds: [...save.worlds, w.id], world: w.id })}
                  >
                    {save.coins < w.coins ? `🔒 🪙 ${w.coins}` : `🔓 Unlock · 🪙 ${w.coins}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="hint">Unlock worlds with coins from the game. Each one drives differently — and pays more coins the harder it is.</p>
      </section>

      <section className="panel">
        <h2>🚗 Your ride</h2>
        <div className="hill-garage__rides">
          <button type="button" className={`hill-garage__ride${!vehicleEmoji ? ' is-on' : ''}`} onClick={() => void store({ ...save, vehicle: null, vehicle_picked: true })}>
            <span>🛞</span>Buggy
          </button>
          {vehicles.map((v) => (
            <button key={v.id} type="button" className={`hill-garage__ride${vehicleEmoji && rideId === v.id ? ' is-on' : ''}`} onClick={() => void store({ ...save, vehicle: v.id, vehicle_picked: true })}>
              <span>{v.emoji}</span>
              {v.name}
            </button>
          ))}
        </div>
        <p className="hint">
          Rides you've bought in <Link to="/dress-up">👕 Dress up → 🚗 Vehicles</Link> show up here. Until you pick one here, you drive the one your avatar has on. They all drive the same — upgrades are what make it faster.
        </p>
      </section>

      <section className="panel">
        <h2>🎮 Controls</h2>
        {!has('jump') && unlockButton('jump')}
        <label className={`privacy-toggle${has('jump') ? '' : ' is-locked'}`}>
          <input type="checkbox" checked={has('jump') && (save.jump ?? false)} disabled={!has('jump')} onChange={(e) => void store({ ...save, jump: e.target.checked })} />
          <span>
            🦘 Jump — with the jump key, or the jump button you pick below.{' '}
            <span className="hint">
              In 🦖 Dino Land with obstacles there are 🥚 eggs too: hop over them. Squash 3 and the next dinosaur chases you for 10 seconds!
            </span>
          </span>
        </label>
        {!has('glide') && unlockButton('glide')}
        <label className={`privacy-toggle${has('glide') ? '' : ' is-locked'}`}>
          <input type="checkbox" checked={has('glide') && (save.glide ?? false)} disabled={!has('glide')} onChange={(e) => void store({ ...save, glide: e.target.checked })} />
          <span>
            🪂 Glider — hold the jump key (or jump button) while you’re in the air to glide.{' '}
            <span className="hint">With it on, there are ☁️ coins worth double and the odd ⛽ can up in the sky. Upgrade it to glide farther.</span>
          </span>
        </label>
        {(['gas', 'brake', 'jump'] as const).filter((p) => p !== 'jump' || (save.jump && has('jump')) || (save.glide && has('glide'))).map((p) => {
          const keys = p === 'gas' ? save.controls.gasKeys : p === 'brake' ? save.controls.brakeKeys : jumpKeysOf(save.controls);
          return (
            <div key={p} className="hill-garage__upgrade">
              <span>
                {p === 'gas' ? '🟢 Gas' : p === 'brake' ? '🔴 Brake' : '🦘 Jump'} key: <strong>{keys.length ? keys.map(keyName).join(' / ') : 'none'}</strong>
              </span>
              <button type="button" className="secondary" onClick={() => setListening(listening === p ? null : p)}>
                {listening === p ? 'Press a key… (Esc = cancel)' : 'Change'}
              </button>
            </div>
          );
        })}
        {((save.jump && has('jump')) || (save.glide && has('glide'))) && (
          <div className="hill-garage__mouse" role="radiogroup" aria-label="Jump button">
            <strong>🦘 Jump button (mouse / touch)</strong>
            {(Object.keys(JUMP_TAP_LABEL) as JumpTap[]).map((t) => (
              <label key={t} className="privacy-toggle">
                <input type="radio" name="hill-jump-tap" checked={jumpTapOf(save.controls) === t} onChange={() => void store({ ...save, controls: { ...save.controls, jumpTap: t } })} />
                <span>{JUMP_TAP_LABEL[t]}</span>
              </label>
            ))}
            {jumpTapOf(save.controls) === 'middle' && save.controls.mouse === 'buttons' && (
              <p className="hint">With “left button = gas”, clicking the middle of the game jumps instead of gas — the JUMP button or the wheel click may suit you better.</p>
            )}
          </div>
        )}
        <div className="hill-garage__mouse" role="radiogroup" aria-label="Mouse">
          {(Object.keys(MOUSE_LABEL) as Array<Controls['mouse']>).map((m) => (
            <label key={m} className="privacy-toggle">
              <input type="radio" name="hill-mouse" checked={save.controls.mouse === m} onChange={() => void store({ ...save, controls: { ...save.controls, mouse: m } })} />
              <span>🖱️ {MOUSE_LABEL[m]}</span>
            </label>
          ))}
        </div>
        <p className="hint">
          The on-screen pedals always work too (touch screens).{' '}
          <button type="button" className="link-button" onClick={() => void store({ ...save, controls: DEFAULT_CONTROLS })}>
            Back to the usual keys (→ / D gas, ← / A brake, Space jump)
          </button>
        </p>
      </section>

      <section className="panel">
        <h2>🔧 Upgrades</h2>
        {[...UPGRADE_KEYS, ...(save.jump && has('jump') ? (['jump'] as const) : []), ...(save.glide && has('glide') ? (['glide'] as const) : [])].map((k) => {
          const lvl = save.upgrades[k] ?? 0;
          const cost = UPGRADE_COST[lvl];
          return (
            <div key={k} className="hill-garage__upgrade">
              <div>
                <div>{UPGRADE_LABEL[k]}</div>
                <div className="hill-garage__pips" aria-label={`Level ${lvl} of ${MAX_LEVEL}`}>
                  {Array.from({ length: MAX_LEVEL }, (_, i) => (
                    <span key={i} className={i < lvl ? 'is-on' : ''} />
                  ))}
                </div>
              </div>
              <div className="hill-garage__upgrade-btns">
                {lvl > 0 && (
                  <button type="button" className="secondary" onClick={() => remove(k)} title={`Take one level off — get 🪙 ${UPGRADE_COST[lvl - 1]} back`}>
                    − <span className="hint">+🪙 {UPGRADE_COST[lvl - 1]}</span>
                  </button>
                )}
                {lvl >= MAX_LEVEL ? (
                  <span className="hint">Max!</span>
                ) : (
                  <button type="button" className="secondary" disabled={save.coins < cost} onClick={() => buy(k)}>
                    🪙 {cost}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <p className="hint">− takes a level off and gives its coins back (if the car's too fast or too bouncy for you).</p>
        <p className="hint">Coins come from the road (bigger ones further on), flips (+25) and big jumps (+10). They're only for this game — not 💎 tokens or ⭐ stars.</p>
      </section>

      {info.top.length > 0 && (
        <section className="panel">
          <h2>🏆 Family best (any world)</h2>
          <ol className="hill-garage__top">
            {info.top.map((t) => {
              const m = byId.get(t.member_id);
              return (
                <li key={t.member_id}>
                  <MemberAvatar member={m ?? null} size={28} /> {m?.name ?? '—'} <strong>{t.score} m</strong>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="panel">
        <h2>How to play</h2>
        <ul className="hint">
          <li><strong>GAS</strong> to go, <strong>BRAKE</strong> to slow down or back up — keys and mouse are set under 🎮 Controls.</li>
          <li>The car is bouncy: gas lifts the nose, and too much on a hill flips you over backwards. Ease off, or tap the brake to bring the nose down. Landing on your head — or on your back — ends the run.</li>
          <li>In the air, gas tips you back and brake tips you forward: land on your wheels, or do a flip for coins.</li>
          <li>Grab ⛽ cans before the tank runs dry. They get further apart the further you go.</li>
          <li>🦘 With Jump on (🎮 Controls): press the jump key (Space unless you changed it) or your jump button — the middle of the screen, an on-screen JUMP button or the mouse wheel click — to hop.</li>
        </ul>
      </section>
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}
