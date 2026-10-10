/* Probability Plot (Q-Q normal) — memeriksa apakah data mendekati sebaran normal */
(function () {
  'use strict';
  const u = GraphCore.u;

  GraphCore.add({
    id: 'probplot', title: 'Probability Plot', types: ['numerik1'],
    lede: 'Plot kuantil-kuantil (Q-Q) terhadap sebaran normal. Jika titik-titik mengikuti garis lurus, data mendekati normal, berguna untuk memeriksa asumsi uji parametrik, ANOVA, dan regresi.',
    format: 'Satu kolom angka (mis. nilai ujian atau residual model), satu baris per pengamatan.',
    columns: [{ label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 5, defaultRows: 8,
    sample: [[62], [75], [68], [80], [72], [85], [70], [66], [78], [74], [90], [69], [73], [77], [82], [64], [71], [76], [88], [67]],
    axes: ['Kuantil teoritis (z)', 'Nilai data'],
    options: [{ key: 'line', type: 'checkbox', label: 'Tampilkan garis normal acuan', def: true }],
    draw(d, o) {
      const n = d.n, y = u.sortedAsc(d.cols[0]);
      const m = u.mean(y), s1 = u.sd(y);
      if (!(s1 > 0)) throw new Error('Semua nilai sama sehingga plot normal tidak dapat dibuat.');
      const z = y.map((_, i) => u.invNorm((i + 1 - 0.375) / (n + 0.25)));
      const sxs = u.niceTicks(Math.min(u.min(z), -2), Math.max(u.max(z), 2)), sys = u.niceTicks(u.min(y), u.max(y));
      const title = o.title || 'Probability Plot (Normal)', xl = o.xLabel || 'Kuantil teoritis (z)', yl = o.yLabel || 'Nilai data';
      const L = u.layout({ title, ml: u.mlFor(sys.ticks, true), xl: true });
      const px = u.sx(L, sxs), py = u.sy(L, sys);
      let s = u.head(L, title) + u.gridY(L, sys, yl) + u.axisX(L, sxs, xl, true);
      if (o.line) {
        const cid = u.nextClipId();
        s += `<clipPath id="${cid}"><rect x="${L.m.l}" y="${L.m.t}" width="${L.pw}" height="${L.ph}"/></clipPath>` +
          `<line clip-path="url(#${cid})" x1="${px(sxs.lo).toFixed(1)}" y1="${py(m + s1 * sxs.lo).toFixed(1)}" x2="${px(sxs.hi).toFixed(1)}" y2="${py(m + s1 * sxs.hi).toFixed(1)}" stroke="${u.ST.c2}" stroke-width="2.2" stroke-dasharray="6 4"/>`;
      }
      z.forEach((zv, i) => { s += `<circle cx="${px(zv).toFixed(1)}" cy="${py(y[i]).toFixed(1)}" r="4.2" fill="${u.ST.c1}" fill-opacity=".78" stroke="#fff" stroke-width="1"/>`; });
      s += '</svg>';

      const r = u.linreg(z, y).r;
      const baik = r >= 0.98;
      const rows = [['Banyak data (n)', n], ['Rata-rata', u.fmt(m)], ['Simpangan baku', u.fmt(s1)], ['Korelasi titik dengan garis normal (r)', u.fmt(r)]];
      const interp = u.note(`<strong>Interpretasi:</strong> korelasi antara data terurut dan kuantil normal r = ${u.fmt(r)}. ` +
        (baik ? 'Titik-titik sangat dekat dengan garis, sehingga data <strong>mendekati sebaran normal</strong>.' : 'Titik-titik menyimpang dari garis, sehingga ada <strong>indikasi data tidak normal</strong> (mis. menceng atau berekor berat); periksa pola lengkungan atau titik ekstrem.') +
        ' Ini adalah pemeriksaan visual dengan patokan kasar (r &ge; 0,98), bukan uji formal seperti Shapiro-Wilk; pada n kecil, penyimpangan kecil wajar terjadi.');
      return { svg: s, summary: u.kv(rows, 'Ringkasan') + interp };
    },
  });
})();
