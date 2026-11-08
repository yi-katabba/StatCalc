/* =========================================================================
   SEM - Structural Equation Modeling (Multivariate): CB-SEM (maximum likelihood) dan PLS-SEM (+ bootstrap)
   Model ditulis dengan sintaks mirip lavaan (=~, <~, ~, ~~). Hitungan: sem-core.js. Halaman otomatis: #view-sem
   ========================================================================= */
(function () {
  'use strict';
  const SE = window.StatSEM, U = window.StatBasicUI;
  if (!SE || !U || !U.mountPage) return;
  const { esc, fmt, fmtP, pct } = U;
  const style = document.createElement('style');
  style.textContent = `
    .bs-set label.sem-wide{ grid-column:1 / -1; }
    .sem-model{ width:100%; min-height:176px; resize:vertical; border:1px solid var(--rule); border-radius:10px; padding:10px 12px; font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; background:#fff; color:var(--ink); box-sizing:border-box; }
    .sem-model:focus{ outline:2px solid var(--accent-2); outline-offset:-1px; }
    .sem-syntax{ font-size:12.5px; color:var(--ink-faint); font-weight:400; line-height:1.55; }
    .sem-syntax code{ font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; background:var(--paper-2); padding:1px 5px; border-radius:4px; }
    .bs-res td.ok{ color:var(--good); font-weight:700; } .bs-res td.warn{ color:#B45309; font-weight:700; } .bs-res td.bad{ color:#B3261E; font-weight:700; }
    .sem-warn{ margin:10px 0 0; padding:9px 12px; border-left:3px solid #B45309; background:#FFF7E6; font-size:13px; border-radius:6px; }`;
  document.head.appendChild(style);

  const SAMPLE_MODEL = '# Kualitas layanan -> Kepuasan -> Loyalitas\nKualitas  =~ kl1 + kl2 + kl3\nKepuasan  =~ kp1 + kp2 + kp3\nLoyalitas =~ ly1 + ly2 + ly3\n\nKepuasan  ~ Kualitas\nLoyalitas ~ Kepuasan + Kualitas';
  const ui = U.mountPage({
    id: 'sem', pre: 'sx', title: 'SEM (Structural Equation Modeling)', eyebrow: 'Metode Statistik &rsaquo; Multivariate', step1: 'Tulis model &amp; masukkan data',
    lede: 'Uji model hubungan antar konstruk laten dan variabel teramati sekaligus: model pengukuran (loading, reliabilitas, validitas) dan model struktural (jalur, efek langsung, tidak langsung, dan total). Tersedia dua pendekatan: CB-SEM (maximum likelihood, lengkap dengan indeks kecocokan model) dan PLS-SEM (algoritma PLS dengan bootstrap).',
    settings: `
      <label>Metode estimasi<select id="sxEst" class="select-input"><option value="cb">CB-SEM (maximum likelihood)</option><option value="pls">PLS-SEM (partial least squares)</option></select></label>
      <label id="sxLblScale">Skala konstruk laten<select id="sxScale" class="select-input"><option value="marker">Indikator pertama = 1 (marker)</option><option value="std">Varians laten = 1 (baku)</option></select></label>
      <label id="sxLblScheme" style="display:none">Skema bobot internal<select id="sxScheme" class="select-input"><option value="path">Jalur (path weighting)</option><option value="centroid">Centroid</option><option value="factorial">Faktorial</option></select></label>
      <label id="sxLblBoot" style="display:none">Bootstrap<select id="sxBoot" class="select-input"><option value="0">Tanpa bootstrap</option><option value="200">200 resampel</option><option value="500" selected>500 resampel</option><option value="1000">1.000 resampel</option><option value="5000">5.000 resampel</option></select></label>
      <label class="sem-wide">Model (satu persamaan per baris)<textarea id="sxModel" class="sem-model" spellcheck="false" autocomplete="off">${SAMPLE_MODEL}</textarea>
        <span class="sem-syntax"><code>F =~ x1 + x2 + x3</code> konstruk reflektif · <code>F &lt;~ x1 + x2</code> konstruk formatif (PLS-SEM) · <code>Y ~ F + X</code> jalur struktural (konstruk atau variabel teramati) · <code>x1 ~~ x2</code> kovarians galat · <code># komentar</code>. Nama indikator harus sama dengan judul kolom data.</span></label>`,
    hint: 'Baris = responden, kolom = indikator/variabel numerik (judul kolom dapat diubah; harus sama dengan nama di model). Minimal <strong><span id="sxMin">30</span> pengamatan</strong> lengkap pada variabel yang dipakai; baris dengan sel kosong dibuang. Pedoman umum: ≥ 200 responden untuk CB-SEM, atau ≥ 5–10 responden per parameter.',
    table: { names: ['kl1', 'kl2', 'kl3', 'kp1', 'kp2', 'kp3', 'ly1', 'ly2', 'ly3'], colLabel: 'x', minCols: 3, maxCols: 40, canAddCol: true }, calcLabel: 'Hitung SEM',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  const syncSettings = () => { const pls = q('sxEst').value === 'pls'; q('sxLblScale').style.display = pls ? 'none' : ''; q('sxLblScheme').style.display = pls ? '' : 'none'; q('sxLblBoot').style.display = pls ? '' : 'none'; };
  q('sxEst').addEventListener('change', syncSettings); syncSettings();

  ui.onSample = () => {
    let s = 2024; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, nrm = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
    const names = ['kl1', 'kl2', 'kl3', 'kp1', 'kp2', 'kp3', 'ly1', 'ly2', 'ly3'], C = names.map(() => []), lam = [0.85, 0.8, 0.75];
    for (let i = 0; i < 180; i++) {
      const kl = nrm(), kp = 0.6 * kl + 0.8 * nrm(), ly = 0.5 * kp + 0.25 * kl + 0.75 * nrm();
      [kl, kp, ly].forEach((f, b) => lam.forEach((l, k) => C[b * 3 + k].push(Math.max(1, Math.min(7, +(4 + 1.1 * (l * f + Math.sqrt(1 - l * l) * nrm())).toFixed(0))))));
    }
    tbl.fill(names, C); q('sxModel').value = SAMPLE_MODEL;
  };

  /* ---------- pembantu tampilan ---------- */
  const th = (arr) => '<tr>' + arr.map((h, i) => `<th${i === 0 ? ' class="lbl"' : ''}>${h}</th>`).join('') + '</tr>';
  const td = (c, i) => (i === 0 ? `<td class="lbl">${c}</td>` : (c !== null && typeof c === 'object' ? `<td class="${c.cls || ''}">${c.v}</td>` : `<td>${c}</td>`));
  const tr = (arr) => '<tr>' + arr.map(td).join('') + '</tr>';
  const table = (cap, head, rows) => `<table class="result-table bs-res"><caption>${cap}</caption><thead>${th(head)}</thead><tbody>${rows.map((r) => (typeof r === 'string' ? r : tr(r))).join('')}</tbody></table>`;
  const pc = (p) => ({ v: fmtP(p), cls: p !== null && p !== undefined && p < 0.05 ? 'sig' : '' });
  const f3 = (v) => fmt(v, 3), f4 = (v) => fmt(v, 4);
  const lvl = (v, good, ok, hi) => { const g = hi ? v >= good : v <= good, o = hi ? v >= ok : v <= ok; return g ? { v: 'baik', cls: 'ok' } : o ? { v: 'cukup', cls: 'warn' } : { v: 'kurang', cls: 'bad' }; };
  const warnBox = (arr) => (arr.length ? `<p class="sem-warn"><strong>Peringatan:</strong> ${arr.map(esc).join(' ')}</p>` : '');

  function collectData(spec) {
    const { cols, bad } = tbl.collect();
    if (bad.length) return { err: 'Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.' };
    const nm = tbl.names.map((_, j) => tbl.name(j)), dup = nm.find((x, i) => nm.indexOf(x) !== i); if (dup) return { err: 'Nama kolom "' + dup + '" muncul lebih dari sekali; beri nama unik.' };
    return { cols, nm };
  }

  ui.onCalc = () => {
    const mdl = q('sxModel').value, est = q('sxEst').value, cd = collectData(); if (cd.err) return ui.err(cd.err);
    const { cols, nm } = cd; let spec; try { spec = SE.parseModel(mdl, nm); } catch (e) { return ui.err(e.message); }
    const used = spec.observed.map((c) => nm.indexOf(c)), nr = Math.max.apply(null, cols.map((c) => c.length)), X = []; let dropped = 0;
    for (let i = 0; i < nr; i++) { const r = used.map((j) => (cols[j][i] === undefined ? null : cols[j][i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) { dropped++; continue; } X.push(r); }
    if (X.length < 30 && est === 'cb') return ui.err('CB-SEM membutuhkan minimal 30 pengamatan lengkap pada variabel model (sekarang ' + X.length + '; disarankan ≥ 200).');
    if (X.length < 10) return ui.err('Dibutuhkan minimal 10 pengamatan lengkap pada variabel model (sekarang ' + X.length + ').');
    const data = { names: spec.observed, X }, exp = ui.dataExport(spec.observed, spec.observed.map((_, j) => X.map((r) => r[j])));
    try {
      if (est === 'cb') { const r = SE.fitCB(spec, X, { scale: q('sxScale').value }); renderCB(spec, r, dropped, exp); } else {
        const B = parseInt(q('sxBoot').value, 10), r = SE.fitPLS(spec, data, { scheme: q('sxScheme').value, boot: B, seed: 12345 }); renderPLS(spec, r, dropped, exp);
      }
    } catch (e) { ui.err(e.message || String(e)); }
  };

  /* =============================== CB-SEM =============================== */
  function renderCB(spec, r, dropped, exp) {
    const f = r.fit, nm = spec.latents.map((l) => l.name), loads = r.params.filter((x) => x.kind === 'loading'), regs = r.params.filter((x) => x.kind === 'reg');
    const covs = r.params.filter((x) => x.kind === 'cov'), vars = r.params.filter((x) => x.kind === 'var' && x.free);
    let sum = table('Ringkasan model', ['Keterangan', 'Nilai'], [
      ['Metode estimasi', 'CB-SEM, maximum likelihood (skala laten: ' + (r.scale === 'std' ? 'varians laten = 1' : 'indikator pertama = 1') + ')'],
      ['Pengamatan lengkap (N)', r.N + (dropped ? ` (${dropped} baris dengan sel kosong dibuang)` : '')],
      ['Variabel teramati / konstruk laten', r.p + ' / ' + r.m],
      ['Parameter bebas / elemen kovarians / derajat bebas', r.q + ' / ' + r.moments + ' / ' + r.df],
      ['Konvergensi', r.converged ? 'tercapai (' + r.iterations + ' iterasi)' : '<span class="flag">belum konvergen</span> (' + r.iterations + ' iterasi)'],
    ]);
    sum += warnBox(r.warnings);
    if (r.df > 0) {
      const fr = [
        ['Chi-square (χ²)', f3(r.chi2), 'db = ' + r.df + ', p ' + (r.pChi2 < 0.0001 ? '< 0,0001' : '= ' + fmtP(r.pChi2)), { v: r.pChi2 > 0.05 ? 'baik' : 'sensitif terhadap N', cls: r.pChi2 > 0.05 ? 'ok' : 'warn' }, 'p > 0,05'],
        ['χ² / db', f3(f.chiRatio), '', lvl(f.chiRatio, 2, 3, false), '≤ 2 (≤ 3 cukup)'],
        ['RMSEA', f4(f.rmsea), 'CI 90%: ' + f4(f.rmseaLo) + ' – ' + f4(f.rmseaHi) + '; p(≤ 0,05) = ' + fmtP(f.pClose), lvl(f.rmsea, 0.05, 0.08, false), '≤ 0,05 (≤ 0,08 cukup)'],
        ['SRMR', f4(f.srmr), '', lvl(f.srmr, 0.05, 0.08, false), '≤ 0,05 (≤ 0,08 cukup)'],
        ['CFI', f4(f.cfi), '', lvl(f.cfi, 0.95, 0.90, true), '≥ 0,95 (≥ 0,90 cukup)'],
        ['TLI (NNFI)', f4(f.tli), '', lvl(f.tli, 0.95, 0.90, true), '≥ 0,95 (≥ 0,90 cukup)'],
        ['NFI', f4(f.nfi), '', lvl(f.nfi, 0.95, 0.90, true), '≥ 0,95 (≥ 0,90 cukup)'],
        ['GFI', f4(f.gfi), '', lvl(f.gfi, 0.95, 0.90, true), '≥ 0,95 (≥ 0,90 cukup)'],
        ['AGFI', f4(f.agfi), '', lvl(f.agfi, 0.90, 0.80, true), '≥ 0,90 (≥ 0,80 cukup)'],
        ['AIC / BIC', f3(f.aic) + ' / ' + f3(f.bic), '', '', 'lebih kecil lebih baik (membandingkan model)'],
      ];
      sum += table('Kecocokan model (goodness of fit)', ['Indeks', 'Nilai', 'Keterangan', 'Penilaian', 'Pedoman umum'], fr);
      sum += `<p class="bs-note">Baseline (model independen): χ² = ${f3(r.chi2Base)}, db = ${r.dfBase}. Konvensi χ² = N × F<sub>ML</sub> dengan S dibagi N (sama dengan lavaan). Pedoman di atas bersifat umum (Hu &amp; Bentler, 1999) dan sebaiknya tidak dipakai sebagai batas mutlak.</p>`;
    } else sum += '<p class="bs-note">Model <strong>just-identified</strong> (db = 0): model cocok sempurna secara matematis, sehingga indeks kecocokan tidak informatif.</p>';

    sum += table('Model pengukuran: loading (indikator ← konstruk)', ['Konstruk → indikator', 'Estimasi', 'SE', 'z', 'p', 'Loading terstandar', 'R² indikator'], loads.map((x) => [esc(x.lhs) + ' → ' + esc(x.rhs), f3(x.est), x.free ? f3(x.se) : { v: 'tetap', cls: '' }, x.free ? fmt(x.z, 2) : '', x.free ? pc(x.p) : '', { v: f3(x.std), cls: Math.abs(x.std) < 0.5 ? 'bad' : Math.abs(x.std) >= 0.7 ? 'ok' : 'warn' }, f3(x.std * x.std)]));
    const rel = spec.latents.map((L, li) => { const ls = loads.filter((x) => x.lhs === L.name).map((x) => x.std), s = ls.reduce((a, b) => a + b, 0), ave = ls.reduce((a, b) => a + b * b, 0) / ls.length; return { name: L.name, k: ls.length, ave, cr: ls.length > 1 ? s * s / (s * s + ls.reduce((a, b) => a + (1 - b * b), 0)) : null, li }; });
    sum += table('Reliabilitas &amp; validitas konvergen', ['Konstruk', 'Indikator', 'Composite reliability (CR)', 'AVE'], rel.map((x) => [esc(x.name), x.k, x.cr === null ? '–' : { v: f3(x.cr), cls: x.cr >= 0.7 ? 'ok' : 'bad' }, { v: f3(x.ave), cls: x.ave >= 0.5 ? 'ok' : 'bad' }]));
    if (r.m > 1) sum += table('Validitas diskriminan (Fornell–Larcker): diagonal = √AVE, di luar diagonal = korelasi antar konstruk', [''].concat(nm.map(esc)), nm.map((a, i) => [esc(a)].concat(nm.map((b, j) => (i === j ? { v: '<strong>' + f3(Math.sqrt(rel[i].ave)) + '</strong>', cls: '' } : { v: f3(r.latCor[i][j]), cls: Math.abs(r.latCor[i][j]) > Math.sqrt(Math.min(rel[i].ave, rel[j].ave)) ? 'bad' : '' })))));
    if (regs.length) sum += table('Model struktural: koefisien jalur (pengaruh ← dari)', ['Dari → ke', 'Estimasi', 'SE', 'z', 'p', 'Terstandar (β)'], regs.map((x) => [esc(x.rhs) + ' → ' + esc(x.lhs), { v: f3(x.est), cls: x.p < 0.05 ? 'sig' : '' }, f3(x.se), fmt(x.z, 2), pc(x.p), f3(x.std)]));
    if (r.r2.length) sum += table('Koefisien determinasi (R²)', ['Variabel', 'R²'], r.r2.filter((x) => x.latent || !x.indicator).map((x) => [esc(x.name), pct(x.r2)]));
    if (r.effects.length) sum += table('Efek langsung, tidak langsung, dan total (delta method)', ['Dari → ke', 'Langsung', 'Tidak langsung', 'SE', 'p', 'Total', 'p (total)'], r.effects.map((e) => [esc(e.from) + ' → ' + esc(e.to), f3(e.direct), { v: f3(e.indirect), cls: e.pInd !== null && e.pInd < 0.05 ? 'sig' : '' }, f3(e.seInd), pc(e.pInd), f3(e.total), pc(e.pTot)]));
    const cv = covs.filter((x) => x.free); if (cv.length) sum += table('Kovarians', ['Pasangan', 'Estimasi', 'SE', 'z', 'p', 'Korelasi terstandar'], cv.map((x) => [esc(x.lhs) + ' ↔ ' + esc(x.rhs), f3(x.est), f3(x.se), fmt(x.z, 2), pc(x.p), f3(x.std)]));
    sum += table('Varians (laten) dan varians galat (indikator)', ['Variabel', 'Estimasi', 'SE', 'z', 'p'], vars.map((x) => [esc(x.lhs) + (x.resid ? ' (galat)' : ''), { v: f3(x.est), cls: x.est < 0 ? 'bad' : '' }, f3(x.se), fmt(x.z, 2), pc(x.p)]));
    if (r.topResid.length) sum += table('Residual korelasi terbesar (sampel − model); |r| > 0,10 patut dicermati', ['Pasangan', 'Residual'], r.topResid.map((x) => [esc(x.a) + ' – ' + esc(x.b), { v: f3(x.r), cls: Math.abs(x.r) > 0.1 ? 'warn' : '' }]));
    sum += `<p class="bs-note">${esc('Estimasi tidak terstandar disertai galat baku dari informasi Fisher; p-value uji Wald dua sisi (z). Loading terstandar < 0,5 ditandai merah, ≥ 0,7 hijau. Efek tidak langsung diuji dengan delta method (selang bootstrap lebih disarankan untuk sampel kecil).')}</p>`;

    const st = [
      { t: 'Spesifikasi model', f: `Variabel teramati p = ${r.p}, konstruk laten m = ${r.m}\nElemen kovarians = p(p + 1)/2 = ${r.moments}\nParameter bebas q = ${r.q}\nDerajat bebas = ${r.moments} − ${r.q} = ${r.df}`, n: 'Model harus teridentifikasi: derajat bebas ≥ 0. Setiap konstruk laten diberi skala (indikator pertama = 1, atau varians = 1).' },
      { t: 'Matriks kovarians model', f: 'Σ(θ) = F (I − A)⁻¹ S (I − A)⁻ᵀ Fᵀ\nA: matriks jalur (loading dan koefisien regresi), S: varians/kovarians (laten dan galat), F: penyaring variabel teramati', n: 'Representasi RAM; mencakup model pengukuran dan struktural sekaligus.' },
      { t: 'Fungsi kecocokan maximum likelihood', f: `F_ML = ln|Σ(θ)| + tr(S Σ(θ)⁻¹) − ln|S| − p\nF_ML minimum = ${fmt(r.F, 6)}\nχ² = N × F_ML = ${r.N} × ${fmt(r.F, 6)} = ${f3(r.chi2)}${r.df > 0 ? ',  db = ' + r.df + ',  p = ' + fmtP(r.pChi2) : ''}`, n: 'S dihitung dengan pembagi N (konvensi lavaan).' },
      { t: 'Optimasi', f: `Gauss-Newton dengan peredam Levenberg-Marquardt\nθ ← θ − (H + λ·diag H)⁻¹ g,  g = ∂F/∂θ,  H = tr(Σ⁻¹ Σₖ Σ⁻¹ Σₗ)\nIterasi: ${r.iterations}  (${r.converged ? 'konvergen' : 'belum konvergen'})`, n: 'Turunan Σₖ = ∂Σ/∂θₖ dihitung analitik.' },
      { t: 'Galat baku', f: 'Cov(θ̂) = (2/N) · H⁻¹,  SE = √diag Cov(θ̂),  z = θ̂ / SE', n: 'Terstandar: θ* = θ·σ_dari/σ_ke dengan σ dari matriks kovarians model; galat bakunya dengan delta method.' },
    ];
    if (r.df > 0) st.push({ t: 'Indeks kecocokan', f: `RMSEA = √(max(χ² − db, 0) / (db·N)) = √(max(${f3(r.chi2)} − ${r.df}, 0) / (${r.df} × ${r.N})) = ${f4(f.rmsea)}\nCFI = 1 − max(χ² − db, 0) / max(χ² − db, χ²₀ − db₀, 0) = ${f4(f.cfi)}   (χ²₀ = ${f3(r.chi2Base)}, db₀ = ${r.dfBase})\nTLI = ((χ²₀/db₀) − (χ²/db)) / ((χ²₀/db₀) − 1) = ${f4(f.tli)}\nSRMR = √(Σ residual² / [p(p+1)/2]) = ${f4(f.srmr)}`, n: 'Selang RMSEA 90% memakai distribusi chi-square non-sentral.' });
    st.push({ t: 'Efek tidak langsung', f: 'Efek total = (I − B)⁻¹ − I,  tidak langsung = total − langsung (B: matriks koefisien regresi antar variabel)\nSE dengan delta method: Var(g) = ∇gᵀ Cov(θ̂) ∇g', n: 'Contoh mediasi A → M → Y: efek tak langsung = a × b.' });

    const sigR = regs.filter((x) => x.p < 0.05), nsR = regs.filter((x) => !(x.p < 0.05)), ip = [];
    if (r.df > 0) {
      const pass = [f.rmsea <= 0.08, f.srmr <= 0.08, f.cfi >= 0.90, f.tli >= 0.90].filter(Boolean).length;
      ip.push(`<strong>Kecocokan model:</strong> χ² = ${f3(r.chi2)} (db = ${r.df}, p ${r.pChi2 < 0.0001 ? '< 0,0001' : '= ' + fmtP(r.pChi2)}). ${r.pChi2 > 0.05 ? 'Model tidak ditolak oleh uji χ².' : 'Uji χ² menolak kecocokan sempurna; uji ini sangat peka terhadap ukuran sampel (N = ' + r.N + '), sehingga indeks lain lebih informatif.'} RMSEA = ${f4(f.rmsea)}, SRMR = ${f4(f.srmr)}, CFI = ${f4(f.cfi)}, TLI = ${f4(f.tli)}: <strong>${pass === 4 ? 'seluruh indeks utama memenuhi batas cukup' : pass >= 2 ? pass + ' dari 4 indeks utama memenuhi batas cukup (kecocokan marginal)' : 'sebagian besar indeks utama belum memenuhi batas; model perlu ditinjau ulang'}</strong>.`);
    }
    const lowL = loads.filter((x) => x.free && Math.abs(x.std) < 0.5).concat(loads.filter((x) => !x.free && Math.abs(x.std) < 0.5)), lowAve = rel.filter((x) => x.ave < 0.5), lowCr = rel.filter((x) => x.cr !== null && x.cr < 0.7);
    ip.push(`<strong>Model pengukuran:</strong> ${lowL.length ? 'loading terstandar &lt; 0,5 pada ' + lowL.map((x) => esc(x.rhs)).join(', ') + ' (pertimbangkan meninjau atau mengeluarkan indikator ini). ' : 'seluruh loading terstandar ≥ 0,5. '}${lowCr.length ? 'CR &lt; 0,7: ' + lowCr.map((x) => esc(x.name)).join(', ') + '. ' : 'CR semua konstruk ≥ 0,7. '}${lowAve.length ? 'AVE &lt; 0,5: ' + lowAve.map((x) => esc(x.name)).join(', ') + ' (validitas konvergen lemah). ' : 'AVE semua konstruk ≥ 0,5 (validitas konvergen terpenuhi).'}`);
    if (regs.length) {
      ip.push(`<strong>Model struktural:</strong> ${sigR.length} dari ${regs.length} jalur signifikan pada α = 5%.${sigR.length ? ' ' + sigR.map((x) => `${esc(x.rhs)} → ${esc(x.lhs)} (β = ${f3(x.std)}, p ${fmtP(x.p) === '< 0,0001' ? '< 0,0001' : '= ' + fmtP(x.p)}; ${x.est > 0 ? 'positif' : 'negatif'})`).join('; ') + '.' : ''}${nsR.length ? ' Tidak signifikan: ' + nsR.map((x) => esc(x.rhs) + ' → ' + esc(x.lhs) + ' (p = ' + fmtP(x.p) + ')').join('; ') + '.' : ''}`);
      r.r2.filter((x) => x.latent || !x.indicator).forEach((x) => ip.push(`<strong>${esc(x.name)}:</strong> variabel pengaruhnya menjelaskan ${pct(x.r2)} variasi (R²).`));
    }
    r.effects.filter((e) => e.pInd !== null).forEach((e) => { const sI = e.pInd < 0.05, sD = regs.some((x) => x.rhs === e.from && x.lhs === e.to) ? regs.find((x) => x.rhs === e.from && x.lhs === e.to).p < 0.05 : null;
      ip.push(`<strong>Mediasi ${esc(e.from)} → ${esc(e.to)}:</strong> efek tidak langsung = ${f3(e.indirect)} (p = ${fmtP(e.pInd)}), ${sI ? (sD === null ? 'signifikan; pengaruh bekerja sepenuhnya lewat perantara.' : sD ? 'signifikan dan efek langsung juga signifikan → <em>mediasi parsial</em>.' : 'signifikan sedangkan efek langsung tidak signifikan → <em>mediasi penuh</em>.') : 'tidak signifikan → tidak ada bukti mediasi.'} Efek total = ${f3(e.total)}.`); });
    ip.push(`<strong>Asumsi &amp; catatan:</strong> estimasi ML mengasumsikan data kontinu berdistribusi normal multivariat; data skala Likert dengan ≥ 5 kategori umumnya masih dapat diterima. Jumlah responden ${r.N} untuk ${r.q} parameter (${fmt(r.N / r.q, 1)} per parameter${r.N / r.q < 5 ? '; kurang dari 5, hasil bisa tidak stabil' : ''}). Modifikasi model hanya patut dilakukan bila ada dasar teori.`);
    r.warnings.forEach((w) => ip.push('<strong>Peringatan:</strong> ' + esc(w)));
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Interpretasi CB-SEM</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'CB-SEM (maximum likelihood)'], ['N', r.N], ['χ² (db)', f3(r.chi2) + ' (' + r.df + ')'], ['RMSEA', r.df > 0 ? f4(f.rmsea) : '-'], ['CFI', r.df > 0 ? f4(f.cfi) : '-'], ['SRMR', f4(f.srmr)]], data: exp });
  }

  /* =============================== PLS-SEM =============================== */
  function renderPLS(spec, r, dropped, exp) {
    const boot = r.boot, C = r.constructs, nmC = C.map((c) => c.name), schemeName = { path: 'jalur (path weighting)', centroid: 'centroid', factorial: 'faktorial' }[r.scheme];
    const bs = (b, d) => (b ? [f3(b.se), fmt(b.t, 2), pc(b.p), '[' + f3(b.lo) + '; ' + f3(b.hi) + ']'] : ['', '', '', '']);
    let sum = table('Ringkasan model', ['Keterangan', 'Nilai'], [
      ['Metode estimasi', 'PLS-SEM, skema bobot ' + schemeName],
      ['Pengamatan lengkap (n)', r.n + (dropped ? ` (${dropped} baris dengan sel kosong dibuang)` : '')],
      ['Konstruk / indikator', r.m + ' / ' + C.reduce((a, c) => a + c.ind.length, 0)],
      ['Konvergensi algoritma PLS', r.converged ? 'tercapai (' + r.iterations + ' iterasi)' : '<span class="flag">belum konvergen</span>'],
      ['Bootstrap', boot ? boot.ok + ' resampel berhasil dari ' + boot.B + ' (seed ' + boot.seed + '; selang kepercayaan persentil 95%, uji t dua sisi db = n − 1)' : 'tidak dijalankan (p-value dan selang tidak tersedia)'],
    ]);
    sum += warnBox(r.warnings);
    const refl = C.filter((c) => c.mode === 'A' && !c.single);
    if (refl.length) sum += table('Model pengukuran reflektif: outer loading', ['Konstruk → indikator', 'Loading', 'Bobot'].concat(boot ? ['SE', 't', 'p', 'CI 95%'] : []), [].concat.apply([], refl.map((c) => c.ind.map((ind, h) => [esc(c.name) + ' → ' + esc(ind), { v: f3(c.loadings[h]), cls: c.loadings[h] >= 0.708 ? 'ok' : c.loadings[h] >= 0.4 ? 'warn' : 'bad' }, f3(c.weights[h])].concat(boot ? bs(c.bootL[h]) : [])))));
    const frm = C.filter((c) => c.mode === 'B');
    if (frm.length) sum += table('Model pengukuran formatif: outer weight', ['Konstruk ← indikator', 'Bobot', 'Loading', 'VIF'].concat(boot ? ['SE', 't', 'p', 'CI 95%'] : []), [].concat.apply([], frm.map((c) => c.ind.map((ind, h) => [esc(c.name) + ' ← ' + esc(ind), f3(c.weights[h]), f3(c.loadings[h]), c.vifOuter ? { v: f3(c.vifOuter[h]), cls: c.vifOuter[h] < 3 ? 'ok' : c.vifOuter[h] < 5 ? 'warn' : 'bad' } : '–'].concat(boot ? bs(c.bootW[h]) : [])))));
    const rv = C.filter((c) => c.mode === 'A' && !c.single);
    if (rv.length) sum += table('Reliabilitas &amp; validitas konvergen', ['Konstruk', 'Cronbach α', 'rho_A', 'CR (rho_c)', 'AVE'], rv.map((c) => [esc(c.name), { v: f3(c.alpha), cls: c.alpha >= 0.7 ? 'ok' : 'warn' }, { v: f3(c.rhoA), cls: c.rhoA >= 0.7 ? 'ok' : 'warn' }, { v: f3(c.rhoC), cls: c.rhoC >= 0.7 ? 'ok' : 'bad' }, { v: f3(c.ave), cls: c.ave >= 0.5 ? 'ok' : 'bad' }]));
    const iR = C.map((c, i) => i).filter((i) => C[i].mode === 'A' && !C[i].single);
    if (iR.length > 1) {
      sum += table('Validitas diskriminan: Fornell–Larcker (diagonal = √AVE)', [''].concat(iR.map((i) => esc(nmC[i]))), iR.map((a) => [esc(nmC[a])].concat(iR.map((b) => (a === b ? { v: '<strong>' + f3(r.fl[a][b]) + '</strong>', cls: '' } : { v: f3(r.fl[a][b]), cls: Math.abs(r.fl[a][b]) > Math.min(r.fl[a][a], r.fl[b][b]) ? 'bad' : '' })))));
      sum += table('Validitas diskriminan: HTMT (nilai &lt; 0,90 disarankan; &lt; 0,85 lebih ketat)', [''].concat(iR.map((i) => esc(nmC[i]))), iR.map((a) => [esc(nmC[a])].concat(iR.map((b) => (a === b ? '' : { v: f3(r.htmt[a][b]), cls: r.htmt[a][b] >= 0.9 ? 'bad' : r.htmt[a][b] >= 0.85 ? 'warn' : 'ok' })))));
      sum += table('Cross-loading (korelasi indikator dengan seluruh konstruk; harus tertinggi pada konstruknya sendiri)', ['Indikator'].concat(nmC.map(esc)), r.cross.filter((x) => C[nmC.indexOf(x.con)].mode === 'A' && !C[nmC.indexOf(x.con)].single).map((x) => { const own = nmC.indexOf(x.con), mx = Math.max.apply(null, x.r.map(Math.abs)); return [esc(x.ind)].concat(x.r.map((v, j) => ({ v: f3(v), cls: j === own ? (Math.abs(v) >= mx - 1e-12 ? 'sig' : 'bad') : '' }))); }));
    }
    if (r.paths.length) {
      sum += table('Model struktural: koefisien jalur', ['Dari → ke', 'β', 'f²', 'VIF'].concat(boot ? ['SE', 't', 'p', 'CI 95%'] : []), r.paths.map((x) => [esc(x.from) + ' → ' + esc(x.to), { v: f3(x.beta), cls: boot && x.boot && x.boot.p < 0.05 ? 'sig' : '' }, { v: f3(x.f2), cls: x.f2 >= 0.35 ? 'ok' : x.f2 >= 0.02 ? 'warn' : '' }, { v: f3(x.vif), cls: x.vif < 3 ? 'ok' : x.vif < 5 ? 'warn' : 'bad' }].concat(boot ? bs(x.boot) : [])));
      sum += table('Koefisien determinasi', ['Konstruk', 'R²', 'R² adjusted'].concat(boot ? ['SE', 't', 'p', 'CI 95%'] : []), r.r2.map((x) => [esc(x.name), { v: f3(x.r2), cls: x.r2 >= 0.75 ? 'ok' : x.r2 >= 0.5 ? 'ok' : x.r2 >= 0.25 ? 'warn' : 'bad' }, f3(x.adj)].concat(boot ? bs(x.boot) : [])));
    }
    if (r.effects.length) sum += table('Efek tidak langsung dan total', ['Dari → ke', 'Langsung', 'Tidak langsung', 'Total'].concat(boot ? ['SE (tak langsung)', 't', 'p', 'CI 95% (tak langsung)', 'p (total)'] : []), r.effects.map((e) => [esc(e.from) + ' → ' + esc(e.to), f3(e.direct), { v: f3(e.indirect), cls: boot && e.bootInd && e.bootInd.p < 0.05 ? 'sig' : '' }, f3(e.total)].concat(boot ? bs(e.bootInd).concat([e.bootTot ? pc(e.bootTot.p) : '']) : [])));
    sum += `<p class="bs-note">Pedoman umum (Hair et al., 2019): loading ≥ 0,708; α, rho_A, CR ≥ 0,70; AVE ≥ 0,50; HTMT &lt; 0,90; VIF &lt; 3 (hati-hati ≥ 5); f² 0,02 / 0,15 / 0,35 = kecil / sedang / besar; R² 0,25 / 0,50 / 0,75 = lemah / moderat / kuat. HTMT memakai korelasi absolut. Blindfolding (Q²) dan PLSpredict belum tersedia.</p>`;

    const ex = refl[0] || C.find((c) => !c.single) || C[0], st = [
      { t: 'Standardisasi indikator', f: 'zᵢⱼ = (xᵢⱼ − x̄ⱼ) / sⱼ  (s dengan pembagi n − 1)', n: 'Seluruh indikator dibakukan sehingga bobot dan loading berada pada skala yang sebanding.' },
      { t: 'Inisialisasi', f: 'Bobot luar awal w = 1 untuk tiap indikator\nSkor konstruk Yⱼ = Σ wⱼₕ zⱼₕ, lalu dibakukan (varians = 1)', n: '' },
      { t: 'Iterasi (algoritma Lohmöller)', f: `1) Proksi dalam: Zⱼ = Σₖ eⱼₖ Yₖ (k = konstruk yang terhubung dengan j)\n   Skema ${schemeName}: ${r.scheme === 'path' ? 'eⱼₖ = koefisien regresi Yⱼ pada pendahulunya, atau korelasi bila k adalah penerus' : r.scheme === 'centroid' ? 'eⱼₖ = tanda korelasi(Yⱼ, Yₖ)' : 'eⱼₖ = korelasi(Yⱼ, Yₖ)'}\n2) Bobot luar: mode A (reflektif) wⱼₕ = kov(zⱼₕ, Zⱼ);  mode B (formatif) w = (ZₕᵀZₕ)⁻¹ Zₕᵀ Zⱼ\n3) Ulangi sampai perubahan bobot < 10⁻⁹ (${r.iterations} iterasi, ${r.converged ? 'konvergen' : 'belum konvergen'})`, n: '' },
      { t: 'Loading dan model struktural', f: `Loading λ = korelasi(indikator, skor konstruk)  (contoh ${ex.name}: ${ex.ind.map((x, h) => x + ' = ' + f3(ex.loadings[h])).join(', ')})\nKoefisien jalur β = R_pp⁻¹ r_py (regresi OLS skor baku)\nR² = Σ β·r\nf² = (R²_dengan − R²_tanpa) / (1 − R²_dengan)\nVIF = diagonal R_pp⁻¹`, n: '' },
      { t: 'Reliabilitas dan validitas', f: `α = k/(k − 1) · (1 − Σσ²ᵢ / σ²_total)\nCR = (Σλ)² / ((Σλ)² + Σ(1 − λ²))\nAVE = Σλ² / k${ex.ave !== undefined ? '\nContoh ' + ex.name + ': AVE = ' + f3(ex.ave) + (ex.rhoC !== undefined ? ', CR = ' + f3(ex.rhoC) : '') : ''}\nHTMT = rata-rata |r antar-konstruk| / √(rata-rata |r dalam₁| × rata-rata |r dalam₂|)`, n: 'rho_A (Dijkstra–Henseler) dihitung dari bobot luar dan korelasi antar indikator.' },
    ];
    if (boot) st.push({ t: 'Bootstrap', f: `Resampel baris dengan pengembalian (${boot.B} kali, seed ${boot.seed}); tiap resampel dibakukan ulang dan diestimasi ulang\nSE = simpangan baku estimasi bootstrap; t = estimasi / SE; p dari distribusi t (db = n − 1 = ${r.n - 1})\nSelang persentil 95% = persentil ke-2,5 dan ke-97,5`, n: 'Tanda skor konstruk diselaraskan dengan solusi asli di setiap resampel.' });

    const ip = [], tp = (p) => (p < 0.0001 ? '< 0,0001' : '= ' + fmtP(p));
    const lowL = refl.filter((c) => c.loadings.some((l) => l < 0.708)), badCR = rv.filter((c) => c.rhoC < 0.7 || c.alpha < 0.7), badAve = rv.filter((c) => c.ave < 0.5);
    ip.push(`<strong>Model pengukuran:</strong> ${lowL.length ? 'loading &lt; 0,708 pada ' + lowL.map((c) => esc(c.name) + ' (' + c.ind.filter((_, h) => c.loadings[h] < 0.708).map(esc).join(', ') + ')').join('; ') + '. Loading 0,40–0,70 dapat dipertahankan bila CR dan AVE tetap terpenuhi. ' : 'seluruh loading ≥ 0,708. '}${badCR.length ? 'Reliabilitas kurang (α atau CR &lt; 0,70): ' + badCR.map((c) => esc(c.name)).join(', ') + '. ' : 'Reliabilitas (α dan CR) semua konstruk ≥ 0,70. '}${badAve.length ? 'AVE &lt; 0,50: ' + badAve.map((c) => esc(c.name)).join(', ') + '.' : 'Validitas konvergen terpenuhi (AVE ≥ 0,50).'}`);
    if (iR.length > 1) { let mx = 0, pair = ''; iR.forEach((a) => iR.forEach((b) => { if (a < b && r.htmt[a][b] > mx) { mx = r.htmt[a][b]; pair = nmC[a] + ' – ' + nmC[b]; } })); ip.push(`<strong>Validitas diskriminan:</strong> HTMT tertinggi = ${f3(mx)} (${esc(pair)}) → ${mx < 0.85 ? 'di bawah 0,85; validitas diskriminan terpenuhi' : mx < 0.9 ? 'di bawah 0,90 namun mendekati batas' : 'melampaui 0,90; kedua konstruk sulit dibedakan secara empiris'}.`); }
    frm.forEach((c) => { if (c.vifOuter) ip.push(`<strong>Konstruk formatif ${esc(c.name)}:</strong> VIF indikator ${c.vifOuter.every((v) => v < 3) ? 'seluruhnya &lt; 3 (tidak ada kolinearitas bermasalah)' : 'ada yang ≥ 3; pertimbangkan menggabungkan atau mengeluarkan indikator yang kolinear'}.`); });
    if (r.paths.length) {
      if (boot) {
        const sg = r.paths.filter((x) => x.boot && x.boot.p < 0.05), ns = r.paths.filter((x) => !(x.boot && x.boot.p < 0.05));
        ip.push(`<strong>Model struktural:</strong> ${sg.length} dari ${r.paths.length} jalur signifikan (p &lt; 0,05, bootstrap).${sg.length ? ' ' + sg.map((x) => `${esc(x.from)} → ${esc(x.to)} (β = ${f3(x.beta)}, p ${tp(x.boot.p)}, f² = ${f3(x.f2)})`).join('; ') + '.' : ''}${ns.length ? ' Tidak signifikan: ' + ns.map((x) => esc(x.from) + ' → ' + esc(x.to) + ' (β = ' + f3(x.beta) + (x.boot ? ', p = ' + fmtP(x.boot.p) : '') + ')').join('; ') + '.' : ''}`);
      } else ip.push('<strong>Model struktural:</strong> koefisien jalur ditampilkan tanpa uji signifikansi karena bootstrap tidak dijalankan. Aktifkan bootstrap (≥ 500 resampel) untuk p-value dan selang kepercayaan.');
      r.r2.forEach((x) => ip.push(`<strong>R² ${esc(x.name)}</strong> = ${f3(x.r2)} (${x.r2 >= 0.75 ? 'kuat' : x.r2 >= 0.5 ? 'moderat' : x.r2 >= 0.25 ? 'lemah' : 'sangat lemah'}; ${pct(x.r2)} variasi dijelaskan konstruk pendahulunya).`));
    }
    if (boot) r.effects.forEach((e) => { const bi = e.bootInd; if (!bi) return; const sI = bi.p < 0.05, dp = r.paths.find((x) => x.from === e.from && x.to === e.to), sD = dp && dp.boot ? dp.boot.p < 0.05 : null;
      ip.push(`<strong>Mediasi ${esc(e.from)} → ${esc(e.to)}:</strong> efek tidak langsung = ${f3(e.indirect)} (p ${tp(bi.p)}; CI 95% [${f3(bi.lo)}; ${f3(bi.hi)}]) ${sI ? (sD === null ? '→ signifikan.' : sD ? '→ signifikan dan efek langsung signifikan: <em>mediasi parsial</em>.' : '→ signifikan, efek langsung tidak signifikan: <em>mediasi penuh</em>.') : '→ tidak signifikan (selang memuat nol).'}`); });
    ip.push('<strong>Catatan:</strong> PLS-SEM tidak mengasumsikan normalitas dan cocok untuk sampel kecil atau tujuan prediktif, tetapi tidak menghasilkan indeks kecocokan χ²/RMSEA/CFI seperti CB-SEM. Untuk menguji kecocokan model secara keseluruhan gunakan metode CB-SEM.');
    r.warnings.forEach((w) => ip.push('<strong>Peringatan:</strong> ' + esc(w)));
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Interpretasi PLS-SEM</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'PLS-SEM (skema ' + r.scheme + ')'], ['n', r.n], ['Konstruk', r.m], ['Bootstrap', boot ? boot.B : 'tidak']], data: exp });
  }
})();
