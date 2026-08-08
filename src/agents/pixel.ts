import { ask } from '../lib/claude.js';
import { logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';
import { searchBackgroundPhoto } from '../lib/pexels.js';
import { renderSlide } from '../lib/slideRenderer.js';

const BUCKET = 'atlas-content';

type Format = 'tools_list' | 'pain_hook';

const SYSTEM =
  "You are Pixel, Ployed's creative agent. You write TikTok slideshow copy for AI automation agency owners, " +
  'GHL agencies, web design agencies, and SMMA operators running under 5 clients — this audience knows these ' +
  'pains immediately, so be specific and concrete, never generic. Voice: plain, direct, lowercase-casual is ' +
  'fine, no corporate fluff, no emojis, no em dashes. ' +
  `The current year is ${new Date().getFullYear()} — if any copy references a year, it must be this one. ` +
  'Respond with STRICT JSON only — no markdown code fences, no commentary before or after.';

// Real tool copy — the reveal slide is always Ployed describing itself, so
// it's hardcoded with the exact copy rather than left to the model, which
// guarantees it's always accurate and on-brand.
const PLOYED_BLURB_TOOLS =
  'Finds leads, researches them, builds the pitch script, handles post-call logging.\n\nEverything except the sales call.';
const CTA_TOOLS_LIST = 'Full list in bio.\nployed.net';
const PLOYED_STATEMENT_PAIN = 'One platform.\nEverything handled.';
const CTA_PAIN_HOOK = 'ployed.net\n14-day free trial';

const BACKGROUND_QUERIES = [
  'moody apartment interior night',
  'laptop desk dark aesthetic',
  'yacht luxury night',
  'minimalist home office dark',
  'city skyline window night',
  'penthouse view night',
  'leather armchair dark interior',
  'modern kitchen night lighting',
];

function randomQuery(): string {
  return BACKGROUND_QUERIES[Math.floor(Math.random() * BACKGROUND_QUERIES.length)];
}

function cap(str: string, maxChars: number): string {
  const trimmed = (str ?? '').trim();
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1).trim()}…` : trimmed;
}

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/```$/, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

async function nextFormat(): Promise<Format> {
  const { data } = await supabase
    .from('slideshows')
    .select('format')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return 'tools_list';
  return data.format === 'tools_list' ? 'pain_hook' : 'tools_list';
}

interface ToolItem {
  name: string;
  blurb: string;
}

interface ToolsListContent {
  hook: string;
  tools: ToolItem[];
  caption: string;
  hashtags: string;
}

interface PainPoint {
  title: string;
  caption: string;
}

interface PainHookContent {
  hook: string;
  painPoints: PainPoint[];
  caption: string;
  hashtags: string;
}

async function generateToolsListContent(recentTools: string[]): Promise<ToolsListContent> {
  const avoid = recentTools.length ? ` Avoid repeating these recently-used tools: ${recentTools.join(', ')}.` : '';
  const raw = await ask(
    'quality',
    SYSTEM,
    'Write a "tools I use" TikTok slideshow for this audience. Pick exactly 3 REAL, well-known tools this ' +
      'audience already uses and trusts — vary the categories (e.g. one outreach/cold-email tool, one ' +
      `automation/workflow tool, one AI or CRM or scheduling tool). Never include Ployed in this list, it's ` +
      `revealed separately.${avoid}\n\n` +
      'For each tool: a short name and a one-line description of what it does (max 12 words).\n\n' +
      'Then write a hook headline for slide 1. There will be exactly 4 numbered items total in this ' +
      'slideshow (your 3 tools plus one more revealed at the end) — if the hook references a number, it must ' +
      'say 4, not any other number. Under 9 words, casual tone is fine.\n\n' +
      'Also write a TikTok caption (1-2 sentences) and 5-8 relevant hashtags for the AI-automation-agency / ' +
      'SMMA space.\n\n' +
      'Return strict JSON: {"hook": string, "tools": [{"name": string, "blurb": string}, ...exactly 3], ' +
      '"caption": string, "hashtags": string (space-separated, each starting with #)}'
  );
  const parsed = parseJson<ToolsListContent>(raw);
  if (!Array.isArray(parsed.tools) || parsed.tools.length < 3) {
    throw new Error(`Pixel: expected 3 tools from Claude, got ${parsed.tools?.length ?? 0}`);
  }
  return {
    ...parsed,
    hook: cap(parsed.hook, 90),
    tools: parsed.tools.slice(0, 3).map((t) => ({ name: cap(t.name, 40), blurb: cap(t.blurb, 130) })),
  };
}

