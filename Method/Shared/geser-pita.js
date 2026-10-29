/* =========================================================================
   GESER-PITA.JS - Semua pita bisa digeser kiri-kanan seperti tab Hasil
   -------------------------------------------------------------------------
   Berlaku untuk:
   - pita Dataset (.sc-rbody: File, Edit, Data, Fungsi, Grafik, Statistik, Edit Grafik);
   - pita halaman metode Stat dan "Pengaturan grafik" halaman Graph, termasuk pita
     Warna / Garis kisi pada grafik pendukung hasil (.rb-body, StatRibbon.mount).
   Bila lebar pita tidak cukup, isi pita:
   - digeser dengan gulir mouse biasa (roda vertikal -> geseran horizontal;
     Ctrl + roda tetap untuk zoom; bila sudah mentok di ujung, halaman bergulir biasa);
   - digeser dengan menahan klik kiri pada bagian kosong pita lalu menarik
     (kolom isian / pilihan tidak ikut menarik, agar tetap bisa diketik);
   - dilengkapi panah ‹ › di tepi yang muncul hanya bila masih ada isi di sisi itu;
   - tanpa bilah gulir bawaan; geser sentuh di layar tetap bekerja.
   Pita yang dibuat belakangan (mis. panel grafik hasil) ikut dikenali otomatis.
   Dimuat SETELAH semua modul metode, grafik, dan Dataset.
   ========================================================================= */
(function () {
  'use strict';
  var SEL = '#view-metode-calc .sc-rbody, .rb-body';

  var css = document.createElement('style');
  css.textContent =
    '.rg-wrap{position:relative;display:flex;flex:1 1 auto;min-width:0;}' +
    '.rg-wrap > .rg-body{flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none !important;}' +
    '.rg-wrap > .rg-body::-webkit-scrollbar{display:none;}' +
    '.rg-wrap.rg-drag > .rg-body{cursor:grabbing;user-select:none;-webkit-user-select:none;}' +
    '.rg-wrap.rg-drag > .rg-body *{cursor:grabbing !important;}' +
    '.rg-arr{position:absolute;top:0;bottom:0;width:32px;display:none;align-items:center;justify-content:center;border:0;padding:0;font-size:24px;line-height:1;color:var(--accent);cursor:pointer;z-index:3;}' +
    '.rg-arr.l{left:0;background:linear-gradient(90deg,#fff 55%,rgba(255,255,255,0));}' +
    '.rg-arr.r{right:0;background:linear-gradient(270deg,#fff 55%,rgba(255,255,255,0));}' +
    '.rg-wrap.ovf-l > .rg-arr.l,.rg-wrap.ovf-r > .rg-arr.r{display:flex;}' +
    '.rg-arr:hover{color:var(--accent-2);}';
  document.head.appendChild(css);

  /* elemen yang harus tetap menerima klik / ketikan sendiri: tarik tidak dimulai dari sini */
  var NODRAG = 'input,select,textarea,option,[contenteditable="true"]';

  function enhance(body) {
    if (!body || !body.parentNode || body.parentNode.classList.contains('rg-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'rg-wrap';
    body.parentNode.insertBefore(wrap, body);
    body.classList.add('rg-body');
    var l = document.createElement('button'), r = document.createElement('button');
    l.type = r.type = 'button'; l.tabIndex = r.tabIndex = -1;
    l.className = 'rg-arr l'; r.className = 'rg-arr r';
    l.setAttribute('aria-label', 'Geser pita ke kiri'); r.setAttribute('aria-label', 'Geser pita ke kanan');
    l.innerHTML = '&#8249;'; r.innerHTML = '&#8250;';
    wrap.appendChild(body); wrap.appendChild(l); wrap.appendChild(r);

    function max() { return body.scrollWidth - body.clientWidth; }
    function update() {
      var m = max();
      wrap.classList.toggle('ovf-l', m > 1 && body.scrollLeft > 1);
      wrap.classList.toggle('ovf-r', m > 1 && body.scrollLeft < m - 1);
    }
    body.addEventListener('scroll', update, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(update).observe(body);
    window.addEventListener('resize', update);
    new MutationObserver(function () { setTimeout(update, 0); }).observe(body, { childList: true, subtree: true });
    update();

    [l, r].forEach(function (a) {
      a.addEventListener('click', function () {
        body.scrollBy({ left: (a === l ? -1 : 1) * Math.max(120, body.clientWidth * 0.6), behavior: 'smooth' });
      });
    });

    /* roda mouse: vertikal -> horizontal, hanya bila memang masih bisa bergeser ke arah itu */
    body.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) return;                          /* Ctrl + roda = zoom Dataset */
      var m = max(); if (m <= 1) return;
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      if (e.deltaMode === 1) d *= 32; else if (e.deltaMode === 2) d *= body.clientWidth;
      var next = Math.max(0, Math.min(m, body.scrollLeft + d));
      if (next === body.scrollLeft) return;                        /* sudah di ujung: biarkan halaman bergulir */
      body.scrollLeft = next; e.preventDefault();
    }, { passive: false });

    /* tahan lalu tarik (mouse); ambang 5 px agar klik biasa pada tombol pita tidak terganggu */
    var down = null, moved = false;
    body.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || max() <= 1 || e.target.closest(NODRAG)) return;
      down = { x: e.clientX, left: body.scrollLeft }; moved = false;
    });
    document.addEventListener('mousemove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) < 5) return;
      moved = true; wrap.classList.add('rg-drag');
      body.scrollLeft = down.left - dx;
    });
    document.addEventListener('mouseup', function () {
      if (!down) return;
      down = null; wrap.classList.remove('rg-drag');
      if (moved) {                                                   /* tarikan jangan dianggap klik pada tombol di bawah kursor */
        var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
        body.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(function () { body.removeEventListener('click', stop, true); }, 0);
      }
    });
  }

  function scan() { Array.prototype.slice.call(document.querySelectorAll(SEL)).forEach(enhance); }
  scan();
  /* pita yang dibuat belakangan (panel grafik hasil, dll.): satu pemindaian per frame */
  var pending = false;
  new MutationObserver(function (list) {
    if (pending) return;
    for (var i = 0; i < list.length; i++) {
      for (var j = 0; j < list[i].addedNodes.length; j++) {
        var n = list[i].addedNodes[j];
        if (n.nodeType === 1 && (n.matches(SEL) || n.querySelector(SEL))) {
          pending = true;
          (window.requestAnimationFrame || setTimeout)(function () { pending = false; scan(); });
          return;
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
