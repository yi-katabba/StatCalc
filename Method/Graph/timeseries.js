/* Time Series Plot - data berurutan menurut waktu */
(function () {
  'use strict';
  const u = GraphCore.u;

  GraphCore.add({
    id: 'timeseries', title: 'Time Series Plot', types: ['waktu'],
    lede: 'Tampilkan data menurut urutan waktu untuk melihat tren, pola musiman, dan lonjakan sebelum melakukan smoothing atau uji stasioneritas.',
    format: 'Dua kolom: <strong>Periode</strong> (teks/tanggal, mis. Jan 2025 atau 2024-Q1) dan <strong>Nilai</strong> (angka). Urutkan dari periode paling awal ke paling akhir.',
    columns: [{ label: 'Periode', placeholder: 'Periode', text: true }, { label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 3, defaultRows: 8,
    sample: [['Jan', 120], ['Feb', 132], ['Mar', 128], ['Apr', 145], ['Mei', 150], ['Jun', 148], ['Jul', 165], ['Agu', 172], ['Sep', 168], ['Okt', 185], ['Nov', 190], ['Des', 205]],
    axes: ['Periode', 'Nilai'],
    options: [
      { key: 'points', type: 'checkbox', label: 'Tampilkan titik data', def: true },
      { key: 'meanLine', type: 'checkbox', label: 'Garis rata-rata', def: false },
      { key: 'trend', type: 'checkbox', label: 'Garis tren linear', def: true },
      { key: 'zero', type: 'checkbox', label: 'Mulai sumbu Y dari 0', def: false },
    ],
    draw(d, o) {
      const lab = d.cols[0], v = d.cols[1], n = d.n;
      const lo = o.zero ? Math.min(0, u.min(v)) : u.min(v), hi = u.max(v);
      const sys = u.niceTicks(lo, hi);
      const title = o.title || 'Time Series Plot', xl = o.xLabel || 'Periode', yl = o.yLabel || 'Nilai';
      const maxLen = Math.min(14, Math.max(...lab.map((l) => l.length)));
      const slots = Math.max(2, Math.floor(540 / (maxLen * 6.4 + 14)));
      const step = Math.max(1, Math.ceil(n / slots));
      const shown = lab.map((l, i) => (i % step === 0 ? l : ''));
      const rot = lab.some((l, i) => i % step === 0 && l.length > 5);
      const L = u.layout({ title, ml: u.mlFor(sys.ticks, true), mb: rot ? Math.min(100, 34 + Math.min(14, Math.max(...lab.map((l) => l.length))) * 4.4 + 20) : 58 });
      const py = u.sy(L, sys), pad = 14;
      const px = (i) => (n === 1 ? L.m.l + L.pw / 2 : L.m.l + pad + i * (L.pw - 2 * pad) / (n - 1));
      let s = u.head(L, title) + u.gridY(L, sys, yl);
      const yb = L.m.t + L.ph;
      s += `<line x1="${L.m.l}" y1="${yb}" x2="${L.W - L.m.r}" y2="${yb}" stroke="${u.AXIS}"/>`;
      lab.forEach((l, i) => {
        if (i % step !== 0) return;
        const x = px(i), t = l.length > 14 ? l.slice(0, 13) + '\u2026' : l;
        if (u.ST.on && u.ST.v) s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${L.m.t}" y2="${yb}" stroke="${u.ST.gc}"/>`;
        s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yb}" y2="${yb + 4}" stroke="${u.AXIS}"/>`;
        s += rot ? `<text transform="translate(${x.toFixed(1)} ${yb + 16}) rotate(-40)" text-anchor="end" font-size="11" fill="${u.SOFT}">${u.esc(t)}</text>`
          : `<text x="${x.toFixed(1)}" y="${yb + 17}" text-anchor="middle" font-size="11" fill="${u.SOFT}">${u.esc(t)}</text>`;
      });
      s += `<text x="${(L.m.l + L.pw / 2).toFixed(1)}" y="${L.H - 10}" text-anchor="middle" font-size="12" fill="${u.INK}">${u.esc(xl)}</text>`;

      const idx = v.map((_, i) => i + 1);
      const reg = n >= 2 ? u.linreg(idx, v) : null;
      const m = u.mean(v);
      if (o.meanLine) s += `<line x1="${L.m.l}" x2="${L.W - L.m.r}" y1="${py(m).toFixed(1)}" y2="${py(m).toFixed(1)}" stroke="#52565F" stroke-width="1.4" stroke-dasharray="3 4"/>` +
        `<text x="${L.W - L.m.r - 4}" y="${(py(m) - 5).toFixed(1)}" text-anchor="end" font-size="11" fill="#52565F">rata-rata ${u.esc(u.fmt(m))}</text>`;
      if (o.trend && reg && reg.sxx > 0) {
        const cid = u.nextClipId();
        s += `<clipPath id="${cid}"><rect x="${L.m.l}" y="${L.m.t}" width="${L.pw}" height="${L.ph}"/></clipPath>` +
          `<line clip-path="url(#${cid})" x1="${px(0).toFixed(1)}" y1="${py(reg.a + reg.b).toFixed(1)}" x2="${px(n - 1).toFixed(1)}" y2="${py(reg.a + reg.b * n).toFixed(1)}" stroke="${u.ST.c2}" stroke-width="2" stroke-dasharray="6 4"/>`;
      }
      s += `<polyline fill="none" stroke="${u.ST.c1}" stroke-width="2.2" stroke-linejoin="round" points="${v.map((y, i) => `${px(i).toFixed(1)},${py(y).toFixed(1)}`).join(' ')}"/>`;
      if (o.points) v.forEach((y, i) => { s += `<circle cx="${px(i).toFixed(1)}" cy="${py(y).toFixed(1)}" r="3.6" fill="${u.ST.c1}" stroke="#fff" stroke-width="1"/>`; });
      s += '</svg>';

      const iMax = v.indexOf(u.max(v)), iMin = v.indexOf(u.min(v));
      const rows = [
        ['Banyak periode (n)', n], ['Rata-rata', u.fmt(m)], ['Simpangan baku', u.fmt(u.sd(v))],
        ['Nilai tertinggi', `${u.fmt(v[iMax])} (${u.esc(lab[iMax])})`], ['Nilai terendah', `${u.fmt(v[iMin])} (${u.esc(lab[iMin])})`],
      ];
      let interp = '';
      if (reg && reg.sxx > 0) {
        rows.push(['Kemiringan tren linear', `${u.fmt(reg.b)} per periode`]);
        const arah = Math.abs(reg.r) < 0.3 ? 'tidak menunjukkan tren linear yang jelas' : reg.b > 0 ? 'cenderung <strong>naik</strong>' : 'cenderung <strong>turun</strong>';
        interp = u.note(`<strong>Interpretasi:</strong> secara umum data ${arah} (rata-rata ${u.fmt(Math.abs(reg.b))} per periode, r\u00B2 tren = ${u.fmt(reg.r2)}). Jika data terlihat bertren atau berpola musiman, pertimbangkan <em>Metode &rsaquo; Stat &rsaquo; Smoothing</em> untuk peramalan dan <em>Uji Stasioneritas</em> untuk memeriksa akar unit.`);
      }
      return { svg: s, summary: u.kv(rows, 'Ringkasan') + interp };
    },
  });
})();
