/* =========================================================================
   PENJELASAN-JUDUL.JS - Tombol tanda tanya lingkaran (?) di samping judul langkah
   -------------------------------------------------------------------------
   Berlaku untuk semua judul langkah (<h2> di dalam .step-card) pada:
     - metode Stat  : Regresi, Smoothing, ANOVA, RSM, Stasioneritas, ARIMA, Deskriptif
     - metode Graph : semua halaman grafik (.gr-view)
   Bila kartu langkah punya penjelasan (p.hint atau .gr-format yang menjadi anak langsung
   kartu), tombol (?) ditaruh di sisi kanan judul. Klik untuk menampilkan / menyembunyikan
   penjelasan itu. Judul tanpa penjelasan (mis. "Hasil") tidak diberi tombol.

   - Elemen penjelasan tidak dipindah atau disalin (hanya diberi kelas .hlp-off), jadi id dan
     isi dinamis (mis. angka "minimal N baris") tetap bekerja.
   - Tombol tidak berisi teks, sehingga h2.textContent (dipakai sheet-hasil.js) tidak berubah.
   - Kartu dan penjelasan yang dibuat belakangan ikut dipasangi otomatis (MutationObserver).
   - Setelan awal: penjelasan tersembunyi. Ubah DEFAULT_OPEN menjadi true untuk membalik.
   Dimuat SETELAH semua file Method/Stat/ dan Method/Graph/.
   ========================================================================= */
(function () {
  'use strict';

  var DEFAULT_OPEN = false;
  var VIEWS = ['regresi', 'smoothing', 'anova', 'rsm', 'stasioner', 'arima', 'deskriptif']
    .map(function (id) { return '#view-' + id; }).concat(['.gr-view']);
  var CARD_SEL = VIEWS.map(function (v) { return v + ' .step-card'; }).join(',');
  var EXPL_SEL = ':scope > p.hint, :scope > .gr-format';
  var uid = 0;

  /* ------------------------------- Gaya ---------------------------------- */
  var st = document.createElement('style');
  st.textContent =
    '.hlp-off{display:none !important;}' +
    '.hlp-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;' +
      'width:22px;height:22px;min-width:22px;margin:-2px 0 0 10px;padding:0;border-radius:50%;' +
      'border:1.5px solid var(--accent-2,#1F5FA8);background:transparent;color:var(--accent-2,#1F5FA8);' +
      'font:800 13px/1 var(--font-body,system-ui,sans-serif);cursor:pointer;flex:0 0 auto;' +
      'transition:background .12s ease,color .12s ease;}' +
    '.hlp-btn::before{content:"?";}' +
    '.hlp-btn::after{content:"";position:absolute;inset:-11px;}' +   /* area sentuh ~44px */
    '.hlp-btn:hover{background:var(--accent-soft,#E2EDF9);}' +
    '.hlp-btn[aria-expanded="true"]{background:var(--accent-2,#1F5FA8);color:#fff;}' +
    '.hlp-btn:focus-visible{outline:2px solid var(--accent-2,#1F5FA8);outline-offset:2px;}' +
    '@keyframes hlpIn{from{opacity:0;transform:translateY(-3px);}to{opacity:1;transform:none;}}' +
    '.hlp-on{animation:hlpIn .16s ease-out;}';
  document.head.appendChild(st);

  /* ---------------------------- Logika tombol ----------------------------- */
  function setOpen(btn, expl, open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.title = open ? 'Sembunyikan penjelasan' : 'Tampilkan penjelasan';
    expl.forEach(function (el) { applyState(el, open); });
  }
  function applyState(el, open) {
    el.classList.toggle('hlp-off', !open);
    el.classList.remove('hlp-on');
    if (open) { void el.offsetWidth; el.classList.add('hlp-on'); }
  }

  function enhance(card) {
    var h2 = card.querySelector(':scope > h2');
    if (!h2) return;
    var expl = Array.prototype.slice.call(card.querySelectorAll(EXPL_SEL));
    if (!expl.length) return;

    var btn = h2.querySelector(':scope > .hlp-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hlp-btn';
      btn.setAttribute('aria-label', 'Penjelasan: ' + h2.textContent.trim());
      h2.appendChild(btn);
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var list = Array.prototype.slice.call(card.querySelectorAll(EXPL_SEL));
        setOpen(btn, list, btn.getAttribute('aria-expanded') !== 'true');
      });
      expl.forEach(function (el) { el.dataset.hlp = '1'; });
      expl.forEach(function (el) { el.id = el.id || 'hlp-' + (++uid); });
      btn.setAttribute('aria-controls', expl.map(function (el) { return el.id; }).join(' '));
      setOpen(btn, expl, DEFAULT_OPEN);
      return;
    }
    /* penjelasan baru yang muncul belakangan mengikuti status tombol saat ini */
    var open = btn.getAttribute('aria-expanded') === 'true', fresh = false;
    expl.forEach(function (el) {
      if (el.dataset.hlp) return;
      el.dataset.hlp = '1'; el.id = el.id || 'hlp-' + (++uid); fresh = true;
      el.classList.toggle('hlp-off', !open);
    });
    if (fresh) btn.setAttribute('aria-controls', expl.map(function (el) { return el.id; }).join(' '));
  }

  function scan() {
    Array.prototype.forEach.call(document.querySelectorAll(CARD_SEL), enhance);
  }

  /* Pemindaian ulang ringan (digabung per frame) bila isi halaman metode berubah */
  var queued = false;
  function queue() {
    if (queued) return; queued = true;
    (window.requestAnimationFrame || setTimeout)(function () { queued = false; scan(); });
  }
  var watched = new WeakSet();
  function watch() {
    Array.prototype.forEach.call(document.querySelectorAll(VIEWS.join(',')), function (v) {
      if (watched.has(v)) return;
      watched.add(v);
      new MutationObserver(queue).observe(v, { childList: true, subtree: true });
    });
  }
  function run() {
    scan(); watch();
    /* halaman Graph/Stat yang baru ditambahkan ke <body> */
    new MutationObserver(function () { watch(); queue(); }).observe(document.body, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
