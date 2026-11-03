/* =========================================================================
   ANOVA PENGUKURAN BERULANG (satu faktor dalam-subjek) - uji sphericity Mauchly, koreksi Greenhouse-Geisser & Huynh-Feldt (ANOVA)
   Baris = subjek, kolom = kondisi/waktu. Hitungan: anova-core.js (repeated). Halaman otomatis: #view-anova-berulang
   ========================================================================= */
(function () {
  'use strict';
  const AX = window.StatAnovaX, U = window.StatBasicUI, D = window.StatDist;
  if (!AX || !U || !D || !U.mountPage) return;
  const { esc, fmt, fmtP, pct } = U;
  const ui = U.mountPage({
    id: 'anova-berulang', pre: 'rm', title: 'ANOVA Pengukuran Berulang', eyebrow: 'Metode Statistik &rsaquo; ANOVA', step1: 'Atur uji &amp; masukkan data',
    lede: 'Bandingkan rata-rata beberapa kondisi atau waktu pengukuran pada subjek yang sama. Memisahkan variasi antar-subjek dari galat sehingga lebih peka daripada ANOVA biasa. Dilengkapi uji sphericity Mauchly, koreksi Greenhouse-Geisser dan Huynh-Feldt, ukuran efek (η²), serta uji lanjut berpasangan.',
    settings: `
      <label>Uji lanjut berpasangan<select id="rmPost" class="select-input"><option value="bonf">Uji t berpasangan + Bonferroni</option><option value="none">Tanpa uji lanjut</option></select></label>
      <label>Tingkat signifikansi (α)<select id="rmAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: 'Baris = subjek, kolom = kondisi / waktu (judul kolom dapat diubah). Setiap baris harus lengkap; minimal 2 kondisi dan <strong><span id="rmMin">3</span> subjek</strong>. Baris yang seluruhnya kosong diabaikan.',
    table: { names: ['Waktu 1', 'Waktu 2', 'Waktu 3'], colLabel: 'Waktu', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung ANOVA Berulang',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => { const M = [[45, 50, 55, 60], [42, 42, 45, 49], [36, 41, 43, 44], [39, 50, 51, 57], [51, 51, 61, 63], [44, 47, 55, 55], [41, 42, 47, 51], [38, 44, 46, 49], [43, 46, 50, 54], [47, 50, 56, 58]]; tbl.fill(['Minggu 0', 'Minggu 4', 'Minggu 8', 'Minggu 12'], [0, 1, 2, 3].map((j) => M.map((r) => r[j]))); };
  ui.onCalc = () => {
    const alpha = parseFloat(q('rmAlpha').value), post = q('rmPost').value, { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const nm = tbl.names.map((_, j) => tbl.name(j)), k = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), M = [];
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) return ui.err('Baris ' + (i + 1) + ' belum lengkap. Setiap subjek harus memiliki nilai pada semua kondisi.'); M.push(r); }
    if (k < 2) return ui.err('Dibutuhkan minimal 2 kondisi (kolom).'); if (M.length < 3) return ui.err('Dibutuhkan minimal 3 subjek (baris lengkap).');
    const R = AX.repeated(M); if (!(R.mse > 0)) return ui.err('KT galat bernilai 0 (pola antar kondisi identik pada semua subjek); uji F tidak dapat dihitung.');
    const n = R.n, pr = k > 2, rej = R.p < alpha, bestP = pr ? (R.pW < alpha ? R.pGG : R.p) : R.p;
    let sum = `<table class="result-table bs-res"><caption>Statistik tiap kondisi (n = ${n} subjek)</caption><thead><tr><th class="lbl">Kondisi</th><th>Rata-rata</th><th>Simpangan baku</th></tr></thead><tbody>` +
      nm.map((c, j) => { const v = M.map((r) => r[j]), m = R.cm[j]; return `<tr><td class="lbl">${esc(c)}</td><td>${fmt(m)}</td><td>${fmt(Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)))}</td></tr>`; }).join('') + '</tbody></table>';
    sum += `<table class="result-table bs-res"><caption>Tabel ANOVA pengukuran berulang</caption><thead><tr><th class="lbl">Sumber</th><th>db</th><th>JK</th><th>KT</th><th>F</th><th>p-value</th></tr></thead><tbody>
      <tr><td class="lbl">Kondisi (dalam-subjek)</td><td>${R.dfc}</td><td>${fmt(R.ssc)}</td><td>${fmt(R.msc)}</td><td>${fmt(R.F)}</td><td class="${rej ? 'sig' : ''}">${fmtP(R.p)}</td></tr>
      <tr><td class="lbl">Subjek</td><td>${R.dfs}</td><td>${fmt(R.sss)}</td><td>${fmt(R.sss / R.dfs)}</td><td></td><td></td></tr><tr><td class="lbl">Galat (kondisi × subjek)</td><td>${R.dfe}</td><td>${fmt(R.sse)}</td><td>${fmt(R.mse)}</td><td></td><td></td></tr><tr><td class="lbl">Total</td><td>${R.N - 1}</td><td>${fmt(R.sst)}</td><td></td><td></td><td></td></tr></tbody></table>`;
    if (pr) sum += `<table class="result-table bs-res"><caption>Asumsi sphericity &amp; koreksi derajat bebas</caption><thead><tr><th class="lbl">Koreksi</th><th>ε</th><th>df₁; df₂</th><th>p-value</th></tr></thead><tbody>
      <tr><td class="lbl">Tanpa koreksi (sphericity dianggap terpenuhi)</td><td>1</td><td>${R.dfc}; ${R.dfe}</td><td class="${R.p < alpha ? 'sig' : ''}">${fmtP(R.p)}</td></tr>
      <tr><td class="lbl">Greenhouse-Geisser</td><td>${fmt(R.epsGG, 4)}</td><td>${fmt(R.dfc * R.epsGG, 3)}; ${fmt(R.dfe * R.epsGG, 3)}</td><td class="${R.pGG < alpha ? 'sig' : ''}">${fmtP(R.pGG)}</td></tr>
      <tr><td class="lbl">Huynh-Feldt</td><td>${fmt(R.epsHF, 4)}</td><td>${fmt(R.dfc * R.epsHF, 3)}; ${fmt(R.dfe * R.epsHF, 3)}</td><td class="${R.pHF < alpha ? 'sig' : ''}">${fmtP(R.pHF)}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Uji sphericity Mauchly (H₀: ragam selisih semua pasangan kondisi sama)</caption><tbody><tr><td class="lbl">W Mauchly</td><td>${fmt(R.W, 4)}</td></tr><tr><td class="lbl">df</td><td>${R.dfW}</td></tr><tr><td class="lbl">p-value</td><td class="${R.pW < alpha ? 'sig' : ''}">${fmtP(R.pW)}</td></tr><tr><td class="lbl">Kesimpulan</td><td><span class="bs-dec ${R.pW < alpha ? 'rej' : 'keep'}">${R.pW < alpha ? 'Sphericity dilanggar' : 'Sphericity terpenuhi'}</span></td></tr></tbody></table>`;
    sum += `<table class="result-table bs-res"><caption>Ukuran efek</caption><tbody><tr><td class="lbl">η² parsial</td><td>${fmt(R.petasq, 3)}</td></tr><tr><td class="lbl">η² umum (generalized)</td><td>${fmt(R.getasq, 3)}</td></tr></tbody></table>`;
    let phRows = null;
    if (post === 'bonf' && k > 2) {
      const prs = AX.pairs(k), m = prs.length, tc = D.tCrit(n - 1, 1 - alpha / m);
      phRows = prs.map(([i, j]) => { const d = M.map((r) => r[i] - r[j]), md = d.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(d.reduce((s, v) => s + (v - md) ** 2, 0) / (n - 1)), se = sd / Math.sqrt(n), t = md / se, p = Math.min(1, m * D.tTwoP(t, n - 1)); return { i, j, md, se, t, p, lo: md - tc * se, hi: md + tc * se }; });
      sum += `<table class="result-table bs-res"><caption>Uji lanjut: t berpasangan dengan koreksi Bonferroni (${m} perbandingan)</caption><thead><tr><th class="lbl">Perbandingan</th><th>Selisih</th><th>SE</th><th>t (df = ${n - 1})</th><th>p disesuaikan</th><th>CI ${pct(1 - alpha)}</th><th>Keputusan</th></tr></thead><tbody>` +
        phRows.map((x) => `<tr><td class="lbl">${esc(nm[x.i])} − ${esc(nm[x.j])}</td><td>${fmt(x.md)}</td><td>${fmt(x.se)}</td><td>${fmt(x.t, 3)}</td><td class="${x.p < alpha ? 'sig' : ''}">${fmtP(x.p)}</td><td>[${fmt(x.lo)} ; ${fmt(x.hi)}]</td><td><span class="bs-dec ${x.p < alpha ? 'rej' : 'keep'}">${x.p < alpha ? 'Berbeda nyata' : 'Tidak berbeda'}</span></td></tr>`).join('') + '</tbody></table>';
    }
    const st = [{ t: 'Hipotesis', f: `H₀: rata-rata semua ${k} kondisi sama\nH₁: setidaknya satu kondisi berbeda\nα = ${fmt(alpha, 2)}`, n: '' },
      { t: 'Jumlah kuadrat', f: `n = ${n} subjek, k = ${k} kondisi, rata-rata umum = ${fmt(R.grand)}\nJK Kondisi = n Σ(x̄ⱼ − x̄)² = ${fmt(R.ssc)}\nJK Subjek = k Σ(x̄ᵢ − x̄)² = ${fmt(R.sss)}\nJK Total = ${fmt(R.sst)}\nJK Galat = JK Total − JK Kondisi − JK Subjek = ${fmt(R.sse)}`, n: 'Variasi antar-subjek dikeluarkan dari galat, itulah keunggulan rancangan berulang.' },
      { t: 'Statistik F', f: `db kondisi = k − 1 = ${R.dfc};  db galat = (n − 1)(k − 1) = ${R.dfe}\nKT Kondisi = ${fmt(R.msc)};  KT Galat = ${fmt(R.mse)}\nF = ${fmt(R.msc)} / ${fmt(R.mse)} = ${fmt(R.F)},  p-value = ${fmtP(R.p)}`, n: '' }];
    if (pr) st.push({ t: 'Sphericity & koreksi', f: `Matriks kovarians kondisi S (${k}×${k}) dipusatkan ganda → nilai eigen λ₁…λ${k - 1}\nW Mauchly = Πλ / (Σλ/(k − 1))^(k − 1) = ${fmt(R.W, 4)},  p = ${fmtP(R.pW)}\nε Greenhouse-Geisser = (Σλ)² / [(k − 1) Σλ²] = ${fmt(R.epsGG, 4)}\nε Huynh-Feldt = [n(k − 1)ε − 2] / [(k − 1)(n − 1 − (k − 1)ε)] = ${fmt(R.epsHF, 4)}\nF dibandingkan dengan df terkoreksi: (ε·${R.dfc}; ε·${R.dfe})\np GG = ${fmtP(R.pGG)};  p HF = ${fmtP(R.pHF)}`, n: 'ε = 1 berarti sphericity sempurna; makin kecil ε makin parah pelanggarannya.' });
    st.push({ t: 'Ukuran efek', f: `η² parsial = JK Kondisi / (JK Kondisi + JK Galat) = ${fmt(R.petasq, 4)}\nη² umum = JK Kondisi / (JK Kondisi + JK Subjek + JK Galat) = ${fmt(R.getasq, 4)}`, n: '' });
    st.push({ t: 'Keputusan', f: `p yang dipakai = ${fmtP(bestP)} ${pr ? (R.pW < alpha ? '(Greenhouse-Geisser, karena sphericity dilanggar)' : '(tanpa koreksi, sphericity terpenuhi)') : ''}\n→ ${bestP < alpha ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' });
    const eff = R.petasq < 0.01 ? 'dapat diabaikan' : R.petasq < 0.06 ? 'kecil' : R.petasq < 0.14 ? 'sedang' : 'besar';
    const ip = [];
    if (pr) ip.push(`<strong>Sphericity:</strong> Mauchly W = ${fmt(R.W, 3)}, p = ${fmtP(R.pW)} → ${R.pW < alpha ? `sphericity <strong>dilanggar</strong>; gunakan hasil terkoreksi (Greenhouse-Geisser ε = ${fmt(R.epsGG, 3)}${R.epsGG > 0.75 ? ', atau Huynh-Feldt karena ε > 0,75' : ''}).` : 'sphericity terpenuhi; hasil tanpa koreksi dapat dipakai (Greenhouse-Geisser tetap aman sebagai pengecekan).'}`);
    ip.push(`<strong>Keputusan:</strong> F(${pr && R.pW < alpha ? fmt(R.dfc * R.epsGG, 2) + '; ' + fmt(R.dfe * R.epsGG, 2) : R.dfc + '; ' + R.dfe}) = ${fmt(R.F)}, p-value = <strong>${fmtP(bestP)}</strong> ${bestP < alpha ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${bestP < alpha ? 'ditolak' : 'tidak ditolak'}</strong>. ${bestP < alpha ? 'Rata-rata antar kondisi <strong>berbeda nyata</strong>.' : 'Belum terdapat bukti perbedaan rata-rata antar kondisi.'}`);
    ip.push(`Ukuran efek: η² parsial = ${fmt(R.petasq, 3)} (efek <strong>${eff}</strong>); ${fmt(R.petasq * 100, 1)}% variasi (di luar subjek) dijelaskan oleh kondisi.`);
    ip.push('Rata-rata: ' + nm.map((c, j) => `${esc(c)} = ${fmt(R.cm[j], 2)}`).join(', ') + '.');
    if (phRows) { const sg = phRows.filter((x) => x.p < alpha); ip.push(sg.length ? `Uji lanjut (Bonferroni): pasangan yang berbeda nyata: ${sg.map((x) => `${esc(nm[x.i])} vs ${esc(nm[x.j])} (selisih ${fmt(x.md, 2)}, p = ${fmtP(x.p)})`).join('; ')}.` : 'Uji lanjut (Bonferroni): tidak ada pasangan yang berbeda nyata.'); }
    if (n < 10) ip.push('<strong>Catatan:</strong> jumlah subjek sedikit, uji sphericity dan asumsi normalitas kurang andal.');
    ip.push('<strong>Asumsi:</strong> selisih antar kondisi mendekati normal, subjek saling bebas, dan sphericity (atau gunakan koreksi). Untuk data ordinal / sangat tidak normal, gunakan Uji Friedman.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>ANOVA pengukuran berulang</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'ANOVA pengukuran berulang'], ['Subjek', n], ['Kondisi', k], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm, nm.map((_, j) => M.map((r) => r[j]))) });
  };
})();
