import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import rulesJson from '../rules/rules.json';
import { defaultParams, evaluateRule, evaluateDataset } from './evaluator';
import { checkHealth, type Metadata, type MerchantRisk } from './health';
import { inflateDataset, type CompactDataset } from '../lib/inflate';
import type { Rule } from './types';

const rules = rulesJson as unknown as Rule[];
const payload = JSON.parse(readFileSync('public/data/dataset.json', 'utf8')) as CompactDataset;
const rows = inflateDataset(payload);
const metadata = JSON.parse(readFileSync('public/data/metadata.json', 'utf8')) as Metadata;
const merchantRisk = JSON.parse(readFileSync('public/data/merchant-risk.json', 'utf8')) as MerchantRisk;

describe('dataset evaluation', () => {
  const results = rules.map((rule) => {
    const params = defaultParams(rule);
    const evaluated = evaluateDataset(rule, rows, params);
    const health = checkHealth(
      rule,
      metadata,
      {
        passCount: evaluated.passCount,
        failCount: evaluated.failCount,
        unevaluableCount: evaluated.unevaluableCount,
        total: rows.length,
      },
      merchantRisk,
      params,
    );
    return { rule, evaluated, health };
  });

  it('prints health and one full-dataset timing', () => {
    for (const item of results) {
      console.log(
        item.rule.rule_id,
        item.health.map((h) => h.status).join('+'),
        `pass=${item.evaluated.passCount}`,
        `uneval=${item.evaluated.unevaluableCount}`,
        `${item.evaluated.durationMs.toFixed(1)}ms`,
      );
      for (const finding of item.health) console.log('  ', finding.explanation);
    }
    expect(results[0].evaluated.durationMs).toBeGreaterThan(0);
  });

  it('002, 003, 005, 006 fire on some but not all rows', () => {
    for (const id of ['RULE_002', 'RULE_003', 'RULE_005', 'RULE_006']) {
      const item = results.find((r) => r.rule.rule_id === id);
      expect(item?.evaluated.passCount, id).toBeGreaterThan(0);
      expect(item?.evaluated.passCount, id).toBeLessThan(rows.length);
    }
  });

  it('flags RULE_004 as missing_field plus no_reference_data', () => {
    const item = results.find((r) => r.rule.rule_id === 'RULE_004');
    const statuses = item?.health.map((h) => h.status) ?? [];
    expect(statuses).toContain('missing_field');
    expect(statuses).toContain('no_reference_data');
  });

  it('flags RULE_007 as impossible_value and names the type domain', () => {
    const item = results.find((r) => r.rule.rule_id === 'RULE_007');
    expect(item?.health[0]?.status).toBe('impossible_value');
    expect(item?.health[0]?.explanation).toContain('atm_withdrawal');
    expect(item?.health[0]?.explanation).toContain('online');
    expect(item?.health[0]?.explanation).toContain('contactless');
  });

  it('prints RULE_005 against one real row', () => {
    const rule = rules.find((r) => r.rule_id === 'RULE_005') as Rule;
    const row = rows.find((r) => r.is_cross_border) ?? rows[0];
    const trace = evaluateRule(rule, row, defaultParams(rule));
    console.log('RULE_005 row', row.transaction_id, JSON.stringify(trace, null, 2));
    expect(trace.kind).toBe('group');
  });

  it('prints RULE_007 unevaluable trace on a row with missing type', () => {
    const rule = rules.find((r) => r.rule_id === 'RULE_007') as Rule;
    const row =
      rows.find((r) => r.transaction_type == null && typeof r.amount_usd === 'number' && r.amount_usd >= 500) ??
      rows.find((r) => r.transaction_type == null) ??
      rows[0];
    const trace = evaluateRule(rule, row, defaultParams(rule));
    console.log('RULE_007 row', row.transaction_id, JSON.stringify(trace, null, 2));
    expect(trace.kind).toBe('group');
    if (trace.kind === 'group') {
      expect(trace.children[0]).toMatchObject({ reason: 'value_null', status: 'unevaluable' });
    }
  });
});
