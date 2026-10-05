import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Settings → Privacy: the one switch for a feature that would send family data off the network on
 * its own, plus a plain statement of what does and doesn't leave (docs/PRIVACY.md has the full list).
 */
export function PrivacySettings() {
  const [lookup, setLookup] = useState<boolean | null>(null);
  const [weatherOn, setWeatherOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<Record<string, string>>('/settings')
      .then((s) => {
        setLookup(s.contacts_distance_lookup === '1');
        setWeatherOn(s.weather_off !== '1');
      })
      .catch(() => setLookup(false));
  }, []);
  const saveWeather = async (on: boolean) => {
    setError(null);
    setWeatherOn(on);
    try {
      await api.patch('/settings', { weather_off: on ? '' : '1' });
    } catch (err) {
      setError((err as Error).message);
      setWeatherOn(!on);
    }
  };
  const save = async (on: boolean) => {
    setError(null);
    setLookup(on);
    try {
      await api.patch('/settings', { contacts_distance_lookup: on ? '1' : '' });
    } catch (err) {
      setError((err as Error).message);
      setLookup(!on);
    }
  };
  return (
    <section className="panel">
      <h2>Privacy</h2>
      <p className="hint">
        Photos, movies, documents, faces, chores, contacts, and everything else stay on this Pi. Things
        only go out for services you set up yourself (calendars, Spotify, email, calling) — see
        docs/PRIVACY.md for the full list.
      </p>
      <label className="privacy-toggle">
        <input type="checkbox" checked={Boolean(lookup)} disabled={lookup === null} onChange={(e) => save(e.target.checked)} />
        <span>
          <strong>Look up how far away contacts live</strong>
          <span className="hint">
            {' '}— sends a contact's street address to OpenStreetMap (a free map service) when it's added or
            changed. Off: no addresses ever leave; contacts just don't show a distance.
          </span>
        </span>
      </label>
      <label className="privacy-toggle">
        <input type="checkbox" checked={Boolean(weatherOn)} disabled={weatherOn === null} onChange={(e) => saveWeather(e.target.checked)} />
        <span>
          <strong>Show the weather</strong>
          <span className="hint">
            {' '}— asks Open-Meteo (a free weather service) for your area's forecast about every 10 minutes,
            with the location rounded to ~7 miles so it never gets your exact home. Off: no weather, and
            nothing is sent.
          </span>
        </span>
      </label>
      {error && <div className="settings-login__error">{error}</div>}
    </section>
  );
}
