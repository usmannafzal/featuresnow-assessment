import type { EvalStatus, UnevaluableReason } from './types';

export type CompareResult = { status: EvalStatus; reason?: UnevaluableReason };
export type CompareFn = (actual: unknown, expected: unknown) => CompareResult;

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

function numeric(
  actual: unknown,
  expected: unknown,
  cmp: (a: number, b: number) => boolean,
): CompareResult {
  if (isNullish(actual)) return { status: 'unevaluable', reason: 'value_null' };
  if (typeof actual !== 'number' || typeof expected !== 'number' || Number.isNaN(actual) || Number.isNaN(expected)) {
    return { status: 'unevaluable', reason: 'type_mismatch' };
  }
  return { status: cmp(actual, expected) ? 'pass' : 'fail' };
}

function equalish(actual: unknown, expected: unknown): CompareResult {
  if (isNullish(actual)) return { status: 'unevaluable', reason: 'value_null' };
  if (isNullish(expected)) return { status: 'unevaluable', reason: 'type_mismatch' };
  return { status: actual === expected ? 'pass' : 'fail' };
}

export const operators: Record<string, CompareFn> = {
  lt: (a, e) => numeric(a, e, (x, y) => x < y),
  lte: (a, e) => numeric(a, e, (x, y) => x <= y),
  gt: (a, e) => numeric(a, e, (x, y) => x > y),
  gte: (a, e) => numeric(a, e, (x, y) => x >= y),
  eq: equalish,
  neq: (a, e) => {
    const result = equalish(a, e);
    if (result.status !== 'pass' && result.status !== 'fail') return result;
    return { status: result.status === 'pass' ? 'fail' : 'pass' };
  },
  in: (a, e) => {
    if (isNullish(a)) return { status: 'unevaluable', reason: 'value_null' };
    if (!Array.isArray(e)) return { status: 'unevaluable', reason: 'type_mismatch' };
    return { status: e.includes(a) ? 'pass' : 'fail' };
  },
  not_in: (a, e) => {
    if (isNullish(a)) return { status: 'unevaluable', reason: 'value_null' };
    if (!Array.isArray(e)) return { status: 'unevaluable', reason: 'type_mismatch' };
    return { status: e.includes(a) ? 'fail' : 'pass' };
  },
};
