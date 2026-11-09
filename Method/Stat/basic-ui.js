/* =========================================================================
   BASIC-UI - pembantu tampilan bersama halaman Basic Statistics (Uji t, Korelasi, ...)
   -------------------------------------------------------------------------
   Berisi: pemformat angka (koma desimal), pembaca sel angka, gaya `.bs-*`, dan
   kata penjelas (kekuatan korelasi, ukuran efek). Muat SEBELUM ujit.js / korelasi.js.
   ========================================================================= */
(function () {
  'use strict';
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NUMRE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
  /* sel kosong -> null, bukan angka -> NaN, selain itu angka (menerima "1,5" dan "1.250,5" lewat StatCalcImport.normNum) */
  function toNum(v) {
    const ci = window.StatCalcImport;
    let s = String(v === undefined || v === null ? '' : v).trim();
    if (s === '') return null;
    if (!NUMRE.test(s) && ci && ci.normNum) { const n = ci.normNum(s); if (n !== null) s = n; }
    if (!NUMRE.test(s)) return NaN;
    return parseFloat(s);
  }
  function fmt(v, d) {
    if (v === null || v === undefined || Number.isNaN(v)) return '-';
    if (v === Infinity) return '∞'; if (v === -Infinity) return '−∞';
    d = d === undefined ? 4 : d;
    if (Math.abs(v) >= 1e9 || (v !== 0 && Math.abs(v) < 1e-4)) return v.toExponential(3).replace('.', ',');
    return String(Number(v.toFixed(d))).replace('.', ',');
  }
  function fmtP(p) {
    if (p === null || p === undefined || Number.isNaN(p)) return '-';
    if (p < 0.0001) return '< 0,0001';
    return String(Number(p.toFixed(4))).replace('.', ',');
  }
  const pct = (c) => String(Number((c * 100).toFixed(1))).replace('.', ',') + '%';
  /* selang: [lo, hi]; sisi tak berhingga ditulis dengan ∞ */
  function fmtCI(ci, d) {
    const a = ci[0], b = ci[1];
    return (a === -Infinity ? '(' : '[') + fmt(a, d) + ' ; ' + fmt(b, d) + (b === Infinity ? ')' : ']');
  }
  function corrStrength(r) {
    const a = Math.abs(r);
    return a < 0.2 ? 'sangat lemah' : a < 0.4 ? 'lemah' : a < 0.6 ? 'sedang' : a < 0.8 ? 'kuat' : 'sangat kuat';
  }
  function effectLabel(d) {   // pedoman Cohen
    const a = Math.abs(d);
    return a < 0.2 ? 'dapat diabaikan' : a < 0.5 ? 'kecil' : a < 0.8 ? 'sedang' : 'besar';
  }
  const style = document.createElement('style');
  style.textContent = `
    .bs-set{ display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; margin:12px 0 14px; }
    .bs-set label{ display:flex; flex-direction:column; gap:5px; font-size:13px; font-weight:600; color:var(--ink-soft); }
    .bs-set .select-input, .bs-set .plain-input{ width:100%; height:44px; border-radius:10px; font-size:14.5px; padding:0 10px; text-align:left; font-family:var(--font-body); }
    .bs-set .bs-sub{ font-weight:400; font-size:12px; color:var(--ink-faint); }
    .bs-bar{ display:grid; gap:10px; margin-top:10px; }
    .bs-bar.c1{ grid-template-columns:1fr; } .bs-bar.c5{ grid-template-columns:repeat(5,1fr); gap:6px; }
    .bs-bar .btn-ghost, .bs-bar .btn-primary{ width:100%; flex:none; padding-left:6px; padding-right:6px; line-height:1.25; }
    @media (max-width:480px){ .bs-bar .btn-ghost{ font-size:13px; } }
    .bs-vname{ width:100%; min-width:92px; border:none; background:transparent; text-align:center; font-weight:700; font-size:14px; font-family:var(--font-body); padding:8px 6px; color:var(--ink); min-height:44px; box-sizing:border-box; }
    .bs-vname:focus{ outline:2px solid var(--accent-2); outline-offset:-2px; background:#fff; }
    .bs-res td.lbl, .bs-res th.lbl{ text-align:left; font-weight:600; background:var(--paper-2); }
    .bs-res td.sig{ font-weight:800; color:var(--accent-2); }
    .bs-res + .bs-res, .bs-wrap > .bs-res{ margin-top:16px; }
    .bs-note{ font-size:13px; color:var(--ink-soft); margin:10px 0 0; text-align:justify; text-justify:inter-word; hyphens:auto; }
    .bs-var{ margin:0 0 16px; padding:12px 14px; border:1px solid var(--rule); border-radius:var(--radius); background:#fff; }
    .bs-var h4{ margin:0 0 6px; font-size:15px; font-family:var(--font-body); }
    .bs-var p{ margin:6px 0 0; font-size:14px; line-height:1.55; text-align:justify; text-justify:inter-word; hyphens:auto; }
    .bs-dec{ display:inline-block; padding:2px 10px; border-radius:999px; font-weight:700; font-size:12.5px; }
    .bs-dec.rej{ background:#DFEEE3; color:var(--good); } .bs-dec.keep{ background:var(--paper-2); color:var(--ink-soft); }
  `;
  document.head.appendChild(style);

  /* ---------------------------------------------------------------------------
     KERANGKA HALAMAN: mountPage(cfg) membuat #view-<id> berisi kartu data (Langkah 1) + kartu hasil
     (Langkah 2: tab Ringkasan / Langkah Perhitungan / Interpretasi), pita, dan tabel data opsional.
       cfg = { id, pre, title, eyebrow?, lede, settings (HTML), hint? (HTML, wajib memuat <span id="{pre}Min">),
               table?: { names:[...], colLabel, minCols, maxCols, canAddCol }, calcLabel, sampleLabel, tip? }
     Mengembalikan api: { section, q(id), tbl, err(msg), clearErr(), show({sum, steps, interp}), publish(opts), onCalc, onSample }
     --------------------------------------------------------------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  function stepsHTML(steps) { return steps.map((s, i) => `<div class="step-block" data-step="${i + 1}"><h4>${esc(s.t)}</h4><span class="formula">${esc(s.f)}</span>${s.n ? `<p>${esc(s.n)}</p>` : ''}</div>`).join(''); }

  function makeTable(q, p, T) {
    const head = q(p + 'Head'), body = q(p + 'Body'), MAXR = 2000;
    const t = { names: T.names.slice(), head, body };
    const label = (j) => (T.colLabel || 'Kolom') + ' ' + (j + 1);
    const inputCell = '<td><input type="text" inputmode="decimal" placeholder="nilai"></td>';
    t.buildHead = () => { head.innerHTML = '<tr><th>#</th>' + t.names.map((n, j) => `<th><input class="bs-vname" data-j="${j}" value="${esc(n)}" aria-label="Nama kolom ${j + 1}" spellcheck="false"></th>`).join('') + '</tr>'; };
    const renumber = () => $$('tr', body).forEach((tr, i) => { tr.querySelector('.rownum').textContent = i + 1; });
    t.addRow = () => { if (body.rows.length >= MAXR) return; const tr = document.createElement('tr'); tr.innerHTML = '<td class="rownum"></td>' + t.names.map(() => inputCell).join(''); body.appendChild(tr); renumber(); };
    t.addCol = () => { if (t.names.length >= (T.maxCols || 12)) return; t.names.push(label(t.names.length)); $$('tr', body).forEach((tr) => tr.insertAdjacentHTML('beforeend', inputCell)); t.buildHead(); };
    t.remCol = () => { if (t.names.length <= (T.minCols || 1)) return; t.names.pop(); $$('tr', body).forEach((tr) => tr.removeChild(tr.lastElementChild)); t.buildHead(); };
    t.setCols = (n) => { n = Math.max(T.minCols || 1, Math.min(T.maxCols || 12, n)); let g = 0; while (t.names.length < n && g++ < 30) t.addCol(); while (t.names.length > n && g++ < 60) t.remCol(); };
    t.build = (nRows) => { body.innerHTML = ''; for (let i = 0; i < nRows; i++) t.addRow(); t.buildHead(); };
    t.clear = () => $$('input', body).forEach((i) => { i.value = ''; i.classList.remove('invalid'); });
    t.fill = (names, cols) => { t.names = names.slice(); t.build(Math.max.apply(null, cols.map((c) => c.length))); $$('tr', body).forEach((tr, i) => $$('input', tr).forEach((inp, j) => { inp.value = cols[j] && i < cols[j].length ? cols[j][i] : ''; })); };
    t.collect = () => {
      const cols = t.names.map(() => []), bad = [];
      $$('tr', body).forEach((tr, r) => $$('input', tr).forEach((inp, j) => {
        inp.classList.remove('invalid'); const v = toNum(inp.value);
        if (Number.isNaN(v)) { bad.push(`${t.names[j] || label(j)} baris ${r + 1}`); inp.classList.add('invalid'); cols[j].push(null); } else cols[j].push(v);
      }));
      return { cols, bad };
    };
    t.name = (j) => (String(t.names[j]).trim() || label(j));
    head.addEventListener('input', (e) => { const i = e.target.closest('.bs-vname'); if (i) t.names[+i.dataset.j] = i.value; });
    q(p + 'Add').addEventListener('click', t.addRow);
    q(p + 'Remove').addEventListener('click', () => { if (body.rows.length > 3) { body.deleteRow(body.rows.length - 1); renumber(); } });
    q(p + 'Clear').addEventListener('click', () => { t.clear(); const e = q(p + 'Err'); e.hidden = true; });
    if (q(p + 'AddCol')) { q(p + 'AddCol').addEventListener('click', t.addCol); q(p + 'RemCol').addEventListener('click', t.remCol); }
    t.register = (fitCols) => {
      if (!(window.StatCalcImport && window.StatCalcImport.register)) return;
      window.StatCalcImport.register({
        card: '#' + p + '-data-card', body: '#' + p + 'Body', add: '#' + p + 'Add', remove: '#' + p + 'Remove', minHint: '#' + p + 'Min', text: [],
        fitCols: fitCols || ((n) => t.setCols(n)),
        onApply: (info) => { (info.names || []).forEach((nm, k) => { const j = (info.offset || 0) + k, v = String(nm || '').trim(); if (v && j < t.names.length) { t.names[j] = v; const inp = $$('.bs-vname', head)[j]; if (inp) inp.value = v; } }); },
      });
    };
    t.setCols(T.names.length); t.build(8);
    return t;
  }

  function mountPage(cfg) {
    const p = cfg.pre, T = cfg.table, section = document.createElement('section');
    section.className = 'view'; section.id = 'view-' + cfg.id;
    const tableHTML = T ? `
        <p class="hint">${cfg.hint}</p>
        <div class="table-scroll"><table class="data-table"><thead id="${p}Head"></thead><tbody id="${p}Body"></tbody></table></div>
        <div class="bs-bar ${T.canAddCol ? 'c5' : 'c5'}">
          ${window.StatSlateBtn('rowadd', 'Tambah baris', '', p + 'Add')}
          ${window.StatSlateBtn('rowdel', 'Hapus baris terakhir', '', p + 'Remove')}
          ${window.StatSlateBtn('clear', 'Kosongkan', '', p + 'Clear')}
          ${T.canAddCol ? window.StatSlateBtn('coladd', 'Tambah kolom', '', p + 'AddCol') + window.StatSlateBtn('coldel', 'Hapus kolom terakhir', '', p + 'RemCol') : ''}
        </div>` : (cfg.hint ? `<p class="hint">${cfg.hint}</p>` : '');
    section.innerHTML = `
    <div class="chapter-inner">
      <div class="chapter-head ch-wide">
        <span class="eyebrow">${cfg.eyebrow || 'Metode Statistik &rsaquo; Basic Statistics'}</span>
        <h1>${cfg.title}</h1>
        <p class="lede">${cfg.lede}</p>
      </div>
      <section class="card step-card" id="${p}-data-card">
        <div class="step-tag">Langkah 1</div>
        <h2>${cfg.step1 || 'Atur uji &amp; masukkan data'}</h2>
        <div class="bs-set">${cfg.settings}</div>${tableHTML}
        <div class="bs-bar c1">
          ${cfg.sampleLabel === null ? '' : `<button type="button" class="btn-ghost" id="${p}Sample">${cfg.sampleLabel || 'Isi contoh data'}</button>`}
          <button type="button" class="btn-primary" id="${p}Calc">${cfg.calcLabel} &rarr;</button>
        </div>
        <p class="error-msg" id="${p}Err" hidden></p>
      </section>
      <section class="card step-card" id="${p}-results-card" hidden>
        <div class="step-tag">Langkah 2</div>
        <h2>Hasil ${cfg.title}</h2>
        <nav class="tabs" id="${p}Tabs">
          <button type="button" class="tab-btn active" data-tab="${p}-tab-sum">Ringkasan</button>
          <button type="button" class="tab-btn" data-tab="${p}-tab-steps">Langkah Perhitungan</button>
          <button type="button" class="tab-btn" data-tab="${p}-tab-interp">Interpretasi</button>
        </nav>
        <div class="tab-panel active" id="${p}-tab-sum"><div id="${p}SumWrap" class="table-scroll bs-wrap"></div></div>
        <div class="tab-panel" id="${p}-tab-steps"><div id="${p}StepsWrap" class="steps-wrap"></div></div>
        <div class="tab-panel" id="${p}-tab-interp"><div id="${p}InterpWrap"></div></div>
      </section>
    </div>`;
    document.body.insertBefore(section, $('#profileOverlay'));
    if (window.StatRibbon) window.StatRibbon.mount({
      view: '#view-' + cfg.id, key: cfg.id,
      tabs: [
        { id: 'hasil', label: 'Hasil', groups: [{ label: 'Tab hasil', cols: 2, items: [
          { type: 'toggle', key: 'sum', label: 'Ringkasan', tab: p + '-tab-sum' },
          { type: 'toggle', key: 'stp', label: 'Langkah Perhitungan', tab: p + '-tab-steps' },
          { type: 'toggle', key: 'int', label: 'Interpretasi', tab: p + '-tab-interp' } ] }],
          tip: cfg.tip || 'Pengaturan pita hanya menyembunyikan atau menampilkan bagian hasil; perhitungan tidak berubah.' },
        { id: 'ekspor', label: 'Ekspor', groups: [{ label: 'Unduhan', items: [{ type: 'toggle', key: 'dl', label: 'Panel unduhan (.docx/.zip)', hide: ['.ex-panel', '.ex-bar'] }] }] },
      ],
    });
    const q = (id) => section.querySelector('#' + id);
    const api = { section, q, pre: p, cfg };
    api.tbl = T ? makeTable(q, p, T) : null;
    api.err = (m) => { const e = q(p + 'Err'); e.textContent = m; e.hidden = false; };
    api.clearErr = () => { q(p + 'Err').hidden = true; };
    api.show = (r) => {
      q(p + 'SumWrap').innerHTML = r.sum; q(p + 'StepsWrap').innerHTML = stepsHTML(r.steps); q(p + 'InterpWrap').innerHTML = r.interp;
      const card = q(p + '-results-card'); card.hidden = false;
      $$('#' + p + 'Tabs .tab-btn', section).forEach((b) => b.classList.toggle('active', b.dataset.tab === p + '-tab-sum'));
      $$('.tab-panel', card).forEach((x) => x.classList.toggle('active', x.id === p + '-tab-sum'));
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
    };
    api.publish = (o) => {
      try {
        const SE = window.StatExport; if (!SE) return;
        SE.publish({ id: cfg.id, title: cfg.title, anchor: '#' + p + '-results-card', resultsCard: '#' + p + '-results-card', meta: o.meta,
          sections: [{ heading: 'Ringkasan', sel: '#' + p + 'SumWrap' }, { heading: 'Langkah Perhitungan', sel: '#' + p + 'StepsWrap' }, { heading: 'Interpretasi', sel: '#' + p + 'InterpWrap' }],
          data: o.data || undefined, charts: o.charts || [] });
      } catch (e) { /* ekspor opsional */ }
    };
    q(p + 'Tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn'); if (!btn) return;
      $$('#' + p + 'Tabs .tab-btn', section).forEach((b) => b.classList.remove('active')); btn.classList.add('active');
      $$('.tab-panel', q(p + '-results-card')).forEach((x) => x.classList.remove('active')); q(btn.dataset.tab).classList.add('active');
    });
    q(p + 'Calc').addEventListener('click', () => { api.clearErr(); if (api.onCalc) api.onCalc(); });
    if (q(p + 'Sample')) q(p + 'Sample').addEventListener('click', () => { api.clearErr(); if (api.onSample) api.onSample(); });
    /* data untuk ekspor dari kolom-kolom (array, null = kosong) */
    api.dataExport = (names, cols) => ({ head: ['#'].concat(names), rows: Array.from({ length: Math.max.apply(null, cols.map((c) => c.length)) }, (_, i) => [i + 1].concat(cols.map((c) => (c[i] === null || c[i] === undefined ? '' : c[i])))), caption: 'Data yang dipakai pada perhitungan.' });
    return api;
  }

  window.StatBasicUI = { esc, toNum, fmt, fmtP, fmtCI, pct, corrStrength, effectLabel, mountPage, stepsHTML };
})();
