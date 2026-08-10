import { requireEnv } from './env.js';

const LINKEDIN_URL = 'https://api.anymailfinder.com/v5.1/find-email/linkedin-url';
const PERSON_URL = 'https://api.anymailfinder.com/v5.1/find-email/person';

// Only usable for LinkedIn leads — same reason Hunter.io was: Apollo has a
// profile URL, not a company domain, and this endpoint takes the URL directly.
// Billing only charges a credit on a genuine "valid" find; not_found/risky
// results are free, so a bad hit-rate against this ICP doesn't burn credits.
export async function findEmailByLinkedIn(profileUrl: string): Promise<string | null> {
  const res = await fetch(LINKEDIN_URL, {
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

// Fallback (and the only option for X leads, which have no LinkedIn URL at
// all): name + company pattern-match against Anymail Finder's own domain
// discovery, not a lookup against their indexed-profile database — a much
// broader net than findEmailByLinkedIn, which only ever hits if this exact
// person is already in their data. Needs a company name Claude extracted
// from the lead's bio/signals; skip callers with neither name nor company.
export async function findEmailByNameAndCompany(fullName: string, companyName: string): Promise<string | null> {
  const res = await fetch(PERSON_URL, {
    method: 'POST',
    headers: {
      Authorization: requireEnv('ANYMAIL_FINDER_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ full_name: fullName, company_name: companyName }),
  });
  if (!res.ok) {
    throw new Error(`Anymail Finder person lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { email_status: string; valid_email: string | null };
  if (body.email_status !== 'valid' || !body.valid_email) return null;
  return body.valid_email;
}
