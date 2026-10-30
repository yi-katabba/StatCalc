/* Heatmap Korelasi - matriks koefisien korelasi antar variabel (kolom = variabel) */
(function () {
  'use strict';
  const u = GraphCore.u;

  function pairs(al, i, j) {
    const x = [], y = [];
    for (let k = 0; k < al[i].length; k++) {
      const a = al[i][k], b = al[j][k];
      if (a !== null && a !== undefined && b !== null && b !== undefined) { x.push(a); y.push(b); }
    }
    return { x, y };
  }
  /* peringkat rata-rata (untuk korelasi Spearman) */
  function ranks(a) {
    const idx = a.map((v, i) => i).sort((p, q) => a[p] - a[q]), r = new Array(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++;
      const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = rk;
      i = j + 1;
    }
    return r;
  }
  function corr(x, y, method) {
    if (x.length < 3) return NaN;
    const r = method === 'spearman' ? u.linreg(ranks(x), ranks(y)).r : u.linreg(x, y).r;
    return Number.isFinite(r) ? r : NaN;
  }
  function kekuatan(r) {
    const a = Math.abs(r);
    return a < 0.2 ? 'sangat lemah' : a < 0.4 ? 'lemah' : a < 0.6 ? 'sedang' : a < 0.8 ? 'kuat' : 'sangat kuat';
  }
  function rgb(hex) {
    const h = String(hex).replace('#', '');
    const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
  }
  /* campuran putih -> warna sesuai |r|; |r| = 1 memakai warna penuh */
  function mix(hex, t) {
    const c = rgb(hex), m = (v) => Math.round(255 + (v - 255) * t);
    return `rgb(${m(c[0])},${m(c[1])},${m(c[2])})`;
  }
  function lum(hex, t) {
    const c = rgb(hex).map((v) => 255 + (v - 255) * t);
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  }

  const SAMPLE = {
    names: ['Jam belajar', 'Nilai ujian', 'Jam tidur', 'Absensi'],
    rows: [[2, 55, 8, 8], [3, 58, 7.5, 7], [4, 64, 7, 6], [5, 63, 7, 6], [6, 72, 6.5, 5], [7, 75, 6.5, 4], [8, 80, 6, 3], [9, 86, 6, 3], [10, 85, 5.5, 2], [11, 93, 5.5, 1], [12, 95, 5, 1], [5, 66, 7, 4]],
  };

  GraphCore.add({
    id: 'heatmapkorelasi', title: 'Heatmap Korelasi', types: ['multinumerik'],
    lede: 'Matriks koefisien korelasi antar variabel yang diberi warna: makin pekat warnanya, makin kuat hubungan linearnya. Cocok untuk memeriksa hubungan antar variabel bebas (multikolinearitas) sebelum regresi berganda.',
    format: 'Tiap kolom = satu variabel numerik (2 sampai 12 variabel), tiap baris = satu pengamatan. Korelasi dihitung dari pasangan data yang lengkap pada tiap pasang variabel.',
    columns: [{ label: 'X', placeholder: 'X' }, { label: 'Y', placeholder: 'Y' }],
    minRows: 3, defaultRows: 6, sample: [[1, 1], [2, 2], [3, 3]],
    options: [
      { key: 'method', type: 'select', label: 'Jenis korelasi', def: 'pearson', choices: [['pearson', 'Pearson (linear)'], ['spearman', 'Spearman (peringkat)']] },
      { key: 'tri', type: 'select', label: 'Bagian matriks', def: 'penuh', choices: [['penuh', 'Seluruh matriks'], ['bawah', 'Segitiga bawah saja']] },
      { key: 'vals', type: 'checkbox', label: 'Tampilkan nilai korelasi pada sel', def: true },
      { key: 'legend', type: 'checkbox', label: 'Tampilkan skala warna', def: true },
    ],
    draw() { throw new Error('Heatmap Korelasi memakai data per variabel (kolom = variabel).'); },
    wide: {
      only: true,
      format: 'Tiap kolom = satu variabel numerik (mis. Jam belajar, Nilai ujian, Jam tidur). Isi <strong>2 sampai 12 kolom</strong>; ubah nama variabel pada judul kolom.',
      namePrefix: 'Variabel', defCols: 4, maxCols: 12, defaultRows: 12, minPerSeries: 3,
      sample: SAMPLE,
      draw(d, o) {
        const k = d.names.length;
        if (k < 2) throw new Error('Heatmap Korelasi membutuhkan minimal 2 variabel. Tambahkan kolom variabel lain.');
        const al = d.aligned || d.series, method = o.method === 'spearman' ? 'spearman' : 'pearson';
        const lower = o.tri === 'bawah';
        const R = [], N = [];
        for (let i = 0; i < k; i++) {
          R[i] = []; N[i] = [];
          for (let j = 0; j < k; j++) {
            if (i === j) { R[i][j] = d.series[i].length >= 3 && u.sd(d.series[i]) > 0 ? 1 : NaN; N[i][j] = d.series[i].length; continue; }
            if (j > i && R[j] && R[j][i] !== undefined) { R[i][j] = R[j][i]; N[i][j] = N[j][i]; continue; }
            const p = pairs(al, i, j); R[i][j] = corr(p.x, p.y, method); N[i][j] = p.x.length;
          }
        }
        const W = 640, fs = k > 8 ? 10 : 11.5;
        const maxLen = d.names.reduce((m, t) => Math.max(m, String(t).length), 1);
        const ml0 = Math.max(54, Math.min(130, Math.round(Math.min(maxLen, 18) * 6.4 + 14)));
        const mr = o.legend ? 74 : 16, mt = 46;
        const cs = Math.min(86, (W - ml0 - mr) / k);
        const ml = ml0 + Math.max(0, Math.floor((W - ml0 - mr - cs * k) / 2));   /* tengahkan matriks + skala warna */
        const rot = d.names.some((t) => String(t).length * 6.2 > cs - 4);
        const mb = rot ? Math.min(110, Math.round(24 + Math.min(maxLen, 18) * 4.6)) : 34;
        const H = Math.round(mt + cs * k + mb);
        const L = { W, H, m: { l: ml, r: mr, t: mt, b: mb } };
        const title = o.title || ('Heatmap Korelasi (' + (method === 'spearman' ? 'Spearman' : 'Pearson') + ')');
        const c1 = u.ST.c1, c2 = u.ST.c2;
        let s = u.head(L, title);
        const cut = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + '…' : String(t));
        for (let i = 0; i < k; i++) {
          const cy0 = mt + i * cs;
          s += `<text x="${ml - 7}" y="${(cy0 + cs / 2 + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${u.INK}">${u.esc(cut(d.names[i], 18))}</text>`;
          for (let j = 0; j < k; j++) {
            if (lower && j > i) continue;
            const cx0 = ml + j * cs, r = R[i][j];
            let fill, tc = u.INK;
            if (Number.isFinite(r)) {
              const t = Math.min(1, Math.abs(r)), base = r >= 0 ? c1 : c2;
              fill = mix(base, t); tc = lum(base, t) < 140 ? '#fff' : u.INK;
            } else fill = '#EDEFF2';
            s += `<rect x="${cx0.toFixed(1)}" y="${cy0.toFixed(1)}" width="${cs.toFixed(1)}" height="${cs.toFixed(1)}" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`;
            if (o.vals) s += `<text x="${(cx0 + cs / 2).toFixed(1)}" y="${(cy0 + cs / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="${i === j ? 400 : 700}" fill="${tc}">${Number.isFinite(r) ? r.toFixed(2) : '-'}</text>`;
          }
        }
        const yb = mt + cs * k;
        for (let j = 0; j < k; j++) {
          const cx = ml + j * cs + cs / 2;
          if (rot) s += `<text transform="translate(${cx.toFixed(1)} ${yb + 14}) rotate(-40)" text-anchor="end" font-size="${fs}" fill="${u.INK}">${u.esc(cut(d.names[j], 18))}</text>`;
          else s += `<text x="${cx.toFixed(1)}" y="${yb + 17}" text-anchor="middle" font-size="${fs}" fill="${u.INK}">${u.esc(cut(d.names[j], 12))}</text>`;
        }
        if (o.legend) {
          const lx = ml + cs * k + 22, ly = mt, lh = Math.min(cs * k, 220), n = 40;
          for (let q = 0; q < n; q++) {
            const v = 1 - 2 * (q + 0.5) / n;
            s += `<rect x="${lx}" y="${(ly + q * lh / n).toFixed(1)}" width="14" height="${(lh / n + 0.6).toFixed(1)}" fill="${mix(v >= 0 ? c1 : c2, Math.abs(v))}"/>`;
          }
          [1, 0.5, 0, -0.5, -1].forEach((v) => {
            const y = ly + (1 - v) / 2 * lh;
            s += `<line x1="${lx + 14}" x2="${lx + 18}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${u.AXIS}"/><text x="${lx + 21}" y="${(y + 4).toFixed(1)}" font-size="10.5" fill="${u.SOFT}">${v > 0 ? '+' + v : v}</text>`;
          });
        }
        s += '</svg>';

        /* matriks korelasi + pasangan terkuat */
        const head = [''].concat(d.names.map((t) => u.esc(t)));
        const rows = d.names.map((nm, i) => [`<strong>${u.esc(nm)}</strong>`].concat(d.names.map((_, j) => (lower && j > i ? '' : Number.isFinite(R[i][j]) ? u.fmt(R[i][j]) : '-'))));
        let tbl = u.grid(head, rows, 'Matriks korelasi (' + (method === 'spearman' ? 'Spearman' : 'Pearson') + ')');
        const list = [];
        for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) if (Number.isFinite(R[i][j])) list.push({ a: d.names[j], b: d.names[i], r: R[i][j], n: N[i][j] });
        list.sort((p, q) => Math.abs(q.r) - Math.abs(p.r));
        let interp;
        if (list.length) {
          const top = list[0], strong = list.filter((p) => Math.abs(p.r) >= 0.8);
          interp = u.note(`<strong>Interpretasi:</strong> hubungan terkuat ada antara <strong>${u.esc(top.a)}</strong> dan <strong>${u.esc(top.b)}</strong> ` +
            `(r = ${u.fmt(top.r)}, ${top.r >= 0 ? 'positif' : 'negatif'} ${kekuatan(top.r)}, n = ${top.n}). ` +
            (strong.length ? `Ada <strong>${strong.length} pasangan</strong> dengan |r| &ge; 0,8; bila variabel-variabel ini dipakai bersama sebagai prediktor regresi, periksa kemungkinan multikolinearitas (VIF). ` : 'Tidak ada pasangan dengan |r| &ge; 0,8, sehingga tidak tampak indikasi multikolinearitas yang kuat. ') +
            `Warna pekat = hubungan kuat; satu warna untuk korelasi positif dan warna lain untuk negatif. Korelasi tidak membuktikan sebab-akibat.`);
        } else interp = u.note('Korelasi tidak dapat dihitung (data terlalu sedikit atau semua nilai pada pasangan variabel sama).');
        return { svg: s, summary: tbl + interp };
      },
    },
  });
})();
