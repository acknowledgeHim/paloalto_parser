import { Router } from 'express';
import { getWeather, geocode } from '../services/weather.js';

export const weatherRouter = Router();

weatherRouter.get('/', async (_req, res) => {
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
