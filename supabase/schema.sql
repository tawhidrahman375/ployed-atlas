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

-- Higgsfield jobs — Pixel writes, dashboard reads.
create table if not exists higgsfield_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id text,
  concept text,
  script text,
  status text not null default 'processing' check (status in ('processing', 'complete', 'failed')),
  output_url text,
  created_at timestamptz not null default now()
);
