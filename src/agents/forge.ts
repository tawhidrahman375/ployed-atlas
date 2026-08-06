import { supabase } from '../lib/supabase.js';
import { remember, logAgentRun } from '../mnemos.js';

export async function proposeExperiment(hypothesis: string, testDesign: string, successMetric: string): Promise<void> {
  const { error } = await supabase
    .from('experiments')
    .insert({ hypothesis, test_design: testDesign, success_metric: successMetric, status: 'running' });
  if (error) throw error;
}

export async function getRunningExperiments() {
  const { data, error } = await supabase.from('experiments').select('*').eq('status', 'running');
  if (error) throw error;
  return data ?? [];
}

export async function concludeExperiment(id: string, result: string, conclusion: string): Promise<void> {
  const { error } = await supabase
    .from('experiments')
    .update({ status: 'complete', result, conclusion, completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await remember('experiment_results', { id, result, conclusion }, { source: 'Forge' });
}

export async function run() {
  const running = await getRunningExperiments();
  await logAgentRun('Forge', 'morning', `${running.length} experiments currently running.`, {
    running: running.length,
  });
  return running;
}
