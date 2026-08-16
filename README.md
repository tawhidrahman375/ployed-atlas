# ATLAS — Ployed Growth OS

Private, single-operator growth automation for [ployed.net](https://ployed.net). No auth, no multi-tenant concerns — built for one person (Tawhid) to run.

This repo replaces the "OpenClaw" runtime referenced in the original spec with a plain Node/TypeScript runner: two scheduled scripts (`npm run morning`, `npm run evening`) plus a small always-on server for the Stripe webhook (`npm start`).

## What's real vs stubbed right now

As of 2026-08-08, every agent is real, tested code — not just plumbing. Confirmed working end-to-end with live credentials (not just typechecked): Nova (real YouTube transcripts → Claude extraction), Vega (real competitor page diffing + Reddit RSS), Pulse (real GSC/PostHog/Instantly pulls), Muse (real content uploaded to Supabase Storage with public URLs), Sentinel (real Instantly bounce-rate check), Ledger (real Stripe MRR reads). Echo is real, working code too, but see the gate below.

**2026-08-08: Pixel switched from AI UGC video (Higgsfield) to TikTok slideshows.** Two alternating formats — "tools list" (real tools the ICP already trusts, Ployed revealed last) and "pain hook" (concrete pains, then Ployed as the payoff) — rendered as 6 real 1080×1920 PNGs plus a caption+hashtags file per run, via `satori` + `@resvg/resvg-js` + `sharp` (Inter font, white text, matching a reference folder of real TikTok slideshow screenshots). Backgrounds are real Pexels stock photography for every slide, never AI-generated. **Verified live end-to-end** with a real `PEXELS_API_KEY` (real Claude copy, real Pexels photos, real Supabase upload + `slideshows` row, test data cleaned up after).

**Apollo** finds leads via the Brave Search API — 8 targeted `site:linkedin.com/in` / `site:x.com` searches across the ICP (AI automation agencies, GHL agencies, web design agencies, SMMA operators), with Claude extracting real individual profiles from the results and deduping against everything already in `lead_queue`. Google Custom Search was the original plan, but the Google Cloud org this account sits under blocks plain API key creation via a default security policy that couldn't be safely overridden — Brave was the pragmatic swap (note: Brave dropped its free tier in early 2026; it's a card-on-file, $5/month-credit plan now, though Apollo's ~240 queries/month stays well inside that). **Confirmed working live**: one real run found 56 genuine, well-qualified candidates (real founders/owners, specific per-lead signals, zero duplicates, zero garbage).

LinkedIn/X search snippets don't expose email addresses on their own, so Apollo enriches a small batch per run (`MAX_ENRICHMENTS_PER_RUN = 5`) via an email-finder API, using a `linkedin_url` lookup — no company domain needed, which Apollo doesn't reliably have. Leads that don't get enriched still queue for manual outreach (X DM / LinkedIn comment, per the original spec) — drafting those manual-channel messages isn't built yet.

**2026-08-08: switched from Hunter.io to Anymail Finder** (`src/lib/anymailFinder.ts`), after Hunter's account ran low (49 credits left) with no ongoing free tier to fall back on. Anymail Finder has a purpose-built `POST /v5.1/find-email/linkedin-url` endpoint — same input shape as the old Hunter integration, so the swap was a straight drop-in — and only charges a credit on a genuine `email_status: "valid"` result; `not_found`/`risky` results are free, same no-waste billing Hunter had. Cheaper at any real volume than Hunter's paid tier ($34/mo) if the free/trial credits run out: plans start around $33/mo for 400 credits vs. Hunter's need to jump straight to that $34/mo tier for anything past 25/month. Ruled out for the same slot: Snov.io's LinkedIn endpoint (`li-profiles-by-urls`) returns profile data, not an email — getting an email out of Snov.io needs a company domain, which is exactly what Apollo doesn't have; Apollo.io's API is still locked behind their $119/user/month Organization plan (3-user minimum) even on a paid Basic/Professional plan, confirmed unchanged from the original evaluation; and scraping business sites directly was ruled out because Apollo never captures a company domain in the first place (LinkedIn/X snippets rarely include one) and would mostly surface generic `hello@`/`info@` inboxes rather than the founder's own address. **Not yet verified live** — needs `ANYMAIL_FINDER_API_KEY` set (locally and on the VPS) before the next run will actually enrich anything; until then Apollo still finds leads, it just queues them unenriched.

**Historical note on Hunter.io coverage** (superseded above, kept for the underlying data point): in live testing while Hunter was still wired up, 0 of 10 real Apollo-sourced leads (small, newer agency founders — the actual ICP) had a match in Hunter's database; the only hit was a deliberately well-known test case (Reid Hoffman → `rhoffman@greylock.com`), used purely to confirm the code path worked. This is a data-coverage problem with this ICP's public footprint in general, not specific to Hunter — expect a similarly low hit-rate from Anymail Finder, which is exactly why its pay-only-on-a-real-find billing matters here.

Every agent is now real, tested code — nothing in the repo uses `notWired(` anymore. Anything that later loses a credential still fails loudly with a clear error naming the missing env var, rather than silently doing nothing.

**Echo is deliberately gated.** `pushToInstantly()` is fully implemented (adds a lead to a real Instantly campaign via their API), but it requires `INSTANTLY_CAMPAIGN_ID`, which is *not* set anywhere by default. Nothing will send a real email until you've created an actual campaign in Instantly and chosen to set that variable yourself — that's an intentional extra step, not an oversight.

| Agent | Status | Notes |
|---|---|---|
| Nova | ✅ real | YouTube transcript fetch via the `youtube-transcript` package (no auth needed), tested against all 6 monitored channels |
| Vega | ✅ real | Competitor page fetch + text diff against last snapshot; Reddit RSS |
| Pulse | ✅ real | GSC (service account JWT), PostHog (HogQL query API), Instantly campaign analytics |
| Muse | ✅ real | Content uploaded to the public `atlas-content` Supabase Storage bucket, not local disk |
| Pixel | ✅ real | Renders 6 real TikTok slideshow PNGs (satori + resvg + sharp, real Pexels photos, no AI-generated imagery) + a caption file per run; verified live |
| Sentinel | ✅ real | Instantly campaign analytics, 7-day bounce-rate window, **and actually enforced**: Echo checks for an unresolved red flag tagged `agent: 'Echo'` before sending anything, verified live to correctly block |
| Ledger | ✅ real | Reads live MRR from Stripe (`sk_live_...` key); webhook *listener* still isn't deployed anywhere (see step 3) |
| Echo | ✅ real, gated | Needs `INSTANTLY_CAMPAIGN_ID` set on purpose before it can send anything live |
| Apollo | ✅ real | Brave Search API; verified live with a real run (56 qualified candidates, 0 duplicates) |
| Apollo (email enrichment) | 🟡 wired, unverified | Anymail Finder `linkedin-url` lookup, capped at 5/run; code is real but not yet run with a live `ANYMAIL_FINDER_API_KEY` |

## Roadmap & planning context

The original plan (tracked in Notion, "Ployed Marketing Agent — Master Plan") called for 19 agents; 12 of the 19 now exist (the 11 in the table above, plus Sage below). These were never started:

| Agent | Role | Priority |
|---|---|---|
| Forge | Runs growth experiments, tests hypotheses — `src/agents/forge.ts` exists with the table plumbing, but nothing calls `proposeExperiment()` yet | 🥇 highest — biggest missing piece pre-PMF |
| Keeper | Customer success — monitors usage, finds churn risk, collects testimonials | 🥈 next, once customers exist |
| Mercury | Partnerships — Skool owners, newsletters, affiliates | 🥉 |
| Scribe | Turns discoveries into SOPs/playbooks | Lower |
| Oracle | Forecasts MRR/churn — needs real data volume first | Lowest, data-gated |
| Ares | Sales — handles objections and conversion | Not scheduled |
| Beacon | Telegram notifications | Dropped from scope entirely — home all day, dashboard covers it |

**Sage — ✅ built** (`src/agents/sage.ts`, wired into `atlas.ts`'s Round 3 alongside Muse). A separate agent from Muse, not a config flag: picks fresh doc topics (deduped against `docs_pages`, distinct from Muse's `seo_pages` dedup), writes direct-answer/AI-citation-formatted pages (open with a self-contained answer, then `##` sections), and publishes live to `ployed.net/docs/<slug>` via `publishDocsPage()` in `seoPublish.ts`. Produces 2 pages/run, same cadence as Muse's SEO pages. Requires a schema migration before it can run for real — `docs_pages` is defined in `supabase/schema.sql` but not yet applied to the live Supabase project (same caveat applied to every other table here: run the schema file against the project before relying on it). The main Ployed app repo has matching `/docs` and `/docs/:slug` routes (`src/pages/Docs.tsx`, `src/pages/DocPage.tsx`, `src/lib/docsPages.ts`) reading the same table.

**Goal stages** — read live from Stripe MRR (`getStage()` in `src/agents/atlas.ts`), logged into every morning/evening report. Nothing currently changes agent behavior by stage yet — it's informational only, surfaced in the daily report:

| Stage | MRR threshold | Focus |
|---|---|---|
| 1 | £0 | Max outreach volume, learn every objection |
| 2 | > £0 | Double down on what closed, gather testimonials |
| 3 | ≥ £1,000 | Scale winning channels, SEO compounding begins |
| 4 | ≥ £5,000 | Paid experiments, partnerships |
| 5 | ≥ £10,000 | Retention focus, kill losers, efficiency mode |

**Model switching** — `src/lib/claude.ts` exports `MODELS.bulk` (`claude-haiku-4-5-20251001`) and `MODELS.quality` (`claude-sonnet-5`), overridable via `MODEL_BULK`/`MODEL_QUALITY` env vars. Convention (not enforced by any linter): Haiku for high-volume/low-stakes work (transcript processing, scraping, logging), Sonnet for anything a human will actually read (cold email copy, SEO pages, social posts, the daily report).

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
10. ✅ **Pixel** — produces two alternating TikTok slideshow formats (tools list / pain hook), 6 real 1080×1920 PNGs + a caption file per run, rendered locally via `satori` + `@resvg/resvg-js` + `sharp` (no AI-generated imagery — every background is a real Pexels stock photo). Generation is synchronous within the morning run now, so there's nothing for the evening block to poll. **Verified with a real end-to-end run** (real Claude copy, real Pexels photos, real Supabase upload + `slideshows` row, test data cleaned up after).
11. ✅ **Forge / Sentinel** — Forge's table plumbing works (nothing calling `proposeExperiment()` yet — that's a "when you want to run an experiment" trigger, not a startup task). Sentinel's bounce-rate check is real, reading 7 days of Instantly campaign analytics — and now actually enforced: Echo refuses to send if an unresolved red flag tagged `agent: 'Echo'` exists, verified live (planted a real flag, confirmed Echo sent 0, removed it). There's no UI yet to mark a flag resolved once the underlying issue is fixed — do it directly in Supabase (`risk_flags.resolved = true`).
12. ✅ **Deploy dashboard** — live at `https://dashboard-seven-lemon-91.vercel.app` (Vercel project `kicksnap/dashboard`), confirmed rendering real Supabase data.
13. ✅ **GitHub Actions** — repo is public, and `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GSC_CREDENTIALS_JSON`, `POSTHOG_API_KEY`, `PRODUCTHUNT_API_TOKEN` are all set as repo secrets. `morning-run.yml` runs for real at 09:00 UTC — every step now does real work except the Product Hunt check (still `notWired`, low priority).
14. ✅ **VPS deployment** — live on Ubuntu 26.04 at `94.237.57.75` (root, key-based SSH only). Node 22 + repo cloned + `.env` copied over. Ledger's webhook listener runs as a systemd service (`ployed-atlas.service`, auto-restarts, survives reboot). `crontab` runs `npm run morning` at 08:00 and `npm run evening` at 20:00 daily. UFW firewall enabled (was off entirely before) — only SSH (22) and the webhook port (8787) open. Verified with a real `npm run morning` run on the VPS itself (exit 0, ~9 min on this 1 CPU/1GB box) — dedup correctly found only 1 new lead against the 56 already in `lead_queue` from earlier local testing. Since switching Pixel to slideshows (see the note at the top), the VPS still needs `PEXELS_API_KEY` set before a real `npm run morning` there will produce a slideshow.

