import { formatGBP } from '../lib/format';

const STAGES = [
  { stage: 1, floor: 0, ceil: null as number | null, label: 'Stage 1 — pre-first-sale', desc: 'Max outreach volume, learn every objection.' },
  { stage: 2, floor: 0, ceil: 1000, label: 'Stage 2 — first sale → £1k', desc: 'Double down on what closed, gather testimonials.' },
  { stage: 3, floor: 1000, ceil: 5000, label: 'Stage 3 — £1k → £5k', desc: 'Scale winning channels, SEO compounding begins.' },
  { stage: 4, floor: 5000, ceil: 10000, label: 'Stage 4 — £5k → £10k', desc: 'Paid experiments, partnerships.' },
  { stage: 5, floor: 10000, ceil: 20000, label: 'Stage 5 — £10k → £20k', desc: 'Retention focus, kill losers, efficiency mode.' },
];

function stageFromMrr(mrr: number) {
  if (mrr >= 10000) return STAGES[4];
  if (mrr >= 5000) return STAGES[3];
  if (mrr >= 1000) return STAGES[2];
  if (mrr > 0) return STAGES[1];
  return STAGES[0];
}

export default function Hero({ mrr }: { mrr: number }) {
  const stage = stageFromMrr(mrr);
  const hasCeiling = stage.ceil !== null;
  const progressPct = hasCeiling ? Math.min(100, Math.max(2, (mrr / (stage.ceil as number)) * 100)) : 0;

  return (
    <section className="hero">
      <div className="hero-left">
        <div className="hero-stage">{stage.label}</div>
        <div className="hero-mrr">{formatGBP(mrr)} MRR</div>
        <div className="hero-caption">{stage.desc}</div>
      </div>
      <div className="hero-progress">
        <div className="hero-progress-labels">
          <span>£0</span>
          <span>{hasCeiling ? `Next: ${formatGBP(stage.ceil as number)}` : 'Awaiting first sale'}</span>
        </div>
        <div className="hero-progress-track">
          <div className="hero-progress-fill" style={{ width: `${hasCeiling ? progressPct : 0}%` }} />
        </div>
      </div>
    </section>
  );
}
