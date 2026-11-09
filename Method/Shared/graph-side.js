/* =========================================================================
   GRAPH-SIDE.JS - Menu Grafik: panel data (kiri) dan panel "Pengaturan grafik" (kanan) bisa diciutkan
   -------------------------------------------------------------------------
   - Sama seperti panel di Dataset dan sidebar Stat: tombol ‹ / › di bilah atas panel; diciutkan = rel 44 px dengan
     judul tegak, grafik di tengah melebar. Klik di mana saja pada rel untuk membuka lagi.
   - Panel kiri: layar >= 1100 px. Panel kanan: layar >= 1440 px (di bawah itu pita pengaturan berada di atas grafik).
   - Pilihan disimpan di localStorage (statcalc.graph.side) dan berlaku untuk semua jenis grafik.
   - Lebar kolom dihitung kolom-geser.js (kelas sx-lmin / sx-rmin pada .chapter-inner).
   Dimuat SETELAH semua file Method/Graph/. ========================================================================= */
(function () {
  'use strict';
  var KEY = 'statcalc.graph.side', state = { l: false, r: false }, painters = { l: [], r: [] };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; state.l = !!sv.l; state.r = !!sv.r; } catch (e) { /* abaikan */ }

  var css = document.createElement('style');
  css.textContent =
    '.gx-bar{display:none;}' +
    '@media (min-width:1100px){' +
    '.gr-view [id$="data-card"] > .gx-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:4px 8px 4px 14px;margin-bottom:12px;background:#fff;border:1px solid var(--rule);border-radius:10px;position:sticky;top:-20px;z-index:5;}' +
    '.gx-title{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);white-space:nowrap;}' +
    '.gx-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--rule-strong);border-radius:8px;background:#fff;color:var(--ink);font-size:20px;line-height:1;cursor:pointer;}' +
    '.gx-btn:hover{background:var(--accent-soft);}.gx-btn:focus-visible{outline:2px solid var(--accent-2,#2F6DB5);outline-offset:1px;}' +
    '.gr-view .chapter-inner.sx-lmin:has(.gr-chart){grid-template-columns:44px minmax(0,1fr);}' +
    '.gr-view [id$="data-card"].gx-min{padding:0 !important;overflow:hidden !important;cursor:pointer;}' +
    '.gr-view [id$="data-card"].gx-min > *:not(.gx-bar){display:none !important;}' +
    '.gr-view [id$="data-card"].gx-min > .gx-bar{flex-direction:column;justify-content:flex-start;align-items:center;gap:14px;min-height:190px;padding:8px 0 14px;margin:0;border:0;background:transparent;position:relative;top:0;}' +
    '.gr-view .gx-min .gx-title{writing-mode:vertical-rl;transform:rotate(180deg);}' +
    '}' +
    '@media (min-width:1440px){' +
    '.gr-view .chapter-inner.sx-lmin:has(.gr-chart){grid-template-columns:44px minmax(0,1fr) 320px;}' +
    '.gr-view .chapter-inner.sx-rmin:has(.gr-chart){grid-template-columns:minmax(300px,340px) minmax(0,1fr) 44px;}' +
    '.gr-view .chapter-inner.sx-lmin.sx-rmin:has(.gr-chart){grid-template-columns:44px minmax(0,1fr) 44px;}' +
    '.gr-view .chapter-inner > .rb-main.gx-has::before{content:none !important;display:none !important;}' +
    '.gr-view .chapter-inner > .rb-main > .gx-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:8px 10px 4px 16px;background:#F8FAFC;position:sticky;top:0;z-index:5;}' +
    '.gr-view .chapter-inner > .rb-main > .gx-bar .gx-title{font-size:15px;font-weight:700;letter-spacing:0;text-transform:none;color:var(--ink);}' +
    '.gr-view .chapter-inner > .rb-main.gx-min{padding:0 !important;overflow:hidden !important;cursor:pointer;}' +
    '.gr-view .chapter-inner > .rb-main.gx-min > *:not(.gx-bar){display:none !important;}' +
    '.gr-view .chapter-inner > .rb-main.gx-min > .gx-bar{flex-direction:column;justify-content:flex-start;align-items:center;gap:14px;min-height:190px;padding:8px 0 14px;}' +
    '.gr-view .chapter-inner > .rb-main.gx-min .gx-title{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);writing-mode:vertical-rl;transform:rotate(180deg);}' +
    '}';
  document.head.appendChild(css);

  function widthOk(side) { return window.matchMedia ? window.matchMedia(side === 'l' ? '(min-width:1100px)' : '(min-width:1440px)').matches : true; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* abaikan */ } }
  function relayout() { if (window.StatCalcCols && window.StatCalcCols.refresh) window.StatCalcCols.refresh(); window.dispatchEvent(new Event('resize')); }
  function set(side, v) { state[side] = !!v; painters[side].forEach(function (f) { f(); }); persist(); relayout(); }

  function attach(inner, panel, side, title) {
    if (panel.querySelector(':scope > .gx-bar')) return;
    var left = side === 'l', bar = document.createElement('div'), min;
    bar.className = 'gx-bar'; bar.innerHTML = '<span class="gx-title"></span><button type="button" class="gx-btn"></button>';
    bar.querySelector('.gx-title').textContent = title;
    var btn = bar.querySelector('.gx-btn'); panel.insertBefore(bar, panel.firstChild); if (!left) panel.classList.add('gx-has');
    function paint() {
      min = state[side]; panel.classList.toggle('gx-min', min);
      /* kelas pada .chapter-inner dipasang bila ada panel yang diciutkan (kiri: [id$=data-card] mana pun) */
      inner.classList.toggle(left ? 'sx-lmin' : 'sx-rmin', state[side]);
      btn.innerHTML = (left !== min) ? '&#8249;' : '&#8250;'; btn.setAttribute('aria-expanded', String(!min));
      btn.title = (min ? 'Buka panel ' : 'Ciutkan panel ') + title; btn.setAttribute('aria-label', btn.title);
    }
    painters[side].push(paint); paint();
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(side, !state[side]); });
    panel.addEventListener('click', function (e) { if (widthOk(side) && state[side] && !e.target.closest('.gx-btn')) set(side, false); });
  }

  function scan(inner) {
    Array.prototype.forEach.call(inner.querySelectorAll(':scope > [id$="data-card"]'), function (c) { attach(inner, c, 'l', 'Data'); });
    var rb = inner.querySelector(':scope > .rb-main'); if (rb) attach(inner, rb, 'r', 'Pengaturan grafik');
  }
  function run() {
    Array.prototype.forEach.call(document.querySelectorAll('.gr-view'), function (v) {
      var inner = v.querySelector(':scope > .chapter-inner'); if (!inner) return;
      scan(inner);
      /* pita pengaturan dipasang belakangan: pasang bilahnya begitu muncul */
      if (window.MutationObserver) new MutationObserver(function () { scan(inner); }).observe(inner, { childList: true });
    });
  }
  window.StatGraphSide = { get: function () { return { left: state.l, right: state.r }; }, set: function (o) { if (o && 'left' in o) set('l', o.left); if (o && 'right' in o) set('r', o.right); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
