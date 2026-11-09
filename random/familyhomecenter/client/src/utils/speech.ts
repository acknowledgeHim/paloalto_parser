/**
 * 🗣️ Say something out loud: the browser's own voice if it has an English one (phones, Windows,
 * Macs), otherwise the Family Home Center makes the audio (Chromium on a Pi often has no voices).
 * A new say() stops whatever was being said.
 */
let audio: HTMLAudioElement | null = null;
let browserVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): Promise<SpeechSynthesisVoice | null> {
  if (browserVoice !== undefined) return Promise.resolve(browserVoice);
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve((browserVoice = null));
  const choose = () => {
    const all = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('en'));
    return all.find((v) => v.lang === 'en-US' && v.localService) ?? all.find((v) => v.lang === 'en-US') ?? all[0] ?? null;
  };
  const now = choose();
  if (now) return Promise.resolve((browserVoice = now));
  // Voices often load a moment later.
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve((browserVoice = choose()));
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    setTimeout(done, 1200);
  });
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  if (audio) {
    audio.pause();
    audio = null;
  }
}

/** Say each piece in turn, with a short pause between ("cat" … "The cat sat." … "cat"). */
export async function say(pieces: string | string[], opts: { slow?: boolean } = {}): Promise<void> {
  stopSpeaking();
  const list = (Array.isArray(pieces) ? pieces : [pieces]).filter(Boolean);
  const mine = Symbol();
  current = mine;
  const voice = await pickVoice();
  for (const text of list) {
    if (current !== mine) return; // something else started talking
    if (voice) {
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = opts.slow ? 0.75 : 0.95;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const a = new Audio(`/api/learning/say?text=${encodeURIComponent(text)}${opts.slow ? '&slow=1' : ''}`);
        audio = a;
        a.onended = () => resolve();
        a.onerror = () => reject(new Error('This screen has no voice, and the Family Home Center can’t speak yet (a parent can install it — see 📚 Learning → ⚙️).'));
        a.play().catch(reject);
      });
    }
    if (list.length > 1) await new Promise((r) => setTimeout(r, 450));
  }
}
let current: symbol | null = null;
