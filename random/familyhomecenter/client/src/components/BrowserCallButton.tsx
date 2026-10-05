import { useEffect, useRef, useState } from 'react';
import { Device, type Call } from '@twilio/voice-sdk';
import { api } from '../api/client.js';

type CallState = 'idle' | 'connecting' | 'in-call';

function fmtDuration(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Real click-to-call via Twilio Voice (server/src/routes/calling.ts) — only renders anything once
 * GET /calling/status confirms it's configured (a paid, opt-in integration; see
 * docs/TWILIO_CALLING_SETUP.md). Everyone can use it, same as the tel:/sms: Call/Text links.
 */
export function BrowserCallButton({ phone, callerLabel }: { phone: string; callerLabel: string }) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    api.get<{ enabled: boolean }>('/calling/status').then((s) => setEnabled(s.enabled)).catch(() => {});
  }, []);

  const teardown = () => {
    callRef.current?.disconnect();
    deviceRef.current?.destroy();
    callRef.current = null;
    deviceRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Hang up and release the microphone if this card unmounts mid-call (e.g. navigating away).
  useEffect(() => teardown, []);

  const endCall = () => {
    teardown();
    setState('idle');
  };

  const startCall = async () => {
    setError(null);
    setState('connecting');
    try {
      const { token } = await api.get<{ token: string }>(`/calling/token?identity=${encodeURIComponent(callerLabel)}`);
      // publishEvents: false — don't send Twilio's call-quality statistics ("Voice Insights"). The SDK
      // honors it but leaves it off its public options type, hence the separate object.
      const deviceOptions = { logLevel: 'error' as const, publishEvents: false };
      const device = new Device(token, deviceOptions);
      deviceRef.current = device;
      const call = await device.connect({ params: { To: phone } });
      callRef.current = call;
      call.on('accept', () => {
        setState('in-call');
        setSeconds(0);
        timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      });
      call.on('disconnect', endCall);
      call.on('cancel', endCall);
      call.on('reject', endCall);
      call.on('error', (err: Error) => {
        setError(err.message || 'Call error');
        endCall();
      });
    } catch (err) {
      setError((err as Error).message || 'Could not start the call — check microphone permission');
      teardown();
      setState('idle');
    }
  };

  const toggleMute = () => {
    const call = callRef.current;
    if (!call) return;
    call.mute(!call.isMuted());
  };

  if (!enabled) return null;

  if (state === 'idle') {
    return (
      <div className="contacts-page__browser-call">
        <button type="button" className="secondary contacts-page__link-btn" onClick={startCall}>
          📱 Call (browser)
        </button>
        {error && <span className="hint">{error}</span>}
      </div>
    );
  }

  return (
    <div className="contacts-page__browser-call contacts-page__browser-call--active">
      <span>{state === 'connecting' ? 'Calling…' : fmtDuration(seconds)}</span>
      {state === 'in-call' && (
        <button type="button" className="secondary" onClick={toggleMute}>
          {callRef.current?.isMuted() ? 'Unmute' : 'Mute'}
        </button>
      )}
      <button type="button" className="task-form__delete" onClick={endCall}>Hang up</button>
    </div>
  );
}
