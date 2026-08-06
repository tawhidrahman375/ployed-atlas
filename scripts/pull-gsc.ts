import { notWired } from '../src/lib/not-wired.js';

async function main() {
  // TODO: use the Search Console API (googleapis) with a service account,
  // write clicks/impressions/position per query to dashboard_metrics.
  await notWired('GSC collector', 'Search Console pull', 'GSC_CREDENTIALS_JSON');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
