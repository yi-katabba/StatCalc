/* =========================================================================
   KOLOM-GESER.JS - Lebar kolom bisa digeser (halaman berkolom 2 atau 3)
   -------------------------------------------------------------------------
   - Tarik garis pemisah antar kolom untuk mengubah lebar kolom samping.
   - Klik dua kali pada pemisah = kembali ke lebar default halaman itu.
   - Keyboard: fokus ke pemisah lalu tekan ← → (Shift = loncat lebih jauh),
     Enter/Home = default.
   - Tombol "Atur ulang lebar kolom" muncul di bilah judul atas (kanan) saat lebar diubah.
   - Pilihan disimpan per halaman di localStorage (statcalc.cols.*).
   - Default = lebar bawaan CSS; skrip ini tidak mengubahnya kecuali pengguna
     menggeser pemisah.
   ========================================================================= */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  var PFX = 'statcalc.cols.';
  var LIM = { l: [180, 520], r: [220, 560] }, MID_MIN = 360, STEP = 16, RAIL = 44; /* RAIL = lebar rel panel yang diciutkan (sheet-sidebar.js) */

  /* Daftar tata letak berkolom. left/right = penanda panel samping. */
  var DEFS = [
    { sel: '#view-kalkulator > .chapter-inner', left: '.calc-tools' },
    { sel: '#view-kalkulator .calc-layout', right: '.calc-hist-card' },
    { sel: '#view-matriks > .chapter-inner', left: '.mx-left', right: '.mx-right' },
    { sel: '#view-metode-calc > .chapter-inner', left: '.sc-vars', right: '.sc-res, .sg-below' },
    { sel: '.chapter-inner:has(.gr-chart)', left: '[id$="data-card"]', right: '.rb-main' },
    { sel: '.chapter-inner:has(> .st-side)', left: '.st-side' },
    { sel: '#view-materi-detail .mt-wrap', left: '.mt-toc', right: '.mt-try' },
    { sel: '#view-home .hm', right: '.hm-side' },
    { sel: '#view-profil > .chapter-inner', left: '.pf-menu' }
  ];

  var css = document.createElement('style');
  css.textContent =
    '.col-grip{position:absolute;width:14px;margin-left:-7px;z-index:6;cursor:col-resize;touch-action:none;outline:none;-webkit-tap-highlight-color:transparent;}' +
    '.col-grip::before{content:"";position:absolute;left:6px;top:0;bottom:0;width:2px;border-radius:2px;background:var(--accent-2,#2F6DB5);opacity:0;transition:opacity .15s;}' +
    '.col-grip i{display:block;position:sticky;top:calc(50vh - 20px);width:5px;height:40px;margin:0 auto;border-radius:3px;background:var(--rule-strong,#C5CDD6);transition:background .15s,height .15s;}' +
    '.col-grip:hover::before,.col-grip:focus-visible::before,.col-grip.on::before{opacity:.55;}' +
    '.col-grip:hover i,.col-grip:focus-visible i,.col-grip.on i{background:var(--accent-2,#2F6DB5);height:52px;}' +
    'body.col-dragging{cursor:col-resize !important;user-select:none;-webkit-user-select:none;}' +
    'body.col-dragging *{cursor:col-resize !important;}' +
    '.col-reset{display:inline-flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;white-space:nowrap;min-height:34px;padding:0 12px;border:1px solid var(--rule-strong,#C5CDD6);border-radius:8px;background:#fff;color:var(--accent,#1F3A57);font:600 12.5px/1 inherit;font-family:inherit;cursor:pointer;}' +
    '.col-reset:hover{background:var(--accent-soft,#E3ECF7);}.topbar .col-reset + .top-avatar{margin-left:8px;}' +
    '.col-reset[hidden]{display:none !important;}' +
    '@media (max-width:1023.98px){.col-grip,.col-reset{display:none !important;}}';
  document.head.appendChild(css);

  var states = new WeakMap(), list = [];

  function load(key) { try { var v = localStorage.getItem(PFX + key); return v ? (JSON.parse(v) || {}) : {}; } catch (e) { return {}; } }
  function save(st) {
    try {
      var o = {}; if (st.custom.l) o.l = Math.round(st.custom.l); if (st.custom.r) o.r = Math.round(st.custom.r);
      if (o.l || o.r) localStorage.setItem(PFX + st.key, JSON.stringify(o)); else localStorage.removeItem(PFX + st.key);
    } catch (e) { /* penyimpanan tidak tersedia */ }
  }
  var pf = function (v) { return parseFloat(v) || 0; };
  var shown = function (el) { return !!(el && el.getClientRects().length); };

  function tracks(cs) {
    if (cs.display !== 'grid') return null;
    var t = cs.gridTemplateColumns;
    if (!t || t === 'none') return null;
    var a = t.split(/\s+/).map(parseFloat);
    if (a.length < 2 || a.some(function (x) { return !isFinite(x); })) return null;
    return a;
  }

  function mkGrip(st, side) {
    var g = document.createElement('div');
    g.className = 'col-grip'; g.setAttribute('role', 'separator'); g.setAttribute('aria-orientation', 'vertical');
    g.setAttribute('tabindex', '0'); g.dataset.side = side;
    g.title = 'Geser untuk mengubah lebar kolom · klik dua kali untuk default';
    g.setAttribute('aria-label', 'Ubah lebar kolom ' + (side === 'l' ? 'kiri' : 'kanan'));
    g.innerHTML = '<i></i>'; g.style.display = 'none';
    g.style.gridColumn = 'auto'; g.style.gridRow = 'auto'; /* abaikan aturan > * { grid-column } milik halaman */
    st.c.appendChild(g);
    g.addEventListener('pointerdown', function (e) { startDrag(st, side, g, e); });
    g.addEventListener('dblclick', function () { delete st.custom[side]; save(st); layout(st); });
    g.addEventListener('keydown', function (e) {
      var k = e.key, d = (e.shiftKey ? 3 : 1) * STEP;
      if (k === 'Enter' || k === 'Home') { e.preventDefault(); delete st.custom[side]; save(st); layout(st); return; }
      if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      e.preventDefault();
      var cur = st.cur[side] || 0, dx = k === 'ArrowRight' ? d : -d;
      st.custom[side] = clamp(st, side, cur + (side === 'l' ? dx : -dx));
      save(st); layout(st);
    });
    return g;
  }

  function clamp(st, side, w) {
    var inf = st.info; if (!inf) return w;
    var lim = LIM[side], other = side === 'l' ? (inf.ri >= 0 ? (st.cur.r || 0) : 0) : (inf.li >= 0 ? (st.cur.l || 0) : 0);
    var gaps = (inf.n - 1) * inf.gap, max = Math.min(lim[1], inf.content - other - gaps - MID_MIN);
    return Math.round(Math.max(lim[0], Math.min(Math.max(lim[0], max), w)));
  }

  function layout(st) {
    var c = st.c, cs, arr;
    c.style.gridTemplateColumns = '';
    cs = getComputedStyle(c); arr = tracks(cs);
    if (!arr) { hide(st); return; }
    if (cs.position === 'static') c.style.position = 'relative';
    var n = arr.length, def = st.def, li = -1, ri = -1;
    if (n >= 3) { if (def.left) li = 0; if (def.right) ri = n - 1; }
    else if (def.left) li = 0; else if (def.right) ri = 1;
    if (li >= 0 && !shown(c.querySelector(def.left))) li = -1;
    if (ri >= 0 && !Array.prototype.some.call(c.querySelectorAll(':scope > ' + def.right.split(',').join(', :scope > ')), shown)) ri = -1;
    var gap = pf(cs.columnGap), pl = pf(cs.paddingLeft), pr = pf(cs.paddingRight);
    var info = st.info = { n: n, li: li, ri: ri, gap: gap, pl: pl, content: c.clientWidth - pl - pr };
    st.cur = { l: li >= 0 ? arr[li] : 0, r: ri >= 0 ? arr[ri] : 0 };

    /* Panel yang diciutkan (kelas sx-lmin / sx-rmin) = rel sempit; lebar custom TIDAK dihapus,
       jadi saat dibuka lagi lebar kembali seperti semula. */
    var minL = li >= 0 && c.classList.contains('sx-lmin'), minR = ri >= 0 && c.classList.contains('sx-rmin');
    var wl = minL ? RAIL : (li >= 0 && st.custom.l ? clamp(st, 'l', st.custom.l) : null);
    var wr = minR ? RAIL : (ri >= 0 && st.custom.r ? clamp(st, 'r', st.custom.r) : null);
    if (wl !== null || wr !== null) {
      c.style.gridTemplateColumns = arr.map(function (w, i) {
        if (i === li) return (wl !== null ? wl : w) + 'px';
        if (i === ri) return (wr !== null ? wr : w) + 'px';
        return 'minmax(0,1fr)';
      }).join(' ');
      arr = tracks(getComputedStyle(c)) || arr;
      st.cur = { l: li >= 0 ? arr[li] : 0, r: ri >= 0 ? arr[ri] : 0 };
    }

    var head = c.querySelector(':scope > .chapter-head');
    var pt = pf(cs.paddingTop), pb = pf(cs.paddingBottom);
    var top = shown(head) ? head.offsetTop + head.offsetHeight : pt;
    var height = c.clientHeight - top - pb;
    function place(side, k) {
      var g = st.grips[side] || (st.grips[side] = mkGrip(st, side));
      if (k < 0 || height < 60) { g.style.display = 'none'; return; }
      var x = pl, j; for (j = 0; j <= k; j++) x += arr[j]; x += k * gap + gap / 2;
      g.style.display = ''; g.style.left = x + 'px'; g.style.top = top + 'px'; g.style.height = height + 'px';
      g.setAttribute('aria-valuenow', Math.round(st.cur[side]));
    }
    place('l', li >= 0 && !minL ? 0 : -1);
    place('r', ri >= 0 && !minR ? n - 2 : -1);

    updateBtn();
  }

  /* Tombol reset: satu, di bilah judul atas (sejajar tombol kembali & judul, rata kanan) */
  var btn = null;
  function ensureBtn() {
    if (btn) return;
    var bar = document.getElementById('topbar'); if (!bar) return;
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'col-reset'; btn.hidden = true;
    btn.textContent = '↺ Atur ulang lebar kolom'; btn.title = 'Kembalikan lebar kolom halaman ini ke default';
    btn.addEventListener('click', function () {
      var id = activeView();
      list.forEach(function (st) { if (st.view === id) { st.custom = {}; save(st); layout(st); } });
      updateBtn(); window.dispatchEvent(new Event('resize'));
    });
    var av = document.getElementById('topAvatar');
    if (av) bar.insertBefore(btn, av); else bar.appendChild(btn);
  }
  function activeView() { var v = document.querySelector('.view.active'); return v ? v.id : ''; }
  function updateBtn() {
    ensureBtn(); if (!btn) return;
    var id = activeView();
    var on = !!id && list.some(function (st) {
      return st.view === id && (st.custom.l || st.custom.r) && ['l', 'r'].some(function (k) { return st.grips[k] && st.grips[k].style.display !== 'none'; });
    });
    if (btn.hidden === on) btn.hidden = !on;
  }
  function hide(st) {
    ['l', 'r'].forEach(function (s) { if (st.grips[s]) st.grips[s].style.display = 'none'; });
    updateBtn();
  }

  function startDrag(st, side, g, e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    var startX = e.clientX, startW = st.cur[side] || 0;
    try { g.setPointerCapture(e.pointerId); } catch (x) { /* abaikan */ }
    g.classList.add('on'); document.body.classList.add('col-dragging');
    function move(ev) {
      var dx = ev.clientX - startX;
      st.custom[side] = clamp(st, side, startW + (side === 'l' ? dx : -dx));
      layout(st);
    }
    function up() {
      g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
      g.classList.remove('on'); document.body.classList.remove('col-dragging');
      save(st); layout(st);
      st.busy = true; try { window.dispatchEvent(new Event('resize')); } finally { st.busy = false; }
    }
    g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  }

  function init(c, def, idx) {
    var view = c.closest('.view'), st = {
      c: c, def: def, key: (view ? view.id : 'x') + ':' + idx, grips: {}, custom: {}, cur: { l: 0, r: 0 }, info: null, view: ''
    };
    var saved = load(st.key); if (saved.l > 0) st.custom.l = saved.l; if (saved.r > 0) st.custom.r = saved.r;
    st.view = view ? view.id : 'x';
    states.set(c, st); list.push(st);
    if (window.ResizeObserver) {
      var raf = 0;
      new ResizeObserver(function () {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; if (!st.busy && shown(c)) layout(st); });
      }).observe(c);
    }
    layout(st);
  }

  function scan() {
    DEFS.forEach(function (def, idx) {
      var nodes; try { nodes = document.querySelectorAll(def.sel); } catch (e) { return; }
      Array.prototype.forEach.call(nodes, function (c) { if (!states.has(c)) init(c, def, idx); });
    });
  }
  function refresh() {
    scan();
    list.forEach(function (st) { if (shown(st.c)) layout(st); });
    updateBtn();
  }

  var t = 0;
  function soon() { clearTimeout(t); t = setTimeout(refresh, 120); }
  window.addEventListener('resize', function () { soon(); });
  if (window.MutationObserver) {
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }
  document.addEventListener('click', soon, true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
  refresh();

  window.StatCalcCols = {
    resetAll: function () {
      list.forEach(function (st) { st.custom = {}; save(st); layout(st); });
      window.dispatchEvent(new Event('resize'));
    },
    refresh: refresh
  };
})();
