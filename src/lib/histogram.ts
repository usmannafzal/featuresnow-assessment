export type Bucket = {
  start: number;
  end: number;
  mid: number;
  count: number;
};

export type Histogram = {
  buckets: Bucket[];
  min: number;
  max: number;
  excludedNulls: number;
  sampleCount: number;
};

export function buildHistogram(
  rows: Record<string, unknown>[],
  field: string,
  bucketCount: number,
): Histogram {
  const values: number[] = [];
  let excludedNulls = 0;
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined) {
      excludedNulls += 1;
    } else if (typeof value === 'number' && !Number.isNaN(value)) {
      values.push(value);
    }
  }

  if (values.length === 0) {
    return { buckets: [], min: 0, max: 0, excludedNulls, sampleCount: 0 };
  }

  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min || 1;
  const width = span / bucketCount;
  const buckets: Bucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const start = min + i * width;
    const end = i === bucketCount - 1 ? max : min + (i + 1) * width;
    buckets.push({ start, end, mid: (start + end) / 2, count: 0 });
  }
  for (const value of values) {
    let idx = Math.floor((value - min) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count += 1;
  }
  return { buckets, min, max, excludedNulls, sampleCount: values.length };
}

export function primaryNumericField(condition: { op: string; children: unknown[] } | Record<string, unknown>): string | null {
  const stack: unknown[] = [condition];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    const rec = node as { op?: string; children?: unknown[]; field?: string; operator?: string };
    if (rec.children) {
      for (let i = rec.children.length - 1; i >= 0; i--) stack.push(rec.children[i]);
      continue;
    }
    if (typeof rec.field === 'string') {
      const numericOps = rec.operator === 'lt' || rec.operator === 'lte' || rec.operator === 'gt' || rec.operator === 'gte';
      if (numericOps) return rec.field;
    }
  }
  return null;
}
