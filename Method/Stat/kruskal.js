/* =========================================================================
   UJI KRUSKAL-WALLIS - perbandingan 2-12 kelompok independen, nonparametrik (Nonparametrics)
   Hitungan: nonpar-core.js (kruskal). Halaman otomatis: #view-kruskal
   ========================================================================= */
(function () {
  'use strict';
  const NP = window.StatNonpar, U = window.StatBasicUI, D = window.StatDist;
  if (!NP || !U || !D || !U.mountPage) return;
  const { esc, fmt, fmtP } = U;
  const ui = U.mountPage({
    id: 'kruskal', pre: 'kw', title: 'Uji Kruskal-Wallis', eyebrow: 'Metode Statistik &rsaquo; Nonparametrics', step1: 'Atur uji &amp; masukkan data',
    lede: 'Alternatif nonparametrik untuk ANOVA satu arah: membandingkan dua atau lebih kelompok independen berdasarkan peringkat, tanpa mensyaratkan normalitas. Dilengkapi statistik H (dengan koreksi nilai kembar), p-value, rata-rata peringkat, dan ukuran efek epsilon-kuadrat.',
    settings: `<label>Tingkat signifikansi (α)<select id="kwAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: 'Setiap kolom adalah satu kelompok (panjang kolom boleh berbeda). Minimal 2 kelompok dengan <strong><span id="kwMin">2</span> data</strong> per kelompok; sel kosong diabaikan.',
    table: { names: ['Kelompok 1', 'Kelompok 2', 'Kelompok 3'], colLabel: 'Kelompok', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Kruskal-Wallis',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => tbl.fill(['Kelompok A', 'Kelompok B', 'Kelompok C'], [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91], [65, 70, 82, 60, 75, 88, 55, 72, 70, 84], [70, 71, 69, 72, 70, 68, 73, 71, 70, 69]]);
  ui.onCalc = () => {
    const alpha = parseFloat(q('kwAlpha').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const idx = []; cols.forEach((c, j) => { if (c.some((v) => v !== null)) idx.push(j); });
    const nm = idx.map((j) => tbl.name(j)), groups = idx.map((j) => cols[j].filter((v) => v !== null));
    if (groups.length < 2) return ui.err('Isi minimal dua kelompok dengan data.');
    const sm = groups.findIndex((g) => g.length < 2); if (sm >= 0) return ui.err('Setiap kelompok membutuhkan minimal 2 data (' + nm[sm] + ' hanya ' + groups[sm].length + ').');
    const all = [].concat.apply([], groups); if (!(Math.max.apply(null, all) > Math.min.apply(null, all))) return ui.err('Semua nilai sama persis, uji tidak dapat dihitung.');
    const r = NP.kruskal(groups), rej = r.p < alpha, k = r.k, small = r.ns.some((n) => n < 5);
    const sum = `<table class="result-table bs-res"><caption>Statistik tiap kelompok</caption><thead><tr><th class="lbl">Kelompok</th><th>n</th><th>Median</th><th>Rata-rata peringkat</th><th>Jumlah peringkat</th></tr></thead><tbody>` +
      groups.map((g, i) => `<tr><td class="lbl">${esc(nm[i])}</td><td>${r.ns[i]}</td><td>${fmt(r.med[i])}</td><td>${fmt(r.meanR[i], 3)}</td><td>${fmt(r.R[i], 2)}</td></tr>`).join('') + `<tr><td class="lbl">Keseluruhan</td><td>${r.N}</td><td>${fmt(NP.median(all))}</td><td>${fmt((r.N + 1) / 2, 3)}</td><td></td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Hasil uji Kruskal-Wallis (H₀: semua kelompok berasal dari distribusi yang sama)</caption><tbody>
      <tr><td class="lbl">Statistik H${r.ties.length ? ' (terkoreksi nilai kembar)' : ''}</td><td>${fmt(r.H)}</td></tr><tr><td class="lbl">Derajat bebas (k − 1)</td><td>${r.df}</td></tr>
      <tr><td class="lbl">p-value</td><td class="${rej ? 'sig' : ''}">${fmtP(r.p)}</td></tr><tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr>
      <tr><td class="lbl">Keputusan</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr><tr><td class="lbl">Ukuran efek (ε²)</td><td>${fmt(r.eps2, 3)}</td></tr></tbody></table>
      <p class="bs-note">p-value dari pendekatan chi-square dengan k − 1 derajat bebas${small ? '; <strong>ada kelompok dengan n &lt; 5</strong>, sehingga pendekatan ini kurang akurat' : ''}. ε² = H/(N − 1) menyatakan proporsi variasi peringkat yang dijelaskan oleh kelompok (0 sampai 1).</p>`;
    const st = [{ t: 'Hipotesis', f: `H₀: semua ${k} kelompok berasal dari distribusi yang sama\nH₁: setidaknya satu kelompok cenderung bernilai berbeda\nα = ${fmt(alpha, 2)}`, n: '' },
      { t: 'Peringkat gabungan', f: `Gabungkan semua ${r.N} data, beri peringkat 1…${r.N} (nilai kembar → rata-rata peringkat)\n` + nm.map((n, i) => `${n}: n = ${r.ns[i]}, jumlah peringkat R = ${fmt(r.R[i], 2)}, rata-rata = ${fmt(r.meanR[i], 3)}`).join('\n'), n: '' },
      { t: 'Statistik H', f: `H = [12 / (N(N + 1))] Σ Rᵢ²/nᵢ − 3(N + 1)\n  = [12 / (${r.N} × ${r.N + 1})] × ${fmt(r.R.reduce((s, v, i) => s + v * v / r.ns[i], 0), 3)} − ${3 * (r.N + 1)} = ${fmt(r.H0, 4)}${r.ties.length ? `\nKoreksi nilai kembar: C = 1 − Σ(t³ − t)/(N³ − N) = ${fmt(r.corr, 5)}\nH terkoreksi = ${fmt(r.H0, 4)} / ${fmt(r.corr, 5)} = ${fmt(r.H, 4)}` : ''}`, n: '' },
      { t: 'p-value', f: `df = k − 1 = ${r.df}\np-value = P(χ² ≥ ${fmt(r.H, 4)}) = ${fmtP(r.p)}`, n: '' },
      { t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(r.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' }];
    const order = r.meanR.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const ip = [`<strong>Keputusan:</strong> H = ${fmt(r.H)}, df = ${r.df}, p-value = <strong>${fmtP(r.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. ${rej ? 'Terdapat bukti yang cukup bahwa <strong>setidaknya satu kelompok berbeda</strong> dari yang lain.' : 'Belum terdapat bukti yang cukup bahwa kelompok-kelompok tersebut berbeda.'}`,
      `Urutan rata-rata peringkat (tertinggi ke terendah): ${order.map((o) => `${esc(nm[o.i])} (${fmt(o.v, 2)})`).join(' &gt; ')}.`, `Ukuran efek ε² = ${fmt(r.eps2, 3)} (${r.eps2 < 0.01 ? 'dapat diabaikan' : r.eps2 < 0.08 ? 'kecil' : r.eps2 < 0.26 ? 'sedang' : 'besar'}).`];
    if (rej && k > 2) ip.push('Uji ini hanya menyatakan <em>ada</em> perbedaan; untuk mengetahui kelompok mana yang berbeda diperlukan uji lanjut (mis. uji Dunn atau Mann-Whitney berpasangan dengan koreksi Bonferroni).');
    if (small) ip.push('<strong>Peringatan:</strong> ada kelompok dengan kurang dari 5 data, p-value pendekatan chi-square kurang akurat.');
    ip.push('<strong>Asumsi:</strong> kelompok saling bebas dan data minimal berskala ordinal. Bila bentuk distribusi antar kelompok serupa, perbedaan dapat ditafsirkan sebagai perbedaan median.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Uji Kruskal-Wallis (${k} kelompok)</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Uji Kruskal-Wallis'], ['Jumlah kelompok', k], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm, groups) });
  };
})();
