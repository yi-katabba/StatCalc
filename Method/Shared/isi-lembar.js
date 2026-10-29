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
    b.addEventListener('click', function () {
      var view = card.closest('.view'), id = view ? view.id.replace(/^view-/, '') : '';
      if (!SH.api.hasData()) { IMP.notify(sel, 'err', EMPTY); toast('Lembar kerja masih kosong.'); return; }
      if (SH.api.fillFromSheet(id, sel)) toast('Data dari Lembar dimuat ke tabel.');
    });
  });
})();
