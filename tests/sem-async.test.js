/* Uji sem-core.js item 6: PLS-SEM bertahap (generator) untuk progress bar dan pembatalan.
   Sifat yang dijaga: (1) hasil bertahap IDENTIK dengan hasil sinkron (seed sama); (2) kemajuan dilaporkan per fase
   (boot / blind / predict) dengan done monoton naik dan total benar; (3) pembatalan berhenti dan mengembalikan null;
   (4) galat validasi tetap sampai ke pemanggil sebagai penolakan Promise; (5) bootstrap CB-SEM bertahap bisa dibatalkan. */
global.window = {}; require('../Method/Shared/stat-dist.js'); const S = require('../Method/Stat/sem-core.js');
const fs = require('fs'), sim = JSON.parse(fs.readFileSync(__dirname + '/data_sem_sim.json', 'utf8'));
let fails = 0; const chk = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'OK    ' : 'GAGAL ') + n + (i !== undefined ? '   ' + i : '')); };
const MODEL = 'A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nC =~ c1 + c2 + c3 + c4\nB ~ A\nC ~ B + A';
const mk = (model) => { const sp = S.parseModel(model, sim.names), ix = sp.observed.map((c) => sim.names.indexOf(c)); return { sp, ds: { names: sp.observed, X: sim.X.map((r) => ix.map((i) => r[i])) } }; };
const { sp, ds } = mk(MODEL);
const OPT = { scheme: 'path', boot: 300, seed: 7, blind: 7, predict: { folds: 5, reps: 3, technique: 'direct', seed: 7 } };
const strip = (r) => JSON.stringify(r, (k, v) => (typeof v === 'function' ? undefined : v));

(async () => {
  /* 1. identik dengan versi sinkron */
  const sync = S.fitPLS(sp, ds, OPT), asy = await S.fitPLSAsync(sp, ds, OPT);
  chk('async == sinkron (seluruh hasil, termasuk bootstrap, Q² dan PLSpredict)', strip(sync) === strip(asy), strip(sync).length + ' karakter dibandingkan');
  chk('hasil bootstrap, blindfolding dan PLSpredict benar-benar ada', !!(asy.boot && asy.blind && asy.predict));

  /* 2. kemajuan per fase */
  const ev = []; const g = S._fitPLSGen(sp, ds, OPT); let r = g.next(); while (!r.done) { ev.push(r.value); r = g.next(); }
  const ph = (p) => ev.filter((e) => e.phase === p);
  chk('fase bootstrap: ' + OPT.boot + ' tik, total benar', ph('boot').length === OPT.boot && ph('boot').every((e) => e.total === OPT.boot), ph('boot').length + ' tik');
  chk('fase blindfolding: D = 7 tik', ph('blind').length === 7 && ph('blind').every((e) => e.total === 7));
  chk('fase PLSpredict: lipatan × ulangan = 15 tik', ph('predict').length === 15 && ph('predict').every((e) => e.total === 15));
  chk('done monoton naik pada tiap fase', ['boot', 'blind', 'predict'].every((p) => ph(p).every((e, i) => e.done === i)));
  chk('urutan fase: blindfolding, PLSpredict, lalu bootstrap (tidak tercampur)', ev.map((e) => e.phase).join(',').replace(/(\w+)(,\1)+/g, '$1') === 'blind,predict,boot', ev.map((e) => e.phase).join(',').replace(/(\w+)(,\1)+/g, '$1'));

  /* 3. pembatalan */
  let calls = 0, seen = 0; const big = { scheme: 'path', boot: 5000, seed: 1 };
  const t0 = Date.now(), out = await S.fitPLSAsync(sp, ds, big, () => { seen++; }, () => ++calls > 3);
  chk('batal: mengembalikan null dan berhenti jauh sebelum selesai', out === null && Date.now() - t0 < 1500, (Date.now() - t0) + ' ms (penuh ≈ 1,7 dtk)');
  const outNow = await S.fitPLSAsync(sp, ds, big, null, () => true); chk('batal sebelum mulai: null', outNow === null);

  /* 4. galat tetap sampai ke pemanggil */
  const bad = mk('A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nB ~ l*A');
  let msg = null; try { await S.fitPLSAsync(bad.sp, bad.ds, { boot: 50 }); } catch (e) { msg = e.message; }
  chk('galat validasi (label di PLS) ditolak lewat Promise', msg !== null && /hanya didukung oleh CB-SEM/.test(msg), msg && msg.slice(0, 60));
  let msg2 = null; try { await S.fitPLSAsync(sp, { names: ds.names, X: ds.X.slice(0, 5) }, { boot: 50 }); } catch (e) { msg2 = e.message; }
  chk('galat n < 10 ditolak lewat Promise', msg2 !== null && /minimal 10/.test(msg2), msg2 && msg2.slice(0, 60));

  /* 5. bootstrap CB-SEM bertahap: batal -> null, model utama tidak rusak */
  const cm = S.parseModel('A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nB ~ A', sim.names), cx = cm.observed.map((c) => sim.names.indexOf(c)), X = sim.X.map((q) => cx.map((i) => q[i]));
  const fit = S.fitCB(cm, X, {}), est0 = fit.params.map((p) => p.est); let k = 0;
  const cbo = await S.bootCBAsync(cm, X, fit, { B: 3000, seed: 3 }, null, () => ++k > 2);
  chk('CB bootstrap dibatalkan -> null; estimasi utama tidak berubah; tanpa boot', cbo === null && !fit.boot && est0.every((v, i) => v === fit.params[i].est));
  const fit2 = S.fitCB(cm, X, {}); const full = await S.bootCBAsync(cm, X, fit2, { B: 100, seed: 3 }); chk('CB bootstrap lengkap tetap berjalan (100 resampel)', full && full.boot && full.boot.ok > 90, 'ok = ' + (full && full.boot && full.boot.ok));

  console.log(fails ? fails + ' GAGAL' : 'Semua uji sem-async lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
