import { ConditionTree } from '../components/ConditionTree';
import { FieldHistogram } from '../components/FieldHistogram';
import { HealthBadge } from '../components/HealthBadge';
import { eachLeaf, resolveValue, resolvedParams } from '../engine/evaluator';
import { statsFromTraces } from '../lib/clause-stats';
import { formatCount } from '../lib/format';
import { primaryNumericField } from '../lib/histogram';
import { healthFor, useStore } from '../store/useStore';

export function RuleDetail() {
  const rules = useStore((s) => s.rules);
  const selectedRuleId = useStore((s) => s.selectedRuleId);
  const paramOverrides = useStore((s) => s.paramOverrides);
  const evalByRule = useStore((s) => s.evalByRule);
  const rows = useStore((s) => s.rows);
  const setParam = useStore((s) => s.setParam);
  const evaluating = useStore((s) => s.evaluating);
  const rule = rules.find((r) => r.rule_id === selectedRuleId);
  if (!rule) return <p>No rule selected.</p>;

  const params = resolvedParams(rule, paramOverrides[rule.rule_id]);
  const result = evalByRule[rule.rule_id];
  const stats = result ? statsFromTraces(result.traces) : null;
  const findings = healthFor(rule);
  const field = primaryNumericField(rule.condition);
  const thresholds: { label: string; value: number }[] = [];
  if (field) {
    eachLeaf(rule.condition, (leaf) => {
      if (leaf.field !== field) return;
      const expected = resolveValue(leaf.value, params);
      if (typeof expected === 'number') {
        const label = typeof leaf.value === 'string' ? leaf.value.slice(1) : String(expected);
        thresholds.push({ label, value: expected });
      }
    });
  }

  return (
    <section className="stack">
      <div>
        <h2>
          {rule.rule_id}: {rule.name}
        </h2>
        <p>{rule.description}</p>
        <HealthBadge findings={findings} />
        <p className="health-explain">{findings.map((f) => f.explanation).join(' ')}</p>
        {rule.limitations ? <p className="muted">Limitation: {rule.limitations}</p> : null}
        <p>
          Matches {formatCount(result?.passCount ?? 0)} of {formatCount(rows.length)}
          {evaluating ? ' (updating)' : ''}
        </p>
      </div>

      <div className="panel">
        <h3>Parameters</h3>
        {Object.entries(rule.parameters).map(([name, spec]) => {
          const value = params[name];
          if (spec.type !== 'number' || typeof value !== 'number') {
            return (
              <div key={name} className="param-row">
                <label>{name}</label>
                <span>{JSON.stringify(value)}</span>
              </div>
            );
          }
          return (
            <div key={name} className="param-row">
              <label htmlFor={name}>
                {name}: {value}
              </label>
              <input
                id={name}
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={value}
                onChange={(e) => setParam(rule.rule_id, name, Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>

      <div className="panel">{stats ? <ConditionTree stats={stats} /> : <p>Evaluating clauses.</p>}</div>

      {field ? (
        <div className="panel">
          <FieldHistogram rows={rows} field={field} thresholds={thresholds} />
        </div>
      ) : (
        <div className="panel">
          <p className="muted">No numeric field to chart for this rule.</p>
        </div>
      )}
    </section>
  );
}
