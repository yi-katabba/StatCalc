/* =========================================================================
   STAT CHARTS - pustaka grafik SVG untuk grafik pendukung tiap metode Stat
   -------------------------------------------------------------------------
   Muat SETELAH Method/Graph/graph-core.js dan boxplot.js (memakai GraphCore.u).
   Semua fungsi mengembalikan string SVG (viewBox 640 x H) yang bisa
   ditampilkan di halaman, diunduh sebagai PNG/SVG, dan disisipkan ke .docx.
   ========================================================================= */
(function () {
  'use strict';
  if (!window.GraphCore) { console.error('stat-charts.js: GraphCore belum dimuat.'); return; }
  const u = GraphCore.u;
  const { esc, fmt, INK, SOFT, GRID, AXIS, ST } = u;
  /* Warna mengikuti gaya bersama u.ST (diatur pita Warna/Garis kisi di panel grafik, lihat export-hasil.js).
     Tanpa pengaturan pita, nilainya sama dengan bawaan lama, jadi tampilan tidak berubah. */
  const palAt = (k) => ST.pal[k % ST.pal.length];
  /* Modul Stat menulis warna bawaan secara literal; terjemahkan ke warna gaya agar ikut berubah.
     #22384A = warna utama, #BD7E1F = warna sorotan, #2F7F79 = warna ke-3 palet. Warna lain (status/abu-abu) tetap. */
  const tone = (c) => (c === '#22384A' ? ST.c1 : c === '#BD7E1F' ? ST.c2 : c === '#2F7F79' ? ST.pal[2 % ST.pal.length] : c);

  const f1 = (v) => (+v).toFixed(1);
  const finite = (v) => v !== null && v !== undefined && Number.isFinite(v);

  /* ------------------------------ Util ------------------------------ */
  function legendSvg(L, items, y) {
    if (!items || !items.length) return '';
    let x = L.m.l, s = '';
    items.forEach((it) => {
      const nm = String(it.name), w = Math.round(nm.length * 6.3) + 34;
      if (it.kind === 'box') s += `<rect x="${x}" y="${y - 8}" width="12" height="10" fill="${it.color}" fill-opacity=".85"/>`;
      else if (it.kind === 'dot') s += `<circle cx="${x + 9}" cy="${y - 3}" r="4" fill="${it.color}"/>`;
      else {
        s += `<line x1="${x}" x2="${x + 18}" y1="${y - 3}" y2="${y - 3}" stroke="${it.color}" stroke-width="2.2"${it.dash ? ' stroke-dasharray="6 4"' : ''}/>`;
        if (it.marker !== false) s += `<circle cx="${x + 9}" cy="${y - 3}" r="3" fill="${it.color}"/>`;
      }
      s += `<text x="${x + 24}" y="${y}" font-size="11" fill="${SOFT}">${esc(nm)}</text>`;
      x += w;
    });
    return s;
  }
  function withLegend(L, hasLegend) { if (hasLegend) { L.m.t += 18; L.ph -= 18; } return L; }
  function hline(L, sc, y, color, dash, label) {
    const py = u.sy(L, sc)(y);
    if (py < L.m.t - 1 || py > L.m.t + L.ph + 1) return '';
    return `<line x1="${L.m.l}" x2="${L.W - L.m.r}" y1="${py.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${color}" stroke-width="1.5"${dash ? ' stroke-dasharray="6 4"' : ''}/>` +
      (label ? `<text x="${L.W - L.m.r - 4}" y="${(py - 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="${color}">${esc(label)}</text>` : '');
  }
  function range(vals, pad) {
    const a = vals.filter(finite);
    let lo = u.min(a), hi = u.max(a);
    if (pad && hi > lo) { const d = (hi - lo) * pad; lo -= d; hi += d; }
    return { lo, hi };
  }
  function noData(msg) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120" font-family="Inter, Arial, sans-serif"><rect width="640" height="120" fill="#fff"/><text x="320" y="64" text-anchor="middle" font-size="14" fill="${SOFT}">${esc(msg)}</text></svg>`;
  }

  /* ------------------------------ Garis ------------------------------ */
  /* o: {title,xLabel,yLabel,labels:[...],series:[{name,values,color,dash,marker}],hlines:[{y,label,color,dash}],yMin,yMax,H}
     values boleh null (celah garis). */
  function line(o) {
    const n = o.labels.length;
    const allv = [];
    o.series.forEach((s) => s.values.forEach((v) => { if (finite(v)) allv.push(v); }));
    (o.hlines || []).forEach((h) => allv.push(h.y));
    if (!allv.length) return noData('Tidak ada data untuk digambar.');
    let r = range(allv, 0.06);
    if (o.yMin !== undefined) r.lo = Math.min(r.lo, o.yMin);
    if (o.yMax !== undefined) r.hi = Math.max(r.hi, o.yMax);
    const sys = u.niceTicks(r.lo, r.hi);
    const showL = o.series.length > 1 || (o.series[0] && o.series[0].name && o.legend);
    const step = Math.max(1, Math.ceil(n / 12));
    const shown = o.labels.filter((_, i) => i % step === 0).map(String);
    const rot = u.needRot(shown);
    const L = withLegend(u.layout({ title: o.title, ml: u.mlFor(sys.ticks, !!o.yLabel), mb: (rot ? Math.min(100, 38 + Math.max.apply(null, shown.map((x) => x.length)) * 4.2) : 36) + (o.xLabel ? 22 : 0), H: o.H || 380 }), showL);
    const py = u.sy(L, sys);
    const inset = Math.min(18, L.pw / (n * 2));
    const px = (i) => L.m.l + inset + (n === 1 ? (L.pw - 2 * inset) / 2 : i / (n - 1) * (L.pw - 2 * inset));
    let s = u.head(L, o.title) + u.gridY(L, sys, o.yLabel);
    const yb = L.m.t + L.ph;
    s += `<line x1="${L.m.l}" y1="${yb}" x2="${L.W - L.m.r}" y2="${yb}" stroke="${AXIS}"/>`;
    o.labels.forEach((lb, i) => {
      if (i % step) return;
      const x = px(i);
      if (ST.on && ST.v) s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${L.m.t}" y2="${yb}" stroke="${ST.gc}"/>`;
      s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yb}" y2="${yb + 4}" stroke="${AXIS}"/>`;
      s += rot
        ? `<text transform="translate(${x.toFixed(1)} ${yb + 14}) rotate(-40)" text-anchor="end" font-size="11" fill="${SOFT}">${esc(String(lb))}</text>`
        : `<text x="${x.toFixed(1)}" y="${yb + 17}" text-anchor="middle" font-size="11" fill="${SOFT}">${esc(String(lb))}</text>`;
    });
    if (o.xLabel) s += `<text x="${(L.m.l + L.pw / 2).toFixed(1)}" y="${L.H - 10}" text-anchor="middle" font-size="12" fill="${INK}">${esc(o.xLabel)}</text>`;
    (o.hlines || []).forEach((h) => { s += hline(L, sys, h.y, tone(h.color) || ST.c2, h.dash !== false, h.label); });
    const items = [];
    o.series.forEach((se, k) => {
      const col = tone(se.color) || palAt(k);
      let d = '', pen = false;
      se.values.forEach((v, i) => {
        if (!finite(v)) { pen = false; return; }
        d += (pen ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1) + ' ';
        pen = true;
      });
      if (se.line !== false) s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${se.width || 2}"${se.dash ? ' stroke-dasharray="6 4"' : ''} stroke-linejoin="round"/>`;
      if (se.marker !== false && n <= 60) se.values.forEach((v, i) => { if (finite(v)) s += `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="${n > 30 ? 2.4 : 3.6}" fill="${col}" stroke="#fff" stroke-width="1"/>`; });
      items.push({ name: se.name || 'Seri ' + (k + 1), color: col, dash: se.dash, marker: se.marker });
    });
    if (showL) s += legendSvg(L, items, 46);
    return s + '</svg>';
  }

  /* ------------------------------ Scatter ------------------------------ */
  /* o: {title,xLabel,yLabel,x,y,fit:{a,b,name},diag,hzero,sameScale,color,legendFit} */
  function scatter(o) {
    const n = o.x.length;
    if (!n) return noData('Tidak ada data untuk digambar.');
    let xr = range(o.x, 0.06), yr = range(o.y.concat(o.hzero ? [0] : []), 0.08);
    if (o.diag || o.sameScale) { const lo = Math.min(xr.lo, yr.lo), hi = Math.max(xr.hi, yr.hi); xr = { lo, hi }; yr = { lo, hi }; }
    if (o.fit) { const a = o.fit.a, b = o.fit.b; yr = { lo: Math.min(yr.lo, a + b * xr.lo, a + b * xr.hi), hi: Math.max(yr.hi, a + b * xr.lo, a + b * xr.hi) }; }
    const sxs = u.niceTicks(xr.lo, xr.hi), sys = u.niceTicks(yr.lo, yr.hi);
    const hasLeg = !!(o.fit && o.fit.name) || !!o.diag;
    const L = withLegend(u.layout({ title: o.title, ml: u.mlFor(sys.ticks, !!o.yLabel), xl: !!o.xLabel, H: o.H || 400 }), hasLeg);
    const px = u.sx(L, sxs), py = u.sy(L, sys);
    let s = u.head(L, o.title) + u.gridY(L, sys, o.yLabel) + u.axisX(L, sxs, o.xLabel, true);
    const items = [];
    if (o.hzero) s += hline(L, sys, 0, '#948C77', true);
    if (o.diag) { s += `<line x1="${px(sxs.lo).toFixed(1)}" y1="${py(sxs.lo).toFixed(1)}" x2="${px(sxs.hi).toFixed(1)}" y2="${py(sxs.hi).toFixed(1)}" stroke="${ST.c2}" stroke-width="2" stroke-dasharray="6 4"/>`; items.push({ name: 'Garis y = x (prediksi sempurna)', color: ST.c2, dash: true, marker: false }); }
    if (o.fit) {
      s += `<line x1="${px(xr.lo).toFixed(1)}" y1="${py(o.fit.a + o.fit.b * xr.lo).toFixed(1)}" x2="${px(xr.hi).toFixed(1)}" y2="${py(o.fit.a + o.fit.b * xr.hi).toFixed(1)}" stroke="${ST.c2}" stroke-width="2.4"/>`;
      if (o.fit.name) items.push({ name: o.fit.name, color: ST.c2, marker: false });
    }
    const col = tone(o.color) || ST.c1;
    o.x.forEach((x, i) => { s += `<circle cx="${px(x).toFixed(1)}" cy="${py(o.y[i]).toFixed(1)}" r="4.3" fill="${col}" fill-opacity=".8" stroke="#fff" stroke-width="1"/>`; });
    if (items.length) s += legendSvg(L, items, 46);
    return s + '</svg>';
  }

  /* ------------------------------ Q-Q normal ------------------------------ */
  function qq(vals, o) {
    o = o || {};
    const n = vals.length;
    if (n < 3) return noData('Data terlalu sedikit untuk Q-Q plot (minimal 3).');
    const m = u.mean(vals), sd = u.sd(vals) || 1;
    const sorted = u.sortedAsc(vals).map((v) => (v - m) / sd);
    const th = sorted.map((_, i) => u.invNorm((i + 0.5) / n));
    // garis acuan melalui kuartil 1 dan 3 (seperti qqline)
    const q1 = u.quantile(sorted, 0.25), q3 = u.quantile(sorted, 0.75), z1 = u.invNorm(0.25), z3 = u.invNorm(0.75);
    const b = (q3 - q1) / (z3 - z1), a = q1 - b * z1;
    return scatter({ title: o.title || 'Q-Q Plot Normal', xLabel: 'Kuantil normal teoritis', yLabel: o.yLabel || 'Kuantil sampel (terstandar)', x: th, y: sorted, fit: { a, b, name: 'Garis acuan kuartil' }, color: o.color });
  }

  /* ------------------------------ Histogram ------------------------------ */
  function hist(vals, o) {
    o = o || {};
    const n = vals.length;
    if (n < 3) return noData('Data terlalu sedikit untuk histogram (minimal 3).');
    const dmin = u.min(vals), dmax = u.max(vals);
    let k = Math.max(3, Math.min(20, Math.ceil(1 + Math.log2(n))));
    let w, lo;
    if (dmin === dmax) { w = 1; lo = dmin - 0.5; k = 1; }
    else {
      const raw = (dmax - dmin) / k, mag = Math.pow(10, Math.floor(Math.log10(raw)));
      w = [1, 2, 2.5, 5, 10].map((m) => m * mag).reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
      lo = Math.floor(dmin / w + 1e-9) * w;
      k = Math.max(1, Math.ceil((dmax - lo) / w - 1e-9));
    }
    const hi = lo + k * w, counts = new Array(k).fill(0);
    vals.forEach((x) => { counts[Math.min(k - 1, Math.max(0, Math.floor((x - lo) / w + 1e-12)))]++; });
    const m = u.mean(vals), sd = u.sd(vals);
    const curve = o.normal !== false && sd > 0;
    const pdf = (x) => n * w * Math.exp(-0.5 * ((x - m) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
    const maxY = Math.max(u.max(counts), curve ? pdf(m) : 0);
    const sys = u.niceTicks(0, maxY * 1.1, 6, true);
    const sxs = { lo, hi, ticks: Array.from({ length: k + 1 }, (_, i) => +(lo + i * w).toPrecision(12)) };
    const tickShow = k <= 12 ? sxs.ticks : sxs.ticks.filter((_, i) => i % Math.ceil(k / 10) === 0);
    const L = withLegend(u.layout({ title: o.title || 'Histogram', ml: u.mlFor(sys.ticks, true), xl: true, H: o.H || 380 }), curve);
    const px = u.sx(L, sxs), py = u.sy(L, sys);
    let s = u.head(L, o.title || 'Histogram') + u.gridY(L, sys, 'Frekuensi') + u.axisX(L, sxs, o.xLabel || 'Nilai', false, tickShow);
    counts.forEach((c, i) => {
      const x0 = px(lo + i * w), x1 = px(lo + (i + 1) * w);
      s += `<rect x="${(x0 + 0.5).toFixed(1)}" y="${py(c).toFixed(1)}" width="${Math.max(1, x1 - x0 - 1).toFixed(1)}" height="${(py(0) - py(c)).toFixed(1)}" fill="${tone(o.color) || ST.c1}" fill-opacity=".72"/>`;
    });
    if (curve) {
      let d = '';
      for (let i = 0; i <= 60; i++) { const x = lo + (hi - lo) * i / 60; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(pdf(x)).toFixed(1) + ' '; }
      s += `<path d="${d}" fill="none" stroke="${ST.c2}" stroke-width="2.2"/>` + legendSvg(L, [{ name: 'Kurva normal (rata-rata & s.baku sampel)', color: ST.c2, marker: false }], 46);
    }
    return s + '</svg>';
  }

  /* ------------------------------ Batang ------------------------------ */
  /* o: {title,xLabel,yLabel,labels,values,colors,color,hlines,valueLabels,thin} */
  function bars(o) {
    const n = o.labels.length;
    if (!n) return noData('Tidak ada data untuk digambar.');
    const vv = o.values.filter(finite).concat([0]).concat((o.hlines || []).map((h) => h.y));
    const r = range(vv, 0.08);
    const sys = u.niceTicks(r.lo, r.hi);
    const labs = o.labels.map(String);
    const step = Math.max(1, Math.ceil(n / 24));
    const L = u.layout({ title: o.title, ml: u.mlFor(sys.ticks, !!o.yLabel), mb: u.catBottom(labs, !!o.xLabel), H: o.H || 360 });
    const py = u.sy(L, sys);
    const ax = u.axisCat(L, labs.map((l, i) => (i % step ? '' : l)), o.xLabel);
    let s = u.head(L, o.title) + u.gridY(L, sys, o.yLabel) + ax.svg;
    const bw = o.thin ? Math.min(5, ax.bw * 0.4) : Math.min(56, ax.bw * 0.64), y0 = py(0);
    o.values.forEach((v, i) => {
      if (!finite(v)) return;
      const cx = ax.cx(i), yv = py(v), col = tone((o.colors && o.colors[i]) || o.color) || ST.c1;
      s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${Math.min(y0, yv).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Math.abs(yv - y0)).toFixed(1)}" fill="${col}" fill-opacity=".85"/>`;
      if (o.valueLabels && n <= 14) s += `<text x="${cx.toFixed(1)}" y="${(v >= 0 ? yv - 5 : yv + 13).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="${INK}">${esc(fmt(v))}</text>`;
    });
    s += `<line x1="${L.m.l}" x2="${L.W - L.m.r}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" stroke="${AXIS}"/>`;
    (o.hlines || []).forEach((h) => { s += hline(L, sys, h.y, tone(h.color) || ST.c2, h.dash !== false, h.label); });
    return s + '</svg>';
  }

  /* Batang berkelompok: o.series=[{name,values}], o.labels = kategori sumbu x */
  function gbars(o) {
    const n = o.labels.length, m = o.series.length;
    const vals = [0]; o.series.forEach((se) => se.values.forEach((v) => { if (finite(v)) vals.push(v); }));
    const sys = u.niceTicks(range(vals, 0.1).lo, range(vals, 0.1).hi);
    const labs = o.labels.map(String);
    const L = withLegend(u.layout({ title: o.title, ml: u.mlFor(sys.ticks, !!o.yLabel), mb: u.catBottom(labs, !!o.xLabel), H: o.H || 380 }), m > 1);
    const py = u.sy(L, sys), ax = u.axisCat(L, labs, o.xLabel);
    let s = u.head(L, o.title) + u.gridY(L, sys, o.yLabel) + ax.svg;
    const bw = Math.min(40, (ax.bw * 0.78) / m), y0 = py(0);
    o.series.forEach((se, k) => {
      const col = tone(se.color) || palAt(k);
      se.values.forEach((v, i) => {
        if (!finite(v)) return;
        const cx = ax.cx(i) - (m * bw) / 2 + bw * (k + 0.5), yv = py(v);
        s += `<rect x="${(cx - bw / 2 + 0.5).toFixed(1)}" y="${Math.min(y0, yv).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.max(1, Math.abs(yv - y0)).toFixed(1)}" fill="${col}" fill-opacity=".85"/>`;
      });
    });
    s += `<line x1="${L.m.l}" x2="${L.W - L.m.r}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" stroke="${AXIS}"/>`;
    if (m > 1) s += legendSvg(L, o.series.map((se, k) => ({ name: se.name, color: tone(se.color) || palAt(k), kind: 'box' })), 46);
    return s + '</svg>';
  }

  /* ------------------------------ Interval plot ------------------------------ */
  /* o: {title,xLabel,yLabel,labels,means,lo,hi,grand,note} */
  function intervals(o) {
    const n = o.labels.length;
    const vv = o.lo.concat(o.hi).concat(o.means).concat(finite(o.grand) ? [o.grand] : []);
    const r = range(vv, 0.1), sys = u.niceTicks(r.lo, r.hi);
    const labs = o.labels.map(String);
    const L = withLegend(u.layout({ title: o.title, ml: u.mlFor(sys.ticks, !!o.yLabel), mb: u.catBottom(labs, !!o.xLabel), H: o.H || 380 }), true);
    const py = u.sy(L, sys), ax = u.axisCat(L, labs, o.xLabel);
    let s = u.head(L, o.title) + u.gridY(L, sys, o.yLabel) + ax.svg;
    if (finite(o.grand)) s += hline(L, sys, o.grand, ST.c2, true);
    o.means.forEach((m, i) => {
      const cx = ax.cx(i), col = palAt(i), cap = Math.min(10, ax.bw * 0.18);
      if (finite(o.lo[i]) && finite(o.hi[i])) {
        s += `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${py(o.lo[i]).toFixed(1)}" y2="${py(o.hi[i]).toFixed(1)}" stroke="${col}" stroke-width="2"/>` +
          `<line x1="${(cx - cap).toFixed(1)}" x2="${(cx + cap).toFixed(1)}" y1="${py(o.lo[i]).toFixed(1)}" y2="${py(o.lo[i]).toFixed(1)}" stroke="${col}" stroke-width="2"/>` +
          `<line x1="${(cx - cap).toFixed(1)}" x2="${(cx + cap).toFixed(1)}" y1="${py(o.hi[i]).toFixed(1)}" y2="${py(o.hi[i]).toFixed(1)}" stroke="${col}" stroke-width="2"/>`;
      }
      s += `<circle cx="${cx.toFixed(1)}" cy="${py(m).toFixed(1)}" r="5" fill="${col}" stroke="#fff" stroke-width="1.2"/>`;
    });
    const items = [{ name: o.note || 'Rata-rata \u00B1 selang kepercayaan 95%', color: INK, kind: 'dot' }];
    if (finite(o.grand)) items.push({ name: 'Rata-rata keseluruhan', color: ST.c2, dash: true, marker: false });
    s += legendSvg(L, items, 46);
    return s + '</svg>';
  }

  /* ------------------------------ Strip plot (nilai individual) ------------------------------ */
  function strip(groups, o) {
    o = o || {};
    const all = [].concat.apply([], groups.map((g) => g.vals));
    const r = range(all, 0.08), sys = u.niceTicks(r.lo, r.hi);
    const names = groups.map((g) => g.name);
    const L = withLegend(u.layout({ title: o.title, ml: u.mlFor(sys.ticks, !!o.yLabel), mb: u.catBottom(names, !!o.xLabel), H: o.H || 380 }), true);
    const py = u.sy(L, sys), ax = u.axisCat(L, names, o.xLabel);
    let s = u.head(L, o.title) + u.gridY(L, sys, o.yLabel) + ax.svg;
    groups.forEach((g, i) => {
      const cx = ax.cx(i), col = palAt(i), half = Math.min(30, ax.bw * 0.3);
      const sorted = u.sortedAsc(g.vals), cnt = {};
      sorted.forEach((v, k) => {
        const key = py(v).toFixed(0); cnt[key] = (cnt[key] || 0) + 1;
        const off = (cnt[key] % 2 ? 1 : -1) * Math.ceil((cnt[key] - 1) / 2) * 7;
        s += `<circle cx="${(cx + Math.max(-half, Math.min(half, off))).toFixed(1)}" cy="${py(v).toFixed(1)}" r="4" fill="${col}" fill-opacity=".72" stroke="#fff" stroke-width="1"/>`;
      });
      const m = u.mean(g.vals);
      s += `<line x1="${(cx - half - 4).toFixed(1)}" x2="${(cx + half + 4).toFixed(1)}" y1="${py(m).toFixed(1)}" y2="${py(m).toFixed(1)}" stroke="${INK}" stroke-width="2.4"/>`;
    });
    s += legendSvg(L, [{ name: 'Nilai individual', color: SOFT, kind: 'dot' }, { name: 'Garis hitam = rata-rata kelompok', color: INK, marker: false }], 46);
    return s + '</svg>';
  }

  /* ------------------------------ ACF ------------------------------ */
  function acfValues(x, maxLag) {
    const n = x.length, m = u.mean(x);
    let c0 = 0; x.forEach((v) => { c0 += (v - m) * (v - m); });
    const out = [];
    for (let k = 1; k <= maxLag; k++) {
      let c = 0; for (let t = k; t < n; t++) c += (x[t] - m) * (x[t - k] - m);
      out.push(c0 > 0 ? c / c0 : NaN);
    }
    return out;
  }
  function acf(x, o) {
    o = o || {};
    const n = x.length;
    if (n < 6) return noData('Data terlalu sedikit untuk ACF (minimal 6).');
    const maxLag = Math.max(2, Math.min(o.maxLag || 20, Math.floor(n / 2) - 1, n - 2));
    const v = acfValues(x, maxLag), b = 1.96 / Math.sqrt(n);
    const col = v.map((a) => (Math.abs(a) > b ? '#B5532F' : ST.c1));
    return bars({
      title: o.title || 'Autokorelasi (ACF)', xLabel: 'Lag', yLabel: 'Autokorelasi',
      labels: v.map((_, i) => i + 1), values: v, colors: col, thin: true,
      hlines: [{ y: b, label: '+1,96/\u221An', color: '#948C77' }, { y: -b, color: '#948C77' }], H: o.H || 340,
    });
  }

  /* Kuantil sebaran t (p = peluang kumulatif). Tepat untuk db 1-2, aproksimasi Cornish-Fisher untuk db lain. */
  function tQuantile(p, df) {
    if (df <= 0) return NaN;
    if (df === 1) return Math.tan(Math.PI * (p - 0.5));
    if (df === 2) return (2 * p - 1) / Math.sqrt(2 * p * (1 - p));
    const z = u.invNorm(p), z2 = z * z, z3 = z2 * z, z5 = z3 * z2, z7 = z5 * z2;
    return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df) +
      (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df * df * df);
  }

  window.StatCharts = { tQuantile, line, scatter, qq, hist, bars, gbars, intervals, strip, acf, acfValues, box: (groups, o) => u.boxSvg(groups, o).svg, noData };
})();
