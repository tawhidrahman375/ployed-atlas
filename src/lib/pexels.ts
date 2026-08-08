import { requireEnv } from './env.js';

const BASE_URL = 'https://api.pexels.com/v1/search';

export interface StockPhoto {
  id: string;
  buffer: Buffer;
}

interface PexelsPhoto {
  id: number;
  src: { large2x: string; portrait: string; large: string };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

// Pexels: free, real stock photography, no attribution required under the
// Pexels License — used for slideshow backgrounds since AI-generated imagery
// is off the table for this content. Picks randomly among the top results,
// skipping anything in excludeIds (recently-used photo IDs), so repeated
// queries across runs don't keep landing on the same background.
export async function searchBackgroundPhoto(
  query: string,
  excludeIds: Set<string> = new Set()
): Promise<StockPhoto> {
  const url = new URL(BASE_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '15');

  const res = await fetch(url, {
    headers: { Authorization: requireEnv('PEXELS_API_KEY') },
  });
  if (!res.ok) {
    throw new Error(`Pexels search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as PexelsSearchResponse;
  if (!data.photos.length) throw new Error(`No Pexels results for query "${query}"`);

  const candidates = data.photos.filter((p) => !excludeIds.has(String(p.id)));
  const pool = candidates.length ? candidates : data.photos;
  const photo = pool[Math.floor(Math.random() * pool.length)];

  const imgRes = await fetch(photo.src.large2x);
  if (!imgRes.ok) throw new Error(`Failed to download Pexels photo ${photo.id}: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  return { id: String(photo.id), buffer };
}
