import { useEffect, useRef, useState } from 'react';

/**
 * 📹 The camera side of a tablet a parent has turned into a camera (Settings → 📹 Cameras). Runs on
 * every screen of the app (and under the screensaver): checks in every few seconds, and while a
 * parent has its camera on, keeps the camera open and
 *  - sends a picture a second while a parent is watching it live, and
 *  - with "save movement" on, compares small pictures twice a second and sends while something moves.
 * A "📹 Camera on" badge shows in the corner while it's on (a parent can hide it per camera).
 */

const KEY = 'familyhomecenter.camera';
export const CAMERA_DEVICE_CHANGED = 'camera-device-changed';

export interface CameraOrders {
  id: string;
  name: string;
  enabled: boolean;
  facing: 'user' | 'environment';
  motion: boolean;
  sensitivity: number;
  show_badge: boolean;
  live: boolean;
}

export function thisCamera(): { id: string; token: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && typeof v.id === 'string' && typeof v.token === 'string' ? v : null;
  } catch {
    return null;
  }
}
export function setThisCamera(v: { id: string; token: string } | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* not remembered */
  }
  window.dispatchEvent(new Event(CAMERA_DEVICE_CHANGED));
}

/** Can this page use a camera at all? (Browsers only allow it over HTTPS, or on localhost.) */
export const cameraAllowedHere = () => window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);

const SMALL_W = 64;
const SMALL_H = 48;
const SEND_W = 640;

export function CameraAgent() {
  const [cam, setCam] = useState(thisCamera);
  const [orders, setOrders] = useState<CameraOrders | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const status = useRef('off');
  const ordersRef = useRef<CameraOrders | null>(null);
  ordersRef.current = orders;

  useEffect(() => {
    const changed = () => setCam(thisCamera());
    window.addEventListener(CAMERA_DEVICE_CHANGED, changed);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener(CAMERA_DEVICE_CHANGED, changed);
      window.removeEventListener('storage', changed);
    };
  }, []);

  // Check in: every 3s while on, every 15s while off.
  useEffect(() => {
    if (!cam) {
      setOrders(null);
      return;
    }
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const hello = async () => {
      try {
        const r = await fetch('/api/cameras/hello', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cam.id, token: cam.token, status: status.current }),
        });
        if (r.status === 404 || r.status === 410) {
          setThisCamera(null);
          return;
        }
        if (r.ok && !stop) setOrders(await r.json());
      } catch {
        /* the Pi is restarting — try again soon */
      }
      if (!stop) timer = setTimeout(hello, ordersRef.current?.enabled ? 3000 : 15000);
    };
    void hello();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [cam]);

  // The camera itself, while it's on.
  const enabled = Boolean(cam && orders?.enabled);
  const facing = orders?.facing ?? 'user';
  useEffect(() => {
    if (!cam || !enabled) {
      status.current = 'off';
      setProblem(null);
      return;
    }
    if (!cameraAllowedHere()) {
      status.current = 'needs-https';
      setProblem('needs HTTPS');
      return;
    }
    let stop = false;
    let stream: MediaStream | null = null;
    let tick: ReturnType<typeof setInterval>;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const small = document.createElement('canvas');
    small.width = SMALL_W;
    small.height = SMALL_H;
    const smallCtx = small.getContext('2d', { willReadFrequently: true })!;
    const big = document.createElement('canvas');
    const bigCtx = big.getContext('2d')!;
    let prev: Uint8ClampedArray | null = null;
    let movingUntil = 0;
    let lastSent = 0;
    let sending = false;

    const send = (motion: boolean) => {
      if (sending || !video.videoWidth) return;
      sending = true;
      lastSent = Date.now();
      big.width = Math.min(SEND_W, video.videoWidth);
      big.height = Math.round((big.width / video.videoWidth) * video.videoHeight);
      bigCtx.drawImage(video, 0, 0, big.width, big.height);
      big.toBlob(
        (blob) => {
          if (!blob || stop) {
            sending = false;
            return;
          }
          fetch(`/api/cameras/${cam.id}/frame${motion ? '?motion=1' : ''}`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg', 'x-camera-token': cam.token },
            body: blob,
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((o) => o && !stop && setOrders(o))
            .catch(() => {})
            .finally(() => (sending = false));
        },
        'image/jpeg',
        0.7
      );
    };

    const look = () => {
      const o = ordersRef.current;
      if (!o || !video.videoWidth) return;
      const now = Date.now();
      if (o.motion) {
        smallCtx.drawImage(video, 0, 0, SMALL_W, SMALL_H);
        const px = smallCtx.getImageData(0, 0, SMALL_W, SMALL_H).data;
        const grey = new Uint8ClampedArray(SMALL_W * SMALL_H);
        let sum = 0;
        for (let i = 0; i < grey.length; i++) {
          grey[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
          sum += grey[i];
        }
        if (prev && sum / grey.length > 12) {
          let changed = 0;
          for (let i = 0; i < grey.length; i++) if (Math.abs(grey[i] - prev[i]) > 28) changed++;
          // Sensitivity 100 → 0.3% of the picture changing counts; 1 → about 9%.
          const need = 0.003 + ((100 - o.sensitivity) / 100) * 0.09;
          if (changed / grey.length > need) movingUntil = now + 5000;
        }
        prev = grey;
      }
      const moving = o.motion && now < movingUntil;
      if ((o.live || moving) && now - lastSent >= 950) send(moving);
    };

    status.current = 'starting';
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(async (s) => {
        if (stop) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        video.srcObject = s;
        await video.play().catch(() => {});
        status.current = 'ok';
        setProblem(null);
        tick = setInterval(look, 500);
      })
      .catch((err: Error) => {
        const denied = err.name === 'NotAllowedError' || err.name === 'SecurityError';
        status.current = denied ? 'denied' : err.name === 'NotFoundError' ? 'no-camera' : 'error';
        setProblem(denied ? 'not allowed' : err.name === 'NotFoundError' ? 'no camera found' : err.message);
      });
    return () => {
      stop = true;
      clearInterval(tick);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [cam, enabled, facing]);

  if (!cam || !orders?.enabled || !orders.show_badge) return null;
  return (
    <div className={`camera-badge ${orders.live ? 'camera-badge--live' : ''}`} role="status">
      📹 Camera on{orders.live ? ' · 👀 live' : ''}
      {problem ? ` · ⚠️ ${problem}` : ''}
    </div>
  );
}
