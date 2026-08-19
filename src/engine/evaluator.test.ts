import { describe, expect, it } from 'vitest';
import { operators } from './operators';
import { defaultParams, evaluateCondition, evaluateRule, resolveValue } from './evaluator';
import rules from '../rules/rules.json';
import type { Rule } from './types';

const allRules = rules as unknown as Rule[];
const rule006 = allRules.find((r) => r.rule_id === 'RULE_006') as Rule;

describe('operators', () => {
  const numericOps = ['lt', 'lte', 'gt', 'gte'] as const;

  it('compares numbers', () => {
    expect(operators.lt(3, 5).status).toBe('pass');
    expect(operators.lt(5, 3).status).toBe('fail');
    expect(operators.lte(5, 5).status).toBe('pass');
    expect(operators.gt(5, 3).status).toBe('pass');
    expect(operators.gte(5, 5).status).toBe('pass');
    expect(operators.eq(5, 5).status).toBe('pass');
    expect(operators.neq(5, 4).status).toBe('pass');
    expect(operators.in('a', ['a', 'b']).status).toBe('pass');
    expect(operators.in('c', ['a', 'b']).status).toBe('fail');
    expect(operators.not_in('a', ['a', 'b']).status).toBe('fail');
  });

  it('treats null and undefined as unevaluable, not fail', () => {
    for (const name of [...numericOps, 'eq', 'neq', 'in', 'not_in']) {
      expect(operators[name](null, 1).status).toBe('unevaluable');
      expect(operators[name](null, 1).reason).toBe('value_null');
      expect(operators[name](undefined, 1).status).toBe('unevaluable');
    }
  });

  it('rejects non-numbers on numeric operators', () => {
    expect(operators.lt('x', 1)).toEqual({ status: 'unevaluable', reason: 'type_mismatch' });
    expect(operators.gt(1, 'x')).toEqual({ status: 'unevaluable', reason: 'type_mismatch' });
  });

  it('rejects a non-array on in / not_in', () => {
    expect(operators.in('a', 'a')).toEqual({ status: 'unevaluable', reason: 'type_mismatch' });
    expect(operators.not_in('a', 1)).toEqual({ status: 'unevaluable', reason: 'type_mismatch' });
  });
});

describe('$param substitution', () => {
  it('resolves $name from params', () => {
    expect(resolveValue('$min_amount_usd', { min_amount_usd: 10000 })).toBe(10000);
    expect(resolveValue(22, { start_hour: 22 })).toBe(22);
  });

  it('returns undefined when the parameter is missing', () => {
    expect(resolveValue('$nope', { min_amount_usd: 1 })).toBeUndefined();
  });
});

describe('AND / OR three-valued logic', () => {
  const leaf = (field: string, operator: string, value: unknown) => ({ field, operator, value });

  it('AND: fail wins, else unevaluable, else pass', () => {
    const row = { a: 1, b: 2, c: null as number | null };
    const passPass = evaluateCondition(
      { op: 'AND', children: [leaf('a', 'eq', 1), leaf('b', 'eq', 2)] },
      row,
      {},
    );
    expect(passPass.status).toBe('pass');
    const passFail = evaluateCondition(
      { op: 'AND', children: [leaf('a', 'eq', 1), leaf('b', 'eq', 9)] },
      row,
      {},
    );
    expect(passFail.status).toBe('fail');
    const passNull = evaluateCondition(
      { op: 'AND', children: [leaf('a', 'eq', 1), leaf('c', 'eq', 1)] },
      row,
      {},
    );
    expect(passNull.status).toBe('unevaluable');
    const failNull = evaluateCondition(
      { op: 'AND', children: [leaf('b', 'eq', 9), leaf('c', 'eq', 1)] },
      row,
      {},
    );
    expect(failNull.status).toBe('fail');
  });

  it('OR: pass wins, else unevaluable, else fail', () => {
    const row = { a: 1, b: 2, c: null as number | null };
    const passFail = evaluateCondition(
      { op: 'OR', children: [leaf('a', 'eq', 1), leaf('b', 'eq', 9)] },
      row,
      {},
    );
    expect(passFail.status).toBe('pass');
    const failFail = evaluateCondition(
      { op: 'OR', children: [leaf('a', 'eq', 9), leaf('b', 'eq', 9)] },
      row,
      {},
    );
    expect(failFail.status).toBe('fail');
    const failNull = evaluateCondition(
      { op: 'OR', children: [leaf('a', 'eq', 9), leaf('c', 'eq', 1)] },
      row,
      {},
    );
    expect(failNull.status).toBe('unevaluable');
    const passNull = evaluateCondition(
      { op: 'OR', children: [leaf('a', 'eq', 1), leaf('c', 'eq', 1)] },
      row,
      {},
    );
    expect(passNull.status).toBe('pass');
  });

  it('nests AND inside OR', () => {
    const row = { a: 1, b: 2, c: 3 };
    const trace = evaluateCondition(
      {
        op: 'OR',
        children: [
          { op: 'AND', children: [leaf('a', 'eq', 9), leaf('b', 'eq', 2)] },
          leaf('c', 'eq', 3),
        ],
      },
      row,
      {},
    );
    expect(trace.status).toBe('pass');
    expect(trace.kind).toBe('group');
    if (trace.kind === 'group') {
      expect(trace.children[0].status).toBe('fail');
      expect(trace.children[1].status).toBe('pass');
    }
  });
});

describe('leaf reasons on real field names', () => {
  const row = { amount_usd: 10, transaction_type: null as string | null };

  it('field_missing', () => {
    const trace = evaluateCondition(
      { field: 'merchant_risk_tier', operator: 'eq', value: 'high' },
      row,
      {},
    );
    expect(trace).toMatchObject({ kind: 'leaf', status: 'unevaluable', reason: 'field_missing' });
  });

  it('value_null', () => {
    const trace = evaluateCondition(
      { field: 'transaction_type', operator: 'eq', value: 'online' },
      row,
      {},
    );
    expect(trace).toMatchObject({ kind: 'leaf', status: 'unevaluable', reason: 'value_null' });
  });

  it('type_mismatch', () => {
    const trace = evaluateCondition(
      { field: 'transaction_type', operator: 'gt', value: 5 },
      { transaction_type: 'online' },
      {},
    );
    expect(trace).toMatchObject({ kind: 'leaf', status: 'unevaluable', reason: 'type_mismatch' });
  });
});

describe('RULE_006 end-to-end', () => {
  it('returns the full overnight OR trace', () => {
    const row = { hour_of_day: 23 };
    const trace = evaluateRule(rule006, row, defaultParams(rule006));
    expect(trace).toEqual({
      kind: 'group',
      op: 'OR',
      status: 'pass',
      children: [
        {
          kind: 'leaf',
          field: 'hour_of_day',
          operator: 'gte',
          expected: 22,
          actual: 23,
          status: 'pass',
        },
        {
          kind: 'leaf',
          field: 'hour_of_day',
          operator: 'lte',
          expected: 6,
          actual: 23,
          status: 'fail',
        },
      ],
    });
  });
});
