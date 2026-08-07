export interface ExperimentRow {
  id: string;
  hypothesis: string | null;
  test_design: string | null;
  success_metric: string | null;
  status: string;
  result: string | null;
}

export default function ExperimentsList({ experiments }: { experiments: ExperimentRow[] }) {
  const running = experiments.filter((e) => e.status === 'running');

  if (!running.length) {
    return <div className="empty-note">None running. Forge proposes one when triggered.</div>;
  }

  return (
    <div className="experiments-list">
      {running.map((e) => (
        <div className="experiment-card" key={e.id}>
          <div className="experiment-hypothesis">{e.hypothesis}</div>
          <div className="experiment-meta">
            {e.test_design && (
              <span>
                <b>Test:</b> {e.test_design}
              </span>
            )}
            {e.success_metric && (
              <span>
                <b>Metric:</b> {e.success_metric}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
