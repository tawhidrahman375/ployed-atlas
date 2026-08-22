import { requireEnv } from './env.js';

// Confirmed by extracting Saleshandy's own official CLI package
// (@saleshandy/saleshandy-cli, pulled from registry.npmjs.org — this
// session's network egress blocks every Saleshandy domain directly, but not
// npm's registry, so this was the actual open-api.saleshandy.com client
// source, not a guess): base URL has NO /v1 suffix — the version segment
// lives inside each path instead (/api/open-api/v1/...). The original guess
// here (`https://open-api.saleshandy.com/v1`) is exactly why the add-prospect
// call 404'd: the real host + prefix is different, not just the path tail.
const BASE_URL = 'https://open-api.saleshandy.com';

// The CLI's ApiClient sets this on every request alongside x-api-key and
// Content-Type — confirmed from its axios.create() defaults, not a guess.
// Unclear whether the API actually enforces it or the CLI just always sends
// it, but matching the real client's behavior exactly is safer than omitting
// something we don't have a reason to.
const COMMON_HEADERS = {
  'sh-application': 'open-api',
};

export interface SequenceAnalytics {
  emails_sent_count: number;
  bounced_count: number;
  reply_count: number;
}

// Every POST in Saleshandy's own CLI wraps successful responses in
// `{ payload: ... }` (their ApiClient unwraps this automatically via an
// axios interceptor) and errors in either `{ code, type, message }`
// (Saleshandy's own envelope) or `{ statusCode, message | messages }`
// (a raw NestJS validation error) — confirmed from the CLI source. This repo
// doesn't use axios, so callers here see the raw envelope, not an unwrapped
// payload — keep that in mind when parsing a response.
async function saleshandyPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'x-api-key': requireEnv('SALESHANDY_API_KEY'),
      'Content-Type': 'application/json',
      ...COMMON_HEADERS,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Saleshandy API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// Confirmed real path + method + request body shape from the CLI's
// `analytics consolidated-stats` command (analytics/consolidated-stats.js):
// POST /api/open-api/v1/analytics/consolidated-stats with
// { sequenceIds: string[], startDate, endDate, pageNum, pageLimit }. Chosen
// over the CLI's other analytics command (`sequence-stats`, POST
// /api/open-api/v1/analytics/stats) because that one takes no date range at
// all — no start/end-date flags exist on it — so it can't serve Sentinel's
// 7-day bounce window or Pulse's "today" pull.
//
// ⚠️ Response shape is NOT confirmed — the CLI just dumps this endpoint's
// response generically (`outputSingle(data, flags)`) without assuming any
// particular fields, unlike `sequence-stats` (whose CLI command does
// destructure a known shape: `{ sequenceName, sequenceId, prospects: [{total,
// open, replied, clicked, bounced, unsubscribed}], emails: [{sent, open,
// replied, clicked, bounced}] }` — note these are arrays, not flat counts,
// likely one row per sequence step). The mapping below is a best-guess at a
// flat totals shape and may not match what consolidated-stats actually
// returns — print the raw response (e.g. via a small test script) and fix
// this mapping before trusting Sentinel's bounce-rate math or Pulse's
// dashboard numbers.
export async function getSequenceAnalytics(startDate?: string, endDate?: string): Promise<SequenceAnalytics> {
  const today = new Date().toISOString().slice(0, 10);
  const raw = await saleshandyPost<{ sent?: number; bounced?: number; replied?: number }>(
    '/api/open-api/v1/analytics/consolidated-stats',
    {
      sequenceIds: [requireEnv('SALESHANDY_SEQUENCE_ID')],
      startDate: startDate ?? today,
      endDate: endDate ?? today,
      pageNum: 1,
      pageLimit: 25,
    }
  );
  return {
    emails_sent_count: raw.sent ?? 0, // ⚠️ confirm field name against a real response
    bounced_count: raw.bounced ?? 0, // ⚠️ confirm field name against a real response
    reply_count: raw.replied ?? 0, // ⚠️ confirm field name against a real response
  };
}

