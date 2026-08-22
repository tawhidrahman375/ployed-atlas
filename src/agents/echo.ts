import { ask } from '../lib/claude.js';
import { requireEnv } from '../lib/env.js';
import { addProspectToSequence } from '../lib/saleshandy.js';
import { recall, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';

const DAILY_LIMIT_PER_DOMAIN = 30;

export interface EmailDraft {
  subject: string;
  body: string;
}

export interface Lead {
  email: string;
  name?: string;
  niche?: string;
}

const DRAFT_SYSTEM_PROMPT =
  "You are Echo, Ployed's cold email writer. Ployed helps AI automation agencies find qualified clients. Write a personalised email under 150 words referencing something specific about this lead, one CTA only, no attachments/links. Subject under 8 words. Never invent facts about the lead. Respond in exactly this format:\nSUBJECT: <subject>\nBODY: <body>";

function parseDraft(raw: string): EmailDraft {
  const subject = raw.match(/^SUBJECT:\s*(.+)$/m)?.[1]?.trim() ?? '(no subject)';
  const body = raw.replace(/^SUBJECT:.*$/m, '').replace(/^BODY:\s*/m, '').trim();
  return { subject, body };
}

// Exported (not just used inline in run()'s loop) so a standalone script can
// draft exactly what a real run would, without duplicating the prompt.
export async function draftEmail(lead: Lead, wins: unknown[], failures: unknown[]): Promise<EmailDraft> {
  const raw = await ask(
    'quality',
    DRAFT_SYSTEM_PROMPT,
    `Lead: ${JSON.stringify(lead)}\nPast winning angles: ${JSON.stringify(wins)}\nPast failed angles to avoid: ${JSON.stringify(failures)}`
  );
  return parseDraft(raw);
}

// Deliberately requires SALESHANDY_SEQUENCE_ID, which isn't set anywhere by
// default — an actual sequence has to exist in Saleshandy and be pointed at
// on purpose before this can send a single real email. Adding a prospect
// here hands it to Saleshandy's own sequence timing; it isn't a synchronous
// send. Returns the raw Saleshandy response body (see addProspectToSequence)
// so a standalone test script can print exactly what the API sent back.
export async function pushToSaleshandy(lead: Lead, draft: EmailDraft): Promise<string> {
  const sequenceId = requireEnv('SALESHANDY_SEQUENCE_ID');
  return addProspectToSequence(sequenceId, {
    email: lead.email,
    firstName: lead.name?.split(' ')[0],
    companyName: lead.niche,
    personalization: `${draft.subject}\n\n${draft.body}`,
  });
}

// Sentinel writes red flags tagged agent: 'Echo' when bounce rate crosses
// the danger threshold, but writing a flag doesn't stop anything by itself
// — this is the actual enforcement. There's no UI yet to mark a flag
// resolved; do it directly in Supabase (risk_flags.resolved = true) once
// the underlying issue is actually fixed. Exported so a standalone test
// script respects the same brake a real run would.
export async function hasUnresolvedRedFlag(): Promise<boolean> {
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

  // Fail fast on missing sequence config, before spending any Claude calls
  // drafting emails that every lead below would fail to push anyway.
  requireEnv('SALESHANDY_SEQUENCE_ID');

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
    const draft = await draftEmail(lead, wins, failures);

    try {
      await pushToSaleshandy(lead, draft);
      await supabase.from('lead_queue').update({ status: 'emailed' }).eq('id', lead.id);
      sent += 1;
    } catch (err) {
      const message = (err as Error).message;
      console.error(message);
      // One lead's Saleshandy push failing (e.g. duplicate, transient API
      // error) shouldn't block every other eligible lead in the batch —
      // skip it and keep going, but keep the error so it's visible without
      // digging through VPS-local stdout.
      failed.push({ email: lead.email, error: message });
    }
  }

  // "Queued" is deliberate, not "sent" — addProspectToSequence succeeding
  // only means Saleshandy accepted the prospect into the sequence's send
  // queue, not that an email left the building. Actual delivery depends on
  // Saleshandy's own sequence timing (and, if the sending account is still
  // warming up, may not happen at all until warmup clears) — verify real
  // sends via Saleshandy's own reporting, not this count.
  await logAgentRun('Echo', 'morning', `Queued ${sent} cold email(s) to Saleshandy.`, {
    queuedToSaleshandy: sent,
    eligible: leads?.length ?? 0,
    failed: failed.length,
    errors: failed,
  });
  return sent;
}
