/* =========================================================================
   NONPAR-CORE - inti hitungan Tables & Nonparametrics (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   Chi-Square (independensi, kesesuaian), uji eksak Fisher 2x2, Mann-Whitney, Wilcoxon (satu sampel / berpasangan),
   Kruskal-Wallis, Friedman. Memakai window.StatDist (stat-dist.js). Muat SETELAH stat-dist.js.
   alt: 'two' | 'greater' | 'less'
   ========================================================================= */
(function () {
  'use strict';
  const D = window.StatDist;
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const lchoose = (n, k) => D.lgamma(n + 1) - D.lgamma(k + 1) - D.lgamma(n - k + 1);

  /* peringkat (rata-rata untuk nilai kembar) + ukuran kelompok kembar */
  function rankInfo(a) {
    const idx = a.map((v, i) => i).sort((i, j) => a[i] - a[j]), r = new Array(a.length), ties = [];
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++;
      const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = rk;
      if (j > i) ties.push(j - i + 1); i = j + 1;
    }
    return { ranks: r, ties };
  }
  const tieSum = (ties) => sum(ties.map((t) => t * t * t - t));
  function median(a) { const s = a.slice().sort((u, v) => u - v), k = s.length, h = k >> 1; return k % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }

  /* ============================== Chi-Square ============================== */
  function chiInd(O) {
    const r = O.length, c = O[0].length, rowT = O.map(sum), colT = O[0].map((_, j) => sum(O.map((row) => row[j]))), N = sum(rowT);
    const E = O.map((row, i) => row.map((_, j) => rowT[i] * colT[j] / N));
    let chi2 = 0, G = 0, low = 0, minE = Infinity;
    const resid = [], adj = [];
    for (let i = 0; i < r; i++) { resid.push([]); adj.push([]); for (let j = 0; j < c; j++) {
      const o = O[i][j], e = E[i][j], d = o - e;
      chi2 += d * d / e; if (o > 0) G += 2 * o * Math.log(o / e);
      if (e < 5) low++; if (e < minE) minE = e;
      resid[i].push(d / Math.sqrt(e)); adj[i].push(d / Math.sqrt(e * (1 - rowT[i] / N) * (1 - colT[j] / N)));
    } }
    const df = (r - 1) * (c - 1), k = Math.min(r - 1, c - 1);
    const out = { r, c, N, rowT, colT, E, chi2, df, p: D.chi2Sf(chi2, df), G, pG: D.chi2Sf(G, df), resid, adj, lowCells: low, pctLow: low / (r * c), minE,
      V: Math.sqrt(chi2 / (N * k)), Cc: Math.sqrt(chi2 / (chi2 + N)) };
    if (r === 2 && c === 2) {
      let y = 0; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const d = Math.max(0, Math.abs(O[i][j] - E[i][j]) - 0.5); y += d * d / E[i][j]; }
      out.yates = { chi2: y, p: D.chi2Sf(y, 1) };
      out.phi = (O[0][0] * O[1][1] - O[0][1] * O[1][0]) / Math.sqrt(rowT[0] * rowT[1] * colT[0] * colT[1]);
    }
    return out;
  }
  function chiGof(O, props) {
    const k = O.length, N = sum(O), ps = props && props.length ? props : O.map(() => 1), tot = sum(ps);
    const E = ps.map((p) => N * p / tot);
    let chi2 = 0, low = 0, minE = Infinity;
    const resid = O.map((o, i) => { const d = o - E[i]; chi2 += d * d / E[i]; if (E[i] < 5) low++; if (E[i] < minE) minE = E[i]; return d / Math.sqrt(E[i]); });
    const df = k - 1;
    return { k, N, E, props: ps.map((p) => p / tot), chi2, df, p: D.chi2Sf(chi2, df), resid, lowCells: low, pctLow: low / k, minE, w: Math.sqrt(chi2 / N) };
  }

  /* ============================ Fisher exact 2x2 ============================ */
  function fisher(a, b, c, d, alt, conf) {
    const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2, lo = Math.max(0, c1 - r2), hi = Math.min(r1, c1);
    const lp = (x) => lchoose(r1, x) + lchoose(r2, c1 - x) - lchoose(n, c1);
    const pm = []; for (let x = lo; x <= hi; x++) pm.push(Math.exp(lp(x)));
    const P = (x) => pm[x - lo];
    let p;
    if (alt === 'greater') { p = 0; for (let x = a; x <= hi; x++) p += P(x); }
    else if (alt === 'less') { p = 0; for (let x = lo; x <= a; x++) p += P(x); }
    else { const t = P(a) * (1 + 1e-7); p = 0; for (let x = lo; x <= hi; x++) if (P(x) <= t) p += P(x); }
    p = Math.min(1, p);
    const or = (b * c === 0) ? (a * d === 0 ? NaN : Infinity) : (a * d) / (b * c);
    const zero = a === 0 || b === 0 || c === 0 || d === 0, h = zero ? 0.5 : 0, lor = Math.log(((a + h) * (d + h)) / ((b + h) * (c + h))), se = Math.sqrt(1 / (a + h) + 1 / (b + h) + 1 / (c + h) + 1 / (d + h)), zc = D.normQuant(1 - (1 - conf) / 2);
    const p1 = a / r1, p2 = c / r2;
    return { a, b, c, d, r1, r2, c1, c2: b + d, n, p, or, orCI: [Math.exp(lor - zc * se), Math.exp(lor + zc * se)], haldane: zero, p1, p2, rr: p2 > 0 ? p1 / p2 : Infinity, rd: p1 - p2, alt, P: P(a), lo, hi };
  }

  /* ============================== Mann-Whitney ============================== */
  const mwMemo = new Map();
  function mwCounts(n, m) {   // banyaknya susunan untuk tiap nilai U (tanpa nilai kembar)
    const key = n + ',' + m; if (mwMemo.has(key)) return mwMemo.get(key);
    let res;
    if (n === 0 || m === 0) res = [1];
    else {
      const A = mwCounts(n - 1, m), Bc = mwCounts(n, m - 1); res = new Array(n * m + 1).fill(0);
      for (let u = 0; u <= n * m; u++) res[u] = (u - m >= 0 && u - m < A.length ? A[u - m] : 0) + (u < Bc.length ? Bc[u] : 0);
    }
    mwMemo.set(key, res); return res;
  }
  function mannWhitney(x, y, alt, opts) {
    opts = opts || {}; const n1 = x.length, n2 = y.length, N = n1 + n2;
    const ri = rankInfo(x.concat(y)), R1 = sum(ri.ranks.slice(0, n1)), R2 = sum(ri.ranks.slice(n1));
    const U1 = R1 - n1 * (n1 + 1) / 2, U2 = n1 * n2 - U1, hasTies = ri.ties.length > 0;
    const exact = opts.method === 'exact' || (opts.method !== 'asymptotic' && !hasTies && N <= (opts.exactMax || 40));
    let p;
    if (exact && !hasTies) {
      const cnt = mwCounts(n1, n2), tot = sum(cnt), cdf = (u) => sum(cnt.slice(0, Math.floor(u + 1e-9) + 1)) / tot, sf = (u) => sum(cnt.slice(Math.ceil(u - 1e-9))) / tot;
      p = alt === 'greater' ? sf(U1) : alt === 'less' ? cdf(U1) : Math.min(1, 2 * Math.min(cdf(U1), sf(U1)));
    } else {
      const mu = n1 * n2 / 2, s = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tieSum(ri.ties) / (N * (N - 1)))), cc = opts.continuity === false ? 0 : 0.5;
      const U = alt === 'greater' ? U1 : alt === 'less' ? U2 : Math.max(U1, U2), z = (U - mu - cc) / s;
      p = Math.min(1, (alt === 'two' ? 2 : 1) * D.normCdf(-z));
    }
    return { n1, n2, N, R1, R2, U1, U2, p, exact: exact && !hasTies, hasTies, ties: ri.ties, ranks: ri.ranks, mr1: R1 / n1, mr2: R2 / n2, med1: median(x), med2: median(y),
      rbc: (U1 - U2) / (n1 * n2), cles: U1 / (n1 * n2), alt };
  }

  /* ============================ Wilcoxon signed-rank ============================ */
  const wsMemo = new Map();
  function wsCounts(n) {   // banyaknya himpunan bagian {1..n} dengan jumlah s
    if (wsMemo.has(n)) return wsMemo.get(n);
    const M = n * (n + 1) / 2, c = new Array(M + 1).fill(0); c[0] = 1;
    for (let k = 1; k <= n; k++) for (let s = M; s >= k; s--) c[s] += c[s - k];
    wsMemo.set(n, c); return c;
  }
  function wilcoxon(d, alt, opts) {   // d = selisih (sudah dikurangi median hipotesis / pasangan); nol dibuang
    opts = opts || {};
    const nz = d.filter((v) => v !== 0), zeros = d.length - nz.length, n = nz.length;
    const ri = rankInfo(nz.map(Math.abs)); let Tp = 0, Tm = 0;
    nz.forEach((v, i) => { if (v > 0) Tp += ri.ranks[i]; else Tm += ri.ranks[i]; });
    const hasTies = ri.ties.length > 0;
    const exact = opts.method === 'exact' || (opts.method !== 'approx' && !hasTies && zeros === 0 && n <= (opts.exactMax || 50));
    let p;
    if (exact && !hasTies) {
      const cnt = wsCounts(n), tot = Math.pow(2, n), cdf = (t) => sum(cnt.slice(0, Math.floor(t + 1e-9) + 1)) / tot, sf = (t) => sum(cnt.slice(Math.ceil(t - 1e-9))) / tot;
      p = alt === 'greater' ? sf(Tp) : alt === 'less' ? cdf(Tp) : Math.min(1, 2 * Math.min(cdf(Tp), sf(Tp)));
    } else {
      const mean = n * (n + 1) / 4, se = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieSum(ri.ties) / 48), cc = opts.correction === false ? 0 : 0.5;
      let z;
      if (alt === 'greater') z = (Tp - mean - cc) / se; else if (alt === 'less') z = (Tp - mean + cc) / se; else z = (Math.abs(Tp - mean) - cc) / se;
      p = alt === 'less' ? D.normCdf(z) : alt === 'greater' ? D.normCdf(-z) : Math.min(1, 2 * D.normCdf(-Math.max(z, 0)));
    }
    return { n, nTotal: d.length, zeros, Tp, Tm, p, exact: exact && !hasTies, hasTies, ties: ri.ties, ranks: ri.ranks, nz, rbc: n > 0 ? (Tp - Tm) / (Tp + Tm) : NaN, mean: n * (n + 1) / 4, se: Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieSum(ri.ties) / 48), alt };
  }

  /* ============================= Kruskal-Wallis ============================= */
  function kruskal(groups) {
    const k = groups.length, ns = groups.map((g) => g.length), N = sum(ns), all = [].concat.apply([], groups), ri = rankInfo(all);
    let pos = 0; const R = ns.map((n) => { const s = sum(ri.ranks.slice(pos, pos + n)); pos += n; return s; });
    const H0 = 12 / (N * (N + 1)) * sum(R.map((r, i) => r * r / ns[i])) - 3 * (N + 1), corr = 1 - tieSum(ri.ties) / (N * N * N - N), H = H0 / corr, df = k - 1;
    return { k, ns, N, R, meanR: R.map((r, i) => r / ns[i]), med: groups.map(median), H0, corr, H, df, p: D.chi2Sf(H, df), eps2: H / (N - 1), ties: ri.ties };
  }

  /* ================================= Friedman ================================= */
  function friedman(rows) {   // rows: n blok x k perlakuan (lengkap)
    const n = rows.length, k = rows[0].length; const R = new Array(k).fill(0); let tcorr = 0; const rr = [];
    rows.forEach((row) => { const ri = rankInfo(row); rr.push(ri.ranks); ri.ranks.forEach((v, j) => { R[j] += v; }); tcorr += tieSum(ri.ties); });
    const chi0 = 12 / (n * k * (k + 1)) * sum(R.map((r) => r * r)) - 3 * n * (k + 1), corr = 1 - tcorr / (n * k * (k * k - 1)), chi2 = chi0 / corr, df = k - 1;
    const cols = rows[0].map((_, j) => rows.map((r) => r[j]));
    return { n, k, R, meanR: R.map((r) => r / n), med: cols.map(median), chi0, corr, chi2, df, p: D.chi2Sf(chi2, df), W: chi2 / (n * (k - 1)), rr };
  }

  window.StatNonpar = { rankInfo, tieSum, median, chiInd, chiGof, fisher, mannWhitney, wilcoxon, kruskal, friedman };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatNonpar;
})();
