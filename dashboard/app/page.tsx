import { supabase } from '../lib/supabase';
import { AGENTS } from '../lib/agents';
import LiveClock from '../components/LiveClock';
import Hero from '../components/Hero';
import AgentFleet, { type AgentActivity } from '../components/AgentFleet';
import StatGrid from '../components/StatGrid';
import LeadFunnel from '../components/LeadFunnel';
import RiskFlags from '../components/RiskFlags';
import ContentFeed from '../components/ContentFeed';
import SlideshowGrid from '../components/SlideshowGrid';
import ExperimentsList from '../components/ExperimentsList';
import ActivityTimeline from '../components/ActivityTimeline';
import {
  AlertTriangleIcon,
  ClockIcon,
  FileTextIcon,
  ImagesIcon,
  FlaskIcon,
  SearchIcon,
  TrendingUpIcon,
} from '../components/icons';

export const revalidate = 300; // 5 minutes

function metricMap(rows: { metric_name: string; metric_value: string | null }[] | null): Map<string, string> {
  return new Map((rows ?? []).map((r) => [r.metric_name, r.metric_value ?? '0']));
}

export default async function Page() {
  const [{ data: metricsRows }, { data: logs }, { data: risks }, { data: content }, { data: slideshows }, { data: experiments }, { data: leadStatuses }, { data: memoryRows }] =
    await Promise.all([
      supabase.from('dashboard_metrics').select('metric_name, metric_value'),
      supabase.from('agent_logs').select('id, agent, session_type, summary, created_at').order('created_at', { ascending: false }).limit(300),
      supabase.from('risk_flags').select('*').eq('resolved', false).order('created_at', { ascending: false }),
      supabase.from('content_queue').select('*').eq('status', 'ready').order('created_at', { ascending: false }).limit(150),
      supabase.from('slideshows').select('*').order('created_at', { ascending: false }).limit(9),
      supabase.from('experiments').select('*').order('started_at', { ascending: false }).limit(20),
      supabase.from('lead_queue').select('status').limit(5000),
      supabase.from('agent_memory').select('category').limit(5000),
    ]);

  const metrics = metricMap(metricsRows);
  const mrr = Number(metrics.get('mrr_pence') ?? 0) / 100;

  // Last-seen + last-summary per agent, from the most recent 300 log rows.
  const activityByAgent = new Map<string, AgentActivity>();
  for (const row of logs ?? []) {
    if (!activityByAgent.has(row.agent)) {
      activityByAgent.set(row.agent, { lastSeen: row.created_at, lastSummary: row.summary ?? undefined });
    }
  }

  const leadCounts: Record<string, number> = {};
  for (const row of leadStatuses ?? []) {
    leadCounts[row.status] = (leadCounts[row.status] ?? 0) + 1;
  }

  const memoryCounts = new Map<string, number>();
  for (const row of memoryRows ?? []) {
    memoryCounts.set(row.category, (memoryCounts.get(row.category) ?? 0) + 1);
  }
  const memoryCategories = [...memoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const nowIso = new Date().toISOString();

  return (
    <main className="page">
      <div className="top-bar">
        <div className="brand">
          <span className="brand-mark">PLOYED GROWTH OS</span>
          <span className="brand-sub">ATLAS · {AGENTS.length} agents</span>
        </div>
        <div className="top-bar-right">
          <span className="live-pill">
            <span className="live-pill-dot" />
            Live
          </span>
          <LiveClock initial={new Date(nowIso).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'} />
        </div>
      </div>

      <Hero mrr={mrr} />

      <section className="section">
        <div className="section-head">
          <div className="section-title-group">
            <h3 className="section-title">Agent fleet</h3>
          </div>
          <span className="section-sub">green = active &lt;24h · amber = stale · cyan = always-on</span>
        </div>
        <AgentFleet activityByAgent={activityByAgent} memoryCategories={memoryCategories} />
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title-group">
            <span className="section-icon">
              <TrendingUpIcon size={15} />
            </span>
            <h3 className="section-title">Today&rsquo;s numbers</h3>
          </div>
        </div>
        <StatGrid
          emailsSent={Number(metrics.get('emails_sent_today') ?? 0)}
          leadsFound={Number(metrics.get('leads_found_today') ?? 0)}
          gscClicks={Number(metrics.get('gsc_clicks_today') ?? 0)}
          gscImpressions={Number(metrics.get('gsc_impressions_today') ?? 0)}
          posthogEvents={Number(metrics.get('posthog_events_today') ?? 0)}
          instantlyBounced={Number(metrics.get('instantly_bounced_today') ?? 0)}
          instantlyReplies={Number(metrics.get('instantly_replies_today') ?? 0)}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title-group">
            <span className="section-icon">
              <SearchIcon size={15} />
            </span>
            <h3 className="section-title">Lead pipeline</h3>
          </div>
        </div>
        <LeadFunnel counts={leadCounts} />
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title-group">
            <span className="section-icon">
              <AlertTriangleIcon size={15} />
            </span>
            <h3 className="section-title">Risk flags</h3>
          </div>
        </div>
        <RiskFlags flags={risks ?? []} />
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title-group">
            <span className="section-icon">
              <FileTextIcon size={15} />
            </span>
            <h3 className="section-title">Content ready to download</h3>
          </div>
        </div>
        <ContentFeed rows={content ?? []} />
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title-group">
            <span className="section-icon">
              <ImagesIcon size={15} />
            </span>
            <h3 className="section-title">Slideshows</h3>
          </div>
        </div>
        <SlideshowGrid slideshows={slideshows ?? []} />
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title-group">
            <span className="section-icon">
              <FlaskIcon size={15} />
            </span>
            <h3 className="section-title">Active experiments (Forge)</h3>
          </div>
        </div>
        <ExperimentsList experiments={experiments ?? []} />
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title-group">
            <span className="section-icon">
              <ClockIcon size={15} />
            </span>
            <h3 className="section-title">Activity</h3>
          </div>
          <span className="section-sub">most recent 15 runs</span>
        </div>
        <ActivityTimeline logs={(logs ?? []).slice(0, 15)} />
      </section>

      <footer className="footer">
        <p>Auto-refreshes every 5 minutes. No login — this URL is the security boundary, keep it private.</p>
        <p>
          <a href="https://github.com/tawhidrahman375/ployed-atlas">ployed-atlas on GitHub</a>
        </p>
      </footer>
    </main>
  );
}
