import { AGENTS, AGENT_BY_KEY, ALWAYS_ON, MEMORY_HUB, PIPELINES, freshnessFromHours, type AgentKey } from '../lib/agents';
import { hoursSince, timeAgo } from '../lib/format';
import { AGENT_ICONS } from './icons';

export interface AgentActivity {
  lastSeen?: string;
  lastSummary?: string;
}

function AgentNode({ agentKey, activity, compact }: { agentKey: AgentKey; activity: AgentActivity | undefined; compact?: boolean }) {
  const meta = AGENT_BY_KEY.get(agentKey)!;
  const Icon = AGENT_ICONS[agentKey];
  const isAlwaysOn = ALWAYS_ON.includes(agentKey);
  const fresh = freshnessFromHours(hoursSince(activity?.lastSeen));
  const statusClass = isAlwaysOn ? 'always' : fresh;
  const title = activity?.lastSummary ? `${meta.name}: ${activity.lastSummary}` : `${meta.name}: no runs logged yet`;

  return (
    <div className="agent-node" title={title}>
      <div className="agent-node-icon" style={{ background: `${meta.color}26`, color: meta.color }}>
        <Icon size={compact ? 15 : 16} />
      </div>
      <div className="agent-node-body">
        <div className="agent-node-name-row">
          <span className={`status-dot ${statusClass}`} />
          <span className="agent-node-name">{meta.name}</span>
        </div>
        {!compact && <div className="agent-node-role">{meta.role}</div>}
      </div>
      <span className="agent-node-time">{isAlwaysOn ? (activity?.lastSeen ? timeAgo(activity.lastSeen) : 'idle') : timeAgo(activity?.lastSeen)}</span>
    </div>
  );
}

export default function AgentFleet({
  activityByAgent,
  memoryCategories,
}: {
  activityByAgent: Map<string, AgentActivity>;
  memoryCategories: { category: string; count: number }[];
}) {
  const atlas = AGENT_BY_KEY.get('atlas')!;
  const AtlasIcon = AGENT_ICONS.atlas;
  const atlasActivity = activityByAgent.get(atlas.name);
  const mnemos = AGENT_BY_KEY.get(MEMORY_HUB)!;
  const MnemosIcon = AGENT_ICONS[MEMORY_HUB];

  const byName = (key: AgentKey) => activityByAgent.get(AGENT_BY_KEY.get(key)!.name);

  return (
    <div className="fleet">
      <div className="fleet-root" title={atlasActivity?.lastSummary ?? 'Atlas: no runs logged yet'}>
        <div className="fleet-root-icon" style={{ color: atlas.color }}>
          <AtlasIcon size={22} />
        </div>
        <div>
          <div className="fleet-root-name">Atlas</div>
          <div className="fleet-root-role">{atlas.role}</div>
        </div>
        <span className="agent-node-time" style={{ marginLeft: 'auto' }}>
          {timeAgo(atlasActivity?.lastSeen)}
        </span>
      </div>

      <div className="tree-drop" />

      <div className="lanes">
        {PIPELINES.map((pipeline) => (
          <div className="lane" key={pipeline.id}>
            <div className="lane-head">
              <div className="lane-title">{pipeline.title}</div>
              <div className="lane-trigger">{pipeline.trigger}</div>
            </div>
            {pipeline.rounds.map((round, i) => (
              <div key={round.label}>
                {i > 0 && <div className="connector" />}
                <div className="round">
                  <div className="round-label">{round.label}</div>
                  <div className={`round-nodes${round.parallel ? ' parallel' : ''}`}>
                    {round.agents.map((agentKey) => (
                      <AgentNode key={agentKey} agentKey={agentKey} activity={byName(agentKey)} compact />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="satellites">
        {ALWAYS_ON.map((key) => {
          const meta = AGENT_BY_KEY.get(key)!;
          const Icon = AGENT_ICONS[key];
          const activity = byName(key);
          return (
            <div className="satellite-card" key={key}>
              <div className="satellite-icon" style={{ background: `${meta.color}26`, color: meta.color }}>
                <Icon size={18} />
              </div>
              <div>
                <div className="satellite-title">
                  {meta.name}
                  <span className="status-dot always" />
                </div>
                <div className="satellite-desc">{meta.role}</div>
                <div className="satellite-meta">Last event: {timeAgo(activity?.lastSeen)}</div>
              </div>
            </div>
          );
        })}

        <div className="satellite-card">
          <div className="satellite-icon" style={{ background: `${mnemos.color}26`, color: mnemos.color }}>
            <MnemosIcon size={18} />
          </div>
          <div>
            <div className="satellite-title">{mnemos.name}</div>
            <div className="satellite-desc">{mnemos.role} — connects to all {AGENTS.length - 1} agents above.</div>
            <div className="satellite-meta">
              {memoryCategories.reduce((s, c) => s + c.count, 0)} memories across {memoryCategories.length} categories
            </div>
            {memoryCategories.length > 0 && (
              <div className="category-chips">
                {memoryCategories.map((c) => (
                  <span className="category-chip" key={c.category}>
                    {c.category} · {c.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
