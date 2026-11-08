/* =========================================================================
   SEM-CORE - inti hitungan Structural Equation Modeling (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   Sintaks model (mirip lavaan), satu baris satu persamaan:
     Kepuasan =~ x1 + x2 + x3        konstruk laten reflektif (indikator = kolom data)
     Kualitas <~ q1 + q2             konstruk formatif (hanya PLS-SEM)
     Loyalitas ~ Kepuasan + Harga    regresi / jalur struktural (laten atau variabel teramati)
     x1 ~~ x2                        kovarians (galat) antar dua variabel
     # komentar

   1) CB-SEM (covariance-based): estimasi maximum likelihood pada matriks kovarians, model umum
      bentuk RAM  Sigma = F (I-A)^-1 S (I-A)^-T F'. Optimasi Gauss-Newton/Levenberg-Marquardt dengan
      turunan analitik, galat baku dari informasi Fisher, solusi terstandar (delta method), efek
      langsung/tidak langsung/total, ukuran kecocokan (chi-square, RMSEA + selang, CFI, TLI, NFI,
      GFI, AGFI, SRMR, AIC, BIC). Konvensi lavaan: S = (1/N) sum(x - mean)(x - mean)', chi2 = N * F_ML.
   2) PLS-SEM (partial least squares, algoritma Lohmoller): skema bobot centroid / faktorial / jalur,
      mode A (reflektif) dan mode B (formatif), loading, bobot, koefisien jalur, R2, f2, VIF,
      Cronbach alpha, rho_A, CR, AVE, Fornell-Larcker, HTMT, cross-loading, efek tidak langsung/total,
      dan bootstrap (seed tetap, hasil reproducible).
   Memakai window.StatDist. Muat SETELAH stat-dist.js.
   ========================================================================= */
