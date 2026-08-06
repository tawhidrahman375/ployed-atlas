import { ask } from '../lib/claude.js';
import { recall, remember, logAgentRun } from '../mnemos.js';
import { notWired } from '../lib/not-wired.js';

interface QueuedVideo {
  videoId: string;
  channel: string;
  status: 'queued' | 'processed';
}

async function fetchTranscript(videoId: string): Promise<string> {
  // TODO: wire up e.g. the `youtube-transcript` npm package. No API key needed,
  // just an implementation — GitHub Actions queues the videoIds overnight.
  notWired('Nova', `transcript fetch for ${videoId}`, 'N/A — implement the fetch itself');
}

async function getQueuedVideos(): Promise<QueuedVideo[]> {
  const entries = await recall('youtube_insights', 50);
  return entries
    .map((e) => e.content as unknown as QueuedVideo)
    .filter((v) => v?.status === 'queued');
}

export async function run(): Promise<string | null> {
  const queued = await getQueuedVideos();
  const insights: string[] = [];

  for (const video of queued) {
    const transcript = await fetchTranscript(video.videoId).catch((err: Error) => {
      console.error(err.message);
      return null;
    });
    if (!transcript) continue;

    const extraction = await ask(
      'bulk',
      "You are Nova, Ployed's research agent. Ployed sells prospecting/lead-gen software to AI automation agencies. Extract only tactics relevant to that: distribution, pricing psychology, cold email, community-led growth, and what flopped. Be specific and concise.",
      `Transcript from ${video.channel}:\n\n${transcript}`
    );

    await remember(
      'youtube_insights',
      { ...video, status: 'processed', extraction },
      { source: 'Nova' }
    );
    insights.push(extraction);
  }

  await logAgentRun('Nova', 'morning', `Processed ${queued.length} queued videos.`, {
    processed: queued.length,
  });

  return insights[0] ?? null; // best-of-day insight, handed to Pixel
}
