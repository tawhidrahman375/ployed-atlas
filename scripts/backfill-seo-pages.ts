// One-off: publishes SEO pages Muse already generated before publishSeoPage()
// existed. Re-fetches each unique seo_page from content_queue's Storage URL
// (that file is `# keyword\n\n` + Claude's raw output, same shape saveContent
// always writes) and runs it through the same publish path new runs use.
import { supabase } from '../src/lib/supabase.js';
import { publishSeoPage } from '../src/lib/seoPublish.js';

interface ContentRow {
  id: string;
  title: string;
  file_path: string;
}

async function run() {
  const { data, error } = await supabase
    .from('content_queue')
    .select('id, title, file_path, created_at')
    .eq('type', 'seo_page')
    .eq('status', 'ready')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const latestByTitle = new Map<string, ContentRow>();
  for (const row of data ?? []) {
    if (!latestByTitle.has(row.title)) latestByTitle.set(row.title, row);
  }

  for (const row of latestByTitle.values()) {
    const res = await fetch(row.file_path);
    if (!res.ok) throw new Error(`Failed to fetch ${row.file_path}: ${res.status}`);
    const fileContents = await res.text();

    // Strip the `# {keyword}\n\n` wrapper saveContent() adds, leaving the
    // same raw Claude output publishSeoPage() expects from a live run.
    const unwrapped = fileContents.replace(/^#\s+.+?\n+/, '');

    const url = await publishSeoPage(row.title, unwrapped, row.id);
    console.log(`Published: ${row.title} -> ${url}`);
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
