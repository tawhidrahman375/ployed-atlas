import type { ReactNode } from 'react';
import { formatNumber } from '../lib/format';
import { AlertTriangleIcon, EchoIcon, EyeIcon, MnemosIcon, ReplyIcon, SearchIcon, TrendingUpIcon } from './icons';

function Tile({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export interface StatGridProps {
  emailsSent: number;
  leadsFound: number;
  gscClicks: number;
  gscImpressions: number;
  posthogEvents: number;
  instantlyBounced: number;
  instantlyReplies: number;
}

export default function StatGrid(props: StatGridProps) {
  return (
    <>
      <div className="stat-group">
        <div className="stat-group-label">Outreach</div>
        <div className="stat-grid">
          <Tile icon={<SearchIcon size={16} />} value={formatNumber(props.leadsFound)} label="Leads found today" />
          <Tile icon={<EchoIcon size={16} />} value={formatNumber(props.emailsSent)} label="Emails delivered today" />
          <Tile icon={<ReplyIcon size={16} />} value={formatNumber(props.instantlyReplies)} label="Replies today" />
          <Tile icon={<AlertTriangleIcon size={16} />} value={formatNumber(props.instantlyBounced)} label="Bounced today" />
        </div>
      </div>
      <div className="stat-group">
        <div className="stat-group-label">Site &amp; product</div>
        <div className="stat-grid">
          <Tile icon={<TrendingUpIcon size={16} />} value={formatNumber(props.gscClicks)} label="GSC clicks today" />
          <Tile icon={<EyeIcon size={16} />} value={formatNumber(props.gscImpressions)} label="GSC impressions today" />
          <Tile icon={<MnemosIcon size={16} />} value={formatNumber(props.posthogEvents)} label="PostHog events today" />
        </div>
      </div>
    </>
  );
}
