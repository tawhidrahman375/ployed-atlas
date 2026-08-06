import { remember } from '../src/mnemos.js';

// Fill in real YouTube channel IDs (the "UC..." string, found in a channel's
// page source or via https://commentpicker.com/youtube-channel-id.php).
// These are not secrets — no .env entry needed, just real values here.
const CHANNELS: Record<string, string> = {
  'Starter Story': '',
  'My First Million': '',
  'Greg Isenberg': '',
  'Alex Hormozi': '',
  "Lenny's Podcast": '',
  Superwall: '',
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
