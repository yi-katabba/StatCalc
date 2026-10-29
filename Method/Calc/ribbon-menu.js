/* =========================================================================
   RIBBON-MENU.JS - Checkbox di pita Calc diganti menu dropdown ala Excel
   -------------------------------------------------------------------------
   - Setiap kelompok checkbox (label.sc-chk) di pita digabung jadi SATU tombol
     dropdown (ikon + nama kelompok + ▾). Isinya daftar pilihan bertanda ✓.
   - Checkbox asli tetap ada di DOM (disembunyikan). Klik item menu hanya
     membalik checkbox asli lalu mengirim event "change", sehingga semua kode
     lama (sheet.js, sheet-data.js, sheet-graph.js) tetap bekerja tanpa diubah.
   - Pita Edit Grafik dibangun ulang tiap grafik dipilih; MutationObserver
     membuat menunya otomatis ikut dibangun ulang.
   - Keyboard: Enter / Spasi / ↓ buka menu, ↑ ↓ pindah item, Enter / Spasi
     centang, Esc tutup.
   ========================================================================= */
(function () {
  'use strict';
  var view = document.getElementById('view-metode-calc');
  if (!view) return;
  var ribbon = view.querySelector('.sc-ribbon');
  if (!ribbon) return;

  var css = document.createElement('style');
  css.textContent =
    '#view-metode-calc .rm-src{display:none !important;}' +
    '#view-metode-calc .sc-rb.rm-btn{min-width:72px;}' +
    '#view-metode-calc .sc-rb.rm-btn .rm-lbl{display:inline-flex;align-items:center;gap:3px;}' +
    '#view-metode-calc .sc-rb.rm-btn .rm-caret{font-size:9px;line-height:1;opacity:.75;}' +
    '#view-metode-calc .sc-rb.rm-btn[aria-expanded="true"]{background:var(--accent-soft);border-color:var(--rule-strong);}' +
    '.rm-menu{position:fixed;z-index:9000;min-width:200px;max-width:min(340px,calc(100vw - 16px));padding:4px;background:#fff;border:1px solid var(--rule-strong,#C5CDD6);border-radius:10px;box-shadow:0 10px 28px rgba(27,36,48,.18);font-family:var(--font-body,inherit);}' +
    '.rm-menu[hidden]{display:none;}' +
    '.rm-item{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:6px 12px 6px 8px;border:0;border-radius:7px;background:transparent;color:var(--ink,#1B2430);font:600 13.5px/1.25 inherit;font-family:inherit;text-align:left;cursor:pointer;}' +
    '.rm-item:hover,.rm-item:focus-visible{background:var(--accent-soft,#E3ECF7);outline:none;}' +
    '.rm-item .rm-ck{flex:0 0 20px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:5px;color:var(--accent,#1F3A57);font-size:15px;font-weight:800;}' +
    '.rm-item[aria-checked="true"] .rm-ck{background:var(--accent-soft,#E3ECF7);}' +
    '.rm-item[aria-checked="false"] .rm-ck::before{content:"";}' +
    '.rm-item[aria-checked="true"] .rm-ck::before{content:"\\2713";}';
  document.head.appendChild(css);

  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5l1.6 1.6L8.5 5M4 12.5l1.6 1.6L8.5 11M4 18.5l1.6 1.6 2.9-3.1"/><path d="M12 7h8M12 13h8M12 19h8"/></svg>';

  var menu = document.createElement('div');
  menu.className = 'rm-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
  document.body.appendChild(menu);
  var openBtn = null, openInputs = null, openedAt = 0;

  function txt(label) { return (label.textContent || '').replace(/\s+/g, ' ').trim(); }

  function close(focusBack) {
    if (!openBtn) return;
    menu.hidden = true; menu.innerHTML = '';
    openBtn.setAttribute('aria-expanded', 'false');
    var b = openBtn; openBtn = null; openInputs = null;
    if (focusBack && document.contains(b)) b.focus();
  }

  function items() { return Array.prototype.slice.call(menu.querySelectorAll('.rm-item')); }

  function paintItem(it, inp) { it.setAttribute('aria-checked', inp.checked ? 'true' : 'false'); }

  function toggle(it, inp, single) {
    inp.checked = !inp.checked;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    if (!document.contains(inp)) { close(false); return; } /* pita dibangun ulang */
    paintItem(it, inp);
    if (single) close(true);
  }

  function open(btn, inputs) {
    if (openBtn === btn) { close(true); return; }
    close(false);
    openBtn = btn; openInputs = inputs; openedAt = Date.now();
    menu.innerHTML = '';
    var single = inputs.length === 1;
    inputs.forEach(function (inp) {
      var lab = inp.closest('label'), it = document.createElement('button');
      it.type = 'button'; it.className = 'rm-item'; it.setAttribute('role', 'menuitemcheckbox');
      it.title = (lab && lab.title) || '';
      it.innerHTML = '<span class="rm-ck" aria-hidden="true"></span><span class="rm-tx"></span>';
      it.querySelector('.rm-tx').textContent = lab ? txt(lab) : '';
      paintItem(it, inp);
      it.addEventListener('click', function () { toggle(it, inp, single); });
      menu.appendChild(it);
    });
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    var r = btn.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8));
    var top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    menu.style.left = left + 'px'; menu.style.top = top + 'px';
  }

  function build(parent, labels) {
    var inputs = labels.map(function (l) { return l.querySelector('input[type="checkbox"]'); }).filter(Boolean);
    if (!inputs.length) return;
    var f = inputs[0], k = f.getAttribute('data-k') || '', name = 'Opsi';
    if (f.id === 'scHeader') name = 'Judul kolom';
    else if (f.id === 'sdMTok') name = 'Nilai hilang';
    else if (f.id === 'sdSpMerge') name = 'Pemisah';
    else if (k.indexOf('st:') === 0) name = 'Garis kisi';
    else if (k.indexOf('opt:') === 0) name = 'Elemen';
    else if (k === 'lock') name = 'Ukuran';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sc-rb rm-btn';
    btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
    btn.title = 'Buka menu: ' + labels.map(txt).join(' · ');
    btn.innerHTML = ICON + '<span class="rm-lbl"></span>';
    btn.querySelector('.rm-lbl').innerHTML = name.replace(/&/g, '&amp;').replace(/</g, '&lt;') + ' <span class="rm-caret" aria-hidden="true">&#9662;</span>';
    btn.addEventListener('click', function (e) { e.preventDefault(); open(btn, inputs); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (openBtn !== btn) open(btn, inputs);
        var li = items(); if (li.length) li[e.key === 'ArrowUp' ? li.length - 1 : 0].focus();
      }
    });
    labels[0].parentNode.insertBefore(btn, labels[0]);
    labels.forEach(function (l) { l.classList.add('rm-src'); l.setAttribute('data-rm', '1'); });
  }

  function enhance() {
    var fresh = Array.prototype.slice.call(ribbon.querySelectorAll('label.sc-chk:not([data-rm])'));
    if (!fresh.length) return;
    var groups = [];
    fresh.forEach(function (l) {
      var p = l.parentNode, g = null;
      for (var i = 0; i < groups.length; i++) if (groups[i].p === p) { g = groups[i]; break; }
      if (!g) groups.push(g = { p: p, labels: [] });
      g.labels.push(l);
    });
    groups.forEach(function (g) { build(g.p, g.labels); });
  }

  /* Navigasi keyboard di dalam menu */
  menu.addEventListener('keydown', function (e) {
    var li = items(), i = li.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); li[(i + 1) % li.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); li[(i - 1 + li.length) % li.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); li[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); li[li.length - 1].focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(true); }
  });
  document.addEventListener('pointerdown', function (e) {
    if (!openBtn) return;
    if (menu.contains(e.target) || openBtn.contains(e.target)) return;
    close(false);
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openBtn) close(true); });
  window.addEventListener('resize', function () { close(false); });
  /* Scroll yang menggeser tombol (pita / halaman) menutup menu; abaikan scroll sesaat setelah dibuka */
  function onScroll(e) {
    if (!openBtn || Date.now() - openedAt < 250) return;
    if (e.target && e.target.nodeType === 1 && menu.contains(e.target)) return;
    close(false);
  }
  window.addEventListener('scroll', onScroll, true);
  ribbon.addEventListener('click', function (e) { if (openBtn && e.target.closest('.sc-tab')) close(false); }, true);

  var raf = 0;
  function soon() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; enhance(); if (openBtn && !document.contains(openBtn)) close(false); }); }
  if (window.MutationObserver) new MutationObserver(soon).observe(ribbon, { childList: true, subtree: true });
  enhance();
})();
