/* StatCalc - animasi header Beranda: tiga adegan bergantian (kurva normal, scatter + regresi, time series + ramalan)
   + simbol statistik melayang. Mandiri, tanpa pustaka, berjalan offline.
   Hanya menyentuh elemen .hero-stat di dalam #skyBanner. */
(function () {
  'use strict';

  var banner = document.getElementById('skyBanner');
  if (!banner || banner.querySelector('.hero-stat')) return;

  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;
  var FADE = 0.8;                     // detik fade-out di akhir tiap adegan (fade-in diatur CSS)

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
  var grad = mk('linearGradient', { id: 'heroFill', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  mk('stop', { offset: '0', 'stop-color': '#8DB9F2', 'stop-opacity': '.34' }, grad);
  mk('stop', { offset: '1', 'stop-color': '#8DB9F2', 'stop-opacity': '0' }, grad);

  var BASE = 196, X0 = 20, X1 = 580, CX = 300;

  /* ---------- Alat bantu ---------- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }          // 0..1 di antara detik a dan b
  function smooth(k) { return k * k * (3 - 2 * k); }
  function outBack(k) { var c = 1.70158, u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  function f1(n) { return n.toFixed(1); }
  function fmt(n) { return n.toFixed(2).replace('.', ','); }
  function setOp(el, v) { el.style.opacity = v >= 1 ? '' : v.toFixed(3); }
  // gambar garis dari awal sampai k (0..1); butuh pathLength=1 pada elemen
  function drawIn(el, k) {
    if (k >= 1) { el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; }
    else { el.style.strokeDasharray = '1'; el.style.strokeDashoffset = (1 - k).toFixed(4); }
  }
  function seeded(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function label(parent, x, y, txt, anchor) {
    var t = mk('text', { 'class': 'hc-lab', x: x, y: y, 'text-anchor': anchor || 'start' }, parent);
    t.textContent = txt;
    return t;
  }
  function axis(parent) { return mk('line', { 'class': 'hc-axis', x1: X0, y1: BASE, x2: X1, y2: BASE }, parent); }

  /* =====================================================================
     Adegan 1 - Kurva normal: mean bergeser, sigma menyempit/melebar
     ===================================================================== */
  function sceneNormal() {
    var g = mk('g', {}, svg);
    axis(g);
    var band = mk('path', { 'class': 'hc-band' }, g);
    var area = mk('path', { 'class': 'hc-area', fill: 'url(#heroFill)' }, g);
    var mean = mk('line', { 'class': 'hc-mean', y1: BASE, y2: 40 }, g);
    var line = mk('path', { 'class': 'hc-line', pathLength: 1 }, g);
    var ring = mk('circle', { 'class': 'hc-ring', r: 6 }, g);
    var dot = mk('circle', { 'class': 'hc-dot', r: 3.5 }, g);
    var ttl = label(g, X1, 24, 'N(μ, σ²)', 'end');

    var tickG = mk('g', { 'class': 'hc-ticks' }, g);
    var ticks = [['μ−2σ', -2], ['μ−σ', -1], ['μ', 0], ['μ+σ', 1], ['μ+2σ', 2]].map(function (t) {
      var tx = mk('text', { 'class': 'hc-tick', y: BASE + 20, 'text-anchor': 'middle' }, tickG);
      tx.textContent = t[0];
      var tk = mk('line', { 'class': 'hc-axis', y1: BASE, y2: BASE + 5 }, tickG);
      return { z: t[1], text: tx, tick: tk };
    });

    var SIG0 = 62, H0 = 150;
    function draw(muShift, sFac) {
      var mu = CX + muShift, sig = SIG0 * sFac;
      var H = Math.min(H0 / sFac, 168);
      var d = '', i, x, y, n = 96;
      for (i = 0; i <= n; i++) {
        x = X0 + (X1 - X0) * i / n;
        var z = (x - mu) / sig;
        y = BASE - H * Math.exp(-z * z / 2);
        d += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y);
      }
      line.setAttribute('d', d);
      area.setAttribute('d', d + 'L' + X1 + ' ' + BASE + 'L' + X0 + ' ' + BASE + 'Z');

      var bx0 = Math.max(X0, mu - sig), bx1 = Math.min(X1, mu + sig), bd = 'M' + f1(bx0) + ' ' + BASE, m = 24;
      for (i = 0; i <= m; i++) {
        x = bx0 + (bx1 - bx0) * i / m;
        var zz = (x - mu) / sig;
        bd += 'L' + f1(x) + ' ' + f1(BASE - H * Math.exp(-zz * zz / 2));
      }
      band.setAttribute('d', bd + 'L' + f1(bx1) + ' ' + BASE + 'Z');

      var top = BASE - H;
      mean.setAttribute('x1', f1(mu)); mean.setAttribute('x2', f1(mu)); mean.setAttribute('y2', f1(top - 4));
      dot.setAttribute('cx', f1(mu)); dot.setAttribute('cy', f1(top));
      ring.setAttribute('cx', f1(mu)); ring.setAttribute('cy', f1(top));

      ticks.forEach(function (t) {
        var tx = mu + t.z * sig;
        var vis = tx > X0 + 14 && tx < X1 - 14;
        t.text.setAttribute('x', f1(tx)); t.tick.setAttribute('x1', f1(tx)); t.tick.setAttribute('x2', f1(tx));
        t.text.style.opacity = vis ? '' : '0';
        t.tick.style.opacity = vis ? '' : '0';
      });
    }

    return {
      name: 'normal', dur: 14, g: g,
      render: function (t, still) {
        var intro = still ? 1 : seg(t, 0.2, 2.6);
        drawIn(line, smooth(intro));
        var fade = still ? 1 : smooth(seg(t, 1.6, 2.8));
        [area, band, mean, dot, tickG, ttl].forEach(function (el) { setOp(el, fade); });
        var k = still ? 0 : smooth(seg(t, 2.4, 4.4));
        draw(k * 30 * Math.sin(t * TAU / 10), 1 + k * 0.2 * Math.sin(t * TAU / 14 + 1));
        // cincin berdenyut di puncak, tiap 3 detik
        if (still || t < 2.4) { ring.style.opacity = '0'; }
        else {
          var p = ((t - 2.4) % 3) / 3;
          ring.setAttribute('r', (6 * (0.6 + 1.8 * p)).toFixed(2));
          ring.style.opacity = (0.9 * (1 - p)).toFixed(3);
        }
      }
    };
  }

  /* =====================================================================
     Adegan 2 - Scatter plot + garis regresi, bergoyang, lalu residual
     ===================================================================== */
  function sceneScatter() {
    var g = mk('g', {}, svg);
    axis(g);
    var rnd = seeded(8675309);
    var N = 16, pts = [], i;
    for (i = 0; i < N; i++) {
      var x = 60 + 480 * (i + 0.5) / N + (rnd() - 0.5) * 18;
      var y = 166 - 0.2 * (x - 60) + (rnd() - 0.5) * 54;
      pts.push({ x: x, y: y, order: 0 });
    }
    // urutan muncul diacak agar terasa seperti data yang masuk satu per satu
    var ord = pts.map(function (_, k) { return k; });
    for (i = N - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = ord[i]; ord[i] = ord[j]; ord[j] = tmp; }
    ord.forEach(function (idx, k) { pts[idx].order = k; });

    // OLS sungguhan pada satuan data (x: 0-10, y: 0-~12) agar label ŷ dan r² jujur
    var xd = pts.map(function (p) { return (p.x - X0) / 56; });
    var yd = pts.map(function (p) { return (BASE - p.y) / 12; });
    var mx = 0, my = 0;
    for (i = 0; i < N; i++) { mx += xd[i]; my += yd[i]; }
    mx /= N; my /= N;
    var sxx = 0, sxy = 0, syy = 0;
    for (i = 0; i < N; i++) { sxx += (xd[i] - mx) * (xd[i] - mx); sxy += (xd[i] - mx) * (yd[i] - my); syy += (yd[i] - my) * (yd[i] - my); }
    var b = sxy / sxx, a = my - b * mx, r2 = (sxy * sxy) / (sxx * syy);
    var xbar = X0 + mx * 56;                                   // pusat putar garis (px)
    function yLine(px, delta) { return BASE - 12 * (a + b * ((px - X0) / 56)) + delta * (px - xbar); }

    var resG = mk('g', { 'class': 'hc-resg' }, g);
    var res = pts.map(function (p) { return mk('line', { 'class': 'hc-res', x1: f1(p.x), x2: f1(p.x) }, resG); });
    var reg = mk('path', { 'class': 'hc-line', pathLength: 1 }, g);
    var dots = pts.map(function (p) { return mk('circle', { 'class': 'hc-pt', cx: f1(p.x), cy: f1(p.y), r: 0 }, g); });
    var l1 = label(g, X0 + 6, 26, 'ŷ = ' + fmt(a) + ' + ' + fmt(b) + 'x', 'start');
    var l2 = label(g, X0 + 6, 46, 'r² = ' + fmt(r2), 'start');

    return {
      name: 'scatter', dur: 15, g: g,
      render: function (t, still) {
        for (var k = 0; k < N; k++) {
          var ta = 0.3 + pts[k].order * 0.2;
          var pk = still ? 1 : seg(t, ta, ta + 0.45);
          dots[k].setAttribute('r', pk <= 0 ? '0' : (3.4 * outBack(pk)).toFixed(2));
        }
        var w = still ? 0 : smooth(seg(t, 6.2, 8.2));
        var delta = w * 0.05 * Math.sin((t - 6.2) * TAU / 6);
        reg.setAttribute('d', 'M40 ' + f1(yLine(40, delta)) + 'L560 ' + f1(yLine(560, delta)));
        drawIn(reg, still ? 1 : smooth(seg(t, 3.8, 5.8)));
        var lab = still ? 1 : smooth(seg(t, 5.8, 6.8));
        setOp(l1, lab); setOp(l2, lab);
        setOp(resG, still ? 1 : smooth(seg(t, 8, 9.4)));
        for (var m = 0; m < N; m++) {
          res[m].setAttribute('y1', f1(pts[m].y));
          res[m].setAttribute('y2', f1(yLine(pts[m].x, delta)));
        }
      }
    };
  }

  /* =====================================================================
     Adegan 3 - Time series mengalir dari kiri, lalu ramalan + pita interval
     ===================================================================== */
  function sceneSeries() {
    var g = mk('g', {}, svg);
    axis(g);
    var NH = 40, SPLIT = 380, H = 12, i, h;
    var rnd = seeded(20261029);
    function trendSeason(s) { return 165 - 1.5 * s + 12 * Math.sin(s * TAU / 8); }
    var hist = [];
    for (i = 0; i < NH; i++) hist.push({ x: X0 + (SPLIT - X0) * i / (NH - 1), y: trendSeason(i) + (rnd() - 0.5) * 10 });
    var last = hist[NH - 1];
    var off = last.y - trendSeason(NH - 1);
    var fMean = [last.y], fHw = [0];
    for (h = 1; h <= H; h++) {
      var s = NH - 1 + h;
      fMean.push(165 - 1.5 * s + 12 * Math.sin(s * TAU / 8) * Math.pow(0.86, h) + off * Math.pow(0.6, h));
      fHw.push(4 + 3.4 * Math.pow(h, 0.9));
    }
    function fx(hh) { return SPLIT + (X1 - SPLIT) * hh / H; }

    var hd = '', i2;
    for (i2 = 0; i2 < NH; i2++) hd += (i2 ? 'L' : 'M') + f1(hist[i2].x) + ' ' + f1(hist[i2].y);
    var area = mk('path', { 'class': 'hc-area', fill: 'url(#heroFill)', d: hd + 'L' + f1(SPLIT) + ' ' + BASE + 'L' + X0 + ' ' + BASE + 'Z' }, g);
    var split = mk('line', { 'class': 'hc-mean', x1: SPLIT, x2: SPLIT, y1: BASE, y2: 40 }, g);
    var ci = mk('path', { 'class': 'hc-ci' }, g);
    var hline = mk('path', { 'class': 'hc-line', pathLength: 1, d: hd }, g);
    var fc = mk('path', { 'class': 'hc-fc' }, g);
    var dot = mk('circle', { 'class': 'hc-dot', r: 3.5, cx: f1(last.x), cy: f1(last.y) }, g);
    var tn = mk('text', { 'class': 'hc-tick', x: SPLIT, y: BASE + 20, 'text-anchor': 'middle' }, g); tn.textContent = 'n';
    var tt = mk('text', { 'class': 'hc-tick', x: X1, y: BASE + 20, 'text-anchor': 'end' }, g); tt.textContent = 't';
    var l1 = label(g, X0 + 6, 26, 'ARIMA(p, d, q)', 'start');
    var l2 = label(g, X0 + 6, 46, 'ŷₙ₊ₕ ± IK 95%', 'start');

    return {
      name: 'series', dur: 15, g: g,
      render: function (t, still) {
        drawIn(hline, still ? 1 : smooth(seg(t, 0.2, 3.4)));
        setOp(area, still ? 1 : smooth(seg(t, 1.4, 3.4)));
        var sp = still ? 1 : smooth(seg(t, 3.2, 3.9));
        setOp(split, sp); setOp(dot, sp); setOp(tn, sp); setOp(tt, sp);
        var lab = still ? 1 : smooth(seg(t, 6.4, 7.4));
        setOp(l1, lab); setOp(l2, lab);

        var f = still ? 1 : seg(t, 3.8, 6.6);
        var w = still ? 0 : smooth(seg(t, 6.6, 8.6));
        var shift = w * 6 * Math.sin((t - 6.6) * TAU / 9);
        var ciK = 1 + w * 0.12 * Math.sin((t - 6.6) * TAU / 11 + 1);
        var m = f * H, steps = Math.floor(m), frac = m - steps;
        var xs = [], ym = [], hw = [];
        for (h = 0; h <= steps && h <= H; h++) { xs.push(fx(h)); ym.push(fMean[h] + shift * h / H); hw.push(fHw[h] * ciK); }
        if (steps < H && frac > 0) {
          xs.push(fx(m)); hw.push((fHw[steps] + (fHw[steps + 1] - fHw[steps]) * frac) * ciK);
          ym.push(fMean[steps] + (fMean[steps + 1] - fMean[steps]) * frac + shift * m / H);
        }
        var fd = '', up = '', lo = '', n = xs.length, q;
        for (q = 0; q < n; q++) {
          fd += (q ? 'L' : 'M') + f1(xs[q]) + ' ' + f1(ym[q]);
          up += (q ? 'L' : 'M') + f1(xs[q]) + ' ' + f1(ym[q] - hw[q]);
        }
        for (q = n - 1; q >= 0; q--) lo += 'L' + f1(xs[q]) + ' ' + f1(ym[q] + hw[q]);
        fc.setAttribute('d', n > 1 ? fd : '');
        ci.setAttribute('d', n > 1 ? up + lo + 'Z' : '');
      }
    };
  }

  /* ---------- Rangkai adegan ---------- */
  var scenes = [sceneNormal(), sceneScatter(), sceneSeries()];   // urutan putar
  var cur = 0, age = 0;

  function show(i) {
    scenes.forEach(function (s, j) { s.g.setAttribute('display', j === i ? 'inline' : 'none'); });
    layer.setAttribute('data-scene', scenes[i].name);
  }
  show(0);
  banner.insertBefore(layer, banner.firstChild);

  if (reduce) { scenes[0].render(99, true); layer.classList.add('is-static'); return; }
  scenes[0].render(0, false);

  /* ---------- Putar & ganti adegan ---------- */
  var raf = 0, last = 0, inView = true;

  function step() {
    var s = scenes[cur];
    if (age >= s.dur) { cur = (cur + 1) % scenes.length; age = 0; show(cur); s = scenes[cur]; }
    svg.style.opacity = age > s.dur - FADE ? '0' : '1';
    s.render(age, false);
  }
  function frame(now) {
    raf = 0;
    if (!inView || document.hidden) return;
    if (!last) last = now;
    var dt = now - last;
    if (dt >= 33) {                              // ~30 fps cukup untuk gerak lambat
      last = now;
      age += Math.min(dt, 100) / 1000;           // jeda tab tidak melompatkan waktu adegan
      step();
    }
    raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && inView && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
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

/* ---------- Halaman masuk: simbol menyebar di seluruh latar (kartu putih menutupi bagian tengah) ---------- */
(function () {
  'use strict';
  var view = document.getElementById('view-login');
  if (!view || view.querySelector('.login-stat')) return;

  var SYMS = ['μ','σ','Σ','α','r²','p','x̄','z','χ²','β','ρ','H₀','t','n','F','s²','λ','R²','df','θ'];
  var COLS = 7, ROWS = 5, seed = 20261029;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }  // acak tetap, hasil sama tiap muat

  var layer = document.createElement('div');
  layer.className = 'login-stat';
  layer.setAttribute('aria-hidden', 'true');

  var cells = [];
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) cells.push([r, c]);
  // acak urutan sel agar simbol kecil/besar tidak berkelompok
  for (var i = cells.length - 1; i > 0; i--) { var k = Math.floor(rnd() * (i + 1)); var tmp = cells[i]; cells[i] = cells[k]; cells[k] = tmp; }

  cells.forEach(function (cell, n) {
    var el = document.createElement('span');
    el.className = 'hero-sym';
    el.textContent = SYMS[n % SYMS.length];
    var left = (cell[1] + 0.15 + rnd() * 0.7) / COLS * 100;
    var top = (cell[0] + 0.15 + rnd() * 0.7) / ROWS * 100;
    var size = 18 + Math.round(rnd() * 26);
    var o = (0.07 + rnd() * 0.12).toFixed(2);
    var dx = Math.round((rnd() - 0.5) * 36), dy = Math.round((rnd() - 0.5) * 36);
    var dur = (8 + rnd() * 8).toFixed(1), del = (-rnd() * 12).toFixed(1);
    el.style.cssText = 'left:' + left.toFixed(1) + '%;top:' + top.toFixed(1) + '%;font-size:' + size + 'px;--o:' + o +
      ';--dx:' + dx + 'px;--dy:' + dy + 'px;--dur:' + dur + 's;--del:' + del + 's';
    layer.appendChild(el);
  });
  view.insertBefore(layer, view.firstChild);
})();
