/* =========================================================================
   UJI KESAMAAN RAGAM - uji F (2 kelompok), Levene / Brown-Forsythe, Bartlett (2-12 kelompok) (Basic Statistics)
   Hitungan: basic-core.js (fTest, levene, bartlett). Halaman otomatis: #view-ragam
   ========================================================================= */
(function () {
  'use strict';
  const B = window.StatBasic, U = window.StatBasicUI, D = window.StatDist;
  if (!B || !U || !D || !U.mountPage) return;
  const { esc, fmt, fmtP, pct } = U;
  const ui = U.mountPage({
    id: 'ragam', pre: 'rg', title: 'Uji Kesamaan Ragam', step1: 'Atur uji &amp; masukkan data',
    lede: 'Periksa apakah ragam (variansi) beberapa kelompok sama sebelum memakai uji t atau ANOVA: uji F untuk dua kelompok, uji Levene (tahan terhadap data tidak normal), dan uji Bartlett (untuk data normal). Menerima 2 sampai 12 kelompok.',
    settings: `
      <label>Pusat uji Levene<select id="rgCenter" class="select-input"><option value="median">Median (Brown-Forsythe, disarankan)</option><option value="mean">Rata-rata (Levene klasik)</option></select></label>
      <label>Tingkat signifikansi (α)<select id="rgAlpha" class="select-input"><option value="0.10">0,10 (CI 90%)</option><option value="0.05" selected>0,05 (CI 95%)</option><option value="0.01">0,01 (CI 99%)</option></select></label>`,
    hint: 'Setiap kolom adalah satu kelompok (panjang kolom boleh berbeda). Minimal 2 kelompok dengan <strong><span id="rgMin">2</span> data</strong> per kelompok; sel kosong diabaikan.',
    table: { names: ['Kelompok 1', 'Kelompok 2'], colLabel: 'Kelompok', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Uji Ragam',
  });
  const tbl = ui.tbl, q = ui.q;
  tbl.register();
  ui.onSample = () => tbl.fill(['Kelompok A', 'Kelompok B', 'Kelompok C'], [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91], [65, 70, 82, 60, 75, 88, 55, 72, 70, 84], [70, 71, 69, 72, 70, 68, 73, 71, 70, 69]]);

  ui.onCalc = () => {
    const alpha = parseFloat(q('rgAlpha').value), center = q('rgCenter').value;
    const { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const idx = []; cols.forEach((c, j) => { if (c.some((v) => v !== null)) idx.push(j); });
    const names = idx.map((j) => tbl.name(j)), groups = idx.map((j) => cols[j].filter((v) => v !== null));
    if (groups.length < 2) return ui.err('Isi minimal dua kelompok dengan data.');
    const small = groups.findIndex((g) => g.length < 2);
    if (small >= 0) return ui.err('Setiap kelompok membutuhkan minimal 2 data (' + names[small] + ' hanya ' + groups[small].length + ').');
    const k = groups.length, vs = groups.map((g) => B.variance(g)), allZero = vs.every((v) => v === 0), anyZero = vs.some((v) => v === 0);
    if (allZero) return ui.err('Semua kelompok tidak bervariasi (ragam = 0), uji tidak dapat dihitung.');
    const lev = B.levene(groups, center), bar = anyZero ? null : B.bartlett(groups), f = k === 2 && !anyZero ? B.fTest(groups[0], groups[1], alpha) : null;
    const dec = (p) => `<span class="bs-dec ${p < alpha ? 'rej' : 'keep'}">${p < alpha ? 'Ragam berbeda' : 'Ragam dapat dianggap sama'}</span>`;
    /* ringkasan */
    let sum = '<table class="result-table bs-res"><caption>Statistik tiap kelompok</caption><thead><tr><th class="lbl">Kelompok</th><th>n</th><th>Rata-rata</th><th>Median</th><th>Simpangan baku</th><th>Ragam</th></tr></thead><tbody>' +
      groups.map((g, i) => `<tr><td class="lbl">${esc(names[i])}</td><td>${g.length}</td><td>${fmt(B.mean(g))}</td><td>${fmt(B.median(g))}</td><td>${fmt(Math.sqrt(vs[i]))}</td><td>${fmt(vs[i])}</td></tr>`).join('') + '</tbody></table>';
    sum += '<table class="result-table bs-res"><caption>Hasil uji (H₀: semua ragam sama; H₁: setidaknya satu ragam berbeda)</caption><thead><tr><th class="lbl">Uji</th><th>Statistik</th><th>df</th><th>p-value</th><th>Keputusan</th></tr></thead><tbody>';
    if (f) sum += `<tr><td class="lbl">Uji F (σ₁² / σ₂²)</td><td>F = ${fmt(f.F)}</td><td>${f.d1}; ${f.d2}</td><td class="${f.p < alpha ? 'sig' : ''}">${fmtP(f.p)}</td><td>${dec(f.p)}</td></tr>`;
    sum += `<tr><td class="lbl">Levene (${center === 'median' ? 'median' : 'rata-rata'})</td><td>W = ${fmt(lev.W)}</td><td>${lev.d1}; ${lev.d2}</td><td class="${lev.p < alpha ? 'sig' : ''}">${fmtP(lev.p)}</td><td>${dec(lev.p)}</td></tr>`;
    sum += bar ? `<tr><td class="lbl">Bartlett</td><td>T = ${fmt(bar.T)}</td><td>${bar.df}</td><td class="${bar.p < alpha ? 'sig' : ''}">${fmtP(bar.p)}</td><td>${dec(bar.p)}</td></tr>` : '<tr><td class="lbl">Bartlett</td><td colspan="4">Tidak dihitung: ada kelompok dengan ragam 0.</td></tr>';
    sum += '</tbody></table>';
    if (f) sum += `<table class="result-table bs-res"><caption>Selang kepercayaan ${pct(1 - alpha)} untuk rasio</caption><tbody><tr><td class="lbl">Rasio ragam σ₁² / σ₂²</td><td>[${fmt(f.ciVar[0])} ; ${fmt(f.ciVar[1])}]</td></tr><tr><td class="lbl">Rasio simpangan baku σ₁ / σ₂</td><td>[${fmt(f.ciSd[0])} ; ${fmt(f.ciSd[1])}]</td></tr></tbody></table>`;
    sum += '<p class="bs-note">Uji F dan Bartlett sensitif terhadap data yang tidak normal; Levene (terutama dengan median) lebih tahan sehingga lebih aman bila normalitas diragukan. p-value Levene dari distribusi F, Bartlett dari chi-square. Uji F dua sisi: p = 2·min(P(F ≤ f), P(F ≥ f)).</p>';
    /* langkah */
    const st = [];
    if (f) st.push({ t: 'Uji F (dua kelompok)', f: `F = s₁² / s₂² = ${fmt(f.v1)} / ${fmt(f.v2)} = ${fmt(f.F)}\ndf = (${f.d1}; ${f.d2})\np-value (dua sisi) = 2 × min(P(F ≤ ${fmt(f.F, 3)}), P(F ≥ ${fmt(f.F, 3)})) = ${fmtP(f.p)}\nCI rasio = [F / F(1−α/2), F / F(α/2)] = [${fmt(f.ciVar[0])} ; ${fmt(f.ciVar[1])}]`, n: 'Uji F mensyaratkan kedua kelompok berdistribusi normal.' });
    st.push({ t: `Uji Levene (${center === 'median' ? 'median' : 'rata-rata'})`, f: `Zᵢⱼ = |xᵢⱼ − ${center === 'median' ? 'median' : 'rata-rata'}ᵢ|  (selisih mutlak terhadap pusat kelompok)\nZ̄ᵢ = ${lev.zb.map((v) => fmt(v, 3)).join(', ')};  Z̄ = ${fmt(lev.zall, 3)}\nW = [(N − k)/(k − 1)] · Σnᵢ(Z̄ᵢ − Z̄)² / ΣΣ(Zᵢⱼ − Z̄ᵢ)²\n  = [(${lev.N} − ${k})/(${k} − 1)] × ${fmt(lev.num, 4)} / ${fmt(lev.den, 4)} = ${fmt(lev.W)}\ndf = (${lev.d1}; ${lev.d2}),  p-value = ${fmtP(lev.p)}`, n: 'Levene sama dengan ANOVA satu arah pada selisih mutlak Zᵢⱼ.' });
    if (bar) st.push({ t: 'Uji Bartlett', f: `sp² = Σ(nᵢ − 1)sᵢ² / (N − k) = ${fmt(bar.sp2)}\nT = [(N − k)ln sp² − Σ(nᵢ − 1)ln sᵢ²] / c\nc = 1 + [Σ1/(nᵢ − 1) − 1/(N − k)] / [3(k − 1)] = ${fmt(bar.c, 4)}\nT = ${fmt(bar.T)},  df = k − 1 = ${bar.df}\np-value = ${fmtP(bar.p)}`, n: 'Statistik T dibandingkan dengan distribusi chi-square dengan k − 1 derajat bebas.' });
    st.push({ t: 'Keputusan', f: (f ? `Uji F: p = ${fmtP(f.p)} → ${f.p < alpha ? 'tolak' : 'gagal menolak'} H₀\n` : '') + `Levene: p = ${fmtP(lev.p)} → ${lev.p < alpha ? 'tolak' : 'gagal menolak'} H₀` + (bar ? `\nBartlett: p = ${fmtP(bar.p)} → ${bar.p < alpha ? 'tolak' : 'gagal menolak'} H₀` : '') + `\n(α = ${fmt(alpha, 2)})`, n: '' });
    /* interpretasi */
    const diff = lev.p < alpha, ip = [];
    ip.push(`<strong>Keputusan utama (Levene):</strong> p-value = <strong>${fmtP(lev.p)}</strong> ${diff ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${diff ? 'ditolak' : 'tidak ditolak'}</strong>. ${diff ? 'Terdapat bukti yang cukup bahwa ragam antar kelompok tidak sama.' : 'Belum terdapat bukti yang cukup bahwa ragam antar kelompok berbeda; asumsi ragam sama dapat diterima.'}`);
    if (f) ip.push(`Rasio ragam sampel ${esc(names[0])} / ${esc(names[1])} = ${fmt(f.F)} (rasio simpangan baku ${fmt(Math.sqrt(f.F))}). Dengan keyakinan ${pct(1 - alpha)}, rasio ragam populasi berada pada [${fmt(f.ciVar[0])} ; ${fmt(f.ciVar[1])}]${f.ciVar[0] <= 1 && f.ciVar[1] >= 1 ? ', memuat 1 (ragam sama).' : ', tidak memuat 1 (ragam berbeda).'}`);
    if (bar && (bar.p < alpha) !== diff) ip.push('Uji Levene dan Bartlett memberi keputusan berbeda. Bartlett sangat peka terhadap penyimpangan dari normal; bila data tidak normal, percayai Levene.');
    ip.push(`<strong>Tindak lanjut:</strong> ${diff ? (k === 2 ? 'gunakan Uji t <em>Welch</em> (ragam tidak sama) atau uji nonparametrik.' : 'gunakan ANOVA Welch atau transformasi data; ANOVA klasik kurang tepat.') : (k === 2 ? 'Uji t dengan ragam gabungan dapat dipakai (Welch tetap aman).' : 'ANOVA klasik dapat dipakai (asumsi homogenitas ragam terpenuhi).')}`);
    ip.push(`<strong>Catatan:</strong> pada sampel kecil uji ragam memiliki daya rendah (ragam bisa berbeda tetapi tidak terdeteksi); pada sampel besar perbedaan kecil pun bisa signifikan. Periksa juga boxplot tiap kelompok.`);
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Uji kesamaan ragam (${k} kelompok)</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Uji kesamaan ragam'], ['Jumlah kelompok', k], ['Pusat Levene', center === 'median' ? 'median' : 'rata-rata'], ['α', fmt(alpha, 2)]], data: ui.dataExport(names, groups) });
  };
})();
