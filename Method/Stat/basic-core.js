/* =========================================================================
   BASIC-CORE - inti hitungan Basic Statistics (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   Uji t (satu sampel, dua sampel Welch / gabungan, berpasangan) dan Korelasi
   (Pearson, Spearman, Kendall tau-b). Memakai window.StatDist (Method/Shared/stat-dist.js).
   Muat SETELAH stat-dist.js dan SEBELUM ujit.js / korelasi.js.

   alt: 'two' (dua sisi) | 'greater' (H1: lebih besar) | 'less' (H1: lebih kecil)
   ========================================================================= */
(function () {
  'use strict';
  const D = window.StatDist;
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => sum(a) / a.length;
  function variance(a, m) { m = m === undefined ? mean(a) : m; return a.length > 1 ? sum(a.map((v) => (v - m) * (v - m))) / (a.length - 1) : NaN; }

  /* p-value & selang kepercayaan sesuai arah hipotesis */
  function tP(t, df, alt) {
    const two = D.tTwoP(t, df);
    if (alt === 'greater') return t > 0 ? two / 2 : 1 - two / 2;
    if (alt === 'less') return t < 0 ? two / 2 : 1 - two / 2;
    return two;
  }
  function tCI(est, se, df, conf, alt) {
    if (alt === 'greater') return [est - D.tCrit(df, 2 * conf - 1) * se, Infinity];
    if (alt === 'less') return [-Infinity, est + D.tCrit(df, 2 * conf - 1) * se];
    const c = D.tCrit(df, conf); return [est - c * se, est + c * se];
  }

  /* ---------------------------- Uji t satu sampel ---------------------------- */
  function tOne(x, mu0, alt, conf) {
    const n = x.length, m = mean(x), s2 = variance(x, m), sd = Math.sqrt(s2), se = sd / Math.sqrt(n), df = n - 1;
    const t = (m - mu0) / se;
    return { type: 'one', n, mean: m, sd, se, mu0, diff: m - mu0, t, df, p: tP(t, df, alt), ci: tCI(m, se, df, conf, alt), alt, conf, d: (m - mu0) / sd };   // ci = selang untuk rata-rata (μ)
  }

  /* ----------------------- Uji t dua sampel independen ----------------------- */
  function tTwo(x, y, delta0, alt, conf, equalVar) {
    const n1 = x.length, n2 = y.length, m1 = mean(x), m2 = mean(y), v1 = variance(x, m1), v2 = variance(y, m2);
    const diff = m1 - m2;
    let se, df, sp = NaN;
    if (equalVar) {
      df = n1 + n2 - 2; const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / df; sp = Math.sqrt(sp2);
      se = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    } else {
      const a = v1 / n1, b = v2 / n2; se = Math.sqrt(a + b);
      df = (a + b) * (a + b) / (a * a / (n1 - 1) + b * b / (n2 - 1));
    }
    const t = (diff - delta0) / se;
    const dPool = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
    return { type: equalVar ? 'pooled' : 'welch', n1, n2, m1, m2, s1: Math.sqrt(v1), s2: Math.sqrt(v2), v1, v2, diff, delta0, se, df, sp, t, p: tP(t, df, alt), ci: tCI(diff, se, df, conf, alt), alt, conf, d: (m1 - m2) / dPool };
  }

  /* ---------------------------- Uji t berpasangan ---------------------------- */
  function tPaired(x, y, mu0, alt, conf) {
    const d = x.map((v, i) => v - y[i]);
    const r = tOne(d, mu0, alt, conf);
    r.type = 'paired'; r.m1 = mean(x); r.m2 = mean(y); r.dvals = d;
    r.r = pearson(x, y).r;   // korelasi pasangan (informasi tambahan)
    return r;
  }

  /* --------------------------------- Korelasi -------------------------------- */
  function pearson(x, y) {
    const n = x.length, mx = mean(x), my = mean(y);
    let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const r0 = sxy / Math.sqrt(sxx * syy);
    const r = Math.max(-1, Math.min(1, r0));
    return { n, r, sxx, syy, sxy, mx, my };
  }
  function rTest(r, n) {   // uji H0: rho = 0 lewat statistik t (df = n - 2)
    if (n < 3) return { t: NaN, df: n - 2, p: NaN };
    if (Math.abs(r) >= 1) return { t: r > 0 ? Infinity : -Infinity, df: n - 2, p: 0 };
    const df = n - 2, t = r * Math.sqrt(df / (1 - r * r));
    return { t, df, p: D.tTwoP(t, df) };
  }
  function fisherCI(r, n, conf) {   // selang kepercayaan rho (transformasi z Fisher), butuh n > 3
    if (n <= 3 || Math.abs(r) >= 1) return [NaN, NaN];
    const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3), c = D.normQuant(1 - (1 - conf) / 2);
    return [Math.tanh(z - c * se), Math.tanh(z + c * se)];
  }
  function ranks(a) {   // peringkat, nilai kembar diberi rata-rata peringkat
    const idx = a.map((v, i) => i).sort((i, j) => a[i] - a[j]), r = new Array(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++;
      const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = rk; i = j + 1;
    }
    return r;
  }
  function tieGroups(a) {   // ukuran tiap kelompok nilai kembar (>1)
    const m = new Map(); a.forEach((v) => m.set(v, (m.get(v) || 0) + 1));
    return Array.from(m.values()).filter((t) => t > 1);
  }
  function spearman(x, y) {
    const rx = ranks(x), ry = ranks(y), pr = pearson(rx, ry);
    return { n: x.length, r: pr.r, ...rTest(pr.r, x.length) };
  }
  function kendall(x, y) {   // tau-b; p-value pendekatan normal dengan koreksi nilai kembar
    const n = x.length; let con = 0, dis = 0;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
      const s = Math.sign(x[i] - x[j]) * Math.sign(y[i] - y[j]);
      if (s > 0) con++; else if (s < 0) dis++;
    }
    const S = con - dis, n0 = n * (n - 1) / 2, tx = tieGroups(x), ty = tieGroups(y);
    const n1 = sum(tx.map((t) => t * (t - 1) / 2)), n2 = sum(ty.map((t) => t * (t - 1) / 2));
    const den = Math.sqrt((n0 - n1) * (n0 - n2)), tau = den > 0 ? S / den : NaN;
    const v0 = n * (n - 1) * (2 * n + 5);
    const vt = sum(tx.map((t) => t * (t - 1) * (2 * t + 5))), vu = sum(ty.map((t) => t * (t - 1) * (2 * t + 5)));
    const v1 = sum(tx.map((t) => t * (t - 1))) * sum(ty.map((t) => t * (t - 1)));
    const v2 = sum(tx.map((t) => t * (t - 1) * (t - 2))) * sum(ty.map((t) => t * (t - 1) * (t - 2)));
    const varS = (v0 - vt - vu) / 18 + (n > 1 ? v1 / (2 * n * (n - 1)) : 0) + (n > 2 ? v2 / (9 * n * (n - 1) * (n - 2)) : 0);
    const z = varS > 0 ? S / Math.sqrt(varS) : NaN;
    return { n, r: tau, con, dis, S, z, p: Number.isFinite(z) ? D.normTwoP(z) : NaN, n0, n1, n2 };
  }

  /* matriks korelasi berpasangan; cols = array kolom sejajar per baris (null = kosong), pasangan dihitung dari baris yang lengkap di kedua kolom */
  function corrMatrix(cols, method) {
    const k = cols.length, R = [], P = [], N = [];
    for (let i = 0; i < k; i++) { R.push(new Array(k).fill(NaN)); P.push(new Array(k).fill(NaN)); N.push(new Array(k).fill(0)); }
    for (let i = 0; i < k; i++) for (let j = i; j < k; j++) {
      const x = [], y = [];
      for (let r = 0; r < cols[i].length; r++) { const a = cols[i][r], b = cols[j][r]; if (a !== null && a !== undefined && b !== null && b !== undefined) { x.push(a); y.push(b); } }
      N[i][j] = N[j][i] = x.length;
      if (i === j) { R[i][i] = 1; P[i][i] = NaN; continue; }
      if (x.length < 3) continue;
      const res = method === 'spearman' ? spearman(x, y) : method === 'kendall' ? kendall(x, y) : (() => { const pr = pearson(x, y); return { r: pr.r, ...rTest(pr.r, x.length) }; })();
      R[i][j] = R[j][i] = res.r; P[i][j] = P[j][i] = res.p;
    }
    return { R, P, N };
  }

  window.StatBasic = { mean, variance, tP, tCI, tOne, tTwo, tPaired, pearson, rTest, fisherCI, ranks, tieGroups, spearman, kendall, corrMatrix };

  /* ============================ Uji z (sigma diketahui) ============================ */
  function zP(z, alt) {
    if (alt === 'greater') return D.normCdf(-z);
    if (alt === 'less') return D.normCdf(z);
    return D.normTwoP(z);
  }
  function zCI(est, se, conf, alt) {
    if (alt === 'greater') return [est - D.normQuant(conf) * se, Infinity];
    if (alt === 'less') return [-Infinity, est + D.normQuant(conf) * se];
    const c = D.normQuant(1 - (1 - conf) / 2); return [est - c * se, est + c * se];
  }
  function zOne(x, mu0, sigma, alt, conf) {
    const n = x.length, m = mean(x), se = sigma / Math.sqrt(n), z = (m - mu0) / se;
    return { type: 'one', n, mean: m, sigma, se, mu0, diff: m - mu0, z, p: zP(z, alt), ci: zCI(m, se, conf, alt), alt, conf, d: (m - mu0) / sigma };
  }
  function zTwo(x, y, s1, s2, delta0, alt, conf) {
    const n1 = x.length, n2 = y.length, m1 = mean(x), m2 = mean(y), diff = m1 - m2;
    const se = Math.sqrt(s1 * s1 / n1 + s2 * s2 / n2), z = (diff - delta0) / se;
    return { type: 'two', n1, n2, m1, m2, s1, s2, diff, delta0, se, z, p: zP(z, alt), ci: zCI(diff, se, conf, alt), alt, conf, d: (m1 - m2) / Math.sqrt((s1 * s1 + s2 * s2) / 2) };
  }

  /* ================================= Proporsi ================================= */
  function lchoose(n, k) { return D.lgamma(n + 1) - D.lgamma(k + 1) - D.lgamma(n - k + 1); }
  function binomPmf(k, n, p) { if (p <= 0) return k === 0 ? 1 : 0; if (p >= 1) return k === n ? 1 : 0; return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)); }
  function binomExactP(x, n, p0, alt) {   // uji binomial eksak (dua sisi = jumlah peluang yang tidak lebih besar dari peluang teramati, seperti SciPy/R)
    const pm = []; for (let k = 0; k <= n; k++) pm.push(binomPmf(k, n, p0));
    if (alt === 'greater') { let s = 0; for (let k = x; k <= n; k++) s += pm[k]; return Math.min(1, s); }
    if (alt === 'less') { let s = 0; for (let k = 0; k <= x; k++) s += pm[k]; return Math.min(1, s); }
    const d = pm[x] * (1 + 1e-7); let s = 0; for (let k = 0; k <= n; k++) if (pm[k] <= d) s += pm[k];
    return Math.min(1, s);
  }
  function wilson(x, n, conf, alt) {   // selang skor Wilson
    const ph = x / n, one = alt === 'greater' || alt === 'less', zc = one ? D.normQuant(conf) : D.normQuant(1 - (1 - conf) / 2), z2 = zc * zc;
    const den = 1 + z2 / n, mid = (ph + z2 / (2 * n)) / den, hw = zc * Math.sqrt(ph * (1 - ph) / n + z2 / (4 * n * n)) / den;
    if (alt === 'greater') return [mid - hw, 1];
    if (alt === 'less') return [0, mid + hw];
    return [mid - hw, mid + hw];
  }
  function propOne(x, n, p0, alt, conf) {
    const ph = x / n, se0 = Math.sqrt(p0 * (1 - p0) / n), z = (ph - p0) / se0;
    return { type: 'one', x, n, ph, p0, se0, z, p: zP(z, alt), pExact: binomExactP(x, n, p0, alt), ci: wilson(x, n, conf, alt), alt, conf, np0: n * p0, nq0: n * (1 - p0), h: 2 * Math.asin(Math.sqrt(ph)) - 2 * Math.asin(Math.sqrt(p0)) };
  }
  function propTwo(x1, n1, x2, n2, delta0, alt, conf) {
    const p1 = x1 / n1, p2 = x2 / n2, diff = p1 - p2, pool = (x1 + x2) / (n1 + n2);
    const sePool = Math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2)), seUn = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    const usePool = delta0 === 0, se0 = usePool ? sePool : seUn, z = (diff - delta0) / se0;
    return { type: 'two', x1, n1, x2, n2, p1, p2, diff, delta0, pool, usePool, se0, seUn, z, p: zP(z, alt), ci: zCI(diff, seUn, conf, alt), alt, conf, h: 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2)) };
  }

  /* ============================ Uji kesamaan ragam ============================ */
  function median(a) { const s = a.slice().sort((u, v) => u - v), k = s.length, h = k >> 1; return k % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
  function fTest(x, y, alpha) {   // H0: ragam sama; p dua sisi; CI untuk rasio ragam
    const n1 = x.length, n2 = y.length, v1 = variance(x), v2 = variance(y), F = v1 / v2, d1 = n1 - 1, d2 = n2 - 1;
    const cdf = D.fCdf(F, d1, d2), sf = D.fSf(F, d1, d2), p = Math.min(1, 2 * Math.min(cdf, sf));
    const ciV = [F / D.fQuant(1 - alpha / 2, d1, d2), F / D.fQuant(alpha / 2, d1, d2)];
    return { n1, n2, v1, v2, s1: Math.sqrt(v1), s2: Math.sqrt(v2), F, d1, d2, p, ciVar: ciV, ciSd: [Math.sqrt(ciV[0]), Math.sqrt(ciV[1])], alpha };
  }
  function levene(groups, center) {   // center: 'median' (Brown-Forsythe, bawaan Minitab) atau 'mean'
    const k = groups.length, N = groups.reduce((s, g) => s + g.length, 0);
    const Z = groups.map((g) => { const c = center === 'mean' ? mean(g) : median(g); return g.map((v) => Math.abs(v - c)); });
    const zb = Z.map(mean), zall = sum(Z.map((z) => sum(z))) / N;
    const num = sum(Z.map((z, i) => z.length * (zb[i] - zall) * (zb[i] - zall)));
    const den = sum(Z.map((z, i) => sum(z.map((v) => (v - zb[i]) * (v - zb[i])))));
    const W = ((N - k) / (k - 1)) * num / den, d1 = k - 1, d2 = N - k;
    return { W, d1, d2, p: D.fSf(W, d1, d2), k, N, center, zb, zall, num, den };
  }
  function bartlett(groups) {
    const k = groups.length, ns = groups.map((g) => g.length), vs = groups.map((g) => variance(g)), N = sum(ns), df = N - k;
    const sp2 = sum(ns.map((n, i) => (n - 1) * vs[i])) / df;
    const num = df * Math.log(sp2) - sum(ns.map((n, i) => (n - 1) * Math.log(vs[i])));
    const c = 1 + (sum(ns.map((n) => 1 / (n - 1))) - 1 / df) / (3 * (k - 1)), T = num / c;
    return { T, df: k - 1, p: D.chi2Sf(T, k - 1), sp2, c, k, N };
  }

  /* ================================ Normalitas ================================ */
  function moments(x) {
    const n = x.length, m = mean(x); let m2 = 0, m3 = 0, m4 = 0;
    for (const v of x) { const d = v - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; }
    m2 /= n; m3 /= n; m4 /= n;
    return { n, mean: m, sd: Math.sqrt(variance(x, m)), skew: m3 / Math.pow(m2, 1.5), kurt: m4 / (m2 * m2) };   // kurt = kurtosis biasa (normal = 3)
  }
  function jarqueBera(x) {
    const mo = moments(x), JB = mo.n / 6 * (mo.skew * mo.skew + (mo.kurt - 3) * (mo.kurt - 3) / 4);
    return { JB, p: D.chi2Sf(JB, 2), skew: mo.skew, kurt: mo.kurt, n: mo.n };
  }
  function andersonDarling(x) {   // normal dengan mean & sd dari sampel; p-value D'Agostino & Stephens (1986)
    const n = x.length, s = x.slice().sort((a, b) => a - b), m = mean(s), sd = Math.sqrt(variance(s, m));
    let A = 0;
    for (let i = 0; i < n; i++) {
      const lo = D.normCdf((s[i] - m) / sd), hi = D.normCdf((s[n - 1 - i] - m) / sd);
      A += (2 * i + 1) * (Math.log(Math.max(lo, 1e-300)) + Math.log(Math.max(1 - hi, 1e-300)));
    }
    const A2 = -n - A / n, As = A2 * (1 + 0.75 / n + 2.25 / (n * n));
    let p;
    if (As >= 0.6) p = Math.exp(1.2937 - 5.709 * As + 0.0186 * As * As);
    else if (As >= 0.34) p = Math.exp(0.9177 - 4.279 * As - 1.38 * As * As);
    else if (As > 0.2) p = 1 - Math.exp(-8.318 + 42.796 * As - 59.938 * As * As);
    else p = 1 - Math.exp(-13.436 + 101.14 * As - 223.73 * As * As);
    return { A2, As, p: Math.min(1, Math.max(0, p)), n };
  }
  function polyR(cc, nord, x) { let ret = cc[0]; if (nord > 1) { let p = x * cc[nord - 1]; for (let j = nord - 2; j > 0; j--) p = (p + cc[j]) * x; ret += p; } return ret; }
  function shapiroWilk(x) {   // Royston (1992/1995), algoritma AS R94; berlaku untuk 3 <= n <= 5000
    const n = x.length, s = x.slice().sort((a, b) => a - b), nn2 = Math.floor(n / 2);
    const G = [-2.273, 0.459], C1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], C2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
    const C3 = [0.544, -0.39978, 0.025054, -6.714e-4], C4 = [1.3822, -0.77857, 0.062767, -0.0020322], C5 = [-1.5861, -0.31082, -0.083751, 0.0038915], C6 = [-0.4803, -0.082676, 0.0030302];
    const a = new Array(nn2 + 1).fill(0);   // a[1..nn2]
    if (n === 3) a[1] = Math.SQRT1_2;
    else {
      const an25 = n + 0.25, m = [0]; let summ2 = 0;
      for (let i = 1; i <= nn2; i++) { const v = D.normQuant((i - 0.375) / an25); m.push(v); summ2 += v * v; }
      summ2 *= 2; const ss = Math.sqrt(summ2), rsn = 1 / Math.sqrt(n);
      const a1 = polyR(C1, 6, rsn) - m[1] / ss; let i1, fac;
      if (n > 5) { i1 = 3; const a2 = -m[2] / ss + polyR(C2, 6, rsn); fac = Math.sqrt((summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2 * a1 * a1 - 2 * a2 * a2)); a[2] = a2; }
      else { i1 = 2; fac = Math.sqrt((summ2 - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1)); }
      a[1] = a1; for (let i = i1; i <= nn2; i++) a[i] = -m[i] / fac;
    }
    const range = s[n - 1] - s[0];
    if (!(range > 1e-19)) return { W: NaN, p: NaN, n, a, sorted: s, constant: true };
    const af = new Array(n).fill(0);
    for (let k = 0; k < nn2; k++) { af[k] = -a[k + 1]; af[n - 1 - k] = a[k + 1]; }
    const xs = s.map((v) => v / range), sx = mean(xs), sa = mean(af);
    let ssa = 0, ssx = 0, sax = 0;
    for (let i = 0; i < n; i++) { const da = af[i] - sa, dx = xs[i] - sx; ssa += da * da; ssx += dx * dx; sax += da * dx; }
    const sq = Math.sqrt(ssa * ssx), w1 = (sq - sax) * (sq + sax) / (ssa * ssx), W = 1 - w1;
    let p;
    if (n === 3) { p = 1.90985931710274 * (Math.asin(Math.sqrt(W)) - 1.04719755119660); if (p < 0) p = 0; }
    else {
      const y = Math.log(w1), xx = Math.log(n); let mu, sg;
      if (n <= 11) { const gm = polyR(G, 2, n); if (y >= gm) return { W, p: 1e-99, n, a, sorted: s }; const yy = -Math.log(gm - y); mu = polyR(C3, 4, n); sg = Math.exp(polyR(C4, 4, n)); p = D.normCdf(-(yy - mu) / sg); }
      else { mu = polyR(C5, 4, xx); sg = Math.exp(polyR(C6, 3, xx)); p = D.normCdf(-(y - mu) / sg); }
    }
    return { W, p, n, a, sorted: s, nn2 };
  }

  window.StatBasic = Object.assign(window.StatBasic, { median, zP, zCI, zOne, zTwo, binomExactP, wilson, propOne, propTwo, fTest, levene, bartlett, moments, jarqueBera, andersonDarling, shapiroWilk });
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatBasic;
})();
