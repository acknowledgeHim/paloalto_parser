// Completion sounds are synthesized with the Web Audio API rather than shipped as audio files —
// no extra assets, no licensing to worry about, and it works fully offline on the Pi.

export const SOUND_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'chime', label: 'Chime' },
  { id: 'ding', label: 'Ding' },
  { id: 'fanfare', label: 'Fanfare' },
  { id: 'cowbell', label: 'Cowbell' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'trumpet', label: 'Trumpet' },
  { id: 'xylophone', label: 'Xylophone' },
  { id: 'sparkle', label: 'Sparkle' },
  { id: 'laser', label: 'Laser' },
  { id: 'robot', label: 'Robot' },
  { id: 'custom', label: 'Upload my own MP3…' },
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

function sweep(ctx: AudioContext, at: number, fromFreq: number, toFreq: number, duration: number, gain = 0.2, type: OscillatorType = 'sawtooth') {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromFreq, at);
  osc.frequency.exponentialRampToValueAtTime(toFreq, at + duration);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, at + duration);
  osc.connect(env).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

const PLAYERS: Record<Exclude<SoundId, 'none' | 'custom'>, (ctx: AudioContext) => void> = {
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
  trumpet: (ctx) => {
    const now = ctx.currentTime;
    [392, 392, 587.33].forEach((freq, i) => tone(ctx, now + i * 0.16, freq, 0.4, 0.22, 'sawtooth'));
  },
  xylophone: (ctx) => {
    const now = ctx.currentTime;
    [523.25, 587.33, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(ctx, now + i * 0.06, freq, 0.3, 0.2, 'triangle'));
  },
  sparkle: (ctx) => {
    const now = ctx.currentTime;
    [1568, 1760, 2093, 2637].forEach((freq, i) => tone(ctx, now + i * 0.05, freq, 0.25, 0.12, 'triangle'));
  },
  laser: (ctx) => {
    sweep(ctx, ctx.currentTime, 1800, 220, 0.35, 0.18, 'sawtooth');
  },
  robot: (ctx) => {
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) tone(ctx, now + i * 0.06, i % 2 === 0 ? 440 : 494, 0.08, 0.15, 'square');
  },
};

// Custom MP3 playback (client/src/components/FamilyMemberFormModal.tsx uploads it) — never plays
// the whole file, just a short clip with a quick fade-out so it always feels like a "sting", not
// a song starting to play.
const CUSTOM_CLIP_SECONDS = 4;
const CUSTOM_FADE_SECONDS = 0.4;

/** Plays a short clip (with fade-out) of whatever audio URL is given — a server file, or a local
 *  data:/blob: URL for previewing an upload before it's saved. */
export function playAudioClip(url: string): void {
  const audio = new Audio(url);
  audio.volume = 1;
  audio.play().catch((err) => console.warn('[sounds] failed to play audio clip', err));

  window.setTimeout(() => {
    const steps = 10;
    let step = 0;
    const fadeInterval = window.setInterval(() => {
      step++;
      audio.volume = Math.max(0, 1 - step / steps);
      if (step >= steps) {
        window.clearInterval(fadeInterval);
        audio.pause();
      }
    }, (CUSTOM_FADE_SECONDS * 1000) / steps);
  }, (CUSTOM_CLIP_SECONDS - CUSTOM_FADE_SECONDS) * 1000);
}

/** `memberId` is only needed for `soundId === 'custom'` (to know whose uploaded MP3 to play). */
export function playCompletionSound(soundId: string | null | undefined, memberId?: string): void {
  if (!soundId || soundId === 'none') return;
  if (soundId === 'custom') {
    if (memberId) playAudioClip(`/api/family-members/${memberId}/sound-file`);
    return;
  }
  const player = PLAYERS[soundId as Exclude<SoundId, 'none' | 'custom'>];
  if (!player) return;
  try {
    player(getContext());
  } catch (err) {
    console.warn('[sounds] failed to play completion sound', err);
  }
}
