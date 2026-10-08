/* Boxplot — numerik per kelompok (atau satu kelompok saja) */
(function () {
  'use strict';
  const u = GraphCore.u;
  const INKC = '#1C1E24';

  GraphCore.add({
    id: 'boxplot', title: 'Boxplot', types: ['kelompok', 'numerik1'],
    lede: 'Bandingkan sebaran beberapa kelompok sekaligus lewat median, kuartil, rentang, dan pencilan. Cocok sebagai pemeriksaan awal sebelum ANOVA.',
    format: 'Dua kolom: <strong>Kelompok</strong> (teks, mis. Metode A) dan <strong>Nilai</strong> (angka). Kolom kelompok boleh dikosongkan bila hanya ada satu kelompok.',
    columns: [{ label: 'Kelompok', placeholder: 'Kelompok', text: true, optional: true, fallback: 'Data' }, { label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 4, defaultRows: 8,
    sample: [
      ['Metode A', 72], ['Metode A', 75], ['Metode A', 70], ['Metode A', 78], ['Metode A', 74], ['Metode A', 69],
      ['Metode B', 82], ['Metode B', 85], ['Metode B', 79], ['Metode B', 88], ['Metode B', 84], ['Metode B', 81], ['Metode B', 60],
      ['Metode C', 65], ['Metode C', 68], ['Metode C', 71], ['Metode C', 66], ['Metode C', 70], ['Metode C', 64],
    ],
    axes: ['Kelompok', 'Nilai'],
    options: [
      { key: 'mean', type: 'checkbox', label: 'Tandai rata-rata (belah ketupat)', def: true },
      { key: 'pts', type: 'checkbox', label: 'Tampilkan semua titik data', def: false },
    ],
    draw(d, o) {
      const names = [], map = {};
      d.cols[0].forEach((g, i) => {
        if (!(g in map)) { map[g] = []; names.push(g); }
        map[g].push(d.cols[1][i]);
      });
      if (names.length > 12) throw new Error('Maksimal 12 kelompok. Gabungkan kelompok kecil terlebih dahulu.');
      const stats = names.map((g) => {
        const vals = map[g], s = u.sortedAsc(vals);
        const q1 = u.quantile(s, 0.25), med = u.quantile(s, 0.5), q3 = u.quantile(s, 0.75), iqr = q3 - q1;
        const lf = q1 - 1.5 * iqr, uf = q3 + 1.5 * iqr;
        const inside = s.filter((x) => x >= lf && x <= uf);
        return { g, n: vals.length, vals, q1, med, q3, mean: u.mean(vals), wlo: inside[0], whi: inside[inside.length - 1], out: s.filter((x) => x < lf || x > uf), min: s[0], max: s[s.length - 1] };
      });
      const all = d.cols[1];
      const sys = u.niceTicks(u.min(all), u.max(all));
      const title = o.title || 'Boxplot', xl = o.xLabel || 'Kelompok', yl = o.yLabel || 'Nilai';
      const L = u.layout({ title, ml: u.mlFor(sys.ticks, true), mb: u.catBottom(names, true) });
      const py = u.sy(L, sys);
      const ax = u.axisCat(L, names, xl);
      let s = u.head(L, title) + u.gridY(L, sys, yl) + ax.svg;
      const bwid = Math.min(64, ax.bw * 0.5);
      stats.forEach((st, i) => {
        const cx = ax.cx(i), col = u.PAL[i % u.PAL.length], x0 = cx - bwid / 2;
        s += `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${py(st.whi).toFixed(1)}" y2="${py(st.q3).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>` +
          `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${py(st.q1).toFixed(1)}" y2="${py(st.wlo).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>` +
          `<line x1="${(cx - bwid / 4).toFixed(1)}" x2="${(cx + bwid / 4).toFixed(1)}" y1="${py(st.whi).toFixed(1)}" y2="${py(st.whi).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>` +
          `<line x1="${(cx - bwid / 4).toFixed(1)}" x2="${(cx + bwid / 4).toFixed(1)}" y1="${py(st.wlo).toFixed(1)}" y2="${py(st.wlo).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>` +
          `<rect x="${x0.toFixed(1)}" y="${py(st.q3).toFixed(1)}" width="${bwid.toFixed(1)}" height="${Math.max(1, py(st.q1) - py(st.q3)).toFixed(1)}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="1.8"/>` +
          `<line x1="${x0.toFixed(1)}" x2="${(x0 + bwid).toFixed(1)}" y1="${py(st.med).toFixed(1)}" y2="${py(st.med).toFixed(1)}" stroke="${col}" stroke-width="3.2"/>`;
        if (o.pts) st.vals.forEach((v, k) => { const jx = cx + ((k % 7) - 3) * (bwid / 16); s += `<circle cx="${jx.toFixed(1)}" cy="${py(v).toFixed(1)}" r="2.4" fill="${col}" fill-opacity=".45"/>`; });
        st.out.forEach((v) => { s += `<circle cx="${cx.toFixed(1)}" cy="${py(v).toFixed(1)}" r="3.8" fill="#fff" stroke="${col}" stroke-width="1.6"/>`; });
        if (o.mean) { const my = py(st.mean), r = 5.5; s += `<path d="M${cx.toFixed(1)} ${(my - r).toFixed(1)} L${(cx + r).toFixed(1)} ${my.toFixed(1)} L${cx.toFixed(1)} ${(my + r).toFixed(1)} L${(cx - r).toFixed(1)} ${my.toFixed(1)} Z" fill="#fff" stroke="${INKC}" stroke-width="1.5"/>`; }
      });
      s += '</svg>';

      const rows = stats.map((st) => [u.esc(st.g), st.n, u.fmt(st.min), u.fmt(st.q1), u.fmt(st.med), u.fmt(st.q3), u.fmt(st.max), u.fmt(st.mean), st.out.length]);
      const interp = u.note('<strong>Cara membaca:</strong> kotak = 50% data di tengah (Q1&ndash;Q3), garis tebal = median, belah ketupat = rata-rata, kumis = data terjauh dalam 1,5&times;IQR, lingkaran kosong = pencilan. ' +
        (stats.length > 1 ? 'Jika kotak antar kelompok hampir tidak tumpang tindih, kemungkinan ada perbedaan nyata; ujilah dengan <em>Metode &rsaquo; Stat &rsaquo; ANOVA</em>.' : ''));
      return { svg: s, summary: u.grid(['Kelompok', 'n', 'Min', 'Q1', 'Median', 'Q3', 'Maks', 'Rata-rata', 'Pencilan'], rows, 'Ringkasan lima angka per kelompok') + interp };
    },
  });
})();
