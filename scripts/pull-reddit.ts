import { pullReddit } from '../src/agents/vega.js';

pullReddit().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