async function generatePainHookContent(): Promise<PainHookContent> {
  const raw = await ask(
    'quality',
    SYSTEM,
    'Write a "pain point" TikTok slideshow for this audience. Slide 1 is a hook stating the core pain: AI ' +
      'automation agency owners manually stitching together multiple disconnected tools. Under 12 words, no ' +
      'mention of Ployed or any specific product.\n\n' +
      'Then write exactly 3 specific, concrete pains this audience feels day to day:\n' +
      "1. no real intel on a prospect's website/company before calling them\n" +
      '2. no personalized pitch script per prospect, just generic talking points\n' +
      '3. manual post-call logging with no real pipeline tracking\n\n' +
      'For each: a short punchy title (under 8 words) and a one-line elaboration caption (under 14 words).\n\n' +
      "Also write a TikTok caption (1-2 sentences, builds curiosity, don't mention Ployed since the reveal is " +
      'visual) and 5-8 relevant hashtags for the AI-automation-agency / SMMA space.\n\n' +
      'Return strict JSON: {"hook": string, "painPoints": [{"title": string, "caption": string}, ...exactly ' +
      '3], "caption": string, "hashtags": string (space-separated, each starting with #)}'
  );
  const parsed = parseJson<PainHookContent>(raw);
  if (!Array.isArray(parsed.painPoints) || parsed.painPoints.length < 3) {
    throw new Error(`Pixel: expected 3 pain points from Claude, got ${parsed.painPoints?.length ?? 0}`);
  }
  return {
    ...parsed,
    hook: cap(parsed.hook, 90),
    painPoints: parsed.painPoints.slice(0, 3).map((p) => ({ title: cap(p.title, 60), caption: cap(p.caption, 100) })),
  };
}

async function buildToolsListSlides(
  content: ToolsListContent,
  recentPhotoIds: Set<string>
): Promise<{ buffers: Buffer[]; photoIds: string[] }> {
  const photoIds: string[] = [];
  const used = new Set(recentPhotoIds);

  const bg1 = await searchBackgroundPhoto(randomQuery(), used);
  used.add(bg1.id);
  photoIds.push(bg1.id);
  const slide1 = await renderSlide(bg1.buffer, 'statement', { title: content.hook });

  const toolSlides: Buffer[] = [];
  for (let i = 0; i < content.tools.length; i++) {
    const bg = await searchBackgroundPhoto(randomQuery(), used);
    used.add(bg.id);
    photoIds.push(bg.id);
    const tool = content.tools[i];
    toolSlides.push(await renderSlide(bg.buffer, 'tool', { title: `${i + 1}. ${tool.name}`, caption: tool.blurb }));
  }

  const bgPloyed = await searchBackgroundPhoto(randomQuery(), used);
  used.add(bgPloyed.id);
  photoIds.push(bgPloyed.id);
  const ployedSlide = await renderSlide(bgPloyed.buffer, 'tool', {
    title: `${content.tools.length + 1}. Ployed`,
    caption: PLOYED_BLURB_TOOLS,
  });

  const bg6 = await searchBackgroundPhoto(randomQuery(), used);
  used.add(bg6.id);
  photoIds.push(bg6.id);
  const slide6 = await renderSlide(bg6.buffer, 'statement', { title: CTA_TOOLS_LIST });

  return { buffers: [slide1, ...toolSlides, ployedSlide, slide6], photoIds };
}

