/* Uji numerik tar-core.js: TAR konvensional, SETAR (2 & 3 rezim), STAR (LSTAR/ESTAR) vs acuan brute force dan scipy (make_ref10.py) */
global.window = {}; require('../Method/Shared/stat-dist.js'); const C = require('../Method/Stat/tar-core.js');
const fs = require('fs'), R = JSON.parse(fs.readFileSync(__dirname + '/ref_tar.json', 'utf8')), S = JSON.parse(fs.readFileSync(__dirname + '/data_tar_sim.json', 'utf8'));
const w = {}, up = (k, e) => { w[k] = Math.max(w[k] || 0, Number.isFinite(e) ? e : 1e9); };
/* syarat logis: kunci berawalan '= ' harus tepat 0 */
const chk = (k, cond) => up('= ' + k, cond ? 0 : 1);
const ab = (a, b) => Math.abs(a - b), rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));
const arr = (k, a, b) => a.forEach((v, i) => up(k, rel(v, b[i])));

/* ---- TAR / SETAR: pencarian ambang, koefisien, SE, AIC, CI Hansen, Tsay, sup-F, diagnostik ---- */
function cmpTAR(tag, r, ref, opt) {
  up(tag + ' delay terpilih', ab(r.d, ref.d)); arr(tag + ' ambang', r.thr, ref.thr); up(tag + ' SSE', rel(r.sse, ref.sse)); up(tag + ' AIC', rel(r.aic, ref.aic)); up(tag + ' BIC', rel(r.bic, ref.bic));
  r.dTable.forEach((q, i) => { up(tag + ' SSE per delay', rel(q.sse, ref.dtab[i].sse)); arr(tag + ' ambang per delay', q.thr, ref.dtab[i].thr); });
  r.regimes.forEach((g, j) => { up(tag + ' n rezim', ab(g.n, ref.regimes[j].n)); arr(tag + ' koefisien', g.coef, ref.regimes[j].coef); arr(tag + ' galat baku', g.se, ref.regimes[j].se); up(tag + ' SSE rezim', rel(g.sse, ref.regimes[j].sse)); });
  up(tag + ' SSE linier', rel(r.lin.sse, ref.lin.sse)); up(tag + ' AIC linier', rel(r.lin.aic, ref.lin.aic));
  if (ref.ci) { up(tag + ' CI Hansen bawah', ab(r.ci.lo, ref.ci[0])); up(tag + ' CI Hansen atas', ab(r.ci.hi, ref.ci[1])); }
  up(tag + ' Tsay F', rel(r.tsay.F, ref.tsay.F)); up(tag + ' Tsay p', ab(r.tsay.p, ref.tsay.p)); up(tag + ' Tsay df2', ab(r.tsay.df2, ref.tsay.df2));
  up(tag + ' Ljung-Box Q', rel(r.diag.lb.Q, ref.lb.Q)); up(tag + ' Ljung-Box df', ab(r.diag.lb.df, ref.lb.df)); up(tag + ' Ljung-Box p', ab(r.diag.lb.p, ref.lb.p)); up(tag + ' Jarque-Bera', rel(r.diag.jb.JB, ref.jb.JB));
  if (opt && opt.boot) { up(tag + ' sup-F', rel(r.boot.F, ref.supF)); }
}
{
  const ref = R.setar2, r = C.fitTAR({ y: S.setar, type: 'setar', nreg: 2, orders: ref.orders, d: 0, dmax: 4, trim: ref.trim, bootB: 150, seed: 11 }); cmpTAR('SETAR2 (p=2,1) d otomatis', r, ref, { boot: true });
  const b = C.fitTAR({ y: S.setar, type: 'setar', nreg: 2, orders: ref.orders, d: 0, dmax: 4, trim: ref.trim, bootB: 150, seed: 11 }); up('Bootstrap reproducible', ab(r.boot.p, b.boot.p));
  chk('Parameter sebenarnya dipulihkan: d = 2', r.d === 2); chk('Ambang sebenarnya 0,3 (toleransi 0,05)', ab(r.thr[0], 0.3) < 0.05); chk('Bootstrap menolak linieritas pada data SETAR', r.boot.p < 0.05);
  chk('Uji Tsay menolak linieritas pada data SETAR', r.tsay.p < 0.01);
}
{ const ref = R.setar2_p2, r = C.fitTAR({ y: S.setar, type: 'setar', nreg: 2, orders: ref.orders, d: ref.dlist[0], trim: ref.trim, bootB: 100, seed: 3 }); cmpTAR('SETAR2 (p=2,2) d tetap', r, ref, { boot: true }); }
{ const ref = R.setar3, r = C.fitTAR({ y: S.setar.slice(0, ref.n), type: 'setar', nreg: 3, orders: ref.orders, d: ref.dlist[0], trim: ref.trim, maxCand3: 5000 }); cmpTAR('SETAR3', r, ref); }
{ const ref = R.tar, r = C.fitTAR({ y: S.tar_y, z: S.tar_z, type: 'tar', nreg: 2, orders: ref.orders, d: 0, dmax: 3, trim: ref.trim, bootB: 100, seed: 5 }); cmpTAR('TAR konvensional (Z eksternal)', r, ref, { boot: true }); chk('TAR: d sebenarnya = 1', r.d === 1); chk('TAR: ambang sebenarnya -0,2 (toleransi 0,1)', ab(r.thr[0], -0.2) < 0.1); }

