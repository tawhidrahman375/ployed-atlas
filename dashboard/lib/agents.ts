export type AgentKey =
  | 'atlas'
  | 'mnemos'
  | 'nova'
  | 'vega'
  | 'apollo'
  | 'echo'
  | 'muse'
  | 'pixel'
  | 'pulse'
  | 'ledger'
  | 'sentinel'
  | 'forge';

export interface AgentMeta {
  key: AgentKey;
  name: string;
  role: string;
  color: string;
}

export const AGENTS: AgentMeta[] = [
  { key: 'atlas', name: 'Atlas', role: 'Orchestrator — runs the morning & evening blocks, writes the daily report', color: '#818cf8' },
  { key: 'mnemos', name: 'Mnemos', role: 'Shared long-term memory every agent reads and writes through', color: '#a78bfa' },
  { key: 'nova', name: 'Nova', role: 'Mines competitor YouTube transcripts for insights', color: '#f472b6' },
  { key: 'vega', name: 'Vega', role: 'Diffs competitor pages and sweeps Reddit for signal', color: '#38bdf8' },
  { key: 'apollo', name: 'Apollo', role: 'Finds leads via Brave Search, enriches emails via Anymail Finder', color: '#fb923c' },
  { key: 'echo', name: 'Echo', role: 'Queues cold email into Instantly (delivery depends on Instantly’s own send schedule/warmup)', color: '#34d399' },
  { key: 'muse', name: 'Muse', role: 'Writes LinkedIn, X and SEO content', color: '#e879f9' },
  { key: 'pixel', name: 'Pixel', role: 'Fires and polls Higgsfield video jobs', color: '#fbbf24' },
  { key: 'pulse', name: 'Pulse', role: 'Pulls GSC, PostHog and Instantly analytics', color: '#22d3ee' },
  { key: 'ledger', name: 'Ledger', role: 'Reads live Stripe MRR — always-on webhook listener', color: '#4ade80' },
  { key: 'sentinel', name: 'Sentinel', role: 'Watches bounce rate, can block Echo mid-send', color: '#f87171' },
  { key: 'forge', name: 'Forge', role: 'Proposes and tracks growth experiments', color: '#fb7185' },
];

export const AGENT_BY_NAME = new Map(AGENTS.map((a) => [a.name, a]));
export const AGENT_BY_KEY = new Map(AGENTS.map((a) => [a.key, a]));

export interface PipelineRound {
  label: string;
  parallel: boolean;
  agents: AgentKey[];
}

export interface Pipeline {
  id: string;
  title: string;
  trigger: string;
  rounds: PipelineRound[];
}

export const PIPELINES: Pipeline[] = [
  {
    id: 'morning',
    title: 'Morning block',
    trigger: 'VPS cron · 08:00 UTC',
    rounds: [
      { label: 'Round 1 · parallel', parallel: true, agents: ['nova', 'pulse'] },
      { label: 'Round 2 · sequential', parallel: false, agents: ['apollo', 'echo'] },
      { label: 'Round 3 · sequential', parallel: false, agents: ['muse', 'pixel'] },
      { label: 'Round 4 · report', parallel: false, agents: ['forge'] },
    ],
  },
  {
    id: 'evening',
    title: 'Evening block',
    trigger: 'VPS cron · 20:00 UTC',
    rounds: [{ label: 'Sequential', parallel: false, agents: ['pulse', 'sentinel', 'pixel'] }],
  },
  {
    id: 'github',
    title: 'GitHub Actions',
    trigger: 'Workflow · 09:00 UTC',
    rounds: [{ label: 'Independent of Atlas', parallel: true, agents: ['vega'] }],
  },
];

export const ALWAYS_ON: AgentKey[] = ['ledger'];
export const MEMORY_HUB: AgentKey = 'mnemos';

export type Freshness = 'live' | 'stale' | 'dormant' | 'never';

export function freshnessFromHours(hours: number | null): Freshness {
  if (hours === null) return 'never';
  if (hours < 24) return 'live';
  if (hours < 48) return 'stale';
  return 'dormant';
}
