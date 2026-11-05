/* Uji numerik power-core.js vs SciPy (nct, ncf), statsmodels (power t / ANOVA), dan rumus proporsi/survei independen */
global.window = {}; require('../Method/Shared/stat-dist.js'); const P = require('../Method/Stat/power-core.js');
const R = JSON.parse(require('fs').readFileSync(__dirname + '/ref_power.json', 'utf8'));
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)), ab = (a, b) => Math.abs(a - b), w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, e); };
R.forEach((c) => {
  if (c.k === 'nct') { up('nct sf (abs)', ab(P.ntSf(c.t, c.df, c.ncp), c.sf)); up('nct cdf (abs)', ab(P.ntCdf(-c.t, c.df, c.ncp), c.cdf)); }
  else if (c.k === 'ncf') up('ncf cdf (abs)', ab(P.ncfCdf(c.f, c.df1, c.df2, c.lam), c.cdf));
  else if (c.k === 'powT1') up('daya t 1 sampel (abs)', ab(P.powerT({ type: 'one', n: c.n, d: c.d, alpha: 0.05, alt: c.alt }), c.power));
  else if (c.k === 'powT2') up('daya t 2 sampel (abs)', ab(P.powerT({ type: 'two', n1: c.n1, n2: c.n2, d: c.d, alpha: 0.05, alt: c.alt }), c.power));
  else if (c.k === 'solveT1') up('n t 1 sampel', ab(P.solveN((n) => P.powerT({ type: 'one', n, d: c.d, alpha: 0.05 }), c.target, 2), c.n));
  else if (c.k === 'solveT2') up('n t 2 sampel', ab(P.solveN((n) => P.powerT({ type: 'two', n, d: c.d, alpha: 0.05 }), c.target, 2), c.n));
  else if (c.k === 'powA') up('daya ANOVA (abs)', ab(P.powerAnova({ k: c.kk, n: c.n, delta: c.delta, sigma: c.sigma, alpha: 0.05 }), c.power));
  else if (c.k === 'solveA') up('n ANOVA', ab(P.solveN((n) => P.powerAnova({ k: c.kk, n, delta: c.delta, sigma: c.sigma, alpha: 0.05 }), c.target, 2), c.n));
  else if (c.k === 'pow1') up('daya 1 proporsi (abs)', ab(P.powerProp1({ p0: c.p0, p1: c.p1, n: c.n, alpha: 0.05, alt: c.alt }), c.power));
  else if (c.k === 'pow2') up('daya 2 proporsi (abs)', ab(P.powerProp2({ p1: c.p1, p2: c.p2, n1: c.n1, n2: c.n2, alpha: 0.05, alt: c.alt }), c.power));
  else if (c.k === 'solve1') up('n 1 proporsi', ab(P.solveN((n) => P.powerProp1({ p0: c.p0, p1: c.p1, n, alpha: 0.05 }), c.target, 2), c.n));
  else if (c.k === 'solve2') up('n 2 proporsi', ab(P.solveN((n) => P.powerProp2({ p1: c.p1, p2: c.p2, n, alpha: 0.05 }), c.target, 2), c.n));
  else if (c.k === 'survey') { up('Slovin', rel(P.survey.slovin(c.N, c.e), c.slovin)); const co = P.survey.cochran(c.conf, c.p, c.e, c.N); up('Cochran n0', rel(co.n0, c.cochran0)); up('Cochran koreksi populasi', rel(co.n, c.cochran)); up('Lemeshow', rel(P.survey.lemeshow(c.conf, c.p, c.e, c.N), c.lemeshow)); up('Lemeshow tak hingga', rel(P.survey.lemeshow(c.conf, c.p, c.e, 0), c.lemeshow_inf)); }
});
console.log(R.length, 'kasus'); Object.keys(w).forEach((k) => console.log(k.padEnd(30), w[k].toExponential(2)));
const bad = Object.keys(w).filter((k) => w[k] > 1e-7); console.log(bad.length ? 'GAGAL: ' + bad.join(', ') : 'SEMUA COCOK');
