/* =========================================================================
   ISI DARI LEMBAR (Method/Shared/isi-lembar.js)
   -------------------------------------------------------------------------
   Di tiap halaman metode Stat dan Graph, tombol "Isi contoh data" kini ditemani
   tombol "Isi dari Lembar". Tombol ini memuat data Lembar kerja ke tabel input
   halaman itu (tanpa menghitung dan tanpa pindah halaman). Bila Lembar kosong,
   muncul peringatan di kartu data dan sebagai toast.
   Peran X / Y dari panel Variabel Lembar ikut dipakai (Regresi, RSM, Scatter).
   Dimuat SETELAH Method/Calc/sheet.js, Method/Shared/impor-data.js, dan semua
   modul metode / grafik (tombol dicari di kartu data yang sudah terdaftar).
   ========================================================================= */
(function () {
  'use strict';
  var IMP = window.StatCalcImport, SH = window.StatCalcSheet;
  if (!IMP || !IMP.cards || !SH || !SH.api || !SH.api.fillFromSheet) return;
  var EMPTY = 'Lembar kerja masih kosong. Isi atau impor data di Lembar terlebih dahulu, lalu coba lagi.';
  function toast(m) { if (window.StatCalc && window.StatCalc.showToast) window.StatCalc.showToast(m); }

  /* ---- Satu baris tombol ikon: Tempel dari Excel, Unggah file, Isi contoh data, Isi dari Lembar ---- */
  var ICON = {
    paste: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M8 12h8M8 16h8"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    sample: '<path d="M11 3l1.8 4.7 4.7 1.8-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>',
    sheet: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M10 10v9.5"/>'
  };
  function ico(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + '</svg>'; }
  function setBtn(btn, name, label, cls) {
    btn.innerHTML = ico(name) + '<span>' + label + '</span>';
    btn.classList.add('imp-ib'); if (cls) btn.classList.add(cls);
  }
  var st = document.createElement('style');
  st.textContent =
    '.imp-bar{display:flex !important;flex-wrap:wrap;align-items:stretch;gap:10px;}' +
    '.imp-bar .imp-label{flex:1 0 100%;}' +
    '.imp-bar .imp-ib{display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:1 1 150px;width:auto;min-width:0;padding:0 8px;font-size:13.5px;white-space:nowrap;overflow:hidden;}' +
    '.imp-bar .imp-ib span{min-width:0;overflow:hidden;text-overflow:ellipsis;}' +
    '.imp-bar .imp-ib svg{width:20px;height:20px;flex:0 0 auto;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;}' +
    '.imp-bar .imp-ib.imp-green{color:#1B7F46;border-color:#8FCBA6;background:#F0FAF3;}' +
    '.imp-bar .imp-ib.imp-green:hover{background:#DFF4E6;border-color:#1B7F46;}' +
    /* makin sempit bilah, makin ringkas: hanya ikon (keterangan muncul sebagai tooltip bila kursor ditahan) */
    '.imp-bar{container-type:inline-size;}' +
    '@container (max-width:640px){.imp-bar .imp-ib{flex:1 1 0;min-width:44px;}.imp-bar .imp-ib span{display:none;}.imp-bar .imp-ib svg{width:22px;height:22px;}}' +
    '@container (max-width:780px){.imp-bar[data-n="5"] .imp-ib{flex:1 1 0;min-width:44px;}.imp-bar[data-n="5"] .imp-ib span{display:none;}.imp-bar[data-n="5"] .imp-ib svg{width:22px;height:22px;}}';
  document.head.appendChild(st);
  function barUp(card, samples, fillBtn) {
    var bar = card.querySelector('.imp-bar'); if (!bar) return;
    var paste = bar.querySelector('[data-act="paste"]'), file = bar.querySelector('[data-act="file"]');
    if (paste) { setBtn(paste, 'paste', 'Tempel dari Excel', 'imp-green'); paste.title = 'Tempel blok sel dari Excel'; }
    if (file) { setBtn(file, 'upload', 'Unggah file', 'imp-green'); file.title = 'Unggah file .xlsx, .csv'; }
    var holders = [];
    samples.forEach(function (sb) {
      var txt = sb.textContent.trim(), m = txt.match(/^(.*?)\s*\((.*)\)\s*$/);
      if (m) { sb.title = txt; txt = m[1]; }
      holders.push(sb.parentNode);
      setBtn(sb, 'sample', txt); bar.appendChild(sb);
    });
    setBtn(fillBtn, 'sheet', 'Isi dari Lembar'); holders.push(fillBtn.parentNode); bar.appendChild(fillBtn);
    var all = bar.querySelectorAll('.imp-ib');
    bar.setAttribute('data-n', String(all.length));
    Array.prototype.forEach.call(all, function (x) {
      var lab = x.querySelector('span').textContent;
      if (!x.title) x.title = lab;
      else if (x.title.indexOf(lab) !== 0) x.title = lab + ' \u2013 ' + x.title;
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
    b.textContent = 'Isi dari Lembar';
    b.title = 'Muat data dari Lembar kerja ke tabel ini';
    last.parentNode.insertBefore(b, last.nextSibling);
    barUp(card, samples, b);
    b.addEventListener('click', function () {
      var view = card.closest('.view'), id = view ? view.id.replace(/^view-/, '') : '';
      if (!SH.api.hasData()) { IMP.notify(sel, 'err', EMPTY); toast('Lembar kerja masih kosong.'); return; }
      if (SH.api.fillFromSheet(id, sel)) toast('Data dari Lembar dimuat ke tabel.');
    });
  });
})();
