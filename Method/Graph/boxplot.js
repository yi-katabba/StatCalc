/* Boxplot — per variabel (kolom = variabel, seperti Excel) atau per kelompok.
   boxSvg() juga dipakai ulang oleh Method/Shared/stat-charts.js (grafik pendukung ANOVA). */
(function () {
  'use strict';
  const u = GraphCore.u;
  const INKC = '#1C1E24';

  /* Kuartil: 'inc' = QUARTILE.INC (bawaan Excel), 'exc' = QUARTILE.EXC */
  function quart(s, p, method) {
    if (method !== 'exc') return u.quantile(s, p);
    const n = s.length, h = (n + 1) * p - 1;
    if (h <= 0) return s[0];
    if (h >= n - 1) return s[n - 1];
    const lo = Math.floor(h);
    return s[lo] + (h - lo) * (s[lo + 1] - s[lo]);
  }

  function stats(groups, method) {
    return groups.map((g) => {
      const vals = g.vals, s = u.sortedAsc(vals);
      const q1 = quart(s, 0.25, method), med = quart(s, 0.5, method), q3 = quart(s, 0.75, method), iqr = q3 - q1;
      const lf = q1 - 1.5 * iqr, uf = q3 + 1.5 * iqr;
      const inside = s.filter((x) => x >= lf && x <= uf);
      return {
        g: g.name, n: vals.length, vals, q1, med, q3, iqr, lf, uf,
        mean: u.mean(vals), sd: u.sd(vals),
        wlo: inside.length ? inside[0] : s[0], whi: inside.length ? inside[inside.length - 1] : s[s.length - 1],
        out: s.filter((x) => x < lf || x > uf), min: s[0], max: s[s.length - 1],
      };
    });
  }

  /* groups: [{name, vals:[...]}]; o: {title, xLabel, yLabel, qmethod, mean, pts, showOut} */
  function boxSvg(groups, o) {
    o = o || {};
    if (groups.length > 12) throw new Error('Maksimal 12 kelompok/variabel. Gabungkan atau kurangi terlebih dahulu.');
    const st = stats(groups, o.qmethod);
    const names = st.map((x) => x.g);
    const showOut = o.showOut !== false;
    const all = [].concat.apply([], groups.map((g) => g.vals));
    const lo0 = u.min(all), hi0 = u.max(all), pad = (hi0 - lo0) * 0.04 || 1;
    const sys = u.niceTicks(lo0 - pad, hi0 + pad);
    const title = o.title || 'Boxplot', xl = o.xLabel === undefined ? 'Kelompok' : o.xLabel, yl = o.yLabel === undefined ? 'Nilai' : o.yLabel;
    const L = u.layout({ title, ml: u.mlFor(sys.ticks, !!yl), mb: u.catBottom(names, !!xl) });
    const py = u.sy(L, sys);
    const ax = u.axisCat(L, names, xl);
    let s = u.head(L, title) + u.gridY(L, sys, yl) + ax.svg;
    const bwid = Math.min(64, ax.bw * 0.5);
    st.forEach((x, i) => {
      const cx = ax.cx(i), col = u.PAL[i % u.PAL.length], x0 = cx - bwid / 2;
      const whi = showOut ? x.whi : x.max, wlo = showOut ? x.wlo : x.min;
      s += `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${py(whi).toFixed(1)}" y2="${py(x.q3).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>` +
        `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${py(x.q1).toFixed(1)}" y2="${py(wlo).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>` +
        `<line x1="${(cx - bwid / 4).toFixed(1)}" x2="${(cx + bwid / 4).toFixed(1)}" y1="${py(whi).toFixed(1)}" y2="${py(whi).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>` +
        `<line x1="${(cx - bwid / 4).toFixed(1)}" x2="${(cx + bwid / 4).toFixed(1)}" y1="${py(wlo).toFixed(1)}" y2="${py(wlo).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>` +
        `<rect x="${x0.toFixed(1)}" y="${py(x.q3).toFixed(1)}" width="${bwid.toFixed(1)}" height="${Math.max(1, py(x.q1) - py(x.q3)).toFixed(1)}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="1.8"/>` +
        `<line x1="${x0.toFixed(1)}" x2="${(x0 + bwid).toFixed(1)}" y1="${py(x.med).toFixed(1)}" y2="${py(x.med).toFixed(1)}" stroke="${col}" stroke-width="3.2"/>`;
      if (o.pts) x.vals.forEach((v, k) => { const jx = cx + ((k % 7) - 3) * (bwid / 16); s += `<circle cx="${jx.toFixed(1)}" cy="${py(v).toFixed(1)}" r="2.4" fill="${col}" fill-opacity=".45"/>`; });
      if (showOut) x.out.forEach((v) => { s += `<circle cx="${cx.toFixed(1)}" cy="${py(v).toFixed(1)}" r="3.8" fill="#fff" stroke="${col}" stroke-width="1.6"/>`; });
      if (o.mean) { const my = py(x.mean), r = 5.5; s += `<path d="M${cx.toFixed(1)} ${(my - r).toFixed(1)} L${(cx + r).toFixed(1)} ${my.toFixed(1)} L${cx.toFixed(1)} ${(my + r).toFixed(1)} L${(cx - r).toFixed(1)} ${my.toFixed(1)} Z" fill="#fff" stroke="${INKC}" stroke-width="1.5"/>`; }
    });
    s += '</svg>';
    return { svg: s, stats: st };
  }
  u.boxSvg = boxSvg;
  u.boxStats = stats;

  function summaryTable(st, qmethod) {
    const rows = st.map((x) => [
      u.esc(x.g), x.n, u.fmt(x.min), u.fmt(x.q1), u.fmt(x.med), u.fmt(x.q3), u.fmt(x.max),
      u.fmt(x.mean), u.fmt(x.sd), u.fmt(x.iqr), x.out.length ? x.out.map(u.fmt).join('; ') : '\u2013',
    ]);
    return u.grid(['Variabel / Kelompok', 'n', 'Min', 'Q1', 'Median', 'Q3', 'Maks', 'Rata-rata', 'S. baku', 'IQR', 'Pencilan'], rows,
      'Ringkasan lima angka ' + (qmethod === 'exc' ? '(kuartil eksklusif, QUARTILE.EXC)' : '(kuartil inklusif, QUARTILE.INC)'));
  }
  function interpretation(multi) {
    return u.note('<strong>Cara membaca:</strong> kotak = 50% data di tengah (Q1&ndash;Q3), garis tebal = median, belah ketupat = rata-rata, kumis = data terjauh dalam 1,5&times;IQR dari kotak, lingkaran kosong = pencilan. ' +
      (multi ? 'Jika kotak antar variabel/kelompok hampir tidak tumpang tindih, kemungkinan ada perbedaan nyata; ujilah dengan <em>Metode &rsaquo; Stat &rsaquo; ANOVA</em>.' : 'Median yang tidak di tengah kotak atau kumis yang tidak simetris menandakan sebaran yang miring.'));
  }

  const OPTIONS = [
    { key: 'qmethod', type: 'select', label: 'Metode kuartil', def: 'inc', choices: [['inc', 'Inklusif (QUARTILE.INC, bawaan Excel)'], ['exc', 'Eksklusif (QUARTILE.EXC)']] },
    { key: 'mean', type: 'checkbox', label: 'Tandai rata-rata (belah ketupat)', def: true },
    { key: 'showOut', type: 'checkbox', label: 'Tampilkan pencilan', def: true },
    { key: 'pts', type: 'checkbox', label: 'Tampilkan semua titik data', def: false },
  ];

  GraphCore.add({
    id: 'boxplot', title: 'Boxplot', types: ['numerik1', 'kelompok'],
    lede: 'Tampilkan sebaran data lewat median, kuartil, rentang, dan pencilan &mdash; untuk <strong>satu variabel</strong> atau <strong>beberapa variabel sekaligus</strong> (satu kotak per kolom, seperti Box &amp; Whisker di Excel). Cocok sebagai pemeriksaan awal sebelum ANOVA.',
    format: 'Dua kolom: <strong>Kelompok</strong> (teks, mis. Metode A) dan <strong>Nilai</strong> (angka). Kolom kelompok boleh dikosongkan bila hanya ada satu kelompok.',
    columns: [{ label: 'Kelompok', placeholder: 'Kelompok', text: true, optional: true, fallback: 'Data' }, { label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 4, defaultRows: 8,
    sample: [
      ['Metode A', 72], ['Metode A', 75], ['Metode A', 70], ['Metode A', 78], ['Metode A', 74], ['Metode A', 69],
      ['Metode B', 82], ['Metode B', 85], ['Metode B', 79], ['Metode B', 88], ['Metode B', 84], ['Metode B', 81], ['Metode B', 60],
      ['Metode C', 65], ['Metode C', 68], ['Metode C', 71], ['Metode C', 66], ['Metode C', 70], ['Metode C', 64],
    ],
    axes: ['Kelompok', 'Nilai'],
    options: OPTIONS,
    wide: {
      format: 'Tiap kolom = satu variabel (mis. nilai Kelas A, Kelas B, Kelas C). Isi <strong>1 kolom</strong> untuk boxplot satu variabel, atau beberapa kolom untuk membandingkan.',
      namePrefix: 'Variabel', defCols: 3, maxCols: 12, defaultRows: 10, minPerSeries: 2,
      sample: {
        names: ['Kelas A', 'Kelas B', 'Kelas C'],
        rows: [[72, 82, 65], [75, 85, 68], [70, 79, 71], [78, 88, 66], [74, 84, 70], [69, 81, 64], [76, 60, 67], [73, 83, ''], [71, '', '']],
      },
      draw(d, o) {
        const groups = d.names.map((nm, i) => ({ name: nm, vals: d.series[i] }));
        const single = groups.length === 1;
        const r = boxSvg(groups, {
          title: o.title || (single ? 'Boxplot ' + groups[0].name : 'Boxplot per variabel'),
          xLabel: o.xLabel === '' || o.xLabel === undefined ? (single ? '' : 'Variabel') : o.xLabel,
          yLabel: o.yLabel === '' || o.yLabel === undefined ? 'Nilai' : o.yLabel,
          qmethod: o.qmethod, mean: o.mean, pts: o.pts, showOut: o.showOut,
        });
        return { svg: r.svg, summary: summaryTable(r.stats, o.qmethod) + interpretation(!single) };
      },
    },
    draw(d, o) {
      const names = [], map = {};
      d.cols[0].forEach((g, i) => {
        if (!(g in map)) { map[g] = []; names.push(g); }
        map[g].push(d.cols[1][i]);
      });
      const groups = names.map((g) => ({ name: g, vals: map[g] }));
      const r = boxSvg(groups, {
        title: o.title || 'Boxplot', xLabel: o.xLabel || 'Kelompok', yLabel: o.yLabel || 'Nilai',
        qmethod: o.qmethod, mean: o.mean, pts: o.pts, showOut: o.showOut,
      });
      return { svg: r.svg, summary: summaryTable(r.stats, o.qmethod) + interpretation(names.length > 1) };
    },
  });
})();
