/* =========================================================================
   METODE - ARIMA & SARIMA (Box-Jenkins)
   -------------------------------------------------------------------------
   Satu halaman dengan dua pilihan model:
     - ARIMA(p, d, q)               : data TANPA pola musiman.
     - SARIMA(p, d, q)(P, D, Q)[s]  : data DENGAN pola musiman berpanjang s.

   Model (B = operator mundur, B Y(t) = Y(t-1)):
     phi(B) Phi(B^s) (1-B)^d (1-B^s)^D [Y(t) - mu] = theta(B) Theta(B^s) e(t)
     phi(B)   = 1 - phi1 B - ... - phip B^p        Phi(B^s)   = 1 - Phi1 B^s - ... - PhiP B^(sP)
     theta(B) = 1 + theta1 B + ... + thetaq B^q    Theta(B^s) = 1 + Theta1 B^s + ... + ThetaQ B^(sQ)
   (ARIMA = SARIMA dengan P = D = Q = 0.)

   Estimasi : tiga metode (dipilih di Langkah 2), semuanya pada deret diferensiasi w(t):
              - OLS   : Conditional Sum of Squares (CSS); meminimumkan jumlah kuadrat galat e(t) dengan e(t) = 0
                        sebelum data pertama yang bisa dihitung (AR murni = regresi OLS), Levenberg-Marquardt
                        dengan syarat stasioner (AR) dan invertibel (MA). SE dari sigma^2 (J'J)^-1.
              - MLE   : likelihood Gaussian eksak lewat filter Kalman (bentuk ruang-keadaan ARMA, keadaan awal
                        stasioner). Titik awal dari OLS; SE dari Hessian numerik. Cocok dengan statsmodels.
              - Momen : Yule-Walker (AR murni, solusi langsung) atau pencocokan ACF teoretis dengan ACF sampel
                        pada lag 1..(p+q) dan kelipatan s (model campuran/musiman).
   Ramalan  : rekursif dari model, lalu "diintegralkan" kembali ke skala data asli.
              Selang 95% memakai bobot psi: Var(h) = sigma^2 * sum(psi_j^2, j < h).
   Diagnosis: Ljung-Box (autokorelasi residu), Jarque-Bera (normalitas residu), ACF residu.

   Bagian inti (tanpa DOM) bisa diuji di Node: require('./arima.js') mengembalikan objek core.
   ========================================================================= */
