/* Uji numerik sem-core.js: CB-SEM vs lavaan (angka terbit, Political Democracy) dan semopy; PLS-SEM vs plspm */
global.window = {}; require('../Method/Shared/stat-dist.js'); const S = require('../Method/Stat/sem-core.js');
const fs = require('fs'), R = JSON.parse(fs.readFileSync(__dirname + '/ref_sem.json', 'utf8'));
const pd = JSON.parse(fs.readFileSync(__dirname + '/data_polidem.json', 'utf8')), sim = JSON.parse(fs.readFileSync(__dirname + '/data_sem_sim.json', 'utf8'));
const w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, e); }, ab = (a, b) => Math.abs(a - b);
const pick = (d, spec) => spec.observed.map((c) => d.names.indexOf(c));
const mat = (d, spec) => { const ix = pick(d, spec); return d.X.map((r) => ix.map((i) => r[i])); };

/* ---- CB-SEM 1: Political Democracy (angka terbit lavaan: chi2 = 38.125, db 35, p = 0.329, RMSEA 0.035, CFI 0.995, TLI 0.993, SRMR 0.044) ---- */
{
  const model = 'ind60 =~ x1 + x2 + x3\ndem60 =~ y1 + y2 + y3 + y4\ndem65 =~ y5 + y6 + y7 + y8\ndem60 ~ ind60\ndem65 ~ ind60 + dem60\ny1 ~~ y5\ny2 ~~ y4 + y6\ny3 ~~ y7\ny4 ~~ y8\ny6 ~~ y8';
  const sp = S.parseModel(model, pd.names), r = S.fitCB(sp, mat(pd, sp), {});
  up('PD chi2 (3 desimal)', ab(r.chi2, 38.125)); up('PD df', ab(r.df, 35)); up('PD p', ab(r.pChi2, 0.329)); up('PD RMSEA', ab(r.fit.rmsea, 0.035)); up('PD CFI', ab(r.fit.cfi, 0.995)); up('PD TLI', ab(r.fit.tli, 0.993)); up('PD SRMR', ab(r.fit.srmr, 0.044));
  const g = (l, rr) => r.params.find((x) => x.lhs === l && x.rhs === rr);
  up('PD jalur dem60~ind60', ab(g('dem60', 'ind60').est, 1.483)); up('PD SE dem60~ind60', ab(g('dem60', 'ind60').se, 0.399)); up('PD jalur dem65~dem60', ab(g('dem65', 'dem60').est, 0.837)); up('PD SE dem65~dem60', ab(g('dem65', 'dem60').se, 0.098));
  up('PD std dem65~dem60', ab(g('dem65', 'dem60').std, 0.885));
}
/* ---- CB-SEM 2: data simulasi vs semopy (estimasi & terstandar; chi2 semopy memakai N-1) ---- */
{
  const sp = S.parseModel(R.cb.model, sim.names), r = S.fitCB(sp, mat(sim, sp), {});
  up('CB converged', r.converged ? 0 : 1);
  up('CB chi2 vs semopy', ab(r.chi2, R.cb.chi2_nm1));
  R.cb.params.forEach((q) => {
    const isLoad = q.op === '~' && /^[abc]\d$/.test(q.lhs) && /^[ABC]$/.test(q.rhs);   // semopy menulis loading sebagai "indikator ~ laten"
    let m;
    if (isLoad) m = r.params.find((x) => x.kind === 'loading' && x.lhs === q.rhs && x.rhs === q.lhs);
    else if (q.op === '~') m = r.params.find((x) => x.kind === 'reg' && x.lhs === q.lhs && x.rhs === q.rhs);
    else m = r.params.find((x) => (x.kind === 'var' || x.kind === 'cov') && ((x.lhs === q.lhs && x.rhs === q.rhs) || (x.lhs === q.rhs && x.rhs === q.lhs)));
    if (!m) { up('CB param tidak ditemukan', 1); console.log('hilang', JSON.stringify(q)); return; }
    up('CB estimasi', ab(m.est, q.est)); up('CB std.all', ab(m.std, q.std));
  });
}
/* ---- PLS-SEM vs plspm ---- */
{
  const model = 'A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nC =~ c1 + c2 + c3 + c4\nB ~ A\nC ~ B + A\nz ~ C + w';
  const sp = S.parseModel(model, sim.names), ds = { names: sp.observed, X: mat(sim, sp) };
  ['path', 'centroid', 'factorial'].forEach((sc) => {
    const ref = R.pls[sc], r = S.fitPLS(sp, ds, { scheme: sc, boot: 0 }), nm = (x) => (x === 'Wc' ? 'w' : x === 'Z' ? 'z' : x);
    up('PLS konvergen', r.converged ? 0 : 1);
    /* plspm mengalikan bobot dengan sqrt(n/(n-1)) */
    r.constructs.forEach((c) => c.ind.forEach((ind, h) => { up('PLS bobot ' + sc, ab(c.weights[h] * Math.sqrt(sim.X.length / (sim.X.length - 1)), ref.weights[ind])); up('PLS loading ' + sc, ab(c.loadings[h], ref.loadings[ind])); }));
    r.paths.forEach((p) => { const key = Object.keys(ref.paths).find((k) => k.split('>').map(nm).join('>') === p.from + '>' + p.to); up('PLS jalur ' + sc, key ? ab(p.beta, ref.paths[key]) : 1); });
    r.r2.forEach((x) => { const key = Object.keys(ref.r2).find((k) => nm(k) === x.name); up('PLS R2 ' + sc, ab(x.r2, ref.r2[key])); });
  });
  const a = S.fitPLS(sp, ds, { boot: 200, seed: 7 }), b = S.fitPLS(sp, ds, { boot: 200, seed: 7 });
  up('Bootstrap reproducible', ab(a.paths[0].boot.se, b.paths[0].boot.se));
  const bt = a.paths[0].boot; up('Bootstrap SE masuk akal (0.02 s.d. 0.2)', bt.se > 0.02 && bt.se < 0.2 ? 0 : 1); up('Bootstrap CI memuat estimasi', bt.lo <= bt.est && bt.est <= bt.hi ? 0 : 1);
  const ei = a.effects.find((e) => e.from === 'A' && e.to === 'C'); up('Efek tak langsung A->C = AB x BC', ab(ei.indirect, a.paths.find((p) => p.from === 'A' && p.to === 'B').beta * a.paths.find((p) => p.from === 'B' && p.to === 'C').beta));
}
/* ---- validasi parser ---- */
{
  const bad = (m, re) => { try { S.parseModel(m, ['x1', 'x2', 'x3']); up('Parser harus galat: ' + m, 1); } catch (e) { if (!re.test(e.message)) up('Parser pesan: ' + m, 1); } };
  bad('F =~ x1 + zz', /tidak ada di kolom/); bad('F =~ x1 + x2\nF ~ F', /dirinya sendiri/); bad('x1 =~ x2 + x3', /nama kolom/); bad('F =~ x1 +', /suku kosong/); bad('hello', /operator/); bad('', /kosong/);
}
const tol = { 'PD chi2 (3 desimal)': 6e-4, 'PD df': 0, 'PD p': 6e-4, 'PD RMSEA': 6e-4, 'PD CFI': 6e-4, 'PD TLI': 6e-4, 'PD SRMR': 6e-4, 'PD jalur dem60~ind60': 6e-4, 'PD SE dem60~ind60': 6e-4, 'PD jalur dem65~dem60': 6e-4, 'PD SE dem65~dem60': 6e-4, 'PD std dem65~dem60': 6e-4 };
let bad = 0; Object.keys(w).forEach((k) => { const t = tol[k] !== undefined ? tol[k] : (/^PLS/.test(k) ? 1e-6 : /^CB (estimasi|std)/.test(k) ? 2e-3 : /chi2 vs semopy/.test(k) ? 1e-4 : 1e-9); const ok = w[k] <= t; if (!ok) bad++; console.log((ok ? 'OK   ' : 'GAGAL'), k.padEnd(44), w[k].toExponential(2)); });
console.log(bad ? bad + ' uji GAGAL' : 'Semua uji sem-core lulus');
process.exit(bad ? 1 : 0);
