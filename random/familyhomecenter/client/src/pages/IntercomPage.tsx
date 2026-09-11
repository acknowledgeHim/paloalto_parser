import { useEffect, useRef, useState } from 'react';
import { api, type Zone } from '../api/client.js';

type ConnState = 'idle' | 'connecting' | 'ready' | 'talking' | 'error';

/**
 * Push-to-talk paging into one or more zones' speakers. Requires the dashboard to be served over
 * HTTPS (browsers block microphone access on plain HTTP for any host but localhost) — see
 * docs/INTERCOM_SETUP.md.
 */
export function IntercomPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [state, setState] = useState<ConnState>('idle');
  const [error, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    api.get<Zone[]>('/music/zones').then(setZones).catch(console.error);
    return () => {
      stopTalking();
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleZone = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openSocket = (): Promise<WebSocket> =>
    new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws/intercom`);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error('Could not reach the intercom server'));
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'error') setErrorMsg(msg.message);
        } catch {
          /* ignore non-JSON */
        }
      };
      ws.onclose = () => setState((s) => (s === 'talking' ? 'idle' : s));
    });

  const startTalking = async () => {
    if (selected.size === 0) {
      setErrorMsg('Pick at least one zone first');
      return;
    }
    if (!window.isSecureContext) {
      setErrorMsg('The microphone needs HTTPS — see docs/INTERCOM_SETUP.md');
      return;
    }
    setErrorMsg(null);
    setState('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ws = await openSocket();
      wsRef.current = ws;
      ws.send(JSON.stringify({ type: 'start', zones: Array.from(selected) }));

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0 && ws.readyState === WebSocket.OPEN) ev.data.arrayBuffer().then((buf) => ws.send(buf));
      };
      recorder.start(250); // send a chunk every 250ms so playback starts with low latency
      recorderRef.current = recorder;

      setState('talking');
    } catch (err) {
      console.error(err);
      setErrorMsg((err as Error).message || 'Could not start the intercom');
      setState('error');
      stopTalking();
    }
  };

  const stopTalking = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    setState('idle');
  };

  return (
    <div className="intercom-page">
      <h1>Intercom</h1>
      <p className="hint">
        Pick one or more zones, then press and hold Talk. Your voice plays through those zones'
        speakers right away (whatever's playing there ducks down automatically).
      </p>

      <div className="intercom-page__zones">
        {zones.map((z) => (
          <button
            key={z.id}
            className={`intercom-zone-button ${selected.has(z.id) ? 'intercom-zone-button--selected' : ''}`}
            onClick={() => toggleZone(z.id)}
          >
            {z.name}
          </button>
        ))}
        <button
          className={`intercom-zone-button ${selected.size === zones.length && zones.length > 0 ? 'intercom-zone-button--selected' : ''}`}
          onClick={() => setSelected(selected.size === zones.length ? new Set() : new Set(zones.map((z) => z.id)))}
        >
          All zones
        </button>
      </div>

      {error && <div className="intercom-page__error">{error}</div>}

      <button
        className={`talk-button ${state === 'talking' ? 'talk-button--active' : ''}`}
        onPointerDown={startTalking}
        onPointerUp={stopTalking}
        onPointerLeave={() => state === 'talking' && stopTalking()}
      >
        {state === 'talking' ? '🔴 Talking — release to stop' : state === 'connecting' ? 'Connecting…' : '🎙️ Press & hold to talk'}
      </button>
    </div>
  );
}
