/* =========================================================================
   TAR-CORE - inti hitungan Threshold Autoregressive (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   Tiga keluarga model, semuanya autoregresi dengan perilaku yang berganti menurut variabel ambang s(t):

   1) TAR konvensional (Tong, 1978): rezim ditentukan variabel ambang EKSTERNAL z(t-d) (kolom lain).
        y(t) = phi_j0 + phi_j1 y(t-1) + ... + phi_j,pj y(t-p_j) + e_j(t)   bila  r_(j-1) < z(t-d) <= r_j
   2) SETAR (self-exciting TAR): sama, tetapi variabel ambangnya lag deret itu sendiri, s(t) = y(t-d).
   3) STAR (smooth transition AR): peralihan mulus, bukan loncatan:
        y(t) = w(t)'phi + w(t)'theta * G(s(t); gamma, c) + e(t),   w(t) = (1, y(t-1), ..., y(t-p))
        LSTAR : G = 1 / (1 + exp(-gamma (s - c) / sd_s))
        ESTAR : G = 1 - exp(-gamma (s - c)^2 / sd_s^2)

   Estimasi TAR/SETAR: kuadrat terkecil bersyarat (conditional least squares). Untuk setiap delay d, semua ambang
   kandidat (nilai teramati dengan tiap rezim >= trim x T pengamatan) dicoba, dipilih yang meminimumkan SSE total
   (selang kepercayaan ambang: invers LR Hansen 1997). Delay d dipilih dengan SSE terkecil bila diminta otomatis.
   Estimasi STAR: kuadrat terkecil nonlinier dengan parameter linier "dikonsentrasikan" (variable projection):
   grid (gamma, c) -> penyempurnaan Nelder-Mead -> galat baku dari Jacobian (J'J)^-1 s^2.

   Uji linearitas: Tsay (1989) arranged autoregression (F); sup-F Hansen dengan bootstrap regresor tetap (seed tetap,
   reproducible; menguji AR linier vs TAR dua rezim); Terasvirta (1994) deret uji H04, H03, H02 + aturan LSTAR/ESTAR
   (statistik versi F dari LM Luukkonen-Saikkonen-Terasvirta). Diagnostik: Ljung-Box (sisa & sisa kuadrat), Jarque-Bera.
   Ramalan: skeleton (tanpa galat) + simulasi bootstrap sisa (rata-rata, selang 95%).
   Memakai window.StatDist. Muat SETELAH stat-dist.js.
   ========================================================================= */
