/* =========================================================================
   CALC > TAB GRAFIK (Method/Calc/sheet-graph.js)
   -------------------------------------------------------------------------
   Menambah tab "Grafik" di pita Calc: grafik digambar langsung dari data
   lembar kerja (tanpa pindah ke menu Graph).

   - Ikon tiap grafik di tab Grafik. Klik ikon -> grafik dibuat dari seleksi sel
     (satu sel terpilih = seluruh tabel). Grafik yang butuh label (Bar, Pie,
     Time Series, Boxplot Kelompok) menanyakan dulu kolom label & nilainya.
   - Tampilan "Di atas lembar kerja": grafik melayang di atas sel, bisa diseret
     dan diubah ukurannya (8 pegangan; sentuh pun bisa).
   - Tampilan "Di bawah lembar kerja": grafik di panel di bawah lembar kerja,
     lengkap dengan tombol Unduh PNG / SVG dan ringkasan.
   - Klik sebuah grafik -> muncul tab "Edit Grafik": data (kolom, baris), teks,
     opsi grafik, warna, garis kisi, tampilan.
   - Grafik ikut berubah bila data sel diubah, dan rujukan kolomnya ikut
     bergeser saat kolom disisip / dihapus.

   Memakai GraphCore.render() (Method/Graph/graph-core.js) sehingga hasilnya
   sama dengan menu Graph. Dimuat SETELAH Method/Calc/sheet.js.
   ========================================================================= */
