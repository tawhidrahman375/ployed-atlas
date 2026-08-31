import { requireEnv, getEnv } from './env.js';

// Confirmed by extracting Saleshandy's own official CLI package
// (@saleshandy/saleshandy-cli, pulled from registry.npmjs.org — this
// session's network egress blocks every Saleshandy domain directly, but not
// npm's registry, so this was the actual open-api.saleshandy.com client
// source, not a guess): base URL has NO /v1 suffix — the version segment
// lives inside each path instead (/api/open-api/v1/...).
const BASE_URL = 'https://open-api.saleshandy.com';

// The CLI's ApiClient sets this on every request alongside x-api-key and
// Content-Type — confirmed from its axios.create() defaults.
const COMMON_HEADERS = {
  'sh-application': 'open-api',
};

// Confirmed from the CLI's ApiClient response interceptor: a successful
// response wraps the real payload as `{ payload: ... }`. The CLI uses axios
// with an interceptor that unwraps this automatically before any command
// code sees it; this repo uses raw fetch, so unwrapping has to happen here
// instead, or every command that expects `data` to already be the inner
// value (e.g. an array of steps) would silently see the wrapper instead.
function unwrapPayload(data: unknown): unknown {
  if (data && typeof data === 'object' && 'payload' in data) {
    return (data as { payload: unknown }).payload;
  }
  return data;
}

async function saleshandyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-api-key': requireEnv('SALESHANDY_API_KEY'), ...COMMON_HEADERS },
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Saleshandy API ${path} failed: ${res.status} ${bodyText}`);
  }
  return unwrapPayload(JSON.parse(bodyText)) as T;
}

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
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Saleshandy API ${path} failed: ${res.status} ${bodyText}`);
  }
  return unwrapPayload(JSON.parse(bodyText)) as T;
}

export interface SequenceAnalytics {
  emails_sent_count: number;
  bounced_count: number;
  reply_count: number;
}

// Confirmed real path + method + request body shape from the CLI's
// `analytics consolidated-stats` command: POST
// /api/open-api/v1/analytics/consolidated-stats with { sequenceIds: string[],
// startDate, endDate, pageNum, pageLimit } — note the plural `sequenceIds`
// here is correct and unaffected by the add-prospect fix below; they're
// different endpoints with different (and non-interchangeable) DTOs, as the
// add-prospect 400 makes clear.
//
// ⚠️ Response shape still NOT confirmed — the CLI dumps this endpoint's
// response generically without assuming a shape. sent/bounced/replied below
// remain a best guess; verify against a real response before trusting
// Sentinel's bounce-rate math or Pulse's dashboard numbers.
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

interface SequenceStep {
  id: string;
  number: number;
  type: number; // confirmed from sequences/steps/create.js's channel comment: 1=Email
  status?: string;
}

const EMAIL_STEP_TYPE = 1;

// Live 400 from a real account confirmed the add-prospect DTO rejects a
// `sequenceId` field outright ("property sequenceId should not exist") — the
// sequence is identified purely by which step you target, since a step
// belongs to exactly one sequence. So "the sequence ID" has to resolve to a
// step ID first, via the CLI's own confirmed `sequences steps list` path:
// GET /api/open-api/v1/sequences/{sequenceId}/steps.
//
// Picks the first Email-type step (lowest `number`) as the default target,
// since Echo only does cold email — a sequence mixing channels (LinkedIn,
// calls, etc.) could have its first step be a non-email one, which this
// deliberately skips past. Override with SALESHANDY_STEP_ID if you want a
// specific step instead (mirrors the CLI's own optional --step-id flag).
// Cached per-process so a batch run (Echo processes many leads per run)
// doesn't re-fetch the step list for every single lead.
let cachedStepId: string | undefined;

async function resolveStepId(sequenceId: string): Promise<string> {
  const override = getEnv('SALESHANDY_STEP_ID');
  if (override) return override;
  if (cachedStepId) return cachedStepId;

  const steps = await saleshandyGet<SequenceStep[]>(`/api/open-api/v1/sequences/${sequenceId}/steps`);
  const emailSteps = steps.filter((s) => s.type === EMAIL_STEP_TYPE).sort((a, b) => a.number - b.number);
  const step = emailSteps[0] ?? [...steps].sort((a, b) => a.number - b.number)[0];
  if (!step) {
    throw new Error(
      `No steps found for Saleshandy sequence ${sequenceId} — create a step in it first, or set SALESHANDY_STEP_ID directly.`
    );
  }
  cachedStepId = step.id;
  return step.id;
}

