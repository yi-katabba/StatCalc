/* =========================================================================
   KAPABILITAS PROSES (Quality Tools) - Cp, Cpk, Pp, Ppk, Cpm, PPM, Z benchmark, histogram + kurva normal
   Data individu (atau dikelompokkan dalam subgrup berurutan). Hitungan: quality-core.js (capability). Halaman otomatis: #view-kapabilitas
   ========================================================================= */
(function () {
  'use strict';
  const QC = window.StatQuality, SV = window.StatSvg, U = window.StatBasicUI, D = window.StatDist;
  if (!QC || !SV || !U || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP, pct } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : String(Number(v.toPrecision(d || 5))).replace('.', ','));
  const lab = (c) => c >= 1.67 ? 'sangat baik' : c >= 1.33 ? 'mampu (capable)' : c >= 1 ? 'marjinal' : 'tidak mampu';
  const ui = U.mountPage({
    id: 'kapabilitas', pre: 'kp', title: 'Kapabilitas Proses', eyebrow: 'Metode Statistik &rsaquo; Quality Tools', step1: 'Atur spesifikasi &amp; masukkan data',
    lede: 'Ukur seberapa baik proses memenuhi batas spesifikasi (LSL/USL): indeks kapabilitas jangka pendek (Cp, Cpk, dari variasi dalam subgrup) dan jangka panjang (Pp, Ppk, dari variasi keseluruhan), Cpm bila ada target, taksiran cacat per sejuta (PPM), Z benchmark, dan histogram dengan kurva normal. Mengasumsikan data berdistribusi normal dan proses stabil.',
    settings: `
      <label>Batas spesifikasi bawah (LSL)<input type="text" id="kpL" class="plain-input" inputmode="decimal" autocomplete="off" placeholder="mis. 93"></label>
      <label>Batas spesifikasi atas (USL)<input type="text" id="kpU" class="plain-input" inputmode="decimal" autocomplete="off" placeholder="mis. 107"></label>
      <label>Target (opsional, untuk Cpm)<input type="text" id="kpT" class="plain-input" inputmode="decimal" autocomplete="off" placeholder="mis. 100"></label>
      <label>Ukuran subgrup<select id="kpSub" class="select-input"><option value="1">1 (data individu: MR̄/d₂)</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="8">8</option><option value="10">10</option></select></label>
      <label>Tingkat kepercayaan CI<select id="kpAlpha" class="select-input"><option value="0.10">90%</option><option value="0.05" selected>95%</option><option value="0.01">99%</option></select></label>`,
    hint: 'Satu kolom data pengukuran <strong>urut menurut waktu</strong> (subgrup dibentuk dari data berurutan sesuai ukuran subgrup). Minimal <strong><span id="kpMin">20</span> data</strong> (disarankan ≥ 100). Isi LSL dan/atau USL (minimal salah satu).',
    table: { names: ['Data'], colLabel: 'Data', minCols: 1, maxCols: 1 }, calcLabel: 'Hitung Kapabilitas',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register((n) => tbl.setCols(1));
  ui.onSample = () => { let s = 31; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, x = []; for (let i = 0; i < 60; i++) x.push(+(100.8 + (rnd() + rnd() + rnd() + rnd() - 2) * 3.6).toFixed(2)); tbl.fill(['Diameter'], [x]); q('kpL').value = '93'; q('kpU').value = '107'; q('kpT').value = '100'; q('kpSub').value = '1'; };
  const num = (id) => { const v = q(id).value.trim(); return v === '' ? NaN : toNum(v); };
  ui.onCalc = () => {
    const alpha = parseFloat(q('kpAlpha').value), sub = parseInt(q('kpSub').value, 10), lsl = num('kpL'), usl = num('kpU'), tg = num('kpT'), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    for (const id of ['kpL', 'kpU', 'kpT']) { const v = q(id).value.trim(); if (v !== '' && Number.isNaN(toNum(v))) return ui.err('Nilai ' + (id === 'kpL' ? 'LSL' : id === 'kpU' ? 'USL' : 'target') + ' harus berupa angka.'); }
    if (!Number.isFinite(lsl) && !Number.isFinite(usl)) return ui.err('Isi minimal salah satu batas spesifikasi (LSL atau USL).');
    if (Number.isFinite(lsl) && Number.isFinite(usl) && !(lsl < usl)) return ui.err('LSL harus lebih kecil dari USL.');
    const raw = cols[0]; let last = -1; raw.forEach((v, i) => { if (v !== null) last = i; }); const x = []; for (let i = 0; i <= last; i++) { if (raw[i] === null) return ui.err('Ada sel kosong di baris ' + (i + 1) + ' di tengah data; data harus berurutan tanpa celah.'); x.push(raw[i]); }
    const n = x.length; if (n < Math.max(10, 2 * sub)) return ui.err(`Dibutuhkan minimal ${Math.max(10, 2 * sub)} data (sekarang ${n}).`);
    if (Math.max.apply(null, x) === Math.min.apply(null, x)) return ui.err('Semua data sama persis; kapabilitas tidak dapat dihitung.');
    const xs = sub > 1 ? x.slice(0, Math.floor(n / sub) * sub) : x, r = QC.capability(xs, { lsl, usl, target: tg, sub, alpha }), N = xs.length, nm = tbl.name(0);
    let ad = null; try { if (window.StatBasic && N >= 8) ad = window.StatBasic.andersonDarling(xs); } catch (e) { }
    const hasB = r.hasL && r.hasU, hasU = r.hasU, hasL = r.hasL, cpkW = r.within.cpk, ppk = r.overall.cpk, ci = r.ciPpk;
    const sigma = (z) => (Number.isFinite(z) ? z + 1.5 : NaN);
    let sum = SV.hist({ data: xs, lsl, usl, target: tg, curves: [{ mu: r.mean, sigma: r.sigmaW, name: 'Within (jangka pendek)', dash: '' }, { mu: r.mean, sigma: r.sigmaO, name: 'Overall (jangka panjang)', dash: '5 3' }], xlabel: nm });
    sum += `<table class="result-table bs-res"><caption>Data proses (n = ${N}${N < n ? ', ' + (n - N) + ' data akhir tidak membentuk subgrup penuh dibuang' : ''})</caption><tbody>
      <tr><td class="lbl">LSL / Target / USL</td><td>${hasL ? g(lsl, 6) : '*'} / ${Number.isFinite(tg) ? g(tg, 6) : '*'} / ${hasU ? g(usl, 6) : '*'}</td></tr><tr><td class="lbl">Rata-rata proses</td><td>${g(r.mean, 6)}</td></tr>
      <tr><td class="lbl">σ within (jangka pendek)</td><td>${g(r.sigmaW, 5)} — ${esc(r.method)}</td></tr><tr><td class="lbl">σ overall (jangka panjang)</td><td>${g(r.sigmaO, 5)} — simpangan baku sampel</td></tr>${ad ? `<tr><td class="lbl">Uji normalitas Anderson-Darling</td><td>A²* = ${fmt(ad.As, 3)}, p = <span class="${ad.p < 0.05 ? 'sig' : ''}">${fmtP(ad.p)}</span> ${ad.p < 0.05 ? '(data tidak normal)' : '(tidak ada bukti menyimpang dari normal)'}</td></tr>` : ''}</tbody></table>
      <table class="result-table bs-res"><caption>Kapabilitas potensial (within)</caption><thead><tr><th class="lbl">Indeks</th><th>Nilai</th><th>Penilaian</th></tr></thead><tbody>${hasB ? `<tr><td class="lbl">Cp</td><td>${fmt(r.within.cp, 3)}</td><td>${lab(r.within.cp)}</td></tr>` : ''}${hasL ? `<tr><td class="lbl">CPL</td><td>${fmt(r.within.cpl, 3)}</td><td></td></tr>` : ''}${hasU ? `<tr><td class="lbl">CPU</td><td>${fmt(r.within.cpu, 3)}</td><td></td></tr>` : ''}<tr><td class="lbl"><strong>Cpk</strong></td><td><strong>${fmt(cpkW, 3)}</strong></td><td>${lab(cpkW)}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Kinerja keseluruhan (overall)</caption><thead><tr><th class="lbl">Indeks</th><th>Nilai</th><th>CI ${pct(1 - alpha)}</th><th>Penilaian</th></tr></thead><tbody>${hasB ? `<tr><td class="lbl">Pp</td><td>${fmt(r.overall.cp, 3)}</td><td>[${fmt(r.ciPp[0], 3)} ; ${fmt(r.ciPp[1], 3)}]</td><td>${lab(r.overall.cp)}</td></tr>` : ''}${hasL ? `<tr><td class="lbl">PPL</td><td>${fmt(r.overall.cpl, 3)}</td><td></td><td></td></tr>` : ''}${hasU ? `<tr><td class="lbl">PPU</td><td>${fmt(r.overall.cpu, 3)}</td><td></td><td></td></tr>` : ''}<tr><td class="lbl"><strong>Ppk</strong></td><td><strong>${fmt(ppk, 3)}</strong></td><td>[${fmt(ci[0], 3)} ; ${fmt(ci[1], 3)}]</td><td>${lab(ppk)}</td></tr>${r.cpm !== undefined ? `<tr><td class="lbl">Cpm (memperhitungkan target)</td><td>${fmt(r.cpm, 3)}</td><td></td><td>${lab(r.cpm)}</td></tr>` : ''}</tbody></table>
      <table class="result-table bs-res"><caption>Kinerja cacat: bagian per sejuta (PPM)</caption><thead><tr><th class="lbl"></th>${hasL ? '<th>&lt; LSL</th>' : ''}${hasU ? '<th>&gt; USL</th>' : ''}<th>Total</th></tr></thead><tbody>
      <tr><td class="lbl">Teramati</td>${hasL ? `<td>${fmt(r.obs.below, 1)}</td>` : ''}${hasU ? `<td>${fmt(r.obs.above, 1)}</td>` : ''}<td>${fmt(r.obs.total, 1)}</td></tr><tr><td class="lbl">Perkiraan within</td>${hasL ? `<td>${fmt(r.ppmWithin.below, 2)}</td>` : ''}${hasU ? `<td>${fmt(r.ppmWithin.above, 2)}</td>` : ''}<td>${fmt(r.ppmWithin.total, 2)}</td></tr><tr><td class="lbl">Perkiraan overall</td>${hasL ? `<td>${fmt(r.ppmOverall.below, 2)}</td>` : ''}${hasU ? `<td>${fmt(r.ppmOverall.above, 2)}</td>` : ''}<td>${fmt(r.ppmOverall.total, 2)}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Z benchmark &amp; level sigma</caption><tbody><tr><td class="lbl">Z bench within / overall</td><td>${fmt(r.zbench.within, 3)} / ${fmt(r.zbench.overall, 3)}</td></tr><tr><td class="lbl">Level sigma (Z bench + 1,5 pergeseran)</td><td>${fmt(sigma(r.zbench.within), 2)} (within) / ${fmt(sigma(r.zbench.overall), 2)} (overall)</td></tr></tbody></table>
      <p class="bs-note">Cp/Cpk memakai σ <em>within</em>; Pp/Ppk memakai σ <em>overall</em>. Kriteria umum: ≥ 1,67 sangat baik, ≥ 1,33 mampu, 1,00–1,33 marjinal, &lt; 1,00 tidak mampu. CI Pp memakai chi-kuadrat, CI Ppk memakai pendekatan Bissell.</p>`;
    const st = [{ t: 'Taksiran variasi', f: `σ overall = s = √[Σ(x − x̄)²/(n − 1)] = ${g(r.sigmaO, 6)}\nσ within: ${r.method} = ${g(r.sigmaW, 6)}`, n: 'σ within hanya mencerminkan variasi jangka pendek (dalam subgrup); σ overall juga memuat pergeseran antar waktu.' },
      { t: 'Indeks kapabilitas', f: `${hasB ? `Cp = (USL − LSL) / (6σ) = (${g(usl)} − ${g(lsl)}) / (6 × ${g(r.sigmaW)}) = ${fmt(r.within.cp, 4)}\n` : ''}${hasU ? `CPU = (USL − x̄) / (3σ) = ${fmt(r.within.cpu, 4)}\n` : ''}${hasL ? `CPL = (x̄ − LSL) / (3σ) = ${fmt(r.within.cpl, 4)}\n` : ''}Cpk = min(CPU, CPL) = ${fmt(cpkW, 4)}`, n: 'Pp dan Ppk dihitung dengan rumus yang sama memakai σ overall.' },
      { t: 'PPM harapan', f: `PPM < LSL = Φ((LSL − x̄)/σ) × 10⁶;  PPM > USL = [1 − Φ((USL − x̄)/σ)] × 10⁶\nWithin total = ${fmt(r.ppmWithin.total, 3)};  overall total = ${fmt(r.ppmOverall.total, 3)}\nZ bench = Φ⁻¹(1 − PPM total/10⁶) = ${fmt(r.zbench.within, 3)} (within)`, n: '' }];
    if (r.cpm !== undefined) st.push({ t: 'Cpm', f: `Cpm = (USL − LSL) / (6 √[s² + (x̄ − T)²]) = ${fmt(r.cpm, 4)}`, n: 'Cpm turun bila rata-rata menjauhi target, walau seluruh data masih dalam spesifikasi.' });
    st.push({ t: 'Selang kepercayaan', f: `Pp: [Pp √(χ²α/2 / (n − 1)), Pp √(χ²1−α/2 / (n − 1))]\nPpk: Ppk ± z √[1/(9n) + Ppk²/(2(n − 1))] = [${fmt(ci[0], 3)} ; ${fmt(ci[1], 3)}]`, n: '' });
    const ip = [`<strong>Kapabilitas jangka pendek:</strong> Cpk = <strong>${fmt(cpkW, 2)}</strong> (${lab(cpkW)})${hasB ? `, Cp = ${fmt(r.within.cp, 2)}` : ''}. <strong>Jangka panjang:</strong> Ppk = <strong>${fmt(ppk, 2)}</strong> (${lab(ppk)}); CI ${pct(1 - alpha)} untuk Ppk [${fmt(ci[0], 2)} ; ${fmt(ci[1], 2)}].`];
    if (hasB && r.within.cp - cpkW > 0.15) ip.push(`<strong>Pemusatan:</strong> Cp (${fmt(r.within.cp, 2)}) jauh di atas Cpk (${fmt(cpkW, 2)}) → rata-rata proses <strong>tidak berada di tengah</strong> spesifikasi; menggeser rata-rata ke ${g((lsl + usl) / 2)}${Number.isFinite(tg) ? ' (atau target ' + g(tg) + ')' : ''} akan menaikkan kapabilitas tanpa mengurangi variasi.`);
    else if (hasB) ip.push('Cp dan Cpk berdekatan: proses cukup terpusat; peningkatan lebih lanjut harus lewat pengurangan variasi.');
    if (cpkW - ppk > 0.2) ip.push(`Cpk (${fmt(cpkW, 2)}) jauh lebih besar daripada Ppk (${fmt(ppk, 2)}): ada <strong>pergeseran atau variasi antar waktu</strong> yang tidak tertangkap dalam subgrup (proses mungkin tidak stabil); periksa dengan peta kendali.`);
    ip.push(`<strong>Cacat:</strong> perkiraan ${fmt(r.ppmOverall.total, 1)} PPM (overall), ${fmt(r.ppmWithin.total, 1)} PPM (within); teramati ${fmt(r.obs.total, 1)} PPM dari ${N} data.${r.obs.total > 0 ? '' : ' Tidak ada data di luar spesifikasi.'} Z bench overall = ${fmt(r.zbench.overall, 2)}.`);
    if (ad && ad.p < 0.05) ip.push('<strong>Peringatan:</strong> uji Anderson-Darling menunjukkan data tidak normal (p = ' + fmtP(ad.p) + '); indeks dan PPM yang dihitung mengandaikan normalitas, jadi bisa menyesatkan. Pertimbangkan transformasi atau analisis kapabilitas non-normal.');
    if (N < 100) ip.push('<strong>Catatan:</strong> kurang dari 100 data; selang kepercayaan lebar dan indeks kapabilitas kurang stabil (lihat CI).');
    ip.push('<strong>Prasyarat:</strong> proses harus terkendali secara statistik (periksa dengan Peta Kendali) sebelum indeks kapabilitas bermakna.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Kapabilitas proses</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Kapabilitas proses (normal)'], ['n', N], ['LSL / USL', (hasL ? g(lsl) : '*') + ' / ' + (hasU ? g(usl) : '*')], ['Cpk / Ppk', fmt(cpkW, 3) + ' / ' + fmt(ppk, 3)]], data: ui.dataExport([nm], [xs]) });
  };
})();
