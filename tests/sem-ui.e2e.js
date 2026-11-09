/* Uji antarmuka SEM di peramban sungguhan (butuh: npm i playwright). Jalankan: node tests/sem-ui.e2e.js [folder-proyek]
   Mencakup: progress bar + Batal (PLS dan CB), halaman tetap responsif, unduhan diagram jalur SVG/PNG dari panel ekspor. */
const { chromium } = require('playwright'); const fs = require('fs');
const P = process.argv[2] || require('path').resolve(__dirname, '..'), OUT = require('os').tmpdir() + '/sem-ui-out'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const chk = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'OK    ' : 'GAGAL ') + n + (i !== undefined ? '   ' + i : '')); };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true }), pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('file://' + P + '/index.html'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { document.body.classList.remove('pre-auth'); document.querySelectorAll('.view').forEach((v) => v.classList.remove('active')); document.getElementById('view-sem').classList.add('active'); });
  await pg.click('#sxSample');
  const run = async (est, sets) => {
    await pg.selectOption('#sxEst', est); await pg.evaluate(() => document.getElementById('sxEst').dispatchEvent(new Event('change')));
    for (const [id, v] of Object.entries(sets)) await pg.selectOption('#' + id, v);
  };
  /* ---- A. PLS dengan bootstrap + blindfolding + PLSpredict: progress tampil, hasil muncul ---- */
  await run('pls', { sxBoot: '5000', sxQ2: '7', sxPred: '5x10' });
  await pg.evaluate(() => { window.__gaps = []; let last = performance.now(); window.__iv = setInterval(() => { const n = performance.now(); window.__gaps.push(n - last); last = n; }, 20); });
  await pg.click('#sxCalc');
  const seen = new Set(); let calcDisabled = null, lastTxt = '';
  for (let i = 0; i < 400; i++) {
    const t = await pg.evaluate(() => { const e = document.querySelector('.sem-prog'); return e && e.style.display !== 'none' ? { txt: e.querySelector('span').textContent, dis: document.getElementById('sxCalc').disabled } : null; });
    if (!t) { if (i > 3) break; } else { seen.add(t.txt.split(':')[0]); calcDisabled = t.dis; lastTxt = t.txt; }
    await pg.waitForTimeout(50);
  }
  const gaps = await pg.evaluate(() => { clearInterval(window.__iv); return window.__gaps; }), maxGap = Math.max.apply(null, gaps);
  chk('PLS: progress menampilkan fase bootstrap', seen.has('Bootstrap'), lastTxt);
  chk('PLS: tombol Hitung dinonaktifkan selama berjalan', calcDisabled === true);
  chk('PLS: halaman tetap responsif (jeda event-loop terpanjang < 300 ms)', maxGap < 300, Math.round(maxGap) + ' ms dari ' + gaps.length + ' tik');
  await pg.waitForSelector('#sx-tab-gp svg[role=img], #sxDiagSvg svg[role=img]', { state: 'attached', timeout: 30000 });
  chk('PLS: diagram jalur tampil di tab Grafik', await pg.evaluate(() => !!document.querySelector('#sx-results-card .tab-panel #sxDiagSvg svg') && !document.querySelector('#sxSumWrap #sxDiagSvg')));
  await pg.click('#sx-results-card .tab-btn:has-text("Grafik")');
  chk('PLS: tombol Hitung aktif lagi', await pg.evaluate(() => !document.getElementById('sxCalc').disabled));
  const dl = async (sel) => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click(sel)]); const f = OUT + '/' + d.suggestedFilename(); await d.saveAs(f); return f; };
  await pg.waitForSelector('#ex-gp-sem .ex-fig', { timeout: 10000 });
  const svgF = await dl('#ex-gp-sem [data-ex="svg"]'), pngF = await dl('#ex-gp-sem [data-ex="png"]');
  const svg = fs.readFileSync(svgF, 'utf8');
  chk('SVG: mandiri (xmlns, tanpa var(--), ada legenda)', /xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(svg) && !/var\(--/.test(svg) && /Elips = konstruk laten/.test(svg), svgF.split('/').pop() + ' ' + svg.length + ' B');
  chk('SVG: ada latar putih & panah', /<rect width="\d+" height="\d+" fill="#fff"\/>/.test(svg) && /marker-end/.test(svg));
  const png = fs.readFileSync(pngF); chk('PNG: tanda tangan PNG & ukuran > 10 KB', png.slice(0, 8).toString('hex') === '89504e470d0a1a0a' && png.length > 10000, png.length + ' B');
  await pg.screenshot({ path: OUT + '/pls-result.png', fullPage: false });
  // gambar diagram ekspor di-render ulang untuk dilihat
  fs.writeFileSync(OUT + '/diagram-pls.svg', svg);
  /* ---- B. PLS: Batal ---- */
  await run('pls', { sxBoot: '5000', sxQ2: '0', sxPred: '0' });
  await pg.click('#sxCalc'); await pg.waitForSelector('.sem-cancel', { state: 'visible' }); await pg.waitForTimeout(300);
  await pg.click('.sem-cancel');
  await pg.waitForFunction(() => !document.getElementById('sxCalc').disabled, null, { timeout: 15000 });
  const warn = await pg.evaluate(() => (document.querySelector('.sem-warn') || {}).textContent || '');
  chk('PLS Batal: hasil tanpa bootstrap + peringatan', /dibatalkan/.test(warn), warn.slice(0, 70));
  /* ---- C. CB-SEM bootstrap + Batal + ekspor diagram ---- */
  await run('cb', { sxBootCB: '200' }); await pg.click('#sxCalc');
  await pg.waitForFunction(() => !document.getElementById('sxCalc').disabled && /Bootstrap: koefisien jalur/.test(document.getElementById('sxSumWrap').textContent), null, { timeout: 60000 });
  chk('CB: bootstrap selesai & tabel bootstrap tampil', true);
  const svgC = fs.readFileSync(await dl('#ex-gp-sem [data-ex="svg"]'), 'utf8'); chk('CB: SVG diagram terunduh, loading & β terstandar', /koefisien terstandar/.test(svgC) && (svgC.match(/<line /g) || []).length >= 9, (svgC.match(/<line /g) || []).length + ' garis');
  fs.writeFileSync(OUT + '/diagram-cb.svg', svgC);
  await run('cb', { sxBootCB: '2000' }); await pg.click('#sxCalc'); await pg.waitForSelector('.sem-cancel', { state: 'visible' }); await pg.waitForTimeout(400); await pg.click('.sem-cancel');
  await pg.waitForFunction(() => !document.getElementById('sxCalc').disabled, null, { timeout: 15000 });
  chk('CB Batal: peringatan muncul, tanpa tabel bootstrap', await pg.evaluate(() => /Bootstrap dibatalkan/.test(document.getElementById('sxSumWrap').textContent) && !/Bootstrap: koefisien jalur/.test(document.getElementById('sxSumWrap').textContent)));
  chk('Tidak ada galat JS', errs.length === 0, errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' GAGAL' : 'Semua uji UI lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
