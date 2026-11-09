/* Uji pita "Edit Diagram Jalur" + tombol (?) penjelasan pada halaman SEM. Jalankan: node tests/sem-diagram-edit.e2e.js [folder-proyek] (butuh playwright) */
const { chromium } = require('playwright'); const fs = require('fs');
const P = process.argv[2] || require('path').resolve(__dirname, '..'), OUT = require('os').tmpdir() + '/sem-edit-out'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const chk = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'OK    ' : 'GAGAL ') + n + (i !== undefined ? '   ' + i : '')); };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true }), pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('file://' + P + '/index.html'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { document.body.classList.remove('pre-auth'); document.querySelectorAll('.view').forEach((v) => v.classList.remove('active')); document.getElementById('view-sem').classList.add('active'); });
  /* ---- A. tombol (?) penjelasan ---- */
  const vis = (id) => pg.evaluate((i) => { const e = document.getElementById(i); return !!e && e.offsetParent !== null; }, id);
  chk('(?) ada di judul Model', await pg.evaluate(() => !!document.querySelector('[data-hlp-target="sxSynModel"] .hlp-btn')));
  chk('Penjelasan sintaks tersembunyi sebelum (?) diklik', !(await vis('sxSynModel')));
  await pg.click('[data-hlp-target="sxSynModel"] .hlp-btn');
  chk('Klik (?) menampilkan penjelasan sintaks', await vis('sxSynModel'));
  await pg.click('[data-hlp-target="sxSynModel"] .hlp-btn');
  chk('Klik lagi menyembunyikan', !(await vis('sxSynModel')));
  for (const id of ['sxNoteEst', 'sxNoteRob', 'sxNoteScale', 'sxNoteBCB', 'sxSynCmp']) {
    await pg.click('[data-hlp-target="' + id + '"] .hlp-btn'); chk('(?) ' + id + ' membuka penjelasan', await vis(id));
  }
  await pg.screenshot({ path: OUT + '/help.png', clip: { x: 0, y: 150, width: 1280, height: 850 } });
  /* ---- B. hitung CB-SEM lalu edit diagram ---- */
  await pg.click('#sxSample'); await pg.selectOption('#sxEst', 'cb'); await pg.evaluate(() => document.getElementById('sxEst').dispatchEvent(new Event('change')));
  await pg.click('#sxCalc'); await pg.waitForSelector('#sxDiagSvg svg', { timeout: 20000 }); await pg.waitForSelector('#sxDiagRib .rb-main'); await pg.waitForSelector('#ex-panel-sem .ex-fig');
  chk('Pita diagram tampil dengan 5 tab', (await pg.$$('#sxDiagRib .rb-tab')).length === 5, (await pg.$$eval('#sxDiagRib .rb-tab', (e) => e.map((x) => x.textContent))).join(','));
  const lines0 = await pg.$$eval('#sxDiagSvg line:not([data-edge])', (e) => e.length), exp = () => pg.$eval('#ex-panel-sem .ex-fig .ex-chart', (e) => e.innerHTML);
  const set = async (id, v) => { await pg.fill('#sxd-' + id, v); await pg.waitForTimeout(150); };
  /* tab Teks: judul + angka desimal */
  await pg.click('#sxDiagRib .rb-tab[data-rbtab="teks"]'); await set('g_title', 'Model Kepuasan Pelanggan');
  chk('Judul tampil di diagram', /Model Kepuasan Pelanggan/.test(await pg.$eval('#sxDiagSvg', (e) => e.innerHTML)));
  await pg.selectOption('#sxd-g_dec', '3'); await pg.waitForTimeout(150);
  chk('Desimal 3 dipakai pada angka panah', /\d,\d{3}<\/text>/.test(await pg.$eval('#sxDiagSvg', (e) => e.innerHTML)));
  await pg.check('#sxd-g_stars'); await pg.waitForTimeout(150);
  chk('Bintang signifikansi muncul', /\*<\/text>/.test(await pg.$eval('#sxDiagSvg', (e) => e.innerHTML)));
  /* tab Simpul: ubah nama + warna satu simpul */
  await pg.click('#sxDiagRib .rb-tab[data-rbtab="simpul"]'); await pg.selectOption('#sxd-nt', 'Kualitas');
  chk('Kolom nama tampil untuk satu simpul', await vis('sxd-n_label'));
  await set('n_label', 'Kualitas|Layanan'); await pg.evaluate(() => { const e = document.getElementById('sxd-n_fill'); e.value = '#ffd54f'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(150);
  let svgHtml = await pg.$eval('#sxDiagSvg', (e) => e.innerHTML);
  chk('Nama simpul dua baris + warna isi berubah', /<tspan[^>]*>Kualitas<\/tspan><tspan[^>]*>Layanan<\/tspan>/.test(svgHtml) && /#ffd54f/.test(svgHtml));
  /* semua indikator: kelompok */
  await pg.selectOption('#sxd-nt', '@obs'); chk('Kolom nama disembunyikan untuk kelompok', !(await vis('sxd-n_label')));
  await pg.evaluate(() => { const e = document.getElementById('sxd-n_stroke'); e.value = '#d81b60'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(150);
  chk('Warna tepi semua indikator berubah (9 persegi)', (await pg.$eval('#sxDiagSvg', (e) => e.innerHTML.match(/stroke:#d81b60/g) || [])).length === 9);
  /* panah */
  await pg.click('#sxDiagRib .rb-tab[data-rbtab="panah"]'); await pg.selectOption('#sxd-et', '@reg'); await pg.selectOption('#sxd-e_dash', 'dash');
  await pg.evaluate(() => { const e = document.getElementById('sxd-e_col'); e.value = '#2e7d32'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(150);
  svgHtml = await pg.$eval('#sxDiagSvg', (e) => e.innerHTML);
  chk('Panah jalur struktural hijau + putus-putus', (svgHtml.match(/stroke:#2e7d32;stroke-width:[\d.]+;stroke-dasharray:5 4/g) || []).length >= 3);
  /* seret simpul */
  const nodeBox = async (n) => pg.$eval('[data-node="' + n + '"] ellipse', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const before = await nodeBox('Kepuasan'); await pg.mouse.move(before.x, before.y); await pg.mouse.down(); await pg.mouse.move(before.x + 20, before.y + 30, { steps: 4 }); await pg.mouse.move(before.x + 60, before.y + 70, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(200);
  const after = await nodeBox('Kepuasan'); chk('Seret memindahkan simpul', Math.abs(after.x - before.x - 60) < 6 && Math.abs(after.y - before.y - 70) < 6, `dari ${Math.round(before.x)},${Math.round(before.y)} ke ${Math.round(after.x)},${Math.round(after.y)}`);
  chk('Seret memilih simpul + tab Simpul aktif + Geser X terisi', (await pg.$eval('#sxd-nt', (e) => e.value)) === 'Kepuasan' && Number(await pg.$eval('#sxd-n_dx', (e) => e.value)) > 40);
  /* klik label panah memilih panah */
  await pg.click('#sxDiagSvg [data-elab]', { force: true }); chk('Klik angka panah memilih panah (tab Panah)', /[A-Za-z]+>[A-Za-z]+/.test(await pg.$eval('#sxd-et', (e) => e.value)));
  /* tata letak */
  await pg.click('#sxDiagRib .rb-tab[data-rbtab="tata"]'); await pg.uncheck('#sxd-g_showInd'); await pg.waitForTimeout(150);
  chk('Sembunyikan indikator: simpul tersisa 3 konstruk', (await pg.$$('#sxDiagSvg [data-node]')).length === 3);
  await pg.check('#sxd-g_showInd'); await pg.waitForTimeout(150);
  /* ekspor mengikuti pengeditan */
  await pg.waitForTimeout(250); const ex = await exp();
  chk('Panel unduhan: diagram ikut berubah (judul, warna, nama baru)', /Model Kepuasan Pelanggan/.test(ex) && /#ffd54f/.test(ex) && /#2e7d32/.test(ex) && />Layanan</.test(ex));
  chk('Panel unduhan: tanpa penanda seret', !/data-node|data-edge|data-elab/.test(ex));
  const dl = async (sel) => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click(sel)]); const f = OUT + '/' + d.suggestedFilename(); await d.saveAs(f); return f; };
  const svgF = await dl('#ex-panel-sem [data-ex="svg"]'), svg = fs.readFileSync(svgF, 'utf8');
  chk('SVG unduhan memuat hasil edit & legenda', /Model Kepuasan Pelanggan/.test(svg) && /Elips = konstruk laten/.test(svg) && !/var\(--/.test(svg));
  const pngF = await dl('#ex-panel-sem [data-ex="png"]'); chk('PNG unduhan valid', fs.readFileSync(pngF).slice(0, 4).toString('hex') === '89504e47');
  const docF = await dl('#ex-panel-sem [data-ex="docx"]'); const docx = fs.readFileSync(docF).toString('latin1');
  chk('.docx tidak memuat teks pita (Sembunyikan simpul / Setel ulang)', !/Sembunyikan simpul|Setel ulang|Terapkan ke/.test(docx));
  chk('.docx terbentuk', fs.statSync(docF).size > 5000, fs.statSync(docF).size + ' B');
  await pg.evaluate(() => document.getElementById('sxDiag').scrollIntoView()); await pg.waitForTimeout(200); await pg.screenshot({ path: OUT + '/edit.png' });
  /* hitung ulang: pengaturan bertahan, pita dibuat ulang tanpa ganda */
  await pg.click('#sxCalc'); await pg.waitForSelector('#sxDiagRib .rb-main', { timeout: 20000 }); await pg.waitForTimeout(400);
  chk('Hitung ulang: satu pita saja & judul bertahan', (await pg.$$('#sxDiagRib .rb-main')).length === 1 && /Model Kepuasan Pelanggan/.test(await pg.$eval('#sxDiagSvg', (e) => e.innerHTML)));
  /* setel ulang semua */
  await pg.click('#sxDiagRib .rb-tab[data-rbtab="tata"]'); await pg.click('#sxDiagRib [data-rb-act="rst-all"]'); await pg.waitForTimeout(300);
  svgHtml = await pg.$eval('#sxDiagSvg', (e) => e.innerHTML);
  chk('Setel ulang semua mengembalikan bawaan', !/Model Kepuasan|#ffd54f|#2e7d32/.test(svgHtml) && (await pg.$$eval('#sxDiagSvg line:not([data-edge])', (e) => e.length)) === lines0);
  /* PLS-SEM */
  await pg.selectOption('#sxEst', 'pls'); await pg.evaluate(() => document.getElementById('sxEst').dispatchEvent(new Event('change'))); await pg.selectOption('#sxBoot', '0'); await pg.selectOption('#sxQ2', '0'); await pg.selectOption('#sxPred', '0');
  await pg.click('#sxCalc'); await pg.waitForTimeout(1500); chk('PLS: pita diagram juga tampil', (await pg.$$('#sxDiagRib .rb-main')).length === 1 && (await pg.$$('#sxDiagSvg [data-node]')).length === 12);
  /* layar sempit */
  await pg.setViewportSize({ width: 390, height: 800 }); await pg.waitForTimeout(300);
  chk('Layar 390 px: halaman tidak melebar menyamping', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), await pg.evaluate(() => document.documentElement.scrollWidth));
  chk('Tidak ada galat JS', errs.length === 0, errs.join(' | ').slice(0, 300));
  await b.close(); console.log(fails ? fails + ' uji gagal' : 'Semua uji lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
