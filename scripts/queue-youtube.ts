import { recall, remember } from '../src/mnemos.js';

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

// YouTube's channel RSS returns the 15 most recent uploads, not just one —
// grab all of them per channel so a backlog of unprocessed videos doesn't
// silently cap Nova at "1 video from 1 channel found new today."
const MAX_VIDEOS_PER_CHANNEL = 5;

async function recentVideoIds(channelId: string): Promise<string[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<yt:videoId>(.*?)<\/yt:videoId>/g)].map((m) => m[1]).slice(0, MAX_VIDEOS_PER_CHANNEL);
}

async function main() {
  // Every videoId ever queued or processed, across all channels, so re-runs
  // never re-queue something Nova already looked at.
  const seen = new Set((await recall('youtube_insights', 500)).map((e) => (e.content as { videoId?: string })?.videoId).filter(Boolean));

  for (const [channel, channelId] of Object.entries(CHANNELS)) {
    if (!channelId) {
      console.warn(`Skipping ${channel} — no channel ID set in scripts/queue-youtube.ts yet.`);
      continue;
    }
    const videoIds = await recentVideoIds(channelId);
    if (!videoIds.length) {
      console.warn(`No videos found for ${channel}.`);
      continue;
    }
    let queued = 0;
    for (const videoId of videoIds) {
      if (seen.has(videoId)) continue;
      await remember('youtube_insights', { videoId, channel, status: 'queued' }, { source: 'GitHubActions' });
      seen.add(videoId);
      queued += 1;
    }
    console.log(`${channel}: ${queued} new of ${videoIds.length} recent videos queued.`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
