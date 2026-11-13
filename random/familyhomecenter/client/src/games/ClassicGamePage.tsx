/*
 * Family Home Center — Copyright (c) 2026 the Family Home Center authors.
 * All rights reserved. Proprietary and confidential; see the LICENSE file.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface RomMeta {
  id: string;
  title: string;
  system: string;
  core: string;
}

/**
 * 🎮 Plays one uploaded ROM (a "classic game") in the self-hosted EmulatorJS emulator. The emulator
 * runs inside an iframe (/emulatorjs/play.html) so its audio and WASM are torn down the moment the
 * player leaves. Entitlement is checked first (owned, or a 🎟️ play left); fetching the ROM spends the
 * play, exactly like starting any other game.
 */
export function ClassicGamePage() {
  const { romId = '' } = useParams();
  const { activeProfile } = useFamilyMembers();
  const [meta, setMeta] = useState<RomMeta | null>(null);
  const [state, setState] = useState<'checking' | 'ready' | 'locked' | 'error'>('checking');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setState('checking');
    (async () => {
      try {
        const m = await api.get<RomMeta>(`/games/roms/${romId}/meta`);
        if (!alive) return;
        setMeta(m);
        if (!activeProfile) {
          setState('locked');
          setMsg('Pick who’s playing (your name, up top) first.');
          return;
        }
        const can = await api.get<{ ok: boolean; reason?: string }>(`/games/roms/${romId}/can-play?member=${activeProfile.id}`);
        if (!alive) return;
        if (can.ok) setState('ready');
        else {
          setState('locked');
          setMsg(can.reason ?? 'Unlock this game on the Games page to play.');
        }
      } catch (e) {
        if (alive) {
          setState('error');
          setMsg((e as Error).message);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [romId, activeProfile?.id]);

  const src =
    activeProfile && meta
      ? `/emulatorjs/play.html?core=${encodeURIComponent(meta.core)}&rom=${encodeURIComponent(`/api/games/roms/${romId}/rom?member=${activeProfile.id}`)}&name=${encodeURIComponent(meta.title)}`
      : '';

  return (
    <div className="classic-game">
      <div className="classic-game__bar">
        <Link className="button secondary" to="/games">
          ← Games
        </Link>
        <strong>{meta?.title ?? 'Classic game'}</strong>
      </div>
      {state === 'ready' && src ? (
        <iframe className="classic-game__frame" src={src} title={meta?.title ?? 'Classic game'} allow="gamepad; fullscreen; autoplay" />
      ) : (
        <div className="panel classic-game__msg">
          {state === 'checking' && <p className="hint">Loading…</p>}
          {state === 'locked' && (
            <>
              <p>🔒 {msg}</p>
              <Link className="button" to="/games">
                Go to 🎮 Games
              </Link>
            </>
          )}
          {state === 'error' && <p className="settings-login__error">{msg}</p>}
        </div>
      )}
      <p className="hint classic-game__hint">
        Controls: tap the on-screen buttons, use a USB controller, or the keyboard (arrows + Z/X). Save/load states and settings are in the emulator’s
        menu.
      </p>
    </div>
  );
}
