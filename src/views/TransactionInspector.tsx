import { applyFilters } from '../lib/filters';
import { TableMeta, TxnTable } from '../components/TxnTable';
import { TxnDetail } from '../components/TxnDetail';
import { useStore } from '../store/useStore';

export function TransactionInspector() {
  const rows = useStore((s) => s.rows);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const metadata = useStore((s) => s.metadata);
  const selectedTxnId = useStore((s) => s.selectedTxnId);
  const filtered = applyFilters(rows, filters);
  const selected = filtered.rows.find((row) => row.transaction_id === selectedTxnId) ?? null;
  const types = metadata?.fields.transaction_type.domain ?? {};
  const countries = metadata?.fields.merchant_country.domain ?? {};

  return (
    <section className="inspector">
      <div>
        <h2>Transactions</h2>
        <div className="filters">
          <label>
            Sender
            <input value={filters.sender} onChange={(e) => setFilter({ sender: e.target.value })} />
          </label>
          <label>
            Type
            <select value={filters.transactionType} onChange={(e) => setFilter({ transactionType: e.target.value })}>
              <option value="">all</option>
              <option value="__missing__">missing</option>
              {Object.keys(types).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Country
            <select value={filters.country} onChange={(e) => setFilter({ country: e.target.value })}>
              <option value="">all</option>
              {Object.keys(countries).map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount min
            <input value={filters.amountMin} onChange={(e) => setFilter({ amountMin: e.target.value })} />
          </label>
          <label>
            Amount max
            <input value={filters.amountMax} onChange={(e) => setFilter({ amountMax: e.target.value })} />
          </label>
          <label>
            Date from
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilter({ dateFrom: e.target.value })} />
          </label>
          <label>
            Date to
            <input type="date" value={filters.dateTo} onChange={(e) => setFilter({ dateTo: e.target.value })} />
          </label>
        </div>
        {filtered.emptyReason ? (
          <p className="callout">{filtered.emptyReason}</p>
        ) : (
          <>
            <TableMeta shown={filtered.rows.length} total={rows.length} />
            <TxnTable rows={filtered.rows} />
          </>
        )}
      </div>
      <aside className="panel">{selected ? <TxnDetail row={selected} /> : <p className="muted">Select a transaction to inspect its features and traces.</p>}</aside>
    </section>
  );
}
