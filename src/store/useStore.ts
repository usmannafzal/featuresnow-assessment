import { create } from 'zustand';
import rulesJson from '../rules/rules.json';
import { evaluateDataset, resolvedParams, type DatasetEval } from '../engine/evaluator';
import type { Rule } from '../engine/types';
import { checkHealth, type MerchantRisk, type Metadata } from '../engine/health';
import { emptyFilters, type Filters } from '../lib/filters';
import { inflateDataset, type CompactDataset } from '../lib/inflate';

export type Tab = 'rules' | 'detail' | 'inspector' | 'diff';

type EvalByRule = Record<string, DatasetEval>;

type Snapshot = {
  ruleId: string;
  paramsKey: string;
  passIds: string[];
};

type Store = {
  loading: boolean;
  error: string | null;
  rows: Record<string, unknown>[];
  metadata: Metadata | null;
  merchantRisk: MerchantRisk | null;
  rules: Rule[];
  paramOverrides: Record<string, Record<string, unknown>>;
  selectedRuleId: string;
  selectedTxnId: string | null;
  tab: Tab;
  filters: Filters;
  evalByRule: EvalByRule;
  snapshot: Snapshot | null;
  evaluating: boolean;
  load: () => Promise<void>;
  setTab: (tab: Tab) => void;
  selectRule: (ruleId: string) => void;
  selectTxn: (txnId: string | null) => void;
  setParam: (ruleId: string, name: string, value: unknown) => void;
  setFilter: (patch: Partial<Filters>) => void;
  snapshotMatches: () => void;
};

const rules = rulesJson as unknown as Rule[];
const evalCache = new Map<string, DatasetEval>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let evalGeneration = 0;

function paramsKey(ruleId: string, params: Record<string, unknown>): string {
  return ruleId + JSON.stringify(params);
}

function evalRule(
  rule: Rule,
  rows: Record<string, unknown>[],
  overrides: Record<string, unknown> | undefined,
): DatasetEval {
  const params = resolvedParams(rule, overrides);
  const key = paramsKey(rule.rule_id, params);
  const cached = evalCache.get(key);
  if (cached) return cached;
  const result = evaluateDataset(rule, rows, params);
  evalCache.set(key, result);
  return result;
}

function evalAll(rows: Record<string, unknown>[], overrides: Record<string, Record<string, unknown>>): EvalByRule {
  const next: EvalByRule = {};
  for (const rule of rules) next[rule.rule_id] = evalRule(rule, rows, overrides[rule.rule_id]);
  return next;
}

export const useStore = create<Store>((set, get) => ({
  loading: true,
  error: null,
  rows: [],
  metadata: null,
  merchantRisk: null,
  rules,
  paramOverrides: {},
  selectedRuleId: rules[0].rule_id,
  selectedTxnId: null,
  tab: 'rules',
  filters: emptyFilters,
  evalByRule: {},
  snapshot: null,
  evaluating: false,

  async load() {
    set({ loading: true, error: null });
    try {
      const [datasetRes, metaRes, riskRes] = await Promise.all([
        fetch('/data/dataset.json'),
        fetch('/data/metadata.json'),
        fetch('/data/merchant-risk.json'),
      ]);
      if (!datasetRes.ok) throw new Error(`dataset.json failed to load (${datasetRes.status})`);
      if (!metaRes.ok) throw new Error(`metadata.json failed to load (${metaRes.status})`);
      if (!riskRes.ok) throw new Error(`merchant-risk.json failed to load (${riskRes.status})`);
      const dataset = (await datasetRes.json()) as CompactDataset;
      const metadata = (await metaRes.json()) as Metadata;
      const merchantRisk = (await riskRes.json()) as MerchantRisk;
      const rows = inflateDataset(dataset);
      const evalByRule = evalAll(rows, get().paramOverrides);
      set({ rows, metadata, merchantRisk, evalByRule, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: message });
    }
  },

  setTab: (tab) => set({ tab }),

  selectRule: (ruleId) => set({ selectedRuleId: ruleId, tab: 'detail' }),

  selectTxn: (txnId) => set({ selectedTxnId: txnId }),

  setParam: (ruleId, name, value) => {
    const paramOverrides = {
      ...get().paramOverrides,
      [ruleId]: { ...get().paramOverrides[ruleId], [name]: value },
    };
    set({ paramOverrides, evaluating: true });
    if (debounceTimer) clearTimeout(debounceTimer);
    const generation = ++evalGeneration;
    debounceTimer = setTimeout(() => {
      const { rows } = get();
      const rule = rules.find((item) => item.rule_id === ruleId);
      if (!rule || generation !== evalGeneration) return;
      const result = evalRule(rule, rows, paramOverrides[ruleId]);
      set((state) => ({
        evalByRule: { ...state.evalByRule, [ruleId]: result },
        evaluating: false,
      }));
    }, 150);
  },

  setFilter: (patch) => set({ filters: { ...get().filters, ...patch } }),

  snapshotMatches: () => {
    const { selectedRuleId, evalByRule, paramOverrides } = get();
    const rule = rules.find((item) => item.rule_id === selectedRuleId);
    if (!rule) return;
    const params = resolvedParams(rule, paramOverrides[selectedRuleId]);
    set({
      snapshot: {
        ruleId: selectedRuleId,
        paramsKey: JSON.stringify(params),
        passIds: evalByRule[selectedRuleId]?.passIds ?? [],
      },
    });
  },
}));

export function healthFor(rule: Rule) {
  const { metadata, merchantRisk, evalByRule, paramOverrides, rows } = useStore.getState();
  const result = evalByRule[rule.rule_id];
  if (!metadata || !merchantRisk || !result) return [];
  return checkHealth(
    rule,
    metadata,
    {
      passCount: result.passCount,
      failCount: result.failCount,
      unevaluableCount: result.unevaluableCount,
      total: rows.length,
    },
    merchantRisk,
    resolvedParams(rule, paramOverrides[rule.rule_id]),
  );
}
