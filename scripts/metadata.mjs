export function buildMetadata(rows) {
  const fields = {};
  for (const field of Object.keys(rows[0])) {
    let nullCount = 0;
    let type = null;
    let min = Infinity;
    let max = -Infinity;
    const domain = new Map();
    for (const row of rows) {
      const value = row[field];
      if (value === null || value === undefined) {
        nullCount += 1;
        continue;
      }
      const t = typeof value;
      if (type === null) type = t;
      if (t === 'number') {
        if (value < min) min = value;
        if (value > max) max = value;
      } else {
        const key = String(value);
        domain.set(key, (domain.get(key) || 0) + 1);
      }
    }
    const entry = { type: type ?? 'null', null_count: nullCount };
    if (type === 'number') {
      entry.min = min;
      entry.max = max;
    } else if (domain.size > 0 && domain.size < 50) {
      entry.domain = Object.fromEntries([...domain.entries()].sort((a, b) => b[1] - a[1]));
    } else if (domain.size >= 50) {
      entry.distinct_count = domain.size;
    }
    fields[field] = entry;
  }
  return { row_count: rows.length, fields };
}

export function countNulls(rows) {
  const counts = {};
  for (const field of Object.keys(rows[0])) {
    let n = 0;
    for (const row of rows) {
      if (row[field] === null || row[field] === undefined) n += 1;
    }
    counts[field] = n;
  }
  return counts;
}
