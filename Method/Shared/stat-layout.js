/* =========================================================================
   STAT-LAYOUT.JS - Halaman metode Stat: sidebar (pengaturan + data) dan bagian utama (hasil)
   -------------------------------------------------------------------------
   Berlaku untuk Regresi, Smoothing, ANOVA, RSM, Stasioneritas, ARIMA, dan Deskriptif.
   - Kartu "*-setup-card" dan "*-data-card" dipindah ke <div class="st-side">.
   - Kartu lain (hasil, uji asumsi, kesimpulan, panel grafik pendukung) ke <div class="st-main">.
   - Desktop (>= 1100px): dua kolom, sidebar menempel di kiri (CSS di statcalc-theme.css).
   - Ponsel/tablet (< 1024px): menu atas Data | Hasil. Saat hasil muncul, halaman otomatis
     pindah ke menu Hasil.
   - Desktop (>= 1100px): sidebar bisa diciutkan jadi rel sempit (tombol ‹ / ›, seperti panel di Dataset); pilihan disimpan
     di localStorage (statcalc.stat.side) dan berlaku untuk semua halaman Stat. Hasil otomatis melebar mengisi ruang.
   Elemen hanya dipindah (bukan disalin), jadi id dan event listener modul Stat tetap bekerja.
   Dimuat SETELAH semua file Method/Stat/. ========================================================================= */
