/* =========================================================================
   IMPOR DATA — tempel dari Excel & unggah file (.xlsx, .xls, .csv, .tsv, .txt)
   -------------------------------------------------------------------------
   Modul bersama: menambahkan toolbar "Impor data" di atas tabel input tiap
   metode, lalu mengisi tabel tersebut. Alur:
     tempel / unggah -> pratinjau + pilih kolom -> "Terapkan ke tabel".
   Selain itu, menempel (Ctrl+V) langsung ke sel tabel dari Excel juga didukung.

   Menambah metode lain cukup menambah satu entri di CONFIGS di bawah,
   atau memanggil window.StatCalcImport.register({...}). Opsi `text: [indeks kolom]`
   menandai kolom teks (kategori/kelompok/periode) agar tidak dianggap angka.
   - File .csv/.tsv/.txt dibaca tanpa pustaka tambahan (bisa offline).
   - File .xlsx/.xls memakai SheetJS: dimuat dari salinan lokal
     Method/Shared/xlsx.full.min.js, dan jika tidak ada, dari cdnjs.
   ========================================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const XLSX_LOCAL = 'Method/Shared/xlsx.full.min.js';
  const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_ROWS = 2000;
  const INSTANCES = {};   // card selector -> { ingest, wrap } (dipakai menu Calc untuk mengirim data)

  /* Metode yang didukung. Tabel harus berisi <input> per sel data, dengan
     tombol tambah/hapus baris yang sudah ada di metode tersebut. */
  const CONFIGS = [
    { card: '#data-card',    body: '#dataTableBody',   add: '#addRowBtn',   remove: '#removeRowBtn',   minHint: '#minRowsHint' },   // Regresi
    { card: '#st-data-card', body: '#stDataTableBody', add: '#stAddRowBtn', remove: '#stRemoveRowBtn', minHint: '#stMinRowsHint' }, // Uji Stasioneritas
    { card: '#sm-data-card', body: '#smDataTableBody', add: '#smAddRowBtn', remove: '#smRemoveRowBtn', minHint: '#smMinRowsHint' }, // Smoothing
  ];

  /* ------------------------------ Gaya ------------------------------ */
  const style = document.createElement('style');
  style.textContent = `
    .imp-bar{ display:grid; grid-template-columns:1fr 1fr; align-items:center; gap:10px; margin:12px 0 10px; }
    .imp-bar .btn-ghost{ width:100%; flex:none; }
    .imp-bar .imp-label{ grid-column:1 / -1; font-size:13px; font-weight:600; color:var(--ink-soft); }
    .imp-panel{ border:1px dashed var(--rule-strong); border-radius:var(--radius); padding:14px 16px; background:var(--paper-2); margin:6px 0 14px; }
    .btn-grid{ display:grid; gap:10px; margin-top:10px; }
    .btn-grid-3{ grid-template-columns:repeat(3,1fr); }
    .btn-grid-2{ grid-template-columns:repeat(2,1fr); }
    .btn-grid-1{ grid-template-columns:1fr; }
    .btn-grid .btn-primary{ width:100%; flex:none; }
    .btn-grid .btn-ghost{ width:100%; flex:none; padding-left:8px; padding-right:8px; line-height:1.25; }
    @media (max-width:480px){ .btn-grid .btn-ghost{ font-size:13px; } }
    .imp-panel[hidden]{ display:none; }
    .imp-panel h4{ margin:0 0 4px; font-size:14.5px; font-family:var(--font-body); }
    .imp-panel p{ margin:4px 0 8px; font-size:13px; color:var(--ink-soft); }
    .imp-panel textarea{ width:100%; min-height:120px; resize:vertical; font-family:var(--font-mono); font-size:13px; padding:10px 12px; border:1px solid var(--rule-strong); border-radius:var(--radius); background:#fff; color:var(--ink); }
    .imp-panel textarea:focus{ outline:2px solid var(--accent-2); outline-offset:1px; }
    .imp-actions{ display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; }
    .imp-map{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px 14px; margin:10px 0; }
    .imp-map label{ display:flex; flex-direction:column; gap:4px; font-size:13px; }
    .imp-map .select-input{ width:100%; }
    .imp-check{ display:flex; align-items:center; gap:8px; font-size:13px; margin:6px 0; font-weight:500; }
    .imp-preview{ overflow-x:auto; margin:8px 0; background:#fff; border:1px solid var(--rule); border-radius:var(--radius); }
    .imp-preview table{ border-collapse:collapse; width:100%; font-family:var(--font-mono); font-size:12.5px; }
    .imp-preview th, .imp-preview td{ padding:5px 10px; border-bottom:1px solid var(--rule); text-align:right; white-space:nowrap; }
    .imp-preview th{ background:var(--paper-2); font-weight:600; }
    .imp-preview td.skip, .imp-preview th.skip{ opacity:.45; }
    .imp-ok{ margin:8px 0; padding:9px 12px; border-radius:var(--radius); background:#DFEEE3; color:var(--good); font-size:13.5px; }
    .imp-ok[hidden]{ display:none; }
  `;
  document.head.appendChild(style);

  /* ------------------------- Parsing & angka ------------------------- */
  /* Kembalikan string angka berformat titik-desimal, atau null bila bukan angka.
     Mengenali format Indonesia (1.234,5), format Inggris (1,234.5), dan koma desimal (1,5). */
  function normNum(v) {
    let s = String(v === null || v === undefined ? '' : v).replace(/[\s\u00A0]/g, '');
    if (s === '' || !/^[+-]?(\d+([.,]\d+)*|[.,]\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    let exp = '';
    const m = s.match(/[eE][+-]?\d+$/);
    if (m) { exp = m[0]; s = s.slice(0, -exp.length); }
    const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
    if (dots && commas) {
      const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
      const other = dec === '.' ? /,/g : /\./g;
      s = s.replace(other, '');
      if (dec === ',') s = s.replace(',', '.');
    } else if (commas) {
      s = commas > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (dots > 1) {
      s = s.replace(/\./g, '');
    }
    return Number.isFinite(Number(s + exp)) ? s + exp : null;
  }
  const isNum = (v) => normNum(v) !== null;

  function splitLine(line, d) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function padRows(rows) {
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    return rows.map((r) => { const c = r.slice(); while (c.length < w) c.push(''); return c; });
  }
  /* Teks (tempelan Excel atau isi CSV) -> larik 2D string */
  function parseGrid(text) {
    const lines = String(text).replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
    if (!lines.length) return [];
    const f = lines[0];
    const count = (c) => f.split(c).length - 1;
    let delim = null;
    if (count('\t') > 0) delim = '\t';
    else if (count(';') > 0) delim = ';';
    else if (count(',') > 0 && !lines.every((l) => /^\s*[+-]?\d+,\d+\s*$/.test(l))) delim = ',';
    return padRows(lines.map((l) => (delim ? splitLine(l, delim) : [l])).map((r) => r.map((c) => c.trim())));
  }
  /* Baris pertama = judul bila ada kolom yang barisnya teks sedangkan baris berikutnya angka */
  function detectHeader(rows) {
    if (!rows.length) return false;
    const r0 = rows[0], r1 = rows[1];
    return r0.some((a, j) => String(a).trim() !== '' && !isNum(a) && (r1 === undefined || isNum(r1[j])));
  }
  function colLetter(j) { let s = ''; j++; while (j > 0) { const m = (j - 1) % 26; s = String.fromCharCode(65 + m) + s; j = Math.floor((j - 1) / 26); } return s; }

  function analyze(rows, hasHeader) {
    const data = rows.slice(hasHeader ? 1 : 0), w = rows[0] ? rows[0].length : 0;
    const cols = [];
    for (let j = 0; j < w; j++) {
      const vals = data.map((r) => String(r[j]).trim()).filter((x) => x !== '');
      const numeric = vals.filter(isNum).length;
      cols.push({
        j, name: hasHeader && String(rows[0][j]).trim() ? String(rows[0][j]).trim() : `Kolom ${colLetter(j)}`,
        numeric: vals.length > 0 && numeric / vals.length >= 0.8, count: vals.length,
      });
    }
    return { data, cols };
  }
  function autoMap(cols, n) {
    const skip = /^(no|nomor|no\.|periode|tahun|bulan|tanggal|tgl|date|waktu|time|id|period|year|month)$/i;
    const numeric = cols.filter((c) => c.numeric);
    const preferred = numeric.filter((c) => !skip.test(c.name));
    const pick = preferred.length >= n ? preferred : numeric.length >= n ? numeric : cols;
    return Array.from({ length: n }, (_, i) => (pick[i] ? pick[i].j : (cols[i] ? cols[i].j : 0)));
  }

  /* ----------------------------- Pustaka Excel ----------------------------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('lib')));
      s.onerror = () => { s.remove(); reject(new Error('offline')); };
      document.head.appendChild(s);
    });
  }
  /* Coba salinan lokal (Method/Shared/xlsx.full.min.js, bisa offline) dulu, baru CDN */
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return loadScript(XLSX_LOCAL).catch(() => loadScript(XLSX_URL));
  }
  const readText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read')); r.readAsText(file); });
  const readBuffer = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('read')); r.readAsArrayBuffer(file); });

  /* ------------------------------ UI per metode ------------------------------ */
  function setup(cfg) {
    const card = $(cfg.card);
    const body = $(cfg.body);
    const anchor = card && $('.table-scroll', card);
    if (!card || !body || !anchor || card.dataset.impReady) return;
    card.dataset.impReady = '1';
    const uid = cfg.card.replace(/[^a-z0-9]/gi, '');

    const wrap = document.createElement('div');
    wrap.className = 'imp-wrap';
    wrap.innerHTML = `
      <div class="imp-bar">
        <span class="imp-label">Impor data:</span>
        <button type="button" class="btn-ghost" data-act="paste">Tempel dari Excel</button>
        <button type="button" class="btn-ghost" data-act="file">Unggah file (.xlsx, .csv)</button>
        <input type="file" hidden accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,text/csv,text/plain">
      </div>
      <div class="imp-panel" data-panel="paste" hidden>
        <h4>Tempel data dari Excel</h4>
        <p>Blok sel di Excel/Google Sheets (boleh beserta judul kolom), salin dengan Ctrl+C, lalu tempel di kotak ini. Anda juga bisa langsung menempel (Ctrl+V) ke sel mana pun pada tabel di bawah.</p>
        <label for="${uid}Paste" class="sr-only" style="position:absolute;left:-9999px">Data tempelan</label>
        <textarea id="${uid}Paste" spellcheck="false" placeholder="Tempel data di sini&hellip;"></textarea>
        <div class="imp-actions">
          <button type="button" class="btn-primary" data-act="read">Baca Data</button>
          <button type="button" class="btn-ghost" data-act="cancel">Batal</button>
        </div>
      </div>
      <div class="imp-panel" data-panel="preview" hidden></div>
      <p class="error-msg" data-msg="err" role="alert" hidden></p>
      <p class="imp-ok" data-msg="ok" role="status" hidden></p>`;
    anchor.parentNode.insertBefore(wrap, anchor);

    const fileInput = $('input[type=file]', wrap);
    const panelPaste = $('[data-panel="paste"]', wrap);
    const panelPrev = $('[data-panel="preview"]', wrap);
    const errEl = $('[data-msg="err"]', wrap), okEl = $('[data-msg="ok"]', wrap);
    const textarea = $('textarea', wrap);
    let parsed = null; // { rows, source, hasHeader }

    const showErr = (m) => { okEl.hidden = true; errEl.textContent = m; errEl.hidden = false; };
    const showOk = (m) => { errEl.hidden = true; okEl.textContent = m; okEl.hidden = false; };
    const clearMsg = () => { errEl.hidden = true; okEl.hidden = true; };

    /* Target kolom = jumlah <input> pada baris pertama tabel; label = judul kolom tabel */
    function targets() {
      const first = body.rows[0];
      if (!first) return null;
      const n = $$('input', first).length;
      const ths = $$('thead th', body.closest('table'));
      const labels = ths.slice(Math.max(0, ths.length - n)).map((t) => { const i = t.querySelector('input'); return (i ? i.value : t.textContent).trim() || 'Kolom'; });
      return n ? { n, labels } : null;
    }
    const minRows = () => parseInt((cfg.minHint && $(cfg.minHint) ? $(cfg.minHint).textContent : '1'), 10) || 1;

    function setRowCount(n) {
      const addBtn = $(cfg.add), remBtn = $(cfg.remove);
      let guard = 0;
      while (body.rows.length < n && guard++ < MAX_ROWS + 5) addBtn.click();
      guard = 0;
      while (body.rows.length > n && guard++ < MAX_ROWS + 5) { const b = body.rows.length; remBtn.click(); if (body.rows.length === b) break; }
    }
    function setCell(inp, v) {
      inp.value = v;
      inp.classList.remove('invalid');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function ingest(rows, source, opt) {
      clearMsg();
      rows = padRows(rows.filter((r) => r.some((c) => String(c).trim() !== '')));
      if (!rows.length || !rows[0].length) { showErr('Tidak ada data yang terbaca. Pastikan file/tempelan berisi angka.'); return; }
      if (rows.length > MAX_ROWS + 1) { showErr(`Data terlalu banyak (maksimal ${MAX_ROWS} baris).`); return; }
      if (!targets()) { showErr('Tabel input belum dibuat. Selesaikan Langkah 1 terlebih dahulu, lalu impor data.'); return; }
      parsed = { rows, source, hasHeader: opt && typeof opt.hasHeader === 'boolean' ? opt.hasHeader : detectHeader(rows) };
      panelPaste.hidden = true;
      renderPreview();
    }

    function renderPreview() {
      const { rows, source } = parsed;
      const { data, cols } = analyze(rows, parsed.hasHeader);
      if (cfg.fitCols) { /* tabel dengan jumlah kolom fleksibel: sesuaikan dengan kolom angka pada data */
        const skipN = /^(no|nomor|no\.|periode|tahun|bulan|tanggal|tgl|date|waktu|time|id|period|year|month)$/i;
        const num = cols.filter((c) => c.numeric), pref = num.filter((c) => !skipN.test(c.name));
        cfg.fitCols((pref.length || num.length || cols.length));
      }
      const t = targets();
      if (cols.length < t.n) {
        panelPrev.hidden = true;
        showErr(`Tabel membutuhkan ${t.n} kolom (${t.labels.join(', ')}), tetapi data hanya memiliki ${cols.length} kolom.`);
        return;
      }
      const map = parsed.map && parsed.map.length === t.n ? parsed.map : autoMap(cols, t.n);
      parsed.map = map;
      const used = new Set(map);
      const opt = (c, sel) => `<option value="${c.j}" ${sel ? 'selected' : ''}>${colLetter(c.j)} \u2014 ${esc(c.name)}${c.numeric ? '' : ' (bukan angka)'}</option>`;
      const selects = t.labels.map((lab, i) => `<label>${esc(lab)} \u2190 kolom<select class="select-input" data-target="${i}">${cols.map((c) => opt(c, c.j === map[i])).join('')}</select></label>`).join('');
      const head = cols.map((c) => `<th class="${used.has(c.j) ? '' : 'skip'}">${colLetter(c.j)}<br>${esc(c.name)}</th>`).join('');
      const prevRows = data.slice(0, 5).map((r) => `<tr>${cols.map((c) => `<td class="${used.has(c.j) ? '' : 'skip'}">${esc(r[c.j])}</td>`).join('')}</tr>`).join('');
      panelPrev.innerHTML = `
        <h4>Pratinjau &amp; pilih kolom</h4>
        <p>Terbaca <strong>${data.length} baris</strong> &times; ${cols.length} kolom dari ${esc(source)}. Pastikan kolom yang dipakai sudah benar (kolom abu-abu tidak diisikan ke tabel).</p>
        <label class="imp-check"><input type="checkbox" data-act="header" ${parsed.hasHeader ? 'checked' : ''}> Baris pertama adalah judul kolom</label>
        <div class="imp-map">${selects}</div>
        <div class="imp-preview"><table><thead><tr>${head}</tr></thead><tbody>${prevRows}</tbody></table></div>
        ${data.length > 5 ? `<p>&hellip; menampilkan 5 dari ${data.length} baris.</p>` : ''}
        <div class="imp-actions">
          <button type="button" class="btn-primary" data-act="apply">Terapkan ke Tabel</button>
          <button type="button" class="btn-ghost" data-act="cancel">Batal</button>
        </div>`;
      panelPrev.hidden = false;
    }

    function apply() {
      const t = targets();
      if (!t || !parsed) return;
      const map = $$('select[data-target]', panelPrev).map((s) => parseInt(s.value, 10));
      if (new Set(map).size !== map.length) { showErr('Satu kolom dipilih lebih dari sekali. Pilih kolom yang berbeda untuk tiap variabel.'); return; }
      const data = analyze(parsed.rows, parsed.hasHeader).data;
      const textCols = cfg.text || []; // indeks kolom teks (mis. kategori/kelompok) yang tidak perlu berupa angka
      const matrix = [];
      let bad = 0;
      data.forEach((r) => {
        const vals = map.map((j) => String(r[j] === undefined ? '' : r[j]).trim());
        if (vals.every((v) => v === '')) return;
        matrix.push(vals.map((v, k) => { if (textCols.indexOf(k) !== -1) return v; const n = normNum(v); if (n === null && v !== '') bad++; return n === null ? v : n; }));
      });
      const need = minRows();
      if (matrix.length < need) { showErr(`Data hanya ${matrix.length} baris, sedangkan metode ini membutuhkan minimal ${need} baris.`); return; }
      setRowCount(matrix.length);
      $$('tr', body).forEach((tr, i) => $$('input', tr).forEach((inp, j) => setCell(inp, matrix[i] ? matrix[i][j] : '')));
      panelPrev.hidden = true;
      const pairs = t.labels.map((lab, i) => `${lab} \u2190 ${analyze(parsed.rows, parsed.hasHeader).cols[map[i]].name}`).join(', ');
      if (cfg.onApply && parsed.hasHeader) { const cc = analyze(parsed.rows, parsed.hasHeader).cols; cfg.onApply({ names: map.map((j) => cc[j].name), offset: 0 }); }
      showOk(`Berhasil mengisi ${matrix.length} baris (${pairs}).` + (bad ? ` Perhatian: ${bad} sel bukan angka dan akan ditandai merah saat dihitung.` : ''));
      parsed = null;
    }

    INSTANCES[cfg.card] = { ingest, wrap };

    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.tagName === 'INPUT') return;
      const act = b.dataset.act;
      if (act === 'paste') { clearMsg(); panelPrev.hidden = true; panelPaste.hidden = !panelPaste.hidden; if (!panelPaste.hidden) textarea.focus(); }
      else if (act === 'file') { fileInput.click(); }
      else if (act === 'read') {
        if (!textarea.value.trim()) { showErr('Kotak masih kosong. Tempel data dari Excel terlebih dahulu.'); return; }
        ingest(parseGrid(textarea.value), 'tempelan');
      }
      else if (act === 'cancel') { panelPaste.hidden = true; panelPrev.hidden = true; parsed = null; }
      else if (act === 'apply') apply();
    });
    wrap.addEventListener('change', (e) => {
      const el = e.target;
      if (el.matches('[data-act="header"]')) { parsed.hasHeader = el.checked; parsed.map = null; renderPreview(); }
      else if (el.matches('select[data-target]')) { parsed.map = $$('select[data-target]', panelPrev).map((s) => parseInt(s.value, 10)); renderPreview(); }
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      clearMsg();
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (file.size > MAX_FILE_BYTES) { showErr('Ukuran file terlalu besar (maksimal 8 MB).'); return; }
      try {
        if (['csv', 'tsv', 'txt'].includes(ext)) {
          ingest(parseGrid(await readText(file)), `file ${file.name}`);
        } else if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
          showOk('Membaca file Excel\u2026');
          const XLSX = await loadXLSX();
          const wb = XLSX.read(await readBuffer(file), { type: 'array' });
          const name = wb.SheetNames[0];
          const arr = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false });
          const rows = arr.map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v).trim())));
          const extra = wb.SheetNames.length > 1 ? `, sheet pertama dari ${wb.SheetNames.length}` : '';
          ingest(rows, `file ${file.name} (sheet \u201C${name}\u201D${extra})`);
        } else {
          showErr('Format file tidak didukung. Gunakan .xlsx, .xls, .csv, .tsv, atau .txt.');
        }
      } catch (err) {
        showErr(err && err.message === 'offline'
          ? 'Pustaka pembaca Excel gagal dimuat (perlu internet saat pertama kali). Simpan file sebagai CSV lalu unggah, atau gunakan \u201CTempel dari Excel\u201D.'
          : 'File tidak dapat dibaca. Pastikan file tidak rusak atau diproteksi password.');
      }
    });

    /* Tempel (Ctrl+V) langsung ke sel tabel: isi mulai dari sel yang sedang aktif */
    body.addEventListener('paste', (e) => {
      const inp = e.target;
      if (!inp || inp.tagName !== 'INPUT') return;
      const cd = e.clipboardData || window.clipboardData;
      const text = cd ? cd.getData('text') : '';
      if (!/[\t\r\n]/.test(text.trim())) return; // satu sel: biarkan perilaku bawaan
      e.preventDefault();
      let rows = parseGrid(text);
      if (!rows.length) return;
      let pastedHead = null;
      if (detectHeader(rows)) { pastedHead = rows[0]; rows = rows.slice(1); }
      const tr = inp.closest('tr');
      const r0 = Array.prototype.indexOf.call(body.rows, tr);
      const c0 = $$('input', tr).indexOf(inp);
      if (r0 + rows.length > MAX_ROWS) { showErr(`Data terlalu banyak (maksimal ${MAX_ROWS} baris).`); return; }
      if (body.rows.length < r0 + rows.length) setRowCount(r0 + rows.length);
      let dropped = false;
      rows.forEach((r, i) => {
        const ins = $$('input', body.rows[r0 + i]);
        r.forEach((v, j) => { if (ins[c0 + j]) { const n = (cfg.text || []).indexOf(c0 + j) !== -1 ? null : normNum(v); setCell(ins[c0 + j], n === null ? v : n); } else if (String(v).trim() !== '') dropped = true; });
      });
      if (cfg.onApply && pastedHead) cfg.onApply({ names: pastedHead, offset: c0 });
      showOk(`Menempel ${rows.length} baris ke tabel.` + (dropped ? ' Kolom yang melebihi jumlah kolom tabel diabaikan.' : ''));
    });
  }

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  CONFIGS.forEach(setup);
  /* Kirim larik 2D (baris pertama = judul bila opt.hasHeader) ke tabel metode lain: membuka pratinjau pemetaan kolom.
     Mengembalikan true bila kartu tujuan ditemukan. */
  function send(cardSel, rows, source, opt) {
    const inst = INSTANCES[cardSel];
    if (!inst) return false;
    inst.ingest(rows, source || 'lembar kerja Calc', opt);
    try { inst.wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* abaikan */ }
    return true;
  }
  window.StatCalcImport = { register: (cfg) => { CONFIGS.push(cfg); setup(cfg); }, normNum, parseGrid, detectHeader, send, has: (c) => !!INSTANCES[c] };
})();
