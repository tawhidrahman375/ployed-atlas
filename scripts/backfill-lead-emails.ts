// One-off: works through the entire existing lead_queue backlog against
// Anymail Finder in one pass, instead of waiting for Apollo's daily trickle
// (capped at MAX_ATTEMPTS_PER_RUN — see apollo.ts). Originally written for
// the Hunter.io -> Anymail Finder swap; extended to also backfill a missing
// `company` field (inferred from the stored `signals` text via Claude) so
// leads that failed the LinkedIn-URL lookup, and X leads that never had any
// enrichment path before the name+company fallback existed, get a real shot
// too.
import { supabase } from '../src/lib/supabase.js';
import { ask } from '../src/lib/claude.js';
import { findEmailByLinkedIn, findEmailByNameAndCompany } from '../src/lib/anymailFinder.js';

async function inferCompany(name: string, signals: string): Promise<string | null> {
  const raw = await ask(
    'bulk',
    'Extract the business/agency name this person runs from the text below, only if it is explicitly stated. Respond with ONLY the company name and nothing else, or the exact word NONE if it is not stated or you would be guessing.',
    `Name: ${name}\nBio/signal: ${signals}`
  );
  const trimmed = raw.trim();
  return trimmed && trimmed.toUpperCase() !== 'NONE' ? trimmed : null;
}

async function run() {
  const { data: leads, error } = await supabase
    .from('lead_queue')
    .select('id, name, handle, platform, signals, company')
    .eq('status', 'queued')
    .is('email', null);
  if (error) throw error;

  let found = 0;
  let companiesInferred = 0;

  for (const lead of leads ?? []) {
    try {
      let company = lead.company as string | null;
      if (!company && lead.signals) {
        company = await inferCompany(lead.name, lead.signals);
        if (company) {
          companiesInferred += 1;
          await supabase.from('lead_queue').update({ company }).eq('id', lead.id);
        }
      }

      let email: string | null = null;
      if (lead.platform === 'linkedin') {
        email = await findEmailByLinkedIn(lead.handle);
      }
      if (!email && company) {
        email = await findEmailByNameAndCompany(lead.name, company);
      }

      if (email) {
        await supabase.from('lead_queue').update({ email }).eq('id', lead.id);
        found += 1;
        console.log(`Found: ${lead.name} (${company ?? 'no company'}) -> ${email}`);
      } else {
        console.log(`Not found: ${lead.name} (${company ?? 'no company'})`);
      }
    } catch (err) {
      console.error(`Lookup failed for ${lead.name} (${lead.handle}):`, (err as Error).message);
    }
  }

  console.log(`Done. ${found}/${leads?.length ?? 0} leads enriched, ${companiesInferred} companies inferred.`);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
