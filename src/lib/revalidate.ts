import { requireEnv, getEnv } from './env.js';

const DEFAULT_DASHBOARD_URL = 'https://dashboard-seven-lemon-91.vercel.app';

// Triggers on-demand ISR revalidation on the deployed dashboard so it shows
// new data immediately after a block finishes, instead of waiting for the
// 5-minute revalidate window. Called from atlas.ts via runStep(), so a
// missing/wrong secret fails loudly but doesn't crash the block — the
// dashboard just falls back to its normal 5-minute refresh.
export async function revalidateDashboard(): Promise<void> {
  const secret = requireEnv('REVALIDATE_SECRET');
  const baseUrl = getEnv('DASHBOARD_URL') ?? DEFAULT_DASHBOARD_URL;

  const res = await fetch(`${baseUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': secret },
  });
  if (!res.ok) {
    throw new Error(`Dashboard revalidate failed: ${res.status} ${await res.text()}`);
  }
}
