/* =========================================================================
   UJI FRIEDMAN - perbandingan beberapa perlakuan pada blok/subjek yang sama, nonparametrik (Nonparametrics)
   Baris = blok (subjek), kolom = perlakuan; baris harus lengkap. Hitungan: nonpar-core.js (friedman).
   Halaman otomatis: #view-friedman
   ========================================================================= */
(function () {
  'use strict';
  const NP = window.StatNonpar, U = window.StatBasicUI, D = window.StatDist;
  if (!NP || !U || !D || !U.mountPage) return;
  const { esc, fmt, fmtP } = U;
  const ui = U.mountPage({
    id: 'friedman', pre: 'fr', title: 'Uji Friedman', eyebrow: 'Metode Statistik &rsaquo; Nonparametrics', step1: 'Atur uji &amp; masukkan data',
    lede: 'Alternatif nonparametrik untuk ANOVA pengukuran berulang / acak kelompok: membandingkan beberapa perlakuan yang diterapkan pada subjek (blok) yang sama berdasarkan peringkat dalam tiap blok. Dilengkapi statistik chi-square Friedman, p-value, dan koefisien konkordansi Kendall (W).',
    settings: `<label>Tingkat signifikansi (α)<select id="frAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: 'Baris = blok/subjek, kolom = perlakuan (judul kolom dapat diubah). Setiap baris harus lengkap; minimal 2 perlakuan dan <strong><span id="frMin">2</span> blok</strong> (disarankan ≥ 3 perlakuan dan ≥ 5 blok). Baris yang seluruhnya kosong diabaikan.',
    table: { names: ['Perlakuan 1', 'Perlakuan 2', 'Perlakuan 3'], colLabel: 'Perlakuan', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Friedman',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => { const M = [[7, 9, 8], [6, 8, 9], [5, 7, 6], [8, 9, 10], [4, 6, 5], [7, 8, 9], [6, 9, 8], [5, 6, 7]]; tbl.fill(['Metode A', 'Metode B', 'Metode C'], [0, 1, 2].map((j) => M.map((r) => r[j]))); };
  ui.onCalc = () => {
    const alpha = parseFloat(q('frAlpha').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const nm = tbl.names.map((_, j) => tbl.name(j)), k = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), rows = [];
    for (let i = 0; i < nr; i++) {
      const r = cols.map((c) => (c[i] === undefined ? null : c[i]));
      if (r.every((v) => v === null)) continue;
      if (r.some((v) => v === null)) return ui.err('Baris ' + (i + 1) + ' belum lengkap. Uji Friedman membutuhkan nilai untuk semua perlakuan pada setiap blok.');
      rows.push(r);
    }
    if (k < 2) return ui.err('Uji Friedman membutuhkan minimal 2 perlakuan (kolom).');
    if (rows.length < 2) return ui.err('Uji Friedman membutuhkan minimal 2 blok (baris lengkap).');
    if (rows.every((r) => r.every((v) => v === r[0]))) return ui.err('Semua nilai sama persis, uji tidak dapat dihitung.');
    const r = NP.friedman(rows), rej = r.p < alpha, n = r.n, small = n < 5 || k < 3;
    const sum = `<table class="result-table bs-res"><caption>Statistik tiap perlakuan (${n} blok)</caption><thead><tr><th class="lbl">Perlakuan</th><th>Median</th><th>Jumlah peringkat</th><th>Rata-rata peringkat</th></tr></thead><tbody>` +
      nm.map((c, j) => `<tr><td class="lbl">${esc(c)}</td><td>${fmt(r.med[j])}</td><td>${fmt(r.R[j], 2)}</td><td>${fmt(r.meanR[j], 3)}</td></tr>`).join('') + `</tbody></table>
      <table class="result-table bs-res"><caption>Hasil uji Friedman (H₀: semua perlakuan berpengaruh sama)</caption><tbody>
      <tr><td class="lbl">Chi-Square Friedman${r.corr !== 1 ? ' (terkoreksi nilai kembar)' : ''}</td><td>${fmt(r.chi2)}</td></tr><tr><td class="lbl">Derajat bebas (k − 1)</td><td>${r.df}</td></tr>
      <tr><td class="lbl">p-value</td><td class="${rej ? 'sig' : ''}">${fmtP(r.p)}</td></tr><tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr>
      <tr><td class="lbl">Keputusan</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr>
      <tr><td class="lbl">Koefisien konkordansi Kendall (W)</td><td>${fmt(r.W, 3)}</td></tr></tbody></table>
      <p class="bs-note">p-value dari pendekatan chi-square dengan k − 1 derajat bebas${small ? '; <strong>jumlah blok atau perlakuan kecil</strong>, sehingga pendekatan ini kurang akurat (gunakan tabel eksak bila tersedia)' : ''}. Kendall’s W = χ² / [n(k − 1)] berkisar 0 (tidak ada kesepakatan urutan antar blok) sampai 1 (urutan perlakuan identik di semua blok).</p>`;
    const sq = r.R.reduce((s, v) => s + v * v, 0);
    const st = [{ t: 'Hipotesis', f: `H₀: ${k} perlakuan berpengaruh sama (distribusi sama dalam tiap blok)\nH₁: setidaknya satu perlakuan cenderung berbeda\nα = ${fmt(alpha, 2)}`, n: '' },
      { t: 'Peringkat dalam blok', f: `Pada setiap dari ${n} blok, beri peringkat 1…${k} pada nilai antarperlakuan (nilai kembar → rata-rata peringkat)\n` + nm.map((c, j) => `${c}: jumlah peringkat R = ${fmt(r.R[j], 2)}, rata-rata = ${fmt(r.meanR[j], 3)}`).join('\n'), n: '' },
      { t: 'Statistik Friedman', f: `χ² = [12 / (n·k·(k + 1))] Σ Rⱼ² − 3n(k + 1)\n   = [12 / (${n}×${k}×${k + 1})] × ${fmt(sq, 3)} − ${3 * n * (k + 1)} = ${fmt(r.chi0, 4)}${r.corr !== 1 ? `\nKoreksi nilai kembar: C = 1 − Σ(t³ − t) / [n·k(k² − 1)] = ${fmt(r.corr, 5)}\nχ² terkoreksi = ${fmt(r.chi0, 4)} / ${fmt(r.corr, 5)} = ${fmt(r.chi2, 4)}` : ''}`, n: '' },
      { t: 'p-value & Kendall W', f: `df = k − 1 = ${r.df}\np-value = P(χ² ≥ ${fmt(r.chi2, 4)}) = ${fmtP(r.p)}\nW = χ² / [n(k − 1)] = ${fmt(r.chi2, 4)} / (${n} × ${k - 1}) = ${fmt(r.W, 4)}`, n: '' },
      { t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(r.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' }];
    const order = r.meanR.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const ip = [`<strong>Keputusan:</strong> χ² = ${fmt(r.chi2)}, df = ${r.df}, p-value = <strong>${fmtP(r.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. ${rej ? 'Terdapat bukti yang cukup bahwa <strong>setidaknya satu perlakuan berbeda</strong>.' : 'Belum terdapat bukti yang cukup bahwa perlakuan-perlakuan tersebut berbeda.'}`,
      `Urutan rata-rata peringkat (tertinggi ke terendah): ${order.map((o) => `${esc(nm[o.i])} (${fmt(o.v, 2)})`).join(' &gt; ')}.`,
      `Koefisien konkordansi Kendall W = ${fmt(r.W, 3)} (${r.W < 0.1 ? 'kesepakatan urutan sangat lemah' : r.W < 0.3 ? 'lemah' : r.W < 0.5 ? 'sedang' : r.W < 0.7 ? 'kuat' : 'sangat kuat'}): seberapa konsisten urutan perlakuan di antara blok.`];
    if (rej && k > 2) ip.push('Untuk mengetahui pasangan perlakuan mana yang berbeda, lakukan uji lanjut (mis. Wilcoxon berpasangan dengan koreksi Bonferroni atau uji Nemenyi).');
    if (small) ip.push('<strong>Peringatan:</strong> sampel kecil (kurang dari 5 blok atau hanya 2 perlakuan); pendekatan chi-square kurang akurat.');
    ip.push('<strong>Asumsi:</strong> blok saling bebas, tiap blok diukur pada semua perlakuan, dan data minimal berskala ordinal.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Uji Friedman (${k} perlakuan, ${n} blok)</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Uji Friedman'], ['Perlakuan', k], ['Blok', n], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm, nm.map((_, j) => rows.map((rw) => rw[j]))) });
  };
})();
