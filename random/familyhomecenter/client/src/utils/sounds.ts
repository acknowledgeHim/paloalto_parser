// Completion sounds are synthesized with the Web Audio API rather than shipped as audio files —
// no extra assets, no licensing to worry about, and it works fully offline on the Pi.

export const SOUND_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'chime', label: 'Chime' },
  { id: 'ding', label: 'Ding' },
  { id: 'fanfare', label: 'Fanfare' },
  { id: 'cowbell', label: 'Cowbell' },
  { id: 'cheer', label: 'Cheer' },
] as const;

export type SoundId = (typeof SOUND_OPTIONS)[number]['id'];

let ctx: AudioContext | null = null;
function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(ctx: AudioContext, at: number, freq: number, duration: number, gain = 0.2, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, at + duration);
  osc.connect(env).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

const PLAYERS: Record<Exclude<SoundId, 'none'>, (ctx: AudioContext) => void> = {
  chime: (ctx) => {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => tone(ctx, now + i * 0.12, freq, 0.5, 0.18));
  },
  ding: (ctx) => {
    tone(ctx, ctx.currentTime, 987.77, 0.4, 0.25, 'triangle');
  },
  fanfare: (ctx) => {
    const now = ctx.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((freq, i) => tone(ctx, now + i * 0.1, freq, 0.35, 0.2, 'square'));
  },
  cowbell: (ctx) => {
    const now = ctx.currentTime;
    [800, 540].forEach((freq) => tone(ctx, now, freq, 0.3, 0.15, 'square'));
    [800, 540].forEach((freq) => tone(ctx, now + 0.18, freq, 0.3, 0.15, 'square'));
  },
  cheer: (ctx) => {
    const now = ctx.currentTime;
    [523.25, 587.33, 659.25, 698.46, 783.99].forEach((freq, i) => tone(ctx, now + i * 0.07, freq, 0.6, 0.14));
  },
};

export function playCompletionSound(soundId: string | null | undefined): void {
  if (!soundId || soundId === 'none') return;
  const player = PLAYERS[soundId as Exclude<SoundId, 'none'>];
  if (!player) return;
  try {
    player(getContext());
  } catch (err) {
    console.warn('[sounds] failed to play completion sound', err);
  }
}
