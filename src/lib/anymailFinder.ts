import { requireEnv } from './env.js';

const BASE_URL = 'https://api.anymailfinder.com/v5.1/find-email/linkedin-url';

// Only usable for LinkedIn leads — same reason Hunter.io was: Apollo has a
// profile URL, not a company domain, and this endpoint takes the URL directly.
// Billing only charges a credit on a genuine "valid" find; not_found/risky
// results are free, so a bad hit-rate against this ICP doesn't burn credits.
export async function findEmailByLinkedIn(profileUrl: string): Promise<string | null> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: requireEnv('ANYMAIL_FINDER_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ linkedin_url: profileUrl }),
  });
  if (!res.ok) {
    throw new Error(`Anymail Finder lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { email_status: string; valid_email: string | null };
  if (body.email_status !== 'valid' || !body.valid_email) return null;
  return body.valid_email;
}