// Confirmed real path + method from the CLI's `sequences prospects-import`
// command (sequences/prospects-import.js): POST
// /api/open-api/v1/sequences/prospects/import-with-field-name. This is what
// 404'd before — the old guess (`/sequences/{sequenceId}/prospects`) isn't a
// real route at all; the sequence ID never goes in the URL for this
// operation.
//
// Confirmed IMPORTANT behavioral fact: this is an ASYNC operation, not a
// synchronous add. The CLI's own success message is "Prospect import has
// started successfully" — the response is a job acknowledgement, not proof
// the prospect was actually created/enrolled. Real confirmation requires
// polling the companion status endpoint (also confirmed from the CLI, see
// getProspectImportStatus below). A 2xx from this function means "Saleshandy
// accepted the import job," not "the prospect is in the sequence" — treat it
// accordingly, same spirit as the existing "queued ≠ delivered" comments
// elsewhere in this codebase.
//
// Body shape: `stepId` is confirmed optional — the CLI's --step-id flag only
// sets `body.stepId` when explicitly passed, implying Saleshandy defaults to
// the sequence's first step when it's omitted (this is inferred from that
// optionality, not stated outright). `prospectList` as the array key is
// confirmed from external Saleshandy documentation (independently, not from
// the CLI). `sequenceId` as a top-level body field is inferred, not directly
// confirmed: the CLI command has no --sequence-id flag at all, so whatever
// JSON file a user supplies must already carry it — there's no other way the
// API would know which sequence this targets.
//
// ⚠️ NOT confirmed: the exact key names inside each prospectList entry.
// `email` is likely flat (Saleshandy's read-side /contacts endpoint returns
// a flat `email` field). Names/company are more uncertain — the read-side
// API stores them as labeled attributes with literal string keys "First
// Name" / "Last Name" (confirmed from prospects/list.js's
// getAttr(row, 'First Name') calls), and this write endpoint is literally
// named "import-with-field-name" — strongly suggesting import entries key by
// the same human-readable labels, not camelCase (firstName/lastName). Kept
// as camelCase below anyway since that's still a guess either way and I have
// no confirmed default label for "company" — verify against a real account
// and adjust to `"First Name"`/`"Last Name"`/whatever the real company label
// is if camelCase 400s.
//
// verifyProspects/conflictAction from the previous version are dropped here
// — that pairing came from a different, more generic Saleshandy doc snippet
// with no confirmation it applies to this exact endpoint, and shipping a
// wrong enum value (e.g. an invalid conflictAction) risks trading one 4xx
// for another. Omitting optional fields Saleshandy doesn't require is safer
// than guessing their values.
export async function addProspectToSequence(
  sequenceId: string,
  prospect: { email: string; firstName?: string; companyName?: string; personalization?: string }
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/open-api/v1/sequences/prospects/import-with-field-name`, {
    method: 'POST',
    headers: {
      'x-api-key': requireEnv('SALESHANDY_API_KEY'),
      'Content-Type': 'application/json',
      ...COMMON_HEADERS,
    },
    body: JSON.stringify({
      sequenceId,
      prospectList: [
        {
          email: prospect.email,
          firstName: prospect.firstName,
          companyName: prospect.companyName,
          // ⚠️ Still the biggest open question in this file: does Saleshandy
          // even support injecting a full Claude-drafted subject+body per
          // prospect through this field, the way Instantly's flat
          // "personalization" field did? Saleshandy sequences are step-based
          // with their own pre-written templates per step — there may be
          // nowhere for a freeform per-lead email body to land here at all.
          // customVariables is a guess at the mechanism — verify this before
          // assuming Echo's drafts are reaching anyone once this ships.
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

// Confirmed real path + method from the CLI's `prospects import-status`
// command (prospects/import-status.js): GET
// /api/open-api/v1/prospects/import-status/{requestId}. Not wired into
// echo.ts — addProspectToSequence's caller doesn't currently poll this — but
// exported so a test script (or a future retry/verification pass in Echo)
// can check whether an import job actually landed instead of trusting the
// initial "accepted" response.
export async function getProspectImportStatus(requestId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/open-api/v1/prospects/import-status/${requestId}`, {
    headers: {
      'x-api-key': requireEnv('SALESHANDY_API_KEY'),
      ...COMMON_HEADERS,
    },
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Saleshandy import-status check failed: ${res.status} ${bodyText}`);
  }
  return bodyText;
}
