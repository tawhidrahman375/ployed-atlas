import { requireEnv } from './env.js';

const BASE_URL = 'https://api.hunter.io/v2/email-finder';
const MIN_CONFIDENCE = 50; // Hunter's 0-100 score; below this, treat as not found

// Free tier: 25 searches/month, no credit charged when nothing is found.
// Only usable for LinkedIn leads — Hunter's linkedin_handle param sidesteps
// needing a company domain, which Apollo doesn't reliably have.
export async function findEmailByLinkedIn(profileUrl: string): Promise<string | null> {
  const linkedinHandle = profileUrl.match(/linkedin\.com\/in\/([^/?]+)/)?.[1];
  if (!linkedinHandle) return null;

  const url = new URL(BASE_URL);
  url.searchParams.set('linkedin_handle', linkedinHandle);
  url.searchParams.set('api_key', requireEnv('HUNTER_API_KEY'));

  const res = await fetch(url);
  if (res.status === 404) return null; // handle not in Hunter's database — a normal miss, not an error
  if (!res.ok) {
    throw new Error(`Hunter.io lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: { email: string | null; score: number } };
  if (!body.data?.email || body.data.score < MIN_CONFIDENCE) return null;
  return body.data.email;
}
