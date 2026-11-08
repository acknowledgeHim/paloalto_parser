import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Closet } from '../api/client.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { outfitOf, useOutfitCatalog } from '../utils/outfits.js';
import { MAX_LEVEL, UPGRADE_COST, UPGRADE_KEYS, type Upgrades } from './hillPhysics.js';
import { HillHopperRun, type RunResult } from './HillHopperRun.js';

interface Save {
  coins: number;
  upgrades: Upgrades;
  vehicle: string | null; // a Dress up vehicle id, or null for the buggy
}
interface PlayInfo {
  save: Partial<Save> | null;
  best: number | null;
  top: Array<{ member_id: string; score: number }>;
}

const GAME = 'hill-hopper';
const NO_UPGRADES: Upgrades = { engine: 0, tires: 0, springs: 0, tank: 0 };
const UPGRADE_LABEL: Record<keyof Upgrades, string> = {
  engine: '🔧 Engine — faster, more pull up hills',
  tires: '🛞 Tires — more grip, less spinning',
  springs: '🪀 Springs — smoother over bumps',
  tank: '⛽ Fuel tank — drive longer between cans',
};
const WHY: Record<RunResult['why'], string> = { crash: '💥 Bonk! Your head hit the ground.', fuel: '⛽ Out of fuel.', quit: '✕ Stopped.' };

/** ⛰️ Hill Hopper: the garage (upgrades, which ride to drive, best runs), then the run itself. */
export function HillHopperPage() {
  const { members, activeProfile } = useFamilyMembers();
  const me = activeProfile;
  const catalog = useOutfitCatalog();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [save, setSave] = useState<Save>({ coins: 0, upgrades: NO_UPGRADES, vehicle: null });
  const [owned, setOwned] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [last, setLast] = useState<{ r: RunResult; newBest: boolean } | null>(null);

  const load = () => {
    if (!me) return;
    api
      .get<PlayInfo>(`/games/${GAME}/play/${me.id}`)
      .then((i) => {
        setInfo(i);
        const worn = outfitOf(me).vehicle ?? null;
        setSave({
          coins: i.save?.coins ?? 0,
          upgrades: { ...NO_UPGRADES, ...(i.save?.upgrades ?? {}) },
          vehicle: i.save?.vehicle !== undefined ? i.save.vehicle : worn,
        });
      })
      .catch((e) => setError((e as Error).message));
    api.get<Closet>(`/outfits/${me.id}`).then((c) => setOwned(c.owned)).catch(() => setOwned([]));
  };
  useEffect(load, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const vehicles = useMemo(() => (catalog?.items ?? []).filter((i) => i.slot === 'vehicle' && owned.includes(i.id)), [catalog, owned]);
  const hat = useMemo(() => {
    const id = me ? outfitOf(me).hat : undefined;
    return catalog?.items.find((i) => i.id === id)?.emoji ?? null;
  }, [catalog, me]);
  const vehicleEmoji = catalog?.items.find((i) => i.id === save.vehicle && owned.includes(i.id))?.emoji ?? null;

  const store = async (next: Save, result?: RunResult) => {
    setSave(next);
    if (!me) return;
    try {
      const r = await api.post<{ best: number | null }>(`/games/${GAME}/play/${me.id}/result`, {
        score: result?.distance ?? 0,
        detail: result ? { coins: result.coins, flips: result.flips, why: result.why } : undefined,
        save: next,
        acting_member_id: me.id,
      });
      setInfo((i) => (i ? { ...i, best: r.best } : i));
    } catch (e) {
      setError((e as Error).message);
    }
  };

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

  if (playing) {
    return (
      <HillHopperRun
        driver={{ id: me.id, name: me.name, color: me.color, avatar: me.avatar ?? null, hat }}
        vehicle={vehicleEmoji}
        upgrades={save.upgrades}
        best={info.best}
        onEnd={(r) => {
          setPlaying(false);
          setLast({ r, newBest: r.distance > (info.best ?? 0) });
          void store({ ...save, coins: save.coins + r.coins }, r);
        }}
      />
    );
  }

  const buy = (k: keyof Upgrades) => {
    const lvl = save.upgrades[k];
    const cost = UPGRADE_COST[lvl];
    if (lvl >= MAX_LEVEL || save.coins < cost) return;
    void store({ ...save, coins: save.coins - cost, upgrades: { ...save.upgrades, [k]: lvl + 1 } });
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
            🪙 {save.coins} coins · Best {info.best ?? 0} m
          </div>
        </div>
        <button type="button" className="hill-garage__go" onClick={() => { setLast(null); setPlaying(true); }}>
          ▶ Drive!
        </button>
      </section>

      <section className="panel">
        <h2>🚗 Your ride</h2>
        <div className="hill-garage__rides">
          <button type="button" className={`hill-garage__ride${!vehicleEmoji ? ' is-on' : ''}`} onClick={() => void store({ ...save, vehicle: null })}>
            <span>🛞</span>Buggy
          </button>
          {vehicles.map((v) => (
            <button key={v.id} type="button" className={`hill-garage__ride${save.vehicle === v.id ? ' is-on' : ''}`} onClick={() => void store({ ...save, vehicle: v.id })}>
              <span>{v.emoji}</span>
              {v.name}
            </button>
          ))}
        </div>
        <p className="hint">
          Rides you've bought in <Link to="/dress-up">👕 Dress up → 🚗 Vehicles</Link> show up here. They all drive the same — upgrades are what make it faster.
        </p>
      </section>

      <section className="panel">
        <h2>🔧 Upgrades</h2>
        {UPGRADE_KEYS.map((k) => {
          const lvl = save.upgrades[k];
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
              {lvl >= MAX_LEVEL ? (
                <span className="hint">Max!</span>
              ) : (
                <button type="button" className="secondary" disabled={save.coins < cost} onClick={() => buy(k)}>
                  🪙 {cost}
                </button>
              )}
            </div>
          );
        })}
        <p className="hint">Coins come from the road (bigger ones further on), flips (+25) and big jumps (+10). They're only for this game — not Prize Bank stars.</p>
      </section>

      {info.top.length > 0 && (
        <section className="panel">
          <h2>🏆 Family best</h2>
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
          <li><strong>GAS</strong> (right pedal, → or D) to go; <strong>BRAKE</strong> (left pedal, ← or A) to slow down or back up.</li>
          <li>Too much gas on a hill tips you over backwards — ease off. If your head touches the ground, the run's over.</li>
          <li>In the air, gas tips you back and brake tips you forward: land on your wheels, or do a flip for coins.</li>
          <li>Grab ⛽ cans before the tank runs dry. They get further apart the further you go.</li>
        </ul>
      </section>
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}
