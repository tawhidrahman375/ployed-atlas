import { supabase } from './lib/supabase.js';

// The 10 categories every agent reads from and writes to before/after a session.
export type MemoryCategory =
  | 'outreach_wins'
  | 'outreach_failures'
  | 'icp_profiles'
  | 'objections'
  | 'messaging'
  | 'platform_rules'
  | 'ugc_best_practices'
  | 'youtube_insights'
  | 'competitor_intel'
  | 'experiment_results';

export async function remember(
  category: MemoryCategory,
  content: unknown,
  opts?: { source?: string; relevanceScore?: number }
): Promise<void> {
  const { error } = await supabase.from('agent_memory').insert({
    category,
    content,
    source: opts?.source,
    relevance_score: opts?.relevanceScore ?? 5,
  });
  if (error) throw error;
}

export async function recall(category: MemoryCategory, limit = 20) {
  const { data, error } = await supabase
    .from('agent_memory')
    .select('*')
    .eq('category', category)
    .order('relevance_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function logAgentRun(
  agent: string,
  sessionType: 'morning' | 'evening' | 'github_actions',
  summary: string,
  actionsTaken?: unknown
): Promise<void> {
  const { error } = await supabase.from('agent_logs').insert({
    agent,
    session_type: sessionType,
    summary,
    actions_taken: actionsTaken ?? null,
  });
  if (error) throw error;
}
