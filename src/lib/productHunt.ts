import { requireEnv } from './env.js';

const API_URL = 'https://api.producthunt.com/v2/api/graphql';

export interface ProductHuntPost {
  name: string;
  tagline: string;
  url: string;
  topics: string[];
}

const QUERY = `
  query RecentPosts($postedAfter: DateTime!) {
    posts(order: RANKING, postedAfter: $postedAfter, first: 50) {
      edges {
        node {
          name
          tagline
          url
          topics(first: 10) {
            edges { node { name } }
          }
        }
      }
    }
  }
`;

// Not an exhaustive taxonomy match — just enough to separate launches
// actually relevant to Ployed's ICP (AI automation/GHL/web design agencies,
// SMMA) from the hundreds of unrelated things Product Hunt ships daily.
const RELEVANT_TOPIC_KEYWORDS = [
  'automation',
  'agency',
  'agencies',
  'artificial intelligence',
  'sales',
  'marketing',
  'productivity',
  'saas',
  'no-code',
  'lead generation',
  'crm',
];

function isRelevant(topics: string[]): boolean {
  const lower = topics.map((t) => t.toLowerCase());
  return lower.some((t) => RELEVANT_TOPIC_KEYWORDS.some((kw) => t.includes(kw)));
}

interface PostHuntResponse {
  errors?: { message: string }[];
  data?: {
    posts?: {
      edges?: {
        node: {
          name: string;
          tagline: string;
          url: string;
          topics?: { edges?: { node: { name: string } }[] };
        };
      }[];
    };
  };
}

// Filtered to launches posted in the lookback window and matching the ICP
// keyword list above. Findings are the caller's job to store (see
// scripts/check-producthunt.ts) — this just fetches and filters.
export async function fetchRelevantLaunches(sinceHoursAgo = 24): Promise<ProductHuntPost[]> {
  const postedAfter = new Date(Date.now() - sinceHoursAgo * 60 * 60 * 1000).toISOString();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('PRODUCTHUNT_API_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: QUERY, variables: { postedAfter } }),
  });
  if (!res.ok) {
    throw new Error(`Product Hunt API failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as PostHuntResponse;
  if (body.errors?.length) {
    throw new Error(`Product Hunt API error: ${body.errors.map((e) => e.message).join('; ')}`);
  }

  const edges = body.data?.posts?.edges ?? [];
  return edges
    .map((e) => ({
      name: e.node.name,
      tagline: e.node.tagline,
      url: e.node.url,
      topics: (e.node.topics?.edges ?? []).map((t) => t.node.name),
    }))
    .filter((post) => isRelevant(post.topics));
}
