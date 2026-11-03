/* =========================================================================
   UJI z - satu sampel dan dua sampel, simpangan baku populasi (σ) DIKETAHUI (Basic Statistics)
   Hitungan: basic-core.js (zOne, zTwo). Bila σ tidak diketahui, gunakan Uji t. Halaman otomatis: #view-uji-z
   ========================================================================= */
(function () {
  'use strict';
  const B = window.StatBasic, U = window.StatBasicUI, D = window.StatDist;
  if (!B || !U || !D || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP, fmtCI, pct, effectLabel } = U;
  const DEF = { one: ['Sampel'], two: ['Kelompok 1', 'Kelompok 2'] }, ALT = { two: '≠', greater: '>', less: '<' };
  const ui = U.mountPage({
    id: 'uji-z', pre: 'uz', title: 'Uji z',
    lede: 'Uji rata-rata dengan distribusi normal baku bila simpangan baku populasi (σ) diketahui: satu sampel terhadap nilai acuan, atau perbandingan dua kelompok independen. Bila σ tidak diketahui, pakai Uji t.',
    settings: `
      <label>Jenis uji<select id="uzMode" class="select-input"><option value="one">Satu sampel</option><option value="two">Dua sampel independen</option></select></label>
      <label><span id="uzS1Lbl">σ populasi</span><input type="text" id="uzS1" class="plain-input" inputmode="decimal" autocomplete="off" placeholder="mis. 6"></label>
      <label id="uzS2Wrap" hidden>σ populasi kelompok 2 (σ₂)<input type="text" id="uzS2" class="plain-input" inputmode="decimal" autocomplete="off" placeholder="mis. 9"></label>
      <label><span id="uzMuLbl">Nilai hipotesis (μ₀)</span><input type="text" id="uzMu" class="plain-input" inputmode="decimal" value="0" autocomplete="off"></label>
      <label>Hipotesis alternatif (H₁)<select id="uzAlt" class="select-input"><option value="two">Dua sisi (≠)</option><option value="greater">Lebih besar (&gt;)</option><option value="less">Lebih kecil (&lt;)</option></select></label>
      <label>Tingkat signifikansi (α)<select id="uzAlpha" class="select-input"><option value="0.10">0,10 (CI 90%)</option><option value="0.05" selected>0,05 (CI 95%)</option><option value="0.01">0,01 (CI 99%)</option></select></label>`,
    hint: '<span id="uzHintLead">Satu kolom data sampel.</span> Minimal <strong><span id="uzMin">2</span> data</strong> per kolom; maksimal 2000 baris. Sel kosong diabaikan.',
    table: { names: DEF.one, colLabel: 'Kolom', minCols: 1, maxCols: 2 }, calcLabel: 'Hitung Uji z',
  });
  const q = ui.q, tbl = ui.tbl, mode = () => q('uzMode').value;
  const isDef = () => Object.keys(DEF).some((m) => DEF[m].join('|') === tbl.names.join('|')) || tbl.names.every((n) => /^Kolom \d+$/.test(n));
  function applyMode(keep) {
    const m = mode(), was = isDef();
    tbl.setCols(m === 'one' ? 1 : 2);
    if (was && !keep) tbl.names = DEF[m].slice();
    tbl.buildHead();
    q('uzMuLbl').textContent = m === 'one' ? 'Nilai hipotesis (μ₀)' : 'Selisih hipotesis μ₁ − μ₂ (δ₀)';
    q('uzS1Lbl').textContent = m === 'one' ? 'σ populasi' : 'σ populasi kelompok 1 (σ₁)';
    q('uzS2Wrap').hidden = m !== 'two';
    q('uzHintLead').textContent = m === 'one' ? 'Satu kolom data sampel.' : 'Dua kolom: satu kolom per kelompok (panjang boleh berbeda).';
  }
  q('uzMode').addEventListener('change', () => { applyMode(false); ui.clearErr(); });
  applyMode(false);
  tbl.register((n) => { const sel = q('uzMode'); if (n >= 2 && sel.value === 'one') sel.value = 'two'; else if (n <= 1 && sel.value !== 'one') sel.value = 'one'; applyMode(true); });
  ui.onSample = () => {
    const m = mode();
    if (m === 'one') { tbl.fill(DEF.one, [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91, 74, 85, 69, 83, 77]]); q('uzMu').value = '75'; q('uzS1').value = '8'; }
    else { tbl.fill(DEF.two, [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91, 74, 85, 69, 83, 77], [65, 70, 82, 60, 75, 88, 55, 72, 70, 84, 62, 78, 58, 74, 69]]); q('uzMu').value = '0'; q('uzS1').value = '8'; q('uzS2').value = '9'; }
    applyMode(true);
  };

  ui.onCalc = () => {
    const m = mode(), alt = q('uzAlt').value, alpha = parseFloat(q('uzAlpha').value), conf = 1 - alpha;
    const mu = toNum(q('uzMu').value), s1 = toNum(q('uzS1').value), s2 = m === 'two' ? toNum(q('uzS2').value) : null;
    if (mu === null || Number.isNaN(mu)) return ui.err('Nilai hipotesis harus berupa angka (boleh 0).');
    if (s1 === null || Number.isNaN(s1) || s1 <= 0) return ui.err('σ populasi harus berupa angka positif (nilai yang diketahui dari populasi, bukan dari sampel).');
    if (m === 'two' && (s2 === null || Number.isNaN(s2) || s2 <= 0)) return ui.err('σ₂ harus berupa angka positif.');
    const { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const names = tbl.names.map((_, j) => tbl.name(j)), x = cols[0].filter((v) => v !== null), y = m === 'two' ? cols[1].filter((v) => v !== null) : null;
    if (x.length < 2 || (y && y.length < 2)) return ui.err(m === 'one' ? 'Uji z membutuhkan minimal 2 data.' : 'Setiap kelompok membutuhkan minimal 2 data (' + names[0] + ': ' + x.length + ', ' + names[1] + ': ' + y.length + ').');
    const res = m === 'one' ? B.zOne(x, mu, s1, alt, conf) : B.zTwo(x, y, s1, s2, mu, alt, conf), rej = res.p < alpha;
    const c = { m, alt, alpha, conf, mu, names, res, rej };
    const h0 = m === 'one' ? 'μ = ' + fmt(mu) : 'μ₁ − μ₂ = ' + fmt(mu), h1 = (m === 'one' ? 'μ ' : 'μ₁ − μ₂ ') + ALT[alt] + ' ' + fmt(mu);
    /* ringkasan */
    const row = (lab, n, mean, sg) => `<tr><td class="lbl">${esc(lab)}</td><td>${n}</td><td>${fmt(mean)}</td><td>${fmt(sg)}</td><td>${fmt(sg / Math.sqrt(n))}</td></tr>`;
    let sum = '<table class="result-table bs-res"><caption>Statistik sampel</caption><thead><tr><th class="lbl">Sampel</th><th>n</th><th>Rata-rata</th><th>σ (diketahui)</th><th>σ/√n</th></tr></thead><tbody>' +
      (m === 'one' ? row(names[0], res.n, res.mean, res.sigma) : row(names[0], res.n1, res.m1, res.s1) + row(names[1], res.n2, res.m2, res.s2)) + '</tbody></table>';
    const est = m === 'one' ? res.mean : res.diff;
    sum += `<table class="result-table bs-res"><caption>${m === 'one' ? 'Uji z satu sampel' : 'Uji z dua sampel'}</caption><tbody>
      <tr><td class="lbl">Hipotesis nol (H₀)</td><td>${h0}</td></tr><tr><td class="lbl">Hipotesis alternatif (H₁)</td><td>${h1}</td></tr>
      <tr><td class="lbl">${m === 'one' ? 'Rata-rata sampel (x̄)' : 'Selisih rata-rata (x̄₁ − x̄₂)'}</td><td>${fmt(est)}</td></tr>
      <tr><td class="lbl">Galat baku (SE)</td><td>${fmt(res.se)}</td></tr>
      <tr><td class="lbl">Selang kepercayaan ${m === 'one' ? 'μ' : 'μ₁ − μ₂'} ${pct(conf)}${alt === 'two' ? '' : ' (satu sisi)'}</td><td>${fmtCI(res.ci)}</td></tr>
      <tr><td class="lbl">Statistik z</td><td>${fmt(res.z)}</td></tr>
      <tr><td class="lbl">p-value</td><td class="${rej ? 'sig' : ''}">${fmtP(res.p)}</td></tr><tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr>
      <tr><td class="lbl">Keputusan</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr>
      <tr><td class="lbl">Ukuran efek (d)</td><td>${fmt(res.d, 3)} (${effectLabel(res.d)})</td></tr></tbody></table>
      <p class="bs-note">p-value dihitung dari distribusi normal baku. σ dianggap diketahui; bila hanya tersedia simpangan baku sampel, gunakan Uji t. Ukuran efek d = ${m === 'one' ? '(x̄ − μ₀)/σ' : '(x̄₁ − x̄₂)/√[(σ₁² + σ₂²)/2]'}.</p>`;
    /* langkah */
    const zc = alt === 'two' ? D.normQuant(1 - alpha / 2) : D.normQuant(1 - alpha), st = [];
    st.push(m === 'one' ? { t: 'Rumus yang dipakai', f: 'x̄ = Σx / n\nSE = σ / √n\nz = (x̄ − μ₀) / SE', n: 'Uji z satu sampel dipakai bila σ populasi diketahui.' }
      : { t: 'Rumus yang dipakai', f: 'SE = √(σ₁²/n₁ + σ₂²/n₂)\nz = (x̄₁ − x̄₂ − δ₀) / SE', n: 'Uji z dua sampel dipakai bila σ kedua populasi diketahui.' });
    st.push({ t: 'Hipotesis', f: `H₀: ${h0}\nH₁: ${h1}\nα = ${fmt(alpha, 2)}`, n: '' });
    st.push(m === 'one' ? { t: 'Statistik sampel', f: `n = ${res.n}\nx̄ = ${fmt(res.mean)}\nσ = ${fmt(res.sigma)}\nSE = ${fmt(res.sigma)} / √${res.n} = ${fmt(res.se)}`, n: '' }
      : { t: 'Statistik tiap kelompok', f: `${names[0]}: n₁ = ${res.n1}, x̄₁ = ${fmt(res.m1)}, σ₁ = ${fmt(res.s1)}\n${names[1]}: n₂ = ${res.n2}, x̄₂ = ${fmt(res.m2)}, σ₂ = ${fmt(res.s2)}\nSelisih = ${fmt(res.diff)}\nSE = √(${fmt(res.s1 * res.s1)}/${res.n1} + ${fmt(res.s2 * res.s2)}/${res.n2}) = ${fmt(res.se)}`, n: '' });
    st.push({ t: 'Statistik uji', f: `z = (${fmt(est)} − ${fmt(mu)}) / ${fmt(res.se)} = ${fmt(res.z)}`, n: '' });
    st.push({ t: 'p-value & nilai kritis', f: `Nilai kritis z (${alt === 'two' ? 'dua sisi' : 'satu sisi'}, α = ${fmt(alpha, 2)}) = ${alt === 'less' ? '−' : alt === 'two' ? '±' : ''}${fmt(zc)}\np-value = ${fmtP(res.p)}`, n: '' });
    st.push({ t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(res.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' });
    st.push({ t: `Selang kepercayaan ${pct(conf)}`, f: `Batas = ${fmt(est)} ± z × SE\n= ${fmtCI(res.ci)}`, n: '' });
    /* interpretasi */
    const phr = { two: 'berbeda secara signifikan dari', greater: 'secara signifikan lebih besar dari', less: 'secara signifikan lebih kecil dari' }[alt];
    const subj = m === 'one' ? 'rata-rata populasi (μ)' : `selisih rata-rata populasi ${esc(names[0])} dan ${esc(names[1])} (μ₁ − μ₂)`;
    const nmin = m === 'one' ? res.n : Math.min(res.n1, res.n2);
    const ip = [`<strong>Keputusan:</strong> p-value = <strong>${fmtP(res.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. Pada tingkat signifikansi ${pct(alpha)}, ${rej ? 'terdapat bukti yang cukup' : 'belum terdapat bukti yang cukup'} bahwa ${subj} ${phr} ${fmt(mu)}.`,
      `${m === 'one' ? 'Rata-rata sampel' : 'Selisih rata-rata sampel'} = ${fmt(est)}; dengan keyakinan ${pct(conf)}${alt === 'two' ? '' : ' (satu sisi)'}, nilai ${m === 'one' ? 'μ' : 'μ₁ − μ₂'} berada pada ${fmtCI(res.ci)}.`,
      `Ukuran efek d = ${fmt(res.d, 3)}, tergolong <strong>${effectLabel(res.d)}</strong>.`,
      `<strong>Asumsi:</strong> σ benar-benar diketahui (bukan dihitung dari sampel); data saling bebas; ${nmin >= 30 ? 'dengan n ≥ 30 distribusi rata-rata mendekati normal meskipun data tidak persis normal' : 'n kecil, sehingga data sebaiknya berdistribusi mendekati normal'}.`];
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${m === 'one' ? 'Uji z satu sampel' : 'Uji z dua sampel'}</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', m === 'one' ? 'Uji z satu sampel' : 'Uji z dua sampel'], ['Hipotesis alternatif', h1], ['α', fmt(alpha, 2)]], data: ui.dataExport(names.slice(0, m === 'one' ? 1 : 2), m === 'one' ? [x] : [x, y]) });
  };
})();
