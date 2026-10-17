# Verdict

**Know if a skincare product works before the return window closes.**
Verdict reads what a product promises, tracks only those concerns with
**YouCam AI Skin Analysis** in comparable daily photos, and delivers a
keep / return verdict a few days before the return deadline.

Built for the *YouCam API Skin AI & eCommerce VTO Hackathon* (2026).

## Status

Skeleton. Runs fully in **mock mode** (no API key, no network, no units):
the mock replays the response shapes documented by Perfect Corp.

- `src/lib/youcam/`: typed API client (File API + PUT upload, Skin Analysis
  v2.0/v2.1, Skin Simulation, Look VTO, unit balance), polling, 429 backoff,
  local unit ledger (reserve, confirm on `success`, refund on `error`).
- `src/lib/tracking/`: product claim reading (max 4 concerns = 9-unit SD tier),
  capture quality gate, trend on `raw_score`, verdict before the deadline.
- `src/lib/budget/plan.ts`: plan for the 1,000 free units + per-visitor quota.
- `src/app/`: mobile-first shell (Today, product timeline, guided photo, merchant).
- `src/app/api/youcam/skin-analysis`: server route; the key never leaves the server.

## Run

```sh
npm install
npm test          # vitest: client, costs, claims, quality, trend, verdict, budget
npm run dev       # http://localhost:3000
npm run build
```

Live mode (later, locally only): copy `.env.example` to `.env.local`, set
`YOUCAM_MODE=live` and `YOUCAM_API_KEY`. Never commit keys.

## Notes

- Scores: `ui_score` is calibrated upward by the provider; trends use `raw_score`.
- Cosmetic guidance only, not medical advice. Photos require explicit consent.
- `docs/screenshots/`: mock-mode screens (sample data).

## License

MIT
