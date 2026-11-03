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
  window.StatSvg = { lines, scatter, scree, dendrogram, palette, nf };
})();
