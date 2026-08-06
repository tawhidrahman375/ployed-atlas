import { ask } from '../lib/claude.js';
import { logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';
import { notWired } from '../lib/not-wired.js';

async function fireHiggsfield(_concept: string, _script: string): Promise<{ jobId: string }> {
  // TODO: call the Higgsfield MCP tool via Composio.
  notWired('Pixel', 'Higgsfield generation', 'HIGGSFIELD_API_KEY');
}

export async function run(bestInsight: string | null) {
  if (!bestInsight) {
    await logAgentRun('Pixel', 'morning', "Skipped — no research insight from Nova today.");
    return null;
  }

  const concept = await ask(
    'quality',
    "You are Pixel, Ployed's creative agent. Turn a research insight into a 45-75s TikTok/Reels concept for AI automation agency owners. Hook must land in the first 1.5 seconds. Show don't tell. No stock-footage feel, no obvious AI voice. First line is the concept title, the rest is the script.",
    bestInsight
  );
  const [conceptLine, ...scriptLines] = concept.split('\n');
  const script = scriptLines.join('\n').trim();

  try {
    const { jobId } = await fireHiggsfield(conceptLine, script);
    const { error } = await supabase
      .from('higgsfield_jobs')
      .insert({ job_id: jobId, concept: conceptLine, script, status: 'processing' });
    if (error) throw error;
    await logAgentRun('Pixel', 'morning', `Fired Higgsfield job ${jobId}.`);
    return jobId;
  } catch (err) {
    console.error((err as Error).message);
    await supabase.from('higgsfield_jobs').insert({ concept: conceptLine, script, status: 'failed' });
    await logAgentRun('Pixel', 'morning', 'Higgsfield not wired — concept saved, no job fired.');
    return null;
  }
}
