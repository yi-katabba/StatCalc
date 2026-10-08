/* Histogram — satu variabel numerik, distribusi frekuensi */
(function () {
  'use strict';
  const u = GraphCore.u;

  GraphCore.add({
    id: 'histogram', title: 'Histogram', types: ['numerik1'],
    lede: 'Lihat bentuk sebaran satu variabel numerik: pusat data, penyebaran, kemiringan, dan kemungkinan pencilan, beserta tabel distribusi frekuensinya.',
    format: 'Satu kolom angka (mis. nilai ujian, tinggi badan, pendapatan), satu baris per pengamatan.',
    columns: [{ label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 5, defaultRows: 8,
    sample: [[62], [75], [68], [80], [72], [85], [70], [66], [78], [74], [90], [69], [73], [77], [82], [64], [71], [76], [88], [67], [79], [73], [75], [70], [81]],
    axes: ['Nilai', 'Frekuensi'],
    options: [
      { key: 'bins', type: 'number', label: 'Jumlah kelas (kosong = otomatis)', placeholder: 'otomatis (aturan Sturges)' },
      { key: 'pct', type: 'checkbox', label: 'Tampilkan jumlah di atas batang', def: true },
    ],
    draw(d, o) {
      const v = d.cols[0], n = d.n;
      const dmin = u.min(v), dmax = u.max(v);
      let k = o.bins && o.bins >= 1 ? Math.round(o.bins) : Math.ceil(1 + Math.log2(n));
      k = Math.max(1, Math.min(40, k));
      /* Lebar kelas dibulatkan ke angka "rapi" (1, 2, 2,5, 5, 10 \u00D7 10^n) agar batas kelas mudah dibaca */
      let w, lo;
      if (dmin === dmax) { w = 1; lo = dmin - 0.5; k = 1; }
      else {
        const raw = (dmax - dmin) / k, mag = Math.pow(10, Math.floor(Math.log10(raw)));
        w = [1, 2, 2.5, 5, 10].map((m) => m * mag).reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
        lo = Math.floor(dmin / w + 1e-9) * w;
        k = Math.max(1, Math.ceil((dmax - lo) / w - 1e-9));
        lo = +lo.toPrecision(12);
      }
      const hi = lo + k * w;
      const counts = new Array(k).fill(0);
      v.forEach((x) => { counts[Math.min(k - 1, Math.max(0, Math.floor((x - lo) / w + 1e-12)))]++; });
      const maxC = u.max(counts);
      const sys = u.niceTicks(0, maxC * 1.1, 6, true);
      const sxs = { lo, hi };
      const edges = Array.from({ length: k + 1 }, (_, i) => +(lo + i * w).toPrecision(12));
      const xticks = k <= 14 ? edges : edges.filter((_, i) => i % Math.ceil(k / 12) === 0);

      const title = o.title || 'Histogram', xl = o.xLabel || 'Nilai', yl = o.yLabel || 'Frekuensi';
      const L = u.layout({ title, ml: u.mlFor(sys.ticks, true), xl: true });
      const px = u.sx(L, sxs), py = u.sy(L, sys);
      let s = u.head(L, title) + u.gridY(L, sys, yl) + u.axisX(L, sxs, xl, false, xticks);
      counts.forEach((c, i) => {
        const x0 = px(edges[i]), x1 = px(edges[i + 1]), y = py(c);
        s += `<rect x="${x0.toFixed(1)}" y="${y.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(py(0) - y).toFixed(1)}" fill="#22384A" fill-opacity=".85" stroke="#fff" stroke-width="1.5"/>`;
        if (o.pct && c > 0) s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="#1C1E24">${c}</text>`;
      });
      s += '</svg>';

      const sorted = u.sortedAsc(v);
      const m = u.mean(v), s1 = u.sd(v);
      let skew = NaN;
      if (n >= 3 && s1 > 0) skew = (n / ((n - 1) * (n - 2))) * v.reduce((a, x) => a + Math.pow((x - m) / s1, 3), 0);
      const q1 = u.quantile(sorted, 0.25), q3 = u.quantile(sorted, 0.75);

      let cum = 0;
      const rows = counts.map((c, i) => {
        cum += c;
        const a = u.fmt(edges[i]), b = u.fmt(edges[i + 1]);
        return [`${a} \u2013 ${b}`, c, u.fmt(c / n * 100) + '%', u.fmt(cum / n * 100) + '%'];
      });
      const stat = u.kv([
        ['Banyak data (n)', n], ['Rata-rata', u.fmt(m)], ['Median', u.fmt(u.quantile(sorted, 0.5))],
        ['Simpangan baku', u.fmt(s1)], ['Minimum / Maksimum', `${u.fmt(sorted[0])} / ${u.fmt(sorted[n - 1])}`],
        ['Q1 / Q3', `${u.fmt(q1)} / ${u.fmt(q3)}`], ['Kemiringan (skewness)', u.fmt(skew)],
        ['Jumlah kelas / lebar kelas', `${k} / ${u.fmt(w)}`],
      ], 'Statistik deskriptif');
      let interp = '';
      if (Number.isFinite(skew)) {
        const bentuk = Math.abs(skew) < 0.5 ? 'kira-kira simetris' : skew > 0 ? 'menceng ke kanan (ekor panjang di nilai besar)' : 'menceng ke kiri (ekor panjang di nilai kecil)';
        interp = u.note(`<strong>Interpretasi:</strong> sebaran data ${bentuk} (skewness = ${u.fmt(skew)}). Bentuk histogram dipengaruhi jumlah kelas (lebar kelas dibulatkan ke angka rapi), jadi coba beberapa nilai untuk memastikan polanya konsisten. Untuk memeriksa kenormalan secara lebih tegas, gunakan <em>Probability Plot</em>.`);
      }
      return { svg: s, summary: stat + u.grid(['Kelas', 'Frekuensi', 'Persen', 'Kumulatif'], rows, 'Distribusi frekuensi') + interp };
    },
  });
})();
