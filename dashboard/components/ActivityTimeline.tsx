import { AGENT_BY_NAME } from '../lib/agents';
import { timeAgo } from '../lib/format';

export interface LogRow {
  id: string;
  agent: string;
  session_type: string | null;
  summary: string | null;
  created_at: string;
}

export default function ActivityTimeline({ logs }: { logs: LogRow[] }) {
  if (!logs.length) {
    return <div className="empty-note">No agent activity logged yet.</div>;
  }

  return (
    <div className="timeline">
      {logs.map((log) => {
        const meta = AGENT_BY_NAME.get(log.agent);
        return (
          <div className="timeline-item" key={log.id}>
            <div className="timeline-rail">
              <span className="timeline-dot" style={{ background: meta?.color ?? 'var(--text-faint)' }} />
              <span className="timeline-line" />
            </div>
            <div className="timeline-body">
              <div className="timeline-head">
                <span className="timeline-agent" style={{ color: meta?.color }}>
                  {log.agent}
                </span>
                {log.session_type && <span className="badge-session">{log.session_type}</span>}
                <span className="timeline-time">{timeAgo(log.created_at)}</span>
              </div>
              <div className="timeline-summary">{log.summary}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
