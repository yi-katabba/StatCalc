/* =========================================================================
   QUALITY-CORE - inti hitungan Control Charts, Quality Tools, dan DOE faktorial 2^k (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   - Konstanta bagan kendali (d2, d3, c4, A2, A3, D3, D4, B3, B4) dihitung langsung, bukan dari tabel
   - Bagan kendali: X-bar/R, X-bar/S, I-MR, p, np, c, u; uji kondisi di luar kendali (Test 1-6)
   - Kapabilitas proses (Cp, Cpk, Pp, Ppk, Cpm), tabel Pareto
   - Faktorial 2^k: efek, koefisien, ANOVA, galat murni / lack-of-fit, Lenth PSE (memakai reg-core.js untuk OLS)
   Memakai window.StatDist dan window.StatRegX. Muat SETELAH stat-dist.js dan reg-core.js.
   ========================================================================= */
(function () {
  'use strict';
  const D = window.StatDist;
  const sum = (a) => a.reduce((s, v) => s + v, 0), mean = (a) => sum(a) / a.length;
  const variance = (a) => { const m = mean(a); return sum(a.map((v) => (v - m) ** 2)) / (a.length - 1); };
  const sd = (a) => Math.sqrt(variance(a));
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), k = s.length, h = k >> 1; return k % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

  /* ------------------------ konstanta bagan kendali ------------------------ */
  function glNodes(n) { const x = [], w = []; for (let i = 0; i < n; i++) { let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 0; for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; } pp = n * (z * p1 - p2) / (z * z - 1); const dz = p1 / pp; z -= dz; if (Math.abs(dz) < 1e-15) break; } x.push(z); w.push(2 / ((1 - z * z) * pp * pp)); } return { x, w }; }
  const GL = glNodes(16);
  function panels(a, b, np) { const xs = [], ws = [], h = (b - a) / np; for (let p = 0; p < np; p++) { const mid = a + p * h + h / 2; for (let i = 0; i < GL.x.length; i++) { xs.push(mid + GL.x[i] * h / 2); ws.push(GL.w[i] * h / 2); } } return { x: xs, w: ws }; }
  const c4fn = (n) => Math.sqrt(2 / (n - 1)) * Math.exp(D.lgamma(n / 2) - D.lgamma((n - 1) / 2));
  const cMemo = {};
  function constants(n) {
    if (cMemo[n]) return cMemo[n];
    const zg = panels(-9, 9, 10), phiz = zg.x.map((z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)), Phiz = zg.x.map((z) => D.normCdf(z)), wg = panels(0, 14, 24);
    let e1 = 0, e2 = 0;
    wg.x.forEach((w, a) => { let W = 0; for (let i = 0; i < zg.x.length; i++) { const d = Phiz[i] - D.normCdf(zg.x[i] - w); if (d > 0) W += zg.w[i] * phiz[i] * Math.pow(d, n - 1); } W *= n; const t = 1 - W; e1 += wg.w[a] * t; e2 += wg.w[a] * 2 * w * t; });
    const d2 = e1, d3 = Math.sqrt(Math.max(0, e2 - e1 * e1)), c4 = Math.sqrt(2 / (n - 1)) * Math.exp(D.lgamma(n / 2) - D.lgamma((n - 1) / 2)), c5 = Math.sqrt(1 - c4 * c4);
    return (cMemo[n] = { n, d2, d3, c4, A2: 3 / (d2 * Math.sqrt(n)), A3: 3 / (c4 * Math.sqrt(n)), D3: Math.max(0, 1 - 3 * d3 / d2), D4: 1 + 3 * d3 / d2, B3: Math.max(0, 1 - 3 * c5 / c4), B4: 1 + 3 * c5 / c4 });
  }

  /* --------------------------- uji kondisi di luar kendali --------------------------- */
  function rules(z, which) {   // z[i] = (x_i - CL_i) / sigma_i ; which = [1..6]; kembalikan {flags: [Set<int>...], byTest}
    const n = z.length, hit = Array.from({ length: n }, () => []), on = (t) => which.includes(t), mark = (i, t) => { if (!hit[i].includes(t)) hit[i].push(t); };
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(z[i])) continue;
      if (on(1) && Math.abs(z[i]) > 3) mark(i, 1);
      if (on(2) && i >= 8) { const w = z.slice(i - 8, i + 1); if (w.every((v) => v > 0) || w.every((v) => v < 0)) mark(i, 2); }
      if (on(3) && i >= 5) { const w = z.slice(i - 5, i + 1); let inc = true, dec = true; for (let k = 1; k < 6; k++) { if (!(w[k] > w[k - 1])) inc = false; if (!(w[k] < w[k - 1])) dec = false; } if (inc || dec) mark(i, 3); }
      if (on(4) && i >= 13) { const w = z.slice(i - 13, i + 1); let ok = true; for (let k = 2; k < 14; k++) if (!((w[k] - w[k - 1]) * (w[k - 1] - w[k - 2]) < 0)) { ok = false; break; } if (ok) mark(i, 4); }
      if (on(5) && i >= 2) { const w = z.slice(i - 2, i + 1); if ((z[i] > 2 && w.filter((v) => v > 2).length >= 2) || (z[i] < -2 && w.filter((v) => v < -2).length >= 2)) mark(i, 5); }
      if (on(6) && i >= 4) { const w = z.slice(i - 4, i + 1); if ((z[i] > 1 && w.filter((v) => v > 1).length >= 4) || (z[i] < -1 && w.filter((v) => v < -1).length >= 4)) mark(i, 6); }
    }
    return hit;
  }
  function mkChart(name, values, cl, ucl, lcl, sig, which, extra) {
    const n = values.length, f = (a) => (Array.isArray(a) ? a : new Array(n).fill(a)), CL = f(cl), U = f(ucl), L = f(lcl), S = f(sig), z = values.map((v, i) => (S[i] > 0 ? (v - CL[i]) / S[i] : 0));
    return Object.assign({ name, values, cl: CL, ucl: U, lcl: L, sigma: S, z, hits: rules(z, which) }, extra || {});
  }
  const keepIdx = (n, ex) => Array.from({ length: n }, (_, i) => i).filter((i) => !(ex && ex.has(i)));

  /* -------------------------------------- bagan variabel -------------------------------------- */
  function xbarR(rows, which, exclude) {   // rows: subgrup x n
    const m = rows.length, n = rows[0].length, c = constants(n), xb = rows.map(mean), R = rows.map((r) => Math.max.apply(null, r) - Math.min.apply(null, r)), k = keepIdx(m, exclude);
    const Rbar = mean(k.map((i) => R[i])), X2 = mean(k.map((i) => xb[i])), s = Rbar / c.d2;
    return { type: 'xbar-r', n, m, c, sigmaHat: s, charts: [mkChart('X̄', xb, X2, X2 + c.A2 * Rbar, X2 - c.A2 * Rbar, c.A2 * Rbar / 3, which), mkChart('R', R, Rbar, c.D4 * Rbar, c.D3 * Rbar, (c.D4 * Rbar - Rbar) / 3, [1])], center: X2, spread: Rbar };
  }
  function xbarS(rows, which, exclude) {
    const m = rows.length, n = rows[0].length, c = constants(n), xb = rows.map(mean), S = rows.map(sd), k = keepIdx(m, exclude);
    const Sbar = mean(k.map((i) => S[i])), X2 = mean(k.map((i) => xb[i])), s = Sbar / c.c4;
    return { type: 'xbar-s', n, m, c, sigmaHat: s, charts: [mkChart('X̄', xb, X2, X2 + c.A3 * Sbar, X2 - c.A3 * Sbar, c.A3 * Sbar / 3, which), mkChart('S', S, Sbar, c.B4 * Sbar, c.B3 * Sbar, (c.B4 * Sbar - Sbar) / 3, [1])], center: X2, spread: Sbar };
  }
  function imr(x, which, exclude) {
    const n = x.length, c = constants(2), mr = [NaN]; for (let i = 1; i < n; i++) mr.push(Math.abs(x[i] - x[i - 1]));
    const kx = keepIdx(n, exclude), kmr = []; for (let i = 1; i < n; i++) if (!(exclude && (exclude.has(i) || exclude.has(i - 1)))) kmr.push(mr[i]);
    const xbar = mean(kx.map((i) => x[i])), mrbar = mean(kmr), s = mrbar / c.d2;
    return { type: 'imr', n, c, sigmaHat: s, charts: [mkChart('Individu (I)', x, xbar, xbar + 3 * s, xbar - 3 * s, s, which), mkChart('Rentang bergerak (MR)', mr, mrbar, c.D4 * mrbar, 0, (c.D4 * mrbar - mrbar) / 3, [1])], center: xbar, spread: mrbar };
  }
  /* ------------------------------------- bagan atribut ------------------------------------- */
  function pChart(x, nn, which, exclude) {   // nn: ukuran sampel per titik (array)
    const m = x.length, k = keepIdx(m, exclude), pbar = sum(k.map((i) => x[i])) / sum(k.map((i) => nn[i])), p = x.map((v, i) => v / nn[i]);
    const sg = nn.map((n) => Math.sqrt(pbar * (1 - pbar) / n)), ucl = sg.map((s) => Math.min(1, pbar + 3 * s)), lcl = sg.map((s) => Math.max(0, pbar - 3 * s));
    return { type: 'p', m, pbar, charts: [mkChart('Proporsi cacat (p)', p, pbar, ucl, lcl, sg, which)], center: pbar };
  }
  function npChart(x, n, which, exclude) {
    const m = x.length, k = keepIdx(m, exclude), pbar = sum(k.map((i) => x[i])) / (n * k.length), s = Math.sqrt(n * pbar * (1 - pbar)), cl = n * pbar;
    return { type: 'np', m, n, pbar, charts: [mkChart('Jumlah cacat (np)', x, cl, cl + 3 * s, Math.max(0, cl - 3 * s), s, which)], center: cl };
  }
  function cChart(x, which, exclude) {
    const m = x.length, k = keepIdx(m, exclude), cbar = mean(k.map((i) => x[i])), s = Math.sqrt(cbar);
    return { type: 'c', m, charts: [mkChart('Jumlah cacat (c)', x, cbar, cbar + 3 * s, Math.max(0, cbar - 3 * s), s, which)], center: cbar };
  }
  function uChart(x, nn, which, exclude) {
    const m = x.length, k = keepIdx(m, exclude), ubar = sum(k.map((i) => x[i])) / sum(k.map((i) => nn[i])), u = x.map((v, i) => v / nn[i]), sg = nn.map((n) => Math.sqrt(ubar / n));
    return { type: 'u', m, ubar, charts: [mkChart('Cacat per unit (u)', u, ubar, sg.map((s) => ubar + 3 * s), sg.map((s) => Math.max(0, ubar - 3 * s)), sg, which)], center: ubar };
  }
  /* tinjau ulang batas: buang titik di luar kendali (Test 1) lalu hitung lagi sampai stabil (maks 10 putaran) */
  function iterate(fn, maxIter) {
    let ex = new Set(), res = fn(ex), excluded = [];
    for (let it = 0; it < (maxIter || 10); it++) { const bad = new Set(); res.charts[0].hits.forEach((h, i) => { if (h.includes(1)) bad.add(i); }); if (res.charts[1]) res.charts[1].hits.forEach((h, i) => { if (h.includes(1)) bad.add(i); }); const add = Array.from(bad).filter((i) => !ex.has(i)); if (!add.length) break; add.forEach((i) => ex.add(i)); res = fn(ex); }
    res.excluded = Array.from(ex).sort((a, b) => a - b); return res;
  }

  /* ----------------------------------- kapabilitas proses ----------------------------------- */
  function chi2Quant(p, k) { let lo = 0, hi = Math.max(10, k * 10); while (D.chi2Cdf(hi, k) < p) hi *= 2; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (D.chi2Cdf(m, k) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  function capability(x, o) {   // o: {lsl, usl, target, sub (ukuran subgrup, 1 = individu), alpha}
    const n = x.length, mu = mean(x), sOver = sd(x), sub = o.sub || 1, alpha = o.alpha || 0.05; let sW, method;
    if (sub <= 1) { const c = constants(2); let mr = 0; for (let i = 1; i < n; i++) mr += Math.abs(x[i] - x[i - 1]); sW = (mr / (n - 1)) / c.d2; method = 'MR̄/d₂ (rentang bergerak, n = 2)'; }
    else { const g = Math.floor(n / sub); let ss = 0, df = 0; for (let j = 0; j < g; j++) { const s = x.slice(j * sub, (j + 1) * sub); ss += (sub - 1) * variance(s); df += sub - 1; } const sp = Math.sqrt(ss / df); sW = sp / c4fn(df + 1); method = `SD gabungan subgrup (m = ${sub}, ${g} subgrup) dengan koreksi c₄`; }
    const hasL = Number.isFinite(o.lsl), hasU = Number.isFinite(o.usl), out = { n, mean: mu, sigmaW: sW, sigmaO: sOver, method, lsl: o.lsl, usl: o.usl, hasL, hasU, sub };
    const idx = (s) => { const cpu = hasU ? (o.usl - mu) / (3 * s) : NaN, cpl = hasL ? (mu - o.lsl) / (3 * s) : NaN, cp = hasL && hasU ? (o.usl - o.lsl) / (6 * s) : NaN, cpk = Math.min.apply(null, [cpu, cpl].filter(Number.isFinite)); return { cp, cpu, cpl, cpk }; };
    out.within = idx(sW); out.overall = idx(sOver);
    const ppm = (s) => ({ below: hasL ? D.normCdf((o.lsl - mu) / s) * 1e6 : 0, above: hasU ? (1 - D.normCdf((o.usl - mu) / s)) * 1e6 : 0 });
    out.ppmWithin = ppm(sW); out.ppmOverall = ppm(sOver); out.ppmWithin.total = out.ppmWithin.below + out.ppmWithin.above; out.ppmOverall.total = out.ppmOverall.below + out.ppmOverall.above;
    out.obs = { below: hasL ? x.filter((v) => v < o.lsl).length / n * 1e6 : 0, above: hasU ? x.filter((v) => v > o.usl).length / n * 1e6 : 0 }; out.obs.total = out.obs.below + out.obs.above;
    out.zbench = { within: D.normQuant(1 - out.ppmWithin.total / 1e6), overall: D.normQuant(1 - out.ppmOverall.total / 1e6) };
    if (Number.isFinite(o.target) && hasL && hasU) out.cpm = (o.usl - o.lsl) / (6 * Math.sqrt(sOver * sOver + (mu - o.target) ** 2));
    const df = n - 1, zc = D.normQuant(1 - alpha / 2);
    if (Number.isFinite(out.overall.cp)) out.ciPp = [out.overall.cp * Math.sqrt(chi2Quant(alpha / 2, df) / df), out.overall.cp * Math.sqrt(chi2Quant(1 - alpha / 2, df) / df)];
    out.ciPpk = [out.overall.cpk - zc * Math.sqrt(1 / (9 * n) + out.overall.cpk ** 2 / (2 * df)), out.overall.cpk + zc * Math.sqrt(1 / (9 * n) + out.overall.cpk ** 2 / (2 * df))];
    return out;
  }

  /* -------------------------------------------- Pareto -------------------------------------------- */
  function pareto(items, opts) {   // items: [{name, count}]
    opts = opts || {}; let it = items.filter((x) => x.count > 0).slice(), tot = sum(it.map((x) => x.count)); it.sort((a, b) => b.count - a.count);
    if (opts.otherPct > 0) { const small = it.filter((x) => x.count / tot * 100 < opts.otherPct); if (small.length > 1) { it = it.filter((x) => !small.includes(x)); it.push({ name: 'Lainnya', count: sum(small.map((x) => x.count)), merged: small.length }); } }
    const main = it.filter((x) => x.name !== 'Lainnya' || !x.merged), oth = it.filter((x) => x.merged); it = main.concat(oth);
    let c = 0; const rows = it.map((x) => { c += x.count; return { name: x.name, count: x.count, pct: x.count / tot * 100, cum: c / tot * 100, merged: x.merged }; });
    const vital = rows.findIndex((r) => r.cum >= (opts.cutoff || 80) - 1e-9) + 1;
    return { rows, total: tot, vital };
  }

  /* ---------------------------------------- faktorial 2^k ---------------------------------------- */
  function subsets(k, maxOrder) { const out = []; for (let mask = 1; mask < (1 << k); mask++) { const ids = []; for (let j = 0; j < k; j++) if (mask & (1 << j)) ids.push(j); if (ids.length <= maxOrder) out.push(ids); } out.sort((a, b) => a.length - b.length || a.join() .localeCompare(b.join())); return out; }
  function factorial2k(F, y, names, maxOrder, alpha) {   // F: baris x k nilai faktor (dua taraf per kolom)
    const RG = window.StatRegX, N = y.length, k = F[0].length; alpha = alpha || 0.05;
    const levels = names.map((_, j) => Array.from(new Set(F.map((r) => r[j]))).sort((a, b) => a - b)); if (levels.some((l) => l.length !== 2)) { const e = new Error('levels'); e.levels = levels.map((l) => l.length); throw e; }
    const X = F.map((r) => r.map((v, j) => (v === levels[j][0] ? -1 : 1))), terms = subsets(k, maxOrder), tname = (ids) => ids.map((j) => names[j]).join('×');
    const M = X.map((r) => [1].concat(terms.map((ids) => ids.reduce((p, j) => p * r[j], 1)))), m = RG.ols(M, y);
    const dfe = m.dfe, mse = m.mse, eff = terms.map((ids, i) => 2 * m.beta[i + 1]), ss = terms.map((_, i) => (dfe > 0 ? m.t[i + 1] ** 2 * mse : N * m.beta[i + 1] ** 2));
    const t = terms.map((ids, i) => ({ ids, name: tname(ids), order: ids.length, effect: eff[i], coef: m.beta[i + 1], se: m.se[i + 1], t: m.t[i + 1], p: m.p_t[i + 1], ss: ss[i], F: dfe > 0 ? m.t[i + 1] ** 2 : NaN, contrib: 0 }));
    const sst = m.sst; t.forEach((x) => { x.contrib = x.ss / sst * 100; });
    // galat murni: baris dengan kombinasi tingkat sama
    const grp = {}; X.forEach((r, i) => { const key = r.join(','); (grp[key] = grp[key] || []).push(y[i]); });
    let sspe = 0, dfpe = 0; Object.values(grp).forEach((g) => { if (g.length > 1) { sspe += sum(g.map((v) => (v - mean(g)) ** 2)); dfpe += g.length - 1; } });
    const lof = dfpe > 0 && dfe - dfpe > 0 ? { ss: m.sse - sspe, df: dfe - dfpe, F: ((m.sse - sspe) / (dfe - dfpe)) / (sspe / dfpe) } : null; if (lof) lof.p = D.fSf(lof.F, lof.df, dfpe);
    // Lenth
    const ab = eff.map(Math.abs), s0 = 1.5 * median(ab), pse = 1.5 * median(ab.filter((v) => v < 2.5 * s0)), dl = ab.length / 3, me = pse * D.tCrit(dl, 1 - alpha), sme = pse * D.tCrit(dl, Math.pow(1 - alpha, 1 / ab.length));
    const means = names.map((_, j) => [0, 1].map((l) => mean(y.filter((_, i) => X[i][j] === (l ? 1 : -1)))));
    const balanced = F.length === Math.pow(2, k) * (F.length / Math.pow(2, k)) && Object.keys(grp).length === Math.pow(2, k) && new Set(Object.values(grp).map((g) => g.length)).size === 1;
    return { N, k, levels, terms: t, model: m, mse, dfe, sse: m.sse, sst, ssr: m.ssr, r2: m.r2, adjr2: m.adjr2, F: m.F, pF: m.pF, dfm: m.dfm, grand: mean(y), sspe, dfpe, lof, lenth: { pse, me, sme, df: dl }, means, balanced, nRuns: Object.keys(grp).length, replicates: F.length / Object.keys(grp).length };
  }

  window.StatQuality = { c4fn, constants, rules, xbarR, xbarS, imr, pChart, npChart, cChart, uChart, iterate, capability, pareto, factorial2k, chi2Quant, subsets };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatQuality;
})();
