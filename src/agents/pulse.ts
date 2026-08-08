import { JWT } from 'google-auth-library';
import { requireEnv } from '../lib/env.js';
import { getCampaignAnalytics } from '../lib/instantly.js';
import { logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';

async function pullGSC(): Promise<{ clicks: number; impressions: number }> {
  const credentials = JSON.parse(requireEnv('GSC_CREDENTIALS_JSON'));
  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const siteUrl = requireEnv('GSC_SITE_URL');
  const today = new Date().toISOString().slice(0, 10);

  // GSC data typically lags 2-3 days, so "today" is often genuinely 0 — that's
  // real, not a bug.
  const res = await client.request<{ rows?: { clicks: number; impressions: number }[] }>({
    url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    method: 'POST',
    data: { startDate: today, endDate: today },
  });

  const row = res.data.rows?.[0];
  return { clicks: row?.clicks ?? 0, impressions: row?.impressions ?? 0 };
}

async function pullPostHog(): Promise<{ eventsToday: number }> {
  const res = await fetch(`https://eu.posthog.com/api/projects/${requireEnv('POSTHOG_PROJECT_ID')}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('POSTHOG_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: { kind: 'HogQLQuery', query: 'select count() from events where timestamp >= today()' },
    }),
  });
  if (!res.ok) throw new Error(`PostHog query failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { results?: [number][] };
  return { eventsToday: data.results?.[0]?.[0] ?? 0 };
}

async function pullInstantlyStats(): Promise<{ sent: number; bounced: number; replies: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const overview = await getCampaignAnalytics(today, today);
  return { sent: overview.emails_sent_count, bounced: overview.bounced_count, replies: overview.reply_count };
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
  const [gsc, posthog, instantly] = await Promise.allSettled([pullGSC(), pullPostHog(), pullInstantlyStats()]);

  if (gsc.status === 'fulfilled') {
    await setMetric('gsc_clicks_today', gsc.value.clicks);
    await setMetric('gsc_impressions_today', gsc.value.impressions);
  } else {
    console.error('[Pulse] GSC pull failed:', gsc.reason);
    await setMetric('gsc_clicks_today', 0);
    await setMetric('gsc_impressions_today', 0);
  }

  if (posthog.status === 'fulfilled') {
    await setMetric('posthog_events_today', posthog.value.eventsToday);
  } else {
    console.error('[Pulse] PostHog pull failed:', posthog.reason);
    await setMetric('posthog_events_today', 0);
  }

  if (instantly.status === 'fulfilled') {
    await setMetric('emails_sent_today', instantly.value.sent);
    await setMetric('instantly_bounced_today', instantly.value.bounced);
    await setMetric('instantly_replies_today', instantly.value.replies);
  } else {
    console.error('[Pulse] Instantly pull failed:', instantly.reason);
    await setMetric('emails_sent_today', 0);
  }

  const startOfToday = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from('lead_queue')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfToday);
  await setMetric('leads_found_today', count ?? 0);

  const wired = [gsc, posthog, instantly].filter((r) => r.status === 'fulfilled').length;
  await logAgentRun('Pulse', 'morning', `Pulled analytics (${wired}/3 sources wired).`, { wired });
}
