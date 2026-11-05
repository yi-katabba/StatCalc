/* Uji numerik quality-core.js vs acuan independen (integrasi SciPy, aturan ditulis ulang, statsmodels) */
global.window = {}; require('../Method/Shared/stat-dist.js'); require('../Method/Stat/reg-core.js'); const Q = require('../Method/Stat/quality-core.js');
const R = JSON.parse(require('fs').readFileSync(__dirname + '/ref_quality.json', 'utf8'));
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b)), ab = (a, b) => Math.abs(a - b), w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, e); };
const maxrel = (a, b) => Math.max.apply(null, a.map((v, i) => rel(v, b[i]))), maxabs = (a, b) => Math.max.apply(null, a.map((v, i) => ab(v, b[i])));
const same = (a, b) => (JSON.stringify(a) === JSON.stringify(b) ? 0 : 1);
R.forEach((c) => {
  if (c.k === 'consts') c.tab.forEach((t) => { const q = Q.constants(t.n); ['d2', 'd3', 'c4', 'A2', 'A3', 'D3', 'D4', 'B3', 'B4'].forEach((key) => up('konstanta ' + key, key === 'D3' && t[key] === 0 ? ab(q[key], 0) : rel(q[key], t[key]))); });
  else if (c.k === 'xbarR') {
    const a = Q.xbarR(c.rows, [1]), s = Q.xbarS(c.rows, [1]); up('Xbar-R CL', rel(a.charts[0].cl[0], c.X2)); up('Xbar-R UCL', rel(a.charts[0].ucl[0], c.uclx)); up('Xbar-R LCL', rel(a.charts[0].lcl[0], c.lclx)); up('R UCL', rel(a.charts[1].ucl[0], c.uclr)); up('R LCL', ab(a.charts[1].lcl[0], c.lclr)); up('Rbar', rel(a.charts[1].cl[0], c.Rbar));
    up('Xbar-S UCL', rel(s.charts[0].ucl[0], c.uclxs)); up('S CL', rel(s.charts[1].cl[0], c.Sbar)); up('S UCL', rel(s.charts[1].ucl[0], c.ucls)); up('S LCL', ab(s.charts[1].lcl[0], c.lcls)); up('Xbar nilai', maxrel(a.charts[0].values, c.xb));
  } else if (c.k === 'imr') {
    const r = Q.imr(c.x, [1, 2, 3, 4, 5, 6]); up('I CL', rel(r.charts[0].cl[0], c.xbar)); up('I UCL', rel(r.charts[0].ucl[0], c.ucl)); up('I LCL', rel(r.charts[0].lcl[0], c.lcl)); up('MR CL', rel(r.charts[1].cl[0], c.mrbar)); up('MR UCL', rel(r.charts[1].ucl[0], c.uclmr));
    for (let t = 1; t <= 6; t++) { const h = Q.rules(r.charts[0].z, [t]); up('aturan I-chart Test ' + t, same(h.map((x) => x.length ? [t] : []), c.rules[String(t)].map((x) => (x.length ? [t] : [])))); }
  } else if (c.k === 'rules') { const h = Q.rules(c.z, [1, 2, 3, 4, 5, 6]); up('Test 1-6 gabungan', same(h.map((x) => x.slice().sort()), c.flags.map((x) => x.slice().sort()))); }
  else if (['p', 'np', 'c', 'u'].includes(c.k)) {
    const r = c.k === 'p' ? Q.pChart(c.x, c.n, [1]) : c.k === 'np' ? Q.npChart(c.x, c.n[0], [1]) : c.k === 'c' ? Q.cChart(c.x, [1]) : Q.uChart(c.x, c.n, [1]), ch = r.charts[0], arr = (v) => (Array.isArray(v) ? v : ch.values.map(() => v));
    up('bagan ' + c.k + ' CL', maxrel(ch.cl, arr(c.cl))); up('bagan ' + c.k + ' UCL', maxrel(ch.ucl, arr(c.ucl))); up('bagan ' + c.k + ' LCL', maxabs(ch.lcl, arr(c.lcl)));
  } else if (c.k === 'cap') {
    const r = Q.capability(c.x, { lsl: c.lsl, usl: c.usl, target: c.target, sub: c.sub }); up('Kapabilitas σ within', rel(r.sigmaW, c.sw)); up('σ overall', rel(r.sigmaO, c.so)); up('Cp', rel(r.within.cp, c.cp)); up('Cpk', rel(r.within.cpk, c.cpk)); up('Pp', rel(r.overall.cp, c.pp)); up('Ppk', rel(r.overall.cpk, c.ppk)); up('Cpm', rel(r.cpm, c.cpm)); up('PPM within', rel(r.ppmWithin.total, c.ppmw)); up('PPM overall', rel(r.ppmOverall.total, c.ppmo)); up('CI Pp', Math.max(rel(r.ciPp[0], c.ciPp[0]), rel(r.ciPp[1], c.ciPp[1])));
  } else if (c.k === 'fact') {
    const k = c.F[0].length, nm = Array.from({ length: k }, (_, j) => String.fromCharCode(65 + j)), f = Q.factorial2k(c.F, c.y, nm, c.order, 0.05);
    up('Faktorial urutan suku', same(f.terms.map((t) => t.name.replace(/×/g, '')), c.terms)); up('Faktorial efek', maxabs(f.terms.map((t) => t.effect), c.eff)); up('Faktorial R2', rel(f.r2, c.r2)); up('Faktorial dfe', ab(f.dfe, c.dfe));
    if (c.se) { up('Faktorial SE efek', maxrel(f.terms.map((t) => 2 * t.se), c.se)); up('Faktorial p (abs)', maxabs(f.terms.map((t) => t.p), c.p)); }
    if (c.sspe !== undefined) { up('Galat murni SS', rel(f.sspe, c.sspe)); up('Galat murni db', ab(f.dfpe, c.dfpe)); }
    up('Lenth PSE', rel(f.lenth.pse, c.lenth[0])); up('Lenth ME', rel(f.lenth.me, c.lenth[1])); up('Lenth SME', rel(f.lenth.sme, c.lenth[2]));
  }
});
console.log(R.length, 'kasus'); Object.keys(w).forEach((k) => console.log(k.padEnd(30), w[k].toExponential(2)));
const bad = Object.keys(w).filter((k) => w[k] > 1e-7); console.log(bad.length ? 'GAGAL: ' + bad.join(', ') : 'SEMUA COCOK');
