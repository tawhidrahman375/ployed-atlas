import { requireEnv } from './env.js';

const BASE_URL = 'https://open-api.saleshandy.com/v1';

// ⚠️ UNVERIFIED END TO END. This session's network egress is blocked from
// every Saleshandy domain (docs and the API host both — confirmed via a
// direct connect attempt, not just a guess), so nothing in this file has
// been exercised against a real account. Base URL and the x-api-key header
// are confirmed from Saleshandy's own docs (indexed externally); every path
// and field name marked ⚠️ below is a best-evidence reconstruction, not a
// tested contract — smoke-test each one against a real SALESHANDY_API_KEY /
// SALESHANDY_SEQUENCE_ID before trusting it in production. This is the same
// class of mistake that shipped unverified in anymailFinder.ts (missing
// "Bearer " prefix) and instantly.ts (wrong campaign_id query param) — don't
// repeat it a third time by assuming the guesses below are correct.

export interface SequenceAnalytics {
  emails_sent_count: number;
  bounced_count: number;
  reply_count: number;
}

async function saleshandyFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { 'x-api-key': requireEnv('SALESHANDY_API_KEY') },
  });
  if (!res.ok) {
    throw new Error(`Saleshandy API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ⚠️ Path and response field names are unconfirmed. Saleshandy's own CLI
// exposes an analogous "sequence-stats"/"consolidated-stats" concept scoped
// by sequence ID + date range, but the exact REST path wasn't reachable from
// here to confirm. sent_count/bounced_count/replied_count below are a guess
// based on the "Sent"/"Bounced"/"Replied" terms Saleshandy's own Reports UI
// uses — verify the real response shape and adjust the mapping below.
export async function getSequenceAnalytics(startDate?: string, endDate?: string): Promise<SequenceAnalytics> {
  const raw = await saleshandyFetch<{ sent_count: number; bounced_count: number; replied_count: number }>(
    '/analytics/sequence-stats', // ⚠️ confirm exact path
    {
      sequence_id: requireEnv('SALESHANDY_SEQUENCE_ID'),
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    }
  );
  return {
    emails_sent_count: raw.sent_count, // ⚠️ confirm field name
    bounced_count: raw.bounced_count, // ⚠️ confirm field name
    reply_count: raw.replied_count, // ⚠️ confirm field name
  };
}

// prospectList/verifyProspects/conflictAction are the one part of this file
// with real evidence behind them — Saleshandy's own "adding prospects via
// API" documentation names all three for this exact operation. stepId is
// deliberately omitted: Ployed only tracks one sequence, not individual
// steps within it, and the caller doesn't have a step ID to give. If your
// account requires an explicit stepId (rather than defaulting to the
// sequence's first step), you'll need a SALESHANDY_STEP_ID env var and to
// pass it through here — confirm which is true before relying on this.
// Returns the raw response body (text, not parsed) rather than void or a
// typed shape — the exact success response schema is unconfirmed (see file
// header), so callers that need to inspect what Saleshandy actually sent
// back (e.g. scripts/test-echo.ts) get the unmodified body instead of a
// guessed-at parsed type.
export async function addProspectToSequence(
  sequenceId: string,
  prospect: { email: string; firstName?: string; companyName?: string; personalization?: string }
): Promise<string> {
  const res = await fetch(`${BASE_URL}/sequences/${sequenceId}/prospects`, { // ⚠️ confirm exact path
    method: 'POST',
    headers: {
      'x-api-key': requireEnv('SALESHANDY_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      verifyProspects: false,
      conflictAction: 'skip', // ⚠️ confirm this is a valid enum value on your account
      prospectList: [
        {
          email: prospect.email,
          firstName: prospect.firstName,
          companyName: prospect.companyName,
          // ⚠️ Biggest open question in this whole file, bigger than any
          // field-name guess: does Saleshandy even support injecting a full
          // Claude-drafted subject+body per prospect, the way Instantly's
          // flat "personalization" field did? Saleshandy sequences are
          // step-based with their own pre-written templates per step — there
          // may be nowhere for a freeform per-lead email body to land via
          // this endpoint at all. customVariables is a guess at the
          // mechanism (a common pattern for merge-field injection on
          // similar APIs) — verify this before assuming Echo's drafts are
          // actually reaching anyone once this ships.
          customVariables: prospect.personalization ? { personalization: prospect.personalization } : undefined,
        },
      ],
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Saleshandy add-prospect failed: ${res.status} ${bodyText}`);
  }
  return bodyText;
}
