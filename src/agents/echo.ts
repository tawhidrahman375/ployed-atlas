import { ask } from '../lib/claude.js';
import { recall, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';
import { notWired } from '../lib/not-wired.js';

const DAILY_LIMIT_PER_DOMAIN = 30;

interface EmailDraft {
  subject: string;
  body: string;
}

async function pushToInstantly(_to: string, _draft: EmailDraft): Promise<void> {
  // TODO: POST to the Instantly campaigns/leads API. Never exceed
  // DAILY_LIMIT_PER_DOMAIN — domain reputation is everything.
  notWired('Echo', 'Instantly push', 'INSTANTLY_API_KEY');
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

  const { data: leads, error } = await supabase
    .from('lead_queue')
    .select('*')
    .eq('status', 'queued')
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
      await pushToInstantly(lead.email, draft);
      await supabase.from('lead_queue').update({ status: 'emailed' }).eq('id', lead.id);
      sent += 1;
    } catch (err) {
      console.error((err as Error).message);
      break; // Instantly isn't wired yet — stop rather than silently drop the rest of the batch
    }
  }

  await logAgentRun('Echo', 'morning', `Sent ${sent} cold emails.`, { sent, queued: leads?.length ?? 0 });
  return sent;
}
