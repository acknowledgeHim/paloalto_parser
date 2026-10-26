import { Router } from 'express';

// 🔑 Passwords — the app only points at Vaultwarden (scripts/setup-vaultwarden.sh); it never sees
// or stores anyone's passwords. Each person's vault is locked with their own master password.
export const passwordsRouter = Router();

/** GET /info — where the vault is: VAULTWARDEN_URL, or null to use https://<this host>:8443. */
passwordsRouter.get('/info', (_req, res) => {
  res.json({ url: process.env.VAULTWARDEN_URL?.trim() || null });
});
