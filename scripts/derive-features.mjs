const MS_1H = 60 * 60 * 1000;
const MS_24H = 24 * MS_1H;

function mostFrequent(counts) {
  let best = null;
  let bestN = -1;
  for (const [key, n] of counts) {
    if (n > bestN || (n === bestN && key < best)) {
      best = key;
      bestN = n;
    }
  }
  return best;
}

function bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

export function addChronologicalFeatures(rows) {
  const sorted = rows.slice().sort((a, b) => {
    if (a.sender_account_id !== b.sender_account_id) {
      return a.sender_account_id < b.sender_account_id ? -1 : 1;
    }
    if (a.txn_ts !== b.txn_ts) return a.txn_ts - b.txn_ts;
    return a.transaction_id < b.transaction_id ? -1 : 1;
  });

  let i = 0;
  while (i < sorted.length) {
    const sender = sorted[i].sender_account_id;
    let j = i;
    while (j < sorted.length && sorted[j].sender_account_id === sender) j += 1;
    const group = sorted.slice(i, j);

    let sumUsd = 0;
    let usdCount = 0;
    for (let k = 0; k < group.length; k++) {
      const row = group[k];
      row.sender_prior_txn_count = k;
      row.sender_prior_avg_amount_usd = usdCount === 0 ? null : sumUsd / usdCount;
      let c1h = 0;
      let c24h = 0;
      for (let p = k - 1; p >= 0; p--) {
        const dt = row.txn_ts - group[p].txn_ts;
        if (dt > MS_24H) break;
        c24h += 1;
        if (dt <= MS_1H) c1h += 1;
      }
      row.sender_txn_count_1h = c1h;
      row.sender_txn_count_24h = c24h;
      const prior = row.sender_prior_avg_amount_usd;
      row.amount_vs_prior_avg_ratio =
        prior == null || prior === 0 || row.amount_usd == null ? null : row.amount_usd / prior;
      if (row.amount_usd != null) {
        sumUsd += row.amount_usd;
        usdCount += 1;
      }
    }

    const typeCounts = new Map();
    let typeTotal = 0;
    const countryCounts = new Map();
    let countryTotal = 0;
    for (const row of group) {
      if (row.transaction_type != null) {
        bump(typeCounts, row.transaction_type);
        typeTotal += 1;
      }
      if (row.merchant_country != null) {
        bump(countryCounts, row.merchant_country);
        countryTotal += 1;
      }
    }
    const modal = mostFrequent(countryCounts);
    for (const row of group) {
      row.sender_modal_country = modal;
      row.sender_type_share =
        row.transaction_type == null || typeTotal === 0
          ? null
          : typeCounts.get(row.transaction_type) / typeTotal;
      if (row.merchant_country == null || countryTotal === 0) {
        row.sender_country_share = null;
        row.is_cross_border = null;
      } else {
        row.sender_country_share = countryCounts.get(row.merchant_country) / countryTotal;
        row.is_cross_border = row.merchant_country !== modal;
      }
    }
    i = j;
  }

  for (const row of rows) {
    row.features_disagree_with_chronology =
      row.transaction_count_as_provided !== row.sender_prior_txn_count + 1;
  }
}
