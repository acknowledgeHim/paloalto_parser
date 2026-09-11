import { useEffect, useState } from 'react';
import { api, type WeatherData } from '../api/client.js';

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get<WeatherData>('/weather')
        .then((d) => !cancelled && setWeather(d))
        .catch(() => !cancelled && setError(true));
    };
    load();
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) return <div className="weather-widget weather-widget--error">Weather unavailable</div>;
  if (!weather) return <div className="weather-widget">Loading weather…</div>;

  return (
    <div className="weather-widget">
      <div className="weather-widget__current">
        <div className="weather-widget__temp">{Math.round(weather.current.temperature)}°</div>
        <div>
          <div className="weather-widget__desc">{weather.current.description}</div>
          <div className="weather-widget__location">{weather.location}</div>
        </div>
      </div>
      <div className="weather-widget__forecast">
        {weather.daily.slice(0, 5).map((d) => (
          <div key={d.date} className="weather-widget__day">
            <div>{new Date(`${d.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <div className="weather-widget__day-temps">
              <strong>{Math.round(d.high)}°</strong> / {Math.round(d.low)}°
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