(function () {
  'use strict';
  const D = (typeof window !== 'undefined' && window.StatDist) || null;
  const sum = (a) => a.reduce((s, v) => s + v, 0), mean = (a) => sum(a) / a.length;
  const sdev = (a) => { const m = mean(a); return Math.sqrt(sum(a.map((v) => (v - m) * (v - m))) / (a.length - 1)); };
  function rngSeed(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function randn(rnd) { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); }

  /* ------------------------- kuadrat terkecil (QR Householder) ------------------------- */
  function qr(X, y) {
    const n = X.length, p = X[0].length, A = new Array(n);
    for (let i = 0; i < n; i++) { const r = new Array(p + 1); for (let j = 0; j < p; j++) r[j] = X[i][j]; r[p] = y[i]; A[i] = r; }
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
  function invUpper(R) { const p = R.length, I = []; for (let i = 0; i < p; i++) I.push(new Array(p).fill(0)); for (let c = 0; c < p; c++) { const e = new Array(p).fill(0); e[c] = 1; const x = backSub(R, e); for (let r = 0; r < p; r++) I[r][c] = x[r]; } return I; }
  /* lsq: {beta, sse, n, p, singular, XtXinv?}; singular -> sse = Infinity */
  function lsq(X, y, wantCov) {
    const n = X.length, p = X[0].length;
    if (n <= p) return { singular: true, sse: Infinity, n, p };
    const q = qr(X, y); let maxd = 0; for (let i = 0; i < p; i++) maxd = Math.max(maxd, Math.abs(q.R[i][i]));
    for (let i = 0; i < p; i++) if (!(Math.abs(q.R[i][i]) > 1e-10 * Math.max(1, maxd))) return { singular: true, sse: Infinity, n, p };
    const out = { beta: backSub(q.R, q.qty), sse: q.sse, n, p, singular: false };
    if (wantCov) { const Ri = invUpper(q.R); out.XtXinv = Ri.map((r, i) => Ri.map((_, j) => { let s = 0; for (let k = Math.max(i, j); k < p; k++) s += Ri[i][k] * Ri[j][k]; return s; })); }
    return out;
  }
  /* invers umum (Gauss-Jordan, pivot sebagian); null bila singular */
  function invert(A) {
    const n = A.length, M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    let scale = 0; for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(A[i][i]));
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (!(Math.abs(M[piv][c]) > 1e-13 * Math.max(scale, 1e-300))) return null;
      if (piv !== c) { const t = M[piv]; M[piv] = M[c]; M[c] = t; }
      const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f !== 0) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map((r) => r.slice(n));
  }
  const tp = (v, df) => (D && Number.isFinite(v) && df > 0 ? D.tTwoP(v, df) : NaN);
  const fp = (F, d1, d2) => (D && Number.isFinite(F) && d1 > 0 && d2 > 0 ? D.fSf(F, d1, d2) : NaN);

  /* ------------------------------- bahan dasar ------------------------------- */
  /* baris efektif i = 0..T-1 untuk t = m + i: y(t) dan w(t) = [1, y(t-1) ... y(t-pmax)] */
  function buildRows(y, pmax, m) {
    const T = y.length - m, X = new Array(T), yy = new Array(T);
    for (let i = 0; i < T; i++) { const t = m + i, r = new Array(pmax + 1); r[0] = 1; for (let j = 1; j <= pmax; j++) r[j] = y[t - j]; X[i] = r; yy[i] = y[t]; }
    return { X, yy, T };
  }
  const thrVar = (series, m, T, d) => { const s = new Array(T); for (let i = 0; i < T; i++) s[i] = series[m + i - d]; return s; };
  function sortOrder(s) { return s.map((v, i) => i).sort((a, b) => (s[a] - s[b]) || (a - b)); }
  function thin(list, max) { if (list.length <= max) return list; const out = [], L = list.length; for (let i = 0; i < max; i++) out.push(list[Math.round(i * (L - 1) / (max - 1))]); return out.filter((v, i) => i === 0 || v !== out[i - 1]); }
  /* titik potong sah (a = jumlah pengamatan di rezim bawah) di antara nilai ambang berbeda */
  function boundaries(ss, lo, hi) { const out = []; for (let a = lo; a <= hi; a++) if (ss[a - 1] < ss[a]) out.push(a); return out; }
  const aicOf = (sse, T, npar) => T * Math.log(sse / T) + 2 * npar;
  const bicOf = (sse, T, npar) => T * Math.log(sse / T) + Math.log(T) * npar;

  /* ----------------------- pencarian ambang (TAR / SETAR) ----------------------- */
  /* XS[j] = matriks rancangan terurut untuk rezim j (kolom 1 + p_j); ys, ss = y dan s terurut menurut s. */
  function searchThreshold(XS, ys, ss, ks, nreg, trim, maxCand2, maxCand3) {
    const T = ys.length, minN = ks.map((k) => Math.max(Math.ceil(trim * T), k + 2));
    const sseRange = (j, a, b) => lsq(XS[j].slice(a, b), ys.slice(a, b), false).sse;
    if (nreg === 2) {
      const cand = thin(boundaries(ss, minN[0], T - minN[1]), maxCand2);
      if (!cand.length) return null;
      let best = null; const prof = [];
      cand.forEach((a) => { const s1 = sseRange(0, 0, a), s2 = sseRange(1, a, T), tot = s1 + s2; if (Number.isFinite(tot)) { prof.push({ a, r: ss[a - 1], sse: tot }); if (!best || tot < best.sse) best = { cuts: [a], sse: tot }; } });
      if (!best) return null; best.prof = prof; best.nCand = cand.length; best.thinned = cand.length < boundaries(ss, minN[0], T - minN[1]).length; return best;
    }
    const all = boundaries(ss, minN[0], T - minN[2]), cand = thin(all, maxCand3);
    if (cand.length < 2) return null;
    const low = {}, high = {}; cand.forEach((a) => { if (a >= minN[0]) low[a] = sseRange(0, 0, a); if (T - a >= minN[2]) high[a] = sseRange(2, a, T); });
    let best = null;
    cand.forEach((a) => { if (low[a] === undefined || !Number.isFinite(low[a])) return; cand.forEach((b) => {
      if (b <= a || b - a < minN[1] || high[b] === undefined || !Number.isFinite(high[b])) return;
      const tot = low[a] + sseRange(1, a, b) + high[b]; if (Number.isFinite(tot) && (!best || tot < best.sse)) best = { cuts: [a, b], sse: tot };
    }); });
    if (best) { best.nCand = cand.length; best.thinned = cand.length < all.length; }
    return best;
  }

  /* ----------------------------- diagnostik sisa ----------------------------- */
  function acfOf(e, m) { const n = e.length, mu = mean(e); let c0 = 0; for (let i = 0; i < n; i++) c0 += (e[i] - mu) ** 2; const r = []; for (let k = 1; k <= m; k++) { let s = 0; for (let i = k; i < n; i++) s += (e[i] - mu) * (e[i - k] - mu); r.push(c0 > 0 ? s / c0 : 0); } return r; }
  function ljungBox(e, m, nPar) { const n = e.length, r = acfOf(e, m); let Q = 0; r.forEach((v, i) => { Q += v * v / (n - i - 1); }); Q *= n * (n + 2); const df = m - (nPar || 0); return { Q, m, df, p: df > 0 && D ? D.chi2Sf(Q, df) : NaN, r }; }
  function jarqueBera(e) {
    const n = e.length, mu = mean(e); let m2 = 0, m3 = 0, m4 = 0; e.forEach((v) => { const d = v - mu; m2 += d * d; m3 += d ** 3; m4 += d ** 4; }); m2 /= n; m3 /= n; m4 /= n;
    const skew = m3 / Math.pow(m2, 1.5), kurt = m4 / (m2 * m2), JB = n / 6 * (skew * skew + (kurt - 3) * (kurt - 3) / 4);
    return { JB, skew, kurt, p: Math.exp(-JB / 2) };
  }
  function diagnostics(resid, pmax) {
    const T = resid.length, m = Math.max(pmax + 1, Math.min(10, Math.floor(T / 4))), lb = ljungBox(resid, m, pmax), lbSq = ljungBox(resid.map((v) => v * v), m, 0);
    return { lb, lbSq, jb: jarqueBera(resid) };
  }
  function quantile(sortedArr, q) { const n = sortedArr.length, h = (n - 1) * q, lo = Math.floor(h), hi = Math.ceil(h); return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (h - lo); }

  /* -------------------------------- uji Tsay (1989) -------------------------------- */
  /* arranged autoregression: urutkan menurut s, residu prediksi rekursif terstandar, regresikan pada w, uji F semua koefisien */
  function tsayTest(X, yy, s) {
    const T = yy.length, k = X[0].length, ord = sortOrder(s), Xs = ord.map((i) => X[i]), ys = ord.map((i) => yy[i]);
    const m0 = Math.max(k + 5, Math.floor(T / 10) + k); if (T - m0 <= k + 2) return { F: NaN, p: NaN, df1: k, df2: NaN, N: 0 };
    const f0 = lsq(Xs.slice(0, m0), ys.slice(0, m0), true); if (f0.singular) return { F: NaN, p: NaN, df1: k, df2: NaN, N: 0 };
    let beta = f0.beta.slice(), P = f0.XtXinv.map((r) => r.slice()); const eh = [];
    for (let i = m0; i < T; i++) {
      const x = Xs[i], Px = P.map((r) => sum(r.map((v, j) => v * x[j]))), den = 1 + sum(x.map((v, j) => v * Px[j])), e = ys[i] - sum(x.map((v, j) => v * beta[j]));
      eh.push(e / Math.sqrt(den)); beta = beta.map((b, j) => b + Px[j] * e / den); for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) P[a][b] -= Px[a] * Px[b] / den;
    }
    const N = eh.length, f1 = lsq(Xs.slice(m0), eh, false); if (f1.singular) return { F: NaN, p: NaN, df1: k, df2: N - k, N };
    const ss0 = sum(eh.map((v) => v * v)), F = ((ss0 - f1.sse) / k) / (f1.sse / (N - k));
    return { F, p: fp(F, k, N - k), df1: k, df2: N - k, N };
  }

  /* ---------------- uji sup-F Hansen (1997), bootstrap regresor tetap ---------------- */
  function gramOf(rows, k) { const G = Array.from({ length: k }, () => new Array(k).fill(0)); rows.forEach((x) => { for (let a = 0; a < k; a++) for (let b = a; b < k; b++) G[a][b] += x[a] * x[b]; }); for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) G[a][b] = G[b][a]; return G; }
  /* menyiapkan struktur per delay: urutan, titik potong, invers Gram bawah/atas; stat(yvec) = SSE linier dan SSE terkecil */
  function supFPrep(X, sList, trim, maxCand) {
    const T = X.length, k = X[0].length, minN = Math.max(Math.ceil(trim * T), k + 2), Gtot = gramOf(X, k), Gi = invert(Gtot); if (!Gi) return null;
    const preps = sList.map((s) => {
      const ord = sortOrder(s), ss = ord.map((i) => s[i]), Xs = ord.map((i) => X[i]), cand = thin(boundaries(ss, minN, T - minN), maxCand), items = [];
      const cum = Array.from({ length: k }, () => new Array(k).fill(0)); let a0 = 0;
      cand.forEach((a) => {
        for (let i = a0; i < a; i++) for (let u = 0; u < k; u++) for (let v = u; v < k; v++) cum[u][v] += Xs[i][u] * Xs[i][v]; a0 = a;
        const Gl = cum.map((r, u) => r.map((v, w) => (w >= u ? v : cum[w][u]))), Gh = Gtot.map((r, u) => r.map((v, w) => v - Gl[u][w])), il = invert(Gl), ih = invert(Gh);
        if (il && ih) items.push({ a, il, ih });
      });
      return { ord, Xs, items };
    });
    function stat(yv) {
      const yy = yv.reduce((s, v) => s + v * v, 0), xyT = new Array(k).fill(0); X.forEach((x, i) => { for (let u = 0; u < k; u++) xyT[u] += x[u] * yv[i]; });
      let S0 = yy; { const b = Gi.map((r) => sum(r.map((v, u) => v * xyT[u]))); S0 -= sum(b.map((v, u) => v * xyT[u])); }
      let best = Infinity;
      preps.forEach((P) => {
        const ysd = P.ord.map((i) => yv[i]); let a0 = 0, yyL = 0; const xyL = new Array(k).fill(0);
        P.items.forEach((it) => {
          for (let i = a0; i < it.a; i++) { yyL += ysd[i] * ysd[i]; for (let u = 0; u < k; u++) xyL[u] += P.Xs[i][u] * ysd[i]; } a0 = it.a;
          const xyH = xyT.map((v, u) => v - xyL[u]), bl = it.il.map((r) => sum(r.map((v, u) => v * xyL[u]))), bh = it.ih.map((r) => sum(r.map((v, u) => v * xyH[u])));
          const sse = (yyL - sum(bl.map((v, u) => v * xyL[u]))) + ((yy - yyL) - sum(bh.map((v, u) => v * xyH[u]))); if (sse < best) best = sse;
        });
      });
      return { S0, S1: best };
    }
    return { T, k, stat, nCand: preps.map((p) => p.items.length) };
  }
  function supFBootstrap(y, pmax, m, sList, trim, B, seed, maxCand) {
    const mu = mean(y), sd = sdev(y), ysd = y.map((v) => (v - mu) / sd), { X, yy, T } = buildRows(ysd, pmax, m);
    const sStd = sList.map((s) => s.map((v) => (v - mu) / sd)), prep = supFPrep(X, sStd, trim, maxCand); if (!prep) return null;
    const F = (r) => (r.S1 > 0 && Number.isFinite(r.S1) ? T * (r.S0 - r.S1) / r.S1 : NaN), Fobs = F(prep.stat(yy));
    const lin = lsq(X, yy, false); if (lin.singular || !Number.isFinite(Fobs)) return null;
    const eps = yy.map((v, i) => v - sum(X[i].map((u, j) => u * lin.beta[j]))), rnd = rngSeed(seed); let ge = 0, ok = 0; const dist = [];
    for (let b = 0; b < B; b++) { const ystar = eps.map((e) => e * randn(rnd)), f = F(prep.stat(ystar)); if (Number.isFinite(f)) { ok++; dist.push(f); if (f >= Fobs) ge++; } }
    dist.sort((a, b2) => a - b2);
    return { F: Fobs, p: (ge + 1) / (ok + 1), B: ok, crit95: dist.length ? quantile(dist, 0.95) : NaN, nCand: prep.nCand };
  }

  /* ----------------------------------- peramalan ----------------------------------- */
  function summarizeSim(paths, h) {
    const mean_ = [], lo = [], hi = [], med = [];
    for (let s = 0; s < h; s++) { const col = paths.map((p) => p[s]).sort((a, b) => a - b); mean_.push(mean(col)); lo.push(quantile(col, 0.025)); hi.push(quantile(col, 0.975)); med.push(quantile(col, 0.5)); }
    return { mean: mean_, lo, hi, median: med };
  }

  /* =================================== TAR / SETAR =================================== */
  function fitTAR(opts) {
    const o = Object.assign({ type: 'setar', nreg: 2, orders: [2, 2], d: 1, dmax: 4, trim: 0.15, maxCand: 500, maxCand3: 45, h: 0, bootB: 0, seed: 12345, simB: 1000 }, opts || {});
    const y = o.y, n = y.length, self = o.type !== 'tar', z = o.z || null, nreg = o.nreg, notes = [];
    if (nreg !== 2 && nreg !== 3) throw new Error('Jumlah rezim harus 2 atau 3.');
    if (!self && (!z || z.length !== n)) throw new Error('TAR konvensional membutuhkan kolom variabel ambang Z dengan panjang sama dengan Y.');
    const orders = o.orders.slice(0, nreg); while (orders.length < nreg) orders.push(orders[orders.length - 1]);
    if (orders.some((p) => !Number.isInteger(p) || p < 1 || p > 12)) throw new Error('Orde AR tiap rezim harus bilangan bulat 1 sampai 12.');
    const pmax = Math.max.apply(null, orders), ks = orders.map((p) => p + 1), dList = o.d > 0 ? [o.d] : Array.from({ length: o.dmax }, (_, i) => i + 1), m = Math.max(pmax, Math.max.apply(null, dList)), T = n - m;
    const series = self ? y : z, minRegime = ks.map((k) => Math.max(Math.ceil(o.trim * T), k + 2));
    if (T < sum(minRegime) + 2) throw new Error(`Data terlalu pendek: ${T} pengamatan efektif tidak cukup untuk ${nreg} rezim dengan trimming ${Math.round(o.trim * 100)}% dan orde ${orders.join(', ')}. Tambah data, kurangi rezim/orde, atau perkecil trimming.`);
    const { X, yy } = buildRows(y, pmax, m), npar = sum(ks) + (nreg - 1);
    const per = dList.map((d) => {
      const s = thrVar(series, m, T, d), ord = sortOrder(s), ss = ord.map((i) => s[i]), ys = ord.map((i) => yy[i]), XS = orders.map((p) => ord.map((i) => X[i].slice(0, p + 1)));
      const r = searchThreshold(XS, ys, ss, ks, nreg, o.trim, o.maxCand, o.maxCand3);
      return { d, s, ord, ss, r };
    });
    const dTable = per.map((q) => q.r ? { d: q.d, sse: q.r.sse, aic: aicOf(q.r.sse, T, npar), thr: q.r.cuts.map((a) => q.ss[a - 1]) } : { d: q.d, sse: NaN, aic: NaN, thr: [] });
    let bi = -1; per.forEach((q, i) => { if (q.r && (bi < 0 || q.r.sse < per[bi].r.sse)) bi = i; });
    if (bi < 0) throw new Error('Tidak ada ambang yang memenuhi syarat ukuran rezim minimum (banyak nilai kembar pada variabel ambang?). Perkecil trimming atau jumlah rezim.');
    const best = per[bi], d = best.d, s = best.s, cuts = best.r.cuts, thr = cuts.map((a) => best.ss[a - 1]);
    if (best.r.thinned) notes.push(`Kandidat ambang dikurangi merata menjadi ${best.r.nCand} titik untuk kecepatan.`);
    /* keanggotaan rezim (ukuran asli) */
    const reg = s.map((v) => { let j = 0; while (j < thr.length && v > thr[j]) j++; return j; });
    const regimes = [], fitted = new Array(T), resid = new Array(T);
    for (let j = 0; j < nreg; j++) {
      const idx = []; reg.forEach((r, i) => { if (r === j) idx.push(i); });
      const Xj = idx.map((i) => X[i].slice(0, ks[j])), yj = idx.map((i) => yy[i]), f = lsq(Xj, yj, true);
      if (f.singular) throw new Error(`Rezim ${j + 1} tidak dapat diestimasi (regresor kolinear). Kurangi orde AR atau ubah ambang.`);
      const dfe = idx.length - ks[j], s2 = f.sse / dfe, se = f.XtXinv.map((r, i) => Math.sqrt(s2 * r[i])), t = f.beta.map((b, i) => b / se[i]);
      idx.forEach((i, q) => { const fv = sum(Xj[q].map((v, u) => v * f.beta[u])); fitted[i] = fv; resid[i] = yy[i] - fv; });
      regimes.push({ p: orders[j], k: ks[j], n: idx.length, idx, coef: f.beta, se, t, pval: t.map((v) => tp(v, dfe)), dfe, sse: f.sse, s2, sumPhi: sum(f.beta.slice(1)), share: idx.length / T,
        lower: j === 0 ? -Infinity : thr[j - 1], upper: j === nreg - 1 ? Infinity : thr[j] });
    }
    const sse = sum(resid.map((v) => v * v)), ybar = mean(yy), sst = sum(yy.map((v) => (v - ybar) ** 2)), lin = lsq(X, yy, true);
    const res = { kind: o.type, n, T, m, d, nreg, orders, pmax, thr, regimes, sse, sigma2: sse / T, aic: aicOf(sse, T, npar), bic: bicOf(sse, T, npar), r2: 1 - sse / sst, npar, trim: o.trim,
      y, yEff: yy, s, reg, fitted, resid, dTable, autoD: o.d <= 0, notes };
    if (!lin.singular) { res.lin = { sse: lin.sse, aic: aicOf(lin.sse, T, pmax + 1), bic: bicOf(lin.sse, T, pmax + 1), k: pmax + 1, beta: lin.beta }; res.sseGain = 1 - sse / lin.sse; }
    /* profil SSE terhadap ambang & selang kepercayaan Hansen (dua rezim) */
    if (nreg === 2 && best.r.prof) {
      const S = best.r.sse, c95 = 7.352, prof = best.r.prof.map((q) => ({ r: q.r, sse: q.sse, lr: T * (q.sse - S) / S })), inCI = prof.filter((q) => q.lr <= c95);
      res.profile = { x: prof.map((q) => q.r), sse: prof.map((q) => q.sse), lr: prof.map((q) => q.lr) };
      res.ci = { lo: Math.min.apply(null, inCI.map((q) => q.r)), hi: Math.max.apply(null, inCI.map((q) => q.r)), level: 0.95, crit: c95 };
      res.critSse = S + c95 * S / T;
    }
    /* uji linearitas */
    res.tsay = tsayTest(X, yy, s);
    if (o.bootB > 0) {
      const sList = dList.map((dd) => thrVar(series, m, T, dd)), full = supFBootstrap(y, pmax, m, sList, o.trim, o.bootB, o.seed, Math.min(o.maxCand, 300));
      if (full) res.boot = Object.assign(full, { overD: dList.length > 1 });
    }
    res.diag = diagnostics(resid, pmax);
    res.rootWarn = regimes.map((r, j) => ({ j, sumPhi: r.sumPhi })).filter((q) => (q.j === 0 || q.j === nreg - 1) && Math.abs(q.sumPhi) >= 1).map((q) => q.j + 1);
    if (res.rootWarn.length) notes.push(`Jumlah koefisien AR pada rezim luar ${res.rootWarn.join(' & ')} ≥ 1 dalam nilai mutlak: deret dapat tidak stasioner di rezim itu; ramalan jangka panjang perlu hati-hati.`);
    if (o.h > 0) res.forecast = forecastTAR(res, o, series);
    return res;
  }
  function forecastTAR(res, o, series) {
    const { y, d, thr, regimes, nreg, n } = res, self = o.type !== 'tar', zArr = o.z, notes = [];
    let h = o.h; if (!self && h > d) { h = d; notes.push(`TAR konvensional memakai Z(t − ${d}); nilai Z masa depan tidak diketahui, sehingga ramalan hanya tersedia sampai ${d} langkah ke depan.`); }
    const getS = (hist, t) => (self ? hist[t - d] : zArr[t - d]);
    const rule = (sv) => { let j = 0; while (j < thr.length && sv > thr[j]) j++; return j; };
    const step = (hist, t, e) => { const j = rule(getS(hist, t)), rg = regimes[j]; let mu = rg.coef[0]; for (let i = 1; i < rg.k; i++) mu += rg.coef[i] * hist[t - i]; return { mu, j, val: mu + (e === null ? 0 : e(j)) }; };
    const skel = [], regs = [], hist = y.slice();
    for (let s = 0; s < h; s++) { const r = step(hist, n + s, null); skel.push(r.mu); regs.push(r.j + 1); hist.push(r.mu); }
    const pools = regimes.map((rg) => rg.idx.map((i) => res.resid[i])), rnd = rngSeed(o.seed + 7), paths = [];
    for (let b = 0; b < o.simB; b++) { const hh = y.slice(), pth = []; for (let s = 0; s < h; s++) { const r = step(hh, n + s, (j) => pools[j][Math.floor(rnd() * pools[j].length)]); pth.push(r.val); hh.push(r.val); } paths.push(pth); }
    return Object.assign({ h, skeleton: skel, regime: regs, notes, B: o.simB }, summarizeSim(paths, h));
  }

  /* =================================== STAR (LSTAR / ESTAR) =================================== */
  const Gfun = (form, u, gamma, c) => (form === 'lstar' ? 1 / (1 + Math.exp(-gamma * (u - c))) : 1 - Math.exp(-gamma * (u - c) * (u - c)));
  /* uji Terasvirta (1994): deret H04 / H03 / H02 dengan hampiran Taylor orde 3 */
  function terasvirta(W, yy, s) {
    const T = yy.length, k = W[0].length, p = k - 1, mu = mean(s), sd = sdev(s), u = s.map((v) => (v - mu) / (sd || 1));
    const cols = (pw) => W.map((w, i) => { const r = w.slice(); for (let q = 1; q <= pw; q++) for (let j = 1; j <= p; j++) r.push(w[j] * Math.pow(u[i], q)); return r; });
    const sse = [0, 1, 2, 3].map((q) => lsq(cols(q), yy, false).sse), df = (extra) => T - k - extra * p;
    const F = (a, b, qb) => ((sse[a] - sse[b]) / p) / (sse[b] / df(qb));
    const Fg = ((sse[0] - sse[3]) / (3 * p)) / (sse[3] / df(3)), F4 = F(2, 3, 3), F3 = F(1, 2, 2), F2 = F(0, 1, 1);
    const pv = (f, d1, d2) => (Number.isFinite(f) && d2 > 0 ? fp(f, d1, d2) : NaN);
    const out = { general: { F: Fg, p: pv(Fg, 3 * p, df(3)), df1: 3 * p, df2: df(3) }, h04: { F: F4, p: pv(F4, p, df(3)), df1: p, df2: df(3) }, h03: { F: F3, p: pv(F3, p, df(2)), df1: p, df2: df(2) }, h02: { F: F2, p: pv(F2, p, df(1)), df1: p, df2: df(1) } };
    const ps = [out.h02.p, out.h03.p, out.h04.p];
    out.choice = ps.every(Number.isFinite) ? (out.h03.p < out.h02.p && out.h03.p < out.h04.p ? 'estar' : 'lstar') : null;
    return out;
  }
  function nelderMead(f, x0, step, maxIter) {
    const n = x0.length, pts = [x0.slice()]; for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += step[i]; pts.push(p); }
    let vals = pts.map(f);
    for (let it = 0; it < maxIter; it++) {
      const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]); const P = idx.map((i) => pts[i]), V = idx.map((i) => vals[i]);
      for (let i = 0; i <= n; i++) { pts[i] = P[i]; vals[i] = V[i]; }
      if (Math.abs(vals[n] - vals[0]) < 1e-13 * (Math.abs(vals[0]) + 1e-12) && it > 5) break;
      const cen = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += pts[i][j] / n;
      const at = (t) => cen.map((c, j) => c + t * (pts[n][j] - c)), xr = at(-1), fr = f(xr);
      if (fr < vals[0]) { const xe = at(-2), fe = f(xe); if (fe < fr) { pts[n] = xe; vals[n] = fe; } else { pts[n] = xr; vals[n] = fr; } }
      else if (fr < vals[n - 1]) { pts[n] = xr; vals[n] = fr; }
      else { const xc = fr < vals[n] ? at(-0.5) : at(0.5), fc = f(xc); if (fc < Math.min(fr, vals[n])) { pts[n] = xc; vals[n] = fc; } else { for (let i = 1; i <= n; i++) { pts[i] = pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j])); vals[i] = f(pts[i]); } } }
    }
    let bi = 0; vals.forEach((v, i) => { if (v < vals[bi]) bi = i; }); return { x: pts[bi], f: vals[bi] };
  }
  function starFit(W, yy, s, form) {
    const T = yy.length, k = W[0].length, sBar = mean(s), sSd = sdev(s) || 1, u = s.map((v) => (v - sBar) / sSd), us = u.slice().sort((a, b) => a - b);
    const qlo = quantile(us, 0.05), qhi = quantile(us, 0.95), lgLo = Math.log(1e-3), lgHi = Math.log(1000);
    const design = (g, c) => W.map((w, i) => { const G = Gfun(form, u[i], g, c), r = w.slice(); for (let j = 0; j < k; j++) r.push(w[j] * G); return r; });
    const conc = (g, c) => { const r = lsq(design(g, c), yy, false); return r.singular ? Infinity : r.sse; };
    const gGrid = [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256], cGrid = []; for (let q = 0.1; q <= 0.9001; q += 0.04) cGrid.push(quantile(us, q));
    const grid = []; gGrid.forEach((g) => cGrid.forEach((c) => { const v = conc(g, c); if (Number.isFinite(v)) grid.push({ g, c, v }); }));
    if (!grid.length) return null; grid.sort((a, b) => a.v - b.v);
    const starts = []; grid.forEach((q) => { if (starts.length < 3 && !starts.some((w) => Math.abs(Math.log(w.g / q.g)) < 0.9 && Math.abs(w.c - q.c) < 0.4)) starts.push(q); });
    const obj = (x) => { const lg = x[0], c = x[1]; if (lg < lgLo || lg > lgHi || c < qlo || c > qhi) return Infinity; return conc(Math.exp(lg), c); };
    let best = null; starts.forEach((q) => { const r = nelderMead(obj, [Math.log(q.g), q.c], [0.7, 0.25 * (qhi - qlo) / 2], 400); if (Number.isFinite(r.f) && (!best || r.f < best.f)) best = r; });
    if (!best) return null;
    const gamma = Math.exp(best.x[0]), c = best.x[1], Z = design(gamma, c), f = lsq(Z, yy, true); if (f.singular) return null;
    const phi = f.beta.slice(0, k), theta = f.beta.slice(k), Gv = u.map((v) => Gfun(form, v, gamma, c)), fitted = Z.map((r) => sum(r.map((v, j) => v * f.beta[j]))), resid = yy.map((v, i) => v - fitted[i]);
    const sse = sum(resid.map((v) => v * v)), npar = 2 * k + 2, dfe = T - npar;
    /* Jacobian analitik terhadap (phi, theta, gamma, c~) dan kovarians NLS */
    const J = W.map((w, i) => {
      const G = Gv[i], r = []; for (let j = 0; j < k; j++) r.push(w[j]); for (let j = 0; j < k; j++) r.push(w[j] * G);
      const wt = sum(w.map((v, j) => v * theta[j])), du = u[i] - c; let dG, dC;
      if (form === 'lstar') { dG = G * (1 - G) * du; dC = -gamma * G * (1 - G); } else { dG = du * du * (1 - G); dC = -2 * gamma * du * (1 - G); }
      r.push(wt * dG); r.push(wt * dC); return r;
    });
    const JtJ = Array.from({ length: npar }, (_, a) => Array.from({ length: npar }, (_, b) => { let s2 = 0; for (let i = 0; i < T; i++) s2 += J[i][a] * J[i][b]; return s2; })), inv = dfe > 0 ? invert(JtJ) : null;
    const s2 = dfe > 0 ? sse / dfe : NaN, cov = inv ? inv.map((r) => r.map((v) => v * s2)) : null, se = cov ? cov.map((r, i) => Math.sqrt(Math.max(r[i], 0))) : new Array(npar).fill(NaN);
    const high = phi.map((v, j) => v + theta[j]), seHigh = cov ? high.map((_, j) => Math.sqrt(Math.max(cov[j][j] + cov[k + j][k + j] + 2 * cov[j][k + j], 0))) : high.map(() => NaN);
    const idxS = u.map((v, i) => i).sort((a, b) => u[a] - u[b]);
    return { form, gamma, c: sBar + sSd * c, cStd: c, sBar, sSd, k, phi, theta, high, sePhi: se.slice(0, k), seTheta: se.slice(k, 2 * k), seHigh, seGamma: se[2 * k], seC: se[2 * k + 1] * sSd,
      tPhi: phi.map((v, j) => v / se[j]), tTheta: theta.map((v, j) => v / se[k + j]), pPhi: phi.map((v, j) => tp(v / se[j], dfe)), pTheta: theta.map((v, j) => tp(v / se[k + j], dfe)), pHigh: high.map((v, j) => tp(v / seHigh[j], dfe)),
      sse, s2, dfe, npar, G: Gv, sOrder: idxS, fitted, resid, aic: aicOf(sse, T, npar), bic: bicOf(sse, T, npar), covOk: !!cov, gridBest: grid[0].v, nGrid: grid.length };
  }
  function fitSTAR(opts) {
    const o = Object.assign({ p: 2, d: 1, dmax: 4, form: 'auto', h: 0, seed: 12345, simB: 1000 }, opts || {});
    const y = o.y, n = y.length, p = o.p, notes = [];
    if (!Number.isInteger(p) || p < 1 || p > 12) throw new Error('Orde AR harus bilangan bulat 1 sampai 12.');
    const dList = o.d > 0 ? [o.d] : Array.from({ length: o.dmax }, (_, i) => i + 1), m = Math.max(p, Math.max.apply(null, dList)), T = n - m, k = p + 1;
    if (T < 4 * k + 10) throw new Error(`Data terlalu pendek untuk STAR dengan orde ${p}: ${T} pengamatan efektif (butuh minimal ${4 * k + 10}).`);
    const { X: W, yy } = buildRows(y, p, m);
    const lin = lsq(W, yy, false); if (lin.singular) throw new Error('Regresor AR linier kolinear; periksa data (mis. deret konstan).');
    const tests = dList.map((d) => Object.assign({ d }, terasvirta(W, yy, thrVar(y, m, T, d))));
    let ci = 0; tests.forEach((t, i) => { if (Number.isFinite(t.general.p) && (!Number.isFinite(tests[ci].general.p) || t.general.p < tests[ci].general.p)) ci = i; });
    const d = tests[ci].d, s = thrVar(y, m, T, d), tt = tests[ci];
    const forms = o.form === 'auto' ? ['lstar', 'estar'] : [o.form], fits = {};
    forms.forEach((f) => { fits[f] = starFit(W, yy, s, f); });
    if (!forms.some((f) => fits[f])) throw new Error('Estimasi STAR gagal (tidak ada titik awal yang valid). Coba orde/delay lain atau gunakan SETAR.');
    let sel = o.form === 'auto' ? (tt.choice || 'lstar') : o.form; if (!fits[sel]) sel = forms.find((f) => fits[f]);
    if (o.form === 'auto') notes.push(tt.choice ? `Bentuk ${sel.toUpperCase()} dipilih dengan aturan Teräsvirta (H03 paling kuat ditolak → ESTAR, selain itu LSTAR).` : 'Aturan Teräsvirta tidak dapat dihitung; LSTAR dipakai sebagai bawaan.');
    const fit = fits[sel], sst = sum(yy.map((v) => (v - mean(yy)) ** 2));
    if (fit.gamma > 100) notes.push('γ sangat besar: peralihan hampir berupa loncatan (mendekati SETAR); galat baku γ tidak andal, pertimbangkan SETAR.');
    if (!fit.covOk) notes.push('Matriks informasi singular: galat baku tidak dapat dihitung (parameter kurang teridentifikasi).');
    const res = { kind: 'star', n, T, m, d, p, k, form: sel, y, yEff: yy, s, fit, fits, tests, testD: tt, autoD: o.d <= 0, sse: fit.sse, sigma2: fit.sse / T, aic: fit.aic, bic: fit.bic, r2: 1 - fit.sse / sst,
      lin: { sse: lin.sse, aic: aicOf(lin.sse, T, k), bic: bicOf(lin.sse, T, k), k, beta: lin.beta }, notes, fitted: fit.fitted, resid: fit.resid, G: fit.G };
    res.sseGain = 1 - fit.sse / lin.sse; res.diag = diagnostics(fit.resid, p);
    res.shareHigh = fit.G.filter((g) => g > 0.5).length / T;
    if (o.h > 0) res.forecast = forecastSTAR(res, o);
    return res;
  }
  function forecastSTAR(res, o) {
    const { y, d, fit, p, n } = res, h = o.h, sB = fit.sBar, sS = fit.sSd, step = (hist, t, e) => {
      const u = (hist[t - d] - sB) / sS, G = Gfun(fit.form, u, fit.gamma, fit.cStd); let mu = 0; for (let j = 0; j <= p; j++) { const w = j === 0 ? 1 : hist[t - j]; mu += w * (fit.phi[j] + fit.theta[j] * G); } return { mu, G, val: mu + (e ? e() : 0) };
    };
    const skel = [], Gs = [], hist = y.slice(); for (let s = 0; s < h; s++) { const r = step(hist, n + s, null); skel.push(r.mu); Gs.push(r.G); hist.push(r.mu); }
    const rnd = rngSeed(o.seed + 7), pool = res.resid, paths = [];
    for (let b = 0; b < o.simB; b++) { const hh = y.slice(), pth = []; for (let s = 0; s < h; s++) { const r = step(hh, n + s, () => pool[Math.floor(rnd() * pool.length)]); pth.push(r.val); hh.push(r.val); } paths.push(pth); }
    return Object.assign({ h, skeleton: skel, G: Gs, notes: [], B: o.simB }, summarizeSim(paths, h));
  }

  /* ---------- uji linearitas Terasvirta untuk saran awal (tanpa estimasi) ---------- */
  function starLinearity(y, p, dmax) {
    const dl = Array.from({ length: dmax }, (_, i) => i + 1), m = Math.max(p, dmax), { X, yy, T } = buildRows(y, p, m);
    return dl.map((d) => Object.assign({ d }, terasvirta(X, yy, thrVar(y, m, T, d))));
  }

  const api = { fitTAR, fitSTAR, starLinearity, tsayTest, terasvirta, supFBootstrap, lsq, ljungBox, jarqueBera, Gfun, rngSeed };
  if (typeof window !== 'undefined') window.StatTAR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
