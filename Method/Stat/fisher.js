/* =========================================================================
   UJI EKSAK FISHER - tabel 2 x 2 (Tables). Input ringkasan: empat frekuensi sel.
   Hitungan: nonpar-core.js (fisher). Halaman otomatis: #view-fisher
   ========================================================================= */
(function () {
  'use strict';
  const NP = window.StatNonpar, U = window.StatBasicUI, D = window.StatDist;
  if (!NP || !U || !D || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP, fmtCI, pct } = U;
  const ALT = { two: 'berbeda (≠)', greater: 'lebih besar (>)', less: 'lebih kecil (<)' };
  const ui = U.mountPage({
    id: 'fisher', pre: 'fs', title: 'Uji Eksak Fisher', eyebrow: 'Metode Statistik &rsaquo; Tables', step1: 'Atur uji &amp; masukkan tabel 2 × 2',
    lede: 'Uji independensi pada tabel 2 × 2 tanpa pendekatan chi-square, cocok untuk sampel kecil atau frekuensi harapan kecil. Menghasilkan p-value eksak (dari distribusi hipergeometrik), rasio odds beserta selang kepercayaan, dan perbandingan risiko.',
    settings: `
      <label>Nama baris 1<input type="text" id="fsR1" class="plain-input" value="Perlakuan" autocomplete="off"></label>
      <label>Nama baris 2<input type="text" id="fsR2" class="plain-input" value="Kontrol" autocomplete="off"></label>
      <label>Nama kolom 1 (hasil “ya”)<input type="text" id="fsC1" class="plain-input" value="Sembuh" autocomplete="off"></label>
      <label>Nama kolom 2 (hasil “tidak”)<input type="text" id="fsC2" class="plain-input" value="Tidak sembuh" autocomplete="off"></label>
      <label>a: baris 1 × kolom 1<input type="text" id="fsA" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 8"></label>
      <label>b: baris 1 × kolom 2<input type="text" id="fsB" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 2"></label>
      <label>c: baris 2 × kolom 1<input type="text" id="fsC" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 1"></label>
      <label>d: baris 2 × kolom 2<input type="text" id="fsD" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 5"></label>
      <label>Hipotesis alternatif (H₁)<select id="fsAlt" class="select-input"><option value="two">Dua sisi (ada asosiasi)</option><option value="greater">Rasio odds &gt; 1 (a lebih tinggi)</option><option value="less">Rasio odds &lt; 1 (a lebih rendah)</option></select></label>
      <label>Tingkat signifikansi (α)<select id="fsAlpha" class="select-input"><option value="0.10">0,10 (CI 90%)</option><option value="0.05" selected>0,05 (CI 95%)</option><option value="0.01">0,01 (CI 99%)</option></select></label>`,
    hint: 'Tabel: <strong>a b</strong> pada baris 1 dan <strong>c d</strong> pada baris 2. Rasio odds = (a·d)/(b·c); “ya” adalah hasil yang diperhatikan (kolom 1).',
    table: null, calcLabel: 'Hitung Uji Fisher',
  });
  const q = ui.q;
  ui.onSample = () => { q('fsA').value = '8'; q('fsB').value = '2'; q('fsC').value = '1'; q('fsD').value = '5'; };
  const cnt = (id) => { const v = toNum(q(id).value); return v === null || Number.isNaN(v) || v < 0 || Math.floor(v) !== v ? NaN : v; };
  ui.onCalc = () => {
    const a = cnt('fsA'), b = cnt('fsB'), c = cnt('fsC'), d = cnt('fsD'), alt = q('fsAlt').value, alpha = parseFloat(q('fsAlpha').value), conf = 1 - alpha;
    if (![a, b, c, d].every(Number.isFinite)) return ui.err('Keempat frekuensi (a, b, c, d) harus bilangan bulat ≥ 0.');
    if (a + b === 0 || c + d === 0 || a + c === 0 || b + d === 0) return ui.err('Ada baris atau kolom yang jumlahnya 0, uji tidak dapat dihitung.');
    if (a + b + c + d > 100000) return ui.err('Total frekuensi terlalu besar untuk uji eksak (maksimal 100.000); gunakan Chi-Square.');
    const nm = ['fsR1', 'fsR2', 'fsC1', 'fsC2'].map((id, i) => (q(id).value.trim() || ['Baris 1', 'Baris 2', 'Kolom 1', 'Kolom 2'][i]));
    const r = NP.fisher(a, b, c, d, alt, conf), rej = r.p < alpha;
    const orTxt = r.or === Infinity ? '∞' : Number.isNaN(r.or) ? '-' : fmt(r.or, 4);
    let sum = `<table class="result-table bs-res"><caption>Tabel 2 × 2</caption><thead><tr><th class="lbl"></th><th>${esc(nm[2])}</th><th>${esc(nm[3])}</th><th>Total</th><th>Proporsi “${esc(nm[2])}”</th></tr></thead><tbody>
      <tr><td class="lbl">${esc(nm[0])}</td><td>${a}</td><td>${b}</td><td><strong>${r.r1}</strong></td><td>${fmt(r.p1, 4)}</td></tr>
      <tr><td class="lbl">${esc(nm[1])}</td><td>${c}</td><td>${d}</td><td><strong>${r.r2}</strong></td><td>${fmt(r.p2, 4)}</td></tr>
      <tr><td class="lbl">Total</td><td><strong>${r.c1}</strong></td><td><strong>${r.c2}</strong></td><td><strong>${r.n}</strong></td><td></td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Hasil uji eksak Fisher (H₀: kedua variabel independen, rasio odds = 1)</caption><tbody>
      <tr><td class="lbl">Hipotesis alternatif</td><td>${alt === 'two' ? 'rasio odds ≠ 1 (ada asosiasi)' : alt === 'greater' ? 'rasio odds > 1' : 'rasio odds < 1'}</td></tr>
      <tr><td class="lbl">p-value eksak</td><td class="${rej ? 'sig' : ''}">${fmtP(r.p)}</td></tr><tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr>
      <tr><td class="lbl">Keputusan</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr>
      <tr><td class="lbl">Rasio odds sampel</td><td>${orTxt}</td></tr>
      <tr><td class="lbl">Selang kepercayaan rasio odds ${pct(conf)} (Woolf${r.haldane ? ', koreksi 0,5' : ''})</td><td>${fmtCI(r.orCI, 4)}</td></tr>
      <tr><td class="lbl">Risiko relatif (p₁ / p₂)</td><td>${r.rr === Infinity ? '∞' : fmt(r.rr, 4)}</td></tr><tr><td class="lbl">Selisih proporsi (p₁ − p₂)</td><td>${fmt(r.rd, 4)}</td></tr></tbody></table>
      <p class="bs-note">p-value dua sisi = jumlah peluang semua tabel (dengan margin tetap) yang peluangnya tidak lebih besar daripada tabel teramati (seperti fisher.test di R dan SciPy). Rasio odds di atas adalah rasio odds sampel; selang kepercayaannya memakai pendekatan logaritma (Woolf) sehingga bisa tidak selaras persis dengan p-value eksak.</p>`;
    const st = [{ t: 'Hipotesis', f: `H₀: kedua variabel independen (rasio odds = 1)\nH₁: ${alt === 'two' ? 'ada asosiasi (rasio odds ≠ 1)' : alt === 'greater' ? 'rasio odds > 1' : 'rasio odds < 1'}\nα = ${fmt(alpha, 2)}`, n: '' },
      { t: 'Distribusi hipergeometrik', f: `Dengan margin tetap (baris: ${r.r1}, ${r.r2}; kolom: ${r.c1}, ${r.c2}; N = ${r.n}), peluang a = x:\nP(x) = C(${r.r1}, x) · C(${r.r2}, ${r.c1} − x) / C(${r.n}, ${r.c1})\nx dapat bernilai ${r.lo} sampai ${r.hi}`, n: '' },
      { t: 'Peluang tabel teramati', f: `P(a = ${a}) = ${fmt(r.P, 6)}`, n: '' },
      { t: 'p-value', f: alt === 'two' ? `p = Σ P(x) untuk semua x dengan P(x) ≤ P(${a}) = ${fmtP(r.p)}` : alt === 'greater' ? `p = P(a ≥ ${a}) = ${fmtP(r.p)}` : `p = P(a ≤ ${a}) = ${fmtP(r.p)}`, n: '' },
      { t: 'Rasio odds', f: `OR = (a·d)/(b·c) = (${a}·${d}) / (${b}·${c}) = ${orTxt}\nCI ${pct(conf)}: exp[ln OR ± z·√(1/a + 1/b + 1/c + 1/d)] = ${fmtCI(r.orCI, 4)}${r.haldane ? '\n(ada sel bernilai 0 → ditambah 0,5 pada tiap sel untuk selang kepercayaan)' : ''}`, n: '' },
      { t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(r.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' }];
    const ip = [`<strong>Keputusan:</strong> p-value eksak = <strong>${fmtP(r.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. ${rej ? `Terdapat bukti yang cukup bahwa ${esc(nm[0])}/${esc(nm[1])} berasosiasi dengan hasil “${esc(nm[2])}”${alt === 'two' ? '' : ' pada arah yang diuji'}.` : 'Belum terdapat bukti yang cukup adanya asosiasi.'}`,
      `Proporsi “${esc(nm[2])}”: ${esc(nm[0])} = ${fmt(r.p1 * 100, 1)}% (${a}/${r.r1}) dan ${esc(nm[1])} = ${fmt(r.p2 * 100, 1)}% (${c}/${r.r2}). Rasio odds sampel = ${orTxt}${r.or > 1 && Number.isFinite(r.or) ? ` (odds “${esc(nm[2])}” pada ${esc(nm[0])} sekitar ${fmt(r.or, 2)} kali ${esc(nm[1])})` : ''}; dengan keyakinan ${pct(conf)}, rasio odds populasi berada pada ${fmtCI(r.orCI, 3)}${r.orCI[0] <= 1 && r.orCI[1] >= 1 ? ', memuat 1.' : ', tidak memuat 1.'}`,
      '<strong>Asumsi:</strong> pengamatan saling bebas dan tiap pengamatan masuk tepat satu sel. Uji Fisher memperlakukan margin tabel sebagai tetap, tetapi dalam praktik juga dipakai bila margin tidak tetap, terutama untuk sampel kecil.'];
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Uji eksak Fisher</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Uji eksak Fisher 2 × 2'], ['Tabel', `a=${a}, b=${b}, c=${c}, d=${d}`], ['α', fmt(alpha, 2)]] });
  };
})();
