/* Uji numerik anova-core.js vs SciPy/statsmodels/pingouin */
global.window = {}; require('../Method/Shared/stat-dist.js'); require('../Method/Stat/anova-core.js');
const A = window.StatAnovaX, R = JSON.parse(require('fs').readFileSync(__dirname + '/ref_anova.json', 'utf8'));
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)), ab = (a, b) => Math.abs(a - b), w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, e); };
R.forEach((c) => {
  if (c.k === 'post') {
    const t = A.postHoc(c.groups, 'tukey', 0.05), d = A.postHoc(c.groups, 'dunnett', 0.05, { control: 0 });
    c.tukey.forEach(([i, j, p, lo, hi]) => { const r = t.rows.find((x) => x.i === i && x.j === j); up('Tukey p (abs)', ab(r.p, p)); up('Tukey CI (abs)', Math.max(ab(r.lo, lo), ab(r.hi, hi))); });
    c.dunnett.forEach(([i, j, p, lo, hi]) => { const r = d.rows.find((x) => x.i === i); up('Dunnett p (abs)', ab(r.p, p)); up('Dunnett CI (abs)', Math.max(ab(r.lo, lo), ab(r.hi, hi))); });
    const b = A.postHoc(c.groups, 'bonferroni', 0.05), m = b.rows.length, one = A.oneWay(c.groups);
    b.rows.forEach((r) => { const se = Math.sqrt(one.msw * (1 / one.ns[r.i] + 1 / one.ns[r.j])); up('Bonferroni (internal)', Math.abs(r.p - Math.min(1, m * 2 * (1 - require('./tcdf')(Math.abs(r.diff / se), one.dfw))))); });
  } else if (c.k === 'rcbd') { const r = A.rcbd(c.M); up('RAK F trt', rel(r.Ft, c.F[0])); up('RAK F blk', rel(r.Fb, c.F[1])); up('RAK p trt', rel(r.pt, c.p[0])); up('RAK p blk', rel(r.pb, c.p[1])); up('RAK SSE', rel(r.sse, c.sse)); }
  else if (c.k === 'rm') { const r = A.repeated(c.M); up('RM F', rel(r.F, c.F)); up('RM p', rel(r.p, c.p)); up('RM SS', rel(r.ssc, c.ssc)); up('RM eps GG', rel(r.epsGG, c.eps)); up('RM p GG', rel(r.pGG, c.pgg)); up('RM gen. eta2', ab(r.getasq, c.np2)); if (c.W !== undefined) { up('RM Mauchly W', rel(r.W, c.W)); up('RM Mauchly p', ab(r.pW, c.pW)); } }
});
console.log(R.length, 'kasus'); Object.keys(w).forEach((k) => console.log(k.padEnd(24), w[k].toExponential(2)));
const tol = { 'Dunnett p (abs)': 3e-3, 'Dunnett CI (abs)': 5e-3, 'Tukey p (abs)': 1e-5, 'Tukey CI (abs)': 1e-5 }, bad = Object.keys(w).filter((k) => w[k] > (tol[k] || 1e-6));
console.log(bad.length ? 'GAGAL: ' + bad.join(', ') : 'SEMUA COCOK');