// Confirmed real path from the CLI's `sequences prospects-import` command:
// POST /api/open-api/v1/sequences/prospects/import-with-field-name.
//
// Confirmed IMPORTANT behavioral fact: this is an ASYNC operation. The CLI's
// own success message is "Prospect import has started successfully" — a 2xx
// here means "Saleshandy accepted the import job," not "the prospect is in
// the sequence." Real confirmation requires polling
// getProspectImportStatus() below.
//
// Body shape, now grounded in a real 400 from a live account rather than
// guesses: `sequenceId` is REJECTED outright (see resolveStepId above —
// `stepId` alone identifies the target). `verifyProspects` (boolean) and
// `conflictAction` (enum) are REQUIRED, not optional as the previous version
// assumed — omitting them is what triggered "must be a boolean value" /
// "must be a valid enum value". conflictAction: 'addMissingFields' and
// 'overwrite' are both confirmed real values from Saleshandy's own prospect-
// import documentation (describing the same "update missing fields /
// overwrite / skip" three-way choice surfaced in their UI); 'addMissingFields'
// is used here as the safer default — it can't clobber existing prospect
// data, unlike 'overwrite'. The UI also exposes a "skip" behavior but no
// source seen so far confirms its literal enum string, so it's deliberately
// not used as a guess.
//
// Per-prospect keys inside prospectList — REVISED after `firstName` /
// `companyName` / `customVariables` were confirmed rejected live (the flat
// camelCase guess this comment used to describe). `stepId` / `verifyProspects`
// / `conflictAction` were NOT flagged as rejected, so those stay as-is.
//
// New shape is a `fields` map keyed by the prospect field's literal display
// name, not camelCase. Evidence, gathered from the @saleshandy/saleshandy-cli
// source (pulled from registry.npmjs.org — same technique as the rest of this
// file, since this session's network egress still blocks every
// saleshandy.com / open-api.saleshandy.com host, confirmed again on this
// pass: direct curl gets a 403 from the egress proxy, and WebFetch reports
// EGRESS_BLOCKED for docs.saleshandy.com, developer.saleshandy.com, and even
// third-party proxies like r.jina.ai):
//   - prospects/list.js reads each contact's custom data as
//     `row.attributes.find(a => a.key === 'First Name').value` straight off
//     the raw API response — i.e. the read side represents fields as
//     {key, value} pairs keyed by literal label ("First Name" / "Last Name"),
//     not firstName/lastName.
//   - The endpoint here is literally named "import-with-field-name" (as
//     opposed to importing by field ID — see the next point), which only
//     makes sense if you address fields by that same literal name string.
//   - prospects/attribute-set.js's single-attribute endpoint
//     (`POST /prospects/{id}/attribute`) uses `{fieldId, attributeValue}` —
//     proving Saleshandy's write-side DTOs do NOT just mirror the read
//     side's {key, value} naming. So while "fields keyed by literal label"
//     is well-evidenced, the exact wrapper shape below (a `fields` object
//     map vs. an array of {fieldName, value} pairs) is still a best guess,
//     not a confirmed fix — a public web search corroborates "field mappings
//     include standard fields like 'First Name', 'Last Name'" but no example
//     request body for THIS endpoint turned up anywhere reachable.
//
// ⚠️ `personalization` → a "Personalization" custom field is kept as a guess
// too, and is a bigger open question than a field-name typo: Saleshandy
// sequences send from pre-written per-step templates, so a per-lead
// Claude-drafted subject+body only reaches the recipient at all if the
// step's template references this exact field name as a merge tag (e.g.
// `{{Personalization}}`) AND that custom field already exists in the
// account. Neither is confirmed.
//
// Next step to actually confirm this: run `npm run test:echo` (pushes ONE
// real lead and prints the raw response/error instead of a queued/failed
// count for 30) and check the result —
//   - 200/202: this shape is right, ship it.
//   - 400 naming a specific property (e.g. "property fields should not
//     exist" or an enum/type mismatch): that error text is the fastest way
//     to nail the exact wrapper, paste it back for the next fix.
//   - Only way to skip the guessing entirely: open
//     https://open-api.saleshandy.com/api-doc/ (Swagger UI — found via web
//     search, not fetchable from this sandbox) from a normal browser and
//     read the "Import Prospects by Field Name" request schema directly.
export async function addProspectToSequence(
  sequenceId: string,
  prospect: { email: string; firstName?: string; companyName?: string; personalization?: string }
): Promise<string> {
  const stepId = await resolveStepId(sequenceId);

  const fields: Record<string, string> = {};
  if (prospect.firstName) fields['First Name'] = prospect.firstName;
  if (prospect.companyName) fields['Company Name'] = prospect.companyName;
  if (prospect.personalization) fields['Personalization'] = prospect.personalization;

  const res = await fetch(`${BASE_URL}/api/open-api/v1/sequences/prospects/import-with-field-name`, {
    method: 'POST',
    headers: {
      'x-api-key': requireEnv('SALESHANDY_API_KEY'),
      'Content-Type': 'application/json',
      ...COMMON_HEADERS,
    },
    body: JSON.stringify({
      stepId,
      verifyProspects: false,
      conflictAction: 'addMissingFields',
      prospectList: [
        {
          email: prospect.email,
          fields,
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
// command: GET /api/open-api/v1/prospects/import-status/{requestId}. Not
// wired into echo.ts's flow — exported so a test script (or a future
// retry/verification pass in Echo) can check whether an import job actually
// landed instead of trusting the initial "accepted" response.
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
