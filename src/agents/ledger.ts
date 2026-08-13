import Stripe from 'stripe';
import { requireEnv } from '../lib/env.js';
import { supabase } from '../lib/supabase.js';
import { logAgentRun } from '../mnemos.js';
import { setMetric } from '../lib/metrics.js';

let stripe: Stripe | undefined;
function stripeClient(): Stripe {
  stripe ??= new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  return stripe;
}

async function flag(level: 'yellow' | 'red', message: string): Promise<void> {
  const { error } = await supabase.from('risk_flags').insert({ level, agent: 'Ledger', message });
  if (error) throw error;
}

async function recomputeMRR(): Promise<number> {
  const subs = await stripeClient().subscriptions.list({ status: 'active', limit: 100 });
  let mrrPence = 0;
  for (const sub of subs.data) {
    for (const item of sub.items.data) {
      const price = item.price;
      if (!price?.unit_amount) continue;
      const monthlyEquivalent = price.recurring?.interval === 'year' ? price.unit_amount / 12 : price.unit_amount;
      mrrPence += monthlyEquivalent * (item.quantity ?? 1);
    }
  }
  mrrPence = Math.round(mrrPence);
  await setMetric('mrr_pence', mrrPence);
  return mrrPence;
}

// The webhook below only fires once Stripe has a registered HTTPS URL to
// call — until then (see README), this direct poll is the only thing that
// actually keeps mrr_pence current. Called from atlas.ts's evening block.
export async function run(): Promise<void> {
  const mrrPence = await recomputeMRR();
  await logAgentRun('Ledger', 'evening', `MRR: £${(mrrPence / 100).toFixed(2)}`, { mrrPence });
}

// Wire this into an HTTP handler (see src/server.ts) with the raw request body
// and the `stripe-signature` header — signature verification is what makes
// this safe to expose publicly.
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const event = stripeClient().webhooks.constructEvent(rawBody, signature, requireEnv('STRIPE_WEBHOOK_SECRET'));

  switch (event.type) {
    case 'customer.subscription.created':
      await logAgentRun('Ledger', 'github_actions', `Trial/subscription started: ${event.id}`, event.data.object);
      break;
    case 'invoice.payment_succeeded':
      await logAgentRun('Ledger', 'github_actions', `Payment succeeded: ${event.id}`, event.data.object);
      break;
    case 'customer.subscription.updated':
      await logAgentRun('Ledger', 'github_actions', `Subscription updated: ${event.id}`, event.data.object);
      break;
    case 'customer.subscription.deleted':
      await flag('yellow', `Cancellation: ${event.id}`);
      await logAgentRun('Ledger', 'github_actions', `Cancellation: ${event.id}`, event.data.object);
      break;
    case 'invoice.payment_failed':
      await flag('yellow', `Payment failed: ${event.id}`);
      await logAgentRun('Ledger', 'github_actions', `Payment failed: ${event.id}`, event.data.object);
      break;
    default:
      break;
  }

  await recomputeMRR();
}
