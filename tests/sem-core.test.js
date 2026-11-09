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
/* ---- Bootstrap CB-SEM (resampel kasus): reproducible, SE ~ SE ML, CI konsisten, light = penuh ---- */
{
  const model = 'ind60 =~ x1 + x2 + x3\ndem60 =~ y1 + y2 + y3 + y4\ndem65 =~ y5 + y6 + y7 + y8\ndem60 ~ ind60\ndem65 ~ ind60 + dem60\ny1 ~~ y5\ny2 ~~ y4 + y6\ny3 ~~ y7\ny4 ~~ y8\ny6 ~~ y8';
  const sp = S.parseModel(model, pd.names), X = mat(pd, sp);
  const a = S.fitCB(sp, X, { boot: 200, seed: 11 }), b = S.fitCB(sp, X, { boot: 200, seed: 11 }), c = S.fitCB(sp, X, { boot: 200, seed: 12 });
  const ra = (r) => r.params.find((x) => x.kind === 'reg' && x.lhs === 'dem65' && x.rhs === 'dem60'), ea = (r) => r.effects.find((e) => e.from === 'ind60' && e.to === 'dem65');
  up('CB boot reproducible (seed sama)', ab(ra(a).boot.se, ra(b).boot.se) + ab(ea(a).bootInd.bcLo, ea(b).bootInd.bcLo));
  up('CB boot seed beda -> hasil beda', ra(a).boot.se !== ra(c).boot.se ? 0 : 1);
  up('CB boot resampel berhasil >= 95%', a.boot.ok >= 190 ? 0 : 1);
  const rs = ra(a).boot.se / ra(a).se; up('CB boot SE ~ SE ML (rasio 0.7-1.4)', rs > 0.7 && rs < 1.4 ? 0 : 1);
  const bi = ea(a).bootInd; up('CB boot CI memuat estimasi', bi.lo <= bi.est && bi.est <= bi.hi && bi.bcLo <= bi.bcHi ? 0 : 1);
  up('CB boot efek tak langsung = a x b', ab(ea(a).indirect, a.params.find((x) => x.kind === 'reg' && x.lhs === 'dem60' && x.rhs === 'ind60').est * ra(a).est));
  up('CB boot SE tak langsung ~ SE delta (0.6-1.6)', bi.se / ea(a).seInd > 0.6 && bi.se / ea(a).seInd < 1.6 ? 0 : 1);
  const l = S.fitCB(sp, X, { light: true }), f = S.fitCB(sp, X, {});
  up('CB light = penuh (estimasi)', Math.max.apply(null, f.params.map((x, i) => ab(x.est, l.params[i].est))));
  up('CB boot tidak mengubah estimasi asli', Math.max.apply(null, f.params.map((x, i) => ab(x.est, a.params[i].est))));
}
/* ---- Modification indices (uji skor) & uji selisih chi-square ---- */
{
  const base = 'ind60 =~ x1 + x2 + x3\ndem60 =~ y1 + y2 + y3 + y4\ndem65 =~ y5 + y6 + y7 + y8\ndem60 ~ ind60\ndem65 ~ ind60 + dem60';
  const lav = 'y1 ~~ y5\ny2 ~~ y4 + y6\ny3 ~~ y7\ny4 ~~ y8\ny6 ~~ y8';
  const fitM = (m, o) => { const sp = S.parseModel(m, pd.names); return S.fitCB(sp, mat(pd, sp), o || {}); };
  const f0 = fitM(base), full = fitM(base + '\n' + lav), norm = (l) => l.split(' ~~ ').sort().join('~~');
  const lavSet = ['y1~~y5', 'y2~~y4', 'y2~~y6', 'y3~~y7', 'y4~~y8', 'y6~~y8'].map((x) => x.split('~~').sort().join('~~'));
  up('MI: tanpa kovarians galat, >= 5 dari 6 kovarians lavaan ada di 7 teratas', f0.mi.slice(0, 7).filter((m) => m.kind === 'cov' && lavSet.indexOf(norm(m.line)) >= 0).length >= 5 ? 0 : 1);
  up('MI: terurut menurun & non-negatif', f0.mi.every((m, i) => m.mi >= 0 && (i === 0 || f0.mi[i - 1].mi >= m.mi)) ? 0 : 1);
  let worstR = 0, worstE = 0;
  f0.mi.slice(0, 5).forEach((m) => {
    const f1 = fitM(base + '\n' + m.line), est = f1.params.find((x) => x.kind === 'cov' && norm(x.lhs + ' ~~ ' + x.rhs) === norm(m.line) || x.kind === 'reg' && x.lhs === m.lhs && x.rhs === m.rhs), lr = f0.chi2 - f1.chi2;
    worstR = Math.max(worstR, Math.abs(m.mi / lr - 1)); worstE = Math.max(worstE, Math.abs(m.epc / est.est - 1));
  });
  up('MI ~ penurunan chi2 sebenarnya (selisih relatif <= 15%)', worstR <= 0.15 ? 0 : worstR);
  up('EPC ~ estimasi hasil refit (selisih relatif <= 10%)', worstE <= 0.10 ? 0 : worstE);
  up('MI: model lengkap tidak punya MI > 10', full.mi.every((m) => m.mi < 10) ? 0 : 1);
  up('MI: light tidak menghitung MI', fitM(base, { light: true }).mi === null ? 0 : 1);
  up('MI: tidak ada kandidat yang sudah bebas di model', f0.mi.every((m) => !f0.params.some((x) => x.free && x.kind === m.kind && ((x.lhs === m.lhs && x.rhs === m.rhs) || (m.kind === 'cov' && x.lhs === m.rhs && x.rhs === m.lhs)))) ? 0 : 1);
  up('MI: tidak ada jalur balik (umpan balik) yang diusulkan', f0.mi.every((m) => !(m.kind === 'reg' && ((m.lhs === 'ind60') || (m.lhs === 'dem60' && m.rhs === 'dem65')))) ? 0 : 1);
  const c = S.compareCB(f0, full), c2 = S.compareCB(full, f0);
  up('compare: delta chi2 = selisih chi2', ab(c.dChi, f0.chi2 - full.chi2)); up('compare: delta db = 6', ab(c.dDf, 6)); up('compare: p = chi2Sf', ab(c.p, global.window.StatDist.chi2Sf(c.dChi, 6)));
  up('compare: urutan argumen tak berpengaruh', ab(c.dChi, c2.dChi) + ab(c.p, c2.p) + (c.restrictedIsMain === !c2.restrictedIsMain ? 0 : 1));
  up('compare: dAIC = AIC terbatas - penuh', ab(c.dAic, f0.fit.aic - full.fit.aic));
  const eq = S.compareCB(f0, fitM(base + '\ny1 ~~ y5'));
  up('compare: nested dengan 1 parameter beda -> db = 1', ab(eq.dDf, 1));
  let thrown = 0; try { S.compareCB(f0, fitM('ind60 =~ x1 + x2 + x3\ndem60 =~ y1 + y2 + y3\ndem60 ~ ind60')); } catch (e) { thrown = /variabel teramati yang sama/.test(e.message) ? 1 : 0; }
  up('compare: galat bila variabel teramati berbeda', thrown ? 0 : 1);
}
/* ---- MLR (SE sandwich + chi-square terskala) & Mardia: vs acuan Python independen (make_ref10.py) ---- */
{
  const M = JSON.parse(fs.readFileSync(__dirname + '/ref_mlr.json', 'utf8'));
  const models = {
    pd: { d: pd, m: 'ind60 =~ x1 + x2 + x3\ndem60 =~ y1 + y2 + y3 + y4\ndem65 =~ y5 + y6 + y7 + y8\ndem60 ~ ind60\ndem65 ~ ind60 + dem60\ny1 ~~ y5\ny2 ~~ y4 + y6\ny3 ~~ y7\ny4 ~~ y8\ny6 ~~ y8' },
    sim: { d: sim, m: 'A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nC =~ c1 + c2 + c3 + c4\nB ~ A\nC ~ B + A' },
  };
  Object.keys(models).forEach((k) => {
    const { d, m } = models[k], ref = M[k], sp = S.parseModel(m, d.names), X = mat(d, sp), r = S.fitCB(sp, X, { estimator: 'mlr' }), ml = S.fitCB(sp, X, {});
    up('MLR ' + k + ' chi2', ab(r.chi2, ref.chi2)); up('MLR ' + k + ' faktor skala c', ab(r.robust.c, ref.c)); up('MLR ' + k + ' c baseline', ab(r.robust.cBase, ref.cBase));
    up('MLR ' + k + ' chi2 terskala', ab(r.robust.chi2Scaled, ref.chi2 / ref.c)); up('MLR ' + k + ' tr(V Gamma)', ab(r.robust.trVG, ref.trVG));
    ref.params.forEach((q) => {
      const x = r.params.find((z) => z.free && z.kind === q.kind && ((z.lhs === q.lhs && z.rhs === q.rhs) || (q.kind === 'cov' && z.lhs === q.rhs && z.rhs === q.lhs)));
      if (!x) { up('MLR param tidak ditemukan', 1); return; }
      up('MLR ' + k + ' estimasi', ab(x.est, q.est)); up('MLR ' + k + ' SE ML', ab(x.seML, q.seML)); up('MLR ' + k + ' SE robust', ab(x.se, q.seR));
    });
    up('MLR ' + k + ': estimasi sama dengan ML', Math.max.apply(null, r.params.map((x, i) => ab(x.est, ml.params[i].est))));
    up('MLR ' + k + ': seML = SE fit ML biasa', Math.max.apply(null, r.params.map((x, i) => (x.free ? ab(x.seML, ml.params[i].se) : 0))));
    up('MLR ' + k + ': chi2 ML tak berubah', ab(r.chi2, ml.chi2));
    const f = r.robust.fit, c = r.robust.c, T = r.chi2, df = r.df, n = r.N, Tb = r.chi2Base, cb = r.robust.cBase, dB = r.dfBase;
    up('MLR ' + k + ' RMSEA robust = sqrt(max(T-c*df,0)/(df*N))', ab(f.rmsea, Math.sqrt(Math.max(T - c * df, 0) / (df * n))));
    up('MLR ' + k + ' RMSEA robust = sqrt(c) x RMSEA terskala', T / c - df > 0 ? ab(f.rmsea, Math.sqrt(c) * f.rmseaScaled) : 0);
    up('MLR ' + k + ' CFI robust', ab(f.cfi, 1 - Math.max(T - c * df, 0) / Math.max(T - c * df, Tb - cb * dB, 1e-300)));
    up('MLR ' + k + ' CFI/TLI dalam batas (CFI<=1)', f.cfi <= 1 + 1e-12 && f.cfiScaled <= 1 + 1e-12 && f.cfi > 0.3 ? 0 : 1);
    /* kasus tepi: model just-identified / c = 1 => tidak ada koreksi */
    const ma = S.mardia(X, sp.observed), rm = ref.mardia;
    up('Mardia ' + k + ' b1p', ab(ma.skew.b1p, rm.b1p) / rm.b1p); up('Mardia ' + k + ' b2p', ab(ma.kurt.b2p, rm.b2p) / rm.b2p); up('Mardia ' + k + ' z kurtosis', ab(ma.kurt.z, rm.zK));
    up('Mardia ' + k + ' stat skew', ab(ma.skew.stat, rm.statSkew) / rm.statSkew); up('Mardia ' + k + ' faktor koreksi k', ab(ma.skew.k, rm.k)); up('Mardia ' + k + ' Mahalanobis maks', ab(ma.maxD, rm.maxD) / rm.maxD);
    up('Mardia ' + k + ' skew univariat', Math.max.apply(null, ma.uni.map((u, i) => ab(u.skew, rm.uniSkew[i])))); up('Mardia ' + k + ' kurtosis univariat', Math.max.apply(null, ma.uni.map((u, i) => ab(u.kurt, rm.uniKurt[i]))));
    up('Mardia ' + k + ' p-value skew = chi2Sf', ab(ma.skew.p, global.window.StatDist.chi2Sf(ma.skew.stat, ma.skew.df)));
  });
}
/* ---- Sifat teoretis: dengan Gamma normal, sandwich = ML (c = 1) ; simulasi Monte Carlo (seed tetap) ---- */
{
  const rngS = (seed) => { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gauss = (rnd) => () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const chi = (g, k) => { let s = 0; for (let i = 0; i < k; i++) { const z = g(); s += z * z; } return s; };
  const gen = (n, seed, kind) => {   // 2 faktor berkorelasi, 3 indikator tiap faktor; kind 'normal' atau 't5' (multivariat t, db 5: kurtosis berat, bentuk elips)
    const rnd = rngS(seed), g = gauss(rnd), X = [];
    for (let i = 0; i < n; i++) {
      const f1 = g(), f2 = 0.5 * f1 + Math.sqrt(0.75) * g(), row = [];
      [[f1, [0.8, 0.7, 0.6]], [f2, [0.7, 0.8, 0.6]]].forEach(([f, ls]) => ls.forEach((l) => row.push(l * f + Math.sqrt(1 - l * l) * g())));
      const sc = kind === 't5' ? Math.sqrt(3 / (chi(g, 5) / 1)) : 1;   // t5: x / sqrt(chi2_5/5) dibakukan ke varians 1 -> faktor sqrt(3/chi2_5)
      X.push(row.map((x) => x * sc));
    }
    return X;
  };
  const model = 'F1 =~ y1 + y2 + y3\nF2 =~ y4 + y5 + y6\nF2 ~ F1', names = ['y1', 'y2', 'y3', 'y4', 'y5', 'y6'], sp = S.parseModel(model, names);
  // (a) Gamma = Gamma normal: bentuk eksplisit via parts -> c = 1 dan sandwich = ML. Dipicu lewat Monte Carlo rata-rata di bawah; di sini cek di data normal besar
  const Xn = gen(4000, 1, 'normal'), rn = S.fitCB(sp, Xn, { estimator: 'mlr' });
  up('MLR data normal N=4000: c mendekati 1 (|c-1| < 0.12)', Math.abs(rn.robust.c - 1) < 0.12 ? 0 : 1);
  up('MLR data normal N=4000: SE robust ~ SE ML (rasio 0.85-1.15)', rn.params.filter((x) => x.free).every((x) => x.se / x.seML > 0.85 && x.se / x.seML < 1.15) ? 0 : 1);
  // (b) Monte Carlo data berekor berat: chi2 ML menggelembung, chi2 terskala ~ db; Mardia menolak
  const R = 120, n = 250; let sML = 0, sSc = 0, rejML = 0, rejSc = 0, sc = 0, mrej = 0, mrejN = 0, ok = 0;
  const seB = []; let cover = 0, coverML = 0, truthVals = [];
  for (let r = 0; r < R; r++) {
    const X = gen(n, 100 + r, 't5'), f = S.fitCB(sp, X, { estimator: 'mlr' }); if (!f.converged || !f.robust || !f.robust.ok) continue; ok++;
    sML += f.chi2; sSc += f.robust.chi2Scaled; sc += f.robust.c; if (f.pChi2 < 0.05) rejML++; if (f.robust.pScaled < 0.05) rejSc++;
    if (S.mardia(X, names).kurt.p < 0.05) mrej++; if (S.mardia(gen(n, 5000 + r, 'normal'), names).kurt.p < 0.05) mrejN++;
  }
  const dfm = S.fitCB(sp, gen(300, 1, 'normal'), {}).df;
  up('MC t5: model benar, db = 8', ab(dfm, 8));
  up('MC t5: rata-rata chi2 ML menggelembung (> 1.5 x db)', sML / ok > 1.5 * dfm ? 0 : 1);
  up('MC t5: rata-rata chi2 terskala ~ db (selisih relatif < 25%)', Math.abs(sSc / ok / dfm - 1) < 0.25 ? 0 : Math.abs(sSc / ok / dfm - 1));
  up('MC t5: tingkat tolak ML > 15% (kesalahan tipe I membengkak)', rejML / ok > 0.15 ? 0 : 1);
  up('MC t5: tingkat tolak terskala < 12% (mendekati 5%)', rejSc / ok < 0.12 ? 0 : rejSc / ok);
  up('MC t5: Mardia kurtosis menolak (> 90%)', mrej / ok > 0.9 ? 0 : 1);
  up('MC normal: Mardia kurtosis menolak ~5% (1%-12%)', mrejN / ok > 0.01 && mrejN / ok < 0.12 ? 0 : mrejN / ok);
  console.log('   [MC] N=' + n + ', ' + ok + ' ulangan t5: mean chi2 ML = ' + (sML / ok).toFixed(2) + ', terskala = ' + (sSc / ok).toFixed(2) + ', c = ' + (sc / ok).toFixed(2) + ', tolak ML = ' + (100 * rejML / ok).toFixed(1) + '%, terskala = ' + (100 * rejSc / ok).toFixed(1) + '%, Mardia(t5) = ' + (100 * mrej / ok).toFixed(0) + '%, Mardia(normal) = ' + (100 * mrejN / ok).toFixed(1) + '%');
}
/* ---- uji selisih chi2 terskala (Satorra-Bentler 2001) ---- */
{
  const base = 'ind60 =~ x1 + x2 + x3\ndem60 =~ y1 + y2 + y3 + y4\ndem65 =~ y5 + y6 + y7 + y8\ndem60 ~ ind60\ndem65 ~ ind60 + dem60';
  const lav = 'y1 ~~ y5\ny2 ~~ y4 + y6\ny3 ~~ y7\ny4 ~~ y8\ny6 ~~ y8';
  const fitM = (m, o) => { const sp = S.parseModel(m, pd.names); return S.fitCB(sp, mat(pd, sp), o); };
  const r0 = fitM(base, { estimator: 'mlr' }), r1 = fitM(base + '\n' + lav, { estimator: 'mlr' }), c = S.compareCB(r0, r1), ml = S.compareCB(fitM(base, {}), fitM(base + '\n' + lav, {}));
  const cd = (r0.df * r0.robust.c - r1.df * r1.robust.c) / (r0.df - r1.df);
  up('MLR compare: cd = (db0 c0 - db1 c1)/(db0 - db1)', ab(c.cd, cd)); up('MLR compare: TRd = (T0 - T1)/cd', ab(c.dChiScaled, (r0.chi2 - r1.chi2) / cd));
  up('MLR compare: p = chi2Sf(TRd, ddb)', ab(c.p, global.window.StatDist.chi2Sf(c.dChiScaled, 6))); up('MLR compare: dChi (ML) tak berubah', ab(c.dChi, ml.dChi)); up('MLR compare: flag scaled', c.scaled && !ml.scaled ? 0 : 1);
  up('MLR compare: BUKAN selisih chi2 terskala naif', ab(c.dChiScaled, r0.robust.chi2Scaled - r1.robust.chi2Scaled) > 1e-6 ? 0 : 1);
  let thrown = 0; try { S.compareCB(r0, fitM(base + '\n' + lav, {})); } catch (e) { thrown = /estimator yang sama/.test(e.message) ? 1 : 0; }
  up('MLR compare: galat bila estimator berbeda', thrown ? 0 : 1);
}
/* ---- validasi parser ---- */
{
  const bad = (m, re) => { try { S.parseModel(m, ['x1', 'x2', 'x3']); up('Parser harus galat: ' + m, 1); } catch (e) { if (!re.test(e.message)) up('Parser pesan: ' + m, 1); } };
  bad('F =~ x1 + zz', /tidak ada di kolom/); bad('F =~ x1 + x2\nF ~ F', /dirinya sendiri/); bad('x1 =~ x2 + x3', /nama kolom/); bad('F =~ x1 +', /suku kosong/); bad('hello', /operator/); bad('', /kosong/);
}
const tol = { 'PD chi2 (3 desimal)': 6e-4, 'PD df': 0, 'PD p': 6e-4, 'PD RMSEA': 6e-4, 'PD CFI': 6e-4, 'PD TLI': 6e-4, 'PD SRMR': 6e-4, 'PD jalur dem60~ind60': 6e-4, 'PD SE dem60~ind60': 6e-4, 'PD jalur dem65~dem60': 6e-4, 'PD SE dem65~dem60': 6e-4, 'PD std dem65~dem60': 6e-4 };
let bad = 0; Object.keys(w).forEach((k) => { const t = tol[k] !== undefined ? tol[k] : (/^MLR .*(estimasi|SE ML|SE robust|faktor skala|c baseline|chi2 terskala|tr\(V Gamma\))/.test(k) ? 2e-5 : /^MLR .*(RMSEA|CFI|chi2$)/.test(k) ? 2e-5 : /^Mardia/.test(k) ? 1e-8 : /^PLS/.test(k) ? 1e-6 : /^CB (estimasi|std)/.test(k) ? 2e-3 : /chi2 vs semopy/.test(k) ? 1e-4 : 1e-9); const ok = w[k] <= t; if (!ok) bad++; console.log((ok ? 'OK   ' : 'GAGAL'), k.padEnd(44), w[k].toExponential(2)); });
console.log(bad ? bad + ' uji GAGAL' : 'Semua uji sem-core lulus');
process.exit(bad ? 1 : 0);
