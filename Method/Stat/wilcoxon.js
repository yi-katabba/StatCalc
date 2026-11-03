/* =========================================================================
   UJI WILCOXON SIGNED-RANK - satu sampel (median) atau berpasangan, nonparametrik (Nonparametrics)
   Hitungan: nonpar-core.js (wilcoxon). Halaman otomatis: #view-wilcoxon
   ========================================================================= */
(function () {
  'use strict';
  const NP = window.StatNonpar, U = window.StatBasicUI, D = window.StatDist;
  if (!NP || !U || !D || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP } = U;
  const DEF = { one: ['Sampel'], paired: ['Sebelum', 'Sesudah'] }, SYM = { two: '≠', greater: '>', less: '<' };
  const ui = U.mountPage({
    id: 'wilcoxon', pre: 'wl', title: 'Uji Wilcoxon', eyebrow: 'Metode Statistik &rsaquo; Nonparametrics', step1: 'Atur uji &amp; masukkan data',
    lede: 'Uji peringkat bertanda Wilcoxon: alternatif nonparametrik untuk uji t satu sampel (median terhadap nilai acuan) dan uji t berpasangan (median selisih). Tidak mensyaratkan data normal, hanya sebaran selisih yang kira-kira simetris.',
    settings: `
      <label>Jenis uji<select id="wlMode" class="select-input"><option value="one">Satu sampel (median)</option><option value="paired">Berpasangan (paired)</option></select></label>
      <label><span id="wlMuLbl">Median hipotesis (θ₀)</span><input type="text" id="wlMu" class="plain-input" inputmode="decimal" value="0" autocomplete="off"></label>
      <label>Hipotesis alternatif (H₁)<select id="wlAlt" class="select-input"><option value="two">Dua sisi (≠)</option><option value="greater">Lebih besar (&gt;)</option><option value="less">Lebih kecil (&lt;)</option></select></label>
      <label>Perhitungan p-value<select id="wlMethod" class="select-input"><option value="auto">Otomatis (eksak bila n ≤ 50, tanpa nol/kembar)</option><option value="approx">Selalu pendekatan normal</option></select></label>
      <label>Tingkat signifikansi (α)<select id="wlAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: '<span id="wlHintLead">Satu kolom data sampel.</span> Minimal <strong><span id="wlMin">2</span> data</strong> per kolom; sel kosong diabaikan<span id="wlHintTail"></span>.',
    table: { names: DEF.one, colLabel: 'Kolom', minCols: 1, maxCols: 2 }, calcLabel: 'Hitung Wilcoxon',
  });
  const q = ui.q, tbl = ui.tbl, mode = () => q('wlMode').value;
  const isDef = () => Object.keys(DEF).some((m) => DEF[m].join('|') === tbl.names.join('|')) || tbl.names.every((n) => /^Kolom \d+$/.test(n));
  function applyMode(keep) {
    const m = mode(), was = isDef(); tbl.setCols(m === 'one' ? 1 : 2); if (was && !keep) tbl.names = DEF[m].slice(); tbl.buildHead();
    q('wlMuLbl').textContent = m === 'one' ? 'Median hipotesis (θ₀)' : 'Median selisih hipotesis (0 = tidak ada perbedaan)';
    q('wlHintLead').textContent = m === 'one' ? 'Satu kolom data sampel.' : 'Dua kolom berpasangan: baris yang sama = subjek yang sama (selisih = kolom 1 − kolom 2).';
    q('wlHintTail').textContent = m === 'paired' ? ' (tetapi pasangan harus lengkap)' : '';
  }
  q('wlMode').addEventListener('change', () => { applyMode(false); ui.clearErr(); }); applyMode(false);
  tbl.register((n) => { const sel = q('wlMode'); if (n >= 2 && sel.value === 'one') sel.value = 'paired'; else if (n <= 1 && sel.value !== 'one') sel.value = 'one'; applyMode(true); });
  ui.onSample = () => {
    if (mode() === 'one') { tbl.fill(DEF.one, [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91, 74, 85, 69, 83, 77]]); q('wlMu').value = '75'; }
    else { tbl.fill(DEF.paired, [[80, 75, 90, 68, 72, 85, 78, 66, 92, 70, 77, 83], [84, 79, 93, 70, 78, 88, 80, 72, 95, 76, 81, 90]]); q('wlMu').value = '0'; }
    applyMode(true);
  };
  ui.onCalc = () => {
    const m = mode(), alt = q('wlAlt').value, alpha = parseFloat(q('wlAlpha').value), mu = toNum(q('wlMu').value);
    if (mu === null || Number.isNaN(mu)) return ui.err('Nilai hipotesis harus berupa angka (boleh 0).');
    const { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const nm = tbl.names.map((_, j) => tbl.name(j)); let x = [], y = [], d;
    if (m === 'one') { x = cols[0].filter((v) => v !== null); d = x.map((v) => v - mu); }
    else {
      const len = Math.max(cols[0].length, cols[1].length);
      for (let i = 0; i < len; i++) { const a = cols[0][i] === undefined ? null : cols[0][i], b = cols[1][i] === undefined ? null : cols[1][i]; if (a === null && b === null) continue; if (a === null || b === null) return ui.err('Baris ' + (i + 1) + ' hanya terisi satu sisi. Pada uji berpasangan setiap baris harus berisi dua nilai.'); x.push(a); y.push(b); }
      d = x.map((v, i) => v - y[i] - mu);
    }
    if (d.length < 2) return ui.err(m === 'one' ? 'Uji Wilcoxon membutuhkan minimal 2 data.' : 'Uji Wilcoxon berpasangan membutuhkan minimal 2 pasang data.');
    const r = NP.wilcoxon(d, alt, { method: q('wlMethod').value === 'approx' ? 'approx' : 'auto', correction: true });
    if (r.n < 1) return ui.err('Semua selisih bernilai 0 sehingga tidak ada yang dapat diberi peringkat.');
    const rej = r.p < alpha, h0 = m === 'one' ? `median = ${fmt(mu)}` : `median selisih (${nm[0]} − ${nm[1]}) = ${fmt(mu)}`, h1 = (m === 'one' ? 'median ' : 'median selisih ') + SYM[alt] + ' ' + fmt(mu);
    const dm = NP.median(d.map((v) => v + mu));
    const sum = `<table class="result-table bs-res"><caption>${m === 'one' ? 'Ringkasan sampel' : 'Ringkasan pasangan'}</caption><tbody>
      <tr><td class="lbl">Banyak data / pasangan</td><td>${r.nTotal}</td></tr><tr><td class="lbl">Selisih sama dengan 0 (dibuang)</td><td>${r.zeros}</td></tr><tr><td class="lbl">Dipakai pada uji (n)</td><td>${r.n}</td></tr>
      ${m === 'one' ? `<tr><td class="lbl">Median sampel</td><td>${fmt(NP.median(x))}</td></tr>` : `<tr><td class="lbl">Median ${esc(nm[0])} / ${esc(nm[1])}</td><td>${fmt(NP.median(x))} / ${fmt(NP.median(y))}</td></tr><tr><td class="lbl">Median selisih (${esc(nm[0])} − ${esc(nm[1])})</td><td>${fmt(dm)}</td></tr>`}</tbody></table>
      <table class="result-table bs-res"><caption>Hasil uji Wilcoxon signed-rank</caption><tbody>
      <tr><td class="lbl">Hipotesis nol (H₀)</td><td>${h0}</td></tr><tr><td class="lbl">Hipotesis alternatif (H₁)</td><td>${h1}</td></tr>
      <tr><td class="lbl">T⁺ (jumlah peringkat selisih positif)</td><td>${fmt(r.Tp, 2)}</td></tr><tr><td class="lbl">T⁻ (jumlah peringkat selisih negatif)</td><td>${fmt(r.Tm, 2)}</td></tr>
      <tr><td class="lbl">p-value</td><td class="${rej ? 'sig' : ''}">${fmtP(r.p)}</td></tr><tr><td class="lbl">Cara perhitungan</td><td>${r.exact ? 'Distribusi eksak' : 'Pendekatan normal' + (r.hasTies ? ' dengan koreksi nilai kembar' : '') + ' dan koreksi kontinuitas'}</td></tr>
      <tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr><tr><td class="lbl">Keputusan</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr>
      <tr><td class="lbl">Korelasi rank-biserial (r)</td><td>${fmt(r.rbc, 3)}</td></tr></tbody></table>
      <p class="bs-note">T⁺ + T⁻ = n(n+1)/2. Selisih bernilai 0 dibuang sebelum diberi peringkat (metode Wilcoxon). Korelasi rank-biserial r = (T⁺ − T⁻)/(T⁺ + T⁻), dari −1 sampai 1.</p>`;
    const st = [{ t: 'Hipotesis', f: `H₀: ${h0}\nH₁: ${h1}\nα = ${fmt(alpha, 2)}`, n: '' },
      { t: 'Selisih', f: m === 'one' ? `dᵢ = xᵢ − θ₀  (θ₀ = ${fmt(mu)})` : `dᵢ = ${nm[0]}ᵢ − ${nm[1]}ᵢ − ${fmt(mu)}`, n: `Dari ${r.nTotal} data, ${r.zeros} selisih bernilai 0 dibuang sehingga n = ${r.n}.` },
      { t: 'Peringkat |d|', f: `Beri peringkat 1…${r.n} pada |d| (nilai kembar → rata-rata peringkat)\nT⁺ = ${fmt(r.Tp, 2)}   T⁻ = ${fmt(r.Tm, 2)}   (T⁺ + T⁻ = ${fmt(r.Tp + r.Tm, 2)} = n(n + 1)/2)`, n: r.hasTies ? `Ada ${r.ties.length} kelompok |d| kembar.` : '' }];
    if (r.exact) st.push({ t: 'p-value eksak', f: `Di bawah H₀, tiap peringkat bertanda + atau − dengan peluang sama (2^${r.n} kemungkinan)\np-value = ${fmtP(r.p)}`, n: '' });
    else st.push({ t: 'Pendekatan normal', f: `μT = n(n + 1)/4 = ${fmt(r.mean, 3)}\nσT = √[n(n + 1)(2n + 1)/24 − Σ(t³ − t)/48] = ${fmt(r.se, 4)}\nz = (|T⁺ − μT| − 0,5) / σT\np-value = ${fmtP(r.p)}`, n: 'Koreksi kontinuitas 0,5 dan koreksi nilai kembar diterapkan.' });
    st.push({ t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(r.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' });
    const ip = [`<strong>Keputusan:</strong> p-value = <strong>${fmtP(r.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. ${rej ? `Terdapat bukti yang cukup bahwa ${h1}.` : `Belum terdapat bukti yang cukup bahwa ${h1}.`}`,
      `T⁺ = ${fmt(r.Tp, 2)} dan T⁻ = ${fmt(r.Tm, 2)}: ${r.Tp > r.Tm ? 'selisih positif mendominasi' : r.Tp < r.Tm ? 'selisih negatif mendominasi' : 'selisih positif dan negatif seimbang'}. Ukuran efek rank-biserial r = ${fmt(r.rbc, 3)}.`,
      '<strong>Asumsi:</strong> ' + (m === 'one' ? 'data saling bebas dan sebaran di sekitar median kira-kira simetris.' : 'pasangan saling bebas dan sebaran selisih kira-kira simetris; bila sangat condong, pertimbangkan uji tanda.') + (r.zeros > 0 ? ` Selisih 0 (${r.zeros}) dibuang, sehingga n efektif berkurang.` : '')];
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Uji Wilcoxon signed-rank</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', m === 'one' ? 'Wilcoxon satu sampel' : 'Wilcoxon berpasangan'], ['H₁', h1], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm.slice(0, m === 'one' ? 1 : 2), m === 'one' ? [x] : [x, y]) });
  };
})();
