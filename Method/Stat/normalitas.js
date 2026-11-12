/* =========================================================================
   UJI NORMALITAS - Shapiro-Wilk, Anderson-Darling, Jarque-Bera (Basic Statistics)
   Satu atau banyak variabel (satu kolom = satu variabel). Hitungan: basic-core.js (shapiroWilk, andersonDarling, jarqueBera).
   Halaman otomatis: #view-normalitas
   ========================================================================= */
(function () {
  'use strict';
  const B = window.StatBasic, U = window.StatBasicUI, D = window.StatDist;
  if (!B || !U || !D || !U.mountPage) return;
  const { esc, fmt, fmtP } = U;
  const ui = U.mountPage({
    id: 'normalitas', pre: 'nm', title: 'Uji Normalitas', step1: 'Atur uji &amp; masukkan data',
    lede: 'Periksa apakah data berdistribusi normal dengan tiga uji sekaligus: Shapiro-Wilk (paling kuat untuk sampel kecil-menengah), Anderson-Darling (sensitif di ekor distribusi), dan Jarque-Bera (berdasar kemencengan dan keruncingan). Menerima 1 sampai 12 variabel.',
    settings: `<label>Tingkat signifikansi (α)<select id="nmAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: 'Satu kolom = satu variabel. Minimal <strong><span id="nmMin">3</span> data</strong> per variabel (disarankan ≥ 8; Shapiro-Wilk maksimal 5000). Sel kosong diabaikan.',
    table: { names: ['Variabel 1'], colLabel: 'Variabel', minCols: 1, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Uji Normalitas',
  });
  const tbl = ui.tbl, q = ui.q;
  tbl.register();
  ui.onSample = () => tbl.fill(['Nilai ujian', 'Waktu respon'], [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91, 74, 85, 69, 83, 77, 81, 86, 79], [1.2, 0.8, 2.5, 1.1, 0.9, 6.8, 1.4, 1.0, 3.9, 1.3, 0.7, 12.5, 1.6, 1.2, 2.1, 0.9, 1.5, 4.4]]);

  ui.onCalc = () => {
    const alpha = parseFloat(q('nmAlpha').value);
    const { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const idx = []; cols.forEach((c, j) => { if (c.some((v) => v !== null)) idx.push(j); });
    if (!idx.length) return ui.err('Isi minimal satu variabel dengan data.');
    const names = idx.map((j) => tbl.name(j)), data = idx.map((j) => cols[j].filter((v) => v !== null));
    for (let i = 0; i < data.length; i++) {
      if (data[i].length < 3) return ui.err(names[i] + ': minimal 3 data (sekarang ' + data[i].length + ').');
      if (data[i].length > 5000) return ui.err(names[i] + ': Shapiro-Wilk hanya berlaku sampai 5000 data (sekarang ' + data[i].length + ').');
      if (!(Math.max.apply(null, data[i]) - Math.min.apply(null, data[i]) > 0)) return ui.err(names[i] + ': semua nilai sama persis, uji normalitas tidak dapat dihitung.');
    }
    const R = data.map((x) => {
      const mo = B.moments(x), sw = B.shapiroWilk(x), big = x.length >= 8;
      return { x, n: x.length, mo, sw, ad: big ? B.andersonDarling(x) : null, jb: big ? B.jarqueBera(x) : null };
    });
    const cell = (p) => `<td class="${p < alpha ? 'sig' : ''}">${fmtP(p)}</td>`;
    const verdict = (r) => {
      const rej = []; if (r.sw.p < alpha) rej.push('Shapiro-Wilk'); if (r.ad && r.ad.p < alpha) rej.push('Anderson-Darling'); if (r.jb && r.jb.p < alpha) rej.push('Jarque-Bera');
      return { rej, normal: !rej.length };
    };
    let sum = '<table class="result-table bs-res"><caption>Statistik deskriptif</caption><thead><tr><th class="lbl">Variabel</th><th>n</th><th>Rata-rata</th><th>Simpangan baku</th><th>Kemencengan</th><th>Kurtosis berlebih</th></tr></thead><tbody>' +
      R.map((r, i) => `<tr><td class="lbl">${esc(names[i])}</td><td>${r.n}</td><td>${fmt(r.mo.mean)}</td><td>${fmt(r.mo.sd)}</td><td>${fmt(r.mo.skew, 3)}</td><td>${fmt(r.mo.kurt - 3, 3)}</td></tr>`).join('') + '</tbody></table>';
    sum += '<table class="result-table bs-res"><caption>Hasil uji (H₀: data berasal dari populasi berdistribusi normal)</caption><thead><tr><th class="lbl">Variabel</th><th>Shapiro-Wilk W</th><th>p</th><th>Anderson-Darling A²*</th><th>p</th><th>Jarque-Bera</th><th>p</th><th>Kesimpulan</th></tr></thead><tbody>' +
      R.map((r, i) => { const v = verdict(r); return `<tr><td class="lbl">${esc(names[i])}</td><td>${fmt(r.sw.W, 4)}</td>${cell(r.sw.p)}<td>${r.ad ? fmt(r.ad.As, 4) : '-'}</td>${r.ad ? cell(r.ad.p) : '<td>-</td>'}<td>${r.jb ? fmt(r.jb.JB, 4) : '-'}</td>${r.jb ? cell(r.jb.p) : '<td>-</td>'}<td><span class="bs-dec ${v.normal ? 'keep' : 'rej'}">${v.normal ? 'Normal' : 'Tidak normal'}</span></td></tr>`; }).join('') + '</tbody></table>';
    sum += `<p class="bs-note">Hipotesis nol ditolak bila p &lt; α = ${fmt(alpha, 2)} (p tercetak tebal). A²* adalah statistik Anderson-Darling yang dikoreksi untuk sampel kecil (p-value dari pendekatan D’Agostino &amp; Stephens). Anderson-Darling dan Jarque-Bera hanya dihitung untuk n ≥ 8 (Jarque-Bera kurang andal untuk n &lt; 30). Kemencengan 0 dan kurtosis berlebih 0 adalah nilai distribusi normal.</p>`;
    /* langkah (variabel pertama) */
    const r0 = R[0], st = [], n0 = r0.n;
    const a = r0.sw.a, sh = (arr) => arr.map((v) => fmt(v, 3)).join(', ');
    const nn2 = Math.floor(n0 / 2), aTop = []; for (let i = 1; i <= Math.min(nn2, 6); i++) aTop.push(a[i]);
    st.push({ t: 'Hipotesis', f: `H₀: data berasal dari populasi berdistribusi normal\nH₁: data tidak berdistribusi normal\nα = ${fmt(alpha, 2)}`, n: `Langkah berikut dihitung untuk variabel pertama: ${names[0]} (n = ${n0}). Variabel lain memakai rumus yang sama.` });
    st.push({ t: 'Shapiro-Wilk', f: `Urutkan data: x(1) ≤ … ≤ x(n)\nW = (Σ aᵢ x(i))² / Σ(xᵢ − x̄)²\nKoefisien a₁…a${Math.min(nn2, 6)} (Royston) = ${sh(aTop)}${nn2 > 6 ? ', …' : ''}\nW = ${fmt(r0.sw.W, 5)}\np-value = ${fmtP(r0.sw.p)}`, n: 'W mendekati 1 bila data normal. p-value dihitung dengan transformasi Royston (1992) yang berlaku untuk 3 ≤ n ≤ 5000.' });
    if (r0.ad) st.push({ t: 'Anderson-Darling', f: `zᵢ = (x(i) − x̄) / s,  Φ = fungsi sebaran normal baku\nA² = −n − (1/n) Σ (2i − 1)[ln Φ(zᵢ) + ln(1 − Φ(z₍ₙ₊₁₋ᵢ₎))]\nA² = ${fmt(r0.ad.A2, 4)}\nA²* = A² (1 + 0,75/n + 2,25/n²) = ${fmt(r0.ad.As, 4)}\np-value = ${fmtP(r0.ad.p)}`, n: 'Statistik ini memberi bobot lebih besar pada penyimpangan di ekor distribusi.' });
    if (r0.jb) st.push({ t: 'Jarque-Bera', f: `S = ${fmt(r0.mo.skew, 4)} (kemencengan),  K = ${fmt(r0.mo.kurt, 4)} (kurtosis)\nJB = (n/6)[S² + (K − 3)²/4] = (${n0}/6)[${fmt(r0.mo.skew * r0.mo.skew, 4)} + ${fmt((r0.mo.kurt - 3) ** 2 / 4, 4)}] = ${fmt(r0.jb.JB, 4)}\ndf = 2,  p-value = ${fmtP(r0.jb.p)}`, n: 'JB dibandingkan dengan distribusi chi-square (df = 2); untuk sampel kecil cenderung kurang andal.' });
    st.push({ t: 'Keputusan', f: R.map((r, i) => { const v = verdict(r); return `${names[i]}: ${v.normal ? 'tidak ada uji yang menolak normalitas' : 'normalitas ditolak oleh ' + v.rej.join(', ')}`; }).join('\n'), n: '' });
    /* interpretasi */
    const ip = R.map((r, i) => {
      const v = verdict(r), sk = r.mo.skew, ku = r.mo.kurt - 3;
      const shape = [Math.abs(sk) >= 0.5 ? (sk > 0 ? 'condong ke kanan (ekor kanan panjang)' : 'condong ke kiri (ekor kiri panjang)') : null, Math.abs(ku) >= 1 ? (ku > 0 ? 'lebih runcing dengan ekor berat' : 'lebih datar') : null].filter(Boolean);
      const parts = [`Shapiro-Wilk p = ${fmtP(r.sw.p)}${r.ad ? `, Anderson-Darling p = ${fmtP(r.ad.p)}` : ''}${r.jb ? `, Jarque-Bera p = ${fmtP(r.jb.p)}` : ''}. ${v.normal ? `Tidak ada uji yang menolak H₀ pada α = ${fmt(alpha, 2)}, jadi tidak ada bukti yang cukup bahwa data menyimpang dari normal.` : `H₀ ditolak oleh ${v.rej.join(', ')}: terdapat bukti bahwa data <strong>tidak berdistribusi normal</strong>.`}`];
      if (shape.length) parts.push(`Bentuk sebaran: ${shape.join(' dan ')} (kemencengan ${fmt(sk, 2)}, kurtosis berlebih ${fmt(ku, 2)}).`);
      if (!v.normal) parts.push('Pertimbangkan transformasi (log, akar kuadrat, Box-Cox), periksa pencilan, atau gunakan uji nonparametrik.');
      if (r.n < 20 && v.normal) parts.push('Sampel kecil: uji normalitas berdaya rendah, jadi hasil “normal” belum menjamin data benar-benar normal.');
      if (r.n > 300 && !v.normal) parts.push('Sampel besar: penyimpangan kecil pun mudah terdeteksi; nilai praktisnya perlu dilihat dari plot peluang normal.');
      return `<div class="bs-var"><h4>${esc(names[i])}</h4>${parts.map((p) => `<p>${p}</p>`).join('')}</div>`;
    }).join('') + '<div class="bs-var"><h4>Catatan penting</h4><p>Uji normalitas sebaiknya dilengkapi plot peluang normal (Probability Plot) dan histogram di menu Graph. Untuk uji t atau ANOVA, yang perlu normal adalah <strong>galat/residu</strong> atau data tiap kelompok, dan dengan sampel besar (n ≥ 30) uji tersebut cukup tahan terhadap penyimpangan ringan dari normal.</p></div>';
    ui.show({ sum, steps: st, interp: ip });
    const SC = window.StatCharts, charts = [];
    if (SC) data.slice(0, 6).forEach((x, i) => {
      const nmI = names[i], v = verdict(R[i]);
      charts.push({ title: 'Probability plot ' + nmI,
        caption: 'Titik yang mengikuti garis lurus berarti data mendekati normal; lengkungan atau ujung yang melenceng menandakan penyimpangan. Shapiro-Wilk p = ' + fmtP(R[i].sw.p) + ' (' + (v.normal ? 'tidak ada uji yang menolak normalitas' : 'normalitas ditolak oleh ' + v.rej.join(', ')) + ').',
        build: () => SC.qq(x, { title: 'Probability Plot ' + nmI }) });
      charts.push({ title: 'Histogram ' + nmI, caption: 'Kurva = kurva normal dengan rata-rata dan simpangan baku data.',
        build: () => SC.hist(x, { title: 'Histogram ' + nmI, xLabel: nmI }) });
    });
    ui.publish({ meta: [['Metode', 'Uji normalitas (Shapiro-Wilk, Anderson-Darling, Jarque-Bera)'], ['α', fmt(alpha, 2)], ['Variabel', names.join(', ')]].concat(data.length > 6 ? [['Grafik', 'Ditampilkan untuk 6 variabel pertama']] : []), data: ui.dataExport(names, data), charts });
  };
})();
