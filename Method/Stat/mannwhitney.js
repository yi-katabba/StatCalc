/* =========================================================================
   UJI MANN-WHITNEY (Wilcoxon rank-sum) - dua sampel independen, nonparametrik (Nonparametrics)
   Hitungan: nonpar-core.js (mannWhitney). Halaman otomatis: #view-mann-whitney
   ========================================================================= */
(function () {
  'use strict';
  const NP = window.StatNonpar, U = window.StatBasicUI, D = window.StatDist;
  if (!NP || !U || !D || !U.mountPage) return;
  const { esc, fmt, fmtP } = U;
  const H1 = { two: 'distribusi kedua kelompok berbeda (lokasi bergeser)', greater: 'nilai kelompok 1 cenderung lebih besar daripada kelompok 2', less: 'nilai kelompok 1 cenderung lebih kecil daripada kelompok 2' };
  const ui = U.mountPage({
    id: 'mann-whitney', pre: 'mw', title: 'Uji Mann-Whitney', eyebrow: 'Metode Statistik &rsaquo; Nonparametrics', step1: 'Atur uji &amp; masukkan data',
    lede: 'Alternatif nonparametrik untuk uji t dua sampel independen: membandingkan dua kelompok berdasarkan peringkat, sehingga tidak mensyaratkan data normal dan tahan terhadap pencilan. Dilengkapi statistik U, p-value eksak atau pendekatan normal, dan ukuran efek.',
    settings: `
      <label>Hipotesis alternatif (H₁)<select id="mwAlt" class="select-input"><option value="two">Dua sisi (berbeda)</option><option value="greater">Kelompok 1 &gt; kelompok 2</option><option value="less">Kelompok 1 &lt; kelompok 2</option></select></label>
      <label>Perhitungan p-value<select id="mwMethod" class="select-input"><option value="auto">Otomatis (eksak bila N ≤ 40 dan tanpa nilai kembar)</option><option value="asymptotic">Selalu pendekatan normal</option></select></label>
      <label>Tingkat signifikansi (α)<select id="mwAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: 'Dua kolom: satu kolom per kelompok (panjang kolom boleh berbeda). Minimal <strong><span id="mwMin">2</span> data</strong> per kelompok; sel kosong diabaikan.',
    table: { names: ['Kelompok 1', 'Kelompok 2'], colLabel: 'Kelompok', minCols: 2, maxCols: 2 }, calcLabel: 'Hitung Mann-Whitney',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => tbl.fill(['Kelompok 1', 'Kelompok 2'], [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91, 74, 85, 69, 83, 77], [65, 70, 82, 60, 75, 88, 55, 72, 70, 84, 62, 78, 58, 74, 69]]);
  ui.onCalc = () => {
    const alt = q('mwAlt').value, alpha = parseFloat(q('mwAlpha').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const x = cols[0].filter((v) => v !== null), y = cols[1].filter((v) => v !== null), nm = [tbl.name(0), tbl.name(1)];
    if (x.length < 2 || y.length < 2) return ui.err('Setiap kelompok membutuhkan minimal 2 data (' + nm[0] + ': ' + x.length + ', ' + nm[1] + ': ' + y.length + ').');
    const r = NP.mannWhitney(x, y, alt, { method: q('mwMethod').value === 'asymptotic' ? 'asymptotic' : 'auto' }), rej = r.p < alpha;
    const sum = `<table class="result-table bs-res"><caption>Statistik peringkat</caption><thead><tr><th class="lbl">Kelompok</th><th>n</th><th>Median</th><th>Rata-rata peringkat</th><th>Jumlah peringkat (W)</th></tr></thead><tbody>
      <tr><td class="lbl">${esc(nm[0])}</td><td>${r.n1}</td><td>${fmt(r.med1)}</td><td>${fmt(r.mr1, 3)}</td><td>${fmt(r.R1, 2)}</td></tr><tr><td class="lbl">${esc(nm[1])}</td><td>${r.n2}</td><td>${fmt(r.med2)}</td><td>${fmt(r.mr2, 3)}</td><td>${fmt(r.R2, 2)}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Hasil uji Mann-Whitney</caption><tbody>
      <tr><td class="lbl">Hipotesis nol (H₀)</td><td>distribusi kedua kelompok sama</td></tr><tr><td class="lbl">Hipotesis alternatif (H₁)</td><td>${H1[alt]}</td></tr>
      <tr><td class="lbl">U kelompok 1 / U kelompok 2</td><td>${fmt(r.U1, 2)} / ${fmt(r.U2, 2)}</td></tr>
      <tr><td class="lbl">p-value</td><td class="${rej ? 'sig' : ''}">${fmtP(r.p)}</td></tr><tr><td class="lbl">Cara perhitungan</td><td>${r.exact ? 'Distribusi eksak (tanpa nilai kembar)' : 'Pendekatan normal' + (r.hasTies ? ' dengan koreksi nilai kembar' : '') + ' dan koreksi kontinuitas'}</td></tr>
      <tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr><tr><td class="lbl">Keputusan</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr>
      <tr><td class="lbl">Korelasi rank-biserial (r)</td><td>${fmt(r.rbc, 3)}</td></tr><tr><td class="lbl">Probabilitas superioritas P(X &gt; Y)</td><td>${fmt(r.cles, 3)}</td></tr></tbody></table>
      <p class="bs-note">U₁ = W₁ − n₁(n₁+1)/2; U₁ + U₂ = n₁·n₂. Korelasi rank-biserial r = (U₁ − U₂)/(n₁·n₂) berkisar −1 sampai 1; probabilitas superioritas = U₁/(n₁·n₂) adalah peluang nilai acak kelompok 1 lebih besar daripada kelompok 2 (nilai kembar dihitung setengah).</p>`;
    const N = r.N, st = [{ t: 'Hipotesis', f: `H₀: distribusi kedua populasi sama, P(X > Y) = 0,5\nH₁: ${H1[alt]}\nα = ${fmt(alpha, 2)}`, n: '' },
      { t: 'Peringkat gabungan', f: `Gabungkan ${r.n1} + ${r.n2} = ${N} data, beri peringkat 1…${N} (nilai kembar → rata-rata peringkat)\nW₁ (jumlah peringkat ${nm[0]}) = ${fmt(r.R1, 2)}\nW₂ (jumlah peringkat ${nm[1]}) = ${fmt(r.R2, 2)}`, n: r.hasTies ? `Ada ${r.ties.length} kelompok nilai kembar.` : '' },
      { t: 'Statistik U', f: `U₁ = W₁ − n₁(n₁ + 1)/2 = ${fmt(r.R1, 2)} − ${r.n1 * (r.n1 + 1) / 2} = ${fmt(r.U1, 2)}\nU₂ = n₁n₂ − U₁ = ${r.n1 * r.n2} − ${fmt(r.U1, 2)} = ${fmt(r.U2, 2)}`, n: '' }];
    if (r.exact) st.push({ t: 'p-value eksak', f: `Peluang U di bawah H₀ dihitung dari semua ${fmt(Math.exp(D.lgamma(N + 1) - D.lgamma(r.n1 + 1) - D.lgamma(r.n2 + 1)), 0)} susunan peringkat yang mungkin\np-value = ${fmtP(r.p)}`, n: 'Berlaku untuk data tanpa nilai kembar dan N tidak terlalu besar.' });
    else { const mu = r.n1 * r.n2 / 2, s = Math.sqrt(r.n1 * r.n2 / 12 * ((N + 1) - NP.tieSum(r.ties) / (N * (N - 1)))); st.push({ t: 'Pendekatan normal', f: `μU = n₁n₂/2 = ${fmt(mu, 2)}\nσU = √{ n₁n₂/12 · [(N + 1) − Σ(t³ − t)/(N(N − 1))] } = ${fmt(s, 4)}\nz = (U − μU − 0,5) / σU (U = ${alt === 'two' ? 'maks(U₁, U₂)' : alt === 'greater' ? 'U₁' : 'U₂'})\np-value = ${fmtP(r.p)}`, n: 'Koreksi kontinuitas 0,5 dan koreksi nilai kembar diterapkan.' }); }
    st.push({ t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(r.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' });
    const hi = r.mr1 > r.mr2;
    const ip = [`<strong>Keputusan:</strong> p-value = <strong>${fmtP(r.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. ${rej ? `Terdapat bukti yang cukup bahwa ${H1[alt]}.` : 'Belum terdapat bukti yang cukup bahwa kedua kelompok berbeda.'}`,
      `Rata-rata peringkat ${esc(nm[0])} = ${fmt(r.mr1, 2)} dan ${esc(nm[1])} = ${fmt(r.mr2, 2)}; kelompok <strong>${esc(hi ? nm[0] : nm[1])}</strong> cenderung bernilai lebih besar. Median: ${fmt(r.med1)} vs ${fmt(r.med2)}.`,
      `Ukuran efek: r rank-biserial = ${fmt(r.rbc, 3)}; peluang nilai acak ${esc(nm[0])} lebih besar daripada ${esc(nm[1])} adalah ${fmt(r.cles * 100, 1)}% (50% berarti tidak ada perbedaan).`,
      '<strong>Asumsi:</strong> kedua sampel saling bebas dan data minimal berskala ordinal. Uji ini membandingkan <em>distribusi</em>; bila bentuk kedua distribusi serupa, perbedaan tersebut dapat ditafsirkan sebagai pergeseran median.'];
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Uji Mann-Whitney</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Uji Mann-Whitney'], ['H₁', H1[alt]], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm, [x, y]) });
  };
})();
