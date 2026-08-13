import { ask } from '../lib/claude.js';
import { recall, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';
import { publishSeoPage } from '../lib/seoPublish.js';
import { extractJsonArray } from '../lib/json.js';

const BUCKET = 'atlas-content';

// Uploaded to the public `atlas-content` Storage bucket (not local disk) so
// the dashboard's download links work from the phone, not just the machine
// that generated the file.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Picks SEO keyword targets that don't already have a published page, so
// Muse keeps expanding coverage instead of re-writing the same 1-2 pages
// forever. Checks against seo_pages by slug (the actual dedup key
// publishSeoPage upserts on) rather than trusting Claude's instruction not
// to repeat itself — a prompt-level "don't repeat" is a suggestion, this is
// the enforcement.
async function pickFreshKeywords(count: number, context: string, system: string): Promise<string[]> {
  const { data: existing, error } = await supabase.from('seo_pages').select('slug, title');
  if (error) throw error;
  const usedSlugs = new Set((existing ?? []).map((r) => r.slug as string));
  const usedTitles = (existing ?? []).map((r) => r.title as string);

  const raw = await ask(
    'quality',
    `${system} You are picking SEO keyword targets, not writing pages yet.`,
    `${context}\n\nAlready-published keyword targets (never repeat or closely rephrase any of these):\n${usedTitles.map((t) => `- ${t}`).join('\n') || '(none yet)'}\n\nPropose ${count + 4} distinct, high-intent SEO keyword targets (real search phrases a prospect would type into Google) Ployed could rank for. Respond with a JSON array of strings only, no prose, no markdown fences.`
  );

  const fresh: string[] = [];
  try {
    const candidates = extractJsonArray(raw) as string[];
    for (const kw of candidates) {
      const slug = slugify(kw);
      if (slug && !usedSlugs.has(slug) && !fresh.some((f) => slugify(f) === slug)) {
        fresh.push(kw);
        if (fresh.length >= count) break;
      }
    }
  } catch (err) {
    console.error('[Muse] Failed to parse keyword candidates:', (err as Error).message);
  }
  return fresh;
}

async function saveContent(type: string, title: string, body: string): Promise<string> {
  const objectPath = `${type}/${Date.now()}-${slugify(title)}.md`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, `# ${title}\n\n${body}`, { contentType: 'text/markdown' });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  const { error } = await supabase
    .from('content_queue')
    .insert({ type, title, file_path: publicUrl.publicUrl, status: 'ready' });
  if (error) throw error;

  return publicUrl.publicUrl;
}

export async function run() {
  const [platformRules, research, messaging] = await Promise.all([
    recall('platform_rules', 10),
    recall('youtube_insights', 10),
    recall('messaging', 10),
  ]);
  const context = `Platform rules: ${JSON.stringify(platformRules)}\nResearch: ${JSON.stringify(research)}\nMessaging that converts: ${JSON.stringify(messaging)}`;
  const system = "You are Muse, Ployed's content writer. Insight-led, no fluff, written for AI automation agency owners. Refuse to publish thin content.";

  const linkedin = await ask('quality', system, `${context}\n\nWrite one LinkedIn post.`);
  await saveContent('linkedin', 'LinkedIn post', linkedin);

  const xThread = await ask('quality', system, `${context}\n\nWrite one tactical X thread.`);
  await saveContent('x_thread', 'X thread', xThread);

  const seedKeywords = await pickFreshKeywords(2, context, system).catch((err: Error) => {
    console.error('[Muse] Keyword selection failed:', err.message);
    return [] as string[];
  });
  const seoPages: string[] = [];
  for (const keyword of seedKeywords) {
    const page = await ask(
      'quality',
      `${system} Write an 800-1500 word SEO page that fully answers the search intent, with a naturally embedded CTA for Ployed.`,
      `Keyword: ${keyword}\n${context}`,
      4096 // 800-1500 words plus thinking overhead needs more than the 2048 default
    );
    seoPages.push(await saveContent('seo_page', keyword, page));
    // Same-day, no manual step: goes live at ployed.net/resources/<slug>
    // right after Muse finishes writing it.
    await publishSeoPage(keyword, page);
  }

  await logAgentRun('Muse', 'morning', `Produced 1 LinkedIn post, 1 X thread, ${seoPages.length} SEO pages (published live).`, {
    seoPages: seoPages.length,
  });

  return { linkedin, xThread, seoPages };
}
