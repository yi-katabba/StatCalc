/* =========================================================================
   ANOVA-CORE - inti hitungan ANOVA lanjutan (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   - Uji lanjut: Tukey HSD (Tukey-Kramer), Bonferroni, Dunnett (vs kontrol), BNT/LSD
   - RAL (satu arah) & RAK (acak kelompok lengkap)
   - ANOVA pengukuran berulang satu faktor + uji sphericity Mauchly, koreksi Greenhouse-Geisser / Huynh-Feldt
   - Huruf notasi (compact letter display) untuk pengelompokan rata-rata
   Distribusi rentang terstudentisasi (Tukey) dan t-multivariat (Dunnett) dihitung dengan integrasi Gauss-Legendre.
   Memakai window.StatDist. Muat SETELAH stat-dist.js.
   ========================================================================= */
(function () {
  'use strict';
  const D = window.StatDist;
  const sum = (a) => a.reduce((s, v) => s + v, 0), mean = (a) => sum(a) / a.length;

  /* ---------------------- kuadratur Gauss-Legendre komposit ---------------------- */
  function glNodes(n) {
    const x = [], w = [];
    for (let i = 0; i < n; i++) {
      let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 0;
      for (let it = 0; it < 100; it++) {
        let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1); const dz = p1 / pp; z -= dz; if (Math.abs(dz) < 1e-15) break;
      }
      x.push(z); w.push(2 / ((1 - z * z) * pp * pp));
    }
    return { x, w };
  }
  const GL = glNodes(16);
  function panels(a, b, np) {   // simpul & bobot pada [a, b] dibagi np panel
    const xs = [], ws = [], h = (b - a) / np;
    for (let p = 0; p < np; p++) { const lo = a + p * h, mid = lo + h / 2; for (let i = 0; i < GL.x.length; i++) { xs.push(mid + GL.x[i] * h / 2); ws.push(GL.w[i] * h / 2); } }
    return { x: xs, w: ws };
  }
  const phi = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const cacheZ = {};
  function zGrid(lo, hi, np) { const key = lo + ',' + hi + ',' + np; if (!cacheZ[key]) { const g = panels(lo, hi, np); g.phi = g.x.map(phi); g.Phi = g.x.map((z) => D.normCdf(z)); cacheZ[key] = g; } return cacheZ[key]; }
  function chiQuant(p, nu) { let lo = 0, hi = Math.max(10, nu * 10); while (D.chi2Cdf(hi, nu) < p) hi *= 2; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (D.chi2Cdf(m, nu) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  function sGrid(nu, np) {   // S = sqrt(chi2_nu / nu): simpul s, bobot (sudah dikali kerapatan)
    const smax = Math.sqrt(chiQuant(1 - 1e-14, nu) / nu), g = panels(0, smax, np), c = Math.log(2) + (nu / 2) * Math.log(nu / 2) - D.lgamma(nu / 2);
    return { s: g.x, w: g.w.map((wi, i) => wi * Math.exp(c + (nu - 1) * Math.log(g.x[i]) - nu * g.x[i] * g.x[i] / 2)) };
  }
  const sCache = {};
  const sg = (nu) => (sCache[nu] || (sCache[nu] = sGrid(nu, 10)));

  /* ----------------------------- Tukey (rentang terstudentisasi) ----------------------------- */
  function ptukey(q, k, nu) {   // P(Q <= q) untuk k rata-rata, derajat bebas galat nu
    if (!(q > 0)) return 0;
    const zg = zGrid(-9, 9, 6), S = sg(nu); let tot = 0;
    for (let a = 0; a < S.s.length; a++) {
      const w = q * S.s[a]; let inner = 0;
      for (let i = 0; i < zg.x.length; i++) { const d = zg.Phi[i] - D.normCdf(zg.x[i] - w); if (d > 0) inner += zg.w[i] * zg.phi[i] * Math.pow(d, k - 1); }
      tot += S.w[a] * k * inner;
    }
    return Math.min(1, Math.max(0, tot));
  }
  function qtukey(p, k, nu) {
    let lo = 0, hi = 4; while (ptukey(hi, k, nu) < p && hi < 1e4) hi *= 2;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ptukey(m, k, nu) < p) lo = m; else hi = m; if (hi - lo < 1e-9 * hi) break; }
    return (lo + hi) / 2;
  }

  /* --------------------------------- ANOVA satu arah / RAL --------------------------------- */
  function oneWay(groups) {
    const k = groups.length, ns = groups.map((g) => g.length), N = sum(ns), means = groups.map(mean), grand = sum(groups.map((g) => sum(g))) / N;
    const ssb = sum(groups.map((g, i) => ns[i] * (means[i] - grand) * (means[i] - grand))), ssw = sum(groups.map((g, i) => sum(g.map((v) => (v - means[i]) * (v - means[i])))));
    const dfb = k - 1, dfw = N - k, msb = ssb / dfb, msw = ssw / dfw, F = msb / msw;
    return { k, ns, N, means, grand, ssb, ssw, sst: ssb + ssw, dfb, dfw, dft: N - 1, msb, msw, F, p: D.fSf(F, dfb, dfw), cv: Math.sqrt(msw) / grand * 100, r2: ssb / (ssb + ssw) };
  }

  /* ----------------------------------- uji lanjut ----------------------------------- */
  function pairs(k) { const o = []; for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) o.push([i, j]); return o; }
  function postHoc(groups, method, alpha, opts) {
    opts = opts || {}; const A = oneWay(groups), k = A.k, nu = A.dfw, mse = A.msw, out = [];
    if (method === 'dunnett') return dunnett(groups, opts.control || 0, alpha, A);
    const prs = pairs(k), m = prs.length;
    const qcrit = method === 'tukey' ? qtukey(1 - alpha, k, nu) : null, tcrit = method === 'bonferroni' ? D.tCrit(nu, 1 - alpha / m) : D.tCrit(nu, 1 - alpha);
    for (const [i, j] of prs) {
      const diff = A.means[i] - A.means[j], v = mse * (1 / A.ns[i] + 1 / A.ns[j]), se = Math.sqrt(v), t = diff / se; let p, hw;
      if (method === 'tukey') { const sq = Math.sqrt(v / 2); p = 1 - ptukey(Math.abs(diff) / sq, k, nu); hw = qcrit * sq; }
      else if (method === 'bonferroni') { p = Math.min(1, m * D.tTwoP(t, nu)); hw = tcrit * se; }
      else { p = D.tTwoP(t, nu); hw = tcrit * se; }   // LSD / BNT
      out.push({ i, j, diff, se, stat: method === 'tukey' ? Math.abs(diff) / Math.sqrt(v / 2) : t, p: Math.max(0, p), lo: diff - hw, hi: diff + hw, hw, sig: p < alpha });
    }
    return { A, method, alpha, nu, mse, rows: out, crit: method === 'tukey' ? qcrit : tcrit, m };
  }

  /* ---------- Dunnett: t-multivariat ekikorelasi lewat representasi satu-faktor (rank-1) ---------- */
  function dunnettCdf(t, lam, nu) {   // P(max_i |T_i| <= t), korelasi T_i,T_j = lam_i lam_j
    const zg = zGrid(-8, 8, 4), S = sg(nu); let tot = 0;
    for (let a = 0; a < S.s.length; a++) {
      const ts = t * S.s[a]; let inner = 0;
      for (let i = 0; i < zg.x.length; i++) {
        let prod = 1;
        for (let l = 0; l < lam.length && prod > 0; l++) { const r = Math.sqrt(1 - lam[l] * lam[l]); prod *= D.normCdf((ts - lam[l] * zg.x[i]) / r) - D.normCdf((-ts - lam[l] * zg.x[i]) / r); }
        inner += zg.w[i] * zg.phi[i] * prod;
      }
      tot += S.w[a] * inner;
    }
    return Math.min(1, Math.max(0, tot));
  }
  function dunnett(groups, ctrl, alpha, A) {
    A = A || oneWay(groups); const k = A.k, nu = A.dfw, mse = A.msw, others = []; for (let i = 0; i < k; i++) if (i !== ctrl) others.push(i);
    const lam = others.map((i) => Math.sqrt(A.ns[i] / (A.ns[i] + A.ns[ctrl])));
    let lo = D.tCrit(nu, 1 - alpha) * 0.999, hi = D.tCrit(nu, 1 - alpha / others.length) * 1.001;
    for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (dunnettCdf(mid, lam, nu) < 1 - alpha) lo = mid; else hi = mid; if (hi - lo < 1e-7) break; }
    const dcrit = (lo + hi) / 2, rows = others.map((i) => {
      const diff = A.means[i] - A.means[ctrl], se = Math.sqrt(mse * (1 / A.ns[i] + 1 / A.ns[ctrl])), t = diff / se, p = Math.max(0, 1 - dunnettCdf(Math.abs(t), lam, nu));
      return { i, j: ctrl, diff, se, stat: t, p, lo: diff - dcrit * se, hi: diff + dcrit * se, hw: dcrit * se, sig: p < alpha };
    });
    return { A, method: 'dunnett', alpha, nu, mse, rows, crit: dcrit, m: others.length, control: ctrl };
  }

  /* ------------------------- huruf notasi (compact letter display) ------------------------- */
  function letters(means, sigFn) {   // means: rata-rata tiap perlakuan; sigFn(i,j) true bila berbeda nyata; kembali array huruf per perlakuan
    const k = means.length, ord = means.map((m, i) => i).sort((a, b) => means[b] - means[a]), sets = [];
    for (let s = 0; s < k; s++) {
      let e = s; while (e + 1 < k && ord.slice(s, e + 2).every((a, x, arr) => arr.every((b) => a === b || !sigFn(a, b)))) e++;
      sets.push([s, e]);
    }
    const keep = sets.filter((a, i) => !sets.some((b, j) => j !== i && b[0] <= a[0] && b[1] >= a[1] && (b[0] < a[0] || b[1] > a[1] || j < i)));
    const res = new Array(k).fill('');
    keep.forEach((iv, li) => { const ch = String.fromCharCode(97 + li); for (let x = iv[0]; x <= iv[1]; x++) res[ord[x]] += ch; });
    return res.map((r) => r.split('').sort().join(''));
  }

  /* ------------------------------------ RAK (acak kelompok) ------------------------------------ */
  function rcbd(M) {   // M: b blok x t perlakuan (lengkap)
    const b = M.length, t = M[0].length, N = b * t, grand = sum(M.map(sum)) / N;
    const trtM = M[0].map((_, j) => mean(M.map((r) => r[j]))), blkM = M.map(mean);
    const sst = sum(M.map((r) => sum(r.map((v) => (v - grand) * (v - grand))))), sstr = b * sum(trtM.map((m) => (m - grand) * (m - grand))), ssb = t * sum(blkM.map((m) => (m - grand) * (m - grand))), sse = Math.max(0, sst - sstr - ssb);
    const dft = t - 1, dfb = b - 1, dfe = (t - 1) * (b - 1), mst = sstr / dft, msb = ssb / dfb, mse = sse / dfe, Ft = mst / mse, Fb = msb / mse;
    return { b, t, N, grand, trtM, blkM, sst, sstr, ssb, sse, dft, dfb, dfe, dftot: N - 1, mst, msb, mse, Ft, pt: D.fSf(Ft, dft, dfe), Fb, pb: D.fSf(Fb, dfb, dfe), cv: Math.sqrt(mse) / grand * 100, r2: (sstr + ssb) / sst, re: ((b - 1) * msb + b * (t - 1) * mse) / ((b * t - 1) * mse) };
  }
  /* uji lanjut atas hasil RAK / RAL memakai KT galat sendiri: groups-like input dengan mse & dfe & n per perlakuan */
  function postHocMse(means, ns, mse, nu, method, alpha) {
    const k = means.length, prs = pairs(k), m = prs.length, qc = method === 'tukey' ? qtukey(1 - alpha, k, nu) : null, tc = method === 'bonferroni' ? D.tCrit(nu, 1 - alpha / m) : D.tCrit(nu, 1 - alpha);
    const rows = prs.map(([i, j]) => {
      const diff = means[i] - means[j], v = mse * (1 / ns[i] + 1 / ns[j]), se = Math.sqrt(v), t = diff / se; let p, hw;
      if (method === 'tukey') { p = 1 - ptukey(Math.abs(diff) / Math.sqrt(v / 2), k, nu); hw = qc * Math.sqrt(v / 2); }
      else if (method === 'bonferroni') { p = Math.min(1, m * D.tTwoP(t, nu)); hw = tc * se; } else { p = D.tTwoP(t, nu); hw = tc * se; }
      return { i, j, diff, se, p: Math.max(0, p), hw, sig: p < alpha };
    });
    return { rows, crit: method === 'tukey' ? qc : tc, m };
  }

  /* --------------------------------- eigen simetris (Jacobi) --------------------------------- */
  function eigSym(Ain) {
    const n = Ain.length, A = Ain.map((r) => r.slice());
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j]; if (off < 1e-26) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let r = 0; r < n; r++) { const a = A[r][p], b = A[r][q]; A[r][p] = c * a - s * b; A[r][q] = s * a + c * b; }
        for (let r = 0; r < n; r++) { const a = A[p][r], b = A[q][r]; A[p][r] = c * a - s * b; A[q][r] = s * a + c * b; }
      }
    }
    return A.map((r, i) => r[i]).sort((a, b) => b - a);
  }

  /* ----------------------------- ANOVA pengukuran berulang (1 faktor) ----------------------------- */
  function repeated(M) {   // M: n subjek x k kondisi (lengkap)
    const n = M.length, k = M[0].length, N = n * k, grand = sum(M.map(sum)) / N, cm = M[0].map((_, j) => mean(M.map((r) => r[j]))), sm = M.map(mean);
    const sst = sum(M.map((r) => sum(r.map((v) => (v - grand) ** 2)))), ssc = n * sum(cm.map((m) => (m - grand) ** 2)), sss = k * sum(sm.map((m) => (m - grand) ** 2)), sse = Math.max(0, sst - ssc - sss);
    const dfc = k - 1, dfs = n - 1, dfe = dfc * dfs, msc = ssc / dfc, mse = sse / dfe, F = msc / mse, p = D.fSf(F, dfc, dfe);
    /* sphericity: matriks kovarians antarkondisi, dipusatkan ganda */
    const S = []; for (let a = 0; a < k; a++) { S.push([]); for (let b = 0; b < k; b++) { let s = 0; for (let i = 0; i < n; i++) s += (M[i][a] - cm[a]) * (M[i][b] - cm[b]); S[a].push(s / (n - 1)); } }
    const rm = S.map(mean), gm = mean(rm), Sd = S.map((r, a) => r.map((v, b) => v - rm[a] - rm[b] + gm));
    let eps = 1, epsHF = 1, W = NaN, pW = NaN, dfW = 0, p_gg = p, p_hf = p;
    if (k > 2) {
      const ev = eigSym(Sd).slice(0, k - 1), sl = sum(ev), sl2 = sum(ev.map((v) => v * v));
      eps = (sl * sl) / ((k - 1) * sl2);
      epsHF = Math.min(1, (n * (k - 1) * eps - 2) / ((k - 1) * (n - 1 - (k - 1) * eps)));
      const prod = ev.reduce((a, v) => a * v, 1); W = prod / Math.pow(sl / (k - 1), k - 1); dfW = k * (k - 1) / 2 - 1;
      if (n - 1 > 0 && W > 0) {   // chi-square Mauchly dengan koreksi orde kedua Anderson (sama dengan mauchly.test di R)
        const d = k - 1, df = n - 1, f = 1 - (2 * d * d + d + 2) / (6 * d * df), chi = -df * f * Math.log(W);
        const w2 = (d + 2) * (d - 1) * (d - 2) * (2 * d * d * d + 6 * d * d + 3 * k + 2) / (288 * Math.pow(df * d * f, 2));
        const p1 = D.chi2Sf(chi, dfW), p2 = D.chi2Sf(chi, dfW + 4); pW = p1 + w2 * (p2 - p1);
      }
      p_gg = D.fSf(F, dfc * eps, dfe * eps); p_hf = D.fSf(F, dfc * epsHF, dfe * epsHF);
    }
    return { n, k, N, grand, cm, sm, sst, ssc, sss, sse, dfc, dfs, dfe, msc, mse, F, p, W, pW, dfW, epsGG: eps, epsHF, pGG: p_gg, pHF: p_hf, petasq: ssc / (ssc + sse), getasq: ssc / (ssc + sss + sse) };
  }

  window.StatAnovaX = { ptukey, qtukey, oneWay, postHoc, dunnett, dunnettCdf, letters, rcbd, postHocMse, eigSym, repeated, pairs };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatAnovaX;
})();
