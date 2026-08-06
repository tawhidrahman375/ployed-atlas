import { remember } from '../src/mnemos.js';

// From the Ployed Marketing Agent — Master Plan doc in Notion.
// Verified against each channel's og:title on 2026-08-06 (source repo is
// public — no secrets here, just channel IDs).
const CHANNELS: Record<string, string> = {
  'Starter Story': 'UChhw6DlKKTQ9mYSpTfXUYqA',
  'My First Million': 'UCxoRKax_0vHaulMbceZtAwA',
  'Greg Isenberg': 'UCPjNBjflYl0-HQtUvOx0Ibw',
  'Alex Hormozi': 'UCrvchO1h6lWZAuGaa1LqX9Q',
  "Lenny's Podcast": 'UC6t1O76G0jYXOAoYCm153dA',
  Superwall: 'UCWWlrm9Y5ZjYzfi_H0caBhw',
};

async function latestVideoId(channelId: string): Promise<string | null> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!res.ok) return null;
  const xml = await res.text();
  return xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] ?? null;
}

async function main() {
  for (const [channel, channelId] of Object.entries(CHANNELS)) {
    if (!channelId) {
      console.warn(`Skipping ${channel} — no channel ID set in scripts/queue-youtube.ts yet.`);
      continue;
    }
    const videoId = await latestVideoId(channelId);
    if (!videoId) {
      console.warn(`No video found for ${channel}.`);
      continue;
    }
    await remember('youtube_insights', { videoId, channel, status: 'queued' }, { source: 'GitHubActions' });
    console.log(`Queued ${channel}: ${videoId}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
