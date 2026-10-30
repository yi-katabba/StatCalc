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
  /* ---- Ubin ikon berwarna (png, svg, salin gambar, docx, bagikan, zip): ilustrasi SVG warna datar, tanpa gradien/id ---- */
  var TILE_ARROW = '<path d="M45 39.5v9.5M40.8 45l4.2 4.2 4.2-4.2M40 53h10" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  var TILE = {
    png: ['ib-t-blue',
      '<path d="M18 7h19l11 11v26a4.5 4.5 0 0 1-4.5 4.5h-25.5A4.5 4.5 0 0 1 13 44V11.5A4.5 4.5 0 0 1 18 7z" fill="#EEF5FE" stroke="#1665DD" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M37 7v7.5a3.5 3.5 0 0 0 3.5 3.5H48z" fill="#1665DD"/>' +
      '<circle cx="31" cy="24" r="3.2" fill="#2F86F0"/>' +
      '<path d="M17 43l9.5-12.5L34 40l4-4.5 3 3.5V44a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 17 44z" fill="#2F86F0"/>' +
      '<circle cx="45" cy="46" r="12" fill="#1F78F0" stroke="#EEF5FE" stroke-width="2.8"/>' + TILE_ARROW],
    svg: ['ib-t-green',
      '<path d="M18 7h19l11 11v26a4.5 4.5 0 0 1-4.5 4.5h-25.5A4.5 4.5 0 0 1 13 44V11.5A4.5 4.5 0 0 1 18 7z" fill="#EAFBF0" stroke="#22B45F" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M37 7v7.5a3.5 3.5 0 0 0 3.5 3.5H48z" fill="#22B45F"/>' +
      '<rect x="6" y="25" width="34" height="14" rx="3.4" fill="#17A354"/>' +
      '<text x="23" y="36" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="11.5" fill="#fff">SVG</text>' +
      '<circle cx="46" cy="47" r="12" fill="#17A354" stroke="#E4FAEB" stroke-width="2.8"/>' +
      '<path d="M46 40.5v9.5M41.8 46l4.2 4.2 4.2-4.2M41 54h10" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'],
    copy: ['ib-t-purple',
      '<rect x="8" y="9" width="32" height="32" rx="4.5" fill="#8A62EE" transform="rotate(-9 24 25)"/>' +
      '<rect x="14" y="13" width="34" height="34" rx="4.5" fill="#F1EBFF" stroke="#A98BF5" stroke-width="3"/>' +
      '<circle cx="39" cy="22" r="3" fill="#8A62EE"/>' +
      '<path d="M18 43l8.5-11 6 7 3.5-4 6 8z" fill="#7144E0"/>' +
      '<circle cx="46" cy="46" r="12" fill="#7144E0" stroke="#F1EBFF" stroke-width="2.8"/>' +
      '<rect x="45" y="44" width="7.5" height="9" rx="1.6" fill="none" stroke="#fff" stroke-width="2.4"/>' +
      '<path d="M43 50.5h-.6a1.6 1.6 0 0 1-1.6-1.6v-6.6a1.6 1.6 0 0 1 1.6-1.6h5.6a1.6 1.6 0 0 1 1.6 1.6v.4" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>'],
    docx: ['ib-t-blue',
      '<rect x="13" y="7" width="34" height="46" rx="4.5" fill="#EEF5FE" stroke="#69AEF5" stroke-width="3"/>' +
      '<path d="M33 7h3l11 11v3a2 2 0 0 1-2 2H35a2 2 0 0 1-2-2z" fill="#2F86F0"/>' +
      '<path d="M26 29h16M26 35h16M26 41h9" stroke="#B5D6FA" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<rect x="5" y="25" width="25" height="25" rx="3.6" fill="#1665DD"/>' +
      '<text x="17.5" y="44.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="18" fill="#fff">W</text>' +
      '<circle cx="45" cy="46" r="12" fill="#1F78F0" stroke="#EEF5FE" stroke-width="2.8"/>' + TILE_ARROW +
      '<path d="M51 10l1.4-4.2M56 15l4.2-2.6M58 22.5h4.4" stroke="#2F86F0" stroke-width="2.4" stroke-linecap="round" fill="none"/>'],
    share: ['ib-t-green',
      '<path d="M15 30L43 14M15 30l21 16" stroke="#22B45F" stroke-width="5.4" stroke-linecap="round" fill="none"/>' +
      '<circle cx="43" cy="14" r="9.5" fill="#2DC468"/><circle cx="15" cy="30" r="9.5" fill="#26BB62"/><circle cx="36" cy="46" r="8.5" fill="#1CA654"/>' +
      '<circle cx="47" cy="47" r="12" fill="#17A354" stroke="#E4FAEB" stroke-width="2.8"/>' +
      '<path d="M41 47.5v4.6a1.6 1.6 0 0 0 1.6 1.6h8.8a1.6 1.6 0 0 0 1.6-1.6v-4.6M47 49.5V39.6M42.9 43.6l4.1-4.1 4.1 4.1" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '<path d="M50 24l1.4-4.2M55.5 29.5l4.2-2.8" stroke="#22B45F" stroke-width="2.4" stroke-linecap="round" fill="none"/>'],
    zip: ['ib-t-purple',
      '<path d="M18 8h23l11 11v31a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z" fill="#8A62EE"/>' +
      '<path d="M32 8h9l11 11v31a5 5 0 0 1-5 5H32z" fill="#6D45DE" opacity=".55"/>' +
      '<path d="M41 8l11 11H44a3 3 0 0 1-3-3z" fill="#5A32CE"/>' +
      '<g fill="#fff"><rect x="24.5" y="9" width="6" height="3.6" rx="1.6"/><rect x="29.5" y="14" width="6" height="3.6" rx="1.6"/><rect x="24.5" y="19" width="6" height="3.6" rx="1.6"/><rect x="29.5" y="24" width="6" height="3.6" rx="1.6"/><rect x="24.5" y="29" width="6" height="3.6" rx="1.6"/></g>' +
      '<path d="M25 36h10l1.4 13a6.4 6.4 0 0 1-12.8 0z" fill="#F1EBFF"/><circle cx="30" cy="46" r="2.6" fill="#7A52E6"/>' +
      '<circle cx="45" cy="46" r="12" fill="#7144E0" stroke="#F1EBFF" stroke-width="2.8"/>' + TILE_ARROW +
      '<path d="M52 12l1.4-4.2M57 17l4.2-2.6M59 24.5h4.4" stroke="#7A52E6" stroke-width="2.4" stroke-linecap="round" fill="none"/>']
  };
  /* HTML satu tombol ikon; extra = atribut tambahan (mis. data-ex="png"). docx / share / zip tampil sebagai ubin berwarna. */
  window.StatIconBtn = function (n, label, extra, cls) {
    var l = String(label).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    if (TILE[n]) return '<button type="button" class="ib ib-tile ' + TILE[n][0] + '" title="' + l + '" aria-label="' + l + '"' + (extra ? ' ' + extra : '') + '><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + TILE[n][1] + '</svg></button>';
    return '<button type="button" class="' + (cls || 'btn-ghost') + ' ib" title="' + l + '" aria-label="' + l + '"' + (extra ? ' ' + extra : '') + '>' + window.StatIcon(n) + '</button>';
  };
  var st = document.createElement('style');
  st.textContent =
    '.ib{display:inline-flex !important;align-items:center;justify-content:center;flex:1 1 0 !important;width:auto !important;min-width:44px;max-width:120px;padding-left:0 !important;padding-right:0 !important;min-height:44px !important;padding:0 !important;}' +
    '.ib svg{width:21px;height:21px;flex:0 0 auto;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}' +
    '.ib:disabled{opacity:.45;cursor:not-allowed;}' +
    '.ib.ib-tile{width:76px !important;max-width:none !important;min-width:0 !important;height:auto !important;min-height:0 !important;aspect-ratio:1/1.1;padding:2px !important;flex:0 0 auto !important;border:2px solid var(--tb) !important;border-radius:16px !important;background:linear-gradient(160deg,var(--t1),var(--t2)) !important;box-shadow:0 2px 7px rgba(30,40,60,.10);color:inherit;transition:transform .12s ease,box-shadow .12s ease,filter .12s ease;}' +
    '.ib.ib-tile svg{width:96%;max-width:none;flex:0 0 auto;height:auto;stroke:none;fill:none;stroke-width:0;overflow:visible;}' +
    '.ib.ib-tile:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 14px rgba(30,40,60,.18);filter:saturate(1.08);}' +
    '.ib.ib-tile:active:not(:disabled){transform:none;box-shadow:0 1px 4px rgba(30,40,60,.18);}' +
    '.ib.ib-tile:focus-visible{outline:3px solid var(--accent-2,#2F7F79);outline-offset:2px;}' +
    '.ib-t-blue{--t1:#E5F1FE;--t2:#BEDBFB;--tb:#7DB6F5;}.ib-t-green{--t1:#E4FAEB;--t2:#BFF3D2;--tb:#85DDA9;}.ib-t-purple{--t1:#F1EBFF;--t2:#D8CCFF;--tb:#B3A0F5;}' +
    '.ib-row.ex-main-btns .ib.ib-tile{width:76px !important;}.ib-row.ex-bar-btns .ib.ib-tile{width:54px !important;padding:4px !important;border-radius:13px !important;}' +
    '.sg-bbtns .ib.ib-tile{width:52px !important;padding:3px !important;border-radius:13px !important;}.sg-bbtns{align-items:center;}' +
    '.ib-row,.ib-row.control-row{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;gap:8px;align-items:stretch;}';
  document.head.appendChild(st);
})();
