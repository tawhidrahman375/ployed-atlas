import { fetchRelevantLaunches } from '../src/lib/productHunt.js';
import { remember } from '../src/mnemos.js';

async function main() {
  const launches = await fetchRelevantLaunches();
  if (!launches.length) {
    console.log('No relevant Product Hunt launches in the last 24h.');
    return;
  }

  for (const launch of launches) {
    await remember(
      'competitor_intel',
      { source: 'producthunt', name: launch.name, tagline: launch.tagline, url: launch.url, topics: launch.topics },
      { source: 'ProductHunt' }
    );
  }
  console.log(`Logged ${launches.length} relevant launch(es): ${launches.map((l) => l.name).join(', ')}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
