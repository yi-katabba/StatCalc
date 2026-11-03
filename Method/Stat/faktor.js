/* =========================================================================
   ANALISIS FAKTOR - ekstraksi komponen utama + rotasi varimax; KMO & uji Bartlett; skor faktor (Multivariate)
   Hitungan: multi-core.js (factorAnalysis, kmoBartlett). Halaman otomatis: #view-faktor
   ========================================================================= */
(function () {
  'use strict';
  const MC = window.StatMulti, SV = window.StatSvg, U = window.StatBasicUI;
  if (!MC || !SV || !U || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP, pct } = U;
  const kmoLabel = (v) => v >= 0.9 ? 'sangat baik (marvelous)' : v >= 0.8 ? 'baik (meritorious)' : v >= 0.7 ? 'cukup (middling)' : v >= 0.6 ? 'kurang (mediocre)' : v >= 0.5 ? 'buruk (miserable)' : 'tidak dapat diterima';
  const ui = U.mountPage({
    id: 'faktor', pre: 'fk', title: 'Analisis Faktor', eyebrow: 'Metode Statistik &rsaquo; Multivariate', step1: 'Atur analisis &amp; masukkan data',
    lede: 'Temukan faktor laten yang mendasari korelasi antar variabel. Memakai ekstraksi komponen utama dengan rotasi varimax (seperti Minitab/SPSS), dilengkapi uji kelayakan KMO dan Bartlett, komunalitas, proporsi varians tiap faktor, dan skor faktor.',
    settings: `
      <label>Jumlah faktor<select id="fkN" class="select-input"><option value="auto">Otomatis (nilai eigen &gt; 1)</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>
      <label>Rotasi<select id="fkRot" class="select-input"><option value="varimax">Varimax (disarankan)</option><option value="none">Tanpa rotasi</option></select></label>
      <label>Tampilkan loading dengan |nilai| ≥<input type="text" id="fkCut" class="plain-input" inputmode="decimal" value="0,30" autocomplete="off"></label>`,
    hint: 'Baris = responden/pengamatan, kolom = variabel (butir) numerik. Minimal 3 variabel dan <strong><span id="fkMin">10</span> pengamatan</strong> lengkap (disarankan ≥ 5 kali jumlah variabel); baris dengan sel kosong dibuang.',
    table: { names: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'], colLabel: 'V', minCols: 3, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Analisis Faktor',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => {
    let s = 17; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, nrm = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7, C = Array.from({ length: 6 }, () => []);
    for (let i = 0; i < 40; i++) { const f1 = nrm(), f2 = nrm(); [0.8 * f1 + 0.4 * nrm(), 0.75 * f1 + 0.5 * nrm(), 0.7 * f1 + 0.5 * nrm(), 0.8 * f2 + 0.4 * nrm(), 0.7 * f2 + 0.5 * nrm(), 0.75 * f2 + 0.5 * nrm()].forEach((v, j) => C[j].push(+(3 + v).toFixed(2))); }
    tbl.fill(['Butir 1', 'Butir 2', 'Butir 3', 'Butir 4', 'Butir 5', 'Butir 6'], C);
  };
  ui.onCalc = () => {
    const nSel = q('fkN').value, rot = q('fkRot').value === 'varimax', cut = toNum(q('fkCut').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    if (cut === null || Number.isNaN(cut) || cut < 0 || cut >= 1) return ui.err('Batas tampilan loading harus di antara 0 dan 1 (mis. 0,30).');
    const nm = tbl.names.map((_, j) => tbl.name(j)), p = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), X = []; let dropped = 0;
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) { dropped++; continue; } X.push(r); }
    const n = X.length; if (p < 3) return ui.err('Analisis faktor membutuhkan minimal 3 variabel.'); if (n < Math.max(p + 2, 10)) return ui.err(`Dibutuhkan minimal ${Math.max(p + 2, 10)} pengamatan lengkap (sekarang ${n}).`);
    const cst = X[0].findIndex((_, j) => { const c = X.map((r) => r[j]); return Math.max.apply(null, c) === Math.min.apply(null, c); }); if (cst >= 0) return ui.err('Variabel "' + nm[cst] + '" bernilai konstan; hapus kolom tersebut.');
    let kb; try { kb = MC.kmoBartlett(X); } catch (e) { return ui.err('Matriks korelasi singular: ada variabel yang berkorelasi sempurna (atau kombinasi linear) dengan variabel lain. Hapus salah satu variabel yang berulang.'); }
    const kaiser = Math.max(1, MC.eigSymFull(kb.R).values.filter((v) => v > 1).length), nf = Math.min(p - 1, nSel === 'auto' ? kaiser : parseInt(nSel, 10)); if (nf < 1) return ui.err('Jumlah faktor tidak valid untuk ' + p + ' variabel.');
    const f = MC.factorAnalysis(X, nf, { rotate: rot }), ev = f.eigenvalues;
    let sum = `<table class="result-table bs-res"><caption>Kelayakan data untuk analisis faktor</caption><tbody><tr><td class="lbl">Ukuran Kaiser-Meyer-Olkin (KMO)</td><td>${fmt(f.kmo, 3)} — ${kmoLabel(f.kmo)}</td></tr><tr><td class="lbl">Uji sphericity Bartlett (χ², db ${f.bart.df})</td><td>${fmt(f.bart.chi2, 3)}, p = <span class="${f.bart.p < 0.05 ? 'sig' : ''}">${fmtP(f.bart.p)}</span></td></tr></tbody></table>
      <table class="result-table bs-res"><caption>MSA tiap variabel (kecukupan sampel; disarankan ≥ 0,5)</caption><thead><tr><th class="lbl">Variabel</th><th>MSA</th></tr></thead><tbody>${nm.map((v, i) => `<tr><td class="lbl">${esc(v)}</td><td class="${f.msa[i] < 0.5 ? 'sig' : ''}">${fmt(f.msa[i], 3)}</td></tr>`).join('')}</tbody></table>
      <table class="result-table bs-res"><caption>Nilai eigen matriks korelasi</caption><thead><tr><th class="lbl">Komponen</th><th>Nilai eigen</th><th>% varians</th><th>Kumulatif</th></tr></thead><tbody>${(() => { let c = 0; return ev.map((v, j) => { c += v / p; return `<tr><td class="lbl">${j + 1}${j < nf ? ' ◄' : ''}</td><td class="${v > 1 ? 'sig' : ''}">${fmt(v, 4)}</td><td>${pct(v / p)}</td><td>${pct(c)}</td></tr>`; }).join(''); })()}</tbody></table>` + SV.scree(ev);
    sum += `<table class="result-table bs-res"><caption>Loading faktor${rot && nf > 1 ? ' setelah rotasi varimax' : ''} (|loading| &lt; ${fmt(cut, 2)} dikosongkan)</caption><thead><tr><th class="lbl">Variabel</th>${Array.from({ length: nf }, (_, j) => `<th>Faktor ${j + 1}</th>`).join('')}<th>Komunalitas</th><th>Keunikan</th></tr></thead><tbody>` +
      nm.map((v, i) => `<tr><td class="lbl">${esc(v)}</td>${f.loadings[i].map((l) => `<td class="${Math.abs(l) >= 0.5 ? 'sig' : ''}">${Math.abs(l) >= cut ? fmt(l, 3) : ''}</td>`).join('')}<td class="${f.communality[i] < 0.4 ? 'sig' : ''}">${fmt(f.communality[i], 3)}</td><td>${fmt(f.uniqueness[i], 3)}</td></tr>`).join('') +
      `<tr><td class="lbl">Varians dijelaskan (SS loading)</td>${f.ssl.map((v) => `<td>${fmt(v, 3)}</td>`).join('')}<td colspan="2"></td></tr><tr><td class="lbl">% varians total</td>${f.prop.map((v) => `<td>${pct(v)}</td>`).join('')}<td colspan="2">${pct(f.cumul[nf - 1])}</td></tr></tbody></table>`;
    const sh = Math.min(n, 12); sum += `<table class="result-table bs-res"><caption>Skor faktor (metode regresi; ${sh} pengamatan pertama dari ${n})</caption><thead><tr><th class="lbl">Pengamatan</th>${Array.from({ length: nf }, (_, j) => `<th>Faktor ${j + 1}</th>`).join('')}</tr></thead><tbody>${f.scores.slice(0, sh).map((s, i) => `<tr><td class="lbl">${i + 1}</td>${s.map((v) => `<td>${fmt(v, 3)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    sum += `<p class="bs-note">${dropped ? dropped + ' baris dengan sel kosong dibuang. ' : ''}Loading ≥ 0,5 ditebalkan; komunalitas &lt; 0,4 (variabel kurang dijelaskan faktor) ditebalkan. Ekstraksi: komponen utama pada matriks korelasi; rotasi varimax dengan normalisasi Kaiser. ◄ = faktor yang dipertahankan (kriteria Kaiser menyarankan ${kaiser}).</p>`;
    const st = [{ t: 'Kelayakan data', f: `KMO = Σr²ᵢⱼ / (Σr²ᵢⱼ + Σa²ᵢⱼ),  aᵢⱼ = korelasi parsial dari −R⁻¹\nKMO = ${fmt(f.kmo, 4)}\nBartlett: χ² = −[n − 1 − (2p + 5)/6] ln|R| = −[${n} − 1 − ${fmt((2 * p + 5) / 6, 3)}] × ln(${fmt(kb.det, 6)}) = ${fmt(f.bart.chi2, 3)},  db = p(p − 1)/2 = ${f.bart.df},  p = ${fmtP(f.bart.p)}`, n: 'H₀ Bartlett: matriks korelasi = matriks identitas (tidak ada korelasi). Ditolak = data layak difaktorkan.' },
      { t: 'Ekstraksi faktor', f: `Matriks korelasi R (${p}×${p}) → nilai eigen λ = ${ev.map((v) => fmt(v, 3)).join(', ')}\nFaktor dipertahankan: ${nf}${nSel === 'auto' ? ' (λ > 1)' : ''}\nLoading awal L = vektor eigen × √λ`, n: '' },
      { t: 'Komunalitas', f: `hᵢ² = Σⱼ Lᵢⱼ² (proporsi varians variabel yang dijelaskan faktor)\n${nm.slice(0, 8).map((v, i) => `${v}: ${fmt(f.communality[i], 3)}`).join('\n')}${p > 8 ? '\n…' : ''}`, n: 'Keunikan = 1 − komunalitas.' }];
    if (rot && nf > 1) st.push({ t: 'Rotasi varimax', f: 'Memutar sumbu faktor agar ragam kuadrat loading tiap faktor maksimum (loading mendekati 0 atau ±1)\nKaiser: baris dinormalisasi dengan akar komunalitas sebelum rotasi lalu dikembalikan', n: 'Komunalitas tidak berubah oleh rotasi; yang berubah pembagian varians antar faktor.' });
    st.push({ t: 'Varians dijelaskan', f: f.ssl.map((v, j) => `Faktor ${j + 1}: SS loading = ${fmt(v, 3)} → ${pct(f.prop[j])}`).join('\n') + `\nTotal ${nf} faktor: ${pct(f.cumul[nf - 1])}`, n: '' });
    st.push({ t: 'Skor faktor', f: 'F = Z R⁻¹ L  (metode regresi/Thurstone)\ndengan Z = data baku, L = loading terotasi', n: '' });
    const ip = [`<strong>Kelayakan:</strong> KMO = ${fmt(f.kmo, 3)} (${kmoLabel(f.kmo)}); Bartlett p = ${fmtP(f.bart.p)} → ${f.bart.p < 0.05 ? 'korelasi antar variabel cukup untuk difaktorkan' : '<strong>korelasi antar variabel lemah</strong>, analisis faktor kurang bermakna'}.${f.kmo < 0.5 ? ' KMO &lt; 0,5: data tidak layak; pertimbangkan membuang variabel ber-MSA rendah.' : ''}`,
      `<strong>Struktur:</strong> ${nf} faktor menjelaskan <strong>${pct(f.cumul[nf - 1])}</strong> varians total.`];
    for (let j = 0; j < nf; j++) { const vs = nm.map((v, i) => ({ v, l: f.loadings[i][j] })).filter((o) => Math.abs(o.l) >= 0.5).sort((a, b) => Math.abs(b.l) - Math.abs(a.l)); ip.push(`<strong>Faktor ${j + 1}</strong> (${pct(f.prop[j])}): ${vs.length ? vs.map((o) => `${esc(o.v)} (${fmt(o.l, 2)})`).join(', ') : 'tidak ada variabel dengan |loading| ≥ 0,5'}.`); }
    const lowC = nm.filter((_, i) => f.communality[i] < 0.4), cross = nm.filter((_, i) => f.loadings[i].filter((l) => Math.abs(l) >= 0.4).length > 1);
    if (lowC.length) ip.push(`Komunalitas rendah (&lt; 0,4): ${lowC.map(esc).join(', ')} — variabel ini kurang dijelaskan faktor yang ada.`);
    if (cross.length) ip.push(`<em>Cross-loading</em> (|loading| ≥ 0,4 pada lebih dari satu faktor): ${cross.map(esc).join(', ')} — pertimbangkan meninjau atau membuang variabel tersebut.`);
    if (n < 5 * p) ip.push('<strong>Catatan:</strong> jumlah pengamatan kurang dari 5 kali jumlah variabel; solusi faktor bisa tidak stabil.');
    ip.push('<strong>Asumsi:</strong> variabel numerik/interval dengan hubungan linear dan korelasi memadai. Hasil ini memakai ekstraksi komponen utama, sehingga komunalitas cenderung sedikit lebih besar daripada metode kemungkinan maksimum/principal axis.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Analisis faktor (${nf} faktor${rot && nf > 1 ? ', varimax' : ''})</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Analisis faktor (komponen utama' + (rot && nf > 1 ? ' + varimax' : '') + ')'], ['n', n], ['Variabel', p], ['Faktor', nf], ['KMO', fmt(f.kmo, 3)]], data: ui.dataExport(nm, nm.map((_, j) => X.map((r) => r[j]))) });
  };
})();
