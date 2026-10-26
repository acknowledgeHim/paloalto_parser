import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';

// 🔑 Passwords — the app only points at Vaultwarden (scripts/setup-vaultwarden.sh); it never sees
// or stores anyone's passwords. Each person's vault is locked with their own master password.
export const passwordsRouter = Router();

/**
 * GET /info — where the vault is (VAULTWARDEN_URL, or null to use https://<this host>:8443), and
 * whether Vaultwarden answers on the Pi (127.0.0.1:8222), so the page can say "not set up yet"
 * instead of opening a tab that can't load.
 */
passwordsRouter.get(
  '/info',
  asyncHandler(async (_req, res) => {
    let running = false;
    try {
      running = (await fetch('http://127.0.0.1:8222/alive', { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
      running = false;
    }
    res.json({ url: process.env.VAULTWARDEN_URL?.trim() || null, running });
  })
);
