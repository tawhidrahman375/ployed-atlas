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

interface ScoredInsight {
  score: number;
  text: string;
}

// Extraction opens with a self-scored "RELEVANCE: N" line so run() can pick
// the actual best insight of the batch instead of whichever video happened
// to be queued first.
function parseScoredExtraction(raw: string): ScoredInsight {
  const match = raw.match(/^RELEVANCE:\s*(\d+)\s*\n+([\s\S]*)$/i);
  if (!match) return { score: 0, text: raw.trim() };
  return { score: Number(match[1]), text: match[2].trim() };
}

export async function run(): Promise<string | null> {
  const queued = await getQueuedVideos();
  const insights: ScoredInsight[] = [];

  for (const video of queued) {
    const transcript = await fetchTranscript(video.videoId).catch((err: Error) => {
      console.error(err.message);
      return null;
    });
    if (!transcript) continue;

    const extraction = await ask(
      'bulk',
      "You are Nova, Ployed's research agent. Ployed sells prospecting/lead-gen software to AI automation agencies. Extract only tactics relevant to that: distribution, pricing psychology, cold email, community-led growth, and what flopped. Be specific and concise. Start your response with exactly one line 'RELEVANCE: <0-10>' scoring how directly useful this is to Ployed's GTM (0 = nothing applicable, 10 = immediately actionable), then a blank line, then the analysis.",
      `Transcript from ${video.channel}:\n\n${transcript}`
    );

    await remember(
      'youtube_insights',
      { ...video, status: 'processed', extraction },
      { source: 'Nova' }
    );
    insights.push(parseScoredExtraction(extraction));
  }

  await logAgentRun('Nova', 'morning', `Processed ${queued.length} queued videos.`, {
    processed: queued.length,
  });

  if (!insights.length) return null;
  const best = insights.reduce((a, b) => (b.score > a.score ? b : a));
  return best.text; // best-of-day insight, handed to Pixel
}
