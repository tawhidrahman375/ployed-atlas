import { ask } from '../lib/claude.js';
import { recall, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';
import { publishDocsPage } from '../lib/seoPublish.js';

const BUCKET = 'atlas-content';
const PAGES_PER_RUN = 2;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in response');
  }
  return JSON.parse(text.slice(start, end + 1)) as unknown[];
}

const SYSTEM =
  "You are Sage, Ployed's documentation agent. You write structured public documentation for " +
  'ployed.net/docs, aimed at AI automation agency owners, GHL agencies, web design agencies, and SMMA ' +
  'operators in the UK and Australia primarily (US/Canada content is informational only — Ployed does not ' +
  'offer AI voice calling there). Unlike a general SEO/marketing page, every doc page must be written for ' +
  'AI-search citation: open with a direct, self-contained answer to the query in the first paragraph (an AI ' +
  'engine or a skimming reader should get the full answer without reading further), then use clear ' +
  '`##`-level headers to break the rest into scannable sections. No fluff, no filler, no invented facts about ' +
  'Ployed or any competitor. Never publish anything that does not fully answer its own title.';

// Same dedup pattern as Muse's pickFreshKeywords, but against docs_pages —
// a prompt-level "don't repeat" is a suggestion, checking the actual slug
// namespace against what's already live is the enforcement.
async function pickFreshTopics(count: number): Promise<string[]> {
  const { data: existing, error } = await supabase.from('docs_pages').select('slug, title');
  if (error) throw error;
  const usedSlugs = new Set((existing ?? []).map((r) => r.slug as string));
  const usedTitles = (existing ?? []).map((r) => r.title as string);

  const [research, competitorIntel] = await Promise.all([
    recall('youtube_insights', 10),
    recall('competitor_intel', 10),
  ]);

  const raw = await ask(
    'quality',
    `${SYSTEM} You are picking documentation topics, not writing pages yet.`,
    `Research memory: ${JSON.stringify(research)}\nCompetitor intel: ${JSON.stringify(competitorIntel)}\n\n` +
      `Already-published doc topics (never repeat or closely rephrase any of these):\n${usedTitles.map((t) => `- ${t}`).join('\n') || '(none yet)'}\n\n` +
      `Propose ${count + 4} distinct documentation page topics — real questions a UK/AU AI-automation-agency ` +
      'owner would ask a search engine or an AI assistant (e.g. "how do AI automation agencies find clients", ' +
      '"what does an AI receptionist cost in the UK"). Prefer direct-answer question phrasing over generic ' +
      'marketing keywords. Respond with a JSON array of strings only, no prose, no markdown fences.'
  );

  const fresh: string[] = [];
  try {
    const candidates = extractJsonArray(raw) as string[];
    for (const topic of candidates) {
      const slug = slugify(topic);
      if (slug && !usedSlugs.has(slug) && !fresh.some((f) => slugify(f) === slug)) {
        fresh.push(topic);
        if (fresh.length >= count) break;
      }
    }
  } catch (err) {
    console.error('[Sage] Failed to parse topic candidates:', (err as Error).message);
  }
  return fresh;
}

// Archived to storage but not queued in content_queue (the dashboard's
// "ready to download" list) — docs pages auto-publish live via
// publishDocsPage below, so there's no manual download step for them.
async function saveDraft(title: string, body: string): Promise<string> {
  const objectPath = `docs_page/${Date.now()}-${slugify(title)}.md`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, `# ${title}\n\n${body}`, { contentType: 'text/markdown' });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return publicUrl.publicUrl;
}

export async function run(): Promise<{ pages: string[] } | null> {
  try {
    const topics = await pickFreshTopics(PAGES_PER_RUN);
    const pages: string[] = [];

    for (const topic of topics) {
      const body = await ask(
        'quality',
        `${SYSTEM} Write an 800-1500 word documentation page.`,
        `Topic: ${topic}\n\nOpen with a "# <clear title>" line, then the direct-answer opening paragraph, ` +
          'then structured `##` sections. Naturally mention Ployed once or twice where genuinely relevant, ' +
          'never as a hard pitch — this is documentation, not an SEO landing page.',
        4096 // 800-1500 words plus thinking overhead needs more than the 2048 default
      );

      await saveDraft(topic, body);
      const url = await publishDocsPage(topic, body);
      pages.push(url);
    }

    await logAgentRun('Sage', 'morning', `Produced ${pages.length} docs page(s) (published live).`, { pages: pages.length });
    return { pages };
  } catch (err) {
    console.error((err as Error).message);
    await logAgentRun('Sage', 'morning', `Docs page generation failed: ${(err as Error).message}`);
    return null;
  }
}
