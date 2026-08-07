import { YoutubeTranscript } from 'youtube-transcript';
import { ask } from '../lib/claude.js';
import { recall, remember, logAgentRun } from '../mnemos.js';

interface QueuedVideo {
  videoId: string;
  channel: string;
  status: 'queued' | 'processed';
}

const MAX_TRANSCRIPT_CHARS = 12000; // caps input tokens for long videos

async function fetchTranscript(videoId: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  const full = segments.map((s) => s.text).join(' ');
  return full.length > MAX_TRANSCRIPT_CHARS ? full.slice(0, MAX_TRANSCRIPT_CHARS) : full;
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
