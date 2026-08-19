export function formatAmount(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'missing';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export function formatPriorAvg(value: unknown): string {
  if (value === null || value === undefined) return 'no prior history';
  return formatAmount(value);
}

export function formatDateTime(txnDateTime: unknown, txnTs: unknown): string {
  if (typeof txnDateTime === 'string') return txnDateTime;
  if (typeof txnTs === 'number') return new Date(txnTs).toISOString();
  return 'missing';
}

export function nullChip(value: unknown): boolean {
  return value === null || value === undefined;
}
