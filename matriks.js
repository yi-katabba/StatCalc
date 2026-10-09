/* =========================================================================
   MATRIKS.JS — Kalkulator Matriks untuk StatCalc
   -------------------------------------------------------------------------
   Bagian 1: inti matematika (murni, tanpa DOM — bisa diuji di Node)
   Bagian 2: antarmuka (dirender ke <main id="view-matriks">)

   Fitur: A + B, A − B, A × B, B × A, k·M, transpos, determinan, invers,
   rank, trace, pangkat, MᵀM, eliminasi Gauss-Jordan (RREF), nilai eigen,
   SPL (A·x = b) dan regresi OLS (β = (XᵀX)⁻¹Xᵀy).
   ========================================================================= */
(function () {
  'use strict';

  /* ======================================================================
     1. INTI MATEMATIKA
     ====================================================================== */
  const MAX = 10;

  const zeros = (r, c) => Array.from({ length: r }, () => Array(c).fill(0));
  const ident = (n) => { const m = zeros(n, n); for (let i = 0; i < n; i++) m[i][i] = 1; return m; };
  const clone = (m) => m.map((r) => r.slice());
  const rows = (m) => m.length;
  const cols = (m) => m[0].length;
  const sz = (m) => rows(m) + '×' + cols(m);
  const maxAbs = (m) => m.reduce((a, r) => r.reduce((b, x) => Math.max(b, Math.abs(x)), a), 0);

  function addM(a, b, sign) {
    return a.map((r, i) => r.map((x, j) => x + sign * b[i][j]));
  }
  function mulM(a, b) {
    const n = rows(a), m = cols(a), p = cols(b), out = zeros(n, p);
    for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) {
      const aik = a[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < p; j++) out[i][j] += aik * b[k][j];
    }
    return out;
  }
  function transposeM(a) {
    const out = zeros(cols(a), rows(a));
    for (let i = 0; i < rows(a); i++) for (let j = 0; j < cols(a); j++) out[j][i] = a[i][j];
    return out;
  }
  const scaleM = (a, k) => a.map((r) => r.map((x) => x * k));

  /* Determinan: eliminasi LU dengan pivot parsial. Pivot ~0 -> det = 0 */
  function detM(a) {
    const n = rows(a), m = clone(a), tol = 1e-11 * maxAbs(a);
    if (maxAbs(a) === 0) return 0;
    let d = 1;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let i = c + 1; i < n; i++) if (Math.abs(m[i][c]) > Math.abs(m[p][c])) p = i;
      if (Math.abs(m[p][c]) <= tol) return 0;
      if (p !== c) { [m[p], m[c]] = [m[c], m[p]]; d = -d; }
      d *= m[c][c];
      for (let i = c + 1; i < n; i++) {
        const f = m[i][c] / m[c][c];
        if (f !== 0) for (let j = c; j < n; j++) m[i][j] -= f * m[c][j];
      }
    }
    return d;
  }

  /* Gauss-Jordan -> bentuk eselon baris tereduksi. limitCols: jumlah kolom
     yang boleh dijadikan pivot (untuk matriks gabungan [A|b]). */
  function rrefM(a, limitCols) {
    const m = clone(a), R = rows(m), C = cols(m), lim = limitCols == null ? C : limitCols;
    const tol = 1e-10 * (maxAbs(a) || 1);
    const pivots = [];
    let r = 0;
    for (let c = 0; c < lim && r < R; c++) {
      let p = r;
      for (let i = r + 1; i < R; i++) if (Math.abs(m[i][c]) > Math.abs(m[p][c])) p = i;
      if (Math.abs(m[p][c]) <= tol) { for (let i = r; i < R; i++) m[i][c] = 0; continue; }
      [m[p], m[r]] = [m[r], m[p]];
      const pv = m[r][c];
      for (let j = 0; j < C; j++) m[r][j] /= pv;
      for (let i = 0; i < R; i++) {
        if (i === r) continue;
        const f = m[i][c];
        if (f !== 0) for (let j = 0; j < C; j++) m[i][j] -= f * m[r][j];
      }
      pivots.push(c); r++;
    }
    return { m, pivots };
  }

  /* Invers via Gauss-Jordan [A | I]; null jika singular */
  function inverseM(a) {
    const n = rows(a);
    const aug = a.map((r, i) => r.concat(ident(n)[i]));
    const { m, pivots } = rrefM(aug, n);
    if (pivots.length < n) return null;
    return m.map((r) => r.slice(n));
  }

  function powerM(a, n) {
    let base = a, e = Math.abs(n), out = ident(rows(a));
    if (n < 0) { base = inverseM(a); if (!base) return null; }
    while (e > 0) {
      if (e & 1) out = mulM(out, base);
      base = mulM(base, base); e >>= 1;
    }
    return out;
  }

  /* Eigen simetris: metode Jacobi (nilai + vektor eigen ortonormal) */
  function jacobiEigen(A) {
    const n = rows(A), a = clone(A), V = ident(n);
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-26 * (1 + maxAbs(A) ** 2)) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((x, y) => a[y][y] - a[x][x]);
    const values = idx.map((i) => a[i][i]);
    const vecs = zeros(n, n);
    idx.forEach((src, dst) => {
      let big = 0;
      for (let k = 0; k < n; k++) if (Math.abs(V[k][src]) > Math.abs(V[big][src])) big = k;
      const sg = V[big][src] < 0 ? -1 : 1;           // tanda: komponen terbesar positif
      for (let k = 0; k < n; k++) vecs[k][dst] = sg * V[k][src];
    });
    return { values: values.map((v) => ({ re: v, im: 0 })), vectors: vecs };
  }

  /* QR Householder (untuk iterasi QR) */
  function qrM(A) {
    const n = rows(A), R = clone(A), Q = ident(n);
    for (let k = 0; k < n - 1; k++) {
      let norm = 0;
      for (let i = k; i < n; i++) norm += R[i][k] * R[i][k];
      norm = Math.sqrt(norm);
      if (norm < 1e-300) continue;
      const alpha = R[k][k] > 0 ? -norm : norm;
      const v = []; for (let i = k; i < n; i++) v.push(R[i][k]);
      v[0] -= alpha;
      const vv = v.reduce((s, x) => s + x * x, 0);
      if (vv < 1e-300) continue;
      for (let j = k; j < n; j++) {
        let d = 0; for (let i = 0; i < v.length; i++) d += v[i] * R[k + i][j];
        d = 2 * d / vv;
        for (let i = 0; i < v.length; i++) R[k + i][j] -= d * v[i];
      }
      for (let i = 0; i < n; i++) {
        let d = 0; for (let j = 0; j < v.length; j++) d += v[j] * Q[i][k + j];
        d = 2 * d / vv;
        for (let j = 0; j < v.length; j++) Q[i][k + j] -= d * v[j];
      }
    }
    return { Q, R };
  }

  /* Eigen umum: iterasi QR, nilai eigen dibaca dari diagonal / blok 2×2
     (blok 2×2 memberi pasangan kompleks). Hanya nilai eigen. */
  function qrEigenvalues(A) {
    const n = rows(A);
    let T = clone(A);
    for (let it = 0; it < 3000; it++) {
      const { Q, R } = qrM(T);
      T = mulM(R, Q);
      let sub = 0;
      for (let i = 1; i < n; i++) sub = Math.max(sub, Math.abs(T[i][i - 1]));
      if (sub < 1e-13 * (1 + maxAbs(A))) break;
    }
    const tol = 1e-7 * (1 + maxAbs(A)), out = [];
    for (let i = 0; i < n;) {
      if (i < n - 1 && Math.abs(T[i + 1][i]) > tol) {
        const a = T[i][i], b = T[i][i + 1], c = T[i + 1][i], d = T[i + 1][i + 1];
        const tr = a + d, dt = a * d - b * c, disc = tr * tr / 4 - dt;
        if (disc >= 0) {
          const s = Math.sqrt(disc);
          out.push({ re: tr / 2 + s, im: 0 }, { re: tr / 2 - s, im: 0 });
        } else {
          const s = Math.sqrt(-disc);
          out.push({ re: tr / 2, im: s }, { re: tr / 2, im: -s });
        }
        i += 2;
      } else { out.push({ re: T[i][i], im: 0 }); i++; }
    }
    out.sort((x, y) => (Math.hypot(y.re, y.im) - Math.hypot(x.re, x.im)) || (y.im - x.im));
    return out;
  }

  function isSymmetric(a) {
    const tol = 1e-9 * (maxAbs(a) || 1);
    for (let i = 0; i < rows(a); i++) for (let j = i + 1; j < cols(a); j++)
      if (Math.abs(a[i][j] - a[j][i]) > tol) return false;
    return true;
  }

  /* ---- Format & parsing angka ---- */
  function fmt(x) {
    if (!isFinite(x)) return String(x);
    if (Math.abs(x) < 1e-10) return '0';
    return String(parseFloat(x.toPrecision(10)));
  }
  function fmtC(z) {
    if (Math.abs(z.im) < 1e-9 * (1 + Math.abs(z.re))) return fmt(z.re);
    return fmt(z.re) + (z.im < 0 ? ' − ' : ' + ') + fmt(Math.abs(z.im)) + 'i';
  }
  const exact = (x) => (Math.abs(x) < 1e-10 ? '0' : String(parseFloat(x.toPrecision(12))));

  /* Sel kosong dianggap 0. Menerima 3,5 / 3.5 / 1/2 / 1e-3. */
  function parseCell(s) {
    const t = String(s == null ? '' : s).trim();
    if (t === '') return 0;
    const N = '[+-]?(?:\\d+(?:[.,]\\d*)?|[.,]\\d+)(?:[eE][+-]?\\d+)?';
    const num = (x) => Number(x.replace(',', '.'));
    const f = t.match(new RegExp('^(' + N + ')\\s*/\\s*(' + N + ')$'));
    if (f) { const d = num(f[2]); return d === 0 ? NaN : num(f[1]) / d; }
    if (!new RegExp('^' + N + '$').test(t)) return NaN;
    return num(t);
  }

  /* ---- Definisi operasi ---- */
  const need = (c, msg) => { if (!c) throw new Error(msg); };
  const square = (m, name) => need(rows(m) === cols(m),
    `Matriks ${name} harus persegi (n×n), ukuran saat ini ${sz(m)}.`);

  const OPS = [
    { group: 'Dua matriks (A dan B)', items: [
      { id: 'add', label: 'Penjumlahan — A + B', run: (c) => {
        const A = c.A(), B = c.B();
        need(rows(A) === rows(B) && cols(A) === cols(B), `A + B memerlukan ukuran yang sama (A: ${sz(A)}, B: ${sz(B)}).`);
        return { title: 'A + B', matrix: addM(A, B, 1) };
      } },
      { id: 'sub', label: 'Pengurangan — A − B', run: (c) => {
        const A = c.A(), B = c.B();
        need(rows(A) === rows(B) && cols(A) === cols(B), `A − B memerlukan ukuran yang sama (A: ${sz(A)}, B: ${sz(B)}).`);
        return { title: 'A − B', matrix: addM(A, B, -1) };
      } },
      { id: 'mul', label: 'Perkalian — A × B', run: (c) => {
        const A = c.A(), B = c.B();
        need(cols(A) === rows(B), `A × B: jumlah kolom A (${cols(A)}) harus sama dengan jumlah baris B (${rows(B)}).`);
        return { title: 'A × B', matrix: mulM(A, B) };
      } },
      { id: 'mulba', label: 'Perkalian — B × A', run: (c) => {
        const A = c.A(), B = c.B();
        need(cols(B) === rows(A), `B × A: jumlah kolom B (${cols(B)}) harus sama dengan jumlah baris A (${rows(A)}).`);
        return { title: 'B × A', matrix: mulM(B, A) };
      } },
      { id: 'spl', label: 'SPL — A·x = b (b = kolom 1 matriks B)', run: (c) => {
        const A = c.A(), B = c.B();
        need(rows(A) === rows(B), `SPL: jumlah baris A (${rows(A)}) harus sama dengan jumlah baris B (${rows(B)}); b diambil dari kolom 1 B.`);
        const n = cols(A);
        const aug = A.map((r, i) => r.concat([B[i][0]]));
        const { m, pivots } = rrefM(aug, n);
        const info = { title: 'Solusi SPL A·x = b' };
        if (pivots.length < rows(A) && m.slice(pivots.length).some((r) => Math.abs(r[n]) > 1e-9 * (maxAbs(aug) || 1)))
          throw new Error('SPL tidak konsisten — tidak ada solusi.');
        if (pivots.length < n) {
          return { title: 'Solusi SPL A·x = b', scalars: [['rank(A)', String(pivots.length)], ['jumlah variabel', String(n)]],
            matrix: m, colLabels: Array.from({ length: n }, (_, i) => 'x' + (i + 1)).concat(['b']),
            note: 'Solusi tak hingga banyak (rank < jumlah variabel). Tabel menunjukkan bentuk eselon tereduksi [A | b].' };
        }
        info.matrix = Array.from({ length: n }, (_, i) => [m[i][n]]);
        info.rowLabels = Array.from({ length: n }, (_, i) => 'x' + (i + 1));
        info.note = 'Solusi tunggal.';
        return info;
      } },
    ] },
    { group: 'Satu matriks (pilih A atau B)', items: [
      { id: 'smul', unary: true, par: 'k', label: 'Perkalian skalar — k × M', run: (c) => {
        const M = c.M(), k = c.k();
        return { title: `${fmt(k)} × ${c.t}`, matrix: scaleM(M, k) };
      } },
      { id: 'tr', unary: true, label: 'Transpos — Mᵀ', run: (c) => ({ title: `${c.t}ᵀ`, matrix: transposeM(c.M()) }) },
      { id: 'det', unary: true, label: 'Determinan — det(M)', run: (c) => {
        const M = c.M(); square(M, c.t);
        const d = detM(M);
        return { title: `det(${c.t})`, scalars: [[`det(${c.t})`, fmt(d)]],
          note: d === 0 ? 'Determinan = 0: matriks singular (tidak punya invers).' : 'Determinan ≠ 0: matriks non-singular (punya invers).' };
      } },
      { id: 'inv', unary: true, label: 'Invers — M⁻¹', run: (c) => {
        const M = c.M(); square(M, c.t);
        const inv = inverseM(M);
        need(inv, `Matriks ${c.t} singular (determinan = 0) sehingga tidak punya invers.`);
        return { title: `${c.t}⁻¹`, scalars: [[`det(${c.t})`, fmt(detM(M))]], matrix: inv };
      } },
      { id: 'rank', unary: true, label: 'Rank — rank(M)', run: (c) => {
        const M = c.M(), r = rrefM(M).pivots.length, full = Math.min(rows(M), cols(M));
        return { title: `rank(${c.t})`, scalars: [[`rank(${c.t})`, String(r)]],
          note: r === full ? 'Rank penuh.' : `Rank kurang dari ${full} (baris/kolom saling bergantung linear).` };
      } },
      { id: 'trace', unary: true, label: 'Trace — tr(M)', run: (c) => {
        const M = c.M(); square(M, c.t);
        let t = 0; for (let i = 0; i < rows(M); i++) t += M[i][i];
        return { title: `tr(${c.t})`, scalars: [[`tr(${c.t})`, fmt(t)]] };
      } },
      { id: 'pow', unary: true, par: 'n', label: 'Pangkat — Mⁿ', run: (c) => {
        const M = c.M(), n = c.n(); square(M, c.t);
        const P = powerM(M, n);
        need(P, `Matriks ${c.t} singular, tidak bisa dipangkatkan negatif.`);
        return { title: `${c.t}^${n}`, matrix: P };
      } },
      { id: 'gram', unary: true, label: 'Perkalian transpos — MᵀM', run: (c) => {
        const M = c.M();
        return { title: `${c.t}ᵀ${c.t}`, matrix: mulM(transposeM(M), M) };
      } },
      { id: 'rref', unary: true, label: 'Eliminasi Gauss-Jordan (RREF)', run: (c) => {
        const M = c.M(), { m, pivots } = rrefM(M);
        return { title: `RREF(${c.t})`, matrix: m, scalars: [['rank', String(pivots.length)]],
          note: 'Bentuk eselon baris tereduksi.' };
      } },
      { id: 'eig', unary: true, label: 'Nilai eigen — λ', run: (c) => {
        const M = c.M(); square(M, c.t);
        const sym = isSymmetric(M);
        const e = sym ? jacobiEigen(M) : { values: qrEigenvalues(M) };
        const out = { title: `Nilai eigen ${c.t}`,
          scalars: e.values.map((z, i) => ['λ' + (i + 1), fmtC(z)]) };
        if (sym) {
          out.matrix = e.vectors;
          out.colLabels = e.values.map((_, i) => 'v' + (i + 1));
          out.note = 'Matriks simetris: semua nilai eigen real. Kolom tabel = vektor eigen (ortonormal) untuk λ yang bersesuaian.';
        } else {
          out.note = 'Matriks tidak simetris: nilai eigen dihitung numerik dengan iterasi QR (bentuk a ± bi berarti pasangan kompleks).';
        }
        return out;
      } },
    ] },
    { group: 'Statistik', items: [
      { id: 'ols', label: 'Regresi OLS — β = (XᵀX)⁻¹Xᵀy (X = A, y = kolom 1 B)', run: (c) => {
        const X = c.A(), B = c.B(), n = rows(X), p = cols(X);
        need(rows(B) === n, `OLS: jumlah baris A (${n}) harus sama dengan jumlah baris B (${rows(B)}); y diambil dari kolom 1 B.`);
        need(n >= p, `OLS: jumlah observasi (${n}) harus ≥ jumlah variabel (${p}).`);
        const y = B.map((r) => [r[0]]), Xt = transposeM(X);
        const inv = inverseM(mulM(Xt, X));
        need(inv, 'XᵀX singular — ada kolom X yang saling bergantung linear (mis. kolom konstanta ganda).');
        const beta = mulM(inv, mulM(Xt, y));
        const fit = mulM(X, beta);
        let sse = 0; for (let i = 0; i < n; i++) sse += (y[i][0] - fit[i][0]) ** 2;
        const hasConst = Array.from({ length: p }, (_, j) => X.every((r) => Math.abs(r[j] - 1) < 1e-12)).some(Boolean);
        const scalars = [['n (observasi)', String(n)], ['p (parameter)', String(p)], ['SSE', fmt(sse)]];
        let note = 'Tambahkan satu kolom berisi angka 1 pada A bila model memerlukan intersep.';
        if (hasConst) {
          const ym = y.reduce((s, r) => s + r[0], 0) / n;
          const sst = y.reduce((s, r) => s + (r[0] - ym) ** 2, 0);
          if (sst > 0) scalars.push(['R²', fmt(1 - sse / sst)]);
          note = 'Kolom konstanta (angka 1) terdeteksi sebagai intersep.';
        }
        return { title: 'Koefisien OLS (β)', scalars, matrix: beta,
          rowLabels: Array.from({ length: p }, (_, i) => 'β' + (i + 1)), note };
      } },
    ] },
  ];

  const core = { parseCell, fmt, fmtC, detM, inverseM, rrefM, mulM, transposeM, powerM,
    jacobiEigen, qrEigenvalues, isSymmetric, OPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;

  /* ======================================================================
     2. ANTARMUKA
     ====================================================================== */
  if (typeof document === 'undefined') return;
  const view = document.getElementById('view-matriks');
  if (!view) return;

  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const SAMPLE = {
    A: [['2', '1', '0'], ['1', '3', '1'], ['0', '1', '4']],
    B: [['1', '2', '3'], ['0', '1', '4'], ['5', '6', '0']],
  };
  const state = {
    A: { r: 3, c: 3, v: clone(SAMPLE.A) },
    B: { r: 3, c: 3, v: clone(SAMPLE.B) },
  };
  let last = null; // hasil terakhir

  const css = document.createElement('style');
  css.textContent = `
    #view-matriks .chapter-inner{ max-width:1040px; }
    #view-matriks .mx-pair{ display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr)); gap:20px; align-items:start; }
    #view-matriks .mx-card{ padding:20px 20px 22px; min-width:0; }
    #view-matriks .mx-card h2{ margin:0 0 12px; font-size:22px; }
    #view-matriks .mx-size{ display:flex; flex-wrap:wrap; gap:10px 18px; margin-bottom:14px; }
    #view-matriks .mx-sz{ display:flex; align-items:center; gap:8px; }
    #view-matriks .mx-sz .stepper input{ width:48px; }
    #view-matriks .mx-scroll{ overflow-x:auto; padding:2px 0 8px; }
    #view-matriks .mx-grid{ display:inline-grid; gap:6px; padding:8px 10px; border-left:3px solid var(--accent); border-right:3px solid var(--accent); border-radius:10px; }
    #view-matriks .mx-grid input{ width:64px; height:42px; text-align:center; font-family:var(--font-mono); font-size:15px; border:1px solid var(--rule-strong); border-radius:8px; background:#fff; color:var(--ink); padding:0 4px; }
    #view-matriks .mx-grid input:focus{ outline:2px solid var(--accent-2); outline-offset:1px; }
    #view-matriks .mx-grid input.bad{ border-color:var(--bad); background:var(--bad-bg); }
    #view-matriks .mx-tools{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    #view-matriks .mx-tools .btn-ghost{ min-height:36px; padding:6px 12px; font-size:13px; }
    #view-matriks .mx-tip{ margin:10px 0 0; font-size:12.5px; color:var(--ink-faint); }
    #view-matriks .mx-ops{ display:flex; flex-wrap:wrap; align-items:flex-end; gap:14px; }
    #view-matriks .mx-fld{ display:flex; flex-direction:column; gap:6px; min-width:0; }
    #view-matriks .mx-fld .select-input{ min-width:0; width:100%; }
    #view-matriks .mx-fld.grow{ flex:1 1 320px; }
    #view-matriks .mx-fld[hidden]{ display:none; }
    #view-matriks .mx-fld .plain-input{ width:110px; }
    #view-matriks .mx-title{ font-family:var(--font-mono); font-size:15px; font-weight:600; color:var(--accent); margin:0 0 12px; }
    #view-matriks .mx-scalars{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
    #view-matriks .mx-chip{ display:inline-flex; gap:8px; align-items:baseline; padding:8px 12px; border:1px solid var(--rule); border-radius:10px; background:var(--paper-2); font-family:var(--font-mono); font-size:15px; }
    #view-matriks .mx-chip b{ color:var(--ink-soft); font-weight:600; }
    #view-matriks .mx-res-scroll{ overflow-x:auto; padding-bottom:6px; }
    #view-matriks table.mx-res{ border-collapse:separate; border-spacing:6px; font-family:var(--font-mono); font-size:15px; border-left:3px solid var(--accent); border-right:3px solid var(--accent); border-radius:10px; }
    #view-matriks table.mx-res td{ min-width:64px; padding:9px 10px; text-align:center; background:var(--paper-2); border-radius:8px; white-space:nowrap; }
    #view-matriks table.mx-res th{ font-size:12px; font-weight:600; color:var(--ink-faint); padding:0 6px; }
    #view-matriks .mx-note{ margin:12px 0 0; font-size:13.5px; color:var(--ink-soft); }
    #view-matriks .mx-actions{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:16px; }
    #view-matriks .mx-actions .btn-ghost{ min-height:38px; padding:6px 14px; font-size:13.5px; }
    #view-matriks .mx-status{ font-size:13px; color:var(--good); font-weight:600; }
    #view-matriks [hidden]{ display:none !important; }
    @media (max-width:520px){
      #view-matriks .mx-card{ padding:16px 14px 18px; }
      #view-matriks .mx-grid input{ width:58px; height:42px; }
    }
  `;
  document.head.appendChild(css);

  const stepper = (key, dim, label) => `
    <div class="mx-sz"><label for="mx_${key}_${dim}">${label}</label>
      <div class="stepper">
        <button type="button" data-act="dec" data-key="${key}" data-dim="${dim}" aria-label="Kurangi ${label.toLowerCase()} ${key}">&minus;</button>
        <input id="mx_${key}_${dim}" type="number" inputmode="numeric" min="1" max="${MAX}" value="${state[key][dim]}" data-key="${key}" data-dim="${dim}">
        <button type="button" data-act="inc" data-key="${key}" data-dim="${dim}" aria-label="Tambah ${label.toLowerCase()} ${key}">+</button>
      </div></div>`;

  const matCard = (key) => `
    <section class="card mx-card">
      <h2>Matriks ${key}</h2>
      <div class="mx-size">${stepper(key, 'r', 'Baris')}${stepper(key, 'c', 'Kolom')}</div>
      <div class="mx-scroll"><div class="mx-grid" id="mxGrid_${key}"></div></div>
      <div class="mx-tools">
        <button type="button" class="btn-ghost" data-tool="sample" data-key="${key}">Contoh</button>
        <button type="button" class="btn-ghost" data-tool="ident" data-key="${key}">Identitas</button>
        <button type="button" class="btn-ghost" data-tool="clear" data-key="${key}">Kosongkan</button>
      </div>
      ${key === 'A' ? '<p class="mx-tip">Sel kosong dianggap 0. Boleh pakai pecahan (1/2) atau koma desimal (3,5). Tempel blok sel dari Excel ke sel mana pun — ukuran menyesuaikan (maks. ' + MAX + '×' + MAX + ').</p>' : ''}
    </section>`;

  view.innerHTML = `
    <div class="chapter-inner">
      <div class="chapter-head">
        <span class="eyebrow">Alat Bantu</span>
        <h1>Kalkulator Matriks</h1>
        <p class="lede">Isi matriks A dan B, pilih operasi, lalu hitung: penjumlahan, perkalian, determinan, invers, rank, nilai eigen, SPL, hingga regresi OLS.</p>
      </div>
      <div class="mx-pair">${matCard('A')}${matCard('B')}</div>

      <section class="card mx-card">
        <h2>Operasi</h2>
        <div class="mx-ops">
          <div class="mx-fld grow"><label for="mxOp">Pilih operasi</label>
            <select id="mxOp" class="select-input">${OPS.map((g) =>
              `<optgroup label="${esc(g.group)}">${g.items.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('')}</optgroup>`).join('')}</select></div>
          <div class="mx-fld" id="mxTargetWrap" hidden><label for="mxTarget">Terapkan pada</label>
            <select id="mxTarget" class="select-input"><option value="A">Matriks A</option><option value="B">Matriks B</option></select></div>
          <div class="mx-fld" id="mxParWrap" hidden><label for="mxPar" id="mxParLbl">Nilai</label>
            <input id="mxPar" class="plain-input" type="text" inputmode="decimal" value="2"></div>
          <div class="mx-fld"><button type="button" class="btn-primary" id="mxRun">Hitung</button></div>
          <div class="mx-fld"><button type="button" class="btn-ghost" id="mxSwap">Tukar A ↔ B</button></div>
        </div>
        <div class="error-msg" id="mxErr" role="alert" hidden></div>
      </section>

      <section class="card mx-card" id="mxResCard" hidden>
        <h2>Hasil</h2>
        <div id="mxRes"></div>
        <div class="mx-actions" id="mxActions">
          <button type="button" class="btn-ghost" id="mxCopy">Salin hasil</button>
          <button type="button" class="btn-ghost" id="mxToA">Jadikan matriks A</button>
          <button type="button" class="btn-ghost" id="mxToB">Jadikan matriks B</button>
          <span class="mx-status" id="mxStatus" role="status"></span>
        </div>
      </section>
    </div>`;

  const $ = (s) => view.querySelector(s);

  /* ---- Grid matriks ---- */
  function renderGrid(key) {
    const m = state[key], g = $('#mxGrid_' + key);
    g.style.gridTemplateColumns = `repeat(${m.c}, auto)`;
    let h = '';
    for (let i = 0; i < m.r; i++) for (let j = 0; j < m.c; j++)
      h += `<input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-key="${key}" data-r="${i}" data-c="${j}" aria-label="${key} baris ${i + 1} kolom ${j + 1}" placeholder="0" value="${esc(m.v[i][j])}">`;
    g.innerHTML = h;
    view.querySelector(`#mx_${key}_r`).value = m.r;
    view.querySelector(`#mx_${key}_c`).value = m.c;
  }
  function resize(key, r, c) {
    const m = state[key];
    r = Math.min(MAX, Math.max(1, r | 0)); c = Math.min(MAX, Math.max(1, c | 0));
    const v = Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (m.v[i] && m.v[i][j]) || ''));
    m.r = r; m.c = c; m.v = v;
    renderGrid(key);
  }
  const focusCell = (key, r, c) => {
    const el = view.querySelector(`#mxGrid_${key} input[data-r="${r}"][data-c="${c}"]`);
    if (el) { el.focus(); el.select(); }
    return !!el;
  };

  view.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('.mx-grid input')) { state[t.dataset.key].v[+t.dataset.r][+t.dataset.c] = t.value; t.classList.remove('bad'); }
  });
  view.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('.stepper input')) {
      const m = state[t.dataset.key], val = parseInt(t.value, 10) || 1;
      resize(t.dataset.key, t.dataset.dim === 'r' ? val : m.r, t.dataset.dim === 'c' ? val : m.c);
    }
  });
  view.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!t.matches('.mx-grid input')) return;
    const key = t.dataset.key, r = +t.dataset.r, c = +t.dataset.c;
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(key, r + 1, c) || (e.key === 'Enter' && focusCell(key, 0, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(key, r - 1, c); }
    else if (e.key === 'ArrowLeft' && t.selectionStart === 0 && t.selectionEnd === 0) { e.preventDefault(); focusCell(key, r, c - 1); }
    else if (e.key === 'ArrowRight' && t.selectionStart === t.value.length) { e.preventDefault(); focusCell(key, r, c + 1); }
  });
  view.addEventListener('paste', (e) => {
    const t = e.target;
    if (!t.matches || !t.matches('.mx-grid input')) return;
    const txt = (e.clipboardData || window.clipboardData).getData('text');
    if (!/[\t\n\r]/.test(txt.trim())) return; // satu nilai: tempel biasa
    e.preventDefault();
    const key = t.dataset.key, r0 = +t.dataset.r, c0 = +t.dataset.c;
    const block = txt.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
    const m = state[key];
    const nr = Math.min(MAX, Math.max(m.r, r0 + block.length));
    const nc = Math.min(MAX, Math.max(m.c, c0 + Math.max(...block.map((x) => x.length))));
    resize(key, nr, nc);
    block.forEach((line, i) => line.forEach((val, j) => {
      if (r0 + i < MAX && c0 + j < MAX) m.v[r0 + i][c0 + j] = val.trim();
    }));
    renderGrid(key); focusCell(key, r0, c0);
  });

  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = b.dataset.key;
    if (b.dataset.act) {
      const m = state[key], d = b.dataset.dim, delta = b.dataset.act === 'inc' ? 1 : -1;
      resize(key, d === 'r' ? m.r + delta : m.r, d === 'c' ? m.c + delta : m.c);
    } else if (b.dataset.tool === 'sample') {
      state[key] = { r: SAMPLE[key].length, c: SAMPLE[key][0].length, v: clone(SAMPLE[key]) }; renderGrid(key);
    } else if (b.dataset.tool === 'ident') {
      const m = state[key];
      m.v = Array.from({ length: m.r }, (_, i) => Array.from({ length: m.c }, (_, j) => (i === j ? '1' : '0'))); renderGrid(key);
    } else if (b.dataset.tool === 'clear') {
      const m = state[key]; m.v = Array.from({ length: m.r }, () => Array(m.c).fill('')); renderGrid(key);
    }
  });

  /* ---- Operasi ---- */
  const opSel = $('#mxOp'), tgtSel = $('#mxTarget'), parIn = $('#mxPar');
  const findOp = (id) => OPS.reduce((f, g) => f || g.items.find((o) => o.id === id), null);
  function syncOp() {
    const o = findOp(opSel.value);
    $('#mxTargetWrap').hidden = !o.unary;
    $('#mxParWrap').hidden = !o.par;
    if (o.par === 'k') { $('#mxParLbl').textContent = 'Skalar (k)'; if (parIn.dataset.for !== 'k') parIn.value = '2'; }
    if (o.par === 'n') { $('#mxParLbl').textContent = 'Pangkat (n)'; if (parIn.dataset.for !== 'n') parIn.value = '2'; }
    if (o.par) parIn.dataset.for = o.par;
  }
  opSel.addEventListener('change', syncOp); syncOp();

  function readMat(key) {
    const m = state[key], out = zeros(m.r, m.c);
    let badEl = null;
    view.querySelectorAll(`#mxGrid_${key} input`).forEach((el) => el.classList.remove('bad'));
    for (let i = 0; i < m.r; i++) for (let j = 0; j < m.c; j++) {
      const x = parseCell(m.v[i][j]);
      if (!isFinite(x)) {
        const el = view.querySelector(`#mxGrid_${key} input[data-r="${i}"][data-c="${j}"]`);
        if (el) el.classList.add('bad');
        if (!badEl) badEl = { i, j, s: m.v[i][j] };
      } else out[i][j] = x;
    }
    if (badEl) throw new Error(`Sel ${key}[baris ${badEl.i + 1}, kolom ${badEl.j + 1}] tidak valid: "${badEl.s}". Gunakan angka, pecahan (1/2), atau kosongkan.`);
    return out;
  }

  const showErr = (msg) => { const el = $('#mxErr'); el.textContent = msg; el.hidden = !msg; };

  function matTable(res) {
    const R = rows(res.matrix), C = cols(res.matrix);
    let h = '<div class="mx-res-scroll"><table class="mx-res">';
    if (res.colLabels) h += '<thead><tr>' + (res.rowLabels ? '<th></th>' : '') + res.colLabels.map((l) => `<th>${esc(l)}</th>`).join('') + '</tr></thead>';
    h += '<tbody>';
    for (let i = 0; i < R; i++) {
      h += '<tr>' + (res.rowLabels ? `<th>${esc(res.rowLabels[i])}</th>` : '');
      for (let j = 0; j < C; j++) h += `<td>${esc(fmt(res.matrix[i][j]))}</td>`;
      h += '</tr>';
    }
    return h + '</tbody></table></div>';
  }

  function showResult(res) {
    last = res;
    const dup = res.scalars && res.scalars.length === 1 && res.scalars[0][0] === res.title && !res.matrix;
    let h = dup ? '' : `<p class="mx-title">${esc(res.title)}</p>`;
    if (res.scalars) h += '<div class="mx-scalars">' + res.scalars.map(([l, v]) => `<span class="mx-chip"><b>${esc(l)}</b> ${esc(v)}</span>`).join('') + '</div>';
    if (res.matrix) h += matTable(res);
    if (res.note) h += `<p class="mx-note">${esc(res.note)}</p>`;
    $('#mxRes').innerHTML = h;
    $('#mxToA').hidden = $('#mxToB').hidden = !res.matrix;
    $('#mxStatus').textContent = '';
    $('#mxResCard').hidden = false;
  }

  function run() {
    showErr('');
    try {
      const o = findOp(opSel.value), t = tgtSel.value;
      const ctx = {
        A: () => readMat('A'), B: () => readMat('B'),
        M: () => readMat(t), t,
        k: () => { const k = parseCell(parIn.value); need(isFinite(k), 'Nilai k tidak valid.'); return k; },
        n: () => {
          const n = parseCell(parIn.value);
          need(Number.isInteger(n) && Math.abs(n) <= 100, 'Pangkat n harus bilangan bulat antara −100 dan 100.');
          return n;
        },
      };
      showResult(o.run(ctx));
      $('#mxResCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      showErr(err.message || String(err));
      $('#mxResCard').hidden = true;
    }
  }
  $('#mxRun').addEventListener('click', run);
  parIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  $('#mxSwap').addEventListener('click', () => {
    [state.A, state.B] = [state.B, state.A];
    renderGrid('A'); renderGrid('B');
  });

  /* ---- Aksi hasil ---- */
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
    return new Promise((ok, no) => {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? ok() : no(); } catch (e) { no(e); } finally { ta.remove(); }
    });
  }
  const flash = (msg) => { const s = $('#mxStatus'); s.textContent = msg; setTimeout(() => { if (s.textContent === msg) s.textContent = ''; }, 2200); };

  $('#mxCopy').addEventListener('click', () => {
    if (!last) return;
    const txt = last.matrix
      ? last.matrix.map((r) => r.map((x) => exact(x)).join('\t')).join('\n')
      : (last.scalars || []).map(([l, v]) => `${l}\t${v}`).join('\n');
    copyText(txt).then(() => flash('Tersalin — siap ditempel ke Excel ✓'), () => flash('Gagal menyalin'));
  });
  function sendTo(key) {
    if (!last || !last.matrix) return;
    const mx = last.matrix;
    if (rows(mx) > MAX || cols(mx) > MAX) { flash(`Ukuran terlalu besar (maks. ${MAX}×${MAX})`); return; }
    state[key] = { r: rows(mx), c: cols(mx), v: mx.map((r) => r.map(exact)) };
    renderGrid(key); flash(`Hasil dipindahkan ke matriks ${key} ✓`);
  }
  $('#mxToA').addEventListener('click', () => sendTo('A'));
  $('#mxToB').addEventListener('click', () => sendTo('B'));

  renderGrid('A'); renderGrid('B');
  window.StatCalcMatriks = { reset: () => { showErr(''); } };
})();