async function buildPainHookSlides(
  content: PainHookContent,
  recentPhotoIds: Set<string>
): Promise<{ buffers: Buffer[]; photoIds: string[] }> {
  const photoIds: string[] = [];
  const used = new Set(recentPhotoIds);

  const bg1 = await searchBackgroundPhoto(randomQuery(), used);
  used.add(bg1.id);
  photoIds.push(bg1.id);
  const slide1 = await renderSlide(bg1.buffer, 'statement', { title: content.hook });

  const painSlides: Buffer[] = [];
  for (const point of content.painPoints) {
    const bg = await searchBackgroundPhoto(randomQuery(), used);
    used.add(bg.id);
    photoIds.push(bg.id);
    painSlides.push(await renderSlide(bg.buffer, 'tool', { title: point.title, caption: point.caption }));
  }

  const bgPloyed = await searchBackgroundPhoto(randomQuery(), used);
  used.add(bgPloyed.id);
  photoIds.push(bgPloyed.id);
  const ployedSlide = await renderSlide(bgPloyed.buffer, 'statement', { title: PLOYED_STATEMENT_PAIN });

  const bg6 = await searchBackgroundPhoto(randomQuery(), used);
  used.add(bg6.id);
  photoIds.push(bg6.id);
  const slide6 = await renderSlide(bg6.buffer, 'statement', { title: CTA_PAIN_HOOK });

  return { buffers: [slide1, ...painSlides, ployedSlide, slide6], photoIds };
}

async function uploadSlide(runId: number, format: Format, index: number, buffer: Buffer): Promise<string> {
  const objectPath = `slideshow/${runId}-${format}-slide-${index}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, { contentType: 'image/png' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

async function uploadCaption(runId: number, format: Format, body: string): Promise<string> {
  const objectPath = `slideshow/${runId}-${format}-caption.txt`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, body, { contentType: 'text/plain' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

async function saveSlideshow(
  format: Format,
  hook: string,
  buffers: Buffer[],
  photoIds: string[],
  toolsUsed: string[],
  caption: string,
  hashtags: string
): Promise<string> {
  const runId = Date.now();
  const urls = await Promise.all(buffers.map((buf, i) => uploadSlide(runId, format, i + 1, buf)));
  const captionUrl = await uploadCaption(runId, format, `${caption}\n\n${hashtags}`);

  const { error } = await supabase.from('slideshows').insert({
    format,
    hook,
    slide_urls: urls,
    caption,
    hashtags,
    caption_url: captionUrl,
    photo_ids: photoIds,
    tools_used: toolsUsed,
    status: 'ready',
  });
  if (error) throw error;

  return captionUrl;
}

export async function run(): Promise<string | null> {
  const format = await nextFormat();
  const { data: recent } = await supabase
    .from('slideshows')
    .select('photo_ids, tools_used')
    .order('created_at', { ascending: false })
    .limit(6);
  const recentPhotoIds = new Set((recent ?? []).flatMap((r) => (r.photo_ids as string[] | null) ?? []));
  const recentTools = (recent ?? []).flatMap((r) => (r.tools_used as string[] | null) ?? []);

  try {
    if (format === 'tools_list') {
      const content = await generateToolsListContent(recentTools);
      const { buffers, photoIds } = await buildToolsListSlides(content, recentPhotoIds);
      await saveSlideshow(
        format,
        content.hook,
        buffers,
        photoIds,
        content.tools.map((t) => t.name),
        content.caption,
        content.hashtags
      );
      await logAgentRun('Pixel', 'morning', `Produced tools-list slideshow: "${content.hook}"`);
      return content.hook;
    }

    const content = await generatePainHookContent();
    const { buffers, photoIds } = await buildPainHookSlides(content, recentPhotoIds);
    await saveSlideshow(format, content.hook, buffers, photoIds, [], content.caption, content.hashtags);
    await logAgentRun('Pixel', 'morning', `Produced pain-hook slideshow: "${content.hook}"`);
    return content.hook;
  } catch (err) {
    console.error((err as Error).message);
    await logAgentRun('Pixel', 'morning', `Slideshow generation failed: ${(err as Error).message}`);
    return null;
  }
}
