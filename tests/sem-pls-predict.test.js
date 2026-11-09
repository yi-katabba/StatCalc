/* Uji sem-core.js item 5: Q2 blindfolding dan PLSpredict.
   Pembanding independen: ref_pls_pred.json (make_ref11.py: PLS numpy dari nol, LM dengan lstsq pada data mentah, lipatan identik via port PRNG).
   Sifat teoretis: data noise murni -> Q2 <= ~0, efek kuat -> Q2 > 0; reproducible; opsi baru tidak mengubah hasil PLS utama; galat masukan. */
global.window = {}; require('../Method/Shared/stat-dist.js'); const S = require('../Method/Stat/sem-core.js');
const fs = require('fs'), sim = JSON.parse(fs.readFileSync(__dirname + '/data_sem_sim.json', 'utf8')), REF = JSON.parse(fs.readFileSync(__dirname + '/ref_pls_pred.json', 'utf8'));
let fails = 0; const ab = (a, b) => Math.abs(a - b);
const chk = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'OK    ' : 'GAGAL ') + name + (info !== undefined ? '   ' + info : '')); };
const near = (name, a, b, tol) => chk(name, ab(a, b) <= tol, 'selisih ' + ab(a, b).toExponential(2));
const throws = (name, fn, re) => { let m = null; try { fn(); } catch (e) { m = e.message; } chk(name, m !== null && (!re || re.test(m)), m ? '"' + m.slice(0, 80) + '…"' : 'tidak melempar galat'); };
const MODEL = 'A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nC =~ c1 + c2 + c3 + c4\nB ~ A\nC ~ B + A\nz ~ C + w';
const mk = (model, d) => { const sp = S.parseModel(model, d.names), ix = sp.observed.map((c) => d.names.indexOf(c)); return { sp, ds: { names: sp.observed, X: d.X.map((r) => ix.map((i) => r[i])) } }; };
const { sp, ds } = mk(MODEL, sim);

