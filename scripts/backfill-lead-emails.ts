// One-off: Apollo's enrichment loop only ever ran against brand-new
// candidates found in that day's search, so the original LinkedIn backlog
// (queued back when Hunter.io was wired in, which had a near-0% hit rate for
// this ICP) never got retried against Anymail Finder after the swap. Apollo's
// daily run now also works through this backlog a few at a time (see
// apollo.ts), but this script clears the whole existing backlog in one pass
// instead of waiting for the daily trickle.
import { supabase } from '../src/lib/supabase.js';
import { findEmailByLinkedIn } from '../src/lib/anymailFinder.js';

async function run() {
  const { data: leads, error } = await supabase
    .from('lead_queue')
    .select('id, name, handle')
    .eq('platform', 'linkedin')
    .eq('status', 'queued')
    .is('email', null);
  if (error) throw error;

  let found = 0;
  for (const lead of leads ?? []) {
    try {
      const email = await findEmailByLinkedIn(lead.handle);
      if (email) {
        const { error: updateError } = await supabase.from('lead_queue').update({ email }).eq('id', lead.id);
        if (updateError) throw updateError;
        found += 1;
        console.log(`Found: ${lead.name} -> ${email}`);
      } else {
        console.log(`Not found: ${lead.name}`);
      }
    } catch (err) {
      console.error(`Lookup failed for ${lead.name} (${lead.handle}):`, (err as Error).message);
    }
  }

  console.log(`Done. ${found}/${leads?.length ?? 0} leads enriched.`);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
