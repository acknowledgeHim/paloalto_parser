import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';

export const settingsRouter = Router();

const KEYS = ['idle_timeout_seconds', 'slideshow_interval_seconds'] as const;

settingsRouter.get('/', (_req, res) => {
  const result: Record<string, string> = {};
  for (const key of KEYS) result[key] = getSetting(key);
  res.json(result);
});

settingsRouter.patch('/', (req, res) => {
  for (const key of KEYS) {
    if (req.body[key] !== undefined) setSetting(key, String(req.body[key]));
  }
  const result: Record<string, string> = {};
  for (const key of KEYS) result[key] = getSetting(key);
  res.json(result);
});
