import { formatNumber } from '../lib/format';

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'queued', label: 'Queued', color: 'var(--text-faint)' },
  { key: 'emailed', label: 'Emailed', color: 'var(--cyan)' },
  { key: 'replied', label: 'Replied', color: 'var(--accent)' },
  { key: 'converted', label: 'Converted', color: 'var(--green)' },
  { key: 'dead', label: 'Dead', color: 'var(--red)' },
];

export default function LeadFunnel({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...STAGES.map((s) => counts[s.key] ?? 0));
  const total = STAGES.reduce((sum, s) => sum + (counts[s.key] ?? 0), 0);

  if (total === 0) {
    return <div className="empty-note">No leads in the queue yet.</div>;
  }

  return (
    <div className="funnel">
      {STAGES.map((s) => {
        const count = counts[s.key] ?? 0;
        const pct = (count / max) * 100;
        return (
          <div className="funnel-row" key={s.key}>
            <span className="funnel-label">{s.label}</span>
            <span className="funnel-bar-track">
              <span className="funnel-bar-fill" style={{ width: `${pct}%`, background: s.color }} />
            </span>
            <span className="funnel-count">{formatNumber(count)}</span>
          </div>
        );
      })}
    </div>
  );
}
