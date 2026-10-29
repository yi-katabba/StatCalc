/* StatCalc - animasi header Beranda: kurva normal "bernapas" + simbol statistik melayang.
   Mandiri, tanpa pustaka, berjalan offline. Hanya menyentuh elemen .hero-stat di dalam #skyBanner. */
(function () {
  'use strict';

  var banner = document.getElementById('skyBanner');
  if (!banner || banner.querySelector('.hero-stat')) return;

  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Markup ---------- */
  var layer = document.createElement('div');
  layer.className = 'hero-stat';
  layer.setAttribute('aria-hidden', 'true');

  var syms = document.createElement('div');
  syms.className = 'hero-syms';
  // [simbol, kiri %, atas %, ukuran px, opasitas, dx, dy, durasi s, jeda s]
  var SYM = [
    ['μ',  62, 10, 30, .20,  10, -14,  9,  0],
    ['σ',  88, 18, 34, .18, -12,  10, 11, -3],
    ['Σ',  74, 52, 26, .14,   8,  12, 10, -5],
    ['α',  94, 58, 24, .16, -10, -10,  8, -2],
    ['r²', 50, 16, 22, .13,  12,   8, 12, -7],
    ['p',  80,  6, 22, .15,  -8,  12,  9, -4],
    ['x̄',  56, 62, 22, .12,  10, -10, 11, -6],
    ['z',  97,  8, 20, .14,  -6,  10, 10, -1],
    ['χ²', 68, 30, 24, .12,   9,  -9, 13, -8],
    ['β',  44, 40, 22, .10, -10,   8, 12, -9],
    ['ρ',  86, 38, 22, .13,   8,  -8, 10, -5],
    ['H₀', 36, 10, 20, .10,  10,  10, 14, -2]
  ];
  SYM.forEach(function (s) {
    var el = document.createElement('span');
    el.className = 'hero-sym';
    el.textContent = s[0];
    el.style.cssText = 'left:' + s[1] + '%;top:' + s[2] + '%;font-size:' + s[3] + 'px;--o:' + s[4] +
      ';--dx:' + s[5] + 'px;--dy:' + s[6] + 'px;--dur:' + s[7] + 's;--del:' + s[8] + 's';
    syms.appendChild(el);
  });
  layer.appendChild(syms);

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var svg = mk('svg', { 'class': 'hero-curve', viewBox: '0 0 600 240', preserveAspectRatio: 'xMaxYMax meet', focusable: 'false' }, layer);
  var defs = mk('defs', {}, svg);
  var g = mk('linearGradient', { id: 'heroFill', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  mk('stop', { offset: '0', 'stop-color': '#8DB9F2', 'stop-opacity': '.34' }, g);
  mk('stop', { offset: '1', 'stop-color': '#8DB9F2', 'stop-opacity': '0' }, g);

  var BASE = 196, X0 = 20, X1 = 580, CX = 300;

  mk('line', { 'class': 'hc-axis', x1: X0, y1: BASE, x2: X1, y2: BASE }, svg);
  var band = mk('path', { 'class': 'hc-band' }, svg);
  var area = mk('path', { 'class': 'hc-area', fill: 'url(#heroFill)' }, svg);
  var mean = mk('line', { 'class': 'hc-mean', y1: BASE, y2: 40 }, svg);
  var line = mk('path', { 'class': 'hc-line', pathLength: 1 }, svg);
  var ring = mk('circle', { 'class': 'hc-ring', r: 6 }, svg);
  var dot = mk('circle', { 'class': 'hc-dot', r: 3.5 }, svg);

  var tickG = mk('g', { 'class': 'hc-ticks' }, svg);
  var ticks = [
    ['μ−2σ', -2], ['μ−σ', -1], ['μ', 0], ['μ+σ', 1], ['μ+2σ', 2]
  ].map(function (t) {
    var tx = mk('text', { 'class': 'hc-tick', y: BASE + 20, 'text-anchor': 'middle' }, tickG);
    tx.textContent = t[0];
    var tk = mk('line', { 'class': 'hc-axis', y1: BASE, y2: BASE + 5 }, tickG);
    return { z: t[1], text: tx, tick: tk };
  });

  banner.insertBefore(layer, banner.firstChild);

  /* ---------- Gambar kurva ---------- */
  var SIG0 = 62;      // sigma dasar (px viewBox)
  var H0 = 150;       // tinggi puncak dasar

  function draw(muShift, sFac) {
    var mu = CX + muShift, sig = SIG0 * sFac;
    var H = Math.min(H0 / sFac, 168);
    var d = '', i, x, y, n = 96;
    for (i = 0; i <= n; i++) {
      x = X0 + (X1 - X0) * i / n;
      var z = (x - mu) / sig;
      y = BASE - H * Math.exp(-z * z / 2);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    line.setAttribute('d', d);
    area.setAttribute('d', d + 'L' + X1 + ' ' + BASE + 'L' + X0 + ' ' + BASE + 'Z');

    // area ±1σ
    var bx0 = Math.max(X0, mu - sig), bx1 = Math.min(X1, mu + sig), bd = 'M' + bx0.toFixed(1) + ' ' + BASE, m = 24;
    for (i = 0; i <= m; i++) {
      x = bx0 + (bx1 - bx0) * i / m;
      var zz = (x - mu) / sig;
      bd += 'L' + x.toFixed(1) + ' ' + (BASE - H * Math.exp(-zz * zz / 2)).toFixed(1);
    }
    band.setAttribute('d', bd + 'L' + bx1.toFixed(1) + ' ' + BASE + 'Z');

    var top = BASE - H;
    mean.setAttribute('x1', mu.toFixed(1)); mean.setAttribute('x2', mu.toFixed(1));
    mean.setAttribute('y2', (top - 4).toFixed(1));
    dot.setAttribute('cx', mu.toFixed(1)); dot.setAttribute('cy', top.toFixed(1));
    ring.setAttribute('cx', mu.toFixed(1)); ring.setAttribute('cy', top.toFixed(1));

    ticks.forEach(function (t) {
      var tx = mu + t.z * sig;
      var vis = tx > X0 + 14 && tx < X1 - 14;
      t.text.setAttribute('x', tx.toFixed(1)); t.tick.setAttribute('x1', tx.toFixed(1)); t.tick.setAttribute('x2', tx.toFixed(1));
      t.text.style.opacity = vis ? '' : '0';
      t.tick.style.opacity = vis ? '' : '0';
    });
  }

  draw(0, 1);
  if (reduce) { layer.classList.add('is-static'); return; }
  layer.classList.add('is-intro');

  /* ---------- Animasi: mean bergeser, sigma menyempit/melebar ---------- */
  var raf = 0, t0 = 0, last = 0, started = false, inView = true;
  var TAU = Math.PI * 2;

  function frame(now) {
    raf = 0;
    if (!inView || document.hidden) return;
    if (!t0) t0 = now;
    if (now - last >= 33) {                       // ~30 fps cukup untuk gerak lambat
      last = now;
      var t = (now - t0) / 1000;
      // tunda gerak sampai garis selesai tergambar (2.4 dtk), lalu naik halus
      var k = Math.min(1, Math.max(0, (t - 2.4) / 2));
      k = k * k * (3 - 2 * k);
      draw(k * 30 * Math.sin(t * TAU / 10), 1 + k * 0.2 * Math.sin(t * TAU / 14 + 1));
    }
    raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && inView && !document.hidden) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  document.addEventListener('visibilitychange', function () {
    layer.classList.toggle('is-paused', document.hidden);
    document.hidden ? stop() : run();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      inView = es[0].isIntersecting;
      layer.classList.toggle('is-paused', !inView);
      inView ? run() : stop();
    }, { threshold: 0 }).observe(banner);
  }
  run();
})();
