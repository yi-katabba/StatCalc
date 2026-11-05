/* =========================================================================
   SVG-HELPERS - grafik SVG ringan tanpa pustaka (garis, pencar, scree, dendrogram) untuk halaman Multivariate & Time Series
   API (window.StatSvg): lines(opts), scatter(opts), scree(eig), dendrogram(merges, n, labels, k), palette
   Semua warna memakai variabel tema (--ink, --rule, --accent-2) sehingga ikut mode terang/gelap.
   ========================================================================= */
(function () {
  'use strict';
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const palette = ['#2f6bb3', '#d9822b', '#2f9e6f', '#a04aa8', '#c2493d', '#5f7385', '#b8a21f', '#1f8a99', '#8a5a16', '#6b3b7c'];
  const nf = (v) => { if (!Number.isFinite(v)) return ''; const a = Math.abs(v); return String(Number((a >= 1000 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toPrecision(3)))).replace('.', ','); };
  function ticks(a, b, count) { const r = (b - a) / count || 1, p = Math.pow(10, Math.floor(Math.log10(r))), f = r / p, s = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, o = []; for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + 1e-9; v += s) o.push(Math.abs(v) < s * 1e-9 ? 0 : v); return o; }
  const head = (w, h, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" style="width:100%;max-width:${Math.min(w, 680)}px;height:auto;display:block;margin:12px auto 0;font-family:var(--font-body);font-size:11px">`;
  function frame(w, h, L, R, T, B, xs, ys, sx, sy, xl, yl, xticks) {
    let s = '';
    (xticks || ticks(xs[0], xs[1], 7)).forEach((v) => { s += `<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${h - B}" style="stroke:var(--rule)"/><text x="${sx(v)}" y="${h - B + 15}" text-anchor="middle" style="fill:var(--ink-soft)">${esc(nf(v))}</text>`; });
    ticks(ys[0], ys[1], 6).forEach((v) => { s += `<line x1="${L}" y1="${sy(v)}" x2="${w - R}" y2="${sy(v)}" style="stroke:var(--rule)"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end" style="fill:var(--ink-soft)">${esc(nf(v))}</text>`; });
    s += `<rect x="${L}" y="${T}" width="${w - L - R}" height="${h - T - B}" style="fill:none;stroke:var(--ink-faint)"/>`;
    if (xl) s += `<text x="${(L + w - R) / 2}" y="${h - 5}" text-anchor="middle" style="fill:var(--ink)">${esc(xl)}</text>`;
    if (yl) s += `<text transform="rotate(-90)" x="${-(T + h - B) / 2}" y="13" text-anchor="middle" style="fill:var(--ink)">${esc(yl)}</text>`;
    return s;
  }
  /* lines: {series:[{name,y,x?,dash?,color?,dots?}], x?: array x bersama, title, xlabel, ylabel, w, h, zeroLine, hline} */
  function lines(o) {
    const w = o.w || 600, h = o.h || 260, L = 56, R = 14, T = 12, B = 38, ser = o.series, n = Math.max.apply(null, ser.map((s) => s.y.length)), xs0 = o.x || Array.from({ length: n }, (_, i) => i + 1);
    const all = [].concat.apply([], ser.map((s) => s.y.filter(Number.isFinite))); if (o.hline !== undefined) all.push(o.hline); let y0 = Math.min.apply(null, all), y1 = Math.max.apply(null, all); const pad = (y1 - y0) * 0.07 || 1; y0 -= pad; y1 += pad;
    const x0 = Math.min.apply(null, xs0), x1 = Math.max.apply(null, xs0), sx = (v) => L + (v - x0) / ((x1 - x0) || 1) * (w - L - R), sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B);
    let s = head(w, h, o.title || 'Grafik garis') + frame(w, h, L, R, T, B, [x0, x1], [y0, y1], sx, sy, o.xlabel, o.ylabel, o.xticks);
    if (o.hline !== undefined) s += `<line x1="${L}" y1="${sy(o.hline)}" x2="${w - R}" y2="${sy(o.hline)}" style="stroke:var(--ink-faint);stroke-dasharray:5 4"/>`;
    ser.forEach((se, k) => {
      const col = se.color || palette[k % palette.length]; let d = '', pen = false;
      se.y.forEach((v, i) => { const x = (se.x || xs0)[i]; if (!Number.isFinite(v)) { pen = false; return; } d += (pen ? ' L' : ' M') + sx(x).toFixed(1) + ',' + sy(v).toFixed(1); pen = true; });
      s += `<path d="${d}" style="fill:none;stroke:${col};stroke-width:${se.width || 2};${se.dash ? 'stroke-dasharray:' + se.dash : ''}"/>`;
      if (se.dots) se.y.forEach((v, i) => { if (Number.isFinite(v)) s += `<circle cx="${sx((se.x || xs0)[i]).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="3.2" style="fill:${col}"/>`; });
    });
    if (ser.length > 1 || o.legend) { let lx = L + 8; ser.forEach((se, k) => { const col = se.color || palette[k % palette.length]; s += `<line x1="${lx}" y1="${T + 11}" x2="${lx + 16}" y2="${T + 11}" style="stroke:${col};stroke-width:2.4;${se.dash ? 'stroke-dasharray:' + se.dash : ''}"/><text x="${lx + 20}" y="${T + 15}" style="fill:var(--ink)">${esc(se.name || '')}</text>`; lx += 30 + 6.2 * String(se.name || '').length; }); }
    return s + '</svg>';
  }
  function scree(eig) {
    return lines({ title: 'Scree plot', series: [{ name: 'Nilai eigen', y: eig, dots: true }], x: eig.map((_, i) => i + 1), xlabel: 'Komponen / faktor', ylabel: 'Nilai eigen (λ)', hline: 1, w: 520, h: 250, xticks: eig.map((_, i) => i + 1) });
  }
  /* scatter: {pts:[[x,y]], groups?:[int], labels?:[str], xlabel, ylabel, centers?:[[x,y]]} */
  function scatter(o) {
    const w = o.w || 560, h = o.h || 330, L = 54, R = 14, T = 12, B = 38, xs = o.pts.map((p) => p[0]), ys = o.pts.map((p) => p[1]).concat((o.centers || []).map((c) => c[1])), xs2 = xs.concat((o.centers || []).map((c) => c[0]));
    let x0 = Math.min.apply(null, xs2), x1 = Math.max.apply(null, xs2), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys); const px = (x1 - x0) * 0.07 || 1, py = (y1 - y0) * 0.07 || 1; x0 -= px; x1 += px; y0 -= py; y1 += py;
    const sx = (v) => L + (v - x0) / (x1 - x0) * (w - L - R), sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B);
    let s = head(w, h, o.title || 'Diagram pencar') + frame(w, h, L, R, T, B, [x0, x1], [y0, y1], sx, sy, o.xlabel, o.ylabel);
    if (o.zero) { if (x0 < 0 && x1 > 0) s += `<line x1="${sx(0)}" y1="${T}" x2="${sx(0)}" y2="${h - B}" style="stroke:var(--ink-faint);stroke-dasharray:4 3"/>`; if (y0 < 0 && y1 > 0) s += `<line x1="${L}" y1="${sy(0)}" x2="${w - R}" y2="${sy(0)}" style="stroke:var(--ink-faint);stroke-dasharray:4 3"/>`; }
    o.pts.forEach((p, i) => { const col = o.groups ? palette[o.groups[i] % palette.length] : palette[0]; s += `<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="${o.r || 4}" style="fill:${col};fill-opacity:.8;stroke:#fff;stroke-width:.6"/>`; if (o.labels && o.pts.length <= 60) s += `<text x="${(sx(p[0]) + 6).toFixed(1)}" y="${(sy(p[1]) - 5).toFixed(1)}" style="fill:var(--ink-soft);font-size:10px">${esc(o.labels[i])}</text>`; });
    (o.centers || []).forEach((c, k) => { s += `<path d="M${sx(c[0]) - 6},${sy(c[1])} h12 M${sx(c[0])},${sy(c[1]) - 6} v12" style="stroke:${palette[k % palette.length]};stroke-width:3"/><circle cx="${sx(c[0])}" cy="${sy(c[1])}" r="7" style="fill:none;stroke:var(--ink);stroke-width:1.2"/>`; });
    if (o.groups) { const ks = Array.from(new Set(o.groups)).sort((a, b) => a - b); let lx = L + 8; ks.forEach((k) => { s += `<circle cx="${lx}" cy="${T + 12}" r="4.5" style="fill:${palette[k % palette.length]}"/><text x="${lx + 8}" y="${T + 16}" style="fill:var(--ink)">Klaster ${k + 1}</text>`; lx += 70; }); }
    return s + '</svg>';
  }
  /* dendrogram: merges [{a,b,h}], n, labels, cut k klaster (garis potong) */
  function dendrogram(merges, n, labels, k, leafOrder) {
    const order = leafOrder, pos = {}, w = 620, hgt = 300, L = 46, R = 12, T = 14, B = n <= 40 ? 54 : 22; order.forEach((id, i) => { pos[id] = i; });
    const maxH = merges[merges.length - 1].h * 1.04, sx = (i) => L + (i + 0.5) / n * (w - L - R), sy = (v) => T + (1 - v / maxH) * (hgt - T - B);
    const xp = {}, yp = {}; for (let i = 0; i < n; i++) { xp[i] = sx(pos[i]); yp[i] = sy(0); }
    let s = head(w, hgt, 'Dendrogram klaster hierarki'); ticks(0, maxH, 6).forEach((v) => { s += `<line x1="${L}" y1="${sy(v)}" x2="${w - R}" y2="${sy(v)}" style="stroke:var(--rule)"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end" style="fill:var(--ink-soft)">${esc(nf(v))}</text>`; });
    s += `<text transform="rotate(-90)" x="${-(T + hgt - B) / 2}" y="12" text-anchor="middle" style="fill:var(--ink)">Jarak penggabungan</text>`;
    const cutH = k >= 2 && k <= n ? (merges[n - k - 1].h + merges[n - k].h) / 2 : null;
    merges.forEach((m, i) => { const id = n + i, ya = yp[m.a], yb = yp[m.b], yh = sy(m.h), xa = xp[m.a], xb = xp[m.b]; s += `<path d="M${xa.toFixed(1)},${ya.toFixed(1)} V${yh.toFixed(1)} H${xb.toFixed(1)} V${yb.toFixed(1)}" style="fill:none;stroke:var(--accent-2);stroke-width:1.6"/>`; xp[id] = (xa + xb) / 2; yp[id] = yh; });
    if (cutH !== null) s += `<line x1="${L}" y1="${sy(cutH)}" x2="${w - R}" y2="${sy(cutH)}" style="stroke:#c2493d;stroke-dasharray:6 4;stroke-width:1.4"/><text x="${w - R - 4}" y="${sy(cutH) - 4}" text-anchor="end" style="fill:#c2493d">${k} klaster</text>`;
    if (n <= 40) order.forEach((id, i) => { s += `<text transform="rotate(-60 ${sx(i)} ${hgt - B + 10})" x="${sx(i)}" y="${hgt - B + 10}" text-anchor="end" style="fill:var(--ink-soft);font-size:10px">${esc(labels[id])}</text>`; });
    return s + '</svg>';
  }

  /* ---------------------------- bagan kendali ---------------------------- */
  /* controlChart: {name, values, cl[], ucl[], lcl[], sigma[], hits:[[test,...]], ylabel, w, h, zones} */
  function controlChart(o) {
    const w = o.w || 640, h = o.h || 270, L = 58, R = 16, T = 14, B = 36, n = o.values.length, xs = Array.from({ length: n }, (_, i) => i + 1), fin = (a) => a.filter(Number.isFinite);
    const all = fin(o.values).concat(fin(o.ucl), fin(o.lcl), fin(o.cl)); let y0 = Math.min.apply(null, all), y1 = Math.max.apply(null, all); const pad = (y1 - y0) * 0.08 || 1; y0 -= pad; y1 += pad;
    const sx = (v) => L + (v - 1) / ((n - 1) || 1) * (w - L - R), sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B), path = (arr, st) => { let d = '', pen = false; arr.forEach((v, i) => { if (!Number.isFinite(v)) { pen = false; return; } d += (pen ? ' L' : ' M') + sx(i + 1).toFixed(1) + ',' + sy(v).toFixed(1); pen = true; }); return `<path d="${d}" style="fill:none;${st}"/>`; };
    let s = head(w, h, o.name || 'Bagan kendali') + frame(w, h, L, R, T, B, [1, n], [y0, y1], sx, sy, 'Nomor sampel / subgrup', o.ylabel || o.name, n <= 30 ? xs : null);
    if (o.zones && o.sigma) [1, 2].forEach((k) => { [1, -1].forEach((sg) => { s += path(o.cl.map((c, i) => c + sg * k * o.sigma[i]), 'stroke:var(--ink-faint);stroke-width:.8;stroke-dasharray:2 3'); }); });
    s += path(o.ucl, 'stroke:#c2493d;stroke-width:1.6;stroke-dasharray:6 4') + path(o.lcl, 'stroke:#c2493d;stroke-width:1.6;stroke-dasharray:6 4') + path(o.cl, 'stroke:#2f9e6f;stroke-width:1.8');
    const lastOf = (a) => a[a.length - 1];
    s += `<text x="${w - R - 3}" y="${sy(lastOf(o.ucl)) - 4}" text-anchor="end" style="fill:#c2493d">UCL = ${nf(lastOf(o.ucl))}</text><text x="${w - R - 3}" y="${sy(lastOf(o.cl)) - 4}" text-anchor="end" style="fill:#2f9e6f">CL = ${nf(lastOf(o.cl))}</text><text x="${w - R - 3}" y="${sy(lastOf(o.lcl)) + 12}" text-anchor="end" style="fill:#c2493d">LCL = ${nf(lastOf(o.lcl))}</text>`;
    s += path(o.values, 'stroke:' + palette[0] + ';stroke-width:1.6');
    o.values.forEach((v, i) => { if (!Number.isFinite(v)) return; const bad = o.hits && o.hits[i] && o.hits[i].length; s += `<circle cx="${sx(i + 1).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="${bad ? 4.8 : 3}" style="fill:${bad ? '#c2493d' : palette[0]};stroke:#fff;stroke-width:.7"/>`; if (bad) s += `<text x="${sx(i + 1).toFixed(1)}" y="${(sy(v) - 8).toFixed(1)}" text-anchor="middle" style="fill:#c2493d;font-size:10px;font-weight:700">${o.hits[i].join(',')}</text>`; });
    return s + '</svg>';
  }
  /* hist: {data, lsl, usl, target, curves:[{mu,sigma,name,dash,color}], xlabel} */
  function hist(o) {
    const w = 620, h = 300, L = 54, R = 14, T = 16, B = 38, d = o.data, n = d.length, dmin = Math.min.apply(null, d), dmax = Math.max.apply(null, d), nb = Math.max(6, Math.min(30, Math.ceil(Math.log2(n) + 1) + 2));
    let lo = Math.min(dmin, Number.isFinite(o.lsl) ? o.lsl : dmin), hi = Math.max(dmax, Number.isFinite(o.usl) ? o.usl : dmax); const span = (hi - lo) || 1; lo -= span * 0.05; hi += span * 0.05;
    const bw = (hi - lo) / (nb * 2.2), b0 = Math.min(dmin, dmax) - bw * 0.0, k = Math.max(5, Math.ceil((dmax - dmin) / ((dmax - dmin) / nb || 1))), step = (dmax - dmin) / nb || 1, cnt = new Array(nb).fill(0);
    d.forEach((v) => { let i = Math.floor((v - dmin) / step); if (i >= nb) i = nb - 1; cnt[i]++; });
    const curves = (o.curves || []).map((c) => ({ c, f: (x) => n * step * Math.exp(-0.5 * ((x - c.mu) / c.sigma) ** 2) / (c.sigma * Math.sqrt(2 * Math.PI)) })), ymax = Math.max(Math.max.apply(null, cnt), Math.max.apply(null, curves.map((cv) => cv.f(cv.c.mu))) || 0) * 1.12;
    const sx = (v) => L + (v - lo) / (hi - lo) * (w - L - R), sy = (v) => T + (1 - v / ymax) * (h - T - B);
    let s = head(w, h, 'Histogram kapabilitas proses') + frame(w, h, L, R, T, B, [lo, hi], [0, ymax], sx, sy, o.xlabel || 'Nilai', 'Frekuensi');
    cnt.forEach((c, i) => { s += `<rect x="${sx(dmin + i * step).toFixed(1)}" y="${sy(c).toFixed(1)}" width="${(sx(dmin + (i + 1) * step) - sx(dmin + i * step) - 1).toFixed(1)}" height="${(sy(0) - sy(c)).toFixed(1)}" style="fill:${palette[0]};fill-opacity:.32;stroke:${palette[0]}"/>`; });
    curves.forEach((cv, k) => { let p = ''; for (let i = 0; i <= 120; i++) { const x = lo + (hi - lo) * i / 120; p += (i ? ' L' : 'M') + sx(x).toFixed(1) + ',' + sy(cv.f(x)).toFixed(1); } s += `<path d="${p}" style="fill:none;stroke:${cv.c.color || palette[k + 1]};stroke-width:2;${cv.c.dash ? 'stroke-dasharray:' + cv.c.dash : ''}"/>`; });
    const vline = (v, col, lab, dash) => { if (!Number.isFinite(v)) return ''; return `<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${h - B}" style="stroke:${col};stroke-width:2;${dash ? 'stroke-dasharray:' + dash : ''}"/><text x="${sx(v) + 4}" y="${T + 11}" style="fill:${col};font-weight:700">${lab}</text>`; };
    s += vline(o.lsl, '#c2493d', 'LSL') + vline(o.usl, '#c2493d', 'USL') + vline(o.target, '#2f9e6f', 'Target', '5 3');
    let lx = L + 8, ly = h - B - 8 - curves.length * 14; curves.forEach((cv, k) => { s += `<line x1="${lx}" y1="${ly + k * 14}" x2="${lx + 18}" y2="${ly + k * 14}" style="stroke:${cv.c.color || palette[k + 1]};stroke-width:2;${cv.c.dash ? 'stroke-dasharray:' + cv.c.dash : ''}"/><text x="${lx + 22}" y="${ly + k * 14 + 4}" style="fill:var(--ink)">${esc(cv.c.name)}</text>`; });
    return s + '</svg>';
  }
  /* pareto: {labels, counts, cum (persen), title, xlabel} */
  function pareto(o) {
    const w = 640, h = 320, L = 56, R = 52, T = 16, B = o.labels.length > 8 ? 78 : 56, n = o.labels.length, tot = o.counts.reduce((a, b) => a + b, 0), cmax = Math.max.apply(null, o.counts) * 1.08;
    const bw = (w - L - R) / n, sx = (i) => L + (i + 0.5) * bw, sy = (v) => T + (1 - v / tot * 1) * 0 + (1 - v / cmax) * (h - T - B), sp = (p) => T + (1 - p / 100) * (h - T - B);
    let s = head(w, h, o.title || 'Diagram Pareto');
    ticks(0, cmax, 5).forEach((v) => { s += `<line x1="${L}" y1="${sy(v)}" x2="${w - R}" y2="${sy(v)}" style="stroke:var(--rule)"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end" style="fill:var(--ink-soft)">${esc(nf(v))}</text>`; });
    [0, 20, 40, 60, 80, 100].forEach((p) => { s += `<text x="${w - R + 6}" y="${sp(p) + 4}" style="fill:var(--ink-soft)">${p}%</text>`; });
    s += `<rect x="${L}" y="${T}" width="${w - L - R}" height="${h - T - B}" style="fill:none;stroke:var(--ink-faint)"/><line x1="${L}" y1="${sp(80)}" x2="${w - R}" y2="${sp(80)}" style="stroke:#c2493d;stroke-dasharray:5 4;stroke-width:1.2"/>`;
    o.counts.forEach((c, i) => { s += `<rect x="${(sx(i) - bw * 0.36).toFixed(1)}" y="${sy(c).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${(sy(0) - sy(c)).toFixed(1)}" style="fill:${palette[0]};fill-opacity:${i < (o.vital || 0) ? .85 : .35}"/><text x="${sx(i).toFixed(1)}" y="${(sy(c) - 4).toFixed(1)}" text-anchor="middle" style="fill:var(--ink);font-size:10px">${esc(nf(c))}</text>`; });
    s += `<path d="M${o.cum.map((p, i) => sx(i).toFixed(1) + ',' + sp(p).toFixed(1)).join(' L')}" style="fill:none;stroke:${palette[1]};stroke-width:2"/>` + o.cum.map((p, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sp(p).toFixed(1)}" r="3.4" style="fill:${palette[1]}"/>`).join('');
    o.labels.forEach((lb, i) => { const t = esc(lb.length > 16 ? lb.slice(0, 15) + '…' : lb); s += n > 6 ? `<text transform="rotate(-40 ${sx(i).toFixed(1)} ${h - B + 12})" x="${sx(i).toFixed(1)}" y="${h - B + 12}" text-anchor="end" style="fill:var(--ink);font-size:10.5px">${t}</text>` : `<text x="${sx(i).toFixed(1)}" y="${h - B + 15}" text-anchor="middle" style="fill:var(--ink)">${t}</text>`; });
    s += `<text transform="rotate(-90)" x="${-(T + h - B) / 2}" y="13" text-anchor="middle" style="fill:var(--ink)">Frekuensi</text>`;
    return s + '</svg>';
  }
  /* efekBars: batang horizontal |nilai| terurut + garis acuan: {labels, values, refs:[{v, label, color}], xlabel} */
  function effectBars(o) {
    const n = o.labels.length, rowH = 22, w = 620, L = 96, R = 22, T = 24, B = 38, h = T + B + n * rowH, vmax = Math.max.apply(null, o.values.concat((o.refs || []).map((r) => r.v))) * 1.08, sx = (v) => L + v / vmax * (w - L - R);
    let s = head(w, h, o.title || 'Diagram Pareto efek'); ticks(0, vmax, 6).forEach((v) => { s += `<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${h - B}" style="stroke:var(--rule)"/><text x="${sx(v)}" y="${h - B + 15}" text-anchor="middle" style="fill:var(--ink-soft)">${esc(nf(v))}</text>`; });
    s += `<rect x="${L}" y="${T}" width="${w - L - R}" height="${h - T - B}" style="fill:none;stroke:var(--ink-faint)"/>`;
    o.labels.forEach((lb, i) => { const y = T + i * rowH + 3, sig = o.sig && o.sig[i]; s += `<rect x="${L}" y="${y}" width="${(sx(o.values[i]) - L).toFixed(1)}" height="${rowH - 6}" style="fill:${sig ? palette[1] : palette[0]};fill-opacity:${sig ? .85 : .4}"/><text x="${L - 6}" y="${y + rowH - 9}" text-anchor="end" style="fill:var(--ink)">${esc(lb)}</text><text x="${(sx(o.values[i]) + 4).toFixed(1)}" y="${y + rowH - 9}" style="fill:var(--ink-soft);font-size:10px">${esc(nf(o.values[i]))}</text>`; });
    (o.refs || []).forEach((r) => { s += `<line x1="${sx(r.v)}" y1="${T}" x2="${sx(r.v)}" y2="${h - B}" style="stroke:${r.color || '#c2493d'};stroke-width:1.6;stroke-dasharray:6 4"/><text x="${sx(r.v) - 3}" y="${T - 6}" text-anchor="end" style="fill:${r.color || '#c2493d'};font-weight:700">${esc(r.label)} = ${esc(nf(r.v))}</text>`; });
    return s + `<text x="${(L + w - R) / 2}" y="${h - 5}" text-anchor="middle" style="fill:var(--ink)">${esc(o.xlabel || '')}</text></svg>`;
  }
  /* mainEffects: {names, means:[[rendah,tinggi]], grand, ylabel} */
  function mainEffects(o) {
    const k = o.names.length, pw = 150, w = Math.min(640, 60 + k * pw), h = 250, L = 54, T = 26, B = 36, all = [].concat.apply([], o.means).concat([o.grand]); let y0 = Math.min.apply(null, all), y1 = Math.max.apply(null, all); const pad = (y1 - y0) * 0.15 || 1; y0 -= pad; y1 += pad;
    const sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B), cw = (w - L - 8) / k;
    let s = head(w, h, 'Plot efek utama'); ticks(y0, y1, 5).forEach((v) => { s += `<line x1="${L}" y1="${sy(v)}" x2="${w - 8}" y2="${sy(v)}" style="stroke:var(--rule)"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end" style="fill:var(--ink-soft)">${esc(nf(v))}</text>`; });
    s += `<line x1="${L}" y1="${sy(o.grand)}" x2="${w - 8}" y2="${sy(o.grand)}" style="stroke:var(--ink-faint);stroke-dasharray:4 3"/>`;
    o.names.forEach((nm, j) => { const x0 = L + j * cw + cw * 0.22, x1 = L + j * cw + cw * 0.78, m = o.means[j]; s += `<rect x="${L + j * cw}" y="${T}" width="${cw}" height="${h - T - B}" style="fill:none;stroke:var(--ink-faint)"/><path d="M${x0},${sy(m[0])} L${x1},${sy(m[1])}" style="stroke:${palette[j % palette.length]};stroke-width:2.4;fill:none"/><circle cx="${x0}" cy="${sy(m[0])}" r="4" style="fill:${palette[j % palette.length]}"/><circle cx="${x1}" cy="${sy(m[1])}" r="4" style="fill:${palette[j % palette.length]}"/><text x="${L + j * cw + cw / 2}" y="${T - 8}" text-anchor="middle" style="fill:var(--ink);font-weight:700">${esc(nm)}</text><text x="${x0}" y="${h - B + 14}" text-anchor="middle" style="fill:var(--ink-soft)">rendah (−)</text><text x="${x1}" y="${h - B + 14}" text-anchor="middle" style="fill:var(--ink-soft)">tinggi (+)</text>`; });
    return s + `<text transform="rotate(-90)" x="${-(T + h - B) / 2}" y="13" text-anchor="middle" style="fill:var(--ink)">${esc(o.ylabel || 'Rata-rata respon')}</text></svg>`;
  }

  window.StatSvg = { lines, scatter, scree, dendrogram, controlChart, hist, pareto, effectBars, mainEffects, palette, nf };
})();
