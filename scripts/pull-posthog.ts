import { notWired } from '../src/lib/not-wired.js';

async function main() {
  // TODO: call the PostHog query/insights API, write feature usage and
  // drop-off data to dashboard_metrics.
  await notWired('PostHog collector', 'PostHog events pull', 'POSTHOG_API_KEY');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
