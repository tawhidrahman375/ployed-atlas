import type { ReactElement, ReactNode, SVGProps } from 'react';
import type { AgentKey } from '../lib/agents';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function AtlasIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
    </Base>
  );
}

export function MnemosIcon(props: IconProps) {
  return (
    <Base {...props}>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.4" />
      <path d="M5 5.5v6c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v-6" />
      <path d="M5 11.5v6c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v-6" />
    </Base>
  );
}

export function NovaIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.3v7.4l6.2-3.7z" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function VegaIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path d="M12 2.5v2.3M21.5 12h-2.3M12 21.5v-2.3M2.5 12h2.3" />
    </Base>
  );
}

export function ApolloIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <path d="M12 1.2v3M12 19.8v3M1.2 12h3M19.8 12h3" />
    </Base>
  );
}

export function EchoIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 6.5l8.5 6.7 8.5-6.7" />
    </Base>
  );
}

export function MuseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 4c-6.2 0-12.4 4-14.4 12.4l-1.8 3.8 3.9-1.7C15.9 16.4 20 10.2 20 4z" />
      <path d="M8.6 15.4l6.3-6.3" />
    </Base>
  );
}

export function SageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 6c-2.1-1.4-4.8-1.9-7.3-1.6v13.1c2.5-.3 5.2.2 7.3 1.6 2.1-1.4 4.8-1.9 7.3-1.6V4.4c-2.5-.3-5.2.2-7.3 1.6z" />
      <path d="M12 6v13.1" />
    </Base>
  );
}

export function PixelIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="8.5" width="18" height="11.5" rx="2" />
      <path d="M3 8.5l3-4.5h4l-3 4.5M11.3 8.5l3-4.5h4l-3 4.5" />
    </Base>
  );
}

export function PulseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2.5 12.5h4l2-6.5 4 13 2-6.5h7" />
    </Base>
  );
}

export function LedgerIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <text x="12" y="16" textAnchor="middle" fontSize="10.5" fill="currentColor" stroke="none" fontFamily="var(--font-inter), sans-serif" fontWeight={600}>
        £
      </text>
    </Base>
  );
}

export function SentinelIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3l7 3.1v5.6c0 4.9-3.2 7.6-7 9-3.8-1.4-7-4.1-7-9V6.1z" />
      <path d="M8.8 12.1l2.1 2.1 4.3-4.3" />
    </Base>
  );
}

export function ForgeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.5 3h5M10.2 3v6.2l-4.8 8.4a1.9 1.9 0 001.6 2.9h10a1.9 1.9 0 001.6-2.9l-4.8-8.4V3" />
      <path d="M7.8 15h8.4" />
    </Base>
  );
}

export const AGENT_ICONS: Record<AgentKey, (props: IconProps) => ReactElement> = {
  atlas: AtlasIcon,
  mnemos: MnemosIcon,
  nova: NovaIcon,
  vega: VegaIcon,
  apollo: ApolloIcon,
  echo: EchoIcon,
  muse: MuseIcon,
  sage: SageIcon,
  pixel: PixelIcon,
  pulse: PulseIcon,
  ledger: LedgerIcon,
  sentinel: SentinelIcon,
  forge: ForgeIcon,
};

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5l-4.3-4.3" />
    </Base>
  );
}

export function TrendingUpIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 17l6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </Base>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Base>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5L2.5 20h19z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.8 2.8L16.5 9" />
    </Base>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 2.8h8l4.2 4.2v13.4a1 1 0 01-1 1H6a1 1 0 01-1-1V3.8a1 1 0 011-1z" />
      <path d="M14 2.8V7h4.2" />
      <path d="M8.3 12.3h7.4M8.3 15.8h7.4M8.3 8.8h3" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.5 2" />
    </Base>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5v11.7M7.8 11.4l4.2 4.2 4.2-4.2" />
      <path d="M4.5 17v2.7a1.3 1.3 0 001.3 1.3h12.4a1.3 1.3 0 001.3-1.3V17" />
    </Base>
  );
}

export function FlaskIcon(props: IconProps) {
  return <ForgeIcon {...props} />;
}

export function ShieldIcon(props: IconProps) {
  return <SentinelIcon {...props} />;
}

export function UsersIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8.3" r="3.2" />
      <path d="M2.8 20c0-3.5 2.8-6.2 6.2-6.2s6.2 2.7 6.2 6.2" />
      <path d="M16 4.6a3.2 3.2 0 010 6.2M21.2 20c0-2.9-1.9-5.3-4.6-6" />
    </Base>
  );
}

export function ReplyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10 8.5l-6 4 6 4" />
      <path d="M4.5 12.5H14a5.5 5.5 0 015.5 5.5v1.3" />
    </Base>
  );
}

export function ImagesIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="13" height="13" rx="2" />
      <path d="M3 12.5l3.5-3.5 3 3 2-2 4.5 4.5" />
      <path d="M8 20.5h10a2 2 0 0 0 2-2v-10" />
    </Base>
  );
}

export function ActivityIcon(props: IconProps) {
  return <PulseIcon {...props} />;
}
