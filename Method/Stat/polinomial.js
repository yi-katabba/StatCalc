/* =========================================================================
   REGRESI POLINOMIAL (Regression) - derajat 1-6, x dipusatkan, perbandingan derajat, prediksi & grafik
   Hitungan: reg-core.js (polyFit, polyPredict, polyCompare). Halaman otomatis: #view-polinomial
   ========================================================================= */
(function () {
  'use strict';
  const RG = window.StatRegX, U = window.StatBasicUI, D = window.StatDist;
  if (!RG || !U || !D || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP, pct } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : String(Number(v.toPrecision(d || 6))).replace('.', ','));
  const ui = U.mountPage({
    id: 'polinomial', pre: 'pn', title: 'Regresi Polinomial', eyebrow: 'Metode Statistik &rsaquo; Regression', step1: 'Atur model &amp; masukkan data',
    lede: 'Modelkan hubungan melengkung antara X dan Y dengan polinomial derajat 1 sampai 6. Variabel X dipusatkan pada rata-ratanya untuk mengurangi multikolinearitas. Dilengkapi uji koefisien, tabel ANOVA, perbandingan derajat (R² terkoreksi, AIC, BIC, uji F bertahap), prediksi dengan selang kepercayaan, dan grafik.',
    settings: `
      <label>Derajat polinomial<select id="pnDeg" class="select-input"><option value="1">1 (linear)</option><option value="2" selected>2 (kuadratik)</option><option value="3">3 (kubik)</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select></label>
      <label>Prediksi pada X = (opsional)<input type="text" id="pnX0" class="plain-input" inputmode="decimal" autocomplete="off" placeholder="mis. 5,5"></label>
      <label>Tingkat signifikansi (α)<select id="pnAlpha" class="select-input"><option value="0.10">0,10 (CI 90%)</option><option value="0.05" selected>0,05 (CI 95%)</option><option value="0.01">0,01 (CI 99%)</option></select></label>`,
    hint: 'Kolom 1 = X (prediktor), kolom 2 = Y (respon). Minimal <strong><span id="pnMin">4</span> pasang data</strong>; harus ada cukup nilai X yang berbeda (minimal derajat + 1). Baris yang tidak lengkap tidak boleh ada.',
    table: { names: ['X', 'Y'], colLabel: 'Kolom', minCols: 2, maxCols: 2 }, calcLabel: 'Hitung Regresi Polinomial',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => { const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], y = [2.1, 4.8, 8.2, 10.1, 12.9, 13.8, 14.6, 14.1, 13.2, 11.5, 8.9, 5.7]; tbl.fill(['X', 'Y'], [x, y]); q('pnDeg').value = '2'; q('pnX0').value = '6,5'; };

  function svg(x, y, m, alpha) {   // diagram pencar + kurva + pita CI rata-rata
    const W = 560, H = 320, L = 52, Rr = 16, T = 14, B = 40, n = x.length, xmin = Math.min.apply(null, x), xmax = Math.max.apply(null, x);
    const pts = []; for (let i = 0; i <= 120; i++) { const xv = xmin + (xmax - xmin) * i / 120, pr = RG.polyPredict(m, xv, alpha); pts.push([xv, pr.fit, pr.ci[0], pr.ci[1]]); }
    const ys = y.concat(pts.map((p) => p[2]), pts.map((p) => p[3])), ymin0 = Math.min.apply(null, ys), ymax0 = Math.max.apply(null, ys), pad = (ymax0 - ymin0) * 0.06 || 1, ymin = ymin0 - pad, ymax = ymax0 + pad;
    const tick = (a, b, c) => { const r = (b - a) / c, p = Math.pow(10, Math.floor(Math.log10(r))), f = r / p, s = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, o = []; for (let v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) o.push(Math.abs(v) < s * 1e-9 ? 0 : v); return o; };
    const sx = (v) => L + (v - xmin) / ((xmax - xmin) || 1) * (W - L - Rr), sy = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagram pencar dan kurva regresi polinomial" style="width:100%;max-width:640px;height:auto;display:block;margin:12px auto 0;font-family:var(--font-body);font-size:11px">`;
    tick(xmin, xmax, 7).forEach((v) => { s += `<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${H - B}" style="stroke:var(--rule)"/><text x="${sx(v)}" y="${H - B + 15}" text-anchor="middle" style="fill:var(--ink-soft)">${esc(fmt(v, 3))}</text>`; });
    tick(ymin, ymax, 6).forEach((v) => { s += `<line x1="${L}" y1="${sy(v)}" x2="${W - Rr}" y2="${sy(v)}" style="stroke:var(--rule)"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end" style="fill:var(--ink-soft)">${esc(fmt(v, 3))}</text>`; });
    s += `<path d="M${pts.map((p) => sx(p[0]).toFixed(1) + ',' + sy(p[2]).toFixed(1)).join(' L')} L${pts.slice().reverse().map((p) => sx(p[0]).toFixed(1) + ',' + sy(p[3]).toFixed(1)).join(' L')} Z" style="fill:var(--accent-2);fill-opacity:.14;stroke:none"/>`;
    s += `<path d="M${pts.map((p) => sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1)).join(' L')}" style="fill:none;stroke:var(--accent-2);stroke-width:2.2"/>`;
    x.forEach((xv, i) => { s += `<circle cx="${sx(xv).toFixed(1)}" cy="${sy(y[i]).toFixed(1)}" r="3.6" style="fill:var(--ink);fill-opacity:.8"/>`; });
    s += `<rect x="${L}" y="${T}" width="${W - L - Rr}" height="${H - T - B}" style="fill:none;stroke:var(--ink-faint)"/><text x="${(L + W - Rr) / 2}" y="${H - 6}" text-anchor="middle" style="fill:var(--ink)">${esc(tbl.name(0))}</text><text transform="rotate(-90)" x="${-(T + H - B) / 2}" y="13" text-anchor="middle" style="fill:var(--ink)">${esc(tbl.name(1))}</text></svg>`;
    return s + `<p class="bs-note" style="text-align:center">Titik = data, garis = kurva polinomial derajat ${m.deg}, pita = selang kepercayaan ${pct(1 - alpha)} untuk rata-rata Y.</p>`;
  }
  ui.onCalc = () => {
    const deg = parseInt(q('pnDeg').value, 10), alpha = parseFloat(q('pnAlpha').value), x0v = q('pnX0').value.trim() === '' ? null : toNum(q('pnX0').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    if (x0v !== null && Number.isNaN(x0v)) return ui.err('Nilai X untuk prediksi harus berupa angka.');
    const x = [], y = [], len = Math.max(cols[0].length, cols[1].length);
    for (let i = 0; i < len; i++) { const a = cols[0][i] === undefined ? null : cols[0][i], b = cols[1][i] === undefined ? null : cols[1][i]; if (a === null && b === null) continue; if (a === null || b === null) return ui.err('Baris ' + (i + 1) + ' hanya terisi satu sisi. X dan Y harus lengkap.'); x.push(a); y.push(b); }
    const n = x.length; if (n < deg + 2) return ui.err(`Derajat ${deg} membutuhkan minimal ${deg + 2} pasang data (sekarang ${n}).`);
    if (new Set(x).size < deg + 1) return ui.err(`Derajat ${deg} membutuhkan minimal ${deg + 1} nilai X yang berbeda (sekarang ${new Set(x).size}).`);
    let m; try { m = RG.polyFit(x, y, deg); } catch (e) { return ui.err('Model tidak dapat dihitung (kolinearitas sempurna). Kurangi derajat atau periksa data.'); }
    if (!(m.sse > 1e-20 * Math.max(1, m.sst))) return ui.err('Kurva melewati semua titik data (galat = 0); turunkan derajat agar uji statistik dapat dihitung.');
    const cmp = RG.polyCompare(x, y, Math.min(6, n - 2)), nmX = tbl.name(0), nmY = tbl.name(1), sigF = m.pF < alpha, c = m.center;
    const termName = (d) => d === 0 ? 'Konstanta' : d === 1 ? `(${nmX} − ${g(c, 5)})` : `(${nmX} − ${g(c, 5)})${d === 2 ? '²' : d === 3 ? '³' : '⁴⁵⁶'[d - 4] ? ['⁴', '⁵', '⁶'][d - 4] : '^' + d}`;
    const eq = (coef, center) => 'ŷ = ' + coef.map((b, d) => { const t = d === 0 ? '' : (center ? `(${nmX} − ${g(c, 5)})` : nmX) + (d > 1 ? '^' + d : ''); return (d === 0 ? g(b) : (b < 0 ? ' − ' : ' + ') + g(Math.abs(b))) + (t ? ' · ' + t : ''); }).join('');
    let sum = svg(x, y, m, alpha);
    sum += `<table class="result-table bs-res"><caption>Ringkasan model derajat ${deg} (n = ${n})</caption><tbody><tr><td class="lbl">S (galat baku regresi)</td><td>${g(m.s)}</td></tr><tr><td class="lbl">R²</td><td>${fmt(m.r2, 4)} (${fmt(m.r2 * 100, 2)}%)</td></tr><tr><td class="lbl">R² terkoreksi</td><td>${fmt(m.adjr2, 4)}</td></tr><tr><td class="lbl">AIC / BIC</td><td>${fmt(m.aic, 3)} / ${fmt(m.bic, 3)}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Analisis varians regresi</caption><thead><tr><th class="lbl">Sumber</th><th>db</th><th>JK</th><th>KT</th><th>F</th><th>p-value</th></tr></thead><tbody><tr><td class="lbl">Regresi</td><td>${m.dfm}</td><td>${g(m.ssr)}</td><td>${g(m.ssr / m.dfm)}</td><td>${fmt(m.F)}</td><td class="${sigF ? 'sig' : ''}">${fmtP(m.pF)}</td></tr><tr><td class="lbl">Galat</td><td>${m.dfe}</td><td>${g(m.sse)}</td><td>${g(m.mse)}</td><td></td><td></td></tr><tr><td class="lbl">Total</td><td>${n - 1}</td><td>${g(m.sst)}</td><td></td><td></td><td></td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Koefisien (X dipusatkan pada ${g(c, 5)})</caption><thead><tr><th class="lbl">Suku</th><th>Koefisien</th><th>SE</th><th>t</th><th>p-value</th></tr></thead><tbody>${m.beta.map((b, d) => `<tr><td class="lbl">${termName(d)}</td><td>${g(b)}</td><td>${g(m.se[d])}</td><td>${fmt(m.t[d], 3)}</td><td class="${m.p_t[d] < alpha ? 'sig' : ''}">${fmtP(m.p_t[d])}</td></tr>`).join('')}</tbody></table>
      <table class="result-table bs-res"><caption>Persamaan regresi</caption><tbody><tr><td class="lbl">X dipusatkan</td><td>${esc(eq(m.beta, true))}</td></tr><tr><td class="lbl">Skala X asli</td><td>${esc(eq(m.coefOrig, false))}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Perbandingan derajat polinomial</caption><thead><tr><th class="lbl">Derajat</th><th>R²</th><th>R² terkoreksi</th><th>S</th><th>AIC</th><th>BIC</th><th>F tambahan</th><th>p (suku derajat tertinggi)</th></tr></thead><tbody>${cmp.map((r) => `<tr><td class="lbl">${r.deg}${r.deg === deg ? ' ◄' : ''}</td><td>${fmt(r.r2, 4)}</td><td>${fmt(r.adjr2, 4)}</td><td>${g(r.s, 4)}</td><td>${fmt(r.aic, 2)}</td><td>${fmt(r.bic, 2)}</td><td>${fmt(r.Finc, 3)}</td><td class="${r.pInc < alpha ? 'sig' : ''}">${fmtP(r.pInc)}</td></tr>`).join('')}</tbody></table>`;
    let pr = null; if (x0v !== null) { pr = RG.polyPredict(m, x0v, alpha); const out = x0v < Math.min.apply(null, x) || x0v > Math.max.apply(null, x); sum += `<table class="result-table bs-res"><caption>Prediksi pada ${esc(nmX)} = ${fmt(x0v)}</caption><tbody><tr><td class="lbl">Nilai prediksi (ŷ)</td><td>${g(pr.fit)}</td></tr><tr><td class="lbl">SE rata-rata</td><td>${g(pr.seMean)}</td></tr><tr><td class="lbl">CI ${pct(1 - alpha)} rata-rata Y</td><td>[${g(pr.ci[0])} ; ${g(pr.ci[1])}]</td></tr><tr><td class="lbl">PI ${pct(1 - alpha)} satu pengamatan baru</td><td>[${g(pr.pi[0])} ; ${g(pr.pi[1])}]</td></tr></tbody></table>${out ? '<p class="bs-note"><strong>Perhatian:</strong> nilai X berada di luar rentang data (ekstrapolasi); polinomial dapat menyimpang tajam di luar rentang data.</p>' : ''}`; }
    sum += '<p class="bs-note">Perbandingan derajat: F tambahan menguji apakah suku derajat tertinggi menambah kecocokan. Pilih derajat terkecil yang masih memberi perbaikan nyata (R² terkoreksi naik, AIC/BIC turun). Derajat tinggi mudah <em>overfitting</em>.</p>';
    const bestAdj = cmp.reduce((a, b) => (b.adjr2 > a.adjr2 ? b : a)), bestBic = cmp.reduce((a, b) => (b.bic < a.bic ? b : a));
    const st = [{ t: 'Model', f: `ŷ = β₀ + β₁(x − x̄) + β₂(x − x̄)² + … + β${deg}(x − x̄)^${deg}\nx̄ = ${g(c, 6)} (pemusatan mengurangi korelasi antar suku pangkat)`, n: '' },
      { t: 'Penaksiran kuadrat terkecil', f: `Matriks desain X (n = ${n} × ${deg + 1}) diuraikan dengan QR Householder: X = QR\nβ̂ = R⁻¹ Qᵀy\n${m.beta.map((b, d) => `β̂${d} = ${g(b)}`).join('\n')}`, n: 'Penguraian QR lebih stabil secara numerik daripada membalik XᵀX.' },
      { t: 'Jumlah kuadrat', f: `JK Galat = Σ(y − ŷ)² = ${g(m.sse)}\nJK Total = Σ(y − ȳ)² = ${g(m.sst)}\nJK Regresi = JK Total − JK Galat = ${g(m.ssr)}\nR² = JK Regresi / JK Total = ${fmt(m.r2, 5)}\nR² terkoreksi = 1 − [JK Galat/${m.dfe}] / [JK Total/${n - 1}] = ${fmt(m.adjr2, 5)}`, n: '' },
      { t: 'Uji F model', f: `F = (JK Regresi / ${m.dfm}) / (JK Galat / ${m.dfe}) = ${fmt(m.F)},  p-value = ${fmtP(m.pF)}`, n: 'H₀: semua koefisien suku x sama dengan 0.' },
      { t: 'Uji t tiap koefisien', f: m.beta.map((b, d) => `${termName(d)}: t = ${g(b)} / ${g(m.se[d])} = ${fmt(m.t[d], 3)}, p = ${fmtP(m.p_t[d])}`).join('\n'), n: 'SE = √(KT Galat × elemen diagonal (XᵀX)⁻¹), df = ' + m.dfe + '.' }];
    if (pr) st.push({ t: 'Prediksi', f: `h = xᵀ(XᵀX)⁻¹x untuk x = ${fmt(x0v)}\nSE rata-rata = √(KT Galat × h) = ${g(pr.seMean)}\nCI = ŷ ± t(${m.dfe}) × SE;  PI = ŷ ± t × √(KT Galat × (1 + h))`, n: '' });
    st.push({ t: 'Memilih derajat', f: cmp.map((r) => `Derajat ${r.deg}: R² terkoreksi ${fmt(r.adjr2, 4)}, BIC ${fmt(r.bic, 2)}, p suku tertinggi ${fmtP(r.pInc)}`).join('\n') + `\n→ R² terkoreksi terbesar: derajat ${bestAdj.deg}; BIC terkecil: derajat ${bestBic.deg}`, n: '' });
    const top = m.p_t[deg], ip = [`<strong>Model keseluruhan:</strong> F = ${fmt(m.F)}, p-value = <strong>${fmtP(m.pF)}</strong> ${sigF ? '<' : '≥'} α = ${fmt(alpha, 2)} → ${sigF ? 'model polinomial derajat ' + deg + ' <strong>signifikan</strong>' : 'model tidak signifikan'}. R² = ${fmt(m.r2, 3)}: ${fmt(m.r2 * 100, 1)}% variasi ${esc(nmY)} dijelaskan oleh ${esc(nmX)}.`,
      `<strong>Suku derajat tertinggi</strong> (pangkat ${deg}): p = ${fmtP(top)} → ${top < alpha ? 'nyata, derajat ' + deg + ' diperlukan' : 'tidak nyata' + (deg > 1 ? '; pertimbangkan derajat ' + (deg - 1) : '')}.`,
      `Perbandingan: R² terkoreksi tertinggi pada derajat <strong>${bestAdj.deg}</strong>, BIC terendah pada derajat <strong>${bestBic.deg}</strong>${bestAdj.deg === deg && bestBic.deg === deg ? ' — derajat terpilih konsisten.' : '; periksa apakah derajat terpilih tidak terlalu rumit.'}`];
    if (pr) ip.push(`Prediksi ${esc(nmY)} pada ${esc(nmX)} = ${fmt(x0v)}: ŷ = ${g(pr.fit)} (CI rata-rata [${g(pr.ci[0])} ; ${g(pr.ci[1])}], PI [${g(pr.pi[0])} ; ${g(pr.pi[1])}]).`);
    if (deg >= 4 || n < 3 * (deg + 1)) ip.push('<strong>Peringatan:</strong> derajat tinggi dan/atau data sedikit rawan <em>overfitting</em>; prediksi di luar rentang data tidak andal. Periksa grafik dan residual.');
    ip.push('<strong>Asumsi:</strong> galat menyebar normal dengan ragam tetap, pengamatan saling bebas, dan bentuk hubungan memang dapat didekati polinomial.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Regresi polinomial derajat ${deg}</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Regresi polinomial derajat ' + deg], ['n', n], ['R²', fmt(m.r2, 4)], ['α', fmt(alpha, 2)]], data: ui.dataExport([nmX, nmY], [x, y]) });
  };
})();
