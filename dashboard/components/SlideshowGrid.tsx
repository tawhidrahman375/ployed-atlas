import { timeAgo } from '../lib/format';
import { DownloadIcon } from './icons';
import DownloadAllButton from './DownloadAllButton';

export interface SlideshowRow {
  id: string;
  format: string;
  hook: string | null;
  slide_urls: string[];
  caption: string | null;
  hashtags: string | null;
  caption_url: string | null;
  created_at: string;
}

const FORMAT_LABELS: Record<string, string> = {
  tools_list: 'Tools list',
  pain_hook: 'Pain hook',
};

export default function SlideshowGrid({ slideshows }: { slideshows: SlideshowRow[] }) {
  if (!slideshows.length) {
    return <div className="empty-note">No slideshows yet.</div>;
  }

  return (
    <div className="slideshow-list">
      {slideshows.map((s) => (
        <div className="slideshow-card" key={s.id}>
          <div className="slideshow-head">
            <span className="format-badge">{FORMAT_LABELS[s.format] ?? s.format}</span>
            <div className="slideshow-head-right">
              <DownloadAllButton
                slideUrls={s.slide_urls}
                caption={s.caption}
                hashtags={s.hashtags}
                fileNameSeed={`${s.hook ?? s.format}-${s.created_at.slice(0, 10)}`}
              />
              <span className="content-item-time">{timeAgo(s.created_at)}</span>
            </div>
          </div>
          <div className="slideshow-title">{s.hook ?? 'Untitled slideshow'}</div>
          <div className="slideshow-thumbs">
            {s.slide_urls.map((url, i) => (
              <a href={url} key={url} title={`Download slide ${i + 1}`}>
                <img src={url} alt={`Slide ${i + 1}`} loading="lazy" />
              </a>
            ))}
          </div>
          {s.caption && (
            <div className="slideshow-caption">
              {s.caption}
              {s.hashtags ? ` ${s.hashtags}` : ''}
            </div>
          )}
          {s.caption_url && (
            <a className="slideshow-caption-link" href={s.caption_url} title="Download caption + hashtags">
              <DownloadIcon size={12} /> download caption
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
