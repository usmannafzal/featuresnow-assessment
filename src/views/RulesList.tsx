import { HealthBadge } from '../components/HealthBadge';
import { formatCount } from '../lib/format';
import { healthFor, useStore } from '../store/useStore';

export function RulesList() {
  const rules = useStore((s) => s.rules);
  const evalByRule = useStore((s) => s.evalByRule);
  const rows = useStore((s) => s.rows);
  const selectRule = useStore((s) => s.selectRule);
  const total = rows.length || 1;

  return (
    <section>
      <h2>Rules</h2>
      <p className="muted">
        Click a row to open the detail tab. Match means the root trace is pass. Unevaluable is counted separately, not as a miss.
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Severity</th>
              <th>Action</th>
              <th>Matches</th>
              <th>Match rate</th>
              <th>Unevaluable</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const result = evalByRule[rule.rule_id];
              const pass = result?.passCount ?? 0;
              const uneval = result?.unevaluableCount ?? 0;
              const findings = healthFor(rule);
              const rate = `${((pass / total) * 100).toFixed(2)}%`;
              return (
                <tr key={rule.rule_id} className="clickable" onClick={() => selectRule(rule.rule_id)}>
                  <td>
                    <div className="rule-id">{rule.rule_id}</div>
                    <div>{rule.name}</div>
                  </td>
                  <td>{rule.severity}</td>
                  <td>{rule.action}</td>
                  <td>{formatCount(pass)}</td>
                  <td>{rate}</td>
                  <td>{formatCount(uneval)}</td>
                  <td>
                    <HealthBadge findings={findings} />
                    <div className="health-explain">{findings.map((f) => f.explanation).join(' ')}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