(function () {
  'use strict';
  var IDS = ['regresi', 'smoothing', 'anova', 'rsm', 'stasioner', 'arima', 'deskriptif', 'uji-t', 'korelasi', 'uji-z', 'proporsi', 'ragam', 'normalitas', 'chi-square', 'fisher', 'mann-whitney', 'wilcoxon', 'kruskal', 'friedman', 'uji-lanjut', 'ral-rak', 'anova-berulang', 'polinomial', 'stepwise', 'logistik', 'pca', 'faktor', 'klaster', 'butir', 'sem', 'dekomposisi-waktu', 'tar', 'faktorial', 'peta-kendali', 'kapabilitas', 'pareto', 'power', 'sampel-survei'];
  var SIDE = /-(setup|data)-card$|^(setup|data)-card$/;

  var SIDE_KEY = 'statcalc.stat.side', collapsed = false, painters = [];
  try { collapsed = localStorage.getItem(SIDE_KEY) === '1'; } catch (e) { /* abaikan */ }
  var css = document.createElement('style');
  css.textContent =
    '.stx-bar{display:none;}' +
    '@media (min-width:1100px){' +
    '.st-side > .stx-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:4px 8px 4px 14px;margin-bottom:12px;background:#fff;border:1px solid var(--rule);border-radius:10px;position:sticky;top:0;z-index:5;}' +
    '.stx-title{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);white-space:nowrap;}' +
    '.stx-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--rule-strong);border-radius:8px;background:#fff;color:var(--ink);font-size:20px;line-height:1;cursor:pointer;}' +
    '.stx-btn:hover{background:var(--accent-soft);}.stx-btn:focus-visible{outline:2px solid var(--accent-2,#2F6DB5);outline-offset:1px;}' +
    '.chapter-inner.sx-lmin:has(> .st-side){grid-template-columns:44px minmax(0,1fr);}' +
    '.st-side.stx-min{overflow:hidden;cursor:pointer;}' +
    '.st-side.stx-min > *:not(.stx-bar){display:none !important;}' +
    '.st-side.stx-min > .stx-bar{flex-direction:column;justify-content:flex-start;align-items:center;gap:14px;min-height:190px;padding:8px 0 14px;margin:0;}' +
    '.st-side.stx-min .stx-title{writing-mode:vertical-rl;transform:rotate(180deg);}' +
    '}';
  document.head.appendChild(css);
  function wide() { return window.matchMedia ? window.matchMedia('(min-width:1100px)').matches : true; }
  function relayout() {
    if (window.StatCalcCols && window.StatCalcCols.refresh) window.StatCalcCols.refresh();
    window.dispatchEvent(new Event('resize'));
  }
  function setCollapsed(v) {
    collapsed = !!v;
    try { localStorage.setItem(SIDE_KEY, collapsed ? '1' : '0'); } catch (e) { /* abaikan */ }
    painters.forEach(function (f) { f(); }); relayout();
  }
  window.StatSide = { get: function () { return collapsed; }, set: setCollapsed };

  function mount(id) {
    var view = document.getElementById('view-' + id);
    var inner = view && view.querySelector(':scope > .chapter-inner');
    if (!inner || inner.querySelector(':scope > .st-side')) return;
    var cards = Array.prototype.filter.call(inner.children, function (el) { return el.classList.contains('step-card'); });
    var side = cards.filter(function (el) { return SIDE.test(el.id); });
    var main = cards.filter(function (el) { return side.indexOf(el) < 0; });
    if (!side.length || !main.length) return;

    var sideBox = document.createElement('div'); sideBox.className = 'st-side';
    var mainBox = document.createElement('div'); mainBox.className = 'st-main';
    inner.insertBefore(sideBox, side[0]);
    side.forEach(function (el) { sideBox.appendChild(el); });
    inner.insertBefore(mainBox, main[0]);

    var sbar = document.createElement('div'); sbar.className = 'stx-bar';
    sbar.innerHTML = '<span class="stx-title">Pengaturan &amp; Data</span><button type="button" class="stx-btn"></button>';
    var sbtn = sbar.querySelector('.stx-btn');
    sideBox.insertBefore(sbar, sideBox.firstChild);
    function paint() {
      sideBox.classList.toggle('stx-min', collapsed); inner.classList.toggle('sx-lmin', collapsed);
      sbtn.innerHTML = collapsed ? '&#8250;' : '&#8249;'; sbtn.setAttribute('aria-expanded', String(!collapsed));
      sbtn.title = collapsed ? 'Buka panel Pengaturan & Data' : 'Ciutkan panel Pengaturan & Data'; sbtn.setAttribute('aria-label', sbtn.title);
    }
    painters.push(paint); paint();
    sbtn.addEventListener('click', function (e) { e.stopPropagation(); setCollapsed(!collapsed); });
    /* rel yang diciutkan bisa diklik di mana saja untuk membuka */
    sideBox.addEventListener('click', function (e) { if (wide() && collapsed && !e.target.closest('.stx-btn')) setCollapsed(false); });
    /* semua elemen setelah kartu hasil pertama (mis. panel Ekspor) ikut ke bagian utama */
    var n = main[0];
    while (n) { var nx = n.nextElementSibling; if (n !== mainBox && !n.classList.contains('st-side')) mainBox.appendChild(n); n = nx; }

    var bar = document.createElement('div');
    bar.className = 'hs-bar st-seg-bar';
    bar.innerHTML = '<div class="hs-seg" role="tablist" aria-label="Bagian halaman metode">' +
      '<button type="button" role="tab" class="on" data-stab="data" aria-selected="true">Data</button>' +
      '<button type="button" role="tab" data-stab="hasil" aria-selected="false">Hasil</button></div>';
    var head = inner.querySelector(':scope > .chapter-head');
    inner.insertBefore(bar, head ? head.nextSibling : inner.firstChild);
    view.classList.add('st-view'); view.dataset.stab = 'data';

    function set(t) {
      view.dataset.stab = t;
      Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
        var on = b.dataset.stab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    view._stSet = set;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-stab]');
      if (!b || b.dataset.stab === view.dataset.stab) return;
      set(b.dataset.stab);
      var top = bar.getBoundingClientRect().top + window.pageYOffset - 8;
      if (top < window.pageYOffset) window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    });
  }

  /* Modul Stat memanggil hasil.scrollIntoView() setelah menghitung. Bila hasil sedang tersembunyi
     (menu Data aktif di ponsel), pindah ke menu Hasil dulu agar guliran bekerja. */
  var orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function () {
    var v = this.closest && this.closest('.st-view');
    if (v && v.dataset.stab === 'data' && this.closest('.st-main') && v._stSet) v._stSet('hasil');
    return orig ? orig.apply(this, arguments) : undefined;
  };

  function run() { IDS.forEach(mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
