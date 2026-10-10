/* Bar Chart - data kategorik dengan nilai/frekuensi tiap kategori */
(function () {
  'use strict';
  const u = GraphCore.u;

  GraphCore.add({
    id: 'barchart', title: 'Bar Chart', types: ['kategorik'],
    lede: 'Bandingkan besaran antar kategori (frekuensi, jumlah, atau nilai rata-rata) dengan batang vertikal atau horizontal.',
    format: 'Dua kolom: <strong>Kategori</strong> (teks) dan <strong>Nilai</strong> (angka, mis. frekuensi atau jumlah). Kategori yang ditulis sama akan dijumlahkan.',
    columns: [{ label: 'Kategori', placeholder: 'Kategori', text: true }, { label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 2, defaultRows: 5,
    sample: [['Mahasiswa Baru', 120], ['Semester 3', 98], ['Semester 5', 76], ['Semester 7', 54], ['Semester 9', 31]],
    axes: ['Kategori', 'Nilai'],
    options: [
      { key: 'orient', type: 'select', label: 'Arah batang', def: 'v', gridDef: { v: { h: 1, v: 0 }, h: { h: 0, v: 1 } }, choices: [['v', 'Vertikal'], ['h', 'Horizontal']] },
      { key: 'sort', type: 'select', label: 'Urutan kategori', def: 'none', choices: [['none', 'Sesuai urutan input'], ['desc', 'Terbesar \u2192 terkecil'], ['asc', 'Terkecil \u2192 terbesar']] },
      { key: 'labels', type: 'checkbox', label: 'Tampilkan nilai di ujung batang', def: true },
      { key: 'multi', type: 'checkbox', label: 'Warna berbeda tiap batang', def: false },
    ],
    draw(d, o) {
      const names = [], tot = {};
      d.cols[0].forEach((k, i) => { if (!(k in tot)) { tot[k] = 0; names.push(k); } tot[k] += d.cols[1][i]; });
      if (names.length > 30) throw new Error('Maksimal 30 kategori. Gabungkan kategori kecil terlebih dahulu.');
      let items = names.map((k) => ({ k, v: tot[k] }));
      if (o.sort === 'desc') items.sort((a, b) => b.v - a.v);
      else if (o.sort === 'asc') items.sort((a, b) => a.v - b.v);
      const vals = items.map((x) => x.v), labs = items.map((x) => x.k);
      const vmin = u.min(vals), vmax = u.max(vals);
      const sc = u.niceTicks(vmin < 0 ? vmin * 1.1 : 0, vmax > 0 ? vmax * 1.1 : 0);
      const title = o.title || 'Bar Chart', xl = o.xLabel || 'Kategori', yl = o.yLabel || 'Nilai';
      const colorOf = (i) => (o.multi ? u.ST.pal[i % u.ST.pal.length] : u.ST.c1);
      let s;

      if (o.orient === 'h') {
        const maxLen = Math.min(22, labs.reduce((m, l) => Math.max(m, l.length), 1));
        const H = Math.max(300, 90 + items.length * 30);
        const L = u.layout({ title, ml: Math.round(maxLen * 6.4 + 22 + 18), xl: true, H });
        const px = u.sx(L, sc), bh = L.ph / items.length, bar = Math.min(34, bh * 0.66);
        s = u.head(L, title) + u.axisX(L, sc, yl, true);
        if (u.ST.on && u.ST.h) for (let i = 0; i <= items.length; i++) { const gy = (L.m.t + bh * i).toFixed(1); s += `<line x1="${L.m.l}" x2="${L.W - L.m.r}" y1="${gy}" y2="${gy}" stroke="${u.ST.gc}"/>`; }
        s += `<line x1="${L.m.l}" y1="${L.m.t}" x2="${L.m.l}" y2="${L.m.t + L.ph}" stroke="${u.AXIS}"/>` +
          `<text transform="translate(14 ${(L.m.t + L.ph / 2).toFixed(1)}) rotate(-90)" text-anchor="middle" font-size="12" fill="${u.INK}">${u.esc(xl)}</text>`;
        items.forEach((it, i) => {
          const cy = L.m.t + bh * (i + 0.5), x0 = px(0), x1 = px(it.v);
          const t = it.k.length > 22 ? it.k.slice(0, 21) + '\u2026' : it.k;
          s += `<text x="${L.m.l - 8}" y="${(cy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${u.SOFT}">${u.esc(t)}</text>` +
            `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${(cy - bar / 2).toFixed(1)}" width="${Math.max(1, Math.abs(x1 - x0)).toFixed(1)}" height="${bar.toFixed(1)}" fill="${colorOf(i)}" fill-opacity=".88"/>`;
          if (o.labels) s += it.v >= 0
            ? `<text x="${(x1 + 5).toFixed(1)}" y="${(cy + 4).toFixed(1)}" font-size="11" fill="${u.INK}">${u.esc(u.fmt(it.v))}</text>`
            : `<text x="${(x1 - 5).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${u.INK}">${u.esc(u.fmt(it.v))}</text>`;
        });
        s += `<line x1="${px(0).toFixed(1)}" y1="${L.m.t}" x2="${px(0).toFixed(1)}" y2="${L.m.t + L.ph}" stroke="${u.INK}" stroke-width="1.2"/></svg>`;
      } else {
        const L = u.layout({ title, ml: u.mlFor(sc.ticks, true), mb: u.catBottom(labs, true) });
        const py = u.sy(L, sc), ax = u.axisCat(L, labs, xl);
        s = u.head(L, title) + u.gridY(L, sc, yl) + ax.svg;
        const bar = Math.min(70, ax.bw * 0.68);
        items.forEach((it, i) => {
          const cx = ax.cx(i), y0 = py(0), y1 = py(it.v);
          s += `<rect x="${(cx - bar / 2).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bar.toFixed(1)}" height="${Math.max(1, Math.abs(y0 - y1)).toFixed(1)}" fill="${colorOf(i)}" fill-opacity=".88"/>`;
          if (o.labels) s += `<text x="${cx.toFixed(1)}" y="${(it.v >= 0 ? y1 - 5 : y1 + 13).toFixed(1)}" text-anchor="middle" font-size="11" fill="${u.INK}">${u.esc(u.fmt(it.v))}</text>`;
        });
        s += `<line x1="${L.m.l}" x2="${L.W - L.m.r}" y1="${py(0).toFixed(1)}" y2="${py(0).toFixed(1)}" stroke="${u.INK}" stroke-width="1.2"/></svg>`;
      }

      const total = u.sum(vals), allPos = vals.every((x) => x >= 0);
      const rows = items.map((it) => [u.esc(it.k), u.fmt(it.v), allPos && total > 0 ? u.fmt(it.v / total * 100) + '%' : '-']);
      const top = items.reduce((a, b) => (b.v > a.v ? b : a)), bot = items.reduce((a, b) => (b.v < a.v ? b : a));
      const interp = u.note(`<strong>Interpretasi:</strong> kategori tertinggi adalah <strong>${u.esc(top.k)}</strong> (${u.fmt(top.v)}) dan terendah <strong>${u.esc(bot.k)}</strong> (${u.fmt(bot.v)}). Pada diagram batang, bandingkan <em>tinggi/panjang</em> batang; sumbu nilai dimulai dari 0 agar perbandingannya tidak menyesatkan.`);
      return { svg: s, summary: u.grid(['Kategori', 'Nilai', 'Persentase'], rows, `Ringkasan (total = ${u.fmt(total)})`) + interp };
    },
  });
})();
