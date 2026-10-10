/* =========================================================================
   MATRIKS.JS - Kalkulator Matriks untuk StatCalc
   -------------------------------------------------------------------------
   Bagian 1: inti matematika (murni, tanpa DOM - bisa diuji di Node)
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

  /* ---------- Pembantu penyusun langkah-langkah ---------- */
  const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-12;
  const allInt = (...ms) => ms.every((m) => m.every((r) => r.every(isInt)));
  /* Pecahan sederhana (penyebut ≤ 1000) bila cocok, selain itu desimal */
  function frac(x) {
    if (Math.abs(x) < 1e-10) return '0';
    if (isInt(x)) return String(Math.round(x));
    const a = Math.abs(x), sg = x < 0 ? '-' : '';
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, b = a;
    for (let i = 0; i < 24; i++) {
      const ai = Math.floor(b), h2 = ai * h1 + h0, k2 = ai * k1 + k0;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (k1 > 1000) break;
      if (Math.abs(a - h1 / k1) < 1e-9 * Math.max(1, a)) return sg + h1 + '/' + k1;
      const f = b - ai; if (f < 1e-12) break; b = 1 / f;
    }
    return fmt(x);
  }
  const par = (s) => (/^-|\//.test(s) ? `(${s})` : s);                // bungkus negatif / pecahan
  const tm = (x, F) => par(F(x));
  const coef = (f, F) => { const s = F(f); return s === '1' ? '' : (s.includes('/') ? `(${s})` : s) + '·'; };
  const mat = (m, F) => m.map((r) => r.map((x) => F(x)));
  const S = (title, o) => Object.assign({ title }, o || {});
  const SUP = ['', '', '²', '³'];
  function polyStr(cs, F) {
    const n = cs.length - 1; let s = '';
    cs.forEach((c, i) => {
      const k = n - i; if (Math.abs(c) < 1e-10) return;
      const a = Math.abs(c);
      const body = ((k === 0 || Math.abs(a - 1) > 1e-12) ? F(a) : '') + (k === 0 ? '' : k === 1 ? 'λ' : 'λ' + SUP[k]);
      s += s ? (c < 0 ? ' − ' : ' + ') + body : (c < 0 ? '-' : '') + body;
    });
    return s + ' = 0';
  }

  /* Gauss-Jordan dengan catatan tiap langkah (pivot = baris pertama yang tak nol) */
  function gjTrace(M, lim, F, sep) {
    const m = clone(M), R = rows(m), C = cols(m), L = lim == null ? C : lim;
    const scale = maxAbs(M) || 1, tol = 1e-10 * scale, blocks = [], pivots = [];
    let r = 0;
    for (let c = 0; c < L && r < R; c++) {
      let p = -1;
      for (let i = r; i < R; i++) if (Math.abs(m[i][c]) > tol) { p = i; break; }
      if (p < 0) {
        for (let i = r; i < R; i++) m[i][c] = 0;
        blocks.push(S(`Kolom ${c + 1}`, { p: `Semua elemen kolom ${c + 1} dari baris ${r + 1} ke bawah bernilai 0, jadi tidak ada pivot di kolom ini. Lanjut ke kolom berikutnya.` }));
        continue;
      }
      const ops = [];
      if (p !== r) { [m[p], m[r]] = [m[r], m[p]]; ops.push(`R${r + 1} ↔ R${p + 1}   (tukar baris agar pivot tidak nol)`); }
      const pv = m[r][c];
      if (Math.abs(pv - 1) > 1e-12) { for (let j = 0; j < C; j++) m[r][j] /= pv; ops.push(`R${r + 1} ← R${r + 1} ÷ ${par(F(pv))}   (pivot menjadi 1)`); }
      m[r][c] = 1;
      for (let i = 0; i < R; i++) {
        if (i === r) continue;
        const f = m[i][c];
        if (Math.abs(f) <= 1e-12 * scale) { m[i][c] = 0; continue; }
        for (let j = 0; j < C; j++) m[i][j] -= f * m[r][j];
        m[i][c] = 0;
        ops.push(`R${i + 1} ← R${i + 1} ${f > 0 ? '−' : '+'} ${coef(Math.abs(f), F)}R${r + 1}`);
      }
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (Math.abs(m[i][j]) < 1e-12 * scale) m[i][j] = 0;
      blocks.push(S(`Pivot kolom ${c + 1} (baris ${r + 1})`, {
        lines: ops.length ? ops : ['(tidak ada operasi diperlukan)'],
        mats: [{ label: 'Matriks sekarang', cells: mat(m, F), sep }],
      }));
      pivots.push(c); r++;
    }
    return { blocks, m, pivots };
  }

  /* Eliminasi maju (tanpa normalisasi) untuk determinan */
  function detElim(M, F) {
    const m = clone(M), n = rows(m), tol = 1e-11 * (maxAbs(M) || 1), blocks = [];
    let swaps = 0, singular = false;
    for (let c = 0; c < n; c++) {
      let p = -1;
      for (let i = c; i < n; i++) if (Math.abs(m[i][c]) > tol) { p = i; break; }
      if (p < 0) {
        blocks.push(S(`Kolom ${c + 1}`, { p: `Semua elemen kolom ${c + 1} dari baris ${c + 1} ke bawah bernilai 0 → tidak ada pivot → det = 0.` }));
        singular = true; break;
      }
      const ops = [];
      if (p !== c) { [m[p], m[c]] = [m[c], m[p]]; swaps++; ops.push(`R${c + 1} ↔ R${p + 1}   (tukar baris → tanda determinan berganti)`); }
      for (let i = c + 1; i < n; i++) {
        const f = m[i][c] / m[c][c];
        if (Math.abs(f) < 1e-12) { m[i][c] = 0; continue; }
        for (let j = 0; j < n; j++) m[i][j] -= f * m[c][j];
        m[i][c] = 0;
        ops.push(`R${i + 1} ← R${i + 1} ${f > 0 ? '−' : '+'} ${coef(Math.abs(f), F)}R${c + 1}`);
      }
      if (c === n - 1) continue;   // kolom terakhir: tidak ada elemen di bawah pivot
      blocks.push(S(`Nolkan elemen di bawah pivot kolom ${c + 1}`, {
        lines: ops.length ? ops : ['(elemen di bawah pivot sudah 0 - tidak ada operasi)'],
        mats: [{ label: 'Matriks sekarang', cells: mat(m, F) }],
      }));
    }
    return { blocks, m, swaps, singular };
  }

  function stepsMul(L, R, nl, nr, F) {
    const C = mulM(L, R), lines = [];
    for (let i = 0; i < rows(L); i++) for (let j = 0; j < cols(R); j++) {
      const terms = []; for (let k = 0; k < cols(L); k++) terms.push(`${tm(L[i][k], F)}·${tm(R[k][j], F)}`);
      lines.push(`c${i + 1}${j + 1} = ${terms.join(' + ')} = ${F(C[i][j])}`);
    }
    return [
      S('Periksa ukuran', { p: `${nl} berukuran ${sz(L)} dan ${nr} berukuran ${sz(R)}. Jumlah kolom ${nl} (${cols(L)}) sama dengan jumlah baris ${nr} (${rows(R)}), jadi keduanya dapat dikalikan. Hasilnya berukuran ${rows(L)}×${cols(R)}.` }),
      S('Rumus perkalian', { p: `cij = ai1·b1j + ai2·b2j + … + ain·bnj - baris ke-i dari ${nl} dikalikan dengan kolom ke-j dari ${nr}, lalu dijumlahkan.` }),
      S('Hitung setiap elemen', { lines }),
      S('Susun hasil', { mats: [{ label: 'Hasil', cells: mat(C, F) }] }),
    ];
  }

  function stepsDet(M, t, F) {
    const n = rows(M), st = [];
    if (n === 1) return [S('Matriks 1×1', { p: `det(${t}) = a₁₁ = ${F(M[0][0])}` })];
    if (n === 2) {
      const [[a, b], [c, d]] = M;
      return [
        S('Rumus determinan 2×2', { p: 'det = a·d − b·c  (diagonal utama dikurangi diagonal samping)' }),
        S('Substitusi angka', { lines: [`det = (${F(a)})(${F(d)}) − (${F(b)})(${F(c)})`, `    = ${F(a * d)} − ${tm(b * c, F)}`, `    = ${F(a * d - b * c)}`] }),
      ];
    }
    if (n === 3) {
      const g = (i, j) => M[i][j], T = (i, j, k) => g(0, i) * g(1, j) * g(2, k);
      const f3 = (i, j, k) => `${tm(g(0, i), F)}·${tm(g(1, j), F)}·${tm(g(2, k), F)}`;
      const plus = [[0, 1, 2], [1, 2, 0], [2, 0, 1]], minus = [[2, 1, 0], [0, 2, 1], [1, 0, 2]];
      const lines = [];
      plus.forEach((p) => lines.push(`+ ${f3(...p)} = ${F(T(...p))}`));
      minus.forEach((p) => lines.push(`− ${f3(...p)} = ${F(T(...p))}`));
      const total = plus.reduce((s, p) => s + T(...p), 0) - minus.reduce((s, p) => s + T(...p), 0);
      return [
        S('Aturan Sarrus (3×3)', { p: 'Jumlahkan tiga hasil kali diagonal utama (searah ↘), lalu kurangi tiga hasil kali diagonal samping (searah ↙).' }),
        S('Hitung keenam hasil kali', { lines }),
        S('Jumlahkan', { lines: [`det = ${plus.map((p) => F(T(...p))).join(' + ')} − (${minus.map((p) => F(T(...p))).join(' + ')})`, `    = ${F(total)}`] }),
      ];
    }
    const e = detElim(M, F);
    st.push(S('Metode eliminasi baris', { p: 'Ubah matriks menjadi segitiga atas dengan operasi baris Rᵢ ← Rᵢ − f·Rₚ (baris pivot = Rₚ) (nilai determinan tidak berubah). Tiap penukaran baris membalik tanda. Determinan = tanda × hasil kali diagonal.' }));
    e.blocks.forEach((b) => st.push(b));
    if (e.singular) st.push(S('Kesimpulan', { p: 'Ada kolom tanpa pivot → determinan = 0 (matriks singular).' }));
    else {
      const diag = e.m.map((r, i) => r[i]);
      const prod = diag.reduce((s, x) => s * x, 1) * (e.swaps % 2 ? -1 : 1);
      st.push(S('Kalikan diagonal', { lines: [`det = (-1)^${e.swaps} × ${diag.map((x) => tm(x, F)).join(' × ')}`, `    = ${F(prod)}`] }));
    }
    return st;
  }

  function stepsInverse(M, t, F, inv) {
    const n = rows(M), st = [];
    const d = detM(M);
    if (n === 1) return [S('Matriks 1×1', { lines: [`${t}⁻¹ = 1 / a₁₁ = 1 / ${F(M[0][0])} = ${F(inv[0][0])}`] })];
    if (n === 2) {
      const [[a, b], [c, dd]] = M;
      return [
        S('Hitung determinan', { lines: [`det = a·d − b·c = (${F(a)})(${F(dd)}) − (${F(b)})(${F(c)}) = ${F(d)}`], p: 'Determinan ≠ 0, jadi invers ada.' }),
        S('Rumus invers 2×2', { p: `${t}⁻¹ = (1/det) × [[d, −b], [−c, a]]  (tukar a↔d, ubah tanda b dan c)`, mats: [{ label: 'Matriks tukar', cells: [[F(dd), F(-b)], [F(-c), F(a)]] }] }),
        S('Kalikan dengan 1/det', { lines: [`${t}⁻¹ = (1/${par(F(d))}) × matriks di atas`], mats: [{ label: `${t}⁻¹`, cells: mat(inv, F) }] }),
      ];
    }
    const aug = M.map((r, i) => r.concat(ident(n)[i]));
    const g = gjTrace(aug, n, F, n);
    st.push(S('Metode Gauss-Jordan', { p: `Susun matriks gabungan [${t} | I]. Lakukan operasi baris hingga bagian kiri menjadi matriks identitas I; bagian kanan otomatis menjadi ${t}⁻¹.`, mats: [{ label: `[${t} | I]`, cells: mat(aug, F), sep: n }] }));
    g.blocks.forEach((b) => st.push(b));
    st.push(S('Baca hasil', { p: `Bagian kiri sudah menjadi I, maka bagian kanan adalah ${t}⁻¹.`, mats: [{ label: `${t}⁻¹`, cells: mat(inv, F) }] }));
    return st;
  }

  function stepsEig(M, t, vals, sym) {
    const n = rows(M), F = allInt(M) ? frac : fmt, st = [];
    let tr = 0; for (let i = 0; i < n; i++) tr += M[i][i];
    const d = detM(M);
    st.push(S('Persamaan karakteristik', { p: `Nilai eigen λ memenuhi det(${t} − λI) = 0.` }));
    if (n === 1) {
      st.push(S('Matriks 1×1', { lines: [`λ = a₁₁ = ${F(M[0][0])}`] }));
    } else if (n === 2) {
      const disc = tr * tr - 4 * d;
      st.push(S('Bentuk 2×2', { lines: [
        `tr(${t}) = ${F(M[0][0])} + ${F(M[1][1])} = ${F(tr)}`,
        `det(${t}) = ${F(d)}`,
        `Persamaan: ${polyStr([1, -tr, d], F)}`,
      ] }));
      st.push(S('Diskriminan', { lines: [`D = tr² − 4·det = ${F(tr * tr)} − 4(${F(d)}) = ${F(disc)}`],
        p: disc >= 0 ? 'D ≥ 0 → kedua akar real.' : 'D < 0 → akar berupa pasangan bilangan kompleks.' }));
      st.push(S('Akar-akar', { lines: ['λ = (tr ± √D) / 2', ...vals.map((z, i) => `λ${i + 1} = ${fmtC(z)}`)] }));
    } else if (n === 3) {
      const m12 = M[0][0] * M[1][1] - M[0][1] * M[1][0], m13 = M[0][0] * M[2][2] - M[0][2] * M[2][0], m23 = M[1][1] * M[2][2] - M[1][2] * M[2][1];
      const c2 = m12 + m13 + m23;
      st.push(S('Koefisien persamaan 3×3', { p: 'λ³ − c₁λ² + c₂λ − c₃ = 0, dengan c₁ = trace, c₂ = jumlah minor utama 2×2, c₃ = determinan.', lines: [
        `c₁ = tr(${t}) = ${F(M[0][0])} + ${F(M[1][1])} + ${F(M[2][2])} = ${F(tr)}`,
        `c₂ = (a₁₁a₂₂ − a₁₂a₂₁) + (a₁₁a₃₃ − a₁₃a₃₁) + (a₂₂a₃₃ − a₂₃a₃₂)`,
        `   = ${F(m12)} + ${tm(m13, F)} + ${tm(m23, F)} = ${F(c2)}`,
        `c₃ = det(${t}) = ${F(d)}`,
        `Persamaan: ${polyStr([1, -tr, c2, -d], F)}`,
      ] }));
      st.push(S('Akar-akar persamaan', { p: 'Akar-akarnya dicari secara numerik; itulah nilai eigen.', lines: vals.map((z, i) => `λ${i + 1} = ${fmtC(z)}`) }));
    } else {
      st.push(S('Metode numerik', { p: sym
        ? `Ukuran ${n}×${n} terlalu besar untuk diselesaikan dengan polinomial. Karena matriks simetris dipakai metode Jacobi: rotasi bidang diulang hingga elemen di luar diagonal ≈ 0; diagonal akhir adalah nilai eigen.`
        : `Ukuran ${n}×${n} terlalu besar untuk diselesaikan dengan polinomial. Dipakai iterasi QR: Aₖ = QₖRₖ lalu Aₖ₊₁ = RₖQₖ, diulang hingga hampir segitiga; nilai eigen dibaca dari diagonal (blok 2×2 berarti pasangan kompleks).`,
        lines: vals.map((z, i) => `λ${i + 1} = ${fmtC(z)}`) }));
    }
    if (sym) st.push(S('Vektor eigen', { p: `Untuk tiap λ, selesaikan (${t} − λI)v = 0 lalu normalkan v sehingga panjangnya 1. Hasilnya adalah kolom v₁, v₂, … pada tabel hasil.` }));
    let sRe = 0, prod = { re: 1, im: 0 };
    vals.forEach((z) => { sRe += z.re; prod = { re: prod.re * z.re - prod.im * z.im, im: prod.re * z.im + prod.im * z.re }; });
    st.push(S('Verifikasi', { lines: [
      `Σλ = ${vals.map((z) => par(fmtC(z))).join(' + ')} = ${fmt(sRe)}   (harus sama dengan trace = ${fmt(tr)})`,
      `Πλ = ${fmt(prod.re)}   (harus sama dengan det = ${fmt(d)})`,
    ] }));
    return st;
  }

  const OPS = [
    { group: 'Dua matriks (A dan B)', items: [
      { id: 'add', label: 'Penjumlahan - A + B', run: (c) => {
        const A = c.A(), B = c.B();
        need(rows(A) === rows(B) && cols(A) === cols(B), `A + B memerlukan ukuran yang sama (A: ${sz(A)}, B: ${sz(B)}).`);
        const C = addM(A, B, 1), F = allInt(A, B) ? frac : fmt;
        return { title: 'A + B', matrix: C, steps: [
          S('Periksa ukuran', { p: `A berukuran ${sz(A)} dan B berukuran ${sz(B)} → sama, jadi dapat dijumlahkan.` }),
          S('Jumlahkan elemen yang seletak', { p: 'Rumus: cij = aij + bij', mats: [{ label: 'aij + bij', cells: A.map((r, i) => r.map((x, j) => `${tm(x, F)} + ${tm(B[i][j], F)}`)) }] }),
          S('Hitung hasilnya', { mats: [{ label: 'A + B', cells: mat(C, F) }] }),
        ] };
      } },
      { id: 'sub', label: 'Pengurangan - A − B', run: (c) => {
        const A = c.A(), B = c.B();
        need(rows(A) === rows(B) && cols(A) === cols(B), `A − B memerlukan ukuran yang sama (A: ${sz(A)}, B: ${sz(B)}).`);
        const C = addM(A, B, -1), F = allInt(A, B) ? frac : fmt;
        return { title: 'A − B', matrix: C, steps: [
          S('Periksa ukuran', { p: `A berukuran ${sz(A)} dan B berukuran ${sz(B)} → sama, jadi dapat dikurangkan.` }),
          S('Kurangkan elemen yang seletak', { p: 'Rumus: cij = aij − bij', mats: [{ label: 'aij − bij', cells: A.map((r, i) => r.map((x, j) => `${tm(x, F)} − ${tm(B[i][j], F)}`)) }] }),
          S('Hitung hasilnya', { mats: [{ label: 'A − B', cells: mat(C, F) }] }),
        ] };
      } },
      { id: 'mul', label: 'Perkalian - A × B', run: (c) => {
        const A = c.A(), B = c.B();
        need(cols(A) === rows(B), `A × B: jumlah kolom A (${cols(A)}) harus sama dengan jumlah baris B (${rows(B)}).`);
        return { title: 'A × B', matrix: mulM(A, B), steps: stepsMul(A, B, 'A', 'B', allInt(A, B) ? frac : fmt) };
      } },
      { id: 'mulba', label: 'Perkalian - B × A', run: (c) => {
        const A = c.A(), B = c.B();
        need(cols(B) === rows(A), `B × A: jumlah kolom B (${cols(B)}) harus sama dengan jumlah baris A (${rows(A)}).`);
        return { title: 'B × A', matrix: mulM(B, A), steps: stepsMul(B, A, 'B', 'A', allInt(A, B) ? frac : fmt) };
      } },
      { id: 'spl', label: 'SPL - A·x = b (b = kolom 1 matriks B)', run: (c) => {
        const A = c.A(), B = c.B();
        need(rows(A) === rows(B), `SPL: jumlah baris A (${rows(A)}) harus sama dengan jumlah baris B (${rows(B)}); b diambil dari kolom 1 B.`);
        const n = cols(A), bcol = B.map((r) => [r[0]]), F = allInt(A, bcol) ? frac : fmt;
        const aug = A.map((r, i) => r.concat([B[i][0]]));
        const g = gjTrace(aug, n, F, n);
        const { m, pivots } = rrefM(aug, n);
        const steps = [
          S('Susun matriks gabungan', { p: 'Tiap persamaan menjadi satu baris pada [A | b]. Lalu lakukan operasi baris (Gauss-Jordan) hingga bagian kiri menjadi bentuk eselon tereduksi.', mats: [{ label: '[A | b]', cells: mat(aug, F), sep: n }] }),
          ...g.blocks,
        ];
        const labels = Array.from({ length: n }, (_, i) => 'x' + (i + 1));
        if (pivots.length < rows(A) && m.slice(pivots.length).some((r) => Math.abs(r[n]) > 1e-9 * (maxAbs(aug) || 1))) {
          steps.push(S('Kesimpulan', { p: 'Terdapat baris berbentuk [0 0 … 0 | c] dengan c ≠ 0, artinya 0 = c (mustahil). SPL tidak konsisten - tidak ada solusi.' }));
          return { title: 'SPL A·x = b', note: 'SPL tidak konsisten - tidak ada solusi.', matrix: m, colLabels: labels.concat(['b']), steps };
        }
        if (pivots.length < n) {
          steps.push(S('Kesimpulan', { p: `Rank = ${pivots.length} < jumlah variabel (${n}), ada variabel bebas → solusi tak hingga banyak.` }));
          return { title: 'Solusi SPL A·x = b', scalars: [['rank(A)', String(pivots.length)], ['jumlah variabel', String(n)]],
            matrix: m, colLabels: labels.concat(['b']),
            note: 'Solusi tak hingga banyak (rank < jumlah variabel). Tabel menunjukkan bentuk eselon tereduksi [A | b].', steps };
        }
        const x = Array.from({ length: n }, (_, i) => [m[i][n]]);
        steps.push(S('Baca solusi', { p: 'Bagian kiri sudah menjadi I, sehingga kolom terakhir adalah solusi.', lines: x.map((r, i) => `x${i + 1} = ${F(r[0])}`) }));
        return { title: 'Solusi SPL A·x = b', matrix: x, rowLabels: labels, note: 'Solusi tunggal.', steps };
      } },
    ] },
    { group: 'Satu matriks (pilih A atau B)', items: [
      { id: 'smul', unary: true, par: 'k', label: 'Perkalian skalar - k × M', run: (c) => {
        const M = c.M(), k = c.k(), F = allInt(M) && isInt(k) ? frac : fmt;
        return { title: `${fmt(k)} × ${c.t}`, matrix: scaleM(M, k), steps: [
          S('Kalikan setiap elemen dengan k', { p: `Rumus: cij = k · aij, dengan k = ${F(k)}.`, mats: [{ label: 'k · aij', cells: M.map((r) => r.map((x) => `${par(F(k))}·${tm(x, F)}`)) }] }),
          S('Hitung hasilnya', { mats: [{ label: `${fmt(k)} × ${c.t}`, cells: mat(scaleM(M, k), F) }] }),
        ] };
      } },
      { id: 'tr', unary: true, label: 'Transpos - Mᵀ', run: (c) => {
        const M = c.M(), F = allInt(M) ? frac : fmt;
        return { title: `${c.t}ᵀ`, matrix: transposeM(M), steps: [
          S('Ukuran baru', { p: `${c.t} berukuran ${sz(M)}, maka ${c.t}ᵀ berukuran ${cols(M)}×${rows(M)}.` }),
          S('Tukar baris dengan kolom', { p: `Elemen aij pindah ke posisi aji: baris ke-i menjadi kolom ke-i.`, mats: [{ label: c.t, cells: mat(M, F) }, { label: `${c.t}ᵀ`, cells: mat(transposeM(M), F) }] }),
        ] };
      } },
      { id: 'det', unary: true, label: 'Determinan - det(M)', run: (c) => {
        const M = c.M(); square(M, c.t);
        const d = detM(M), F = allInt(M) ? frac : fmt;
        return { title: `det(${c.t})`, scalars: [[`det(${c.t})`, fmt(d)]],
          note: d === 0 ? 'Determinan = 0: matriks singular (tidak punya invers).' : 'Determinan ≠ 0: matriks non-singular (punya invers).',
          steps: stepsDet(M, c.t, F) };
      } },
      { id: 'inv', unary: true, label: 'Invers - M⁻¹', run: (c) => {
        const M = c.M(); square(M, c.t);
        const inv = inverseM(M);
        need(inv, `Matriks ${c.t} singular (determinan = 0) sehingga tidak punya invers.`);
        return { title: `${c.t}⁻¹`, scalars: [[`det(${c.t})`, fmt(detM(M))]], matrix: inv,
          steps: stepsInverse(M, c.t, allInt(M) ? frac : fmt, inv) };
      } },
      { id: 'rank', unary: true, label: 'Rank - rank(M)', run: (c) => {
        const M = c.M(), F = allInt(M) ? frac : fmt, g = gjTrace(M, null, F), r = g.pivots.length, full = Math.min(rows(M), cols(M));
        return { title: `rank(${c.t})`, scalars: [[`rank(${c.t})`, String(r)]],
          note: r === full ? 'Rank penuh.' : `Rank kurang dari ${full} (baris/kolom saling bergantung linear).`,
          steps: [
            S('Matriks awal', { p: 'Rank = banyaknya baris tak nol setelah matriks diubah ke bentuk eselon tereduksi dengan operasi baris.', mats: [{ label: c.t, cells: mat(M, F) }] }),
            ...g.blocks,
            S('Hitung rank', { p: `Terdapat ${r} baris yang tidak nol → rank(${c.t}) = ${r}.`, mats: [{ label: 'Bentuk akhir', cells: mat(g.m, F) }] }),
          ] };
      } },
      { id: 'trace', unary: true, label: 'Trace - tr(M)', run: (c) => {
        const M = c.M(); square(M, c.t);
        const F = allInt(M) ? frac : fmt, n = rows(M);
        let t = 0; for (let i = 0; i < n; i++) t += M[i][i];
        return { title: `tr(${c.t})`, scalars: [[`tr(${c.t})`, fmt(t)]], steps: [
          S('Jumlahkan elemen diagonal utama', { p: 'Trace = a₁₁ + a₂₂ + … + aₙₙ', lines: [`tr(${c.t}) = ${M.map((r, i) => tm(r[i], F)).join(' + ')}`, `       = ${F(t)}`] }),
        ] };
      } },
      { id: 'pow', unary: true, par: 'n', label: 'Pangkat - Mⁿ', run: (c) => {
        const M = c.M(), n = c.n(); square(M, c.t);
        const P = powerM(M, n);
        need(P, `Matriks ${c.t} singular, tidak bisa dipangkatkan negatif.`);
        const st = [], k = Math.abs(n);
        let base = M, nm = c.t, F = allInt(M) ? frac : fmt;
        if (n === 0) {
          st.push(S('Aturan pangkat nol', { p: `${c.t}⁰ = I (matriks identitas berukuran ${rows(M)}×${rows(M)}).`, mats: [{ label: 'I', cells: mat(P, F) }] }));
        } else {
          if (n < 0) {
            base = inverseM(M); nm = `(${c.t}⁻¹)`; F = allInt(base) ? frac : fmt;
            st.push(S('Pangkat negatif', { p: `${c.t}^${n} = (${c.t}⁻¹)^${k}. Cari invers terlebih dahulu.`, mats: [{ label: `${c.t}⁻¹`, cells: mat(base, F) }] }));
          }
          if (k === 1) st.push(S('Pangkat 1', { p: `Pangkat 1 sama dengan matriks itu sendiri.`, mats: [{ label: `${c.t}^${n}`, cells: mat(P, F) }] }));
          let cur = base;
          for (let e = 2; e <= Math.min(k, 6); e++) {
            const next = mulM(cur, base);
            st.push(S(`${nm}^${e} = ${nm}^${e - 1} × ${nm}`, { p: 'Perkalian matriks: baris × kolom.', mats: [{ label: `${nm}^${e}`, cells: mat(next, F) }] }));
            cur = next;
          }
          if (k > 6) st.push(S('Lanjutkan', { p: `Perkalian diteruskan sampai pangkat ${k} (di program memakai kuadrat berulang agar efisien). Hasil akhirnya ada pada tabel hasil.` }));
        }
        return { title: `${c.t}^${n}`, matrix: P, steps: st };
      } },
      { id: 'gram', unary: true, label: 'Perkalian transpos - MᵀM', run: (c) => {
        const M = c.M(), Mt = transposeM(M), F = allInt(M) ? frac : fmt;
        return { title: `${c.t}ᵀ${c.t}`, matrix: mulM(Mt, M), steps: [
          S(`Transposkan ${c.t}`, { mats: [{ label: c.t, cells: mat(M, F) }, { label: `${c.t}ᵀ`, cells: mat(Mt, F) }] }),
          ...stepsMul(Mt, M, `${c.t}ᵀ`, c.t, F),
        ] };
      } },
      { id: 'rref', unary: true, label: 'Eliminasi Gauss-Jordan (RREF)', run: (c) => {
        const M = c.M(), { m, pivots } = rrefM(M), F = allInt(M) ? frac : fmt, g = gjTrace(M, null, F);
        return { title: `RREF(${c.t})`, matrix: m, scalars: [['rank', String(pivots.length)]],
          note: 'Bentuk eselon baris tereduksi.', steps: [
            S('Matriks awal', { p: 'Tujuan: tiap pivot bernilai 1 dan semua elemen lain di kolom pivot bernilai 0, memakai operasi baris elementer (tukar baris, bagi baris, tambah kelipatan baris).', mats: [{ label: c.t, cells: mat(M, F) }] }),
            ...g.blocks,
            S('Hasil', { p: `Terdapat ${pivots.length} pivot → rank = ${pivots.length}.`, mats: [{ label: `RREF(${c.t})`, cells: mat(g.m, F) }] }),
          ] };
      } },
      { id: 'eig', unary: true, label: 'Nilai eigen - λ', run: (c) => {
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
        out.steps = stepsEig(M, c.t, e.values, sym);
        return out;
      } },
    ] },
    { group: 'Statistik', items: [
      { id: 'ols', label: 'Regresi OLS - β = (XᵀX)⁻¹Xᵀy (X = A, y = kolom 1 B)', run: (c) => {
        const X = c.A(), B = c.B(), n = rows(X), p = cols(X);
        need(rows(B) === n, `OLS: jumlah baris A (${n}) harus sama dengan jumlah baris B (${rows(B)}); y diambil dari kolom 1 B.`);
        need(n >= p, `OLS: jumlah observasi (${n}) harus ≥ jumlah variabel (${p}).`);
        const y = B.map((r) => [r[0]]), Xt = transposeM(X);
        const XtX = mulM(Xt, X), Xty = mulM(Xt, y);
        const inv = inverseM(XtX);
        need(inv, 'XᵀX singular - ada kolom X yang saling bergantung linear (mis. kolom konstanta ganda).');
        const beta = mulM(inv, Xty), fit = mulM(X, beta);
        const res = y.map((r, i) => [r[0] - fit[i][0]]);
        let sse = 0; for (let i = 0; i < n; i++) sse += res[i][0] ** 2;
        const hasConst = Array.from({ length: p }, (_, j) => X.every((r) => Math.abs(r[j] - 1) < 1e-12)).some(Boolean);
        const scalars = [['n (observasi)', String(n)], ['p (parameter)', String(p)], ['SSE', fmt(sse)]];
        let note = 'Tambahkan satu kolom berisi angka 1 pada A bila model memerlukan intersep.';
        const F = allInt(X, y) ? frac : fmt, Fd = fmt;
        const lines = [`SSE = Σ eᵢ² = ${res.map((r) => tm(r[0], Fd) + '²').join(' + ')} = ${fmt(sse)}`];
        if (hasConst) {
          const ym = y.reduce((s, r) => s + r[0], 0) / n;
          const sst = y.reduce((s, r) => s + (r[0] - ym) ** 2, 0);
          if (sst > 0) { scalars.push(['R²', fmt(1 - sse / sst)]); lines.push(`SST = Σ(yᵢ − ȳ)² = ${fmt(sst)}   (ȳ = ${fmt(ym)})`, `R² = 1 − SSE/SST = 1 − ${fmt(sse)}/${fmt(sst)} = ${fmt(1 - sse / sst)}`); }
          note = 'Kolom konstanta (angka 1) terdeteksi sebagai intersep.';
        }
        const lab = Array.from({ length: p }, (_, i) => 'β' + (i + 1));
        return { title: 'Koefisien OLS (β)', scalars, matrix: beta, rowLabels: lab, note, steps: [
          S('Data', { p: 'X = matriks A (tiap baris = satu observasi, tiap kolom = satu variabel), y = kolom 1 matriks B. Rumus kuadrat terkecil: β = (XᵀX)⁻¹ Xᵀ y.', mats: [{ label: 'X', cells: mat(X, F) }, { label: 'y', cells: mat(y, F) }] }),
          S('Transpos X', { mats: [{ label: 'Xᵀ', cells: mat(Xt, F) }] }),
          S('Hitung XᵀX', { p: `Ukuran ${sz(XtX)}.`, mats: [{ label: 'XᵀX', cells: mat(XtX, F) }] }),
          S('Hitung Xᵀy', { mats: [{ label: 'Xᵀy', cells: mat(Xty, F) }] }),
          S('Cari invers (XᵀX)⁻¹', { p: `det(XᵀX) = ${fmt(detM(XtX))} ≠ 0, jadi invers ada (cara mencarinya: lihat operasi Invers).`, mats: [{ label: '(XᵀX)⁻¹', cells: mat(inv, allInt(inv) ? frac : F === frac ? frac : fmt) }] }),
          S('Kalikan: β = (XᵀX)⁻¹ · Xᵀy', { mats: [{ label: 'β', cells: mat(beta, F === frac ? frac : fmt), rowLabels: lab }] }),
          S('Periksa kecocokan model', { p: 'ŷ = Xβ, galat e = y − ŷ.', mats: [{ label: 'ŷ', cells: mat(fit, Fd) }, { label: 'e = y − ŷ', cells: mat(res, Fd) }], lines }),
        ] };
      } },
    ] },
  ];

  const core = { parseCell, fmt, fmtC, detM, inverseM, rrefM, mulM, transposeM, powerM,
    jacobiEigen, qrEigenvalues, isSymmetric, OPS, frac };
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
    #view-matriks .mx-scroll{ overflow-x:auto; padding:2px 0 8px; text-align:center; }
    #view-matriks .mx-grid{ display:inline-grid; gap:6px; padding:8px 10px; border-left:3px solid var(--accent); border-right:3px solid var(--accent); border-radius:10px; }
    #view-matriks .mx-grid input{ width:64px; height:42px; text-align:center; font-family:var(--font-mono); font-size:15px; border:1px solid var(--rule-strong); border-radius:8px; background:#fff; color:var(--ink); padding:0 4px; }
    #view-matriks .mx-grid input:focus{ outline:2px solid var(--accent-2); outline-offset:1px; }
    #view-matriks .mx-grid input.bad{ border-color:var(--bad); background:var(--bad-bg); }
    #view-matriks .mx-tools{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:10px; }
    #view-matriks .mx-tools .btn-ghost{ width:100%; min-height:38px; padding:6px 8px; font-size:13px; white-space:nowrap; }
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
    #view-matriks .mx-steps{ margin-top:20px; border-top:1px solid var(--rule); padding-top:14px; }
    #view-matriks .mx-steps > summary{ cursor:pointer; font-family:var(--font-display); font-size:18px; font-weight:600; color:var(--ink); padding:4px 0 10px; }
    #view-matriks .mx-step{ display:flex; flex-direction:column; gap:8px; padding:12px 0 14px 14px; border-left:3px solid var(--accent-soft); margin-left:4px; min-width:0; }
    #view-matriks .mx-step-h{ display:flex; align-items:center; gap:10px; font-weight:700; font-size:14.5px; color:var(--ink); }
    #view-matriks .mx-step-n{ flex:none; display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:var(--accent); color:#fff; font-size:12.5px; font-family:var(--font-mono); margin-left:-28px; box-shadow:0 0 0 4px #fff; }
    #view-matriks .mx-step p{ margin:0; font-size:14px; color:var(--ink-soft); text-align:left; }
    #view-matriks pre.mx-lines{ margin:0; padding:10px 12px; background:var(--paper-2); border:1px solid var(--rule); border-radius:8px; font-family:var(--font-mono); font-size:13px; line-height:1.65; white-space:pre-wrap; word-break:break-word; color:var(--ink); }
    #view-matriks .mx-mats{ display:flex; flex-wrap:wrap; gap:14px 22px; align-items:flex-start; }
    #view-matriks .mx-fig{ margin:0; max-width:100%; }
    #view-matriks .mx-fig figcaption{ font-family:var(--font-mono); font-size:12.5px; color:var(--ink-faint); margin-bottom:4px; }
    #view-matriks table.mx-res td.sep{ border-left:2px dashed var(--accent-2); border-radius:0 8px 8px 0; }
    #view-matriks table.mx-res td.sep-l{ border-radius:8px 0 0 8px; }
    #view-matriks .mx-steps table.mx-res{ font-size:13.5px; border-spacing:4px; }
    #view-matriks .mx-steps table.mx-res td{ min-width:44px; padding:7px 8px; }
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
      ${key === 'A' ? '<p class="mx-tip">Sel kosong dianggap 0. Boleh pakai pecahan (1/2) atau koma desimal (3,5). Tempel blok sel dari Excel ke sel mana pun - ukuran menyesuaikan (maks. ' + MAX + '×' + MAX + ').</p>' : ''}
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
        <div id="mxSteps"></div>
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

  /* spec: { cells:[[string]], rowLabels?, colLabels?, sep? }  (sep = indeks kolom pertama setelah garis pemisah) */
  function tableHTML(spec) {
    const cells = spec.cells, R = cells.length, C = cells[0].length;
    let h = '<div class="mx-res-scroll"><table class="mx-res">';
    if (spec.colLabels) h += '<thead><tr>' + (spec.rowLabels ? '<th></th>' : '') + spec.colLabels.map((l) => `<th>${esc(l)}</th>`).join('') + '</tr></thead>';
    h += '<tbody>';
    for (let i = 0; i < R; i++) {
      h += '<tr>' + (spec.rowLabels ? `<th>${esc(spec.rowLabels[i])}</th>` : '');
      for (let j = 0; j < C; j++) h += `<td${spec.sep != null && j === spec.sep ? ' class="sep"' : ''}>${esc(cells[i][j])}</td>`;
      h += '</tr>';
    }
    return h + '</tbody></table></div>';
  }
  const matTable = (res) => tableHTML({ cells: res.matrix.map((r) => r.map(fmt)), rowLabels: res.rowLabels, colLabels: res.colLabels });

  function stepsHTML(steps) {
    return '<details class="mx-steps" open><summary>Langkah-langkah perhitungan</summary>' + steps.map((st, i) =>
      `<div class="mx-step"><div class="mx-step-h"><span class="mx-step-n">${i + 1}</span><span>${esc(st.title)}</span></div>` +
      (st.p ? `<p>${esc(st.p)}</p>` : '') +
      (st.lines ? `<pre class="mx-lines">${esc(st.lines.join('\n'))}</pre>` : '') +
      (st.mats ? '<div class="mx-mats">' + st.mats.map((m) =>
        `<figure class="mx-fig"><figcaption>${esc(m.label || '')}</figcaption>${tableHTML(m)}</figure>`).join('') + '</div>' : '') +
      '</div>').join('') + '</details>';
  }

  function showResult(res) {
    last = res;
    const dup = res.scalars && res.scalars.length === 1 && res.scalars[0][0] === res.title && !res.matrix;
    let h = dup ? '' : `<p class="mx-title">${esc(res.title)}</p>`;
    if (res.scalars) h += '<div class="mx-scalars">' + res.scalars.map(([l, v]) => `<span class="mx-chip"><b>${esc(l)}</b> ${esc(v)}</span>`).join('') + '</div>';
    if (res.matrix) h += matTable(res);
    if (res.note) h += `<p class="mx-note">${esc(res.note)}</p>`;
    $('#mxRes').innerHTML = h;
    $('#mxSteps').innerHTML = res.steps && res.steps.length ? stepsHTML(res.steps) : '';
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
    copyText(txt).then(() => flash('Tersalin - siap ditempel ke Excel ✓'), () => flash('Gagal menyalin'));
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
