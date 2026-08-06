import { notWired } from '../src/lib/not-wired.js';

async function main() {
  // TODO: call the Product Hunt GraphQL API, filter to automation/agency
  // category launches, write findings to competitor_intel memory.
  await notWired('Product Hunt collector', 'Product Hunt launch check', 'PRODUCTHUNT_API_TOKEN');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
