import { resolvedParams } from '../engine/evaluator';
import { formatCount } from '../lib/format';
import { useStore } from '../store/useStore';

const CAP = 100;

export function ParameterDiff() {
  const selectedRuleId = useStore((s) => s.selectedRuleId);
  const rules = useStore((s) => s.rules);
  const snapshot = useStore((s) => s.snapshot);
  const snapshotMatches = useStore((s) => s.snapshotMatches);
  const evalByRule = useStore((s) => s.evalByRule);
  const paramOverrides = useStore((s) => s.paramOverrides);
  const rule = rules.find((r) => r.rule_id === selectedRuleId);
  const current = evalByRule[selectedRuleId];
  if (!rule || !current) return <p>Select a rule first.</p>;

  const params = resolvedParams(rule, paramOverrides[rule.rule_id]);
  const currentSet = new Set(current.passIds);
  let added: string[] = [];
  let removed: string[] = [];
  let kept: string[] = [];
  if (snapshot && snapshot.ruleId === selectedRuleId) {
    const before = new Set(snapshot.passIds);
    for (const id of current.passIds) {
      if (before.has(id)) kept.push(id);
      else added.push(id);
    }
    for (const id of snapshot.passIds) {
      if (!currentSet.has(id)) removed.push(id);
    }
  }

  return (
    <section className="stack">
      <h2>Parameter diff</h2>
      <p>
        Snapshot the current match set for {rule.rule_id}, change a slider on the detail tab, then return here.
      </p>
      <p>Current params: {JSON.stringify(params)}</p>
      <p>Current matches: {formatCount(current.passCount)}</p>
      <button type="button" onClick={snapshotMatches}>
        Snapshot current matches
      </button>
      {!snapshot || snapshot.ruleId !== selectedRuleId ? (
        <p className="muted">No snapshot yet for this rule.</p>
      ) : (
        <div className="diff-cols">
          <IdList title="Newly matching" ids={added} />
          <IdList title="No longer matching" ids={removed} />
          <IdList title="Unchanged" ids={kept} />
        </div>
      )}
    </section>
  );
}

function IdList({ title, ids }: { title: string; ids: string[] }) {
  const shown = ids.slice(0, CAP);
  const rest = ids.length - shown.length;
  return (
    <div className="panel">
      <h3>
        {title}: {formatCount(ids.length)}
      </h3>
      <ul className="id-list">
        {shown.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
      {rest > 0 ? <p className="muted">{formatCount(rest)} more not shown.</p> : null}
    </div>
  );
}
