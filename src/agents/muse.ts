import { ask } from '../lib/claude.js';
import { recall, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';

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

  // TODO: replace with Nova's GSC-gap + competitor-keyword analysis output.
  const seedKeywords = ['best lead gen tool for AI automation agencies', 'Clay alternative for agencies'];
  const seoPages: string[] = [];
  for (const keyword of seedKeywords) {
    const page = await ask(
      'quality',
      `${system} Write an 800-1500 word SEO page that fully answers the search intent, with a naturally embedded CTA for Ployed.`,
      `Keyword: ${keyword}\n${context}`,
      4096 // 800-1500 words plus thinking overhead needs more than the 2048 default
    );
    seoPages.push(await saveContent('seo_page', keyword, page));
  }

  await logAgentRun('Muse', 'morning', `Produced 1 LinkedIn post, 1 X thread, ${seoPages.length} SEO pages.`, {
    seoPages: seoPages.length,
  });

  return { linkedin, xThread, seoPages };
}
