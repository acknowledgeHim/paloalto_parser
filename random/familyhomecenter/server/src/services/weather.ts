import { config } from '../config.js';

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers',
  85: 'Light snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm w/ hail',
};

export function describeWeatherCode(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? 'Unknown';
}

let cache: { fetchedAt: number; data: unknown } | null = null;
const CACHE_MS = 10 * 60 * 1000; // Open-Meteo updates hourly; 10 min cache is plenty and keeps the dashboard snappy.

export async function getWeather(): Promise<unknown> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.data;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(config.weather.lat));
  url.searchParams.set('longitude', String(config.weather.lon));
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo request failed: ${resp.status}`);
  const raw = await resp.json();

  const data = {
    location: config.weather.locationName,
    current: {
      temperature: raw.current?.temperature_2m,
      humidity: raw.current?.relative_humidity_2m,
      windSpeed: raw.current?.wind_speed_10m,
      code: raw.current?.weather_code,
      description: describeWeatherCode(raw.current?.weather_code),
    },
    daily: (raw.daily?.time ?? []).map((date: string, i: number) => ({
      date,
      code: raw.daily.weather_code[i],
      description: describeWeatherCode(raw.daily.weather_code[i]),
      high: raw.daily.temperature_2m_max[i],
      low: raw.daily.temperature_2m_min[i],
      precipChance: raw.daily.precipitation_probability_max?.[i] ?? null,
    })),
  };

  cache = { fetchedAt: Date.now(), data };
  return data;
}

/** Geocode a place name to lat/lon using Open-Meteo's free geocoding API (for the Settings page). */
export async function geocode(query: string): Promise<Array<{ name: string; lat: number; lon: number; admin1?: string; country?: string }>> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '5');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Geocoding request failed: ${resp.status}`);
  const raw = await resp.json();
  return (raw.results ?? []).map((r: any) => ({
    name: r.name, lat: r.latitude, lon: r.longitude, admin1: r.admin1, country: r.country,
  }));
}
