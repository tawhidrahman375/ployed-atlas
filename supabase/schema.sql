-- ATLAS growth OS schema
-- Run this against the existing Ployed Supabase project (new tables, no collisions expected).
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- Agent memory — Mnemos reads/writes every category here.
create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- outreach_wins, outreach_failures, icp_profiles, objections, messaging,
                            -- platform_rules, ugc_best_practices, youtube_insights, competitor_intel, experiment_results
  content jsonb not null,
  relevance_score integer not null default 5 check (relevance_score between 1 and 10),
  source text, -- which agent wrote this
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agent_memory_category on agent_memory (category);

-- Lead queue — Apollo writes, Echo reads.
create table if not exists lead_queue (
  id uuid primary key default gen_random_uuid(),
  name text,
  handle text,
  platform text,
  niche text,
  signals text,
  email text,
  status text not null default 'queued' check (status in ('queued', 'emailed', 'replied', 'converted', 'dead')),
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_queue_status on lead_queue (status);

-- Content queue — Muse/Pixel write, dashboard reads.
create table if not exists content_queue (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- linkedin, x_thread, seo_page, comparison_page, reddit_response, youtube_script
  title text,
  file_path text,
  status text not null default 'ready' check (status in ('ready', 'posted')),
  created_at timestamptz not null default now()
);
create index if not exists idx_content_queue_status on content_queue (status);

-- Agent logs — every agent writes one entry per session. Dashboard status dots read this.
create table if not exists agent_logs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  session_type text, -- morning, evening, github_actions
  summary text,
  actions_taken jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_logs_agent_created on agent_logs (agent, created_at desc);

-- Dashboard metrics — Pulse writes, dashboard reads.
create table if not exists dashboard_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_name text not null unique,
  metric_value text,
  updated_at timestamptz not null default now()
);

-- Risk flags — Sentinel writes, dashboard reads.
create table if not exists risk_flags (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('green', 'yellow', 'red')),
  agent text,
  message text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_risk_flags_resolved on risk_flags (resolved);

-- Experiment tracker — Forge reads/writes.
create table if not exists experiments (
  id uuid primary key default gen_random_uuid(),
  hypothesis text,
  test_design text,
  success_metric text,
  status text not null default 'running' check (status in ('running', 'complete')),
  result text,
  conclusion text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Higgsfield jobs — historical only, Pixel no longer writes here (see
-- `slideshows` below). Left in place rather than dropped so past runs
-- aren't lost.
create table if not exists higgsfield_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id text,
  concept text,
  script text,
  status text not null default 'processing' check (status in ('processing', 'complete', 'failed')),
  output_url text,
  created_at timestamptz not null default now()
);

-- Slideshows — Pixel writes, dashboard reads. One row per TikTok slideshow
-- (6 slide images + a caption file), alternating between the two formats.
create table if not exists slideshows (
  id uuid primary key default gen_random_uuid(),
  format text not null check (format in ('tools_list', 'pain_hook')),
  hook text,
  slide_urls text[] not null default '{}',
  caption text,
  hashtags text,
  caption_url text, -- downloadable .txt with caption + hashtags
  photo_ids text[] not null default '{}', -- Pexels photo IDs used, for background dedup
  tools_used text[] not null default '{}', -- tools_list format only, for tool-choice dedup
  status text not null default 'ready' check (status in ('ready', 'failed')),
  created_at timestamptz not null default now()
);

-- Docs pages — Sage writes, ployed.net/docs (main app repo) reads. Separate
-- from seo_pages/Muse's /resources output: same publish mechanism, different
-- URL prefix and aimed at AI-search-citation formatting rather than general
-- SEO traffic. Note: seo_pages itself predates this file and was created
-- directly in Supabase, so it isn't defined here — docs_pages mirrors its
-- inferred shape (the columns src/lib/seoPages.ts in the main app reads).
create table if not exists docs_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  meta_description text,
  body_markdown text not null,
  content_queue_id uuid,
  published boolean not null default true,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_docs_pages_published on docs_pages (published, published_at desc);

-- RLS: the dashboard embeds NEXT_PUBLIC_SUPABASE_ANON_KEY client-side, which
-- makes that key effectively public. Lock it to read-only. Agents write via
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS, so this doesn't affect them.
alter table agent_memory enable row level security;
alter table lead_queue enable row level security;
alter table content_queue enable row level security;
alter table agent_logs enable row level security;
alter table dashboard_metrics enable row level security;
alter table risk_flags enable row level security;
alter table experiments enable row level security;
alter table higgsfield_jobs enable row level security;
alter table slideshows enable row level security;
alter table docs_pages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'agent_memory' and policyname = 'anon read agent_memory') then
    create policy "anon read agent_memory" on agent_memory for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'lead_queue' and policyname = 'anon read lead_queue') then
    create policy "anon read lead_queue" on lead_queue for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'content_queue' and policyname = 'anon read content_queue') then
    create policy "anon read content_queue" on content_queue for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_logs' and policyname = 'anon read agent_logs') then
    create policy "anon read agent_logs" on agent_logs for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dashboard_metrics' and policyname = 'anon read dashboard_metrics') then
    create policy "anon read dashboard_metrics" on dashboard_metrics for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'risk_flags' and policyname = 'anon read risk_flags') then
    create policy "anon read risk_flags" on risk_flags for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'experiments' and policyname = 'anon read experiments') then
    create policy "anon read experiments" on experiments for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'higgsfield_jobs' and policyname = 'anon read higgsfield_jobs') then
    create policy "anon read higgsfield_jobs" on higgsfield_jobs for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'slideshows' and policyname = 'anon read slideshows') then
    create policy "anon read slideshows" on slideshows for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'docs_pages' and policyname = 'anon read published docs_pages') then
    create policy "anon read published docs_pages" on docs_pages for select to anon using (published = true);
  end if;
end $$;
