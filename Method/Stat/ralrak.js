/* =========================================================================
   RAL & RAK - Rancangan Acak Lengkap dan Rancangan Acak Kelompok Lengkap (ANOVA)
   Tabel sidik ragam (db, JK, KT, F hitung, F tabel, p), koefisien keragaman, uji lanjut BNT / BNJ (Tukey) / Bonferroni dengan huruf notasi.
   Hitungan: anova-core.js (oneWay, rcbd, postHocMse, letters). Halaman otomatis: #view-ral-rak
   ========================================================================= */
(function () {
  'use strict';
  const AX = window.StatAnovaX, U = window.StatBasicUI, D = window.StatDist;
  if (!AX || !U || !D || !U.mountPage) return;
  const { esc, fmt, fmtP, pct } = U;
  const PN = { bnt: 'BNT (Beda Nyata Terkecil / LSD)', bnj: 'BNJ (Beda Nyata Jujur / Tukey)', bonferroni: 'Bonferroni' }, PM = { bnt: 'lsd', bnj: 'tukey', bonferroni: 'bonferroni' };
  const ui = U.mountPage({
    id: 'ral-rak', pre: 'rk', title: 'RAL & RAK', eyebrow: 'Metode Statistik &rsaquo; ANOVA', step1: 'Atur rancangan &amp; masukkan data',
    lede: 'Analisis sidik ragam untuk Rancangan Acak Lengkap (RAL: perlakuan diacak penuh, ulangan boleh tidak sama) dan Rancangan Acak Kelompok Lengkap (RAK: tiap kelompok/blok memuat semua perlakuan). Dilengkapi koefisien keragaman (KK), uji lanjut BNT/BNJ dengan huruf notasi, dan interpretasi.',
    settings: `
      <label>Rancangan<select id="rkMode" class="select-input"><option value="ral">RAL (Rancangan Acak Lengkap)</option><option value="rak">RAK (Rancangan Acak Kelompok)</option></select></label>
      <label>Uji lanjut<select id="rkPost" class="select-input"><option value="bnj">BNJ / Tukey</option><option value="bnt">BNT / LSD</option><option value="bonferroni">Bonferroni</option><option value="none">Tanpa uji lanjut</option></select></label>
      <label>Taraf nyata (α)<select id="rkAlpha" class="select-input"><option value="0.10">0,10 (10%)</option><option value="0.05" selected>0,05 (5%)</option><option value="0.01">0,01 (1%)</option></select></label>`,
    hint: '<span id="rkHintLead">Kolom = perlakuan, baris = ulangan (jumlah ulangan boleh berbeda).</span> Minimal 2 perlakuan dan <strong><span id="rkMin">2</span> data</strong> per perlakuan; sel kosong diabaikan.',
    table: { names: ['Perlakuan 1', 'Perlakuan 2', 'Perlakuan 3'], colLabel: 'Perlakuan', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Sidik Ragam',
  });
  const q = ui.q, tbl = ui.tbl, mode = () => q('rkMode').value; tbl.register();
  q('rkMode').addEventListener('change', () => { q('rkHintLead').textContent = mode() === 'ral' ? 'Kolom = perlakuan, baris = ulangan (jumlah ulangan boleh berbeda).' : 'Kolom = perlakuan, baris = kelompok/blok. Setiap baris harus lengkap (semua perlakuan terisi).'; ui.clearErr(); });
  ui.onSample = () => {
    if (mode() === 'ral') tbl.fill(['Pupuk A', 'Pupuk B', 'Pupuk C', 'Kontrol'], [[24.5, 26.1, 25.3, 27.0], [28.9, 30.2, 29.4, 31.1], [33.6, 32.4, 34.1, 33.0], [22.1, 23.4, 21.8, 22.9]]);
    else tbl.fill(['Varietas A', 'Varietas B', 'Varietas C', 'Varietas D'], [[5.2, 5.9, 5.5, 6.1], [6.4, 6.9, 6.6, 7.2], [7.1, 7.8, 7.3, 7.9], [5.0, 5.4, 5.1, 5.8]]);
  };
  const row = (a) => `<td>${a.join('</td><td>')}</td>`;
  ui.onCalc = () => {
    const m = mode(), post = q('rkPost').value, alpha = parseFloat(q('rkAlpha').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const idx = []; cols.forEach((c, j) => { if (c.some((v) => v !== null)) idx.push(j); });
    const nm = idx.map((j) => tbl.name(j)), t = idx.length; let A, means, ns, mse, dfe, tab, reps, blockRows = null;
    if (t < 2) return ui.err('Isi minimal dua perlakuan dengan data.');
    if (m === 'ral') {
      const groups = idx.map((j) => cols[j].filter((v) => v !== null)), sm = groups.findIndex((g) => g.length < 2);
      if (sm >= 0) return ui.err('Setiap perlakuan membutuhkan minimal 2 ulangan (' + nm[sm] + ' hanya ' + groups[sm].length + ').');
      A = AX.oneWay(groups); if (!(A.msw > 0)) return ui.err('KT galat bernilai 0 (semua ulangan identik dalam tiap perlakuan); analisis tidak dapat dihitung.');
      means = A.means; ns = A.ns; mse = A.msw; dfe = A.dfw; reps = new Set(ns).size === 1 ? ns[0] : null;
      const Fcrit = D.fQuant(1 - alpha, A.dfb, A.dfw);
      tab = { rows: [['Perlakuan', A.dfb, A.ssb, A.msb, A.F, Fcrit, A.p], ['Galat', A.dfw, A.ssw, A.msw], ['Total', A.dft, A.sst]], F: A.F, p: A.p, cv: A.cv, r2: A.r2, grand: A.grand, sst: A.sst, groups };
    } else {
      const nr = Math.max.apply(null, idx.map((j) => cols[j].length)), M = [];
      for (let i = 0; i < nr; i++) { const r = idx.map((j) => (cols[j][i] === undefined ? null : cols[j][i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) return ui.err('Baris ' + (i + 1) + ' belum lengkap. RAK membutuhkan nilai untuk semua perlakuan pada setiap kelompok.'); M.push(r); }
      if (M.length < 2) return ui.err('RAK membutuhkan minimal 2 kelompok (baris lengkap).');
      A = AX.rcbd(M); if (!(A.mse > 0)) return ui.err('KT galat bernilai 0; data cocok sempurna dengan model aditif sehingga uji F tidak dapat dihitung.');
      blockRows = M; means = A.trtM; ns = new Array(t).fill(A.b); mse = A.mse; dfe = A.dfe; reps = A.b;
      tab = { rows: [['Perlakuan', A.dft, A.sstr, A.mst, A.Ft, D.fQuant(1 - alpha, A.dft, A.dfe), A.pt], ['Kelompok', A.dfb, A.ssb, A.msb, A.Fb, D.fQuant(1 - alpha, A.dfb, A.dfe), A.pb], ['Galat', A.dfe, A.sse, A.mse], ['Total', A.dftot, A.sst]], F: A.Ft, p: A.pt, cv: A.cv, r2: A.r2, grand: A.grand, sst: A.sst };
    }
    const sig = tab.p < alpha; let ph = null, lt = null;
    if (post !== 'none') { ph = AX.postHocMse(means, ns, mse, dfe, PM[post], alpha); const sm = {}; ph.rows.forEach((x) => { sm[x.i + ',' + x.j] = sm[x.j + ',' + x.i] = x.sig; }); lt = AX.letters(means, (a, b) => !!sm[a + ',' + b]); }
    let sum = `<table class="result-table bs-res"><caption>Tabel sidik ragam (${m.toUpperCase()})</caption><thead><tr><th class="lbl">Sumber keragaman</th><th>db</th><th>JK</th><th>KT</th><th>F hitung</th><th>F tabel (${fmt(alpha, 2)})</th><th>p-value</th></tr></thead><tbody>` +
      tab.rows.map((r) => `<tr><td class="lbl">${r[0]}</td>${row([r[1], fmt(r[2]), r[3] === undefined ? '' : fmt(r[3]), r[4] === undefined ? '' : fmt(r[4]), r[5] === undefined ? '' : fmt(r[5]), r[6] === undefined ? '' : `<span class="${r[6] < alpha ? 'sig' : ''}">${fmtP(r[6])}</span>`])}</tr>`).join('') + `</tbody></table>
      <table class="result-table bs-res"><caption>Ukuran kecocokan</caption><tbody><tr><td class="lbl">Koefisien keragaman (KK)</td><td>${fmt(tab.cv, 2)}%</td></tr><tr><td class="lbl">Koefisien determinasi (R²)</td><td>${fmt(tab.r2, 4)}</td></tr><tr><td class="lbl">Rata-rata umum</td><td>${fmt(tab.grand)}</td></tr>${m === 'rak' ? `<tr><td class="lbl">Efisiensi relatif RAK terhadap RAL</td><td>${fmt(A.re, 3)}${A.re > 1 ? ' (pengelompokan efektif)' : ' (pengelompokan kurang bermanfaat)'}</td></tr>` : ''}</tbody></table>
      <table class="result-table bs-res"><caption>Rata-rata perlakuan${post !== 'none' ? ' dan huruf notasi (' + PN[post] + ', α = ' + fmt(alpha, 2) + ')' : ''}</caption><thead><tr><th class="lbl">Perlakuan</th><th>Ulangan</th><th>Rata-rata</th>${lt ? '<th>Huruf</th>' : ''}</tr></thead><tbody>` +
      nm.map((n, i) => `<tr><td class="lbl">${esc(n)}</td><td>${ns[i]}</td><td>${fmt(means[i])}</td>${lt ? `<td><strong>${lt[i]}</strong></td>` : ''}</tr>`).join('') + '</tbody></table>';
    if (ph) { const half = reps ? (post === 'bnt' ? ph.crit * Math.sqrt(2 * mse / reps) : post === 'bnj' ? ph.crit * Math.sqrt(mse / reps) : ph.crit * Math.sqrt(2 * mse / reps)) : null; sum += `<p class="bs-note">${post === 'bnt' ? 'BNT' : post === 'bnj' ? 'BNJ' : 'Nilai beda Bonferroni'}${half !== null ? ' = ' + fmt(half, 4) : ' (ulangan tidak sama; tiap pasangan dihitung terpisah dengan koreksi Tukey-Kramer / SE masing-masing)'}. Perlakuan yang diikuti huruf sama tidak berbeda nyata pada taraf ${pct(alpha)}.${!sig ? ' <strong>F perlakuan tidak nyata</strong>, sehingga uji lanjut umumnya tidak dilakukan.' : ''}</p>`; }
    const N = tab.groups ? A.N : A.N, st = [], FK = (tab.grand * N) ** 2 / N;
    st.push({ t: 'Hipotesis', f: `H₀: semua perlakuan berpengaruh sama (μ₁ = μ₂ = … = μ${t})\nH₁: setidaknya satu perlakuan berbeda\nα = ${fmt(alpha, 2)}`, n: '' });
    st.push({ t: 'Faktor koreksi & JK total', f: `FK = (ΣY)² / N = (${fmt(tab.grand * N)})² / ${N} = ${fmt(FK)}\nJK Total = ΣY² − FK = ${fmt(tab.sst)}`, n: `N = ${N} pengamatan, ${t} perlakuan${m === 'rak' ? `, ${A.b} kelompok` : ''}.` });
    if (m === 'ral') st.push({ t: 'JK perlakuan & galat', f: `JK Perlakuan = Σ(Yᵢ.²/rᵢ) − FK = ${fmt(A.ssb)}\nJK Galat = JK Total − JK Perlakuan = ${fmt(A.ssw)}\ndb: perlakuan = t − 1 = ${A.dfb}; galat = N − t = ${A.dfw}; total = N − 1 = ${A.dft}`, n: '' });
    else st.push({ t: 'JK perlakuan, kelompok & galat', f: `JK Perlakuan = Σ(Yᵢ.²)/b − FK = ${fmt(A.sstr)}\nJK Kelompok = Σ(Y.ⱼ²)/t − FK = ${fmt(A.ssb)}\nJK Galat = JK Total − JK Perlakuan − JK Kelompok = ${fmt(A.sse)}\ndb: perlakuan = ${A.dft}; kelompok = ${A.dfb}; galat = (t − 1)(b − 1) = ${A.dfe}`, n: '' });
    st.push({ t: 'Kuadrat tengah & F', f: m === 'ral' ? `KT Perlakuan = ${fmt(A.msb)};  KT Galat = ${fmt(A.msw)}\nF hitung = KT Perlakuan / KT Galat = ${fmt(A.F)}\nF tabel (α = ${fmt(alpha, 2)}; ${A.dfb}; ${A.dfw}) = ${fmt(tab.rows[0][5])}\np-value = ${fmtP(A.p)}` : `KT Perlakuan = ${fmt(A.mst)};  KT Kelompok = ${fmt(A.msb)};  KT Galat = ${fmt(A.mse)}\nF perlakuan = ${fmt(A.Ft)} (F tabel ${fmt(tab.rows[0][5])}, p = ${fmtP(A.pt)})\nF kelompok = ${fmt(A.Fb)} (F tabel ${fmt(tab.rows[1][5])}, p = ${fmtP(A.pb)})`, n: '' });
    st.push({ t: 'Koefisien keragaman', f: `KK = √KT Galat / rata-rata umum × 100% = √${fmt(mse)} / ${fmt(tab.grand)} × 100% = ${fmt(tab.cv, 2)}%`, n: 'KK menunjukkan ketelitian percobaan; makin kecil makin baik (nilai wajar bergantung bidang).' });
    if (ph) st.push({ t: 'Uji lanjut ' + PN[post], f: post === 'bnt' ? `BNT = t(α/2; db galat = ${dfe}) × √(2·KT Galat / r) = ${fmt(ph.crit, 4)} × √(2 × ${fmt(mse)} / ${reps || 'r'})` : post === 'bnj' ? `BNJ = q(α; t = ${t}, db galat = ${dfe}) × √(KT Galat / r) = ${fmt(ph.crit, 4)} × √(${fmt(mse)} / ${reps || 'r'})` : `t kritis (α/m = ${fmt(alpha / ph.m, 4)} per uji) = ${fmt(ph.crit, 4)}; p disesuaikan = m × p mentah`, n: 'Dua perlakuan dinyatakan berbeda nyata bila selisih rata-ratanya melebihi nilai pembeda.' });
    st.push({ t: 'Keputusan', f: m === 'ral' ? `F hitung ${A.F > tab.rows[0][5] ? '>' : '≤'} F tabel (${fmt(A.F)} ${A.F > tab.rows[0][5] ? '>' : '≤'} ${fmt(tab.rows[0][5])}), p = ${fmtP(A.p)}\n→ ${sig ? 'Tolak H₀ (perlakuan berpengaruh nyata)' : 'Gagal menolak H₀ (perlakuan tidak berpengaruh nyata)'}` : `Perlakuan: F = ${fmt(A.Ft)}, p = ${fmtP(A.pt)} → ${A.pt < alpha ? 'berpengaruh nyata' : 'tidak berpengaruh nyata'}\nKelompok: F = ${fmt(A.Fb)}, p = ${fmtP(A.pb)} → ${A.pb < alpha ? 'berpengaruh nyata' : 'tidak berpengaruh nyata'}`, n: '' });
    const best = means.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const ip = [`<strong>Perlakuan:</strong> F hitung = ${fmt(tab.F)}, p-value = <strong>${fmtP(tab.p)}</strong> ${sig ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${sig ? 'ditolak' : 'tidak ditolak'}</strong>. ${sig ? 'Terdapat pengaruh perlakuan yang nyata terhadap respon.' : 'Belum terdapat bukti pengaruh perlakuan yang nyata.'}`];
    if (m === 'rak') ip.push(`<strong>Kelompok:</strong> F = ${fmt(A.Fb)}, p = ${fmtP(A.pb)} → ${A.pb < alpha ? 'pengelompokan berpengaruh nyata (efisiensi relatif ' + fmt(A.re, 2) + ' kali RAL)' : 'pengelompokan tidak nyata'}.`);
    if (lt && sig) ip.push('Peringkat rata-rata: ' + best.map((o) => `${esc(nm[o.i])} (${fmt(o.v, 2)}${lt ? ' ' + lt[o.i] : ''})`).join(' &gt; ') + '. Huruf yang sama = tidak berbeda nyata.');
    ip.push(`<strong>KK = ${fmt(tab.cv, 2)}%</strong>, R² = ${fmt(tab.r2, 3)}.`);
    ip.push('<strong>Asumsi:</strong> galat menyebar normal dan ragamnya homogen antar perlakuan' + (m === 'rak' ? ', pengaruh kelompok dan perlakuan bersifat aditif (tanpa interaksi)' : '') + ', serta pengamatan saling bebas.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${m === 'ral' ? 'Rancangan Acak Lengkap (RAL)' : 'Rancangan Acak Kelompok (RAK)'}</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', m === 'ral' ? 'RAL' : 'RAK'], ['Perlakuan', t], ['Uji lanjut', post === 'none' ? '-' : PN[post]], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm, m === 'ral' ? tab.groups : nm.map((_, j) => blockRows.map((r) => r[j]))) });
  };
})();
