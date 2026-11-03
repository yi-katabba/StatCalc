/* Uji numerik multi-core.js vs numpy/scipy/sklearn/factor_analyzer/pingouin/statsmodels */
global.window = {}; require('../Method/Shared/stat-dist.js'); const M = require('../Method/Stat/multi-core.js');
const R = JSON.parse(require('fs').readFileSync(__dirname + '/ref_multi.json', 'utf8'));
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)), ab = (a, b) => Math.abs(a - b), w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, e); };
const maxrel = (a, b) => Math.max.apply(null, a.map((v, i) => rel(v, b[i]))), maxabs = (a, b) => Math.max.apply(null, a.map((v, i) => ab(v, b[i])));
const nanCmp = (a, b, f) => Math.max.apply(null, a.map((v, i) => (b[i] === null ? (Number.isNaN(v) ? 0 : 1) : f(v, b[i]))));
const ari = (a, b) => { const n = a.length, key = {}, ca = {}, cb = {}; let s = 0; for (let i = 0; i < n; i++) { const k = a[i] + ',' + b[i]; key[k] = (key[k] || 0) + 1; ca[a[i]] = (ca[a[i]] || 0) + 1; cb[b[i]] = (cb[b[i]] || 0) + 1; } const c2 = (x) => x * (x - 1) / 2, sk = Object.values(key).reduce((t, v) => t + c2(v), 0), sa = Object.values(ca).reduce((t, v) => t + c2(v), 0), sb = Object.values(cb).reduce((t, v) => t + c2(v), 0), ex = sa * sb / c2(n); return (sk - ex) / ((sa + sb) / 2 - ex); };
R.forEach((c) => {
  if (c.k === 'pca') {
    const p = M.pca(c.X, { standardize: true }); up('PCA nilai eigen', maxrel(p.eigenvalues, c.ev)); up('PCA vektor eigen |v|', Math.max.apply(null, p.vectors.map((v, j) => maxabs(v.map(Math.abs), c.absV[j])))); up('PCA skor |z|', Math.max.apply(null, p.scores.map((r, i) => maxabs(r.map(Math.abs), c.absScores[i]))));
    const pc = M.pca(c.X, { standardize: false }); up('PCA kovarians nilai eigen', maxrel(pc.eigenvalues, c.cov_ev));
    const kb = M.kmoBartlett(c.X); up('KMO total', rel(kb.kmo, c.kmo)); up('KMO per variabel', maxrel(kb.msa, c.msa)); up('Bartlett chi2', rel(kb.chi2, c.bchi)); up('Bartlett p (abs)', ab(kb.p, c.bp));
    const f = M.factorAnalysis(c.X, c.nf); const cm = f.communality.slice().sort(), cr = c.fa_comm.slice().sort(); up('Faktor komunalitas', maxabs(cm, cr));
    up('Faktor SS loading', maxabs(f.ssl.slice().sort((a, b) => b - a), c.fa_var.slice().sort((a, b) => b - a)));
    if (c.nf > 1) { const used = new Set(); let worst = 0; for (let j = 0; j < c.nf; j++) { let best = Infinity, bj = -1; for (let q = 0; q < c.nf; q++) { if (used.has(q)) continue; const e = maxabs(f.loadings.map((r) => Math.abs(r[j])), c.fa_abs.map((r) => r[q])); if (e < best) { best = e; bj = q; } } used.add(bj); worst = Math.max(worst, best); } up('Faktor loading rotasi |L|', worst); }
    else up('Faktor loading rotasi |L|', maxabs(f.loadings.map((r) => Math.abs(r[0])), c.fa_abs.map((r) => r[0])));
  } else if (c.k === 'hc') {
    ['single', 'complete', 'average', 'ward'].forEach((m) => { const mg = M.hclust(c.X, m, 'euclid'); up('Hirarki tinggi ' + m, maxrel(mg.map((x) => x.h).sort((a, b) => a - b), c[m].slice().sort((a, b) => a - b))); up('Hirarki partisi k=3 ' + m + ' (1-ARI)', 1 - ari(M.cutTree(mg, c.X.length, 3), c[m + '_lab3'])); });
  } else if (c.k === 'km') {
    const km = M.kmeans(c.X, c.kc, { nInit: 30, seed: 7 }); up('Kmeans inertia', rel(km.inertia, c.inertia)); up('Kmeans partisi (1-ARI)', 1 - ari(km.labels, c.labels)); up('Silhouette', rel(M.silhouette(c.X, c.labels).mean, c.sil));
  } else if (c.k === 'item') {
    const r = M.itemAnalysis(c.M, 0.05); up('Alpha', rel(r.alpha, c.alpha)); up('Alpha CI', Math.max(ab(r.ci[0], c.ci[0]), ab(r.ci[1], c.ci[1]))); up('Item-total terkoreksi', maxabs(r.items.map((x) => x.rCorrected), c.ric)); if (c.ad[0] !== null) up('Alpha bila dihapus', maxabs(r.items.map((x) => x.alphaDeleted), c.ad));
  } else if (c.k === 'dec') {
    const d = M.decompose(c.y, c.m, c.model, 6); up('Dekomposisi tren', nanCmp(d.trend, c.trend, rel)); up('Dekomposisi musiman', maxrel(d.seasonal, c.seasonal)); up('Dekomposisi sisa', nanCmp(d.irregular, c.resid, rel)); up('Tren linier a', rel(d.a, c.a)); up('Tren linier b', rel(d.b, c.b)); up('Ramalan', maxrel(d.forecast, c.fc));
  }
});
console.log(R.length, 'kasus'); Object.keys(w).forEach((k) => console.log(k.padEnd(32), w[k].toExponential(2)));
const tol = { 'Alpha CI': 6e-4, 'Faktor loading rotasi |L|': 1e-6, 'Faktor SS loading': 1e-6, 'Faktor komunalitas': 1e-8, 'Hirarki partisi k=3 single (1-ARI)': 0.0 }, bad = Object.keys(w).filter((k) => w[k] > (tol[k] === undefined ? 1e-7 : tol[k]));
console.log(bad.length ? 'GAGAL: ' + bad.join(', ') : 'SEMUA COCOK');
