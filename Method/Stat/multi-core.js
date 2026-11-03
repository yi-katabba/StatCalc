/* =========================================================================
   MULTI-CORE - inti hitungan Multivariate, Analisis Butir, dan Dekomposisi (tanpa DOM, bisa diuji di Node)
   -------------------------------------------------------------------------
   PCA, Analisis Faktor (ekstraksi komponen utama + rotasi varimax, KMO, Bartlett, skor faktor regresi),
   Klaster hierarki (single/complete/average/Ward), K-means (k-means++, multi-start), silhouette,
   Analisis butir (Cronbach alpha, korelasi item-total, validitas, split-half), Dekomposisi deret waktu klasik.
   Memakai window.StatDist. Muat SETELAH stat-dist.js.
   ========================================================================= */
(function () {
  'use strict';
  const D = window.StatDist;
  const sum = (a) => a.reduce((s, v) => s + v, 0), mean = (a) => sum(a) / a.length;
  const variance = (a) => { const m = mean(a); return sum(a.map((v) => (v - m) * (v - m))) / (a.length - 1); };
  const col = (X, j) => X.map((r) => r[j]);

  /* ---------------- aljabar linear kecil ---------------- */
  function eigSymFull(Ain) {   // Jacobi: nilai eigen menurun, vektor eigen sebagai baris V[j] (tanda: komponen terbesar positif)
    const n = Ain.length, A = Ain.map((r) => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j]; if (off < 1e-28) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let r = 0; r < n; r++) { const a = A[r][p], b = A[r][q]; A[r][p] = c * a - s * b; A[r][q] = s * a + c * b; }
        for (let r = 0; r < n; r++) { const a = A[p][r], b = A[q][r]; A[p][r] = c * a - s * b; A[q][r] = s * a + c * b; }
        for (let r = 0; r < n; r++) { const a = V[r][p], b = V[r][q]; V[r][p] = c * a - s * b; V[r][q] = s * a + c * b; }
      }
    }
    const idx = A.map((r, i) => i).sort((a, b) => A[b][b] - A[a][a]);
    const values = idx.map((i) => A[i][i]), vectors = idx.map((i) => { const v = V.map((r) => r[i]); let m = 0; v.forEach((x, k) => { if (Math.abs(x) > Math.abs(v[m])) m = k; }); return v[m] < 0 ? v.map((x) => -x) : v; });
    return { values, vectors };
  }
  function invert(Ain) {   // Gauss-Jordan dengan pivoting
    const n = Ain.length, A = Ain.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-12) { const e = new Error('singular'); e.singular = true; throw e; }
      [A[c], A[piv]] = [A[piv], A[c]]; const d = A[c][c]; for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f !== 0) for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j]; }
    }
    return A.map((r) => r.slice(n));
  }
  const matmul = (A, B) => A.map((r) => B[0].map((_, j) => sum(r.map((v, k) => v * B[k][j]))));
  function standardize(X, useSd) {
    const n = X.length, p = X[0].length, means = [], sds = [];
    for (let j = 0; j < p; j++) { const c = col(X, j); means.push(mean(c)); sds.push(useSd ? Math.sqrt(variance(c)) : 1); }
    return { Z: X.map((r) => r.map((v, j) => (v - means[j]) / sds[j])), means, sds };
  }
  function corrMatrix(X) { const { Z } = standardize(X, true), n = X.length, p = X[0].length; return Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => { let s = 0; for (let i = 0; i < n; i++) s += Z[i][a] * Z[i][b]; return s / (n - 1); })); }

  /* ------------------------------------ PCA ------------------------------------ */
  function pca(X, opts) {
    opts = Object.assign({ standardize: true }, opts || {}); const n = X.length, p = X[0].length, st = standardize(X, opts.standardize), Z = st.Z;
    const C = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => { let s = 0; for (let i = 0; i < n; i++) s += Z[i][a] * Z[i][b]; return s / (n - 1); }));
    const e = eigSymFull(C), tot = sum(e.values), ev = e.values.map((v) => Math.max(v, 0));
    const loadings = e.vectors.map((v, j) => v.map((x) => x * Math.sqrt(ev[j])));   // loadings[j][i] = beta variabel i pada komponen j
    const scores = Z.map((r) => e.vectors.map((v) => sum(r.map((x, i) => x * v[i]))));
    let cum = 0; const prop = ev.map((v) => v / tot), cumul = prop.map((v) => (cum += v));
    return { n, p, means: st.means, sds: st.sds, C, eigenvalues: ev, vectors: e.vectors, loadings, scores, prop, cumul, total: tot, standardized: opts.standardize };
  }

  /* --------------------------- KMO & Bartlett (kecocokan data) --------------------------- */
  function kmoBartlett(X) {
    const n = X.length, p = X[0].length, R = corrMatrix(X), S = invert(R);
    let r2 = 0, q2 = 0; const msa = new Array(p).fill(0), rr = new Array(p).fill(0), qq = new Array(p).fill(0);
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) if (i !== j) { const pc = -S[i][j] / Math.sqrt(S[i][i] * S[j][j]); r2 += R[i][j] ** 2; q2 += pc * pc; rr[i] += R[i][j] ** 2; qq[i] += pc * pc; }
    for (let i = 0; i < p; i++) msa[i] = rr[i] / (rr[i] + qq[i]);
    const ev = eigSymFull(R).values, lnDet = sum(ev.map((v) => Math.log(Math.max(v, 1e-300)))), chi = -(n - 1 - (2 * p + 5) / 6) * lnDet, df = p * (p - 1) / 2;
    return { R, kmo: r2 / (r2 + q2), msa, chi2: chi, df, p: D.chi2Sf(chi, df), det: Math.exp(lnDet) };
  }

  /* ---------------- rotasi varimax (Kaiser, pasangan kolom, dinormalisasi baris) ---------------- */
  function varimax(L0, normalize) {   // L0: p x k
    const p = L0.length, k = L0[0].length, h = L0.map((r) => Math.sqrt(sum(r.map((v) => v * v)))), L = L0.map((r, i) => r.map((v) => (normalize && h[i] > 0 ? v / h[i] : v)));
    for (let it = 0; it < 500; it++) {
      let changed = 0;
      for (let a = 0; a < k - 1; a++) for (let b = a + 1; b < k; b++) {
        let A = 0, B = 0, C = 0, Dd = 0;
        for (let i = 0; i < p; i++) { const x = L[i][a], y = L[i][b], u = x * x - y * y, v = 2 * x * y; A += u; B += v; C += u * u - v * v; Dd += 2 * u * v; }
        const num = Dd - 2 * A * B / p, den = C - (A * A - B * B) / p, ang = Math.atan2(num, den) / 4;
        if (Math.abs(ang) > 1e-10) { const c = Math.cos(ang), s = Math.sin(ang); for (let i = 0; i < p; i++) { const x = L[i][a], y = L[i][b]; L[i][a] = c * x + s * y; L[i][b] = -s * x + c * y; } changed = Math.max(changed, Math.abs(ang)); }
      }
      if (changed < 1e-9) break;
    }
    return L.map((r, i) => r.map((v) => (normalize ? v * h[i] : v)));
  }

  /* ------------------------------- analisis faktor ------------------------------- */
  function factorAnalysis(X, nf, opts) {
    opts = Object.assign({ rotate: true }, opts || {}); const n = X.length, p = X[0].length, kb = kmoBartlett(X), R = kb.R, e = eigSymFull(R), ev = e.values.map((v) => Math.max(v, 0));
    let L = Array.from({ length: p }, (_, i) => Array.from({ length: nf }, (_, j) => e.vectors[j][i] * Math.sqrt(ev[j])));   // p x nf
    const unrot = L.map((r) => r.slice()); let rot = opts.rotate && nf > 1 ? varimax(L, true) : L.map((r) => r.slice());
    // urutkan faktor menurut SS loading menurun & tanda jumlah positif
    const ss0 = Array.from({ length: nf }, (_, j) => sum(rot.map((r) => r[j] * r[j]))), ord = ss0.map((v, j) => j).sort((a, b) => ss0[b] - ss0[a]);
    rot = rot.map((r) => ord.map((j) => r[j])); for (let j = 0; j < nf; j++) { if (sum(rot.map((r) => r[j])) < 0) rot.forEach((r) => { r[j] = -r[j]; }); }
    const comm = rot.map((r) => sum(r.map((v) => v * v))), ssl = Array.from({ length: nf }, (_, j) => sum(rot.map((r) => r[j] * r[j])));
    const Z = standardize(X, true).Z, W = matmul(invert(R), rot), scores = Z.map((r) => Array.from({ length: nf }, (_, j) => sum(r.map((v, i) => v * W[i][j]))));
    let cum = 0; const prop = ssl.map((v) => v / p), cumul = prop.map((v) => (cum += v));
    return { n, p, nf, R, eigenvalues: ev, unrotated: unrot, loadings: rot, communality: comm, uniqueness: comm.map((c) => 1 - c), ssl, prop, cumul, scores, kmo: kb.kmo, msa: kb.msa, bart: { chi2: kb.chi2, df: kb.df, p: kb.p }, kaiser: ev.filter((v) => v > 1).length };
  }

  /* -------------------------------- klaster hierarki -------------------------------- */
  function distMatrix(X, metric) { const n = X.length, d = Array.from({ length: n }, () => new Array(n).fill(0)); for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let s = 0; for (let k = 0; k < X[i].length; k++) { const t = X[i][k] - X[j][k]; s += metric === 'manhattan' ? Math.abs(t) : t * t; } d[i][j] = d[j][i] = metric === 'manhattan' ? s : Math.sqrt(s); } return d; }
  function hclust(X, method, metric) {   // kembalikan merges seperti scipy: [{a,b,h,size}] (id gabungan = n + indeks)
    const n = X.length; let d = distMatrix(X, metric || 'euclid'); const ward = method === 'ward'; if (ward) d = d.map((r) => r.map((v) => v * v));
    const act = Array.from({ length: n }, (_, i) => i), size = new Array(2 * n).fill(1), id = Array.from({ length: n }, (_, i) => i), merges = [], D2 = d.map((r) => r.slice());
    for (let step = 0; step < n - 1; step++) {
      let bi = -1, bj = -1, bd = Infinity;
      for (let a = 0; a < act.length; a++) for (let b = a + 1; b < act.length; b++) { const v = D2[act[a]][act[b]]; if (v < bd - 1e-15) { bd = v; bi = a; bj = b; } }
      const i = act[bi], j = act[bj], ni = size[id[i]], nj = size[id[j]], newId = n + step;
      merges.push({ a: Math.min(id[i], id[j]), b: Math.max(id[i], id[j]), h: ward ? Math.sqrt(bd) : bd, size: ni + nj });
      for (const k of act) if (k !== i && k !== j) {
        const nk = size[id[k]], dik = D2[i][k], djk = D2[j][k]; let v;
        if (method === 'single') v = Math.min(dik, djk); else if (method === 'complete') v = Math.max(dik, djk);
        else if (method === 'average') v = (ni * dik + nj * djk) / (ni + nj); else v = ((ni + nk) * dik + (nj + nk) * djk - nk * bd) / (ni + nj + nk);
        D2[i][k] = D2[k][i] = v;
      }
      size[newId] = ni + nj; id[i] = newId; act.splice(bj, 1);
    }
    return merges;
  }
  function cutTree(merges, n, k) {   // label klaster 0..k-1 dengan k klaster
    const parent = Array.from({ length: 2 * n }, (_, i) => i), find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let s = 0; s < n - k; s++) { parent[find(merges[s].a)] = n + s; parent[find(merges[s].b)] = n + s; }
    const roots = {}, lab = []; let c = 0; for (let i = 0; i < n; i++) { const r = find(i); if (!(r in roots)) roots[r] = c++; lab.push(roots[r]); } return lab;
  }
  function leafOrder(merges, n) { const kids = (id) => (id < n ? [id] : [].concat(kids(merges[id - n].a), kids(merges[id - n].b))); return kids(2 * n - 2); }

  /* ------------------------------------ k-means ------------------------------------ */
  function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const sq = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const t = a[i] - b[i]; s += t * t; } return s; };
  function kmeansOnce(X, k, rand, maxIter) {
    const n = X.length, p = X[0].length; let cen = [X[Math.floor(rand() * n)].slice()];
    while (cen.length < k) { const d = X.map((x) => Math.min.apply(null, cen.map((c) => sq(x, c)))), tot = sum(d); let r = rand() * tot, i = 0; while (i < n - 1 && (r -= d[i]) > 0) i++; cen.push(X[i].slice()); }
    let lab = new Array(n).fill(-1), it = 0;
    for (; it < maxIter; it++) {
      let ch = false; const nl = X.map((x, i) => { let b = 0, bd = Infinity; cen.forEach((c, j) => { const v = sq(x, c); if (v < bd) { bd = v; b = j; } }); if (b !== lab[i]) ch = true; return b; }); lab = nl;
      if (!ch) break;
      cen = cen.map((c, j) => { const m = X.filter((_, i) => lab[i] === j); return m.length ? Array.from({ length: p }, (_, d) => mean(m.map((r) => r[d]))) : c; });
    }
    return { lab, cen, inertia: sum(X.map((x, i) => sq(x, cen[lab[i]]))), iter: it };
  }
  function kmeans(X, k, opts) {
    opts = Object.assign({ nInit: 20, seed: 12345, maxIter: 300 }, opts || {}); const rand = rng(opts.seed); let best = null;
    for (let r = 0; r < opts.nInit; r++) { const t = kmeansOnce(X, k, rand, opts.maxIter); if (!best || t.inertia < best.inertia - 1e-12) best = t; }
    const n = X.length, p = X[0].length, gm = Array.from({ length: p }, (_, d) => mean(col(X, d))), tss = sum(X.map((x) => sq(x, gm)));
    const sizes = Array.from({ length: k }, (_, j) => best.lab.filter((l) => l === j).length), wss = Array.from({ length: k }, (_, j) => sum(X.map((x, i) => (best.lab[i] === j ? sq(x, best.cen[j]) : 0))));
    return { labels: best.lab, centers: best.cen, inertia: best.inertia, iter: best.iter, sizes, wss, tss, bss: tss - best.inertia };
  }
  function silhouette(X, labels, metric) {
    const n = X.length, d = distMatrix(X, metric || 'euclid'), ks = Array.from(new Set(labels)).sort((a, b) => a - b), s = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const own = labels[i], ownIdx = []; const per = {}; ks.forEach((k) => { per[k] = []; });
      for (let j = 0; j < n; j++) if (j !== i) per[labels[j]].push(d[i][j]);
      if (per[own].length === 0) { s[i] = 0; continue; }
      const a = mean(per[own]); let b = Infinity; ks.forEach((k) => { if (k !== own && per[k].length) b = Math.min(b, mean(per[k])); });
      s[i] = Number.isFinite(b) ? (b - a) / Math.max(a, b) : 0;
    }
    return { s, mean: mean(s), byCluster: ks.map((k) => ({ k, mean: mean(s.filter((_, i) => labels[i] === k)) })) };
  }

  /* -------------------------------- analisis butir -------------------------------- */
  function pearsonR(x, y) { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { const u = x[i] - mx, v = y[i] - my; a += u * v; b += u * u; c += v * v; } return a / Math.sqrt(b * c); }
  function itemAnalysis(M, alpha) {
    alpha = alpha || 0.05; const n = M.length, k = M[0].length, items = Array.from({ length: k }, (_, j) => col(M, j)), tot = M.map(sum), vt = variance(tot), vi = items.map(variance);
    const cron = k / (k - 1) * (1 - sum(vi) / vt);
    let rs = 0, cnt = 0; for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) { rs += pearsonR(items[a], items[b]); cnt++; } const rbar = rs / cnt, stdAlpha = k * rbar / (1 + (k - 1) * rbar);
    const df = n - 2, tc = D.tCrit(df, 1 - alpha), rCrit = tc / Math.sqrt(tc * tc + df);
    const itemRows = items.map((it, j) => {
      const rest = M.map((r, i) => tot[i] - r[j]), rc = pearsonR(it, rest), rt = pearsonR(it, tot), restItems = items.filter((_, q) => q !== j), restTot = restItems.length ? M.map((r) => sum(r) - r[j]) : null;
      let aDel = NaN; if (k > 2) { const vr = variance(restTot), vsum = sum(restItems.map(variance)); aDel = (k - 1) / (k - 2) * (1 - vsum / vr); }
      return { mean: mean(it), sd: Math.sqrt(variance(it)), rCorrected: rc, rTotal: rt, alphaDeleted: aDel, valid: rc > rCrit, p: D.tTwoP(rc * Math.sqrt(df / (1 - rc * rc)), df) };
    });
    // split-half ganjil-genap
    const odd = M.map((r) => sum(r.filter((_, j) => j % 2 === 0))), even = M.map((r) => sum(r.filter((_, j) => j % 2 === 1))), rh = pearsonR(odd, even);
    const fz = D.fQuant(1 - alpha / 2, n - 1, (n - 1) * (k - 1)), fl = D.fQuant(alpha / 2, n - 1, (n - 1) * (k - 1));
    return { n, k, alpha: cron, stdAlpha, rbar, ci: [1 - (1 - cron) * fz, 1 - (1 - cron) * fl], items: itemRows, rCrit, df, splitHalf: { r: rh, sb: 2 * rh / (1 + rh) }, totalMean: mean(tot), totalSd: Math.sqrt(vt) };
  }

  /* -------------------------------- dekomposisi deret waktu -------------------------------- */
  function decompose(y, m, model, h) {
    const n = y.length, mult = model === 'multiplicative', half = Math.floor(m / 2), trend = new Array(n).fill(NaN);
    for (let t = 0; t < n; t++) {
      if (m % 2 === 1) { if (t >= half && t < n - half) trend[t] = mean(y.slice(t - half, t + half + 1)); }
      else if (t >= half && t < n - half) { let s = 0.5 * y[t - half] + 0.5 * y[t + half]; for (let q = t - half + 1; q <= t + half - 1; q++) s += y[q]; trend[t] = s / m; }
    }
    const detr = y.map((v, t) => (Number.isNaN(trend[t]) ? NaN : mult ? v / trend[t] : v - trend[t])), raw = Array.from({ length: m }, (_, s) => { const v = detr.filter((x, t) => t % m === s && !Number.isNaN(x)); return v.length ? mean(v) : NaN; });
    const c = mean(raw), idx = raw.map((v) => (mult ? v / c : v - c)), seas = y.map((_, t) => idx[t % m]), irr = y.map((v, t) => (Number.isNaN(trend[t]) ? NaN : mult ? v / (trend[t] * seas[t]) : v - trend[t] - seas[t]));
    // ramalan: tren linier pada data tanpa musiman
    const des = y.map((v, t) => (mult ? v / seas[t] : v - seas[t])), tt = y.map((_, t) => t + 1), mt = mean(tt), md = mean(des);
    let sxy = 0, sxx = 0; tt.forEach((x, i) => { sxy += (x - mt) * (des[i] - md); sxx += (x - mt) ** 2; }); const b = sxy / sxx, a = md - b * mt;
    const fit = y.map((_, t) => { const tr = a + b * (t + 1); return mult ? tr * seas[t] : tr + seas[t]; }), err = y.map((v, t) => v - fit[t]);
    const mape = mean(y.map((v, t) => (v !== 0 ? Math.abs(err[t] / v) * 100 : NaN)).filter((v) => !Number.isNaN(v))), mad = mean(err.map(Math.abs)), msd = mean(err.map((e) => e * e));
    const fc = Array.from({ length: h || 0 }, (_, i) => { const t = n + i, tr = a + b * (t + 1), s = idx[t % m]; return mult ? tr * s : tr + s; });
    return { n, m, model, trend, seasonal: seas, indices: idx, irregular: irr, deseason: des, a, b, fitted: fit, errors: err, mape, mad, msd, forecast: fc };
  }

  window.StatMulti = { eigSymFull, invert, matmul, standardize, corrMatrix, pca, kmoBartlett, varimax, factorAnalysis, distMatrix, hclust, cutTree, leafOrder, kmeans, silhouette, itemAnalysis, decompose, pearsonR };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.StatMulti;
})();
