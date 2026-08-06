import { recall, remember, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';
import { notWired } from '../lib/not-wired.js';

interface Candidate {
  name: string;
  handle: string;
  platform: string;
  niche: string;
  signals: string;
  email?: string;
}

async function findCandidates(): Promise<Candidate[]> {
  // TODO: wire up a real search (e.g. a LinkedIn/X search API, or import a
  // manually exported list). Qualification signals to look for: active
  // online presence, under 5k followers, prospecting/lead-gen content,
  // no obvious product of their own.
  notWired('Apollo', 'lead search', 'N/A — implement a search source');
}

export async function run() {
  await recall('icp_profiles', 20); // load before searching so future passes can use it for targeting

  const candidates = await findCandidates().catch((err: Error) => {
    console.error(err.message);
    return [] as Candidate[];
  });

  if (candidates.length) {
    const { error } = await supabase
      .from('lead_queue')
      .insert(candidates.map((c) => ({ ...c, status: 'queued' })));
    if (error) throw error;
  }

  await remember(
    'icp_profiles',
    { batchSize: candidates.length, ts: new Date().toISOString() },
    { source: 'Apollo' }
  );
  await logAgentRun('Apollo', 'morning', `Found ${candidates.length} qualified leads.`, {
    count: candidates.length,
  });

  return candidates.length;
}
