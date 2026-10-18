# Verdict

**Know if a skincare product works before the return window closes.**
Verdict reads what a product promises, measures only those concerns with **YouCam AI Skin Analysis** in comparable
photos, and tells you **keep it, return it, or stop using it**, two days before the return deadline.

Built for the *YouCam API Skin AI & eCommerce VTO Hackathon* (2026). Mobile-first web app (Next.js).

<p>
  <img src="docs/screenshots/03-verdict-keep-phone.png" width="240" alt="Keep it, 14 days before the deadline" />
  <img src="docs/screenshots/02-replay-midway-phone.png" width="240" alt="Replaying the return window day by day" />
  <img src="docs/screenshots/09-capture-result-trace-phone.png" width="240" alt="Guided photo with the YouCam API calls" />
</p>

## Try it in 10 seconds

1. Open the app: the first card is a serum whose verdict landed **17 days before the deadline**.
2. Tap **Replay the 30-day return window**: every day is recomputed from the photos available that day, and you
   watch "Measuring" turn into "Keep it".
3. Open the shelf: one product per outcome (keep, return, stop, still measuring).
4. **Take a photo** → consent → camera (or *Use a sample*) → on-device quality gate → analysis, with every YouCam API
   call listed.
5. **Add** a product: paste its claim; Verdict picks the concerns and prices the whole window in units before the
   first photo.

> **Synthetic data until the API key is wired.** By default the server runs in mock mode: products and scores are
> generated, shaped exactly like the documented Skin Analysis responses, and labelled "Synthetic data" on every
> screen. In mock mode your photo never leaves the device: only its size is sent to simulate the upload.

## What it does

- **Reads the promise.** "Calming serum that reduces redness and refines pores in 14 days" → *redness, pores*,
  14 days. Tracking 1 to 4 concerns keeps every photo in the cheapest SD tier (9 units).
- **Makes photos comparable.** An on-device gate (light, face size, resolution, lighting drift vs day 0) runs before
  any unit is spent. Photos that differ are set aside, not averaged in.
- **Decides on a trend, not a photo.** Least-squares slope on `raw_score` with a noise floor; `ui_score` is shown but
  never trended, because the provider calibrates it upward on purpose.
- **Decides in time.** Daily photos in the final 4 days, verdict 2 days before the deadline. Irritation-type concerns
  getting worse trigger **Stop** at once. A promise longer than the return window (retinol: 12 weeks vs 30 days) is
  flagged.
- **Proof for the store.** A printable report of every photo, its quality and its scores.
- **Merchant view.** Measured efficacy per SKU, return rate, and claims that over-promise.

## YouCam APIs

| API | Use in Verdict | Cost |
| --- | --- | --- |
| **AI Skin Analysis** (`/s2s/v2.0/task/skin-analysis`, `format: json`) | Scores for the 1 to 4 promised concerns | 9 units (SD, 1–4 concerns) |
| File API (`POST /s2s/v2.0/file` + PUT to the pre-signed URL) | Upload, then poll the task until `success` | free |
| **Skin Simulation** (`/s2s/v2.0/task/skin-simulation`) | "The promised result" from the day-0 photo | 4 units |
| **Look VTO** (`/s2s/v2.0/task/look-vto`) | An alternative to try when the verdict is return | 2 units |
| Credit (`GET /s2s/v1.0/client/credit`) | Unit balance guard | free |

Skin Simulation and Look VTO are wired in the client and shown as planned calls; they run only with the live key.

## Architecture

- `src/lib/youcam/`: typed client (File API + PUT, Skin Analysis v2.0/v2.1, Skin Simulation, Look VTO, balance),
  polling, 429 back-off, local unit ledger (reserve, confirm on `success`, refund on `error`), **tracing transport**
  that records every step for the UI without leaking the pre-signed URL, mock transport replaying the documented
  shapes and errors.
- `src/lib/tracking/`: claim reading, tracking plan and unit cost, capture quality gate, trend, verdict.
- `src/lib/demo/`: the synthetic shelf (four outcomes) and the day-by-day replay; visitor products in localStorage.
- `src/app/api/youcam/analyze`: the full pipeline for one photo. The API key never leaves the server; public live
  analyses are off unless `YOUCAM_PUBLIC_LIVE=1`.

## Run

```sh
npm install
npm test          # vitest: 46 tests (client, tracing, costs, claims, plan, quality, trend, verdict, demo shelf, budget)
npm run dev       # http://localhost:3000
npm run build
```

Live mode (local only): copy `.env.example` to `.env.local`, set `YOUCAM_MODE=live` and `YOUCAM_API_KEY`.
Never commit keys.

## Notes

- Cosmetic guidance only, not medical advice. Photos need explicit consent and can be deleted.
- Noise thresholds (`noiseSigma`, `minEffect` in `src/lib/tracking/trend.ts`) are provisional until the 5-photo
  calibration with the live API.
- `docs/screenshots/`: mock-mode screens (synthetic data), phone and desktop.

## License

MIT
