import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { formatAmount, formatCount } from '../lib/format';
import { useStore } from '../store/useStore';

type Props = {
  rows: Record<string, unknown>[];
};

export function TxnTable({ rows }: Props) {
  const selectedTxnId = useStore((s) => s.selectedTxnId);
  const selectTxn = useStore((s) => s.selectTxn);

  return (
    <div className="grid-table">
      <div className="grid-head">
        <span>ID</span>
        <span>Time</span>
        <span>Type</span>
        <span>Country</span>
        <span>Amount</span>
        <span>USD</span>
      </div>
      <FixedSizeList height={420} itemCount={rows.length} itemSize={36} width="100%" itemData={{ rows, selectedTxnId, selectTxn }}>
        {Row}
      </FixedSizeList>
    </div>
  );
}

function Row({ index, style, data }: ListChildComponentProps<{
  rows: Record<string, unknown>[];
  selectedTxnId: string | null;
  selectTxn: (id: string) => void;
}>) {
  const row = data.rows[index];
  const id = String(row.transaction_id);
  const type = row.transaction_type;
  const selected = data.selectedTxnId === id;
  return (
    <button
      type="button"
      style={style}
      className={`grid-row ${selected ? 'selected' : ''}`}
      onClick={() => data.selectTxn(id)}
    >
      <span>{id}</span>
      <span>{String(row.txn_date_time)}</span>
      <span>{type == null ? <span className="chip">missing</span> : String(type)}</span>
      <span>{String(row.merchant_country)}</span>
      <span>{formatAmount(row.amount)}</span>
      <span>
        {row.amount_usd == null ? (
          <span title="Currency is not in src/rules/fx-rates.json">unmapped currency</span>
        ) : (
          formatAmount(row.amount_usd)
        )}
      </span>
    </button>
  );
}

export function TableMeta({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="muted">
      Showing {formatCount(shown)} of {formatCount(total)} transactions. Scroll is windowed; not all rows are in the DOM.
    </p>
  );
}
