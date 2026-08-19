import { useEffect } from 'react';
import { ParameterDiff } from './views/ParameterDiff';
import { RuleDetail } from './views/RuleDetail';
import { RulesList } from './views/RulesList';
import { TransactionInspector } from './views/TransactionInspector';
import { useStore, type Tab } from './store/useStore';

const TABS: { id: Tab; label: string }[] = [
  { id: 'rules', label: 'Rules' },
  { id: 'detail', label: 'Rule detail' },
  { id: 'inspector', label: 'Transactions' },
  { id: 'diff', label: 'Parameter diff' },
];

export function App() {
  const load = useStore((s) => s.load);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="app">
      <header>
        <div>
          <h1>Rule Debugger</h1>
          <p className="muted">Why did rule X miss this transaction?</p>
        </div>
        <nav>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'tab active' : 'tab'}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {loading ? <p>Loading 38,903 transactions.</p> : null}
        {error ? <p className="callout">Could not load data: {error}</p> : null}
        {!loading && !error ? <Active tab={tab} /> : null}
      </main>
    </div>
  );
}

function Active({ tab }: { tab: Tab }) {
  if (tab === 'rules') return <RulesList />;
  if (tab === 'detail') return <RuleDetail />;
  if (tab === 'inspector') return <TransactionInspector />;
  return <ParameterDiff />;
}
