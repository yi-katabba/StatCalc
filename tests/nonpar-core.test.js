/* Uji numerik nonpar-core.js vs acuan SciPy */
global.window = {}; require('../Method/Shared/stat-dist.js'); require('../Method/Stat/nonpar-core.js');
const N = window.StatNonpar, R = JSON.parse(require('fs').readFileSync(__dirname + '/ref_nonpar.json', 'utf8'));
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)), w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, e); };
const alt = { 'two-sided': 'two', greater: 'greater', less: 'less' };
R.forEach((c) => {
  if (c.k === 'chi') { const r = N.chiInd(c.O); up('chi2', rel(r.chi2, c.chi[0])); up('chi2 p', rel(r.p, c.chi[1])); up('chi2 df', Math.abs(r.df - c.chi[2])); up('G', rel(r.G, c.G[0])); up('G p', rel(r.pG, c.G[1])); up('Cramer V', rel(r.V, c.V)); if (c.yates) { up('Yates', rel(r.yates.chi2, c.yates[0])); up('Yates p', rel(r.yates.p, c.yates[1])); } }
  else if (c.k === 'gof') { const a = N.chiGof(c.O), b = N.chiGof(c.O, c.props); up('gof eq', rel(a.chi2, c.eq[0])); up('gof eq p', rel(a.p, c.eq[1])); up('gof exp', rel(b.chi2, c.ex[0])); up('gof exp p', rel(b.p, c.ex[1])); }
  else if (c.k === 'fisher') { Object.keys(alt).forEach((a) => { const r = N.fisher(c.tab[0], c.tab[1], c.tab[2], c.tab[3], alt[a], 0.95), ref = c[a]; up('fisher p ' + a, rel(r.p, ref[1])); up('fisher OR', isFinite(ref[0]) ? rel(r.or, ref[0]) : (r.or === Infinity ? 0 : 1)); }); }
  else if (c.k === 'mw') { Object.keys(alt).forEach((a) => { const r = N.mannWhitney(c.x, c.y, alt[a], { method: c.exact ? 'exact' : 'asymptotic' }); up('MW p ' + (c.exact ? 'eksak' : 'asimtotik'), rel(r.p, c[a])); }); up('MW U1', rel(N.mannWhitney(c.x, c.y, 'greater').U1, c.U1)); }
  else if (c.k === 'wil') { Object.keys(alt).forEach((a) => { const r = N.wilcoxon(c.d, alt[a], { method: c.exact ? 'exact' : 'approx', correction: true }); up('Wilcoxon p ' + (c.exact ? 'eksak' : 'aprox'), rel(r.p, c[a])); }); }
  else if (c.k === 'kw') { const r = N.kruskal(c.groups); up('KW H', rel(r.H, c.H)); up('KW p', rel(r.p, c.p)); }
  else if (c.k === 'fr') { const r = N.friedman(c.M); up('Friedman chi2', rel(r.chi2, c.chi)); up('Friedman p', rel(r.p, c.p)); }
});
console.log(R.length, 'kasus'); Object.keys(w).forEach((k) => console.log(k.padEnd(22), w[k].toExponential(2)));
const bad = Object.keys(w).filter((k) => w[k] > 1e-9); console.log(bad.length ? 'GAGAL: ' + bad.join(', ') : 'SEMUA COCOK');
