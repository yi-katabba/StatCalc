/* Scatter Plot - dua variabel numerik (X, Y), garis regresi & korelasi */
(function () {
  'use strict';
  const u = GraphCore.u;

  function kekuatan(r) {
    const a = Math.abs(r);
    return a < 0.2 ? 'sangat lemah' : a < 0.4 ? 'lemah' : a < 0.6 ? 'sedang' : a < 0.8 ? 'kuat' : 'sangat kuat';
  }

  GraphCore.add({
    id: 'scatter', title: 'Scatter Plot', types: ['numerik2'],
    lede: 'Diagram pencar untuk melihat hubungan dua variabel numerik, lengkap dengan garis regresi dan koefisien korelasi Pearson.',
    format: 'Dua kolom angka berpasangan: <strong>X</strong> (variabel bebas) dan <strong>Y</strong> (variabel terikat), satu baris per pengamatan.',
    columns: [{ label: 'X', placeholder: 'X' }, { label: 'Y', placeholder: 'Y' }],
    minRows: 3, defaultRows: 6,
    sample: [[1, 55], [2, 58], [3, 64], [4, 63], [5, 72], [6, 75], [7, 80], [8, 86], [9, 85], [10, 93]],
    axes: ['X', 'Y'],
    options: [{ key: 'line', type: 'checkbox', label: 'Tampilkan garis regresi', def: true }],
    draw(d, o) {
      const x = d.cols[0], y = d.cols[1];
      const sxs = u.niceTicks(u.min(x), u.max(x)), sys = u.niceTicks(u.min(y), u.max(y));
      const title = o.title || 'Scatter Plot', xl = o.xLabel || 'X', yl = o.yLabel || 'Y';
      const L = u.layout({ title, ml: u.mlFor(sys.ticks, true), xl: true });
      const px = u.sx(L, sxs), py = u.sy(L, sys);
      const reg = u.linreg(x, y);
      const sxxOk = reg.sxx > 0;
      if (o.line && !sxxOk) throw new Error('Semua nilai X sama, sehingga garis regresi tidak dapat dibuat.');

      let s = u.head(L, title) + u.gridY(L, sys, yl) + u.axisX(L, sxs, xl, true);
      if (o.line) {
        const cid = u.nextClipId();
        const y1 = reg.a + reg.b * sxs.lo, y2 = reg.a + reg.b * sxs.hi;
        s += `<clipPath id="${cid}"><rect x="${L.m.l}" y="${L.m.t}" width="${L.pw}" height="${L.ph}"/></clipPath>` +
          `<line clip-path="url(#${cid})" x1="${px(sxs.lo).toFixed(1)}" y1="${py(y1).toFixed(1)}" x2="${px(sxs.hi).toFixed(1)}" y2="${py(y2).toFixed(1)}" stroke="${u.ST.c2}" stroke-width="2.2" stroke-dasharray="6 4"/>`;
      }
      x.forEach((xv, i) => { s += `<circle cx="${px(xv).toFixed(1)}" cy="${py(y[i]).toFixed(1)}" r="4.6" fill="${u.ST.c1}" fill-opacity=".75" stroke="#fff" stroke-width="1"/>`; });
      s += '</svg>';

      const rOk = Number.isFinite(reg.r);
      const rows = [
        ['Banyak data (n)', d.n],
        ['Rata-rata X / Y', `${u.fmt(u.mean(x))} / ${u.fmt(u.mean(y))}`],
        ['Simpangan baku X / Y', `${u.fmt(u.sd(x))} / ${u.fmt(u.sd(y))}`],
        ['Korelasi Pearson (r)', rOk ? u.fmt(reg.r) : '-'],
      ];
      if (sxxOk) {
        rows.push(['Persamaan garis', `Y = ${u.fmt(reg.a)} ${reg.b >= 0 ? '+' : '\u2212'} ${u.fmt(Math.abs(reg.b))}X`]);
        if (rOk) rows.push(['Koefisien determinasi (R\u00B2)', u.fmt(reg.r2)]);
      }
      let interp = '';
      if (rOk) {
        interp = u.note(`<strong>Interpretasi:</strong> hubungan linear ${reg.r >= 0 ? 'positif' : 'negatif'} yang <strong>${kekuatan(reg.r)}</strong> (r = ${u.fmt(reg.r)}). ` +
          `Sekitar ${u.fmt(reg.r2 * 100)}% keragaman Y dapat dijelaskan secara linear oleh X. Korelasi tidak membuktikan sebab-akibat. Untuk uji signifikansi dan asumsi klasik, gunakan menu <em>Metode &rsaquo; Stat &rsaquo; Regresi Linear</em>.`);
      } else {
        interp = u.note('Korelasi tidak dapat dihitung karena semua nilai Y sama.');
      }
      return { svg: s, summary: u.kv(rows, 'Ringkasan') + interp };
    },
  });
})();