(function () {
  'use strict';

  /* ==================================================================
     INTI NUMERIK (tidak memakai DOM)
     ================================================================== */
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : NaN);

  /* ---- distribusi ---- */
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const normCdf = (x) => 0.5 * erfc(-x / Math.SQRT2);
  function logGamma(x) {
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    x -= 1;
    let a = c[0]; const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  /* Q(a, x) = gamma tak lengkap atas teregularisasi */
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) {
      let ap = a, del = 1 / a, s = del;
      for (let n = 0; n < 500; n++) { ap += 1; del *= x / ap; s += del; if (Math.abs(del) < Math.abs(s) * 1e-14) break; }
      return 1 - s * Math.exp(-x + a * Math.log(x) - logGamma(a));
    }
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  }
  const chiSqUpperP = (x, df) => (Number.isFinite(x) && x >= 0 && df > 0 ? gammaQ(df / 2, x / 2) : NaN);

  /* ---- polinomial: larik koefisien [c0, c1, ...] untuk c0 + c1 B + ... ---- */
  function polyMul(a, b) {
    const r = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] += a[i] * b[j];
    return r;
  }
  /* 1 - sum c_i B^(i*step) (AR) atau 1 + sum c_i B^(i*step) (MA, sign = +1) */
  function seasPoly(coefs, step, sign) {
    const r = new Array(coefs.length * step + 1).fill(0);
    r[0] = 1;
    coefs.forEach((c, i) => { r[(i + 1) * step] = sign * c; });
    return r;
  }
  /* Apakah 1 - sum c_i z^i tidak punya akar di dalam / pada lingkaran satuan? (rekursi Schur-Cohn / Levinson turun) */
  function arStable(c) {
    let a = c.slice();
    for (let m = a.length; m >= 1; m--) {
      const k = a[m - 1];
      if (!(Math.abs(k) < 1)) return false;
      if (m === 1) break;
      const nxt = [], den = 1 - k * k;
      for (let j = 1; j < m; j++) nxt.push((a[j - 1] + k * a[m - 1 - j]) / den);
      a = nxt;
    }
    return true;
  }
  /* "Jarak" ke batas: |koefisien pantulan| terbesar (mendekati 1 = hampir tidak stasioner/invertibel) */
  function maxReflection(c) {
    let a = c.slice(), mx = 0;
    for (let m = a.length; m >= 1; m--) {
      const k = a[m - 1];
      mx = Math.max(mx, Math.abs(k));
      if (!(Math.abs(k) < 1) || m === 1) break;
      const nxt = [], den = 1 - k * k;
      for (let j = 1; j < m; j++) nxt.push((a[j - 1] + k * a[m - 1 - j]) / den);
      a = nxt;
    }
    return mx;
  }

  /* ---- diferensiasi: (1-B)^d (1-B^s)^D ---- */
  function diffPoly(d, D, s) {
    let poly = [1];
    for (let i = 0; i < d; i++) poly = polyMul(poly, [1, -1]);
    for (let i = 0; i < D; i++) { const sp = new Array(s + 1).fill(0); sp[0] = 1; sp[s] = -1; poly = polyMul(poly, sp); }
    return poly;
  }
  function applyDiff(Y, poly) {
    const L = poly.length - 1, w = [];
    for (let t = L; t < Y.length; t++) { let v = 0; for (let k = 0; k <= L; k++) v += poly[k] * Y[t - k]; w.push(v); }
    return w;
  }

  /* ---- spesifikasi model ---- */
  /* cfg: {p,d,q,P,D,Q,s,seasonal,constant:boolean}. Kembalikan orde yang sudah dinormalkan. */
  const METHOD_KEYS = ['ols', 'mle', 'moment'];
  const METHOD_NAME = { ols: 'OLS (kuadrat terkecil / CSS)', mle: 'MLE (likelihood Gaussian eksak)', moment: 'Metode Momen (Yule-Walker / pencocokan ACF)' };
  function normCfg(cfg) {
    const seasonal = !!cfg.seasonal;
    const o = { p: cfg.p | 0, d: cfg.d | 0, q: cfg.q | 0, P: seasonal ? cfg.P | 0 : 0, D: seasonal ? cfg.D | 0 : 0, Q: seasonal ? cfg.Q | 0 : 0, s: seasonal ? cfg.s | 0 : 1, seasonal, constant: !!cfg.constant, method: METHOD_KEYS.indexOf(cfg.method) >= 0 ? cfg.method : 'ols' };
    return o;
  }
  function paramNames(o) {
    const n = [];
    for (let i = 1; i <= o.p; i++) n.push('φ' + i);
    for (let i = 1; i <= o.q; i++) n.push('θ' + i);
    for (let i = 1; i <= o.P; i++) n.push('Φ' + i);
    for (let i = 1; i <= o.Q; i++) n.push('Θ' + i);
    if (o.constant) n.push(o.d + o.D === 0 ? 'μ (konstanta)' : 'drift (c)');
    return n;
  }
  function splitParams(o, x) {
    let k = 0;
    const take = (m) => { const r = x.slice(k, k + m); k += m; return r; };
    const phi = take(o.p), theta = take(o.q), Phi = take(o.P), Theta = take(o.Q);
    const c = o.constant ? x[k] : 0;
    return { phi, theta, Phi, Theta, c };
  }
  function polysOf(o, x) {
    const sp = splitParams(o, x);
    const A = polyMul(seasPoly(sp.phi, 1, -1), seasPoly(sp.Phi, o.s, -1));
    const M = polyMul(seasPoly(sp.theta, 1, +1), seasPoly(sp.Theta, o.s, +1));
    return { sp, A, M, pf: A.length - 1, qf: M.length - 1 };
  }
  function feasible(o, x) {
    const sp = splitParams(o, x);
    if (!arStable(sp.phi) || !arStable(sp.Phi)) return false;
    if (!arStable(sp.theta.map((v) => -v)) || !arStable(sp.Theta.map((v) => -v))) return false;
    return true;
  }

  /* ---- galat CSS: A(B)(w - c) = M(B) e ---- */
  function cssResiduals(w, A, M, c, pf, qf) {
    const n = w.length, e = new Array(n).fill(0);
    for (let t = pf; t < n; t++) {
      let v = 0;
      for (let i = 0; i <= pf; i++) v += A[i] * (w[t - i] - c);
      for (let j = 1; j <= qf; j++) if (t - j >= 0) v -= M[j] * e[t - j];
      e[t] = v;
    }
    return e.slice(pf);
  }

  /* ---- Levenberg-Marquardt untuk jumlah kuadrat ---- */
  function solveSym(Mx, b) {
    const n = b.length, a = Mx.map((r, i) => r.concat([b[i]]));
    for (let i = 0; i < n; i++) {
      let piv = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[piv][i])) piv = r;
      if (Math.abs(a[piv][i]) < 1e-14) return null;
      [a[i], a[piv]] = [a[piv], a[i]];
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const f = a[r][i] / a[i][i];
        for (let c = i; c <= n; c++) a[r][c] -= f * a[i][c];
      }
    }
    return a.map((r, i) => r[n] / r[i]);
  }
  function invert(Mx) {
    const n = Mx.length, a = Mx.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let i = 0; i < n; i++) {
      let piv = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[piv][i])) piv = r;
      if (Math.abs(a[piv][i]) < 1e-13) return null;
      [a[i], a[piv]] = [a[piv], a[i]];
      const d = a[i][i];
      for (let c = 0; c < 2 * n; c++) a[i][c] /= d;
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const f = a[r][i];
        if (f !== 0) for (let c = 0; c < 2 * n; c++) a[r][c] -= f * a[i][c];
      }
    }
    return a.map((r) => r.slice(n));
  }
  function jacobian(resFn, x, e0) {
    const k = x.length, m = e0.length, J = Array.from({ length: m }, () => new Array(k).fill(0));
    for (let j = 0; j < k; j++) {
      const h = 1e-6 * Math.max(1, Math.abs(x[j]));
      const xp = x.slice(); xp[j] += h;
      const xm = x.slice(); xm[j] -= h;
      const ep = resFn(xp), em = resFn(xm);
      for (let i = 0; i < m; i++) J[i][j] = (ep[i] - em[i]) / (2 * h);
    }
    return J;
  }
  function jtj(J) {
    const k = J[0].length, G = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let r = 0; r < J.length; r++) { const row = J[r]; for (let i = 0; i < k; i++) { const ri = row[i]; if (ri === 0) continue; for (let j = i; j < k; j++) G[i][j] += ri * row[j]; } }
    for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) G[i][j] = G[j][i];
    return G;
  }
  function levenberg(resFn, x0, isOk) {
    let x = x0.slice(), e = resFn(x), S = e.reduce((s, v) => s + v * v, 0), lam = 1e-2, iter = 0, converged = false;
    const k = x.length;
    for (; iter < 400; iter++) {
      const J = jacobian(resFn, x, e), G = jtj(J);
      const g = new Array(k).fill(0);
      for (let r = 0; r < J.length; r++) for (let i = 0; i < k; i++) g[i] += J[r][i] * e[r];
      let improved = false;
      for (let tries = 0; tries < 30; tries++) {
        const H = G.map((row, i) => row.map((v, j) => (i === j ? v + lam * Math.max(v, 1e-8) : v)));
        const step = solveSym(H, g.map((v) => -v));
        if (!step) { lam *= 10; continue; }
        const xn = x.map((v, i) => v + step[i]);
        if (!isOk(xn)) { lam *= 10; continue; }
        const en = resFn(xn), Sn = en.reduce((s, v) => s + v * v, 0);
        if (Number.isFinite(Sn) && Sn < S) {
          const rel = (S - Sn) / Math.max(S, 1e-300), mv = Math.max.apply(null, step.map((v, i) => Math.abs(v) / Math.max(1, Math.abs(x[i]))));
          x = xn; e = en; S = Sn; lam = Math.max(lam / 5, 1e-12); improved = true;
          if (rel < 1e-12 || mv < 1e-9) converged = true;
          break;
        }
        lam *= 10;
        if (lam > 1e12) break;
      }
      if (!improved) { converged = true; break; }
      if (converged) break;
    }
    return { x, e, S, iter: iter + 1, converged };
  }

  /* ---- Estimasi model ---- */
  function minObservations(o) {
    const k = o.p + o.q + o.P + o.Q + (o.constant ? 1 : 0);
    const lost = o.d + o.s * o.D + o.p + o.s * o.P;
    return lost + k + 5;
  }
  /* ---- Likelihood Gaussian eksak ARMA(pf, qf) stasioner lewat filter Kalman ----
     Bentuk ruang-keadaan (Harvey): a(t+1) = T a(t) + R e(t), w(t) - c = a(t)[0],
     T = matriks pendamping dengan kolom pertama phi_i = -A_i, R = [1, M1, ..., M(r-1)].
     Varians galat dinormalkan sigma^2 = 1 (di-"konsentrasi-kan"); P0 dari P = T P T' + R R' (algoritma doubling). */
  function tpt(P, phi, r) {
    const X = new Array(r), Y2 = new Array(r);
    for (let i = 0; i < r; i++) { X[i] = new Array(r); for (let j = 0; j < r; j++) X[i][j] = phi[i] * P[0][j] + (i + 1 < r ? P[i + 1][j] : 0); }
    for (let i = 0; i < r; i++) { Y2[i] = new Array(r); for (let j = 0; j < r; j++) Y2[i][j] = phi[j] * X[i][0] + (j + 1 < r ? X[i][j + 1] : 0); }
    return Y2;
  }
  function matMul(X, Y2, r) {
    const Z = Array.from({ length: r }, () => new Array(r).fill(0));
    for (let i = 0; i < r; i++) for (let k = 0; k < r; k++) { const v = X[i][k]; if (v === 0) continue; for (let j = 0; j < r; j++) Z[i][j] += v * Y2[k][j]; }
    return Z;
  }
  function stationaryP0(phi, Rv, r) {
    let Pk = Array.from({ length: r }, (_, i) => Rv.map((v) => Rv[i] * v));
    let Ak = Array.from({ length: r }, (_, i) => { const row = new Array(r).fill(0); row[0] = phi[i]; if (i + 1 < r) row[i + 1] = 1; return row; });
    for (let it = 0; it < 60; it++) {
      const AP = matMul(Ak, Pk, r), AkT = Ak[0].map((_, j) => Ak.map((row) => row[j]));
      const inc = matMul(AP, AkT, r);
      let mx = 0;
      for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) { Pk[i][j] += inc[i][j]; mx = Math.max(mx, Math.abs(inc[i][j])); }
      Ak = matMul(Ak, Ak, r);
      if (mx < 1e-13) break;
    }
    return Pk;
  }
  function exactArma(w, A, M, c, pf, qf) {
    const n = w.length, r = Math.max(pf, qf + 1, 1);
    const phi = new Array(r).fill(0); for (let i = 1; i <= pf; i++) phi[i - 1] = -A[i];
    const Rv = new Array(r).fill(0); Rv[0] = 1; for (let j = 1; j <= qf; j++) Rv[j] = M[j];
    let P = stationaryP0(phi, Rv, r);
    let a = new Array(r).fill(0);
    const v = new Array(n), F = new Array(n);
    let S = 0, sumLogF = 0;
    const RR = Array.from({ length: r }, (_, i) => Rv.map((x) => Rv[i] * x));
    for (let t = 0; t < n; t++) {
      const vt = (w[t] - c) - a[0], Ft = P[0][0];
      if (!(Ft > 1e-10) || !Number.isFinite(Ft) || !Number.isFinite(vt)) return null;
      v[t] = vt; F[t] = Ft; S += vt * vt / Ft; sumLogF += Math.log(Ft);
      const K = new Array(r);
      for (let i = 0; i < r; i++) K[i] = (phi[i] * P[0][0] + (i + 1 < r ? P[i + 1][0] : 0)) / Ft;
      const an = new Array(r);
      for (let i = 0; i < r; i++) an[i] = phi[i] * a[0] + (i + 1 < r ? a[i + 1] : 0) + K[i] * vt;
      const Pn = tpt(P, phi, r);
      for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) Pn[i][j] += RR[i][j] - Ft * K[i] * K[j];
      a = an; P = Pn;
    }
    return { v, F, S, sumLogF, n };
  }

  /* ---- Bobot psi, ACF teoretis, dan ACF sampel (untuk Metode Momen) ---- */
  function psiW(A, M, pf, qf, J) {
    const psi = [1];
    for (let j = 1; j < J; j++) { let x = j <= qf ? M[j] : 0; for (let i = 1; i <= Math.min(j, pf); i++) x -= A[i] * psi[j - i]; psi.push(x); }
    return psi;
  }
  function theoryAcf(A, M, pf, qf, lags) {
    const J = 500, psi = psiW(A, M, pf, qf, J);
    let g0 = 0; for (let j = 0; j < J; j++) g0 += psi[j] * psi[j];
    const rho = lags.map((k) => { let g = 0; for (let j = 0; j + k < J; j++) g += psi[j] * psi[j + k]; return g / g0; });
    return { rho, g0 };
  }
  function sampleAcf(w, c, lags) {
    const n = w.length; let g0 = 0; for (let t = 0; t < n; t++) g0 += (w[t] - c) * (w[t] - c);
    g0 /= n;
    return { g0, r: lags.map((k) => { let g = 0; for (let t = k; t < n; t++) g += (w[t] - c) * (w[t - k] - c); return g / n / g0; }) };
  }
  /* Lag yang dicocokkan: 1..(p+q) dan kelipatan s sebanyak (P+Q): jumlahnya sama dengan banyaknya parameter AR/MA. */
  function momentLags(o) {
    const lags = [];
    for (let k = 1; k <= o.p + o.q; k++) lags.push(k);
    for (let k = 1; k <= o.P + o.Q; k++) lags.push(k * o.s);
    return lags;
  }

  function fitModel(Y, cfg) {
    const o = normCfg(cfg), N = Y.length, method = o.method;
    const dpoly = diffPoly(o.d, o.D, o.s), t0 = dpoly.length - 1;
    const w = applyDiff(Y, dpoly);
    const names = paramNames(o), k = names.length;
    const startX = new Array(k).fill(0);
    if (o.constant) startX[k - 1] = mean(w);
    const nArma = o.p + o.q + o.P + o.Q;
    const pf0 = o.p + o.s * o.P;
    if (w.length - pf0 < k + 2) throw new Error('Data terlalu sedikit untuk orde yang dipilih.');
    const resFn = (x) => { const pl = polysOf(o, x); return cssResiduals(w, pl.A, pl.M, pl.sp.c, pl.pf, pl.qf); };
    const ok = (xx) => feasible(o, xx);
    const sq = (arr) => arr.reduce((s2, v) => s2 + v * v, 0);
    /* titik awal acak deterministik (dipakai OLS dan Momen untuk menghindari minimum lokal) */
    const multiStart = (fn, first) => {
      let r = first;
      if (nArma >= 2) {
        let seed = 20240607;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        for (let trial = 0; trial < 6; trial++) {
          const x0 = startX.map((v, i) => (i < nArma ? (rnd() - 0.5) * 1.0 : v));
          if (!ok(x0)) continue;
          const r2 = fn(x0);
          if (r2.S < r.S - 1e-9 * Math.max(1, r.S)) r = r2;
        }
      }
      return r;
    };
    /* --- OLS / CSS: jumlah kuadrat galat minimum --- */
    const runOls = () => {
      if (k === 0) { const e0 = resFn(startX); return { x: startX, e: e0, S: sq(e0), iter: 0, converged: true }; }
      const fn = (x0) => levenberg(resFn, x0, ok);
      return multiStart(fn, fn(startX));
    };

    let x, e, S, iter = 0, converged = true;
    const extra = {};
    let lik = null;                                   // hasil filter Kalman (MLE)
    if (method === 'moment') {
      const c = o.constant ? mean(w) : 0;
      const lags = momentLags(o);
      extra.momentLags = lags;
      const tail = o.constant ? [c] : [];
      let xa = new Array(nArma).fill(0);
      if (nArma > 0) {
        if (lags.some((L) => L >= w.length - 1)) throw new Error('Data terlalu sedikit untuk mencocokkan autokorelasi pada lag musiman.');
        const sa = sampleAcf(w, c, lags);
        extra.sampleR = sa.r; extra.gamma0 = sa.g0;
        const ywDirect = o.q === 0 && o.P === 0 && o.Q === 0 && o.p > 0;
        if (ywDirect) {
          /* Yule-Walker: R phi = r (R Toeplitz dari autokorelasi sampel) */
          const rr = [1].concat(sa.r), R = Array.from({ length: o.p }, (_, i) => Array.from({ length: o.p }, (_, j) => rr[Math.abs(i - j)]));
          const sol = solveSym(R, sa.r.slice(0, o.p));
          if (!sol) throw new Error('Persamaan Yule-Walker singular; kurangi orde AR.');
          xa = sol; extra.yw = true; iter = 0;
        } else {
          const mFn = (xx) => { const pl = polysOf(o, xx.concat(tail)); return theoryAcf(pl.A, pl.M, pl.pf, pl.qf, lags).rho.map((rv, i) => rv - sa.r[i]); };
          const okA = (xx) => feasible(o, xx.concat(tail));
          const runM = (x0) => levenberg(mFn, x0, okA);
          const first = runM(xa);
          let best = first;
          if (nArma >= 2) {
            let seed = 20240607;
            const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
            for (let trial = 0; trial < 6; trial++) {
              const x0 = xa.map(() => (rnd() - 0.5) * 1.0);
              if (!okA(x0)) continue;
              const r2 = runM(x0);
              if (r2.S < best.S - 1e-12) best = r2;
            }
          }
          xa = best.x; iter = best.iter; converged = best.converged; extra.momentDist = best.S;
        }
        if (extra.yw) extra.momentDist = 0;
      }
      x = xa.concat(tail);
      e = resFn(x); S = sq(e);
      if (nArma > 0) { const pl = polysOf(o, x); const th = theoryAcf(pl.A, pl.M, pl.pf, pl.qf, []); extra.sigma2Moment = (extra.gamma0 || 0) / th.g0; }
      else extra.sigma2Moment = sampleAcf(w, c, []).g0;
    } else {
      const r0 = runOls();
      x = r0.x; e = r0.e; S = r0.S; iter = r0.iter; converged = r0.converged;
      extra.css0 = S;
      if (method === 'mle') {
        const objU = (xx) => {
          const pl = polysOf(o, xx), L = exactArma(w, pl.A, pl.M, pl.sp.c, pl.pf, pl.qf);
          if (!L) return null;
          const g = Math.exp(L.sumLogF / (2 * L.n));
          return L.v.map((vt, i) => vt / Math.sqrt(L.F[i]) * g);
        };
        const uFn = (xx) => objU(xx) || new Array(w.length).fill(1e6);
        const u0 = objU(x);
        if (u0) {
          let r = k > 0 ? levenberg(uFn, x, ok) : { x, S: sq(u0), iter: 0, converged: true };
          x = r.x; iter = r.iter; converged = r.converged;
          const pl = polysOf(o, x);
          lik = exactArma(w, pl.A, pl.M, pl.sp.c, pl.pf, pl.qf);
        }
        if (!lik) extra.mleFallback = true;
      }
    }
    const pl = polysOf(o, x), pf = pl.pf, qf = pl.qf;
    let nEff, sigma2, loglik, nLik, cov = null, se = new Array(k).fill(NaN);
    if (lik) {
      /* MLE: galat = inovasi terstandarisasi v/sqrt(F) (varians sigma^2), mulai dari t = pf agar sejajar dengan metode lain */
      const n = lik.n;
      sigma2 = lik.S / n;
      e = lik.v.map((vt, i) => vt / Math.sqrt(lik.F[i])).slice(pf);
      nEff = e.length; nLik = n; S = sq(e);
      loglik = -0.5 * (n * Math.log(2 * Math.PI * sigma2) + lik.sumLogF + n);
      extra.mleS = lik.S; extra.sumLogF = lik.sumLogF;
      if (k > 0) {
        /* Hessian numerik dari -loglik terkonsentrasi: f(x) = (n/2) ln(S_u / n), S_u = S * exp(sumLogF / n) */
        const f = (xx) => { const q = polysOf(o, xx), L = exactArma(w, q.A, q.M, q.sp.c, q.pf, q.qf); return L ? 0.5 * n * Math.log(L.S * Math.exp(L.sumLogF / n) / n) : NaN; };
        const H = Array.from({ length: k }, () => new Array(k).fill(0));
        const hs = x.map((v) => 1e-4 * Math.max(1, Math.abs(v)));
        let good = true;
        for (let i = 0; i < k && good; i++) for (let j = i; j < k; j++) {
          const xs = (si, sj) => { const z = x.slice(); z[i] += si * hs[i]; z[j] += sj * hs[j]; return z; };
          const val = (f(xs(1, 1)) - f(xs(1, -1)) - f(xs(-1, 1)) + f(xs(-1, -1))) / (4 * hs[i] * hs[j]);
          if (!Number.isFinite(val)) { good = false; break; }
          H[i][j] = val; H[j][i] = val;
        }
        const inv = good ? invert(H) : null;
        if (inv) { cov = inv; se = x.map((_, i) => (cov[i][i] > 0 ? Math.sqrt(cov[i][i]) : NaN)); }
      }
    } else {
      nEff = e.length; nLik = nEff; sigma2 = S / nEff;
      loglik = -0.5 * nEff * (Math.log(2 * Math.PI * sigma2) + 1);
      if (k > 0) {
        const J = jacobian(resFn, x, e), inv = invert(jtj(J));
        if (inv) { cov = inv.map((row) => row.map((v) => v * sigma2)); se = x.map((_, i) => (cov[i][i] > 0 ? Math.sqrt(cov[i][i]) : NaN)); }
      }
    }
    const params = names.map((name, i) => {
      const z = x[i] / se[i];
      return { name, est: x[i], se: se[i], z, p: Number.isFinite(z) ? 2 * (1 - normCdf(Math.abs(z))) : NaN };
    });
    const nPar = k + 1; // + sigma^2
    const aic = -2 * loglik + 2 * nPar, bic = -2 * loglik + Math.log(nLik) * nPar;
    const aicc = nLik - nPar - 1 > 0 ? aic + (2 * nPar * (nPar + 1)) / (nLik - nPar - 1) : NaN;
    // galat pada skala data asli: indeks data asli = t0 + pf + i
    const first = t0 + pf;
    const err = new Array(N).fill(null), fitted = new Array(N).fill(null);
    for (let i = 0; i < nEff; i++) { err[first + i] = e[i]; fitted[first + i] = Y[first + i] - e[i]; }
    const sp = pl.sp;
    const refl = Math.max(maxReflection(sp.phi), maxReflection(sp.Phi), maxReflection(sp.theta.map((v) => -v)), maxReflection(sp.Theta.map((v) => -v)), 0);
    return {
      cfg: o, method, extra, Y, N, dpoly, t0, w, A: pl.A, M: pl.M, pf, qf, sp, x, names, params, k,
      e, nEff, nLik, css: sq(resFn(x)), sigma2, loglik, aic, bic, aicc, iter, converged, cov, first, err, fitted,
      stationary: arStable(sp.phi) && arStable(sp.Phi), invertible: arStable(sp.theta.map((v) => -v)) && arStable(sp.Theta.map((v) => -v)),
      nearBoundary: refl > 0.98,
    };
  }

  /* ---- Ramalan h langkah ke depan + selang kepercayaan ---- */
  function forecast(fit, h, z) {
    z = z || 1.959964;
    const { Y, N, dpoly, w, A, M, pf, qf, sp, e, first, t0 } = fit;
    const c = sp.c, nw = w.length;
    // galat lengkap sejajar dengan w: e_w[t] = 0 untuk t < pf
    const ew = new Array(nw).fill(0);
    for (let i = 0; i < e.length; i++) ew[pf + i] = e[i];
    const wf = w.slice(), ef = ew.slice(), yf = Y.slice();
    const L = dpoly.length - 1, mean_ = [];
    for (let m = 0; m < h; m++) {
      const t = nw + m;
      let v = c;
      for (let i = 1; i <= pf; i++) v -= A[i] * (wf[t - i] - c);
      for (let j = 1; j <= qf; j++) v += M[j] * ef[t - j];
      wf.push(v); ef.push(0);
      let y = v; for (let k = 1; k <= L; k++) y -= dpoly[k] * yf[yf.length - k];
      yf.push(y); mean_.push(y);
    }
    // bobot psi dari  [A(B) * delta(B)] psi(B) = M(B)
    const PI = polyMul(A, dpoly), psi = [1];
    for (let j = 1; j < h; j++) {
      let v = j <= qf ? M[j] : 0;
      for (let i = 1; i <= Math.min(j, PI.length - 1); i++) v -= PI[i] * psi[j - i];
      psi.push(v);
    }
    const se = [], lo = [], hi = [];
    let acc = 0;
    for (let m = 0; m < h; m++) {
      acc += psi[m] * psi[m];
      const s = Math.sqrt(fit.sigma2 * acc);
      se.push(s); lo.push(mean_[m] - z * s); hi.push(mean_[m] + z * s);
    }
    return { mean: mean_, se, lo, hi, psi };
  }

  /* ---- Peramalan RENTANG (langsung per horizon) ----
     Untuk tiap horizon h parameter diestimasi ulang dengan meminimumkan jumlah kuadrat galat h-langkah:
       min  Sum_t [ w(t+h) - w^(t+h | t; theta_h) ]^2
     w^(t+h|t) = prediksi h langkah dari data sampai t (galat masa depan = 0). Ramalan w tiap horizon baru
     dikembalikan ke skala data asli. Galat baku = RMSE galat h-langkah dalam sampel (skala data asli). */
  function fullE(w, A, M, c, pf, qf) {
    const n = w.length, e = new Array(n).fill(0);
    for (let t = pf; t < n; t++) {
      let v = 0;
      for (let i = 0; i <= pf; i++) v += A[i] * (w[t - i] - c);
      for (let j = 1; j <= qf; j++) if (t - j >= 0) v -= M[j] * e[t - j];
      e[t] = v;
    }
    return e;
  }
  function hstepAll(w, e, A, M, c, pf, qf, tau, H) {
    const f = new Array(H);
    for (let m = 1; m <= H; m++) {
      let v = c;
      for (let i = 1; i <= pf; i++) { const idx = tau + m - i; const wi = idx <= tau ? w[idx] : f[idx - tau - 1]; v -= A[i] * (wi - c); }
      for (let j = 1; j <= qf; j++) { const idx = tau + m - j; if (idx <= tau && idx >= 0) v += M[j] * e[idx]; }
      f[m - 1] = v;
    }
    return f;
  }
  function forecastDirect(fit, H, z) {
    z = z || 1.959964;
    const o = fit.cfg, { Y, dpoly, w, t0 } = fit, nw = w.length, L = dpoly.length - 1, k = fit.k, pf0 = fit.pf;
    const rec = forecast(fit, H, z);
    const nmin = Math.max(8, k + 3);
    const deadline = Date.now() + 8000;
    const okx = (xx) => feasible(o, xx);
    const models = [];
    let prev = fit.x.slice();
    for (let h = 1; h <= H; h++) {
      const nOrig = nw - h - pf0;
      let x = fit.x.slice(), status = 'base', reason = nOrig < nmin ? 'data' : '', sse = NaN;
      if (nOrig >= nmin && k === 0) status = 'direct';
      else if (nOrig >= nmin && Date.now() >= deadline) reason = 'waktu';
      else if (nOrig >= nmin) {
        const resH = (xx) => {
          const pl = polysOf(o, xx), e = fullE(w, pl.A, pl.M, pl.sp.c, pl.pf, pl.qf), r = [];
          for (let tau = pf0; tau <= nw - 1 - h; tau++) r.push(w[tau + h] - hstepAll(w, e, pl.A, pl.M, pl.sp.c, pl.pf, pl.qf, tau, h)[h - 1]);
          return r;
        };
        let r1 = null;
        try { r1 = levenberg(resH, prev, okx); } catch (err) { r1 = null; }
        if (r1 && Number.isFinite(r1.S)) { x = r1.x; sse = r1.S; status = 'direct'; prev = x.slice(); }
        else reason = 'gagal';
      }
      const pl = polysOf(o, x);
      models.push({ h, x, status, reason, nOrig, sse, pl, e: fullE(w, pl.A, pl.M, pl.sp.c, pl.pf, pl.qf) });
    }
    // ramalan pada asal terakhir
    const yf = Y.slice(), mean_ = [];
    models.forEach((m) => {
      const f = hstepAll(w, m.e, m.pl.A, m.pl.M, m.pl.sp.c, m.pl.pf, m.pl.qf, nw - 1, m.h);
      let y = f[m.h - 1]; for (let kk = 1; kk <= L; kk++) y -= dpoly[kk] * yf[yf.length - kk];
      yf.push(y); mean_.push(y);
    });
    // galat h-langkah dalam sampel pada skala data asli
    const W = models.map(() => []);
    models.forEach((m) => { for (let tau = pf0; tau <= nw - 1 - m.h; tau++) W[m.h - 1][tau] = hstepAll(w, m.e, m.pl.A, m.pl.M, m.pl.sp.c, m.pl.pf, m.pl.qf, tau, m.h)[m.h - 1]; });
    const errs = Array.from({ length: H }, () => []);
    for (let tau = pf0; tau <= nw - 2; tau++) {
      const base = tau + t0, hmax = Math.min(H, nw - 1 - tau), yh = [];
      for (let h = 1; h <= hmax; h++) {
        let y = W[h - 1][tau];
        for (let kk = 1; kk <= L; kk++) { const idx = base + h - kk; y -= dpoly[kk] * (idx <= base ? Y[idx] : yh[idx - base - 1]); }
        yh.push(y); errs[h - 1].push(Y[base + h] - y);
      }
    }
    const se = [], lo = [], hi = [];
    models.forEach((m, i) => {
      let s2 = rec.se[i];
      if (m.status === 'direct' && errs[i].length >= nmin) { const r = Math.sqrt(errs[i].reduce((a, v) => a + v * v, 0) / errs[i].length); if (Number.isFinite(r) && r > 0) s2 = r; }
      else if (m.status === 'direct') m.status = 'base';
      se.push(s2); lo.push(mean_[i] - z * s2); hi.push(mean_[i] + z * s2);
    });
    return { mean: mean_, se, lo, hi, psi: rec.psi, direct: true, nmin, models: models.map((m) => ({ h: m.h, status: m.status, reason: m.reason, nOrig: errs[m.h - 1].length, x: m.x, sse: m.sse })) };
  }

  /* ---- ACF, PACF, uji residu ---- */
  function acfOf(x, maxLag) {
    const n = x.length, m = mean(x);
    let c0 = 0; x.forEach((v) => { c0 += (v - m) * (v - m); });
    const r = [];
    for (let k = 1; k <= maxLag; k++) {
      let c = 0; for (let t = k; t < n; t++) c += (x[t] - m) * (x[t - k] - m);
      r.push(c0 > 0 ? c / c0 : NaN);
    }
    return r;
  }
  function pacfFrom(r) {
    const out = [], phi = [];
    for (let k = 1; k <= r.length; k++) {
      let num = r[k - 1], den = 1;
      for (let j = 1; j < k; j++) { num -= phi[k - 2][j - 1] * r[k - j - 1]; den -= phi[k - 2][j - 1] * r[j - 1]; }
      const a = den === 0 ? NaN : num / den;
      const row = [];
      for (let j = 1; j < k; j++) row.push(phi[k - 2][j - 1] - a * phi[k - 2][k - j - 1]);
      row.push(a); phi.push(row); out.push(a);
    }
    return out;
  }
  function ljungBox(e, m, nPar) {
    const n = e.length, r = acfOf(e, m);
    let Q = 0; r.forEach((v, i) => { Q += (v * v) / (n - i - 1); });
    Q *= n * (n + 2);
    const df = m - nPar;
    return { Q, m, df, p: df > 0 ? chiSqUpperP(Q, df) : NaN, r };
  }
  function jarqueBera(e) {
    const n = e.length, m = mean(e);
    let m2 = 0, m3 = 0, m4 = 0;
    e.forEach((v) => { const d = v - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; });
    m2 /= n; m3 /= n; m4 /= n;
    const skew = m3 / Math.pow(m2, 1.5), kurt = m4 / (m2 * m2);
    const JB = (n / 6) * (skew * skew + ((kurt - 3) * (kurt - 3)) / 4);
    return { JB, skew, kurt, p: Math.exp(-JB / 2) };
  }

  /* ---- Ukuran akurasi pada skala data asli ---- */
  function evaluate(Y, err, first) {
    let sq = 0, ab = 0, pct = 0, m = 0, mp = 0;
    for (let i = first; i < Y.length; i++) {
      if (err[i] === null) continue;
      sq += err[i] * err[i]; ab += Math.abs(err[i]); m++;
      if (Y[i] !== 0) { pct += Math.abs(err[i] / Y[i]) * 100; mp++; }
    }
    return { mse: m ? sq / m : NaN, rmse: m ? Math.sqrt(sq / m) : NaN, mae: m ? ab / m : NaN, mape: mp ? pct / mp : NaN, m };
  }

  /* ---- Petunjuk awal musiman: ACF deret yang sudah dibedakan sekali ---- */
  function detectSeasonality(Y) {
    const n = Y.length;
    if (n < 16) return { found: false, tooShort: true };
    const z = []; for (let i = 1; i < n; i++) z.push(Y[i] - Y[i - 1]);
    const maxLag = Math.min(36, Math.floor(z.length / 2) - 1);
    if (maxLag < 4) return { found: false, tooShort: true };
    const r = acfOf(z, maxLag), bound = 1.96 / Math.sqrt(z.length);
    let best = null;
    for (let s = 3; s <= maxLag; s++) {
      const v = r[s - 1];
      if (!(v > Math.max(bound, 0.3))) continue;
      const left = r[s - 2], right = s < maxLag ? r[s] : -Infinity;
      if (v < left || v < right) continue;                   // harus puncak lokal
      if (!best || v > best.r + 0.05) best = { s, r: v };    // pilih lag terkecil yang kuat bila selisih kecil
    }
    return { found: !!best, s: best ? best.s : null, r: best ? best.r : null, bound, acf: r };
  }

  /* ---- Pencarian orde sederhana berdasarkan AIC ---- */
  function searchOrders(Y, base, opts) {
    const out = [], maxPQ = opts && opts.maxPQ !== undefined ? opts.maxPQ : 2, maxSeas = base.seasonal ? 1 : 0;
    for (let p = 0; p <= maxPQ; p++) for (let q = 0; q <= maxPQ; q++) for (let P = 0; P <= maxSeas; P++) for (let Q = 0; Q <= maxSeas; Q++) {
      const cfg = Object.assign({}, base, { p, q, P, Q });
      const o = normCfg(cfg);
      if (Y.length < minObservations(o) + 3) continue;
      try {
        const f = fitModel(Y, cfg);
        if (!Number.isFinite(f.aic)) continue;
        const ev = evaluate(Y, f.err, f.first);
        out.push({ p, q, P, Q, aic: f.aic, bic: f.bic, sigma2: f.sigma2, rmse: ev.rmse, mape: ev.mape });
      } catch (err) { /* lewati orde yang gagal */ }
    }
    out.sort((a, b) => a.aic - b.aic);
    return out;
  }

  const core = { forecastDirect, METHOD_NAME, exactArma, theoryAcf, fitModel, forecast, acfOf, pacfFrom, ljungBox, jarqueBera, evaluate, detectSeasonality, searchOrders, minObservations, normCfg, diffPoly, applyDiff, polyMul, seasPoly, normCdf, chiSqUpperP, arStable };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;
  window.StatCalcArima = core;

  /* ==================================================================
     ANTARMUKA
     ================================================================== */
  /* Pita pengaturan tampilan hasil */
  if (window.StatRibbon) window.StatRibbon.mount({
    view: '#view-arima', key: 'arima',
    tabs: [
      { id: 'hasil', label: 'Hasil', groups: [
        { label: 'Tab hasil', cols: 2, items: [
          { type: 'toggle', key: 'ident', label: 'Identifikasi (ACF/PACF)', tab: 'ar-tab-ident' },
          { type: 'toggle', key: 'model', label: 'Parameter Model', tab: 'ar-tab-model' },
          { type: 'toggle', key: 'tbl', label: 'Tabel Hasil', tab: 'ar-tab-table' },
          { type: 'toggle', key: 'fc', label: 'Ramalan', tab: 'ar-tab-forecast' },
          { type: 'toggle', key: 'diag', label: 'Diagnostik Residu', tab: 'ar-tab-diag' },
          { type: 'toggle', key: 'cmp', label: 'Bandingkan Model', tab: 'ar-tab-compare' },
          { type: 'toggle', key: 'stp', label: 'Langkah Perhitungan', tab: 'ar-tab-steps' },
        ] },
        { label: 'Bagian lain', items: [
          { type: 'toggle', key: 'eval', label: 'Langkah 4 Evaluasi & Kesimpulan', hide: ['#ar-eval-card'] },
        ] },
      ], tip: 'Pengaturan pita hanya menyembunyikan atau menampilkan bagian hasil; perhitungan dan langkah-langkah tidak berubah.' },
      { id: 'grafik', label: 'Grafik & Ekspor', groups: [
        { label: 'Grafik', items: [
          { type: 'toggle', key: 'chart', label: 'Tab Grafik', tab: 'ar-tab-chart' },
          { type: 'toggle', key: 'figs', label: 'Grafik pendukung', hide: ['.ex-grid', '.ex-bar a'] },
        ] },
        { label: 'Unduhan', items: [
          { type: 'toggle', key: 'dl', label: 'Panel unduhan (.docx/.zip)', hide: ['.ex-panel', '.ex-bar'] },
        ] },
      ] },
    ],
  });

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const view = $('#view-arima');
  if (!view) return;

  const state = { fcMode: 'recursive', method: 'ols', seasonal: false, p: 1, d: 1, q: 0, P: 0, D: 1, Q: 1, s: 12, constant: false, h: 6, minRows: 10, last: null };

  const el = {
    mode: $('#arMode'), seasBox: $('#arSeasonalBox'), modeHint: $('#arModeHint'),
    p: $('#arP'), d: $('#arD'), q: $('#arQ'), P: $('#arSP'), D: $('#arSD'), Q: $('#arSQ'), s: $('#arS'),
    constant: $('#arConst'), h: $('#arH'), method: $('#arMethod'), methodHint: $('#arMethodHint'), fcMode: $('#arFcMode'), fcModeHint: $('#arFcModeHint'),
    setupError: $('#arSetupError'), needHint: $('#arNeedHint'), fillSampleSBtn: $('#arFillSampleSBtn'),
    dataCard: $('#ar-data-card'), minRowsHint: $('#arMinRowsHint'), tableBody: $('#arDataTableBody'),
    clearBtn: $('#arClearBtn'), addRowBtn: $('#arAddRowBtn'), removeRowBtn: $('#arRemoveRowBtn'),
    fillSampleBtn: $('#arFillSampleBtn'), sampleNote: $('#arSampleNote'), calcBtn: $('#arCalcBtn'), dataError: $('#arDataError'),
    resultsCard: $('#ar-results-card'), identWrap: $('#arIdentWrap'), modelWrap: $('#arModelWrap'), tableWrap: $('#arTableWrap'),
    forecastWrap: $('#arForecastWrap'), diagWrap: $('#arDiagWrap'), compareWrap: $('#arCompareWrap'), stepsWrap: $('#arStepsWrap'), chartWrap: $('#arChartWrap'),
    evalCard: $('#ar-eval-card'), evalWrap: $('#arEvalWrap'),
  };

  /* ---------- Pilihan model ---------- */
  function syncMode() {
    const seas = el.mode.value === 'sarima';
    el.seasBox.hidden = !seas;
    el.modeHint.innerHTML = seas
      ? '<strong>SARIMA</strong> dipakai bila data memiliki <em>pola musiman</em>: pola naik-turun yang berulang pada selang tetap (mis. s = 12 untuk data bulanan, s = 4 untuk triwulanan, s = 7 untuk data harian dengan pola mingguan).'
      : '<strong>ARIMA</strong> dipakai bila data <em>tidak memiliki pola musiman</em> (hanya tren atau fluktuasi acak). Jika grafik data menunjukkan pola yang berulang tiap s periode, pilih SARIMA.';
  }
  const METHOD_HINT = {
    ols: '<strong>OLS (kuadrat terkecil)</strong> meminimumkan jumlah kuadrat galat &Sigma;e&sup2; (Conditional Sum of Squares). Untuk model AR murni hasilnya sama dengan regresi OLS biasa; untuk model dengan MA atau musiman dikerjakan iteratif (kuadrat terkecil nonlinear). Cepat dan stabil; cocok sebagai pilihan awal.',
    mle: '<strong>MLE (kemungkinan maksimum)</strong> memaksimumkan likelihood normal <em>eksak</em> memakai filter Kalman, sehingga seluruh data (termasuk pengamatan awal) ikut terpakai tanpa pemotongan. Umumnya paling efisien dan standar di perangkat lunak statistik (R, Stata, statsmodels). Sedikit lebih lambat; AIC/BIC memakai log-likelihood eksak.',
    moment: '<strong>Metode Momen</strong> mencocokkan autokorelasi teoretis model dengan autokorelasi sampel. Untuk AR murni berupa persamaan <em>Yule-Walker</em> (solusi langsung); untuk model dengan MA/musiman dipakai pencocokan ACF pada lag 1..(p+q) dan lag kelipatan s. Sederhana, tetapi kurang efisien dan bisa tidak stabil bila ada komponen MA.',
  };
  function syncMethod() { el.methodHint.innerHTML = METHOD_HINT[el.method.value] || ''; }
  el.method.addEventListener('change', syncMethod);
  syncMethod();
  const FCMODE_HINT = {
    recursive: '<strong>Rekursif (satu-satu)</strong>: satu model diestimasi sekali; ramalan periode N+1 dipakai sebagai masukan untuk meramalkan N+2, dan seterusnya. Selang kepercayaan dari bobot &psi; model.',
    direct: '<strong>Rentang (langsung per horizon)</strong>: parameter diestimasi ulang untuk tiap horizon h dengan meminimumkan galat h-langkah ke depan, sehingga setiap periode diramalkan langsung dari data aktual, tanpa memakai ramalan sebelumnya. Selang dari RMSE galat h-langkah dalam sampel. Lebih lambat dan butuh data lebih banyak; horizon yang datanya tidak cukup memakai model utama.',
  };
  function syncFcMode() { el.fcModeHint.innerHTML = FCMODE_HINT[el.fcMode.value] || ''; }
  el.fcMode.addEventListener('change', syncFcMode);
  syncFcMode();
  el.mode.addEventListener('change', () => { syncMode(); updateMin(); });
  syncMode();

  function intIn(input, lo, hi, label) {
    const v = Number(String(input.value).trim());
    if (!Number.isInteger(v) || v < lo || v > hi) return { err: `${label} harus bilangan bulat antara ${lo} dan ${hi}.` };
    return { v };
  }

  /* Baca & validasi pengaturan model (Langkah 2). Mengembalikan true bila valid dan mengisi state. */
  function readSettings() {
    hideError(el.setupError);
    const seas = el.mode.value === 'sarima';
    const spec = [['p', el.p, 0, 5, 'Orde AR (p)'], ['d', el.d, 0, 2, 'Orde diferensiasi (d)'], ['q', el.q, 0, 5, 'Orde MA (q)']];
    if (seas) spec.push(['P', el.P, 0, 2, 'Orde AR musiman (P)'], ['D', el.D, 0, 1, 'Orde diferensiasi musiman (D)'], ['Q', el.Q, 0, 2, 'Orde MA musiman (Q)'], ['s', el.s, 2, 52, 'Panjang musim (s)']);
    spec.push(['h', el.h, 1, 60, 'Jumlah periode ramalan (h)']);
    const next = {};
    for (const [key, input, lo, hi, label] of spec) {
      const r = intIn(input, lo, hi, label);
      if (r.err) { showError(el.setupError, r.err); return false; }
      next[key] = r.v;
    }
    if (!seas) { next.P = 0; next.D = 0; next.Q = 0; next.s = 1; }
    next.seasonal = seas;
    next.method = el.method.value;
    next.fcMode = el.fcMode.value;
    const cv = el.constant.value;
    next.constant = cv === 'yes' ? true : cv === 'no' ? false : (next.d + next.D === 0);
    Object.assign(state, next);
    updateMin();
    return true;
  }

  /* Minimal jumlah periode menyesuaikan orde yang sedang diisi (tanpa menampilkan galat bila isian belum valid). */
  function updateMin() {
    const seas = el.mode.value === 'sarima';
    const g = (input, lo, hi, def) => { const v = Number(String(input.value).trim()); return Number.isInteger(v) && v >= lo && v <= hi ? v : def; };
    const cfg = { seasonal: seas, p: g(el.p, 0, 5, 1), d: g(el.d, 0, 2, 1), q: g(el.q, 0, 5, 0),
      P: seas ? g(el.P, 0, 2, 0) : 0, D: seas ? g(el.D, 0, 1, 0) : 0, Q: seas ? g(el.Q, 0, 2, 0) : 0, s: seas ? g(el.s, 2, 52, 12) : 1, constant: false };
    let need = 10;
    try { need = Math.max(10, minObservations(normCfg(cfg))); } catch (e) { /* biarkan bawaan */ }
    state.minRows = need;
    el.minRowsHint.textContent = need;
    const lbl = seas ? `SARIMA(${cfg.p},${cfg.d},${cfg.q})(${cfg.P},${cfg.D},${cfg.Q})[${cfg.s}]` : `ARIMA(${cfg.p},${cfg.d},${cfg.q})`;
    if (el.needHint) el.needHint.innerHTML = `Dengan orde ini (<strong>${lbl}</strong>), data minimal <strong>${need} periode</strong>. Jumlah data saat ini: <strong>${filledCount()}</strong>.`;
  }
  function filledCount() { return $$('input[data-role="Y"]', el.tableBody).filter((i) => i.value.trim() !== '').length; }
  [el.p, el.d, el.q, el.P, el.D, el.Q, el.s].forEach((inp) => inp.addEventListener('input', updateMin));
  el.tableBody.addEventListener('input', () => { if (el.needHint) updateMin(); });

  /* ---------- Tabel data ---------- */
  function buildDataTable(rowCount) { el.tableBody.innerHTML = ''; for (let i = 0; i < rowCount; i++) addRow(); }
  function addRow() {
    const idx = el.tableBody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rownum">${idx}</td><td><input type="text" inputmode="decimal" data-role="Y" placeholder="Nilai periode ${idx}"></td>`;
    el.tableBody.appendChild(tr);
  }
  buildDataTable(12);
  el.addRowBtn.addEventListener('click', () => { addRow(); updateMin(); });
  el.clearBtn.addEventListener('click', () => { $$('input', el.tableBody).forEach((inp) => { inp.value = ''; inp.classList.remove('invalid'); }); el.sampleNote.hidden = true; updateMin(); });
  el.removeRowBtn.addEventListener('click', () => {
    const rows = $$('tr', el.tableBody);
    if (rows.length <= state.minRows) return;
    rows[rows.length - 1].remove();
    updateMin();
  });

  /* Contoh data: ARIMA(1,1,0) dengan tren naik; SARIMA: data bulanan bertren dengan pola musiman s = 12. */
  const SAMPLE_ARIMA = [107.6, 111.2, 114.6, 114.8, 116, 117.1, 118.9, 118.7, 122.1, 127.6, 131.4, 131.3, 128.8, 129, 132.6, 138.8, 142.4, 147.4, 152.1, 154.1, 155.3, 155.5, 157.3, 159.2, 160.4, 161, 162.1, 164.2, 164.7, 167.4, 172.3, 176.9, 179.1, 181.9, 184.8, 183.4, 183, 183.4, 186.3, 187.6];
  const SAMPLE_SARIMA = [187.6, 194.4, 201.9, 208.9, 216.8, 222.1, 223.8, 223.8, 219.7, 212.2, 206.9, 202.6, 208.8, 213.8, 219.9, 231.3, 238.5, 246, 250, 248.3, 244.1, 238, 230.8, 228.5, 232.8, 235.4, 241.1, 250, 256.4, 263, 268, 266.1, 259, 253.3, 250.7, 243.6, 250.1, 254.1, 261.6, 272.5, 281.3, 290.4, 296.7, 293.9, 283.3, 279.8, 275.7, 270];
  function fillSample(seasonal) {
    const data = seasonal ? SAMPLE_SARIMA : SAMPLE_ARIMA;
    /* sesuaikan Langkah 2 dengan contoh agar langsung bisa dihitung */
    el.mode.value = seasonal ? 'sarima' : 'arima';
    el.p.value = 1; el.d.value = 1; el.q.value = 0;
    if (seasonal) { el.P.value = 0; el.D.value = 1; el.Q.value = 1; el.s.value = 12; }
    el.constant.value = 'auto';
    syncMode(); updateMin();
    while (el.tableBody.children.length < data.length) addRow();
    while (el.tableBody.children.length > data.length && el.tableBody.children.length > state.minRows) el.tableBody.lastElementChild.remove();
    $$('tr', el.tableBody).forEach((tr, i) => {
      const inp = tr.querySelector('input[data-role="Y"]');
      inp.value = i < data.length ? data[i] : '';
      inp.classList.remove('invalid');
    });
    updateMin();
    el.sampleNote.hidden = false;
    el.sampleNote.textContent = seasonal
      ? `Contoh: ${data.length} data bulanan bertren dengan pola musiman. Langkah 2 sudah diisi SARIMA(1,1,0)(0,1,1)[12] (s = 12); ubah bila perlu lalu klik Hitung Model.`
      : `Contoh: ${data.length} data bertren tanpa pola musiman. Langkah 2 sudah diisi ARIMA(1,1,0); pilih Konstanta = Ya (drift) bila ingin memodelkan tren naik, lalu klik Hitung Model.`;
  }
  el.fillSampleBtn.addEventListener('click', () => fillSample(false));
  el.fillSampleSBtn.addEventListener('click', () => fillSample(true));
  updateMin();

  function collectData() {
    const rows = $$('tr', el.tableBody), Y = [], problems = [];
    $$('input', el.tableBody).forEach((inp) => inp.classList.remove('invalid'));
    rows.forEach((tr, i) => {
      const inp = tr.querySelector('input[data-role="Y"]');
      const raw = inp.value.trim().replace(',', '.');
      const val = Number(raw);
      if (raw === '' || !Number.isFinite(val)) { problems.push(`Baris ${i + 1}: nilai kosong atau bukan angka.`); inp.classList.add('invalid'); }
      Y.push(val);
    });
    if (problems.length) return { error: problems.slice(0, 6).join(' ') + (problems.length > 6 ? ' …' : '') };
    if (Y.length < state.minRows) return { error: `Minimal ${state.minRows} periode data diperlukan untuk orde model yang dipilih (Langkah 2). Tambah data di Langkah 1 atau kecilkan orde.` };
    if (Y.every((v) => v === Y[0])) return { error: 'Semua data bernilai sama, model tidak dapat diestimasi.' };
    return { Y };
  }

  /* ---------- Label ---------- */
  function modelLabel(o) {
    return o.seasonal ? `SARIMA(${o.p},${o.d},${o.q})(${o.P},${o.D},${o.Q})[${o.s}]` : `ARIMA(${o.p},${o.d},${o.q})`;
  }
  const fmt = (x, d = 4) => (x === null || x === undefined || !Number.isFinite(x) ? '-' : Number(x).toFixed(d));
  const fmtP = (p) => (!Number.isFinite(p) ? '-' : p < 0.0001 ? '<0.0001' : p.toFixed(4));
  function statCard(label, value) { return `<div class="stat-card"><div class="k">${escapeHTML(label)}</div><div class="v">${escapeHTML(String(value))}</div></div>`; }
  function showError(node, msg) { node.textContent = msg; node.hidden = false; }
  function hideError(node) { node.hidden = true; node.textContent = ''; }
  function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
  const sup = (n) => ({ 1: '', 2: '²', 3: '³' }[n] !== undefined ? { 1: '', 2: '²', 3: '³' }[n] : '^' + n);

  /* ---------- Hitung ---------- */
  el.calcBtn.addEventListener('click', () => {
    hideError(el.dataError);
    if (!readSettings()) return;
    const data = collectData();
    if (data.error) { showError(el.dataError, data.error); return; }
    const Y = data.Y;
    let fit;
    try { fit = fitModel(Y, state); }
    catch (err) { showError(el.dataError, err.message || 'Model tidak dapat diestimasi.'); return; }
    if (!Number.isFinite(fit.sigma2) || fit.sigma2 <= 0) { showError(el.dataError, 'Model cocok sempurna atau tidak stabil (varians galat nol). Coba orde yang lebih kecil.'); return; }
    let fc;
    try { fc = state.fcMode === 'direct' ? forecastDirect(fit, state.h) : forecast(fit, state.h); }
    catch (err) { fc = forecast(fit, state.h); }
    const ev = evaluate(Y, fit.err, fit.first);
    const o = fit.cfg;
    const lbm = ljungBox(fit.e, Math.max(state.seasonal ? Math.min(2 * o.s, Math.floor(fit.nEff / 3)) : Math.min(10, Math.floor(fit.nEff / 3)), 1), o.p + o.q + o.P + o.Q);
    const jb = fit.nEff >= 8 ? jarqueBera(fit.e) : null;
    const season = detectSeasonality(Y);
    const R = { Y, fit, fc, ev, lb: lbm, jb, season, o, h: state.h };
    state.last = R;

    renderIdent(R); renderModel(R); renderTable(R); renderForecast(R); renderDiag(R);
    renderCompareStub(R); renderSteps(R); renderChart(R); renderEval(R);
    exportArima(R);

    $$('.tab-btn', $('#arResultTabs')).forEach((b) => b.classList.remove('active'));
    $$('.tab-panel', view).forEach((p) => p.classList.remove('active'));
    $('#arResultTabs .tab-btn[data-tab="ar-tab-ident"]').classList.add('active');
    $('#ar-tab-ident').classList.add('active');
    el.resultsCard.hidden = false;
    el.evalCard.hidden = false;
    el.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
  });

  $('#arResultTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    $$('#arResultTabs .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-panel', btn.closest('.step-card')).forEach((p) => p.classList.remove('active'));
    $('#' + btn.dataset.tab).classList.add('active');
  });

  /* ---------- Grafik (SVG dari StatCharts) ---------- */
  function svgBox(svg) { return `<div class="ar-svg" style="width:100%;max-width:720px;margin:0 auto 10px;">${svg}</div>`; }
  function fixSvg(node) { $$('.ar-svg svg', node).forEach((s) => { s.style.cssText = 'width:100%;height:auto;display:block;'; }); }
  function corrChart(vals, n, title, yLabel, s) {
    const SC = window.StatCharts;
    if (!SC) return '';
    const b = 1.96 / Math.sqrt(n);
    const col = vals.map((v, i) => (Math.abs(v) > b ? '#B5532F' : (s > 1 && (i + 1) % s === 0 ? '#BD7E1F' : '#22384A')));
    return SC.bars({ title, xLabel: 'Lag', yLabel, labels: vals.map((_, i) => i + 1), values: vals, colors: col, thin: true, hlines: [{ y: b, label: '+1,96/√n', color: '#948C77' }, { y: -b, color: '#948C77' }], H: 320 });
  }
  const lines = (title, labels, series, extra) => (window.StatCharts ? window.StatCharts.line(Object.assign({ title, xLabel: 'Periode', yLabel: 'Nilai', labels, series }, extra || {})) : '');

  /* ---------- Tab Identifikasi ---------- */
  function renderIdent(R) {
    const { fit, Y, season, o } = R;
    const w = fit.w, nw = w.length;
    const maxLag = Math.max(2, Math.min(Math.max(20, o.seasonal ? 3 * o.s : 0), Math.floor(nw / 2) - 1, nw - 2));
    const r = acfOf(w, maxLag), pr = pacfFrom(r);
    const dtxt = (o.d || o.D) ? `setelah diferensiasi (d = ${o.d}${o.seasonal ? `, D = ${o.D}` : ''})` : 'tanpa diferensiasi';
    let seasHtml;
    if (season.tooShort) seasHtml = '<p class="test-note">Data terlalu pendek untuk mendeteksi pola musiman secara otomatis (minimal 16 periode).</p>';
    else if (season.found) {
      const agree = o.seasonal;
      seasHtml = `<div class="test-verdict ${agree ? 'ok' : 'bad'}">Indikasi pola musiman terdeteksi (perkiraan s = ${season.s}, ACF = ${fmt(season.r, 3)})</div>
        <p class="test-conclusion">${agree
          ? `Anda memilih <strong>SARIMA</strong>, sesuai dengan indikasi ini${o.s === season.s ? '' : ` (perhatikan: s yang Anda pilih = ${o.s}, sedangkan perkiraan dari data = ${season.s})`}.`
          : `Anda memilih <strong>ARIMA</strong>, padahal ACF data yang dibedakan satu kali berpuncak di lag ${season.s} (${fmt(season.r, 3)} &gt; batas ${fmt(season.bound, 3)}). Pertimbangkan beralih ke <strong>SARIMA</strong> dengan s = ${season.s}.`}</p>`;
    } else {
      seasHtml = `<div class="test-verdict ok">Tidak ada indikasi kuat pola musiman</div>
        <p class="test-conclusion">${o.seasonal
          ? 'Anda memilih <strong>SARIMA</strong>, tetapi ACF tidak menunjukkan puncak musiman yang jelas. Bila grafik data juga tidak berpola berulang, <strong>ARIMA</strong> biasanya cukup dan lebih sederhana.'
          : 'ACF tidak menunjukkan puncak pada lag musiman, sejalan dengan pilihan <strong>ARIMA</strong>.'}</p>`;
    }
    el.identWrap.innerHTML = `
      <div class="test-block">
        <h4>Petunjuk Musiman: ARIMA atau SARIMA?</h4>
        <p class="test-sub">Pemeriksaan awal otomatis: ACF dari selisih pertama data dicari puncak berulang pada lag s. Ini hanya petunjuk; keputusan akhir tetap memakai grafik data dan pengetahuan Anda tentang data.</p>
        ${seasHtml}
      </div>
      <div class="test-block">
        <h4>ACF &amp; PACF Deret ${escapeHTML(dtxt)}</h4>
        <p class="test-sub">Dipakai untuk memilih orde: ACF terpotong di lag q &rarr; MA(q); PACF terpotong di lag p &rarr; AR(p). Pada data musiman, perhatikan lag kelipatan s (batang kuning). Batang merah melewati batas &plusmn;1,96/&radic;n (n = ${nw}).</p>
        <div id="arIdentCharts"></div>
      </div>`;
    const box = $('#arIdentCharts', el.identWrap);
    box.innerHTML = svgBox(lines('Data Asli (Y)', Y.map((_, i) => i + 1), [{ name: 'Data asli', values: Y }])) +
      ((o.d || o.D) ? svgBox(lines(`Data Setelah Diferensiasi (${o.d ? 'd = ' + o.d : ''}${o.d && o.D ? ', ' : ''}${o.D ? 'D = ' + o.D + ', s = ' + o.s : ''})`, w.map((_, i) => i + 1 + fit.t0), [{ name: 'Deret diferensiasi', values: w }], { hlines: [{ y: mean(w), label: 'rata-rata', color: '#BD7E1F' }] })) : '') +
      svgBox(corrChart(r, nw, 'ACF', 'Autokorelasi', o.s)) + svgBox(corrChart(pr, nw, 'PACF', 'Autokorelasi parsial', o.s));
    fixSvg(box);
  }

  /* ---------- Teks per metode estimasi ---------- */
  function methodSub(fit) {
    const nm = METHOD_NAME[fit.method];
    if (fit.method === 'mle') return `Estimasi dengan <strong>${nm}</strong>: filter Kalman memakai seluruh ${fit.nLik} pengamatan deret diferensiasi, ${fit.iter} iterasi (titik awal dari OLS).`;
    if (fit.method === 'moment') return `Estimasi dengan <strong>${nm}</strong>: ${fit.extra && fit.extra.yw ? 'persamaan Yule-Walker (solusi langsung)' : (fit.cfg.p + fit.cfg.q + fit.cfg.P + fit.cfg.Q ? 'pencocokan ACF teoretis dengan ACF sampel, ' + fit.iter + ' iterasi' : 'rata-rata sampel')}; galat dihitung dari parameter hasil estimasi, n efektif = ${fit.nEff}.`;
    return `Estimasi dengan <strong>${nm}</strong>, n efektif = ${fit.nEff} galat, ${fit.iter} iterasi.`;
  }
  function methodNote(fit) {
    if (fit.method === 'mle') return 'Galat baku dari kebalikan matriks Hessian numerik log-likelihood. AIC/BIC dihitung dari log-likelihood Gaussian eksak (n = ' + fit.nLik + '); hanya bermakna untuk membandingkan model dengan diferensiasi (d, D) yang sama pada data yang sama dan metode estimasi yang sama.';
    if (fit.method === 'moment') return 'Galat baku dihitung dari σ²·(J′J)⁻¹ di titik estimasi (hampiran): untuk model dengan MA, estimator momen kurang efisien sehingga galat baku sebenarnya cenderung lebih besar. Log-likelihood/AIC/BIC memakai pendekatan normal dari jumlah kuadrat galat, dan tidak sebanding dengan hasil MLE.';
    return 'AIC/BIC dihitung dari pendekatan likelihood normal berdasarkan CSS; hanya bermakna untuk membandingkan model dengan diferensiasi (d, D) yang sama pada data yang sama, dan berupa pendekatan karena jumlah galat efektif sedikit berbeda antar orde.';
  }

  /* ---------- Tab Parameter Model ---------- */
  function eqFactorB(coefs, step, sign) {
    if (!coefs.length) return '';
    let s = '1';
    coefs.forEach((c, i) => {
      const v = sign * c, k = (i + 1) * step;
      s += (v < 0 ? ' − ' : ' + ') + fmt(Math.abs(v), 4) + (k === 1 ? 'B' : 'B' + (k <= 3 ? sup(k) : '^' + k));
    });
    return '(' + s + ')';
  }
  function equationText(fit) {
    const o = fit.cfg, sp = fit.sp;
    const ar = eqFactorB(sp.phi, 1, -1) + eqFactorB(sp.Phi, o.s, -1);
    const diff = (o.d ? (o.d === 1 ? '(1 − B)' : `(1 − B)${sup(o.d)}`) : '') + (o.D ? (o.D === 1 ? `(1 − B^${o.s})` : `(1 − B^${o.s})${sup(o.D)}`) : '');
    const ma = eqFactorB(sp.theta, 1, +1) + eqFactorB(sp.Theta, o.s, +1);
    const lhsCore = (ar + diff) || '';
    const lhs = o.constant && o.d + o.D === 0 ? `${lhsCore}(Y(t) − ${fmt(sp.c, 4)})` : `${lhsCore}Y(t)`;
    const rhs = (o.constant && o.d + o.D > 0 ? fmt(sp.c, 4) + ' + ' : '') + (ma ? ma + ' e(t)' : 'e(t)');
    return `${lhs} = ${rhs}`;
  }
  function renderModel(R) {
    const { fit, o } = R;
    const rows = fit.params.map((p) => {
      const sig = Number.isFinite(p.p) ? (p.p < statAlpha() ? '<span style="color:var(--good,#4E7F3A);font-weight:600;">signifikan</span>' : '<span style="color:var(--bad,#B5532F);">tidak signifikan</span>') : '-';
      return `<tr><td>${escapeHTML(p.name)}</td><td>${fmt(p.est, 4)}</td><td>${fmt(p.se, 4)}</td><td>${fmt(p.z, 3)}</td><td>${fmtP(p.p)}</td><td>${sig}</td></tr>`;
    }).join('');
    const warn = [];
    if (!fit.stationary) warn.push('Bagian AR tidak stasioner.');
    if (!fit.invertible) warn.push('Bagian MA tidak invertibel.');
    if (fit.nearBoundary) warn.push('Ada parameter yang mendekati batas stasioner/invertibel (|koefisien pantulan| &gt; 0,98). Ini sering menandakan model terlalu banyak parameter atau data sudah di-diferensiasi berlebihan; coba orde yang lebih kecil.');
    if (!fit.converged) warn.push('Optimasi belum konvergen sempurna dalam batas iterasi; hasil dapat sedikit berbeda dari optimum.');
    if (fit.extra && fit.extra.mleFallback) warn.push('Likelihood eksak tidak dapat dihitung di titik awal; hasil memakai estimasi OLS.');
    if (fit.method === 'moment' && !(fit.extra && fit.extra.yw) && fit.extra && fit.extra.momentDist > 1e-6) warn.push(`Autokorelasi sampel tidak dapat dicocokkan persis oleh model (jarak kuadrat = ${fmt(fit.extra.momentDist, 5)}). Estimator momen kurang andal untuk model campuran AR-MA; bandingkan dengan OLS atau MLE.`);
    if (fit.params.length && fit.params.some((p) => !Number.isFinite(p.se))) warn.push('Galat baku sebagian parameter tidak dapat dihitung (matriks informasi singular), biasanya karena ada parameter yang saling menggantikan. Kurangi orde p/q (atau P/Q).');
    el.modelWrap.innerHTML = `
      <div class="test-block">
        <h4>Model Terpilih: ${escapeHTML(modelLabel(o))}</h4>
        <p class="test-sub">${o.seasonal ? 'Model musiman (SARIMA) dengan panjang musim s = ' + o.s + '.' : 'Model tanpa komponen musiman (ARIMA).'} ${methodSub(fit)}</p>
        <span class="formula">${escapeHTML(equationText(fit))}</span>
        ${fit.params.length ? `<div class="table-scroll"><table class="result-table"><caption>Estimasi parameter (galat baku dari matriks informasi)</caption>
          <thead><tr><th>Parameter</th><th>Estimasi</th><th>Galat baku</th><th>z</th><th>p-value</th><th>Keputusan (5%)</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<p class="test-note">Model tanpa parameter AR/MA (hanya diferensiasi), mis. random walk.</p>'}
        <div class="test-stat-row">
          ${statCard(fit.method === 'mle' ? 'σ² (MLE)' : fit.method === 'moment' ? 'σ² (galat/n)' : 'σ² (CSS/n)', fmt(fit.sigma2, 4))}
          ${statCard('Log-likelihood', fmt(fit.loglik, 2))}
          ${statCard('AIC', fmt(fit.aic, 2))}
          ${statCard('BIC', fmt(fit.bic, 2))}
        </div>
        <div class="test-stat-row">
          <div class="test-verdict ${fit.stationary ? 'ok' : 'bad'}">${fit.stationary ? 'AR stasioner' : 'AR tidak stasioner'}</div>
          <div class="test-verdict ${fit.invertible ? 'ok' : 'bad'}">${fit.invertible ? 'MA invertibel' : 'MA tidak invertibel'}</div>
        </div>
        ${warn.length ? `<p class="test-note">${warn.join(' ')}</p>` : ''}
        <p class="test-note">p-value memakai pendekatan normal (uji z) untuk setiap parameter dengan H<sub>0</sub>: parameter = 0. Parameter yang tidak signifikan dapat dipertimbangkan untuk dibuang. ${methodNote(fit)}</p>
      </div>`;
  }

  /* ---------- Tab Tabel Hasil ---------- */
  function renderTable(R) {
    const { Y, fit } = R, N = Y.length;
    let html = `<table class="result-table"><caption>Data Aktual vs Nilai Fit - ${escapeHTML(modelLabel(R.o))}</caption>
      <thead><tr><th>Periode</th><th>Data Aktual (Y)</th><th>Fit (F)</th><th>Residual (Y &minus; F)</th><th>|Residual|</th><th>Error %</th></tr></thead><tbody>`;
    for (let i = 0; i < N; i++) {
      const e = fit.err[i], f = fit.fitted[i];
      html += `<tr><td>${i + 1}</td><td>${fmt(Y[i], 2)}</td><td>${f === null ? '-' : fmt(f, 3)}</td><td>${e === null ? '-' : fmt(e, 3)}</td><td>${e === null ? '-' : fmt(Math.abs(e), 3)}</td><td>${e === null || Y[i] === 0 ? '-' : fmt(Math.abs(e / Y[i]) * 100, 2) + '%'}</td></tr>`;
    }
    html += `</tbody><tfoot><tr><td colspan="6">Periode awal tanpa nilai fit dipakai sebagai nilai awal (akibat diferensiasi dan orde AR). Nilai fit = ramalan satu langkah ke depan dari model.</td></tr></tfoot></table>`;
    el.tableWrap.innerHTML = html;
  }

  /* ---------- Tab Ramalan ---------- */
  function renderForecast(R) {
    const { Y, fc, fit } = R, N = Y.length, h = R.h;
    const dir = !!fc.direct;
    let rows = '';
    for (let m = 0; m < h; m++) {
      const md = dir ? fc.models[m] : null;
      const basis = dir ? `<td>${md.status === 'direct' ? 'Langsung' : 'Rekursif*'}</td>` : '';
      rows += `<tr><td>${N + m + 1}</td><td><strong>${fmt(fc.mean[m], 3)}</strong></td><td>${fmt(fc.se[m], 3)}</td><td>${fmt(fc.lo[m], 3)}</td><td>${fmt(fc.hi[m], 3)}</td>${basis}</tr>`;
    }
    const sub = dir
      ? 'Cara peramalan: <strong>Rentang (langsung per horizon)</strong>. Parameter diestimasi ulang untuk setiap horizon dengan meminimumkan galat h-langkah ke depan, sehingga tiap periode diramalkan langsung dari data aktual tanpa memakai ramalan sebelumnya. Galat baku = RMSE galat h-langkah dalam sampel; selang kepercayaan 95% = ramalan &plusmn; 1,96 &times; galat baku. Karena dihitung dari data sampel, galat baku pada horizon jauh (asal data makin sedikit) bisa mendatar atau turun dan kurang stabil dibanding cara rekursif.'
      : 'Cara peramalan: <strong>Rekursif (satu-satu)</strong>. Ramalan periode sebelumnya dipakai sebagai masukan untuk periode berikutnya. Selang kepercayaan 95% = ramalan &plusmn; 1,96 &times; galat baku ramalan. Selang melebar seiring horizon karena ketidakpastian menumpuk, terutama pada model dengan diferensiasi.';
    let extra = '';
    if (dir) {
      const base = fc.models.filter((m) => m.status !== 'direct');
      const why = { data: `data tidak cukup (kurang dari ${fc.nmin} asal pengamatan untuk menaksir galat h-langkah)`, waktu: 'batas waktu hitung tercapai', gagal: 'optimasi tidak konvergen' };
      const reasons = Array.from(new Set(base.map((m) => why[m.reason] || 'data tidak cukup'))).join('; ');
      if (base.length) extra += `<p class="test-note">* Horizon ${base.map((m) => m.h).join(', ')} memakai parameter model utama (rekursif) dan selang dari bobot &psi;: ${reasons}.</p>`;
      const head = fit.names.map((n) => `<th>${escapeHTML(n)}</th>`).join('');
      const prow = fc.models.map((m) => `<tr><td>${m.h}</td>${m.x.map((v) => `<td>${fmt(v, 4)}</td>`).join('')}<td>${m.nOrig}</td><td>${m.status === 'direct' ? 'Langsung' : 'Model utama'}</td></tr>`).join('');
      extra += `<details class="ar-edit" style="margin:12px 0;"><summary>Parameter per horizon</summary><div class="ar-edit-body"><div class="table-scroll"><table class="result-table"><thead><tr><th>h</th>${head}<th>Asal data</th><th>Dasar</th></tr></thead><tbody>${prow}</tbody></table></div><p class="field-note">Parameter hasil estimasi h-langkah untuk tiap horizon. Metode estimasi yang dipilih (${escapeHTML(METHOD_NAME[fit.method])}) dipakai sebagai titik awal, sedangkan kriterianya adalah jumlah kuadrat galat h-langkah.</p></div></details>`;
    }
    el.forecastWrap.innerHTML = `
      <div class="test-block">
        <h4>Ramalan ${h} Periode ke Depan</h4>
        <p class="test-sub">${sub}</p>
        <div class="table-scroll"><table class="result-table"><thead><tr><th>Periode</th><th>Ramalan</th><th>Galat baku</th><th>Batas bawah 95%</th><th>Batas atas 95%</th>${dir ? '<th>Dasar</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>
        ${extra}
        <div id="arFcEditHolder">${fcEditorHtml()}</div>
        <div id="arFcChart"></div>
      </div>`;
    const box = $('#arFcChart', el.forecastWrap);
    box.innerHTML = svgBox(fcChartSvg(R));
    fixSvg(box);
    bindFcEditor();
  }
  /* ---- Grafik Ramalan yang bisa diedit (judul, label, warna, seri, kisi, rentang) ---- */
  const FC_DEF = () => ({ title: '', xLabel: 'Periode', yLabel: 'Nilai', cAct: '#22384A', cFit: '#2F7F79', cFc: '#BD7E1F', cBand: '#948C77',
    showFit: true, showBand: true, markers: true, legend: true, gridH: true, gridV: false, gridOn: false, lastN: '', yMin: '', yMax: '', H: 380, lw: 2 });
  let fcOpts = FC_DEF();
  const numOrU = (v) => { const t = String(v === undefined || v === null ? '' : v).trim().replace(',', '.'); if (t === '') return undefined; const x = Number(t); return Number.isFinite(x) ? x : undefined; };

  function fcChartSvg(R) {
    const { Y, fc, fit } = R, N = Y.length, h = R.h, O = fcOpts;
    let labels = Array.from({ length: N + h }, (_, i) => i + 1);
    const pad = (arr) => arr.concat(new Array(h).fill(null));
    const bridge = (arr) => { const a = new Array(N - 1).fill(null); a.push(Y[N - 1]); return a.concat(arr); };
    const lw = Math.min(6, Math.max(1, numOrU(O.lw) || 2));
    let series = [{ name: 'Data aktual', values: pad(Y), color: O.cAct, marker: O.markers, width: lw }];
    if (O.showFit) series.push({ name: 'Fit', values: pad(fit.fitted), color: O.cFit, marker: false, width: lw });
    series.push({ name: 'Ramalan', values: bridge(fc.mean), color: O.cFc, marker: O.markers, width: lw });
    if (O.showBand) series.push({ name: 'Batas bawah 95%', values: bridge(fc.lo), color: O.cBand, dash: true, marker: false, width: lw }, { name: 'Batas atas 95%', values: bridge(fc.hi), color: O.cBand, dash: true, marker: false, width: lw });
    const last = Math.floor(numOrU(O.lastN) || 0);
    if (last >= 3 && last < labels.length) {
      const from = labels.length - last;
      labels = labels.slice(from);
      series = series.map((se) => Object.assign({}, se, { values: se.values.slice(from) }));
    }
    const opt = { title: (O.title || '').trim() || `Data, Fit, dan Ramalan ${modelLabel(R.o)}`, xLabel: O.xLabel, yLabel: O.yLabel, labels, series, noLegend: !O.legend, H: Math.min(700, Math.max(240, numOrU(O.H) || 380)) };
    const y0 = numOrU(O.yMin), y1 = numOrU(O.yMax);
    if (y0 !== undefined) opt.yFixMin = y0;
    if (y1 !== undefined) opt.yFixMax = y1;
    const gu = window.GraphCore && window.GraphCore.u;
    if (!gu || !O.gridOn) return lines(opt.title, labels, series, opt);
    /* kisi diatur khusus untuk grafik ini; gaya bersama dipulihkan sesudah digambar */
    const prev = Object.assign({}, gu.ST);
    Object.assign(gu.ST, { on: true, h: !!O.gridH, v: !!O.gridV });
    try { return lines(opt.title, labels, series, opt); } finally { Object.assign(gu.ST, prev); }
  }

  let fcExportTimer = null;
  function refreshFcCharts() {
    const R = state.last; if (!R) return;
    const svg = fcChartSvg(R);
    const a = $('#arFcChart', el.forecastWrap); if (a) { a.innerHTML = svgBox(svg); fixSvg(a); }
    const b = $('#arChartFcBox', el.chartWrap); if (b) { b.innerHTML = svgBox(svg); fixSvg(b); }
    clearTimeout(fcExportTimer);
    fcExportTimer = setTimeout(() => { if (state.last === R) exportArima(R); }, 700);
  }
  function svgWithSize(svg) {
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    return m && !/<svg[^>]*\swidth=/.test(svg) ? svg.replace('<svg ', `<svg width="${Math.round(m[1] * 1.5)}" height="${Math.round(m[2] * 1.5)}" `) : svg;
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function fcEditorHtml() {
    const O = fcOpts, v = (x) => escapeHTML(String(x)).replace(/"/g, '&quot;');
    const chk = (k, label) => `<label class="ar-chk"><input type="checkbox" data-fc="${k}"${O[k] ? ' checked' : ''}> ${label}</label>`;
    const txt = (k, label, ph) => `<label class="ar-fld"><span>${label}</span><input type="text" class="plain-input" data-fc="${k}" value="${v(O[k])}" placeholder="${ph || ''}"></label>`;
    const num = (k, label, ph) => `<label class="ar-fld"><span>${label}</span><input type="text" inputmode="decimal" class="plain-input" data-fc="${k}" value="${v(O[k])}" placeholder="${ph || ''}"></label>`;
    const col = (k, label) => `<label class="ar-fld ar-col"><span>${label}</span><input type="color" data-fc="${k}" value="${O[k]}"></label>`;
    return `
      <style>
        .ar-edit{border:1px solid var(--rule-strong);border-radius:var(--radius);background:var(--paper-2);margin:12px 0 14px;}
        .ar-edit>summary{cursor:pointer;padding:10px 14px;font-weight:600;font-size:14px;}
        .ar-edit-body{padding:4px 14px 14px;}
        .ar-edit h5{margin:12px 0 6px;font-size:13px;color:var(--accent);font-family:var(--font-body);}
        .ar-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px 12px;}
        .ar-fld{display:flex;flex-direction:column;gap:3px;font-size:12.5px;}
        .ar-fld .plain-input{width:100%;}
        .ar-col input[type=color]{width:100%;height:34px;padding:2px;border:1px solid var(--rule-strong);border-radius:6px;background:#fff;}
        .ar-chk{display:flex;align-items:center;gap:7px;font-size:13px;}
        .ar-edit .ar-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}
        .ar-edit .ar-act .btn-ghost{flex:1 1 140px;}
      </style>
      <details class="ar-edit" id="arFcEdit" open>
        <summary>Edit grafik (judul, warna, seri, kisi, rentang sumbu)</summary>
        <div class="ar-edit-body">
          <h5>Teks</h5>
          <div class="ar-grid">${txt('title', 'Judul grafik', 'Kosong = judul otomatis')}${txt('xLabel', 'Label sumbu X')}${txt('yLabel', 'Label sumbu Y')}</div>
          <h5>Warna garis</h5>
          <div class="ar-grid">${col('cAct', 'Data aktual')}${col('cFit', 'Fit')}${col('cFc', 'Ramalan')}${col('cBand', 'Selang 95%')}</div>
          <h5>Tampilkan</h5>
          <div class="ar-grid">${chk('showFit', 'Garis fit')}${chk('showBand', 'Selang kepercayaan 95%')}${chk('markers', 'Titik pada garis')}${chk('legend', 'Legenda')}</div>
          <h5>Garis kisi</h5>
          <div class="ar-grid">${chk('gridOn', 'Atur kisi sendiri')}${chk('gridH', 'Kisi horizontal')}${chk('gridV', 'Kisi vertikal')}</div>
          <h5>Rentang &amp; ukuran</h5>
          <div class="ar-grid">${num('lastN', 'Tampilkan N periode terakhir', 'Kosong = semua')}${num('yMin', 'Sumbu Y minimum', 'Otomatis')}${num('yMax', 'Sumbu Y maksimum', 'Otomatis')}${num('H', 'Tinggi grafik (240-700)')}${num('lw', 'Tebal garis (1-6)')}</div>
          <div class="ar-act">
            <button type="button" class="btn-ghost" data-fc-act="reset">Setel ulang grafik</button>
            <button type="button" class="btn-ghost" data-fc-act="png">Unduh PNG</button>
            <button type="button" class="btn-ghost" data-fc-act="svg">Unduh SVG</button>
          </div>
          <p class="field-note">Perubahan langsung tampil dan ikut ke grafik di tab <em>Grafik</em>, unduhan PNG/SVG/ZIP, serta berkas .docx.</p>
        </div>
      </details>`;
  }
  function bindFcEditor() {
    const root = $('#arFcEdit', el.forecastWrap); if (!root) return;
    const onEdit = (e) => {
      const t = e.target, k = t.getAttribute && t.getAttribute('data-fc'); if (!k) return;
      fcOpts[k] = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'gridH' || k === 'gridV') { fcOpts.gridOn = true; const g = $('[data-fc="gridOn"]', root); if (g) g.checked = true; }
      refreshFcCharts();
    };
    root.addEventListener('input', onEdit);
    root.addEventListener('change', onEdit);
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-fc-act]'); if (!b || !state.last) return;
      const act = b.getAttribute('data-fc-act');
      if (act === 'reset') {
        fcOpts = FC_DEF();
        const holder = $('#arFcEditHolder', el.forecastWrap);
        if (holder) { holder.innerHTML = fcEditorHtml(); bindFcEditor(); }
        refreshFcCharts();
      } else if (act === 'svg') {
        downloadBlob(new Blob([svgWithSize(fcChartSvg(state.last))], { type: 'image/svg+xml;charset=utf-8' }), 'StatCalc-arima-ramalan.svg');
      } else if (act === 'png') {
        try { const png = await window.StatExport.svgToPng(svgWithSize(fcChartSvg(state.last)), 2); downloadBlob(png.blob, 'StatCalc-arima-ramalan.png'); }
        catch (err) { alert('Peramban ini tidak dapat membuat PNG. Gunakan Unduh SVG.'); }
      }
    });
  }

  /* ---------- Tab Diagnostik ---------- */
  function renderDiag(R) {
    const { fit, lb, jb, o } = R;
    const lbOk = Number.isFinite(lb.p) ? lb.p > statAlpha() : null;
    const m = mean(fit.e), sd = Math.sqrt(fit.e.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, fit.e.length - 1));
    const tmean = m / (sd / Math.sqrt(fit.e.length)), pmean = 2 * (1 - normCdf(Math.abs(tmean)));
    const nPar = o.p + o.q + o.P + o.Q;
    el.diagWrap.innerHTML = `
      <div class="test-block">
        <h4>Uji Ljung-Box (Autokorelasi Residu)</h4>
        <p class="test-sub">H<sub>0</sub>: residu tidak berautokorelasi (white noise). H<sub>1</sub>: ada autokorelasi. Model yang baik menghasilkan residu yang acak, jadi diharapkan H<sub>0</sub> <em>tidak ditolak</em> (p &gt; 0,05).</p>
        <div class="test-stat-row">
          ${statCard('Q Ljung-Box', fmt(lb.Q, 3))}
          ${statCard('Lag (m)', lb.m)}
          ${statCard('Derajat bebas', lb.df > 0 ? lb.df : '-')}
          ${statCard('p-value', fmtP(lb.p))}
        </div>
        ${lbOk === null
          ? '<div class="test-verdict bad">Tidak dapat ditentukan</div><p class="test-conclusion">Derajat bebas &le; 0: jumlah lag terlalu sedikit dibanding jumlah parameter. Tambah data atau kurangi orde.</p>'
          : `<div class="test-verdict ${lbOk ? 'ok' : 'bad'}">${lbOk ? 'Residu white noise: model memadai' : 'Residu masih berautokorelasi: model belum memadai'}</div>
             <p class="test-conclusion">${lbOk ? `p-value ${fmtP(lb.p)} &gt; 0,05, sehingga H<sub>0</sub> tidak ditolak. Tidak ada bukti autokorelasi yang tersisa pada residu sampai lag ${lb.m}.` : `p-value ${fmtP(lb.p)} &le; 0,05, sehingga H<sub>0</sub> ditolak. Masih ada pola yang belum ditangkap model; coba menambah orde AR/MA${o.seasonal ? ' (atau komponen musiman)' : ', atau pertimbangkan SARIMA bila data berpola musiman'}.`}</p>`}
      </div>
      <div class="test-block">
        <h4>Uji Normalitas Residu (Jarque-Bera)</h4>
        <p class="test-sub">H<sub>0</sub>: residu berdistribusi normal. Normalitas dibutuhkan agar selang kepercayaan ramalan akurat.</p>
        ${jb ? `<div class="test-stat-row">${statCard('JB', fmt(jb.JB, 3))}${statCard('Skewness', fmt(jb.skew, 3))}${statCard('Kurtosis', fmt(jb.kurt, 3))}${statCard('p-value', fmtP(jb.p))}</div>
        <div class="test-verdict ${jb.p > statAlpha() ? 'ok' : 'bad'}">${jb.p > statAlpha() ? 'Residu berdistribusi normal' : 'Residu tidak normal'}</div>
        <p class="test-conclusion">${jb.p > statAlpha() ? 'H<sub>0</sub> tidak ditolak (p &gt; 0,05).' : 'H<sub>0</sub> ditolak (p &le; 0,05). Selang ramalan perlu ditafsirkan dengan hati-hati; periksa pencilan pada grafik residu.'}</p>`
        : '<p class="test-note">Residu terlalu sedikit untuk uji Jarque-Bera (minimal 8).</p>'}
      </div>
      <div class="test-block">
        <h4>Rata-rata Residu</h4>
        <div class="test-stat-row">${statCard('Rata-rata residu', fmt(m, 4))}${statCard('t-hitung', fmt(tmean, 3))}${statCard('p-value', fmtP(pmean))}</div>
        <p class="test-conclusion">Rata-rata residu ${pmean > statAlpha() ? 'tidak berbeda nyata dari nol (baik)' : 'berbeda nyata dari nol (mungkin ada tren yang belum ditangkap)'}.</p>
      </div>
      <div id="arDiagCharts"></div>`;
    const box = $('#arDiagCharts', el.diagWrap);
    const lag = Math.min(Math.max(20, o.seasonal ? 3 * o.s : 0), Math.floor(fit.nEff / 2) - 1);
    const racf = lag >= 2 ? acfOf(fit.e, lag) : [];
    box.innerHTML = svgBox(lines('Residual Menurut Periode', fit.e.map((_, i) => fit.first + i + 1), [{ name: 'Residual', values: fit.e }], { hlines: [{ y: 0, label: '0', color: '#BD7E1F' }] })) +
      (racf.length ? svgBox(corrChart(racf, fit.nEff, 'ACF Residual', 'Autokorelasi', o.s)) : '');
    fixSvg(box);
  }

  /* ---------- Tab Bandingkan Model ---------- */
  function renderCompareStub(R) {
    const o = R.o;
    el.compareWrap.innerHTML = `
      <div class="test-block">
        <h4>Bandingkan Beberapa Orde (AIC)</h4>
        <p class="test-sub">Mencoba kombinasi p, q = 0&ndash;2${o.seasonal ? ' dan P, Q = 0&ndash;1' : ''} dengan d = ${o.d}${o.seasonal ? `, D = ${o.D}, s = ${o.s}` : ''} pilihan konstanta, dan metode estimasi (${escapeHTML(METHOD_NAME[o.method])}) yang sama seperti model Anda, lalu mengurutkannya dari AIC terkecil. Orde dengan AIC terkecil umumnya terbaik, tetapi tetap periksa diagnostik residunya.</p>
        <div class="control-row"><button type="button" class="btn-primary" id="arCompareBtn">Jalankan Perbandingan</button></div>
        <div id="arCompareOut"></div>
      </div>`;
    $('#arCompareBtn').addEventListener('click', () => {
      const out = $('#arCompareOut');
      out.innerHTML = '<p class="test-note">Menghitung…</p>';
      setTimeout(() => {
        const list = searchOrders(R.Y, { p: 0, d: o.d, q: 0, P: 0, D: o.D, Q: 0, s: o.s, seasonal: o.seasonal, constant: o.constant, method: o.method });
        if (!list.length) { out.innerHTML = '<p class="test-note">Data terlalu sedikit untuk membandingkan model.</p>'; return; }
        const top = list.slice(0, 12), best = list[0].aic;
        const rows = top.map((m, i) => {
          const cur = m.p === o.p && m.q === o.q && m.P === o.P && m.Q === o.Q;
          return `<tr${cur ? ' style="background:#F3EFDF;"' : ''}><td>${i + 1}</td><td>${escapeHTML(modelLabel({ seasonal: o.seasonal, p: m.p, d: o.d, q: m.q, P: m.P, D: o.D, Q: m.Q, s: o.s }))}${cur ? ' (model Anda)' : ''}</td><td>${fmt(m.aic, 2)}</td><td>${fmt(m.aic - best, 2)}</td><td>${fmt(m.bic, 2)}</td><td>${fmt(m.rmse, 3)}</td><td>${fmt(m.mape, 2)}%</td></tr>`;
        }).join('');
        out.innerHTML = `<div class="table-scroll"><table class="result-table"><caption>${top.length} model terbaik menurut AIC (dari ${list.length} model yang berhasil diestimasi)</caption>
          <thead><tr><th>#</th><th>Model</th><th>AIC</th><th>&Delta;AIC</th><th>BIC</th><th>RMSE</th><th>MAPE</th></tr></thead><tbody>${rows}</tbody></table></div>
          <p class="test-note">Model dengan &Delta;AIC &lt; 2 dari yang terbaik praktis setara; pilih yang paling sederhana. Untuk memakai model lain, ubah ordenya di Langkah 2 lalu hitung ulang.</p>`;
      }, 30);
    });
  }

  /* ---------- Tab Langkah Perhitungan ---------- */
  function renderSteps(R) {
    const { Y, fit, fc, ev, o } = R, N = Y.length;
    const steps = [];
    const L = modelLabel(o);
    steps.push({ section: 'A. Bentuk model' });
    steps.push({
      title: `Model ${L}`,
      formula: o.seasonal
        ? `φ(B)·Φ(B^s)·(1 − B)^d·(1 − B^s)^D·Y(t) = c + θ(B)·Θ(B^s)·e(t)\nφ(B) = 1 − φ₁B − … − φp B^p          Φ(B^s) = 1 − Φ₁B^s − … − ΦP B^(sP)\nθ(B) = 1 + θ₁B + … + θq B^q          Θ(B^s) = 1 + Θ₁B^s + … + ΘQ B^(sQ)`
        : `φ(B)·(1 − B)^d·Y(t) = c + θ(B)·e(t)\nφ(B) = 1 − φ₁B − … − φp B^p\nθ(B) = 1 + θ₁B + … + θq B^q`,
      note: `B adalah operator mundur (B·Y(t) = Y(t−1)). Orde terpilih: p = ${o.p}, d = ${o.d}, q = ${o.q}${o.seasonal ? `, P = ${o.P}, D = ${o.D}, Q = ${o.Q}, s = ${o.s}` : ''}. ${o.constant ? (o.d + o.D === 0 ? 'Model memuat konstanta μ (rata-rata deret).' : 'Model memuat konstanta c (drift) pada deret hasil diferensiasi.') : 'Model tanpa konstanta.'}`,
    });
    steps.push({ section: 'B. Diferensiasi' });
    if (o.d + o.D === 0) steps.push({ title: 'Tanpa diferensiasi', formula: 'w(t) = Y(t)', note: 'd = 0' + (o.seasonal ? ' dan D = 0' : '') + ', data dipakai langsung.' });
    else {
      const dp = fit.dpoly, ex = fit.t0;
      const terms = dp.map((c, k) => (c === 0 ? null : `${c > 0 ? (k ? '+ ' : '') : '− '}${Math.abs(c) === 1 ? '' : Math.abs(c) + '·'}Y(t${k ? '−' + k : ''})`)).filter(Boolean).join(' ').replace(/^\+ /, '');
      steps.push({
        title: 'Deret diferensiasi w(t)',
        formula: `w(t) = ${o.d ? (o.d === 1 ? '(1 − B)' : `(1 − B)${sup(o.d)}`) : ''}${o.D ? `(1 − B^${o.s})${o.D > 1 ? sup(o.D) : ''}` : ''} Y(t)\n     = ${terms}\nw(${ex + 1}) = ${fmt(fit.w[0], 3)},  w(${ex + 2}) = ${fmt(fit.w[1], 3)},  w(${ex + 3}) = ${fmt(fit.w[2], 3)}, …`,
        note: `Diferensiasi menghilangkan tren${o.D ? ' (d) dan pola musiman (D)' : ''} sehingga w(t) lebih stasioner. Data berkurang ${ex} titik, tersisa ${fit.w.length}.`,
      });
    }
    const parLines = fit.params.map((p) => `${p.name} = ${fmt(p.est, 4)}  (galat baku ${fmt(p.se, 4)})`).join('\n');
    const polyNotes = () => {
      if (o.seasonal && (o.p || o.P)) steps.push({ title: 'Polinomial AR gabungan A(B)', formula: `A(B) = ${polyText(fit.A)}`, note: `Perkalian faktor non-musiman dan musiman memunculkan suku di lag kelipatan s dan interaksinya (derajat ${fit.pf}).` });
      if (o.seasonal && (o.q || o.Q)) steps.push({ title: 'Polinomial MA gabungan M(B)', formula: `M(B) = ${polyText(fit.M)}`, note: `Derajat ${fit.qf}.` });
    };
    if (fit.method === 'mle') {
      steps.push({ section: 'C. Estimasi parameter (MLE)' });
      steps.push({
        title: 'Likelihood Gaussian eksak (filter Kalman)',
        formula: `ln L = −½ [ n·ln(2πσ²) + Σ ln F(t) + (1/σ²)·Σ v(t)²/F(t) ]\nσ̂² = Σ v(t)²/F(t) / n     (dikonsentrasikan)\nn = ${fit.nLik},  Σ ln F(t) = ${fmt(fit.extra.sumLogF, 4)},  Σ v²/F = ${fmt(fit.extra.mleS, 4)}`,
        note: 'v(t) adalah galat prediksi satu langkah dari filter Kalman dan F(t) variansnya (relatif terhadap σ²). Keadaan awal memakai distribusi stasioner model, sehingga seluruh pengamatan terpakai, tidak ada data awal yang dibuang seperti pada CSS. A(B) = φ(B)·Φ(B^s) dan M(B) = θ(B)·Θ(B^s).',
      });
      polyNotes();
      steps.push({
        title: 'Hasil optimasi likelihood',
        formula: parLines + `\nσ̂² = ${fmt(fit.extra.mleS, 4)} / ${fit.nLik} = ${fmt(fit.sigma2, 4)}\nln L = ${fmt(fit.loglik, 3)}`,
        note: `Titik awal dari estimasi OLS (CSS = ${fmt(fit.extra.css0, 4)}), lalu dioptimalkan dengan Levenberg-Marquardt pada galat terbobot sehingga setara memaksimumkan ln L; konvergen setelah ${fit.iter} iterasi. Galat baku dari kebalikan Hessian numerik. Galat model pada tabel hasil = v(t)/√F(t).`,
      });
    } else if (fit.method === 'moment') {
      const lg = (fit.extra && fit.extra.momentLags) || [];
      steps.push({ section: 'C. Estimasi parameter (Metode Momen)' });
      if (lg.length) {
        steps.push({
          title: 'Autokorelasi sampel deret w(t)',
          formula: `r(k) = Σ [w(t) − ${o.constant ? 'w̄' : '0'}]·[w(t−k) − ${o.constant ? 'w̄' : '0'}] / Σ [w(t) − ${o.constant ? 'w̄' : '0'}]²\n` + lg.map((L, i) => `r(${L}) = ${fmt(fit.extra.sampleR[i], 4)}`).join(',  '),
          note: `Banyaknya persamaan sama dengan banyaknya parameter AR/MA (${lg.length}): lag ${lg.join(', ')}.${o.constant ? ' Konstanta diestimasi dengan rata-rata sampel w̄ = ' + fmt(fit.sp.c, 4) + '.' : ''}`,
        });
        if (fit.extra.yw) {
          steps.push({
            title: 'Persamaan Yule-Walker',
            formula: `R·φ = r,   R(i,j) = r(|i − j|),  r(0) = 1\n` + fit.params.filter((p2) => /^φ/.test(p2.name)).map((p2) => `${p2.name} = ${fmt(p2.est, 4)}`).join(',  '),
            note: 'Sistem linear dari autokorelasi sampel diselesaikan langsung (tanpa iterasi). Estimator Yule-Walker selalu menghasilkan model AR yang stasioner.',
          });
        } else {
          steps.push({
            title: 'Pencocokan autokorelasi teoretis',
            formula: `ρ(k; parameter) = r(k)  untuk k = ${lg.join(', ')}\nρ(k) = Σ ψ(j)·ψ(j+k) / Σ ψ(j)²,  ψ dari A(B)·ψ(B) = M(B)\n` + parLines,
            note: `Parameter dicari agar ACF teoretis model sama dengan ACF sampel pada lag tersebut (Levenberg-Marquardt, dibatasi stasioner dan invertibel; ${fit.iter} iterasi, jarak kuadrat sisa = ${fmt(fit.extra.momentDist, 6)}).`,
          });
          polyNotes();
        }
      } else {
        steps.push({ title: 'Tanpa parameter AR/MA', formula: `μ̂ = w̄ = ${fmt(fit.sp.c, 4)}`, note: 'Tidak ada autokorelasi yang perlu dicocokkan.' });
      }
      steps.push({
        title: 'Varians galat dan galat baku',
        formula: `σ̂² (momen) = γ̂(0) / Σ ψ(j)² = ${fmt(fit.extra.sigma2Moment, 4)}\nσ̂² (dari galat) = Σ e² / n = ${fmt(fit.css, 4)} / ${fit.nEff} = ${fmt(fit.sigma2, 4)}`,
        note: 'Aplikasi memakai σ̂² dari galat untuk selang ramalan dan ukuran akurasi agar sebanding dengan metode lain. Galat baku parameter dari σ²·(J′J)⁻¹ di titik estimasi (hampiran).',
      });
    } else {
      steps.push({ section: 'C. Estimasi parameter (OLS / CSS)' });
      steps.push({
        title: 'Galat model dan kriteria kuadrat terkecil',
        formula: `e(t) = Σ A(i)·[w(t−i) − c] − Σ M(j)·e(t−j)\nCSS = Σ e(t)²  (dari t = ${fit.pf + 1} sampai ${fit.w.length}, n efektif = ${fit.nEff})`,
        note: 'A(B) = φ(B)·Φ(B^s) dan M(B) = θ(B)·Θ(B^s) adalah hasil kali polinomial AR dan MA. Galat sebelum data pertama yang dapat dihitung dianggap nol (conditional). Untuk AR murni ini sama dengan regresi OLS biasa; bila ada MA/musiman, parameter dicari dengan meminimumkan CSS memakai algoritma Levenberg-Marquardt, dibatasi agar model stasioner dan invertibel.',
      });
      polyNotes();
      steps.push({
        title: 'Hasil optimasi',
        formula: parLines + `\nCSS = ${fmt(fit.css, 4)}\nσ² = CSS / n = ${fmt(fit.css, 4)} / ${fit.nEff} = ${fmt(fit.sigma2, 4)}`,
        note: `Konvergen setelah ${fit.iter} iterasi. Galat baku dari σ²·(J′J)⁻¹ dengan J = turunan galat terhadap parameter.`,
      });
    }
    // contoh galat pertama
    const i0 = 0, t = fit.pf; // indeks w
    if (fit.nEff > 0 && fit.method !== 'mle') {
      const parts = [];
      for (let i = 0; i <= fit.pf; i++) if (fit.A[i] !== 0) parts.push(`${fmt(fit.A[i], 4)}·(${fmt(fit.w[t - i], 3)}${fit.sp.c ? ' − ' + fmt(fit.sp.c, 3) : ''})`);
      steps.push({ title: `Contoh galat pertama e(${fit.first + 1})`, formula: `e = ${parts.join(' + ')}${fit.qf ? '  (suku MA = 0 karena galat awal dianggap nol)' : ''}\n  = ${fmt(fit.e[i0], 4)}`, note: 'Fit = Y − e. Galat pada data asli sama dengan galat pada deret diferensiasi, karena diferensiasi hanya menggeser nilai yang sudah diketahui.' });
    }
    steps.push({ section: 'D. Ramalan' });
    const wt = fit.w, nw = wt.length, c = fit.sp.c;
    const arTerms = [], maTerms = [];
    for (let i = 1; i <= fit.pf; i++) if (fit.A[i] !== 0) arTerms.push(`${fmt(-fit.A[i], 4)}·(${fmt(wt[nw - i], 3)}${c ? ' − ' + fmt(c, 3) : ''})`);
    for (let j = 1; j <= fit.qf; j++) if (fit.M[j] !== 0) maTerms.push(`${fmt(fit.M[j], 4)}·(${fmt(fit.e[fit.e.length - j] !== undefined ? fit.e[fit.e.length - j] : 0, 3)})`);
    if (fc.direct) {
      const m1 = fc.models[0], mLast = fc.models.filter((m) => m.status === 'direct').pop() || m1;
      const pl = (m) => fit.names.map((n, i) => `${n} = ${fmt(m.x[i], 4)}`).join(', ') || '(tanpa parameter)';
      steps.push({
        title: 'Ramalan rentang (langsung per horizon)',
        formula: `Untuk setiap h: minimumkan Σ [ w(t+h) − ŵ(t+h | t; θ_h) ]²\nŵ(t+h | t) = prediksi h langkah dari data sampai t (galat masa depan = 0)\nŶ(${N}+h) = ŵ_h − Σ δ(k)·Ŷ(${N}+h−k)\nh = 1: ${pl(m1)}\nh = ${mLast.h}: ${pl(mLast)}`,
        note: `Berbeda dengan rekursif, parameter θ_h diestimasi sendiri untuk tiap horizon (titik awal dari estimasi metode terpilih), dan ŵ_h dihitung langsung dari data aktual. Hasil w tiap horizon baru dikembalikan ke skala data asli dengan kebalikan diferensiasi. Horizon yang asal datanya kurang dari ${fc.nmin} memakai parameter model utama.`,
      });
      steps.push({
        title: 'Selang kepercayaan ramalan rentang 95%',
        formula: `galat baku(h) = √( Σ [Y(t+h) − Ŷ(t+h | t)]² / m_h )\nh = 1: m = ${m1.nOrig}, galat baku = ${fmt(fc.se[0], 4)}\nSelang = ramalan ± 1,96 × galat baku = [${fmt(fc.lo[0], 3)} ; ${fmt(fc.hi[0], 3)}]`,
        note: 'm_h adalah banyaknya asal pengamatan dalam sampel yang punya nilai aktual h langkah ke depan. Makin besar h, makin sedikit asal data sehingga galat baku makin kurang stabil.',
      });
    } else {
      steps.push({
        title: `Ramalan satu langkah: w(${nw + fit.t0 + 1})`,
        formula: `ŵ = ${c ? fmt(c, 4) + ' + ' : ''}${[arTerms.join(' + '), maTerms.join(' + ')].filter(Boolean).join(' + ') || '0'}\nŶ(${N + 1}) = ŵ − Σ δ(k)·Y(${N + 1}−k)  →  ${fmt(fc.mean[0], 3)}`,
        note: 'Galat masa depan diganti nol. Setelah w diramalkan, nilainya dikembalikan ke skala data asli dengan menjumlahkan kembali nilai yang sudah dibedakan (kebalikan diferensiasi). Ramalan berikutnya memakai ramalan sebelumnya secara rekursif.',
      });
      const psiShow = fc.psi.slice(0, Math.min(6, fc.psi.length)).map((v, j) => `ψ${j} = ${fmt(v, 4)}`).join(',  ');
      steps.push({
        title: 'Selang kepercayaan ramalan 95%',
        formula: `Var(h) = σ²·Σ ψ(j)², j = 0 … h−1\n${psiShow}${fc.psi.length > 6 ? ', …' : ''}\nh = 1: galat baku = √(${fmt(fit.sigma2, 4)}) = ${fmt(fc.se[0], 4)}\nSelang = ramalan ± 1,96 × galat baku = [${fmt(fc.lo[0], 3)} ; ${fmt(fc.hi[0], 3)}]`,
        note: 'ψ adalah bobot MA(∞) model, diperoleh dari [A(B)·δ(B)]·ψ(B) = M(B) dengan δ(B) polinomial diferensiasi. Selang melebar bila ada diferensiasi karena galat menumpuk.',
      });
    }
    steps.push({ section: 'E. Evaluasi' });
    steps.push({
      title: 'Ukuran akurasi (data asli vs fit)',
      formula: `MSE = Σ(Y − F)² / m = ${fmt(ev.mse, 4)}\nRMSE = √MSE = ${fmt(ev.rmse, 4)}\nMAE = Σ|Y − F| / m = ${fmt(ev.mae, 4)}\nMAPE = Σ|(Y − F)/Y| × 100% / m = ${fmt(ev.mape, 2)}%\nAIC = −2·logL + 2·(k+1) = ${fmt(fit.aic, 2)},  BIC = ${fmt(fit.bic, 2)}`,
      note: `m = ${ev.m} periode yang memiliki nilai fit. k = banyaknya parameter (termasuk konstanta), ditambah satu untuk σ².`,
    });
    let n = 0;
    el.stepsWrap.innerHTML = steps.map((s) => {
      if (s.section) return `<h3 class="step-section" style="margin:18px 0 8px;font-size:15px;">${escapeHTML(s.section)}</h3>`;
      n++;
      const parts = [`<h4>${escapeHTML(s.title)}</h4>`];
      if (s.formula) parts.push(`<span class="formula">${escapeHTML(s.formula)}</span>`);
      if (s.note) parts.push(`<p>${escapeHTML(s.note)}</p>`);
      return `<div class="step-block" data-step="${n}">${parts.join('')}</div>`;
    }).join('');
  }
  function polyText(p) {
    let s = '1';
    for (let i = 1; i < p.length; i++) { if (Math.abs(p[i]) < 1e-12) continue; s += (p[i] < 0 ? ' − ' : ' + ') + fmt(Math.abs(p[i]), 4) + (i === 1 ? 'B' : 'B^' + i); }
    return s;
  }

  /* ---------- Tab Grafik ---------- */
  function renderChart(R) {
    const { Y, fit } = R;
    const box = el.chartWrap;
    box.innerHTML = '<div id="arChartFcBox">' + svgBox(fcChartSvg(R)) + '</div><p class="chart-note">Biru tua = data aktual, hijau = nilai fit (ramalan satu langkah), kuning = ramalan ke depan, abu-abu putus-putus = selang 95%.</p>' +
      svgBox(lines('Residual Menurut Periode', fit.e.map((_, i) => fit.first + i + 1), [{ name: 'Residual', values: fit.e }], { hlines: [{ y: 0, label: '0', color: '#BD7E1F' }] })) + '<p class="chart-note">Residual yang baik acak di sekitar nol tanpa pola.</p>';
    fixSvg(box);
  }

  /* ---------- Evaluasi & Kesimpulan ---------- */
  function mapeLabel(mape) {
    if (!Number.isFinite(mape)) return { text: 'Tidak dapat ditentukan', cls: '' };
    if (mape < 10) return { text: 'Sangat Akurat', cls: 'ok' };
    if (mape < 20) return { text: 'Akurat', cls: 'ok' };
    if (mape < 50) return { text: 'Cukup Akurat', cls: 'bad' };
    return { text: 'Tidak Akurat', cls: 'bad' };
  }
  function renderEval(R) {
    const { fit, fc, ev, lb, o, season } = R, N = R.Y.length;
    const verdict = mapeLabel(ev.mape);
    const lbOk = Number.isFinite(lb.p) ? lb.p > statAlpha() : null;
    const sigPar = fit.params.filter((p) => Number.isFinite(p.p) && p.p >= statAlpha()).map((p) => p.name);
    const notes = [];
    if (!o.seasonal && season.found) notes.push(`ACF menunjukkan indikasi pola musiman (s ≈ ${season.s}); pertimbangkan model <strong>SARIMA</strong>.`);
    if (o.seasonal && !season.found && !season.tooShort) notes.push('Tidak ada indikasi musiman yang kuat pada data; <strong>ARIMA</strong> yang lebih sederhana mungkin sudah cukup.');
    if (lbOk === false) notes.push('Residu masih berautokorelasi (Ljung-Box); orde model perlu disesuaikan.');
    if (sigPar.length) notes.push(`Parameter ${sigPar.join(', ')} tidak signifikan pada 5%; pertimbangkan menguranginya.`);
    el.evalWrap.innerHTML = `<div class="test-block">
      <h4>Ringkasan ${escapeHTML(modelLabel(o))}</h4>
      <p class="test-sub">Akurasi dihitung dari selisih data aktual dan nilai fit (ramalan satu langkah) pada m = ${ev.m} periode.</p>
      <div class="test-stat-row">
        ${statCard('MSE', fmt(ev.mse))}${statCard('RMSE', fmt(ev.rmse))}${statCard('MAE', fmt(ev.mae))}${statCard('MAPE', fmt(ev.mape, 2) + '%')}
      </div>
      <div class="test-stat-row">
        ${statCard('AIC', fmt(fit.aic, 2))}${statCard('BIC', fmt(fit.bic, 2))}${statCard('Ljung-Box p', fmtP(lb.p))}${statCard('Ramalan periode ' + (N + 1), fmt(fc.mean[0], 3))}
      </div>
      <div class="test-verdict ${verdict.cls}">${verdict.text} (MAPE ${fmt(ev.mape, 2)}%)</div>
      <div class="test-verdict ${lbOk === null ? '' : lbOk ? 'ok' : 'bad'}" style="margin-top:8px;">${lbOk === null ? 'Diagnostik residu tidak dapat ditentukan' : lbOk ? 'Residu white noise: model memadai' : 'Residu belum white noise: model belum memadai'}</div>
      <p class="test-conclusion">Model <strong>${escapeHTML(modelLabel(o))}</strong> menghasilkan MAPE ${fmt(ev.mape, 2)}% (tergolong <strong>${verdict.text.toLowerCase()}</strong>) dan ${lbOk === null ? 'diagnostik residu belum dapat dinilai' : lbOk ? 'lolos uji autokorelasi residu' : 'belum lolos uji autokorelasi residu'}. Ramalan ${R.h} periode ke depan tersedia pada tab <em>Ramalan</em>, dimulai dari ${fmt(fc.mean[0], 3)} untuk periode ${N + 1} (selang 95%: ${fmt(fc.lo[0], 3)} sampai ${fmt(fc.hi[0], 3)}).</p>
      ${notes.length ? `<ul class="test-note" style="padding-left:18px;margin:8px 0 0;">${notes.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
      <p class="test-note">Kriteria MAPE (Lewis, 1982): &lt;10% sangat akurat, 10-20% akurat, 20-50% cukup akurat, &gt;50% tidak akurat. Pilih model terbaik dengan mempertimbangkan AIC/BIC yang kecil, residu white noise, dan parameter yang signifikan, bukan hanya MAPE.</p>
    </div>`;
  }

  /* =========================================================================
     EKSPOR .docx + GRAFIK PENDUKUNG (lihat Method/Shared/export-hasil.js)
     ========================================================================= */
  function exportArima(R) {
    try {
      const SC = window.StatCharts, SE = window.StatExport;
      if (!SC || !SE) return;
      const { Y, fit, fc, ev, o } = R, N = Y.length, L = modelLabel(o);
      const w = fit.w, nw = w.length;
      const maxLag = Math.max(2, Math.min(Math.max(20, o.seasonal ? 3 * o.s : 0), Math.floor(nw / 2) - 1, nw - 2));
      const r = acfOf(w, maxLag), pr = pacfFrom(r);
      const rl = Math.min(Math.max(20, o.seasonal ? 3 * o.s : 0), Math.floor(fit.nEff / 2) - 1);
      const charts = [
        { title: 'Data aktual, fit, dan ramalan', caption: 'Garis kuning = ramalan; garis putus-putus = selang kepercayaan 95%.', build: () => fcChartSvg(R) },
        { title: 'ACF deret yang dimodelkan', caption: 'Dipakai untuk menentukan orde MA (q) dan MA musiman (Q).', build: () => corrChart(r, nw, 'ACF', 'Autokorelasi', o.s) },
        { title: 'PACF deret yang dimodelkan', caption: 'Dipakai untuk menentukan orde AR (p) dan AR musiman (P).', build: () => corrChart(pr, nw, 'PACF', 'Autokorelasi parsial', o.s) },
        { title: 'Residual menurut periode', caption: 'Residual yang baik acak di sekitar nol.', build: () => lines('Residual Menurut Periode', fit.e.map((_, i) => fit.first + i + 1), [{ name: 'Residual', values: fit.e }], { hlines: [{ y: 0, label: '0', color: '#BD7E1F' }] }) },
      ];
      if (rl >= 2) charts.push({ title: 'ACF residual', caption: 'Batang di dalam batas ±1,96/√n menandakan residual white noise.', build: () => corrChart(acfOf(fit.e, rl), fit.nEff, 'ACF Residual', 'Autokorelasi', o.s) });
      SE.publish({
        id: 'arima', title: 'Hasil ' + L, anchor: '#ar-eval-card', resultsCard: '#ar-results-card',
        meta: [['Model', L], ['Metode estimasi', METHOD_NAME[o.method]], ['Cara peramalan', R.fc && R.fc.direct ? 'Rentang (langsung per horizon)' : 'Rekursif (satu-satu)'], ['Jenis', o.seasonal ? 'SARIMA (musiman)' : 'ARIMA (non-musiman)'], ['Jumlah data (N)', N], ['AIC', fmt(fit.aic, 2)], ['BIC', fmt(fit.bic, 2)], ['MSE', fmt(ev.mse)], ['MAPE', fmt(ev.mape, 2) + '%'], ['Ljung-Box p', fmtP(R.lb.p)], ['Ramalan periode ' + (N + 1), fmt(fc.mean[0], 3)]],
        sections: [{ heading: 'Parameter Model', sel: '#arModelWrap' }, { heading: 'Data Aktual vs Fit', sel: '#arTableWrap' }, { heading: 'Ramalan', sel: '#arForecastWrap' }, { heading: 'Diagnostik Residu', sel: '#arDiagWrap' }, { heading: 'Langkah Perhitungan', sel: '#arStepsWrap' }, { heading: 'Evaluasi', sel: '#arEvalWrap' }],
        data: { head: ['Periode', 'Data aktual (Y)'], rows: Y.map((y, i) => [i + 1, y]), caption: 'Data deret waktu yang dipakai pada perhitungan.' },
        charts,
      });
    } catch (err) { console.warn('Ekspor ARIMA:', err); }
  }
})();
