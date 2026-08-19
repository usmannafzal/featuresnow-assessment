import type { Trace } from '../engine/types';

export function TraceView({ trace, name }: { trace: Trace; name?: string }) {
  return (
    <details className="trace">
      <summary>
        <StatusMark status={trace.status} /> {name ?? (trace.kind === 'group' ? trace.op : `${trace.field} ${trace.operator}`)}{' '}
        <span className={`status status-${trace.status}`}>{trace.status}</span>
      </summary>
      {trace.kind === 'leaf' ? (
        <ul>
          <li>field: {trace.field}</li>
          <li>operator: {trace.operator}</li>
          <li>expected: {JSON.stringify(trace.expected)}</li>
          <li>actual: {JSON.stringify(trace.actual)}</li>
          {trace.reason ? <li>reason: {trace.reason}</li> : null}
        </ul>
      ) : (
        <div className="trace-children">
          {trace.children.map((child, i) => (
            <TraceView key={i} trace={child} />
          ))}
        </div>
      )}
    </details>
  );
}

function StatusMark({ status }: { status: string }) {
  const color = status === 'pass' ? '#1a7f37' : status === 'fail' ? '#c62828' : '#6b7280';
  return (
    <span className="status-dot" style={{ background: color }} aria-hidden="true" />
  );
}
