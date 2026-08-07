# ATLAS — Ployed Growth OS

Private, single-operator growth automation for [ployed.net](https://ployed.net). No auth, no multi-tenant concerns — built for one person (Tawhid) to run.

This repo replaces the "OpenClaw" runtime referenced in the original spec with a plain Node/TypeScript runner: two scheduled scripts (`npm run morning`, `npm run evening`) plus a small always-on server for the Stripe webhook (`npm start`).

## What's real vs stubbed right now

As of 2026-08-08, every agent is real, tested code — not just plumbing. Confirmed working end-to-end with live credentials (not just typechecked): Nova (real YouTube transcripts → Claude extraction), Vega (real competitor page diffing + Reddit RSS), Pulse (real GSC/PostHog/Instantly pulls), Muse (real content uploaded to Supabase Storage with public URLs), Pixel (real Higgsfield video jobs via the CLI, fired and polled to completion), Sentinel (real Instantly bounce-rate check), Ledger (real Stripe MRR reads). Echo is real, working code too, but see the gate below.

**Apollo** finds leads via the Brave Search API — 8 targeted `site:linkedin.com/in` / `site:x.com` searches across the ICP (AI automation agencies, GHL agencies, web design agencies, SMMA operators), with Claude extracting real individual profiles from the results and deduping against everything already in `lead_queue`. Google Custom Search was the original plan, but the Google Cloud org this account sits under blocks plain API key creation via a default security policy that couldn't be safely overridden — Brave was the pragmatic swap (note: Brave dropped its free tier in early 2026; it's a card-on-file, $5/month-credit plan now, though Apollo's ~240 queries/month stays well inside that). **Confirmed working live**: one real run found 56 genuine, well-qualified candidates (real founders/owners, specific per-lead signals, zero duplicates, zero garbage).

LinkedIn/X search snippets don't expose email addresses on their own, so Apollo now enriches a small batch per run (`MAX_ENRICHMENTS_PER_RUN = 5`) via Hunter.io's Email Finder, using its `linkedin_handle` lookup — no company domain needed, which Apollo doesn't reliably have. Free tier is 25 lookups/month total; capping at 5/run spreads that across many days instead of one run burning the month. **Confirmed working live**: `reidhoffman` → `rhoffman@greylock.com`, a real, correctly-patterned match. Most smaller/newer founders (the actual ICP) aren't in Hunter's database yet and correctly come back as "not found" rather than erroring — one real bug caught here: Hunter returns a `404` for handles it doesn't have on record (not a `200` with `data.email: null` like the docs implied), which the code originally treated as a thrown error instead of a normal miss; fixed. Leads that don't get enriched still queue for manual outreach (X DM / LinkedIn comment, per the original spec) — drafting those manual-channel messages isn't built yet.

One account-setup note if you ever regenerate this key: Hunter briefly returned `429 restricted_account` until phone verification was completed on the Hunter dashboard — nothing to do with the code, just their signup flow.

Every agent is now real, tested code — nothing in the repo uses `notWired(` anymore. Anything that later loses a credential still fails loudly with a clear error naming the missing env var, rather than silently doing nothing.

**Echo is deliberately gated.** `pushToInstantly()` is fully implemented (adds a lead to a real Instantly campaign via their API), but it requires `INSTANTLY_CAMPAIGN_ID`, which is *not* set anywhere by default. Nothing will send a real email until you've created an actual campaign in Instantly and chosen to set that variable yourself — that's an intentional extra step, not an oversight.

| Agent | Status | Notes |
|---|---|---|
| Nova | ✅ real | YouTube transcript fetch via the `youtube-transcript` package (no auth needed), tested against all 6 monitored channels |
| Vega | ✅ real | Competitor page fetch + text diff against last snapshot; Reddit RSS |
| Pulse | ✅ real | GSC (service account JWT), PostHog (HogQL query API), Instantly campaign analytics |
| Muse | ✅ real | Content uploaded to the public `atlas-content` Supabase Storage bucket, not local disk |
| Pixel | ✅ real | Shells out to the authenticated `higgsfield` CLI (`generate create seedance_2_0`); evening block polls pending jobs to completion |
| Sentinel | ✅ real | Instantly campaign analytics, 7-day bounce-rate window |
| Ledger | ✅ real | Reads live MRR from Stripe (`sk_live_...` key); webhook *listener* still isn't deployed anywhere (see step 3) |
| Echo | ✅ real, gated | Needs `INSTANTLY_CAMPAIGN_ID` set on purpose before it can send anything live |
| Apollo | ✅ real | Brave Search API; verified live with a real run (56 qualified candidates, 0 duplicates) |
| Apollo (email enrichment) | ✅ real | Hunter.io `linkedin_handle` lookup, capped at 5/run; verified live with a real match |

## Build order

Status as of 2026-08-08:

1. ✅ **Supabase** — schema live, RLS locked to read-only for `anon` on all 8 tables, plus a public `atlas-content` Storage bucket for generated files.
2. ✅ **Core env** — `npm run morning` and `npm run evening` both run end-to-end for real. Two real bugs were caught and fixed while testing: `ask()` was silently returning empty strings for `claude-sonnet-5` because it only read `content[0]`, which is a `thinking` block when extended thinking is on, not the `text` block (`9a0fe16`); and on Windows, `execFile` can't spawn npm's `.cmd` shims without `shell: true`, which doesn't auto-quote multi-word arguments — Pixel's prompt was getting tokenized into dozens of stray positional args until it was quoted explicitly.
3. 🟡 **Ledger + Stripe** — reads live MRR from Stripe for real (`sk_live_...` key). The webhook listener is deployed and running (systemd, port 8787, firewall open) — but Stripe requires HTTPS for webhook URLs, and there's no domain pointed at the VPS yet, so it isn't registered with Stripe. Not blocking: MRR reads happen via a direct API poll, not the webhook.
4. ✅ **Pulse** — GSC (service account JWT via `google-auth-library`), PostHog (HogQL query API), and Instantly campaign analytics all pulling real data into `dashboard_metrics`.
5. ✅ **Apollo** — real code against the Brave Search API (see the note above on why not Google Custom Search), verified live: 56 real, qualified candidates in one run, 0 duplicates. Apollo.io (the SaaS product) was ruled out — API access needs their $119/mo Organization plan.
6. ✅🔒 **Echo** — `pushToInstantly()` fully implemented against Instantly's real leads API. Gated behind `INSTANTLY_CAMPAIGN_ID`, which is intentionally unset — see the autonomy note at the bottom.
7. ✅ **Nova** — real transcript fetch via the `youtube-transcript` package, tested against all 6 monitored channels end-to-end (queue → transcript → Claude extraction → memory).
8. ✅ **Vega** — real page fetch + text-diff against the last snapshot in `competitor_intel` memory. Reddit RSS already worked with no key.
9. ✅ **Muse** — content uploads to the public `atlas-content` Supabase Storage bucket and is publicly fetchable (verified with a real upload + fetch), not local disk. Daily reports (from Atlas) go through the same path now, so they show up in the dashboard's content list too.
10. ✅ **Pixel** — shells out to the authenticated `higgsfield` CLI (`generate create seedance_2_0`, 9:16 aspect ratio). Verified with a real video generation (job fired, polled, completed, real `.mp4` URL returned). The evening block now calls `pixel.pollPendingJobs()` to catch up any jobs still processing from the morning.
11. ✅ **Forge / Sentinel** — Forge's table plumbing works (nothing calling `proposeExperiment()` yet — that's a "when you want to run an experiment" trigger, not a startup task). Sentinel's bounce-rate check is real, reading 7 days of Instantly campaign analytics.
12. ✅ **Deploy dashboard** — live at `https://dashboard-seven-lemon-91.vercel.app` (Vercel project `kicksnap/dashboard`), confirmed rendering real Supabase data.
13. ✅ **GitHub Actions** — repo is public, and `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GSC_CREDENTIALS_JSON`, `POSTHOG_API_KEY`, `PRODUCTHUNT_API_TOKEN` are all set as repo secrets. `morning-run.yml` runs for real at 09:00 UTC — every step now does real work except the Product Hunt check (still `notWired`, low priority).
14. ✅ **VPS deployment** — live on Ubuntu 26.04 at `94.237.57.75` (root, key-based SSH only). Node 22 + repo cloned + `.env` copied over. Ledger's webhook listener runs as a systemd service (`ployed-atlas.service`, auto-restarts, survives reboot). `crontab` runs `npm run morning` at 08:00 and `npm run evening` at 20:00 daily. UFW firewall enabled (was off entirely before) — only SSH (22) and the webhook port (8787) open. The `higgsfield` CLI's local credentials were copied over too (`~/.config/higgsfield/`), so Pixel works there without redoing OAuth on a headless box. Verified with a real `npm run morning` run on the VPS itself (exit 0, ~9 min on this 1 CPU/1GB box) — dedup correctly found only 1 new lead against the 56 already in `lead_queue` from earlier local testing.

