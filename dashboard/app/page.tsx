import { supabase } from '../lib/supabase';

export const revalidate = 300; // 5 minutes

const AGENTS = ['Atlas', 'Mnemos', 'Nova', 'Vega', 'Apollo', 'Echo', 'Muse', 'Pixel', 'Pulse', 'Ledger', 'Sentinel', 'Forge'];

const STAGE_LABELS: Record<number, string> = {
  1: 'Stage 1 — First sale',
  2: 'Stage 2 — First sale → £1k',
  3: 'Stage 3 — £1k → £5k',
  4: 'Stage 4 — £5k → £10k',
  5: 'Stage 5 — £10k → £20k',
};

async function getMetric(name: string): Promise<string> {
  const { data } = await supabase
    .from('dashboard_metrics')
    .select('metric_value')
    .eq('metric_name', name)
    .maybeSingle();
  return data?.metric_value ?? '0';
}

function agentStatusEmoji(lastSeenIso: string | undefined): string {
  if (!lastSeenIso) return '⚪';
  const hoursSince = (Date.now() - new Date(lastSeenIso).getTime()) / 3_600_000;
  if (hoursSince < 24) return '🟢';
  if (hoursSince < 48) return '🟡';
  return '🔴';
}

function stageFromMrr(mrr: number): number {
  if (mrr >= 10000) return 5;
  if (mrr >= 5000) return 4;
  if (mrr >= 1000) return 3;
  if (mrr > 0) return 2;
  return 1;
}

export default async function Page() {
  const [mrrPence, emailsSent, leadsFound, gscClicks, gscImpressions] = await Promise.all([
    getMetric('mrr_pence'),
    getMetric('emails_sent_today'),
    getMetric('leads_found_today'),
    getMetric('gsc_clicks_today'),
    getMetric('gsc_impressions_today'),
  ]);
  const mrr = Number(mrrPence) / 100;
  const stage = stageFromMrr(mrr);

  const { data: logs } = await supabase
    .from('agent_logs')
    .select('agent, created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  const lastSeenByAgent = new Map<string, string>();
  for (const row of logs ?? []) {
    if (!lastSeenByAgent.has(row.agent)) lastSeenByAgent.set(row.agent, row.created_at);
  }

  const { data: risks } = await supabase
    .from('risk_flags')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false });
  const { data: content } = await supabase
    .from('content_queue')
    .select('*')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(20);
  const { data: jobs } = await supabase
    .from('higgsfield_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  const { data: experiments } = await supabase.from('experiments').select('*').eq('status', 'running');

  return (
    <main>
      <header>
        <h1>PLOYED GROWTH OS</h1>
        <span>{new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span>
      </header>

      <section className="hero">
        <h2>{STAGE_LABELS[stage]}</h2>
        <div className="mrr">MRR: £{mrr.toFixed(2)}</div>
      </section>

      <section>
        <h3>Agent status</h3>
        <div className="agent-grid">
          {AGENTS.map((agent) => (
            <span key={agent}>
              {agentStatusEmoji(lastSeenByAgent.get(agent))} {agent}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3>Today&rsquo;s numbers</h3>
        <div className="numbers-grid">
          <div>📧 Emails sent: {emailsSent}</div>
          <div>🔍 Leads found: {leadsFound}</div>
          <div>🌐 GSC clicks: {gscClicks}</div>
          <div>🌐 GSC impressions: {gscImpressions}</div>
        </div>
      </section>

      <section>
        <h3>Risk flags</h3>
        {!risks?.length && <div className="ok">🟢 All clear</div>}
        {risks?.map((r) => (
          <div key={r.id} className="risk">
            {r.level === 'red' ? '🔴' : r.level === 'yellow' ? '🟡' : '🟢'} [{r.agent}] {r.message}
          </div>
        ))}
      </section>

      <section>
        <h3>Content ready to download</h3>
        {!content?.length && <div>Nothing yet.</div>}
        <ul>
          {content?.map((c) => (
            <li key={c.id}>
              📄 {c.type}: {c.title} — <a href={c.file_path}>download</a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Higgsfield jobs</h3>
        {!jobs?.length && <div>None yet.</div>}
        <ul>
          {jobs?.map((j) => (
            <li key={j.id}>
              🎬 {j.concept ?? j.job_id} — {j.status}
              {j.status === 'complete' && j.output_url ? (
                <>
                  {' '}
                  — <a href={j.output_url}>download</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Active experiments (Forge)</h3>
        {!experiments?.length && <div>None running.</div>}
        <ul>
          {experiments?.map((e) => (
            <li key={e.id}>🧪 {e.hypothesis}</li>
          ))}
        </ul>
      </section>

      <footer>
        <p>Auto-refreshes every 5 minutes. No login — this URL is the security boundary, keep it private.</p>
      </footer>
    </main>
  );
}
