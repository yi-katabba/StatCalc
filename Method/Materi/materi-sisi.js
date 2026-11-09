/* =========================================================================
   MATERI-SISI.JS - Panel samping halaman baca Materi bisa diciutkan (minimize)
   -------------------------------------------------------------------------
   - Panel kiri (Daftar materi) dan panel kanan (Coba di Dataset) masing-masing punya
     tombol ‹ / › di bilah atasnya, seperti panel di Dataset dan Stat.
   - Diciutkan = panel jadi rel sempit (44 px) dengan judul tegak; teks bacaan otomatis melebar.
   - Dibuka lagi = lebar kembali persis seperti sebelumnya (termasuk lebar hasil geseran di kolom-geser.js).
   - Kiri berlaku di layar >= 1024 px; kanan di layar >= 1360 px (saat kartu itu memang berada di samping).
   - Pilihan disimpan di localStorage (statcalc.materi.side).
   - Lebar kolom dihitung kolom-geser.js: kelas sx-lmin / sx-rmin pada .mt-wrap dibaca di sana.
   - Panel dibuat ulang tiap topik dibuka, jadi bilahnya dipasang lagi lewat MutationObserver.
   Dimuat SETELAH materi.js, materi-lembar.js, dan materi-nav.js. ========================================================================= */
(function () {
  'use strict';
  var view = document.getElementById('view-materi-detail'), wrap = document.getElementById('mtWrap');
  if (!view || !wrap) return;
  var KEY = 'statcalc.materi.side', saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  var state = { l: !!saved.l, r: !!saved.r };

  /* Aturan bilah & rel dibuat per panel supaya hanya berlaku saat panel itu memang berada di samping */
  function rules(P) {   /* P = selektor panel */
    var V = '#view-materi-detail ';
    return V + P + ' > .mtx-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:4px 8px 4px 14px;background:#fff;border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:3;}' +
      V + P + '.mtx-min{padding:0 !important;overflow:hidden !important;cursor:pointer;}' +
      V + P + '.mtx-min > *:not(.mtx-bar){display:none !important;}' +
      V + P + '.mtx-min > .mtx-bar{flex-direction:column;justify-content:flex-start;align-items:center;gap:14px;min-height:190px;margin:0;padding:8px 0 14px;border-bottom:0;background:transparent;position:relative;}' +
      V + P + '.mtx-min .mtx-title{writing-mode:vertical-rl;transform:rotate(180deg);}';
  }
  var css = document.createElement('style');
  css.textContent =
    '#view-materi-detail .mtx-bar{display:none;}' +
    '#view-materi-detail .mtx-title{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);white-space:nowrap;}' +
    '#view-materi-detail .mtx-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--rule-strong);border-radius:8px;background:#fff;color:var(--accent);font:700 18px/1 var(--font-body,inherit);cursor:pointer;}' +
    '#view-materi-detail .mtx-btn:hover{background:var(--accent-soft);}' +
    '#view-materi-detail .mtx-btn:focus-visible{outline:2px solid var(--accent-2,#2F6DB5);outline-offset:1px;}' +
    '@media (min-width:1024px){' + rules('.mt-tree') + '#view-materi-detail .mt-tree > .mtx-bar ~ .mtt-k{display:none;}}' +
    /* kartu "Coba di Dataset" hanya jadi panel samping di >= 1360 px; di bawah itu ia tampil biasa di kolom bacaan */
    '@media (min-width:1360px){' + rules('.mt-try') + '#view-materi-detail .mt-try:not(.mtx-min) > .mtx-bar{margin:-14px -16px 10px;border-radius:10px 10px 0 0;}' +
    '#view-materi-detail .mt-try > .mtx-bar + h3{display:none;}}';   /* judul sudah ada di bilah */
  document.head.appendChild(css);

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* abaikan */ } }
  function mq(px) { return window.matchMedia ? window.matchMedia('(min-width:' + px + 'px)').matches : true; }
  function relayout() {
    if (window.StatCalcCols && window.StatCalcCols.refresh) window.StatCalcCols.refresh();
    window.dispatchEvent(new Event('resize'));   /* bilah posisi baca & tata letak lain menghitung ulang */
  }

  var SIDES = {
    l: { sel: ':scope > .mt-tree', title: 'Daftar materi', name: 'kiri (Daftar materi)', left: true, min: 1024 },
    r: { sel: ':scope > .mt-try', title: 'Coba di Dataset', name: 'kanan (Coba di Dataset)', left: false, min: 1360 }
  };

  function paint(side) {
    var d = SIDES[side], min = state[side], panel = wrap.querySelector(d.sel);
    wrap.classList.toggle(d.left ? 'sx-lmin' : 'sx-rmin', min);
    if (!panel) return;
    var bar = panel.querySelector(':scope > .mtx-bar'), btn = bar && bar.querySelector('.mtx-btn');
    panel.classList.toggle('mtx-min', min);
    if (!btn) return;
    /* kiri: ‹ untuk ciutkan, › untuk buka; kanan sebaliknya */
    /* hanya tulis bila berubah: perubahan isi tombol dilihat MutationObserver di bawah dan akan memanggil paint lagi (loop) */
    var glyph = (d.left !== min) ? '\u2039' : '\u203A', ttl = (min ? 'Buka panel ' : 'Ciutkan panel ') + d.name;
    if (btn.textContent !== glyph) btn.textContent = glyph;
    if (btn.title !== ttl) { btn.title = ttl; btn.setAttribute('aria-label', ttl); }
    btn.setAttribute('aria-expanded', String(!min));
  }
  function set(side, v) {
    state[side] = !!v; paint(side); persist(); relayout();
  }
  function ensure(side) {
    var d = SIDES[side], panel = wrap.querySelector(d.sel);
    if (!panel) { paint(side); return; }
    if (!panel.querySelector(':scope > .mtx-bar')) {
      var bar = document.createElement('div');
      bar.className = 'mtx-bar';
      bar.innerHTML = '<span class="mtx-title"></span><button type="button" class="mtx-btn"></button>';
      bar.querySelector('.mtx-title').textContent = d.title;
      bar.querySelector('.mtx-btn').addEventListener('click', function (e) { e.stopPropagation(); set(side, !state[side]); });
      panel.insertBefore(bar, panel.firstChild);
      /* rel yang diciutkan bisa diklik di mana saja untuk membuka */
      if (!panel._mtxClick) {
        panel._mtxClick = true;
        panel.addEventListener('click', function (e) {
          if (state[side] && mq(d.min) && !e.target.closest('.mtx-btn')) set(side, false);
        });
      }
    }
    paint(side);
  }
  function ensureAll() { ensure('l'); ensure('r'); }

  new MutationObserver(ensureAll).observe(wrap, { childList: true, subtree: true });
  ensureAll();

  window.MateriSide = {
    get: function () { return { left: state.l, right: state.r }; },
    set: function (o) {
      if (o && 'left' in o) state.l = !!o.left;
      if (o && 'right' in o) state.r = !!o.right;
      paint('l'); paint('r'); persist(); relayout();
    }
  };
})();
