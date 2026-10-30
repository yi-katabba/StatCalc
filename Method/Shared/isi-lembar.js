/* =========================================================================
   ISI DARI LEMBAR (Method/Shared/isi-lembar.js)
   -------------------------------------------------------------------------
   Di tiap halaman metode Stat dan Graph, tombol "Isi contoh data" kini ditemani
   tombol "Isi dari Dataset". Tombol ini memuat data Dataset ke tabel input
   halaman itu (tanpa menghitung dan tanpa pindah halaman). Bila Dataset kosong,
   muncul peringatan di kartu data dan sebagai toast.
   Peran X / Y dari panel Variabel Dataset ikut dipakai (Regresi, RSM, Scatter).
   Dimuat SETELAH Method/Calc/sheet.js, Method/Shared/impor-data.js, dan semua
   modul metode / grafik (tombol dicari di kartu data yang sudah terdaftar).
   ========================================================================= */
(function () {
  'use strict';
  var IMP = window.StatCalcImport, SH = window.StatCalcSheet;
  if (!IMP || !IMP.cards || !SH || !SH.api || !SH.api.fillFromSheet) return;
  var EMPTY = 'Dataset masih kosong. Isi atau impor data di Dataset terlebih dahulu, lalu coba lagi.';
  function toast(m) { if (window.StatCalc && window.StatCalc.showToast) window.StatCalc.showToast(m); }

  /* ---- Satu baris ubin ikon berwarna: Tempel dari Excel, Unggah file, Isi contoh data, Isi dari Dataset ----
     Ilustrasi SVG memakai warna datar (tanpa gradien/id) agar tampil benar walau halaman sedang tersembunyi. */
  function star(cx, cy, r, fill) {
    var k = r * 0.3, f = function (n) { return n.toFixed(1); };
    return '<path fill="' + fill + '" d="M' + f(cx) + ' ' + f(cy - r) + 'L' + f(cx + k) + ' ' + f(cy - k) + 'L' + f(cx + r) + ' ' + f(cy) + 'L' + f(cx + k) + ' ' + f(cy + k) + 'L' + f(cx) + ' ' + f(cy + r) + 'L' + f(cx - k) + ' ' + f(cy + k) + 'L' + f(cx - r) + ' ' + f(cy) + 'L' + f(cx - k) + ' ' + f(cy - k) + 'Z"/>';
  }
  var ART = {
    paste:
      '<rect x="31" y="24" width="24" height="31" rx="3" fill="#fff" stroke="#8CCFA8" stroke-width="2"/>' +
      '<path d="M37 33h12M37 38.5h12M37 44h8" stroke="#BFE3CD" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
      '<rect x="7" y="13" width="35" height="44" rx="5" fill="#EAF8F0" stroke="#1B7A46" stroke-width="3"/>' +
      '<rect x="16" y="7" width="17" height="10" rx="3.2" fill="#1B7A46"/><circle cx="24.5" cy="12" r="1.7" fill="#EAF8F0"/>' +
      '<rect x="13" y="27" width="23" height="23" rx="3.4" fill="#1D8F52"/>' +
      '<path d="M19.5 33l11 11M30.5 33l-11 11" stroke="#fff" stroke-width="3.4" stroke-linecap="round" fill="none"/>' +
      '<path d="M50 14l3.4-3.4M54 21l4.4-1.2M46.5 8.5l1-4.4" stroke="#1B7A46" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
    upload:
      '<path d="M16 5h22l13 13v36a3.5 3.5 0 0 1-3.5 3.5h-31.5A3.5 3.5 0 0 1 12.5 54V8.5A3.5 3.5 0 0 1 16 5z" fill="#fff" stroke="#3B8BEB" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M38 5v13h13" fill="#CFE4FB" stroke="#3B8BEB" stroke-width="3" stroke-linejoin="round"/>' +
      '<rect x="7" y="26" width="35" height="14" rx="2.6" fill="#1E9A57"/>' +
      '<text x="24.5" y="36.4" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="10" fill="#fff">XLSX</text>' +
      '<rect x="14" y="43" width="21" height="10" rx="2.2" fill="#5B86BD"/>' +
      '<text x="24.5" y="50.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="7.6" fill="#fff">CSV</text>' +
      '<circle cx="46" cy="46" r="11.5" fill="#2F86F0" stroke="#fff" stroke-width="2.6"/>' +
      '<path d="M46 52V40.5M40.6 45.8L46 40.4l5.4 5.4" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    sample:
      '<rect x="8" y="14" width="38" height="37" rx="4.5" fill="#FFF8EC" stroke="#E58A1F" stroke-width="2.8"/>' +
      '<path d="M8 18.5A4.5 4.5 0 0 1 12.5 14h29A4.5 4.5 0 0 1 46 18.5V25H8z" fill="#F29A2E"/>' +
      '<path d="M8 25h38M8 34.5h38M8 44h38M20.7 25v26M33.3 25v26" stroke="#E58A1F" stroke-width="2" fill="none"/>' +
      '<path d="M27 56.5L44 39.5" stroke="#7A4527" stroke-width="5.4" stroke-linecap="round" fill="none"/>' +
      '<path d="M41.6 41.9l2.4-2.4" stroke="#F6E6C6" stroke-width="5.4" stroke-linecap="round" fill="none"/>' +
      star(52, 22, 8, '#FFC83D') + star(57.5, 36, 4.6, '#FFC83D') + star(45, 29, 3.4, '#FFD971'),
    sheet:
      '<path class="c-d" d="M10 16v27c0 4.6 8 8.4 18 8.4s18-3.8 18-8.4V16z"/>' +
      '<path class="c-c" d="M10 16v9c0 4.6 8 8.4 18 8.4s18-3.8 18-8.4v-9z"/>' +
      '<path d="M10 26c0 4.6 8 8.4 18 8.4s18-3.8 18-8.4M10 35.5c0 4.6 8 8.4 18 8.4s18-3.8 18-8.4" class="c-line" stroke-width="1.8" fill="none"/>' +
      '<ellipse class="c-a" cx="28" cy="16" rx="18" ry="8"/>' +
      '<circle class="c-badge" cx="46" cy="46" r="11.5" stroke="#fff" stroke-width="2.6"/>' +
      '<path d="M46 40v11.5M40.6 46.2L46 51.6l5.4-5.4" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  };
  var TONE = { paste: 'imp-t-green', upload: 'imp-t-blue', sample: 'imp-t-orange', sheet: 'imp-t-purple' };
  function ico(name) { return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + ART[name] + '</svg>'; }
  /* label = teks tombol (jadi tooltip + aria-label, tidak ditampilkan); badge = lencana kecil di atas ubin (mis. ARIMA) */
  function setBtn(btn, name, label, badge) {
    btn.innerHTML = ico(name) + (badge ? '<i class="imp-badge">' + badge + '</i>' : '') + '<span class="imp-cap">' + label + '</span>';
    btn.classList.remove('btn-ghost');
    btn.classList.add('imp-ib', 'imp-tile', TONE[name]);
    if (badge) btn.classList.add('has-badge');
  }
  var st = document.createElement('style');
  st.textContent =
    '.imp-bar{display:flex !important;flex-wrap:wrap;align-items:stretch;gap:10px;}' +
    '.imp-bar .imp-label{flex:1 0 100%;}' +
    '.imp-bar .imp-tile{position:relative;display:flex;align-items:center;justify-content:center;flex:1 1 0;width:auto;min-width:44px;max-width:66px;aspect-ratio:1/1;padding:4px;margin:0;container-type:inline-size;' +
      'border:2px solid var(--tb);border-radius:15px;background:linear-gradient(160deg,var(--t1),var(--t2));box-shadow:0 2px 7px rgba(30,40,60,.10);cursor:pointer;color:inherit;' +
      'transition:transform .12s ease,box-shadow .12s ease,filter .12s ease;}' +
    '.imp-bar .imp-tile:hover{transform:translateY(-2px);box-shadow:0 6px 14px rgba(30,40,60,.18);filter:saturate(1.08);}' +
    '.imp-bar .imp-tile:active{transform:translateY(0);box-shadow:0 1px 4px rgba(30,40,60,.18);}' +
    '.imp-bar .imp-tile:focus-visible{outline:3px solid var(--accent-2,#2F7F79);outline-offset:2px;}' +
    '.imp-bar .imp-tile svg{width:68%;height:auto;max-height:100%;flex:0 0 auto;display:block;pointer-events:none;overflow:visible;}' +
    '.imp-bar .imp-tile.has-badge svg{width:54%;margin-top:22%;}' +
    '.imp-bar .imp-tile .imp-cap{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}' +
    '.imp-bar .imp-badge{position:absolute;top:7%;left:50%;transform:translateX(-50%);font-style:normal;font-weight:800;font-size:15cqw;letter-spacing:.01em;line-height:1;color:#fff;background:#F08A1E;padding:.32em .6em;border-radius:999px;box-shadow:0 1px 2px rgba(0,0,0,.18);pointer-events:none;white-space:nowrap;}' +
    '.imp-t-green{--t1:#E6F9EE;--t2:#BDEBD3;--tb:#7FD3A6;}' +
    '.imp-t-blue{--t1:#E5F2FF;--t2:#BCDCFF;--tb:#7DB6F5;}' +
    '.imp-t-orange{--t1:#FFF2DE;--t2:#FFDBA9;--tb:#F5B35C;}' +
    '.imp-t-purple{--t1:#F0EAFF;--t2:#D4C8FF;--tb:#B3A0F5;--ca:#B3A6F5;--cb:#7D70DD;--cc:#6A5DD0;--cd:#5649B8;--cl:#C9C0FA;--cbd:#7A57D6;}' +
    '.imp-bar[data-n="5"] .imp-t-purple{--t1:#E5F2FF;--t2:#BCDCFF;--tb:#7DB6F5;--ca:#8EC3FA;--cb:#4C93EC;--cc:#3B82E0;--cd:#2C6CC4;--cl:#A9D1FB;--cbd:#2F6FE0;}' +
    '.imp-tile .c-a{fill:var(--ca)}.imp-tile .c-b{fill:var(--cb)}.imp-tile .c-c{fill:var(--cb)}.imp-tile .c-d{fill:var(--cd)}.imp-tile .c-line{stroke:var(--cl)}.imp-tile .c-badge{fill:var(--cbd)}' +
    '@media (max-width:520px){.imp-bar{gap:7px;}.imp-bar .imp-tile{min-width:40px;border-radius:13px;padding:4px;}}';
  document.head.appendChild(st);
  function barUp(card, samples, fillBtn) {
    var bar = card.querySelector('.imp-bar'); if (!bar) return;
    var paste = bar.querySelector('[data-act="paste"]'), file = bar.querySelector('[data-act="file"]');
    if (paste) { setBtn(paste, 'paste', 'Tempel dari Excel'); paste.title = 'Tempel blok sel dari Excel'; }
    if (file) { setBtn(file, 'upload', 'Unggah file'); file.title = 'Unggah file .xlsx atau .csv'; }
    var holders = [];
    samples.forEach(function (sb) {
      var txt = sb.textContent.trim(), badge = '', rest = txt.replace(/^Isi contoh data\s*/i, ''), m = rest.match(/^\((.*)\)\s*$/);
      if (m) sb.title = txt;                                  /* "(CCD kimia: degradasi)" -> hanya tooltip */
      else if (rest && rest.length <= 8) badge = rest;        /* "ARIMA" / "SARIMA" -> lencana di ubin */
      holders.push(sb.parentNode);
      setBtn(sb, 'sample', 'Isi contoh data' + (badge ? ' ' + badge : ''), badge); bar.appendChild(sb);
      if (!sb.title) sb.title = txt;
    });
    setBtn(fillBtn, 'sheet', 'Isi dari Dataset'); holders.push(fillBtn.parentNode); bar.appendChild(fillBtn);
    var all = bar.querySelectorAll('.imp-ib');
    bar.setAttribute('data-n', String(all.length));
    Array.prototype.forEach.call(all, function (x) {
      var lab = x.querySelector('.imp-cap').textContent;
      if (!x.title) x.title = lab;
      else if (x.title.indexOf(lab) !== 0 && x.title !== lab) x.title = lab + ' \u2013 ' + x.title;
      x.setAttribute('aria-label', lab);
    });
    holders.forEach(function (h) { if (h && h !== bar && h.classList && h.classList.contains('btn-grid') && !h.children.length) h.remove(); });
  }

  IMP.cards().forEach(function (sel) {
    var card = document.querySelector(sel);
    if (!card || card.querySelector('[data-sheet-fill]')) return;
    var samples = Array.prototype.slice.call(card.querySelectorAll('button')).filter(function (b) { return /^\s*Isi contoh data/i.test(b.textContent); });
    if (!samples.length) return;
    var last = samples[samples.length - 1];
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-ghost'; b.setAttribute('data-sheet-fill', '1');
    b.textContent = 'Isi dari Dataset';
    b.title = 'Muat data dari Dataset ke tabel ini';
    last.parentNode.insertBefore(b, last.nextSibling);
    barUp(card, samples, b);
    b.addEventListener('click', function () {
      var view = card.closest('.view'), id = view ? view.id.replace(/^view-/, '') : '';
      if (!SH.api.hasData()) { IMP.notify(sel, 'err', EMPTY); toast('Dataset masih kosong.'); return; }
      if (SH.api.fillFromSheet(id, sel)) toast('Data dari Dataset dimuat ke tabel.');
    });
  });
})();
