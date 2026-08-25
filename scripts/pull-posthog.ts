// Standalone GitHub Actions step — same situation as pull-gsc.ts: a real
// PostHog implementation already existed in pulse.ts, this stub just never
// called it despite the workflow already passing POSTHOG_API_KEY in.
import { pullPostHog } from '../src/agents/pulse.js';
import { setMetric } from '../src/lib/metrics.js';

async function main() {
  const { eventsToday } = await pullPostHog();
  await setMetric('posthog_events_today', eventsToday);
  console.log(`PostHog: ${eventsToday} events today.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
