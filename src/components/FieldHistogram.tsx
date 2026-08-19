import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCount } from '../lib/format';
import { buildHistogram } from '../lib/histogram';

export function FieldHistogram({
  rows,
  field,
  thresholds,
}: {
  rows: Record<string, unknown>[];
  field: string;
  thresholds: { label: string; value: number }[];
}) {
  const hist = buildHistogram(rows, field, 30);
  const dataMax = hist.max;
  let xMax = dataMax;
  for (const t of thresholds) if (t.value > xMax) xMax = t.value;
  const chartData = hist.buckets.map((b) => ({
    mid: b.mid,
    count: b.count === 0 ? 0.5 : b.count,
    rawCount: b.count,
    start: b.start,
    end: b.end,
  }));

  return (
    <div>
      <h3>Distribution of {field}</h3>
      <div className="chart">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mid" type="number" domain={[hist.min, xMax || 1]} tickFormatter={(v) => Number(v).toFixed(0)} />
            <YAxis scale="log" domain={[0.5, 'auto']} allowDataOverflow tickFormatter={(v) => formatCount(Number(v))} />
            <Tooltip
              formatter={(value, _name, item) => [formatCount(Number(item?.payload?.rawCount ?? value)), 'rows']}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload;
                if (!row) return field;
                return `${Number(row.start).toFixed(2)} to ${Number(row.end).toFixed(2)}`;
              }}
            />
            <Bar dataKey="count" fill="#1d4e89" />
            {thresholds.map((t) => (
              <ReferenceLine key={t.label} x={t.value} stroke="#c62828" strokeDasharray="4 4" label={t.label} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="muted">
        {formatCount(hist.sampleCount)} rows in the histogram. {formatCount(hist.excludedNulls)} null values excluded.
        Count axis is log scale because {field} is heavily skewed.
      </p>
    </div>
  );
}
