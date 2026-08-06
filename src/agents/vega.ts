import { remember, logAgentRun } from '../mnemos.js';
import { notWired } from '../lib/not-wired.js';

// Adjust to the real competitor domains once confirmed.
const COMPETITORS = ['clay.com', 'agensi.ai', 'gohighlevel.com', 'sitedrop.io'];
const SUBREDDITS = ['AIAssistants', 'automation', 'agency'];

async function scrapeCompetitor(domain: string): Promise<string> {
  // TODO: fetch the pricing/landing page and diff against the last snapshot
  // stored under the competitor_intel memory category. No key required.
  notWired('Vega', `scrape ${domain}`, 'N/A — implement fetch/parse');
}

async function pullSubredditTitles(subreddit: string): Promise<string[]> {
  const res = await fetch(`https://www.reddit.com/r/${subreddit}/new/.rss`);
  if (!res.ok) {
    throw new Error(`Reddit RSS fetch failed for r/${subreddit}: ${res.status}`);
  }
  const xml = await res.text();
  const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map((m) => m[1]);
  return titles.slice(1); // drop the feed's own title
}

export async function scrapeCompetitors() {
  const findings: Record<string, unknown> = {};
  for (const domain of COMPETITORS) {
    try {
      findings[domain] = await scrapeCompetitor(domain);
    } catch (err) {
      console.error((err as Error).message);
    }
  }
  await logAgentRun('Vega', 'github_actions', 'Competitor scrape complete.', findings);
  return findings;
}

export async function pullReddit() {
  const findings: Record<string, unknown> = {};
  for (const sub of SUBREDDITS) {
    try {
      const posts = await pullSubredditTitles(sub);
      await remember('competitor_intel', { source: `reddit:${sub}`, posts }, { source: 'Vega' });
      findings[`reddit:${sub}`] = posts.length;
    } catch (err) {
      console.error((err as Error).message);
    }
  }
  await logAgentRun('Vega', 'github_actions', 'Reddit sweep complete.', findings);
  return findings;
}

// Combined run, for local/manual testing — GitHub Actions calls the two
// functions above as separate workflow steps instead.
export async function run() {
  const competitors = await scrapeCompetitors();
  const reddit = await pullReddit();
  return { ...competitors, ...reddit };
}
