import { requireEnv } from './env.js';

const BASE_URL = 'https://api.instantly.ai/api/v2';

export interface CampaignAnalyticsOverview {
  emails_sent_count: number;
  bounced_count: number;
  reply_count: number;
}

async function instantlyFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${requireEnv('INSTANTLY_API_KEY')}` },
  });
  if (!res.ok) {
    throw new Error(`Instantly API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// /campaigns/analytics (the list endpoint) returns `[]` on this account
// regardless of params — confirmed live, not just a docs gap — so Pulse's
// and Sentinel's numbers were silently always zero. /campaigns/analytics/overview
// returns the same fields as a single object, populated even at zero volume,
// and takes the same campaign_id/date-range scoping.
export async function getCampaignAnalytics(startDate?: string, endDate?: string): Promise<CampaignAnalyticsOverview> {
  return instantlyFetch<CampaignAnalyticsOverview>('/campaigns/analytics/overview', {
    campaign_id: requireEnv('INSTANTLY_CAMPAIGN_ID'),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
  });
}

interface AddLeadResponse {
  id: string;
  email: string;
}

// Adds a lead directly to a running campaign — Instantly handles the actual
// send timing/sequencing from there. Requires INSTANTLY_CAMPAIGN_ID, which is
// a deliberate extra gate: without a real campaign already set up in
// Instantly, this throws instead of guessing a target.
export async function addLeadToCampaign(
  campaignId: string,
  lead: { email: string; firstName?: string; companyName?: string; personalization?: string }
): Promise<AddLeadResponse> {
  const url = `${BASE_URL}/leads`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('INSTANTLY_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaign: campaignId,
      email: lead.email,
      first_name: lead.firstName,
      company_name: lead.companyName,
      personalization: lead.personalization,
    }),
  });
  if (!res.ok) {
    throw new Error(`Instantly add-lead failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<AddLeadResponse>;
}
