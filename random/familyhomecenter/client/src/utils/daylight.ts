import { useEffect, useState } from 'react';
import { api, type WeatherData } from '../api/client.js';

/**
 * 🌗 Day and night on the floor plan: follows today's sunrise and sunset (from the weather, or
 * 7am / 7pm when weather is off), plus rain, snow or fog when the weather has some.
 */
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type SkyWeather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';
export interface Sky {
  phase: SkyPhase;
  weather: SkyWeather;
}
/** 'auto' follows the clock; the others are for trying it out. */
export type SkyMode = 'auto' | 'day' | 'night';

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function weatherKind(code: number | undefined): SkyWeather {
  if (code == null) return 'clear';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'cloudy';
  return 'clear';
}

const minutesOf = (iso: string | null | undefined, fallback: number) => {
  const m = iso?.match(/T(\d\d):(\d\d)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
};

export function phaseAt(now: Date, sunrise: number, sunset: number): SkyPhase {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m >= sunrise - 40 && m < sunrise + 30) return 'dawn';
  if (m >= sunset - 40 && m < sunset + 30) return 'dusk';
  if (m >= sunrise + 30 && m < sunset - 40) return 'day';
  return 'night';
}

let shared: Promise<WeatherData | null> | null = null;
let sharedAt = 0;
function weather(): Promise<WeatherData | null> {
  if (!shared || Date.now() - sharedAt > 15 * 60_000) {
    sharedAt = Date.now();
    shared = api.get<WeatherData | null>('/weather').catch(() => null);
  }
  return shared;
}

export function useSky(mode: SkyMode): Sky {
  const [w, setW] = useState<WeatherData | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let live = true;
    const load = () => weather().then((x) => live && setW(x || null));
    load();
    const t = setInterval(() => {
      setNow(new Date());
      load();
    }, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  const today = w?.daily?.find((d) => d.date === localDate(now));
  const phase = mode === 'day' ? 'day' : mode === 'night' ? 'night' : phaseAt(now, minutesOf(today?.sunrise, 7 * 60), minutesOf(today?.sunset, 19 * 60));
  return { phase, weather: weatherKind(w?.current?.code) };
}
