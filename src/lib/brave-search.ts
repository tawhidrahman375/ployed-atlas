import { requireEnv } from './env.js';

const BASE_URL = 'https://api.search.brave.com/res/v1/web/search';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

// $5/month in credits (~1000 queries) on Brave's current plan. Apollo uses 8
// per run (see SEARCHES in apollo.ts) — keep that in mind before adding more
// callers of this.
export async function customSearch(query: string): Promise<SearchResult[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set('q', query);

  const res = await fetch(url, {
    headers: { 'X-Subscription-Token': requireEnv('BRAVE_SEARCH_API_KEY') },
  });
  if (!res.ok) {
    throw new Error(`Brave Search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { web?: { results?: { title: string; url: string; description: string }[] } };
  return (data.web?.results ?? []).map((r) => ({ title: r.title, link: r.url, snippet: r.description }));
}
