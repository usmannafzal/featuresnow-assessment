export type EvalStatus = 'pass' | 'fail' | 'unevaluable';

export type UnevaluableReason = 'field_missing' | 'value_null' | 'type_mismatch';

export type LeafTrace = {
  kind: 'leaf';
  field: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  status: EvalStatus;
  reason?: UnevaluableReason;
};

export type GroupTrace = {
  kind: 'group';
  op: 'AND' | 'OR';
  status: EvalStatus;
  children: Trace[];
};

export type Trace = LeafTrace | GroupTrace;

export type ParamSpec = {
  type: 'number' | 'array';
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
};

export type LeafCondition = {
  field: string;
  operator: string;
  value: unknown;
};

export type GroupCondition = {
  op: 'AND' | 'OR';
  children: Condition[];
};

export type Condition = LeafCondition | GroupCondition;

export type Rule = {
  rule_id: string;
  name: string;
  description: string;
  action: string;
  severity: string;
  parameters: Record<string, ParamSpec>;
  condition: GroupCondition;
  limitations: string;
};

export type HealthStatus =
  | 'missing_field'
  | 'impossible_value'
  | 'no_reference_data'
  | 'never_fires'
  | 'always_fires'
  | 'mostly_unevaluable'
  | 'healthy';

export type HealthFinding = {
  status: HealthStatus;
  explanation: string;
};
