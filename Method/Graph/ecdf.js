/* Empirical CDF - fungsi sebaran empiris F(x) = proporsi data yang <= x */
(function () {
  'use strict';
  const u = GraphCore.u;

  /* Fungsi sebaran normal baku (aproksimasi erf Abramowitz-Stegun 7.1.26, galat < 1,5e-7) */
  function normCdf(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }

  GraphCore.add({
    id: 'ecdf', title: 'Empirical CDF', types: ['numerik1'],
    lede: 'Fungsi sebaran empiris F(x): proporsi pengamatan yang kurang dari atau sama dengan setiap nilai x. Kurva berbentuk tangga yang naik 1/n pada tiap data, berguna untuk membaca persentil dan membandingkan sebaran data dengan sebaran teoretis.',
    format: 'Satu kolom angka (mis. nilai ujian, waktu tunggu, pendapatan), satu baris per pengamatan.',
    columns: [{ label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 3, defaultRows: 8,
    sample: [[62], [75], [68], [80], [72], [85], [70], [66], [78], [74], [90], [69], [73], [77], [82], [64], [71], [76], [88], [67]],
    axes: ['Nilai', 'F(x) = proporsi data ≤ x'],
    options: [
      { key: 'points', type: 'checkbox', label: 'Tampilkan titik pada tiap lompatan', def: true },
      { key: 'normal', type: 'checkbox', label: 'Bandingkan dengan CDF normal (rata-rata & SB data)', def: false },
      { key: 'size', type: 'range', label: 'Ukuran titik', min: 2, max: 9, step: 0.5, def: 3.6, unit: ' px' },
    ],
    draw(d, o) {
      const n = d.n, y = u.sortedAsc(d.cols[0]);
      /* nilai unik + frekuensi kumulatif */
      const xs = [], cum = [], cnt = [];
      y.forEach((v, i) => {
        if (xs.length && xs[xs.length - 1] === v) { cum[cum.length - 1] = i + 1; cnt[cnt.length - 1]++; }
        else { xs.push(v); cum.push(i + 1); cnt.push(1); }
      });
      const m = u.mean(y), s1 = u.sd(y);
      const lo0 = y[0], hi0 = y[n - 1];
      const pad = hi0 > lo0 ? (hi0 - lo0) * 0.06 : Math.abs(lo0) * 0.1 || 1;
      const sxs = u.niceTicks(lo0 - pad, hi0 + pad);
      const sys = { lo: 0, hi: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
      const title = o.title || 'Empirical CDF', xl = o.xLabel || 'Nilai', yl = o.yLabel || 'F(x)';
      const L = u.layout({ title, ml: 46, xl: true });
      const px = u.sx(L, sxs), py = u.sy(L, sys);
      let s = u.head(L, title) + u.gridY(L, sys, yl) + u.axisX(L, sxs, xl, false);

      const cid = u.nextClipId();
      s += `<clipPath id="${cid}"><rect x="${L.m.l}" y="${L.m.t - 4}" width="${L.pw}" height="${L.ph + 8}"/></clipPath><g clip-path="url(#${cid})">`;
      if (o.normal && s1 > 0) {
        let p = '';
        const K = 120;
        for (let i = 0; i <= K; i++) {
          const x = sxs.lo + (sxs.hi - sxs.lo) * i / K;
          p += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(normCdf((x - m) / s1)).toFixed(1);
        }
        s += `<path d="${p}" fill="none" stroke="${u.ST.c2}" stroke-width="2.2" stroke-dasharray="6 4"/>`;
      }
      /* garis tangga: 0 sebelum data pertama, loncat di tiap nilai, 1 setelah data terakhir */
      let path = `M${px(sxs.lo).toFixed(1)} ${py(0).toFixed(1)}`;
      xs.forEach((x, i) => {
        const prev = i ? cum[i - 1] / n : 0;
        path += `L${px(x).toFixed(1)} ${py(prev).toFixed(1)}L${px(x).toFixed(1)} ${py(cum[i] / n).toFixed(1)}`;
      });
      path += `L${px(sxs.hi).toFixed(1)} ${py(1).toFixed(1)}`;
      s += `<path d="${path}" fill="none" stroke="${u.ST.c1}" stroke-width="2.4" stroke-linejoin="round"/>`;
      if (o.points) {
        const r = o.size || 3.6;
        xs.forEach((x, i) => {
          const prev = i ? cum[i - 1] / n : 0;
          s += `<circle cx="${px(x).toFixed(1)}" cy="${py(prev).toFixed(1)}" r="${r}" fill="#fff" stroke="${u.ST.c1}" stroke-width="1.5"/>` +
            `<circle cx="${px(x).toFixed(1)}" cy="${py(cum[i] / n).toFixed(1)}" r="${r}" fill="${u.ST.c1}" stroke="#fff" stroke-width="1"/>`;
        });
      }
      s += '</g>';
      if (o.normal && s1 > 0) {
        s += `<g font-size="11" fill="${u.INK}"><line x1="${L.m.l + L.pw - 150}" x2="${L.m.l + L.pw - 126}" y1="${L.m.t + 62}" y2="${L.m.t + 62}" stroke="${u.ST.c1}" stroke-width="2.4"/><text x="${L.m.l + L.pw - 120}" y="${L.m.t + 66}">CDF empiris</text>` +
          `<line x1="${L.m.l + L.pw - 150}" x2="${L.m.l + L.pw - 126}" y1="${L.m.t + 80}" y2="${L.m.t + 80}" stroke="${u.ST.c2}" stroke-width="2.2" stroke-dasharray="6 4"/><text x="${L.m.l + L.pw - 120}" y="${L.m.t + 84}">CDF normal</text></g>`;
      }
      s += '</svg>';

      const q = (p) => u.fmt(u.quantile(y, p));
      const rows = [['Banyak data (n)', n], ['Nilai unik', xs.length], ['Minimum / Maksimum', `${u.fmt(lo0)} / ${u.fmt(hi0)}`],
        ['Persentil ke-25 / 50 / 75', `${q(0.25)} / ${q(0.5)} / ${q(0.75)}`], ['Persentil ke-10 / 90', `${q(0.1)} / ${q(0.9)}`]];
      if (o.normal && s1 > 0) {
        let ks = 0;
        xs.forEach((x, i) => { const f = normCdf((x - m) / s1); ks = Math.max(ks, Math.abs(cum[i] / n - f), Math.abs((i ? cum[i - 1] : 0) / n - f)); });
        rows.push(['Jarak terjauh ke CDF normal (D)', u.fmt(ks)]);
      }
      const MAXR = 40;
      const trows = xs.slice(0, MAXR).map((x, i) => [u.fmt(x), cnt[i], cum[i], u.fmt(cum[i] / n)]);
      const tbl = u.grid(['Nilai (x)', 'Frekuensi', 'Kumulatif', 'F(x)'], trows, 'Tabel sebaran empiris' + (xs.length > MAXR ? ` (${MAXR} nilai pertama)` : ''));
      const interp = u.note('<strong>Cara membaca:</strong> tarik garis mendatar dari proporsi tertentu (mis. 0,5) hingga memotong kurva, lalu turun ke sumbu nilai untuk mendapat persentilnya (median). Kurva yang curam berarti data rapat di rentang itu; kurva yang landai berarti data jarang.' +
        (o.normal && s1 > 0 ? ' Semakin dekat kurva tangga ke kurva normal putus-putus, semakin mendekati normal; D hanyalah ukuran jarak deskriptif (mirip statistik Kolmogorov-Smirnov), bukan uji formal karena parameter normal diduga dari data yang sama.' : ''));
      return { svg: s, summary: u.kv(rows, 'Ringkasan') + tbl + interp };
    },
  });
})();
