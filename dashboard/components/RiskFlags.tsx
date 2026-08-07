import { timeAgo } from '../lib/format';
import { CheckCircleIcon } from './icons';

export interface RiskFlagRow {
  id: string;
  level: string;
  agent: string | null;
  message: string | null;
  created_at: string;
}

export default function RiskFlags({ flags }: { flags: RiskFlagRow[] }) {
  if (!flags.length) {
    return (
      <div className="all-clear">
        <CheckCircleIcon size={16} />
        All clear — no unresolved risk flags.
      </div>
    );
  }

  return (
    <div className="risk-list">
      {flags.map((f) => (
        <div className={`risk-item level-${f.level}`} key={f.id}>
          <div style={{ flex: 1 }}>
            {f.agent && <span className="risk-agent">[{f.agent}] </span>}
            {f.message}
          </div>
          <span className="risk-time">{timeAgo(f.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
