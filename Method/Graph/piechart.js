/* Pie Chart - komposisi bagian terhadap keseluruhan */
(function () {
  'use strict';
  const u = GraphCore.u;

  function arc(cx, cy, r, a0, a1, ri) {
    const p = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const [x0, y0] = p(a0, r), [x1, y1] = p(a1, r);
    if (!ri) return `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
    const [x2, y2] = p(a1, ri), [x3, y3] = p(a0, ri);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${ri} ${ri} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
  }

  GraphCore.add({
    id: 'piechart', title: 'Pie Chart', types: ['kategorik'],
    lede: 'Tampilkan komposisi bagian terhadap keseluruhan: berapa persen tiap kategori dari total. Paling cocok untuk sedikit kategori (maks. 12).',
    format: 'Dua kolom: <strong>Kategori</strong> (teks) dan <strong>Nilai</strong> (angka tidak negatif, mis. frekuensi atau jumlah). Kategori yang ditulis sama akan dijumlahkan.',
    columns: [{ label: 'Kategori', placeholder: 'Kategori', text: true }, { label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 2, defaultRows: 5,
    sample: [['Mahasiswa Baru', 120], ['Semester 3', 98], ['Semester 5', 76], ['Semester 7', 54], ['Semester 9', 31]],
    options: [
      { key: 'donut', type: 'checkbox', label: 'Bentuk donat', def: false },
      { key: 'sort', type: 'checkbox', label: 'Urutkan dari terbesar', def: false },
    ],
    draw(d, o) {
      const names = [], tot = {};
      d.cols[0].forEach((k, i) => {
        if (d.cols[1][i] < 0) throw new Error(`Nilai untuk \u201C${k}\u201D negatif. Pie chart hanya dapat memakai nilai nol atau positif.`);
        if (!(k in tot)) { tot[k] = 0; names.push(k); }
        tot[k] += d.cols[1][i];
      });
      let items = names.map((k) => ({ k, v: tot[k] })).filter((x) => x.v > 0);
      if (!items.length) throw new Error('Semua nilai nol. Isi minimal satu nilai positif.');
      if (items.length > 12) throw new Error('Maksimal 12 kategori pada pie chart. Gunakan Bar Chart atau gabungkan kategori kecil.');
      if (o.sort) items.sort((a, b) => b.v - a.v);
      const total = u.sum(items.map((x) => x.v));
      const title = o.title || 'Pie Chart';
      const W = 640, H = 400, cx = 205, cy = 220, r = 138, ri = o.donut ? 76 : 0;
      let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Inter, Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>` +
        `<text x="${W / 2}" y="27" text-anchor="middle" font-size="16" font-weight="700" fill="${u.INK}">${u.esc(title)}</text>`;
      let a = -Math.PI / 2;
      if (items.length === 1) {
        s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${u.ST.pal[0]}"/>` + (ri ? `<circle cx="${cx}" cy="${cy}" r="${ri}" fill="#fff"/>` : '') +
          `<text x="${cx}" y="${cy - (ri ? 0 : r * 0.55)}" text-anchor="middle" font-size="14" font-weight="700" fill="${ri ? u.INK : '#fff'}">100%</text>`;
      } else {
        items.forEach((it, i) => {
          const frac = it.v / total, a1 = a + frac * 2 * Math.PI, col = u.ST.pal[i % u.ST.pal.length];
          s += `<path d="${arc(cx, cy, r, a, a1, ri)}" fill="${col}" stroke="#fff" stroke-width="2"/>`;
          if (frac >= 0.05) {
            const am = (a + a1) / 2, rr = ri ? (r + ri) / 2 : r * 0.64;
            s += `<text x="${(cx + rr * Math.cos(am)).toFixed(1)}" y="${(cy + rr * Math.sin(am) + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${(frac * 100).toFixed(1)}%</text>`;
          }
          a = a1;
        });
      }
      const lx = 392, rowH = Math.min(26, 300 / items.length), ly0 = cy - (items.length * rowH) / 2 + 4;
      items.forEach((it, i) => {
        const y = ly0 + i * rowH, t = it.k.length > 20 ? it.k.slice(0, 19) + '\u2026' : it.k;
        s += `<rect x="${lx}" y="${(y - 11).toFixed(1)}" width="14" height="14" rx="3" fill="${u.ST.pal[i % u.ST.pal.length]}"/>` +
          `<text x="${lx + 22}" y="${y.toFixed(1)}" font-size="12.5" fill="${u.INK}">${u.esc(t)} <tspan fill="${u.SOFT}">(${u.esc(u.fmt(it.v))})</tspan></text>`;
      });
      s += '</svg>';

      const rows = items.map((it) => [u.esc(it.k), u.fmt(it.v), u.fmt(it.v / total * 100) + '%']);
      const top = items.reduce((x, y) => (y.v > x.v ? y : x));
      const interp = u.note(`<strong>Interpretasi:</strong> kategori terbesar adalah <strong>${u.esc(top.k)}</strong> dengan ${u.fmt(top.v / total * 100)}% dari total. Pie chart baik untuk menunjukkan proporsi, tetapi sulit membandingkan irisan yang ukurannya mirip. Untuk perbandingan yang lebih teliti, gunakan <em>Bar Chart</em>.`);
      return { svg: s, summary: u.grid(['Kategori', 'Nilai', 'Persentase'], rows, `Komposisi (total = ${u.fmt(total)})`) + interp };
    },
  });
})();
