import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ask } from '../lib/claude.js';
import { recall, logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';

const OUTPUT_DIR = path.resolve('output', 'content');

// NOTE: files are saved locally on whichever machine runs this (the VPS).
// The dashboard's download buttons need these uploaded to Supabase Storage
// to be reachable from the phone/browser — that upload is not wired yet.
// TODO: replace writeFile below with a supabase.storage.from(...).upload() call.
async function saveContent(type: string, title: string, body: string): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `${Date.now()}-${type}.md`);
  await writeFile(filePath, `# ${title}\n\n${body}`, 'utf-8');

  const { error } = await supabase
    .from('content_queue')
    .insert({ type, title, file_path: filePath, status: 'ready' });
  if (error) throw error;

  return filePath;
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
