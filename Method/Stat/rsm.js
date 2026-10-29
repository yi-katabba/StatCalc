/* =========================================================================
     METODE: RESPONSE SURFACE METHODOLOGY (RSM)
     -------------------------------------------------------------------------
     UI + grafik. Perhitungan statistik ada di Method/Stat/rsm-core.js
     (window.StatCalcRSMCore), dimuat sebelum file ini.

     Isi: model orde dua (linear / interaksi / kuadratik), ANOVA + lack of fit,
     koefisien (terkode & satuan asli), plot kontur & permukaan 3D, titik
     stasioner + analisis kanonik, optimasi, prediksi dengan CI/PI, diagnostik.
     ========================================================================= */
(function () {
  'use strict';
  const Core = window.StatCalcRSMCore;
  if (!Core) { console.error('rsm.js: rsm-core.js belum dimuat.'); return; }

  /* Pita pengaturan tampilan hasil */
  if (window.StatRibbon) window.StatRibbon.mount({
    view: '#view-rsm', key: 'rsm',
    tabs: [
      { id: 'hasil', label: 'Hasil', groups: [
        { label: 'Tab hasil', cols: 2, items: [
          { type: 'toggle', key: 'mdl', label: 'Model & ANOVA', tab: 'rs-tab-model' },
          { type: 'toggle', key: 'cof', label: 'Koefisien & Persamaan', tab: 'rs-tab-coef' },
          { type: 'toggle', key: 'plt', label: 'Grafik Respon', tab: 'rs-tab-plot' },
          { type: 'toggle', key: 'opt', label: 'Optimasi', tab: 'rs-tab-opt' },
          { type: 'toggle', key: 'dgn', label: 'Diagnostik', tab: 'rs-tab-diag' },
          { type: 'toggle', key: 'stp', label: 'Langkah Perhitungan', tab: 'rs-tab-steps' },
        ] },
        { label: 'Bagian lain', items: [
          { type: 'toggle', key: 'concl', label: 'Langkah 4 Kesimpulan', hide: ['#rs-conclusion-card'] },
        ] },
      ], tip: 'Pengaturan pita hanya menyembunyikan atau menampilkan bagian hasil; perhitungan dan langkah-langkah tidak berubah.' },
      { id: 'grafik', label: 'Grafik & Ekspor', groups: [
        { label: 'Grafik', items: [
          { type: 'toggle', key: 'figs', label: 'Grafik pendukung', hide: ['.ex-grid', '.ex-bar a'] },
        ] },
        { label: 'Unduhan', items: [
          { type: 'toggle', key: 'dl', label: 'Panel unduhan (.docx/.zip)', hide: ['.ex-panel', '.ex-bar'] },
        ] },
      ] },
    ],
  });

  /* ---------- CSS khusus halaman RSM ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #view-rsm table.data-table thead th input{ width:100%; min-width:92px; border:none; background:transparent; text-align:center; font:inherit; font-weight:700; color:var(--ink); padding:2px 4px; min-height:0; }
    #view-rsm table.data-table thead th input:focus{ outline:2px solid var(--accent-2); outline-offset:1px; background:#fff; }
    #view-rsm table.data-table thead th.rs-resp{ background:var(--accent-soft); }
    #view-rsm table.data-table thead th input{ font-size:13px; }
    .rs-ctl{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px 14px; align-items:end; margin:0 0 12px; padding:12px 14px; background:var(--paper-2); border-radius:var(--radius); }
    .rs-ctl label{ display:flex; flex-direction:column; gap:4px; font-size:12.5px; font-weight:600; color:var(--ink-soft); }
    .rs-ctl .select-input, .rs-ctl .plain-input{ width:100%; min-width:0; }
    .rs-ctl h4{ grid-column:1 / -1; margin:0; font-size:14px; font-family:var(--font-body); color:var(--accent); }
    .rs-ctl .rs-sub{ grid-column:1 / -1; margin:-4px 0 0; font-size:12.5px; color:var(--ink-faint); }
    .rs-ctl .btn-primary, .rs-ctl .btn-ghost{ width:100%; flex:none; }
    .rs-plot-wrap{ display:flex; flex-direction:column; gap:16px; }
    .rs-fig{ border:1px solid var(--rule); border-radius:var(--radius); background:#fff; padding:8px; }
    .rs-fig svg{ display:block; width:100%; height:auto; }
    .rs-fig .rs-cap{ font-size:12.5px; color:var(--ink-soft); margin:6px 4px 2px; text-align:justify; }
    .rs-pred{ margin-top:10px; }
    table.mini-table td.rs-l, table.mini-table th.rs-l{ text-align:left; }
    table.mini-table td.rs-in{ padding-left:22px; text-align:left; color:var(--ink-soft); }
    table.mini-table tr.rs-best td{ background:#E7F3EA; }
    .rs-eq{ font-family:var(--font-mono); font-size:13px; line-height:1.7; background:var(--paper-2); border-radius:var(--radius); padding:12px 14px; overflow-x:auto; white-space:normal; word-break:break-word; margin:6px 0 12px; }
  `;
  document.head.appendChild(css);

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const state = { k: 3, model: 'quad', minRows: 11, res: null, plot: null };
  const DEFAULT_NAMES = ['Waktu', 'Konsentrasi', 'pH', 'Suhu'];

  const el = {
    varCount: $('#rsVarCount'), incK: $('#rsIncK'), decK: $('#rsDecK'), model: $('#rsModel'),
    buildBtn: $('#rsBuildTableBtn'), setupError: $('#rsSetupError'),
    dataCard: $('#rs-data-card'), minHint: $('#rsMinRowsHint'),
    tableHead: $('#rsDataTableHead'), tableBody: $('#rsDataTableBody'),
    addRowBtn: $('#rsAddRowBtn'), removeRowBtn: $('#rsRemoveRowBtn'), clearBtn: $('#rsClearBtn'),
    fillSampleBtn: $('#rsFillSampleBtn'), calcBtn: $('#rsCalcBtn'), dataError: $('#rsDataError'),
    resultsCard: $('#rs-results-card'), conclusionCard: $('#rs-conclusion-card'),
    modelWrap: $('#rsModelWrap'), coefWrap: $('#rsCoefWrap'), plotCtl: $('#rsPlotCtl'), plotWrap: $('#rsPlotWrap'),
    optCtl: $('#rsOptCtl'), optWrap: $('#rsOptWrap'), diagWrap: $('#rsDiagWrap'), stepsWrap: $('#rsStepsWrap'),
    conclusionWrap: $('#rsConclusionWrap'),
  };

  /* ---------- Util ---------- */
  function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(x, d = 4) { return (x === null || x === undefined || !Number.isFinite(x)) ? '-' : Number(x).toFixed(d); }
  function fmtP(p) { return !Number.isFinite(p) ? '-' : (p < 0.0001 ? '< 0.0001' : p.toFixed(4)); }
  /* angka ringkas untuk koefisien/persamaan: 5 angka bermakna */
  function fmtC(v) {
    if (!Number.isFinite(v)) return '-';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e5 || a < 1e-4) return v.toExponential(3);
    return String(Number(v.toPrecision(5)));
  }
  const short = (s) => String(s).replace(/\s*\(.*\)\s*$/, '').trim() || String(s);
  const statCard = (label, value) => `<div class="stat-card"><div class="k">${escapeHTML(label)}</div><div class="v">${escapeHTML(String(value))}</div></div>`;
  function showError(node, msg) { node.textContent = msg; node.hidden = false; }
  function hideError(node) { node.hidden = true; node.textContent = ''; }
  const sgn = (v) => (v < 0 ? '\u2212' : '+');
  const parseNum = (v) => {
    const s = String(v).trim();
    if (s === '') return null;
    const n = window.StatCalcImport && window.StatCalcImport.normNum ? window.StatCalcImport.normNum(s) : s.replace(',', '.');
    const x = n === null ? NaN : Number(n);
    return Number.isFinite(x) ? x : NaN;
  };
  function equation(resp, items, useShort) {
    // items: [{label, b}] pertama = konstanta
    let s = `${short(resp)} = ${fmtC(items[0].b)}`;
    for (let i = 1; i < items.length; i++) s += ` ${sgn(items[i].b)} ${fmtC(Math.abs(items[i].b))}\u00B7${useShort ? short(items[i].label) : items[i].label}`;
    return s;
  }

  /* =========================================================================
     LANGKAH 1 & 2: setup + tabel data
     ========================================================================= */
  const stepK = (d) => { el.varCount.value = Math.max(2, Math.min(4, (parseInt(el.varCount.value, 10) || 3) + d)); };
  el.incK.addEventListener('click', () => stepK(1));
  el.decK.addEventListener('click', () => stepK(-1));

  el.buildBtn.addEventListener('click', () => {
    hideError(el.setupError);
    const k = parseInt(el.varCount.value, 10);
    if (!Number.isInteger(k) || k < 2 || k > 4) { showError(el.setupError, 'Jumlah faktor harus berupa bilangan bulat antara 2 dan 4.'); return; }
    state.k = k; state.model = el.model.value;
    state.minRows = Core.minTerms(k, state.model) + 1;
    el.minHint.textContent = state.minRows;
    buildTable(k, Math.max(state.minRows, 8));
    el.dataCard.hidden = false;
    el.resultsCard.hidden = true; el.conclusionCard.hidden = true;
    el.dataCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function buildTable(k, rowCount, names, resp) {
    const headRow = document.createElement('tr');
    let h = '<th>No</th>';
    for (let j = 0; j < k; j++) h += `<th><input type="text" class="rs-name" data-col="${j}" value="${escapeHTML((names && names[j]) || DEFAULT_NAMES[j] || 'Faktor ' + (j + 1))}" aria-label="Nama faktor ${j + 1}"></th>`;
    h += `<th class="rs-resp"><input type="text" class="rs-name" data-col="${k}" value="${escapeHTML(resp || 'Degradasi')}" aria-label="Nama respon"></th>`;
    headRow.innerHTML = h;
    el.tableHead.innerHTML = '';
    el.tableHead.appendChild(headRow);
    el.tableBody.innerHTML = '';
    for (let r = 0; r < rowCount; r++) addRow();
  }
  function addRow() {
    const k = state.k;
    const tr = document.createElement('tr');
    const num = document.createElement('td'); num.className = 'rownum'; tr.appendChild(num);
    for (let j = 0; j <= k; j++) {
      const td = document.createElement('td');
      td.innerHTML = `<input type="text" inputmode="decimal" data-role="${j === k ? 'Y' : 'X'}" data-col="${j}" placeholder="-">`;
      tr.appendChild(td);
    }
    el.tableBody.appendChild(tr);
    renumber();
  }
  function renumber() { $$('#rsDataTableBody tr').forEach((tr, i) => { tr.querySelector('.rownum').textContent = i + 1; }); }
  el.addRowBtn.addEventListener('click', addRow);
  el.removeRowBtn.addEventListener('click', () => {
    if (el.tableBody.rows.length <= state.minRows) return;
    el.tableBody.deleteRow(el.tableBody.rows.length - 1); renumber();
  });
  el.clearBtn.addEventListener('click', () => { $$('input', el.tableBody).forEach((i) => { i.value = ''; i.classList.remove('invalid'); }); });

  /* Contoh: CCD face-centered 3 faktor (20 run) - degradasi zat warna (%) */
  const SAMPLE = [
    [60, 20, 6, 81.92], [60, 20, 6, 82.14], [30, 10, 3, 61.75], [90, 20, 6, 84.04], [60, 20, 9, 75.59],
    [30, 10, 9, 68.38], [90, 30, 3, 66.26], [60, 20, 6, 81.57], [30, 30, 3, 52.29], [60, 20, 3, 70.69],
    [60, 30, 6, 73.17], [30, 20, 6, 70.58], [60, 20, 6, 83.64], [60, 20, 6, 81.36], [30, 30, 9, 50.31],
    [90, 10, 9, 80.39], [60, 20, 6, 82.16], [90, 30, 9, 68.65], [90, 10, 3, 71.72], [60, 10, 6, 85.25],
  ];
  el.fillSampleBtn.addEventListener('click', () => {
    el.varCount.value = 3; el.model.value = 'quad';
    state.k = 3; state.model = 'quad'; state.minRows = Core.minTerms(3, 'quad') + 1; el.minHint.textContent = state.minRows;
    buildTable(3, SAMPLE.length, ['Waktu (menit)', 'Konsentrasi (mg/L)', 'pH'], 'Degradasi (%)');
    $$('tr', el.tableBody).forEach((tr, i) => $$('input', tr).forEach((inp, j) => { inp.value = SAMPLE[i][j]; inp.classList.remove('invalid'); }));
    el.dataCard.hidden = false;
    hideError(el.dataError);
  });

  /* dipanggil modul impor: ganti judul kolom sesuai judul file */
  function applyNames(info) {
    if (!info || !info.names) return;
    const ins = $$('input.rs-name', el.tableHead);
    info.names.forEach((n, j) => { const inp = ins[(info.offset || 0) + j]; if (inp && String(n).trim()) inp.value = String(n).trim(); });
  }

  /* =========================================================================
     HITUNG
     ========================================================================= */
  function collect() {
    const k = state.k, X = [], y = [];
    let bad = 0, partial = 0;
    $$('tr', el.tableBody).forEach((tr) => {
      const ins = $$('input', tr);
      const vals = ins.map((i) => i.value.trim());
      ins.forEach((i) => i.classList.remove('invalid'));
      if (vals.every((v) => v === '')) return;
      const nums = vals.map(parseNum);
      let ok = true;
      nums.forEach((v, j) => { if (v === null || Number.isNaN(v)) { ok = false; ins[j].classList.add('invalid'); } });
      if (!ok) { if (nums.some((v) => v === null)) partial++; bad += nums.filter((v) => Number.isNaN(v)).length; return; }
      X.push(nums.slice(0, k)); y.push(nums[k]);
    });
    const heads = $$('input.rs-name', el.tableHead).map((i) => i.value.trim());
    const names = heads.slice(0, k).map((n, j) => n || DEFAULT_NAMES[j] || 'Faktor ' + (j + 1));
    return { X, y, names, resp: heads[k] || 'Respon', bad, partial };
  }

  el.calcBtn.addEventListener('click', () => {
    hideError(el.dataError);
    const d = collect();
    if (d.bad || d.partial) { showError(el.dataError, 'Ada sel yang kosong atau bukan angka (ditandai merah). Setiap baris yang diisi harus lengkap: semua faktor dan respon.'); return; }
    if (d.X.length < state.minRows) { showError(el.dataError, `Data terlalu sedikit: model ini memiliki ${state.minRows - 1} suku sehingga minimal ${state.minRows} percobaan diperlukan, sedangkan baru ${d.X.length} baris terisi.`); return; }
    let res;
    try { res = Core.analyze({ X: d.X, y: d.y, names: d.names, resp: d.resp, model: state.model }); }
    catch (e) {
      if (e.message === 'KONSTAN') showError(el.dataError, `Faktor "${d.names[e.idx]}" bernilai sama di semua baris, sehingga tidak ada rentang untuk dimodelkan. Variasikan nilainya.`);
      else if (e.message === 'SINGULAR') showError(el.dataError, 'Matriks rancangan singular: rancangan percobaan tidak cukup untuk menaksir semua suku model. Biasanya karena faktor hanya diuji pada 2 level (tidak bisa suku kuadrat), ada faktor yang berkolinear sempurna, atau ada terlalu banyak baris identik. Coba model "Linear + interaksi" atau tambahkan titik tengah/aksial (CCD, Box-Behnken).');
      else if (e.message === 'DATA_KURANG') showError(el.dataError, `Data terlalu sedikit untuk model ini (butuh minimal ${e.need} percobaan).`);
      else showError(el.dataError, 'Perhitungan gagal: ' + e.message);
      return;
    }
    state.res = res;
    renderAll(res);
    el.resultsCard.hidden = false; el.conclusionCard.hidden = false;
    $$('.tab-btn', $('#rsResultTabs')).forEach((b) => b.classList.remove('active'));
    $$('.tab-panel', el.resultsCard).forEach((p) => p.classList.remove('active'));
    $('.tab-btn[data-tab="rs-tab-model"]', $('#rsResultTabs')).classList.add('active');
    $('#rs-tab-model').classList.add('active');
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
    el.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#rsResultTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    $$('.tab-btn', $('#rsResultTabs')).forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-panel', btn.closest('.step-card')).forEach((p) => p.classList.remove('active'));
    $('#' + btn.dataset.tab).classList.add('active');
  });

  function renderAll(res) {
    renderModel(res); renderCoef(res); initPlot(res); renderOptimization(res);
    renderDiag(res); renderSteps(res); renderConclusion(res);
    exportAll(res);
  }

  /* =========================================================================
     TAB: MODEL & ANOVA
     ========================================================================= */
  function adequacy(res) {
    const m = res.m, lofOK = !res.lof.testable || res.lof.p >= res.alpha;
    const gap = m.adj - m.predR2;
    return {
      sig: m.pF < res.alpha, lofOK, lofTestable: res.lof.testable,
      gapOK: Number.isFinite(gap) ? gap < 0.2 : false, gap,
      apOK: res.adeq > 4,
    };
  }
  function renderModel(res) {
    const m = res.m, ad = adequacy(res);
    let html = `<div class="stat-grid">${statCard('Jumlah percobaan (n)', res.n)}${statCard('Jumlah suku model', res.p)}${statCard('R\u00B2', fmt(m.R2, 4))}${statCard('R\u00B2 adjusted', fmt(m.adj, 4))}${statCard('R\u00B2 prediksi', fmt(m.predR2, 4))}${statCard('Simpangan baku (S)', fmt(m.S, 4))}${statCard('CV (%)', fmt(res.cv, 2))}${statCard('Adequate precision', fmt(res.adeq, 2))}</div><div style="height:14px"></div>`;

    // ---- ANOVA ----
    let rows = `<tr><td class="rs-l"><strong>Model</strong></td><td>${fmt(m.SSR)}</td><td>${m.dfR}</td><td>${fmt(m.MSR)}</td><td>${fmt(m.F)}</td><td>${fmtP(m.pF)}</td></tr>`;
    res.groups.forEach((g) => { rows += `<tr><td class="rs-in">${escapeHTML(g.label)}</td><td>${fmt(g.SS)}</td><td>${g.df}</td><td>${fmt(g.MS)}</td><td>${fmt(g.F)}</td><td>${fmtP(g.p)}</td></tr>`; });
    rows += `<tr><td class="rs-l"><strong>Residual (galat)</strong></td><td>${fmt(m.SSE)}</td><td>${m.dfE}</td><td>${fmt(m.MSE)}</td><td>-</td><td>-</td></tr>`;
    const L = res.lof;
    if (L.dfLOF > 0) rows += `<tr><td class="rs-in">Lack of Fit</td><td>${fmt(L.SSLOF)}</td><td>${L.dfLOF}</td><td>${L.testable ? fmt(L.MSLOF) : fmt(L.SSLOF / L.dfLOF)}</td><td>${L.testable ? fmt(L.F) : '-'}</td><td>${L.testable ? fmtP(L.p) : '-'}</td></tr>`;
    if (L.dfPE > 0) rows += `<tr><td class="rs-in">Pure Error (galat murni)</td><td>${fmt(L.SSPE)}</td><td>${L.dfPE}</td><td>${fmt(L.MSPE)}</td><td>-</td><td>-</td></tr>`;
    rows += `<tr><td class="rs-l"><strong>Total</strong></td><td>${fmt(m.SST)}</td><td>${m.dfT}</td><td>-</td><td>-</td><td>-</td></tr>`;
    html += `<div class="test-block"><h4>Tabel ANOVA Model RSM (${escapeHTML(res.modelName)})</h4>
      <p class="test-sub">Variasi respon dipecah menjadi bagian yang dijelaskan model dan galat. Galat dipecah lagi menjadi <em>lack of fit</em> (ketidaksesuaian model) dan <em>pure error</em> (variasi acak dari ulangan di titik rancangan yang sama).</p>
      <div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Sumber Variasi</th><th>JK (SS)</th><th>db</th><th>KT (MS)</th><th>F hitung</th><th>Sig. (p)</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="test-note">Baris Linear, Kuadrat, dan Interaksi memakai jumlah kuadrat terkoreksi (adjusted): kenaikan galat bila seluruh suku kelompok itu dikeluarkan dari model.</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">semua koefisien model selain konstanta sama dengan nol (faktor tidak memengaruhi ${escapeHTML(short(res.resp))}).</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">minimal satu koefisien tidak sama dengan nol.</span></div>
      </div>
      <div class="test-stat-row">${statCard('F hitung', fmt(m.F))}${statCard('df1, df2', m.dfR + ', ' + m.dfE)}${statCard('Sig. (p-value)', fmtP(m.pF))}</div>
      <div class="test-verdict ${ad.sig ? 'ok' : 'bad'}">${ad.sig ? 'Model signifikan (p &lt; 0.05)' : 'Model tidak signifikan (p &ge; 0.05)'}</div>
      <p class="test-conclusion">${ad.sig
        ? `Karena p-value (${fmtP(m.pF)}) &lt; 0.05, H0 ditolak: paling tidak satu faktor (atau interaksi/kuadratnya) berpengaruh nyata terhadap ${escapeHTML(short(res.resp))}.`
        : `Karena p-value (${fmtP(m.pF)}) &ge; 0.05, H0 gagal ditolak: model belum terbukti menjelaskan ${escapeHTML(short(res.resp))} lebih baik daripada rata-rata saja.`}</p></div>`;

    // ---- Lack of fit ----
    let lofHtml;
    if (L.testable) {
      lofHtml = `<div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">model sesuai dengan data (tidak ada lack of fit).</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">model tidak sesuai (ada lack of fit); model orde yang lebih tinggi mungkin diperlukan.</span></div></div>
        <div class="test-stat-row">${statCard('F lack of fit', fmt(L.F))}${statCard('df1, df2', L.dfLOF + ', ' + L.dfPE)}${statCard('Sig. (p-value)', fmtP(L.p))}</div>
        <div class="test-verdict ${L.p >= res.alpha ? 'ok' : 'bad'}">${L.p >= res.alpha ? 'Lack of fit tidak signifikan (baik)' : 'Lack of fit signifikan (model kurang pas)'}</div>
        <p class="test-conclusion">${L.p >= res.alpha
          ? `Karena p-value (${fmtP(L.p)}) &ge; 0.05, H0 gagal ditolak: tidak terbukti ada ketidaksesuaian model. Ini hasil yang diharapkan dalam RSM.`
          : `Karena p-value (${fmtP(L.p)}) &lt; 0.05, H0 ditolak: galat model jauh lebih besar daripada galat acak murni. Pertimbangkan model orde lebih tinggi, transformasi respon, atau periksa pencilan.`}</p>`;
    } else {
      lofHtml = `<p class="test-conclusion">Uji lack of fit <strong>tidak dapat dihitung</strong>. ${L.dfPE <= 0 ? 'Tidak ada ulangan pada titik rancangan yang sama (derajat bebas galat murni = 0); tambahkan beberapa ulangan di titik pusat.' : L.dfLOF <= 0 ? 'Jumlah titik rancangan berbeda tidak lebih banyak dari jumlah suku model sehingga lack of fit tidak punya derajat bebas.' : 'Galat murni bernilai nol (ulangan identik sempurna).'}</p>`;
    }
    html += `<div class="test-block"><h4>Uji Lack of Fit</h4><p class="test-sub">Membandingkan galat ketidaksesuaian model dengan galat murni dari ulangan.</p>${lofHtml}</div>`;

    // ---- Perbandingan model ----
    const okModels = res.compare.filter((c) => c.ok && c.key !== 'mean' && Number.isFinite(c.predR2));
    const best = okModels.length ? okModels.reduce((a, b) => (b.predR2 > a.predR2 ? b : a)) : null;
    let crow = '';
    res.compare.forEach((c) => {
      if (c.key === 'mean') return;
      if (!c.ok) { crow += `<tr><td class="rs-l">${escapeHTML(c.name)}</td><td>${c.p}</td><td colspan="7">${escapeHTML(c.why)}</td></tr>`; return; }
      const mark = (best && c.key === best.key) ? ' (disarankan)' : '';
      crow += `<tr class="${best && c.key === best.key ? 'rs-best' : ''}"><td class="rs-l">${escapeHTML(c.name)}${mark}</td><td>${c.p}</td><td>${fmt(c.S, 4)}</td><td>${fmt(c.R2, 4)}</td><td>${fmt(c.adj, 4)}</td><td>${fmt(c.predR2, 4)}</td><td>${c.seq ? fmtP(c.seq.p) : '-'}</td><td>${fmtP(c.pF)}</td><td>${Number.isFinite(c.lofP) ? fmtP(c.lofP) : '-'}</td></tr>`;
    });
    html += `<div class="test-block"><h4>Perbandingan Model (Model Summary Statistics)</h4>
      <p class="test-sub">Memeriksa apakah suku interaksi dan kuadrat memang diperlukan. Pilih model orde terendah yang signifikan secara sekuensial, tanpa lack of fit signifikan, dengan R&sup2; prediksi tertinggi.</p>
      <div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Model</th><th>Suku</th><th>S</th><th>R&sup2;</th><th>R&sup2; adj</th><th>R&sup2; pred</th><th>p sekuensial</th><th>p model</th><th>p lack of fit</th></tr></thead><tbody>${crow}</tbody></table></div>
      <p class="test-note">p sekuensial = uji kenaikan JK model dibanding model orde sebelumnya (dengan KT residual model yang lebih besar). Baris yang diberi warna hijau adalah model dengan R&sup2; prediksi tertinggi.</p></div>`;

    // ---- Kecukupan ----
    const row = (lab, val, ok, note) => `<tr><td class="rs-l">${lab}</td><td>${val}</td><td class="${ok === null ? '' : ok ? 'ok' : 'bad'}">${ok === null ? '-' : ok ? 'Terpenuhi' : 'Belum'}</td><td class="rs-l">${note}</td></tr>`;
    html += `<div class="test-block"><h4>Pemeriksaan Kecukupan Model</h4>
      <div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Kriteria</th><th>Nilai</th><th>Status</th><th class="rs-l">Acuan</th></tr></thead><tbody>
      ${row('Model signifikan', fmtP(m.pF), ad.sig, 'p &lt; 0.05')}
      ${row('Lack of fit tidak signifikan', ad.lofTestable ? fmtP(res.lof.p) : 'tidak teruji', ad.lofTestable ? ad.lofOK : null, 'p &ge; 0.05 (butuh ulangan titik pusat)')}
      ${row('R&sup2; adj &minus; R&sup2; pred', fmt(ad.gap, 4), Number.isFinite(ad.gap) ? ad.gapOK : null, 'selisih &lt; 0.2')}
      ${row('Adequate precision', fmt(res.adeq, 2), ad.apOK, 'rasio sinyal/derau &gt; 4')}
      </tbody></table></div></div>`;
    el.modelWrap.innerHTML = html;
  }

  /* =========================================================================
     TAB: KOEFISIEN & PERSAMAAN
     ========================================================================= */
  function renderCoef(res) {
    const k = res.k;
    let crow = '';
    res.coefs.forEach((c) => {
      const sig = c.p < res.alpha;
      crow += `<tr><td class="rs-l">${escapeHTML(c.label)}</td><td>${fmt(c.b)}</td><td>${fmt(c.se)}</td><td>${fmt(c.t, 3)}</td><td class="${c.term.type === 'const' ? '' : sig ? 'ok' : 'bad'}">${fmtP(c.p)}</td><td>${fmt(c.lo)}</td><td>${fmt(c.hi)}</td><td>${Number.isFinite(c.vif) ? fmt(c.vif, 2) : '-'}</td></tr>`;
    });
    let html = `<div class="test-block"><h4>Faktor &amp; Pengodean Variabel</h4>
      <p class="test-sub">Tiap faktor dikodekan ke skala terkode x = (X &minus; pusat) / setengah rentang, sehingga &minus;1 = nilai terendah dan +1 = nilai tertinggi pada data. Koefisien terkode dapat dibandingkan langsung antar faktor.</p>
      <div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Faktor</th><th>Simbol</th><th>Rendah (&minus;1)</th><th>Pusat (0)</th><th>Tinggi (+1)</th></tr></thead><tbody>
      ${res.names.map((n, i) => `<tr><td class="rs-l">${escapeHTML(n)}</td><td>${res.sym[i]}</td><td>${fmtC(res.cd.min[i])}</td><td>${fmtC(res.cd.center[i])}</td><td>${fmtC(res.cd.max[i])}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    html += `<div class="test-block"><h4>Koefisien Model (variabel terkode) &amp; Uji t</h4>
      <p class="test-sub">H0: koefisien = 0 untuk tiap suku, diuji dengan statistik t (db = ${res.dfE}). Hijau = signifikan pada &alpha; = 0.05. VIF &gt; 10 mengisyaratkan kolinearitas tinggi antar suku.</p>
      <div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Suku</th><th>Koefisien</th><th>SE</th><th>t</th><th>Sig. (p)</th><th>CI 95% bawah</th><th>CI 95% atas</th><th>VIF</th></tr></thead><tbody>${crow}</tbody></table></div></div>`;

    html += `<div class="test-block"><h4>Persamaan Model</h4>
      <p class="test-sub">Persamaan dalam variabel terkode (A, B, C, ... = faktor sesuai urutan di atas) dan dalam satuan asli faktor.</p>
      <p style="margin:6px 0 2px;font-weight:600;font-size:13px">Variabel terkode</p>
      <div class="rs-eq">${escapeHTML(equation(res.resp, res.coefs.map((c) => ({ label: c.sym, b: c.b })), false))}</div>
      <p style="margin:6px 0 2px;font-weight:600;font-size:13px">Satuan asli</p>
      <div class="rs-eq">${escapeHTML(equation(res.resp, res.actual.map((c) => ({ label: c.label.replace(/[^\u00B2\u00D7]+/g, (s) => short(s)), b: c.b })), false))}</div>
      <div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Suku</th><th>Koefisien (satuan asli)</th></tr></thead><tbody>
      ${res.actual.map((c) => `<tr><td class="rs-l">${escapeHTML(c.label)}</td><td>${fmtC(c.b)}</td></tr>`).join('')}
      </tbody></table></div></div>`;

    // interpretasi singkat
    const lin = res.coefs.filter((c) => c.term.type === 'lin');
    const strongest = lin.slice().sort((a, b) => Math.abs(b.b) - Math.abs(a.b))[0];
    const sigTerms = res.coefs.filter((c) => c.term.type !== 'const' && c.p < res.alpha);
    html += `<div class="test-block"><h4>Interpretasi Singkat</h4>
      <p class="test-conclusion">${sigTerms.length
        ? `Suku yang berpengaruh signifikan pada taraf 5%: <strong>${sigTerms.map((c) => escapeHTML(c.label)).join(', ')}</strong>. `
        : 'Tidak ada suku yang signifikan secara individual pada taraf 5%. '}Di antara pengaruh linear, faktor <strong>${escapeHTML(strongest.label)}</strong> memiliki koefisien terkode terbesar (${fmt(strongest.b, 3)}), artinya menaikkannya dari nilai pusat ke nilai tinggi ${strongest.b >= 0 ? 'menaikkan' : 'menurunkan'} ${escapeHTML(short(res.resp))} sekitar ${fmt(Math.abs(strongest.b), 2)} satuan bila suku lain tetap. Suku kuadrat negatif menandakan lengkung ke bawah (ada puncak), sedangkan suku kuadrat positif menandakan lengkung ke atas (ada lembah).</p></div>`;
    el.coefWrap.innerHTML = html;
  }

  /* =========================================================================
     GRAFIK: kontur, permukaan 3D, perturbasi
     ========================================================================= */
  const GC = () => window.GraphCore && window.GraphCore.u;
  const STOPS = [[46, 74, 97], [47, 127, 121], [141, 184, 138], [235, 217, 138], [189, 126, 31]];
  function colorAt(t) {
    t = Math.max(0, Math.min(1, t));
    const x = t * (STOPS.length - 1), i = Math.min(STOPS.length - 2, Math.floor(x)), f = x - i;
    const a = STOPS[i], b = STOPS[i + 1];
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
  }
  const f2 = (v) => (+v).toFixed(1);
  function tickFmt(v) { return v === 0 ? '0' : Number(v.toPrecision(3)).toString(); }

  /* hold: nilai terkode seluruh faktor (indeks i, j diabaikan) */
  function contourSvg(res, i, j, hold, o) {
    o = o || {};
    const u = GC(); if (!u) return '';
    const { esc, INK, SOFT, GRID } = u;
    const G = 41;
    const z = Core.surfaceGrid(res, i, j, hold, G);
    let zmin = Infinity, zmax = -Infinity;
    z.forEach((r) => r.forEach((v) => { if (v < zmin) zmin = v; if (v > zmax) zmax = v; }));
    const flat = !(zmax - zmin > 1e-12);
    const W = 640, H = 450, ml = 66, mr = 104, mt = 46, mb = 62;
    const pw = W - ml - mr, ph = H - mt - mb;
    const cw = pw / (G - 1), ch = ph / (G - 1);
    const px = (a) => ml + a * cw, py = (b) => mt + ph - b * ch;
    const norm = (v) => (flat ? 0.5 : (v - zmin) / (zmax - zmin));
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Inter, Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
    s += `<text x="${W / 2}" y="27" text-anchor="middle" font-size="16" font-weight="700" fill="${INK}">${esc(o.title || ('Kontur ' + short(res.resp)))}</text>`;
    for (let b = 0; b < G - 1; b++) for (let a = 0; a < G - 1; a++) {
      const v = (z[b][a] + z[b][a + 1] + z[b + 1][a] + z[b + 1][a + 1]) / 4;
      s += `<rect x="${f2(px(a))}" y="${f2(py(b + 1))}" width="${(cw + 0.6).toFixed(1)}" height="${(ch + 0.6).toFixed(1)}" fill="${colorAt(norm(v))}" shape-rendering="crispEdges"/>`;
    }
    // garis kontur (marching squares)
    const levels = [];
    if (!flat) { const nt = u.niceTicks(zmin, zmax, 11); nt.ticks.forEach((t) => { if (t > zmin + (zmax - zmin) * 0.02 && t < zmax - (zmax - zmin) * 0.02) levels.push(t); }); }
    levels.forEach((lv, q) => {
      let d = '', best = null;
      const tx = ml + pw * (0.18 + 0.64 * (levels.length > 1 ? q / (levels.length - 1) : 0.5)), ty = mt + ph * (q % 2 ? 0.34 : 0.66);
      for (let b = 0; b < G - 1; b++) for (let a = 0; a < G - 1; a++) {
        const v00 = z[b][a], v10 = z[b][a + 1], v11 = z[b + 1][a + 1], v01 = z[b + 1][a];
        const pts = [];
        const cross = (va, vb, xa, ya, xb, yb) => { if ((va - lv) * (vb - lv) < 0) { const t = (lv - va) / (vb - va); pts.push([xa + (xb - xa) * t, ya + (yb - ya) * t]); } };
        cross(v00, v10, a, b, a + 1, b); cross(v10, v11, a + 1, b, a + 1, b + 1); cross(v11, v01, a + 1, b + 1, a, b + 1); cross(v01, v00, a, b + 1, a, b);
        for (let n = 0; n + 1 < pts.length; n += 2) {
          const p1 = pts[n], p2 = pts[n + 1];
          const x1 = px(p1[0]), y1 = py(p1[1]), x2 = px(p2[0]), y2 = py(p2[1]);
          d += `M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`;
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dist = (mx - tx) ** 2 + (my - ty) ** 2;
          if (!best || dist < best.d) best = { d: dist, x: mx, y: my };
        }
      }
      if (d) s += `<path d="${d}" stroke="#ffffff" stroke-opacity=".85" stroke-width="1.1" fill="none"/>`;
      if (best) {
        const lt = esc(tickFmt(lv));
        s += `<text x="${f2(best.x)}" y="${f2(best.y + 3.5)}" text-anchor="middle" font-size="10" font-weight="600" fill="#fff" stroke="#fff" stroke-width="3.2" stroke-linejoin="round">${lt}</text>`;
        s += `<text x="${f2(best.x)}" y="${f2(best.y + 3.5)}" text-anchor="middle" font-size="10" font-weight="600" fill="#1C1E24">${lt}</text>`;
      }
    });
    // titik percobaan pada irisan
    res.Xc.forEach((x, r) => {
      const on = x.every((v, f) => f === i || f === j || Math.abs(v - hold[f]) < 0.02);
      if (!on) return;
      s += `<circle cx="${f2(px((x[i] + 1) / 2 * (G - 1)))}" cy="${f2(py((x[j] + 1) / 2 * (G - 1)))}" r="3.4" fill="#fff" stroke="#1C1E24" stroke-width="1.2"/>`;
    });
    // sumbu
    s += `<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="none" stroke="#1C1E24" stroke-width="1"/>`;
    [-1, -0.5, 0, 0.5, 1].forEach((c) => {
      const x = ml + (c + 1) / 2 * pw, y = mt + ph - (c + 1) / 2 * ph;
      s += `<line x1="${f2(x)}" y1="${mt + ph}" x2="${f2(x)}" y2="${mt + ph + 5}" stroke="#1C1E24"/><text x="${f2(x)}" y="${mt + ph + 19}" text-anchor="middle" font-size="11" fill="${SOFT}">${esc(tickFmt(res.cd.center[i] + res.cd.half[i] * c))}</text>`;
      s += `<line x1="${ml - 5}" y1="${f2(y)}" x2="${ml}" y2="${f2(y)}" stroke="#1C1E24"/><text x="${ml - 8}" y="${f2(y + 4)}" text-anchor="end" font-size="11" fill="${SOFT}">${esc(tickFmt(res.cd.center[j] + res.cd.half[j] * c))}</text>`;
    });
    s += `<text x="${ml + pw / 2}" y="${mt + ph + 40}" text-anchor="middle" font-size="12.5" font-weight="600" fill="${INK}">${esc(res.names[i])}</text>`;
    s += `<text transform="translate(16 ${mt + ph / 2}) rotate(-90)" text-anchor="middle" font-size="12.5" font-weight="600" fill="${INK}">${esc(res.names[j])}</text>`;
    // colorbar
    const cbx = W - mr + 26, cbw = 14;
    for (let n = 0; n < 40; n++) s += `<rect x="${cbx}" y="${f2(mt + ph - (n + 1) * ph / 40)}" width="${cbw}" height="${(ph / 40 + 0.6).toFixed(1)}" fill="${colorAt((n + 0.5) / 40)}" shape-rendering="crispEdges"/>`;
    s += `<rect x="${cbx}" y="${mt}" width="${cbw}" height="${ph}" fill="none" stroke="#1C1E24" stroke-width=".8"/>`;
    s += `<text x="${cbx}" y="${mt - 8}" font-size="11" font-weight="600" fill="${INK}">${esc(short(res.resp))}</text>`;
    const cbt = flat ? [zmin] : u.niceTicks(zmin, zmax, 6).ticks.filter((t) => t >= zmin - 1e-9 && t <= zmax + 1e-9);
    cbt.forEach((t) => { const y = mt + ph - norm(t) * ph; s += `<line x1="${cbx + cbw}" y1="${f2(y)}" x2="${cbx + cbw + 4}" y2="${f2(y)}" stroke="#1C1E24"/><text x="${cbx + cbw + 7}" y="${f2(y + 3.5)}" font-size="10.5" fill="${SOFT}">${esc(tickFmt(t))}</text>`; });
    const others = res.names.map((n, f) => (f === i || f === j ? null : `${short(n)} = ${tickFmt(res.cd.center[f] + res.cd.half[f] * hold[f])}`)).filter(Boolean);
    s += `<text x="${ml}" y="${H - 8}" font-size="11" fill="${SOFT}">\u25CB titik percobaan pada irisan ini${others.length ? '   |   Dipegang tetap: ' + esc(others.join(', ')) : ''}</text>`;
    void GRID;
    return s + '</svg>';
  }

  function surfaceSvg(res, i, j, hold, o) {
    o = o || {};
    const u = GC(); if (!u) return '';
    const { esc, INK, SOFT } = u;
    const G = 26;
    const z = Core.surfaceGrid(res, i, j, hold, G);
    let zmin = Infinity, zmax = -Infinity;
    z.forEach((r) => r.forEach((v) => { if (v < zmin) zmin = v; if (v > zmax) zmax = v; }));
    const flat = !(zmax - zmin > 1e-12);
    const az = 35 * Math.PI / 180, el_ = 27 * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el_), se = Math.sin(el_);
    const ZH = 1.5;
    const proj = (x, y, t) => { const Z = (t - 0.5) * ZH, xr = x * ca - y * sa, yr = x * sa + y * ca; return { x: xr, y: Z * ce + yr * se, d: yr }; };
    const tOf = (v) => (flat ? 0.5 : (v - zmin) / (zmax - zmin));
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const all = [];
    corners.forEach(([x, y]) => { all.push(proj(x, y, 0)); all.push(proj(x, y, 1)); });
    const minx = Math.min(...all.map((p) => p.x)), maxx = Math.max(...all.map((p) => p.x)), miny = Math.min(...all.map((p) => p.y)), maxy = Math.max(...all.map((p) => p.y));
    const W = 640, H = 470, mx = 90, mtop = 52, mbot = 62;
    const sc = Math.min((W - 2 * mx) / (maxx - minx), (H - mtop - mbot) / (maxy - miny));
    const ox = W / 2 - (minx + maxx) / 2 * sc, oy = mtop + (H - mtop - mbot) / 2 + (miny + maxy) / 2 * sc;
    const P = (x, y, t) => { const p = proj(x, y, t); return [ox + p.x * sc, oy - p.y * sc, p.d]; };
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Inter, Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
    s += `<text x="${W / 2}" y="27" text-anchor="middle" font-size="16" font-weight="700" fill="${INK}">${esc(o.title || ('Permukaan Respon ' + short(res.resp)))}</text>`;
    // lantai & rangka
    const fl = corners.map(([x, y]) => P(x, y, 0));
    s += `<polygon points="${fl.map((p) => f2(p[0]) + ',' + f2(p[1])).join(' ')}" fill="#F2EDDF" stroke="#AEA484" stroke-width="1"/>`;
    const back = corners.reduce((a, c) => (P(c[0], c[1], 0)[2] > P(a[0], a[1], 0)[2] ? c : a), corners[0]);
    const front = corners.reduce((a, c) => (P(c[0], c[1], 0)[2] < P(a[0], a[1], 0)[2] ? c : a), corners[0]);
    // dinding belakang (2 sisi dari sudut belakang)
    const bx = back[0], by = back[1];
    [[-bx, by], [bx, -by]].forEach(([x, y]) => {
      const a = P(bx, by, 0), b = P(x, y, 0), a2 = P(bx, by, 1), b2 = P(x, y, 1);
      s += `<polygon points="${f2(a[0])},${f2(a[1])} ${f2(b[0])},${f2(b[1])} ${f2(b2[0])},${f2(b2[1])} ${f2(a2[0])},${f2(a2[1])}" fill="#FBF9F2" stroke="#DAD2B8" stroke-width=".8"/>`;
    });
    // permukaan (pelukis: jauh dulu)
    const quads = [];
    for (let b = 0; b < G - 1; b++) for (let a = 0; a < G - 1; a++) {
      const x0 = -1 + 2 * a / (G - 1), x1 = -1 + 2 * (a + 1) / (G - 1), y0 = -1 + 2 * b / (G - 1), y1 = -1 + 2 * (b + 1) / (G - 1);
      const pts = [P(x0, y0, tOf(z[b][a])), P(x1, y0, tOf(z[b][a + 1])), P(x1, y1, tOf(z[b + 1][a + 1])), P(x0, y1, tOf(z[b + 1][a]))];
      const t = (tOf(z[b][a]) + tOf(z[b][a + 1]) + tOf(z[b + 1][a + 1]) + tOf(z[b + 1][a])) / 4;
      quads.push({ pts, t, d: (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4 });
    }
    quads.sort((p, q) => q.d - p.d);
    quads.forEach((q) => { s += `<polygon points="${q.pts.map((p) => f2(p[0]) + ',' + f2(p[1])).join(' ')}" fill="${colorAt(q.t)}" stroke="#ffffff" stroke-opacity=".55" stroke-width=".5"/>`; });
    // sumbu pada tepi depan
    const labelEdge = (c1, c2, axisIdx) => {
      const a = P(c1[0], c1[1], 0), b = P(c2[0], c2[1], 0);
      const midx = (a[0] + b[0]) / 2, midy = (a[1] + b[1]) / 2, cx = ox, cy = oy;
      let dx = midx - cx, dy = midy - cy; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const lo = res.cd.center[axisIdx] - res.cd.half[axisIdx], hi = res.cd.center[axisIdx] + res.cd.half[axisIdx];
      const first = axisIdx === i ? (c1[0] < c2[0] ? lo : hi) : (c1[1] < c2[1] ? lo : hi);
      const second = axisIdx === i ? (c1[0] < c2[0] ? hi : lo) : (c1[1] < c2[1] ? hi : lo);
      s += `<text x="${f2(a[0] + dx * 12)}" y="${f2(a[1] + dy * 12 + 4)}" text-anchor="middle" font-size="10.5" fill="${SOFT}">${esc(tickFmt(first))}</text>`;
      s += `<text x="${f2(b[0] + dx * 12)}" y="${f2(b[1] + dy * 12 + 4)}" text-anchor="middle" font-size="10.5" fill="${SOFT}">${esc(tickFmt(second))}</text>`;
      s += `<text x="${f2(midx + dx * 30)}" y="${f2(midy + dy * 30 + 4)}" text-anchor="middle" font-size="12.5" font-weight="600" fill="${INK}">${esc(res.names[axisIdx])}</text>`;
    };
    const fx = front[0], fy = front[1];
    labelEdge([fx, fy], [-fx, fy], i);
    labelEdge([fx, fy], [fx, -fy], j);
    // sumbu Z di sudut paling kiri
    const left = corners.reduce((a, c) => (P(c[0], c[1], 0)[0] < P(a[0], a[1], 0)[0] ? c : a), corners[0]);
    const zb = P(left[0], left[1], 0), zt = P(left[0], left[1], 1);
    s += `<line x1="${f2(zb[0])}" y1="${f2(zb[1])}" x2="${f2(zt[0])}" y2="${f2(zt[1])}" stroke="#1C1E24" stroke-width="1"/>`;
    [0, 0.5, 1].forEach((t) => { const p = P(left[0], left[1], t); s += `<line x1="${f2(p[0] - 4)}" y1="${f2(p[1])}" x2="${f2(p[0])}" y2="${f2(p[1])}" stroke="#1C1E24"/><text x="${f2(p[0] - 8)}" y="${f2(p[1] + 3.5)}" text-anchor="end" font-size="10.5" fill="${SOFT}">${esc(tickFmt(zmin + (zmax - zmin) * t))}</text>`; });
    s += `<text x="${f2(zt[0])}" y="${f2(zt[1] - 12)}" text-anchor="middle" font-size="12.5" font-weight="600" fill="${INK}">${esc(short(res.resp))}</text>`;
    const others = res.names.map((n, f) => (f === i || f === j ? null : `${short(n)} = ${tickFmt(res.cd.center[f] + res.cd.half[f] * hold[f])}`)).filter(Boolean);
    if (others.length) s += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${SOFT}">Dipegang tetap: ${esc(others.join(', '))}</text>`;
    return s + '</svg>';
  }

  /* Plot perturbasi: pengaruh tiap faktor bila diubah dari titik acuan (faktor lain tetap) */
  function perturbSvg(res, ref) {
    const SC = window.StatCharts; if (!SC) return '';
    const xs = []; for (let c = -1; c <= 1.0001; c += 0.25) xs.push(+c.toFixed(2));
    return SC.line({ title: 'Plot Perturbasi (Efek Tiap Faktor)', xLabel: 'Deviasi dari titik acuan (satuan terkode)', yLabel: short(res.resp), labels: xs.map((v) => String(v)),
      series: res.names.map((n, i) => ({ name: short(n), values: xs.map((c) => { const x = ref.slice(); x[i] = c; return Core.yhat(res, x); }) })), legend: true });
  }

  function pairs(k) { const p = []; for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) p.push([i, j]); return p; }

  function initPlot(res) {
    const k = res.k;
    state.plot = { i: 0, j: 1, type: 'both', hold: res.cd.center.map(() => 0) };
    const nameOpts = (sel) => res.names.map((n, f) => `<option value="${f}" ${f === sel ? 'selected' : ''}>${escapeHTML(n)}</option>`).join('');
    let holds = '';
    if (k > 2) holds = res.names.map((n, f) => `<label data-hold="${f}">${escapeHTML(short(n))} (tetap)<input type="text" class="plain-input" data-holdinp="${f}" value="${fmtC(res.cd.center[f])}" inputmode="decimal"></label>`).join('');
    el.plotCtl.innerHTML = `<div class="rs-ctl">
      <h4>Pengaturan grafik</h4>
      <p class="rs-sub">Pilih dua faktor untuk sumbu. Faktor lain dipegang pada nilai tetap (bawaan: nilai pusat; ubah bila perlu, mis. ke kondisi optimum).</p>
      <label>Sumbu horizontal<select class="select-input" id="rsAxX">${nameOpts(0)}</select></label>
      <label>Sumbu vertikal<select class="select-input" id="rsAxY">${nameOpts(1)}</select></label>
      <label>Jenis grafik<select class="select-input" id="rsPlotType"><option value="both">Kontur + Permukaan 3D</option><option value="contour">Kontur saja</option><option value="surface">Permukaan 3D saja</option></select></label>
      ${holds}
    </div>`;
    syncHoldVisibility();
    drawPlots();
  }
  function syncHoldVisibility() {
    const p = state.plot, res = state.res;
    $$('[data-hold]', el.plotCtl).forEach((l) => { l.hidden = (+l.dataset.hold === p.i || +l.dataset.hold === p.j); });
    void res;
  }
  el.plotCtl.addEventListener('change', (e) => {
    const res = state.res, p = state.plot; if (!res || !p) return;
    const t = e.target;
    if (t.id === 'rsAxX' || t.id === 'rsAxY') {
      let a = +$('#rsAxX').value, b = +$('#rsAxY').value;
      if (a === b) { if (t.id === 'rsAxX') b = (a + 1) % res.k; else a = (b + 1) % res.k; $('#rsAxX').value = a; $('#rsAxY').value = b; }
      p.i = a; p.j = b; syncHoldVisibility();
    } else if (t.id === 'rsPlotType') p.type = t.value;
    else if (t.dataset.holdinp !== undefined) {
      const f = +t.dataset.holdinp, v = parseNum(t.value);
      if (v === null || Number.isNaN(v)) { t.value = fmtC(res.cd.center[f] + res.cd.half[f] * p.hold[f]); return; }
      p.hold[f] = (v - res.cd.center[f]) / res.cd.half[f];
      if (Math.abs(p.hold[f]) > 1 + 1e-9) window.StatCalc && window.StatCalc.showToast && window.StatCalc.showToast('Nilai di luar rentang data: hasilnya ekstrapolasi, tafsirkan dengan hati-hati.');
    }
    drawPlots();
  });
  el.plotCtl.addEventListener('input', (e) => { if (e.target.dataset.holdinp !== undefined) { /* tunggu change */ } });

  function drawPlots() {
    const res = state.res, p = state.plot; if (!res || !p) return;
    const hold = p.hold.slice();
    const cap = (t) => `<p class="rs-cap">${t}</p>`;
    let html = '';
    if (p.type !== 'surface') html += `<div class="rs-fig">${contourSvg(res, p.i, p.j, hold)}${cap('Warna menunjukkan nilai prediksi respon; garis putih adalah garis kontur (respon yang sama). Kontur yang rapat berarti respon berubah cepat; kontur berbentuk lingkaran/elips tertutup menandakan puncak atau lembah.')}</div>`;
    if (p.type !== 'contour') html += `<div class="rs-fig">${surfaceSvg(res, p.i, p.j, hold)}${cap('Permukaan respon prediksi. Puncak tertinggi menunjukkan kombinasi kedua faktor yang memberi respon terbesar pada nilai faktor lain yang dipegang tetap.')}</div>`;
    html += `<div class="rs-fig">${perturbSvg(res, res.cd.center.map(() => 0))}${cap('Garis yang curam berarti respon sangat sensitif terhadap faktor itu; garis melengkung menandakan efek kuadratik. Titik acuan = pusat rancangan (kode 0).')}</div>`;
    el.plotWrap.innerHTML = html;
  }

  /* =========================================================================
     TAB: OPTIMASI (titik stasioner + pencarian optimum + prediksi)
     ========================================================================= */
  const NATURE = {
    max: 'maksimum (semua nilai eigen negatif: respon turun ke segala arah dari titik ini)',
    min: 'minimum (semua nilai eigen positif: respon naik ke segala arah dari titik ini)',
    saddle: 'titik pelana (nilai eigen berbeda tanda: naik pada satu arah, turun pada arah lain)',
    ridge: 'punggungan / lembah datar (ada nilai eigen mendekati nol, titik stasioner tidak tunggal atau jauh)',
  };
  function renderStationary(res) {
    if (!res.canon) {
      const g = res.coefs.filter((c) => c.term.type === 'lin');
      const nrm = Math.sqrt(g.reduce((s, c) => s + c.b * c.b, 0)) || 1;
      return `<div class="test-block"><h4>Arah Pendakian Curam</h4>
        <p class="test-sub">Model yang dipilih tidak memiliki suku kuadrat, sehingga tidak ada titik stasioner (puncak/lembah). Respon naik paling cepat searah gradien di bawah ini; gunakan model kuadratik (butuh titik pusat/aksial) untuk mencari optimum.</p>
        <div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Faktor</th><th>Koefisien terkode</th><th>Arah (satuan)</th></tr></thead><tbody>
        ${g.map((c) => `<tr><td class="rs-l">${escapeHTML(c.label)}</td><td>${fmt(c.b)}</td><td>${fmt(c.b / nrm, 3)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    const cn = res.canon;
    let html = `<div class="test-block"><h4>Titik Stasioner &amp; Analisis Kanonik</h4>
      <p class="test-sub">Titik stasioner adalah titik tempat gradien respon bernilai nol: x<sub>s</sub> = &minus;&frac12; B<sup>&minus;1</sup>b. Sifatnya ditentukan oleh nilai eigen matriks B (koefisien kuadrat dan &frac12; interaksi).</p>`;
    html += `<div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Nilai eigen</th><th>&lambda;</th><th class="rs-l">Arti</th></tr></thead><tbody>
      ${cn.eig.values.map((l, q) => `<tr><td class="rs-l">&lambda;${q + 1}</td><td>${fmt(l, 4)}</td><td class="rs-l">${Math.abs(l) < 1e-7 * Math.max(...cn.eig.values.map(Math.abs), 1e-12) ? 'mendekati nol (datar)' : l < 0 ? 'melengkung ke bawah' : 'melengkung ke atas'}</td></tr>`).join('')}</tbody></table></div>`;
    if (cn.xs) {
      html += `<p class="test-conclusion">Titik stasioner berupa <strong>${NATURE[cn.nature]}</strong>. Respon prediksi di titik ini: <strong>${fmt(cn.ys, 4)}</strong> (CI 95%: ${fmt(cn.pred.ci[0], 3)} s.d. ${fmt(cn.pred.ci[1], 3)}).</p>
        <div class="table-scroll" style="margin-top:10px"><table class="mini-table"><thead><tr><th class="rs-l">Faktor</th><th>Nilai terkode</th><th>Nilai asli</th><th>Rentang data</th></tr></thead><tbody>
        ${res.names.map((n, i) => `<tr><td class="rs-l">${escapeHTML(n)}</td><td>${fmt(cn.xs[i], 4)}</td><td>${fmtC(cn.actual[i])}</td><td>${fmtC(res.cd.min[i])} s.d. ${fmtC(res.cd.max[i])}</td></tr>`).join('')}</tbody></table></div>
        <div class="test-verdict ${cn.inside ? 'ok' : 'bad'}">${cn.inside ? 'Titik stasioner di dalam daerah percobaan' : 'Titik stasioner di luar daerah percobaan (ekstrapolasi)'}</div>
        <p class="test-note">${cn.inside ? 'Prediksi di titik ini dapat dipercaya sejauh model memadai.' : 'Titik stasioner jatuh di luar rentang data, sehingga prediksinya ekstrapolasi dan kurang andal. Gunakan hasil "Optimum dalam rentang data" di bawah, atau lakukan percobaan lanjutan ke arah titik tersebut.'}</p>`;
    } else html += `<p class="test-conclusion">Titik stasioner berupa <strong>${NATURE.ridge}</strong>. Cari optimum dengan pencarian terbatas pada rentang data di bawah.</p>`;
    return html + '</div>';
  }
  function renderOptimum(res, o, opts) {
    const pr = o.pred;
    const goalTxt = o.goal === 'max' ? 'memaksimalkan' : o.goal === 'min' ? 'meminimalkan' : `mencapai target ${fmtC(o.target)}`;
    const out = o.x.map((v, i) => Math.abs(v) > 1 + 1e-9);
    return `<div class="test-block"><h4>Kondisi Optimum (${goalTxt} ${escapeHTML(short(res.resp))})</h4>
      <p class="test-sub">Pencarian numerik (grid + pencarian lokal) pada model yang dipasang dalam batas faktor berikut: ${res.names.map((n, i) => `${escapeHTML(short(n))} ${fmtC(opts.loA[i])} s.d. ${fmtC(opts.hiA[i])}`).join('; ')}.</p>
      <div class="table-scroll"><table class="mini-table"><thead><tr><th class="rs-l">Faktor</th><th>Nilai optimum (asli)</th><th>Terkode</th></tr></thead><tbody>
      ${res.names.map((n, i) => `<tr><td class="rs-l">${escapeHTML(n)}</td><td>${fmtC(o.actual[i])}</td><td>${fmt(o.x[i], 3)}</td></tr>`).join('')}</tbody></table></div>
      <div class="test-stat-row">${statCard('Respon prediksi', fmt(pr.y, 4))}${statCard('CI 95% rata-rata', fmt(pr.ci[0], 3) + ' - ' + fmt(pr.ci[1], 3))}${statCard('PI 95% satu percobaan', fmt(pr.pi[0], 3) + ' - ' + fmt(pr.pi[1], 3))}</div>
      ${out.some(Boolean) ? '<p class="test-note">Sebagian faktor berada di luar rentang data (ekstrapolasi); hasilnya kurang andal.</p>' : ''}
      <p class="test-note">CI 95% adalah selang untuk rata-rata respon pada kondisi ini; PI 95% adalah selang untuk satu hasil percobaan baru, sehingga lebih lebar. Verifikasi dengan percobaan konfirmasi pada kondisi optimum.</p></div>`;
  }
  function renderOptimization(res) {
    const k = res.k;
    const box = res.names.map((n, i) => `<label>${escapeHTML(short(n))}: batas bawah<input type="text" class="plain-input" data-lo="${i}" value="${fmtC(res.cd.min[i])}" inputmode="decimal"></label><label>${escapeHTML(short(n))}: batas atas<input type="text" class="plain-input" data-hi="${i}" value="${fmtC(res.cd.max[i])}" inputmode="decimal"></label>`).join('');
    const pred = res.names.map((n, i) => `<label>${escapeHTML(n)}<input type="text" class="plain-input" data-pr="${i}" value="${fmtC(res.cd.center[i])}" inputmode="decimal"></label>`).join('');
    el.optCtl.innerHTML = `<div class="rs-ctl" id="rsOptForm">
      <h4>Pencarian kondisi optimum</h4>
      <p class="rs-sub">Pilih tujuan dan batas tiap faktor (bawaan: rentang data percobaan). Mengubah batas di luar rentang data berarti ekstrapolasi.</p>
      <label>Tujuan<select class="select-input" id="rsGoal"><option value="max">Maksimalkan respon</option><option value="min">Minimalkan respon</option><option value="target">Capai nilai target</option></select></label>
      <label id="rsTargetLbl" hidden>Nilai target<input type="text" class="plain-input" id="rsTarget" value="${fmtC(Math.round(res.m.ybar * 10) / 10)}" inputmode="decimal"></label>
      ${box}
      <button type="button" class="btn-primary" id="rsOptBtn">Cari Optimum</button>
    </div>
    <div class="rs-ctl rs-pred" id="rsPredForm">
      <h4>Prediksi di kondisi tertentu</h4>
      <p class="rs-sub">Masukkan nilai faktor (satuan asli) untuk memprediksi respon beserta selang kepercayaannya.</p>
      ${pred}
      <button type="button" class="btn-ghost" id="rsPredBtn">Hitung Prediksi</button>
      <div id="rsPredOut" style="grid-column:1 / -1"></div>
    </div>`;
    el.optWrap.innerHTML = `<div id="rsStatBlock">${renderStationary(res)}</div><div id="rsOptBlock"></div>`;
    runOptimization(true);
    void k;
  }
  el.optCtl.addEventListener('change', (e) => { if (e.target.id === 'rsGoal') $('#rsTargetLbl').hidden = e.target.value !== 'target'; });
  el.optCtl.addEventListener('click', (e) => {
    if (e.target.id === 'rsOptBtn') runOptimization(false);
    else if (e.target.id === 'rsPredBtn') runPrediction();
  });
  function runOptimization(silent) {
    const res = state.res; if (!res) return;
    const goal = $('#rsGoal').value;
    const loA = [], hiA = [];
    for (let i = 0; i < res.k; i++) {
      loA.push(parseNum($(`[data-lo="${i}"]`).value)); hiA.push(parseNum($(`[data-hi="${i}"]`).value));
      if (!Number.isFinite(loA[i]) || !Number.isFinite(hiA[i]) || !(loA[i] < hiA[i])) {
        $('#rsOptBlock').innerHTML = `<p class="error-msg">Batas faktor "${escapeHTML(res.names[i])}" tidak valid: isi angka dengan batas bawah &lt; batas atas.</p>`;
        return;
      }
    }
    let target = parseNum($('#rsTarget').value);
    if (goal === 'target' && !Number.isFinite(target)) { $('#rsOptBlock').innerHTML = '<p class="error-msg">Nilai target harus berupa angka.</p>'; return; }
    const lo = loA.map((v, i) => (v - res.cd.center[i]) / res.cd.half[i]), hi = hiA.map((v, i) => (v - res.cd.center[i]) / res.cd.half[i]);
    const o = Core.optimize(res, { goal, target, lo, hi });
    res.optimum = o;
    $('#rsOptBlock').innerHTML = renderOptimum(res, o, { loA, hiA });
    if (!silent) { renderConclusion(res); exportAll(res); }
    // isi kolom prediksi dengan optimum
    o.actual.forEach((v, i) => { const inp = $(`[data-pr="${i}"]`); if (inp && silent) inp.value = fmtC(v); });
  }
  function runPrediction() {
    const res = state.res; if (!res) return;
    const v = [];
    for (let i = 0; i < res.k; i++) {
      const x = parseNum($(`[data-pr="${i}"]`).value);
      if (!Number.isFinite(x)) { $('#rsPredOut').innerHTML = `<p class="error-msg">Nilai "${escapeHTML(res.names[i])}" harus berupa angka.</p>`; return; }
      v.push(x);
    }
    const x = Core.toCoded(res.cd, v), pr = Core.predict(res, x);
    const out = x.some((c) => Math.abs(c) > 1 + 1e-9);
    $('#rsPredOut').innerHTML = `<div class="test-stat-row">${statCard('Respon prediksi', fmt(pr.y, 4))}${statCard('CI 95% rata-rata', fmt(pr.ci[0], 3) + ' - ' + fmt(pr.ci[1], 3))}${statCard('PI 95% satu percobaan', fmt(pr.pi[0], 3) + ' - ' + fmt(pr.pi[1], 3))}</div>${out ? '<p class="test-note">Ada faktor di luar rentang data: prediksi berupa ekstrapolasi.</p>' : ''}`;
  }

  /* =========================================================================
     TAB: DIAGNOSTIK
     ========================================================================= */
  function renderDiag(res) {
    const n = res.n, p = res.p;
    const hLim = 2 * p / n;
    let rows = '', flagged = 0;
    res.diag.forEach((d) => {
      const notes = [];
      if (Number.isFinite(d.sr) && Math.abs(d.sr) > 3) notes.push('pencilan');
      else if (Number.isFinite(d.sr) && Math.abs(d.sr) > 2) notes.push('perhatikan');
      if (d.h > hLim) notes.push('leverage tinggi');
      if (Number.isFinite(d.cook) && d.cook > 1) notes.push('berpengaruh (Cook > 1)');
      if (notes.length) flagged++;
      rows += `<tr><td>${d.run}</td><td>${fmt(d.y, 3)}</td><td>${fmt(d.fit, 3)}</td><td>${fmt(d.e, 3)}</td><td>${fmt(d.sr, 3)}</td><td>${fmt(d.h, 3)}</td><td>${fmt(d.cook, 3)}</td><td class="rs-l ${notes.length ? 'bad' : ''}">${notes.join(', ') || '-'}</td></tr>`;
    });
    const r = res.diag.map((d) => d.e);
    const mae = r.reduce((s, v) => s + Math.abs(v), 0) / n;
    el.diagWrap.innerHTML = `<div class="test-block"><h4>Diagnostik Residual per Percobaan</h4>
      <p class="test-sub">Residual = aktual &minus; prediksi. Residual baku memakai S dan leverage; |nilai| &gt; 2 patut diperhatikan dan &gt; 3 mengisyaratkan pencilan. Leverage tinggi bila h &gt; 2p/n = ${fmt(hLim, 3)}.</p>
      <div class="stat-grid">${statCard('Rata-rata |residual|', fmt(mae, 4))}${statCard('PRESS', fmt(res.m.PRESS, 3))}${statCard('Baris ditandai', flagged)}</div>
      <div class="table-scroll" style="margin-top:12px"><table class="mini-table"><thead><tr><th>Run</th><th>Aktual</th><th>Prediksi</th><th>Residual</th><th>Resid. baku</th><th>Leverage</th><th>Cook&rsquo;s D</th><th class="rs-l">Catatan</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="test-note">Grafik diagnostik (Q-Q plot residual, residual vs prediksi, residual vs urutan, aktual vs prediksi, histogram) tersedia pada panel grafik pendukung di bawah halaman. Titik residual yang acak tanpa pola dan mengikuti garis pada Q-Q plot mendukung asumsi model.</p></div>`;
  }

  /* =========================================================================
     TAB: LANGKAH PERHITUNGAN
     ========================================================================= */
  function renderSteps(res) {
    const m = res.m;
    const list = [
      { title: 'Kodekan setiap faktor ke skala \u22121 s.d. +1',
        formula: 'x = (X \u2212 pusat) / setengah rentang',
        note: res.names.map((n, i) => `${n}: pusat = ${fmtC(res.cd.center[i])}, setengah rentang = ${fmtC(res.cd.half[i])}`).join('; ') + '.' },
      { title: 'Susun model dan matriks rancangan X',
        formula: res.model === 'quad' ? 'y = b0 + \u03A3 bi xi + \u03A3 bii xi\u00B2 + \u03A3 bij xi xj + e' : res.model === '2fi' ? 'y = b0 + \u03A3 bi xi + \u03A3 bij xi xj + e' : 'y = b0 + \u03A3 bi xi + e',
        note: `Model "${res.modelName}" memiliki p = ${res.p} suku sehingga X berukuran ${res.n} \u00D7 ${res.p} (kolom: ${res.terms.map((t) => Core.termLabel(t, res.names, res.sym)).join(', ')}).` },
      { title: 'Taksir koefisien dengan kuadrat terkecil',
        formula: 'b = (X\u1D40X)\u207B\u00B9 X\u1D40 y',
        note: res.coefs.map((c) => `${c.sym} = ${fmt(c.b)}`).join('; ') + '.' },
      { title: 'Hitung jumlah kuadrat dan ANOVA',
        formula: 'JKT = \u03A3(y \u2212 \u0233)\u00B2 ;  JKG = \u03A3(y \u2212 \u0177)\u00B2 ;  JKM = JKT \u2212 JKG ;  F = KTM / KTG',
        note: `JKT = ${fmt(m.SST)}, JKM = ${fmt(m.SSR)} (db ${m.dfR}), JKG = ${fmt(m.SSE)} (db ${m.dfE}). F = ${fmt(m.MSR)} \u00F7 ${fmt(m.MSE)} = ${fmt(m.F)}, p-value = ${fmtP(m.pF)}.` },
      { title: 'Uji lack of fit dengan galat murni',
        formula: 'JKGM = \u03A3 (y \u2212 rata-rata titik kembar)\u00B2 ;  JKLOF = JKG \u2212 JKGM ;  F = KTLOF / KTGM',
        note: res.lof.testable ? `Terdapat ${res.lof.distinct} titik rancangan berbeda; JKGM = ${fmt(res.lof.SSPE)} (db ${res.lof.dfPE}), JKLOF = ${fmt(res.lof.SSLOF)} (db ${res.lof.dfLOF}), F = ${fmt(res.lof.F)}, p-value = ${fmtP(res.lof.p)}.` : 'Uji tidak dapat dihitung (tidak ada ulangan atau derajat bebas lack of fit nol).' },
      { title: 'Ukur kecocokan model',
        formula: 'R\u00B2 = JKM/JKT ;  R\u00B2adj = 1 \u2212 (JKG/dbG)/(JKT/dbT) ;  R\u00B2pred = 1 \u2212 PRESS/JKT',
        note: `R\u00B2 = ${fmt(m.R2)}, R\u00B2 adj = ${fmt(m.adj)}, R\u00B2 pred = ${fmt(m.predR2)} (PRESS = ${fmt(m.PRESS, 3)}). S = \u221AKTG = ${fmt(m.S)}.` },
      { title: 'Uji signifikansi tiap koefisien',
        formula: 't = bj / SE(bj) ;  SE(bj) = \u221A( KTG \u00B7 [(X\u1D40X)\u207B\u00B9]jj )',
        note: `Dengan db = ${res.dfE}, nilai kritis t(0.975) = ${fmt(res.tcrit, 4)}. Suku dengan |t| lebih besar dari nilai ini signifikan.` },
    ];
    if (res.canon && res.canon.xs) list.push({ title: 'Cari titik stasioner dan sifatnya',
      formula: 'xs = \u2212\u00BD B\u207B\u00B9 b ;  \u0177s = b0 + \u00BD xs\u1D40 b',
      note: `xs (terkode) = (${res.canon.xs.map((v) => fmt(v, 3)).join('; ')}), setara ${res.names.map((n, i) => `${short(n)} = ${fmtC(res.canon.actual[i])}`).join(', ')}; \u0177s = ${fmt(res.canon.ys, 3)}. Nilai eigen B: ${res.canon.eig.values.map((v) => fmt(v, 3)).join('; ')} \u2192 ${NATURE[res.canon.nature].split(' (')[0]}.` });
    list.push({ title: 'Cari kondisi optimum dan selang prediksi',
      formula: 'CI: \u0177 \u00B1 t\u00B7\u221A(KTG\u00B7x\u2080\u1D40(X\u1D40X)\u207B\u00B9x\u2080) ;  PI: \u0177 \u00B1 t\u00B7\u221A(KTG\u00B7(1 + x\u2080\u1D40(X\u1D40X)\u207B\u00B9x\u2080))',
      note: 'Optimum dicari secara numerik pada batas faktor yang dipilih (tab Optimasi); selang kepercayaan dan selang prediksi dihitung dengan rumus di atas.' });
    el.stepsWrap.innerHTML = list.map((s, i) => `<div class="step-block" data-step="${i + 1}"><h4>${escapeHTML(s.title)}</h4>${s.formula ? `<span class="formula">${escapeHTML(s.formula)}</span>` : ''}${s.note ? `<p>${escapeHTML(s.note)}</p>` : ''}</div>`).join('');
  }

  /* =========================================================================
     KESIMPULAN
     ========================================================================= */
  function renderConclusion(res) {
    const m = res.m, ad = adequacy(res), cn = res.canon, o = res.optimum;
    let html = `<div class="stat-grid">${statCard('Percobaan (n)', res.n)}${statCard('R\u00B2 / R\u00B2 pred', fmt(m.R2, 3) + ' / ' + fmt(m.predR2, 3))}${statCard('F model', fmt(m.F, 2))}${statCard('Sig. (p-value)', fmtP(m.pF))}${statCard('p lack of fit', res.lof.testable ? fmtP(res.lof.p) : 'tidak teruji')}</div>`;
    const good = ad.sig && ad.lofOK && ad.gapOK && ad.apOK;
    let txt = `Model ${escapeHTML(res.modelName.toLowerCase())} untuk <strong>${escapeHTML(short(res.resp))}</strong> ${ad.sig ? `<strong>signifikan</strong> (F = ${fmt(m.F, 2)}; p ${m.pF < 0.0001 ? '&lt; 0.0001' : '= ' + fmt(m.pF, 4)})` : `<strong>belum signifikan</strong> (p = ${fmt(m.pF, 4)})`} dan menjelaskan ${fmt(m.R2 * 100, 2)}% variasi data (R&sup2; adj = ${fmt(m.adj, 3)}; R&sup2; prediksi = ${fmt(m.predR2, 3)}). `;
    txt += ad.lofTestable ? (ad.lofOK ? `Uji lack of fit tidak signifikan (p = ${fmt(res.lof.p, 4)}), sehingga model dinilai sesuai dengan data. ` : `Uji lack of fit signifikan (p = ${fmt(res.lof.p, 4)}), sehingga model kurang sesuai dan perlu dipertimbangkan ulang. `) : 'Lack of fit tidak dapat diuji karena tidak ada ulangan. ';
    txt += `Adequate precision = ${fmt(res.adeq, 2)} ${ad.apOK ? '(&gt; 4, sinyal cukup untuk menjelajahi ruang rancangan).' : '(&le; 4, sinyal lemah).'} `;
    txt += good ? 'Secara keseluruhan model <strong>memadai</strong> untuk dipakai memprediksi dan mengoptimalkan respon.' : 'Beberapa kriteria kecukupan belum terpenuhi, sehingga gunakan model dengan hati-hati dan pertimbangkan menambah percobaan.';
    html += `<p class="test-conclusion">${txt}</p>`;
    const sigT = res.coefs.filter((c) => c.term.type !== 'const' && c.p < res.alpha).map((c) => c.label);
    if (sigT.length) html += `<p class="test-conclusion" style="margin-top:10px">Suku yang berpengaruh nyata (&alpha; = 0.05): <strong>${sigT.map(escapeHTML).join(', ')}</strong>.</p>`;
    if (o) {
      const gl = o.goal === 'max' ? 'maksimum' : o.goal === 'min' ? 'minimum' : 'mendekati target ' + fmtC(o.target);
      html += `<p class="test-conclusion" style="margin-top:10px">Kondisi yang memberi respon ${gl} dalam rentang pencarian: <strong>${res.names.map((n, i) => `${escapeHTML(short(n))} = ${fmtC(o.actual[i])}`).join(', ')}</strong>, dengan prediksi ${escapeHTML(short(res.resp))} = <strong>${fmt(o.pred.y, 3)}</strong> (CI 95%: ${fmt(o.pred.ci[0], 2)} s.d. ${fmt(o.pred.ci[1], 2)}; PI 95%: ${fmt(o.pred.pi[0], 2)} s.d. ${fmt(o.pred.pi[1], 2)}). Lakukan percobaan konfirmasi pada kondisi tersebut untuk memverifikasi.</p>`;
    }
    if (cn && cn.xs) html += `<p class="test-conclusion" style="margin-top:10px">Analisis kanonik: titik stasioner berupa ${NATURE[cn.nature].split(' (')[0]} ${cn.inside ? 'di dalam' : 'di luar'} daerah percobaan.</p>`;
    el.conclusionWrap.innerHTML = html;
  }

  /* =========================================================================
     EKSPOR .docx + GRAFIK PENDUKUNG (lihat Method/Shared/export-hasil.js)
     ========================================================================= */
  function exportAll(res) {
    try {
      const SC = window.StatCharts, SE = window.StatExport;
      if (!SC || !SE) return;
      const m = res.m, o = res.optimum;
      const rows = res.X.map((r, i) => r.concat([res.y[i]]));
      const zero = res.cd.center.map(() => 0);
      const charts = [];
      pairs(res.k).forEach(([i, j]) => {
        const hold = zero.slice();
        const others = res.names.filter((_, f) => f !== i && f !== j).map(short).join(', ');
        const note = others ? ` Faktor lain (${others}) dipegang di nilai pusat.` : '';
        charts.push({ title: `Kontur: ${short(res.names[i])} \u00D7 ${short(res.names[j])}`, caption: 'Warna dan garis kontur menunjukkan respon prediksi; lingkaran putih adalah titik percobaan pada irisan.' + note, build: () => contourSvg(res, i, j, hold, { title: `Kontur ${short(res.resp)}: ${short(res.names[i])} vs ${short(res.names[j])}` }) });
        charts.push({ title: `Permukaan 3D: ${short(res.names[i])} \u00D7 ${short(res.names[j])}`, caption: 'Permukaan respon prediksi.' + note, build: () => surfaceSvg(res, i, j, hold, { title: `Permukaan ${short(res.resp)}: ${short(res.names[i])} vs ${short(res.names[j])}` }) });
      });
      charts.push({ title: 'Plot perturbasi', caption: 'Pengaruh tiap faktor terhadap respon bila diubah dari pusat rancangan dengan faktor lain tetap.', build: () => perturbSvg(res, zero) });
      const lin = res.coefs.filter((c) => c.term.type !== 'const').slice().sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
      charts.push({ title: 'Diagram Pareto efek terstandar', caption: 'Nilai |t| tiap suku model; batang yang melewati garis putus-putus (t kritis) signifikan pada \u03B1 = 0,05.', build: () => SC.bars({ title: 'Pareto |t| Koefisien', yLabel: '|t|', labels: lin.map((c) => c.label), values: lin.map((c) => Math.abs(c.t)), colors: lin.map((c) => (c.p < res.alpha ? '#22384A' : '#948C77')), hlines: [{ y: res.tcrit, label: 't kritis = ' + fmt(res.tcrit, 2), color: '#A5402C', dash: true }] }) });
      const e = res.diag.map((d) => d.e), fit = res.diag.map((d) => d.fit);
      charts.push({ title: 'Q-Q plot residual', caption: 'Titik yang mengikuti garis menandakan residual mendekati normal.', build: () => SC.qq(e, { title: 'Q-Q Plot Residual' }) });
      charts.push({ title: 'Residual vs nilai prediksi', caption: 'Sebaran acak di sekitar nol tanpa pola corong atau lengkung mendukung ragam konstan dan kelinearan model.', build: () => SC.scatter({ title: 'Residual vs Prediksi', xLabel: 'Nilai prediksi', yLabel: 'Residual', x: fit, y: e, hzero: true }) });
      charts.push({ title: 'Residual vs urutan percobaan', caption: 'Pola atau tren menurut urutan menandakan pengaruh waktu/pengacakan yang kurang baik.', build: () => SC.line({ title: 'Residual vs Urutan Run', xLabel: 'Urutan run', yLabel: 'Residual', labels: e.map((_, i) => String(i + 1)), series: [{ name: 'Residual', values: e }], hlines: [{ y: 0, color: '#948C77', dash: true }], noLegend: true }) });
      charts.push({ title: 'Aktual vs prediksi', caption: 'Titik dekat garis y = x menandakan prediksi model akurat.', build: () => SC.scatter({ title: 'Aktual vs Prediksi', xLabel: 'Prediksi', yLabel: 'Aktual', x: fit, y: res.y, diag: true }) });
      charts.push({ title: 'Histogram residual', caption: 'Bentuk lonceng simetris mendukung asumsi normalitas.', build: () => SC.hist(e, { title: 'Histogram Residual', xLabel: 'Residual' }) });
      const meta = [['Jenis analisis', 'Response Surface Methodology (RSM)'], ['Model', res.modelName], ['Respon', res.resp], ['Faktor', res.names.join(', ')], ['Jumlah percobaan (n)', res.n], ['Taraf signifikansi', '\u03B1 = 0,05'],
        ['F model', fmt(m.F)], ['Sig. model (p-value)', fmtP(m.pF)], ['R\u00B2 / R\u00B2 adj / R\u00B2 pred', `${fmt(m.R2)} / ${fmt(m.adj)} / ${fmt(m.predR2)}`], ['Lack of fit', res.lof.testable ? `F = ${fmt(res.lof.F)}, p = ${fmtP(res.lof.p)}` : 'tidak teruji']];
      if (o) meta.push(['Kondisi optimum', res.names.map((n, i) => `${short(n)} = ${fmtC(o.actual[i])}`).join('; ') + ` \u2192 ${short(res.resp)} = ${fmt(o.pred.y, 3)}`]);
      SE.publish({
        id: 'rsm', title: 'Hasil Response Surface Methodology', anchor: '#rs-conclusion-card', resultsCard: '#rs-results-card', meta,
        sections: [
          { heading: 'Model & ANOVA', sel: '#rsModelWrap' }, { heading: 'Koefisien & Persamaan', sel: '#rsCoefWrap' }, { heading: 'Optimasi', sel: '#rsOptWrap' },
          { heading: 'Diagnostik', sel: '#rsDiagWrap' }, { heading: 'Langkah Perhitungan', sel: '#rsStepsWrap' }, { heading: 'Kesimpulan', sel: '#rsConclusionWrap' },
        ],
        data: { head: res.names.concat([res.resp]), rows, caption: 'Data percobaan (satuan asli).' },
        charts,
      });
    } catch (err) { console.warn('Ekspor RSM:', err); }
  }

  window.StatCalcRSM = { applyNames, contourSvg, surfaceSvg, state };
})();
