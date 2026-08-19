# Approach

## 1. Rules as data plus a generic evaluator

The seven rules live in `src/rules/rules.json`. Each rule is a name, parameters, and a boolean tree of field/operator/value leaves. `$min_amount_usd` is substituted from the current parameter map at evaluation time.

That split is what makes a live edit cheap. Adding a rule is a JSON object. Adding `between` is one function in `src/engine/operators.ts`. The UI never hardcodes "if amount > 10000". If the interviewer asks to change RULE_006 from overnight hours to weekday mornings, the change is the JSON tree (and maybe a slider bound), not a new React component.

## 2. The evaluator returns a trace, not a boolean

`evaluateRule` returns a `Trace`: every leaf records field, operator, expected, actual, and `pass | fail | unevaluable`. Groups combine children with three-valued AND/OR.

Every screen is a projection of that object:

- The rules list counts root `pass` vs `unevaluable` across 38,903 traces.
- The condition tree counts those statuses per clause, which answers "which clause is killing the rule".
- The transaction inspector renders the same tree in green / red / grey for one row.
- Health checks consume the counts, not a second evaluator.

Unevaluable is not a miss. A null `transaction_type` (616 rows) must not look like "this row is fine".

## 3. Rule feasibility

| Rule | Fires on this data at defaults? | Why |
|---|---|---|
| RULE_001 High Value | No | `amount_usd` max is 9,008.44 after static FX. Native max is 16.2 million because of COP. Default threshold 10,000 USD is above every row. Lower the slider to make it fire. Health: `never_fires`. |
| RULE_002 Multiple Small | Yes | `amount_usd < 50` and `sender_txn_count_1h >= 5`. |
| RULE_003 Unusual Type | Yes | Rare `transaction_type` for senders with enough history. |
| RULE_004 High-Risk Merchant | No | Field `merchant_risk_tier` does not exist. `merchant-risk.json` is empty. Health: `missing_field` and `no_reference_data`. |
| RULE_005 Cross-Border | Yes | Modal country vs merchant country, plus amount. |
| RULE_006 Outside Hours | Yes | Overnight window is OR, not AND: hour >= 22 OR hour <= 6. |
| RULE_007 Large Cash Withdrawal | No | `transaction_type` domain is online, contactless, chip_and_pin, refund, internal. There is no `atm_withdrawal`. Health: `impossible_value`. |

RULE_004 and RULE_007 are encoded as written. Rewriting them so they fire would hide the thing the tool is for.

## 4. Data quality findings

- The raw JSON files are not valid JSON. `transactions.json` has 39,532 bare `NaN` tokens; `feature_vectors.json` has 629. `JSON.parse` throws. The preprocess step does a word-boundary replace to `null` first.
- `terminal_id` is 0.0 on every row. `merchant_postcode` is null on every row. Both are dropped.
- Provided features `transaction_count` and `avg_transaction_amount` are running values in file order, not lifetime totals.
- File order is not chronological. 103 of 108 senders have out-of-order timestamps. Chronological features are stored alongside `*_as_provided` values. `features_disagree_with_chronology` is true on 38,126 rows.
- Seven currencies are compared only after converting with static FX in `src/rules/fx-rates.json`. Without that, RULE_001 looks at 16 million COP as if it were 16 million dollars.
- 616 rows have null `transaction_type`. 1,343 rows have `amount` exactly 0.0. 13 rows have null `receiver_account_id`. 108 senders; 3 of them have only one transaction.

## 5. Known limitations

Quoted from each rule's `limitations` field:

- RULE_001: amount_usd uses static FX estimates, so a large native COP amount can sit well below this USD threshold.
- RULE_002: The 1h window count is not filtered by amount, so a burst of large transactions also satisfies clause 2.
- RULE_003: Share is computed over the sender's full history, including the current row, so the first time a type appears it is already counted in the share.
- RULE_004: merchant_risk_tier is not in the dataset, and merchant-risk.json ships empty, so this rule cannot evaluate.
- RULE_005: Typical country is the sender's modal merchant_country over full history, so a sender who mostly shops abroad will not be flagged for those countries.
- RULE_006: The overnight window wraps midnight, so the clauses are OR (hour >= 22 OR hour <= 6), not AND.
- RULE_007: The type domain has no ATM or withdrawal category, so clause 1 can never pass on this dataset.

FX rates in `src/rules/fx-rates.json` are static approximations, not live rates. `dataset.json` is stored as `{ fields, rows }` so repeated JSON keys do not blow past 12 MB; the app inflates rows on load.

## 6. What I would do next

- Let an analyst type a new leaf into the condition tree and re-run, still without a visual builder.
- Join a real merchant-risk list and show RULE_004 flipping from missing_field to healthy.
- Add a `between` operator and a timezone parameter for RULE_006, since "user's timezone" is in the description and not in the data.
- Precompute clause histograms so dragging a slider does not rebuild 38,903 traces on the main thread. The current cache plus 150 ms debounce is enough to present, not enough for a 10-rule catalogue.