/* ---- uji sup-F terkalibrasi: data linier tidak menolak ---- */
{ const r = C.fitTAR({ y: S.linear, type: 'setar', nreg: 2, orders: [1, 1], d: 1, bootB: 200, seed: 1 }); chk('Data linier: bootstrap p > 0,05', r.boot.p > 0.05); chk('Data linier: Tsay p > 0,05', r.tsay.p > 0.05); }

/* ---- peramalan ---- */
{
  const r = C.fitTAR({ y: S.setar, type: 'setar', nreg: 2, orders: [2, 1], d: 2, h: 4, simB: 400, seed: 9 }), n = S.setar.length, f = r.forecast;
  const j = S.setar[n - 2] <= r.thr[0] ? 0 : 1, rg = r.regimes[j]; let mu = rg.coef[0]; for (let i = 1; i < rg.k; i++) mu += rg.coef[i] * S.setar[n - i];
  up('Ramalan skeleton 1 langkah = nilai bersyarat', ab(f.skeleton[0], mu)); chk('Rezim ramalan sesuai aturan ambang', f.regime[0] === j + 1);
  chk('Selang 95% memuat rata-rata simulasi', f.lo.every((v, i) => v <= f.mean[i] && f.mean[i] <= f.hi[i])); chk('Selang melebar? hi-lo > 0', f.hi.every((v, i) => v - f.lo[i] > 0));
  const t = C.fitTAR({ y: S.tar_y, z: S.tar_z, type: 'tar', nreg: 2, orders: [1, 2], d: 2, h: 6, simB: 100 }); chk('TAR konvensional: horizon dibatasi d', t.forecast.h === 2); chk('TAR konvensional: catatan batas horizon', t.forecast.notes.length);
}

