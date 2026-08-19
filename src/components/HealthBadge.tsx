import type { HealthFinding } from '../engine/types';

const labels: Record<string, string> = {
  missing_field: 'missing field',
  impossible_value: 'impossible value',
  no_reference_data: 'no reference data',
  never_fires: 'never fires',
  always_fires: 'always fires',
  mostly_unevaluable: 'mostly unevaluable',
  healthy: 'healthy',
};

export function HealthBadge({ findings }: { findings: HealthFinding[] }) {
  if (findings.length === 0) return null;
  const title = findings.map((f) => f.explanation).join(' ');
  return (
    <span className="health-stack" title={title}>
      {findings.map((finding) => (
        <span key={finding.status} className={`badge badge-${finding.status}`}>
          {labels[finding.status]}
        </span>
      ))}
    </span>
  );
}
