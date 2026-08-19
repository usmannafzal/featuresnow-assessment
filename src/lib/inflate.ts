export type CompactDataset = {
  fields: string[];
  rows: unknown[][];
};

export function inflateDataset(payload: CompactDataset): Record<string, unknown>[] {
  const { fields, rows } = payload;
  const out: Record<string, unknown>[] = [];
  for (const values of rows) {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < fields.length; i++) row[fields[i]] = values[i];
    out.push(row);
  }
  return out;
}
