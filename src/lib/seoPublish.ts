import { supabase } from './supabase.js';

const SITE_URL = 'https://ployed.net';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function deriveExcerpt(markdown: string, maxLen = 155): string {
  const plain = markdown
    .replace(/^#+\s+.*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  const cut = plain.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen)}…`;
}

// Claude's raw output already opens with its own `# Headline` — pull that
// out as the page title instead of showing it twice (once as an <h1>, once
// as the first line of the rendered body).
function parseSeoBody(raw: string): { title: string; bodyMarkdown: string; description: string } {
  const match = raw.match(/^#\s+(.+?)\s*\n+([\s\S]*)$/);
  const title = match ? match[1].trim() : raw.split('\n')[0].slice(0, 80);
  const rest = (match ? match[2] : raw).trim();
  return { title, bodyMarkdown: rest, description: deriveExcerpt(rest) };
}

// Upserts on slug (derived from the target keyword, not the generated
// headline) so re-running the same keyword refreshes the same live URL
// instead of piling up duplicate pages.
export async function publishSeoPage(keyword: string, rawBody: string, contentQueueId?: string): Promise<string> {
  const slug = slugify(keyword);
  const { title, bodyMarkdown, description } = parseSeoBody(rawBody);

  const { error } = await supabase.from('seo_pages').upsert(
    {
      slug,
      title,
      meta_description: description,
      body_markdown: bodyMarkdown,
      content_queue_id: contentQueueId ?? null,
      published: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug' }
  );
  if (error) throw error;

  return `${SITE_URL}/resources/${slug}`;
}
