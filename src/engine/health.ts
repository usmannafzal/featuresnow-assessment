import { eachLeaf, resolveValue } from './evaluator';
import type { HealthFinding, Rule } from './types';

export type FieldMeta = {
  type: string;
  null_count: number;
  min?: number;
  max?: number;
  domain?: Record<string, number>;
  distinct_count?: number;
};

export type Metadata = {
  row_count: number;
  fields: Record<string, FieldMeta>;
};

export type MerchantRisk = {
  high_risk_receiver_ids: unknown[];
  note: string;
};

export type EvalCounts = {
  passCount: number;
  failCount: number;
  unevaluableCount: number;
  total: number;
};

function domainList(meta: FieldMeta): string[] | null {
  if (!meta.domain) return null;
  return Object.keys(meta.domain);
}

export function checkHealth(
  rule: Rule,
  metadata: Metadata,
  counts: EvalCounts,
  merchantRisk: MerchantRisk,
  params: Record<string, unknown>,
): HealthFinding[] {
  const findings: HealthFinding[] = [];
  const missing = new Set<string>();
  const impossible: string[] = [];

  eachLeaf(rule.condition, (leaf) => {
    const meta = metadata.fields[leaf.field];
    if (!meta) {
      missing.add(leaf.field);
      return;
    }
    if (leaf.operator !== 'eq' && leaf.operator !== 'in') return;
    const expected = resolveValue(leaf.value, params);
    const values = leaf.operator === 'in' && Array.isArray(expected) ? expected : [expected];
    const domain = domainList(meta);
    if (!domain) return;
    for (const value of values) {
      if (typeof value === 'string' && !domain.includes(value)) {
        impossible.push(`${leaf.field}:${String(value)}`);
      }
    }
  });

  for (const field of missing) {
    findings.push({
      status: 'missing_field',
      explanation: `Field '${field}' does not exist in the dataset. This rule cannot evaluate.`,
    });
  }

  for (const item of impossible) {
    const [field, value] = item.split(':');
    const domain = domainList(metadata.fields[field]);
    const domainText = domain ? domain.join(', ') : 'unknown';
    findings.push({
      status: 'impossible_value',
      explanation: `${field} has no value '${value}'. Domain is: ${domainText}.`,
    });
  }

  let usesMerchantRisk = false;
  eachLeaf(rule.condition, (leaf) => {
    if (leaf.field === 'merchant_risk_tier') usesMerchantRisk = true;
  });
  if (usesMerchantRisk && merchantRisk.high_risk_receiver_ids.length === 0) {
    findings.push({
      status: 'no_reference_data',
      explanation:
        "merchant-risk.json has an empty high_risk_receiver_ids list, so there is no merchant risk data to join.",
    });
  }

  if (findings.length > 0) return findings;

  const { passCount, unevaluableCount, total } = counts;
  if (total > 0 && passCount === total) {
    return [
      {
        status: 'always_fires',
        explanation: `This rule passes on all ${total.toLocaleString()} rows. The threshold is likely too loose.`,
      },
    ];
  }
  if (passCount === 0) {
    return [
      {
        status: 'never_fires',
        explanation: `This rule passes on 0 of ${total.toLocaleString()} rows. Fields and values are valid, so the thresholds may be unreachable.`,
      },
    ];
  }
  if (total > 0 && unevaluableCount / total > 0.2) {
    return [
      {
        status: 'mostly_unevaluable',
        explanation: `${unevaluableCount.toLocaleString()} of ${total.toLocaleString()} rows are unevaluable (over 20 percent). Null fields are likely the cause.`,
      },
    ];
  }
  return [
    {
      status: 'healthy',
      explanation: `Passes on ${passCount.toLocaleString()} of ${total.toLocaleString()} rows.`,
    },
  ];
}
