/* =========================================================================
   IKON-TOMBOL.JS - Ikon SVG & gaya tombol "hanya ikon" yang dipakai bersama
   -------------------------------------------------------------------------
   StatIcon(nama)  -> string <svg> (png, svg, copy, docx, share, zip, up, down, edit, del)
   Tombol ikon: <button class="btn-ghost ib" title="Keterangan" aria-label="Keterangan">ikon</button>
   Keterangan muncul sebagai tooltip bila kursor ditahan di atas tombol.
   Baris tombol ikon: <div class="ib-row">...</div> (satu baris, tombol berbagi lebar).
   Dimuat SEBELUM Method/Calc/sheet-graph.js dan Method/Shared/export-hasil.js.
   ========================================================================= */
(function () {
  'use strict';
  var P = {
    png: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    svg: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    docx: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
    zip: '<rect x="3.5" y="4" width="17" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M12 11v5M9.5 13.5L12 16l2.5-2.5"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14.5 7.5l3 3"/>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'
  };
  window.StatIcon = function (n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>'; };
  /* HTML satu tombol ikon; extra = atribut tambahan (mis. data-ex="png") */
  window.StatIconBtn = function (n, label, extra, cls) {
    var l = String(label).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '<button type="button" class="' + (cls || 'btn-ghost') + ' ib" title="' + l + '" aria-label="' + l + '"' + (extra ? ' ' + extra : '') + '>' + window.StatIcon(n) + '</button>';
  };
  var st = document.createElement('style');
  st.textContent =
    '.ib{display:inline-flex !important;align-items:center;justify-content:center;flex:1 1 0 !important;width:auto !important;min-width:44px;max-width:120px;padding-left:0 !important;padding-right:0 !important;min-height:44px !important;padding:0 !important;}' +
    '.ib svg{width:21px;height:21px;flex:0 0 auto;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}' +
    '.ib:disabled{opacity:.45;cursor:not-allowed;}' +
    '.ib-row,.ib-row.control-row{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;gap:8px;align-items:stretch;}';
  document.head.appendChild(st);
})();
