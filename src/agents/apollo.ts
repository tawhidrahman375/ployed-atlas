import { ask } from '../lib/claude.js';
import { customSearch } from '../lib/brave-search.js';
import { findEmailByLinkedIn } from '../lib/anymailFinder.js';
import { recall, remember, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';

// Anymail Finder only charges a credit on a genuine find, so this cap isn't
// about rationing a monthly quota — it's a sanity ceiling on live SMTP-verify
// calls (each one takes real seconds) per run.
const MAX_ENRICHMENTS_PER_RUN = 5;

interface Candidate {
  name: string;
  handle: string;
  platform: 'linkedin' | 'x';
  niche: string;
  signals: string;
  email?: string;
}

// ICP priority order from the spec: AI automation agencies first, then GHL,
// web design, SMMA. One query per (niche x platform) — 8 total, well inside
// the 100/day free-tier cap even run twice.
const SEARCHES: { niche: string; platform: 'linkedin' | 'x'; query: string }[] = [
  {
    niche: 'AI automation agency',
    platform: 'linkedin',
    query: 'site:linkedin.com/in "AI automation agency" (founder OR owner OR "co-founder")',
  },
  {
    niche: 'GHL agency',
    platform: 'linkedin',
    query: 'site:linkedin.com/in "GoHighLevel agency" (founder OR owner)',
  },
  {
    niche: 'web design agency',
    platform: 'linkedin',
    query: 'site:linkedin.com/in "web design agency" (founder OR owner)',
  },
  {
    niche: 'SMMA',
    platform: 'linkedin',
    query: 'site:linkedin.com/in SMMA (founder OR owner) clients',
  },
  {
    niche: 'AI automation agency',
    platform: 'x',
    query: 'site:x.com "AI automation agency" (founder OR owner)',
  },
  { niche: 'GHL agency', platform: 'x', query: 'site:x.com "GoHighLevel agency"' },
  { niche: 'web design agency', platform: 'x', query: 'site:x.com "web design agency" founder' },
  { niche: 'SMMA', platform: 'x', query: 'site:x.com SMMA founder' },
];

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in response');
  }
  return JSON.parse(text.slice(start, end + 1)) as unknown[];
}

async function findCandidates(seenHandles: Set<string>): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  for (const search of SEARCHES) {
    const results = await customSearch(search.query).catch((err: Error) => {
      console.error(`[Apollo] search failed for "${search.query}":`, err.message);
      return [];
    });
    if (!results.length) continue;

    const raw = await ask(
      'bulk',
      `You are Apollo, Ployed's lead-finding agent. Ployed sells prospecting/lead-gen software to AI automation agencies, GHL agencies, web design agencies, and SMMA operators — especially ones with fewer than 5 clients, since they need it most. From these ${search.platform === 'linkedin' ? 'LinkedIn' : 'X'} search results, extract real individual people (not companies, not job listings, not news articles) who plausibly run or co-found a ${search.niche}. Respond with a JSON array only, no prose, no markdown fences. Each item: {"name": string, "handle": string (the profile URL), "signals": string (one line on why they fit)}. Skip anything that isn't clearly a person's own profile.`,
      JSON.stringify(results)
    );

    try {
      const parsed = extractJsonArray(raw) as { name: string; handle: string; signals: string }[];
      for (const c of parsed) {
        if (c.handle && c.name && !seenHandles.has(c.handle)) {
          candidates.push({ name: c.name, handle: c.handle, signals: c.signals, platform: search.platform, niche: search.niche });
          seenHandles.add(c.handle);
        }
      }
    } catch (err) {
      console.error(`[Apollo] failed to parse extraction for "${search.query}":`, (err as Error).message);
    }
  }

  return candidates;
}

export async function run() {
  await recall('icp_profiles', 20); // TODO: use past conversion data to weight/reorder SEARCHES

  const { data: existing } = await supabase.from('lead_queue').select('handle');
  const seenHandles = new Set((existing ?? []).map((r) => r.handle).filter((h): h is string => Boolean(h)));

  const candidates = await findCandidates(seenHandles).catch((err: Error) => {
    console.error(err.message);
    return [] as Candidate[];
  });

  // LinkedIn/X search snippets don't expose email addresses on their own, so
  // enrich a small batch via Anymail Finder's LinkedIn-URL endpoint (no
  // company domain needed). Leads that don't get enriched still queue for
  // manual X DM / LinkedIn comment outreach; enriched ones become eligible
  // for Echo's Instantly path immediately.
  let enriched = 0;
  for (const c of candidates) {
    if (enriched >= MAX_ENRICHMENTS_PER_RUN || c.platform !== 'linkedin') continue;
    try {
      const email = await findEmailByLinkedIn(c.handle);
      if (email) {
        c.email = email;
        enriched += 1;
      }
    } catch (err) {
      console.error(`[Apollo] Anymail Finder lookup failed for ${c.handle}:`, (err as Error).message);
    }
  }

  if (candidates.length) {
    const { error } = await supabase.from('lead_queue').insert(candidates.map((c) => ({ ...c, status: 'queued' })));
    if (error) throw error;
  }

  // Dedup means most days find few or zero brand-new candidates, so the
  // backlog of already-queued LinkedIn leads that never got enriched (e.g.
  // anything found back when Hunter.io was wired in, which had a near-0%
  // hit rate for this ICP) would otherwise sit at email=null forever. Spend
  // whatever enrichment budget is left today working through that backlog
  // too, oldest first.
  let backfilled = 0;
  if (enriched < MAX_ENRICHMENTS_PER_RUN) {
    const { data: backlog, error: backlogError } = await supabase
      .from('lead_queue')
      .select('id, handle')
      .eq('platform', 'linkedin')
      .eq('status', 'queued')
      .is('email', null)
      .order('created_at', { ascending: true })
      .limit(MAX_ENRICHMENTS_PER_RUN - enriched);
    if (backlogError) throw backlogError;

    for (const lead of backlog ?? []) {
      try {
        const email = await findEmailByLinkedIn(lead.handle);
        if (email) {
          const { error: updateError } = await supabase.from('lead_queue').update({ email }).eq('id', lead.id);
          if (updateError) throw updateError;
          backfilled += 1;
        }
      } catch (err) {
        console.error(`[Apollo] Anymail Finder backfill failed for ${lead.handle}:`, (err as Error).message);
      }
    }
  }

  await remember(
    'icp_profiles',
    { batchSize: candidates.length, enriched: enriched + backfilled, ts: new Date().toISOString() },
    { source: 'Apollo' }
  );
  await logAgentRun(
    'Apollo',
    'morning',
    `Found ${candidates.length} qualified leads, enriched ${enriched} with email, backfilled ${backfilled} from the existing queue.`,
    { count: candidates.length, enriched, backfilled }
  );

  return candidates.length;
}
