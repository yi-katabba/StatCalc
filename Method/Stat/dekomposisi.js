/* =========================================================================
   DEKOMPOSISI DERET WAKTU - klasik aditif / multiplikatif: tren (rata-rata bergerak), indeks musiman, sisa; ramalan (Time Series)
   Hitungan: multi-core.js (decompose). Grafik: svg-helpers.js. Halaman otomatis: #view-dekomposisi
   ========================================================================= */
(function () {
  'use strict';
  const MC = window.StatMulti, SV = window.StatSvg, U = window.StatBasicUI;
  if (!MC || !SV || !U || !U.mountPage) return;
  const { esc, toNum, fmt } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : String(Number(v.toPrecision(d || 6))).replace('.', ','));
  const ui = U.mountPage({
    id: 'dekomposisi', pre: 'dk', title: 'Dekomposisi Deret Waktu', eyebrow: 'Metode Statistik &rsaquo; Time Series', step1: 'Atur model &amp; masukkan data',
    lede: 'Uraikan deret waktu menjadi tren, komponen musiman, dan sisa (acak), baik secara aditif (Y = T + S + I) maupun multiplikatif (Y = T × S × I). Tren diperoleh dari rata-rata bergerak terpusat, indeks musiman dari rata-rata per periode. Dilengkapi ukuran akurasi (MAPE, MAD, MSD) dan ramalan beberapa periode ke depan.',
    settings: `
      <label>Model dekomposisi<select id="dkModel" class="select-input"><option value="additive">Aditif (Y = T + S + I)</option><option value="multiplicative">Multiplikatif (Y = T × S × I)</option></select></label>
      <label>Panjang periode musiman (m)<input type="text" id="dkM" class="plain-input" inputmode="numeric" value="12" autocomplete="off"><span class="bs-sub">12 = data bulanan, 4 = kuartalan, 7 = harian per pekan</span></label>
      <label>Ramalan ke depan (jumlah periode)<input type="text" id="dkH" class="plain-input" inputmode="numeric" value="6" autocomplete="off"></label>`,
    hint: 'Satu kolom nilai deret waktu, <strong>urut dari yang paling lama ke terbaru</strong>, tanpa celah. Minimal <strong><span id="dkMin">24</span> data</strong> (setidaknya 2 periode musiman penuh); maksimal 2000. Model multiplikatif membutuhkan semua nilai &gt; 0.',
    table: { names: ['Nilai'], colLabel: 'Nilai', minCols: 1, maxCols: 1 }, calcLabel: 'Hitung Dekomposisi',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register((n) => tbl.setCols(1));
  ui.onSample = () => { const y = []; const sea = [-4, -2, 1, 3, 6, 8, 7, 5, 2, -1, -3, -5]; let s = 21; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let t = 0; t < 48; t++) y.push(+(50 + 0.6 * t + sea[t % 12] + (rnd() - 0.5) * 3).toFixed(1)); tbl.fill(['Penjualan'], [y]); q('dkM').value = '12'; q('dkModel').value = 'additive'; };
  ui.onCalc = () => {
    const model = q('dkModel').value, m = toNum(q('dkM').value), h = q('dkH').value.trim() === '' ? 0 : toNum(q('dkH').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    if (m === null || Number.isNaN(m) || m < 2 || Math.floor(m) !== m || m > 52) return ui.err('Panjang periode musiman harus bilangan bulat antara 2 dan 52.');
    if (h === null || Number.isNaN(h) || h < 0 || Math.floor(h) !== h || h > 120) return ui.err('Jumlah periode ramalan harus bilangan bulat antara 0 dan 120.');
    const raw = cols[0], y = []; let lastFilled = -1; raw.forEach((v, i) => { if (v !== null) lastFilled = i; });
    for (let i = 0; i <= lastFilled; i++) { if (raw[i] === null) return ui.err('Ada sel kosong di baris ' + (i + 1) + ' di tengah data. Deret waktu harus tanpa celah.'); y.push(raw[i]); }
    const n = y.length; if (n < 2 * m) return ui.err(`Dibutuhkan minimal ${2 * m} data (2 periode musiman penuh) untuk periode m = ${m}; sekarang ${n}.`);
    if (model === 'multiplicative' && y.some((v) => v <= 0)) return ui.err('Model multiplikatif membutuhkan semua nilai > 0. Gunakan model aditif atau geser data.');
    if (Math.max.apply(null, y) === Math.min.apply(null, y)) return ui.err('Semua nilai sama persis; dekomposisi tidak bermakna.');
    const nmY = tbl.name(0), d = MC.decompose(y, m, model, h), mult = model === 'multiplicative', xs = y.map((_, i) => i + 1), xsF = d.forecast.map((_, i) => n + i + 1);
    let sum = SV.lines({ title: 'Data, tren, dan hasil model', series: [{ name: 'Data', y: y.concat(d.forecast.map(() => NaN)), dots: n <= 80 }, { name: 'Tren (rata-rata bergerak)', y: d.trend.concat(d.forecast.map(() => NaN)), width: 2.6 }, { name: 'Model + ramalan', y: d.fitted.concat(d.forecast), dash: '5 3' }], x: xs.concat(xsF), xlabel: 'Periode waktu (t)', ylabel: nmY, w: 640, h: 290 });
    sum += SV.lines({ title: 'Indeks musiman', series: [{ name: 'Indeks musiman', y: d.indices, dots: true }], x: d.indices.map((_, i) => i + 1), xlabel: 'Posisi dalam periode musiman', ylabel: mult ? 'Indeks (rasio)' : 'Efek musiman', hline: mult ? 1 : 0, w: 520, h: 230, xticks: d.indices.map((_, i) => i + 1) });
    sum += SV.lines({ title: 'Komponen sisa', series: [{ name: 'Sisa (irregular)', y: d.irregular, dots: n <= 80 }], x: xs, xlabel: 'Periode waktu (t)', ylabel: mult ? 'Rasio sisa' : 'Sisa', hline: mult ? 1 : 0, w: 640, h: 210 });
    sum += `<table class="result-table bs-res"><caption>Indeks musiman (m = ${m})</caption><thead><tr><th class="lbl">Posisi</th>${d.indices.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody><tr><td class="lbl">${mult ? 'Indeks (rata-rata = 1)' : 'Efek (jumlah = 0)'}</td>${d.indices.map((v) => `<td>${g(v, 5)}</td>`).join('')}</tr></tbody></table>
      <table class="result-table bs-res"><caption>Persamaan tren &amp; akurasi model</caption><tbody><tr><td class="lbl">Tren linier (data tanpa musiman)</td><td>T(t) = ${g(d.a)} ${d.b < 0 ? '−' : '+'} ${g(Math.abs(d.b))} × t</td></tr><tr><td class="lbl">Kemiringan tren</td><td>${g(d.b)} per periode</td></tr><tr><td class="lbl">MAPE (galat persentase absolut rata-rata)</td><td>${fmt(d.mape, 3)}%</td></tr><tr><td class="lbl">MAD (simpangan absolut rata-rata)</td><td>${g(d.mad)}</td></tr><tr><td class="lbl">MSD (rata-rata kuadrat selisih)</td><td>${g(d.msd)}</td></tr></tbody></table>`;
    if (h > 0) sum += `<table class="result-table bs-res"><caption>Ramalan ${h} periode ke depan</caption><thead><tr><th class="lbl">Periode (t)</th><th>Posisi musiman</th><th>Ramalan</th></tr></thead><tbody>${d.forecast.map((v, i) => `<tr><td class="lbl">${n + i + 1}</td><td>${((n + i) % m) + 1}</td><td><strong>${g(v)}</strong></td></tr>`).join('')}</tbody></table>`;
    sum += `<table class="result-table bs-res"><caption>Komponen deret waktu (${Math.min(n, 60)} baris pertama dari ${n})</caption><thead><tr><th class="lbl">t</th><th>Data</th><th>Tren (MA)</th><th>Musiman</th><th>Sisa</th><th>Model</th></tr></thead><tbody>${y.slice(0, 60).map((v, i) => `<tr><td class="lbl">${i + 1}</td><td>${g(v)}</td><td>${g(d.trend[i], 5)}</td><td>${g(d.seasonal[i], 5)}</td><td>${g(d.irregular[i], 4)}</td><td>${g(d.fitted[i], 5)}</td></tr>`).join('')}</tbody></table>
      <p class="bs-note">Tren (MA) kosong di ${Math.floor(m / 2)} data awal dan akhir karena rata-rata bergerak terpusat membutuhkan data di kedua sisi. Kolom “Model” = tren linier × (atau +) indeks musiman, dipakai untuk akurasi dan ramalan.</p>`;
    const half = Math.floor(m / 2), rng = Math.max.apply(null, d.indices) - Math.min.apply(null, d.indices), ymean = y.reduce((a, b) => a + b, 0) / n;
    const st = [{ t: 'Model', f: mult ? 'Yₜ = Tₜ × Sₜ × Iₜ  (variasi musiman membesar seiring tren)' : 'Yₜ = Tₜ + Sₜ + Iₜ  (variasi musiman konstan)', n: `n = ${n} data, periode musiman m = ${m}.` },
      { t: 'Tren: rata-rata bergerak terpusat', f: m % 2 === 1 ? `Tₜ = (1/${m}) Σ Yₜ₊ⱼ,  j = −${half} … ${half}` : `Tₜ = [½Yₜ₋${half} + Yₜ₋${half - 1} + … + Yₜ₊${half - 1} + ½Yₜ₊${half}] / ${m}  (rata-rata bergerak 2×${m})`, n: `Dihitung untuk t = ${half + 1} … ${n - half}; T${half + 1} = ${g(d.trend[half], 6)}.` },
      { t: 'Indeks musiman', f: `Hilangkan tren: ${mult ? 'Yₜ / Tₜ' : 'Yₜ − Tₜ'}\nRata-ratakan tiap posisi musiman (1…${m})\nNormalisasi agar ${mult ? 'rata-rata indeks = 1' : 'jumlah efek = 0'}\nIndeks: ${d.indices.map((v) => g(v, 4)).join(', ')}`, n: '' },
      { t: 'Sisa', f: mult ? 'Iₜ = Yₜ / (Tₜ × Sₜ)' : 'Iₜ = Yₜ − Tₜ − Sₜ', n: 'Sisa yang baik berfluktuasi acak di sekitar ' + (mult ? '1' : '0') + ' tanpa pola.' },
      { t: 'Tren linier & model', f: `Data tanpa musiman: ${mult ? 'Yₜ / Sₜ' : 'Yₜ − Sₜ'}\nRegresi linier terhadap t = 1…${n}: T(t) = ${g(d.a)} ${d.b < 0 ? '−' : '+'} ${g(Math.abs(d.b))} t\nModel: Ŷₜ = T(t) ${mult ? '×' : '+'} Sₜ`, n: '' },
      { t: 'Akurasi', f: `MAPE = (100/n) Σ |Yₜ − Ŷₜ| / Yₜ = ${fmt(d.mape, 3)}%\nMAD = (1/n) Σ |Yₜ − Ŷₜ| = ${g(d.mad)}\nMSD = (1/n) Σ (Yₜ − Ŷₜ)² = ${g(d.msd)}`, n: '' }];
    if (h > 0) st.push({ t: 'Ramalan', f: `Ŷₜ = T(t) ${mult ? '×' : '+'} S(posisi musiman)\n` + d.forecast.slice(0, 4).map((v, i) => `t = ${n + i + 1}: ${g(d.a + d.b * (n + i + 1))} ${mult ? '×' : '+'} ${g(d.indices[(n + i) % m], 4)} = ${g(v)}`).join('\n') + (h > 4 ? '\n…' : ''), n: '' });
    const ip = [`<strong>Tren:</strong> ${d.b > 0 ? 'naik' : d.b < 0 ? 'turun' : 'datar'} sekitar <strong>${g(Math.abs(d.b), 4)}</strong> per periode (${fmt(Math.abs(d.b) / Math.abs(ymean) * 100, 2)}% dari rata-rata data per periode).`,
      `<strong>Musiman:</strong> ${mult ? `indeks berkisar ${g(Math.min.apply(null, d.indices), 3)} sampai ${g(Math.max.apply(null, d.indices), 3)}; posisi ${d.indices.indexOf(Math.max.apply(null, d.indices)) + 1} tertinggi (${fmt((Math.max.apply(null, d.indices) - 1) * 100, 1)}% di atas tren) dan posisi ${d.indices.indexOf(Math.min.apply(null, d.indices)) + 1} terendah (${fmt((1 - Math.min.apply(null, d.indices)) * 100, 1)}% di bawah tren)` : `efek musiman berkisar ${g(Math.min.apply(null, d.indices), 3)} sampai ${g(Math.max.apply(null, d.indices), 3)} (selisih ${g(rng, 3)}); posisi ${d.indices.indexOf(Math.max.apply(null, d.indices)) + 1} tertinggi dan posisi ${d.indices.indexOf(Math.min.apply(null, d.indices)) + 1} terendah`}.`,
      `<strong>Akurasi:</strong> MAPE = ${fmt(d.mape, 2)}% → ${d.mape < 10 ? 'sangat baik' : d.mape < 20 ? 'baik' : d.mape < 50 ? 'cukup' : 'lemah'}; MAD = ${g(d.mad)}.`];
    if (h > 0) ip.push(`<strong>Ramalan:</strong> ${h} periode berikutnya dihitung dari perpanjangan tren linier dan indeks musiman (periode pertama = ${g(d.forecast[0])}). Ramalan berasumsi tren dan pola musiman tetap berlaku; makin jauh periode ramalan makin tidak pasti, dan model ini tidak menyediakan selang kepercayaan.`);
    if (n < 3 * m) ip.push('<strong>Catatan:</strong> data kurang dari 3 periode musiman penuh sehingga indeks musiman kurang stabil.');
    ip.push('<strong>Asumsi:</strong> pola musiman berulang dengan panjang tetap dan tren dapat didekati garis lurus. Bila tren melengkung atau pola berubah, gunakan Smoothing (Holt-Winters) atau ARIMA/SARIMA.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Dekomposisi ${mult ? 'multiplikatif' : 'aditif'} (m = ${m})</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Dekomposisi ' + (mult ? 'multiplikatif' : 'aditif')], ['n', n], ['Periode musiman', m], ['MAPE', fmt(d.mape, 2) + '%']], data: { head: ['t', nmY, 'Tren (MA)', 'Musiman', 'Sisa', 'Model'], rows: y.map((v, i) => [i + 1, v, Number.isNaN(d.trend[i]) ? '' : d.trend[i], d.seasonal[i], Number.isNaN(d.irregular[i]) ? '' : d.irregular[i], d.fitted[i]]), caption: 'Komponen hasil dekomposisi.' } });
  };
})();
