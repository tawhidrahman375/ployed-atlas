import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ask } from '../lib/claude.js';
import { logAgentRun } from '../mnemos.js';
import { supabase } from '../lib/supabase.js';

const execFileAsync = promisify(execFile);
const MAX_PROMPT_CHARS = 1500;
// npm installs Windows CLI shims as `<name>.cmd`, which can only be spawned
// through a shell (Node throws EINVAL otherwise — .cmd isn't a native PE
// executable). On Windows, execFile's shell:true joins argv into one string
// for cmd.exe rather than escaping each argument, so any cmd.exe
// metacharacter in an arg could break out of its slot. The job id we pass is
// always our own UUID, safe either way — the prompt is AI-generated text, so
// it goes through sanitizeForShell() first to strip anything cmd.exe would
// treat specially, making shell:true safe here.
const HIGGSFIELD_BIN = process.platform === 'win32' ? 'higgsfield.cmd' : 'higgsfield';
const USE_SHELL = process.platform === 'win32';

function sanitizeForShell(input: string): string {
  return input
    .replace(/[&|<>^%"`\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// shell:true on Windows joins the args array into one string without adding
// quotes around anything (per Node's own deprecation warning), so a
// multi-word value here gets tokenized by cmd.exe into several positional
// args instead of one. sanitizeForShell() already stripped every `"` from
// the input, so wrapping it in quotes afterward can't be broken out of.
function quoteArg(arg: string): string {
  return `"${arg}"`;
}

interface HiggsfieldJob {
  id: string;
  status: 'in_progress' | 'completed' | 'failed' | string;
  result_url: string | null;
}

// Shells out to the `higgsfield` CLI (authenticated locally via `higgsfield
// auth login`) rather than calling the API directly — that's how the CLI's
// OAuth session works. Requires the CLI on PATH.
async function fireHiggsfield(prompt: string): Promise<string> {
  const safePrompt = sanitizeForShell(prompt).slice(0, MAX_PROMPT_CHARS);
  const promptArg = USE_SHELL ? quoteArg(safePrompt) : safePrompt;
  const { stdout } = await execFileAsync(
    HIGGSFIELD_BIN,
    ['generate', 'create', 'seedance_2_0', '--prompt', promptArg, '--aspect-ratio', '9:16', '--json'],
    { timeout: 60_000, shell: USE_SHELL }
  );
  const ids = JSON.parse(stdout) as string[];
  if (!ids[0]) throw new Error(`Unexpected higgsfield CLI output: ${stdout}`);
  return ids[0];
}

async function getHiggsfieldJob(jobId: string): Promise<HiggsfieldJob> {
  const { stdout } = await execFileAsync(HIGGSFIELD_BIN, ['generate', 'get', jobId, '--json'], {
    timeout: 30_000,
    shell: USE_SHELL,
  });
  return JSON.parse(stdout) as HiggsfieldJob;
}

export async function run(bestInsight: string | null) {
  if (!bestInsight) {
    await logAgentRun('Pixel', 'morning', "Skipped — no research insight from Nova today.");
    return null;
  }

  const concept = await ask(
    'quality',
    "You are Pixel, Ployed's creative agent. Turn a research insight into a short vertical video concept for AI automation agency owners. Hook must land in the first 1.5 seconds. Show don't tell. No stock-footage feel, no obvious AI voice. First line is the concept title. Everything after that is a single concrete visual prompt describing the shot — it feeds a text-to-video model directly, so describe what's on screen, not abstract ideas.",
    bestInsight
  );
  const [conceptLine, ...promptLines] = concept.split('\n');
  const visualPrompt = promptLines.join(' ').trim() || conceptLine;

  try {
    const jobId = await fireHiggsfield(visualPrompt);
    const { error } = await supabase
      .from('higgsfield_jobs')
      .insert({ job_id: jobId, concept: conceptLine, script: visualPrompt, status: 'processing' });
    if (error) throw error;
    await logAgentRun('Pixel', 'morning', `Fired Higgsfield job ${jobId}.`);
    return jobId;
  } catch (err) {
    console.error((err as Error).message);
    await supabase.from('higgsfield_jobs').insert({ concept: conceptLine, script: visualPrompt, status: 'failed' });
    await logAgentRun('Pixel', 'morning', 'Higgsfield generation failed — concept saved, no job fired.');
    return null;
  }
}

// Called from the evening block: video generation takes longer than a
// morning-block round, so jobs get fired in the morning and checked later.
export async function pollPendingJobs(): Promise<number> {
  const { data: pending, error } = await supabase
    .from('higgsfield_jobs')
    .select('id, job_id')
    .eq('status', 'processing')
    .not('job_id', 'is', null);
  if (error) throw error;

  let updated = 0;
  for (const row of pending ?? []) {
    try {
      const job = await getHiggsfieldJob(row.job_id as string);
      if (job.status === 'completed' && job.result_url) {
        await supabase.from('higgsfield_jobs').update({ status: 'complete', output_url: job.result_url }).eq('id', row.id);
        updated += 1;
      } else if (job.status === 'failed') {
        await supabase.from('higgsfield_jobs').update({ status: 'failed' }).eq('id', row.id);
        updated += 1;
      }
    } catch (err) {
      console.error(`[Pixel] poll failed for job ${row.job_id}:`, (err as Error).message);
    }
  }
  return updated;
}