(function () {
  'use strict';
  const D = window.StatDist;
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
  const eye = (n) => { const I = zeros(n, n); for (let i = 0; i < n; i++) I[i][i] = 1; return I; };
  const err = (msg, extra) => { const e = new Error(msg); if (extra) Object.assign(e, extra); return e; };

  /* ---------------------------------- aljabar linear kecil ---------------------------------- */
  function mm(A, B) {
    const n = A.length, k = B.length, m = B[0].length, C = zeros(n, m);
    for (let i = 0; i < n; i++) { const Ai = A[i], Ci = C[i]; for (let l = 0; l < k; l++) { const a = Ai[l]; if (a === 0) continue; const Bl = B[l]; for (let j = 0; j < m; j++) Ci[j] += a * Bl[j]; } }
    return C;
  }
  const tp = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  function inv(Ain) {   // Gauss-Jordan; null bila singular
    const n = Ain.length, A = Ain.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (!(Math.abs(A[piv][c]) > 1e-13)) return null;
      if (piv !== c) { const t = A[c]; A[c] = A[piv]; A[piv] = t; }
      const d = A[c][c]; for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f !== 0) for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j]; }
    }
    return A.map((r) => r.slice(n));
  }
  function solve(A, b) {   // A x = b, pivoting; null bila singular
    const n = A.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (!(Math.abs(M[piv][c]) > 1e-14)) return null;
      if (piv !== c) { const t = M[c]; M[c] = M[piv]; M[piv] = t; }
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; if (f !== 0) for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }
  function chol(A) {   // faktor Cholesky bawah; null bila tidak definit positif
    const n = A.length, L = zeros(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (!(s > 1e-12)) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
    return L;
  }
  function cholInvLogdet(A) {
    const L = chol(A); if (!L) return null; const n = A.length;
    let ld = 0; for (let i = 0; i < n; i++) ld += 2 * Math.log(L[i][i]);
    const Li = zeros(n, n);   // invers L (bawah)
    for (let i = 0; i < n; i++) { Li[i][i] = 1 / L[i][i]; for (let j = 0; j < i; j++) { let s = 0; for (let k = j; k < i; k++) s += L[i][k] * Li[k][j]; Li[i][j] = -s / L[i][i]; } }
    const Ainv = zeros(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = 0; for (let k = i; k < n; k++) s += Li[k][i] * Li[k][j]; Ainv[i][j] = s; Ainv[j][i] = s; }
    return { inv: Ainv, logdet: ld };
  }

  /* ---------------------------------- distribusi pembantu ---------------------------------- */
  function ncx2Cdf(x, k, lam) {   // chi-square non-sentral lewat campuran Poisson
    if (x <= 0) return 0; const h = lam / 2; if (h < 1e-12) return D.chi2Cdf(x, k);
    const jmax = Math.ceil(h + 14 * Math.sqrt(h + 1) + 60); let s = 0;
    for (let j = 0; j <= jmax; j++) { const w = Math.exp(-h + j * Math.log(h) - D.lgamma(j + 1)); if (w < 1e-300) continue; s += w * D.chi2Cdf(x, k + 2 * j); }
    return Math.min(1, s);
  }
  function ncpFor(T, df, prob) {   // lam sehingga P(X <= T | df, lam) = prob (menurun terhadap lam); 0 bila tidak ada
    if (ncx2Cdf(T, df, 0) < prob) return 0;
    let lo = 0, hi = Math.max(10, T); while (ncx2Cdf(T, df, hi) > prob && hi < 1e7) hi *= 2;
    for (let i = 0; i < 90; i++) { const mid = (lo + hi) / 2; if (ncx2Cdf(T, df, mid) > prob) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* ======================================== PARSER MODEL ======================================== */
  function parseModel(text, cols) {
    const colMap = {}; cols.forEach((c) => { const k = String(c).trim().toLowerCase(); if (k && !(k in colMap)) colMap[k] = String(c).trim(); });
    const lines = String(text || '').split(/\r?\n|;/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
    if (!lines.length) throw err('Model masih kosong. Tulis minimal satu persamaan, mis. "Kepuasan =~ x1 + x2 + x3".');
    const parsed = [];
    lines.forEach((ln, i) => {
      const m = /^(.*?)(=~|<~|~~|~)(.*)$/.exec(ln);
      if (!m) throw err('Baris ' + (i + 1) + ' ("' + ln + '") tidak memuat operator. Gunakan =~ (konstruk), ~ (regresi), atau ~~ (kovarians).');
      const lhs = m[1].trim(), op = m[2], rhs = m[3].split('+').map((s) => s.trim());
      if (!lhs) throw err('Baris ' + (i + 1) + ': bagian kiri operator ' + op + ' kosong.');
      if (rhs.some((s) => !s)) throw err('Baris ' + (i + 1) + ': ada suku kosong di sisi kanan "' + op + '" (periksa tanda +).');
      if ([lhs].concat(rhs).some((s) => /[*()]/.test(s))) throw err('Baris ' + (i + 1) + ': tanda * atau tanda kurung (label, pembatasan, nilai tetap) belum didukung.');
      parsed.push({ line: i + 1, lhs, op, rhs });
    });
    const latents = [], latIdx = {};
    parsed.filter((r) => r.op === '=~' || r.op === '<~').forEach((r) => {
      const key = r.lhs.toLowerCase();
      if (key in colMap) throw err('"' + r.lhs + '" adalah nama kolom data; beri nama lain untuk konstruk laten.');
      const mode = r.op === '=~' ? 'A' : 'B';
      let L = latIdx[key];
      if (!L) { L = { name: r.lhs, ind: [], mode }; latIdx[key] = L; latents.push(L); } else if (L.mode !== mode) throw err('Konstruk "' + r.lhs + '" didefinisikan reflektif (=~) sekaligus formatif (<~).');
      r.rhs.forEach((s) => {
        const c = colMap[s.toLowerCase()];
        if (!c) throw err('Indikator "' + s + '" (konstruk ' + r.lhs + ') tidak ada di kolom data. Kolom tersedia: ' + cols.join(', ') + '.');
        if (L.ind.indexOf(c) >= 0) throw err('Indikator "' + c + '" terdaftar dua kali pada konstruk ' + r.lhs + '.');
        L.ind.push(c);
      });
    });
    const seen = {}; latents.forEach((L) => L.ind.forEach((c) => { if (seen[c] && seen[c] !== L.name) throw err('Indikator "' + c + '" dipakai oleh dua konstruk (' + seen[c] + ' dan ' + L.name + '). Satu indikator hanya boleh mengukur satu konstruk.'); seen[c] = L.name; }));
    const resolve = (s, line) => { const k = s.toLowerCase(); if (k in latIdx) return { name: latIdx[k].name, latent: true }; if (k in colMap) return { name: colMap[k], latent: false }; throw err('Baris ' + line + ': variabel "' + s + '" bukan konstruk laten (=~) maupun kolom data.'); };
    const regs = [], covs = [], observed = new Set(); latents.forEach((L) => L.ind.forEach((c) => observed.add(c)));
    parsed.filter((r) => r.op === '~').forEach((r) => {
      const to = resolve(r.lhs, r.line); if (!to.latent) observed.add(to.name);
      let R = regs.find((x) => x.to === to.name); if (!R) { R = { to: to.name, from: [] }; regs.push(R); }
      r.rhs.forEach((s) => { const f = resolve(s, r.line); if (f.name === to.name) throw err('Baris ' + r.line + ': variabel "' + f.name + '" tidak boleh memengaruhi dirinya sendiri.'); if (!f.latent) observed.add(f.name); if (R.from.indexOf(f.name) < 0) R.from.push(f.name); });
    });
    parsed.filter((r) => r.op === '~~').forEach((r) => {
      const a = resolve(r.lhs, r.line); if (!a.latent) observed.add(a.name);
      r.rhs.forEach((s) => { const b = resolve(s, r.line); if (!b.latent) observed.add(b.name); if (a.name !== b.name && !covs.some((c) => (c[0] === a.name && c[1] === b.name) || (c[0] === b.name && c[1] === a.name))) covs.push([a.name, b.name]); });
    });
    if (!latents.length && !regs.length) throw err('Model tidak memuat konstruk laten maupun regresi.');
    const order = cols.map((c) => String(c).trim()).filter((c) => observed.has(c));
    return { latents, regs, covs, observed: order };
  }

  /* ======================================== CB-SEM ======================================== */
  function fitCB(spec, X, opts) {
    opts = opts || {};
    const scale = opts.scale === 'std' ? 'std' : 'marker';
    if (spec.latents.some((l) => l.mode === 'B')) throw err('Konstruk formatif (<~) hanya didukung oleh PLS-SEM. Untuk CB-SEM gunakan =~ (reflektif).');
    const obs = spec.observed, p = obs.length, n = X.length;
    if (p < 3) throw err('CB-SEM membutuhkan minimal 3 variabel teramati.');
    if (n < p + 2) throw err('Pengamatan lengkap (' + n + ') terlalu sedikit untuk ' + p + ' variabel teramati.');
    const mean = obs.map((_, j) => sum(X.map((r) => r[j])) / n);
    const S = zeros(p, p); for (let a = 0; a < p; a++) for (let b = a; b < p; b++) { let s = 0; for (let i = 0; i < n; i++) s += (X[i][a] - mean[a]) * (X[i][b] - mean[b]); S[a][b] = S[b][a] = s / n; }
    for (let a = 0; a < p; a++) if (!(S[a][a] > 0)) throw err('Variabel "' + obs[a] + '" bernilai konstan; hapus dari model.');
    const Sc = cholInvLogdet(S); if (!Sc) throw err('Matriks kovarians data singular: ada variabel yang kombinasi linear sempurna dari variabel lain.');
    const sd = S.map((r, i) => Math.sqrt(r[i]));
    const lat = spec.latents.map((l) => l.name), m = lat.length, v = p + m, idx = {};
    obs.forEach((o, i) => { idx[o] = i; }); lat.forEach((l, i) => { idx[l] = p + i; });
    const names = obs.concat(lat);
    const P = [];   // parameter: {mat:'A'|'S', i, j, free, val, kind, lhs, rhs, t}
    const hasIn = new Array(v).fill(false), startA = {}, singles = new Set();
    spec.latents.forEach((L, li) => {
      const f = p + li, ii = L.ind.map((c) => idx[c]);
      if (ii.length < 1) throw err('Konstruk ' + L.name + ' tidak memiliki indikator.');
      if (ii.length === 1) { singles.add(ii[0]); P.push({ mat: 'A', i: ii[0], j: f, free: false, val: 1, kind: 'loading', lhs: L.name, rhs: L.ind[0] }); hasIn[ii[0]] = true; return; }
      const mk = ii[0];
      ii.forEach((o, k) => {
        hasIn[o] = true;
        if (k === 0 && scale === 'marker') P.push({ mat: 'A', i: o, j: f, free: false, val: 1, kind: 'loading', lhs: L.name, rhs: L.ind[k] });
        else {
          let st = scale === 'std' ? 0.7 * sd[o] : 0.8 * sd[o] / sd[mk];
          if (scale === 'marker') { let c = 0; for (let t = 0; t < n; t++) c += (X[t][o] - mean[o]) * (X[t][mk] - mean[mk]); if (c < 0) st = -st; }
          P.push({ mat: 'A', i: o, j: f, free: true, val: st, kind: 'loading', lhs: L.name, rhs: L.ind[k] });
        }
      });
    });
    spec.regs.forEach((R) => R.from.forEach((fr) => { hasIn[idx[R.to]] = true; P.push({ mat: 'A', i: idx[R.to], j: idx[fr], free: true, val: 0, kind: 'reg', lhs: R.to, rhs: fr }); }));
    const markerVar = (li) => { const L = spec.latents[li], mk = idx[L.ind[0]]; return 0.7 * S[mk][mk]; };
    const sKey = {};
    const addS = (i, j, free, val, kind) => { if (i > j) { const t = i; i = j; j = t; } const key = i + ',' + j; if (sKey[key]) return; sKey[key] = true; P.push({ mat: 'S', i, j, free, val, kind, lhs: names[i], rhs: names[j] }); };
    for (let a = 0; a < p; a++) {
      if (singles.has(a)) addS(a, a, false, 0, 'var');
      else addS(a, a, true, hasIn[a] ? 0.4 * S[a][a] : S[a][a], 'var');
    }
    for (let li = 0; li < m; li++) {
      const f = p + li;
      if (scale === 'std') addS(f, f, false, 1, 'var');
      else addS(f, f, true, hasIn[f] ? 0.5 * markerVar(li) : markerVar(li), 'var');
    }
    const exoObs = [], exoLat = [];
    for (let a = 0; a < p; a++) if (!hasIn[a]) exoObs.push(a);
    for (let li = 0; li < m; li++) if (!hasIn[p + li]) exoLat.push(p + li);
    for (let x = 0; x < exoObs.length; x++) for (let y = x + 1; y < exoObs.length; y++) addS(exoObs[x], exoObs[y], true, S[exoObs[x]][exoObs[y]], 'cov');
    for (let x = 0; x < exoLat.length; x++) for (let y = x + 1; y < exoLat.length; y++) addS(exoLat[x], exoLat[y], true, 0.2 * Math.sqrt(markerVar(exoLat[x] - p) * markerVar(exoLat[y] - p)), 'cov');
    spec.covs.forEach((c) => { const a = idx[c[0]], b = idx[c[1]]; const sm = a < p && b < p ? S[a][b] * 0.3 : 0; addS(a, b, true, sm, 'cov'); });
    const free = P.filter((q) => q.free); free.forEach((q, k) => { q.t = k; });
    const q = free.length, moments = p * (p + 1) / 2, df = moments - q;
    if (df < 0) throw err('Model tidak teridentifikasi: ' + q + ' parameter bebas melebihi ' + moments + ' elemen kovarians (db = ' + df + '). Sederhanakan model atau tambah indikator.');
    let theta = free.map((x) => x.val);

    function assemble(th) {
      const A = zeros(v, v), Sm = zeros(v, v);
      P.forEach((x) => { const val = x.free ? th[x.t] : x.val; if (x.mat === 'A') A[x.i][x.j] = val; else { Sm[x.i][x.j] = val; Sm[x.j][x.i] = val; } });
      const B = eye(v); for (let i = 0; i < v; i++) for (let j = 0; j < v; j++) B[i][j] -= A[i][j];
      const M = inv(B); if (!M) return null;
      const C = mm(mm(M, Sm), tp(M));
      const Sig = C.slice(0, p).map((r) => r.slice(0, p));
      const ci = cholInvLogdet(Sig); if (!ci) return null;
      let trSW = 0; for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) trSW += S[a][b] * ci.inv[b][a];
      const F = ci.logdet + trSW - Sc.logdet - p;
      return { A, Sm, M, C, Sig, Sinv: ci.inv, F, th };
    }
    function derivs(ev) {
      const { M, C } = ev;
      return free.map((x) => {
        const Sk = zeros(p, p), i = x.i, j = x.j;
        if (x.mat === 'A') { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) Sk[a][b] = M[a][i] * C[j][b] + C[a][j] * M[b][i]; }
        else if (i === j) { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) Sk[a][b] = M[a][i] * M[b][i]; }
        else { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) Sk[a][b] = M[a][i] * M[b][j] + M[a][j] * M[b][i]; }
        return Sk;
      });
    }
    function gradHess(ev) {
      const Sk = derivs(ev), Si = ev.Sinv;
      const R = zeros(p, p); for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) R[a][b] = ev.Sig[a][b] - S[a][b];
      const G = mm(mm(Si, R), Si), Pk = Sk.map((K) => mm(mm(Si, K), Si));
      const g = Sk.map((K) => { let s = 0; for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) s += G[a][b] * K[a][b]; return s; });
      const H = zeros(q, q);
      for (let a = 0; a < q; a++) for (let b = a; b < q; b++) { let s = 0; const Pa = Pk[a], Kb = Sk[b]; for (let x = 0; x < p; x++) for (let y = 0; y < p; y++) s += Pa[x][y] * Kb[x][y]; H[a][b] = s; H[b][a] = s; }
      return { g, H, Sk };
    }

    let ev = assemble(theta), tries = 0;
    while (!ev && tries < 8) { theta = theta.map((t, k) => (free[k].kind === 'var' ? t * 1.5 + 0.05 * S[0][0] : t * 0.5)); ev = assemble(theta); tries++; }
    if (!ev) throw err('Nilai awal menghasilkan matriks kovarians model yang tidak valid. Periksa spesifikasi model (mis. konstruk dengan 2 indikator tanpa kaitan lain).');
    let lam = 1e-3, iters = 0, converged = false;
    for (; iters < 400; iters++) {
      const { g, H } = gradHess(ev);
      const gmax = Math.max.apply(null, g.map(Math.abs).concat([0]));
      if (gmax < 1e-8) { converged = true; break; }
      let ok = false, step = 0;
      for (let tr = 0; tr < 30; tr++) {
        const Hd = H.map((r, i) => r.map((x, j) => (i === j ? x * (1 + lam) + 1e-10 : x)));
        const d = solve(Hd, g.map((x) => -x));
        if (d) {
          const th2 = theta.map((t, k) => t + d[k]), ev2 = assemble(th2);
          if (ev2 && ev2.F <= ev.F + 1e-13) { step = Math.max.apply(null, d.map(Math.abs)); const dF = ev.F - ev2.F; theta = th2; ev = ev2; lam = Math.max(lam / 4, 1e-10); ok = true; if (dF < 1e-15 && gmax < 1e-5) converged = true; break; }
        }
        lam = Math.min(lam * 5, 1e10);
      }
      if (!ok) { converged = gmax < 1e-5; break; }
      if (converged || step < 1e-13) { converged = true; break; }
    }
    if (!converged) { const gm = Math.max.apply(null, gradHess(ev).g.map(Math.abs)); converged = gm < 1e-5; }
    const gh = gradHess(ev), Hinv = inv(gh.H);
    const cov = Hinv ? Hinv.map((r) => r.map((x) => x * 2 / n)) : null;
    const seTh = cov ? free.map((_, k) => (cov[k][k] > 0 ? Math.sqrt(cov[k][k]) : NaN)) : free.map(() => NaN);

    /* ---------- solusi terstandar + delta method ---------- */
    function stdOf(e) {
      const sdv = e.C.map((r, i) => Math.sqrt(Math.max(r[i], 1e-300)));
      return P.map((x) => { const val = x.free ? e.th[x.t] : x.val; if (x.mat === 'A') return val * sdv[x.j] / sdv[x.i]; if (x.i === x.j) return val / (sdv[x.i] * sdv[x.i]); return val / (sdv[x.i] * sdv[x.j]); });
    }
    const stdVal = stdOf(ev);
    function numJac(fun) {   // Jacobian numerik (central) fun: theta -> vektor, terhadap theta bebas
      const base = fun(theta), J = base.map(() => new Array(q).fill(0));
      for (let k = 0; k < q; k++) {
        const h = 1e-6 * Math.max(1, Math.abs(theta[k])), t1 = theta.slice(), t2 = theta.slice(); t1[k] += h; t2[k] -= h;
        const f1 = fun(t1), f2 = fun(t2); for (let r = 0; r < base.length; r++) J[r][k] = (f1[r] - f2[r]) / (2 * h);
      }
      return { base, J };
    }
    function deltaSE(J) { return J.map((row) => { let s = 0; for (let a = 0; a < q; a++) for (let b = 0; b < q; b++) s += row[a] * cov[a][b] * row[b]; return s > 0 ? Math.sqrt(s) : NaN; }); }
    let stdSE = P.map(() => NaN);
    if (cov) { try { const nj = numJac((th) => { const e = assemble(th); return e ? stdOf(e) : P.map(() => NaN); }); stdSE = deltaSE(nj.J); } catch (e) { /* biarkan NaN */ } }

    const params = P.map((x, k) => {
      const est = x.free ? theta[x.t] : x.val, se = x.free ? seTh[x.t] : null, z = se ? est / se : null;
      const isResid = x.kind === 'var' && x.i < p ? hasIn[x.i] : (x.kind === 'var' && hasIn[x.i]);
      return { kind: x.kind, lhs: x.lhs, rhs: x.rhs, free: x.free, est, se, z, p: z === null || Number.isNaN(z) ? null : D.normTwoP(z), std: stdVal[k], stdSe: x.free ? stdSE[k] : null, resid: isResid, latent: x.i >= p, i: x.i, j: x.j, mat: x.mat };
    });

    /* ---------- ukuran kecocokan ---------- */
    const Fmin = Math.max(ev.F, 0), chi2 = n * Fmin;
    const out = { N: n, p, m, q, moments, df, scale, converged, iterations: iters, F: ev.F, chi2, S, Sigma: ev.Sig, obs, lat, names, params, warnings: [] };
    out.pChi2 = df > 0 ? D.chi2Sf(chi2, df) : null;
    const dBase = p * (p - 1) / 2; let ldDiag = 0; for (let a = 0; a < p; a++) ldDiag += Math.log(S[a][a]);
    const chiB = n * (ldDiag - Sc.logdet);
    out.chi2Base = chiB; out.dfBase = dBase;
    const fit = {};
    if (df > 0) {
      fit.cfi = 1 - Math.max(chi2 - df, 0) / Math.max(chi2 - df, chiB - dBase, 1e-300);
      fit.tli = dBase > 0 ? ((chiB / dBase) - (chi2 / df)) / ((chiB / dBase) - 1) : NaN;
      fit.nfi = (chiB - chi2) / chiB;
      fit.rmsea = Math.sqrt(Math.max(chi2 - df, 0) / (df * n));
      fit.rmseaLo = Math.sqrt(ncpFor(chi2, df, 0.95) / (df * n)); fit.rmseaHi = Math.sqrt(ncpFor(chi2, df, 0.05) / (df * n));
      fit.pClose = 1 - ncx2Cdf(chi2, df, n * df * 0.05 * 0.05);
      fit.chiRatio = chi2 / df;
    }
    // SRMR (lavaan/Bentler): residual terstandar sampel, termasuk diagonal
    let ss = 0, cnt = 0; const resid = []; for (let a = 0; a < p; a++) for (let b = 0; b <= a; b++) { const r = (S[a][b] - ev.Sig[a][b]) / (sd[a] * sd[b]); ss += r * r; cnt++; if (a !== b) resid.push({ a: obs[a], b: obs[b], r }); }
    fit.srmr = Math.sqrt(ss / cnt);
    resid.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)); out.topResid = resid.slice(0, 6);
    const SW = mm(ev.Sinv, S); let t1 = 0, t2 = 0; for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) { t1 += (SW[a][b] - (a === b ? 1 : 0)) * (SW[b][a] - (a === b ? 1 : 0)); t2 += SW[a][b] * SW[b][a]; }
    fit.gfi = 1 - t1 / t2; if (df > 0) fit.agfi = 1 - (p * (p + 1) / (2 * df)) * (1 - fit.gfi);
    const ll = -(n / 2) * (p * Math.log(2 * Math.PI) + ev.F + Sc.logdet + p);   // -(N/2)(p log2pi + log|Sigma| + tr(Sigma^-1 S))
    fit.logLik = ll; fit.aic = -2 * ll + 2 * (q + p); fit.bic = -2 * ll + Math.log(n) * (q + p);
    out.fit = fit;

    /* ---------- korelasi antar konstruk laten (implied) ---------- */
    out.latCor = lat.map((_, a) => lat.map((__, b) => ev.C[p + a][p + b] / Math.sqrt(ev.C[p + a][p + a] * ev.C[p + b][p + b])));
    /* ---------- R2 endogen ---------- */
    out.r2 = []; for (let a = 0; a < v; a++) if (hasIn[a] && !singles.has(a)) { const tot = ev.C[a][a], sp = P.find((x) => x.mat === 'S' && x.i === a && x.j === a); const res = sp.free ? theta[sp.t] : sp.val; out.r2.push({ name: names[a], latent: a >= p, r2: 1 - res / tot, indicator: a < p && spec.latents.some((L) => L.ind.indexOf(names[a]) >= 0) }); }

    /* ---------- efek langsung / tidak langsung / total ---------- */
    const regP = P.filter((x) => x.kind === 'reg');
    out.effects = [];
    if (regP.length) {
      const bool = zeros(v, v); regP.forEach((x) => { bool[x.i][x.j] = 1; });
      let T = bool.map((r) => r.slice()); for (let it = 0; it < v; it++) { const T2 = mm(T, bool); let ch = false; for (let a = 0; a < v; a++) for (let b = 0; b < v; b++) if (T2[a][b] > 0 && !T[a][b]) { T[a][b] = 1; ch = true; } if (!ch) break; }
      const pairs = []; for (let a = 0; a < v; a++) for (let b = 0; b < v; b++) { let two = false; for (let c = 0; c < v; c++) if (bool[a][c] && T[c][b]) { two = true; break; } if (two) pairs.push([a, b]); }
      if (pairs.length) {
        const eff = (th) => {
          const e = assemble(th); if (!e) return pairs.reduce((r) => r.concat([NaN, NaN]), []);
          const Bm = zeros(v, v); regP.forEach((x) => { Bm[x.i][x.j] = th[x.t]; });
          const Im = eye(v); for (let a = 0; a < v; a++) for (let b = 0; b < v; b++) Im[a][b] -= Bm[a][b];
          const Ti = inv(Im); if (!Ti) return pairs.reduce((r) => r.concat([NaN, NaN]), []);
          const res = []; pairs.forEach(([a, b]) => { const tot = Ti[a][b] - (a === b ? 1 : 0); res.push(tot - Bm[a][b], tot); }); return res;
        };
        const nj = numJac(eff), ses = cov ? deltaSE(nj.J) : nj.base.map(() => NaN), sdv = ev.C.map((r, i) => Math.sqrt(Math.max(r[i], 1e-300)));
        pairs.forEach(([a, b], k) => {
          const direct = regP.filter((x) => x.i === a && x.j === b).reduce((s, x) => s + theta[x.t], 0), ind = nj.base[2 * k], tot = nj.base[2 * k + 1], sI = ses[2 * k], sT = ses[2 * k + 1];
          out.effects.push({ from: names[b], to: names[a], direct, indirect: ind, total: tot, seInd: sI, zInd: sI ? ind / sI : null, pInd: sI ? D.normTwoP(ind / sI) : null, seTot: sT, zTot: sT ? tot / sT : null, pTot: sT ? D.normTwoP(tot / sT) : null, stdInd: ind * sdv[b] / sdv[a], stdTot: tot * sdv[b] / sdv[a] });
        });
      }
    }

    /* ---------- peringatan ---------- */
    if (!converged) out.warnings.push('Optimasi belum konvergen penuh setelah ' + iters + ' iterasi; hasil perlu ditafsirkan hati-hati.');
    if (!cov) out.warnings.push('Matriks informasi singular: model kemungkinan tidak teridentifikasi secara empiris, galat baku tidak dapat dihitung.');
    params.filter((x) => x.kind === 'var' && x.free && x.est < 0).forEach((x) => out.warnings.push('Kasus Heywood: varians "' + x.lhs + '" bernilai negatif (' + x.est.toFixed(4) + ').'));
    params.filter((x) => x.kind === 'cov' && x.free && Number.isFinite(x.std) && Math.abs(x.std) > 1.0001).forEach((x) => out.warnings.push('Korelasi ' + x.lhs + ' dan ' + x.rhs + ' terstandar melebihi 1 (' + x.std.toFixed(3) + '): kemungkinan multikolinearitas atau konstruk tidak terbedakan.'));
    params.filter((x) => x.kind === 'loading' && x.free && Number.isFinite(x.std) && Math.abs(x.std) > 1.0001).forEach((x) => out.warnings.push('Loading terstandar ' + x.rhs + ' pada ' + x.lhs + ' melebihi 1 (' + x.std.toFixed(3) + ').'));
    out._internal = { assemble, theta, free, P };
    return out;
  }

  /* ======================================== PLS-SEM ======================================== */
  function rngSeed(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function colStd(c) {   // pusat + sd sampel (n-1); kembalikan Float64Array terstandar, atau null bila konstan
    const n = c.length; let mu = 0; for (let i = 0; i < n; i++) mu += c[i]; mu /= n; let ss = 0; for (let i = 0; i < n; i++) ss += (c[i] - mu) * (c[i] - mu);
    const sdv = Math.sqrt(ss / (n - 1)); if (!(sdv > 0)) return null;
    const z = new Float64Array(n); for (let i = 0; i < n; i++) z[i] = (c[i] - mu) / sdv; return z;
  }
  const dotc = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s / (a.length - 1); };

  function plsStructure(spec) {
    const cons = spec.latents.map((L) => ({ name: L.name, mode: L.mode, ind: L.ind.slice(), single: false, observed: false }));
    const cnames = cons.map((c) => c.name), obsAsCon = {};
    const need = (nm) => { if (cnames.indexOf(nm) >= 0) return; cons.push({ name: nm, mode: 'A', ind: [nm], single: true, observed: true }); cnames.push(nm); obsAsCon[nm] = true; };
    spec.regs.forEach((R) => { need(R.to); R.from.forEach(need); });
    cons.forEach((c) => { if (c.ind.length === 1) c.single = true; });
    const m = cons.length, idx = {}; cnames.forEach((c, i) => { idx[c] = i; });
    const pred = cons.map(() => []), succ = cons.map(() => []);
    spec.regs.forEach((R) => R.from.forEach((f) => { pred[idx[R.to]].push(idx[f]); succ[idx[f]].push(idx[R.to]); }));
    const indeg = pred.map((x) => x.length), queue = [], topo = []; indeg.forEach((d, i) => { if (!d) queue.push(i); });
    while (queue.length) { const u = queue.shift(); topo.push(u); succ[u].forEach((w) => { if (--indeg[w] === 0) queue.push(w); }); }
    if (topo.length < m) throw err('PLS-SEM hanya mendukung model rekursif: ada lingkaran umpan balik antar konstruk.');
    cons.forEach((c, j) => { if (!pred[j].length && !succ[j].length) throw err('Konstruk "' + c.name + '" tidak terhubung ke konstruk lain lewat jalur struktural (~).'); });
    return { cons, pred, succ, idx, m, topo };
  }

  function plsCore(Zd, cons, pred, succ, opts, w0) {
    const n = Zd[0].length, m = cons.length, scheme = opts.scheme || 'path', maxIter = opts.maxIter || 300, tol = opts.tol || 1e-9;
    const W = cons.map((c, j) => (w0 ? w0[j].slice() : c.cols.map(() => 1)));
    const Y = cons.map(() => new Float64Array(n)), Rb = cons.map((c) => (c.mode === 'B' && c.cols.length > 1 ? c.cols.map((a) => c.cols.map((b) => dotc(Zd[a], Zd[b]))) : null));
    function score(j) {
      const y = Y[j], c = cons[j]; y.fill(0);
      c.cols.forEach((col, h) => { const z = Zd[col], w = W[j][h]; for (let i = 0; i < n; i++) y[i] += w * z[i]; });
      let ss = 0; for (let i = 0; i < n; i++) ss += y[i] * y[i]; const sdv = Math.sqrt(ss / (n - 1));
      if (sdv > 0) { for (let i = 0; i < n; i++) y[i] /= sdv; W[j] = W[j].map((w) => w / sdv); }
      return sdv > 0;
    }
    for (let j = 0; j < m; j++) if (!score(j)) return null;
    let iters = 0, conv = false;
    for (; iters < maxIter; iters++) {
      const R = Y.map((a) => Y.map((b) => dotc(a, b)));
      const Zin = cons.map((c, j) => {
        const z = new Float64Array(n), nb = pred[j].concat(succ[j]);
        let beta = null; if (scheme === 'path' && pred[j].length) { const Rpp = pred[j].map((a) => pred[j].map((b) => R[a][b])), rp = pred[j].map((a) => R[a][j]); beta = solve(Rpp, rp); }
        nb.forEach((k) => {
          let e; const isPred = pred[j].indexOf(k) >= 0;
          if (scheme === 'centroid') e = Math.sign(R[j][k]); else if (scheme === 'factorial') e = R[j][k]; else e = isPred ? (beta ? beta[pred[j].indexOf(k)] : R[j][k]) : R[j][k];
          const yk = Y[k]; for (let i = 0; i < n; i++) z[i] += e * yk[i];
        });
        let ss = 0; for (let i = 0; i < n; i++) ss += z[i] * z[i]; const sdv = Math.sqrt(ss / (n - 1)); if (sdv > 0) for (let i = 0; i < n; i++) z[i] /= sdv; else z.set(Y[j]);
        return z;
      });
      let delta = 0;
      for (let j = 0; j < m; j++) {
        const c = cons[j]; if (c.cols.length === 1) continue;
        let wn;
        if (c.mode === 'B') { const r = c.cols.map((col) => dotc(Zd[col], Zin[j])); wn = solve(Rb[j], r); if (!wn) wn = r; } else wn = c.cols.map((col) => dotc(Zd[col], Zin[j]));
        const old = W[j]; W[j] = wn; if (!score(j)) return null;
        for (let h = 0; h < wn.length; h++) delta = Math.max(delta, Math.abs(W[j][h] - old[h]));
      }
      if (delta < tol) { conv = true; iters++; break; }
    }
    return { W, Y, iters, converged: conv };
  }
  function plsPaths(Y, pred, n) {   // koefisien jalur (OLS pada skor baku), R2, VIF
    const m = Y.length, R = Y.map((a) => Y.map((b) => dotc(a, b))), B = zeros(m, m), r2 = new Array(m).fill(null), vif = zeros(m, m);
    for (let j = 0; j < m; j++) {
      const pr = pred[j]; if (!pr.length) continue;
      const Rpp = pr.map((a) => pr.map((b) => R[a][b])), rp = pr.map((a) => R[a][j]), Ri = inv(Rpp); if (!Ri) return null;
      const beta = Ri.map((row) => sum(row.map((x, k) => x * rp[k])));
      pr.forEach((a, k) => { B[j][a] = beta[k]; vif[j][a] = Ri[k][k]; });
      r2[j] = sum(beta.map((b, k) => b * rp[k]));
    }
    return { R, B, r2, vif };
  }
  function effectsFromB(B) {
    const m = B.length, Im = eye(m); for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) Im[a][b] -= B[a][b];
    const Ti = inv(Im); if (!Ti) return null;
    const total = zeros(m, m), ind = zeros(m, m); for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) { total[a][b] = Ti[a][b] - (a === b ? 1 : 0); ind[a][b] = total[a][b] - B[a][b]; }
    return { total, ind };
  }

  function fitPLS(spec, dataset, opts) {
    opts = opts || {};
    const st = plsStructure(spec), { cons, pred, succ, m } = st;
    const names = dataset.names, X = dataset.X, n = X.length;
    if (n < 10) throw err('PLS-SEM membutuhkan minimal 10 pengamatan lengkap (sekarang ' + n + ').');
    const colIdx = {}; names.forEach((c, i) => { colIdx[c] = i; });
    const raw = []; const colOf = {};
    cons.forEach((c) => { c.cols = c.ind.map((nm) => { if (!(nm in colOf)) { colOf[nm] = raw.length; raw.push(Float64Array.from(X.map((r) => r[colIdx[nm]]))); } return colOf[nm]; }); });
    const Zd = raw.map((c, i) => { const z = colStd(c); if (!z) throw err('Indikator "' + Object.keys(colOf).find((k) => colOf[k] === i) + '" bernilai konstan.'); return z; });
    const core = plsCore(Zd, cons, pred, succ, opts); if (!core) throw err('Algoritma PLS gagal: skor konstruk bernilai konstan.');
    const pa = plsPaths(core.Y, pred, n); if (!pa) throw err('Multikolinearitas sempurna antar konstruk prediktor; periksa model struktural.');
    const eff = effectsFromB(pa.B);
    const res = { n, m, scheme: opts.scheme || 'path', iterations: core.iters, converged: core.converged, constructs: [], paths: [], effects: [], r2: [], warnings: [] };
    // ---- model pengukuran ----
    cons.forEach((c, j) => {
      const w = core.W[j], l = c.cols.map((col) => dotc(Zd[col], core.Y[j])), k = c.cols.length;
      const o = { name: c.name, mode: c.mode, ind: c.ind.slice(), single: c.single, weights: w.slice(), loadings: l, observed: c.observed };
      o.ave = sum(l.map((x) => x * x)) / k;
      if (k > 1) {
        const sl = sum(l); o.rhoC = sl * sl / (sl * sl + sum(l.map((x) => 1 - x * x)));
        const rc = c.cols.map((a) => raw[a]); const cv = rc.map((a) => rc.map((b) => { let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let s = 0; for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb); return s / (n - 1); }));
        const tv = sum(cv.map((r) => sum(r))); o.alpha = k / (k - 1) * (1 - sum(cv.map((r, i) => r[i])) / tv);
        const Sb = c.cols.map((a) => c.cols.map((b) => dotc(Zd[a], Zd[b]))); let num = 0, ww = 0;
        for (let a = 0; a < k; a++) { ww += w[a] * w[a]; for (let b = 0; b < k; b++) if (a !== b) num += w[a] * Sb[a][b] * w[b]; }
        let dd = 0; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) if (a !== b) dd += w[a] * w[b] * w[a] * w[b]; o.rhoA = ww * ww * num / (dd === 0 ? NaN : dd);
        if (c.mode === 'B') { const Ri = inv(Sb); o.vifOuter = Ri ? Ri.map((r, i) => r[i]) : null; }
      } else { o.rhoC = 1; o.alpha = 1; o.rhoA = 1; }
      res.constructs.push(o);
    });
    // ---- model struktural ----
    res.R = pa.R; res.conNames = cons.map((c) => c.name);
    cons.forEach((c, j) => { if (pred[j].length) {
      const r2 = pa.r2[j], kk = pred[j].length; res.r2.push({ name: c.name, r2, adj: 1 - (1 - r2) * (n - 1) / (n - kk - 1) });
      pred[j].forEach((a) => {
        const rest = pred[j].filter((x) => x !== a); let r2ex = 0; if (rest.length) { const Rpp = rest.map((x) => rest.map((y) => pa.R[x][y])), rp = rest.map((x) => pa.R[x][j]), Ri = inv(Rpp); if (Ri) { const be = Ri.map((row) => sum(row.map((x, k) => x * rp[k]))); r2ex = sum(be.map((b, k) => b * rp[k])); } }
        res.paths.push({ from: cons[a].name, to: c.name, fi: a, ti: j, beta: pa.B[j][a], f2: (r2 - r2ex) / (1 - r2), vif: kk > 1 ? pa.vif[j][a] : 1, r2ex });
      });
    } });
    // efek
    for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) if (eff && Math.abs(eff.ind[a][b]) > 1e-12) res.effects.push({ from: cons[b].name, to: cons[a].name, fi: b, ti: a, direct: pa.B[a][b], indirect: eff.ind[a][b], total: eff.total[a][b] });
    // validitas diskriminan
    res.fl = cons.map((c, a) => cons.map((d, b) => (a === b ? Math.sqrt(res.constructs[a].ave) : pa.R[a][b])));
    const pr = (a, b) => dotc(Zd[a], Zd[b]);
    res.htmt = cons.map((ca, a) => cons.map((cb, b) => {
      if (a === b) return null; if (ca.cols.length < 2 || cb.cols.length < 2) return NaN;
      let hs = 0, hc = 0; ca.cols.forEach((x) => cb.cols.forEach((y) => { hs += Math.abs(pr(x, y)); hc++; }));
      const mono = (c) => { let s = 0, k = 0; for (let x = 0; x < c.cols.length; x++) for (let y = x + 1; y < c.cols.length; y++) { s += Math.abs(pr(c.cols[x], c.cols[y])); k++; } return s / k; };
      return (hs / hc) / Math.sqrt(mono(ca) * mono(cb));
    }));
    const flatCols = []; cons.forEach((c) => c.cols.forEach((col, h) => flatCols.push({ ind: c.ind[h], col, con: c.name })));
    res.cross = flatCols.map((f) => ({ ind: f.ind, con: f.con, r: core.Y.map((y) => dotc(Zd[f.col], y)) }));
    if (!core.converged) res.warnings.push('Algoritma PLS belum konvergen dalam ' + core.iters + ' iterasi.');
    // skor konstruk (untuk ekspor)
    res.scores = Array.from({ length: Math.min(n, 12) }, (_, i) => core.Y.map((y) => y[i]));

    /* ---------- bootstrap ---------- */
    const B = opts.boot | 0;
    if (B > 0) {
      const flatKeys = [], flatOrig = [];
      const push = (k, v) => { flatKeys.push(k); flatOrig.push(v); };
      cons.forEach((c, j) => c.ind.forEach((ind, h) => { push('L|' + c.name + '|' + ind, res.constructs[j].loadings[h]); push('W|' + c.name + '|' + ind, res.constructs[j].weights[h]); }));
      res.paths.forEach((x) => push('P|' + x.from + '|' + x.to, x.beta));
      res.r2.forEach((x) => push('R|' + x.name, x.r2));
      res.effects.forEach((x) => { push('I|' + x.from + '|' + x.to, x.indirect); push('T|' + x.from + '|' + x.to, x.total); });
      const keyIdx = {}; flatKeys.forEach((k, i) => { keyIdx[k] = i; });
      const rnd = rngSeed(opts.seed === undefined ? 12345 : opts.seed), draws = flatKeys.map(() => []);
      let okB = 0, failB = 0;
      for (let b = 0; b < B; b++) {
        const ids = new Array(n); for (let i = 0; i < n; i++) ids[i] = Math.floor(rnd() * n);
        let bad = false; const Zb = raw.map((c) => { const rs = Float64Array.from(ids, (i) => c[i]); const z = colStd(rs); if (!z) bad = true; return z; });
        if (bad) { failB++; continue; }
        const cb = plsCore(Zb, cons, pred, succ, { scheme: opts.scheme, maxIter: 150, tol: 1e-7 }, core.W); if (!cb) { failB++; continue; }
        // orientasi tanda: samakan dengan bobot asli
        for (let j = 0; j < m; j++) { let d = 0; cb.W[j].forEach((w, h) => { d += w * core.W[j][h]; }); if (d < 0) { cb.W[j] = cb.W[j].map((w) => -w); const y = cb.Y[j]; for (let i = 0; i < n; i++) y[i] = -y[i]; } }
        const pb = plsPaths(cb.Y, pred, n); if (!pb) { failB++; continue; }
        const eb = effectsFromB(pb.B); if (!eb) { failB++; continue; }
        const vals = new Array(flatKeys.length);
        cons.forEach((c, j) => c.ind.forEach((ind, h) => { vals[keyIdx['L|' + c.name + '|' + ind]] = dotc(Zb[c.cols[h]], cb.Y[j]); vals[keyIdx['W|' + c.name + '|' + ind]] = cb.W[j][h]; }));
        res.paths.forEach((x) => { vals[keyIdx['P|' + x.from + '|' + x.to]] = pb.B[x.ti][x.fi]; });
        res.r2.forEach((x) => { vals[keyIdx['R|' + x.name]] = pb.r2[res.conNames.indexOf(x.name)]; });
        res.effects.forEach((x) => { vals[keyIdx['I|' + x.from + '|' + x.to]] = eb.ind[x.ti][x.fi]; vals[keyIdx['T|' + x.from + '|' + x.to]] = eb.total[x.ti][x.fi]; });
        vals.forEach((v, i) => draws[i].push(v)); okB++;
      }
      const stat = (k) => {
        const i = keyIdx[k], d = draws[i].slice().sort((a, c) => a - c), nb = d.length;
        if (nb < 20) return null;
        const mu = sum(d) / nb, sdv = Math.sqrt(sum(d.map((x) => (x - mu) * (x - mu))) / (nb - 1)), est = flatOrig[i], t = sdv > 0 ? est / sdv : null;
        const q = (pp) => { const pos = pp * (nb - 1), lo = Math.floor(pos), hi = Math.ceil(pos); return d[lo] + (d[hi] - d[lo]) * (pos - lo); };
        return { est, mean: mu, se: sdv, t, p: t === null ? null : D.tTwoP(Math.abs(t), n - 1), lo: q(0.025), hi: q(0.975) };
      };
      res.boot = { B, ok: okB, failed: failB, seed: opts.seed === undefined ? 12345 : opts.seed, stat };
      res.constructs.forEach((c) => { c.bootL = c.ind.map((ind) => stat('L|' + c.name + '|' + ind)); c.bootW = c.ind.map((ind) => stat('W|' + c.name + '|' + ind)); });
      res.paths.forEach((x) => { x.boot = stat('P|' + x.from + '|' + x.to); });
      res.r2.forEach((x) => { x.boot = stat('R|' + x.name); });
      res.effects.forEach((x) => { x.bootInd = stat('I|' + x.from + '|' + x.to); x.bootTot = stat('T|' + x.from + '|' + x.to); });
      if (failB > B * 0.05) res.warnings.push(failB + ' dari ' + B + ' sampel bootstrap dilewati (kolom konstan atau matriks singular pada sampel itu).');
    }
    return res;
  }

  window.StatSEM = { parseModel, fitCB, fitPLS, ncx2Cdf, ncpFor, _inv: inv, _chol: chol };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatSEM;
})();
