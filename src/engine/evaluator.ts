import { operators } from './operators';
import type { Condition, EvalStatus, GroupCondition, LeafCondition, Rule, Trace } from './types';

export function isGroup(condition: Condition): condition is GroupCondition {
  return 'op' in condition;
}

export function resolveValue(value: unknown, params: Record<string, unknown>): unknown {
  if (typeof value !== 'string' || !value.startsWith('$')) return value;
  const name = value.slice(1);
  if (!(name in params)) return undefined;
  return params[name];
}

export function defaultParams(rule: Rule): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(rule.parameters)) {
    params[name] = spec.default;
  }
  return params;
}

export function resolvedParams(
  rule: Rule,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...defaultParams(rule), ...overrides };
}

export function eachLeaf(condition: Condition, visit: (leaf: LeafCondition) => void): void {
  if (isGroup(condition)) {
    for (const child of condition.children) eachLeaf(child, visit);
  } else {
    visit(condition);
  }
}

function combineAnd(statuses: EvalStatus[]): EvalStatus {
  let unevaluable = false;
  for (const status of statuses) {
    if (status === 'fail') return 'fail';
    if (status === 'unevaluable') unevaluable = true;
  }
  return unevaluable ? 'unevaluable' : 'pass';
}

function combineOr(statuses: EvalStatus[]): EvalStatus {
  let unevaluable = false;
  for (const status of statuses) {
    if (status === 'pass') return 'pass';
    if (status === 'unevaluable') unevaluable = true;
  }
  return unevaluable ? 'unevaluable' : 'fail';
}

function evalLeaf(leaf: LeafCondition, row: Record<string, unknown>, params: Record<string, unknown>): Trace {
  const expected = resolveValue(leaf.value, params);
  if (!(leaf.field in row)) {
    return {
      kind: 'leaf',
      field: leaf.field,
      operator: leaf.operator,
      expected,
      actual: undefined,
      status: 'unevaluable',
      reason: 'field_missing',
    };
  }
  const actual = row[leaf.field];
  const compare = operators[leaf.operator];
  if (!compare) {
    return {
      kind: 'leaf',
      field: leaf.field,
      operator: leaf.operator,
      expected,
      actual,
      status: 'unevaluable',
      reason: 'type_mismatch',
    };
  }
  const result = compare(actual, expected);
  return {
    kind: 'leaf',
    field: leaf.field,
    operator: leaf.operator,
    expected,
    actual,
    status: result.status,
    reason: result.reason,
  };
}

export function evaluateCondition(
  condition: Condition,
  row: Record<string, unknown>,
  params: Record<string, unknown>,
): Trace {
  if (!isGroup(condition)) return evalLeaf(condition, row, params);
  const children: Trace[] = [];
  for (const child of condition.children) {
    children.push(evaluateCondition(child, row, params));
  }
  const statuses: EvalStatus[] = [];
  for (const child of children) statuses.push(child.status);
  const status = condition.op === 'AND' ? combineAnd(statuses) : combineOr(statuses);
  return { kind: 'group', op: condition.op, status, children };
}

export function evaluateRule(
  rule: Rule,
  row: Record<string, unknown>,
  params: Record<string, unknown> = defaultParams(rule),
): Trace {
  return evaluateCondition(rule.condition, row, params);
}

export type DatasetEval = {
  traces: Trace[];
  passCount: number;
  failCount: number;
  unevaluableCount: number;
  passIds: string[];
  durationMs: number;
};

export function evaluateDataset(
  rule: Rule,
  rows: Record<string, unknown>[],
  params: Record<string, unknown>,
): DatasetEval {
  const started = performance.now();
  const traces = [];
  const passIds = [];
  let passCount = 0;
  let failCount = 0;
  let unevaluableCount = 0;
  for (const row of rows) {
    const trace = evaluateRule(rule, row, params);
    traces.push(trace);
    if (trace.status === 'pass') {
      passCount += 1;
      passIds.push(String(row.transaction_id));
    } else if (trace.status === 'fail') {
      failCount += 1;
    } else {
      unevaluableCount += 1;
    }
  }
  return {
    traces,
    passCount,
    failCount,
    unevaluableCount,
    passIds,
    durationMs: performance.now() - started,
  };
}
