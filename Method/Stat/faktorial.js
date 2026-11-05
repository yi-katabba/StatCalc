/* =========================================================================
   FAKTORIAL 2^k (DOE) - analisis rancangan faktorial dua taraf penuh, 2 sampai 5 faktor
   Efek utama & interaksi, uji t / ANOVA, galat murni & lack-of-fit, analisis Lenth untuk desain tanpa replikasi, plot efek utama.
   Kolom: faktor (dua taraf tiap kolom) lalu respon Y di kolom terakhir. Hitungan: quality-core.js (factorial2k). Halaman otomatis: #view-faktorial
   ========================================================================= */
(function () {
  'use strict';
  const QC = window.StatQuality, SV = window.StatSvg, U = window.StatBasicUI, D = window.StatDist;
  if (!QC || !SV || !U || !U.mountPage) return;
  const { esc, fmt, fmtP, pct } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : String(Number(v.toPrecision(d || 5))).replace('.', ','));
  const ui = U.mountPage({
    id: 'faktorial', pre: 'fc', title: 'Faktorial 2^k', eyebrow: 'Metode Statistik &rsaquo; DOE', step1: 'Susun desain &amp; masukkan respon',
    lede: 'Analisis percobaan faktorial dua taraf (2 sampai 5 faktor): efek utama dan interaksi, uji signifikansi (t / ANOVA), galat murni dan lack-of-fit bila ada replikasi, serta analisis Lenth untuk desain tanpa replikasi. Dilengkapi diagram Pareto efek, plot efek utama, persamaan model terkode, dan kombinasi faktor terbaik.',
    settings: `
      <label>Interaksi yang dimasukkan ke model<select id="fcOrder" class="select-input"><option value="all">Semua interaksi</option><option value="3">Sampai orde 3</option><option value="2">Sampai orde 2 (efek utama + interaksi 2 faktor)</option><option value="1">Hanya efek utama</option></select></label>
      <label>Tingkat signifikansi (α)<select id="fcAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>
      <label>Membuat tabel desain: jumlah faktor<select id="fcK" class="select-input"><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label>
      <label>Replikasi<select id="fcRep" class="select-input"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label>
      <div style="grid-column:1/-1"><button type="button" class="btn-ghost" id="fcGen" style="width:100%">Buat tabel desain standar (urutan Yates) → isi respon di kolom Y</button></div>`,
    hint: 'Kolom <strong>terakhir = respon Y</strong>; kolom sebelumnya = faktor, masing-masing tepat <strong>dua taraf</strong> (mis. −1 dan +1, atau 20 dan 30). Satu baris = satu percobaan (run); baris yang sama berulang = replikasi. Minimal 2 faktor dan <strong><span id="fcMin">4</span> percobaan</strong>; maksimal 5 faktor.',
    table: { names: ['A', 'B', 'C', 'Y'], colLabel: 'Faktor', minCols: 3, maxCols: 6, canAddCol: true }, calcLabel: 'Analisis Faktorial',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  function design(k, rep) { const rows = []; for (let r = 0; r < rep; r++) for (let i = 0; i < (1 << k); i++) rows.push(Array.from({ length: k }, (_, j) => ((i >> j) & 1 ? 1 : -1))); return rows; }
  function fillDesign(k, rep, y) { const rows = design(k, rep), nm = Array.from({ length: k }, (_, j) => String.fromCharCode(65 + j)).concat(['Y']); tbl.fill(nm, nm.slice(0, k).map((_, j) => rows.map((r) => r[j])).concat([y || []])); }
  q('fcGen').addEventListener('click', () => { fillDesign(parseInt(q('fcK').value, 10), parseInt(q('fcRep').value, 10)); ui.clearErr(); });
  ui.onSample = () => { const k = 3, rows = design(k, 2), y = rows.map((r, i) => +(60 + 6 * r[0] + 3 * r[1] - 1.5 * r[2] + 4 * r[0] * r[1] + (((i * 37) % 11) - 5) * 0.18).toFixed(2)); fillDesign(k, 2, y); q('fcOrder').value = 'all'; };
  ui.onCalc = () => {
    const alpha = parseFloat(q('fcAlpha').value), ordSel = q('fcOrder').value, { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const nm = tbl.names.map((_, j) => tbl.name(j)), nc = cols.length, k = nc - 1, nr = Math.max.apply(null, cols.map((c) => c.length)), F = [], y = [];
    if (k < 2 || k > 5) return ui.err('Dibutuhkan 2 sampai 5 kolom faktor ditambah 1 kolom respon (kolom terakhir).');
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) return ui.err('Baris ' + (i + 1) + ' belum lengkap (faktor dan respon harus terisi).'); F.push(r.slice(0, k)); y.push(r[k]); }
    if (F.length < Math.pow(2, k)) return ui.err(`Desain 2^${k} lengkap membutuhkan minimal ${Math.pow(2, k)} percobaan (sekarang ${F.length}).`);
    const maxOrder = ordSel === 'all' ? k : Math.min(k, parseInt(ordSel, 10)), fn = nm.slice(0, k); let r;
    try { r = QC.factorial2k(F, y, fn, maxOrder, alpha); } catch (e) { return ui.err(e.levels ? 'Setiap faktor harus tepat dua taraf. Jumlah taraf per faktor sekarang: ' + e.levels.map((l, j) => fn[j] + ' = ' + l).join(', ') + '.' : e.collinear ? 'Model tidak dapat diestimasi (desain tidak lengkap untuk suku yang diminta). Kurangi orde interaksi atau lengkapi kombinasi percobaan.' : 'Terjadi galat perhitungan: ' + e.message); }
    if (Math.max.apply(null, y) === Math.min.apply(null, y)) return ui.err('Semua respon sama persis; tidak ada efek yang dapat dihitung.');
    if (r.dfe > 0 && r.sse <= 1e-10 * Math.max(1, r.sst)) return ui.err('Model cocok sempurna dengan data (galat ≈ 0), sehingga uji signifikansi tidak dapat dihitung. Ini biasanya terjadi pada data simulasi tanpa galat acak atau replikasi yang identik; periksa kembali data respon.');
    const lenthMode = r.dfe === 0, T = r.terms, sigT = (t) => (lenthMode ? Math.abs(t.effect) > r.lenth.me : t.p < alpha);
    let sum = `<table class="result-table bs-res"><caption>Ringkasan desain &amp; model</caption><tbody>
      <tr><td class="lbl">Faktor / taraf</td><td>${k} faktor × 2 taraf (${fn.map((f, j) => esc(f) + ': ' + r.levels[j][0] + ' / ' + r.levels[j][1]).join('; ')})</td></tr><tr><td class="lbl">Jumlah percobaan (N) / kombinasi berbeda</td><td>${r.N} / ${r.nRuns}${r.replicates > 1 ? ' (replikasi ≈ ' + fmt(r.replicates, 2) + ')' : ' (tanpa replikasi)'}</td></tr>
      <tr><td class="lbl">Suku dalam model</td><td>${T.length} (sampai orde ${maxOrder})</td></tr><tr><td class="lbl">Derajat bebas galat</td><td>${r.dfe}${lenthMode ? ' — tidak ada galat: dipakai analisis Lenth' : ''}</td></tr>
      ${r.dfe > 0 ? `<tr><td class="lbl">S / R² / R² terkoreksi</td><td>${g(Math.sqrt(r.mse))} / ${fmt(r.r2 * 100, 2)}% / ${fmt(r.adjr2 * 100, 2)}%</td></tr><tr><td class="lbl">F model (p)</td><td>${fmt(r.F)} (${fmtP(r.pF)})</td></tr>` : `<tr><td class="lbl">R²</td><td>${fmt(r.r2 * 100, 2)}% (model jenuh)</td></tr>`}
      </tbody></table>`;
    if (!r.balanced) sum += '<p class="bs-note"><strong>Perhatian:</strong> desain tidak seimbang (kombinasi tidak lengkap atau jumlah ulangan berbeda); efek dihitung sebagai 2 × koefisien regresi dan kontribusi tidak saling lepas.</p>';
    sum += `<table class="result-table bs-res"><caption>Efek &amp; koefisien (variabel terkode −1 / +1)</caption><thead><tr><th class="lbl">Suku</th><th>Efek</th><th>Koefisien</th>${lenthMode ? '' : '<th>SE koef.</th><th>t</th><th>p-value</th>'}<th>JK</th><th>Kontribusi</th><th>Penting?</th></tr></thead><tbody>` +
      T.map((t) => `<tr><td class="lbl">${esc(t.name)}</td><td>${g(t.effect)}</td><td>${g(t.coef)}</td>${lenthMode ? '' : `<td>${g(t.se)}</td><td>${fmt(t.t, 3)}</td><td class="${t.p < alpha ? 'sig' : ''}">${fmtP(t.p)}</td>`}<td>${g(t.ss)}</td><td>${fmt(t.contrib, 2)}%</td><td>${sigT(t) ? '<span class="bs-dec rej">Ya</span>' : '<span class="bs-dec keep">Tidak</span>'}</td></tr>`).join('') + `</tbody></table>
      <p class="bs-note">Efek = rata-rata respon pada taraf tinggi − rata-rata pada taraf rendah (= 2 × koefisien). ${lenthMode ? `Tanpa replikasi tidak ada galat, sehingga signifikansi dinilai dengan metode Lenth: PSE = ${g(r.lenth.pse)}, margin of error (ME, α = ${fmt(alpha, 2)}) = ${g(r.lenth.me)}, simultaneous ME (SME) = ${g(r.lenth.sme)}; efek dengan |nilai| &gt; ME dianggap penting.` : `Signifikansi dari uji t koefisien (db galat = ${r.dfe}).`}</p>`;
    if (!lenthMode) {
      const nT = T.length; sum += `<table class="result-table bs-res"><caption>Analisis varians</caption><thead><tr><th class="lbl">Sumber</th><th>db</th><th>JK</th><th>KT</th><th>F</th><th>p-value</th></tr></thead><tbody>
        <tr><td class="lbl">Model</td><td>${nT}</td><td>${g(r.ssr)}</td><td>${g(r.ssr / nT)}</td><td>${fmt(r.F)}</td><td class="${r.pF < alpha ? 'sig' : ''}">${fmtP(r.pF)}</td></tr>` +
        [1, 2, 3, 4, 5].filter((o) => T.some((t) => t.order === o)).map((o) => { const ts = T.filter((t) => t.order === o), ss = ts.reduce((a, t) => a + t.ss, 0), df = ts.length, F = ss / df / r.mse; return `<tr><td class="lbl">&nbsp;&nbsp;${o === 1 ? 'Efek utama' : 'Interaksi ' + o + ' faktor'}</td><td>${df}</td><td>${g(ss)}</td><td>${g(ss / df)}</td><td>${fmt(F)}</td><td class="${D.fSf(F, df, r.dfe) < alpha ? 'sig' : ''}">${fmtP(D.fSf(F, df, r.dfe))}</td></tr>`; }).join('') +
        `<tr><td class="lbl">Galat</td><td>${r.dfe}</td><td>${g(r.sse)}</td><td>${g(r.mse)}</td><td></td><td></td></tr>` + (r.lof ? `<tr><td class="lbl">&nbsp;&nbsp;Lack of fit</td><td>${r.lof.df}</td><td>${g(r.lof.ss)}</td><td>${g(r.lof.ss / r.lof.df)}</td><td>${fmt(r.lof.F)}</td><td class="${r.lof.p < alpha ? 'sig' : ''}">${fmtP(r.lof.p)}</td></tr>` : '') + (r.dfpe > 0 ? `<tr><td class="lbl">&nbsp;&nbsp;Galat murni</td><td>${r.dfpe}</td><td>${g(r.sspe)}</td><td>${g(r.sspe / r.dfpe)}</td><td></td><td></td></tr>` : '') + `<tr><td class="lbl">Total</td><td>${r.N - 1}</td><td>${g(r.sst)}</td><td></td><td></td><td></td></tr></tbody></table>`;
      if (r.lof) sum += `<p class="bs-note">Lack of fit ${r.lof.p < alpha ? '<strong>signifikan</strong> (p = ' + fmtP(r.lof.p) + '): model belum menangkap semua pola sistematik (mis. interaksi lebih tinggi atau efek kuadratik)' : 'tidak signifikan (p = ' + fmtP(r.lof.p) + '): model cukup sesuai dengan data'}.</p>`;
    }
    const sorted = T.map((t) => ({ t })).sort((a, b) => (lenthMode ? Math.abs(b.t.effect) - Math.abs(a.t.effect) : Math.abs(b.t.t) - Math.abs(a.t.t)));
    sum += SV.effectBars(lenthMode ? { title: 'Diagram Pareto efek (|efek|)', labels: sorted.map((o) => o.t.name), values: sorted.map((o) => Math.abs(o.t.effect)), sig: sorted.map((o) => sigT(o.t)), refs: [{ v: r.lenth.me, label: 'ME' }, { v: r.lenth.sme, label: 'SME', color: '#d9822b' }], xlabel: 'Nilai mutlak efek' } : { title: 'Diagram Pareto efek terstandar (|t|)', labels: sorted.map((o) => o.t.name), values: sorted.map((o) => Math.abs(o.t.t)), sig: sorted.map((o) => sigT(o.t)), refs: [{ v: D.tCrit(r.dfe, 1 - alpha), label: 't kritis' }], xlabel: '|t| koefisien' });
    sum += '<p class="bs-note" style="text-align:center">Batang oranye = efek penting; garis putus-putus = batas signifikansi.</p>' + SV.mainEffects({ names: fn, means: r.means, grand: r.grand, ylabel: nm[k] });
    // persamaan & kombinasi terbaik
    const m = r.model, eq = 'ŷ = ' + g(m.beta[0]) + T.map((t, i) => (m.beta[i + 1] < 0 ? ' − ' : ' + ') + g(Math.abs(m.beta[i + 1])) + '·' + t.ids.map((j) => fn[j]).join('·')).join('');
    const corners = []; for (let i = 0; i < (1 << k); i++) { const cd = Array.from({ length: k }, (_, j) => ((i >> j) & 1 ? 1 : -1)); corners.push({ cd, fit: m.beta[0] + T.reduce((a, t, ti) => a + m.beta[ti + 1] * t.ids.reduce((p, j) => p * cd[j], 1), 0) }); }
    corners.sort((a, b) => b.fit - a.fit);
    sum += `<table class="result-table bs-res"><caption>Persamaan model (variabel terkode −1 / +1)</caption><tbody><tr><td class="lbl">${esc(nm[k])}</td><td>${esc(eq)}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Prediksi pada kombinasi taraf (respon tertinggi → terendah)</caption><thead><tr><th class="lbl">Peringkat</th>${fn.map((f) => `<th>${esc(f)}</th>`).join('')}<th>Prediksi ${esc(nm[k])}</th></tr></thead><tbody>${corners.slice(0, Math.min(8, corners.length)).map((c, i) => `<tr><td class="lbl">${i + 1}</td>${c.cd.map((v, j) => `<td>${r.levels[j][v > 0 ? 1 : 0]}</td>`).join('')}<td>${g(c.fit)}</td></tr>`).join('')}</tbody></table>`;
    const st = [{ t: 'Pengodean faktor', f: fn.map((f, j) => `${f}: ${r.levels[j][0]} → −1,  ${r.levels[j][1]} → +1`).join('\n') + '\nKolom interaksi = hasil kali kolom faktor terkode (mis. AB = A × B)', n: 'Dengan kode ±1 dan desain seimbang, kolom-kolom bersifat ortogonal sehingga efek dapat dihitung terpisah.' },
      { t: 'Efek', f: `Efek suku = (jumlah Y pada taraf +) / (N/2) − (jumlah Y pada taraf −) / (N/2) = 2 × koefisien\n${T.slice(0, 6).map((t) => `${t.name}: ${g(t.effect)}`).join('\n')}${T.length > 6 ? '\n…' : ''}`, n: `N = ${r.N} percobaan.` },
      { t: 'Jumlah kuadrat', f: `JK suku = N × (koefisien)² = N × (efek/2)²\nKontribusi = JK suku / JK Total × 100%\nJK Total = ${g(r.sst)}`, n: '' }];
    if (lenthMode) st.push({ t: 'Metode Lenth (tanpa replikasi)', f: `s₀ = 1,5 × median |efek|\nPSE = 1,5 × median{ |efek| : |efek| < 2,5 s₀ } = ${g(r.lenth.pse)}\nME = t(1 − α/2; db = m/3 = ${fmt(r.lenth.df, 3)}) × PSE = ${g(r.lenth.me)}\nSME = t(γ; db) × PSE dengan γ = [1 + (1 − α)^(1/m)] / 2 = ${g(r.lenth.sme)}`, n: 'PSE menaksir galat baku efek dengan mengabaikan efek besar (yang dianggap nyata).' });
    else st.push({ t: 'Galat & uji', f: `KT Galat (MSE) = JK Galat / db = ${g(r.sse)} / ${r.dfe} = ${g(r.mse)}\nSE efek = 2 × √(MSE / N) = ${g(2 * Math.sqrt(r.mse / r.N))}\nt = koefisien / SE koefisien,  db = ${r.dfe}${r.dfpe > 0 ? `\nGalat murni: JK = ${g(r.sspe)}, db = ${r.dfpe}` : ''}`, n: '' });
    st.push({ t: 'Keputusan', f: T.filter(sigT).length ? 'Suku penting: ' + T.filter(sigT).map((t) => t.name).join(', ') : 'Tidak ada suku yang penting pada α = ' + fmt(alpha, 2), n: '' });
    const imp = T.filter(sigT).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)), best = corners[0], low = corners[corners.length - 1];
    const ip = [`<strong>Ringkasan:</strong> dari ${T.length} suku dalam model, <strong>${imp.length}</strong> berpengaruh penting pada α = ${fmt(alpha, 2)}${imp.length ? ': ' + imp.map((t) => `${esc(t.name)} (efek ${g(t.effect, 4)})`).join(', ') : ''}. Model menjelaskan ${fmt(r.r2 * 100, 1)}% variasi respon.`];
    imp.filter((t) => t.order === 1).forEach((t) => ip.push(`<strong>${esc(t.name)}</strong>: menaikkan faktor dari ${r.levels[t.ids[0]][0]} ke ${r.levels[t.ids[0]][1]} ${t.effect > 0 ? 'menaikkan' : 'menurunkan'} respon rata-rata sebesar ${g(Math.abs(t.effect), 4)}.`));
    const inter = imp.filter((t) => t.order >= 2); if (inter.length) ip.push(`<strong>Interaksi penting:</strong> ${inter.map((t) => esc(t.name)).join(', ')} — pengaruh satu faktor bergantung pada taraf faktor lain, sehingga efek utama yang terlibat sebaiknya tidak ditafsirkan sendiri-sendiri.`);
    ip.push(`<strong>Kombinasi terbaik (respon tertinggi menurut model):</strong> ${fn.map((f, j) => `${esc(f)} = ${r.levels[j][best.cd[j] > 0 ? 1 : 0]}`).join(', ')} dengan prediksi ${g(best.fit)}; terendah ${g(low.fit)}. ${r.dfe > 0 ? '' : 'Karena tidak ada replikasi, prediksi ini belum disertai ukuran ketidakpastian.'}`);
    if (lenthMode) ip.push('<strong>Catatan:</strong> desain tanpa replikasi dianalisis dengan metode Lenth (aproksimasi). Untuk uji yang lebih tegas, lakukan replikasi atau gabungkan interaksi orde tinggi sebagai galat (pilih “Sampai orde 2”).');
    ip.push('<strong>Asumsi:</strong> galat menyebar normal dengan ragam sama pada semua kombinasi, percobaan dilakukan acak, dan respon berubah linear antara dua taraf (periksa dengan titik pusat bila memungkinkan).');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Faktorial 2^${k}${r.replicates > 1 ? ' dengan replikasi' : ''}</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Faktorial 2^' + k], ['Percobaan', r.N], ['Faktor', fn.join(', ')], ['Respon', nm[k]], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm, nm.map((_, j) => (j < k ? F.map((rw) => rw[j]) : y))) });
  };
})();
