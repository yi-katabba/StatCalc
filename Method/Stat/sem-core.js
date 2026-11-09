/* =========================================================================
   SEM-CORE - inti hitungan Structural Equation Modeling (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   Sintaks model (mirip lavaan), satu baris satu persamaan:
     Kepuasan =~ x1 + x2 + x3        konstruk laten reflektif (indikator = kolom data)
     Kualitas <~ q1 + q2             konstruk formatif (hanya PLS-SEM)
     Loyalitas ~ Kepuasan + Harga    regresi / jalur struktural (laten atau variabel teramati)
     x1 ~~ x2                        kovarians (galat) antar dua variabel
     Y ~ a*X1 + b*X2                 label parameter (label sama = parameter sama / kesamaan); angka*var = nilai tetap
     F =~ x1 + l*x2 + l*x3, x ~~ v*x label & pembatasan juga pada loading, kovarians, varians; NA*x1 membebaskan penanda
     a == b  /  a == 0.5             pembatasan sederhana: dua label disamakan / label dikunci ke angka
     ab := a*b                       parameter terdefinisi (efek tak langsung, selisih, total); + - * / ^ ( ) sqrt exp log abs
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

  /* ---------------------------------- normalitas multivariat (Mardia) ----------------------------------
     S = kovarians dengan pembagi n (konvensi Mardia/MLE), d_ij = (x_i - xbar)' S^-1 (x_j - xbar).
     Skewness b1p = (1/n^2) sum_ij d_ij^3,  kurtosis b2p = (1/n) sum_i d_ii^2.
     Uji skewness: n*b1p/6 ~ chi2(p(p+1)(p+2)/6); koreksi sampel kecil (Mardia 1974): k = (p+1)(n+1)(n+3) / (n((n+1)(p+1) - 6)), statistik n*k*b1p/6.
     Uji kurtosis: z = (b2p - p(p+2)) / sqrt(8p(p+2)/n) ~ N(0,1). Juga skewness / kurtosis berlebih (excess) tiap variabel dan pencilan Mahalanobis (d_ii). */
  function mardia(X, names) {
    const n = X.length, p = n ? X[0].length : 0;
    if (p < 2) throw err('Uji Mardia membutuhkan minimal 2 variabel.');
    if (n < p + 2) throw err('Pengamatan (' + n + ') terlalu sedikit untuk uji Mardia dengan ' + p + ' variabel.');
    const mean = new Array(p).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) mean[j] += X[i][j] / n;
    const Z = X.map((r) => r.map((x, j) => x - mean[j]));
    const S = zeros(p, p); for (let a = 0; a < p; a++) for (let b = a; b < p; b++) { let s = 0; for (let i = 0; i < n; i++) s += Z[i][a] * Z[i][b]; S[a][b] = S[b][a] = s / n; }
    const ci = cholInvLogdet(S); if (!ci) throw err('Matriks kovarians data singular; uji Mardia tidak dapat dihitung.');
    const W = Z.map((z) => { const w = new Array(p).fill(0); for (let a = 0; a < p; a++) { let s = 0; for (let b = 0; b < p; b++) s += ci.inv[a][b] * z[b]; w[a] = s; } return w; });   // W_i = S^-1 z_i
    let b1 = 0, b2 = 0; const dist = new Array(n);
    for (let i = 0; i < n; i++) {
      const wi = W[i]; let dii = 0; for (let a = 0; a < p; a++) dii += wi[a] * Z[i][a]; dist[i] = dii; b2 += dii * dii;
      for (let j = 0; j < n; j++) { const zj = Z[j]; let d = 0; for (let a = 0; a < p; a++) d += wi[a] * zj[a]; b1 += d * d * d; }
    }
    b1 /= n * n; b2 /= n;
    const dfS = p * (p + 1) * (p + 2) / 6, k = (p + 1) * (n + 1) * (n + 3) / (n * ((n + 1) * (p + 1) - 6));
    const stat = n * b1 / 6, statSmall = n * k * b1 / 6, expK = p * (p + 2), zK = (b2 - expK) / Math.sqrt(8 * p * (p + 2) / n);
    const uni = []; for (let j = 0; j < p; j++) { let m2 = 0, m3 = 0, m4 = 0; for (let i = 0; i < n; i++) { const z = Z[i][j], z2 = z * z; m2 += z2; m3 += z2 * z; m4 += z2 * z2; } m2 /= n; m3 /= n; m4 /= n; uni.push({ name: names ? names[j] : 'x' + (j + 1), skew: m3 / Math.pow(m2, 1.5), kurt: m4 / (m2 * m2) - 3 }); }
    let maxD = 0, maxI = 0, nOut = 0; dist.forEach((d, i) => { if (d > maxD) { maxD = d; maxI = i; } if (D.chi2Sf(d, p) < 0.001) nOut++; });
    return { n, p, skew: { b1p: b1, stat, df: dfS, p: D.chi2Sf(stat, dfS), statSmall, pSmall: D.chi2Sf(statSmall, dfS), k }, kurt: { b2p: b2, expected: expK, excess: b2 - expK, relative: b2 / expK, z: zK, p: D.normTwoP(zK) }, uni, maxD, maxIdx: maxI, nOutlier: nOut };
  }

  /* Bahan sandwich untuk estimator robust (MLR) dan faktor skala Satorra-Bentler / Yuan-Bentler.
     Z = data terpusat (n x p), Sinv = Sigma^-1, S = kovarians sampel, Sks = turunan dSigma/dtheta_k (p x p).
       A  = Delta' V Delta = (1/2) tr(Sinv Sk Sinv Sl)                      (informasi ekspektasi per pengamatan)
       M  = Delta' V Gamma V Delta = kovarians sampel (pembagi n) dari skor kasus s_ik = (1/2) z_i' Sinv Sk Sinv z_i
       trVG = tr(V Gamma) = (1/2) [ mean_i (z_i' Sinv z_i)^2 - tr((Sinv S)^2) ]   dengan Gamma = kovarians sampel dari vech(z z')
     V = (1/2) D'(Sigma^-1 (x) Sigma^-1)D; semua bentuk di atas identik dengan perkalian matriks vech yang eksplisit.
     Cov robust(theta) = (1/n) A^-1 M A^-1;  tr(U Gamma) = trVG - tr(A^-1 M);  c = tr(U Gamma) / db;  chi2 terskala = chi2 / c. */
  function sandwichParts(Z, Sinv, S, Sks) {
    const n = Z.length, p = S.length, q = Sks.length;
    const Pk = Sks.map((K) => mm(mm(Sinv, K), Sinv));
    const A = zeros(q, q); for (let a = 0; a < q; a++) for (let b = a; b < q; b++) { let s = 0; const Pa = Pk[a], Kb = Sks[b]; for (let x = 0; x < p; x++) for (let y = 0; y < p; y++) s += Pa[x][y] * Kb[x][y]; A[a][b] = A[b][a] = s / 2; }
    const sc = Pk.map((P) => { const s = new Float64Array(n); for (let i = 0; i < n; i++) { const z = Z[i]; let t = 0; for (let x = 0; x < p; x++) { let r = 0; for (let y = 0; y < p; y++) r += P[x][y] * z[y]; t += z[x] * r; } s[i] = t / 2; } return s; });
    const mu = sc.map((s) => { let t = 0; for (let i = 0; i < n; i++) t += s[i]; return t / n; });
    const M = zeros(q, q); for (let a = 0; a < q; a++) for (let b = a; b < q; b++) { let t = 0; const sa = sc[a], sb = sc[b]; for (let i = 0; i < n; i++) t += (sa[i] - mu[a]) * (sb[i] - mu[b]); M[a][b] = M[b][a] = t / n; }
    let m2 = 0; for (let i = 0; i < n; i++) { const z = Z[i]; let d = 0; for (let x = 0; x < p; x++) { let r = 0; for (let y = 0; y < p; y++) r += Sinv[x][y] * z[y]; d += z[x] * r; } m2 += d * d; } m2 /= n;
    const SW = mm(Sinv, S); let trSq = 0; for (let x = 0; x < p; x++) for (let y = 0; y < p; y++) trSq += SW[x][y] * SW[y][x];
    return { A, M, trVG: (m2 - trSq) / 2 };
  }
  function scalingFactor(parts, df) {   // c = tr(U Gamma) / db;  null bila A singular
    const Ai = inv(parts.A); if (!Ai) return null;
    const AM = mm(Ai, parts.M); let tr = 0; for (let a = 0; a < AM.length; a++) tr += AM[a][a];
    return { Ai, trUG: parts.trVG - tr, c: (parts.trVG - tr) / df };
  }

  /* ======================================== PARSER MODEL ======================================== */
  /* ---- ekspresi parameter terdefinisi (:=): tokenizer + parser rekursif -> AST ---- */
  const IDENT = /^[A-Za-z_][A-Za-z0-9_.]*$/, NUM = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
  const FUNCS = { sqrt: Math.sqrt, exp: Math.exp, log: Math.log, abs: Math.abs };
  function parseExpr(src, line) {
    const toks = [], re = /\s*(?:(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|([A-Za-z_][A-Za-z0-9_.]*)|([-+*\/^(),]))/y; let pos = 0; const s0 = src.trim();
    while (pos < s0.length) {
      re.lastIndex = pos; const m = re.exec(s0);
      if (!m) throw err('Baris ' + line + ': karakter tidak dikenali pada ekspresi ":=" dekat "' + s0.slice(pos, pos + 8) + '".');
      toks.push(m[1] !== undefined ? { n: parseFloat(m[1]) } : m[2] !== undefined ? { id: m[2] } : { op: m[3] }); pos = re.lastIndex;
    }
    let k = 0; const peek = () => toks[k], isOp = (o) => toks[k] && toks[k].op === o;
    const bad = (why) => err('Baris ' + line + ': ekspresi ":=" tidak valid (' + why + '): ' + src.trim());
    function expr() { let a = term(); while (isOp('+') || isOp('-')) { const op = toks[k++].op; a = { op, a, b: term() }; } return a; }
    function term() { let a = unary(); while (isOp('*') || isOp('/')) { const op = toks[k++].op; a = { op, a, b: unary() }; } return a; }
    function unary() { if (isOp('-')) { k++; return { neg: unary() }; } if (isOp('+')) { k++; return unary(); } return power(); }
    function power() { const a = atom(); if (isOp('^')) { k++; return { op: '^', a, b: unary() }; } return a; }
    function atom() {
      const t = peek(); if (!t) throw bad('berakhir tiba-tiba');
      if (t.n !== undefined) { k++; return { n: t.n }; }
      if (t.id !== undefined) {
        k++;
        if (isOp('(')) { const f = t.id.toLowerCase(); if (!FUNCS[f]) throw bad('fungsi "' + t.id + '" tidak didukung; yang ada: sqrt, exp, log, abs'); k++; const a = expr(); if (!isOp(')')) throw bad('tanda kurung tidak ditutup'); k++; return { fn: f, a }; }
        return { v: t.id };
      }
      if (t.op === '(') { k++; const a = expr(); if (!isOp(')')) throw bad('tanda kurung tidak ditutup'); k++; return a; }
      throw bad('tak terduga "' + t.op + '"');
    }
    const ast = expr(); if (k < toks.length) throw bad('sisa "' + (toks[k].op || toks[k].id || toks[k].n) + '" tak terduga');
    return ast;
  }
  function evalAst(a, get) {
    if (a.n !== undefined) return a.n; if (a.v !== undefined) return get(a.v); if (a.neg !== undefined) return -evalAst(a.neg, get);
    if (a.fn !== undefined) return FUNCS[a.fn](evalAst(a.a, get));
    const x = evalAst(a.a, get), y = evalAst(a.b, get);
    switch (a.op) { case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return x / y; default: return Math.pow(x, y); }
  }
  function astRefs(a, out) { if (a.v !== undefined) out.push(a.v); else if (a.neg !== undefined) astRefs(a.neg, out); else if (a.fn !== undefined) astRefs(a.a, out); else if (a.op !== undefined) { astRefs(a.a, out); astRefs(a.b, out); } return out; }

  function parseModel(text, cols) {
    const colMap = {}; cols.forEach((c) => { const k = String(c).trim().toLowerCase(); if (k && !(k in colMap)) colMap[k] = String(c).trim(); });
    const lines = String(text || '').split(/\r?\n|;/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
    if (!lines.length) throw err('Model masih kosong. Tulis minimal satu persamaan, mis. "Kepuasan =~ x1 + x2 + x3".');
    const parsed = [], defsRaw = [], eqRaw = [], allMods = [];
    /* suku "pengubah*nama": pengubah = label (huruf/angka/_), angka (nilai tetap), atau NA (bebaskan loading yang biasanya dikunci) */
    const termOf = (term, ln, op) => {
      if (/[()]/.test(term)) throw err('Baris ' + ln + ': tanda kurung hanya boleh pada ekspresi ":=" (suku "' + term + '").');
      const parts = term.split('*');
      if (parts.length > 2) throw err('Baris ' + ln + ': suku "' + term + '" memuat lebih dari satu tanda *; hanya satu pengubah (label atau nilai) per suku.');
      if (parts.length === 1) return { name: term.trim(), mod: null };
      const mt = parts[0].trim(), name = parts[1].trim();
      if (!mt || !name) throw err('Baris ' + ln + ': suku "' + term + '" tidak lengkap (bentuk yang benar: pengubah*variabel).');
      if (op === '<~') throw err('Baris ' + ln + ': label dan nilai tetap tidak didukung untuk konstruk formatif (<~).');
      let mod;
      if (/^NA$/i.test(mt)) { if (op !== '=~') throw err('Baris ' + ln + ': NA* hanya berlaku untuk loading (=~).'); mod = { na: true }; }
      else if (NUM.test(mt)) mod = { fixed: parseFloat(mt) };
      else if (IDENT.test(mt)) mod = { label: mt };
      else throw err('Baris ' + ln + ': pengubah "' + mt + '" bukan label (huruf/angka/_ , tidak diawali angka), angka, maupun NA.');
      allMods.push(mod); return { name, mod };
    };
    lines.forEach((ln, i) => {
      const L = i + 1; let m = /^(.*?):=(.*)$/.exec(ln);
      if (m) { defsRaw.push({ line: L, name: m[1].trim(), expr: m[2].trim() }); return; }
      if (ln.indexOf('==') >= 0) { const sp = ln.split('=='); if (sp.length !== 2) throw err('Baris ' + L + ': pembatasan hanya boleh memuat satu tanda ==.'); eqRaw.push({ line: L, l: sp[0].trim(), r: sp[1].trim() }); return; }
      m = /^(.*?)(=~|<~|~~|~)(.*)$/.exec(ln);
      if (!m) throw err('Baris ' + L + ' ("' + ln + '") tidak memuat operator. Gunakan =~ (konstruk), ~ (regresi), ~~ (kovarians), := (parameter terdefinisi), atau == (pembatasan).');
      const lhs = m[1].trim(), op = m[2], rawR = m[3].split('+').map((s) => s.trim());
      if (!lhs) throw err('Baris ' + L + ': bagian kiri operator ' + op + ' kosong.');
      if (rawR.some((s) => !s)) throw err('Baris ' + L + ': ada suku kosong di sisi kanan "' + op + '" (periksa tanda +).');
      if (/[*()]/.test(lhs)) throw err('Baris ' + L + ': sisi kiri operator tidak boleh memuat * atau tanda kurung; letakkan label/nilai pada suku di sisi kanan.');
      parsed.push({ line: L, lhs, op, rhs: rawR.map((s) => termOf(s, L, op)) });
    });
    const latents = [], latIdx = {};
    parsed.filter((r) => r.op === '=~' || r.op === '<~').forEach((r) => {
      const key = r.lhs.toLowerCase();
      if (key in colMap) throw err('"' + r.lhs + '" adalah nama kolom data; beri nama lain untuk konstruk laten.');
      const mode = r.op === '=~' ? 'A' : 'B';
      let L = latIdx[key];
      if (!L) { L = { name: r.lhs, ind: [], mode }; latIdx[key] = L; latents.push(L); } else if (L.mode !== mode) throw err('Konstruk "' + r.lhs + '" didefinisikan reflektif (=~) sekaligus formatif (<~).');
      r.rhs.forEach((t) => {
        const s = t.name, c = colMap[s.toLowerCase()];
        if (!c) throw err('Indikator "' + s + '" (konstruk ' + r.lhs + ') tidak ada di kolom data. Kolom tersedia: ' + cols.join(', ') + '.');
        if (L.ind.indexOf(c) >= 0) throw err('Indikator "' + c + '" terdaftar dua kali pada konstruk ' + r.lhs + '.');
        L.ind.push(c); if (t.mod) { L.mod = L.mod || {}; L.mod[c] = t.mod; }
      });
    });
    const seen = {}; latents.forEach((L) => L.ind.forEach((c) => { if (seen[c] && seen[c] !== L.name) throw err('Indikator "' + c + '" dipakai oleh dua konstruk (' + seen[c] + ' dan ' + L.name + '). Satu indikator hanya boleh mengukur satu konstruk.'); seen[c] = L.name; }));
    const resolve = (s, line) => { const k = s.toLowerCase(); if (k in latIdx) return { name: latIdx[k].name, latent: true }; if (k in colMap) return { name: colMap[k], latent: false }; throw err('Baris ' + line + ': variabel "' + s + '" bukan konstruk laten (=~) maupun kolom data.'); };
    const regs = [], covs = [], observed = new Set(), varMods = {}; latents.forEach((L) => L.ind.forEach((c) => observed.add(c)));
    parsed.filter((r) => r.op === '~').forEach((r) => {
      const to = resolve(r.lhs, r.line); if (!to.latent) observed.add(to.name);
      let R = regs.find((x) => x.to === to.name); if (!R) { R = { to: to.name, from: [] }; regs.push(R); }
      r.rhs.forEach((t) => {
        const f = resolve(t.name, r.line); if (f.name === to.name) throw err('Baris ' + r.line + ': variabel "' + f.name + '" tidak boleh memengaruhi dirinya sendiri.'); if (!f.latent) observed.add(f.name);
        if (R.from.indexOf(f.name) < 0) { R.from.push(f.name); if (t.mod) { R.mod = R.mod || {}; R.mod[f.name] = t.mod; } }
        else if (t.mod || (R.mod && R.mod[f.name])) throw err('Baris ' + r.line + ': jalur ' + f.name + ' → ' + to.name + ' ditulis dua kali; beri label/nilai hanya pada satu penyebutan.');
      });
    });
    parsed.filter((r) => r.op === '~~').forEach((r) => {
      const a = resolve(r.lhs, r.line); if (!a.latent) observed.add(a.name);
      r.rhs.forEach((t) => {
        const b = resolve(t.name, r.line); if (!b.latent) observed.add(b.name);
        if (a.name === b.name) { if (t.mod) varMods[a.name] = t.mod; return; }   // x ~~ v*x : label / nilai tetap pada varians
        if (!covs.some((c) => (c[0] === a.name && c[1] === b.name) || (c[0] === b.name && c[1] === a.name))) { const c = [a.name, b.name]; if (t.mod) c.mod = t.mod; covs.push(c); }
        else if (t.mod) throw err('Baris ' + r.line + ': kovarians ' + a.name + ' ~~ ' + b.name + ' ditulis dua kali; beri label/nilai hanya pada satu penyebutan.');
      });
    });
    if (!latents.length && !regs.length) throw err('Model tidak memuat konstruk laten maupun regresi.');

    /* ---- label, pembatasan (==), parameter terdefinisi (:=) ---- */
    const labels = new Set(); allMods.forEach((m) => { if (m.label) labels.add(m.label); });
    const alias = {}, find = (x) => { while (alias[x] !== undefined) x = alias[x]; return x; }, fixes = [];
    eqRaw.forEach((e) => {
      if (!e.l || !e.r) throw err('Baris ' + e.line + ': pembatasan == memerlukan dua sisi.');
      const lN = NUM.test(e.l), rN = NUM.test(e.r), lI = IDENT.test(e.l), rI = IDENT.test(e.r);
      if (!((lI || lN) && (rI || rN)) || (lN && rN)) throw err('Baris ' + e.line + ': pembatasan == hanya mendukung bentuk "label == label" atau "label == angka" (bukan ekspresi lain).');
      [lI ? e.l : null, rI ? e.r : null].forEach((x) => { if (x && !labels.has(x)) throw err('Baris ' + e.line + ': label "' + x + '" tidak dipakai pada persamaan model mana pun (tulis label*variabel di persamaan).'); });
      if (lI && rI) { const a = find(e.l), b = find(e.r); if (a !== b) alias[b] = a; } else fixes.push({ label: lI ? e.l : e.r, val: parseFloat(lI ? e.r : e.l), line: e.line });
    });
    const labelFix = {};
    fixes.forEach((f) => { const k = find(f.label); if (labelFix[k] !== undefined && labelFix[k] !== f.val) throw err('Baris ' + f.line + ': label "' + f.label + '" dikunci ke dua nilai berbeda (' + labelFix[k] + ' dan ' + f.val + ').'); labelFix[k] = f.val; });
    allMods.forEach((m) => { if (m.label) m.label = find(m.label); });
    const aliasOut = {}; labels.forEach((l) => { if (find(l) !== l) aliasOut[l] = find(l); });
    const defs = [], defNames = new Set();
    defsRaw.forEach((d) => {
      if (!IDENT.test(d.name)) throw err('Baris ' + d.line + ': nama parameter terdefinisi "' + d.name + '" tidak valid (huruf/angka/_ , tidak diawali angka).');
      if (labels.has(d.name) || defNames.has(d.name)) throw err('Baris ' + d.line + ': nama "' + d.name + '" sudah dipakai sebagai label atau parameter terdefinisi lain.');
      if (!d.expr) throw err('Baris ' + d.line + ': ekspresi di kanan ":=" kosong.');
      const ast = parseExpr(d.expr, d.line), refs = astRefs(ast, []);
      refs.forEach((rf) => { if (!labels.has(rf) && !defNames.has(rf)) throw err('Baris ' + d.line + ': "' + rf + '" bukan label parameter (tulis label*variabel di persamaan model) maupun parameter terdefinisi di baris sebelumnya.'); });
      defs.push({ name: d.name, expr: d.expr, ast, line: d.line, refs }); defNames.add(d.name);
    });
    const order = cols.map((c) => String(c).trim()).filter((c) => observed.has(c));
    return { latents, regs, covs, observed: order, varMods, labels: Array.from(labels), alias: aliasOut, labelFix, defs, hasMods: allMods.length > 0 || defs.length > 0 || eqRaw.length > 0 };
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
      if (ii.length === 1 && L.mod && L.mod[L.ind[0]]) throw err('Konstruk ' + L.name + ' hanya punya satu indikator: loading dikunci 1 sehingga tidak dapat diberi label atau nilai.');
      if (ii.length === 1) { singles.add(ii[0]); P.push({ mat: 'A', i: ii[0], j: f, free: false, val: 1, kind: 'loading', lhs: L.name, rhs: L.ind[0] }); hasIn[ii[0]] = true; return; }
      const mk = ii[0], md = L.mod || {}, userFix = L.ind.some((c) => md[c] && md[c].fixed !== undefined);   // nilai tetap dari pengguna menggantikan penanda otomatis
      ii.forEach((o, k) => {
        hasIn[o] = true; const m1 = md[L.ind[k]], lb = m1 && m1.label ? { label: m1.label } : {};
        if (m1 && m1.fixed !== undefined) P.push({ mat: 'A', i: o, j: f, free: false, val: m1.fixed, kind: 'loading', lhs: L.name, rhs: L.ind[k] });
        else if (k === 0 && scale === 'marker' && !userFix && !(m1 && m1.na)) P.push(Object.assign({ mat: 'A', i: o, j: f, free: false, val: 1, kind: 'loading', lhs: L.name, rhs: L.ind[k] }, lb));
        else {
          let st = scale === 'std' ? 0.7 * sd[o] : 0.8 * sd[o] / sd[mk];
          if (scale === 'marker') { let c = 0; for (let t = 0; t < n; t++) c += (X[t][o] - mean[o]) * (X[t][mk] - mean[mk]); if (c < 0) st = -st; }
          P.push(Object.assign({ mat: 'A', i: o, j: f, free: true, val: st, kind: 'loading', lhs: L.name, rhs: L.ind[k] }, lb));
        }
      });
    });
    spec.regs.forEach((R) => R.from.forEach((fr) => {
      hasIn[idx[R.to]] = true; const m1 = R.mod && R.mod[fr], e = { mat: 'A', i: idx[R.to], j: idx[fr], free: true, val: 0, kind: 'reg', lhs: R.to, rhs: fr };
      if (m1) { if (m1.fixed !== undefined) { e.free = false; e.val = m1.fixed; } else if (m1.label) e.label = m1.label; }
      P.push(e);
    }));
    const markerVar = (li) => { const L = spec.latents[li], mk = idx[L.ind[0]]; return 0.7 * S[mk][mk]; };
    const sKey = {};
    const addS = (i, j, free, val, kind, mod) => {
      if (i > j) { const t = i; i = j; j = t; } const key = i + ',' + j; if (sKey[key]) return; sKey[key] = true;
      const e = { mat: 'S', i, j, free, val, kind, lhs: names[i], rhs: names[j] };
      if (mod) { if (mod.fixed !== undefined) { e.free = false; e.val = mod.fixed; } else if (mod.label) e.label = mod.label; }
      P.push(e);
    };
    const vm = spec.varMods || {};
    spec.covs.forEach((c) => { if (!c.mod) return; const a = idx[c[0]], b = idx[c[1]]; addS(a, b, true, a < p && b < p ? S[a][b] * 0.3 : 0, 'cov', c.mod); });   // kovarians ber-pengubah lebih dulu agar menimpa bawaan
    for (let a = 0; a < p; a++) {
      if (singles.has(a)) addS(a, a, false, 0, 'var', vm[names[a]]);
      else addS(a, a, true, hasIn[a] ? 0.4 * S[a][a] : S[a][a], 'var', vm[names[a]]);
    }
    for (let li = 0; li < m; li++) {
      const f = p + li;
      if (scale === 'std') addS(f, f, false, 1, 'var', vm[names[f]]);
      else addS(f, f, true, hasIn[f] ? 0.5 * markerVar(li) : markerVar(li), 'var', vm[names[f]]);
    }
    const exoObs = [], exoLat = [];
    for (let a = 0; a < p; a++) if (!hasIn[a]) exoObs.push(a);
    for (let li = 0; li < m; li++) if (!hasIn[p + li]) exoLat.push(p + li);
    for (let x = 0; x < exoObs.length; x++) for (let y = x + 1; y < exoObs.length; y++) addS(exoObs[x], exoObs[y], true, S[exoObs[x]][exoObs[y]], 'cov');
    for (let x = 0; x < exoLat.length; x++) for (let y = x + 1; y < exoLat.length; y++) addS(exoLat[x], exoLat[y], true, 0.2 * Math.sqrt(markerVar(exoLat[x] - p) * markerVar(exoLat[y] - p)), 'cov');
    spec.covs.forEach((c) => { const a = idx[c[0]], b = idx[c[1]]; const sm = a < p && b < p ? S[a][b] * 0.3 : 0; addS(a, b, true, sm, 'cov'); });
    /* label: kunci ke angka (==) atau ikat parameter bebas berlabel sama menjadi SATU parameter (kesamaan). free = satu wakil per kelompok; members = semua anggota. */
    const lfix = spec.labelFix || {};
    P.forEach((x) => {
      if (!x.label) return;
      if (lfix[x.label] !== undefined) { x.free = false; x.val = lfix[x.label]; }
      else if (!x.free) throw err('Label "' + x.label + '" dipasang pada parameter yang nilainya dikunci (' + x.lhs + ' – ' + x.rhs + '), mis. indikator penanda = 1 (skala marker) atau varians laten = 1 (skala baku). Ganti skala, pindahkan label ke parameter bebas, atau kunci lewat "' + x.label + ' == angka".');
    });
    const nFreeRaw = P.filter((x) => x.free).length, free = [], gmap = {};
    P.forEach((x) => { if (!x.free) return; const g = x.label ? gmap[x.label] : null; if (g) { x.t = g.t; g.members.push(x); return; } x.t = free.length; x.members = [x]; free.push(x); if (x.label) gmap[x.label] = x; });
    const q = free.length, moments = p * (p + 1) / 2, df = moments - q;
    if (df < 0) throw err('Model tidak teridentifikasi: ' + q + ' parameter bebas melebihi ' + moments + ' elemen kovarians (db = ' + df + '). Sederhanakan model atau tambah indikator.');
    let theta = free.map((x) => x.val);
    if (opts.start) free.forEach((x, k) => { const sv = opts.start[x.mat + '|' + x.i + '|' + x.j]; if (sv !== undefined) theta[k] = sv; });   // warm start (bootstrap)

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
    function derivs(ev, list) {
      const { M, C } = ev;
      return (list || free).map((x0) => {
        const Sk = zeros(p, p);   // parameter terikat (label sama): turunan = jumlah turunan semua anggota
        (x0.members || [x0]).forEach((x) => {
          const i = x.i, j = x.j;
          if (x.mat === 'A') { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) Sk[a][b] += M[a][i] * C[j][b] + C[a][j] * M[b][i]; }
          else if (i === j) { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) Sk[a][b] += M[a][i] * M[b][i]; }
          else { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) Sk[a][b] += M[a][i] * M[b][j] + M[a][j] * M[b][i]; }
        });
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
    const gh = opts.light ? null : gradHess(ev), Hinv = gh ? inv(gh.H) : null;   // light = refit bootstrap: tanpa galat baku
    const covML = Hinv ? Hinv.map((r) => r.map((x) => x * 2 / n)) : null;
    const seML = covML ? free.map((_, k) => (covML[k][k] > 0 ? Math.sqrt(covML[k][k]) : NaN)) : free.map(() => NaN);
    /* ---------- estimator robust (MLR): SE sandwich Huber-White + faktor skala chi-square ---------- */
    const estimator = opts.estimator === 'mlr' ? 'mlr' : 'ml';
    let cov = covML, robust = null;
    if (estimator === 'mlr' && !opts.light && covML && df >= 0) {
      try {
        const Zc = X.map((r) => r.map((x, j) => x - mean[j])), pr = sandwichParts(Zc, ev.Sinv, S, gh.Sk), Ai = inv(pr.A);
        if (Ai) {
          const covR = mm(mm(Ai, pr.M), Ai).map((r) => r.map((x) => x / n));
          robust = { cov: covR, trVG: pr.trVG };
          cov = covR;
          if (df > 0) {
            const sf = scalingFactor(pr, df); robust.c = sf.c; robust.trUG = sf.trUG;
            // baseline (model independen): Sigma_b = diag(S), parameter = p varians
            const Sb = S.map((r, i) => r.map((x, j) => (i === j ? x : 0))), SbInv = Sb.map((r, i) => r.map((x, j) => (i === j ? 1 / x : 0)));
            const Eb = []; for (let a = 0; a < p; a++) { const E = zeros(p, p); E[a][a] = 1; Eb.push(E); }
            const dB = p * (p - 1) / 2, sb = dB > 0 ? scalingFactor(sandwichParts(Zc, SbInv, S, Eb), dB) : null; robust.cBase = sb ? sb.c : null;
          }
        }
      } catch (e) { robust = null; cov = covML; }
    }
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
    if (cov && !opts.light) { try { const nj = numJac((th) => { const e = assemble(th); return e ? stdOf(e) : P.map(() => NaN); }); stdSE = deltaSE(nj.J); } catch (e) { /* biarkan NaN */ } }

    /* ---------- parameter terdefinisi (:=): nilai dari theta lewat label; SE delta method (SE robust bila MLR) ---------- */
    const defsSpec = spec.defs || [], labelT = {};
    P.forEach((x) => { if (x.label && labelT[x.label] === undefined) labelT[x.label] = x.free ? { t: x.t } : { v: x.val }; });
    function defEval(th) {
      const env = {}, res = [];
      const get = (nm) => { if (nm in env) return env[nm]; const k = (spec.alias && spec.alias[nm]) || nm, lt = labelT[k]; return lt ? (lt.t !== undefined ? th[lt.t] : lt.v) : NaN; };
      defsSpec.forEach((d) => { let v; try { v = evalAst(d.ast, get); } catch (e) { v = NaN; } v = Number.isFinite(v) ? v : NaN; env[d.name] = v; res.push(v); });
      return res;
    }
    let defOut = [];
    if (defsSpec.length) {
      const base = defEval(theta); let ses = base.map(() => NaN);
      if (cov && !opts.light) { try { ses = deltaSE(numJac(defEval).J); } catch (e) { /* biarkan NaN */ } }
      defOut = defsSpec.map((d, k) => { const se = ses[k], ok = Number.isFinite(se) && se > 0 && Number.isFinite(base[k]), z = ok ? base[k] / se : null; return { name: d.name, expr: d.expr, est: base[k], se, z, p: z === null ? null : D.normTwoP(z) }; });
    }
    const params = P.map((x, k) => {
      const est = x.free ? theta[x.t] : x.val, se = x.free ? seTh[x.t] : null, z = se ? est / se : null;
      const isResid = x.kind === 'var' && x.i < p ? hasIn[x.i] : (x.kind === 'var' && hasIn[x.i]);
      return { kind: x.kind, lhs: x.lhs, rhs: x.rhs, free: x.free, est, se, seML: x.free ? seML[x.t] : null, z, p: z === null || Number.isNaN(z) ? null : D.normTwoP(z), std: stdVal[k], stdSe: x.free ? stdSE[k] : null, label: x.label || null, resid: isResid, latent: x.i >= p, i: x.i, j: x.j, mat: x.mat };
    });

    /* ---------- ukuran kecocokan ---------- */
    const Fmin = Math.max(ev.F, 0), chi2 = n * Fmin;
    const out = { N: n, p, m, q, nFreeRaw, nTied: nFreeRaw - q, defs: defOut, moments, df, scale, estimator, converged, iterations: iters, F: ev.F, chi2, S, Sigma: ev.Sig, obs, lat, names, params, warnings: [] };
    out.pChi2 = df > 0 ? D.chi2Sf(chi2, df) : null;
    const dBase = p * (p - 1) / 2; let ldDiag = 0; for (let a = 0; a < p; a++) ldDiag += Math.log(S[a][a]);
    const chiB = n * (ldDiag - Sc.logdet);
    out.chi2Base = chiB; out.dfBase = dBase;
    const fit = {};
    if (df > 0 && !opts.light) {
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
    fit.gfi = 1 - t1 / t2; if (df > 0 && !opts.light) fit.agfi = 1 - (p * (p + 1) / (2 * df)) * (1 - fit.gfi);
    const ll = -(n / 2) * (p * Math.log(2 * Math.PI) + ev.F + Sc.logdet + p);   // -(N/2)(p log2pi + log|Sigma| + tr(Sigma^-1 S))
    fit.logLik = ll; fit.aic = -2 * ll + 2 * (q + p); fit.bic = -2 * ll + Math.log(n) * (q + p);
    out.fit = fit;
    /* ---------- chi-square terskala + indeks robust (MLR) ----------
       'Terskala' = rumus baku dengan chi-square terskala (T/c) dan db apa adanya (kolom "scaled" lavaan).
       'Robust' (Brosseau-Liard & Savalei, 2014) = E[T] = c*db + N*F0 sehingga F0 ditaksir (T - c*db)/N:
         RMSEA_r = sqrt(max(T - c*db, 0) / (db*N)),  CFI_r = 1 - max(T - c*db, 0) / max(T - c*db, Tb - cb*dbb, 0),
         TLI_r = (Tb/dbb - cb - T/db + c) / (Tb/dbb - cb);  selang RMSEA_r: sqrt(c * ncp / (db*N)) dengan ncp dari chi-square terskala. */
    out.robust = null;
    if (robust) {
      const R = { cov: robust.cov, trVG: robust.trVG, c: null, cBase: null, chi2Scaled: null, pScaled: null, fit: {}, ok: false };
      if (df > 0 && Number.isFinite(robust.c) && robust.c > 0) {
        const c = robust.c, Ts = chi2 / c; R.c = c; R.trUG = robust.trUG; R.chi2Scaled = Ts; R.pScaled = D.chi2Sf(Ts, df); R.ok = true;
        const rf = R.fit; rf.rmseaScaled = Math.sqrt(Math.max(Ts - df, 0) / (df * n)); rf.rmsea = Math.sqrt(Math.max(chi2 - c * df, 0) / (df * n));
        rf.rmseaLo = Math.sqrt(c * ncpFor(Ts, df, 0.95) / (df * n)); rf.rmseaHi = Math.sqrt(c * ncpFor(Ts, df, 0.05) / (df * n));
        if (Number.isFinite(robust.cBase) && robust.cBase > 0 && dBase > 0) {
          const cb = robust.cBase, Tbs = chiB / cb; R.cBase = cb; R.chi2BaseScaled = Tbs;
          rf.cfiScaled = 1 - Math.max(Ts - df, 0) / Math.max(Ts - df, Tbs - dBase, 1e-300); rf.tliScaled = ((Tbs / dBase) - (Ts / df)) / ((Tbs / dBase) - 1);
          rf.cfi = 1 - Math.max(chi2 - c * df, 0) / Math.max(chi2 - c * df, chiB - cb * dBase, 1e-300); rf.tli = ((chiB / dBase - cb) - (chi2 / df - c)) / (chiB / dBase - cb);
        }
      }
      out.robust = R;
    }

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
          const Bm = zeros(v, v); regP.forEach((x) => { Bm[x.i][x.j] = x.free ? th[x.t] : x.val; });
          const Im = eye(v); for (let a = 0; a < v; a++) for (let b = 0; b < v; b++) Im[a][b] -= Bm[a][b];
          const Ti = inv(Im); if (!Ti) return pairs.reduce((r) => r.concat([NaN, NaN]), []);
          const res = []; pairs.forEach(([a, b]) => { const tot = Ti[a][b] - (a === b ? 1 : 0); res.push(tot - Bm[a][b], tot); }); return res;
        };
        const nj = opts.light ? { base: eff(theta) } : numJac(eff), ses = cov && !opts.light ? deltaSE(nj.J) : (nj.base || []).map(() => NaN), sdv = ev.C.map((r, i) => Math.sqrt(Math.max(r[i], 1e-300)));
        pairs.forEach(([a, b], k) => {
          const direct = regP.filter((x) => x.i === a && x.j === b).reduce((s, x) => s + (x.free ? theta[x.t] : x.val), 0), ind = nj.base[2 * k], tot = nj.base[2 * k + 1], sI = ses[2 * k], sT = ses[2 * k + 1];
          out.effects.push({ from: names[b], to: names[a], direct, indirect: ind, total: tot, seInd: sI, zInd: sI ? ind / sI : null, pInd: sI ? D.normTwoP(ind / sI) : null, seTot: sT, zTot: sT ? tot / sT : null, pTot: sT ? D.normTwoP(tot / sT) : null, stdInd: ind * sdv[b] / sdv[a], stdTot: tot * sdv[b] / sdv[a] });
        });
      }
    }

    /* ---------- peringatan ---------- */
    if (estimator === 'mlr' && !opts.light) {
      if (!out.robust) out.warnings.push('Estimator MLR tidak dapat dihitung (matriks informasi singular); hasil memakai galat baku ML biasa.');
      else if (df > 0 && !out.robust.ok) out.warnings.push('Faktor skala χ² (c) tidak positif atau tidak terhitung; χ² terskala dan indeks robust tidak dilaporkan.');
      else if (out.robust.ok && n < 100) out.warnings.push('MLR dengan N = ' + n + ' < 100: koreksi berbasis momen keempat sampel tidak stabil; hati-hati menafsirkan SE dan χ² terskala.');
    }
    if (!opts.light && cov) defOut.filter((d) => !Number.isFinite(d.se) || !(d.se > 0)).forEach((d) => out.warnings.push('Parameter terdefinisi "' + d.name + '": galat baku tidak dapat dihitung (nilai NaN atau turunan nol); periksa ekspresi (mis. pembagian dengan 0).'));
    if (!converged) out.warnings.push('Optimasi belum konvergen penuh setelah ' + iters + ' iterasi; hasil perlu ditafsirkan hati-hati.');
    if (!cov && !opts.light) out.warnings.push('Matriks informasi singular: model kemungkinan tidak teridentifikasi secara empiris, galat baku tidak dapat dihitung.');
    params.filter((x) => x.kind === 'var' && x.free && x.est < 0).forEach((x) => out.warnings.push('Kasus Heywood: varians "' + x.lhs + '" bernilai negatif (' + x.est.toFixed(4) + ').'));
    params.filter((x) => x.kind === 'cov' && x.free && Number.isFinite(x.std) && Math.abs(x.std) > 1.0001).forEach((x) => out.warnings.push('Korelasi ' + x.lhs + ' dan ' + x.rhs + ' terstandar melebihi 1 (' + x.std.toFixed(3) + '): kemungkinan multikolinearitas atau konstruk tidak terbedakan.'));
    params.filter((x) => x.kind === 'loading' && x.free && Number.isFinite(x.std) && Math.abs(x.std) > 1.0001).forEach((x) => out.warnings.push('Loading terstandar ' + x.rhs + ' pada ' + x.lhs + ' melebihi 1 (' + x.std.toFixed(3) + ').'));
    /* ---------- modification indices (uji skor) + expected parameter change ----------
       Kandidat = parameter yang sekarang dikunci 0 dan dapat ditulis ulang lewat sintaks: kovarians galat (indikator / konstruk endogen)
       dan jalur struktural ke variabel endogen (tanpa membuat lingkaran umpan balik). Cross-loading tidak dilaporkan (sintaks melarangnya).
       MI_k = (N/2) g_k^2 / (H_kk - H_kc H_cc^-1 H_ck);  EPC_k = -g_k / (H_kk - H_kc H_cc^-1 H_ck);  H = tr(S^-1 S_a S^-1 S_b), g = dF/dtheta. */
    function computeMI(e, Hi) {
      const Si = e.Sinv, sdv = e.C.map((r, i) => Math.sqrt(Math.max(r[i], 1e-300)));
      const isInd = new Array(v).fill(false); spec.latents.forEach((L) => L.ind.forEach((c) => { isInd[idx[c]] = true; }));
      const T = zeros(v, v); P.filter((x) => x.kind === 'reg').forEach((x) => { T[x.i][x.j] = 1; });   // T[a][b] = 1: b memengaruhi a
      for (let k = 0; k < v; k++) for (let a = 0; a < v; a++) if (T[a][k]) for (let b = 0; b < v; b++) if (T[k][b]) T[a][b] = 1;
      const hasA = {}; P.forEach((x) => { if (x.mat === 'A') hasA[x.i + ',' + x.j] = true; });
      const cand = [];
      for (let i = 0; i < v; i++) {
        if (!hasIn[i] || isInd[i]) continue;
        for (let j = 0; j < v; j++) if (j !== i && !isInd[j] && !hasA[i + ',' + j] && !T[j][i]) cand.push({ mat: 'A', i, j, kind: 'reg', lhs: names[i], rhs: names[j], line: names[i] + ' ~ ' + names[j] });
      }
      for (let a = 0; a < v; a++) for (let b = a + 1; b < v; b++) {
        if ((a < p) !== (b < p) || !hasIn[a] || !hasIn[b] || singles.has(a) || singles.has(b) || sKey[a + ',' + b] || T[a][b] || T[b][a]) continue;
        cand.push({ mat: 'S', i: a, j: b, kind: 'cov', lhs: names[a], rhs: names[b], line: names[a] + ' ~~ ' + names[b] });
      }
      if (!cand.length) return [];
      const R = zeros(p, p); for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) R[a][b] = e.Sig[a][b] - S[a][b];
      const G = mm(mm(Si, R), Si), Pk = derivs(e, free).map((K) => mm(mm(Si, K), Si)), Sc = derivs(e, cand), out2 = [];
      cand.forEach((c, k) => {
        const Sk = Sc[k]; let g = 0, hkk = 0; const Pc = mm(mm(Si, Sk), Si);
        for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) { g += G[a][b] * Sk[a][b]; hkk += Pc[a][b] * Sk[a][b]; }
        const h = Pk.map((K) => { let t = 0; for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) t += K[a][b] * Sk[a][b]; return t; });
        let corr = 0; for (let a = 0; a < q; a++) for (let b = 0; b < q; b++) corr += h[a] * Hi[a][b] * h[b];
        const schur = hkk - corr; if (!(hkk > 0) || !(schur > 1e-7 * hkk)) return;   // tak teridentifikasi / redundan
        const mi = (n / 2) * g * g / schur, epc = -g / schur;
        const sepc = c.mat === 'A' ? epc * sdv[c.j] / sdv[c.i] : epc / (sdv[c.i] * sdv[c.j]);
        out2.push({ kind: c.kind, lhs: c.lhs, rhs: c.rhs, op: c.kind === 'reg' ? '~' : '~~', line: c.line, mi, p: D.chi2Sf(mi, 1), epc, sepc });
      });
      out2.sort((x, y) => y.mi - x.mi); return out2;
    }
    out.mi = null; if (!opts.light && Hinv) { try { out.mi = computeMI(ev, Hinv); } catch (e) { out.mi = null; } }
    out._internal = { assemble, theta, free, P };
    if ((opts.boot | 0) > 0 && !opts.light) bootCB(spec, X, out, { B: opts.boot | 0, seed: opts.seed });
    return out;
  }

  /* ---------- uji selisih chi-square (likelihood-ratio) antar dua model CB-SEM pada data yang sama ----------
     Model dengan db lebih besar = model terbatas (restricted). Valid bila model terbatas bersarang (nested) di model penuh. */
  function compareCB(a, b) {
    const w = [], key = (r) => r.obs.slice().sort().join('|');
    if (key(a) !== key(b)) throw err('Kedua model harus memakai himpunan variabel teramati yang sama agar dapat dibandingkan.');
    if (a.N !== b.N) throw err('Kedua model harus memakai data (N) yang sama.');
    if (a.scale !== b.scale) throw err('Kedua model harus memakai skala konstruk laten yang sama.');
    if ((a.estimator === 'mlr') !== (b.estimator === 'mlr')) throw err('Kedua model harus memakai estimator yang sama (ML atau MLR).');
    const aRestr = a.df >= b.df, Rm = aRestr ? a : b, Fm = aRestr ? b : a;
    const dChi = Rm.chi2 - Fm.chi2, dDf = Rm.df - Fm.df, res = { restrictedIsMain: aRestr, restricted: Rm, full: Fm, dChi, dDf, p: null, nested: dDf > 0, scaled: false };
    if (dDf <= 0) w.push('Derajat bebas kedua model sama (' + a.df + '): salah satunya bukan versi terbatas dari yang lain, sehingga uji selisih χ² tidak berlaku. Bandingkan dengan AIC/BIC.');
    else {
      if (dChi < -1e-6) w.push('χ² model terbatas lebih kecil daripada model penuh (selisih ' + dChi.toFixed(3) + '): model kemungkinan tidak bersarang, atau salah satu estimasi belum optimum.');
      res.p = D.chi2Sf(Math.max(dChi, 0), dDf);
      /* MLR: selisih chi-square terskala Satorra-Bentler (2001): cd = (db0*c0 - db1*c1)/(db0 - db1), TRd = (T0 - T1)/cd, dengan T = chi-square ML (tak terskala).
         Selisih dua chi-square yang sudah terskala TIDAK berdistribusi chi-square, jadi tidak boleh dipakai. */
      if (Rm.estimator === 'mlr') {
        const r0 = Rm.robust, r1 = Fm.robust;
        if (!r0 || !r1 || !r0.ok || (Fm.df > 0 && !r1.ok)) w.push('Faktor skala MLR salah satu model tidak tersedia; uji selisih χ² terskala tidak dapat dihitung.');
        else {
          const c1 = Fm.df > 0 ? r1.c : 1, cd = (Rm.df * r0.c - Fm.df * c1) / dDf; res.scaled = true; res.cd = cd; res.dChiScaled = cd > 0 ? dChi / cd : NaN;
          if (!(cd > 0)) { res.p = null; w.push('Faktor skala selisih (cd = ' + cd.toFixed(4) + ') tidak positif: uji selisih terskala 2001 tidak valid pada data ini (dapat terjadi pada sampel kecil atau model tidak bersarang). Gunakan versi "strictly positive" (Satorra–Bentler, 2010) atau bandingkan dengan AIC/BIC.'); }
          else res.p = D.chi2Sf(Math.max(res.dChiScaled, 0), dDf);
        }
      }
    }
    const g = (r, k) => (r.fit ? r.fit[k] : NaN);
    res.dCfi = g(Fm, 'cfi') - g(Rm, 'cfi'); res.dRmsea = g(Rm, 'rmsea') - g(Fm, 'rmsea'); res.dSrmr = g(Rm, 'srmr') - g(Fm, 'srmr'); res.dAic = Rm.fit.aic - Fm.fit.aic; res.dBic = Rm.fit.bic - Fm.fit.bic;
    res.warnings = w; return res;
  }

  /* ---------- bootstrap nonparametrik CB-SEM (resampel kasus) ----------
     Tiap resampel: ambil n baris dengan pengembalian, estimasi ulang model (start dari solusi asli, tanpa galat baku),
     kumpulkan estimasi tak terstandar & terstandar tiap parameter serta efek tak langsung/total.
     Hasil: SE bootstrap, selang persentil 95% dan selang bias-corrected (BC) 95%.
     Catatan: chi-square TIDAK di-bootstrap (resampel biasa membuat chi-square membengkak; itu perlu Bollen-Stine). */
  function* bootGen(spec, X, fit, opts) {
    const Bn = opts.B | 0, n = X.length, seed = opts.seed === undefined ? 12345 : opts.seed, chunk = opts.chunk || 10, rnd = rngSeed(seed);
    const start = {}; fit._internal.free.forEach((x, k) => { start[x.mat + '|' + x.i + '|' + x.j] = fit._internal.theta[k]; });
    const keys = [], orig = [], at = {};
    const add = (k, v) => { at[k] = keys.length; keys.push(k); orig.push(v); };
    fit.params.forEach((x, k) => { if (x.free) add('U' + k, x.est); if (Number.isFinite(x.std) && x.kind !== 'var') add('S' + k, x.std); else if (Number.isFinite(x.std) && x.free) add('S' + k, x.std); });
    fit.effects.forEach((e, k) => { add('I' + k, e.indirect); add('T' + k, e.total); add('J' + k, e.stdInd); add('K' + k, e.stdTot); });
    (fit.defs || []).forEach((d, k) => add('D' + k, d.est));
    const draws = keys.map(() => []);
    let ok = 0, failed = 0, heywood = 0;
    for (let b = 0; b < Bn; b++) {
      const Xb = new Array(n); for (let i = 0; i < n; i++) Xb[i] = X[Math.floor(rnd() * n)];
      let rb = null; try { rb = fitCB(spec, Xb, { scale: fit.scale, start, light: true }); } catch (e) { rb = null; }
      if (!rb || !rb.converged || rb.params.length !== fit.params.length || rb.effects.length !== fit.effects.length || (rb.defs || []).length !== (fit.defs || []).length) failed++;
      else {
        if (rb.params.some((x) => x.kind === 'var' && x.free && x.est < 0)) heywood++;
        keys.forEach((k, i) => {
          const t = k.charAt(0), j = +k.slice(1);
          draws[i].push(t === 'D' ? rb.defs[j].est : t === 'U' ? rb.params[j].est : t === 'S' ? rb.params[j].std : t === 'I' ? rb.effects[j].indirect : t === 'T' ? rb.effects[j].total : t === 'J' ? rb.effects[j].stdInd : rb.effects[j].stdTot);
        });
        ok++;
      }
      if ((b + 1) % chunk === 0 || b + 1 === Bn) yield { done: b + 1, total: Bn };
    }
    const sorted = draws.map((d) => d.filter(Number.isFinite).sort((a, c) => a - c));
    const q = (d, pp) => { const pos = Math.min(Math.max(pp, 0), 1) * (d.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos); return d[lo] + (d[hi] - d[lo]) * (pos - lo); };
    const stat = (k) => {
      const i = at[k]; if (i === undefined) return null;
      const d = sorted[i], nb = d.length; if (nb < 20) return null;
      const est = orig[i], mu = sum(d) / nb, sdv = Math.sqrt(sum(d.map((x) => (x - mu) * (x - mu))) / (nb - 1));
      let below = 0; for (let t = 0; t < nb; t++) if (d[t] < est) below++; else break;
      const pb = Math.min(Math.max(below / nb, 0.5 / nb), 1 - 0.5 / nb), z0 = D.normQuant(pb);
      const bc = (a) => D.normCdf(2 * z0 + D.normQuant(a)), z = sdv > 0 ? est / sdv : null;
      return { est, mean: mu, bias: mu - est, se: sdv, z, p: z === null ? null : D.normTwoP(z), lo: q(d, 0.025), hi: q(d, 0.975), bcLo: q(d, bc(0.025)), bcHi: q(d, bc(0.975)), n: nb };
    };
    fit.boot = { B: Bn, ok, failed, heywood, seed, stat };
    fit.params.forEach((x, k) => { x.boot = x.free ? stat('U' + k) : null; x.bootStd = stat('S' + k); });
    (fit.defs || []).forEach((d, k) => { d.boot = stat('D' + k); });
    fit.effects.forEach((e, k) => { e.bootInd = stat('I' + k); e.bootTot = stat('T' + k); e.bootStdInd = stat('J' + k); e.bootStdTot = stat('K' + k); });
    if (failed > Bn * 0.05) fit.warnings.push(failed + ' dari ' + Bn + ' resampel bootstrap tidak konvergen / gagal dan dilewati; periksa kestabilan model atau tambah ukuran sampel.' + (fit.scale === 'std' ? ' Pada skala "varians laten = 1", konstruk endogen dengan R² mendekati 1 membuat estimasi resampel tidak stabil (varians galat laten dikunci 1); gunakan skala indikator pertama = 1 (marker) untuk bootstrap.' : ''));
    if (heywood > Bn * 0.05) fit.warnings.push('Varians galat negatif (kasus Heywood) muncul pada ' + heywood + ' dari ' + ok + ' resampel bootstrap yang berhasil.');
    return fit;
  }
  function bootCB(spec, X, fit, opts) { const g = bootGen(spec, X, fit, opts || {}); let r = g.next(); while (!r.done) r = g.next(); return r.value; }
  function bootCBAsync(spec, X, fit, opts, onProgress, isCancelled) {   // bertahap lewat setTimeout agar halaman tidak membeku
    return new Promise((resolve, reject) => {
      const g = bootGen(spec, X, fit, opts || {});
      const step = () => {
        try {
          if (isCancelled && isCancelled()) return resolve(null);
          const t0 = Date.now(); let r = g.next();
          while (!r.done && Date.now() - t0 < 40) r = g.next();   // ~40 ms kerja per putaran
          if (r.done) return resolve(r.value);
          if (onProgress) onProgress(r.value.done, r.value.total);
          setTimeout(step, 0);
        } catch (e) { reject(e); }
      };
      step();
    });
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

  function plsData(cons, dataset) {   // kolom mentah per indikator unik + versi baku; mengisi cons[j].cols
    const names = dataset.names, X = dataset.X, colIdx = {}, raw = [], colOf = {}; names.forEach((c, i) => { colIdx[c] = i; });
    cons.forEach((c) => { c.cols = c.ind.map((nm) => { if (!(nm in colOf)) { colOf[nm] = raw.length; raw.push(Float64Array.from(X.map((r) => r[colIdx[nm]]))); } return colOf[nm]; }); });
    const Zd = raw.map((c, i) => { const z = colStd(c); if (!z) throw err('Indikator "' + Object.keys(colOf).find((k) => colOf[k] === i) + '" bernilai konstan.'); return z; });
    return { raw, colOf, Zd };
  }

  /* ---------- Blindfolding (Q²): Stone-Geisser, cross-validated communality & redundancy (Tenenhaus dkk. 2005) ----------
     Sel (i, k) dihilangkan pada putaran g bila (i + k) mod D = g  (pola diagonal; tiap sel hilang tepat satu kali dalam D putaran).
     Sel yang hilang diganti rata-rata sel tersisa pada kolom itu, model PLS diestimasi ulang, lalu sel yang hilang diprediksi:
       communality :  x^ = rata2 + sd * lambda_k * Y_j          (skor konstruknya sendiri)            -> hanya konstruk reflektif multi-indikator
       redundancy  :  x^ = rata2 + sd * lambda_k * sum(beta_jp Y_p)  (skor prediksi dari pendahulu)   -> konstruk endogen reflektif / indikator tunggal
     Q² = 1 - SSE/SSO;  SSE = sum (x - x^)^2,  SSO = sum (x - rata2 sel tersisa)^2  */
  function* plsBlindfoldGen(cons, pred, succ, raw, W0, opts) {
    const D = opts.D, n = raw[0].length, K = raw.length, m = cons.length;
    const redOK = cons.map((c, j) => pred[j].length > 0 && (c.mode === 'A' || c.single)), commOK = cons.map((c) => c.mode === 'A' && !c.single);
    const acc = cons.map((c) => c.cols.map(() => ({ ssoC: 0, sseC: 0, ssoR: 0, sseR: 0, nC: 0, nR: 0 })));
    let failed = 0;
    for (let g = 0; g < D; g++) {
      yield { phase: 'blind', done: g, total: D };
      const mu = new Array(K), sd = new Array(K); let bad = false;
      const Zb = raw.map((c, k) => {
        let s1 = 0, nb = 0; for (let i = 0; i < n; i++) if ((i + k) % D !== g) { s1 += c[i]; nb++; }
        const mk = s1 / nb; let ss = 0; for (let i = 0; i < n; i++) if ((i + k) % D !== g) ss += (c[i] - mk) * (c[i] - mk);
        const sk = Math.sqrt(ss / (nb - 1)); mu[k] = mk; sd[k] = sk; if (!(sk > 0)) { bad = true; return null; }
        const z = new Float64Array(n); for (let i = 0; i < n; i++) z[i] = (i + k) % D === g ? 0 : (c[i] - mk) / sk; return z;
      });
      if (bad) { failed++; continue; }
      const core = plsCore(Zb, cons, pred, succ, { scheme: opts.scheme, maxIter: 300, tol: 1e-9 }, W0); const pa = core && plsPaths(core.Y, pred, n);
      if (!core || !pa) { failed++; continue; }
      cons.forEach((c, j) => {
        if (!commOK[j] && !redOK[j]) return;
        const Yj = core.Y[j], yhat = redOK[j] ? new Float64Array(n) : null;
        if (yhat) pred[j].forEach((p) => { const b = pa.B[j][p], Yp = core.Y[p]; for (let i = 0; i < n; i++) yhat[i] += b * Yp[i]; });
        c.cols.forEach((k, h) => {
          const lam = dotc(Zb[k], Yj), a = acc[j][h];
          for (let ii = (((g - k) % D) + D) % D; ii < n; ii += D) {   // semua i dengan (i + k) mod D = g
            const x = raw[k][ii], dev = (x - mu[k]) * (x - mu[k]);
            if (commOK[j]) { const e = x - (mu[k] + sd[k] * lam * Yj[ii]); a.sseC += e * e; a.ssoC += dev; a.nC++; }
            if (redOK[j]) { const e = x - (mu[k] + sd[k] * lam * yhat[ii]); a.sseR += e * e; a.ssoR += dev; a.nR++; }
          }
        });
      });
    }
    if (failed) return { failed };
    const q2 = (sse, sso) => (sso > 0 ? 1 - sse / sso : NaN), tot = (arr, f) => arr.reduce((s1, a) => s1 + a[f], 0);
    const out = cons.map((c, j) => {
      const a = acc[j], o = { name: c.name, mode: c.mode, single: c.single, ind: c.ind.slice(), comm: null, red: null, indicators: c.ind.map((ind, h) => ({ ind, commQ2: commOK[j] ? q2(a[h].sseC, a[h].ssoC) : null, redQ2: redOK[j] ? q2(a[h].sseR, a[h].ssoR) : null })) };
      if (commOK[j]) { const sse = tot(a, 'sseC'), sso = tot(a, 'ssoC'); o.comm = { sse, sso, q2: q2(sse, sso), n: tot(a, 'nC') }; }
      if (redOK[j]) { const sse = tot(a, 'sseR'), sso = tot(a, 'ssoR'); o.red = { sse, sso, q2: q2(sse, sso), n: tot(a, 'nR') }; }
      return o;
    });
    return { D, constructs: out, failed: 0 };
  }

  /* ---------- PLSpredict (Shmueli dkk. 2016, 2019): prediksi luar-sampel k-lipatan berulang vs benchmark regresi linear ---------- */
  function* plsPredictGen(cons, pred, succ, topo, raw, W0, opts) {
    const n = raw[0].length, K = raw.length, m = cons.length, F = opts.folds, R = opts.reps, tech = opts.technique === 'earliest' ? 'earliest' : 'direct';
    const exo = cons.map((c, j) => pred[j].length === 0);
    const anc = cons.map(() => new Set()); topo.forEach((j) => pred[j].forEach((p) => { anc[j].add(p); anc[p].forEach((a) => anc[j].add(a)); }));
    const targets = []; cons.forEach((c, j) => { if (pred[j].length && !(c.mode === 'B' && c.cols.length > 1)) c.cols.forEach((k, h) => targets.push({ j, h, k, con: c.name, ind: c.ind[h] })); });
    const skipped = cons.filter((c, j) => pred[j].length && c.mode === 'B' && c.cols.length > 1).map((c) => c.name);
    const regCols = (j) => { const ids = tech === 'direct' ? pred[j] : Array.from(anc[j]).filter((a) => exo[a]), set = new Set(); ids.forEach((a) => cons[a].cols.forEach((k) => set.add(k))); return Array.from(set); };
    const lmCols = cons.map((c, j) => (pred[j].length ? regCols(j) : null));
    const rnd = rngSeed(opts.seed === undefined ? 12345 : opts.seed), nT = targets.length;
    const sum_ = targets.map(() => ({ rmse: 0, mae: 0, q2: 0, lmRmse: 0, lmMae: 0, lmQ2: 0 })); let repsOK = 0, failedFolds = 0, lmFail = 0;
    for (let r = 0; r < R; r++) {
      const perm = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const q = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[q]; perm[q] = t; }
      const e = targets.map(() => ({ sse: 0, sae: 0, ssn: 0, sseL: 0, saeL: 0, ok: true })); let repBad = false;
      for (let f = 0; f < F; f++) {
        yield { phase: 'predict', done: r * F + f, total: R * F };
        const te = [], tr = []; perm.forEach((id, pos) => { (pos % F === f ? te : tr).push(id); });
        const ntr = tr.length, nte = te.length, mu = new Array(K), sd = new Array(K); let bad = false;
        const Ztr = raw.map((c, k) => {
          let s1 = 0; for (let t = 0; t < ntr; t++) s1 += c[tr[t]]; const mk = s1 / ntr; let ss = 0; for (let t = 0; t < ntr; t++) ss += (c[tr[t]] - mk) * (c[tr[t]] - mk);
          const sk = Math.sqrt(ss / (ntr - 1)); mu[k] = mk; sd[k] = sk; if (!(sk > 0)) { bad = true; return null; }
          const z = new Float64Array(ntr); for (let t = 0; t < ntr; t++) z[t] = (c[tr[t]] - mk) / sk; return z;
        });
        if (bad) { failedFolds++; repBad = true; break; }
        const core = plsCore(Ztr, cons, pred, succ, { scheme: opts.scheme, maxIter: 300, tol: 1e-8 }, W0), pa = core && plsPaths(core.Y, pred, ntr);
        if (!core || !pa) { failedFolds++; repBad = true; break; }
        const Zte = raw.map((c, k) => { const z = new Float64Array(nte); for (let t = 0; t < nte; t++) z[t] = (c[te[t]] - mu[k]) / sd[k]; return z; });
        const Yte = cons.map((c, j) => { const y = new Float64Array(nte); c.cols.forEach((k, h) => { const w = core.W[j][h]; for (let t = 0; t < nte; t++) y[t] += w * Zte[k][t]; }); return y; });
        const Yh = Yte.map((y) => y.slice());   // skor dipakai untuk prediksi: DA = skor dari indikator holdout; EA = skor prediksi berantai dari konstruk eksogen
        if (tech === 'earliest') topo.forEach((j) => { if (!pred[j].length) return; const y = new Float64Array(nte); pred[j].forEach((p) => { const b = pa.B[j][p]; for (let t = 0; t < nte; t++) y[t] += b * Yh[p][t]; }); Yh[j] = y; });
        const lmBeta = {};
        targets.forEach((tg, a) => {
          const { j, k } = tg;
          const lam = dotc(Ztr[k], core.Y[j]);
          let yh; if (tech === 'earliest') yh = Yh[j]; else { yh = new Float64Array(nte); pred[j].forEach((p) => { const b = pa.B[j][p]; for (let t = 0; t < nte; t++) yh[t] += b * Yte[p][t]; }); }
          // benchmark LM
          const cols = lmCols[j], key = j + '|' + k; let beta = lmBeta[key];
          if (beta === undefined) { const Rxx = cols.map((c1) => cols.map((c2) => dotc(Ztr[c1], Ztr[c2]))), rxy = cols.map((c1) => dotc(Ztr[c1], Ztr[k])); beta = solve(Rxx, rxy); lmBeta[key] = beta; }
          if (!beta) e[a].ok = false;
          for (let t = 0; t < nte; t++) {
            const x = raw[k][te[t]], pr = mu[k] + sd[k] * lam * yh[t], er = x - pr; e[a].sse += er * er; e[a].sae += Math.abs(er); e[a].ssn += (x - mu[k]) * (x - mu[k]);
            if (beta) { let zl = 0; cols.forEach((c1, q) => { zl += beta[q] * Zte[c1][t]; }); const el = x - (mu[k] + sd[k] * zl); e[a].sseL += el * el; e[a].saeL += Math.abs(el); }
          }
        });
      }
      if (repBad) continue; repsOK++;
      targets.forEach((tg, a) => { const x = e[a], s = sum_[a]; s.rmse += Math.sqrt(x.sse / n); s.mae += x.sae / n; s.q2 += 1 - x.sse / x.ssn; if (x.ok) { s.lmRmse += Math.sqrt(x.sseL / n); s.lmMae += x.saeL / n; s.lmQ2 += 1 - x.sseL / x.ssn; } else lmFail++; });
    }
    if (!repsOK) return { failed: true, failedFolds };
    const rows = targets.map((tg, a) => { const s = sum_[a], d = repsOK, ok = lmFail === 0; return { construct: tg.con, ind: tg.ind, rmse: s.rmse / d, mae: s.mae / d, q2: s.q2 / d, lmRmse: ok ? s.lmRmse / d : NaN, lmMae: ok ? s.lmMae / d : NaN, lmQ2: ok ? s.lmQ2 / d : NaN, dRmse: ok ? (s.rmse - s.lmRmse) / d : NaN, dMae: ok ? (s.mae - s.lmMae) / d : NaN }; });
    const byCon = {}; rows.forEach((x) => { (byCon[x.construct] = byCon[x.construct] || []).push(x); });
    const constructs = Object.keys(byCon).map((nm) => {
      const rs = byCon[nm], nT2 = rs.length, nBetter = rs.filter((x) => x.dRmse < 0).length, nQpos = rs.filter((x) => x.q2 > 0).length;
      const level = nQpos === 0 ? 'tidak ada' : !Number.isFinite(rs[0].dRmse) ? 'tak tersedia' : nBetter === nT2 ? 'tinggi' : nBetter > nT2 / 2 ? 'sedang' : nBetter > 0 ? 'rendah' : 'tidak ada';
      return { name: nm, nInd: nT2, nBetter, nQpos, level };
    });
    return { folds: F, reps: R, repsOK, failedFolds, technique: tech, seed: opts.seed === undefined ? 12345 : opts.seed, rows, constructs, skipped, lmFailed: lmFail > 0 };
  }

  function* fitPLSGen(spec, dataset, opts) {
    if (spec.hasMods) throw err('Label, nilai tetap (angka*variabel), pembatasan (==), dan parameter terdefinisi (:=) hanya didukung oleh CB-SEM. Hapus pengubah tersebut atau pilih CB-SEM.');
    opts = opts || {};
    const st = plsStructure(spec), { cons, pred, succ, m } = st;
    const X = dataset.X, n = X.length;
    if (n < 10) throw err('PLS-SEM membutuhkan minimal 10 pengamatan lengkap (sekarang ' + n + ').');
    const { raw, Zd } = plsData(cons, dataset);
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

    /* ---------- Q² (blindfolding) dan PLSpredict ---------- */
    const Dq = opts.blind | 0;
    if (Dq > 0) {
      if (Dq < 2 || Dq >= n) throw err('Jarak omisi blindfolding (D) harus bilangan bulat antara 2 dan n − 1 (disarankan 5–12).');
      res.blind = yield* plsBlindfoldGen(cons, pred, succ, raw, core.W, { D: Dq, scheme: opts.scheme });
      if (res.blind.failed) { res.warnings.push('Blindfolding gagal pada ' + res.blind.failed + ' dari ' + Dq + ' putaran (kolom konstan atau matriks singular setelah sel dihilangkan); Q² tidak dilaporkan. Coba nilai D lain.'); res.blind = null; }
      else if (Dq < 5 || Dq > 12) res.warnings.push('Jarak omisi D = ' + Dq + ' di luar rentang yang disarankan (5–12).');
    }
    const pq = opts.predict;
    if (pq && pq.folds > 1) {
      const F = pq.folds | 0, Rp = Math.max(1, pq.reps | 0);
      if (F > n / 2) throw err('Jumlah lipatan PLSpredict (' + F + ') terlalu besar untuk n = ' + n + '; gunakan paling banyak ' + Math.floor(n / 2) + '.');
      res.predict = yield* plsPredictGen(cons, pred, succ, st.topo, raw, core.W, { folds: F, reps: Rp, scheme: opts.scheme, technique: pq.technique, seed: pq.seed });
      if (res.predict.failed) { res.warnings.push('PLSpredict gagal: kolom konstan atau matriks singular pada data latih.'); res.predict = null; }
      else {
        if (res.predict.failedFolds) res.warnings.push('PLSpredict: ' + res.predict.failedFolds + ' ulangan dilewati karena lipatan latih bermasalah (kolom konstan atau singular).');
        if (res.predict.lmFailed) res.warnings.push('PLSpredict: benchmark regresi linear (LM) singular pada sebagian lipatan (prediktor kolinear sempurna); perbandingan dengan LM tidak ditampilkan.');
        if (res.predict.skipped.length) res.warnings.push('PLSpredict dan Q² redundancy melewati konstruk endogen formatif multi-indikator (' + res.predict.skipped.join(', ') + ').');
        if (n / F < 30) res.warnings.push('Tiap lipatan uji hanya berisi sekitar ' + Math.round(n / F) + ' kasus; Shmueli dkk. menyarankan ≥ 30 per lipatan agar RMSE stabil (kurangi jumlah lipatan).');
      }
    }
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
        yield { phase: 'boot', done: b, total: B };
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

  /* ---------- pembungkus: versi sinkron (uji, skrip) dan versi bertahap (UI, tidak membekukan halaman) ---------- */
  const drain = (g) => { let r = g.next(); while (!r.done) r = g.next(); return r.value; };
  const plsBlindfold = (...a) => drain(plsBlindfoldGen(...a)), plsPredictCV = (...a) => drain(plsPredictGen(...a)), fitPLS = (...a) => drain(fitPLSGen(...a));
  /* Jalankan generator bertahap lewat setTimeout (~40 ms kerja per putaran). onProgress({phase, done, total}); isCancelled() true -> resolve(null). */
  function runGenAsync(g, onProgress, isCancelled) {
    return new Promise((resolve, reject) => {
      const step = () => {
        try {
          if (isCancelled && isCancelled()) { g.return(); return resolve(null); }
          const t0 = Date.now(); let r = g.next();
          while (!r.done && Date.now() - t0 < 40) r = g.next();
          if (r.done) return resolve(r.value);
          if (onProgress) onProgress(r.value);
          setTimeout(step, 0);
        } catch (e) { reject(e); }
      };
      step();
    });
  }
  const fitPLSAsync = (spec, dataset, opts, onProgress, isCancelled) => runGenAsync(fitPLSGen(spec, dataset, opts), onProgress, isCancelled);

  window.StatSEM = { plsBlindfold, plsPredictCV, parseModel, _evalAst: evalAst, fitCB, compareCB, mardia, _sandwichParts: sandwichParts, _scalingFactor: scalingFactor, bootCB, bootCBAsync, fitPLS, fitPLSAsync, _fitPLSGen: fitPLSGen, ncx2Cdf, ncpFor, _inv: inv, _chol: chol };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatSEM;
})();
