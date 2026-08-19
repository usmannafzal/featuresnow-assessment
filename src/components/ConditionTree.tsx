import { formatCount } from '../lib/format';
import type { ClauseStats } from '../lib/clause-stats';

function clauseLabel(stats: ClauseStats, index: number): string {
  if (stats.kind === 'leaf') {
    return `${stats.field} ${stats.operator} ${JSON.stringify(stats.expected)}`;
  }
  return `${stats.op} group ${index + 1}`;
}

export function ConditionTree({ stats }: { stats: ClauseStats }) {
  return (
    <div>
      <h3>Condition tree</h3>
      <p className="muted">
        Combined {stats.op ?? 'rule'} passes on {formatCount(stats.pass)} rows, fails on {formatCount(stats.fail)}, unevaluable on {formatCount(stats.unevaluable)}.
      </p>
      <ClauseNode stats={stats} index={0} depth={0} />
    </div>
  );
}

function ClauseNode({ stats, index, depth }: { stats: ClauseStats; index: number; depth: number }) {
  const summary = `passes on ${formatCount(stats.pass)} rows, fails on ${formatCount(stats.fail)}, unevaluable on ${formatCount(stats.unevaluable)}`;
  return (
    <div className="clause" style={{ marginLeft: depth * 16 }}>
      <div>
        <span className="clause-label">{clauseLabel(stats, index)}</span>
        <span className="muted"> {summary}</span>
      </div>
      {stats.children?.map((child, i) => (
        <ClauseNode key={i} stats={child} index={i} depth={depth + 1} />
      ))}
    </div>
  );
}