(function () {
  'use strict';

  const SH = window.StatCalcSheet, GC = window.GraphCore;
  if (!SH || !GC || !GC.render) return;

  const S = SH.state, section = SH.els.section, elScroll = SH.els.scroll, elInner = SH.els.inner;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const GUT = 48, MINW = 170, MINH = 110;

  /* ------------------------------ Ikon grafik ------------------------------ */
  const F = 'fill="currentColor" fill-opacity=".16"';
  const ICON = {
    histogram: `<path d="M3.5 20.5h17"/><rect x="4.5" y="13" width="3.6" height="7.5" ${F}/><rect x="8.1" y="7" width="3.6" height="13.5" ${F}/><rect x="11.7" y="3.8" width="3.6" height="16.7" ${F}/><rect x="15.3" y="10" width="3.6" height="10.5" ${F}/>`,
    probplot: '<path d="M4 3.5v17h16.5"/><path d="M6.5 17.8 18.5 6" stroke-dasharray="2.4 2"/><circle cx="7.6" cy="16.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="10.2" cy="14.4" r="1.15" fill="currentColor" stroke="none"/><circle cx="12.6" cy="12.3" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.2" cy="10.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="17.6" cy="7.2" r="1.15" fill="currentColor" stroke="none"/>',
    boxplot: `<path d="M3.5 20.5h17"/><path d="M8 4.5v3M8 15v3.5M5.8 4.5h4.4M5.8 18.5h4.4"/><rect x="5" y="7.5" width="6" height="7.5" rx=".6" ${F}/><path d="M5 11.2h6"/><path d="M16.5 3.5v5M16.5 13.5v5M14.3 3.5h4.4M14.3 18.5h4.4"/><rect x="13.5" y="8.5" width="6" height="5" rx=".6" ${F}/><path d="M13.5 11h6"/>`,
    boxgroup: `<path d="M3.5 17h17"/><path d="M6.2 3.5v2.5M6.2 11v3M4.7 3.5h3M4.7 14h3"/><rect x="4" y="6" width="4.4" height="5" rx=".5" ${F}/><path d="M12 5.5v2M12 12v2.5M10.5 5.5h3M10.5 14.5h3"/><rect x="9.8" y="7.5" width="4.4" height="4.5" rx=".5" ${F}/><path d="M17.8 7v2M17.8 13.5v1M16.3 7h3M16.3 14.5h3"/><rect x="15.6" y="9" width="4.4" height="4.5" rx=".5" ${F}/><path d="M4.6 20.5h3.2M10.4 20.5h3.2M16.2 20.5h3.2"/>`,
    scatter: '<path d="M4 3.5v17h16.5"/><path d="M6.5 16.5 19 7.5" stroke-dasharray="2.4 2"/><circle cx="7.4" cy="14.4" r="1.25" fill="currentColor" stroke="none"/><circle cx="10" cy="15.6" r="1.25" fill="currentColor" stroke="none"/><circle cx="11.6" cy="11.4" r="1.25" fill="currentColor" stroke="none"/><circle cx="14.4" cy="12.6" r="1.25" fill="currentColor" stroke="none"/><circle cx="16.2" cy="8.2" r="1.25" fill="currentColor" stroke="none"/><circle cx="18.6" cy="9.6" r="1.25" fill="currentColor" stroke="none"/>',
    barchart: `<path d="M3.5 20.5h17"/><rect x="4.8" y="11" width="3.8" height="9.5" rx=".6" ${F}/><rect x="10.1" y="5" width="3.8" height="15.5" rx=".6" ${F}/><rect x="15.4" y="13.5" width="3.8" height="7" rx=".6" ${F}/>`,
    piechart: `<circle cx="12" cy="12" r="8.5"/><path d="M12 12V3.5M12 12l7.2 4.6M12 12 5.4 17.2"/><path d="M12 12V3.5A8.5 8.5 0 0 1 19.2 16.6Z" ${F}/>`,
    timeseries: '<path d="M4 3.5v17h16.5"/><path d="M5.5 16.5 9 11.5l3 3 3.6-7 3.4 3.5"/><circle cx="9" cy="11.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="14.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.6" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="19" cy="11" r="1.1" fill="currentColor" stroke="none"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
    done: '<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.7 2.7 4.8-5.4"/>',
    sel: '<path d="M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  };
  const svgI = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

  /* ----------------------------- Katalog grafik ---------------------------- */
  /* roles = peran kolom data (urut sesuai kolom GraphCore); dialog = tanya kolom label dulu */
  const ROLES = {
    histogram: [{ l: 'Kolom data', hint: 'kolom angka yang disebarkan' }],
    probplot: [{ l: 'Kolom data', hint: 'kolom angka yang diperiksa kenormalannya' }],
    scatter: [{ l: 'Variabel X', hint: 'sumbu mendatar (variabel bebas)' }, { l: 'Variabel Y', hint: 'sumbu tegak (variabel terikat)' }],
    barchart: [{ l: 'Label kategori', hint: 'nama tiap batang (teks)' }, { l: 'Nilai', hint: 'tinggi batang (angka)' }],
    piechart: [{ l: 'Label kategori', hint: 'nama tiap irisan (teks)' }, { l: 'Nilai', hint: 'ukuran irisan (angka tidak negatif)' }],
    timeseries: [{ l: 'Label periode', hint: 'urutan waktu, mis. Jan, Feb, 2024-Q1' }, { l: 'Nilai', hint: 'nilai pada tiap periode (angka)' }],
    'boxplot:long': [{ l: 'Label kelompok', hint: 'kolom yang menentukan kelompok tiap nilai (faktor ANOVA)', none: '(tanpa kelompok)' }, { l: 'Nilai', hint: 'angka yang dibandingkan antar kelompok' }],
  };
  const CATALOG = [
    { key: 'histogram', gid: 'histogram', label: 'Histogram', tip: 'Histogram: sebaran satu kolom angka', group: 'Sebaran data' },
    { key: 'probplot', gid: 'probplot', label: 'Probability Plot', tip: 'Probability Plot (Q-Q normal): cek kenormalan satu kolom angka', group: 'Sebaran data' },
    { key: 'boxplot', gid: 'boxplot', mode: 'wide', label: 'Boxplot', tip: 'Boxplot per variabel: tiap kolom angka = satu kotak', group: 'Sebaran data' },
    { key: 'boxgroup', gid: 'boxplot', mode: 'long', label: 'Boxplot Kelompok', tip: 'Boxplot per kelompok (gaya ANOVA): pilih kolom label kelompok dan kolom nilai', group: 'Sebaran data', dialog: true, why: 'Kolom label menentukan kelompok setiap nilai, seperti faktor pada ANOVA. Satu kotak digambar untuk tiap label yang berbeda.' },
    { key: 'scatter', gid: 'scatter', label: 'Scatter Plot', tip: 'Scatter Plot: hubungan dua kolom angka (X dan Y)', group: 'Hubungan' },
    { key: 'barchart', gid: 'barchart', label: 'Bar Chart', tip: 'Bar Chart: bandingkan nilai antar kategori', group: 'Kategori & waktu', dialog: true, why: 'Pilih kolom yang berisi nama kategori (label tiap batang) dan kolom nilainya. Kategori yang sama akan dijumlahkan.' },
    { key: 'piechart', gid: 'piechart', label: 'Pie Chart', tip: 'Pie Chart: komposisi bagian terhadap total', group: 'Kategori & waktu', dialog: true, why: 'Pilih kolom yang berisi nama kategori (label tiap irisan) dan kolom nilainya. Kategori yang sama akan dijumlahkan.' },
    { key: 'timeseries', gid: 'timeseries', label: 'Time Series', tip: 'Time Series Plot: data menurut urutan waktu', group: 'Kategori & waktu', dialog: true, why: 'Pilih kolom periode (label sumbu waktu) dan kolom nilainya. Urutkan data dari periode paling awal ke paling akhir.' },
  ];
  const entryOf = (key) => CATALOG.find((e) => e.key === key);
  const rolesOf = (gid, mode) => ROLES[gid === 'boxplot' ? 'boxplot:long' : gid] || (mode === 'long' && ROLES[gid]) || [];
  /* peran kolom -> label sumbu otomatis (dari judul kolom): [indeks peran sumbu X, indeks peran sumbu Y] */
  const AXSRC = { histogram: [0, null], probplot: [null, null], scatter: [0, 1], barchart: [0, 1], timeseries: [0, 1], boxplot: [0, 1], piechart: [null, null] };

  /* --------------------------------- Gaya --------------------------------- */
  const style = document.createElement('style');
  style.textContent = `
    #view-metode-calc .sc-tab-ctx{ color:var(--accent-2); background:var(--accent-soft); font-weight:800; }
    #view-metode-calc .sc-tab-ctx[aria-selected="true"]{ color:var(--accent); }
    #view-metode-calc .sg-fg{ display:grid; gap:8px 10px; align-items:end; }
    #view-metode-calc .sg-color input{ width:78px; height:40px; padding:2px; border:1px solid var(--rule-strong); border-radius:10px; background:#fff; cursor:pointer; }
    #view-metode-calc .sc-ribbon .plain-input.invalid{ border-color:var(--bad); background:var(--bad-bg); }
    #view-metode-calc .sc-ribbon .sg-w{ width:150px; }
    #view-metode-calc .sc-gbody.sg-gcol{ flex-direction:column; align-items:stretch; }

    #view-metode-calc .sg-layer{ position:absolute; left:0; top:0; right:0; bottom:0; z-index:2; pointer-events:none; }
    #view-metode-calc .sg-chart{ position:absolute; pointer-events:auto; box-sizing:border-box; background:#fff; border:1px solid var(--rule-strong); border-radius:8px; box-shadow:0 4px 18px rgba(20,30,45,.18); cursor:move; touch-action:none; user-select:none; -webkit-user-select:none; outline:none; }
    #view-metode-calc .sg-chart.sel{ border-color:var(--accent-2); box-shadow:0 0 0 2px var(--accent-2), 0 8px 26px rgba(20,30,45,.26); z-index:3; }
    #view-metode-calc .sg-chart.drag{ opacity:.93; }
    #view-metode-calc .sg-body{ position:absolute; inset:0; overflow:hidden; border-radius:7px; }
    #view-metode-calc .sg-body svg{ display:block; width:100%; height:100%; pointer-events:none; }
    #view-metode-calc .sg-err{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:16px; text-align:center; font-size:13px; line-height:1.4; color:var(--bad); background:var(--bad-bg); }
    #view-metode-calc .sg-x{ position:absolute; top:6px; right:6px; width:26px; height:26px; padding:0; border:1px solid var(--rule-strong); border-radius:50%; background:rgba(255,255,255,.94); color:var(--ink-soft); font-size:17px; line-height:1; cursor:pointer; display:none; z-index:4; }
    #view-metode-calc .sg-chart.sel .sg-x{ display:block; }
    #view-metode-calc .sg-x:hover{ color:var(--bad); border-color:var(--bad); }
    #view-metode-calc .sg-h{ position:absolute; width:12px; height:12px; box-sizing:border-box; background:#fff; border:2px solid var(--accent-2); border-radius:3px; transform:translate(-50%,-50%); display:none; touch-action:none; z-index:5; }
    #view-metode-calc .sg-chart.sel .sg-h{ display:block; }
    #view-metode-calc .sg-h[data-h="nw"]{ left:0; top:0; cursor:nwse-resize; }
    #view-metode-calc .sg-h[data-h="n"]{ left:50%; top:0; cursor:ns-resize; }
    #view-metode-calc .sg-h[data-h="ne"]{ left:100%; top:0; cursor:nesw-resize; }
    #view-metode-calc .sg-h[data-h="e"]{ left:100%; top:50%; cursor:ew-resize; }
    #view-metode-calc .sg-h[data-h="se"]{ left:100%; top:100%; cursor:nwse-resize; }
    #view-metode-calc .sg-h[data-h="s"]{ left:50%; top:100%; cursor:ns-resize; }
    #view-metode-calc .sg-h[data-h="sw"]{ left:0; top:100%; cursor:nesw-resize; }
    #view-metode-calc .sg-h[data-h="w"]{ left:0; top:50%; cursor:ew-resize; }
    @media (pointer:coarse){ #view-metode-calc .sg-h{ width:22px; height:22px; border-radius:6px; } #view-metode-calc .sg-x{ width:32px; height:32px; } }

    #view-metode-calc .sg-below{ margin-top:16px; padding:16px 18px 18px; }
    #view-metode-calc .sg-below > h2{ margin:0 0 4px; font-size:18px; }
    #view-metode-calc .sg-blk{ border:1px solid var(--rule); border-radius:12px; padding:12px; margin-top:12px; background:#fff; }
    #view-metode-calc .sg-blk.sel{ border-color:var(--accent-2); box-shadow:0 0 0 2px var(--accent-soft); }
    #view-metode-calc .sg-bhead{ display:flex; flex-wrap:wrap; gap:8px 12px; align-items:center; justify-content:space-between; margin-bottom:10px; }
    #view-metode-calc .sg-bhead h3{ margin:0; font-size:15px; font-family:var(--font-body); }
    #view-metode-calc .sg-bbtns{ display:flex; flex-wrap:wrap; gap:8px; }
    #view-metode-calc .sg-bbtns .btn-ghost{ flex:none; min-height:38px; padding:0 14px; font-size:13.5px; }
    #view-metode-calc .sg-bchart{ position:relative; border:1px solid var(--rule); border-radius:8px; overflow:hidden; max-width:820px; margin:0 auto; background:#fff; }
    #view-metode-calc .sg-bchart svg{ display:block; width:100%; height:auto; }
    #view-metode-calc .sg-bchart .sg-err{ position:static; min-height:140px; }
    #view-metode-calc .sg-bnote{ margin:8px 0 0; font-size:13px; }
    #view-metode-calc .sg-bsum{ margin-top:12px; }
    #view-metode-calc .sg-bsum > summary{ cursor:pointer; font-weight:700; font-size:13.5px; color:var(--accent); padding:4px 0; }
    #view-metode-calc .sg-bsum .gr-sum{ display:flex; flex-direction:column; gap:14px; margin-top:8px; }

    .sg-modal{ position:fixed; inset:0; z-index:100; background:rgba(20,22,26,.46); display:flex; align-items:center; justify-content:center; padding:16px; }
    .sg-dlg{ background:#fff; border-radius:16px; width:100%; max-width:480px; max-height:92vh; overflow:auto; padding:20px 22px 18px; box-shadow:0 20px 60px rgba(0,0,0,.3); }
    .sg-dlg h3{ margin:0 0 6px; font-size:18px; }
    .sg-dlg-why{ margin:0 0 12px; font-size:13.5px; color:var(--ink-soft); }
    .sg-dlg-f{ display:flex; flex-direction:column; gap:3px; margin-bottom:10px; }
    .sg-dlg-f label{ font-size:13px; font-weight:700; color:var(--ink); }
    .sg-dlg-f small{ font-size:12px; color:var(--ink-faint); font-weight:500; }
    .sg-dlg-f .select-input{ width:100%; }
    .sg-dlg-prev{ margin:4px 0 8px; padding:8px 10px; border-radius:10px; background:var(--paper-2); font-size:12.5px; color:var(--ink-soft); font-family:var(--font-mono); overflow-x:auto; white-space:nowrap; }
    .sg-dlg-info{ margin:0 0 8px; font-size:12.5px; color:var(--ink-soft); }
    .sg-dlg-err{ margin:0 0 8px; padding:8px 11px; border-radius:10px; background:var(--bad-bg); color:var(--bad); font-size:13px; }
    .sg-dlg-btns{ display:flex; gap:10px; justify-content:flex-end; margin-top:12px; }
    .sg-dlg-btns button{ flex:0 1 auto; min-width:110px; }
  `;
  document.head.appendChild(style);

  /* --------------------------- Status & elemen DOM -------------------------- */
  let charts = [], seq = 0, selId = null;
  const insertBody = $('#sgInsertBody', section), editBody = $('#sgEditBody', section), ctxTab = $('.sc-tab-ctx', section);
  const layer = document.createElement('div');
  layer.className = 'sg-layer';
  elInner.appendChild(layer);

  const msgBox = $('.sc-msgs', section);
  msgBox.insertAdjacentHTML('beforeend', '<p class="sc-msg err" id="sgErr" role="alert" hidden></p><p class="sc-msg ok" id="sgOk" role="status" hidden></p>');
  function msg(kind, text, ms) {
    const e = $(kind === 'err' ? '#sgErr' : '#sgOk', section);
    $$('.sc-msg', section).forEach((m) => { if (m !== e) m.hidden = true; });
    e.textContent = text; e.hidden = false;
    clearTimeout(e._t); if (ms) e._t = setTimeout(() => { e.hidden = true; }, ms);
  }

  const below = document.createElement('section');
  below.className = 'card sg-below';
  below.hidden = true;
  below.innerHTML = '<h2>Grafik di bawah lembar kerja</h2><p class="hint">Setiap grafik di sini bisa diunduh sebagai gambar PNG atau SVG. Klik grafik atau tombol Edit grafik untuk mengubahnya lewat tab Edit Grafik di pita.</p><div class="sg-blist"></div>';
  $('.sc-main', section).insertAdjacentElement('afterend', below);
  const blist = $('.sg-blist', below);

  /* --------------------------- Bantu: kolom & data -------------------------- */
  const cn = (c) => SH.colName(c);
  function hdrText(c) { return S.header && c >= 0 ? SH.display(SH.cellVal(0, c)).trim() : ''; }
  const colLabel = (c) => hdrText(c) || 'Kolom ' + cn(c);
  function colOpt(c) { const t = hdrText(c); return cn(c) + (t ? ' \u2013 ' + (t.length > 18 ? t.slice(0, 17) + '\u2026' : t) : ''); }
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  /* Telaah seleksi: satu sel = seluruh tabel; rentang = kolom/baris terpilih */
  function analyze() {
    const ub = SH.usedBounds(), first = SH.firstDataRow(), last = SH.lastDataRow();
    if (ub.C < 1 || last < first) return null;
    const sel = SH.selection();
    let c1 = 0, c2 = ub.C - 1, r1 = first, r2 = last, explicit = false;
    if (sel.multi) {
      const R = sel.rect;
      const a = Math.max(0, R.c1), b = Math.min(ub.C - 1, R.c2), ra = Math.max(first, R.r1), rb = Math.min(last, R.r2);
      if (a <= b && ra <= rb) { c1 = a; c2 = b; r1 = ra; r2 = rb; explicit = r1 > first || r2 < last; }
    }
    const cols = [];
    for (let c = c1; c <= c2; c++) {
      let nb = 0, nn = 0;
      for (let r = r1; r <= r2; r++) { const v = SH.cellVal(r, c); if (v === '') continue; nb++; if (isNum(v)) nn++; }
      if (nb) cols.push({ c, numeric: nn / nb >= 0.8, nb });
    }
    return { c1, c2, r1, r2, first, last, explicit, cols };
  }

  /* Tebakan pemetaan kolom -> peran grafik */
  function guess(gid, mode, ctx) {
    const info = GC.info(gid), cols = ctx.cols;
    if (mode === 'wide') {
      const v = cols.filter((x) => x.numeric).map((x) => x.c).slice(0, (info.wide && info.wide.maxCols) || 12);
      return { vcols: v, ok: v.length > 0 };
    }
    const used = new Set(), map = info.columns.map(() => -1);
    const order = info.columns.map((_, j) => j).sort((a, b) => (info.columns[b].text ? 1 : 0) - (info.columns[a].text ? 1 : 0));
    order.forEach((j) => {
      const d = info.columns[j];
      let pick;
      if (d.text) {
        pick = cols.find((x) => !x.numeric && !used.has(x.c));
        if (!pick && !d.optional) {
          // label berupa angka (mis. tahun): ambil kolom paling kiri yang bebas, sisakan kolom angka untuk peran nilai
          const need = info.columns.filter((x) => !x.text).length, free = cols.filter((x) => !used.has(x.c));
          if (free.length > need) pick = free[0];
        }
      } else pick = cols.find((x) => x.numeric && !used.has(x.c));
      if (pick) { map[j] = pick.c; used.add(pick.c); }
    });
    return { cols: map, ok: info.columns.every((d, j) => d.optional || map[j] >= 0) };
  }

  /* Baca data grafik dari lembar kerja */
  function getData(ch, info) {
    const first = SH.firstDataRow(), last = SH.lastDataRow();
    if (last < first) throw new Error('Lembar kerja belum berisi data.');
    const a = Math.max(first, ch.r1 ? ch.r1 - 1 : first), b = Math.min(last, ch.r2 ? ch.r2 - 1 : last);
    if (a > b) throw new Error('Rentang baris kosong. Periksa isian \u201CDari baris\u201D dan \u201CSampai baris\u201D.');
    const rd = (r, c) => {
      if (c < 0) return '';
      const v = SH.cellVal(r, c);
      if (SH.isErr(v)) throw new Error(`Sel ${cn(c)}${r + 1} berisi galat ${v.code}. Perbaiki isi atau rumusnya.`);
      return v;
    };
    const numOf = (v) => (isNum(v) ? v : GC.parseNum(String(v)));

    if (ch.mode === 'wide') {
      const names = [], series = [], seen = {}; let n = 0;
      if (!ch.vcols.length) throw new Error('Pilih minimal satu kolom variabel (mis. B:D).');
      ch.vcols.forEach((c) => {
        const arr = [];
        for (let r = a; r <= b; r++) {
          const v = rd(r, c); if (v === '') continue;
          const x = numOf(v);
          if (!Number.isFinite(x)) throw new Error(`Sel ${cn(c)}${r + 1}: \u201C${SH.display(v)}\u201D bukan angka (kolom ${colLabel(c)}).`);
          arr.push(x);
        }
        if (!arr.length) return;
        let nm = colLabel(c);
        if (seen[nm]) { seen[nm]++; nm += ' (' + seen[nm] + ')'; } else seen[nm] = 1;
        names.push(nm); series.push(arr); n += arr.length;
      });
      if (!names.length) throw new Error('Kolom yang dipilih belum berisi angka.');
      const mp = info.wide.minPerSeries || 2, sh = series.findIndex((x) => x.length < mp);
      if (sh !== -1) throw new Error(`Variabel \u201C${names[sh]}\u201D baru berisi ${series[sh].length} data; minimal ${mp} data per variabel.`);
      return { data: { wide: true, d: { names, series, n } }, note: '' };
    }

    const roles = rolesOf(ch.gid, 'long');
    info.columns.forEach((d, j) => {
      if (!d.optional && !(ch.cols[j] >= 0)) throw new Error(`Pilih kolom untuk \u201C${(roles[j] || {}).l || d.label}\u201D di tab Edit Grafik.`);
    });
    const cols = info.columns.map(() => []); let n = 0, skipped = 0;
    for (let r = a; r <= b; r++) {
      const raw = ch.cols.map((c) => rd(r, c));
      if (raw.every((v) => v === '')) continue;
      const row = []; let ok = true;
      for (let j = 0; j < info.columns.length; j++) {
        const d = info.columns[j], v = raw[j], c = ch.cols[j];
        if (d.text) {
          if (v === '') { if (d.optional) { row.push(d.fallback || ''); continue; } ok = false; break; }
          row.push(typeof v === 'string' ? v : SH.display(v));
        } else {
          if (v === '') { ok = false; break; }
          const x = numOf(v);
          if (!Number.isFinite(x)) throw new Error(`Sel ${cn(c)}${r + 1}: \u201C${SH.display(v)}\u201D bukan angka (peran \u201C${(roles[j] || {}).l || d.label}\u201D memakai kolom ${colLabel(c)}). Pilih kolom lain atau perbaiki isinya.`);
          row.push(x);
        }
      }
      if (!ok) { skipped++; continue; }
      row.forEach((v, j) => cols[j].push(v)); n++;
    }
    if (n < info.minRows) throw new Error(`Data baru ${n} baris; grafik ini membutuhkan minimal ${info.minRows} baris.`);
    return { data: { wide: false, d: { cols, n } }, note: skipped ? `${skipped} baris dilewati karena ada sel kosong pada kolom yang dipakai.` : '' };
  }

  function autoLabels(ch) {
    if (!S.header || ch.mode === 'wide') return {};
    const a = AXSRC[ch.gid] || [null, null];
    const lab = (j) => (j !== null && ch.cols[j] >= 0 ? hdrText(ch.cols[j]) : '');
    return { x: lab(a[0]), y: lab(a[1]) };
  }

  /* Hitung ulang SVG + ringkasan sebuah grafik (galat disimpan, tidak dilempar) */
  function compute(ch) {
    ch._err = ''; ch._note = '';
    try {
      const info = GC.info(ch.gid), r = getData(ch, info);
      const o = Object.assign({}, ch.opts), al = autoLabels(ch);
      if (!o.xLabel && al.x) o.xLabel = al.x;
      if (!o.yLabel && al.y) o.yLabel = al.y;
      const res = GC.render(ch.gid, r.data, o, ch.style);
      ch._svg = res.svg; ch._sum = res.summary || ''; ch._note = r.note;
      const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(res.svg);
      if (m) ch.ratio = (+m[1]) / (+m[2]);
    } catch (e) {
      ch._svg = ''; ch._sum = '';
      ch._err = e && e.message ? e.message : 'Grafik tidak dapat digambar.';
    }
  }
  const titleOf = (ch) => ch.opts.title || ch.label;

  /* ---------------------------- Grafik melayang ----------------------------- */
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const byId = (uid) => charts.find((c) => c.uid === uid) || null;
  const cur = () => byId(selId);
  const floatEl = (ch) => $(`.sg-chart[data-uid="${ch.uid}"]`, layer);
  const blockEl = (ch) => $(`.sg-blk[data-uid="${ch.uid}"]`, blist);

  function initGeom(ch) {
    const off = (charts.filter((c) => c !== ch && c.place === 'above').length % 6) * 28;
    const w = clamp(Math.min(520, elScroll.clientWidth - GUT - 40), 200, 700);
    ch.w = Math.round(w); ch.h = Math.round(w / (ch.ratio || 1.6));
    ch.x = Math.round(elScroll.scrollLeft + GUT + 16 + off); ch.y = Math.round(elScroll.scrollTop + 16 + off);
    clampPos(ch);
  }
  function clampPos(ch) {
    ch.x = Math.max(0, Math.min(ch.x, Math.max(0, elInner.offsetWidth - ch.w)));
    ch.y = Math.max(0, Math.min(ch.y, Math.max(0, elInner.offsetHeight - ch.h)));
  }
  function placeEl(ch, el) { el.style.left = ch.x + 'px'; el.style.top = ch.y + 'px'; el.style.width = ch.w + 'px'; el.style.height = ch.h + 'px'; }

  function paintFloat(ch) {
    const el = floatEl(ch); if (!el) return;
    const body = $('.sg-body', el);
    body.style.background = ch.style.bg || '#fff';
    body.innerHTML = ch._err ? `<div class="sg-err">${esc(ch._err)}</div>` : ch._svg;
    el.setAttribute('aria-label', 'Grafik ' + titleOf(ch));
  }

  function mountFloat(ch) {
    if (!ch.w) initGeom(ch);
    const el = document.createElement('div');
    el.className = 'sg-chart' + (ch.uid === selId ? ' sel' : '');
    el.dataset.uid = ch.uid; el.tabIndex = 0;
    el.innerHTML = '<div class="sg-body"></div><button type="button" class="sg-x" title="Hapus grafik" aria-label="Hapus grafik">&times;</button>' + HANDLES.map((h) => `<i class="sg-h" data-h="${h}"></i>`).join('');
    layer.appendChild(el);
    placeEl(ch, el); paintFloat(ch);

    ['mousedown', 'click', 'dblclick', 'contextmenu'].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation()));
    $('.sg-x', el).addEventListener('pointerdown', (e) => e.stopPropagation());
    $('.sg-x', el).addEventListener('click', () => removeChart(ch.uid));
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const k = e.key, step = e.shiftKey ? 10 : 1;
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeChart(ch.uid); return; }
      if (k === 'Escape') { deselect(); return; }
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k];
      if (d) { e.preventDefault(); ch.x += d[0]; ch.y += d[1]; clampPos(ch); placeEl(ch, el); }
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      if (e.target.closest('.sg-x')) return;
      select(ch.uid, true);
      try { el.focus({ preventScroll: true }); } catch (err) { /* abaikan */ }
      const hd = e.target.closest('.sg-h');
      const st = { px: e.clientX, py: e.clientY, x: ch.x, y: ch.y, w: ch.w, h: ch.h, hd: hd ? hd.dataset.h : '' };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
      el.classList.add('drag');
      const mv = (ev) => {
        const dx = ev.clientX - st.px, dy = ev.clientY - st.py;
        if (!st.hd) {
          ch.x = st.x + dx; ch.y = st.y + dy; clampPos(ch);
        } else {
          const east = st.hd.indexOf('e') >= 0, west = st.hd.indexOf('w') >= 0, south = st.hd.indexOf('s') >= 0, north = st.hd.indexOf('n') >= 0;
          let w = st.w, h = st.h;
          if (east) w = st.w + dx; if (west) w = st.w - dx;
          if (south) h = st.h + dy; if (north) h = st.h - dy;
          w = Math.max(MINW, w); h = Math.max(MINH, h);
          if (ch.lock) {
            const r = st.w / st.h;
            if ((east || west) && !(north || south)) h = w / r;
            else if ((north || south) && !(east || west)) w = h * r;
            else if (Math.abs(w - st.w) / st.w >= Math.abs(h - st.h) / st.h) h = w / r; else w = h * r;
            if (w < MINW) { w = MINW; h = w / r; }
            if (h < MINH) { h = MINH; w = h * r; }
          }
          let x = west ? st.x + st.w - w : st.x, y = north ? st.y + st.h - h : st.y;
          if (x < 0) { w += x; x = 0; if (ch.lock) { const r = st.w / st.h; h = w / r; if (north) y = st.y + st.h - h; } }
          if (y < 0) { h += y; y = 0; if (ch.lock) { const r = st.w / st.h; w = h * r; if (west) x = st.x + st.w - w; } }
          ch.x = Math.round(x); ch.y = Math.round(y); ch.w = Math.round(Math.max(MINW, w)); ch.h = Math.round(Math.max(MINH, h));
        }
        placeEl(ch, el);
      };
      const up = () => {
        el.classList.remove('drag');
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      e.preventDefault();
    });
  }

  /* --------------------------- Grafik di bawah lembar ------------------------ */
  function dlName(ch) { return ((($('#scFname', section) || {}).value || 'data-calc').trim() || 'data-calc').replace(/[\\/:*?"<>|]+/g, '_') + '-' + ch.key; }
  function blockHTML(ch) {
    return `<div class="sg-blk${ch.uid === selId ? ' sel' : ''}" data-uid="${ch.uid}">
      <div class="sg-bhead"><h3></h3><div class="sg-bbtns">
        <button type="button" class="btn-ghost" data-bact="edit">Edit grafik</button>
        <button type="button" class="btn-ghost" data-bact="png">Unduh PNG</button>
        <button type="button" class="btn-ghost" data-bact="svg">Unduh SVG</button>
        <button type="button" class="btn-ghost" data-bact="del">Hapus</button>
      </div></div>
      <div class="sg-bchart"></div>
      <p class="hint sg-bnote" hidden></p>
      <details class="sg-bsum" open><summary>Ringkasan &amp; interpretasi</summary><div class="gr-sum"></div></details>
    </div>`;
  }
  function paintBelow(ch) {
    const b = blockEl(ch); if (!b) return;
    $('h3', b).textContent = titleOf(ch);
    $('.sg-bchart', b).innerHTML = ch._err ? `<div class="sg-err">${esc(ch._err)}</div>` : ch._svg;
    $('.sg-bchart', b).style.background = ch.style.bg || '#fff';
    const nt = $('.sg-bnote', b); nt.hidden = !ch._note; nt.textContent = ch._note || '';
    $('.sg-bsum', b).hidden = !!ch._err || !ch._sum;
    $('.gr-sum', b).innerHTML = ch._err ? '' : ch._sum;
    $$('[data-bact="png"],[data-bact="svg"]', b).forEach((x) => { x.disabled = !!ch._err; });
  }
  function rebuildBelow() {
    const list = charts.filter((c) => c.place === 'below');
    blist.innerHTML = list.map(blockHTML).join('');
    list.forEach(paintBelow);
    below.hidden = !list.length;
  }
  blist.addEventListener('click', (e) => {
    const b = e.target.closest('.sg-blk'); if (!b) return;
    const ch = byId(b.dataset.uid); if (!ch) return;
    const act = e.target.closest('[data-bact]');
    if (!act) { if (!e.target.closest('summary')) select(ch.uid, true); return; }
    const a = act.dataset.bact;
    if (a === 'edit') { select(ch.uid, true); const r = $('.sc-ribbon', section); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (a === 'del') removeChart(ch.uid);
    else if (a === 'png') GC.downloadPNG(ch._svg, dlName(ch), () => msg('err', 'Peramban ini tidak dapat membuat PNG. Gunakan Unduh SVG.', 6000));
    else if (a === 'svg') GC.downloadSVG(ch._svg, dlName(ch));
  });

  /* ------------------------------ Pasang / lepas ---------------------------- */
  function paint(ch) { if (ch.place === 'above') paintFloat(ch); else paintBelow(ch); if (ch.uid === selId) syncSelClass(); }
  function mountAll(ch) {
    const f = floatEl(ch); if (f) f.remove();
    if (ch.place === 'above') mountFloat(ch);
    rebuildBelow();
  }
  function syncSelClass() {
    $$('.sg-chart', layer).forEach((e) => e.classList.toggle('sel', e.dataset.uid === selId));
    $$('.sg-blk', blist).forEach((e) => e.classList.toggle('sel', e.dataset.uid === selId));
  }
  function removeChart(uid) {
    const ch = byId(uid); if (!ch) return;
    charts = charts.filter((c) => c !== ch);
    const f = floatEl(ch); if (f) f.remove();
    if (selId === uid) deselect();
    rebuildBelow();
  }

  /* -------------------------------- Pilihan --------------------------------- */
  function select(uid, open) {
    const was = selId, ch = byId(uid); if (!ch) return;
    selId = uid; ctxTab.hidden = false;
    syncSelClass();
    if (was !== uid || !editBody.firstChild) buildEdit();
    if (open) {
      const t0 = elScroll.getBoundingClientRect().top;
      SH.showTab('editgrafik');
      const dy = elScroll.getBoundingClientRect().top - t0, se = document.scrollingElement;
      if (dy && se && se.scrollTop > 0) window.scrollBy(0, dy);   // jaga posisi lembar bila tinggi pita berubah
    }
  }
  function deselect() {
    if (selId === null) return;
    selId = null; syncSelClass();
    const active = $('.sc-rpanel.on', section);
    ctxTab.hidden = true;
    editBody.innerHTML = '';
    if (active && active.dataset.panel === 'editgrafik') SH.showTab('grafik');
  }
  elScroll.addEventListener('mousedown', (e) => { if (selId && !e.target.closest('.sg-chart')) deselect(); }, true);

  /* --------------------------- Tab Edit Grafik (pita) ----------------------- */
  const fld = (label, inner, cls) => `<div class="sc-fld${cls ? ' ' + cls : ''}"><label>${label}</label>${inner}</div>`;
  const selH = (k, val, opts, cls) => `<select class="select-input${cls ? ' ' + cls : ''}" data-k="${esc(k)}">${opts.map((o) => `<option value="${esc(o[0])}"${String(o[0]) === String(val) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const inH = (k, val, ph) => `<input type="text" class="plain-input sg-w" data-k="${esc(k)}" value="${esc(val === null || val === undefined ? '' : val)}" placeholder="${esc(ph || '')}" autocomplete="off">`;
  const chkH = (k, val, label) => `<label class="sc-chk"><input type="checkbox" data-k="${esc(k)}"${val ? ' checked' : ''}> ${esc(label)}</label>`;
  const colH = (k, val, label) => `<label class="sc-fld sg-color"><label>${esc(label)}</label><input type="color" data-k="${esc(k)}" value="${esc(val)}"></label>`;
  const grp = (label, body) => `<div class="sc-grp"><div class="sc-gbody">${body}</div><div class="sc-glabel">${label}</div></div>`;
  const grid = (items, n) => `<div class="sc-fgrid sg-fg" style="grid-template-columns:repeat(${n},max-content)">${items.join('')}</div>`;
  const rbH = (act, ico, label, tip, cls) => `<button type="button" class="sc-rb ${cls || ''}" data-act="${act}" title="${esc(tip || label)}" aria-label="${esc(tip || label)}">${svgI(ico)}<span>${esc(label)}</span></button>`;

  function specOf(vcols) {
    if (!vcols.length) return '';
    const s = vcols.slice().sort((a, b) => a - b), out = []; let i = 0;
    while (i < s.length) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? cn(s[i]) + ':' + cn(s[j]) : cn(s[i])); i = j + 1; }
    return out.join(',');
  }
  function parseSpec(t) {
    const out = new Set();
    for (const tok of String(t).split(/[\s,;]+/).filter(Boolean)) {
      const m = /^([A-Za-z]{1,3})(?::([A-Za-z]{1,3}))?$/.exec(tok);
      if (!m) return null;
      const a = SH.colIndex(m[1]), b = m[2] ? SH.colIndex(m[2]) : a;
      for (let c = Math.min(a, b); c <= Math.max(a, b); c++) { if (c > 51) return null; out.add(c); }
    }
    return out.size ? Array.from(out).sort((a, b) => a - b).slice(0, 12) : null;
  }

  function buildEdit() {
    const ch = cur();
    if (!ch) { editBody.innerHTML = ''; return; }
    const info = GC.info(ch.gid), o = ch.opts, st = ch.style, GS = info.style, al = autoLabels(ch);
    const nC = Math.max(1, SH.usedBounds().C, ...ch.cols.map((c) => c + 1), ...ch.vcols.map((c) => c + 1));
    const colOptions = (none) => (none ? [[-1, none]] : []).concat(Array.from({ length: nC }, (_, c) => [c, colOpt(c)]));
    let h = '';

    /* Data */
    const df = [];
    if (info.wide) df.push(fld('Format data', selH('mode', ch.mode, [['wide', 'Per variabel (kolom = variabel)'], ['long', 'Per kelompok (label + nilai)']])));
    if (ch.mode === 'wide') df.push(fld('Kolom variabel', inH('vcols', specOf(ch.vcols), 'mis. B:D atau A,C')));
    else rolesOf(ch.gid, 'long').forEach((r, j) => df.push(fld(esc(r.l), selH('map:' + j, ch.cols[j], colOptions(info.columns[j].optional ? (r.none || '(tidak ada)') : null)))));
    df.push(fld('Dari baris', inH('r1', ch.r1, 'otomatis')));
    df.push(fld('Sampai baris', inH('r2', ch.r2, 'otomatis')));
    h += grp('Data', grid(df, df.length > 4 ? 3 : 2) + rbH('usesel', 'sel', 'Pakai seleksi', 'Ambil kolom & baris dari sel yang sedang dipilih di lembar kerja'));

    /* Teks */
    const tf = [fld('Judul grafik', inH('opt:title', o.title, info.title))];
    const dX = info.opts.find((d) => d.key === 'xLabel'), dY = info.opts.find((d) => d.key === 'yLabel');
    if (dX) tf.push(fld('Label sumbu X', inH('opt:xLabel', o.xLabel, al.x || dX.placeholder)));
    if (dY) tf.push(fld('Label sumbu Y', inH('opt:yLabel', o.yLabel, al.y || dY.placeholder)));
    h += grp('Teks', grid(tf, tf.length > 2 ? 2 : 1));

    /* Opsi grafik */
    const others = info.opts.filter((d) => ['title', 'xLabel', 'yLabel'].indexOf(d.key) < 0);
    if (others.length) {
      const of = others.map((d) => {
        const k = 'opt:' + d.key;
        if (d.type === 'checkbox') return chkH(k, o[d.key], d.label);
        if (d.type === 'select') return fld(esc(d.label), selH(k, o[d.key], d.choices));
        return fld(esc(d.label), inH(k, o[d.key], d.placeholder || ''));
      });
      h += grp('Opsi grafik', grid(of, Math.min(2, of.length)));
    }

    /* Warna */
    const cf = [];
    if (GS.c1) cf.push(colH('st:c1', st.c1, GS.c1));
    if (GS.c2) cf.push(colH('st:c2', st.c2, GS.c2));
    if (GS.pal) cf.push(fld('Palet warna', selH('st:pal', st.pal, Object.keys(GC.PALETTES).map((k) => [k, GC.PALETTE_LABEL[k]]))));
    cf.push(colH('st:bg', st.bg, 'Warna latar'));
    h += grp('Warna', grid(cf, cf.length > 2 ? 2 : cf.length));

    /* Garis kisi */
    if (GS.grid) h += grp('Garis kisi', grid([chkH('st:h', st.h, 'Garis horizontal'), chkH('st:v', st.v, 'Garis vertikal'), colH('st:gc', st.gc, 'Warna garis kisi')], 2));

    /* Tampilan */
    const pf = [fld('Tampilkan grafik', selH('place', ch.place, [['above', 'Di atas lembar kerja'], ['below', 'Di bawah lembar kerja']]))];
    if (ch.place === 'above') pf.push(chkH('lock', ch.lock, 'Kunci rasio ukuran'));
    h += grp('Tampilan', grid(pf, 1));
    h += grp('Grafik', rbH('dup', 'copy', 'Duplikat', 'Gandakan grafik ini') + rbH('del', 'trash', 'Hapus', 'Hapus grafik ini', 'danger') + rbH('close', 'done', 'Selesai', 'Tutup tab Edit Grafik'));
    editBody.innerHTML = h;
  }

  let ptimer = 0;
  function refreshOne(ch) {
    clearTimeout(ptimer);
    ptimer = setTimeout(() => { compute(ch); paint(ch); }, 40);
  }
  function applyEdit(el) {
    const ch = cur(); if (!ch || !el.dataset || !el.dataset.k) return;
    const k = el.dataset.k, info = GC.info(ch.gid), val = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'mode') {
      ch.mode = val;
      const ctx = analyze();
      if (ctx) { const g = guess(ch.gid, ch.mode, ctx); if (g.cols) ch.cols = g.cols; if (g.vcols) ch.vcols = g.vcols; }
      compute(ch); paint(ch); buildEdit(); return;
    }
    if (k.indexOf('map:') === 0) ch.cols[+k.slice(4)] = +val;
    else if (k === 'vcols') {
      const v = parseSpec(val);
      el.classList.toggle('invalid', !v && String(val).trim() !== '');
      if (!v) return;
      ch.vcols = v;
    } else if (k === 'r1' || k === 'r2') {
      const t = String(val).trim(), n = t === '' ? null : Math.round(Number(t));
      el.classList.toggle('invalid', t !== '' && !(n >= 1));
      if (t !== '' && !(n >= 1)) return;
      ch[k] = n;
    } else if (k.indexOf('opt:') === 0) {
      const key = k.slice(4), d = info.opts.find((x) => x.key === key) || {};
      if (d.type === 'checkbox') ch.opts[key] = !!val;
      else if (d.type === 'number') { const n = GC.parseNum(String(val)); ch.opts[key] = Number.isFinite(n) ? n : null; }
      else ch.opts[key] = String(val).trim() === '' && d.type === 'text' ? '' : String(val);
      if (d.type === 'select' && d.gridDef && d.gridDef[val]) {
        ch.style.h = !!d.gridDef[val].h; ch.style.v = !!d.gridDef[val].v;
        const eh = $('[data-k="st:h"]', editBody), ev = $('[data-k="st:v"]', editBody);
        if (eh) eh.checked = ch.style.h; if (ev) ev.checked = ch.style.v;
      }
    } else if (k.indexOf('st:') === 0) ch.style[k.slice(3)] = val;
    else if (k === 'lock') ch.lock = !!val;
    else if (k === 'place') {
      ch.place = val;
      if (val === 'above' && !ch.w) initGeom(ch);
      compute(ch); mountAll(ch); syncSelClass(); buildEdit();
      if (val === 'below') { const b = blockEl(ch); if (b && b.scrollIntoView) b.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      return;
    }
    refreshOne(ch);
  }
  editBody.addEventListener('input', (e) => applyEdit(e.target));
  editBody.addEventListener('change', (e) => applyEdit(e.target));
  editBody.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); const ch = cur(); if (!b || !ch) return;
    const a = b.dataset.act;
    if (a === 'del') removeChart(ch.uid);
    else if (a === 'close') deselect();
    else if (a === 'dup') {
      const c2 = JSON.parse(JSON.stringify({ key: ch.key, gid: ch.gid, mode: ch.mode, label: ch.label, cols: ch.cols, vcols: ch.vcols, r1: ch.r1, r2: ch.r2, opts: ch.opts, style: ch.style, place: ch.place, lock: ch.lock, ratio: ch.ratio, w: ch.w, h: ch.h, x: ch.x + 28, y: ch.y + 28 }));
      c2.uid = 'g' + (++seq);
      charts.push(c2); compute(c2); if (c2.place === 'above') clampPos(c2);
      mountAll(c2); select(c2.uid, true);
    } else if (a === 'usesel') {
      const ctx = analyze(); if (!ctx) { msg('err', 'Lembar kerja masih kosong.', 5000); return; }
      const g = guess(ch.gid, ch.mode, ctx);
      if (!g.ok) { msg('err', 'Seleksi saat ini tidak memuat kolom yang cocok untuk grafik ini. Pilih sel yang berisi data lalu coba lagi.', 6000); return; }
      if (g.cols) ch.cols = g.cols; if (g.vcols) ch.vcols = g.vcols;
      ch.r1 = ctx.explicit ? ctx.r1 + 1 : null; ch.r2 = ctx.explicit ? ctx.r2 + 1 : null;
      compute(ch); paint(ch); buildEdit();
    }
  });

  /* ------------------------------- Buat grafik ------------------------------ */
  function defStyle(info) {
    const g = info.style.grid;
    return { c1: GC.PAL[0], c2: '#BD7E1F', pal: 'bawaan', bg: '#ffffff', h: !!(g && g.h), v: !!(g && g.v), gc: GC.GRID };
  }
  const curPlace = () => (($('#sgPlace', section) || {}).value === 'below' ? 'below' : 'above');

  /* Mengembalikan teks galat bila grafik gagal dibuat (grafik tidak ditambahkan) */
  function tryCreate(entry, g, ctx) {
    const info = GC.info(entry.gid), mode = entry.mode === 'wide' ? 'wide' : 'long';
    const ch = {
      uid: 'g' + (++seq), key: entry.key, gid: entry.gid, mode, label: entry.label,
      cols: g.cols || info.columns.map(() => -1), vcols: g.vcols || [],
      r1: ctx.explicit ? ctx.r1 + 1 : null, r2: ctx.explicit ? ctx.r2 + 1 : null,
      opts: GC.defaults(entry.gid), style: defStyle(info), place: curPlace(), lock: true,
      x: 0, y: 0, w: 0, h: 0, ratio: 1.6,
    };
    compute(ch);
    if (ch._err) return ch._err;
    charts.push(ch);
    mountAll(ch);
    select(ch.uid, true);
    if (ch.place === 'below') { const b = blockEl(ch); if (b && b.scrollIntoView) b.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    return '';
  }

  function insert(entry) {
    const ctx = analyze();
    if (!ctx) { msg('err', 'Lembar kerja masih kosong. Isi atau impor data terlebih dahulu, lalu pilih grafik.', 6000); return; }
    if (!ctx.cols.some((c) => c.numeric)) { msg('err', 'Tidak ditemukan kolom angka pada data / seleksi. Grafik membutuhkan minimal satu kolom angka.', 6000); return; }
    const mode = entry.mode === 'wide' ? 'wide' : 'long', g = guess(entry.gid, mode, ctx);
    if (mode === 'long' && (entry.dialog || !g.ok)) { openDialog(entry, g, ctx); return; }
    const err = tryCreate(entry, g, ctx);
    if (err) msg('err', err, 8000);
  }

  /* Dialog: tentukan kolom label / nilai sebelum grafik dibuat */
  function openDialog(entry, g, ctx) {
    if ($('.sg-modal')) return;
    const info = GC.info(entry.gid), roles = rolesOf(entry.gid, 'long'), ub = SH.usedBounds();
    const nC = Math.max(1, ub.C);
    const opts = (none) => (none ? '<option value="-1">' + esc(none) + '</option>' : '') + Array.from({ length: nC }, (_, c) => `<option value="${c}">${esc(colOpt(c))}</option>`).join('');
    const ov = document.createElement('div');
    ov.className = 'sg-modal';
    ov.innerHTML = `<div class="sg-dlg" role="dialog" aria-modal="true" aria-labelledby="sgDlgT">
      <h3 id="sgDlgT">Atur data: ${esc(entry.label)}</h3>
      <p class="sg-dlg-why">${esc(entry.why || 'Tentukan kolom data yang dipakai grafik ini.')}</p>
      ${roles.map((r, j) => `<div class="sg-dlg-f"><label for="sgDlg${j}">${esc(r.l)} <small>&mdash; ${esc(r.hint)}</small></label><select class="select-input" id="sgDlg${j}">${opts(info.columns[j].optional ? (r.none || '(tidak ada)') : null)}</select></div>`).join('')}
      <div class="sg-dlg-prev" id="sgDlgPrev"></div>
      <p class="sg-dlg-info">Baris data: ${ctx.r1 + 1}&ndash;${ctx.r2 + 1} (${ctx.explicit ? 'dari seleksi' : 'seluruh tabel'}${S.header ? '; baris 1 dianggap judul kolom' : ''}). Bisa diubah nanti di tab Edit Grafik.</p>
      <p class="sg-dlg-err" id="sgDlgErr" hidden></p>
      <div class="sg-dlg-btns"><button type="button" class="btn-ghost" id="sgDlgNo">Batal</button><button type="button" class="btn-primary" id="sgDlgOk">Buat grafik</button></div>
    </div>`;
    document.body.appendChild(ov);
    const sels = roles.map((_, j) => $('#sgDlg' + j, ov)), errEl = $('#sgDlgErr', ov), prev = $('#sgDlgPrev', ov);
    // peran wajib yang tidak berhasil ditebak diberi kolom bebas pertama (bukan kolom A secara diam-diam)
    const start = (g.cols || []).slice();
    roles.forEach((_, j) => {
      if (start[j] >= 0 || info.columns[j].optional) return;
      let c = 0; while (c < nC - 1 && start.indexOf(c) >= 0) c++;
      start[j] = c;
    });
    sels.forEach((s, j) => { s.value = String(start[j] === undefined ? -1 : start[j]); });
    const picked = () => sels.map((s) => +s.value);
    const showPrev = () => {
      const r = ctx.r1, cells = picked().map((c) => (c < 0 ? '\u2014' : SH.display(SH.cellVal(r, c)) || '(kosong)'));
      prev.textContent = 'Contoh baris ' + (r + 1) + ': ' + roles.map((x, j) => x.l + ' = ' + cells[j]).join('  |  ');
    };
    sels.forEach((s) => s.addEventListener('change', () => { errEl.hidden = true; showPrev(); }));
    showPrev();
    const close = () => { document.removeEventListener('keydown', onKey, true); ov.remove(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    $('#sgDlgNo', ov).addEventListener('click', close);
    $('#sgDlgOk', ov).addEventListener('click', () => {
      const cols = picked(), real = cols.filter((c) => c >= 0);
      const fail = (t) => { errEl.textContent = t; errEl.hidden = false; };
      if (info.columns.some((d, j) => !d.optional && cols[j] < 0)) return fail('Pilih kolom untuk semua peran yang wajib.');
      if (new Set(real).size !== real.length) return fail('Setiap peran harus memakai kolom yang berbeda.');
      const err = tryCreate(entry, { cols }, ctx);
      if (err) return fail(err);
      close();
    });
    sels[0].focus();
  }

  /* ------------------------------ Tab Grafik (ikon) ------------------------- */
  (function buildInsert() {
    const groups = [];
    CATALOG.forEach((e) => { let g = groups.find((x) => x.l === e.group); if (!g) { g = { l: e.group, items: [] }; groups.push(g); } g.items.push(e); });
    insertBody.innerHTML = groups.map((g) => `<div class="sc-grp"><div class="sc-gbody">${g.items.map((e) => `<button type="button" class="sc-rb" data-g="${e.key}" title="${esc(e.tip)}" aria-label="${esc(e.tip)}">${svgI(e.key)}<span>${esc(e.label)}</span></button>`).join('')}</div><div class="sc-glabel">${esc(g.l)}</div></div>`).join('') +
      `<div class="sc-grp"><div class="sc-gbody"><div class="sc-fld"><label for="sgPlace">Tampilkan grafik</label><select id="sgPlace" class="select-input" style="width:230px"><option value="above">Di atas lembar kerja</option><option value="below">Di bawah lembar kerja (bisa diunduh)</option></select></div></div><div class="sc-glabel">Tampilan</div></div>`;
    insertBody.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      const en = entryOf(b.dataset.g); if (en) insert(en);
    });
  })();

  /* ------------------- Sinkron dengan perubahan data / struktur -------------- */
  function refreshAll() {
    if (!charts.length) return;
    charts.forEach((ch) => { compute(ch); paint(ch); });
    if (selId && !(document.activeElement && editBody.contains(document.activeElement))) buildEdit();
  }
  let rt = 0;
  SH.onChange(() => { if (!charts.length) return; clearTimeout(rt); rt = setTimeout(refreshAll, 60); });
  SH.onStructure((axis, kind, at, n) => {
    if (axis === 'c') {
      const mv = (c) => (c < 0 ? c : kind === 'ins' ? (c >= at ? c + n : c) : (c >= at && c <= at + n - 1 ? -1 : (c > at + n - 1 ? c - n : c)));
      charts.forEach((ch) => { ch.cols = ch.cols.map(mv); ch.vcols = ch.vcols.map(mv).filter((c) => c >= 0); });
    } else {
      const end = at + n - 1;
      const mvr = (r, isEnd) => {   // r = nomor baris (1-based) atau null
        if (!r) return r;
        const i = r - 1;
        if (kind === 'ins') return i >= at ? r + n : r;
        if (i > end) return r - n;
        if (i >= at) return isEnd ? (at >= 1 ? at : null) : at + 1;
        return r;
      };
      charts.forEach((ch) => { ch.r1 = mvr(ch.r1, false); ch.r2 = mvr(ch.r2, true); if (ch.r1 && ch.r2 && ch.r1 > ch.r2) { ch.r1 = null; ch.r2 = null; } });
    }
  });
})();
