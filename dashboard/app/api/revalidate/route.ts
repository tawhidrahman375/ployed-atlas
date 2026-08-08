import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// Called by the runner (src/lib/revalidate.ts) at the end of every morning/
// evening block so the dashboard shows new data immediately instead of
// waiting for the 5-minute ISR window (`export const revalidate = 300` in
// app/page.tsx).
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  revalidatePath('/');
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
