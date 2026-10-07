# نظام الأصدقاء / Friends system

| Piece | File | Lives |
|---|---|---|
| Accounts, friendships, requests, recent players | `store.ts` + `service.ts` | **permanent** — `DATA_DIR/social.json` |
| Presence + invitations (always-on socket `/ws/social`) | `hub.ts` | memory (rooms are memory too) |
| Account creation (`POST /api/account`) | `routes.ts` | — |
| Browser client | `src/services/social.ts` | account id + secret token in `localStorage` |

- **Identity**: anonymous. First use creates `{name, @username, avatar}`; the server keeps only a hash of the secret token.
  Clearing browser data / another device = a new account (no recovery yet).
- **Invitation → room**: an invite points at a room code but never reveals it. On "accept" the server re-checks the room is
  still in its lobby with a free seat, then hands the code over and the player joins exactly like with a typed code.
- **Hosting**: set `DATA_DIR` to a persistent disk. On an ephemeral disk friend lists reset on every deploy
  (clients notice and just ask the player to re-create the profile).
- **Not built yet**: push notifications when the app is closed (needs Web Push: service worker + VAPID keys),
  block/report, account recovery.

Tests: `npm run test:social` (logic + real server/rooms/restart) · `python3 tests/ui-friends.e2e.py` (two real browsers).
