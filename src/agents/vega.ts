import { recall, remember, logAgentRun } from '../mnemos.js';

// Adjust to the real competitor domains once confirmed.
const COMPETITORS = ['clay.com', 'agensi.ai', 'gohighlevel.com', 'sitedrop.io'];
const SUBREDDITS = ['AIAssistants', 'automation', 'agency'];
const MAX_SNAPSHOT_CHARS = 8000;

interface CompetitorSnapshot {
  domain: string;
  type: 'snapshot';
  text: string;
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeCompetitor(domain: string): Promise<string> {
  const res = await fetch(`https://${domain}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Fetch failed for ${domain}: ${res.status}`);
  const text = extractText(await res.text()).slice(0, MAX_SNAPSHOT_CHARS);

  const previous = await recall('competitor_intel', 50);
  const lastSnapshot = previous
    .map((e) => e.content as unknown as CompetitorSnapshot)
    .find((c) => c?.domain === domain && c?.type === 'snapshot');
  const changed = !lastSnapshot || lastSnapshot.text !== text;

  await remember('competitor_intel', { domain, type: 'snapshot', text } satisfies CompetitorSnapshot, {
    source: 'Vega',
  });

  if (!lastSnapshot) return 'First snapshot taken.';
  return changed ? 'Changed since last check.' : 'No change since last check.';
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