Legend: ✅ done · 🟡 partially done · 🔲 not started · 🔒 gated on purpose.

## Environment variables

Copy `.env.example` to `.env` (runner) and `dashboard/.env.example` to `dashboard/.env.local` (dashboard), then fill in as you go through the build order above. Full list, grouped by system:

**Runner (VPS) — `.env`:**
`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BRAVE_SEARCH_API_KEY`, `INSTANTLY_API_KEY`, `INSTANTLY_CAMPAIGN_ID` (leave unset until you're ready for Echo to send real emails), `COMPOSIO_API_KEY`, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, `GSC_SITE_URL`, `GSC_CREDENTIALS_JSON`, `PRODUCTHUNT_API_TOKEN`

The `higgsfield` CLI handles its own auth separately (`higgsfield auth login`, stored under `~/.config/higgsfield/`) — there's no `HIGGSFIELD_API_KEY` env var to set.

**GitHub Actions — repo secrets** (Settings → Secrets and variables → Actions):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GSC_CREDENTIALS_JSON`, `POSTHOG_API_KEY`, `PRODUCTHUNT_API_TOKEN`

**Dashboard (Vercel) — project env vars:**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Note: RLS is enabled on all 8 tables with a read-only policy for the `anon` role (see the bottom of `supabase/schema.sql`). The anon key is embedded client-side in the dashboard, so it's effectively public — read-only keeps that safe. Agents write via `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS, so this doesn't affect the runner.

## Running on the VPS

✅ **Deployed and verified**, `94.237.57.75` (Ubuntu 26.04, root, key-based SSH — password auth was never enabled). Setup:

```bash
# Node 22 via NodeSource, git/curl via apt
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs git curl

git clone https://github.com/tawhidrahman375/ployed-atlas.git ~/ployed-atlas
cd ~/ployed-atlas && npm install
# .env copied over via scp — see Environment variables above for the full list
npm run typecheck

# higgsfield CLI, reusing the already-authenticated local credentials
# rather than redoing OAuth on a headless box:
npm install -g @higgsfield/cli
# scp ~/.config/higgsfield/{config.json,credentials.json} to the same path on the VPS
```

**Always-on webhook listener** — runs as a systemd service, not a bare `npm start &`, so it survives crashes and reboots:

```ini
# /etc/systemd/system/ployed-atlas.service
[Unit]
Description=Ployed Atlas - Ledger Stripe webhook listener
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/ployed-atlas
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload && systemctl enable --now ployed-atlas.service
```

**Scheduled blocks** — via `crontab -e`:
```
0 8 * * * cd /root/ployed-atlas && /usr/bin/npm run morning >> logs/morning.log 2>&1
0 20 * * * cd /root/ployed-atlas && /usr/bin/npm run evening >> logs/evening.log 2>&1
```

**Firewall** — was completely off by default. Now UFW-enabled, only SSH (22) and the webhook port (8787) allowed:
```bash
ufw allow 22/tcp && ufw allow 8787/tcp && ufw --force enable
```

**Deploying updates** — pull and restart the service:
```bash
cd ~/ployed-atlas && git pull && npm install && systemctl restart ployed-atlas.service
```

## GitHub Actions setup

✅ **Already done:**
1. Repo is public (`github.com/tawhidrahman375/ployed-atlas`) — unlimited free Actions minutes.
2. Repo secrets are set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GSC_CREDENTIALS_JSON`, `POSTHOG_API_KEY`, `PRODUCTHUNT_API_TOKEN`.
3. The workflow at `.github/workflows/morning-run.yml` runs daily at 09:00 UTC, or trigger it manually from the Actions tab (`workflow_dispatch`).
4. Steps for still-stubbed agent code (`GSC`, `PostHog`, competitor scrape, Product Hunt) use `continue-on-error: true` so the run stays green — credentials are ready, but the run won't do anything real for those until the corresponding `notWired` calls are implemented (see build order above). The YouTube queue and Reddit steps run for real already.

## Deploying the dashboard

✅ **Already deployed**, live at `https://dashboard-seven-lemon-91.vercel.app` (Vercel project `kicksnap/dashboard`, root directory `dashboard/`, `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` set for Production).

The page is a server component that revalidates every 5 minutes (`export const revalidate = 300`). No login — the private URL is the security boundary, so don't link to it publicly.

To redeploy after changes:

```bash
cd dashboard
vercel --prod
```

## A note on autonomy

Echo's Instantly integration is real, working code today — the only thing stopping `npm run morning` from sending real cold emails is that `INSTANTLY_CAMPAIGN_ID` is unset. Apollo now finds real leads (verified: 56 in one run) and enriches up to 5/run with real emails via Hunter.io (verified live). Before removing the campaign gate:

1. Apollo is already finding real, relevant candidates and attaching real emails where Hunter has them — nothing to do here.
2. Most of the actual ICP (small, newer agency founders) won't be in Hunter's database yet, so expect most leads to still lack an email and need manual outreach — that's Hunter's data coverage, not a bug.
3. Create an actual campaign in Instantly, set `INSTANTLY_CAMPAIGN_ID` to its ID.
4. Test with a very small, known-safe lead list first — once all of the above are in place, every `npm run morning` sends real emails to real people with no per-email confirmation. This now runs on a schedule (crontab, 08:00 daily) on the live VPS, so "in place" means it fires automatically, not just when you happen to run it by hand.
5. Keep Sentinel's bounce-rate check running (it's real and wired) before scaling volume.
