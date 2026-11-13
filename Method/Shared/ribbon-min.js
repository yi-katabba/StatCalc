/* =========================================================================
   RIBBON-MIN.JS - Tombol panah di pojok kanan bawah pita: ^ saat pita terbuka (perkecil), v saat diciutkan (perbesar)
   -------------------------------------------------------------------------
   Berlaku untuk pita Dataset (.sc-ribbon) dan pita halaman Stat (.rb-main).
   Saat diperkecil hanya baris tab yang tersisa. Klik tab saat diperkecil
   membuka pita lagi. Pilihan diingat per jenis pita (localStorage).
   Pita pengaturan grafik di samping (halaman Grafik) tidak diubah.
   ========================================================================= */
(function () {
  'use strict';
  var KEY = 'sc-ribbon-min:';
  function load(k) { try { var v = localStorage.getItem(KEY + k); if (v === null) return k === 'calc'; return v === '1'; } catch (e) { return k === 'calc'; } }
  function save(k, v) { try { localStorage.setItem(KEY + k, v ? '1' : '0'); } catch (e) { /* abaikan */ } }

  var css = document.createElement('style');
  css.textContent =
    '.rb-minable{position:relative;}' +
    '.rb-min-btn{position:absolute;right:8px;bottom:6px;z-index:5;width:28px;height:28px;min-height:0;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--rule-strong,#C5CDD6);border-radius:8px;background:#fff;cursor:pointer;}' +
    '.rb-min-btn:hover{background:var(--accent-soft,#E3ECF7);}' +
    '.rb-min-btn::before{content:"";display:block;width:8px;height:8px;margin-top:3px;border-right:2px solid var(--accent,#1F3A57);border-bottom:2px solid var(--accent,#1F3A57);transform:rotate(-135deg);transition:transform .15s ease;}' +
    '.rb-minable.rb-min .rb-min-btn::before{margin-top:-3px;transform:rotate(45deg);}' +
    '.rb-minable.rb-min .sc-rpanel,.rb-minable.rb-min .rb-panel{display:none !important;}' +
    '.rb-minable.rb-min .sc-tabs,.rb-minable.rb-min .rb-tabs{border-bottom:0;}' +
    '.rb-minable .sc-tabs,.rb-minable .rb-tabs{padding-right:44px;}' +
    '.rb-minable.rb-min.rb-peek .sc-rpanel.on{display:flex !important;position:absolute;left:0;right:0;top:100%;z-index:40;border:1px solid var(--rule-strong,#C5CDD6);border-radius:0 0 12px 12px;box-shadow:0 10px 28px rgba(20,40,70,.18);max-height:min(70vh,520px);overflow:auto;}' +
    '#view-metode-calc .sc-main:has(.rb-min){overflow:visible;}' +
    '@media (max-width:1023.98px){' +
      '.rb-minable:not(.rb-min){padding-bottom:40px;}' +
      '.rb-min-btn{width:36px;height:36px;right:6px;bottom:3px;}' +
      '.rb-minable:not(.rb-min) .rb-min-btn{bottom:2px;}' +
      '.rb-minable .sc-tabs,.rb-minable .rb-tabs{padding-right:50px;}' +
    '}';
  document.head.appendChild(css);

  function setup(box, kind) {
    if (!box || box.classList.contains('rb-minable')) return;
    box.classList.add('rb-minable');
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'rb-min-btn';
    function paint(min) {
      box.classList.toggle('rb-min', min); if (!min) box.classList.remove('rb-peek');
      var t = min ? 'Sematkan pita (selalu tampil)' : 'Perkecil pita';
      btn.setAttribute('aria-label', t); btn.title = t; btn.setAttribute('aria-expanded', String(!min));
    }
    function set(min, remember) {
      paint(min); if (remember) save(kind, min);
      window.dispatchEvent(new Event('resize'));
    }
    btn.addEventListener('click', function () { set(!box.classList.contains('rb-min'), true); });
    box.addEventListener('click', function (e) {
      var tab = e.target.closest('.sc-tab,.rb-tab');
      if (!box.classList.contains('rb-min') || !tab) return;
      if (kind === 'calc') {
        /* pita Dataset: klik tab membuka panel sebagai popover; klik tab yang sama menutupnya */
        var same = tab.getAttribute('aria-selected') === 'true';
        box.classList.toggle('rb-peek', !(same && box.classList.contains('rb-peek')));
      } else set(false, true);
    }, true);
    document.addEventListener('click', function (e) {
      if (box.classList.contains('rb-peek') && !box.contains(e.target) && !e.target.closest('.rm-menu')) box.classList.remove('rb-peek');
    });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('rb-peek'); });
    box.appendChild(btn);
    paint(load(kind));
  }

  function scan() {
    var c = document.querySelector('#view-metode-calc .sc-ribbon');
    if (c) setup(c, 'calc');
    Array.prototype.forEach.call(document.querySelectorAll('.rb-main'), function (m) {
      var side = false;
      try { side = m.matches('.chapter-inner:has(.gr-chart) > .rb-main'); } catch (e) { /* browser lama */ }
      if (side || m.closest('.gr-view') || m.classList.contains('rb-pop')) return;
      setup(m, 'stat');
    });
  }
  var raf = 0;
  new MutationObserver(function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; scan(); }); })
    .observe(document.body, { childList: true, subtree: true });
  scan();
})();
