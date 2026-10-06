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

/** A short tune for each all-done celebration (components/Celebration.tsx), a little longer and
 *  bigger than a single task's sound. */
const TUNES: Record<string, (ctx: AudioContext) => void> = {
  confetti: (ctx) => {
    const now = ctx.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(ctx, now + i * 0.11, f, 0.3, 0.18, 'square'));
    [659.25, 783.99, 1046.5].forEach((f) => tone(ctx, now + 0.5, f, 0.9, 0.12, 'triangle'));
  },
  fireworks: (ctx) => {
    const now = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      sweep(ctx, now + i * 0.4, 300, 1400, 0.35, 0.06, 'triangle');
      tone(ctx, now + i * 0.4 + 0.38, 90, 0.25, 0.3, 'square');
      [1568, 2093, 2637].forEach((f, k) => tone(ctx, now + i * 0.4 + 0.42 + k * 0.04, f, 0.2, 0.05, 'triangle'));
    }
  },
  balloons: (ctx) => {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(ctx, now + i * 0.09, f, 0.35, 0.16, 'triangle'));
  },
  rocket: (ctx) => {
    const now = ctx.currentTime;
    [0, 0.25, 0.5].forEach((t) => tone(ctx, now + t, 440, 0.12, 0.15, 'square')); // 3, 2, 1…
    sweep(ctx, now + 0.8, 120, 1600, 1.6, 0.14, 'sawtooth');
  },
  unicorn: (ctx) => {
    const now = ctx.currentTime;
    [1046.5, 1318.5, 1568, 2093, 1568, 1318.5, 1568, 2093, 2637].forEach((f, i) => tone(ctx, now + i * 0.08, f, 0.4, 0.1, 'sine'));
  },
  dino: (ctx) => {
    const now = ctx.currentTime;
    sweep(ctx, now, 180, 60, 0.9, 0.22, 'sawtooth');
    for (let i = 0; i < 6; i++) tone(ctx, now + 0.9 + i * 0.48, 55, 0.25, 0.35, 'square');
  },
  dance: (ctx) => {
    const now = ctx.currentTime;
    const bass = [130.81, 130.81, 155.56, 174.61];
    for (let i = 0; i < 16; i++) {
      if (i % 2 === 0) tone(ctx, now + i * 0.21, 60, 0.12, 0.3, 'sine'); // kick
      tone(ctx, now + i * 0.21, bass[Math.floor(i / 4) % bass.length], 0.18, 0.12, 'square');
    }
  },
  trophy: (ctx) => {
    const now = ctx.currentTime;
    [[392, 0], [392, 0.15], [392, 0.3], [523.25, 0.45]].forEach(([f, t]) => tone(ctx, now + t, f, 0.3, 0.2, 'sawtooth'));
    [523.25, 659.25, 783.99].forEach((f) => tone(ctx, now + 0.8, f, 1.1, 0.12, 'sawtooth'));
  },
};

export function playCelebrationTune(id: string): void {
  const tune = TUNES[id];
  if (!tune) return;
  try {
    tune(getContext());
  } catch (err) {
    console.warn('[sounds] failed to play celebration tune', err);
  }
}
