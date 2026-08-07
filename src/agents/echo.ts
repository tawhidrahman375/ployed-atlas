import { ask } from '../lib/claude.js';
import { requireEnv } from '../lib/env.js';
import { addLeadToCampaign } from '../lib/instantly.js';
import { recall, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';

const DAILY_LIMIT_PER_DOMAIN = 30;

interface EmailDraft {
  subject: string;
  body: string;
}

interface Lead {
  email: string;
  name?: string;
  niche?: string;
}

// Deliberately requires INSTANTLY_CAMPAIGN_ID, which isn't set anywhere by
// default — an actual campaign has to exist in Instantly and be pointed at
// on purpose before this can send a single real email. Adding a lead here
// hands it to Instantly's own sequence timing; it isn't a synchronous send.
async function pushToInstantly(lead: Lead, draft: EmailDraft): Promise<void> {
  const campaignId = requireEnv('INSTANTLY_CAMPAIGN_ID');
  await addLeadToCampaign(campaignId, {
    email: lead.email,
    firstName: lead.name?.split(' ')[0],
    companyName: lead.niche,
    personalization: `${draft.subject}\n\n${draft.body}`,
  });
}

function parseDraft(raw: string): EmailDraft {
  const subject = raw.match(/^SUBJECT:\s*(.+)$/m)?.[1]?.trim() ?? '(no subject)';
  const body = raw.replace(/^SUBJECT:.*$/m, '').replace(/^BODY:\s*/m, '').trim();
  return { subject, body };
}

export async function run() {
  const [wins, failures] = await Promise.all([
    recall('outreach_wins', 20),
    recall('outreach_failures', 20),
  ]);

  // Apollo's Google Custom Search source can't recover email addresses from
  // LinkedIn/X search snippets, so most queued leads won't have one — those
  // are for manual X DM / LinkedIn comment outreach, not this path.
  const { data: leads, error } = await supabase
    .from('lead_queue')
    .select('*')
    .eq('status', 'queued')
    .not('email', 'is', null)
    .limit(DAILY_LIMIT_PER_DOMAIN);
  if (error) throw error;

  let sent = 0;
  for (const lead of leads ?? []) {
    const raw = await ask(
      'quality',
      "You are Echo, Ployed's cold email writer. Ployed helps AI automation agencies find qualified clients. Write a personalised email under 150 words referencing something specific about this lead, one CTA only, no attachments/links. Subject under 8 words. Never invent facts about the lead. Respond in exactly this format:\nSUBJECT: <subject>\nBODY: <body>",
      `Lead: ${JSON.stringify(lead)}\nPast winning angles: ${JSON.stringify(wins)}\nPast failed angles to avoid: ${JSON.stringify(failures)}`
    );
    const draft = parseDraft(raw);

    try {
      await pushToInstantly(lead, draft);
      await supabase.from('lead_queue').update({ status: 'emailed' }).eq('id', lead.id);
      sent += 1;
    } catch (err) {
      console.error((err as Error).message);
      break; // no campaign configured (or Instantly call failed) — stop rather than silently drop the rest of the batch
    }
  }

  await logAgentRun('Echo', 'morning', `Sent ${sent} cold emails.`, { sent, queued: leads?.length ?? 0 });
  return sent;
}
