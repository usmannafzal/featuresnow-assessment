import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addChronologicalFeatures } from './derive-features.mjs';
import { buildMetadata, countNulls } from './metadata.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'public', 'data');
const EXPECTED_ROWS = 38903;

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function parseJsonWithNan(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/\bNaN\b/g, 'null'));
}

function uniqueIds(rows) {
  const ids = new Set();
  for (const row of rows) {
    assert(!ids.has(row.transaction_id), `duplicate id ${row.transaction_id}`);
    ids.add(row.transaction_id);
  }
  return ids;
}

function joinRows(transactions, features, rates) {
  assert(transactions.length === EXPECTED_ROWS, `transactions length ${transactions.length}`);
  assert(features.length === EXPECTED_ROWS, `features length ${features.length}`);
  const txnIds = uniqueIds(transactions);
  const featIds = uniqueIds(features);
  assert(txnIds.size === featIds.size, 'id set sizes differ');
  for (const id of txnIds) assert(featIds.has(id), `orphan transaction ${id}`);
  for (const id of featIds) assert(txnIds.has(id), `orphan feature ${id}`);

  const featById = new Map();
  for (const f of features) featById.set(f.transaction_id, f);

  let unmappedCurrency = 0;
  const rows = [];
  for (const t of transactions) {
    const f = featById.get(t.transaction_id);
    const txn_ts = new Date(t.txn_date_time.replace(' ', 'T')).getTime();
    assert(!Number.isNaN(txn_ts), `unparseable date on ${t.transaction_id}`);
    const rate = rates[t.currency];
    let amount_usd = null;
    if (rate === undefined) unmappedCurrency += 1;
    else amount_usd = t.amount * rate;
    rows.push({
      transaction_id: t.transaction_id,
      txn_date_time: t.txn_date_time,
      txn_ts,
      sender_account_id: t.sender_account_id,
      receiver_account_id: t.receiver_account_id,
      amount: t.amount,
      currency: t.currency,
      amount_usd,
      transaction_type: t.transaction_type,
      merchant_city: t.merchant_city,
      merchant_country: t.merchant_country,
      merchant_description_condensed: t.merchant_description_condensed,
      hour_of_day: f.hour_of_day,
      day_of_week: f.day_of_week,
      transaction_count_as_provided: f.transaction_count,
      avg_transaction_amount_as_provided: f.avg_transaction_amount,
      merchant_avg_transaction_amount_as_provided: f.merchant_avg_transaction_amount,
    });
  }
  return { rows, unmappedCurrency };
}

// Array-of-objects JSON repeats long key names ~39k times and exceeds 12 MB.
function compactDataset(rows) {
  const fields = Object.keys(rows[0]);
  return {
    fields,
    rows: rows.map((row) => fields.map((field) => row[field])),
  };
}

mkdirSync(OUT, { recursive: true });
const rates = JSON.parse(readFileSync(join(ROOT, 'src', 'rules', 'fx-rates.json'), 'utf8')).rates;
const { rows, unmappedCurrency } = joinRows(
  parseJsonWithNan(join(RAW, 'transactions.json')),
  parseJsonWithNan(join(RAW, 'feature_vectors.json')),
  rates,
);
addChronologicalFeatures(rows);

const senderCounts = new Map();
let disagree = 0;
for (const row of rows) {
  senderCounts.set(row.sender_account_id, (senderCounts.get(row.sender_account_id) || 0) + 1);
  if (row.features_disagree_with_chronology) disagree += 1;
}
let singleTxnSenders = 0;
for (const n of senderCounts.values()) if (n === 1) singleTxnSenders += 1;

const datasetPath = join(OUT, 'dataset.json');
writeFileSync(datasetPath, JSON.stringify(compactDataset(rows)));
writeFileSync(join(OUT, 'metadata.json'), JSON.stringify(buildMetadata(rows), null, 2));
writeFileSync(
  join(OUT, 'merchant-risk.json'),
  JSON.stringify(
    {
      high_risk_receiver_ids: [],
      note: 'Empty by default. RULE_004 needs this merchant risk list and the dataset does not contain it.',
    },
    null,
    2,
  ),
);

const sizeMb = (statSync(datasetPath).size / (1024 * 1024)).toFixed(2);
console.log('rows written:', rows.length);
console.log('dataset.json size:', sizeMb, 'MB');
console.log('null counts per field:');
for (const [field, n] of Object.entries(countNulls(rows))) console.log(`  ${field}: ${n}`);
console.log('features disagree with chronology:', disagree);
console.log('unmapped currency rows:', unmappedCurrency);
console.log('senders with only one transaction:', singleTxnSenders);
