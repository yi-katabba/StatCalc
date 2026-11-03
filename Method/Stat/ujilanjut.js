/* =========================================================================
   UJI LANJUT ANOVA (post hoc) - Tukey HSD, Bonferroni, Dunnett (vs kontrol), BNT/LSD (ANOVA)
   Hitungan: anova-core.js (postHoc, dunnett, letters). Halaman otomatis: #view-uji-lanjut
   ========================================================================= */
(function () {
  'use strict';
  const AX = window.StatAnovaX, U = window.StatBasicUI, D = window.StatDist;
  if (!AX || !U || !D || !U.mountPage) return;
  const { esc, fmt, fmtP, pct } = U;
  const MN = { tukey: 'Tukey HSD (Tukey-Kramer)', bonferroni: 'Bonferroni', dunnett: 'Dunnett (terhadap kontrol)', lsd: 'BNT / Fisher LSD (tanpa penyesuaian)' };
  const ui = U.mountPage({
    id: 'uji-lanjut', pre: 'ph', title: 'Uji Lanjut ANOVA', eyebrow: 'Metode Statistik &rsaquo; ANOVA', step1: 'Atur uji &amp; masukkan data',
    lede: 'Setelah ANOVA satu arah menyatakan ada perbedaan, uji lanjut (post hoc) menunjukkan kelompok mana yang berbeda: Tukey HSD untuk semua pasangan, Bonferroni, Dunnett untuk membandingkan semua kelompok dengan satu kelompok kontrol, atau BNT (LSD). Dilengkapi selang kepercayaan simultan dan huruf notasi.',
    settings: `
      <label>Metode uji lanjut<select id="phMethod" class="select-input"><option value="tukey">Tukey HSD (semua pasangan)</option><option value="bonferroni">Bonferroni (semua pasangan)</option><option value="dunnett">Dunnett (vs kontrol)</option><option value="lsd">BNT / Fisher LSD (tanpa penyesuaian)</option></select></label>
      <label id="phCtrlWrap" hidden>Kelompok kontrol (nomor kolom)<input type="text" id="phCtrl" class="plain-input" inputmode="numeric" value="1" autocomplete="off"></label>
      <label>Tingkat signifikansi (α)<select id="phAlpha" class="select-input"><option value="0.10">0,10 (CI 90%)</option><option value="0.05" selected>0,05 (CI 95%)</option><option value="0.01">0,01 (CI 99%)</option></select></label>`,
    hint: 'Setiap kolom adalah satu kelompok (panjang kolom boleh berbeda). Minimal 2 kelompok, <strong><span id="phMin">2</span> data</strong> per kelompok; sel kosong diabaikan.',
    table: { names: ['Kelompok 1', 'Kelompok 2', 'Kelompok 3'], colLabel: 'Kelompok', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Uji Lanjut',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  q('phMethod').addEventListener('change', () => { q('phCtrlWrap').hidden = q('phMethod').value !== 'dunnett'; });
  ui.onSample = () => tbl.fill(['Kontrol', 'Dosis A', 'Dosis B', 'Dosis C'], [[12.1, 13.4, 11.8, 12.9, 13.0, 12.4], [14.2, 15.1, 13.8, 14.9, 15.5, 14.4], [16.8, 17.5, 16.1, 17.9, 16.4, 17.2], [12.7, 13.1, 12.2, 13.6, 12.9, 13.3]]);
  ui.onCalc = () => {
    const method = q('phMethod').value, alpha = parseFloat(q('phAlpha').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const idx = []; cols.forEach((c, j) => { if (c.some((v) => v !== null)) idx.push(j); });
    const nm = idx.map((j) => tbl.name(j)), groups = idx.map((j) => cols[j].filter((v) => v !== null)), k = groups.length;
    if (k < 2) return ui.err('Isi minimal dua kelompok dengan data.');
    const sm = groups.findIndex((g) => g.length < 2); if (sm >= 0) return ui.err('Setiap kelompok membutuhkan minimal 2 data (' + nm[sm] + ' hanya ' + groups[sm].length + ').');
    let ctrl = 0;
    if (method === 'dunnett') { const cn = parseInt(q('phCtrl').value, 10); if (!(cn >= 1)) return ui.err('Nomor kolom kontrol harus bilangan bulat ≥ 1.'); ctrl = idx.indexOf(cn - 1); if (ctrl < 0) return ui.err('Kolom ' + cn + ' kosong atau tidak ada; pilih kolom kontrol yang berisi data.'); }
    const A = AX.oneWay(groups); if (!(A.msw > 0) || A.dfw < 1) return ui.err('Ragam galat bernilai 0 atau derajat bebas galat tidak cukup; uji lanjut tidak dapat dihitung.');
    const r = AX.postHoc(groups, method, alpha, { control: ctrl }), isD = method === 'dunnett', tw = method === 'tukey';
    const sigM = {}; if (!isD) r.rows.forEach((x) => { sigM[x.i + ',' + x.j] = sigM[x.j + ',' + x.i] = x.sig; });
    const lt = isD ? null : AX.letters(A.means, (a, b) => !!sigM[a + ',' + b]);
    const lab = (x) => `${esc(nm[x.i])} − ${esc(nm[x.j])}`;
    let sum = `<table class="result-table bs-res"><caption>ANOVA satu arah (ringkas)</caption><thead><tr><th class="lbl">Sumber</th><th>db</th><th>JK</th><th>KT</th><th>F</th><th>p-value</th></tr></thead><tbody>
      <tr><td class="lbl">Antar kelompok</td><td>${A.dfb}</td><td>${fmt(A.ssb)}</td><td>${fmt(A.msb)}</td><td>${fmt(A.F)}</td><td class="${A.p < alpha ? 'sig' : ''}">${fmtP(A.p)}</td></tr>
      <tr><td class="lbl">Galat (dalam kelompok)</td><td>${A.dfw}</td><td>${fmt(A.ssw)}</td><td>${fmt(A.msw)}</td><td></td><td></td></tr><tr><td class="lbl">Total</td><td>${A.dft}</td><td>${fmt(A.sst)}</td><td></td><td></td><td></td></tr></tbody></table>`;
    sum += `<table class="result-table bs-res"><caption>Statistik kelompok</caption><thead><tr><th class="lbl">Kelompok</th><th>n</th><th>Rata-rata</th><th>Simpangan baku</th>${isD ? '' : '<th>Huruf</th>'}</tr></thead><tbody>` +
      groups.map((g, i) => `<tr><td class="lbl">${esc(nm[i])}${isD && i === ctrl ? ' (kontrol)' : ''}</td><td>${g.length}</td><td>${fmt(A.means[i])}</td><td>${fmt(Math.sqrt(groups[i].reduce((s, v) => s + (v - A.means[i]) ** 2, 0) / (g.length - 1)))}</td>${isD ? '' : `<td><strong>${lt[i]}</strong></td>`}</tr>`).join('') + '</tbody></table>';
    sum += `<table class="result-table bs-res"><caption>Perbandingan berpasangan: ${MN[method]} (α = ${fmt(alpha, 2)})</caption><thead><tr><th class="lbl">Perbandingan</th><th>Selisih</th><th>SE</th><th>${tw ? 'q' : 't'}</th><th>p-value${method === 'lsd' ? '' : ' (disesuaikan)'}</th><th>CI ${pct(1 - alpha)}${method === 'lsd' ? '' : ' simultan'}</th><th>Keputusan</th></tr></thead><tbody>` +
      r.rows.map((x) => `<tr><td class="lbl">${lab(x)}</td><td>${fmt(x.diff)}</td><td>${fmt(x.se)}</td><td>${fmt(x.stat, 3)}</td><td class="${x.sig ? 'sig' : ''}">${fmtP(x.p)}</td><td>[${fmt(x.lo)} ; ${fmt(x.hi)}]</td><td><span class="bs-dec ${x.sig ? 'rej' : 'keep'}">${x.sig ? 'Berbeda nyata' : 'Tidak berbeda'}</span></td></tr>`).join('') + '</tbody></table>';
    sum += `<p class="bs-note">${A.p >= alpha && method !== 'dunnett' ? '<strong>Perhatian:</strong> ANOVA keseluruhan tidak signifikan; uji lanjut biasanya tidak dilakukan, atau hasilnya perlu ditafsirkan sangat hati-hati. ' : ''}Nilai kritis ${method === 'tukey' ? 'q = ' + fmt(r.crit, 4) + ' (rentang terstudentisasi, k = ' + k + ', db galat = ' + r.nu + ')' : method === 'dunnett' ? 'Dunnett d = ' + fmt(r.crit, 4) + ' (db galat = ' + r.nu + ')' : method === 'bonferroni' ? 't = ' + fmt(r.crit, 4) + ' (α/' + r.m + ' per perbandingan, db galat = ' + r.nu + ')' : 't = ' + fmt(r.crit, 4) + ' (db galat = ' + r.nu + ')'}. ${isD ? 'Selisih dihitung sebagai (kelompok) − (kontrol).' : 'Kelompok yang berbagi huruf sama tidak berbeda nyata.'} ${(tw && new Set(A.ns).size > 1) ? 'Ukuran kelompok tidak sama: dipakai koreksi Tukey-Kramer.' : ''}</p>`;
    const f0 = r.rows[0], st = [{ t: 'ANOVA satu arah', f: `KT galat (MSE) = ${fmt(A.msw, 5)},  db galat = ${A.dfw}\nF = ${fmt(A.F)},  p-value = ${fmtP(A.p)}`, n: 'KT galat gabungan dipakai untuk semua perbandingan.' }];
    const v0 = A.msw * (1 / A.ns[f0.i] + 1 / A.ns[f0.j]);
    if (method === 'tukey') st.push({ t: 'Tukey HSD', f: `q = |x̄ᵢ − x̄ⱼ| / √[(MSE/2)(1/nᵢ + 1/nⱼ)]\nContoh (${nm[f0.i]} vs ${nm[f0.j]}): q = ${fmt(Math.abs(f0.diff), 4)} / √(${fmt(v0 / 2, 5)}) = ${fmt(f0.stat, 4)}\np-value = P(Q ≥ q) dari distribusi rentang terstudentisasi (k = ${k}, db = ${A.dfw}) = ${fmtP(f0.p)}\nq kritis (α = ${fmt(alpha, 2)}) = ${fmt(r.crit, 4)}\nCI: selisih ± q kritis × √[(MSE/2)(1/nᵢ + 1/nⱼ)]`, n: 'Mengendalikan peluang galat tipe I untuk seluruh pasangan sekaligus.' });
    if (method === 'bonferroni') st.push({ t: 'Bonferroni', f: `m = k(k − 1)/2 = ${r.m} perbandingan\nt = (x̄ᵢ − x̄ⱼ) / √[MSE(1/nᵢ + 1/nⱼ)]\nContoh (${nm[f0.i]} vs ${nm[f0.j]}): t = ${fmt(f0.diff, 4)} / ${fmt(Math.sqrt(v0), 4)} = ${fmt(f0.stat, 4)}\np disesuaikan = min(1, m × p mentah) = ${fmtP(f0.p)}\nt kritis (α/m = ${fmt(alpha / r.m, 4)} per uji) = ${fmt(r.crit, 4)}`, n: 'Sederhana dan aman, tetapi konservatif bila perbandingan banyak.' });
    if (method === 'lsd') st.push({ t: 'BNT / Fisher LSD', f: `t = (x̄ᵢ − x̄ⱼ) / √[MSE(1/nᵢ + 1/nⱼ)]\nContoh (${nm[f0.i]} vs ${nm[f0.j]}): t = ${fmt(f0.stat, 4)}, p = ${fmtP(f0.p)}\nBNT = t(α/2; ${A.dfw}) × √[MSE(1/nᵢ + 1/nⱼ)] = ${fmt(r.crit, 4)} × ${fmt(Math.sqrt(v0), 4)} = ${fmt(r.crit * Math.sqrt(v0), 4)}`, n: 'Tanpa penyesuaian: peluang galat tipe I membengkak bila perbandingan banyak. Pakai hanya setelah F ANOVA signifikan.' });
    if (method === 'dunnett') st.push({ t: 'Dunnett', f: `t = (x̄ᵢ − x̄kontrol) / √[MSE(1/nᵢ + 1/nkontrol)]\nContoh (${nm[f0.i]} vs ${nm[ctrl]}): t = ${fmt(f0.diff, 4)} / ${fmt(f0.se, 4)} = ${fmt(f0.stat, 4)}\np disesuaikan dari distribusi t-multivariat (korelasi akibat kontrol bersama) = ${fmtP(f0.p)}\nNilai kritis Dunnett d (α = ${fmt(alpha, 2)}, ${r.m} perbandingan, db = ${A.dfw}) = ${fmt(r.crit, 4)}\nCI: selisih ± d × SE`, n: 'Lebih kuat daripada Tukey/Bonferroni bila hanya membandingkan dengan kontrol.' });
    st.push({ t: 'Keputusan', f: r.rows.map((x) => `${nm[x.i]} − ${nm[x.j]}: p = ${fmtP(x.p)} → ${x.sig ? 'berbeda nyata' : 'tidak berbeda'}`).join('\n'), n: '' });
    const sg = r.rows.filter((x) => x.sig), ip = [`<strong>ANOVA:</strong> F = ${fmt(A.F)}, p = ${fmtP(A.p)} → ${A.p < alpha ? 'terdapat perbedaan rata-rata antar kelompok' : 'tidak ada bukti perbedaan rata-rata antar kelompok'}.`,
      `<strong>${MN[method]}</strong> pada α = ${fmt(alpha, 2)}: ${sg.length ? `${sg.length} dari ${r.rows.length} perbandingan berbeda nyata: ` + sg.map((x) => `${esc(nm[x.i])} vs ${esc(nm[x.j])} (selisih ${fmt(x.diff, 3)}, p = ${fmtP(x.p)})`).join('; ') + '.' : `tidak ada dari ${r.rows.length} perbandingan yang berbeda nyata.`}`];
    if (lt) ip.push('Huruf notasi: ' + nm.map((n, i) => `${esc(n)} (${fmt(A.means[i], 2)}) = <strong>${lt[i]}</strong>`).join(', ') + '. Kelompok yang diikuti huruf sama tidak berbeda nyata.');
    if (isD) ip.push(`Kelompok dibandingkan dengan kontrol <strong>${esc(nm[ctrl])}</strong> (rata-rata ${fmt(A.means[ctrl], 3)}); selisih positif berarti kelompok lebih besar daripada kontrol.`);
    ip.push('<strong>Asumsi:</strong> galat berdistribusi normal, ragam antar kelompok sama (periksa dengan Uji Kesamaan Ragam), dan pengamatan saling bebas.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${MN[method]}</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Uji lanjut ANOVA: ' + MN[method]], ['Jumlah kelompok', k], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm, groups) });
  };
})();
