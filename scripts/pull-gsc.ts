// Standalone GitHub Actions step. This used to be a notWired() stub even
// though a real GSC implementation already existed in pulse.ts (and the
// workflow was already passing GSC_CREDENTIALS_JSON into this exact step) —
// it just never called it. Delegates to the same pull Pulse uses in the
// morning/evening blocks so there's one GSC implementation, not two.
import { pullGSC } from '../src/agents/pulse.js';
import { setMetric } from '../src/lib/metrics.js';

async function main() {
  const { clicks, impressions } = await pullGSC();
  await setMetric('gsc_clicks_today', clicks);
  await setMetric('gsc_impressions_today', impressions);
  console.log(`GSC: ${clicks} clicks, ${impressions} impressions today.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
