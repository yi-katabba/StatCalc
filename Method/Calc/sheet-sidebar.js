/* =========================================================================
   SHEET-SIDEBAR.JS - Panel samping Lembar Calc bisa diciutkan (minimize)
   -------------------------------------------------------------------------
   - Panel kiri (Proyek & Variabel) dan panel kanan (Hasil analisis) masing-
     masing punya tombol ‹ / › di bilah atasnya.
   - Diciutkan = panel jadi rel sempit (44 px) dengan judul tegak; lembar
     kerja di tengah otomatis melebar mengisi ruang (kiri, kanan, atau
     keduanya).
   - Dibuka lagi = lebar kembali persis seperti sebelum diciutkan (termasuk
     lebar hasil geseran pengguna di kolom-geser.js).
   - Berlaku di layar >= 1280 px (tata letak 3 kolom). Di layar lebih kecil
     panel memang sudah dipisah lewat segmen Data / Hasil.
   - Pilihan disimpan di localStorage (statcalc.calc.side).
   - Lebar kolom dihitung kolom-geser.js: kelas sx-lmin / sx-rmin pada
     .chapter-inner dibaca di sana.
   ========================================================================= */
(function () {
  'use strict';
  var view = document.getElementById('view-metode-calc');
  if (!view) return;
  var host = view.querySelector('.chapter-inner');
  if (!host) return;
  var KEY = 'statcalc.calc.side';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  var state = { l: !!saved.l, r: !!saved.r };

  var css = document.createElement('style');
  css.textContent =
    '#view-metode-calc .sx-bar{display:none;}' +
    '@media (min-width:1280px){' +
    '#view-metode-calc .sx-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:4px 8px 4px 14px;background:#fff;border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:3;}' +
    '#view-metode-calc .sc-res > .sx-bar{position:relative;}' +
    '#view-metode-calc .sx-title{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);white-space:nowrap;}' +
    '#view-metode-calc .sx-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--rule-strong);border-radius:8px;background:#fff;color:var(--accent);font:700 18px/1 var(--font-body,inherit);cursor:pointer;}' +
    '#view-metode-calc .sx-btn:hover{background:var(--accent-soft);}' +
    '#view-metode-calc .sx-btn:focus-visible{outline:2px solid var(--accent-2,#2F6DB5);outline-offset:1px;}' +
    /* keadaan diciutkan: hanya bilah (rel) yang tampil */
    '#view-metode-calc .sx-min{padding:0 !important;overflow:hidden !important;cursor:pointer;}' +
    '#view-metode-calc .sx-min > *:not(.sx-bar){display:none !important;}' +
    '#view-metode-calc .sx-min > .sx-bar{flex-direction:column;justify-content:flex-start;align-items:center;gap:14px;min-height:190px;height:100%;padding:8px 0 14px;border-bottom:0;background:transparent;position:relative;}' +
    '#view-metode-calc .sx-min .sx-title{writing-mode:vertical-rl;transform:rotate(180deg);}' +
    '#view-metode-calc .sx-min .sx-bar.ping .sx-btn::after{content:"";position:absolute;top:6px;right:6px;width:9px;height:9px;border-radius:50%;background:var(--accent-2,#2F6DB5);box-shadow:0 0 0 2px #fff;}' +
    '#view-metode-calc .sx-min .sx-btn{position:relative;}' +
    '}';
  document.head.appendChild(css);

  function wide() { return window.matchMedia ? window.matchMedia('(min-width:1280px)').matches : true; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* abaikan */ } }

  function relayout() {
    if (window.StatCalcCols && window.StatCalcCols.refresh) window.StatCalcCols.refresh();
    /* beri tahu lembar kerja (virtual grid) bahwa lebarnya berubah */
    window.dispatchEvent(new Event('resize'));
  }

  function make(side, panel, title) {
    var left = side === 'l';
    var bar = document.createElement('div');
    bar.className = 'sx-bar';
    bar.innerHTML = '<span class="sx-title"></span><button type="button" class="sx-btn"></button>';
    bar.querySelector('.sx-title').textContent = title;
    var btn = bar.querySelector('.sx-btn');
    panel.insertBefore(bar, panel.firstChild);

    function paint() {
      var min = state[side];
      panel.classList.toggle('sx-min', min);
      host.classList.toggle(left ? 'sx-lmin' : 'sx-rmin', min);
      /* kiri: ‹ untuk ciutkan, › untuk buka; kanan sebaliknya */
      btn.innerHTML = (left !== min) ? '&#8249;' : '&#8250;';
      btn.setAttribute('aria-expanded', String(!min));
      var nm = left ? 'kiri (Proyek & Variabel)' : 'kanan (Hasil analisis)';
      btn.title = (min ? 'Buka panel ' : 'Ciutkan panel ') + nm;
      btn.setAttribute('aria-label', btn.title);
      if (!min) bar.classList.remove('ping');
    }
    function set(v) { state[side] = v; paint(); persist(); relayout(); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!state[side]); });
    /* rel yang diciutkan bisa diklik di mana saja untuk membuka */
    panel.addEventListener('click', function (e) { if (wide() && state[side] && !e.target.closest('.sx-btn')) set(false); });
    paint();
    return { bar: bar, paint: paint };
  }

  var vars = host.querySelector(':scope > .sc-vars');
  var res = host.querySelector(':scope > .sc-res');
  var L = vars ? make('l', vars, 'Proyek & Variabel') : null;
  var R = res ? make('r', res, 'Hasil analisis') : null;

  /* Titik penanda di rel kanan bila ada hasil baru saat panel diciutkan */
  var body = res && res.querySelector('#srBody');
  if (R && body && window.MutationObserver) {
    new MutationObserver(function () { if (state.r && host.classList.contains('has-res')) R.bar.classList.add('ping'); })
      .observe(body, { childList: true, subtree: true });
  }
  /* Bila panel hasil muncul lagi lewat has-res sementara diciutkan, jaga agar tata letak dihitung ulang */
  if (window.MutationObserver) {
    new MutationObserver(function () { if (window.StatCalcCols) window.StatCalcCols.refresh(); }).observe(host, { attributes: true, attributeFilter: ['class'] });
  }

  window.StatCalcSide = {
    get: function () { return { left: state.l, right: state.r }; },
    set: function (o) {
      if (o && 'left' in o) state.l = !!o.left;
      if (o && 'right' in o) state.r = !!o.right;
      if (L) L.paint(); if (R) R.paint(); persist(); relayout();
    }
  };
})();
