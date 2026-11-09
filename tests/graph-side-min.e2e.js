/* Uji panel kiri/kanan menu Grafik bisa diciutkan. Jalankan: node tests/graph-side-min.e2e.js (butuh playwright) */
const { chromium } = require('playwright'); const fs = require('fs'); const P = require('path').resolve(__dirname, '..'), OUT = require('os').tmpdir() + '/graph-side';
fs.mkdirSync(OUT, { recursive: true }); let fails = 0; const chk = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'OK    ' : 'GAGAL ') + n + (i !== undefined ? '   ' + i : '')); };
(async () => {
  const b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('file://' + P + '/index.html'); await pg.waitForTimeout(500);
  const ids = await pg.$$eval('.gr-view', (v) => v.map((x) => x.id)); chk('Ada tampilan grafik', ids.length >= 10, ids.length + ' tampilan');
  const V = ids[0], sel = (s) => '#' + V + ' ' + s;
  await pg.evaluate((i) => { document.body.classList.remove('pre-auth'); document.querySelectorAll('.view').forEach((v) => v.classList.remove('active')); document.getElementById(i).classList.add('active'); window.dispatchEvent(new Event('resize')); }, V); await pg.waitForTimeout(400);
  const W = (s) => pg.$eval(sel(s), (e) => Math.round(e.getBoundingClientRect().width)), vis = (s) => pg.$eval(sel(s), (e) => e.offsetParent !== null);
  const dataCard = '.chapter-inner > [id$="data-card"]:not([hidden])';
  chk('Bilah ciutkan ada di panel data dan panel pengaturan', await pg.$(sel('[id$="data-card"] > .gx-bar .gx-btn')) !== null && await pg.$(sel('.rb-main > .gx-bar .gx-btn')) !== null);
  const l0 = await W(dataCard), r0 = await W('.rb-main'), c0 = await W('.gr-pane-grafik:not([hidden])');
  await pg.click(sel(dataCard + ' > .gx-bar .gx-btn')); await pg.waitForTimeout(300);
  const l1 = await W(dataCard), m1 = await W('.rb-main');
  chk('Panel data menjadi rel 44 px', l1 >= 40 && l1 <= 48, l0 + ' → ' + l1); chk('Panel pengaturan tetap', Math.abs(m1 - r0) < 6, r0 + ' → ' + m1);
  await pg.click(sel('.rb-main > .gx-bar .gx-btn')); await pg.waitForTimeout(300);
  chk('Panel pengaturan menjadi rel 44 px', (await W('.rb-main')) <= 48, (await W('.rb-main')) + ' px');
  chk('Isi panel pengaturan tersembunyi', !(await pg.$eval(sel('.rb-main .rb-tabs'), (e) => e.offsetParent !== null).catch(() => false)));
  const c1 = await W('.gr-pane-grafik:not([hidden])'); chk('Area grafik melebar saat kedua panel diciutkan', c1 > c0 + 300, c0 + ' → ' + c1);
  await pg.screenshot({ path: OUT + '/min.png' });
  await pg.click(sel(dataCard)); await pg.click(sel('.rb-main')); await pg.waitForTimeout(300);
  chk('Klik rel membuka kembali (lebar semula)', Math.abs((await W(dataCard)) - l0) < 30 && Math.abs((await W('.rb-main')) - r0) < 30, (await W(dataCard)) + ' / ' + (await W('.rb-main')));
  /* pilihan berlaku di jenis grafik lain + tersimpan */
  await pg.click(sel(dataCard + ' > .gx-bar .gx-btn')); await pg.waitForTimeout(200);
  await pg.evaluate((i) => { document.querySelectorAll('.view').forEach((v) => v.classList.remove('active')); document.getElementById(i).classList.add('active'); window.dispatchEvent(new Event('resize')); }, ids[3]); await pg.waitForTimeout(300);
  chk('Grafik lain ikut menciut', (await pg.$eval('#' + ids[3] + ' .chapter-inner > [id$="data-card"]:not([hidden])', (e) => Math.round(e.getBoundingClientRect().width))) <= 48);
  await pg.reload(); await pg.waitForTimeout(500);
  await pg.evaluate((i) => { document.body.classList.remove('pre-auth'); document.querySelectorAll('.view').forEach((v) => v.classList.remove('active')); document.getElementById(i).classList.add('active'); window.dispatchEvent(new Event('resize')); }, V); await pg.waitForTimeout(400);
  chk('Tersimpan setelah muat ulang', (await W(dataCard)) <= 48);
  await pg.click(sel(dataCard)); await pg.waitForTimeout(200);
  /* layar 1200: hanya panel kiri */
  await pg.setViewportSize({ width: 1200, height: 900 }); await pg.waitForTimeout(300);
  chk('1200 px: bilah panel kanan tidak tampil, panel kiri tampil', !(await vis('.rb-main > .gx-bar')) && (await vis('[id$="data-card"]:not([hidden]) > .gx-bar')));
  await pg.setViewportSize({ width: 900, height: 900 }); await pg.waitForTimeout(300);
  chk('900 px: tak ada bilah ciutkan', !(await vis('[id$="data-card"]:not([hidden]) > .gx-bar')));
  chk('Tidak ada galat JS', errs.length === 0, errs.join('|').slice(0, 200)); await b.close(); console.log(fails ? fails + ' gagal' : 'Semua uji lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
