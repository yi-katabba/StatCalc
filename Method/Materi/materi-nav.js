/* Materi: (1) daftar semua topik + sub-bagian di kiri (desktop >= 1024px), topik aktif terbuka dan sub-bagian
   yang sedang dibaca ditandai; (2) indikator "Regresi Linear · Bagian 3 dari 5 · 6 menit baca" di atas judul,
   di bilah status (desktop), dan di bilah atas (ponsel). Dimuat SETELAH materi.js dan materi-lembar.js. */
(function () {
  'use strict';
  var M = window.StatCalcMateri, view = document.getElementById('view-materi-detail'), wrap = document.getElementById('mtWrap');
  if (!M || !view || !wrap) return;
  var WPM = 180;
  wrap.classList.add('has-tree');
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------- indikator tambahan: bilah atas (ponsel) dan bilah status (desktop) ---------- */
  var top = document.getElementById('topbar'), tpos = document.createElement('span');
  tpos.id = 'topPos'; tpos.className = 'top-pos';
  var av = document.getElementById('topAvatar');
  if (top) top.insertBefore(tpos, av || null);
  var sbar = document.getElementById('statusBar'), sbM = document.createElement('span'), sbP = document.createElement('span');
  sbM.id = 'sbMateri'; sbP.id = 'sbBagian'; sbM.hidden = sbP.hidden = true;
  if (sbar) { var sp = sbar.querySelector('.sb-sp'); sbar.insertBefore(sbM, sp); sbar.insertBefore(sbP, sp); }

  var mins = {};   /* topik -> menit baca per bagian (dihitung dari teks yang tampil, tanpa duplikat MathML KaTeX) */
  function minutesOf(t) {
    if (mins[t.id]) return mins[t.id];
    var out = [];
    Array.prototype.forEach.call(wrap.querySelectorAll('.mt-sec'), function (el) {
      var c = el.cloneNode(true);
      Array.prototype.forEach.call(c.querySelectorAll('.katex-mathml, h2'), function (x) { x.remove(); });
      var words = (c.textContent || '').trim().split(/\s+/).filter(Boolean).length;
      out.push(Math.max(1, Math.round(words / WPM)));
    });
    if (out.length === t.sections.length) mins[t.id] = out;
    return out;
  }

  var active = -1, cur = null;
  function posText(t, k) {
    var m = minutesOf(t)[k] || 1;
    return { full: t.title + ' \u00B7 Bagian ' + (k + 1) + ' dari ' + t.sections.length + ' \u00B7 ' + m + ' menit baca', short: 'Bagian ' + (k + 1) + ' dari ' + t.sections.length };
  }
  function topicNow() { var id = M.currentId && M.currentId(); return id ? M.topics().filter(function (x) { return x.id === id; })[0] : null; }

  function treeHTML(t) {
    var h = '<div class="mtt-k">Daftar materi</div>';
    M.topics().forEach(function (x) {
      var on = x.id === t.id;
      h += '<button type="button" class="mtt-tp' + (on ? ' on' : '') + '" data-topic="' + esc(x.id) + '"' + (on ? ' aria-current="true"' : '') + '>' + esc(x.title) + '</button>';
      if (on) x.sections.forEach(function (s, i) {
        h += '<button type="button" class="mtt-sb" data-sec="' + esc(s.id) + '" data-i="' + i + '"><span class="mtt-n">' + (i + 1) + ' \u00B7</span> ' + esc(s.title) + '</button>';
      });
    });
    return h;
  }
  function ensureTree() {
    var t = topicNow(); if (!t || !wrap.querySelector('.mt-head')) return;
    var tree = wrap.querySelector('.mt-tree');
    if (tree && tree.dataset.topic === t.id) return;
    if (!tree) { tree = document.createElement('aside'); tree.className = 'mt-tree'; tree.setAttribute('aria-label', 'Daftar materi'); wrap.insertBefore(tree, wrap.firstChild); }
    tree.dataset.topic = t.id; tree.innerHTML = treeHTML(t);
    cur = t; active = -1; update(true);
  }

  function update(force) {
    var t = topicNow(); if (!t) return;
    var secs = wrap.querySelectorAll('.mt-sec'), k = 0, i;
    if (!secs.length) return;
    for (i = 0; i < secs.length; i++) { if (secs[i].getBoundingClientRect().top <= 130) k = i; else break; }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) k = secs.length - 1;
    if (!force && k === active && cur === t) return;
    active = k; cur = t;
    var p = posText(t, k), eb = wrap.querySelector('.mt-head .eyebrow');
    if (eb) eb.textContent = p.full;
    tpos.textContent = p.short; sbM.textContent = 'Materi \u00B7 ' + t.title; sbP.textContent = p.short;
    var tree = wrap.querySelector('.mt-tree');
    if (tree) {
      Array.prototype.forEach.call(tree.querySelectorAll('.mtt-sb'), function (b) {
        var on = +b.dataset.i === k; b.classList.toggle('on', on);
        if (on) { b.setAttribute('aria-current', 'location'); var bt = b.offsetTop, bh = b.offsetHeight; if (bt < tree.scrollTop + 8) tree.scrollTop = Math.max(0, bt - 40); else if (bt + bh > tree.scrollTop + tree.clientHeight - 8) tree.scrollTop = bt + bh - tree.clientHeight + 40; } else b.removeAttribute('aria-current');
      });
    }
  }

  wrap.addEventListener('click', function (e) {
    var tp = e.target.closest('.mt-tree .mtt-tp'), sb = e.target.closest('.mt-tree .mtt-sb');
    if (tp) { if (!tp.classList.contains('on')) M.open(tp.dataset.topic, null, { backTo: 'materi' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (sb) { var el = document.getElementById('mt-' + (cur && cur.id) + '-' + sb.dataset.sec); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  var raf = 0;
  window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (view.classList.contains('active')) update(false); }); }, { passive: true });
  window.addEventListener('resize', function () { if (view.classList.contains('active')) update(true); });
  new MutationObserver(function () { ensureTree(); }).observe(wrap, { childList: true });
  new MutationObserver(function () {
    var on = view.classList.contains('active');
    document.body.classList.toggle('mt-reading', on); sbM.hidden = sbP.hidden = !on;
    if (on) { ensureTree(); update(true); }
  }).observe(view, { attributes: true, attributeFilter: ['class'] });
  ensureTree();
})();
