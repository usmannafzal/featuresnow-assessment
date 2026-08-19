export type Filters = {
  sender: string;
  transactionType: string;
  country: string;
  amountMin: string;
  amountMax: string;
  dateFrom: string;
  dateTo: string;
};

export const emptyFilters: Filters = {
  sender: '',
  transactionType: '',
  country: '',
  amountMin: '',
  amountMax: '',
  dateFrom: '',
  dateTo: '',
};

type Step = { name: string; active: boolean; pred: (row: Record<string, unknown>) => boolean };

function parseNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseDayStart(text: string): number | null {
  if (text.trim() === '') return null;
  const ts = new Date(text + 'T00:00:00').getTime();
  return Number.isNaN(ts) ? null : ts;
}

function parseDayEnd(text: string): number | null {
  if (text.trim() === '') return null;
  const ts = new Date(text + 'T23:59:59').getTime();
  return Number.isNaN(ts) ? null : ts;
}

export function applyFilters(
  rows: Record<string, unknown>[],
  filters: Filters,
): { rows: Record<string, unknown>[]; emptyReason: string | null } {
  const amountMin = parseNumber(filters.amountMin);
  const amountMax = parseNumber(filters.amountMax);
  const dateFrom = parseDayStart(filters.dateFrom);
  const dateTo = parseDayEnd(filters.dateTo);
  const sender = filters.sender.trim().toLowerCase();

  const steps: Step[] = [
    {
      name: 'sender',
      active: sender !== '',
      pred: (row) => String(row.sender_account_id).toLowerCase().includes(sender),
    },
    {
      name: 'transaction type',
      active: filters.transactionType !== '',
      pred: (row) =>
        filters.transactionType === '__missing__'
          ? row.transaction_type == null
          : row.transaction_type === filters.transactionType,
    },
    {
      name: 'country',
      active: filters.country !== '',
      pred: (row) => row.merchant_country === filters.country,
    },
    {
      name: 'amount min',
      active: amountMin !== null,
      pred: (row) => typeof row.amount === 'number' && row.amount >= (amountMin as number),
    },
    {
      name: 'amount max',
      active: amountMax !== null,
      pred: (row) => typeof row.amount === 'number' && row.amount <= (amountMax as number),
    },
    {
      name: 'date from',
      active: dateFrom !== null,
      pred: (row) => typeof row.txn_ts === 'number' && row.txn_ts >= (dateFrom as number),
    },
    {
      name: 'date to',
      active: dateTo !== null,
      pred: (row) => typeof row.txn_ts === 'number' && row.txn_ts <= (dateTo as number),
    },
  ];

  let current = rows;
  for (const step of steps) {
    if (!step.active) continue;
    const next: Record<string, unknown>[] = [];
    for (const row of current) if (step.pred(row)) next.push(row);
    if (next.length === 0) {
      return {
        rows: [],
        emptyReason: `Filter '${step.name}' excluded all remaining rows (${current.length.toLocaleString()} left before it).`,
      };
    }
    current = next;
  }
  return { rows: current, emptyReason: null };
}
