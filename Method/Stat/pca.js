/* =========================================================================
   PCA (Analisis Komponen Utama) - Multivariate. Matriks korelasi (data dibakukan) atau kovarians.
   Hitungan: multi-core.js (pca). Grafik: svg-helpers.js. Halaman otomatis: #view-pca
   ========================================================================= */
(function () {
  'use strict';
  const MC = window.StatMulti, SV = window.StatSvg, U = window.StatBasicUI;
  if (!MC || !SV || !U || !U.mountPage) return;
  const { esc, fmt, pct } = U;
  const ui = U.mountPage({
    id: 'pca', pre: 'pc', title: 'PCA (Komponen Utama)', eyebrow: 'Metode Statistik &rsaquo; Multivariate', step1: 'Atur analisis &amp; masukkan data',
    lede: 'Ringkas banyak variabel yang saling berkorelasi menjadi beberapa komponen utama yang tidak berkorelasi. Menampilkan nilai eigen, proporsi varians, scree plot, loading tiap variabel, skor komponen, dan grafik skor.',
    settings: `
      <label>Matriks yang dipakai<select id="pcMat" class="select-input"><option value="corr">Korelasi (data dibakukan, disarankan)</option><option value="cov">Kovarians (satuan asli)</option></select></label>
      <label>Jumlah komponen ditampilkan<select id="pcK" class="select-input"><option value="auto">Otomatis (kriteria Kaiser)</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>`,
    hint: 'Baris = pengamatan, kolom = variabel numerik (judul kolom dapat diubah). Minimal 2 variabel dan <strong><span id="pcMin">4</span> pengamatan</strong> lengkap; baris dengan sel kosong dibuang.',
    table: { names: ['X1', 'X2', 'X3', 'X4'], colLabel: 'X', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung PCA',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => {
    let s = 3; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, A = [], B = [], C = [], Dd = [];
    for (let i = 0; i < 24; i++) { const f = rnd() * 4, g = rnd() * 3; A.push(+(60 + 8 * f + rnd() * 6).toFixed(1)); B.push(+(55 + 7 * f + rnd() * 7).toFixed(1)); C.push(+(50 + 6 * g + rnd() * 6).toFixed(1)); Dd.push(+(52 + 6.5 * g + 2 * f + rnd() * 6).toFixed(1)); }
    tbl.fill(['Matematika', 'Fisika', 'Bahasa', 'Sejarah'], [A, B, C, Dd]);
  };
  ui.onCalc = () => {
    const useCorr = q('pcMat').value === 'corr', kSel = q('pcK').value, { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const nm = tbl.names.map((_, j) => tbl.name(j)), p = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), X = []; let dropped = 0;
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) { dropped++; continue; } X.push(r); }
    const n = X.length; if (p < 2) return ui.err('PCA membutuhkan minimal 2 variabel.'); if (n < Math.max(3, p)) return ui.err(`Dibutuhkan minimal ${Math.max(3, p)} pengamatan lengkap (sekarang ${n}).`);
    const cst = X[0].findIndex((_, j) => { const c = X.map((r) => r[j]); return Math.max.apply(null, c) === Math.min.apply(null, c); }); if (cst >= 0) return ui.err('Variabel "' + nm[cst] + '" bernilai konstan; hapus kolom tersebut.');
    const r = MC.pca(X, { standardize: useCorr }), ev = r.eigenvalues, avg = r.total / p;
    const kaiser = ev.filter((v) => v > (useCorr ? 1 : avg)).length || 1, k = Math.min(p, kSel === 'auto' ? kaiser : parseInt(kSel, 10)), k80 = r.cumul.findIndex((c) => c >= 0.8) + 1;
    let sum = `<table class="result-table bs-res"><caption>Nilai eigen &amp; proporsi varians (${useCorr ? 'matriks korelasi' : 'matriks kovarians'}, n = ${n})</caption><thead><tr><th class="lbl">Komponen</th><th>Nilai eigen (λ)</th><th>Proporsi</th><th>Kumulatif</th></tr></thead><tbody>` +
      ev.map((v, j) => `<tr><td class="lbl">PC${j + 1}${j < k ? ' ◄' : ''}</td><td class="${v > (useCorr ? 1 : avg) ? 'sig' : ''}">${fmt(v, 4)}</td><td>${pct(r.prop[j])}</td><td>${pct(r.cumul[j])}</td></tr>`).join('') + '</tbody></table>';
    sum += SV.scree(ev) + `<p class="bs-note" style="text-align:center">Garis putus-putus: λ = 1 (kriteria Kaiser${useCorr ? '' : '; pada matriks kovarians acuan yang lebih tepat adalah rata-rata λ = ' + fmt(avg, 3)}).</p>`;
    sum += `<table class="result-table bs-res"><caption>Loading komponen (${useCorr ? 'korelasi variabel–komponen' : 'vektor eigen × √λ'})</caption><thead><tr><th class="lbl">Variabel</th>${Array.from({ length: k }, (_, j) => `<th>PC${j + 1}</th>`).join('')}<th>Komunalitas (${k} PC)</th></tr></thead><tbody>` +
      nm.map((v, i) => `<tr><td class="lbl">${esc(v)}</td>${Array.from({ length: k }, (_, j) => { const l = r.loadings[j][i]; return `<td class="${Math.abs(l) >= 0.5 ? 'sig' : ''}">${fmt(l, 3)}</td>`; }).join('')}<td>${fmt(Array.from({ length: k }, (_, j) => r.loadings[j][i] ** 2).reduce((a, b) => a + b, 0) / r.C[i][i], 3)}</td></tr>`).join('') + '</tbody></table>';
    const shown = Math.min(n, 15);
    sum += `<table class="result-table bs-res"><caption>Skor komponen (${shown} pengamatan pertama dari ${n})</caption><thead><tr><th class="lbl">Pengamatan</th>${Array.from({ length: k }, (_, j) => `<th>PC${j + 1}</th>`).join('')}</tr></thead><tbody>` + r.scores.slice(0, shown).map((sc, i) => `<tr><td class="lbl">${i + 1}</td>${sc.slice(0, k).map((v) => `<td>${fmt(v, 3)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
    if (p >= 2) sum += SV.scatter({ pts: r.scores.map((s) => [s[0], s[1]]), labels: r.scores.map((_, i) => String(i + 1)), xlabel: `PC1 (${pct(r.prop[0])})`, ylabel: `PC2 (${pct(r.prop[1])})`, title: 'Grafik skor PC1 vs PC2', zero: true }) + '<p class="bs-note" style="text-align:center">Tiap titik adalah satu pengamatan (nomor baris).</p>';
    sum += `<p class="bs-note">${dropped ? dropped + ' baris dengan sel kosong dibuang. ' : ''}Loading ≥ 0,5 ditebalkan. ${useCorr ? 'Pada matriks korelasi, jumlah nilai eigen = jumlah variabel (' + p + ').' : 'Pada matriks kovarians, variabel berskala besar mendominasi komponen; bakukan data bila satuan berbeda.'} ◄ = komponen yang ditampilkan.</p>`;
    const st = [{ t: 'Persiapan data', f: useCorr ? `Setiap variabel dibakukan: zᵢⱼ = (xᵢⱼ − x̄ⱼ) / sⱼ\nMatriks korelasi R = ZᵀZ / (n − 1)  (${p}×${p}), n = ${n}` : `Data dipusatkan: xᵢⱼ − x̄ⱼ\nMatriks kovarians S = XᵀX / (n − 1)  (${p}×${p}), n = ${n}`, n: '' },
      { t: 'Nilai & vektor eigen', f: `Cari λ dan v sehingga ${useCorr ? 'R' : 'S'}v = λv (dekomposisi Jacobi untuk matriks simetris)\nλ = ${ev.map((v) => fmt(v, 4)).join(', ')}\nJumlah λ = ${fmt(r.total, 4)} = ${useCorr ? 'jumlah variabel' : 'jumlah ragam variabel'}`, n: 'Vektor eigen ke-j menentukan kombinasi linear variabel pembentuk komponen ke-j.' },
      { t: 'Proporsi varians', f: ev.slice(0, Math.min(p, 6)).map((v, j) => `PC${j + 1}: λ / Σλ = ${fmt(v, 4)} / ${fmt(r.total, 4)} = ${pct(r.prop[j])}  (kumulatif ${pct(r.cumul[j])})`).join('\n'), n: '' },
      { t: 'Loading & skor', f: `Loading = vektor eigen × √λ\nSkor PCⱼ = Σᵢ vᵢⱼ · zᵢ  (kombinasi linear variabel ${useCorr ? 'baku' : 'terpusat'})\nContoh PC1: ${nm.map((v, i) => `${fmt(r.vectors[0][i], 3)}·${v}`).join(' + ')}`, n: '' },
      { t: 'Jumlah komponen', f: `Kriteria Kaiser (λ > ${useCorr ? '1' : 'rata-rata ' + fmt(avg, 3)}): ${kaiser} komponen\nKumulatif ≥ 80%: ${k80} komponen\nDitampilkan: ${k} komponen (${pct(r.cumul[k - 1])} varians)`, n: 'Periksa juga siku pada scree plot.' }];
    const dom = (j) => nm.filter((_, i) => Math.abs(r.loadings[j][i]) >= 0.5).map((v, _) => esc(v));
    const ip = [`<strong>Ringkasan:</strong> ${p} variabel diringkas menjadi <strong>${k} komponen utama</strong> yang menjelaskan <strong>${pct(r.cumul[k - 1])}</strong> varians total (kriteria Kaiser: ${kaiser} komponen; 80% varians dicapai pada ${k80} komponen).`];
    for (let j = 0; j < k; j++) { const ps = nm.filter((_, i) => r.loadings[j][i] >= 0.5).map(esc), ng = nm.filter((_, i) => r.loadings[j][i] <= -0.5).map(esc); ip.push(`<strong>PC${j + 1}</strong> (${pct(r.prop[j])}): ${ps.length || ng.length ? (ps.length ? 'loading positif tinggi pada ' + ps.join(', ') : '') + (ps.length && ng.length ? '; ' : '') + (ng.length ? 'loading negatif tinggi pada ' + ng.join(', ') : '') + '.' : 'tidak ada variabel dengan |loading| ≥ 0,5 (komponen campuran).'}`); }
    ip.push('Skor komponen dapat dipakai sebagai variabel baru yang saling bebas (mis. pada regresi) atau untuk memvisualisasikan pengamatan dalam dua dimensi.');
    if (n < 5 * p) ip.push('<strong>Catatan:</strong> jumlah pengamatan relatif sedikit dibanding variabel (disarankan ≥ 5 kali jumlah variabel); hasil bisa tidak stabil.');
    ip.push('<strong>Asumsi:</strong> hubungan antar variabel linear dan data numerik; PCA peka terhadap pencilan. Bila tujuannya mengidentifikasi faktor laten, gunakan Analisis Faktor.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Analisis komponen utama</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'PCA (' + (useCorr ? 'korelasi' : 'kovarians') + ')'], ['n', n], ['Variabel', p], ['Komponen ditampilkan', k]], data: ui.dataExport(nm, nm.map((_, j) => X.map((r2) => r2[j]))) });
  };
})();
