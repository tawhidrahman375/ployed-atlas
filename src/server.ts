import http from 'node:http';
import { handleStripeWebhook } from './agents/ledger.js';

// Long-running process for the VPS: exposes the Stripe webhook endpoint that
// Ledger listens on 24/7. Run alongside the cron-scheduled morning/evening
// blocks (those are separate short-lived processes, see src/agents/atlas.ts).
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhooks/stripe') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const rawBody = Buffer.concat(chunks);
    const signature = req.headers['stripe-signature'];

    try {
      if (typeof signature !== 'string') throw new Error('Missing stripe-signature header');
      await handleStripeWebhook(rawBody, signature);
      res.writeHead(200).end('ok');
    } catch (err) {
      console.error('[Ledger] webhook error:', (err as Error).message);
      res.writeHead(400).end('webhook error');
    }
    return;
  }

  res.writeHead(404).end();
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => console.log(`Ledger webhook server listening on :${port}`));
