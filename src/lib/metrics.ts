import { supabase } from './supabase.js';

// Shared by every agent that writes to dashboard_metrics (Pulse, Ledger, and
// the standalone collector scripts) so the upsert shape only lives in one place.
export async function setMetric(name: string, value: string | number): Promise<void> {
  const { error } = await supabase
    .from('dashboard_metrics')
    .upsert(
      { metric_name: name, metric_value: String(value), updated_at: new Date().toISOString() },
      { onConflict: 'metric_name' }
    );
  if (error) throw error;
}
