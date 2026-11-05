/* =========================================================================
   PETA KENDALI (Control Charts) - variabel: X-bar/R, X-bar/S, I-MR; atribut: p, np, c, u
   Batas kendali ±3σ, uji kondisi di luar kendali (Test 1-6), opsi menghitung ulang batas tanpa titik di luar kendali.
   Hitungan: quality-core.js. Grafik: svg-helpers.js. Halaman otomatis: #view-peta-kendali
   ========================================================================= */
(function () {
  'use strict';
  const QC = window.StatQuality, SV = window.StatSvg, U = window.StatBasicUI;
  if (!QC || !SV || !U || !U.mountPage) return;
  const { esc, toNum, fmt } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : String(Number(v.toPrecision(d || 6))).replace('.', ','));
  const TN = { 'xbar-r': 'X̄ – R', 'xbar-s': 'X̄ – S', imr: 'I – MR (individu)', p: 'Bagan p', np: 'Bagan np', c: 'Bagan c', u: 'Bagan u' };
  const TD = { 1: 'satu titik di luar 3σ', 2: '9 titik berurutan pada sisi yang sama dari garis tengah', 3: '6 titik berurutan naik atau turun', 4: '14 titik berurutan bergantian naik-turun', 5: '2 dari 3 titik berurutan di luar 2σ (sisi sama)', 6: '4 dari 5 titik berurutan di luar 1σ (sisi sama)' };
  const DEF = { 'xbar-r': ['Obs 1', 'Obs 2', 'Obs 3', 'Obs 4', 'Obs 5'], 'xbar-s': ['Obs 1', 'Obs 2', 'Obs 3', 'Obs 4', 'Obs 5'], imr: ['Nilai'], p: ['Cacat', 'Ukuran sampel'], np: ['Cacat'], c: ['Cacat'], u: ['Cacat', 'Jumlah unit'] };
  const ui = U.mountPage({
    id: 'peta-kendali', pre: 'cc', title: 'Peta Kendali', eyebrow: 'Metode Statistik &rsaquo; Control Charts', step1: 'Pilih bagan &amp; masukkan data',
    lede: 'Pantau kestabilan proses dengan bagan kendali: X̄–R, X̄–S, dan I–MR untuk data ukuran (variabel), serta bagan p, np, c, dan u untuk data cacat/atribut. Menghitung garis tengah dan batas kendali ±3σ, menandai titik di luar kendali dengan uji kondisi khusus (Test 1–6), dan dapat menghitung ulang batas tanpa titik tak wajar.',
    settings: `
      <label>Jenis bagan<select id="ccType" class="select-input"><optgroup label="Data ukuran (variabel)"><option value="xbar-r">X̄ – R (subgrup)</option><option value="xbar-s">X̄ – S (subgrup besar)</option><option value="imr">I – MR (data individu)</option></optgroup><optgroup label="Data cacat (atribut)"><option value="p">p (proporsi cacat)</option><option value="np">np (jumlah cacat, n tetap)</option><option value="c">c (cacat per unit, area tetap)</option><option value="u">u (cacat per unit, area bervariasi)</option></optgroup></select></label>
      <label id="ccNWrap" hidden>Ukuran sampel tetap (n)<input type="text" id="ccN" class="plain-input" inputmode="numeric" value="100" autocomplete="off"></label>
      <label>Uji kondisi di luar kendali<select id="ccTests" class="select-input"><option value="1">Test 1 saja (titik di luar 3σ)</option><option value="4" selected>Test 1–4</option><option value="6">Test 1–6</option></select></label>
      <label>Hitung ulang batas tanpa titik di luar kendali<select id="ccRecalc" class="select-input"><option value="no">Tidak</option><option value="yes">Ya (buang titik Test 1, ulangi)</option></select></label>`,
    hint: '<span id="ccHintLead">Baris = subgrup, kolom = pengamatan dalam subgrup (ukuran subgrup sama, 2–10).</span> Minimal <strong><span id="ccMin">5</span> titik/subgrup</strong> (disarankan ≥ 20); urutkan menurut waktu.',
    table: { names: DEF['xbar-r'], colLabel: 'Obs', minCols: 1, maxCols: 10, canAddCol: true }, calcLabel: 'Buat Peta Kendali',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register((n) => { const t = q('ccType').value; if (t === 'xbar-r' || t === 'xbar-s') tbl.setCols(Math.max(2, Math.min(10, n))); });
  const type = () => q('ccType').value;
  const isDefault = () => Object.keys(DEF).some((k) => DEF[k].join('|') === tbl.names.join('|')) || tbl.names.every((n) => /^Obs \d+$/.test(n));
  const LEAD = { 'xbar-r': 'Baris = subgrup (urut waktu), kolom = pengamatan dalam subgrup (ukuran sama, 2–10).', 'xbar-s': 'Baris = subgrup (urut waktu), kolom = pengamatan dalam subgrup (ukuran sama, 2–25).', imr: 'Satu kolom nilai individu, urut menurut waktu.', p: 'Kolom 1 = jumlah cacat, kolom 2 = ukuran sampel tiap titik (boleh berbeda).', np: 'Satu kolom jumlah cacat; ukuran sampel tetap diisi di atas.', c: 'Satu kolom jumlah cacat per unit pemeriksaan (area/ukuran tetap).', u: 'Kolom 1 = jumlah cacat, kolom 2 = jumlah unit yang diperiksa tiap titik.' };
  function applyType() {
    const t = type(), was = isDefault(), want = DEF[t].length; tbl.setCols(want); if (was) tbl.names = DEF[t].slice(); tbl.buildHead();
    q('ccNWrap').hidden = t !== 'np'; q('ccHintLead').textContent = LEAD[t]; ['ccAddCol', 'ccRemCol'].forEach((id) => { const b = q(id); if (b) b.disabled = !(t === 'xbar-r' || t === 'xbar-s'); });
  }
  q('ccType').addEventListener('change', () => { applyType(); ui.clearErr(); }); applyType();
  ui.onSample = () => {
    const t = type(); let s = 13; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, nrm = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
    if (t === 'xbar-r' || t === 'xbar-s') { const C = [[], [], [], [], []]; for (let i = 0; i < 25; i++) { const sh = i === 17 ? 3.2 : 0; for (let j = 0; j < 5; j++) C[j].push(+(50 + nrm() * 1.5 + sh).toFixed(2)); } tbl.fill(DEF[t], C); }
    else if (t === 'imr') { const x = []; for (let i = 0; i < 30; i++) x.push(+(100 + nrm() * 2 + (i === 22 ? 9 : 0)).toFixed(2)); tbl.fill(DEF.imr, [x]); }
    else if (t === 'p') { const x = [], n = []; for (let i = 0; i < 25; i++) { const m = 90 + Math.round(rnd() * 30); n.push(m); x.push(Math.round(m * (0.06 + (i === 12 ? 0.1 : 0)) + nrm() * 1.5)); } tbl.fill(DEF.p, [x.map((v) => Math.max(0, v)), n]); }
    else if (t === 'np') { const x = []; for (let i = 0; i < 25; i++) x.push(Math.max(0, Math.round(6 + nrm() * 2 + (i === 9 ? 11 : 0)))); tbl.fill(DEF.np, [x]); q('ccN').value = '100'; }
    else if (t === 'c') { const x = []; for (let i = 0; i < 25; i++) x.push(Math.max(0, Math.round(8 + nrm() * 2.4 + (i === 14 ? 10 : 0)))); tbl.fill(DEF.c, [x]); }
    else { const x = [], n = []; for (let i = 0; i < 25; i++) { const m = 4 + Math.round(rnd() * 6); n.push(m); x.push(Math.max(0, Math.round(m * 1.5 + nrm() * 2 + (i === 7 ? 9 : 0)))); } tbl.fill(DEF.u, [x, n]); }
    applyType(); };
  ui.onCalc = () => {
    const t = type(), tests = [1, 2, 3, 4, 5, 6].slice(0, parseInt(q('ccTests').value, 10)), recalc = q('ccRecalc').value === 'yes', { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const nm = tbl.names.map((_, j) => tbl.name(j)), nc = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), rows = []; let fn, extra = '';
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) return ui.err('Baris ' + (i + 1) + ' belum lengkap. Semua kolom pada baris yang dipakai harus terisi.'); rows.push(r); }
    const m = rows.length; if (m < 5) return ui.err(`Dibutuhkan minimal 5 titik/subgrup (sekarang ${m}); disarankan ≥ 20 untuk batas yang andal.`);
    if (t === 'xbar-r' || t === 'xbar-s') { if (nc < 2 || nc > (t === 'xbar-r' ? 10 : 25)) return ui.err('Ukuran subgrup harus 2–' + (t === 'xbar-r' ? 10 : 25) + ' (jumlah kolom).'); fn = (ex) => (t === 'xbar-r' ? QC.xbarR(rows, tests, ex) : QC.xbarS(rows, tests, ex)); }
    else if (t === 'imr') fn = (ex) => QC.imr(rows.map((r) => r[0]), tests, ex);
    else { const x = rows.map((r) => r[0]); if (x.some((v) => v < 0 || Math.floor(v) !== v)) return ui.err('Jumlah cacat harus bilangan bulat ≥ 0.');
      if (t === 'c') fn = (ex) => QC.cChart(x, tests, ex);
      else if (t === 'np') { const n = toNum(q('ccN').value); if (n === null || Number.isNaN(n) || n < 1 || Math.floor(n) !== n) return ui.err('Ukuran sampel tetap (n) harus bilangan bulat ≥ 1.'); if (x.some((v) => v > n)) return ui.err('Ada jumlah cacat yang lebih besar dari ukuran sampel n.'); fn = (ex) => QC.npChart(x, n, tests, ex); extra = n; }
      else { const nn = rows.map((r) => r[1]); if (nn.some((v) => !(v > 0))) return ui.err('Kolom ukuran sampel / jumlah unit harus > 0.'); if (t === 'p') { if (x.some((v, i) => v > nn[i])) return ui.err('Ada jumlah cacat yang lebih besar dari ukuran sampel.'); fn = (ex) => QC.pChart(x, nn, tests, ex); } else fn = (ex) => QC.uChart(x, nn, tests, ex); } }
    const res = recalc ? QC.iterate(fn, 10) : Object.assign(fn(new Set()), { excluded: [] });
    const first = res.charts[0], zones = ['xbar-r', 'xbar-s', 'imr'].includes(t) && recalc === false || ['xbar-r', 'xbar-s', 'imr'].includes(t);
    let sum = '', totalHits = 0;
    res.charts.forEach((ch, ci) => { sum += SV.controlChart({ name: TN[t] + ' — ' + ch.name, ylabel: ch.name, values: ch.values, cl: ch.cl, ucl: ch.ucl, lcl: ch.lcl, sigma: ch.sigma, hits: ch.hits, zones: ci === 0 && ['xbar-r', 'xbar-s', 'imr'].includes(t) }); });
    sum += `<p class="bs-note" style="text-align:center">Garis hijau = garis tengah (CL), merah putus-putus = batas kendali ±3σ, titik merah = melanggar uji (angka = nomor uji)${['xbar-r', 'xbar-s', 'imr'].includes(t) ? '; garis abu-abu = batas ±1σ dan ±2σ' : ''}.</p>`;
    sum += `<table class="result-table bs-res"><caption>Garis tengah &amp; batas kendali${res.excluded.length ? ' (dihitung ulang tanpa titik ' + res.excluded.map((i) => i + 1).join(', ') + ')' : ''}</caption><thead><tr><th class="lbl">Bagan</th><th>LCL</th><th>CL</th><th>UCL</th></tr></thead><tbody>` +
      res.charts.map((ch) => { const v = ch.ucl.some((u, i) => u !== ch.ucl[0]); return `<tr><td class="lbl">${esc(ch.name)}</td><td>${v ? g(Math.min.apply(null, ch.lcl)) + ' – ' + g(Math.max.apply(null, ch.lcl)) : g(ch.lcl[0])}</td><td>${g(ch.cl[0])}</td><td>${v ? g(Math.min.apply(null, ch.ucl)) + ' – ' + g(Math.max.apply(null, ch.ucl)) : g(ch.ucl[0])}</td></tr>`; }).join('') + '</tbody></table>';
    if (res.sigmaHat) sum += `<table class="result-table bs-res"><caption>Taksiran simpangan baku proses</caption><tbody><tr><td class="lbl">σ̂ ${t === 'xbar-r' ? '= R̄ / d₂' : t === 'xbar-s' ? '= S̄ / c₄' : '= MR̄ / d₂'}</td><td>${g(res.sigmaHat)}</td></tr>${res.c ? `<tr><td class="lbl">Konstanta (n = ${res.c.n})</td><td>d₂ = ${g(res.c.d2, 5)}; ${t === 'xbar-r' ? 'A₂ = ' + g(res.c.A2, 5) + '; D₃ = ' + g(res.c.D3, 5) + '; D₄ = ' + g(res.c.D4, 5) : t === 'xbar-s' ? 'c₄ = ' + g(res.c.c4, 5) + '; A₃ = ' + g(res.c.A3, 5) + '; B₃ = ' + g(res.c.B3, 5) + '; B₄ = ' + g(res.c.B4, 5) : 'D₄ = ' + g(res.c.D4, 5)}</td></tr>` : ''}</tbody></table>`;
    const viol = []; res.charts.forEach((ch, ci) => ch.hits.forEach((h, i) => { if (h.length) viol.push({ i, chart: ch.name, v: ch.values[i], z: ch.z[i], tests: h }); }));
    totalHits = viol.length;
    sum += viol.length ? `<table class="result-table bs-res"><caption>Titik yang melanggar uji (${viol.length})</caption><thead><tr><th class="lbl">Titik #</th><th>Bagan</th><th>Nilai</th><th>z (σ dari CL)</th><th class="lbl">Uji yang dilanggar</th></tr></thead><tbody>${viol.map((o) => `<tr><td class="lbl">${o.i + 1}</td><td>${esc(o.chart)}</td><td>${g(o.v)}</td><td>${fmt(o.z, 2)}</td><td class="lbl">${o.tests.map((k) => 'Test ' + k).join(', ')}</td></tr>`).join('')}</tbody></table><table class="result-table bs-res"><caption>Arti uji yang dipakai</caption><tbody>${tests.map((k) => `<tr><td class="lbl">Test ${k}</td><td>${TD[k]}</td></tr>`).join('')}</tbody></table>` : `<p class="bs-note"><strong>Tidak ada titik yang melanggar uji</strong> (Test ${tests.join(', ')}). Proses tampak terkendali secara statistik.</p>`;
    const st = [{ t: 'Prinsip bagan kendali', f: 'Batas kendali = garis tengah ± 3 × galat baku statistik yang digambar\nTitik di luar batas atau pola tak acak = sinyal adanya sebab khusus (assignable cause)', n: '' }];
    if (t === 'xbar-r') st.push({ t: 'Rumus X̄–R', f: `X̄̄ = rata-rata X̄ = ${g(res.center)};  R̄ = rata-rata R = ${g(res.spread)}\nBatas X̄: X̄̄ ± A₂R̄ = ${g(res.center)} ± ${g(res.c.A2, 5)} × ${g(res.spread)}\nBagan R: LCL = D₃R̄ = ${g(res.charts[1].lcl[0])};  UCL = D₄R̄ = ${g(res.charts[1].ucl[0])}\nσ̂ = R̄ / d₂ = ${g(res.sigmaHat)}`, n: `A₂ = 3/(d₂√n), D₃, D₄ dihitung dari distribusi rentang sampel normal (n = ${res.c.n}).` });
    if (t === 'xbar-s') st.push({ t: 'Rumus X̄–S', f: `X̄̄ = ${g(res.center)};  S̄ = ${g(res.spread)}\nBatas X̄: X̄̄ ± A₃S̄ = ${g(res.center)} ± ${g(res.c.A3, 5)} × ${g(res.spread)}\nBagan S: LCL = B₃S̄ = ${g(res.charts[1].lcl[0])};  UCL = B₄S̄ = ${g(res.charts[1].ucl[0])}\nσ̂ = S̄ / c₄ = ${g(res.sigmaHat)}`, n: 'c₄ = √[2/(n−1)] Γ(n/2)/Γ((n−1)/2).' });
    if (t === 'imr') st.push({ t: 'Rumus I–MR', f: `MRᵢ = |xᵢ − xᵢ₋₁|;  MR̄ = ${g(res.spread)};  x̄ = ${g(res.center)}\nσ̂ = MR̄ / d₂ (n = 2: d₂ = ${g(res.c.d2, 5)}) = ${g(res.sigmaHat)}\nBatas I: x̄ ± 3σ̂ = ${g(res.charts[0].lcl[0])} … ${g(res.charts[0].ucl[0])}\nBagan MR: UCL = D₄MR̄ = ${g(res.charts[1].ucl[0])}, LCL = 0`, n: '' });
    if (t === 'p') st.push({ t: 'Rumus bagan p', f: `p̄ = Σ cacat / Σ sampel = ${g(res.pbar)}\nBatas: p̄ ± 3√[p̄(1 − p̄)/nᵢ]  (batas bervariasi bila nᵢ berbeda; dipotong ke [0, 1])`, n: '' });
    if (t === 'np') st.push({ t: 'Rumus bagan np', f: `p̄ = ${g(res.pbar)},  n = ${extra}\nCL = np̄ = ${g(res.center)}\nBatas: np̄ ± 3√[np̄(1 − p̄)]`, n: '' });
    if (t === 'c') st.push({ t: 'Rumus bagan c', f: `c̄ = rata-rata cacat = ${g(res.center)}\nBatas: c̄ ± 3√c̄  (LCL dipotong ke 0)`, n: 'Mengasumsikan jumlah cacat berdistribusi Poisson.' });
    if (t === 'u') st.push({ t: 'Rumus bagan u', f: `ū = Σ cacat / Σ unit = ${g(res.ubar)}\nBatas: ū ± 3√(ū/nᵢ)`, n: '' });
    st.push({ t: 'Uji kondisi di luar kendali', f: tests.map((k) => `Test ${k}: ${TD[k]}`).join('\n') + '\nz = (nilai − CL) / σ titik; zona 1σ, 2σ, 3σ diukur dari garis tengah', n: 'Pola non-acak dapat menandakan sebab khusus walaupun semua titik berada di dalam batas 3σ.' });
    if (recalc) st.push({ t: 'Penghitungan ulang batas', f: res.excluded.length ? `Titik yang dibuang dari penaksiran batas: ${res.excluded.map((i) => i + 1).join(', ')} (melanggar Test 1)\nBatas dihitung ulang sampai tidak ada titik baru yang keluar` : 'Tidak ada titik Test 1 yang perlu dibuang', n: 'Titik tetap digambar, hanya tidak ikut menaksir garis tengah dan batas.' });
    const ooc = viol.filter((o) => o.tests.includes(1)), pat = viol.filter((o) => !o.tests.includes(1));
    const ip = [viol.length ? `<strong>Proses ${ooc.length ? 'TIDAK terkendali' : 'menunjukkan pola tak acak'}:</strong> ${viol.length} titik melanggar uji${ooc.length ? `, ${ooc.length} di antaranya di luar batas 3σ (titik ${ooc.map((o) => o.i + 1).join(', ')})` : ''}.` : '<strong>Proses terkendali secara statistik:</strong> tidak ada titik yang melanggar uji yang dipilih.'];
    if (ooc.length) ip.push('Telusuri sebab khusus pada titik di luar kendali (mesin, bahan, operator, pengukuran) dan perbaiki sebelum menghitung kapabilitas proses.' + (!recalc ? ' Opsi “hitung ulang batas” dapat dipakai bila sebab sudah diketahui dan titik tersebut ingin dikeluarkan dari penaksiran batas.' : ''));
    if (pat.length) ip.push('Pelanggaran pola: ' + Array.from(new Set(pat.flatMap((o) => o.tests))).sort().map((k) => `Test ${k} (${TD[k]})`).join('; ') + ' — menandakan pergeseran, tren, atau osilasi walau titik masih di dalam batas.');
    if (['xbar-r', 'xbar-s'].includes(t)) ip.push('Periksa bagan dispersi (' + (t === 'xbar-r' ? 'R' : 'S') + ') terlebih dahulu: bila dispersi tidak stabil, batas bagan X̄ kurang bermakna.');
    if (m < 20) ip.push('<strong>Catatan:</strong> kurang dari 20 titik; batas kendali bersifat sementara (fase I) dan perlu ditinjau ulang setelah data bertambah.');
    if (t === 'p' || t === 'u') ip.push('Batas bervariasi mengikuti ukuran sampel tiap titik, sehingga titik berukuran kecil punya batas lebih lebar.');
    ip.push('<strong>Asumsi:</strong> pengamatan saling bebas' + (['xbar-r', 'xbar-s', 'imr'].includes(t) ? ' dan berdistribusi mendekati normal (bagan I–MR sangat peka terhadap ketidaknormalan)' : t === 'c' || t === 'u' ? ' dan cacat mengikuti distribusi Poisson' : ' dan cacat mengikuti distribusi binomial') + '; subgrup dibentuk agar variasi di dalam subgrup mewakili variasi sebab umum.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${TN[t]}</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Peta kendali ' + TN[t]], ['Jumlah titik', m], ['Uji', 'Test ' + tests.join(', ')], ['Titik melanggar', totalHits]], data: ui.dataExport(nm, nm.map((_, j) => rows.map((r) => r[j]))) });
  };
})();
