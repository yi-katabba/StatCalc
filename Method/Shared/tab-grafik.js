/* =========================================================================
   TAB-GRAFIK.JS - tab "Grafik" pada kartu hasil halaman metode Stat
   -------------------------------------------------------------------------
   Satu tempat untuk semua grafik sebuah metode:
   - grafik yang digambar modul metode (Regresi, Smoothing, ... sudah punya tab "Grafik");
   - grafik pendukung + pita pengaturan + tombol PNG/SVG/Salin (export-hasil.js);
   - grafik yang tadinya ikut di tab Ringkasan (TAR, PCA, Klaster, Peta Kendali, SEM, ...).
   Tombol unduh .docx / .zip / Bagikan tetap di panel "Ekspor".

   Bila kartu hasil belum punya tab "Grafik", tab itu dibuat otomatis di ujung deretan tab.
   Tab yang labelnya diawali "Grafik" (mis. "Grafik Respon" pada RSM) dipakai apa adanya.

   API (window.StatGraphTab):
     ensure(kartuHasil, id)        -> { btn, pane } (membuat tab bila belum ada), atau null
     gtab(kartuHasil, id)          -> elemen .ex-gtab#ex-gp-<id> di dalam panel tab (dibuat bila belum ada)
     moveFrom(wadah, kartuHasil, id) -> memindahkan <svg role="img"> (+ catatan di bawahnya) dan #sxDiag
                                       dari wadah (mis. isi tab Ringkasan) ke tab Grafik
   Dimuat SEBELUM modul Stat.
   ========================================================================= */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var style = document.createElement('style');
  style.textContent =
    '.gt-native{display:flex;flex-direction:column;gap:6px;}' +
    '.gt-native > svg{margin-top:0 !important;}' +
    '.gt-native + .ex-gtab,.ex-gtab + .gt-native{margin-top:22px;}' +
    '.ex-gtab{margin-top:14px;}' +
    '.ex-gtab:first-child{margin-top:0;}' +
    '.ex-gt-h{margin:0 0 4px;font-size:16px;}' +
    '.ex-gt-note{margin:0 0 6px;font-size:13px;color:var(--ink-soft);}' +
    '.ex-chart-off{display:none;}';
  document.head.appendChild(style);

  function ensure(rc, id) {
    if (!rc) return null;
    var nav = $('.tabs', rc);
    if (!nav) return null;
    var btn = $$('.tab-btn', nav).filter(function (b) { return /^\s*grafik\b/i.test(b.textContent); })[0];
    var pane = btn ? document.getElementById(btn.dataset.tab) : null;
    if (btn && pane) return { btn: btn, pane: pane };

    var pid = id + '-tab-gp';
    pane = document.getElementById(pid);
    btn = $('.tab-btn[data-tab="' + pid + '"]', nav);
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'tab-panel'; pane.id = pid;
      var panes = $$('.tab-panel', rc), last = panes[panes.length - 1];
      if (last && last.parentNode) last.parentNode.insertBefore(pane, last.nextSibling); else rc.appendChild(pane);
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'tab-btn'; btn.dataset.tab = pid; btn.textContent = 'Grafik';
      nav.appendChild(btn);
      /* modul asal memasang penangan klik tab pada tombol lama saja; tab baru diaktifkan di sini */
      btn.addEventListener('click', function () {
        $$('.tab-btn', nav).forEach(function (b) { b.classList.toggle('active', b === btn); });
        $$('.tab-panel', rc).forEach(function (p) { p.classList.toggle('active', p === pane); });
      });
    }
    return { btn: btn, pane: pane };
  }

  function gtab(rc, id) {
    var t = ensure(rc, id);
    if (!t) return null;
    var el = document.getElementById('ex-gp-' + id);
    if (el && t.pane.contains(el)) return el;
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'ex-gtab'; el.id = 'ex-gp-' + id;
    t.pane.appendChild(el);
    return el;
  }

  /* Grafik yang digabung ke teks Ringkasan oleh modul metode (SVG polos; catatan di bawahnya berupa <p class="bs-note" style="text-align:center">) */
  function moveFrom(wrap, rc, id) {
    if (!wrap || !rc) return 0;
    var items = $$('svg[role="img"], #sxDiag', wrap).filter(function (n) {
      if (n.closest('table')) return false;
      var up = n.parentNode && n.parentNode.closest ? n.parentNode.closest('#sxDiag') : null;
      return !up;
    });
    if (!items.length) { var old = $('.gt-native', rc); if (old) old.innerHTML = ''; return 0; }   /* hitungan ulang tanpa grafik: bersihkan sisa lama */
    var t = ensure(rc, id);
    if (!t) return 0;
    var box = $('.gt-native', t.pane);
    if (!box) {
      box = document.createElement('div'); box.className = 'gt-native';
      t.pane.insertBefore(box, t.pane.firstChild);
    }
    box.innerHTML = '';
    items.forEach(function (n) {
      var note = n.nextElementSibling;
      box.appendChild(n);
      if (note && note.matches && note.matches('p.bs-note') && /text-align:\s*center/.test(note.getAttribute('style') || '')) box.appendChild(note);
    });
    return items.length;
  }

  window.StatGraphTab = { ensure: ensure, gtab: gtab, moveFrom: moveFrom };
})();