/* ---- STAR ---- */
function cmpSTAR(tag, fit, ref) {
  up(tag + ' SSE (<= acuan + 1e-6 relatif)', Math.max(0, (fit.sse - ref.sse) / ref.sse - 1e-6)); up(tag + ' SSE (selisih)', rel(fit.sse, ref.sse));
  up(tag + ' gamma', rel(fit.gamma, ref.gamma)); up(tag + ' c (satuan asli)', rel(fit.c, ref.c)); arr(tag + ' phi', fit.phi, ref.phi); arr(tag + ' theta', fit.theta, ref.theta);
  arr(tag + ' SE phi', fit.sePhi, ref.sePhi); arr(tag + ' SE theta', fit.seTheta, ref.seTheta); up(tag + ' SE gamma', rel(fit.seGamma, ref.seGamma)); up(tag + ' SE c', rel(fit.seC, ref.seC)); arr(tag + ' SE phi+theta', fit.seHigh, ref.seHigh); up(tag + ' AIC', rel(fit.aic, ref.aic));
}
function cmpTer(tag, tests, ref) {
  tests.forEach((t) => { const q = ref[String(t.d)]; ['general', 'h04', 'h03', 'h02'].forEach((k) => { up(tag + ' F ' + k, rel(t[k].F, q[k][0])); up(tag + ' p ' + k, ab(t[k].p, q[k][1])); }); });
}
{
  const r = C.fitSTAR({ y: S.lstar, p: 1, d: 0, dmax: 3, form: 'auto', h: 5, simB: 300 }); chk('LSTAR: d otomatis = 1', r.d === 1); chk('LSTAR: aturan Terasvirta memilih LSTAR', r.form === 'lstar');
  cmpSTAR('LSTAR', C.fitSTAR({ y: S.lstar, p: 1, d: 1, form: 'lstar' }).fits.lstar, R.lstar); cmpTer('LSTAR uji Terasvirta', r.tests, R.lstar_tests); up('LSTAR: SSE linier d tetap', rel(C.fitSTAR({ y: S.lstar, p: 1, d: 1, form: 'lstar' }).lin.sse, R.lstar.lin_sse));
  chk('LSTAR: gamma terstandar sebenarnya ~ 4 sd(y) (rentang lebar 1,5-6)', r.fit.gamma > 1.5 && r.fit.gamma < 6);
  chk('Ramalan STAR 1 langkah memakai G di [0,1]', r.forecast.G.every((g) => g >= 0 && g <= 1));
}
{
  const r = C.fitSTAR({ y: S.estar, p: 2, d: 0, dmax: 3, form: 'auto', h: 3, simB: 200 }); chk('ESTAR: d otomatis = 1', r.d === 1); chk('ESTAR: aturan Terasvirta memilih ESTAR', r.form === 'estar');
  cmpSTAR('ESTAR', C.fitSTAR({ y: S.estar, p: 2, d: 1, form: 'estar' }).fits.estar, R.estar); cmpTer('ESTAR uji Terasvirta', r.tests, R.estar_tests);
}

/* ---- validasi masukan ---- */
{
  const bad = (f, re, tag) => { try { f(); up('Harus galat: ' + tag, 1); } catch (e) { if (!re.test(e.message)) { up('Pesan galat: ' + tag, 1); console.log('pesan:', e.message); } } };
  bad(() => C.fitTAR({ y: S.setar.slice(0, 12), type: 'setar', nreg: 2, orders: [2, 2], d: 1 }), /terlalu pendek/, 'data pendek');
  bad(() => C.fitTAR({ y: S.setar, type: 'tar', nreg: 2, orders: [1, 1], d: 1 }), /variabel ambang Z/, 'TAR tanpa Z');
  bad(() => C.fitTAR({ y: S.setar, type: 'setar', nreg: 2, orders: [0, 1], d: 1 }), /Orde AR/, 'orde 0');
  bad(() => C.fitTAR({ y: S.setar, type: 'setar', nreg: 4, orders: [1, 1], d: 1 }), /2 atau 3/, 'rezim 4');
  bad(() => C.fitSTAR({ y: S.lstar.slice(0, 15), p: 2, d: 1 }), /terlalu pendek/, 'STAR pendek');
  bad(() => C.fitTAR({ y: S.setar.map((v, i) => (i % 2 ? 1 : 1)), type: 'setar', nreg: 2, orders: [1, 1], d: 1 }), /./, 'deret konstan');
}

let bad = 0;
const tolOf = (k) => {
  if (k[0] === '=') return 0;
  if (/^(LSTAR|ESTAR)/.test(k)) return /uji Terasvirta/.test(k) ? 1e-8 : /SSE linier/.test(k) ? 1e-9 : /SSE \(<=/.test(k) ? 0 : /SSE \(selisih\)/.test(k) ? 1e-6 : /SE /.test(k) ? 2e-3 : 2e-4;
  if (/ambang|delay terpilih|n rezim|CI Hansen|df/.test(k)) return 1e-12;
  if (/Bootstrap reproducible/.test(k)) return 0;
  return 1e-8;
};
Object.keys(w).forEach((k) => {
  const t = tolOf(k), ok = w[k] <= t; if (!ok) bad++; console.log((ok ? 'OK    ' : 'GAGAL ') + k + '  galat=' + w[k].toExponential(2) + (ok ? '' : '  (batas ' + t + ')'));
});
console.log(bad ? bad + ' uji GAGAL' : 'Semua uji tar-core lulus');
process.exit(bad ? 1 : 0);
