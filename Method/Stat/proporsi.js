/* =========================================================================
   UJI PROPORSI - satu proporsi (z + eksak binomial) dan dua proporsi (Basic Statistics)
   Input berupa ringkasan (jumlah sukses x, ukuran sampel n), bukan tabel data.
   Hitungan: basic-core.js (propOne, propTwo). Halaman otomatis: #view-proporsi
   ========================================================================= */
(function () {
  'use strict';
  const B = window.StatBasic, U = window.StatBasicUI, D = window.StatDist;
  if (!B || !U || !D || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP, fmtCI, pct, effectLabel } = U;
  const ALT = { two: '≠', greater: '>', less: '<' };
  const ui = U.mountPage({
    id: 'proporsi', pre: 'pr', title: 'Uji Proporsi', step1: 'Atur uji &amp; masukkan ringkasan data',
    lede: 'Uji proporsi dengan pendekatan normal (uji z): satu proporsi terhadap nilai acuan (dilengkapi uji binomial eksak) atau perbandingan dua proporsi independen. Cukup memasukkan jumlah keberhasilan dan ukuran sampel.',
    settings: `
      <label>Jenis uji<select id="prMode" class="select-input"><option value="one">Satu proporsi</option><option value="two">Dua proporsi</option></select></label>
      <label><span id="prX1Lbl">Jumlah sukses (x)</span><input type="text" id="prX1" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 18"></label>
      <label><span id="prN1Lbl">Ukuran sampel (n)</span><input type="text" id="prN1" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 40"></label>
      <label class="pr2" hidden>Jumlah sukses sampel 2 (x₂)<input type="text" id="prX2" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 20"></label>
      <label class="pr2" hidden>Ukuran sampel 2 (n₂)<input type="text" id="prN2" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 90"></label>
      <label><span id="prH0Lbl">Proporsi hipotesis (p₀)</span><input type="text" id="prH0" class="plain-input" inputmode="decimal" autocomplete="off" value="0,5"></label>
      <label>Hipotesis alternatif (H₁)<select id="prAlt" class="select-input"><option value="two">Dua sisi (≠)</option><option value="greater">Lebih besar (&gt;)</option><option value="less">Lebih kecil (&lt;)</option></select></label>
      <label>Tingkat signifikansi (α)<select id="prAlpha" class="select-input"><option value="0.10">0,10 (CI 90%)</option><option value="0.05" selected>0,05 (CI 95%)</option><option value="0.01">0,01 (CI 99%)</option></select></label>`,
    hint: 'Contoh: 18 dari 40 pelanggan puas &rarr; x = 18, n = 40. Pada dua proporsi, x₁/n₁ adalah sampel 1 dan x₂/n₂ sampel 2.',
    table: null, calcLabel: 'Hitung Uji Proporsi',
  });
  const q = ui.q, mode = () => q('prMode').value;
  function applyMode() {
    const m = mode(); ui.section.querySelectorAll('.pr2').forEach((e) => { e.hidden = m !== 'two'; });
    q('prX1Lbl').textContent = m === 'one' ? 'Jumlah sukses (x)' : 'Jumlah sukses sampel 1 (x₁)';
    q('prN1Lbl').textContent = m === 'one' ? 'Ukuran sampel (n)' : 'Ukuran sampel 1 (n₁)';
    q('prH0Lbl').textContent = m === 'one' ? 'Proporsi hipotesis (p₀)' : 'Selisih hipotesis p₁ − p₂ (δ₀, 0 = sama)';
    if (m === 'two' && /^0[,.]5$/.test(q('prH0').value.trim())) q('prH0').value = '0';
    if (m === 'one' && q('prH0').value.trim() === '0') q('prH0').value = '0,5';
  }
  q('prMode').addEventListener('change', () => { applyMode(); ui.clearErr(); });
  ui.onSample = () => {
    if (mode() === 'one') { q('prX1').value = '18'; q('prN1').value = '40'; q('prH0').value = '0,5'; }
    else { q('prX1').value = '30'; q('prN1').value = '80'; q('prX2').value = '20'; q('prN2').value = '90'; q('prH0').value = '0'; }
  };
  const cnt = (id) => { const v = toNum(q(id).value); return v === null || Number.isNaN(v) || v < 0 || Math.floor(v) !== v ? NaN : v; };

  ui.onCalc = () => {
    const m = mode(), alt = q('prAlt').value, alpha = parseFloat(q('prAlpha').value), conf = 1 - alpha;
    const x1 = cnt('prX1'), n1 = cnt('prN1'), h0 = toNum(q('prH0').value);
    if (!Number.isFinite(x1) || !Number.isFinite(n1) || n1 < 1) return ui.err('Jumlah sukses (x) dan ukuran sampel (n) harus bilangan bulat tak negatif, dan n minimal 1.');
    if (x1 > n1) return ui.err('Jumlah sukses (x) tidak boleh lebih besar dari ukuran sampel (n).');
    if (h0 === null || Number.isNaN(h0)) return ui.err('Nilai hipotesis harus berupa angka.');
    let res, x2, n2;
    if (m === 'one') {
      if (!(h0 > 0 && h0 < 1)) return ui.err('Proporsi hipotesis p₀ harus di antara 0 dan 1 (tidak termasuk 0 dan 1).');
      res = B.propOne(x1, n1, h0, alt, conf);
    } else {
      x2 = cnt('prX2'); n2 = cnt('prN2');
      if (!Number.isFinite(x2) || !Number.isFinite(n2) || n2 < 1) return ui.err('x₂ dan n₂ harus bilangan bulat tak negatif, dan n₂ minimal 1.');
      if (x2 > n2) return ui.err('x₂ tidak boleh lebih besar dari n₂.');
      if (Math.abs(h0) >= 1) return ui.err('Selisih hipotesis harus di antara −1 dan 1.');
      res = B.propTwo(x1, n1, x2, n2, h0, alt, conf);
      if (!(res.se0 > 0)) return ui.err('Galat baku bernilai 0 (kedua sampel semuanya sukses atau semuanya gagal), uji z tidak dapat dihitung.');
    }
    const rej = res.p < alpha;
    const H0 = m === 'one' ? 'p = ' + fmt(h0) : 'p₁ − p₂ = ' + fmt(h0), H1 = (m === 'one' ? 'p ' : 'p₁ − p₂ ') + ALT[alt] + ' ' + fmt(h0);
    /* syarat pendekatan normal */
    const cond = m === 'one' ? [res.np0, res.nq0] : [x1, n1 - x1, x2, n2 - x2];
    const condOK = cond.every((v) => v >= 10), condWarn = !condOK;
    const rowS = (lab, x, n) => `<tr><td class="lbl">${lab}</td><td>${x}</td><td>${n}</td><td>${fmt(x / n)}</td></tr>`;
    let sum = '<table class="result-table bs-res"><caption>Ringkasan sampel</caption><thead><tr><th class="lbl">Sampel</th><th>Sukses (x)</th><th>n</th><th>Proporsi (p̂)</th></tr></thead><tbody>' +
      (m === 'one' ? rowS('Sampel', x1, n1) : rowS('Sampel 1', x1, n1) + rowS('Sampel 2', x2, n2)) + '</tbody></table>';
    const est = m === 'one' ? res.ph : res.diff;
    sum += `<table class="result-table bs-res"><caption>${m === 'one' ? 'Uji satu proporsi' : 'Uji dua proporsi'}</caption><tbody>
      <tr><td class="lbl">Hipotesis nol (H₀)</td><td>${H0}</td></tr><tr><td class="lbl">Hipotesis alternatif (H₁)</td><td>${H1}</td></tr>
      <tr><td class="lbl">${m === 'one' ? 'Proporsi sampel (p̂)' : 'Selisih proporsi (p̂₁ − p̂₂)'}</td><td>${fmt(est)}</td></tr>
      <tr><td class="lbl">Galat baku di bawah H₀</td><td>${fmt(res.se0)}${m === 'two' ? (res.usePool ? ' (proporsi gabungan)' : ' (tanpa penggabungan)') : ''}</td></tr>
      <tr><td class="lbl">Selang kepercayaan ${pct(conf)}${alt === 'two' ? '' : ' (satu sisi)'}</td><td>${fmtCI(res.ci)}</td></tr>
      <tr><td class="lbl">Statistik z</td><td>${fmt(res.z)}</td></tr>
      <tr><td class="lbl">p-value (pendekatan normal)</td><td class="${rej ? 'sig' : ''}">${fmtP(res.p)}</td></tr>
      ${m === 'one' ? `<tr><td class="lbl">p-value (binomial eksak)</td><td>${fmtP(res.pExact)}</td></tr>` : ''}
      <tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr>
      <tr><td class="lbl">Keputusan (berdasar uji z)</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr>
      <tr><td class="lbl">Ukuran efek (Cohen’s h)</td><td>${fmt(res.h, 3)} (${effectLabel(res.h)})</td></tr></tbody></table>
      <p class="bs-note">${condWarn ? '<strong>Perhatian:</strong> syarat pendekatan normal (semua nilai ' + (m === 'one' ? 'n·p₀ dan n(1 − p₀)' : 'x dan n − x pada kedua sampel') + ' ≥ 10) tidak terpenuhi, sehingga uji z dan selang Wilson kurang akurat' + (m === 'one' ? '; gunakan p-value binomial eksak.' : '; pertimbangkan uji eksak Fisher.') : 'Syarat pendekatan normal terpenuhi (semua ' + (m === 'one' ? 'n·p₀ dan n(1 − p₀)' : 'x dan n − x') + ' ≥ 10).'} ${m === 'one' ? 'Selang kepercayaan memakai metode skor Wilson.' : 'Selang kepercayaan selisih memakai galat baku tanpa penggabungan (Wald).'} Cohen’s h = 2·asin√p̂₁ − 2·asin√p̂₂.</p>`;
    /* langkah */
    const zc = alt === 'two' ? D.normQuant(1 - alpha / 2) : D.normQuant(1 - alpha), st = [];
    if (m === 'one') {
      st.push({ t: 'Rumus yang dipakai', f: 'p̂ = x / n\nSE₀ = √[p₀(1 − p₀) / n]\nz = (p̂ − p₀) / SE₀\nCI Wilson: [p̂ + z²/2n ± z√(p̂(1−p̂)/n + z²/4n²)] / (1 + z²/n)', n: 'Galat baku pada uji memakai p₀ (nilai di bawah H₀).' });
      st.push({ t: 'Hipotesis', f: `H₀: ${H0}\nH₁: ${H1}\nα = ${fmt(alpha, 2)}`, n: '' });
      st.push({ t: 'Proporsi & galat baku', f: `p̂ = ${x1} / ${n1} = ${fmt(res.ph)}\nSE₀ = √[${fmt(h0)} × ${fmt(1 - h0)} / ${n1}] = ${fmt(res.se0)}`, n: `Syarat: n·p₀ = ${fmt(res.np0, 2)} dan n(1 − p₀) = ${fmt(res.nq0, 2)} sebaiknya ≥ 10.` });
      st.push({ t: 'Statistik uji', f: `z = (${fmt(res.ph)} − ${fmt(h0)}) / ${fmt(res.se0)} = ${fmt(res.z)}`, n: '' });
      st.push({ t: 'p-value', f: `Nilai kritis z = ${alt === 'less' ? '−' : alt === 'two' ? '±' : ''}${fmt(zc)}\np-value (normal) = ${fmtP(res.p)}\np-value (binomial eksak) = ${fmtP(res.pExact)}`, n: 'p-value eksak dihitung langsung dari distribusi binomial(n, p₀), tanpa pendekatan normal.' });
    } else {
      st.push({ t: 'Rumus yang dipakai', f: res.usePool ? 'p̂₁ = x₁/n₁,  p̂₂ = x₂/n₂\np̂ = (x₁ + x₂)/(n₁ + n₂)  (proporsi gabungan)\nSE₀ = √[p̂(1 − p̂)(1/n₁ + 1/n₂)]\nz = (p̂₁ − p̂₂) / SE₀' : 'p̂₁ = x₁/n₁,  p̂₂ = x₂/n₂\nSE = √[p̂₁(1−p̂₁)/n₁ + p̂₂(1−p̂₂)/n₂]\nz = (p̂₁ − p̂₂ − δ₀) / SE', n: res.usePool ? 'Bila H₀: p₁ = p₂, kedua proporsi digabung untuk galat baku uji.' : 'Karena δ₀ ≠ 0, galat baku dihitung tanpa penggabungan.' });
      st.push({ t: 'Hipotesis', f: `H₀: ${H0}\nH₁: ${H1}\nα = ${fmt(alpha, 2)}`, n: '' });
      st.push({ t: 'Proporsi & galat baku', f: `p̂₁ = ${x1}/${n1} = ${fmt(res.p1)}\np̂₂ = ${x2}/${n2} = ${fmt(res.p2)}\nSelisih = ${fmt(res.diff)}${res.usePool ? `\np̂ gabungan = ${fmt(res.pool)}` : ''}\nSE = ${fmt(res.se0)}`, n: '' });
      st.push({ t: 'Statistik uji & p-value', f: `z = (${fmt(res.diff)} − ${fmt(h0)}) / ${fmt(res.se0)} = ${fmt(res.z)}\nNilai kritis z = ${alt === 'less' ? '−' : alt === 'two' ? '±' : ''}${fmt(zc)}\np-value = ${fmtP(res.p)}`, n: '' });
    }
    st.push({ t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(res.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' });
    /* interpretasi */
    const phr = { two: 'berbeda secara signifikan dari', greater: 'secara signifikan lebih besar dari', less: 'secara signifikan lebih kecil dari' }[alt];
    const subj = m === 'one' ? 'proporsi populasi (p)' : 'selisih proporsi populasi (p₁ − p₂)';
    const ip = [`<strong>Keputusan:</strong> p-value = <strong>${fmtP(res.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. Pada tingkat signifikansi ${pct(alpha)}, ${rej ? 'terdapat bukti yang cukup' : 'belum terdapat bukti yang cukup'} bahwa ${subj} ${phr} ${fmt(h0)}.`,
      `${m === 'one' ? 'Proporsi sampel' : 'Selisih proporsi sampel'} = ${fmt(est)} (${fmt(est * 100, 2)}%). Dengan keyakinan ${pct(conf)}${alt === 'two' ? '' : ' (satu sisi)'}, ${m === 'one' ? 'p' : 'p₁ − p₂'} berada pada ${fmtCI(res.ci)}.`,
      `Ukuran efek Cohen’s h = ${fmt(res.h, 3)}, tergolong <strong>${effectLabel(res.h)}</strong>.`];
    if (m === 'one' && condWarn) ip.push(`Karena syarat pendekatan normal tidak terpenuhi, rujuk p-value binomial eksak = <strong>${fmtP(res.pExact)}</strong> (${res.pExact < alpha ? 'menolak' : 'tidak menolak'} H₀).`);
    if (m === 'one' && !condWarn && (res.pExact < alpha) !== rej) ip.push(`Catatan: uji z dan uji eksak memberi keputusan berbeda (p eksak = ${fmtP(res.pExact)}); hasilnya berada di dekat batas α, jadi sebaiknya dilaporkan hati-hati.`);
    ip.push('<strong>Asumsi:</strong> observasi saling bebas dan hanya dua kemungkinan hasil (sukses/gagal) dengan peluang sukses tetap.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${m === 'one' ? 'Uji satu proporsi' : 'Uji dua proporsi'}</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', m === 'one' ? 'Uji satu proporsi' : 'Uji dua proporsi'], ['Hipotesis alternatif', H1], ['α', fmt(alpha, 2)], ['Data', m === 'one' ? `x = ${x1}, n = ${n1}` : `x₁ = ${x1}, n₁ = ${n1}; x₂ = ${x2}, n₂ = ${n2}`]] });
  };
})();
