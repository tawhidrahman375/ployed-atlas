import { contentTypeLabel, dedupeContent, groupBy, timeAgo, type ContentRow } from '../lib/format';
import { DownloadIcon, FileTextIcon } from './icons';

export default function ContentFeed({ rows }: { rows: ContentRow[] }) {
  const deduped = dedupeContent(rows);
  if (!deduped.length) {
    return <div className="empty-note">Nothing generated yet.</div>;
  }

  const grouped = groupBy(deduped, (d) => d.item.type);

  return (
    <div className="content-groups">
      {[...grouped.entries()].map(([type, items]) => (
        <div className="content-group" key={type}>
          <div className="content-group-head">
            <FileTextIcon size={15} />
            {contentTypeLabel(type)}
            <span className="badge-count">{items.length}</span>
          </div>
          <div className="content-list">
            {items.slice(0, 8).map(({ item, count }) => (
              <div className="content-item" key={item.id}>
                <a className="content-item-title" href={item.file_path} title={item.title ?? undefined}>
                  {item.title ?? 'Untitled'}
                </a>
                <span className="content-item-meta">
                  {count > 1 && <span className="badge-count">×{count}</span>}
                  <span className="content-item-time">{timeAgo(item.created_at)}</span>
                  <a href={item.file_path} title="Download" aria-label="Download">
                    <DownloadIcon size={13} />
                  </a>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
