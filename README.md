# ATLAS — Ployed Growth OS

Private, single-operator growth automation for [ployed.net](https://ployed.net). No auth, no multi-tenant concerns — built for one person (Tawhid) to run.

This repo replaces the "OpenClaw" runtime referenced in the original spec with a plain Node/TypeScript runner: two scheduled scripts (`npm run morning`, `npm run evening`) plus a small always-on server for the Stripe webhook (`npm start`).

## What's real vs stubbed right now

Everything below is wired end-to-end: Supabase reads/writes, Claude calls (model-switched per agent), the orchestration sequence, the Reddit RSS pull, the YouTube RSS "latest video" queue, and the dashboard.

Anything that needs a paid API you haven't connected yet **fails loudly** with a clear error naming the missing env var, instead of silently doing nothing. Search the repo for `notWired(` to see every stub:

| Agent | Stubbed until you add | Env var |
|---|---|---|
| Echo | Instantly push | `INSTANTLY_API_KEY` |
| Pixel | Higgsfield generation | `HIGGSFIELD_API_KEY` |
| Pulse | GSC pull | `GSC_CREDENTIALS_JSON` |
| Pulse | PostHog pull | `POSTHOG_API_KEY` |
| Pulse / Sentinel | Instantly stats/bounce rate | `INSTANTLY_API_KEY` |
| Apollo | Lead search (LinkedIn/X) | none yet — needs a search source picked |
| Vega | Competitor page scrape | none yet — needs scrape/diff logic |
| Muse | Downloadable content | files save locally; need Supabase Storage upload for the dashboard's download links to work remotely |
| Ledger | Stripe MRR | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| — | Product Hunt check | `PRODUCTHUNT_API_TOKEN` |

Fill these in one at a time, in the build order below — don't rush to fill every key immediately.

## Build order

1. **Supabase** — run `supabase/schema.sql` against your existing Ployed project.
2. **Core env** — set `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Run `npm install && npm run typecheck` to confirm it's wired.
3. **Ledger + Stripe** — add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, deploy `npm start` somewhere reachable, point a Stripe webhook at `https://<host>/webhooks/stripe`.
4. **Pulse** — add `GSC_CREDENTIALS_JSON`, `POSTHOG_API_KEY`, implement the two `notWired` calls in `src/agents/pulse.ts`.
5. **Apollo** — implement `findCandidates()` in `src/agents/apollo.ts` against whatever lead-search source you pick.
6. **Echo** — add `INSTANTLY_API_KEY`, implement `pushToInstantly()` in `src/agents/echo.ts`.
7. **Nova** — implement `fetchTranscript()` in `src/agents/nova.ts` (e.g. the `youtube-transcript` npm package). Fill in real channel IDs in `scripts/queue-youtube.ts`.
8. **Vega** — implement `scrapeCompetitor()` in `src/agents/vega.ts`. Reddit RSS already works with no key.
9. **Muse** — works today; wire Supabase Storage upload in `saveContent()` so the dashboard's download links work from your phone, not just the VPS filesystem.
10. **Pixel** — add `HIGGSFIELD_API_KEY`/`COMPOSIO_API_KEY`, implement `fireHiggsfield()`.
11. **Forge / Sentinel** — Forge's table plumbing works; call `proposeExperiment()` from wherever you want to start a test. Sentinel's bounce-rate check needs Instantly wired (step 6).
12. **Deploy dashboard** — see below.
13. **GitHub Actions** — see below.

## Environment variables

Copy `.env.example` to `.env` (runner) and `dashboard/.env.example` to `dashboard/.env.local` (dashboard), then fill in as you go through the build order above. Full list, grouped by system:

**Runner (VPS) — `.env`:**
`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INSTANTLY_API_KEY`, `HIGGSFIELD_API_KEY`, `COMPOSIO_API_KEY`, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, `GSC_SITE_URL`, `GSC_CREDENTIALS_JSON`, `PRODUCTHUNT_API_TOKEN`

**GitHub Actions — repo secrets** (Settings → Secrets and variables → Actions):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GSC_CREDENTIALS_JSON`, `POSTHOG_API_KEY`, `PRODUCTHUNT_API_TOKEN`

**Dashboard (Vercel) — project env vars:**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Note: RLS is enabled on all 8 tables with a read-only policy for the `anon` role (see the bottom of `supabase/schema.sql`). The anon key is embedded client-side in the dashboard, so it's effectively public — read-only keeps that safe. Agents write via `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS, so this doesn't affect the runner.

## Running on the VPS

```bash
git clone <this-repo-url> && cd ployed-atlas
npm install
cp .env.example .env   # fill in keys as you complete the build order
npm run typecheck      # sanity check

# Always-on: Stripe webhook listener
npm start &            # or run under pm2/systemd so it survives reboots

# Scheduled: add to crontab (crontab -e)
# 0 8 * * * cd /path/to/ployed-atlas && npm run morning >> logs/morning.log 2>&1
# 0 20 * * * cd /path/to/ployed-atlas && npm run evening >> logs/evening.log 2>&1
```

## GitHub Actions setup

1. Push this repo to a **public** GitHub repo (required for unlimited free Actions minutes).
2. Add the repo secrets listed above.
3. The workflow at `.github/workflows/morning-run.yml` runs daily at 09:00 UTC, or trigger it manually from the Actions tab (`workflow_dispatch`).
4. Steps for unwired sources (`GSC`, `PostHog`, competitor scrape, Product Hunt) use `continue-on-error: true` so the run stays green while you fill those in — the YouTube queue and Reddit steps run for real already.

## Deploying the dashboard

```bash
cd dashboard
vercel link      # or connect the repo in the Vercel dashboard, root directory = dashboard/
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel deploy --prod
```

The page is a server component that revalidates every 5 minutes (`export const revalidate = 300`). No login — the private URL is the security boundary, so don't link to it publicly.

## A note on autonomy

Once Echo and Instantly are wired, `npm run morning` will send real cold emails to real people with no per-email confirmation. Test with a very small, known-safe lead list before trusting the full pipeline, and keep Sentinel's bounce-rate check wired before scaling volume.
