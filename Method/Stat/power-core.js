/* =========================================================================
   POWER-CORE - daya uji & ukuran sampel (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   Uji t (satu sampel, dua sampel, berpasangan) lewat distribusi t non-sentral, ANOVA satu arah lewat F non-sentral,
   satu dan dua proporsi (pendekatan normal), pencari ukuran sampel / efek terdeteksi, dan rumus ukuran sampel survei
   (Slovin, Cochran, Lemeshow, estimasi rata-rata). Memakai window.StatDist. Muat SETELAH stat-dist.js.
   alt: 'two' | 'greater' | 'less'
   ========================================================================= */
(function () {
  'use strict';
  const D = window.StatDist;
  function glNodes(n) { const x = [], w = []; for (let i = 0; i < n; i++) { let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 0; for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; } pp = n * (z * p1 - p2) / (z * z - 1); const dz = p1 / pp; z -= dz; if (Math.abs(dz) < 1e-15) break; } x.push(z); w.push(2 / ((1 - z * z) * pp * pp)); } return { x, w }; }
  const GL = glNodes(16);
  function panels(a, b, np) { const xs = [], ws = [], h = (b - a) / np; for (let p = 0; p < np; p++) { const mid = a + p * h + h / 2; for (let i = 0; i < GL.x.length; i++) { xs.push(mid + GL.x[i] * h / 2); ws.push(GL.w[i] * h / 2); } } return { x: xs, w: ws }; }
  function chiQ(p, nu) { let lo = 0, hi = Math.max(10, nu * 10); while (D.chi2Cdf(hi, nu) < p) hi *= 2; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (D.chi2Cdf(m, nu) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  const sCache = {};
  function sGrid(nu) {   // S = sqrt(chi2_nu / nu); simpul dan bobot (sudah dikali kerapatan)
    const key = nu.toFixed(6); if (sCache[key]) return sCache[key];
    const lo = Math.sqrt(chiQ(1e-14, nu) / nu), hi = Math.sqrt(chiQ(1 - 1e-14, nu) / nu), g = panels(lo, hi, nu > 200 ? 6 : 12), c = Math.log(2) + (nu / 2) * Math.log(nu / 2) - D.lgamma(nu / 2);
    return (sCache[key] = { s: g.x, w: g.w.map((wi, i) => wi * Math.exp(c + (nu - 1) * Math.log(g.x[i]) - nu * g.x[i] * g.x[i] / 2)) });
  }
  /* P(T' > t) dan P(T' < t) untuk T' ~ t non-sentral(df, ncp) */
  function ntSf(t, df, ncp) { const g = sGrid(df); let tot = 0; for (let i = 0; i < g.s.length; i++) tot += g.w[i] * D.normCdf(ncp - t * g.s[i]); return Math.min(1, Math.max(0, tot)); }
  function ntCdf(t, df, ncp) { return 1 - ntSf(t, df, ncp); }

  /* F non-sentral: P(F' <= f) = sum_j Poisson(j; lam/2) I_x(df1/2 + j, df2/2) */
  function ncfCdf(f, df1, df2, lam) {
    if (f <= 0) return 0; const x = df1 * f / (df1 * f + df2), h = lam / 2; let tot = 0, jmax = Math.ceil(h + 12 * Math.sqrt(h + 1) + 60), lp = -h;
    for (let j = 0; j <= jmax; j++) { if (j > 0) lp += Math.log(h) - Math.log(j); const pw = h === 0 ? (j === 0 ? 1 : 0) : Math.exp(lp); tot += pw * D.ibeta(df1 / 2 + j, df2 / 2, x); }
    return Math.min(1, tot);
  }

  /* ------------------------------------- daya uji t ------------------------------------- */
  function powerT(o) {   // o: {type:'one'|'paired'|'two', n (atau n1,n2), d (ukuran efek Cohen = beda/SD), alpha, alt}
    const n1 = o.n1 || o.n, n2 = o.n2 || n1, two = o.type === 'two', df = two ? n1 + n2 - 2 : n1 - 1, ncp = Math.abs(o.d) * (two ? 1 / Math.sqrt(1 / n1 + 1 / n2) : Math.sqrt(n1)), alt = o.alt || 'two';
    if (df < 1) return NaN;
    if (alt === 'two') { const tc = D.tCrit(df, 1 - o.alpha); return Math.min(1, ntSf(tc, df, ncp) + ntCdf(-tc, df, ncp)); }
    const tc = D.tCrit(df, 1 - 2 * o.alpha); return ntSf(tc, df, ncp);
  }
  function powerAnova(o) {   // o: {k, n (per kelompok), lambda | (delta, sigma), alpha}
    const k = o.k, n = o.n, df1 = k - 1, df2 = k * (n - 1), lam = o.lambda !== undefined ? o.lambda : n * (o.delta * o.delta / 2) / (o.sigma * o.sigma);
    if (df2 < 1) return NaN; const fc = D.fQuant(1 - o.alpha, df1, df2); return Math.min(1, 1 - ncfCdf(fc, df1, df2, lam));
  }
  /* ------------------------------------ daya uji proporsi ------------------------------------ */
  function powerProp1(o) {   // H0: p = p0 ; benar p1
    const { p0, p1, n, alpha } = o, alt = o.alt || 'two', s0 = Math.sqrt(p0 * (1 - p0) / n), s1 = Math.sqrt(p1 * (1 - p1) / n), dlt = p1 - p0;
    if (alt === 'two') { const z = D.normQuant(1 - alpha / 2); return D.normCdf((dlt - z * s0) / s1) + D.normCdf((-dlt - z * s0) / s1); }
    const z = D.normQuant(1 - alpha); return alt === 'greater' ? D.normCdf((dlt - z * s0) / s1) : D.normCdf((-dlt - z * s0) / s1);
  }
  function powerProp2(o) {   // H0: p1 = p2 (penaksir gabungan di bawah H0)
    const { p1, p2, alpha } = o, n1 = o.n1 || o.n, n2 = o.n2 || n1, alt = o.alt || 'two', pb = (n1 * p1 + n2 * p2) / (n1 + n2), s0 = Math.sqrt(pb * (1 - pb) * (1 / n1 + 1 / n2)), s1 = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2), dlt = p1 - p2;
    if (alt === 'two') { const z = D.normQuant(1 - alpha / 2); return D.normCdf((dlt - z * s0) / s1) + D.normCdf((-dlt - z * s0) / s1); }
    const z = D.normQuant(1 - alpha); return alt === 'greater' ? D.normCdf((dlt - z * s0) / s1) : D.normCdf((-dlt - z * s0) / s1);
  }
  /* ---------------------------------------- pencari ---------------------------------------- */
  function solveN(fn, target, nmin) {   // n bulat terkecil dengan fn(n) >= target (fn naik terhadap n)
    nmin = nmin || 2; let lo = nmin, hi = nmin; if (fn(lo) >= target) return lo;
    while (!(fn(hi) >= target)) { lo = hi; hi *= 2; if (hi > 5e6) return Infinity; }
    while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (fn(m) >= target) hi = m; else lo = m; } return hi;
  }
  function solveEffect(fn, target, lo, hi) {   // efek terkecil dengan fn(efek) >= target (fn naik terhadap efek)
    if (fn(hi) < target) return NaN; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (fn(m) >= target) hi = m; else lo = m; } return hi;
  }
  /* --------------------------------- ukuran sampel survei --------------------------------- */
  const zOf = (conf) => D.normQuant(1 - (1 - conf) / 2);
  const survey = {
    slovin: (N, e) => N / (1 + N * e * e),
    cochran: (conf, p, e, N) => { const z = zOf(conf), n0 = z * z * p * (1 - p) / (e * e); return { n0, n: N ? n0 / (1 + (n0 - 1) / N) : n0 }; },
    lemeshow: (conf, p, d, N) => { const z = zOf(conf), v = z * z * p * (1 - p); return N ? N * v / (d * d * (N - 1) + v) : v / (d * d); },
    mean: (conf, sigma, E, N) => { const z = zOf(conf), n0 = (z * sigma / E) ** 2; return { n0, n: N ? n0 / (1 + (n0 - 1) / N) : n0 }; },
  };
  window.StatPower = { ntSf, ntCdf, ncfCdf, powerT, powerAnova, powerProp1, powerProp2, solveN, solveEffect, survey, zOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatPower;
})();
