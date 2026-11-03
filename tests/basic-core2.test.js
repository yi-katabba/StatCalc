/* Uji numerik basic-core.js (uji z, proporsi, kesamaan ragam, normalitas) vs acuan SciPy/statsmodels */
global.window = {}; require('../Method/Shared/stat-dist.js'); require('../Method/Stat/basic-core.js');
const B = window.StatBasic, R = JSON.parse(require('fs').readFileSync(__dirname + '/ref_basic2.json', 'utf8'));
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)), ab = (a, b) => Math.abs(a - b);
const w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, e); };
const alt = { 'two-sided': 'two', greater: 'greater', less: 'less' };
const ci = (r, c) => Math.max(...[0, 1].map((i) => (isFinite(c[i]) ? ab(r[i], c[i]) : (r[i] === c[i] ? 0 : 1))));
R.forEach((c) => {
  if (c.k === 'z1') { const r = B.zOne(c.x, c.mu0, c.sigma, alt[c.alt], 0.95); up('z1 z', rel(r.z, c.z)); up('z1 p', rel(r.p, c.p)); up('z1 ci', ci(r.ci, c.ci)); }
  else if (c.k === 'z2') { const r = B.zTwo(c.x, c.y, c.s1, c.s2, c.d0, alt[c.alt], 0.95); up('z2 z', rel(r.z, c.z)); up('z2 p', rel(r.p, c.p)); }
  else if (c.k === 'p1') { const r = B.propOne(c.x, c.n, c.p0, alt[c.alt], 0.95); up('p1 z', rel(r.z, c.z)); up('p1 p(z)', rel(r.p, c.p)); up('p1 p(eksak)', rel(r.pExact, c.pe)); up('p1 wilson', ci(r.ci, c.ci)); }
  else if (c.k === 'p2') { const r = B.propTwo(c.x1, c.n1, c.x2, c.n2, 0, alt[c.alt], 0.95); up('p2 z', rel(r.z, c.z)); up('p2 p', rel(r.p, c.p)); if (c.alt === 'two-sided') up('p2 wald ci', ci(r.ci, c.ci)); }
  else if (c.k === 'var') {
    const lm = B.levene(c.groups, 'median'), la = B.levene(c.groups, 'mean'), bt = B.bartlett(c.groups);
    up('levene med W', rel(lm.W, c.lmed[0])); up('levene med p', rel(lm.p, c.lmed[1])); up('levene mean W', rel(la.W, c.lmean[0])); up('levene mean p', rel(la.p, c.lmean[1]));
    up('bartlett T', rel(bt.T, c.bart[0])); up('bartlett p', rel(bt.p, c.bart[1]));
    if (c.f) { const f = B.fTest(c.groups[0], c.groups[1], 0.05); up('F', rel(f.F, c.f[0])); up('F p', rel(f.p, c.f[1])); up('F ci', Math.max(rel(f.ciVar[0], c.f[2]), rel(f.ciVar[1], c.f[3]))); }
  } else if (c.k === 'norm') {
    const s = B.shapiroWilk(c.x); up('SW W', rel(s.W, c.sw[0])); up('SW p (abs)', ab(s.p, c.sw[1]));
    if (c.jb) { const j = B.jarqueBera(c.x), a = B.andersonDarling(c.x); up('JB', rel(j.JB, c.jb[0])); up('JB p', rel(j.p, c.jb[1])); up('AD A2', rel(a.A2, c.ad[0])); up('AD p (abs)', ab(a.p, c.ad[1])); }
  }
});
console.log(R.length, 'kasus'); Object.keys(w).forEach((k) => console.log(k.padEnd(14), w[k].toExponential(2)));
const tol = { 'SW p (abs)': 1e-5, 'SW W': 1e-5, 'AD p (abs)': 1e-6 }, bad = Object.keys(w).filter((k) => w[k] > (tol[k] || 1e-9));
console.log(bad.length ? 'GAGAL: ' + bad.join(', ') : 'SEMUA COCOK');
