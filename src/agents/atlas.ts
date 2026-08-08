import { supabase } from '../lib/supabase.js';
import { logAgentRun } from '../mnemos.js';
import * as nova from './nova.js';
import * as apollo from './apollo.js';
import * as echo from './echo.js';
import * as muse from './muse.js';
import * as pixel from './pixel.js';
import * as pulse from './pulse.js';
import * as sentinel from './sentinel.js';
import * as forge from './forge.js';

const REPORT_BUCKET = 'atlas-content';

async function saveReport(title: string, body: string): Promise<string> {
  const objectPath = `daily_report/${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  const { error: uploadError } = await supabase.storage
    .from(REPORT_BUCKET)
    .upload(objectPath, body, { contentType: 'text/markdown' });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(REPORT_BUCKET).getPublicUrl(objectPath);
  const { error } = await supabase
    .from('content_queue')
    .insert({ type: 'daily_report', title, file_path: publicUrl.publicUrl, status: 'ready' });
  if (error) throw error;

  return publicUrl.publicUrl;
}

interface StageInfo {
  stage: number;
  label: string;
  mrr: number;
}

const STAGE_LABELS: Record<number, string> = {
  1: 'Stage 1 — pre-first-sale (£0 MRR): max outreach volume, learn every objection',
  2: 'Stage 2 — first sale → £1k MRR: double down on what closed, gather testimonials',
  3: 'Stage 3 — £1k → £5k MRR: scale winning channels, SEO compounding begins',
  4: 'Stage 4 — £5k → £10k MRR: paid experiments, partnerships',
  5: 'Stage 5 — £10k → £20k MRR: retention focus, kill losers, efficiency mode',
};

async function getStage(): Promise<StageInfo> {
  const { data } = await supabase
    .from('dashboard_metrics')
    .select('metric_value')
    .eq('metric_name', 'mrr_pence')
    .maybeSingle();
  const mrr = Number(data?.metric_value ?? 0) / 100;

  let stage = 1;
  if (mrr >= 10000) stage = 5;
  else if (mrr >= 5000) stage = 4;
  else if (mrr >= 1000) stage = 3;
  else if (mrr > 0) stage = 2;

  return { stage, label: STAGE_LABELS[stage], mrr };
}

async function runStep<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[Atlas] ${name} failed:`, (err as Error).message);
    return null;
  }
}

async function morningBlock(): Promise<void> {
  const stageInfo = await getStage();
  console.log(`[Atlas] ${stageInfo.label}`);

  // Round 1 — research.
  const bestInsight = await runStep('Nova', () => nova.run());

  // Round 2 — outreach. Sequential: Echo reads the queue Apollo just filled.
  const leadsFound = await runStep('Apollo', () => apollo.run());
  const emailsSent = await runStep('Echo', () => echo.run());

  // Pulse reads lead_queue/Instantly counts for "today" — must run after
  // Apollo/Echo have done today's work, not in parallel with Nova beforehand,
  // or leads_found_today/emails_sent_today always read as 0 (queried before
  // today's rows existed).
  await runStep('Pulse', () => pulse.run());

  // Round 3 — content. Sequential: Pixel uses Nova's best insight.
  const museOutput = await runStep('Muse', () => muse.run());
  const pixelJob = await runStep('Pixel', () => pixel.run(bestInsight));

  // Round 4 — report.
  const experiments = await runStep('Forge', () => forge.run());

  const report = [
    `# Ployed Atlas — Morning Report — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `**Stage:** ${stageInfo.label}`,
    `**MRR:** £${stageInfo.mrr.toFixed(2)}`,
    '',
    '## Research',
    bestInsight ? `Best insight of the day: ${bestInsight}` : 'No new insight today.',
    '',
    '## Outreach',
    `Leads found: ${leadsFound ?? 0}`,
    `Emails sent: ${emailsSent ?? 0}`,
    '',
    '## Content',
    museOutput
      ? `LinkedIn post, X thread, and ${museOutput.seoPages.length} SEO pages produced.`
      : 'Muse did not complete this run.',
    pixelJob ? `Higgsfield job fired: ${pixelJob}` : 'No Higgsfield job fired.',
    '',
    '## Experiments',
    `${experiments?.length ?? 0} currently running.`,
  ].join('\n');

  const reportUrl = await saveReport(`Morning Report ${new Date().toISOString().slice(0, 10)}`, report);

  await logAgentRun('Atlas', 'morning', 'Morning block complete.', { stage: stageInfo.stage, reportUrl });
  console.log(report);
}

async function eveningBlock(): Promise<void> {
  const stageInfo = await getStage();

  await runStep('Pulse', () => pulse.run());
  await runStep('Sentinel', () => sentinel.run());
  const higgsfieldUpdated = await runStep('Pixel (poll)', () => pixel.pollPendingJobs());

  const summary = `Evening block complete. ${stageInfo.label}${higgsfieldUpdated ? ` — ${higgsfieldUpdated} Higgsfield job(s) updated.` : ''}`;
  await logAgentRun('Atlas', 'evening', summary, { stage: stageInfo.stage });
  console.log(`[Atlas] ${summary}`);
}

const mode = process.argv[2];
if (mode === 'morning') {
  await morningBlock();
} else if (mode === 'evening') {
  await eveningBlock();
} else {
  console.error('Usage: tsx src/agents/atlas.ts <morning|evening>');
  process.exit(1);
}