Legend: ✅ done · 🟡 partially done · 🔲 not started · 🔒 gated on purpose.

## Environment variables

Copy `.env.example` to `.env` (runner) and `dashboard/.env.example` to `dashboard/.env.local` (dashboard), then fill in as you go through the build order above. Full list, grouped by system:

**Runner (VPS) — `.env`:**
`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BRAVE_SEARCH_API_KEY`, `ANYMAIL_FINDER_API_KEY`, `INSTANTLY_API_KEY`, `INSTANTLY_CAMPAIGN_ID` (leave unset until you're ready for Echo to send real emails), `PEXELS_API_KEY`, `COMPOSIO_API_KEY`, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, `GSC_SITE_URL`, `GSC_CREDENTIALS_JSON`, `PRODUCTHUNT_API_TOKEN`

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

**Status: live.** As of 2026-08-08, the campaign has been launched (Instantly status: Active, not Draft) — every code-level gate is open:

- `INSTANTLY_CAMPAIGN_ID` is set (`cfac9833-addf-4a2d-a994-d1293c7ea67f`, "My Campaign"), both locally and on the VPS, verified with a real API call.
- Echo checks for an unresolved red risk flag (Sentinel's bounce-rate alarm) before sending anything, and refuses if one exists — verified live, this is a real enforced brake, not just a dashboard warning.
- As of 2026-08-14, 42 leads have a verified email, are enrolled in the Instantly campaign, and are marked `emailed` in `lead_queue`. Every future run keeps enrolling any newly-enriched lead the same way — no per-email confirmation from anyone.

**2026-08-14 — diagnosed why 0 emails have actually gone out yet: not a bug.** The sending domain's warmup only started 2026-08-09, and Instantly requires 2–3 weeks minimum warmup before it delivers campaign sends — so `emails_sent_today` reading 0 on the dashboard is expected right now, not a failure of Echo, the lead pipeline, or the Instantly integration. The 42 already-enrolled leads will start sending automatically once warmup clears, no manual re-enrollment needed. Expected resume window: **2026-08-23 to 2026-08-28**. Also recorded in Atlas's own memory (`agent_memory`, category `outreach_failures`, via Mnemos) so agents don't re-diagnose this as a problem before that window passes.

**What actually happens next**: the VPS cron runs `npm run morning` at 08:00 UTC daily. Each run, Apollo finds a handful of new leads and Anymail Finder attempts to enrich up to 5. Any newly-enriched lead gets cold email copy from Echo and is pushed into the Instantly campaign the same day — but actual delivery waits on the domain warmup above. Keep an eye on the dashboard's "Today's numbers" (emails sent) and the risk flags section for when real sends resume.
