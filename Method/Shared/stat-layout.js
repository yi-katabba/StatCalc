/* =========================================================================
   STAT-LAYOUT.JS - Halaman metode Stat: sidebar (pengaturan + data) dan bagian utama (hasil)
   -------------------------------------------------------------------------
   Berlaku untuk Regresi, Smoothing, ANOVA, RSM, Stasioneritas, ARIMA, dan Deskriptif.
   - Kartu "*-setup-card" dan "*-data-card" dipindah ke <div class="st-side">.
   - Kartu lain (hasil, uji asumsi, kesimpulan, panel grafik pendukung) ke <div class="st-main">.
   - Desktop (>= 1100px): dua kolom, sidebar menempel di kiri (CSS di statcalc-theme.css).
   - Ponsel/tablet (< 1024px): menu atas Data | Hasil. Saat hasil muncul, halaman otomatis
     pindah ke menu Hasil.
   Elemen hanya dipindah (bukan disalin), jadi id dan event listener modul Stat tetap bekerja.
   Dimuat SETELAH semua file Method/Stat/. ========================================================================= */
(function () {
  'use strict';
  var IDS = ['regresi', 'smoothing', 'anova', 'rsm', 'stasioner', 'arima', 'deskriptif'];
  var SIDE = /-(setup|data)-card$|^(setup|data)-card$/;

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
    /* semua elemen setelah kartu hasil pertama (mis. panel Grafik Pendukung) ikut ke bagian utama */
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
