import { supabase } from '../lib/supabase.js';
import { logAgentRun } from '../mnemos.js';
import { notWired } from '../lib/not-wired.js';

const BOUNCE_YELLOW = 0.03;
const BOUNCE_RED = 0.05;

async function getInstantlyBounceRate(): Promise<number> {
  notWired('Sentinel', 'Instantly bounce rate check', 'INSTANTLY_API_KEY');
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
