/* =========================================================================
   ANALISIS KLASTER - hierarki (single, complete, average, Ward) dan K-means (Multivariate)
   Hasil: dendrogram / pusat klaster, keanggotaan, ringkasan tiap klaster, silhouette, tabel siku (elbow).
   Hitungan: multi-core.js (hclust, cutTree, kmeans, silhouette). Halaman otomatis: #view-klaster
   ========================================================================= */
(function () {
  'use strict';
  const MC = window.StatMulti, SV = window.StatSvg, U = window.StatBasicUI;
  if (!MC || !SV || !U || !U.mountPage) return;
  const { esc, fmt, pct } = U;
  const MN = { ward: 'Hierarki — Ward', average: 'Hierarki — Average linkage', complete: 'Hierarki — Complete linkage', single: 'Hierarki — Single linkage', kmeans: 'K-means' };
  const silLabel = (v) => v > 0.7 ? 'struktur kuat' : v > 0.5 ? 'struktur wajar' : v > 0.25 ? 'struktur lemah' : 'tidak ada struktur klaster yang berarti';
  const ui = U.mountPage({
    id: 'klaster', pre: 'kl', title: 'Analisis Klaster', eyebrow: 'Metode Statistik &rsaquo; Multivariate', step1: 'Atur analisis &amp; masukkan data',
    lede: 'Kelompokkan pengamatan yang mirip ke dalam klaster. Pilih klaster hierarki (dendrogram; Ward, average, complete, single) atau K-means (pusat klaster). Dilengkapi keanggotaan klaster, ringkasan tiap klaster, indeks silhouette, dan tabel siku untuk menentukan jumlah klaster.',
    settings: `
      <label>Metode<select id="klMeth" class="select-input"><option value="ward">Hierarki — Ward</option><option value="average">Hierarki — Average linkage</option><option value="complete">Hierarki — Complete linkage</option><option value="single">Hierarki — Single linkage</option><option value="kmeans">K-means</option></select></label>
      <label>Jumlah klaster (k)<select id="klK" class="select-input"><option>2</option><option selected>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option></select></label>
      <label>Ukuran jarak<select id="klMet" class="select-input"><option value="euclid">Euclidean</option><option value="manhattan">Manhattan (kecuali Ward / K-means)</option></select></label>
      <label>Pembakuan variabel<select id="klStd" class="select-input"><option value="yes">Ya (disarankan bila satuan berbeda)</option><option value="no">Tidak</option></select></label>`,
    hint: 'Baris = pengamatan (objek), kolom = variabel numerik. Minimal 2 variabel dan <strong><span id="klMin">4</span> pengamatan</strong> lengkap (hierarki maks. 400, K-means maks. 5000); baris dengan sel kosong dibuang.',
    table: { names: ['X1', 'X2'], colLabel: 'X', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Klaster',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => {
    let s = 5; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, nrm = () => (rnd() + rnd() + rnd() - 1.5) * 2, A = [], B = [], C = [[2, 3], [8, 9], [14, 3]];
    for (let i = 0; i < 30; i++) { const c = C[i % 3]; A.push(+(c[0] + nrm()).toFixed(2)); B.push(+(c[1] + nrm()).toFixed(2)); }
    tbl.fill(['Tinggi', 'Berat'], [A, B]);
  };
  ui.onCalc = () => {
    const meth = q('klMeth').value, k = parseInt(q('klK').value, 10), metric = meth === 'ward' || meth === 'kmeans' ? 'euclid' : q('klMet').value, useStd = q('klStd').value === 'yes', { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const nm = tbl.names.map((_, j) => tbl.name(j)), p = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), Xo = []; let dropped = 0;
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) { dropped++; continue; } Xo.push(r); }
    const n = Xo.length, isH = meth !== 'kmeans'; if (p < 1) return ui.err('Isi minimal satu variabel.');
    if (n < Math.max(4, k + 1)) return ui.err(`Dibutuhkan minimal ${Math.max(4, k + 1)} pengamatan lengkap untuk ${k} klaster (sekarang ${n}).`);
    if (isH && n > 400) return ui.err('Klaster hierarki dibatasi maksimal 400 pengamatan di peramban; gunakan K-means untuk data lebih besar.'); if (!isH && n > 5000) return ui.err('K-means dibatasi maksimal 5000 pengamatan.');
    const X = useStd ? MC.standardize(Xo, true).Z : Xo; if (useStd) { const c0 = Xo[0].findIndex((_, j) => { const c = Xo.map((r) => r[j]); return Math.max.apply(null, c) === Math.min.apply(null, c); }); if (c0 >= 0) return ui.err('Variabel "' + nm[c0] + '" bernilai konstan; hapus kolom tersebut atau matikan pembakuan.'); }
    const lbl = Xo.map((_, i) => String(i + 1)); let labels, merges = null, km = null, order = null;
    if (isH) { merges = MC.hclust(X, meth, metric); labels = MC.cutTree(merges, n, k); order = MC.leafOrder(merges, n); }
    else { km = MC.kmeans(X, k, { nInit: 25, seed: 2024 }); labels = km.labels; }
    const sizes = Array.from({ length: k }, (_, j) => labels.filter((l) => l === j).length);
    if (sizes.some((s) => s === 0)) return ui.err('Terbentuk klaster kosong; kurangi jumlah klaster.');
    const sil = MC.silhouette(X, labels, metric), cen = Array.from({ length: k }, (_, j) => Array.from({ length: p }, (_, d) => { const v = Xo.filter((_, i) => labels[i] === j).map((r) => r[d]); return v.reduce((a, b) => a + b, 0) / v.length; }));
    // tabel siku / silhouette untuk beberapa k
    const kmax = Math.min(8, n - 1), elbow = []; for (let kk = 1; kk <= kmax; kk++) { if (isH) { const lb = kk === 1 ? new Array(n).fill(0) : MC.cutTree(merges, n, kk); const gm = Array.from({ length: p }, (_, d) => Xo.reduce((a, r) => a + r[d], 0) / n); let w = 0; for (let j = 0; j < kk; j++) { const g = X.filter((_, i) => lb[i] === j); if (g.length) { const c = Array.from({ length: p }, (_, d) => g.reduce((a, r) => a + r[d], 0) / g.length); g.forEach((r) => { w += r.reduce((a, v, d) => a + (v - c[d]) ** 2, 0); }); } } elbow.push({ k: kk, wss: w, sil: kk > 1 ? MC.silhouette(X, lb, metric).mean : NaN }); } else { const t = kk === k ? km : MC.kmeans(X, kk, { nInit: 12, seed: 2024 }); elbow.push({ k: kk, wss: t.inertia, sil: kk > 1 ? MC.silhouette(X, t.labels, metric).mean : NaN }); } }
    const bestK = elbow.filter((e) => e.k > 1).reduce((a, b) => (b.sil > a.sil ? b : a), { sil: -Infinity }).k;
    let sum = `<table class="result-table bs-res"><caption>${MN[meth]}: ${k} klaster (n = ${n}, ${p} variabel${useStd ? ', dibakukan' : ''}, jarak ${metric === 'manhattan' ? 'Manhattan' : 'Euclidean'})</caption><thead><tr><th class="lbl">Klaster</th><th>Anggota</th><th>%</th>${nm.map((v) => `<th>Rata-rata ${esc(v)}</th>`).join('')}<th>Silhouette</th></tr></thead><tbody>` +
      sizes.map((s, j) => `<tr><td class="lbl">Klaster ${j + 1}</td><td>${s}</td><td>${pct(s / n)}</td>${cen[j].map((v) => `<td>${fmt(v, 3)}</td>`).join('')}<td>${fmt(sil.byCluster.find((c) => c.k === j).mean, 3)}</td></tr>`).join('') + `<tr><td class="lbl">Keseluruhan</td><td>${n}</td><td>100%</td>${nm.map((_, d) => `<td>${fmt(Xo.reduce((a, r) => a + r[d], 0) / n, 3)}</td>`).join('')}<td><strong>${fmt(sil.mean, 3)}</strong></td></tr></tbody></table>`;
    if (isH) sum += SV.dendrogram(merges, n, lbl, k, order) + '<p class="bs-note" style="text-align:center">Garis merah putus-putus = batas pemotongan untuk ' + k + ' klaster. Tinggi cabang = jarak saat dua klaster digabung.</p>';
    if (p >= 2) sum += SV.scatter({ pts: Xo.map((r) => [r[0], r[1]]), groups: labels, labels: lbl, xlabel: nm[0], ylabel: nm[1], title: 'Sebaran klaster', centers: !isH ? cen.map((c) => [c[0], c[1]]) : cen.map((c) => [c[0], c[1]]) }) + `<p class="bs-note" style="text-align:center">Warna = klaster; tanda + berlingkar = pusat klaster (variabel pertama vs kedua pada satuan asli).</p>`;
    sum += `<table class="result-table bs-res"><caption>Menentukan jumlah klaster (siku &amp; silhouette)</caption><thead><tr><th class="lbl">k</th><th>Jumlah kuadrat dalam klaster (WSS)</th><th>Rata-rata silhouette</th></tr></thead><tbody>${elbow.map((e) => `<tr><td class="lbl">${e.k}${e.k === k ? ' ◄' : ''}</td><td>${fmt(e.wss, 3)}</td><td class="${e.k === bestK ? 'sig' : ''}">${Number.isNaN(e.sil) ? '-' : fmt(e.sil, 3)}${e.k === bestK ? ' (tertinggi)' : ''}</td></tr>`).join('')}</tbody></table>`;
    sum += '<table class="result-table bs-res"><caption>Keanggotaan klaster</caption><thead><tr><th class="lbl">Klaster</th><th class="lbl">Nomor pengamatan (baris)</th></tr></thead><tbody>' + sizes.map((_, j) => `<tr><td class="lbl">Klaster ${j + 1}</td><td class="lbl">${labels.map((l, i) => (l === j ? i + 1 : null)).filter((v) => v !== null).join(', ')}</td></tr>`).join('') + '</tbody></table>';
    if (!isH) sum += `<table class="result-table bs-res"><caption>Ukuran kecocokan K-means</caption><tbody><tr><td class="lbl">Jumlah kuadrat dalam klaster (WSS)</td><td>${fmt(km.inertia, 4)}</td></tr><tr><td class="lbl">Jumlah kuadrat antar klaster (BSS)</td><td>${fmt(km.bss, 4)}</td></tr><tr><td class="lbl">BSS / total</td><td>${pct(km.bss / km.tss)}</td></tr><tr><td class="lbl">Iterasi (solusi terbaik dari 25 awalan acak)</td><td>${km.iter}</td></tr></tbody></table>`;
    sum += `<p class="bs-note">${dropped ? dropped + ' baris dengan sel kosong dibuang. ' : ''}Silhouette (−1 sampai 1): makin besar makin baik pemisahan klaster; &gt; 0,5 wajar, &gt; 0,7 kuat. Klaster hierarki bersifat deterministik; K-means dijalankan 25 kali dengan awalan k-means++ dan dipilih solusi dengan WSS terkecil.</p>`;
    const st = [{ t: 'Persiapan data', f: `${n} pengamatan, ${p} variabel${useStd ? '\nTiap variabel dibakukan: z = (x − x̄)/s agar satuan tidak mendominasi jarak' : '\nData dipakai pada satuan asli'}`, n: '' }];
    if (isH) { st.push({ t: 'Matriks jarak', f: `Jarak ${metric === 'manhattan' ? 'Manhattan: d = Σ|xᵢ − xⱼ|' : 'Euclidean: d = √Σ(xᵢ − xⱼ)²'} antara semua pasangan pengamatan (${n}×${n})`, n: '' });
      st.push({ t: 'Penggabungan bertahap', f: { ward: 'Ward: gabungkan dua klaster yang menambah jumlah kuadrat dalam-klaster paling kecil (Lance-Williams)', average: 'Average: jarak klaster = rata-rata jarak semua pasangan anggota', complete: 'Complete: jarak klaster = jarak terjauh antar anggota', single: 'Single: jarak klaster = jarak terdekat antar anggota' }[meth] + `\nMulai dari ${n} klaster, gabungkan pasangan terdekat berulang kali sampai tersisa 1\nLangkah pertama: gabung ${merges[0].a + 1} & ${merges[0].b + 1} pada jarak ${fmt(merges[0].h, 4)}\nLangkah terakhir: jarak ${fmt(merges[n - 2].h, 4)}`, n: 'Pohon penggabungan digambar sebagai dendrogram.' });
      st.push({ t: 'Memotong dendrogram', f: `Dipotong pada ${k} klaster → ukuran: ${sizes.join(', ')}\nBatas potong di antara tinggi ${fmt(merges[n - k - 1].h, 4)} dan ${fmt(merges[n - k].h, 4)}`, n: 'Lompatan besar pada tinggi penggabungan menunjukkan jumlah klaster yang wajar.' }); }
    else { st.push({ t: 'Algoritma K-means', f: `1. Pilih ${k} pusat awal dengan k-means++\n2. Tetapkan tiap pengamatan ke pusat terdekat\n3. Hitung ulang pusat = rata-rata anggota\n4. Ulangi 2–3 sampai keanggotaan tidak berubah (maks. 300 iterasi)\nDiulang 25 kali; dipilih WSS terkecil`, n: '' });
      st.push({ t: 'Hasil', f: `WSS = Σ jarak² ke pusat = ${fmt(km.inertia, 4)}\nBSS = TSS − WSS = ${fmt(km.tss, 4)} − ${fmt(km.inertia, 4)} = ${fmt(km.bss, 4)}  (${pct(km.bss / km.tss)} dari total)\nUkuran klaster: ${sizes.join(', ')}`, n: '' }); }
    st.push({ t: 'Silhouette', f: `Untuk pengamatan i: a = rata-rata jarak ke anggota klasternya, b = rata-rata jarak ke klaster terdekat lain\ns = (b − a) / maks(a, b)\nRata-rata s = ${fmt(sil.mean, 4)} (${silLabel(sil.mean)})`, n: '' });
    const ip = [`<strong>Hasil:</strong> ${MN[meth]} membagi ${n} pengamatan menjadi <strong>${k} klaster</strong> berukuran ${sizes.join(', ')}.`,
      `<strong>Kualitas:</strong> rata-rata silhouette = ${fmt(sil.mean, 3)} → ${silLabel(sil.mean)}. ${bestK !== k ? `Silhouette tertinggi pada k = ${bestK} (${fmt(elbow.find((e) => e.k === bestK).sil, 3)}); pertimbangkan jumlah klaster tersebut.` : 'Jumlah klaster yang dipilih sekaligus memberi silhouette tertinggi di antara k = 2…' + kmax + '.'}`];
    const prof = []; for (let j = 0; j < k; j++) { const dev = nm.map((v, d) => { const gm = Xo.reduce((a, r) => a + r[d], 0) / n, sd = Math.sqrt(Xo.reduce((a, r) => a + (r[d] - gm) ** 2, 0) / (n - 1)); return { v, z: (cen[j][d] - gm) / (sd || 1) }; }).sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0]; prof.push(`Klaster ${j + 1} (${sizes[j]} anggota): ciri paling menonjol ${esc(dev.v)} ${dev.z > 0 ? 'tinggi' : 'rendah'} (${fmt(dev.z, 2)} simpangan baku dari rata-rata keseluruhan)`); }
    ip.push('<strong>Profil klaster:</strong> ' + prof.join('; ') + '.');
    if (sizes.some((s) => s < Math.max(2, n * 0.05))) ip.push('Ada klaster yang sangat kecil; bisa berisi pencilan. Periksa anggotanya sebelum menafsirkan.');
    ip.push('<strong>Catatan:</strong> analisis klaster bersifat eksploratif; hasilnya bergantung pada metode, ukuran jarak, dan pembakuan. ' + (isH ? 'Single linkage rentan membentuk rantai panjang; Ward cenderung menghasilkan klaster berukuran seimbang.' : 'K-means mengasumsikan klaster berbentuk bulat dengan ukuran serupa dan peka terhadap pencilan.'));
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${MN[meth]} (${k} klaster)</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', MN[meth]], ['n', n], ['Variabel', p], ['Klaster', k], ['Silhouette', fmt(sil.mean, 3)]], data: ui.dataExport(nm.concat(['Klaster']), nm.map((_, j) => Xo.map((r) => r[j])).concat([labels.map((l) => l + 1)])) });
  };
})();
