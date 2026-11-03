/* =========================================================================
   REG-CORE - inti hitungan regresi lanjutan (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   OLS berbasis QR Householder (stabil), regresi polinomial, seleksi variabel (stepwise / forward / backward),
   best subsets (semua himpunan bagian), dan regresi logistik biner (IRLS / Newton-Raphson).
   Memakai window.StatDist. Muat SETELAH stat-dist.js.
   X selalu berupa array baris; kolom konstanta (intercept) ditambahkan oleh pemanggil lewat addIntercept().
   ========================================================================= */
(function () {
  'use strict';
  const D = window.StatDist;
  const sum = (a) => a.reduce((s, v) => s + v, 0), mean = (a) => sum(a) / a.length;
  const addIntercept = (X) => X.map((r) => [1].concat(r));

  /* ---------- QR Householder pada matriks [X | y]; kembalikan R, Q'y, SSE ---------- */
  function qrFit(X, y) {
    const n = X.length, p = X[0].length, A = X.map((r, i) => r.concat([y[i]]));
    for (let j = 0; j < p; j++) {
      let norm = 0; for (let i = j; i < n; i++) norm += A[i][j] * A[i][j]; norm = Math.sqrt(norm);
      if (norm === 0) continue;
      const alpha = A[j][j] > 0 ? -norm : norm, v = new Array(n).fill(0); v[j] = A[j][j] - alpha; for (let i = j + 1; i < n; i++) v[i] = A[i][j];
      let vn = 0; for (let i = j; i < n; i++) vn += v[i] * v[i]; if (vn === 0) continue;
      for (let c = j; c <= p; c++) { let d = 0; for (let i = j; i < n; i++) d += v[i] * A[i][c]; const f = 2 * d / vn; for (let i = j; i < n; i++) A[i][c] -= f * v[i]; }
    }
    const R = []; for (let i = 0; i < p; i++) R.push(A[i].slice(0, p));
    const qty = []; for (let i = 0; i < p; i++) qty.push(A[i][p]);
    let sse = 0; for (let i = p; i < n; i++) sse += A[i][p] * A[i][p];
    return { R, qty, sse, n, p };
  }
  function backSub(R, b) { const p = R.length, x = new Array(p); for (let i = p - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < p; j++) s -= R[i][j] * x[j]; x[i] = s / R[i][i]; } return x; }
  function invUpper(R) {   // invers segitiga atas
    const p = R.length, I = []; for (let i = 0; i < p; i++) { I.push(new Array(p).fill(0)); }
    for (let c = 0; c < p; c++) { const e = new Array(p).fill(0); e[c] = 1; const x = backSub(R, e); for (let r = 0; r < p; r++) I[r][c] = x[r]; }
    return I;
  }

  /* --------------------------------- OLS --------------------------------- */
  function ols(X, y, opts) {   // X termasuk kolom intercept bila diinginkan; opts.hasIntercept (bawaan true)
    opts = opts || {}; const hasInt = opts.hasIntercept !== false, n = X.length, p = X[0].length;
    const q = qrFit(X, y), maxd = Math.max.apply(null, q.R.map((r, i) => Math.abs(r[i])));
    if (q.R.some((r, i) => Math.abs(r[i]) < 1e-10 * Math.max(1, maxd))) { const e = new Error('collinear'); e.collinear = true; throw e; }
    const beta = backSub(q.R, q.qty), Ri = invUpper(q.R), XtXinv = Ri.map((r, i) => Ri.map((_, j) => { let s = 0; for (let k = Math.max(i, j); k < p; k++) s += Ri[i][k] * Ri[j][k]; return s; }));
    const dfe = n - p, sse = q.sse, mse = dfe > 0 ? sse / dfe : NaN, ybar = mean(y), sst = hasInt ? sum(y.map((v) => (v - ybar) ** 2)) : sum(y.map((v) => v * v));
    const se = XtXinv.map((r, i) => Math.sqrt(mse * r[i])), t = beta.map((b, i) => b / se[i]), pv = t.map((v) => D.tTwoP(v, dfe));
    const fitted = X.map((r) => sum(r.map((v, j) => v * beta[j]))), resid = y.map((v, i) => v - fitted[i]);
    const dfm = hasInt ? p - 1 : p, ssr = sst - sse, F = dfm > 0 && dfe > 0 ? (ssr / dfm) / mse : NaN;
    const llf = -n / 2 * (Math.log(2 * Math.PI) + Math.log(sse / n) + 1);
    const lev = X.map((r) => { const z = Ri[0].map((_, c) => { let s = 0; for (let k = 0; k <= c; k++) s += r[k] * Ri[k][c]; return s; }); return sum(z.map((v) => v * v)); });
    return { n, p, beta, se, t, p_t: pv, dfe, dfm, sse, mse, s: Math.sqrt(mse), sst, ssr, F, pF: Number.isFinite(F) ? D.fSf(F, dfm, dfe) : NaN,
      r2: ssr / sst, adjr2: 1 - (sse / dfe) / (sst / (hasInt ? n - 1 : n)), fitted, resid, XtXinv, lev, llf, aic: -2 * llf + 2 * p, bic: -2 * llf + p * Math.log(n), hasInt };
  }

  /* ----------------------------- regresi polinomial ----------------------------- */
  function polyDesign(x, deg, center) { return x.map((v) => { const r = []; const u = v - center; for (let d = 1; d <= deg; d++) r.push(Math.pow(u, d)); return r; }); }
  function polyFit(x, y, deg) {   // x dipusatkan pada rata-rata; kembalikan model + koefisien pada skala x asli
    const c = mean(x), X = addIntercept(polyDesign(x, deg, c)), m = ols(X, y);
    // konversi ke koefisien pada x asli: y = Σ b_d (x - c)^d = Σ a_k x^k
    const a = new Array(deg + 1).fill(0), binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
    for (let d = 0; d <= deg; d++) for (let k = 0; k <= d; k++) a[k] += m.beta[d] * binom(d, k) * Math.pow(-c, d - k);
    return Object.assign(m, { deg, center: c, coefOrig: a });
  }
  function polyPredict(m, x0, alpha) {   // CI rata-rata & PI pada x0
    const u = x0 - m.center, row = [1]; for (let d = 1; d <= m.deg; d++) row.push(Math.pow(u, d));
    const fit = sum(row.map((v, j) => v * m.beta[j])); let q = 0; for (let i = 0; i < row.length; i++) for (let j = 0; j < row.length; j++) q += row[i] * m.XtXinv[i][j] * row[j];
    const tc = D.tCrit(m.dfe, 1 - alpha), seM = Math.sqrt(m.mse * q), seP = Math.sqrt(m.mse * (1 + q));
    return { fit, seMean: seM, ci: [fit - tc * seM, fit + tc * seM], pi: [fit - tc * seP, fit + tc * seP] };
  }
  function polyCompare(x, y, maxDeg) {   // model derajat 1..maxDeg + uji F bertahap
    const rows = []; let prev = null;
    for (let d = 1; d <= maxDeg; d++) {
      let m; try { m = polyFit(x, y, d); } catch (e) { break; }
      const r = { deg: d, r2: m.r2, adjr2: m.adjr2, s: m.s, aic: m.aic, bic: m.bic, sse: m.sse, dfe: m.dfe };
      if (prev) { const df1 = 1, F = ((prev.sse - m.sse) / df1) / m.mse; r.Finc = F; r.pInc = D.fSf(F, df1, m.dfe); } else { r.Finc = m.F; r.pInc = m.pF; }
      rows.push(r); prev = m;
    }
    return rows;
  }

  /* --------------------- seleksi variabel & best subsets --------------------- */
  function fitSubset(Xcols, y, idx) { const X = y.map((_, i) => [1].concat(idx.map((j) => Xcols[j][i]))); return ols(X, y); }
  function partialP(Xcols, y, cur, j) {   // p-value uji-t untuk variabel j bila ditambahkan ke model cur
    try { const m = fitSubset(Xcols, y, cur.concat([j])); return m.p_t[m.p_t.length - 1]; } catch (e) { return NaN; }
  }
  function stepwise(Xcols, y, opts) {   // opts: {method:'stepwise'|'forward'|'backward', alphaIn, alphaOut}
    opts = Object.assign({ method: 'stepwise', alphaIn: 0.15, alphaOut: 0.15 }, opts || {});
    const p = Xcols.length, steps = []; let cur = opts.method === 'backward' ? Xcols.map((_, j) => j) : [];
    const snapshot = (action, v, pv) => { const m = cur.length ? fitSubset(Xcols, y, cur) : null; const n = y.length, ybar = mean(y), sst = sum(y.map((t) => (t - ybar) ** 2));
      steps.push({ step: steps.length + 1, action, variable: v, p: pv, vars: cur.slice(), r2: m ? m.r2 : 0, adjr2: m ? m.adjr2 : 0, s: m ? m.s : Math.sqrt(sst / (n - 1)), aic: m ? m.aic : NaN }); };
    if (opts.method === 'backward') snapshot('awal', null, NaN);
    const seen = new Set(); let guard = 0;
    while (guard++ < 4 * p + 10) {
      const key = cur.slice().sort().join(','); if (seen.has(key) && opts.method === 'stepwise' && steps.length > 1) break; seen.add(key);
      let changed = false;
      if (opts.method !== 'backward') {   // coba tambah
        let best = null; for (let j = 0; j < p; j++) if (!cur.includes(j)) { const pv = partialP(Xcols, y, cur, j); if (Number.isFinite(pv) && (best === null || pv < best.p)) best = { j, p: pv }; }
        if (best && best.p < opts.alphaIn) { cur = cur.concat([best.j]); snapshot('masuk', best.j, best.p); changed = true; }
      }
      if (opts.method !== 'forward' && cur.length) {   // coba keluarkan
        const m = fitSubset(Xcols, y, cur); let worst = null; m.p_t.slice(1).forEach((pv, i) => { if (worst === null || pv > worst.p) worst = { j: cur[i], p: pv }; });
        if (worst && worst.p > opts.alphaOut && !(changed && worst.j === cur[cur.length - 1])) { cur = cur.filter((v) => v !== worst.j); snapshot('keluar', worst.j, worst.p); changed = true; }
      }
      if (!changed) break;
    }
    return { steps, final: cur.slice(), opts };
  }
  function bestSubsets(Xcols, y, opts) {   // semua himpunan bagian (p <= 12); simpan 'keep' terbaik per ukuran menurut R2
    opts = Object.assign({ keep: 2 }, opts || {}); const p = Xcols.length, n = y.length, full = fitSubset(Xcols, y, Xcols.map((_, j) => j)), mseFull = full.mse;
    const bySize = []; for (let m = 1; m <= p; m++) bySize.push([]);
    for (let mask = 1; mask < (1 << p); mask++) {
      const idx = []; for (let j = 0; j < p; j++) if (mask & (1 << j)) idx.push(j); let m; try { m = fitSubset(Xcols, y, idx); } catch (e) { continue; }
      const k = idx.length + 1;
      bySize[idx.length - 1].push({ vars: idx, size: idx.length, r2: m.r2, adjr2: m.adjr2, s: m.s, cp: m.sse / mseFull - (n - 2 * k), aic: m.aic, bic: m.bic, sse: m.sse, press: null });
    }
    const out = []; bySize.forEach((arr) => { arr.sort((a, b) => b.r2 - a.r2); arr.slice(0, opts.keep).forEach((r) => out.push(r)); });
    return { rows: out, full, nModels: bySize.reduce((s, a) => s + a.length, 0) };
  }

  /* ------------------------------ regresi logistik biner ------------------------------ */
  function logistic(Xcols, y, opts) {   // Xcols: array kolom prediktor (tanpa intercept)
    opts = Object.assign({ maxIter: 100, tol: 1e-10, cutoff: 0.5, alpha: 0.05 }, opts || {}); const n = y.length, X = y.map((_, i) => [1].concat(Xcols.map((c) => c[i]))), p = X[0].length;
    const n1 = sum(y), n0 = n - n1; let beta = new Array(p).fill(0); beta[0] = Math.log(n1 / n0);
    const mu = (b) => X.map((r) => { const e = sum(r.map((v, j) => v * b[j])); return e >= 0 ? 1 / (1 + Math.exp(-e)) : Math.exp(e) / (1 + Math.exp(e)); });
    const ll = (m) => sum(y.map((v, i) => v === 1 ? Math.log(Math.max(m[i], 1e-300)) : Math.log(Math.max(1 - m[i], 1e-300))));
    let m = mu(beta), L = ll(m), iter = 0, converged = false, XtWXinv = null;
    for (; iter < opts.maxIter; iter++) {
      const w = m.map((v) => Math.max(v * (1 - v), 1e-12)), z = X.map((r, i) => sum(r.map((v, j) => v * beta[j])) + (y[i] - m[i]) / w[i]), sw = w.map(Math.sqrt);
      const Xw = X.map((r, i) => r.map((v) => v * sw[i])), zw = z.map((v, i) => v * sw[i]);
      let q; try { q = qrFit(Xw, zw); } catch (e) { break; }
      if (q.R.some((r, i) => Math.abs(r[i]) < 1e-10 * Math.max(1, Math.abs(q.R[0][0])))) { const e = new Error('collinear'); e.collinear = true; throw e; }
      const nb = backSub(q.R, q.qty), Ri = invUpper(q.R); XtWXinv = Ri.map((r, i) => Ri.map((_, j) => { let s = 0; for (let k = Math.max(i, j); k < p; k++) s += Ri[i][k] * Ri[j][k]; return s; }));
      const nm = mu(nb), nL = ll(nm), dbeta = Math.max.apply(null, nb.map((v, j) => Math.abs(v - beta[j])));
      beta = nb; m = nm; const done = Math.abs(nL - L) < opts.tol * (Math.abs(nL) + 0.1) && dbeta < 1e-8; L = nL; if (done) { converged = true; iter++; break; }
    }
    const se = XtWXinv ? XtWXinv.map((r, i) => Math.sqrt(r[i])) : beta.map(() => NaN), z = beta.map((b, i) => b / se[i]), pz = z.map((v) => D.normTwoP(v)), zc = D.normQuant(1 - opts.alpha / 2);
    const ph = n1 / n, L0 = n1 * Math.log(ph) + n0 * Math.log(1 - ph), LR = 2 * (L - L0), dfm = p - 1;
    const sepr = m.some((v, i) => (y[i] === 1 && v > 1 - 1e-9) || (y[i] === 0 && v < 1e-9)) || beta.some((b) => Math.abs(b) > 25);
    // klasifikasi & AUC
    const pred = m.map((v) => (v >= opts.cutoff ? 1 : 0)); let tp = 0, tn = 0, fp = 0, fn = 0; pred.forEach((pr, i) => { if (y[i] === 1) { pr ? tp++ : fn++; } else { pr ? fp++ : tn++; } });
    const idx = m.map((v, i) => i).sort((a, b) => m[a] - m[b]), ranks = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && m[idx[j + 1]] === m[idx[i]]) j++; const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) ranks[idx[k]] = rk; i = j + 1; }
    const R1 = sum(y.map((v, i) => (v === 1 ? ranks[i] : 0))), auc = (R1 - n1 * (n1 + 1) / 2) / (n1 * n0);
    const cs = 1 - Math.exp(2 * (L0 - L) / n);
    return { n, n1, n0, p, beta, se, z, p_z: pz, or: beta.map(Math.exp), orLo: beta.map((b, i) => Math.exp(b - zc * se[i])), orHi: beta.map((b, i) => Math.exp(b + zc * se[i])), ll: L, ll0: L0, deviance: -2 * L, nullDeviance: -2 * L0,
      LR, dfm, pLR: D.chi2Sf(LR, dfm), mcfadden: 1 - L / L0, coxsnell: cs, nagelkerke: cs / (1 - Math.exp(2 * L0 / n)), aic: -2 * L + 2 * p, bic: -2 * L + p * Math.log(n), fitted: m, iter, converged, separation: sepr,
      cls: { tp, tn, fp, fn, cutoff: opts.cutoff, acc: (tp + tn) / n, sens: tp + fn ? tp / (tp + fn) : NaN, spec: tn + fp ? tn / (tn + fp) : NaN, ppv: tp + fp ? tp / (tp + fp) : NaN, npv: tn + fn ? tn / (tn + fn) : NaN }, auc, XtWXinv };
  }

  window.StatRegX = { addIntercept, qrFit, ols, polyFit, polyPredict, polyCompare, stepwise, bestSubsets, logistic, fitSubset };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatRegX;
})();
