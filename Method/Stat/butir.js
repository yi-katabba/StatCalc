/* =========================================================================
   ANALISIS BUTIR - uji validitas (korelasi item-total terkoreksi), reliabilitas Cronbach alpha, split-half (Multivariate)
   Baris = responden, kolom = butir kuesioner/tes. Hitungan: multi-core.js (itemAnalysis). Halaman otomatis: #view-butir
   ========================================================================= */
(function () {
  'use strict';
  const MC = window.StatMulti, U = window.StatBasicUI;
  if (!MC || !U || !U.mountPage) return;
  const { esc, fmt, fmtP, pct } = U;
  const aLab = (a) => a >= 0.9 ? 'sangat tinggi' : a >= 0.8 ? 'tinggi (baik)' : a >= 0.7 ? 'dapat diterima' : a >= 0.6 ? 'kurang memadai' : 'rendah';
  const ui = U.mountPage({
    id: 'butir', pre: 'bt', title: 'Analisis Butir (Validitas & Reliabilitas)', eyebrow: 'Metode Statistik &rsaquo; Multivariate', step1: 'Atur analisis &amp; masukkan data',
    lede: 'Periksa kualitas instrumen (kuesioner, skala Likert, atau tes): uji validitas tiap butir dengan korelasi item-total terkoreksi dibanding r tabel, uji reliabilitas dengan Cronbach’s alpha (beserta selang kepercayaan), alpha jika butir dihapus, dan reliabilitas belah dua (split-half) dengan koreksi Spearman-Brown.',
    settings: `<label>Taraf signifikansi uji validitas (α, dua sisi)<select id="btAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: 'Baris = responden, kolom = butir (skor numerik, mis. skala Likert 1–5; judul kolom dapat diubah). Minimal 2 butir (disarankan ≥ 3) dan <strong><span id="btMin">5</span> responden</strong> lengkap; baris dengan sel kosong dibuang.',
    table: { names: ['B1', 'B2', 'B3', 'B4', 'B5'], colLabel: 'B', minCols: 2, maxCols: 30, canAddCol: true }, calcLabel: 'Hitung Validitas & Reliabilitas',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => {
    let s = 9; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, nrm = () => (rnd() + rnd() + rnd() - 1.5) * 1.6, C = Array.from({ length: 6 }, () => []);
    for (let i = 0; i < 30; i++) { const t = nrm() * 1.1; for (let j = 0; j < 6; j++) { const noise = j === 5 ? nrm() * 3 : nrm() * 0.8; C[j].push(Math.max(1, Math.min(5, Math.round(3 + t * (j === 5 ? 0.1 : 1) + noise)))); } }
    tbl.fill(['B1', 'B2', 'B3', 'B4', 'B5', 'B6'], C);
  };
  ui.onCalc = () => {
    const alpha = parseFloat(q('btAlpha').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const nm = tbl.names.map((_, j) => tbl.name(j)), k = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), M = []; let dropped = 0;
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) { dropped++; continue; } M.push(r); }
    const n = M.length; if (k < 2) return ui.err('Dibutuhkan minimal 2 butir (kolom).'); if (n < 5) return ui.err(`Dibutuhkan minimal 5 responden lengkap (sekarang ${n}).`);
    const cst = M[0].findIndex((_, j) => { const c = M.map((r) => r[j]); return Math.max.apply(null, c) === Math.min.apply(null, c); }); if (cst >= 0) return ui.err('Butir "' + nm[cst] + '" memiliki skor yang sama untuk semua responden (tidak bervariasi); hapus butir tersebut.');
    const r = MC.itemAnalysis(M, alpha), nValid = r.items.filter((x) => x.valid).length, lowAlpha = r.alpha < 0.7;
    let sum = `<table class="result-table bs-res"><caption>Reliabilitas instrumen (n = ${n} responden, ${k} butir)</caption><tbody>
      <tr><td class="lbl">Cronbach’s alpha</td><td><strong>${fmt(r.alpha, 4)}</strong> — ${aLab(r.alpha)}</td></tr><tr><td class="lbl">Selang kepercayaan 95% (Feldt)</td><td>[${fmt(r.ci[0], 3)} ; ${fmt(r.ci[1], 3)}]</td></tr>
      <tr><td class="lbl">Alpha terbakukan</td><td>${fmt(r.stdAlpha, 4)}</td></tr><tr><td class="lbl">Rata-rata korelasi antar butir</td><td>${fmt(r.rbar, 4)}</td></tr>
      <tr><td class="lbl">Belah dua (ganjil–genap): r / Spearman-Brown</td><td>${fmt(r.splitHalf.r, 4)} / ${fmt(r.splitHalf.sb, 4)}</td></tr><tr><td class="lbl">Rata-rata / simpangan baku skor total</td><td>${fmt(r.totalMean, 3)} / ${fmt(r.totalSd, 3)}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Validitas butir (r tabel = ${fmt(r.rCrit, 4)} untuk α = ${fmt(alpha, 2)} dua sisi, db = ${r.df})</caption><thead><tr><th class="lbl">Butir</th><th>Rata-rata</th><th>Simpangan baku</th><th>r item-total terkoreksi</th><th>p-value</th><th>Status</th>${k > 2 ? '<th>Alpha jika dihapus</th>' : ''}</tr></thead><tbody>` +
      r.items.map((x, j) => `<tr><td class="lbl">${esc(nm[j])}</td><td>${fmt(x.mean, 3)}</td><td>${fmt(x.sd, 3)}</td><td class="${x.valid ? '' : 'sig'}">${fmt(x.rCorrected, 4)}</td><td>${fmtP(x.p)}</td><td><span class="bs-dec ${x.valid ? 'keep' : 'rej'}">${x.valid ? 'Valid' : 'Tidak valid'}</span></td>${k > 2 ? `<td class="${x.alphaDeleted > r.alpha + 0.005 ? 'sig' : ''}">${fmt(x.alphaDeleted, 4)}</td>` : ''}</tr>`).join('') + '</tbody></table>' +
      `<p class="bs-note">${dropped ? dropped + ' baris dengan sel kosong dibuang. ' : ''}Butir dinyatakan <strong>valid</strong> bila r item-total terkoreksi (korelasi butir dengan jumlah butir lain) &gt; r tabel. Alpha jika butir dihapus yang <strong>lebih tinggi</strong> dari alpha keseluruhan ditebalkan: menghapus butir itu akan menaikkan reliabilitas. Kriteria alpha: ≥ 0,9 sangat tinggi, ≥ 0,8 baik, ≥ 0,7 dapat diterima, ≥ 0,6 kurang, &lt; 0,6 rendah.</p>`;
    const st = [{ t: 'Cronbach’s alpha', f: `α = [k / (k − 1)] × [1 − Σσᵢ² / σₜ²]\nk = ${k},  Σσᵢ² (jumlah ragam butir) = ${fmt(r.items.reduce((a, x) => a + x.sd ** 2, 0), 4)},  σₜ² (ragam skor total) = ${fmt(r.totalSd ** 2, 4)}\nα = ${k}/${k - 1} × [1 − ${fmt(r.items.reduce((a, x) => a + x.sd ** 2, 0), 4)} / ${fmt(r.totalSd ** 2, 4)}] = ${fmt(r.alpha, 4)}`, n: '' },
      { t: 'Selang kepercayaan alpha (Feldt)', f: `Batas = 1 − (1 − α) × F(kuantil; n − 1 = ${n - 1}, (n − 1)(k − 1) = ${(n - 1) * (k - 1)})\nCI 95% = [${fmt(r.ci[0], 4)} ; ${fmt(r.ci[1], 4)}]`, n: '' },
      { t: 'Validitas butir', f: `r item-total terkoreksi = korelasi Pearson antara butir i dan jumlah butir lainnya (butir i tidak ikut dijumlahkan)\nt = r √(n − 2) / √(1 − r²),  db = ${r.df}\nr tabel = t(α/2; ${r.df}) / √(t² + ${r.df}) = ${fmt(r.rCrit, 4)}\n` + r.items.map((x, j) => `${nm[j]}: r = ${fmt(x.rCorrected, 4)} ${x.valid ? '>' : '≤'} ${fmt(r.rCrit, 4)} → ${x.valid ? 'valid' : 'tidak valid'}`).join('\n'), n: 'Korelasi terkoreksi menghindari bias karena butir ikut membentuk skor total.' },
      { t: 'Alpha jika butir dihapus', f: k > 2 ? r.items.map((x, j) => `${nm[j]}: α(tanpa butir ini) = ${fmt(x.alphaDeleted, 4)}`).join('\n') : 'Dibutuhkan minimal 3 butir.', n: '' },
      { t: 'Reliabilitas belah dua', f: `Skor total butir ganjil vs genap: r = ${fmt(r.splitHalf.r, 4)}\nKoreksi Spearman-Brown: r′ = 2r / (1 + r) = ${fmt(r.splitHalf.sb, 4)}`, n: 'Nilai bergantung pada cara membagi butir; alpha adalah rata-rata semua kemungkinan pembelahan.' }];
    const inv = r.items.map((x, j) => ({ x, n: nm[j] })).filter((o) => !o.x.valid), up = r.items.map((x, j) => ({ x, n: nm[j] })).filter((o) => k > 2 && o.x.alphaDeleted > r.alpha + 0.005);
    const ip = [`<strong>Reliabilitas:</strong> Cronbach’s alpha = <strong>${fmt(r.alpha, 3)}</strong> (CI 95% [${fmt(r.ci[0], 3)} ; ${fmt(r.ci[1], 3)}]) → konsistensi internal <strong>${aLab(r.alpha)}</strong>${lowAlpha ? '; di bawah batas umum 0,7.' : '.'}`,
      `<strong>Validitas:</strong> ${nValid} dari ${k} butir valid (r terkoreksi &gt; ${fmt(r.rCrit, 3)}). ${inv.length ? 'Butir tidak valid: ' + inv.map((o) => `${esc(o.n)} (r = ${fmt(o.x.rCorrected, 3)})`).join(', ') + '. Pertimbangkan merevisi atau membuang butir ini.' : 'Semua butir valid.'}`];
    if (up.length) ip.push('Menghapus ' + up.map((o) => `${esc(o.n)} (alpha menjadi ${fmt(o.x.alphaDeleted, 3)})`).join(', ') + ' akan menaikkan reliabilitas.');
    if (inv.length && up.length === 0) ip.push('Butir tidak valid tidak selalu menurunkan alpha; keputusan membuang butir sebaiknya mempertimbangkan isi/konsep yang diukur, bukan hanya angka.');
    if (n < 30) ip.push('<strong>Catatan:</strong> jumlah responden kurang dari 30; estimasi alpha dan uji validitas kurang stabil.');
    ip.push('<strong>Catatan metodologis:</strong> alpha tinggi tidak membuktikan instrumen mengukur satu konsep (unidimensional) — gunakan Analisis Faktor untuk memeriksa dimensi. Untuk skala Likert pendek, korelasi Pearson dapat dilengkapi dengan korelasi polikorik. Alpha sangat tinggi (&gt; 0,95) dapat menandakan butir yang berulang.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Validitas &amp; reliabilitas instrumen</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Analisis butir: validitas & Cronbach alpha'], ['Responden', n], ['Butir', k], ['Alpha', fmt(r.alpha, 4)]], data: ui.dataExport(nm, nm.map((_, j) => M.map((rw) => rw[j]))) });
  };
})();