/* ---- 1. Blindfolding vs acuan numpy ---- */
{
  const cmp = (tag, r, ref) => {
    const byN = {}; r.blind.constructs.forEach((c) => { byN[c.name] = c; }); let worst = 0, cnt = 0;
    Object.keys(ref).forEach((nm) => {
      const c = byN[nm], o = ref[nm];
      if ('comm' in o) { worst = Math.max(worst, ab(c.comm.q2, o.comm)); cnt++; o.commInd.forEach((v, h) => { worst = Math.max(worst, ab(c.indicators[h].commQ2, v)); cnt++; }); } else chk(tag + ' ' + nm + ': tanpa communality (indikator tunggal)', c.comm === null);
      if ('red' in o) { worst = Math.max(worst, ab(c.red.q2, o.red)); cnt++; o.redInd.forEach((v, h) => { worst = Math.max(worst, ab(c.indicators[h].redQ2, v)); cnt++; }); } else chk(tag + ' ' + nm + ': tanpa redundancy (eksogen)', c.red === null);
    });
    chk(tag + ': ' + cnt + ' nilai Q2 (konstruk + indikator) sama dgn numpy', worst < 2e-6, 'selisih maks ' + worst.toExponential(2));
  };
  cmp('Blindfolding path D=7', S.fitPLS(sp, ds, { scheme: 'path', blind: 7 }), REF.blind.path);
  cmp('Blindfolding centroid D=7', S.fitPLS(sp, ds, { scheme: 'centroid', blind: 7 }), REF.blind.centroid);
  cmp('Blindfolding path D=5', S.fitPLS(sp, ds, { scheme: 'path', blind: 5 }), REF.blindD5);
}
/* ---- 2. PLSpredict vs acuan numpy (RMSE, MAE, Q2predict, LM) ---- */
{
  [['path', 'direct', 'path_direct'], ['path', 'earliest', 'path_earliest'], ['centroid', 'direct', 'centroid_direct']].forEach(([scheme, tech, key]) => {
    const r = S.fitPLS(sp, ds, { scheme, predict: { folds: 5, reps: 3, technique: tech, seed: 42 } }), ref = REF.predict[key], rows = r.predict.rows;
    chk('PLSpredict ' + key + ': jumlah target = ' + ref.length, rows.length === ref.length);
    let wr = 0, wm = 0, wq = 0, wlr = 0, wlm = 0;
    ref.forEach((q, i) => { const x = rows[i]; wr = Math.max(wr, ab(x.rmse, q.rmse)); wm = Math.max(wm, ab(x.mae, q.mae)); wq = Math.max(wq, ab(x.q2, q.q2)); wlr = Math.max(wlr, ab(x.lmRmse, q.lrmse)); wlm = Math.max(wlm, ab(x.lmMae, q.lmae)); });
    chk('PLSpredict ' + key + ': RMSE PLS = numpy', wr < 1e-6, wr.toExponential(2)); chk('PLSpredict ' + key + ': MAE PLS = numpy', wm < 1e-6, wm.toExponential(2));
    chk('PLSpredict ' + key + ': Q2predict = numpy', wq < 1e-6, wq.toExponential(2));
    chk('PLSpredict ' + key + ': RMSE LM (lstsq mentah) = LM persamaan normal', wlr < 1e-8, wlr.toExponential(2)); chk('PLSpredict ' + key + ': MAE LM = numpy', wlm < 1e-8, wlm.toExponential(2));
  });
  const d = S.fitPLS(sp, ds, { predict: { folds: 5, reps: 3, technique: 'direct', seed: 42 } }).predict, e = S.fitPLS(sp, ds, { predict: { folds: 5, reps: 3, technique: 'earliest', seed: 42 } }).predict;
  chk('DA dan EA memberi prediksi berbeda untuk konstruk dengan mediator (C, z)', d.rows.some((x, i) => x.construct !== 'B' && ab(x.rmse, e.rows[i].rmse) > 1e-4));
  chk('Konstruk dengan pendahulu eksogen saja (B) sama pada DA dan EA', d.rows.filter((x) => x.construct === 'B').every((x, i) => ab(x.rmse, e.rows.filter((y) => y.construct === 'B')[i].rmse) < 1e-9));
}
/* ---- 3. Sifat: reproducible, tidak mengubah hasil utama, ringkasan ---- */
{
  const base = S.fitPLS(sp, ds, { scheme: 'path' }), full = S.fitPLS(sp, ds, { scheme: 'path', blind: 7, predict: { folds: 10, reps: 2, seed: 9 } }), again = S.fitPLS(sp, ds, { scheme: 'path', blind: 7, predict: { folds: 10, reps: 2, seed: 9 } }), other = S.fitPLS(sp, ds, { scheme: 'path', predict: { folds: 10, reps: 2, seed: 10 } });
  chk('opsi blind/predict tidak mengubah koefisien jalur & R2', base.paths.every((p, i) => ab(p.beta, full.paths[i].beta) === 0) && base.r2.every((x, i) => ab(x.r2, full.r2[i].r2) === 0));
  chk('opsi blind/predict tidak mengubah loading/bobot', base.constructs.every((c, i) => c.loadings.every((l, h) => l === full.constructs[i].loadings[h] && c.weights[h] === full.constructs[i].weights[h])));
  chk('reproducible (seed sama)', full.predict.rows.every((x, i) => x.rmse === again.predict.rows[i].rmse && x.q2 === again.predict.rows[i].q2));
  chk('seed beda -> lipatan beda -> RMSE beda', other.predict.rows.some((x, i) => x.rmse !== full.predict.rows[i].rmse));
  chk('tanpa opsi: res.blind dan res.predict tidak ada', base.blind === undefined && base.predict === undefined);
  chk('Q2 blindfolding deterministik', full.blind.constructs.every((c, i) => c.red === again.blind.constructs[i].red || c.red.q2 === again.blind.constructs[i].red.q2));
  const B = full.blind.constructs.find((c) => c.name === 'B'), r2B = full.r2.find((x) => x.name === 'B').r2;
  chk('Q2 redundancy B > 0 dan < R2 B (prediksi luar-sampel < dalam-sampel)', B.red.q2 > 0 && B.red.q2 < r2B, B.red.q2.toFixed(3) + ' < ' + r2B.toFixed(3));
  chk('Q2 = 1 - SSE/SSO (konstruk)', ab(B.red.q2, 1 - B.red.sse / B.red.sso) < 1e-12);
  chk('banyak sel diprediksi = n x jumlah indikator (tiap sel hilang sekali)', B.comm.n === ds.X.length * 3 && B.red.n === ds.X.length * 3, B.comm.n + ' = ' + ds.X.length * 3);
  chk('A (eksogen reflektif): ada communality, tanpa redundancy', full.blind.constructs[0].comm !== null && full.blind.constructs[0].red === null);
  const w = full.blind.constructs.find((c) => c.name === 'w'); chk('w (eksogen indikator tunggal): tanpa Q2', w.comm === null && w.red === null);
  const lvl = full.predict.constructs.find((c) => c.name === 'C'); chk('ringkasan per konstruk: jumlah indikator & level valid', lvl.nInd === 4 && ['tinggi', 'sedang', 'rendah', 'tidak ada'].indexOf(lvl.level) >= 0, JSON.stringify(lvl));
  const lv = full.predict.constructs.find((c) => c.name === 'C'), rows = full.predict.rows.filter((x) => x.construct === 'C'); chk('level konsisten dgn hitung ΔRMSE<0', lv.nBetter === rows.filter((x) => x.dRmse < 0).length);
  chk('dRmse = RMSE PLS - RMSE LM', full.predict.rows.every((x) => ab(x.dRmse, x.rmse - x.lmRmse) < 1e-12));
}
/* ---- 4. Data noise murni vs efek kuat ---- */
{
  const rngS = (seed) => { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gen = (n, seed, beta) => { const r = rngS(seed), g = () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }, X = []; for (let i = 0; i < n; i++) { const f = g(), y = beta * f + Math.sqrt(1 - beta * beta) * g(), row = []; [f, y].forEach((v) => [0.8, 0.75, 0.7].forEach((l) => row.push(l * v + Math.sqrt(1 - l * l) * g()))); X.push(row); } return X; };
  const names = ['f1', 'f2', 'f3', 'y1', 'y2', 'y3'], M = 'F =~ f1 + f2 + f3\nG =~ y1 + y2 + y3\nG ~ F';
  let nQ = 0, nP = 0, R = 40, sQ = 0, sP = 0, ok = 0;
  for (let s = 0; s < R; s++) { const r = S.fitPLS(S.parseModel(M, names), { names, X: gen(200, 300 + s, 0) }, { blind: 7, predict: { folds: 5, reps: 1, seed: s } }); if (!r.blind || !r.predict) continue; ok++; const q = r.blind.constructs.find((c) => c.name === 'G').red.q2; sQ += q; if (q > 0.05) nQ++; r.predict.rows.forEach((x) => { sP += x.q2 / 3; if (x.q2 > 0.05) nP++; }); }
  chk('noise murni (beta = 0): rata-rata Q2 redundancy G <= 0.02 (' + ok + ' ulangan)', sQ / ok <= 0.02, (sQ / ok).toFixed(4)); chk('noise murni: Q2 redundancy > 0.05 jarang (<= 10%)', nQ / ok <= 0.1, (100 * nQ / ok).toFixed(0) + '%');
  chk('noise murni: rata-rata Q2predict <= 0.02', sP / ok <= 0.02, (sP / ok).toFixed(4)); chk('noise murni: Q2predict > 0.05 jarang (<= 10% indikator)', nP / (3 * ok) <= 0.1, (100 * nP / (3 * ok)).toFixed(0) + '%');
  const rs = S.fitPLS(S.parseModel(M, names), { names, X: gen(300, 77, 0.7) }, { blind: 7, predict: { folds: 5, reps: 2, seed: 1 } });
  chk('efek kuat (beta = 0.7): Q2 redundancy G > 0.1', rs.blind.constructs.find((c) => c.name === 'G').red.q2 > 0.1, rs.blind.constructs.find((c) => c.name === 'G').red.q2.toFixed(3));
  chk('efek kuat: Q2predict semua indikator G > 0.05', rs.predict.rows.every((x) => x.q2 > 0.05)); chk('efek kuat: level prediksi G = tinggi atau sedang', ['tinggi', 'sedang'].indexOf(rs.predict.constructs[0].level) >= 0, rs.predict.constructs[0].level);
}
/* ---- 5. Masukan tidak sah & kasus tepi ---- */
{
  throws('D terlalu kecil', () => S.fitPLS(sp, ds, { blind: 1 }), /Jarak omisi/); throws('D >= n', () => S.fitPLS(sp, ds, { blind: 999 }), /Jarak omisi/);
  throws('lipatan terlalu banyak untuk n', () => S.fitPLS(sp, ds, { predict: { folds: 200, reps: 1 } }), /terlalu besar/);
  const r = S.fitPLS(sp, ds, { blind: 3 }); chk('D = 3 memberi peringatan di luar 5-12', r.warnings.some((w) => /5–12/.test(w)));
  const r2 = S.fitPLS(sp, ds, { predict: { folds: 10, reps: 1 } }); chk('n/lipatan < 30 memberi peringatan', r2.warnings.some((w) => /≥ 30/.test(w)) === (ds.X.length / 10 < 30));
  const sp2 = S.parseModel('A =~ a1 + a2 + a3\nQ <~ b1 + b2 + b3\nC =~ c1 + c2 + c3\nQ ~ A\nC ~ Q', sim.names), ix = sp2.observed.map((c) => sim.names.indexOf(c)), d2 = { names: sp2.observed, X: sim.X.map((r) => ix.map((i) => r[i])) };
  const rf = S.fitPLS(sp2, d2, { blind: 7, predict: { folds: 5, reps: 1, seed: 3 } }), qn = rf.blind.constructs.find((c) => c.name === 'Q');
  chk('konstruk endogen formatif: tanpa Q2 (redundancy & communality)', qn.red === null && qn.comm === null); chk('konstruk endogen formatif: dilewati di PLSpredict + peringatan', !rf.predict.rows.some((x) => x.construct === 'Q') && rf.warnings.some((w) => /formatif/.test(w)));
  chk('konstruk reflektif C (endogen, pendahulu formatif) tetap dihitung', rf.blind.constructs.find((c) => c.name === 'C').red !== null && rf.predict.rows.some((x) => x.construct === 'C'));
  const rb = S.fitPLS(sp, ds, { blind: 7, boot: 50, seed: 3, predict: { folds: 5, reps: 1 } }); chk('bersama bootstrap: semua keluaran ada', rb.boot && rb.blind && rb.predict && rb.paths[0].boot);
}
console.log(fails ? fails + ' uji GAGAL' : 'Semua uji sem-pls-predict lulus'); process.exit(fails ? 1 : 0);
