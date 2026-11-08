import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  bodyPoint,
  fuelSpots,
  HEAD,
  newCar,
  placePickups,
  statsFor,
  step,
  Terrain,
  WHEEL_R,
  type Car,
  type Pickup,
  type Upgrades,
} from './hillPhysics.js';

export interface Driver {
  id: string;
  name: string;
  color: string;
  avatar: string | null;
  hat: string | null;
}

export interface RunResult {
  distance: number;
  coins: number;
  flips: number;
  why: 'crash' | 'fuel' | 'quit';
}

/** Vehicle pictures that already face right (most vehicle emoji face left, so they're mirrored). */
const FACES_RIGHT = new Set(['🚀', '✈️', '🛸', '🪂', '🛩️']);
const FUEL_PER_SEC = 4;
const DT = 1 / 240;

/**
 * ⛰️ One run of Hill Hopper on a canvas: the car, the hills, coins and fuel cans, and the HUD.
 * Gas / brake from the on-screen pedals (touch), or → / ← (also D / A) on a keyboard.
 */
export function HillHopperRun({
  driver,
  vehicle,
  upgrades,
  best,
  onEnd,
}: {
  driver: Driver;
  vehicle: string | null;
  upgrades: Upgrades;
  best: number | null;
  onEnd: (r: RunResult) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pedal = useRef({ gas: false, brake: false });
  const quit = useRef(false);
  const [, setPressed] = useState(0);

  useEffect(() => {
    const keys = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowright' || k === 'd' || k === 'arrowup' || k === 'w') pedal.current.gas = down;
      else if (k === 'arrowleft' || k === 'a' || k === 'arrowdown' || k === 's') pedal.current.brake = down;
      else return;
      e.preventDefault();
      setPressed((n) => n + 1);
    };
    const kd = keys(true);
    const ku = keys(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const terrain = new Terrain(7);
    const stats = statsFor(upgrades);
    const car: Car = newCar(terrain);
    const startX = car.x;
    const pickups: Pickup[] = [];
    let placedTo = placePickups(terrain, 400, pickups, 40);
    const fuelAt = fuelSpots(20000).map((x) => ({ x, taken: false }));
    let fuel = stats.tank;
    let started = false;
    let coins = 0;
    let flips = 0;
    let maxX = car.x;
    let airRot = 0;
    let airTime = 0;
    let stopped = 0;
    let toast: { text: string; until: number } | null = null;
    let ended = false;
    let last = performance.now();
    let acc = 0;
    let camY = car.y;
    let raf = 0;

    const face = new Image();
    let faceOk = false;
    if (driver.avatar === 'image' || driver.avatar === 'video') {
      face.onload = () => (faceOk = true);
      face.src = `/api/family-members/${driver.id}/avatar-image`;
    }

    const finish = (why: RunResult['why']) => {
      if (ended) return;
      ended = true;
      onEnd({ distance: Math.max(0, Math.floor(maxX - startX)), coins, flips, why });
    };

    const say = (text: string) => (toast = { text, until: performance.now() + 1600 });

    const sim = () => {
      const p = pedal.current;
      const input = p.gas && !p.brake ? 1 : p.brake && !p.gas ? -1 : 0;
      if (input !== 0) started = true;
      if (started) fuel = Math.max(0, fuel - FUEL_PER_SEC * DT);
      const r = step(car, terrain, stats, input, fuel > 0, DT);
      if (r.crashed) return finish('crash');
      // Flips: count the turning done while both wheels are off the ground.
      if (!r.grounded) {
        airRot += car.w * DT;
        airTime += DT;
      } else if (airTime > 0) {
        const n = Math.floor((Math.abs(airRot) + 0.4) / (2 * Math.PI));
        if (n > 0) {
          flips += n;
          coins += 25 * n;
          say(`${airRot > 0 ? '🔄 Backflip' : '🔃 Front flip'}${n > 1 ? ` ×${n}` : ''}! +${25 * n}`);
        } else if (airTime > 1.4) {
          coins += 10;
          say('🪽 Big air! +10');
        }
        airRot = 0;
        airTime = 0;
      }
      maxX = Math.max(maxX, car.x);
      if (fuel <= 0 && Math.hypot(car.vx, car.vy) < 0.4) {
        stopped += DT;
        if (stopped > 2) finish('fuel');
      } else stopped = 0;
    };

    const pickUp = () => {
      if (car.x + 300 > placedTo) placedTo = placePickups(terrain, placedTo + 400, pickups, placedTo);
      const near = (x: number, y: number, d: number) =>
        Math.hypot(car.x - x, car.y - y) < d || car.wheels.some((w) => Math.hypot(w.x - x, w.y - y) < d * 0.8);
      for (const c of pickups) {
        if (c.taken || Math.abs(c.x - car.x) > 3) continue;
        if (near(c.x, c.y, 1.3)) {
          c.taken = true;
          coins += c.value;
        }
      }
      for (const f of fuelAt) {
        if (f.taken || Math.abs(f.x - car.x) > 3) continue;
        if (near(f.x, terrain.h(f.x) + 0.8, 1.6)) {
          f.taken = true;
          fuel = stats.tank;
          say('⛽ Full tank!');
        }
      }
      // Don't keep thousands of old coins around.
      if (pickups.length > 400) pickups.splice(0, pickups.findIndex((c) => c.x > car.x - 30));
    };

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const S = Math.max(22, Math.min(W / 22, H / 11)); // pixels per metre
      camY += (car.y - camY) * 0.08;
      const camX = car.x - (W * 0.32) / S;
      const sx = (x: number) => (x - camX) * S;
      const sy = (y: number) => H * 0.58 - (y - camY) * S;

      // Sky, sun, far hills (they move slower — parallax).
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#6fb7ff');
      sky.addColorStop(1, '#d9f0ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255, 236, 140, 0.9)';
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.18, Math.min(W, H) * 0.07, 0, Math.PI * 2);
      ctx.fill();
      for (const [k, color, base] of [
        [0.15, '#a8d5a0', 0.55],
        [0.35, '#86c27c', 0.68],
      ] as Array<[number, string, number]>) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let px = 0; px <= W + 10; px += 10) {
          const wx = (px / S + camX * k) * 0.35;
          ctx.lineTo(px, H * base - (Math.sin(wx) * 0.5 + Math.sin(wx * 0.37 + 1) * 0.8) * S * 1.2);
        }
        ctx.lineTo(W, H);
        ctx.fill();
      }

      // The ground: dirt, a grass top.
      const x0 = camX - 1;
      const x1 = camX + W / S + 1;
      ctx.beginPath();
      ctx.moveTo(sx(x0), H + 10);
      for (let x = x0; x <= x1; x += 0.4) ctx.lineTo(sx(x), sy(terrain.h(x)));
      ctx.lineTo(sx(x1), H + 10);
      ctx.closePath();
      const dirt = ctx.createLinearGradient(0, sy(car.y), 0, H + sy(car.y));
      dirt.addColorStop(0, '#9b6b3d');
      dirt.addColorStop(1, '#6d4523');
      ctx.fillStyle = dirt;
      ctx.fill();
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 0.4) (x === x0 ? ctx.moveTo : ctx.lineTo).call(ctx, sx(x), sy(terrain.h(x)));
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = Math.max(4, S * 0.22);
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Distance signs every 100 m, and the best so far.
      ctx.font = `bold ${Math.round(S * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (let m = Math.ceil((x0 - startX) / 100) * 100; m + startX <= x1; m += 100) {
        if (m <= 0) continue;
        const gx = startX + m;
        const gy = terrain.h(gx);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(sx(gx) - 2, sy(gy + 1.8), 4, S * 1.8);
        ctx.fillStyle = '#fff8e1';
        ctx.fillRect(sx(gx) - S * 0.75, sy(gy + 2.3), S * 1.5, S * 0.6);
        ctx.fillStyle = '#5d4037';
        ctx.fillText(`${m} m`, sx(gx), sy(gy + 1.85));
      }
      if (best && best > 0) {
        const bx = startX + best;
        if (bx > x0 && bx < x1) {
          const by = terrain.h(bx);
          ctx.fillStyle = '#333';
          ctx.fillRect(sx(bx) - 2, sy(by + 3), 4, S * 3);
          ctx.fillStyle = '#e53935';
          ctx.beginPath();
          ctx.moveTo(sx(bx) + 2, sy(by + 3));
          ctx.lineTo(sx(bx) + S * 1.3, sy(by + 2.6));
          ctx.lineTo(sx(bx) + 2, sy(by + 2.2));
          ctx.fill();
          ctx.fillStyle = '#b71c1c';
          ctx.fillText('Best', sx(bx), sy(by + 3.3));
        }
      }

      // Coins and fuel cans.
      for (const c of pickups) {
        if (c.taken || c.x < x0 || c.x > x1) continue;
        const r = S * (c.value >= 25 ? 0.42 : c.value >= 10 ? 0.36 : 0.3);
        ctx.fillStyle = c.value >= 25 ? '#ff9800' : c.value >= 10 ? '#cfd8dc' : '#ffd54f';
        ctx.strokeStyle = c.value >= 25 ? '#e65100' : c.value >= 10 ? '#78909c' : '#f9a825';
        ctx.lineWidth = Math.max(2, S * 0.07);
        ctx.beginPath();
        ctx.arc(sx(c.x), sy(c.y), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.font = `${Math.round(S * 1.1)}px system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      for (const f of fuelAt) {
        if (f.taken || f.x < x0 || f.x > x1) continue;
        ctx.fillText('⛽', sx(f.x), sy(terrain.h(f.x) + 0.8));
      }

      // The car: springs, wheels, body, driver.
      for (const w of car.wheels) {
        const a = bodyPoint(car, w.ax, w.ay + 0.25);
        ctx.strokeStyle = '#616161';
        ctx.lineWidth = Math.max(3, S * 0.12);
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(w.x), sy(w.y));
        ctx.stroke();
      }
      for (const w of car.wheels) {
        ctx.save();
        ctx.translate(sx(w.x), sy(w.y));
        ctx.rotate(-w.angle);
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.arc(0, 0, WHEEL_R * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#bdbdbd';
        ctx.beginPath();
        ctx.arc(0, 0, WHEEL_R * S * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#757575';
        ctx.lineWidth = Math.max(2, S * 0.06);
        for (let k = 0; k < 3; k++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(-WHEEL_R * S * 0.5, 0);
          ctx.lineTo(WHEEL_R * S * 0.5, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(sx(car.x), sy(car.y));
      ctx.rotate(-car.a);
      if (vehicle) {
        ctx.font = `${Math.round(S * 2.6)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!FACES_RIGHT.has(vehicle)) ctx.scale(-1, 1);
        ctx.fillText(vehicle, 0, -S * 0.1);
        if (!FACES_RIGHT.has(vehicle)) ctx.scale(-1, 1);
      } else {
        // The buggy: a body in their colour and a roll bar.
        ctx.fillStyle = driver.color || '#7c5cff';
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = Math.max(2, S * 0.07);
        ctx.beginPath();
        ctx.roundRect(-1.45 * S, -0.3 * S, 2.9 * S, 0.65 * S, 0.22 * S);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = Math.max(3, S * 0.1);
        ctx.beginPath();
        ctx.moveTo(-0.75 * S, -0.3 * S);
        ctx.lineTo(-0.7 * S, -1.35 * S);
        ctx.lineTo(0.35 * S, -1.35 * S);
        ctx.lineTo(0.75 * S, -0.3 * S);
        ctx.stroke();
      }
      // The driver's head: their avatar, with their hat.
      const hx = HEAD.x * S;
      const hy = -HEAD.y * S;
      const hr = HEAD.r * S;
      ctx.fillStyle = driver.color || '#7c5cff';
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
      if (faceOk) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(face, hx - hr, hy - hr, hr * 2, hr * 2);
        ctx.restore();
      } else if (driver.avatar && driver.avatar !== 'image' && driver.avatar !== 'video') {
        ctx.font = `${Math.round(hr * 1.3)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(driver.avatar, hx, hy + hr * 0.08);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(2, S * 0.06);
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.stroke();
      if (driver.hat) {
        ctx.font = `${Math.round(hr * 1.4)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(driver.hat, hx, hy - hr * 1.05);
      }
      ctx.restore();

      // HUD: fuel, coins, distance.
      const pad = 12;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const fw = Math.min(220, W * 0.38);
      const low = fuel / stats.tank < 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad, pad, fw + 44, 26);
      ctx.fillStyle = low && Math.floor(performance.now() / 300) % 2 ? '#ff5252' : low ? '#ff8a80' : '#69f0ae';
      ctx.fillRect(pad + 38, pad + 5, (fw * fuel) / stats.tank, 16);
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('⛽', pad + 8, pad + 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad, pad + 32, 150, 26);
      ctx.fillStyle = '#fff';
      ctx.fillText(`🪙 ${coins}`, pad + 8, pad + 35);
      const dist = Math.max(0, Math.floor(maxX - startX));
      ctx.textAlign = 'right';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(W - pad - 170, pad, 170, 30);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${dist} m${best ? ` / ${best}` : ''}`, W - pad - 10, pad + 4);
      if (toast && performance.now() < toast.until) {
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(Math.min(34, W / 16))}px system-ui, sans-serif`;
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeText(toast.text, W / 2, H * 0.16);
        ctx.fillStyle = '#ffeb3b';
        ctx.fillText(toast.text, W / 2, H * 0.16);
      }
      if (!started) {
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(Math.min(26, W / 20))}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText('Hold GAS to go!  In the air: gas tips back, brake tips forward', W / 2, H * 0.3);
      }
    };

    const frame = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= DT && !ended) {
        sim();
        acc -= DT;
      }
      if (!ended) pickUp();
      if (quit.current) finish('quit');
      draw();
      if (!ended) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // One run per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hold = (which: 'gas' | 'brake', down: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    pedal.current[which] = down;
    if (down) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setPressed((n) => n + 1);
  };

  return (
    <div className="hill-run">
      <canvas ref={canvas} className="hill-run__canvas" />
      <button type="button" className="hill-run__quit secondary" onClick={() => (quit.current = true)}>
        ✕ Stop
      </button>
      <button
        type="button"
        className={`hill-run__pedal hill-run__pedal--brake${pedal.current.brake ? ' is-down' : ''}`}
        onPointerDown={hold('brake', true)}
        onPointerUp={hold('brake', false)}
        onPointerCancel={hold('brake', false)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Brake"
      >
        BRAKE
      </button>
      <button
        type="button"
        className={`hill-run__pedal hill-run__pedal--gas${pedal.current.gas ? ' is-down' : ''}`}
        onPointerDown={hold('gas', true)}
        onPointerUp={hold('gas', false)}
        onPointerCancel={hold('gas', false)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Gas"
      >
        GAS
      </button>
    </div>
  );
}
