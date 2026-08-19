import { evaluateRule, resolvedParams } from '../engine/evaluator';
import { formatAmount, formatPriorAvg } from '../lib/format';
import { TraceView } from './TraceView';
import { useStore } from '../store/useStore';

const RAW_FIELDS = [
  'transaction_id',
  'txn_date_time',
  'sender_account_id',
  'receiver_account_id',
  'amount',
  'currency',
  'transaction_type',
  'merchant_city',
  'merchant_country',
  'merchant_description_condensed',
];

export function TxnDetail({ row }: { row: Record<string, unknown> }) {
  const rules = useStore((s) => s.rules);
  const paramOverrides = useStore((s) => s.paramOverrides);
  const disagree = row.features_disagree_with_chronology === true;

  return (
    <div className="stack">
      <h3>{String(row.transaction_id)}</h3>
      <h4>Raw fields</h4>
      <FieldList row={row} fields={RAW_FIELDS} />
      <h4>Derived features</h4>
      {disagree ? (
        <p className="callout">
          File-order features disagree with chronology. Provided running count is {String(row.transaction_count_as_provided)}; chronological count is {String(Number(row.sender_prior_txn_count) + 1)}. Provided avg {formatAmount(row.avg_transaction_amount_as_provided)}; chronological prior avg {formatPriorAvg(row.sender_prior_avg_amount_usd)}.
        </p>
      ) : null}
      <FieldList row={row} fields={derivedFields(row)} />
      <h4>All seven rules on this transaction</h4>
      {rules.map((rule) => {
        const trace = evaluateRule(rule, row, resolvedParams(rule, paramOverrides[rule.rule_id]));
        return <TraceView key={rule.rule_id} trace={trace} name={`${rule.rule_id} ${rule.name}`} />;
      })}
    </div>
  );
}

function derivedFields(row: Record<string, unknown>): string[] {
  const skip = new Set(RAW_FIELDS);
  return Object.keys(row).filter((key) => !skip.has(key));
}

function FieldList({ row, fields }: { row: Record<string, unknown>; fields: string[] }) {
  return (
    <dl className="fields">
      {fields.map((field) => (
        <div key={field}>
          <dt>{field}</dt>
          <dd>{renderValue(field, row[field], row)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(field: string, value: unknown, row: Record<string, unknown>) {
  if (field === 'transaction_type' && value == null) return <span className="chip">missing</span>;
  if (field === 'amount' || field === 'amount_usd') {
    if (field === 'amount_usd' && value == null) {
      return `unmapped currency (${String(row.currency)} is not in fx-rates.json)`;
    }
    return formatAmount(value);
  }
  if (field === 'sender_prior_avg_amount_usd') return formatPriorAvg(value);
  if (value === null || value === undefined) return <span className="chip">missing</span>;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return String(value);
}
