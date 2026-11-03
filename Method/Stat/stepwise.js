/* =========================================================================
   REGRESI STEPWISE & BEST SUBSETS (Regression) - seleksi variabel prediktor
   Metode: stepwise dua arah, forward, backward (uji t parsial dengan α masuk/keluar), atau best subsets (semua kombinasi).
   Baris dengan data tidak lengkap dibuang (listwise). Hitungan: reg-core.js (stepwise, bestSubsets, ols). Halaman otomatis: #view-stepwise
   ========================================================================= */
(function () {
  'use strict';
  const RG = window.StatRegX, U = window.StatBasicUI, D = window.StatDist;
  if (!RG || !U || !D || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : String(Number(v.toPrecision(d || 6))).replace('.', ','));
  const MN = { stepwise: 'Stepwise (dua arah)', forward: 'Seleksi maju (forward)', backward: 'Eliminasi mundur (backward)', best: 'Best subsets (semua kombinasi)' };
  const ui = U.mountPage({
    id: 'stepwise', pre: 'sw', title: 'Regresi Stepwise & Best Subsets', eyebrow: 'Metode Statistik &rsaquo; Regression', step1: 'Atur seleksi &amp; masukkan data',
    lede: 'Pilih prediktor terbaik dari banyak kandidat. Stepwise, forward, dan backward memasukkan atau mengeluarkan variabel berdasarkan p-value uji t parsial; best subsets memeriksa semua kombinasi dan menampilkan model terbaik tiap ukuran dengan R², R² terkoreksi, Cp Mallows, S, AIC, dan BIC.',
    settings: `
      <label>Metode seleksi<select id="swMethod" class="select-input"><option value="stepwise">Stepwise (dua arah)</option><option value="forward">Forward (maju)</option><option value="backward">Backward (mundur)</option><option value="best">Best subsets (semua kombinasi)</option></select></label>
      <label class="sw-sel">α untuk masuk (α-in)<input type="text" id="swIn" class="plain-input" inputmode="decimal" value="0,15" autocomplete="off"></label>
      <label class="sw-sel">α untuk keluar (α-out)<input type="text" id="swOut" class="plain-input" inputmode="decimal" value="0,15" autocomplete="off"></label>
      <label class="sw-best" hidden>Model terbaik per ukuran<select id="swKeep" class="select-input"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option></select></label>
      <label>Tingkat signifikansi koefisien (α)<select id="swAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: 'Kolom 1 = Y (respon), kolom lain = kandidat prediktor X (maksimal 11; best subsets maksimal 10). Baris yang ada sel kosongnya dibuang. Minimal <strong><span id="swMin">8</span> baris</strong> lengkap dan lebih banyak dari jumlah prediktor + 2.',
    table: { names: ['Y', 'X1', 'X2', 'X3', 'X4'], colLabel: 'X', minCols: 2, maxCols: 12, canAddCol: true }, calcLabel: 'Jalankan Seleksi',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  const sync = () => { const b = q('swMethod').value === 'best'; ui.section.querySelectorAll('.sw-sel').forEach((e) => { e.hidden = b; }); ui.section.querySelectorAll('.sw-best').forEach((e) => { e.hidden = !b; }); q('swOut').closest('label').hidden = b || q('swMethod').value === 'forward'; q('swIn').closest('label').hidden = b || q('swMethod').value === 'backward'; };
  q('swMethod').addEventListener('change', () => { sync(); ui.clearErr(); }); sync();
  ui.onSample = () => {
    const n = 24, X1 = [], X2 = [], X3 = [], X4 = [], Y = []; let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) { const a = rnd() * 10, b = rnd() * 8 + a * 0.4, c = rnd() * 6, d = rnd() * 5; X1.push(+a.toFixed(1)); X2.push(+b.toFixed(1)); X3.push(+c.toFixed(1)); X4.push(+d.toFixed(1)); Y.push(+(5 + 1.8 * a - 1.2 * c + 0.6 * d + (rnd() - 0.5) * 6).toFixed(1)); }
    tbl.fill(['Y', 'X1', 'X2', 'X3', 'X4'], [Y, X1, X2, X3, X4]);
  };
  const coefTable = (m, vn, alpha) => `<table class="result-table bs-res"><caption>Koefisien model akhir</caption><thead><tr><th class="lbl">Suku</th><th>Koefisien</th><th>SE</th><th>t</th><th>p-value</th></tr></thead><tbody>${m.beta.map((b, i) => `<tr><td class="lbl">${i === 0 ? 'Konstanta' : esc(vn[i - 1])}</td><td>${g(b)}</td><td>${g(m.se[i])}</td><td>${fmt(m.t[i], 3)}</td><td class="${m.p_t[i] < alpha ? 'sig' : ''}">${fmtP(m.p_t[i])}</td></tr>`).join('')}</tbody></table>`;
  ui.onCalc = () => {
    const method = q('swMethod').value, alpha = parseFloat(q('swAlpha').value), ain = toNum(q('swIn').value), aout = toNum(q('swOut').value), keep = parseInt(q('swKeep').value, 10), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    if (method !== 'best') { if (ain === null || Number.isNaN(ain) || !(ain > 0 && ain < 1)) return ui.err('α untuk masuk harus di antara 0 dan 1 (mis. 0,15).'); if (aout === null || Number.isNaN(aout) || !(aout > 0 && aout < 1)) return ui.err('α untuk keluar harus di antara 0 dan 1 (mis. 0,15).'); }
    const nm = tbl.names.map((_, j) => tbl.name(j)), k = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), rows = []; let dropped = 0;
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) { dropped++; continue; } rows.push(r); }
    const p = k - 1, n = rows.length, y = rows.map((r) => r[0]), Xc = []; for (let j = 1; j < k; j++) Xc.push(rows.map((r) => r[j])); const vn = nm.slice(1);
    if (p < 1) return ui.err('Dibutuhkan minimal 1 kolom prediktor selain kolom Y.');
    if (n < p + 3) return ui.err(`Dibutuhkan minimal ${p + 3} baris lengkap untuk ${p} prediktor (sekarang ${n}).`);
    if (method === 'best') { if (p > 10) return ui.err('Best subsets dibatasi maksimal 10 prediktor (sekarang ' + p + ').'); if ((Math.pow(2, p) - 1) * n * (p + 1) * (p + 1) > 4e8) return ui.err('Data terlalu besar untuk best subsets di peramban; kurangi jumlah baris atau prediktor.'); }
    if (Xc.some((c) => Math.max.apply(null, c) === Math.min.apply(null, c))) return ui.err('Ada prediktor yang nilainya konstan; hapus kolom tersebut.');
    let full; try { full = RG.fitSubset(Xc, y, Xc.map((_, j) => j)); } catch (e) { return ui.err('Ada prediktor yang berkorelasi sempurna (kolinear) dengan prediktor lain atau jumlah data tidak cukup. Hapus salah satu kolom yang berulang.'); }
    const note = dropped ? `${dropped} baris dengan sel kosong dibuang (n dipakai = ${n}).` : '';
    const MS = (idx) => idx.map((j) => vn[j]).join(', ') || '(tanpa prediktor)';
    if (method === 'best') {
      const B = RG.bestSubsets(Xc, y, { keep }), rowsB = B.rows, bAdj = rowsB.reduce((a, b) => (b.adjr2 > a.adjr2 ? b : a)), bBic = rowsB.reduce((a, b) => (b.bic < a.bic ? b : a)), bCp = rowsB.filter((r) => r.cp >= 0 || true).reduce((a, b) => (Math.abs(b.cp - (b.size + 1)) < Math.abs(a.cp - (a.size + 1)) ? b : a));
      const mk = (r) => (r === bAdj ? ' ◄adj' : '') + (r === bBic ? ' ◄BIC' : '');
      let sum = `<table class="result-table bs-res"><caption>Best subsets: ${B.nModels} model diperiksa (n = ${n}, ${p} prediktor)</caption><thead><tr><th class="lbl">Jumlah X</th><th>R²</th><th>R² terkoreksi</th><th>Cp Mallows</th><th>S</th><th>AIC</th><th>BIC</th><th class="lbl">Prediktor dalam model</th></tr></thead><tbody>` +
        rowsB.map((r) => `<tr><td class="lbl">${r.size}</td><td>${fmt(r.r2 * 100, 2)}%</td><td>${fmt(r.adjr2 * 100, 2)}%</td><td>${fmt(r.cp, 2)}</td><td>${g(r.s, 5)}</td><td>${fmt(r.aic, 2)}</td><td>${fmt(r.bic, 2)}</td><td class="lbl">${esc(MS(r.vars))}<strong>${mk(r)}</strong></td></tr>`).join('') + `</tbody></table>
        <p class="bs-note">${note} ◄adj = R² terkoreksi tertinggi, ◄BIC = BIC terendah. Cp Mallows ideal mendekati p = jumlah koefisien (X + konstanta) dan tidak jauh di atasnya; dihitung terhadap KT galat model penuh (${g(full.mse)}). Pada tiap ukuran hanya ${keep} model dengan R² tertinggi yang ditampilkan.</p>`;
      const m2 = RG.fitSubset(Xc, y, bBic.vars);
      sum += `<table class="result-table bs-res"><caption>Ringkasan model BIC terendah: ${esc(MS(bBic.vars))}</caption><tbody><tr><td class="lbl">R² / R² terkoreksi</td><td>${fmt(m2.r2, 4)} / ${fmt(m2.adjr2, 4)}</td></tr><tr><td class="lbl">F model (p)</td><td>${fmt(m2.F)} (${fmtP(m2.pF)})</td></tr></tbody></table>` + coefTable(m2, bBic.vars.map((j) => vn[j]), alpha);
      const st = [{ t: 'Prosedur', f: `Untuk ${p} prediktor ada 2^${p} − 1 = ${Math.pow(2, p) - 1} himpunan bagian. Semua model dihitung dengan kuadrat terkecil.\nR² = 1 − JK Galat/JK Total;  R² terkoreksi = 1 − KT Galat/KT Total\nCp = JK Galat(model)/KT Galat(penuh) − (n − 2p),  p = jumlah koefisien termasuk konstanta\nAIC = n·ln(JK Galat/n) + n(1 + ln 2π) + 2p;  BIC = … + p·ln n`, n: 'Model penuh dipakai sebagai acuan KT galat untuk Cp.' },
        { t: 'Model penuh', f: `Semua ${p} prediktor: R² = ${fmt(full.r2, 4)}, R² terkoreksi = ${fmt(full.adjr2, 4)}, S = ${g(full.s)}, KT Galat = ${g(full.mse)}`, n: '' },
        { t: 'Kriteria pemilihan', f: `R² terkoreksi tertinggi: ${MS(bAdj.vars)} (${fmt(bAdj.adjr2 * 100, 2)}%)\nBIC terendah: ${MS(bBic.vars)} (${fmt(bBic.bic, 2)})\nCp paling dekat dengan p: ${MS(bCp.vars)} (Cp = ${fmt(bCp.cp, 2)}, p = ${bCp.size + 1})`, n: 'Kriteria berbeda bisa menyarankan model berbeda; BIC cenderung memilih model lebih ringkas.' }];
      const ip = [`Dari ${B.nModels} kemungkinan model, <strong>R² terkoreksi tertinggi</strong> pada model dengan ${esc(MS(bAdj.vars))} (${fmt(bAdj.adjr2 * 100, 2)}%), sedangkan <strong>BIC terendah</strong> pada model dengan ${esc(MS(bBic.vars))}.`,
        bAdj === bBic ? 'Kedua kriteria menunjuk model yang sama, sehingga pilihan relatif jelas.' : 'Kedua kriteria menunjuk model berbeda; pilih model yang lebih ringkas bila selisih R² terkoreksinya kecil.',
        `Model penuh menjelaskan ${fmt(full.r2 * 100, 1)}% variasi; model BIC terendah menjelaskan ${fmt(m2.r2 * 100, 1)}% dengan ${bBic.size} prediktor.`,
        '<strong>Peringatan:</strong> seleksi variabel otomatis cenderung terlalu optimis (p-value dan R² model terpilih menaksir terlalu tinggi); pertimbangkan teori bidang dan validasi pada data baru. Periksa juga multikolinearitas antar prediktor.'];
      ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Best subsets</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    } else {
      const S = RG.stepwise(Xc, y, { method, alphaIn: ain, alphaOut: aout }), fin = S.final, steps = S.steps;
      let mF = null; if (fin.length) mF = RG.fitSubset(Xc, y, fin);
      let sum = `<table class="result-table bs-res"><caption>Riwayat seleksi: ${MN[method]} (α-in = ${fmt(ain, 2)}, α-out = ${fmt(aout, 2)})</caption><thead><tr><th class="lbl">Langkah</th><th>Aksi</th><th>Variabel</th><th>p-value</th><th>R²</th><th>R² terkoreksi</th><th>S</th><th>AIC</th><th class="lbl">Variabel dalam model</th></tr></thead><tbody>` +
        (steps.length ? steps.map((s) => `<tr><td class="lbl">${s.step}</td><td>${s.action === 'masuk' ? 'Masuk (+)' : s.action === 'keluar' ? 'Keluar (−)' : 'Model penuh'}</td><td>${s.variable === null ? '-' : esc(vn[s.variable])}</td><td>${fmtP(s.p)}</td><td>${fmt(s.r2 * 100, 2)}%</td><td>${fmt(s.adjr2 * 100, 2)}%</td><td>${g(s.s, 5)}</td><td>${Number.isNaN(s.aic) ? '-' : fmt(s.aic, 2)}</td><td class="lbl">${esc(MS(s.vars))}</td></tr>`).join('') : '<tr><td colspan="9" class="lbl">Tidak ada variabel yang memenuhi kriteria masuk.</td></tr>') + '</tbody></table>';
      if (mF) {
        const sigF = mF.pF < alpha;
        sum += `<table class="result-table bs-res"><caption>Model akhir: ${esc(nm[0])} ~ ${esc(MS(fin))}</caption><tbody><tr><td class="lbl">R² / R² terkoreksi</td><td>${fmt(mF.r2, 4)} / ${fmt(mF.adjr2, 4)}</td></tr><tr><td class="lbl">S</td><td>${g(mF.s)}</td></tr><tr><td class="lbl">F model (db ${mF.dfm}; ${mF.dfe})</td><td>${fmt(mF.F)} (p = ${fmtP(mF.pF)})</td></tr><tr><td class="lbl">AIC / BIC</td><td>${fmt(mF.aic, 2)} / ${fmt(mF.bic, 2)}</td></tr></tbody></table>` + coefTable(mF, fin.map((j) => vn[j]), alpha);
        const outv = Xc.map((_, j) => j).filter((j) => !fin.includes(j)); if (outv.length) sum += `<table class="result-table bs-res"><caption>Variabel yang tidak masuk (p-value bila ditambahkan ke model akhir)</caption><tbody>${outv.map((j) => { let pv = NaN; try { const mm = RG.fitSubset(Xc, y, fin.concat([j])); pv = mm.p_t[mm.p_t.length - 1]; } catch (e) { } return `<tr><td class="lbl">${esc(vn[j])}</td><td>${fmtP(pv)}</td></tr>`; }).join('')}</tbody></table>`;
      }
      sum += `<p class="bs-note">${note} Aturan: ${method === 'backward' ? 'mulai dari model penuh, keluarkan variabel dengan p terbesar bila p > α-out' : method === 'forward' ? 'mulai tanpa variabel, masukkan variabel dengan p terkecil bila p < α-in' : 'tambahkan variabel dengan p terkecil bila p < α-in, lalu periksa apakah ada variabel di dalam model yang p-nya > α-out untuk dikeluarkan'}; berhenti bila tidak ada perubahan. p-value tiap langkah dari uji t parsial pada model saat itu.</p>`;
      const st = [{ t: 'Prosedur', f: `Metode: ${MN[method]}\nα-in = ${fmt(ain, 2)}, α-out = ${fmt(aout, 2)}\nPada tiap langkah dihitung uji t parsial (setara uji F parsial) untuk setiap kandidat.`, n: 'Disarankan α-in ≤ α-out agar tidak terjadi putaran masuk-keluar berulang.' }].concat(steps.map((s) => ({ t: `Langkah ${s.step}: ${s.action === 'masuk' ? 'masukkan ' + vn[s.variable] : s.action === 'keluar' ? 'keluarkan ' + vn[s.variable] : 'model penuh'}`, f: `${s.variable === null ? '' : 'p-value = ' + fmtP(s.p) + (s.action === 'masuk' ? ' < α-in' : ' > α-out') + '\n'}Model: ${MS(s.vars)}\nR² = ${fmt(s.r2, 4)}, R² terkoreksi = ${fmt(s.adjr2, 4)}, S = ${g(s.s, 5)}`, n: '' })));
      st.push({ t: 'Model akhir', f: mF ? `${nm[0]} = ${mF.beta.map((b, i) => (i === 0 ? g(b) : (b < 0 ? ' − ' : ' + ') + g(Math.abs(b)) + ' × ' + vn[fin[i - 1]])).join('')}` : 'Tidak ada prediktor yang dipilih.', n: '' });
      const ip = [fin.length ? `Seleksi ${MN[method]} memilih <strong>${fin.length} dari ${p} prediktor</strong>: ${esc(MS(fin))}. Model akhir menjelaskan ${fmt(mF.r2 * 100, 1)}% variasi ${esc(nm[0])} (R² terkoreksi ${fmt(mF.adjr2 * 100, 1)}%), F = ${fmt(mF.F)}, p = ${fmtP(mF.pF)}.` : `Tidak ada prediktor yang memenuhi kriteria masuk (α-in = ${fmt(ain, 2)}); tidak ada hubungan linear yang cukup kuat dengan ${esc(nm[0])}.`];
      if (mF) { const sg = fin.filter((j, i) => mF.p_t[i + 1] < alpha); ip.push(`Pada α = ${fmt(alpha, 2)}, koefisien yang signifikan: ${sg.length ? sg.map((j) => esc(vn[j])).join(', ') : 'tidak ada'}${sg.length < fin.length ? ' (variabel lain dipertahankan karena α-in/α-out lebih longgar)' : ''}.`); }
      if (steps.length > 2 * p + 2) ip.push('Terjadi banyak langkah masuk-keluar; periksa multikolinearitas antar prediktor.');
      ip.push('<strong>Peringatan:</strong> seleksi bertahap otomatis cenderung terlalu optimis (p-value dan R² model akhir menaksir terlalu tinggi) dan hasilnya bisa berbeda antar metode. Pertimbangkan teori bidang, bandingkan dengan Best Subsets, dan validasi pada data baru.');
      ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${MN[method]}</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    }
    ui.publish({ meta: [['Metode', 'Seleksi variabel: ' + MN[method]], ['n', n], ['Prediktor', p], ['Respon', nm[0]]], data: ui.dataExport(nm, nm.map((_, j) => rows.map((r) => r[j]))) });
  };
})();
