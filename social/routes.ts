// HTTP side of the social system: creating an account. Everything else goes through /ws/social.

import type { Express } from 'express';
import { SocialService, SocialError, toProfile } from './service';

export function registerSocialRoutes(app: Express, svc: SocialService) {
  // Per-IP limits: anonymous accounts are free to create, so keep one person from minting thousands.
  const hits = new Map<string, number[]>();
  const allow = (key: string, max: number, windowMs: number) => {
    const now = Date.now();
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      hits.set(key, list);
      return false;
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };

  app.post('/api/account', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!allow(`reg:${req.ip}`, 10, 60 * 60_000)) return res.status(429).json({ error: 'RATE_LIMIT' });
    try {
      const { name, username, avatar } = req.body ?? {};
      const { user, token } = svc.register(name, username, avatar);
      return res.json({ user: toProfile(user), token });
    } catch (err) {
      if (err instanceof SocialError) return res.status(err.code === 'USERNAME_TAKEN' ? 409 : 400).json({ error: err.code });
      console.error('[social] register failed:', err);
      return res.status(500).json({ error: 'SERVER_ERROR' });
    }
  });

  app.get('/api/account/username-available', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!allow(`avail:${req.ip}`, 40, 60_000)) return res.status(429).json({ error: 'RATE_LIMIT' });
    return res.json({ available: svc.usernameAvailable(req.query.u) });
  });
}
