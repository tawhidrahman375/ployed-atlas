import { timeAgo } from '../lib/format';
import { DownloadIcon } from './icons';

export interface HiggsfieldJobRow {
  id: string;
  job_id: string | null;
  concept: string | null;
  status: string;
  output_url: string | null;
  created_at: string;
}

export default function JobsGrid({ jobs }: { jobs: HiggsfieldJobRow[] }) {
  if (!jobs.length) {
    return <div className="empty-note">No Higgsfield jobs yet.</div>;
  }

  return (
    <div className="jobs-grid">
      {jobs.map((j) => (
        <div className="job-card" key={j.id}>
          <div className="job-title">{j.concept ?? j.job_id ?? 'Untitled job'}</div>
          <div className="job-meta">
            <span className={`status-pill ${j.status}`}>
              <span className="status-pill-dot" />
              {j.status}
            </span>
            <span>{timeAgo(j.created_at)}</span>
          </div>
          {j.status === 'complete' && j.output_url && (
            <a href={j.output_url} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <DownloadIcon size={13} /> download
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
