import { supabase } from '../lib/supabase.js';
import { getCampaignAnalytics } from '../lib/instantly.js';
import { logAgentRun } from '../mnemos.js';

const BOUNCE_YELLOW = 0.03;
const BOUNCE_RED = 0.05;
const LOOKBACK_DAYS = 7; // a single day's ratio is too noisy at low volume

async function getInstantlyBounceRate(): Promise<number> {
  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const analytics = await getCampaignAnalytics(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));

  const totals = analytics.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.emails_sent_count ?? 0),
      bounced: acc.bounced + (c.bounced_count ?? 0),
    }),
    { sent: 0, bounced: 0 }
  );

  return totals.sent > 0 ? totals.bounced / totals.sent : 0;
}

async function flag(level: 'green' | 'yellow' | 'red', agent: string, message: string): Promise<void> {
  const { error } = await supabase.from('risk_flags').insert({ level, agent, message });
  if (error) throw error;
}

export async function run() {
  try {
    const bounceRate = await getInstantlyBounceRate();
    if (bounceRate >= BOUNCE_RED) {
      await flag('red', 'Echo', `Bounce rate ${(bounceRate * 100).toFixed(1)}% — pause Echo immediately.`);
    } else if (bounceRate >= BOUNCE_YELLOW) {
      await flag('yellow', 'Echo', `Bounce rate ${(bounceRate * 100).toFixed(1)}% — review before next send.`);
    }
  } catch (err) {
    console.error((err as Error).message);
  }

  // TODO once wired: domain reputation (MX Toolbox), engagement-rate drops
  // across LinkedIn/X/TikTok, Instantly sending velocity vs safe limits.

  await logAgentRun('Sentinel', 'evening', 'Risk sweep complete.');
}
