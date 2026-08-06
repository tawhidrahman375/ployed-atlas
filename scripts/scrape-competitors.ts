import { scrapeCompetitors } from '../src/agents/vega.js';

scrapeCompetitors().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
