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

async function fetchOrderedSlides(slideUrls: string[], seed: string) {
  const slug = slugify(seed);
  const pad = String(slideUrls.length).length;
  return Promise.all(
    slideUrls.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch slide ${i + 1}`);
      const blob = await res.blob();
      // Zero-padded prefix keeps every share target / gallery app that sorts
      // saved files by name in the same order the slideshow was authored in.
      const name = `${String(i + 1).padStart(pad, '0')}-${slug}.${extFromUrl(url)}`;
      return { blob, name };
    })
  );
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

  async function downloadAsZip(slides: { blob: Blob; name: string }[]) {
    const zip = new JSZip();
    for (const { blob, name } of slides) zip.file(name, blob);
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
  }

  async function handleClick() {
    if (state === 'working') return;
    setState('working');
    try {
      const slides = await fetchOrderedSlides(slideUrls, fileNameSeed);

      // Android's share sheet (Chrome, Samsung Internet) offers "Save to
      // Photos"/gallery as a direct target when sharing image Files — that
      // writes straight into the camera roll, in the array's order, with no
      // zip step for the user to extract. canShare() has to be checked
      // against the actual File objects: some browsers implement share()
      // without file support at all, or reject a set this large.
      const files = slides.map(({ blob, name }) => new File([blob], name, { type: blob.type || 'image/jpeg' }));
      const canShareFiles =
        typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files });

      if (canShareFiles) {
        try {
          await navigator.share({
            files,
            title: fileNameSeed,
            text: caption ? `${caption}${hashtags ? ` ${hashtags}` : ''}` : undefined,
          });
          setState('idle');
          return;
        } catch (err) {
          // User dismissing the share sheet throws AbortError — that's not a
          // failure, just leave the button as-is. Any other error falls
          // through to the zip download below instead of dead-ending.
          if ((err as Error).name === 'AbortError') {
            setState('idle');
            return;
          }
        }
      }

      await downloadAsZip(slides);
      setState('idle');
    } catch (err) {
      console.error('download all failed', err);
      setState('error');
    }
  }

  const canShareFilesUpfront =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

  return (
    <button
      type="button"
      className="slideshow-download-all"
      onClick={handleClick}
      disabled={state === 'working'}
      title={
        canShareFilesUpfront
          ? 'Save all slides straight to Photos (falls back to a zip if sharing isn’t available)'
          : 'Download all slides + caption as a zip'
      }
    >
      <DownloadIcon size={12} />
      {state === 'working' ? 'preparing…' : state === 'error' ? 'failed — retry' : canShareFilesUpfront ? 'save to photos' : 'download all'}
    </button>
  );
}
