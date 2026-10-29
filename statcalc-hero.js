/* StatCalc - animasi header Beranda: enam adegan bergantian (kurva normal, histogram -> normal, scatter + regresi,
   uji hipotesis H0 vs H1, time series + ramalan, kontur RSM + optimum)
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

  /* =====================================================================
     Adegan 4 - Histogram -> kurva normal (menu Deskriptif):
     batang menjulang dari sampel kecil yang berantakan, lalu makin rapi
     mengikuti kurva N(x̄, s²) seiring n bertambah
     ===================================================================== */
  function sceneHistogram() {
    var g = mk('g', {}, svg);
    axis(g);
    var K = 13, BX0 = 60, BW = 480 / K, MU = 300, SG = 85, HP = 140, i;
    var rnd = seeded(31415926);
    var bars = [], ideal = [], nz = [], add = [];
    for (i = 0; i < K; i++) {
      var z = (BX0 + BW * (i + 0.5) - MU) / SG;
      ideal.push(HP * Math.exp(-z * z / 2));
      nz.push((rnd() - 0.5) * 0.9);
      add.push(rnd() * 16);
      bars.push(mk('rect', { 'class': 'hc-bar', x: f1(BX0 + BW * i + 1.5), width: f1(BW - 3), y: BASE, height: 0 }, g));
    }
    var mean = mk('line', { 'class': 'hc-mean', x1: MU, x2: MU, y1: BASE, y2: 44 }, g);
    var d = '', n = 96, x;
    for (i = 0; i <= n; i++) {
      x = X0 + (X1 - X0) * i / n;
      var zz = (x - MU) / SG;
      d += (i ? 'L' : 'M') + f1(x) + ' ' + f1(BASE - HP * Math.exp(-zz * zz / 2));
    }
    var curve = mk('path', { 'class': 'hc-line', pathLength: 1, d: d }, g);
    var tk = mk('text', { 'class': 'hc-tick', x: MU, y: BASE + 20, 'text-anchor': 'middle' }, g); tk.textContent = 'x̄';
    var l1 = label(g, X0 + 6, 26, 'Histogram → N(x̄, s²)', 'start');
    var l2 = label(g, X0 + 6, 46, 'n = 20', 'start');
    var lastN = -1;

    return {
      name: 'histogram', dur: 15, g: g,
      render: function (t, still) {
        var conv = still ? 1 : smooth(seg(t, 3.8, 9.2));
        var w = still ? 0 : smooth(seg(t, 10.4, 12.4));
        for (var k = 0; k < K; k++) {
          var gr = still ? 1 : smooth(seg(t, 0.3 + k * 0.12, 1.5 + k * 0.12));
          var h = ideal[k] * (1 + nz[k] * (1 - conv)) + add[k] * (1 - conv);
          h = Math.max(0, h * (1 + 0.04 * w * Math.sin(t * 1.3 + k * 1.7))) * gr;
          bars[k].setAttribute('y', f1(BASE - h));
          bars[k].setAttribute('height', f1(h));
        }
        drawIn(curve, still ? 1 : smooth(seg(t, 8.6, 11)));
        var fd = still ? 1 : smooth(seg(t, 10.2, 11.2));
        setOp(mean, fd); setOp(tk, fd);
        var nn = Math.round(20 + 480 * conv * conv);
        if (nn !== lastN) { lastN = nn; l2.textContent = 'n = ' + nn; }
        var lab = still ? 1 : smooth(seg(t, 0.8, 1.8));
        setOp(l1, lab); setOp(l2, lab);
      }
    };
  }

  /* =====================================================================
     Adegan 5 - Uji hipotesis H0 vs H1 (menu Konsep Uji / ANOVA):
     daerah alpha (galat tipe I) dan beta (galat tipe II); beta berubah
     saat μ1 bergeser, nilainya dihitung sungguhan dari Φ
     ===================================================================== */
  function sceneTest() {
    var g = mk('g', {}, svg);
    axis(g);
    var SIG = 42, HP = 140, MU0 = 280, MU1 = 395, CZ = 1.645, CX0 = MU0 + CZ * SIG;
    function Phi(z) {
      var t = 1 / (1 + 0.2316419 * Math.abs(z)), dd = 0.3989423 * Math.exp(-z * z / 2);
      var p = dd * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
      return z > 0 ? 1 - p : p;
    }
    function yAt(x, mu) { var z = (x - mu) / SIG; return BASE - HP * Math.exp(-z * z / 2); }
    function curveD(mu) {
      var s = '', i, n = 96;
      for (i = 0; i <= n; i++) { var x = X0 + (X1 - X0) * i / n; s += (i ? 'L' : 'M') + f1(x) + ' ' + f1(yAt(x, mu)); }
      return s;
    }

    var aFill = mk('path', { 'class': 'hc-alpha' }, g);
    var bFill = mk('path', { 'class': 'hc-beta' }, g);
    var c0 = mk('path', { 'class': 'hc-line', pathLength: 1, d: curveD(MU0) }, g);
    var c1 = mk('path', { 'class': 'hc-line hc-line2', pathLength: 1 }, g);
    var crit = mk('line', { 'class': 'hc-mean', x1: f1(CX0), x2: f1(CX0), y1: BASE, y2: BASE }, g);
    var h0 = label(g, MU0, BASE - HP - 8, 'H₀', 'middle');
    var h1 = label(g, MU1, BASE - HP - 8, 'H₁', 'middle');
    var la = label(g, CX0 + 22, BASE - 46, 'α', 'start'); la.setAttribute('class', 'hc-lab hc-lab-a');
    var lb = label(g, CX0 - 16, BASE - 12, 'β', 'end'); lb.setAttribute('class', 'hc-lab hc-lab-b');

    var tickG = mk('g', {}, g);
    function tick(txt, x) {
      var tx = mk('text', { 'class': 'hc-tick', x: f1(x), y: BASE + 20, 'text-anchor': 'middle' }, tickG);
      tx.textContent = txt;
      var tl = mk('line', { 'class': 'hc-axis', x1: f1(x), x2: f1(x), y1: BASE, y2: BASE + 5 }, tickG);
      return { t: tx, l: tl };
    }
    var t0 = tick('μ₀', MU0), tc = tick('c', CX0), t1 = tick('μ₁', MU1);
    var l1 = label(g, X0 + 6, 26, 'H₀: μ = μ₀  vs  H₁: μ = μ₁', 'start');
    var l2 = label(g, X0 + 6, 46, '', 'start');
    var lastTxt = '';

    // alpha: ekor kanan H0 di kanan nilai kritis c
    var ad = 'M' + f1(CX0) + ' ' + BASE, i, x;
    for (i = 0; i <= 30; i++) { x = CX0 + (X1 - CX0) * i / 30; ad += 'L' + f1(x) + ' ' + f1(yAt(x, MU0)); }
    aFill.setAttribute('d', ad + 'L' + X1 + ' ' + BASE + 'Z');

    return {
      name: 'test', dur: 16, g: g,
      render: function (t, still) {
        var w = still ? 0 : smooth(seg(t, 9.4, 11.4));
        var mu1 = MU1 + w * 26 * Math.sin((t - 9.4) * TAU / 9);
        c1.setAttribute('d', curveD(mu1));
        var bd = 'M' + X0 + ' ' + BASE;
        for (i = 0; i <= 40; i++) { x = X0 + (CX0 - X0) * i / 40; bd += 'L' + f1(x) + ' ' + f1(yAt(x, mu1)); }
        bFill.setAttribute('d', bd + 'L' + f1(CX0) + ' ' + BASE + 'Z');

        drawIn(c0, still ? 1 : smooth(seg(t, 0.2, 2.4)));
        drawIn(c1, still ? 1 : smooth(seg(t, 2.6, 4.8)));
        setOp(h0, still ? 1 : smooth(seg(t, 1.8, 2.6)));
        setOp(h1, still ? 1 : smooth(seg(t, 4.2, 5)));
        var kc = still ? 1 : smooth(seg(t, 5.2, 6));
        crit.setAttribute('y2', f1(BASE - (BASE - 40) * kc));
        setOp(tc.t, kc); setOp(tc.l, kc);
        var m = still ? 1 : smooth(seg(t, 0.2, 1));
        setOp(t0.t, m); setOp(t0.l, m);
        var m1 = still ? 1 : smooth(seg(t, 3, 3.8));
        t1.t.setAttribute('x', f1(mu1)); t1.l.setAttribute('x1', f1(mu1)); t1.l.setAttribute('x2', f1(mu1));
        h1.setAttribute('x', f1(mu1));
        setOp(t1.t, m1); setOp(t1.l, m1);
        setOp(aFill, still ? 1 : smooth(seg(t, 6, 7)));
        setOp(bFill, still ? 1 : smooth(seg(t, 7.2, 8.2)));
        setOp(la, still ? 1 : smooth(seg(t, 6.6, 7.4)));
        setOp(lb, still ? 1 : smooth(seg(t, 7.8, 8.6)));
        var beta = Phi((CX0 - mu1) / SIG);
        var txt = 'α = 0,05  ·  β = ' + fmt(beta) + '  ·  1 − β = ' + fmt(1 - beta);
        if (txt !== lastTxt) { lastTxt = txt; l2.textContent = txt; }
        setOp(l1, still ? 1 : smooth(seg(t, 0.8, 1.8)));
        setOp(l2, still ? 1 : smooth(seg(t, 8.2, 9.2)));
      }
    };
  }

  /* =====================================================================
     Adegan 6 - Kontur RSM + titik optimum (menu RSM):
     kontur elips respon kuadratik, jalur pendakian curam menuju optimum
     ===================================================================== */
  function sceneRSM() {
    var g = mk('g', {}, svg);
    axis(g);
    mk('line', { 'class': 'hc-axis', x1: X0, y1: BASE, x2: X0, y2: 70 }, g);
    var CXm = 420, CYm = 112, RX = 140, RY = 66, PHI = -0.35;
    var LV = [[90, 0.30], [85, 0.564], [80, 0.739], [75, 0.879], [70, 1]];   // [nilai ŷ, skala jari-jari]
    var NP = 72, i;

    var cons = LV.map(function (lv) { return mk('path', { 'class': 'hc-contour', pathLength: 1 }, g); });
    var vals = LV.map(function (lv) {
      var tx = mk('text', { 'class': 'hc-tick', 'text-anchor': 'start' }, g);
      tx.textContent = String(lv[0]);
      return tx;
    });
    var asc = mk('path', { 'class': 'hc-fc' }, g);
    var head = mk('circle', { 'class': 'hc-dot', r: 3.5 }, g);
    var ring = mk('circle', { 'class': 'hc-ring', r: 8 }, g);
    var star = mk('path', { 'class': 'hc-opt' }, g);
    var sd = '';
    for (i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4.2 : 10;
      sd += (i ? 'L' : 'M') + f1(rr * Math.cos(ang)) + ' ' + f1(rr * Math.sin(ang));
    }
    star.setAttribute('d', sd + 'Z');
    var lx = label(g, X1, BASE + 20, 'x₁', 'end'); lx.setAttribute('class', 'hc-tick');
    var ly = label(g, X0 + 8, 66, 'x₂', 'start'); ly.setAttribute('class', 'hc-tick');
    var l1 = label(g, X0 + 6, 26, 'ŷ = β₀ + Σβᵢxᵢ + Σβᵢᵢxᵢ² + Σβᵢⱼxᵢxⱼ', 'start');
    var l2 = label(g, X0 + 6, 46, 'x* = titik optimum', 'start');
    var U0 = -1.2 * RX, V0 = -0.9 * RY;

    return {
      name: 'rsm', dur: 16, g: g,
      render: function (t, still) {
        var w = still ? 0 : smooth(seg(t, 9.6, 11.6));
        var cx = CXm + w * 7 * Math.sin((t - 9.6) * TAU / 10);
        var cy = CYm + w * 4 * Math.cos((t - 9.6) * TAU / 12);
        var phi = PHI + w * 0.09 * Math.sin((t - 9.6) * TAU / 13);
        var cp = Math.cos(phi), sp = Math.sin(phi);
        function px(u, v) { return cx + u * cp - v * sp; }
        function py(u, v) { return cy + u * sp + v * cp; }

        for (var j = 0; j < LV.length; j++) {
          var s = LV[j][1], d = '', q;
          for (q = 0; q < NP; q++) {
            var th = TAU * q / NP;
            d += (q ? 'L' : 'M') + f1(px(RX * s * Math.cos(th), RY * s * Math.sin(th))) + ' ' + f1(py(RX * s * Math.cos(th), RY * s * Math.sin(th)));
          }
          cons[j].setAttribute('d', d + 'Z');
          var ta = 0.3 + (LV.length - 1 - j) * 0.55;               // kontur terluar tergambar lebih dulu
          drawIn(cons[j], still ? 1 : smooth(seg(t, ta, ta + 1.4)));
          vals[j].setAttribute('x', f1(px(RX * s, 0) + 5));
          vals[j].setAttribute('y', f1(py(RX * s, 0) + 4));
          setOp(vals[j], still ? 1 : smooth(seg(t, ta + 1, ta + 1.8)));
        }
        setOp(lx, still ? 1 : smooth(seg(t, 0.4, 1.2)));
        setOp(ly, still ? 1 : smooth(seg(t, 0.4, 1.2)));
        setOp(l1, still ? 1 : smooth(seg(t, 1, 2)));

        // jalur pendakian curam: u dan v menyusut dengan laju berbeda (elips gepeng -> melengkung)
        var k = still ? 1 : seg(t, 4.2, 8);
        var ad = '', hx = cx, hy = cy, steps = Math.max(1, Math.round(k * 48));
        for (q = 0; q <= steps; q++) {
          var sk = k * q / steps, fin = 1 - smooth(seg(sk, 0.86, 1));
          var uu = U0 * Math.exp(-2.2 * sk) * fin, vv = V0 * Math.exp(-2.2 * 4.6 * sk) * fin;
          hx = px(uu, vv); hy = py(uu, vv);
          ad += (q ? 'L' : 'M') + f1(hx) + ' ' + f1(hy);
        }
        asc.setAttribute('d', k > 0 ? ad : '');
        head.setAttribute('cx', f1(hx)); head.setAttribute('cy', f1(hy));
        setOp(head, still ? 0 : (k > 0 && k < 1 ? smooth(seg(t, 4.2, 4.8)) : 0));
        if (still || k >= 1) head.style.opacity = '0';

        var ks = still ? 1 : seg(t, 8, 8.9);
        star.setAttribute('transform', 'translate(' + f1(cx) + ' ' + f1(cy) + ') scale(' + (ks <= 0 ? 0 : outBack(ks)).toFixed(3) + ')');
        setOp(l2, still ? 1 : smooth(seg(t, 8, 9)));
        if (still || t < 8.9) { ring.style.opacity = '0'; }
        else {
          var p = ((t - 8.9) % 3) / 3;
          ring.setAttribute('cx', f1(cx)); ring.setAttribute('cy', f1(cy));
          ring.setAttribute('r', (8 * (0.7 + 2 * p)).toFixed(2));
          ring.style.opacity = (0.9 * (1 - p)).toFixed(3);
        }
      }
    };
  }

  /* ---------- Rangkai adegan ---------- */
  // urutan putar: selang-seling agar tiap kelompok menu (Deskriptif, Regresi, Konsep Uji, Time Series, RSM) bergantian
  var scenes = [sceneNormal(), sceneHistogram(), sceneScatter(), sceneTest(), sceneSeries(), sceneRSM()];
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
