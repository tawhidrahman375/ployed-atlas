'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import { DownloadIcon } from './icons';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'slideshow';
}

function extFromUrl(url: string): string {
  const clean = url.split('?')[0].split('#')[0];
  const match = /\.([a-z0-9]+)$/i.exec(clean);
  return match ? match[1] : 'jpg';
}

export default function DownloadAllButton({
  slideUrls,
  caption,
  hashtags,
  fileNameSeed,
}: {
  slideUrls: string[];
  caption: string | null;
  hashtags: string | null;
  fileNameSeed: string;
}) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');

  async function handleClick() {
    if (state === 'working') return;
    setState('working');
    try {
      const zip = new JSZip();
      const pad = String(slideUrls.length).length;

      const slides = await Promise.all(
        slideUrls.map(async (url, i) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch slide ${i + 1}`);
          const blob = await res.blob();
          return { index: i, blob, ext: extFromUrl(url) };
        })
      );

      for (const { index, blob, ext } of slides) {
        zip.file(`slide-${String(index + 1).padStart(pad, '0')}.${ext}`, blob);
      }

      if (caption) {
        zip.file('caption.txt', `${caption}${hashtags ? `\n\n${hashtags}` : ''}`);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${slugify(fileNameSeed)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setState('idle');
    } catch (err) {
      console.error('download all failed', err);
      setState('error');
    }
  }

  return (
    <button
      type="button"
      className="slideshow-download-all"
      onClick={handleClick}
      disabled={state === 'working'}
      title="Download all slides + caption as a zip"
    >
      <DownloadIcon size={12} />
      {state === 'working' ? 'zipping…' : state === 'error' ? 'failed — retry' : 'download all'}
    </button>
  );
}
