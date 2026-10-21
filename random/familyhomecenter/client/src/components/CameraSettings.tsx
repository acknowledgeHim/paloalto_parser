import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type CameraInfo } from '../api/client.js';
import { CAMERA_DEVICE_CHANGED, cameraAllowedHere, setThisCamera, thisCamera, type CameraOrders } from './CameraAgent.js';
import { useActing } from '../pages/CamerasPage.js';
import { CameraStorageSettings } from './CameraStorageSettings.js';


/**
 * Settings → 📹 Cameras: make this tablet a camera (done once, on the tablet), the movement email,
 * and a link to the 📹 Cameras page where they're turned on and watched.
 */
export function CameraSettings() {
  const acting = useActing();
  const [mine, setMine] = useState(thisCamera);
  const [name, setName] = useState('');
  const [info, setInfo] = useState<{ cameras: CameraInfo[]; motion_email: boolean; storage_bytes: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const load = () => api.get<typeof info>(`/cameras?${acting.q}`).then(setInfo).catch((e) => setStatus(e.message));
  useEffect(() => {
    load();
    const changed = () => setMine(thisCamera());
    window.addEventListener(CAMERA_DEVICE_CHANGED, changed);
    return () => window.removeEventListener(CAMERA_DEVICE_CHANGED, changed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting.id]);

  const add = async () => {
    setStatus(null);
    try {
      const r = await api.post<CameraOrders & { token: string }>('/cameras/hello', {
        add: true,
        name: name.trim() || 'Tablet',
        id: mine?.id,
        token: mine?.token,
        acting_member_id: acting.id || null,
      });
      setThisCamera({ id: r.id, token: r.token ?? mine!.token });
      setStatus(`✅ This device is now the “${r.name}” camera. Turn it on from 📹 Cameras.`);
      load();
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  const remove = async () => {
    if (!mine || !window.confirm('Stop using this device as a camera? (Its saved clips are kept.)')) return;
    await api.post(`/cameras/${mine.id}/hide`, { acting_member_id: acting.id || null }).catch(() => {});
    setThisCamera(null);
    setStatus('This device is no longer a camera.');
    load();
  };
  const saveEmail = async (on: boolean) => {
    const r = await api.patch<{ motion_email: boolean }>('/cameras/settings', { motion_email: on, acting_member_id: acting.id || null });
    setInfo((i) => (i ? { ...i, motion_email: r.motion_email } : i));
  };
  const myInfo = info?.cameras.find((c) => c.id === mine?.id);

  return (
    <section className="panel">
      <h2>📹 Cameras</h2>
      <p className="hint">
        Use a wall tablet's camera as a security camera — only parents can turn it on, watch it, or see what it saved. Setup:
        docs/ANDROID_TABLET_SETUP.md.
      </p>
      <h3>This device</h3>
      {!cameraAllowedHere() && (
        <div className="settings-login__error">
          This page isn't open over HTTPS, so the browser won't let it use the camera. Open the HTTPS address (e.g. https://familyhub.local) on the
          tablet — see docs/ANDROID_TABLET_SETUP.md.
        </div>
      )}
      {mine && myInfo ? (
        <p>
          ✅ This device is the <strong>{myInfo.name}</strong> camera ({myInfo.enabled ? 'on' : 'off'}).{' '}
          <button type="button" className="link-button" onClick={remove}>
            Stop using this device as a camera
          </button>
        </p>
      ) : (
        <div className="task-form__row">
          <input placeholder="Name it — e.g. Kitchen" value={name} onChange={(e) => setName(e.target.value)} aria-label="Camera name" />
          <button type="button" onClick={add}>
            📹 Use this device as a camera
          </button>
        </div>
      )}
      {status && <div className="hint">{status}</div>}
      <h3>All cameras</h3>
      <p>
        {info ? `${info.cameras.length} camera${info.cameras.length === 1 ? '' : 's'}` : '…'} ·{' '}
        <Link to="/cameras">Open 📹 Cameras</Link> to turn them on, watch live and see movement.
      </p>
      <label className="privacy-toggle">
        <input type="checkbox" checked={Boolean(info?.motion_email)} disabled={!info} onChange={(e) => saveEmail(e.target.checked)} />
        Email parents when a camera saves movement (at most one email every 10 minutes per camera)
      </label>
      <CameraStorageSettings />
    </section>
  );
}
