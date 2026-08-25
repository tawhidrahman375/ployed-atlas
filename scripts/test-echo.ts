// Standalone smoke test for the Saleshandy swap: runs Echo's real logic
// (same risk-flag check, same draft prompt, same push call as atlas.ts's
// morning block) against exactly ONE eligible lead, and prints the raw
// Saleshandy response instead of just a queued/failed count. Use this
// instead of `npm run morning` to verify the integration without burning a
// Claude draft call (and a Saleshandy push attempt) for every eligible lead
// in the queue at once — if the request shape is wrong, one failure proves
// it as cheaply as thirty would.
//
// This makes a REAL push to Saleshandy if SALESHANDY_API_KEY/
// SALESHANDY_SEQUENCE_ID are set and a lead is picked up — it is not a
// no-op dry run. On success it also marks that lead 'emailed' in
// lead_queue, same as a real run would, so the next real `npm run morning`
// doesn't push it again.
//
// Usage: tsx scripts/test-echo.ts
import { supabase } from '../src/lib/supabase.js';
import { requireEnv } from '../src/lib/env.js';
import { recall } from '../src/mnemos.js';
import { draftEmail, hasUnresolvedRedFlag, pushToSaleshandy, type Lead } from '../src/agents/echo.js';

async function main() {
  console.log('[test-echo] Checking SALESHANDY_API_KEY / SALESHANDY_SEQUENCE_ID are set...');
  requireEnv('SALESHANDY_API_KEY');
  const sequenceId = requireEnv('SALESHANDY_SEQUENCE_ID');
  console.log(`[test-echo] Both set. Target sequence: ${sequenceId}`);

  if (await hasUnresolvedRedFlag()) {
    console.error('[test-echo] Aborting — Echo has an unresolved red risk flag (bounce rate). Same brake a real run respects.');
    process.exit(1);
  }

  const { data: leads, error } = await supabase
    .from('lead_queue')
    .select('*')
    .eq('status', 'queued')
    .not('email', 'is', null)
    .limit(1);
  if (error) throw error;

  const lead = leads?.[0] as Lead & { id: string };
  if (!lead) {
    console.error('[test-echo] No eligible lead found (status=queued, email set). Nothing to push.');
    process.exit(1);
  }
  console.log(`[test-echo] Using lead: ${lead.email} (${lead.name ?? 'no name'}, ${lead.niche ?? 'no niche'})`);

  const [wins, failures] = await Promise.all([recall('outreach_wins', 20), recall('outreach_failures', 20)]);

  console.log('[test-echo] Drafting via Claude...');
  const draft = await draftEmail(lead, wins, failures);
  console.log(`[test-echo] Draft subject: ${draft.subject}`);
  console.log(`[test-echo] Draft body:\n${draft.body}`);

  console.log(`[test-echo] Pushing to Saleshandy sequence ${sequenceId} — this is a REAL API call...`);
  try {
    const rawResponse = await pushToSaleshandy(lead, draft);
    console.log('[test-echo] SUCCESS. Raw Saleshandy response body:');
    console.log(rawResponse);

    await supabase.from('lead_queue').update({ status: 'emailed' }).eq('id', lead.id);
    console.log(`[test-echo] Marked lead_queue row ${lead.id} as 'emailed' (same as a real run would).`);
  } catch (err) {
    console.error('[test-echo] FAILED. Raw error (includes HTTP status + response body):');
    console.error((err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[test-echo] Unexpected error:', (err as Error).message);
  process.exit(1);
});
