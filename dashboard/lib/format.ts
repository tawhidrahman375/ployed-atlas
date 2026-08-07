export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  return `${week}w ago`;
}

export function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function formatGBP(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n);
}

export interface ContentRow {
  id: string;
  type: string;
  title: string | null;
  file_path: string;
  status: string;
  created_at: string;
}

export interface DedupedContent {
  item: ContentRow;
  count: number;
}

export function dedupeContent(rows: ContentRow[]): DedupedContent[] {
  const map = new Map<string, DedupedContent>();
  for (const row of rows) {
    const key = `${row.type}::${row.title ?? ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (row.created_at > existing.item.created_at) existing.item = row;
    } else {
      map.set(key, { item: row, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.item.created_at.localeCompare(a.item.created_at));
}

export function groupBy<T, K extends string>(rows: T[], keyFn: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  daily_report: 'Daily reports',
  seo_page: 'SEO pages',
  x_thread: 'X threads',
  linkedin: 'LinkedIn posts',
  comparison_page: 'Comparison pages',
  reddit_response: 'Reddit responses',
  youtube_script: 'YouTube scripts',
};

export function contentTypeLabel(type: string): string {
  return CONTENT_TYPE_LABELS[type] ?? type;
}
