/* =========================================================================
   RSM CORE - inti perhitungan Response Surface Methodology (tanpa DOM)
   -------------------------------------------------------------------------
   Mandiri (tidak butuh regresi.js) dan bisa dijalankan di Node untuk pengujian:
     const C = require('./rsm-core.js');
     const res = C.analyze({ X, y, names, model: 'quad' });

   Model orde kedua (kuadratik penuh) dalam variabel terkode x_i in [-1, +1]:
     y = b0 + SUM b_i x_i + SUM b_ii x_i^2 + SUM_{i<j} b_ij x_i x_j + e
   Pengodean: x_i = (X_i - c_i) / h_i, c_i = (maks+min)/2, h_i = (maks-min)/2.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StatCalcRSMCore = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* ----------------------------- Distribusi ----------------------------- */
  const LG = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  function logGamma(x) {
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += LG[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(x, a, b) {
    const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function betai(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
    return 1 - bt * betacf(1 - x, b, a) / b;
  }
  const tTwoP = (t, df) => (!Number.isFinite(t) || !(df > 0) ? NaN : betai(df / (df + t * t), df / 2, 0.5));
  const fUpperP = (F, d1, d2) => (!Number.isFinite(F) || F < 0 || !(d1 > 0) || !(d2 > 0) ? NaN : betai(d2 / (d2 + d1 * F), d2 / 2, d1 / 2));
  /* kuantil t satu-sisi: P(T <= t) = p, 0.5 < p < 1 */
  function tQuantile(p, df) {
    let lo = 0, hi = 1000;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const cdf = 1 - 0.5 * tTwoP(mid, df);
      if (cdf < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ------------------------------- Matriks ------------------------------- */
  const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  function matMul(A, B) {
    const r = A.length, c = B[0].length, m = B.length;
    const R = Array.from({ length: r }, () => new Array(c).fill(0));
    for (let i = 0; i < r; i++) for (let k = 0; k < m; k++) { const a = A[i][k]; if (a === 0) continue; for (let j = 0; j < c; j++) R[i][j] += a * B[k][j]; }
    return R;
  }
  function matVec(A, v) { return A.map((r) => r.reduce((s, a, j) => s + a * v[j], 0)); }
  function invert(M) {
    const n = M.length;
    const scale = Math.max(1e-300, ...M.map((r, i) => Math.abs(r[i])));
    const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let col = 0; col < n; col++) {
      let p = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[p][col])) p = r;
      if (Math.abs(A[p][col]) < 1e-10 * scale) throw new Error('SINGULAR');
      if (p !== col) [A[col], A[p]] = [A[p], A[col]];
      const piv = A[col][col];
      for (let c = 0; c < 2 * n; c++) A[col][c] /= piv;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = A[r][col];
        if (f === 0) continue;
        for (let c = 0; c < 2 * n; c++) A[r][c] -= f * A[col][c];
      }
    }
    return A.map((row) => row.slice(n));
  }
  /* Nilai & vektor eigen matriks simetris (metode Jacobi). vectors[:,k] = vektor eigen ke-k, urut menurun */
  function eigenSym(M) {
    const n = M.length;
    const A = M.map((r) => r.slice());
    const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-24) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = A.map((_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
    return { values: idx.map((i) => A[i][i]), vectors: V.map((row) => idx.map((i) => row[i])) };
  }

  /* -------------------------------- Model -------------------------------- */
  const MODELS = {
    linear: 'Linear (orde pertama)',
    '2fi': 'Linear + interaksi 2 faktor',
    quad: 'Kuadratik penuh (orde kedua)',
  };
  /* Suku model: [{type:'const'}, {type:'lin', i}, {type:'sq', i}, {type:'int', i, j}] */
  function buildTerms(k, model) {
    const T = [{ type: 'const' }];
    for (let i = 0; i < k; i++) T.push({ type: 'lin', i });
    if (model === 'quad') for (let i = 0; i < k; i++) T.push({ type: 'sq', i });
    if (model === '2fi' || model === 'quad') for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) T.push({ type: 'int', i, j });
    return T;
  }
  function termValue(t, x) {
    switch (t.type) {
      case 'const': return 1;
      case 'lin': return x[t.i];
      case 'sq': return x[t.i] * x[t.i];
      default: return x[t.i] * x[t.j];
    }
  }
  function termLabel(t, names, sym) {
    const n = (i) => (sym ? sym[i] : names[i]);
    switch (t.type) {
      case 'const': return 'Konstanta';
      case 'lin': return n(t.i);
      case 'sq': return n(t.i) + '\u00B2';
      default: return n(t.i) + '\u00D7' + n(t.j);
    }
  }
  const minTerms = (k, model) => buildTerms(k, model).length;

  /* ------------------------------ Pengodean ------------------------------ */
  function coding(X) {
    const k = X[0].length, center = [], half = [];
    for (let j = 0; j < k; j++) {
      const col = X.map((r) => r[j]);
      const mn = Math.min(...col), mx = Math.max(...col);
      center.push((mx + mn) / 2); half.push((mx - mn) / 2);
    }
    return { center, half, min: X[0].map((_, j) => Math.min(...X.map((r) => r[j]))), max: X[0].map((_, j) => Math.max(...X.map((r) => r[j]))) };
  }
  const encode = (cd, X) => X.map((r) => r.map((v, j) => (v - cd.center[j]) / cd.half[j]));
  const toCoded = (cd, v) => v.map((a, j) => (a - cd.center[j]) / cd.half[j]);
  const toActual = (cd, x) => x.map((a, j) => cd.center[j] + cd.half[j] * a);

  /* OLS dasar: kembalikan {beta, inv, yhat, e, h, SSE} */
  function ols(D, y) {
    const Dt = transpose(D);
    const inv = invert(matMul(Dt, D));
    const Dty = matVec(Dt, y);
    const beta = matVec(inv, Dty);
    const yhat = matVec(D, beta);
    const e = y.map((v, i) => v - yhat[i]);
    const h = D.map((row) => { const w = matVec(inv, row); return row.reduce((s, a, j) => s + a * w[j], 0); });
    return { beta, inv, yhat, e, h, SSE: e.reduce((s, v) => s + v * v, 0) };
  }
  const designMatrix = (terms, Xc) => Xc.map((x) => terms.map((t) => termValue(t, x)));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

  /* VIF dari matriks korelasi kolom non-konstanta (model terkode) */
  function vifs(D, terms) {
    const idx = terms.map((t, j) => (t.type === 'const' ? -1 : j)).filter((j) => j >= 0);
    const out = terms.map(() => NaN);
    if (idx.length === 1) { out[idx[0]] = 1; return out; }
    const n = D.length;
    const cols = idx.map((j) => D.map((r) => r[j]));
    const mu = cols.map(mean);
    const sd = cols.map((c, a) => Math.sqrt(c.reduce((s, v) => s + (v - mu[a]) ** 2, 0)));
    if (sd.some((s) => s < 1e-12)) return out;
    const R = cols.map((ca, a) => cols.map((cb, b) => ca.reduce((s, v, r) => s + (v - mu[a]) * (cb[r] - mu[b]), 0) / (sd[a] * sd[b])));
    try { const Ri = invert(R); idx.forEach((j, a) => { out[j] = Ri[a][a]; }); } catch (e) { /* biarkan NaN */ }
    return out;
  }

  /* Pengelompokan titik rancangan identik -> galat murni (pure error) */
  function pureError(Xc, y) {
    const map = new Map();
    Xc.forEach((x, i) => { const key = x.map((v) => v.toFixed(7)).join('|'); if (!map.has(key)) map.set(key, []); map.get(key).push(i); });
    let ss = 0, df = 0;
    const groups = [];
    map.forEach((ids) => {
      const m = mean(ids.map((i) => y[i]));
      ids.forEach((i) => { ss += (y[i] - m) ** 2; });
      df += ids.length - 1;
      groups.push(ids);
    });
    return { SS: ss, df, distinct: map.size, groups };
  }

  /* ------------------------------ Fit satu model ------------------------------ */
  function fitModel(Xc, y, k, model) {
    const terms = buildTerms(k, model);
    const n = y.length, p = terms.length;
    if (n - p < 1) { const e = new Error('DATA_KURANG'); e.need = p + 1; e.p = p; throw e; }
    const D = designMatrix(terms, Xc);
    let fit;
    try { fit = ols(D, y); } catch (e) { if (e.message === 'SINGULAR') { const er = new Error('SINGULAR'); throw er; } throw e; }
    const ybar = mean(y);
    const SST = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
    const SSE = fit.SSE, SSR = SST - SSE;
    const dfE = n - p, dfR = p - 1, dfT = n - 1;
    const MSE = SSE / dfE, MSR = SSR / dfR;
    const F = MSR / MSE, pF = fUpperP(F, dfR, dfE);
    const R2 = SST > 0 ? SSR / SST : NaN;
    const adj = SST > 0 ? 1 - (SSE / dfE) / (SST / dfT) : NaN;
    let PRESS = 0, pressOK = true;
    fit.e.forEach((e, i) => { const d = 1 - fit.h[i]; if (d < 1e-8) pressOK = false; else PRESS += (e / d) ** 2; });
    const predR2 = pressOK && SST > 0 ? 1 - PRESS / SST : NaN;
    const S = Math.sqrt(MSE);
    return { model, terms, p, n, D, beta: fit.beta, inv: fit.inv, yhat: fit.yhat, e: fit.e, h: fit.h,
      SST, SSR, SSE, dfT, dfR, dfE, MSR, MSE, F, pF, R2, adj, PRESS: pressOK ? PRESS : NaN, predR2, S, ybar };
  }

  /* ------------------------------ Analisis lengkap ------------------------------ */
  /* o: {X: n x k (satuan asli), y, names, resp, model, alpha} */
  function analyze(o) {
    const X = o.X, y = o.y, k = X[0].length, n = y.length;
    const names = o.names && o.names.length === k ? o.names : X[0].map((_, i) => 'X' + (i + 1));
    const model = o.model || 'quad';
    const alpha = o.alpha || 0.05;
    const cd = coding(X);
    if (cd.half.some((h) => !(h > 0))) { const e = new Error('KONSTAN'); e.idx = cd.half.findIndex((h) => !(h > 0)); throw e; }
    const Xc = encode(cd, X);
    const m = fitModel(Xc, y, k, model);
    const { terms, p, dfE, MSE } = m;
    const tcrit = tQuantile(1 - alpha / 2, dfE);
    const sym = names.map((_, i) => String.fromCharCode(65 + i)); // A, B, C, D
    const vif = vifs(m.D, terms);

    // ---- Koefisien (terkode) ----
    const coefs = terms.map((t, j) => {
      const se = Math.sqrt(MSE * m.inv[j][j]);
      const tv = m.beta[j] / se;
      return { term: t, label: termLabel(t, names), sym: termLabel(t, names, sym), b: m.beta[j], se, t: tv, p: tTwoP(tv, dfE),
        lo: m.beta[j] - tcrit * se, hi: m.beta[j] + tcrit * se, vif: vif[j] };
    });

    // ---- Koefisien satuan asli ----
    const b0 = m.beta[0], bl = Array(k).fill(0), bs = Array(k).fill(0), bi = Array.from({ length: k }, () => Array(k).fill(0));
    terms.forEach((t, j) => { if (t.type === 'lin') bl[t.i] = m.beta[j]; else if (t.type === 'sq') bs[t.i] = m.beta[j]; else if (t.type === 'int') bi[t.i][t.j] = m.beta[j]; });
    const c = cd.center, hh = cd.half;
    const a = { a0: b0, al: Array(k).fill(0), as: Array(k).fill(0), ai: Array.from({ length: k }, () => Array(k).fill(0)) };
    let a0 = b0;
    for (let i = 0; i < k; i++) {
      a.as[i] = bs[i] / (hh[i] * hh[i]);
      let li = bl[i] / hh[i] - 2 * bs[i] * c[i] / (hh[i] * hh[i]);
      for (let j = 0; j < k; j++) {
        if (j === i) continue;
        const v = i < j ? bi[i][j] : bi[j][i];
        li -= v * c[j] / (hh[i] * hh[j]);
      }
      a.al[i] = li;
      a0 += -bl[i] * c[i] / hh[i] + bs[i] * c[i] * c[i] / (hh[i] * hh[i]);
      for (let j = i + 1; j < k; j++) { a.ai[i][j] = bi[i][j] / (hh[i] * hh[j]); a0 += bi[i][j] * c[i] * c[j] / (hh[i] * hh[j]); }
    }
    a.a0 = a0;
    const actual = terms.map((t) => {
      let v;
      if (t.type === 'const') v = a.a0; else if (t.type === 'lin') v = a.al[t.i]; else if (t.type === 'sq') v = a.as[t.i]; else v = a.ai[t.i][t.j];
      return { term: t, label: termLabel(t, names), sym: termLabel(t, names, sym), b: v };
    });

    // ---- Kelompok suku (JK terkoreksi): linear / kuadrat / interaksi ----
    const groups = [];
    [['lin', 'Linear'], ['sq', 'Kuadrat'], ['int', 'Interaksi 2 faktor']].forEach(([ty, lab]) => {
      const keep = terms.map((t) => t.type !== ty);
      const cnt = keep.filter((v) => !v).length;
      if (!cnt) return;
      const T2 = terms.filter((_, j) => keep[j]);
      const D2 = m.D.map((r) => r.filter((_, j) => keep[j]));
      let SSE2;
      try { SSE2 = ols(D2, y).SSE; } catch (e) { SSE2 = NaN; }
      const SS = SSE2 - m.SSE, ms = SS / cnt, F = ms / MSE;
      groups.push({ type: ty, label: lab, df: cnt, SS, MS: ms, F, p: fUpperP(F, cnt, dfE) });
      void T2;
    });

    // ---- Lack of fit ----
    const pe = pureError(Xc, y);
    const lof = { distinct: pe.distinct, dfPE: pe.df, SSPE: pe.SS, MSPE: pe.df > 0 ? pe.SS / pe.df : NaN, dfLOF: pe.distinct - p, testable: false };
    lof.SSLOF = m.SSE - pe.SS;
    if (lof.dfLOF > 0 && pe.df > 0 && pe.SS > 1e-12) {
      lof.MSLOF = lof.SSLOF / lof.dfLOF; lof.F = lof.MSLOF / lof.MSPE; lof.p = fUpperP(lof.F, lof.dfLOF, pe.df); lof.testable = true;
    }

    // ---- Presisi ----
    const yhatMax = Math.max(...m.yhat), yhatMin = Math.min(...m.yhat);
    const adeq = (yhatMax - yhatMin) / Math.sqrt(p * MSE / n);
    const cv = m.ybar !== 0 ? m.S / Math.abs(m.ybar) * 100 : NaN;

    // ---- Diagnostik per-run ----
    const diag = y.map((yv, i) => {
      const e = m.e[i], hi = m.h[i], d = 1 - hi;
      const sr = d > 1e-10 ? e / Math.sqrt(MSE * d) : NaN;
      return { run: i + 1, y: yv, fit: m.yhat[i], e, h: hi, sr, cook: Number.isFinite(sr) ? sr * sr * hi / (p * d) : NaN };
    });

    const res = { n, k, names, sym, resp: o.resp || 'Y', model, modelName: MODELS[model], alpha, X, y, Xc, cd, m, terms, p, dfE, MSE, tcrit,
      coefs, actual, a, groups, lof, pe, adeq, cv, diag, yhatMax, yhatMin };
    res.compare = compare(Xc, y, k, alpha);
    if (model === 'quad') res.canon = canonical(res);
    return res;
  }

  /* ----------------------- Perbandingan model (sekuensial) ----------------------- */
  function compare(Xc, y, k, alpha) {
    const n = y.length, ybar = mean(y);
    const SST = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
    const list = [{ key: 'mean', name: 'Rata-rata saja', p: 1, SSE: SST, ok: true }];
    ['linear', '2fi', 'quad'].forEach((key) => {
      try {
        const f = fitModel(Xc, y, k, key);
        const pe = pureError(Xc, y);
        const dfL = pe.distinct - f.p;
        let lofP = NaN;
        if (dfL > 0 && pe.df > 0 && pe.SS > 1e-12) lofP = fUpperP(((f.SSE - pe.SS) / dfL) / (pe.SS / pe.df), dfL, pe.df);
        list.push({ key, name: MODELS[key], p: f.p, SSE: f.SSE, dfE: f.dfE, S: f.S, R2: f.R2, adj: f.adj, predR2: f.predR2, pF: f.pF, lofP, ok: true });
      } catch (e) { list.push({ key, name: MODELS[key], p: minTerms(k, key), ok: false, why: e.message === 'DATA_KURANG' ? 'data kurang' : 'tidak dapat diestimasi' }); }
    });
    for (let i = 1; i < list.length; i++) {
      const cur = list[i];
      if (!cur.ok) continue;
      let prev = null;
      for (let j = i - 1; j >= 0; j--) if (list[j].ok) { prev = list[j]; break; }
      if (!prev) continue;
      const dfN = cur.p - prev.p, SSseq = prev.SSE - cur.SSE;
      cur.seq = { df: dfN, SS: SSseq, F: (SSseq / dfN) / (cur.SSE / cur.dfE) };
      cur.seq.p = fUpperP(cur.seq.F, dfN, cur.dfE);
    }
    void alpha;
    return list;
  }

  /* ------------------------------ Prediksi ------------------------------ */
  function rowOf(res, x) { return res.terms.map((t) => termValue(t, x)); }
  function yhat(res, x) { const r = rowOf(res, x); let s = 0; for (let j = 0; j < r.length; j++) s += r[j] * res.m.beta[j]; return s; }
  /* x terkode -> {y, se, ci, pi} */
  function predict(res, x) {
    const r = rowOf(res, x);
    const w = matVec(res.m.inv, r);
    const q = r.reduce((s, a, j) => s + a * w[j], 0);
    const yh = yhat(res, x);
    const seMean = Math.sqrt(res.MSE * q), sePred = Math.sqrt(res.MSE * (1 + q));
    return { y: yh, seMean, sePred, ci: [yh - res.tcrit * seMean, yh + res.tcrit * seMean], pi: [yh - res.tcrit * sePred, yh + res.tcrit * sePred] };
  }

  /* ------------------------------ Analisis kanonik ------------------------------ */
  function canonical(res) {
    const k = res.k, a = res.a, cd = res.cd, m = res.m;
    const bl = [], B = Array.from({ length: k }, () => Array(k).fill(0));
    res.terms.forEach((t, j) => { if (t.type === 'lin') bl[t.i] = m.beta[j]; else if (t.type === 'sq') B[t.i][t.i] = m.beta[j]; else if (t.type === 'int') { B[t.i][t.j] = m.beta[j] / 2; B[t.j][t.i] = m.beta[j] / 2; } });
    void a;
    const eig = eigenSym(B);
    const scale = Math.max(...eig.values.map(Math.abs), 1e-12);
    const tol = 1e-7 * scale;
    let nature;
    const neg = eig.values.filter((v) => v < -tol).length, pos = eig.values.filter((v) => v > tol).length, zero = k - neg - pos;
    if (zero > 0) nature = 'ridge';
    else if (neg === k) nature = 'max';
    else if (pos === k) nature = 'min';
    else nature = 'saddle';
    const out = { B, bl, eig, nature };
    if (nature !== 'ridge') {
      try {
        const Bi = invert(B);
        const xs = matVec(Bi, bl).map((v) => -0.5 * v);
        const ys = yhat(res, xs);
        out.xs = xs; out.actual = toActual(cd, xs); out.ys = ys;
        out.inside = xs.every((v) => Math.abs(v) <= 1 + 1e-9);
        out.pred = predict(res, xs);
        out.dist = Math.sqrt(xs.reduce((s, v) => s + v * v, 0));
      } catch (e) { out.nature = 'ridge'; }
    }
    return out;
  }

  /* ------------------------------ Optimasi ------------------------------ */
  /* opt: {goal:'max'|'min'|'target', target, lo:[...], hi:[...]} (batas terkode; bawaan -1..+1) */
  function optimize(res, opt) {
    const k = res.k, goal = opt.goal || 'max';
    const lo = opt.lo || Array(k).fill(-1), hi = opt.hi || Array(k).fill(1);
    const obj = (x) => { const v = yhat(res, x); return goal === 'max' ? -v : goal === 'min' ? v : (v - opt.target) ** 2; };
    const per = k <= 2 ? 61 : k === 3 ? 25 : 11;
    const pts = [];
    const x = Array(k).fill(0);
    (function rec(d) {
      if (d === k) { pts.push({ x: x.slice(), f: obj(x) }); return; }
      for (let s = 0; s < per; s++) { x[d] = lo[d] + (hi[d] - lo[d]) * s / (per - 1); rec(d + 1); }
    })(0);
    pts.sort((a, b) => a.f - b.f);
    let best = null;
    pts.slice(0, 6).forEach((st) => {
      let cur = st.x.slice(), fc = st.f;
      let step = cur.map((_, d) => (hi[d] - lo[d]) / (per - 1));
      for (let it = 0; it < 400; it++) {
        let improved = false;
        for (let d = 0; d < k; d++) for (const sg of [1, -1]) {
          const nx = cur.slice(); nx[d] = Math.min(hi[d], Math.max(lo[d], nx[d] + sg * step[d]));
          const fn = obj(nx);
          if (fn < fc - 1e-15) { cur = nx; fc = fn; improved = true; }
        }
        if (!improved) { step = step.map((s) => s / 2); if (Math.max(...step) < 1e-7) break; }
      }
      if (!best || fc < best.f) best = { x: cur, f: fc };
    });
    const pr = predict(res, best.x);
    return { x: best.x, actual: toActual(res.cd, best.x), pred: pr, goal, target: opt.target };
  }

  /* Grid permukaan respons untuk sumbu i (horizontal) & j (vertikal); hold = nilai terkode faktor lain */
  function surfaceGrid(res, i, j, hold, N) {
    N = N || 40;
    const z = [];
    for (let b = 0; b < N; b++) {
      const row = [];
      for (let a = 0; a < N; a++) {
        const x = hold.slice(); x[i] = -1 + 2 * a / (N - 1); x[j] = -1 + 2 * b / (N - 1);
        row.push(yhat(res, x));
      }
      z.push(row);
    }
    return z;
  }

  return { MODELS, buildTerms, termLabel, minTerms, analyze, fitModel, predict, yhat, optimize, surfaceGrid, canonical,
    coding, toCoded, toActual, tQuantile, tTwoP, fUpperP, invert, matMul, eigenSym };
});
