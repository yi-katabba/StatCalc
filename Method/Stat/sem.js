/* =========================================================================
   SEM - Structural Equation Modeling (Multivariate): CB-SEM (maximum likelihood) dan PLS-SEM (+ bootstrap)
   Model ditulis dengan sintaks mirip lavaan (=~, <~, ~, ~~). Hitungan: sem-core.js. Halaman otomatis: #view-sem
   Bootstrap, blindfolding, dan PLSpredict berjalan bertahap (progress bar + tombol Batal; halaman tidak membeku).
   Diagram jalur diteruskan ke panel ekspor (PNG, SVG, salin gambar, dokumen Word) sebagai SVG mandiri.
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
    .sem-add{ border:1px solid var(--accent-2); background:#fff; color:var(--accent-2); border-radius:6px; padding:2px 9px; font:600 12px var(--font-body),sans-serif; cursor:pointer; white-space:nowrap; }
    .sem-add::before{ content:'+ tambah'; } .sem-add:hover{ background:var(--paper-2); } .sem-add[disabled]{ cursor:default; opacity:.65; } .sem-add[disabled]::before{ content:'✓ ditambah'; }
    .sem-lab{ color:var(--ink-faint); font-size:11.5px; font-weight:400; }
    .sem-warn{ margin:10px 0 0; padding:9px 12px; border-left:3px solid #B45309; background:#FFF7E6; font-size:13px; border-radius:6px; }`;
  document.head.appendChild(style);

  const SAMPLE_MODEL = '# Kualitas layanan -> Kepuasan -> Loyalitas\nKualitas  =~ kl1 + kl2 + kl3\nKepuasan  =~ kp1 + kp2 + kp3\nLoyalitas =~ ly1 + ly2 + ly3\n\nKepuasan  ~ Kualitas\nLoyalitas ~ Kepuasan + Kualitas';
  const ui = U.mountPage({
    id: 'sem', pre: 'sx', title: 'SEM (Structural Equation Modeling)', eyebrow: 'Metode Statistik &rsaquo; Multivariate', step1: 'Tulis model &amp; masukkan data',
    lede: 'Uji model hubungan antar konstruk laten dan variabel teramati sekaligus: model pengukuran (loading, reliabilitas, validitas) dan model struktural (jalur, efek langsung, tidak langsung, dan total). Tersedia dua pendekatan: CB-SEM (maximum likelihood, lengkap dengan indeks kecocokan model) dan PLS-SEM (algoritma PLS dengan bootstrap, blindfolding Q², dan PLSpredict).',
    settings: `
      <label>Metode estimasi<select id="sxEst" class="select-input"><option value="cb">CB-SEM (maximum likelihood)</option><option value="pls">PLS-SEM (partial least squares)</option></select></label>
      <label id="sxLblRob">Estimator CB-SEM<select id="sxRob" class="select-input"><option value="ml" selected>ML (asumsi normal multivariat)</option><option value="mlr">MLR (robust terhadap non-normalitas)</option></select></label>
      <label id="sxLblScale">Skala konstruk laten<select id="sxScale" class="select-input"><option value="marker">Indikator pertama = 1 (marker)</option><option value="std">Varians laten = 1 (baku)</option></select></label>
      <label id="sxLblScheme" style="display:none">Skema bobot internal<select id="sxScheme" class="select-input"><option value="path">Jalur (path weighting)</option><option value="centroid">Centroid</option><option value="factorial">Faktorial</option></select></label>
      <label id="sxLblBoot" style="display:none">Bootstrap<select id="sxBoot" class="select-input"><option value="0">Tanpa bootstrap</option><option value="200">200 resampel</option><option value="500" selected>500 resampel</option><option value="1000">1.000 resampel</option><option value="5000">5.000 resampel</option></select></label>
      <label id="sxLblQ2" style="display:none">Blindfolding (Q²)<select id="sxQ2" class="select-input"><option value="0">Tanpa blindfolding</option><option value="5">Jarak omisi D = 5</option><option value="7" selected>Jarak omisi D = 7 (disarankan)</option><option value="10">Jarak omisi D = 10</option><option value="12">Jarak omisi D = 12</option></select></label>
      <label id="sxLblPred" style="display:none">PLSpredict (validasi silang)<select id="sxPred" class="select-input"><option value="0">Tanpa PLSpredict</option><option value="5x10" selected>5 lipatan × 10 ulangan</option><option value="10x10">10 lipatan × 10 ulangan (n ≥ 300)</option><option value="10x1">10 lipatan × 1 ulangan (cepat)</option></select></label>
      <label id="sxLblPredTech" style="display:none">Teknik prediksi PLSpredict<select id="sxPredTech" class="select-input"><option value="direct" selected>Antecedent langsung (DA)</option><option value="earliest">Antecedent paling awal (EA)</option></select></label>
      <label id="sxLblBootCB">Bootstrap (selang efek tak langsung)<select id="sxBootCB" class="select-input"><option value="0" selected>Tanpa bootstrap</option><option value="200">200 resampel</option><option value="500">500 resampel</option><option value="1000">1.000 resampel</option><option value="2000">2.000 resampel</option></select></label>
      <label class="sem-wide">Model (satu persamaan per baris)<textarea id="sxModel" class="sem-model" spellcheck="false" autocomplete="off">${SAMPLE_MODEL}</textarea>
        <span class="sem-syntax"><code>F =~ x1 + x2 + x3</code> konstruk reflektif · <code>F &lt;~ x1 + x2</code> konstruk formatif (PLS-SEM) · <code>Y ~ F + X</code> jalur struktural (konstruk atau variabel teramati) · <code>x1 ~~ x2</code> kovarians galat · <code># komentar</code>. Nama indikator harus sama dengan judul kolom data.<br><strong>Label &amp; pembatasan (hanya CB-SEM):</strong> <code>Y ~ a*X1 + b*X2</code> memberi label jalur; <em>label yang sama = parameter yang sama</em> (mis. <code>F =~ x1 + l*x2 + l*x3</code>, loading dibuat sama; skala laten &ldquo;varians = 1&rdquo; bila penanda ikut diberi label) · <code>0*</code>, <code>0.5*</code> nilai tetap (mis. <code>F1 ~~ 0*F2</code>, <code>x1 ~~ 0.2*x1</code>) · <code>NA*x1 + 1*x2</code> mengganti indikator penanda · <code>a == b</code> menyamakan dua label, <code>a == 0.5</code> mengunci label · <code>ab := a*b</code> parameter terdefinisi (efek tak langsung, selisih, total; operator <code>+ - * / ^ ( )</code>, fungsi <code>sqrt exp log abs</code>) dengan SE delta method dan CI bootstrap.</span></label>
      <label id="sxLblCmp" class="sem-wide">Model pembanding (opsional) &mdash; uji selisih &chi;&sup2;<textarea id="sxModel2" class="sem-model" style="min-height:92px" spellcheck="false" autocomplete="off" placeholder="Kosongkan bila tidak dipakai. Contoh: salin model di atas lalu hapus satu jalur, tambahkan satu kovarians galat, atau samakan loading dengan label yang sama (mis. l*x2 + l*x3)."></textarea>
        <span class="sem-syntax">Model pembanding harus memakai variabel teramati yang sama dan bersarang (<em>nested</em>) dengan model utama, mis. sama kecuali beberapa parameter dibebaskan atau dikunci. Model dengan derajat bebas lebih besar diperlakukan sebagai model terbatas.</span></label>`,
    hint: 'Baris = responden, kolom = indikator/variabel numerik (judul kolom dapat diubah; harus sama dengan nama di model). Minimal <strong><span id="sxMin">30</span> pengamatan</strong> lengkap pada variabel yang dipakai; baris dengan sel kosong dibuang. Pedoman umum: ≥ 200 responden untuk CB-SEM, atau ≥ 5–10 responden per parameter.',
    table: { names: ['kl1', 'kl2', 'kl3', 'kp1', 'kp2', 'kp3', 'ly1', 'ly2', 'ly3'], colLabel: 'x', minCols: 3, maxCols: 40, canAddCol: true }, calcLabel: 'Hitung SEM',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  const syncSettings = () => { const pls = q('sxEst').value === 'pls'; q('sxLblScale').style.display = pls ? 'none' : ''; q('sxLblRob').style.display = pls ? 'none' : ''; q('sxLblScheme').style.display = pls ? '' : 'none'; q('sxLblBoot').style.display = pls ? '' : 'none'; q('sxLblBootCB').style.display = pls ? 'none' : ''; q('sxLblCmp').style.display = pls ? 'none' : ''; q('sxLblQ2').style.display = pls ? '' : 'none'; q('sxLblPred').style.display = pls ? '' : 'none'; q('sxLblPredTech').style.display = pls && q('sxPred').value !== '0' ? '' : 'none'; };
  q('sxEst').addEventListener('change', syncSettings); q('sxPred').addEventListener('change', syncSettings); syncSettings();

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
  const lab = (x) => (x.label ? ' <span class="sem-lab">[' + esc(x.label) + ']</span>' : '');
  const warnBox = (arr) => (arr.length ? `<p class="sem-warn"><strong>Peringatan:</strong> ${arr.map(esc).join(' ')}</p>` : '');

  function collectData(spec) {
    const { cols, bad } = tbl.collect();
    if (bad.length) return { err: 'Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.' };
    const nm = tbl.names.map((_, j) => tbl.name(j)), dup = nm.find((x, i) => nm.indexOf(x) !== i); if (dup) return { err: 'Nama kolom "' + dup + '" muncul lebih dari sekali; beri nama unik.' };
    return { cols, nm };
  }

  const safeMardia = (X, names) => { try { return names.length >= 2 ? SE.mardia(X, names) : null; } catch (e) { return null; } };
  ui.onCalc = () => {
    const mdl = q('sxModel').value, est = q('sxEst').value, cd = collectData(); if (cd.err) return ui.err(cd.err);
    const { cols, nm } = cd; let spec; try { spec = SE.parseModel(mdl, nm); } catch (e) { return ui.err(e.message); }
    const used = spec.observed.map((c) => nm.indexOf(c)), nr = Math.max.apply(null, cols.map((c) => c.length)), X = []; let dropped = 0;
    for (let i = 0; i < nr; i++) { const r = used.map((j) => (cols[j][i] === undefined ? null : cols[j][i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) { dropped++; continue; } X.push(r); }
    if (X.length < 30 && est === 'cb') return ui.err('CB-SEM membutuhkan minimal 30 pengamatan lengkap pada variabel model (sekarang ' + X.length + '; disarankan ≥ 200).');
    if (X.length < 10) return ui.err('Dibutuhkan minimal 10 pengamatan lengkap pada variabel model (sekarang ' + X.length + ').');
    const data = { names: spec.observed, X }, exp = ui.dataExport(spec.observed, spec.observed.map((_, j) => X.map((r) => r[j])));
    try {
      if (est === 'cb') {
        const scale = q('sxScale').value, estimator = q('sxRob').value, Bc = parseInt(q('sxBootCB').value, 10) || 0, r = SE.fitCB(spec, X, { scale, estimator }); r.mardia = safeMardia(X, spec.observed);
        let cmp = null; const m2 = q('sxModel2').value.trim();
        if (m2) {
          let sp2, r2; try { sp2 = SE.parseModel(m2, nm); } catch (e) { return ui.err('Model pembanding: ' + e.message); }
          if (spec.observed.join('|') !== sp2.observed.join('|')) { const a = spec.observed.filter((x) => sp2.observed.indexOf(x) < 0), b2 = sp2.observed.filter((x) => spec.observed.indexOf(x) < 0); return ui.err('Model pembanding harus memakai variabel teramati yang sama dengan model utama.' + (a.length ? ' Hanya di model utama: ' + a.join(', ') + '.' : '') + (b2.length ? ' Hanya di model pembanding: ' + b2.join(', ') + '.' : '')); }
          try { r2 = SE.fitCB(sp2, X, { scale, estimator }); cmp = SE.compareCB(r, r2); } catch (e) { return ui.err('Model pembanding: ' + e.message); }
          cmp.fitB = r2;
        }
        if (!Bc) renderCB(spec, r, dropped, exp, cmp); else runBootCB(spec, X, r, Bc, dropped, exp, cmp);
      } else {
        const B = parseInt(q('sxBoot').value, 10) || 0, pv = q('sxPred').value, pm = pv === '0' ? null : pv.split('x').map(Number), Dq = parseInt(q('sxQ2').value, 10) || 0;
        const opts = { scheme: q('sxScheme').value, boot: B, seed: 12345, blind: Dq, predict: pm ? { folds: pm[0], reps: pm[1], technique: q('sxPredTech').value, seed: 12345 } : null };
        if (B > 0 || Dq > 0 || pm) { runPLS(spec, data, opts, X, dropped, exp); return; }   // pekerjaan berat: bertahap dengan progress bar
        const r = SE.fitPLS(spec, data, opts); r.mardia = safeMardia(X, spec.observed); renderPLS(spec, r, dropped, exp);
      }
    } catch (e) { ui.err(e.message || String(e)); }
  };

  /* ---------- bootstrap CB-SEM bertahap (tidak membekukan halaman) ---------- */
  document.addEventListener('click', (ev) => {   // tombol "tambah" pada tabel modification indices
    const b = ev.target && ev.target.closest ? ev.target.closest('.sem-add') : null; if (!b || b.disabled) return;
    const ta = q('sxModel'); if (!ta) return; ta.value = ta.value.replace(/\s+$/, '') + '\n' + b.getAttribute('data-line'); b.disabled = true;
  });
  /* progress bar dibangun sekali lalu hanya diperbarui nilainya (tombol Batal tidak ikut dibuat ulang saat tiap tik) */
  const UNIT = { boot: ['Bootstrap', 'resampel'], blind: ['Blindfolding (Q²)', 'putaran'], predict: ['PLSpredict', 'lipatan'] };
  let progBox = null, pBar = null, pTxt = null, cancelled = false;
  function showProg(d, t, phase) {
    if (!progBox) {
      progBox = document.createElement('div'); progBox.className = 'sem-prog'; progBox.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px';
      pBar = document.createElement('progress'); pBar.style.cssText = 'flex:0 1 260px;min-width:120px'; pTxt = document.createElement('span'); pTxt.className = 'sem-syntax'; pTxt.setAttribute('aria-live', 'polite');
      const cb = document.createElement('button'); cb.type = 'button'; cb.className = 'sem-add sem-cancel'; cb.textContent = 'Batal'; cb.addEventListener('click', () => { cancelled = true; cb.disabled = true; pTxt.textContent = 'Membatalkan…'; });
      progBox.appendChild(cb); progBox.appendChild(pBar); progBox.appendChild(pTxt);
      /* tombol Batal di kiri agar posisinya tetap saat teks berubah */
      const btn = q('sxCalc'); btn.parentNode.insertBefore(progBox, btn.nextSibling);
    }
    if (d === null) { progBox.style.display = 'none'; return; }
    const u = UNIT[phase || 'boot'] || UNIT.boot, cb = progBox.firstChild;
    progBox.style.display = 'flex';
    cb.disabled = cancelled; pBar.max = t; pBar.value = d; if (!cancelled) pTxt.textContent = u[0] + ': ' + d + ' / ' + t + ' ' + u[1];
  }
  const startProg = () => { cancelled = false; if (progBox) progBox.firstChild.disabled = false; q('sxCalc').disabled = true; };
  const endProg = () => { q('sxCalc').disabled = false; showProg(null); };
  const CANCEL_MSG = 'Perhitungan lanjutan dibatalkan oleh pengguna; hasil di bawah hanya memuat estimasi utama (tanpa bagian yang dibatalkan).';
  function runBootCB(spec, X, r, B, dropped, exp, cmp) {
    startProg(); showProg(0, B, 'boot');
    SE.bootCBAsync(spec, X, r, { B, seed: 12345 }, (d, t) => showProg(d, t, 'boot'), () => cancelled).then((out) => {
      endProg(); if (out === null) r.warnings.push('Bootstrap dibatalkan. ' + CANCEL_MSG);
      renderCB(spec, r, dropped, exp, cmp);
    }).catch((e) => { endProg(); ui.err(e.message || String(e)); });
  }
  function runPLS(spec, data, opts, X, dropped, exp) {
    startProg(); showProg(0, opts.boot || 1, 'boot');
    SE.fitPLSAsync(spec, data, opts, (p) => showProg(p.done, p.total, p.phase), () => cancelled).then((r) => {
      endProg();
      if (r === null) { r = SE.fitPLS(spec, data, { scheme: opts.scheme, boot: 0, blind: 0, predict: null }); r.warnings.push('Bootstrap, blindfolding, dan PLSpredict dibatalkan. ' + CANCEL_MSG); }
      r.mardia = safeMardia(X, spec.observed); renderPLS(spec, r, dropped, exp);
    }).catch((e) => { endProg(); ui.err(e.message || String(e)); });
  }

  /* ---------- diagram jalur (SVG), dipakai CB-SEM dan PLS-SEM ----------
     g = { latents:[{name, ind:[{n, v, p}], formative, single}], regs:[{from,to,v,p}], covs:[{a,b,v}], note } ; v = angka pada panah, p = p-value (null = tidak diuji) */
  function pathSvg(g, mid, legend) {   // legend = true: versi mandiri untuk ekspor (latar putih, legenda di dalam gambar, tanpa variabel CSS)
    const nf = (v) => (Number.isFinite(v) ? fmt(v, 2) : ''), lat = {}, isInd = {}, single = {};
    g.latents.forEach((L) => { if (L.single) single[L.name] = 1; else lat[L.name] = L; L.ind.forEach((i) => { if (!L.single) isInd[i.n] = 1; }); });
    const names = []; const addN = (v) => { if (names.indexOf(v) < 0) names.push(v); };
    g.latents.forEach((L) => addN(L.name)); g.regs.forEach((e) => { addN(e.from); addN(e.to); });
    const rank = {}; names.forEach((v) => { rank[v] = 0; });
    for (let it = 0; it < names.length; it++) g.regs.forEach((e) => { rank[e.to] = Math.max(rank[e.to], rank[e.from] + 1); });
    const maxR = Math.max.apply(null, names.map((v) => rank[v]).concat([0])), NW = 96, NH = 40, IW = 66, IH = 32, GX = 170, vgap = 28;
    const cols = Array.from({ length: maxR + 1 }, (_, c) => names.filter((v) => rank[v] === c));
    const side = (f) => (rank[f] === 0 ? 'L' : (rank[f] === maxR ? 'R' : 'B'));
    const needL = Object.keys(lat).some((f) => side(f) === 'L' && lat[f].ind.length), needR = Object.keys(lat).some((f) => side(f) === 'R' && lat[f].ind.length);
    const leftW = needL ? IW + 70 : 0, rightW = needR ? IW + 70 : 0, colX = (c) => leftW + 30 + c * (NW + GX) + NW / 2, pos = {}; let ymax = 0;
    cols.forEach((vs, c) => { let y = 30; vs.forEach((v) => { const n = lat[v] ? lat[v].ind.length : 0, sd = lat[v] ? side(v) : '', h = Math.max(NH + vgap, sd === 'B' ? NH + 120 : n * (IH + 14)); pos[v] = { x: colX(c), y: y + h / 2 - (sd === 'B' ? 40 : 0) }; y += h + 12; }); ymax = Math.max(ymax, y); });
    Object.keys(lat).forEach((f) => { const list = lat[f].ind, n = list.length, P = pos[f], sd = side(f); list.forEach((e, i) => { pos[e.n] = sd === 'L' ? { x: P.x - NW / 2 - 70 - IW / 2, y: P.y + (i - (n - 1) / 2) * (IH + 14) } : sd === 'R' ? { x: P.x + NW / 2 + 70 + IW / 2, y: P.y + (i - (n - 1) / 2) * (IH + 14) } : { x: P.x + (i - (n - 1) / 2) * (IW + 14), y: P.y + 110 }; }); });
    const skipE = (e) => !isInd[e.from] && !isInd[e.to] && Math.abs(rank[e.from] - rank[e.to]) > 1;
    if (g.regs.some(skipE)) Object.keys(pos).forEach((v) => { pos[v].y += 80; });
    let W = leftW + 30 + (maxR + 1) * NW + maxR * GX + 30 + rightW, H = ymax + 50; Object.keys(pos).forEach((v) => { W = Math.max(W, pos[v].x + 60); H = Math.max(H, pos[v].y + 50); });
    const dim = (v) => (lat[v] ? { w: NW, h: NH + 6 } : (isInd[v] ? { w: IW, h: IH } : { w: NW, h: NH }));
    const bound = (a, b, ra, rb) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, cut = (r) => Math.min(Math.min((r.w / 2) / Math.abs(dx || 1e-9), (r.h / 2) / Math.abs(dy || 1e-9)) * d, Math.hypot(r.w / 2, r.h / 2)), ca = cut(ra), cb = cut(rb); return { x1: a.x + dx / d * ca, y1: a.y + dy / d * ca, x2: b.x - dx / d * cb, y2: b.y - dy / d * cb }; };
    const LAB = 'fill:#1B2430;font-size:11.5px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:3px';
    const Wr = Math.round(W), Hr = Math.round(H), leg = legend ? wrapText(legendText(g), Math.max(30, Math.floor((Wr - 24) / 5.6))) : [], Hf = Hr + (legend ? 10 + 15 * leg.length : 0);
    let s = (legend
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wr} ${Hf}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="12"><rect width="${Wr}" height="${Hf}" fill="#fff"/>`
      : `<svg viewBox="0 0 ${Wr} ${Hr}" role="img" aria-label="Diagram jalur model SEM" style="width:100%;max-width:${Math.min(Wr, 960)}px;height:auto;display:block;margin:12px auto 0;font:12px var(--font-body),sans-serif">`)
      + `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:#4A5666"/></marker></defs>`, labels = '';
    const edge = (a, b, v, p, skip) => {
      if (!pos[a] || !pos[b]) return; const dash = p !== null && p !== undefined && !(p < 0.05) ? 'stroke-dasharray:5 4;' : '';
      if (skip) { const up = -(NH + 52 + 14 * (Math.abs(rank[a] - rank[b]) - 2)), A0 = { x: pos[a].x, y: pos[a].y - NH / 2 }, B0 = { x: pos[b].x, y: pos[b].y - NH / 2 }, cy = Math.min(A0.y, B0.y) + up, cx = (A0.x + B0.x) / 2; s += `<path d="M${A0.x} ${A0.y} Q${cx} ${cy} ${B0.x} ${B0.y}" style="fill:none;stroke:#4A5666;stroke-width:1.4;${dash}" marker-end="url(#${mid})"/>`; labels += `<text x="${cx}" y="${0.25 * A0.y + 0.5 * cy + 0.25 * B0.y - 4}" text-anchor="middle" style="${LAB}">${nf(v)}</text>`; return; }
      const e = bound(pos[a], pos[b], dim(a), dim(b)); s += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" style="stroke:#4A5666;stroke-width:1.4;${dash}" marker-end="url(#${mid})"/>`; labels += `<text x="${(e.x1 + e.x2) / 2}" y="${(e.y1 + e.y2) / 2 - 4}" text-anchor="middle" style="${LAB}">${nf(v)}</text>`;
    };
    Object.keys(lat).forEach((f) => lat[f].ind.forEach((i) => (lat[f].formative ? edge(i.n, f, i.v, i.p) : edge(f, i.n, i.v, i.p))));
    g.regs.forEach((e) => edge(e.from, e.to, e.v, e.p, skipE(e)));
    (g.covs || []).forEach((e) => { if (!pos[e.a] || !pos[e.b] || isInd[e.a] || isInd[e.b]) return; const a = pos[e.a], b = pos[e.b], off = 46 + Math.abs(a.y - b.y) * 0.08, ax = a.x - dim(e.a).w / 2, bx = b.x - dim(e.b).w / 2, cx = Math.min(ax, bx) - off; s += `<path d="M${ax} ${a.y} Q${cx} ${(a.y + b.y) / 2} ${bx} ${b.y}" style="fill:none;stroke:#5F6B7A;stroke-width:1.2" marker-start="url(#${mid})" marker-end="url(#${mid})"/>`; labels += `<text x="${cx + off * 0.45}" y="${(a.y + b.y) / 2 + 4}" text-anchor="end" style="fill:#4A5666;font-size:11px;paint-order:stroke;stroke:#fff;stroke-width:3px">${nf(e.v)}</text>`; });
    Object.keys(pos).forEach((v) => { const P = pos[v], d = dim(v); s += lat[v] ? `<ellipse cx="${P.x}" cy="${P.y}" rx="${d.w / 2}" ry="${d.h / 2}" style="fill:#E6EBF1;stroke:#1F5FA8;stroke-width:1.8"/>` : `<rect x="${P.x - d.w / 2}" y="${P.y - d.h / 2}" width="${d.w}" height="${d.h}" rx="4" style="fill:#fff;stroke:#4A5666;stroke-width:1.4"/>`; s += `<text x="${P.x}" y="${P.y + 4}" text-anchor="middle" style="fill:#1B2430;font-weight:${lat[v] ? 800 : 600}">${esc(v.length > 13 ? v.slice(0, 12) + '…' : v)}</text>`; });
    const foot = leg.map((t, i) => `<text x="12" y="${Hr + 14 + 15 * i}" style="fill:#4A5666;font-size:11px">${esc(t)}</text>`).join('');
    return s + labels + foot + '</svg>';
  }

  const wrapText = (t, n) => { const out = []; let cur = ''; t.split(' ').forEach((w) => { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) out.push(cur); return out; };
  const legendText = (g) => 'Elips = konstruk laten, persegi = variabel teramati. Angka pada panah = ' + g.note + '.'
    + (g.regs.concat([].concat.apply([], g.latents.map((L) => L.ind))).some((e) => e.p !== null && e.p !== undefined) ? ' Garis putus-putus = tidak signifikan (p ≥ 0,05).' : '')
    + ((g.covs || []).length ? ' Garis lengkung = korelasi.' : '');
  const pathDiagram = (g) => `<h4 style="margin:18px 0 0">Diagram jalur</h4>${pathSvg(g, 'sxArr', false)}<p class="bs-note">${esc(legendText(g))}</p>`;
  const diagramChart = (g) => ({ title: 'Diagram jalur', caption: ' — ' + legendText(g), svg: pathSvg(g, 'sxArrX', true) });   // untuk panel ekspor (SVG/PNG/salin/Word)
  const gCB = (spec, r) => ({
    note: 'koefisien terstandar (loading dan β)',
    latents: spec.latents.map((L) => ({ name: L.name, ind: r.params.filter((x) => x.kind === 'loading' && x.lhs === L.name).map((x) => ({ n: x.rhs, v: x.std, p: x.free ? x.p : null })) })),
    regs: r.params.filter((x) => x.kind === 'reg').map((x) => ({ from: x.rhs, to: x.lhs, v: x.std, p: x.p })),
    covs: r.params.filter((x) => x.kind === 'cov' && x.free).map((x) => ({ a: x.lhs, b: x.rhs, v: x.std })),
  });
  const gPLS = (r) => ({
    note: 'outer loading / bobot formatif dan koefisien jalur (β)',
    latents: r.constructs.map((c) => ({ name: c.name, single: c.single, formative: c.mode === 'B', ind: c.single ? [] : c.ind.map((n, k) => ({ n, v: c.mode === 'B' ? c.weights[k] : c.loadings[k], p: c.bootL && c.bootL[k] ? c.bootL[k].p : null })) })),
    regs: r.paths.map((x) => ({ from: x.from, to: x.to, v: x.beta, p: x.boot ? x.boot.p : null })), covs: [],
  });

  /* =============================== CB-SEM =============================== */
  const f4n = (v) => (Number.isFinite(v) ? f4(v) : '–');
  function miTableCB(r) {
    if (!r.mi || !r.mi.length || !(r.df > 0)) return '';
    const top = r.mi.slice(0, 10), nSig = r.mi.filter((x) => x.p < 0.05).length;
    return table('Indeks modifikasi (modification indices): parameter yang bila dibebaskan paling menurunkan χ²', ['Parameter yang dibebaskan', 'MI (≈ penurunan χ²)', 'p (db = 1)', 'EPC', 'EPC terstandar', 'Tambah ke model'],
      top.map((m) => [esc(m.line) + (m.kind === 'cov' ? ' <span class="sem-syntax">(kovarians galat)</span>' : ' <span class="sem-syntax">(jalur)</span>'), { v: f3(m.mi), cls: m.mi >= 10 ? 'bad' : m.mi >= 3.84 ? 'warn' : '' }, pc(m.p), f3(m.epc), f3(m.sepc), `<button type="button" class="sem-add" data-line="${esc(m.line)}" title="Tambahkan baris ini ke model, lalu tekan Hitung SEM"></button>`]))
      + `<p class="bs-note">${nSig} dari ${r.mi.length} kandidat memiliki MI ≥ 3,84 (p &lt; 0,05; db = 1). MI adalah uji skor (Lagrange multiplier): perkiraan penurunan χ² bila parameter itu dibebaskan, tanpa estimasi ulang. EPC = perkiraan nilai parameter bila dibebaskan. Kandidat yang dihitung: kovarians galat dan jalur struktural ke variabel endogen (tanpa lingkaran umpan balik); cross-loading tidak dihitung karena sintaks model melarang satu indikator pada dua konstruk. Ubah model <strong>hanya bila ada dasar teori</strong>; modifikasi yang dituntun data semata mudah menyesuaikan diri dengan kebetulan sampel (MacCallum et al., 1992) dan sebaiknya divalidasi pada sampel lain.</p>`;
  }
  /* ---------- uji normalitas multivariat (Mardia) ---------- */
  function mardiaTable(m, est) {
    if (!m) return '';
    const sk = m.skew, ku = m.kurt, nSk = sk.pSmall < 0.05, nKu = ku.p < 0.05;
    let h = table('Uji normalitas multivariat (Mardia)', ['Ukuran', 'Nilai', 'Statistik uji', 'p', 'Penilaian'], [
      ['Skewness multivariat (b<sub>1,p</sub>)', f3(sk.b1p), 'χ² = ' + f3(sk.statSmall) + ', db = ' + sk.df + ' (koreksi sampel kecil)', pc(sk.pSmall), nSk ? { v: 'menyimpang', cls: 'warn' } : { v: 'sesuai normal', cls: 'ok' }],
      ['Kurtosis multivariat (b<sub>2,p</sub>)', f3(ku.b2p) + ' (harapan normal ' + f3(ku.expected) + ')', 'z = ' + f3(ku.z), pc(ku.p), nKu ? { v: ku.z > 0 ? 'berekor berat' : 'berekor ringan', cls: 'warn' } : { v: 'sesuai normal', cls: 'ok' }],
      ['Kurtosis relatif (b<sub>2,p</sub> / [p(p+2)])', f3(ku.relative), '', '', ku.relative > 1.2 ? { v: 'tinggi', cls: 'warn' } : { v: 'wajar', cls: 'ok' }],
    ]);
    h += table('Skewness dan kurtosis berlebih tiap variabel (pedoman: |skewness| ≤ 2 dan |kurtosis| ≤ 7; West, Finch &amp; Curran, 1995)', ['Variabel', 'Skewness', 'Kurtosis berlebih'], m.uni.map((u) => [esc(u.name), { v: f3(u.skew), cls: Math.abs(u.skew) > 2 ? 'bad' : Math.abs(u.skew) > 1 ? 'warn' : '' }, { v: f3(u.kurt), cls: Math.abs(u.kurt) > 7 ? 'bad' : Math.abs(u.kurt) > 2 ? 'warn' : '' }]));
    h += `<p class="bs-note">N = ${m.n}, p = ${m.p} variabel. Jarak Mahalanobis terbesar = ${f3(m.maxD)} (baris ke-${m.maxIdx + 1} dari data lengkap); ${m.nOutlier} pengamatan memiliki p &lt; 0,001 terhadap χ²(${m.p}) (kandidat pencilan multivariat). Uji Mardia sangat sensitif pada N besar: kurtosis relatif sekitar 1 berarti kemiripan dengan normal, nilai jauh di atas 1 berarti ekor berat. ${est === 'mlr' || est === 'pls' ? '' : (nKu || nSk) ? '<strong>Data menyimpang dari normal multivariat: pertimbangkan estimator MLR (SE dan χ² dikoreksi).</strong>' : ''}</p>`;
    return h;
  }
  const mlrOf = (r) => (r.robust && r.robust.ok ? r.robust : null);
  const fitOf = (x) => { const rb = mlrOf(x); return rb ? { cfi: rb.fit.cfi, rmsea: rb.fit.rmsea } : { cfi: x.fit.cfi, rmsea: x.fit.rmsea }; };
  function cmpTableCB(r, cmp) {
    if (!cmp) return '';
    const B = cmp.fitB, mlr = cmp.scaled, row = (nm, x) => [nm, f3(x.chi2) + (mlrOf(x) ? ' (terskala ' + f3(mlrOf(x).chi2Scaled) + ')' : ''), x.df, f4n(fitOf(x).cfi), f4n(fitOf(x).rmsea), f4(x.fit.srmr), f3(x.fit.aic), f3(x.fit.bic)];
    const rn = cmp.restrictedIsMain ? 'model utama' : 'model pembanding', fn = cmp.restrictedIsMain ? 'model pembanding' : 'model utama';
    let h = table('Perbandingan model: ukuran kecocokan' + (mlr ? ' (CFI dan RMSEA robust; AIC/BIC dari likelihood ML)' : ''), ['Model', 'χ²', 'db', 'CFI', 'RMSEA', 'SRMR', 'AIC', 'BIC'], [row('Model utama', r), row('Model pembanding', B)]);
    const rows = [['Model terbatas (db lebih besar)', rn], [mlr ? 'Δχ² ML (tak terskala)' : 'Δχ²', f3(cmp.dChi)], ['Δdb', cmp.dDf]];
    if (mlr && cmp.cd !== undefined) rows.push(['Faktor skala selisih c<sub>d</sub>', f4n(cmp.cd)], ['Δχ² terskala (Satorra–Bentler, 2001)', f3(cmp.dChiScaled)]);
    if (cmp.nested && cmp.p !== null) rows.push(['p (uji selisih χ²)', pc(cmp.p)], ['Kesimpulan', cmp.p < 0.05 ? `signifikan: ${fn} (lebih longgar) cocok lebih baik daripada ${rn}; pembatasan pada ${rn} ditolak` : `tidak signifikan: ${rn} (lebih sederhana) tidak lebih buruk daripada ${fn}; ${rn} lebih diutamakan`]);
    rows.push(['ΔCFI (penuh − terbatas)', f4n(cmp.dCfi)], ['ΔRMSEA (terbatas − penuh)', f4n(cmp.dRmsea)], ['ΔAIC / ΔBIC (terbatas − penuh)', f3(cmp.dAic) + ' / ' + f3(cmp.dBic)]);
    h += table(mlr ? 'Uji selisih χ² terskala (MLR)' : 'Uji selisih χ² (likelihood-ratio)', ['Ukuran', 'Nilai'], rows) + warnBox(cmp.warnings);
    if (mlr) h += `<p class="bs-note"><strong>Estimator MLR:</strong> selisih dua χ² yang sudah terskala <em>tidak</em> berdistribusi χ², sehingga memakai rumus Satorra–Bentler (2001): c<sub>d</sub> = (db<sub>0</sub>·c<sub>0</sub> − db<sub>1</sub>·c<sub>1</sub>) / (db<sub>0</sub> − db<sub>1</sub>), Δχ²<sub>terskala</sub> = (χ²<sub>0</sub> − χ²<sub>1</sub>) / c<sub>d</sub> dengan χ² ML tak terskala. Bila c<sub>d</sub> ≤ 0 uji tidak valid.</p>`;
    h += `<p class="bs-note">Uji selisih χ² valid bila model terbatas bersarang di model penuh (hanya berbeda oleh pembatasan parameter) dan data memenuhi asumsi ML. Aplikasi tidak dapat memeriksa kebersarangan secara otomatis; pastikan sendiri. Selisih χ² juga sensitif terhadap N besar, maka ΔCFI ≤ 0,01 (Cheung &amp; Rensvold, 2002) sering dipakai sebagai pelengkap. ΔAIC/ΔBIC &gt; 0 berarti model penuh lebih baik; keduanya juga berlaku untuk model yang tidak bersarang.</p>`;
    return h;
  }
  function bootTablesCB(r, loads, regs) {
    const seLbl = r.estimator === 'mlr' ? 'SE (MLR)' : 'SE (ML)', b = r.boot, ci = (x) => (x ? '[' + f3(x.lo) + '; ' + f3(x.hi) + ']' : '–'), bc = (x) => (x ? '[' + f3(x.bcLo) + '; ' + f3(x.bcHi) + ']' : '–');
    const sg = (x) => (x ? (x.bcLo > 0 || x.bcHi < 0 ? { v: 'ya', cls: 'ok' } : { v: 'tidak', cls: '' }) : '–');
    let h = `<p class="bs-note"><strong>Bootstrap:</strong> ${b.ok} resampel berhasil dari ${b.B} (seed ${b.seed}); kasus diambil ulang dengan pengembalian dan model diestimasi ulang di setiap resampel. Selang persentil 95% memakai persentil ke-2,5 dan ke-97,5; selang <em>bias-corrected</em> (BC) 95% mengoreksi bias median. Parameter dinyatakan signifikan bila selang BC tidak memuat 0.</p>`;
    h += table('Bootstrap: koefisien jalur struktural', ['Dari → ke', 'Estimasi', seLbl, 'SE bootstrap', 'CI persentil 95%', 'CI BC 95%', 'Signifikan', 'β terstandar', 'CI BC β'],
      regs.map((x) => [esc(x.rhs) + ' → ' + esc(x.lhs), f3(x.est), f3(x.se), x.boot ? f3(x.boot.se) : '–', ci(x.boot), bc(x.boot), sg(x.boot), f3(x.std), bc(x.bootStd)]));
    const fl = loads.filter((x) => x.free);
    if (fl.length) h += table('Bootstrap: loading', ['Konstruk → indikator', 'Estimasi', seLbl, 'SE bootstrap', 'CI BC 95%', 'Loading terstandar', 'CI BC terstandar'],
      fl.map((x) => [esc(x.lhs) + ' → ' + esc(x.rhs), f3(x.est), f3(x.se), x.boot ? f3(x.boot.se) : '–', bc(x.boot), f3(x.std), bc(x.bootStd)]));
    if (r.effects.length) h += table('Bootstrap: efek tidak langsung dan total', ['Dari → ke', 'Tak langsung', 'SE (delta)', 'SE bootstrap', 'CI persentil 95%', 'CI BC 95%', 'Signifikan', 'Total', 'CI BC total'],
      r.effects.map((e) => [esc(e.from) + ' → ' + esc(e.to), f3(e.indirect), f3(e.seInd), e.bootInd ? f3(e.bootInd.se) : '–', ci(e.bootInd), bc(e.bootInd), sg(e.bootInd), f3(e.total), bc(e.bootTot)]));
    if (r.defs && r.defs.length) h += table('Bootstrap: parameter terdefinisi (:=)', ['Nama', 'Ekspresi', 'Estimasi', 'SE (delta)', 'SE bootstrap', 'CI persentil 95%', 'CI BC 95%', 'Signifikan'],
      r.defs.map((d) => [esc(d.name), '<code>' + esc(d.expr) + '</code>', f3(d.est), f3(d.se), d.boot ? f3(d.boot.se) : '–', ci(d.boot), bc(d.boot), sg(d.boot)]));
    return h;
  }
  function renderCB(spec, r, dropped, exp, cmp) {
    const f = r.fit, rb = mlrOf(r), isR = r.estimator === 'mlr', ff = rb ? rb.fit : f, nm = spec.latents.map((l) => l.name), loads = r.params.filter((x) => x.kind === 'loading'), regs = r.params.filter((x) => x.kind === 'reg');
    const covs = r.params.filter((x) => x.kind === 'cov'), vars = r.params.filter((x) => x.kind === 'var' && x.free);
    let sum = table('Ringkasan model', ['Keterangan', 'Nilai'], [
      ['Metode estimasi', 'CB-SEM, ' + (isR ? 'MLR (maximum likelihood robust: galat baku sandwich Huber–White, χ² terskala)' : 'maximum likelihood') + ' (skala laten: ' + (r.scale === 'std' ? 'varians laten = 1' : 'indikator pertama = 1') + ')'],
      ['Pengamatan lengkap (N)', r.N + (dropped ? ` (${dropped} baris dengan sel kosong dibuang)` : '')],
      ['Variabel teramati / konstruk laten', r.p + ' / ' + r.m],
      ['Parameter bebas / elemen kovarians / derajat bebas', r.q + ' / ' + r.moments + ' / ' + r.df + (r.nTied ? ' (' + r.nFreeRaw + ' parameter pada model, ' + r.nTied + ' di antaranya diikat oleh label yang sama)' : '')],
      ['Konvergensi', r.converged ? 'tercapai (' + r.iterations + ' iterasi)' : '<span class="flag">belum konvergen</span> (' + r.iterations + ' iterasi)'],
    ]);
    sum += warnBox(r.warnings);
    if (r.df > 0) {
      const fr = [];
      if (rb) {
        fr.push(['Chi-square ML (tak terskala)', f3(r.chi2), 'db = ' + r.df + ', p ' + (r.pChi2 < 0.0001 ? '< 0,0001' : '= ' + fmtP(r.pChi2)) + ' (tidak valid bila data tidak normal)', '', 'p > 0,05'],
          ['Chi-square terskala (χ²/c)', f3(rb.chi2Scaled), 'db = ' + r.df + ', p ' + (rb.pScaled < 0.0001 ? '< 0,0001' : '= ' + fmtP(rb.pScaled)) + '; faktor skala c = ' + f4(rb.c), { v: rb.pScaled > 0.05 ? 'baik' : 'sensitif terhadap N', cls: rb.pScaled > 0.05 ? 'ok' : 'warn' }, 'p > 0,05'],
          ['χ² terskala / db', f3(rb.chi2Scaled / r.df), '', lvl(rb.chi2Scaled / r.df, 2, 3, false), '≤ 2 (≤ 3 cukup)']);
      } else fr.push(['Chi-square (χ²)', f3(r.chi2), 'db = ' + r.df + ', p ' + (r.pChi2 < 0.0001 ? '< 0,0001' : '= ' + fmtP(r.pChi2)), { v: r.pChi2 > 0.05 ? 'baik' : 'sensitif terhadap N', cls: r.pChi2 > 0.05 ? 'ok' : 'warn' }, 'p > 0,05'],
        ['χ² / db', f3(f.chiRatio), '', lvl(f.chiRatio, 2, 3, false), '≤ 2 (≤ 3 cukup)']);
      fr.push(['RMSEA' + (rb ? ' (robust)' : ''), f4(ff.rmsea), rb ? 'CI 90%: ' + f4(ff.rmseaLo) + ' – ' + f4(ff.rmseaHi) : 'CI 90%: ' + f4(f.rmseaLo) + ' – ' + f4(f.rmseaHi) + '; p(≤ 0,05) = ' + fmtP(f.pClose), lvl(ff.rmsea, 0.05, 0.08, false), '≤ 0,05 (≤ 0,08 cukup)'],
        ['SRMR', f4(f.srmr), '', lvl(f.srmr, 0.05, 0.08, false), '≤ 0,05 (≤ 0,08 cukup)'],
        ['CFI' + (rb ? ' (robust)' : ''), f4n(ff.cfi), '', lvl(ff.cfi, 0.95, 0.90, true), '≥ 0,95 (≥ 0,90 cukup)'],
        ['TLI (NNFI)' + (rb ? ' (robust)' : ''), f4n(ff.tli), '', lvl(ff.tli, 0.95, 0.90, true), '≥ 0,95 (≥ 0,90 cukup)'],
        ['NFI' + (rb ? ' (ML, tak terkoreksi)' : ''), f4(f.nfi), '', lvl(f.nfi, 0.95, 0.90, true), '≥ 0,95 (≥ 0,90 cukup)'],
        ['GFI' + (rb ? ' (ML, tak terkoreksi)' : ''), f4(f.gfi), '', lvl(f.gfi, 0.95, 0.90, true), '≥ 0,95 (≥ 0,90 cukup)'],
        ['AGFI' + (rb ? ' (ML, tak terkoreksi)' : ''), f4(f.agfi), '', lvl(f.agfi, 0.90, 0.80, true), '≥ 0,90 (≥ 0,80 cukup)'],
        ['AIC / BIC', f3(f.aic) + ' / ' + f3(f.bic), '', '', 'lebih kecil lebih baik (membandingkan model)']);
      sum += table('Kecocokan model (goodness of fit)', ['Indeks', 'Nilai', 'Keterangan', 'Penilaian', 'Pedoman umum'], fr);
      if (rb) sum += table('Indeks kecocokan: ML vs terskala vs robust (MLR)', ['Indeks', 'ML (tak terkoreksi)', 'Terskala (χ²/c)', 'Robust (Brosseau-Liard &amp; Savalei)'], [
        ['RMSEA', f4(f.rmsea), f4(rb.fit.rmseaScaled), f4(rb.fit.rmsea)], ['CFI', f4(f.cfi), f4n(rb.fit.cfiScaled), f4n(rb.fit.cfi)], ['TLI', f4(f.tli), f4n(rb.fit.tliScaled), f4n(rb.fit.tli)]])
        + `<p class="bs-note">Faktor skala χ² c = tr(UΓ)/db = ${f4(rb.c)}${rb.cBase ? ' (model independen: ' + f4(rb.cBase) + ')' : ''}; c &gt; 1 berarti ekor data lebih berat dari normal sehingga χ² ML membengkak, c &lt; 1 sebaliknya. Kolom "terskala" memakai rumus baku dengan χ²/c, kolom "robust" memakai koreksi Brosseau-Liard &amp; Savalei (2014) yang dianjurkan; SRMR tidak dikoreksi.</p>`;
      sum += `<p class="bs-note">Baseline (model independen): χ² = ${f3(r.chi2Base)}, db = ${r.dfBase}. Konvensi χ² = N × F<sub>ML</sub> dengan S dibagi N (sama dengan lavaan). Pedoman di atas bersifat umum (Hu &amp; Bentler, 1999) dan sebaiknya tidak dipakai sebagai batas mutlak.</p>`;
    } else sum += '<p class="bs-note">Model <strong>just-identified</strong> (db = 0): model cocok sempurna secara matematis, sehingga indeks kecocokan tidak informatif.</p>';

    sum += table('Model pengukuran: loading (indikator ← konstruk)', ['Konstruk → indikator', 'Estimasi', 'SE', 'z', 'p', 'Loading terstandar', 'R² indikator'], loads.map((x) => [esc(x.lhs) + ' → ' + esc(x.rhs) + lab(x), f3(x.est), x.free ? f3(x.se) : { v: 'tetap', cls: '' }, x.free ? fmt(x.z, 2) : '', x.free ? pc(x.p) : '', { v: f3(x.std), cls: Math.abs(x.std) < 0.5 ? 'bad' : Math.abs(x.std) >= 0.7 ? 'ok' : 'warn' }, f3(x.std * x.std)]));
    const rel = spec.latents.map((L, li) => { const ls = loads.filter((x) => x.lhs === L.name).map((x) => x.std), s = ls.reduce((a, b) => a + b, 0), ave = ls.reduce((a, b) => a + b * b, 0) / ls.length; return { name: L.name, k: ls.length, ave, cr: ls.length > 1 ? s * s / (s * s + ls.reduce((a, b) => a + (1 - b * b), 0)) : null, li }; });
    sum += table('Reliabilitas &amp; validitas konvergen', ['Konstruk', 'Indikator', 'Composite reliability (CR)', 'AVE'], rel.map((x) => [esc(x.name), x.k, x.cr === null ? '–' : { v: f3(x.cr), cls: x.cr >= 0.7 ? 'ok' : 'bad' }, { v: f3(x.ave), cls: x.ave >= 0.5 ? 'ok' : 'bad' }]));
    if (r.m > 1) sum += table('Validitas diskriminan (Fornell–Larcker): diagonal = √AVE, di luar diagonal = korelasi antar konstruk', [''].concat(nm.map(esc)), nm.map((a, i) => [esc(a)].concat(nm.map((b, j) => (i === j ? { v: '<strong>' + f3(Math.sqrt(rel[i].ave)) + '</strong>', cls: '' } : { v: f3(r.latCor[i][j]), cls: Math.abs(r.latCor[i][j]) > Math.sqrt(Math.min(rel[i].ave, rel[j].ave)) ? 'bad' : '' })))));
    if (regs.length) sum += table('Model struktural: koefisien jalur (pengaruh ← dari)', ['Dari → ke', 'Estimasi', isR ? 'SE (robust)' : 'SE', 'z', 'p', 'Terstandar (β)'].concat(isR ? ['SE (ML biasa)'] : []), regs.map((x) => [esc(x.rhs) + ' → ' + esc(x.lhs) + lab(x), { v: f3(x.est), cls: x.free && x.p < 0.05 ? 'sig' : '' }, x.free ? f3(x.se) : { v: 'tetap', cls: '' }, x.free ? fmt(x.z, 2) : '', x.free ? pc(x.p) : '', f3(x.std)].concat(isR ? [x.free ? f3(x.seML) : ''] : [])));
    if (r.r2.length) sum += table('Koefisien determinasi (R²)', ['Variabel', 'R²'], r.r2.filter((x) => x.latent || !x.indicator).map((x) => [esc(x.name), pct(x.r2)]));
    if (r.effects.length) sum += table('Efek langsung, tidak langsung, dan total (delta method)', ['Dari → ke', 'Langsung', 'Tidak langsung', 'SE', 'p', 'Total', 'p (total)'], r.effects.map((e) => [esc(e.from) + ' → ' + esc(e.to), f3(e.direct), { v: f3(e.indirect), cls: e.pInd !== null && e.pInd < 0.05 ? 'sig' : '' }, f3(e.seInd), pc(e.pInd), f3(e.total), pc(e.pTot)]));
    if (r.defs && r.defs.length) sum += table('Parameter terdefinisi (:=)', ['Nama', 'Ekspresi', 'Estimasi', isR ? 'SE (delta, robust)' : 'SE (delta)', 'z', 'p'], r.defs.map((d) => [esc(d.name), '<code>' + esc(d.expr) + '</code>', { v: f3(d.est), cls: d.p !== null && d.p < 0.05 ? 'sig' : '' }, f3(d.se), d.z === null ? '' : fmt(d.z, 2), d.p === null ? '' : pc(d.p)]));
    if (r.boot) sum += bootTablesCB(r, loads, regs);
    const cv = covs; if (cv.length) sum += table('Kovarians', ['Pasangan', 'Estimasi', 'SE', 'z', 'p', 'Korelasi terstandar'], cv.map((x) => [esc(x.lhs) + ' ↔ ' + esc(x.rhs) + lab(x), f3(x.est), x.free ? f3(x.se) : { v: 'tetap', cls: '' }, x.free ? fmt(x.z, 2) : '', x.free ? pc(x.p) : '', f3(x.std)]));
    sum += table('Varians (laten) dan varians galat (indikator)', ['Variabel', 'Estimasi', 'SE', 'z', 'p'], vars.map((x) => [esc(x.lhs) + (x.resid ? ' (galat)' : '') + lab(x), { v: f3(x.est), cls: x.est < 0 ? 'bad' : '' }, f3(x.se), fmt(x.z, 2), pc(x.p)]));
    if (r.topResid.length) sum += table('Residual korelasi terbesar (sampel − model); |r| > 0,10 patut dicermati', ['Pasangan', 'Residual'], r.topResid.map((x) => [esc(x.a) + ' – ' + esc(x.b), { v: f3(x.r), cls: Math.abs(x.r) > 0.1 ? 'warn' : '' }]));
    sum += `<p class="bs-note">${esc(''+(isR ? 'Estimasi tidak terstandar disertai galat baku robust (sandwich Huber–White: A⁻¹BA⁻¹/N dengan A informasi Fisher dan B kovarians skor kasus); galat baku ML biasa ditampilkan sebagai pembanding pada tabel jalur struktural; rasio SE robust/SE ML jauh dari 1 menandakan pelanggaran normalitas yang berarti. ' : 'Estimasi tidak terstandar disertai galat baku dari informasi Fisher; ')+'p-value uji Wald dua sisi (z). Loading terstandar < 0,5 ditandai merah, ≥ 0,7 hijau. Efek tidak langsung diuji dengan delta method (selang bootstrap lebih disarankan untuk sampel kecil).')}</p>`;

    const st = [
      { t: 'Spesifikasi model', f: `Variabel teramati p = ${r.p}, konstruk laten m = ${r.m}\nElemen kovarians = p(p + 1)/2 = ${r.moments}\nParameter bebas q = ${r.q}\nDerajat bebas = ${r.moments} − ${r.q} = ${r.df}`, n: 'Model harus teridentifikasi: derajat bebas ≥ 0. Setiap konstruk laten diberi skala (indikator pertama = 1, atau varians = 1).' },
      { t: 'Matriks kovarians model', f: 'Σ(θ) = F (I − A)⁻¹ S (I − A)⁻ᵀ Fᵀ\nA: matriks jalur (loading dan koefisien regresi), S: varians/kovarians (laten dan galat), F: penyaring variabel teramati', n: 'Representasi RAM; mencakup model pengukuran dan struktural sekaligus.' },
      { t: 'Fungsi kecocokan maximum likelihood', f: `F_ML = ln|Σ(θ)| + tr(S Σ(θ)⁻¹) − ln|S| − p\nF_ML minimum = ${fmt(r.F, 6)}\nχ² = N × F_ML = ${r.N} × ${fmt(r.F, 6)} = ${f3(r.chi2)}${r.df > 0 ? ',  db = ' + r.df + ',  p = ' + fmtP(r.pChi2) : ''}`, n: 'S dihitung dengan pembagi N (konvensi lavaan).' },
      { t: 'Optimasi', f: `Gauss-Newton dengan peredam Levenberg-Marquardt\nθ ← θ − (H + λ·diag H)⁻¹ g,  g = ∂F/∂θ,  H = tr(Σ⁻¹ Σₖ Σ⁻¹ Σₗ)\nIterasi: ${r.iterations}  (${r.converged ? 'konvergen' : 'belum konvergen'})`, n: 'Turunan Σₖ = ∂Σ/∂θₖ dihitung analitik.' },
      { t: 'Galat baku', f: 'Cov(θ̂) = (2/N) · H⁻¹,  SE = √diag Cov(θ̂),  z = θ̂ / SE', n: 'Terstandar: θ* = θ·σ_dari/σ_ke dengan σ dari matriks kovarians model; galat bakunya dengan delta method.' },
    ];
    if (r.df > 0) st.push({ t: 'Indeks kecocokan', f: `RMSEA = √(max(χ² − db, 0) / (db·N)) = √(max(${f3(r.chi2)} − ${r.df}, 0) / (${r.df} × ${r.N})) = ${f4(f.rmsea)}\nCFI = 1 − max(χ² − db, 0) / max(χ² − db, χ²₀ − db₀, 0) = ${f4(f.cfi)}   (χ²₀ = ${f3(r.chi2Base)}, db₀ = ${r.dfBase})\nTLI = ((χ²₀/db₀) − (χ²/db)) / ((χ²₀/db₀) − 1) = ${f4(f.tli)}\nSRMR = √(Σ residual² / [p(p+1)/2]) = ${f4(f.srmr)}`, n: 'Selang RMSEA 90% memakai distribusi chi-square non-sentral.' });
    if (isR) st.push({ t: 'Estimator robust MLR (sandwich + χ² terskala)', f: `Δ = ∂σ/∂θ (σ = vech Σ),  V = ½ Dᵀ(Σ⁻¹ ⊗ Σ⁻¹)D,  A = ΔᵀVΔ,  Γ̂ = kovarians sampel vech(zzᵀ) (z = x − x̄; pembagi N)\nCov robust(θ̂) = (1/N) A⁻¹ (ΔᵀVΓ̂VΔ) A⁻¹\nU = V − VΔA⁻¹ΔᵀV,  c = tr(UΓ̂)/db = ${rb ? f4(rb.c) : '–'},  χ² terskala = χ²/c${rb ? ' = ' + f3(rb.chi2Scaled) + ',  p = ' + fmtP(rb.pScaled) : ''}\nRMSEA_r = √(max(χ² − c·db, 0)/(db·N)),  CFI_r = 1 − max(χ² − c·db, 0)/max(χ² − c·db, χ²₀ − c₀·db₀, 0)\nTLI_r = (χ²₀/db₀ − c₀ − χ²/db + c) / (χ²₀/db₀ − c₀)`, n: 'Setara dengan estimator MLR (SE robust Huber–White + χ² terskala) pada data lengkap. Bentuk dihitung per kasus: skor s_ik = ½ zᵢᵀΣ⁻¹ΣₖΣ⁻¹zᵢ, ΔᵀVΓ̂VΔ = kovarians skor; tr(VΓ̂) = ½[mean(zᵢᵀΣ⁻¹zᵢ)² − tr((Σ⁻¹S)²)]. Faktor skala berbentuk Satorra–Bentler; versi Yuan–Bentler (Mplus) dapat berbeda pada suku berorde 1/N. Informasi yang dipakai: ekspektasi (bukan observasi); MI dan bootstrap tetap memakai teori normal.' });
    st.push({ t: 'Efek tidak langsung', f: 'Efek total = (I − B)⁻¹ − I,  tidak langsung = total − langsung (B: matriks koefisien regresi antar variabel)\nSE dengan delta method: Var(g) = ∇gᵀ Cov(θ̂) ∇g', n: 'Contoh mediasi A → M → Y: efek tak langsung = a × b.' });
    if (spec.hasMods) st.push({ t: 'Label, pembatasan, dan parameter terdefinisi', f: `Label sama → satu parameter θ_k di semua posisi:  ∂Σ/∂θ_k = Σ_anggota ∂Σ/∂θ_anggota\nParameter unik q = ${r.q} (dari ${r.nFreeRaw} parameter pada model);  db = p(p + 1)/2 − q = ${r.df}\nNilai tetap (angka*, ==): parameter keluar dari θ, db bertambah\n:= g(θ):  estimasi g(θ̂),  SE = √(∇g · Cov(θ̂) · ∇gᵀ)  (delta method, turunan numerik pusat)`, n: 'Kesamaan menambah db sebanyak jumlah parameter yang digabung dikurangi satu; model terikat bersarang di model bebas, sehingga dapat diuji dengan selisih χ² pada kolom "Model pembanding". Pada MLR, SE parameter terdefinisi memakai kovarians robust.' });
    if (r.mi && r.mi.length && r.df > 0) st.push({ t: 'Indeks modifikasi (uji skor)', f: 'g_k = ∂F/∂θ_k pada parameter yang dikunci 0,  H = tr(Σ⁻¹ Σₐ Σ⁻¹ Σ_b)\nSchur_k = H_kk − H_kc H_cc⁻¹ H_ck   (c = parameter bebas)\nMI_k = (N/2) · g_k² / Schur_k,   EPC_k = −g_k / Schur_k\nEPC terstandar: EPC · σ_dari / σ_ke (jalur);  EPC / (σ_a σ_b) (kovarians)', n: 'MI ≈ penurunan χ² bila parameter dibebaskan (db = 1); dibandingkan dengan 3,84 (p = 0,05). Tidak memerlukan estimasi ulang model.' });
    if (cmp) st.push({ t: cmp.scaled ? 'Uji selisih χ² terskala (Satorra–Bentler, 2001)' : 'Uji selisih χ²', f: (cmp.scaled ? `c_d = (db₀·c₀ − db₁·c₁)/(db₀ − db₁) = ${f4n(cmp.cd)};  Δχ²_terskala = (χ²₀ − χ²₁)/c_d = ${f3(cmp.dChiScaled)}\n` : '') + `Δχ² = χ²(terbatas) − χ²(penuh) = ${f3(cmp.restricted.chi2)} − ${f3(cmp.full.chi2)} = ${f3(cmp.dChi)}\nΔdb = ${cmp.restricted.df} − ${cmp.full.df} = ${cmp.dDf}${cmp.p !== null ? '\np = ' + fmtP(cmp.p) + '  (distribusi χ² dengan db = Δdb)' : ''}`, n: 'Valid bila model terbatas bersarang di model penuh.' });
    if (r.boot) st.push({ t: 'Bootstrap (resampel kasus)', f: `Ulangi ${r.boot.B} kali (seed ${r.boot.seed}): ambil N = ${r.N} baris dengan pengembalian → estimasi ulang model (nilai awal = solusi asli)\nSE bootstrap = simpangan baku estimasi di seluruh resampel yang berhasil (${r.boot.ok} berhasil, ${r.boot.failed} gagal)\nCI persentil = persentil ke-2,5 dan ke-97,5\nCI BC: z₀ = Φ⁻¹(proporsi estimasi bootstrap < estimasi asli); batas = persentil Φ(2z₀ ± 1,96)`, n: 'Efek tak langsung adalah hasil kali koefisien sehingga distribusinya menceng; selang bootstrap lebih tepat daripada uji z delta method. χ² tidak di-bootstrap (perlu Bollen–Stine).' });

    const sigR = regs.filter((x) => x.free && x.p < 0.05), nsR = regs.filter((x) => x.free && !(x.p < 0.05)), ip = [];
    if (r.df > 0) {
      const pass = [ff.rmsea <= 0.08, f.srmr <= 0.08, ff.cfi >= 0.90, ff.tli >= 0.90].filter(Boolean).length, c2 = rb ? rb.chi2Scaled : r.chi2, pc2 = rb ? rb.pScaled : r.pChi2;
      ip.push(`<strong>Kecocokan model${rb ? ' (MLR)' : ''}:</strong> ${rb ? 'χ² terskala = ' + f3(c2) + ' (χ² ML = ' + f3(r.chi2) + ', c = ' + f4(rb.c) + ')' : 'χ² = ' + f3(c2)} (db = ${r.df}, p ${pc2 < 0.0001 ? '< 0,0001' : '= ' + fmtP(pc2)}). ${pc2 > 0.05 ? 'Model tidak ditolak oleh uji χ².' : 'Uji χ² menolak kecocokan sempurna; uji ini sangat peka terhadap ukuran sampel (N = ' + r.N + '), sehingga indeks lain lebih informatif.'} RMSEA${rb ? ' robust' : ''} = ${f4(ff.rmsea)}, SRMR = ${f4(f.srmr)}, CFI${rb ? ' robust' : ''} = ${f4n(ff.cfi)}, TLI${rb ? ' robust' : ''} = ${f4n(ff.tli)}: <strong>${pass === 4 ? 'seluruh indeks utama memenuhi batas cukup' : pass >= 2 ? pass + ' dari 4 indeks utama memenuhi batas cukup (kecocokan marginal)' : 'sebagian besar indeks utama belum memenuhi batas; model perlu ditinjau ulang'}</strong>.`);
    }
    const lowL = loads.filter((x) => x.free && Math.abs(x.std) < 0.5).concat(loads.filter((x) => !x.free && Math.abs(x.std) < 0.5)), lowAve = rel.filter((x) => x.ave < 0.5), lowCr = rel.filter((x) => x.cr !== null && x.cr < 0.7);
    ip.push(`<strong>Model pengukuran:</strong> ${lowL.length ? 'loading terstandar &lt; 0,5 pada ' + lowL.map((x) => esc(x.rhs)).join(', ') + ' (pertimbangkan meninjau atau mengeluarkan indikator ini). ' : 'seluruh loading terstandar ≥ 0,5. '}${lowCr.length ? 'CR &lt; 0,7: ' + lowCr.map((x) => esc(x.name)).join(', ') + '. ' : 'CR semua konstruk ≥ 0,7. '}${lowAve.length ? 'AVE &lt; 0,5: ' + lowAve.map((x) => esc(x.name)).join(', ') + ' (validitas konvergen lemah). ' : 'AVE semua konstruk ≥ 0,5 (validitas konvergen terpenuhi).'}`);
    if (regs.length) {
      ip.push(`<strong>Model struktural:</strong> ${sigR.length} dari ${sigR.length + nsR.length} jalur bebas signifikan pada α = 5%.${sigR.length ? ' ' + sigR.map((x) => `${esc(x.rhs)} → ${esc(x.lhs)} (β = ${f3(x.std)}, p ${fmtP(x.p) === '< 0,0001' ? '< 0,0001' : '= ' + fmtP(x.p)}; ${x.est > 0 ? 'positif' : 'negatif'})`).join('; ') + '.' : ''}${nsR.length ? ' Tidak signifikan: ' + nsR.map((x) => esc(x.rhs) + ' → ' + esc(x.lhs) + ' (p = ' + fmtP(x.p) + ')').join('; ') + '.' : ''}`);
      r.r2.filter((x) => x.latent || !x.indicator).forEach((x) => ip.push(`<strong>${esc(x.name)}:</strong> variabel pengaruhnya menjelaskan ${pct(x.r2)} variasi (R²).`));
    }
    r.effects.filter((e) => e.pInd !== null).forEach((e) => { const sI = e.pInd < 0.05, sD = regs.some((x) => x.rhs === e.from && x.lhs === e.to) ? regs.find((x) => x.rhs === e.from && x.lhs === e.to).p < 0.05 : null;
      ip.push(`<strong>Mediasi ${esc(e.from)} → ${esc(e.to)}:</strong> efek tidak langsung = ${f3(e.indirect)} (p = ${fmtP(e.pInd)}), ${sI ? (sD === null ? 'signifikan; pengaruh bekerja sepenuhnya lewat perantara.' : sD ? 'signifikan dan efek langsung juga signifikan → <em>mediasi parsial</em>.' : 'signifikan sedangkan efek langsung tidak signifikan → <em>mediasi penuh</em>.') : 'tidak signifikan → tidak ada bukti mediasi.'} Efek total = ${f3(e.total)}.`); });
    (r.defs || []).forEach((d) => { const b = d.boot; ip.push(`<strong>Parameter terdefinisi ${esc(d.name)}</strong> (<code>${esc(d.expr)}</code>) = ${f3(d.est)}, SE (delta) = ${f3(d.se)}${d.p === null ? ' (p tidak dapat dihitung)' : ', p ' + (d.p < 0.0001 ? '< 0,0001' : '= ' + fmtP(d.p))}${b ? '; bootstrap: SE = ' + f3(b.se) + ', CI BC 95% [' + f3(b.bcLo) + '; ' + f3(b.bcHi) + '] → ' + (b.bcLo > 0 || b.bcHi < 0 ? 'tidak memuat 0 (signifikan)' : 'memuat 0 (tidak signifikan)') : ''}.`); });
    if (r.boot) r.effects.forEach((e) => { const b = e.bootInd; if (!b) return; const sB = b.bcLo > 0 || b.bcHi < 0, sZ = e.pInd !== null && e.pInd < 0.05;
      ip.push(`<strong>Mediasi (bootstrap) ${esc(e.from)} → ${esc(e.to)}:</strong> efek tidak langsung = ${f3(e.indirect)}, SE bootstrap = ${f3(b.se)}, CI BC 95% [${f3(b.bcLo)}; ${f3(b.bcHi)}] → ${sB ? 'tidak memuat 0, <strong>signifikan</strong>' : 'memuat 0, <strong>tidak signifikan</strong>'}.${sB !== sZ ? ' Kesimpulan ini berbeda dari uji delta method (p = ' + fmtP(e.pInd) + '); gunakan hasil bootstrap karena lebih sesuai untuk hasil kali koefisien.' : ''}`); });
    if (r.mi && r.mi.length && r.df > 0) { const sg = r.mi.filter((x) => x.p < 0.05), t = r.mi[0];
      ip.push(`<strong>Indeks modifikasi:</strong> ${sg.length ? sg.length + ' parameter yang dikunci memiliki MI ≥ 3,84. Terbesar: <em>' + esc(t.line) + '</em> (MI = ' + f3(t.mi) + ', EPC = ' + f3(t.epc) + '). Membebaskannya diperkirakan menurunkan χ² sekitar ' + f3(t.mi) + ' dengan 1 derajat bebas. Pertimbangkan hanya bila ada pembenaran teori (mis. dua indikator berbagi redaksi pertanyaan atau pengukuran yang sama).' : 'tidak ada parameter terkunci dengan MI ≥ 3,84; tidak ada indikasi kuat bahwa model perlu dilonggarkan.'}`); }
    if (cmp) { const rn = cmp.restrictedIsMain ? 'model utama' : 'model pembanding', fn = cmp.restrictedIsMain ? 'model pembanding' : 'model utama';
      ip.push(`<strong>Perbandingan model:</strong> ${cmp.nested && cmp.p !== null ? 'Δχ² = ' + f3(cmp.dChi) + ' (Δdb = ' + cmp.dDf + ', p ' + (cmp.p < 0.0001 ? '< 0,0001' : '= ' + fmtP(cmp.p)) + '). ' + (cmp.p < 0.05 ? 'Pelonggaran pada ' + fn + ' memperbaiki kecocokan secara bermakna; ' + rn + ' ditolak.' : rn.charAt(0).toUpperCase() + rn.slice(1) + ' tidak lebih buruk secara bermakna, sehingga lebih diutamakan karena lebih sederhana.') : 'uji selisih χ² tidak berlaku (derajat bebas sama).'} ΔCFI = ${f4n(cmp.dCfi)}, ΔAIC = ${f3(cmp.dAic)}, ΔBIC = ${f3(cmp.dBic)}.`); }
    const md = r.mardia, nonNorm = md && (md.kurt.p < 0.05 || md.skew.pSmall < 0.05);
    if (md) ip.push(`<strong>Normalitas multivariat (Mardia):</strong> skewness b<sub>1,p</sub> = ${f3(md.skew.b1p)} (p ${md.skew.pSmall < 0.0001 ? '< 0,0001' : '= ' + fmtP(md.skew.pSmall)}), kurtosis b<sub>2,p</sub> = ${f3(md.kurt.b2p)} vs harapan ${f3(md.kurt.expected)} (z = ${f3(md.kurt.z)}, p ${md.kurt.p < 0.0001 ? '< 0,0001' : '= ' + fmtP(md.kurt.p)}). ${nonNorm ? 'Data <strong>menyimpang dari normal multivariat</strong>' + (isR ? '; estimator MLR yang dipakai mengoreksi galat baku dan χ² untuk hal ini.' : '; galat baku dan χ² ML bisa terlalu optimistis (χ² membengkak bila kurtosis tinggi). Pertimbangkan memilih estimator MLR.') : 'Tidak ada bukti kuat penyimpangan dari normal multivariat' + (isR ? '; MLR dan ML seharusnya memberi hasil serupa (c mendekati 1).' : '.')}`);
    ip.push(`<strong>Asumsi &amp; catatan:</strong> ${isR ? 'estimator MLR tidak mensyaratkan normalitas multivariat (data kontinu atau Likert ≥ 5 kategori), tetapi bergantung pada momen keempat sampel sehingga memerlukan N yang memadai (≥ 100–200). Data kategorik dengan sedikit kategori sebaiknya memakai estimator khusus ordinal (WLSMV; belum tersedia). Estimasi parameter tetap sama dengan ML; yang dikoreksi adalah galat baku, χ², dan indeks kecocokan.' : 'estimasi ML mengasumsikan data kontinu berdistribusi normal multivariat; data skala Likert dengan ≥ 5 kategori umumnya masih dapat diterima.'} Jumlah responden ${r.N} untuk ${r.q} parameter (${fmt(r.N / r.q, 1)} per parameter${r.N / r.q < 5 ? '; kurang dari 5, hasil bisa tidak stabil' : ''}). Modifikasi model hanya patut dilakukan bila ada dasar teori.`);
    r.warnings.forEach((w) => ip.push('<strong>Peringatan:</strong> ' + esc(w)));
    sum += mardiaTable(r.mardia, r.estimator) + miTableCB(r) + cmpTableCB(r, cmp);
    sum += pathDiagram(gCB(spec, r));
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Interpretasi CB-SEM</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', isR ? 'CB-SEM (MLR, robust)' : 'CB-SEM (maximum likelihood)'], ['N', r.N], [rb ? 'χ² terskala (db)' : 'χ² (db)', f3(rb ? rb.chi2Scaled : r.chi2) + ' (' + r.df + ')'], ['RMSEA', r.df > 0 ? f4(ff.rmsea) : '-'], ['CFI', r.df > 0 ? f4n(ff.cfi) : '-'], ['SRMR', f4(f.srmr)]].concat(r.boot ? [['Bootstrap', r.boot.ok + ' / ' + r.boot.B + ' resampel']] : []), data: exp, charts: [diagramChart(gCB(spec, r))] });
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
      ['Blindfolding (Q²)', r.blind ? 'jarak omisi D = ' + r.blind.D + ' (' + r.blind.D + ' putaran; tiap sel data dihilangkan tepat satu kali)' : 'tidak dijalankan'],
      ['PLSpredict', r.predict ? r.predict.folds + ' lipatan × ' + r.predict.repsOK + ' ulangan, teknik ' + (r.predict.technique === 'direct' ? 'antecedent langsung (DA)' : 'antecedent paling awal (EA)') + ', seed ' + r.predict.seed + '; benchmark regresi linear (LM)' : 'tidak dijalankan'],
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
    if (r.blind) {
      const bc = r.blind.constructs.filter((c) => c.comm || c.red), r2of = (nm) => { const x = r.r2.find((y) => y.name === nm); return x ? x.r2 : null; };
      const qc = (v) => ({ v: f3(v), cls: v > 0.25 ? 'ok' : v > 0 ? 'warn' : 'bad' });
      sum += table('Blindfolding: Q² tingkat konstruk (Q² &gt; 0 = relevansi prediktif)', ['Konstruk', 'Q² communality', 'SSO (redundancy)', 'SSE (redundancy)', 'Q² redundancy', 'R²'],
        bc.map((c) => [esc(c.name), c.comm ? qc(c.comm.q2) : '', c.red ? f3(c.red.sso) : '', c.red ? f3(c.red.sse) : '', c.red ? qc(c.red.q2) : '', r2of(c.name) === null ? '' : f3(r2of(c.name))]));
      sum += table('Blindfolding: Q² per indikator', ['Konstruk → indikator', 'Q² communality', 'Q² redundancy'], [].concat.apply([], bc.map((c) => c.indicators.map((x) => [esc(c.name) + ' → ' + esc(x.ind), x.commQ2 === null ? '' : qc(x.commQ2), x.redQ2 === null ? '' : qc(x.redQ2)]))));
    }
    if (r.predict) {
      const P = r.predict, dl = (v) => (Number.isFinite(v) ? { v: (v > 0 ? '+' : '') + f4(v), cls: v < 0 ? 'ok' : 'warn' } : '–'), lv = { 'tinggi': 'ok', 'sedang': 'ok', 'rendah': 'warn', 'tidak ada': 'bad', 'tak tersedia': '' };
      sum += table('PLSpredict: ringkasan daya prediksi per konstruk endogen', ['Konstruk', 'Indikator dengan RMSE PLS &lt; LM', 'Indikator dengan Q²predict &gt; 0', 'Daya prediksi'], P.constructs.map((c) => [esc(c.name), c.nBetter + ' dari ' + c.nInd, c.nQpos + ' dari ' + c.nInd, { v: c.level, cls: lv[c.level] || '' }]));
      sum += table('PLSpredict: akurasi prediksi luar-sampel per indikator (rata-rata ' + P.repsOK + ' ulangan)', ['Konstruk → indikator', 'Q²predict', 'RMSE PLS', 'RMSE LM', 'ΔRMSE (PLS − LM)', 'MAE PLS', 'MAE LM', 'ΔMAE (PLS − LM)'],
        P.rows.map((x) => [esc(x.construct) + ' → ' + esc(x.ind), { v: f3(x.q2), cls: x.q2 > 0 ? 'ok' : 'bad' }, f3(x.rmse), f3(x.lmRmse), dl(x.dRmse), f3(x.mae), f3(x.lmMae), dl(x.dMae)]));
    }
    if (r.effects.length) sum += table('Efek tidak langsung dan total', ['Dari → ke', 'Langsung', 'Tidak langsung', 'Total'].concat(boot ? ['SE (tak langsung)', 't', 'p', 'CI 95% (tak langsung)', 'p (total)'] : []), r.effects.map((e) => [esc(e.from) + ' → ' + esc(e.to), f3(e.direct), { v: f3(e.indirect), cls: boot && e.bootInd && e.bootInd.p < 0.05 ? 'sig' : '' }, f3(e.total)].concat(boot ? bs(e.bootInd).concat([e.bootTot ? pc(e.bootTot.p) : '']) : [])));
    sum += `<p class="bs-note">Pedoman umum (Hair et al., 2019): loading ≥ 0,708; α, rho_A, CR ≥ 0,70; AVE ≥ 0,50; HTMT &lt; 0,90; VIF &lt; 3 (hati-hati ≥ 5); f² 0,02 / 0,15 / 0,35 = kecil / sedang / besar; R² 0,25 / 0,50 / 0,75 = lemah / moderat / kuat. HTMT memakai korelasi absolut.${r.blind ? ' Q² (blindfolding) &gt; 0 menandakan model memiliki relevansi prediktif untuk konstruk endogen itu (0 / 0,25 / 0,50 = kecil / sedang / besar; Hair dkk., 2019); Blindfolding menghilangkan sel data secara bergilir (bukan responden), sehingga bukan prediksi luar-sampel sejati; untuk itu gunakan PLSpredict.' : ''}${r.predict ? ' PLSpredict (Shmueli dkk., 2019): Q²predict &gt; 0 diperlukan; bila <em>seluruh</em> indikator RMSE PLS &lt; LM → daya prediksi tinggi, <em>mayoritas</em> → sedang, <em>minoritas</em> → rendah, tidak ada → tidak ada. Bila distribusi galat prediksi sangat miring, bandingkan MAE, bukan RMSE.' : ''}</p>`;

    const ex = refl[0] || C.find((c) => !c.single) || C[0], st = [
      { t: 'Standardisasi indikator', f: 'zᵢⱼ = (xᵢⱼ − x̄ⱼ) / sⱼ  (s dengan pembagi n − 1)', n: 'Seluruh indikator dibakukan sehingga bobot dan loading berada pada skala yang sebanding.' },
      { t: 'Inisialisasi', f: 'Bobot luar awal w = 1 untuk tiap indikator\nSkor konstruk Yⱼ = Σ wⱼₕ zⱼₕ, lalu dibakukan (varians = 1)', n: '' },
      { t: 'Iterasi (algoritma Lohmöller)', f: `1) Proksi dalam: Zⱼ = Σₖ eⱼₖ Yₖ (k = konstruk yang terhubung dengan j)\n   Skema ${schemeName}: ${r.scheme === 'path' ? 'eⱼₖ = koefisien regresi Yⱼ pada pendahulunya, atau korelasi bila k adalah penerus' : r.scheme === 'centroid' ? 'eⱼₖ = tanda korelasi(Yⱼ, Yₖ)' : 'eⱼₖ = korelasi(Yⱼ, Yₖ)'}\n2) Bobot luar: mode A (reflektif) wⱼₕ = kov(zⱼₕ, Zⱼ);  mode B (formatif) w = (ZₕᵀZₕ)⁻¹ Zₕᵀ Zⱼ\n3) Ulangi sampai perubahan bobot < 10⁻⁹ (${r.iterations} iterasi, ${r.converged ? 'konvergen' : 'belum konvergen'})`, n: '' },
      { t: 'Loading dan model struktural', f: `Loading λ = korelasi(indikator, skor konstruk)  (contoh ${ex.name}: ${ex.ind.map((x, h) => x + ' = ' + f3(ex.loadings[h])).join(', ')})\nKoefisien jalur β = R_pp⁻¹ r_py (regresi OLS skor baku)\nR² = Σ β·r\nf² = (R²_dengan − R²_tanpa) / (1 − R²_dengan)\nVIF = diagonal R_pp⁻¹`, n: '' },
      { t: 'Reliabilitas dan validitas', f: `α = k/(k − 1) · (1 − Σσ²ᵢ / σ²_total)\nCR = (Σλ)² / ((Σλ)² + Σ(1 − λ²))\nAVE = Σλ² / k${ex.ave !== undefined ? '\nContoh ' + ex.name + ': AVE = ' + f3(ex.ave) + (ex.rhoC !== undefined ? ', CR = ' + f3(ex.rhoC) : '') : ''}\nHTMT = rata-rata |r antar-konstruk| / √(rata-rata |r dalam₁| × rata-rata |r dalam₂|)`, n: 'rho_A (Dijkstra–Henseler) dihitung dari bobot luar dan korelasi antar indikator.' },
    ];
    if (r.blind) st.push({ t: 'Blindfolding: Q² (Stone–Geisser)', f: `Sel (i, k) dihilangkan pada putaran g bila (i + k) mod D = g, D = ${r.blind.D}  →  tiap sel hilang tepat satu kali dalam ${r.blind.D} putaran\\nSel hilang diganti rata-rata sel tersisa pada kolom itu, model PLS diestimasi ulang, lalu sel hilang diprediksi:\\n  communality:  x̂ᵢₖ = x̄ₖ + sₖ·λₖ·Yⱼᵢ            (konstruk reflektif multi-indikator)\\n  redundancy:   x̂ᵢₖ = x̄ₖ + sₖ·λₖ·Σₚ βⱼₚ Yₚᵢ     (konstruk endogen reflektif atau indikator tunggal)\\nQ² = 1 − SSE/SSO,   SSE = Σ(x − x̂)²,   SSO = Σ(x − x̄ₖ)²   (dijumlahkan pada seluruh sel dan putaran)`, n: 'Q² > 0: prediksi model lebih baik daripada rata-rata sederhana. Konstruk formatif multi-indikator tidak dihitung (loading tidak bermakna sebagai prediktor sel).' });
    if (r.predict) st.push({ t: 'PLSpredict (validasi silang k-lipatan)', f: `Data diacak (seed ${r.predict.seed}) dan dibagi ${r.predict.folds} lipatan; ${r.predict.reps} ulangan\\nUntuk tiap lipatan: estimasi PLS pada data latih (baku dengan rata-rata & sd data latih), skor konstruk lipatan uji Yⱼ = Σ wₕ zₕ\\n${r.predict.technique === 'direct' ? 'DA: Ŷⱼ = Σₚ βⱼₚ Yₚ  (Yₚ = skor dari indikator lipatan uji milik pendahulu langsung)' : 'EA: Ŷⱼ = Σₚ βⱼₚ Ŷₚ  (berantai mulai dari konstruk eksogen saja)'}\\nx̂ = x̄_latih + s_latih·λₖ·Ŷⱼ;   RMSE = √(Σ(x − x̂)²/n),  MAE = Σ|x − x̂|/n\\nQ²predict = 1 − Σ(x − x̂)² / Σ(x − x̄_latih)²   (benchmark naif = rata-rata data latih)\\nBenchmark LM: regresi linear indikator target pada semua indikator ${r.predict.technique === 'direct' ? 'konstruk pendahulu langsung' : 'konstruk eksogen leluhur'}`, n: 'Seluruh prediksi dibuat untuk kasus yang tidak dipakai mengestimasi model. Hasil dirata-ratakan atas ulangan.' });
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
    if (r.mardia) ip.push(`<strong>Normalitas data (Mardia):</strong> kurtosis relatif = ${f3(r.mardia.kurt.relative)} (p ${r.mardia.kurt.p < 0.0001 ? '< 0,0001' : '= ' + fmtP(r.mardia.kurt.p)}), skewness multivariat p ${r.mardia.skew.pSmall < 0.0001 ? '< 0,0001' : '= ' + fmtP(r.mardia.skew.pSmall)}. PLS-SEM tidak mensyaratkan normalitas, sehingga hasil ini hanya informasi; bootstrap tetap sahih.`);
    if (r.blind) {
      const red = r.blind.constructs.filter((c) => c.red), pos = red.filter((c) => c.red.q2 > 0), neg = red.filter((c) => !(c.red.q2 > 0));
      if (red.length) ip.push(`<strong>Relevansi prediktif (Q², blindfolding D = ${r.blind.D}):</strong> ${pos.length ? 'Q² redundancy &gt; 0 pada ' + pos.map((c) => esc(c.name) + ' (' + f3(c.red.q2) + ')').join(', ') + ' → model memiliki relevansi prediktif.' : ''}${neg.length ? ' Q² ≤ 0 pada ' + neg.map((c) => esc(c.name) + ' (' + f3(c.red.q2) + ')').join(', ') + ' → tidak ada relevansi prediktif; prediktornya tidak memperbaiki tebakan rata-rata.' : ''}`);
      const lowC = r.blind.constructs.filter((c) => c.comm && c.comm.q2 <= 0); if (lowC.length) ip.push('<strong>Q² communality ≤ 0</strong> pada ' + lowC.map((c) => esc(c.name)).join(', ') + ': model pengukuran konstruk itu tidak memprediksi indikator yang dihilangkan lebih baik daripada rata-rata; periksa loading dan indikator.');
    }
    if (r.predict) {
      const P = r.predict, lvTxt = { 'tinggi': 'daya prediksi <strong>tinggi</strong> (seluruh indikator lebih akurat daripada LM)', 'sedang': 'daya prediksi <strong>sedang</strong> (mayoritas indikator lebih akurat daripada LM)', 'rendah': 'daya prediksi <strong>rendah</strong> (hanya minoritas indikator lebih akurat daripada LM)', 'tidak ada': '<strong>tanpa daya prediksi</strong> (' + 'tidak ada indikator yang mengalahkan LM, atau Q²predict ≤ 0)', 'tak tersedia': 'benchmark LM tidak tersedia' };
      P.constructs.forEach((c) => ip.push(`<strong>PLSpredict ${esc(c.name)}:</strong> ${c.nBetter} dari ${c.nInd} indikator memiliki RMSE PLS &lt; LM dan ${c.nQpos} dari ${c.nInd} memiliki Q²predict &gt; 0 → ${lvTxt[c.level]}.`));
      ip.push('<strong>Catatan PLSpredict:</strong> LM meregresikan tiap indikator target pada seluruh indikator pendahulu tanpa struktur konstruk, sehingga menjadi tolok ukur apakah model struktural PLS menambah daya prediksi. Bila distribusi galat prediksi sangat miring, gunakan MAE sebagai pembanding.' + (P.repsOK < P.reps ? ' ' + (P.reps - P.repsOK) + ' ulangan dilewati.' : ''));
    }
    ip.push('<strong>Catatan:</strong> PLS-SEM tidak mengasumsikan normalitas dan cocok untuk sampel kecil atau tujuan prediktif, tetapi tidak menghasilkan indeks kecocokan χ²/RMSEA/CFI seperti CB-SEM. Untuk menguji kecocokan model secara keseluruhan gunakan metode CB-SEM.');
    r.warnings.forEach((w) => ip.push('<strong>Peringatan:</strong> ' + esc(w)));
    sum += mardiaTable(r.mardia, 'pls');
    sum += pathDiagram(gPLS(r));
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Interpretasi PLS-SEM</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'PLS-SEM (skema ' + r.scheme + ')'], ['n', r.n], ['Konstruk', r.m], ['Bootstrap', boot ? boot.B : 'tidak']].concat(r.blind ? [['Blindfolding D', r.blind.D]] : []).concat(r.predict ? [['PLSpredict', r.predict.folds + ' lipatan × ' + r.predict.repsOK + ' (' + (r.predict.technique === 'direct' ? 'DA' : 'EA') + ')']] : []), data: exp, charts: [diagramChart(gPLS(r))] });
  }
})();
