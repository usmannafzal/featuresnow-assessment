import type { Trace } from '../engine/types';

export type ClauseStats = {
  kind: 'leaf' | 'group';
  op?: 'AND' | 'OR';
  field?: string;
  operator?: string;
  expected?: unknown;
  pass: number;
  fail: number;
  unevaluable: number;
  children?: ClauseStats[];
};

function emptyStats(trace: Trace): ClauseStats {
  if (trace.kind === 'leaf') {
    return {
      kind: 'leaf',
      field: trace.field,
      operator: trace.operator,
      expected: trace.expected,
      pass: 0,
      fail: 0,
      unevaluable: 0,
    };
  }
  const children: ClauseStats[] = [];
  for (const child of trace.children) children.push(emptyStats(child));
  return { kind: 'group', op: trace.op, pass: 0, fail: 0, unevaluable: 0, children };
}

function addTrace(stats: ClauseStats, trace: Trace): void {
  if (trace.status === 'pass') stats.pass += 1;
  else if (trace.status === 'fail') stats.fail += 1;
  else stats.unevaluable += 1;
  if (stats.kind === 'group' && trace.kind === 'group' && stats.children) {
    for (let i = 0; i < stats.children.length; i++) addTrace(stats.children[i], trace.children[i]);
  }
}

export function statsFromTraces(traces: Trace[]): ClauseStats | null {
  if (traces.length === 0) return null;
  const stats = emptyStats(traces[0]);
  for (const trace of traces) addTrace(stats, trace);
  return stats;
}
