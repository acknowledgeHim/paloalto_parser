import { Router } from 'express';
import { getWeather, geocode } from '../services/weather.js';
import { getSetting } from '../db.js';

export const weatherRouter = Router();

weatherRouter.get('/', async (_req, res) => {
  // Settings → Privacy can turn weather off entirely: then nothing is ever asked of Open-Meteo.
  if (getSetting('weather_off', '') === '1') return res.status(204).end();
  try {
    res.json(await getWeather());
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch weather' });
  }
});

weatherRouter.get('/geocode', async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q.trim()) return res.status(400).json({ error: 'q is required' });
    res.json(await geocode(q));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Geocoding failed' });
  }
});
