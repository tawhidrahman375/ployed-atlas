import { logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';
import { notWired } from '../lib/not-wired.js';

async function pullGSC(): Promise<void> {
  notWired('Pulse', 'Google Search Console pull', 'GSC_CREDENTIALS_JSON');
}
async function pullPostHog(): Promise<void> {
  notWired('Pulse', 'PostHog pull', 'POSTHOG_API_KEY');
}
async function pullInstantlyStats(): Promise<void> {
  notWired('Pulse', 'Instantly stats pull', 'INSTANTLY_API_KEY');
}

async function setMetric(name: string, value: string | number): Promise<void> {
  const { error } = await supabase
    .from('dashboard_metrics')
    .upsert(
      { metric_name: name, metric_value: String(value), updated_at: new Date().toISOString() },
      { onConflict: 'metric_name' }
    );
  if (error) throw error;
}

export async function run() {
  const results = await Promise.allSettled([pullGSC(), pullPostHog(), pullInstantlyStats()]);
  const wired = results.filter((r) => r.status === 'fulfilled').length;

  // Defaults stay at 0 until the sources above are wired — never show fake numbers on the dashboard.
  await setMetric('emails_sent_today', 0);
  await setMetric('leads_found_today', 0);
  await setMetric('gsc_clicks_today', 0);
  await setMetric('gsc_impressions_today', 0);

  await logAgentRun('Pulse', 'morning', `Pulled analytics (${wired}/3 sources wired).`, { wired });
}
