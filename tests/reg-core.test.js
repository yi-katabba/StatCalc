/* Uji numerik reg-core.js vs statsmodels/SciPy */
global.window = {}; require('../Method/Shared/stat-dist.js'); const G = require('../Method/Stat/reg-core.js');
const R = JSON.parse(require('fs').readFileSync(__dirname + '/ref_reg.json', 'utf8'));
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)), ab = (a, b) => Math.abs(a - b), w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, e); };
const maxrel = (a, b) => Math.max.apply(null, a.map((v, i) => rel(v, b[i]))), col = (X) => X[0].map((_, j) => X.map((r) => r[j]));
R.forEach((c) => {
  if (c.k === 'ols') { const m = G.ols(G.addIntercept(c.X), c.y); up('OLS beta', maxrel(m.beta, c.beta)); up('OLS se', maxrel(m.se, c.se)); up('OLS p (abs)', Math.max.apply(null, m.p_t.map((v, i) => ab(v, c.p[i])))); up('OLS R2', rel(m.r2, c.r2)); up('OLS adjR2', rel(m.adjr2, c.adj)); up('OLS F', rel(m.F, c.F)); up('OLS pF', rel(m.pF, c.pF)); up('OLS AIC', rel(m.aic, c.aic)); up('OLS BIC', rel(m.bic, c.bic)); up('OLS leverage', maxrel(m.lev, c.h)); }
  else if (c.k === 'poly') {
    const m = G.polyFit(c.x, c.y, c.deg); up('Poly beta (terpusat)', maxrel(m.beta, c.beta)); up('Poly se', maxrel(m.se, c.se)); up('Poly koef asli', maxrel(m.coefOrig, c.orig)); up('Poly R2', rel(m.r2, c.r2)); up('Poly AIC', rel(m.aic, c.aic));
    const pr = G.polyPredict(m, c.pred[0], 0.05); up('Poly prediksi', Math.max(rel(pr.fit, c.pred[1]), rel(pr.ci[0], c.pred[2]), rel(pr.ci[1], c.pred[3]), rel(pr.pi[0], c.pred[4]), rel(pr.pi[1], c.pred[5])));
    const cm = G.polyCompare(c.x, c.y, 5); c.cmp.forEach((r, i) => { up('Poly bandingkan derajat', Math.max(rel(cm[i].r2, r[1]), rel(cm[i].adjr2, r[2]), rel(cm[i].aic, r[3]), rel(cm[i].bic, r[4]))); });
  } else if (c.k === 'step') {
    const r = G.stepwise(col(c.X), c.y, { method: c.method, alphaIn: 0.15, alphaOut: 0.15 }), a = r.final.slice().sort().join(','), b = c.final.slice().sort().join(',');
    up('Stepwise himpunan akhir', a === b ? 0 : 1); up('Stepwise urutan langkah', JSON.stringify(r.steps.filter((s) => s.action !== 'awal').map((s) => [s.action === 'masuk' ? 'in' : 'out', s.variable])) === JSON.stringify(c.hist) ? 0 : 1);
  } else if (c.k === 'best') {
    const b = G.bestSubsets(col(c.X), c.y, { keep: 1000 }); up('Best subsets jumlah model', b.rows.length === c.rows.length ? 0 : 1);
    c.rows.forEach(([idx, r2, adj, cp, aic, bic]) => { const r = b.rows.find((x) => x.vars.join(',') === idx.join(',')); up('Best subsets R2/adj/Cp/AIC/BIC', Math.max(rel(r.r2, r2), rel(r.adjr2, adj), ab(r.cp, cp) / Math.max(1, Math.abs(cp)), rel(r.aic, aic), rel(r.bic, bic))); });
  } else if (c.k === 'logit') {
    const m = G.logistic(col(c.X), c.y); up('Logit beta', maxrel(m.beta, c.beta)); up('Logit se', maxrel(m.se, c.se)); up('Logit p (abs)', Math.max.apply(null, m.p_z.map((v, i) => ab(v, c.p[i])))); up('Logit LL', rel(m.ll, c.ll)); up('Logit LL0', rel(m.ll0, c.ll0)); up('Logit LR', rel(m.LR, c.LR)); up('Logit p(LR)', rel(m.pLR, c.pLR)); up('Logit McFadden', rel(m.mcfadden, c.mcf)); up('Logit AIC', rel(m.aic, c.aic)); up('Logit BIC', rel(m.bic, c.bic)); up('Logit klasifikasi', m.cls.tp === c.tp && m.cls.tn === c.tn ? 0 : 1); up('Logit AUC', rel(m.auc, c.auc));
  }
});
console.log(R.length, 'kasus'); Object.keys(w).forEach((k) => console.log(k.padEnd(32), w[k].toExponential(2)));
const bad = Object.keys(w).filter((k) => w[k] > 1e-6); console.log(bad.length ? 'GAGAL: ' + bad.join(', ') : 'SEMUA COCOK');
