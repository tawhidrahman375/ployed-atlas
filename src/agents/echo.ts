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

// Sentinel writes red flags tagged agent: 'Echo' when bounce rate crosses
// the danger threshold, but writing a flag doesn't stop anything by itself
// — this is the actual enforcement. There's no UI yet to mark a flag
// resolved; do it directly in Supabase (risk_flags.resolved = true) once
// the underlying issue is actually fixed.
async function hasUnresolvedRedFlag(): Promise<boolean> {
  const { data, error } = await supabase
    .from('risk_flags')
    .select('id')
    .eq('agent', 'Echo')
    .eq('level', 'red')
    .eq('resolved', false)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function run() {
  if (await hasUnresolvedRedFlag()) {
    await logAgentRun('Echo', 'morning', 'Skipped — unresolved red risk flag (bounce rate).');
    return 0;
  }

  // Fail fast on missing campaign config, before spending any Claude calls
  // drafting emails that every lead below would fail to push anyway.
  requireEnv('INSTANTLY_CAMPAIGN_ID');

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
  const failed: { email: string; error: string }[] = [];
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
      const message = (err as Error).message;
      console.error(message);
      // One lead's Instantly push failing (e.g. duplicate, transient API
      // error) shouldn't block every other eligible lead in the batch —
      // skip it and keep going, but keep the error so it's visible without
      // digging through VPS-local stdout.
      failed.push({ email: lead.email, error: message });
    }
  }

  // "Queued" is deliberate, not "sent" — addLeadToCampaign succeeding only
  // means Instantly accepted the lead into the campaign's send queue, not
  // that an email left the building. Actual delivery depends on Instantly's
  // own sequence timing (and, if the sending account is still warming up,
  // may not happen at all until warmup clears) — verify real sends via
  // Instantly's /emails endpoint or campaign analytics, not this count.
  await logAgentRun('Echo', 'morning', `Queued ${sent} cold email(s) to Instantly.`, {
    queuedToInstantly: sent,
    eligible: leads?.length ?? 0,
    failed: failed.length,
    errors: failed,
  });
  return sent;
}
