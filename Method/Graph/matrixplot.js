/* Matrix Plot - scatter plot semua pasangan variabel (kolom = variabel) */
(function () {
  'use strict';
  const u = GraphCore.u;

  /* pasangan lengkap (tanpa sel kosong) antara variabel i dan j */
  function pairs(al, i, j) {
    const x = [], y = [];
    for (let k = 0; k < al[i].length; k++) {
      const a = al[i][k], b = al[j][k];
      if (a !== null && a !== undefined && b !== null && b !== undefined) { x.push(a); y.push(b); }
    }
    return { x, y };
  }
  function pearson(x, y) {
    if (x.length < 3) return NaN;
    const r = u.linreg(x, y).r;
    return Number.isFinite(r) ? r : NaN;
  }
  function kekuatan(r) {
    const a = Math.abs(r);
    return a < 0.2 ? 'sangat lemah' : a < 0.4 ? 'lemah' : a < 0.6 ? 'sedang' : a < 0.8 ? 'kuat' : 'sangat kuat';
  }

  const SAMPLE = {
    names: ['Jam belajar', 'Nilai ujian', 'Jam tidur', 'Absensi'],
    rows: [[2, 55, 8, 8], [3, 58, 7.5, 7], [4, 64, 7, 6], [5, 63, 7, 6], [6, 72, 6.5, 5], [7, 75, 6.5, 4], [8, 80, 6, 3], [9, 86, 6, 3], [10, 85, 5.5, 2], [11, 93, 5.5, 1], [12, 95, 5, 1], [5, 66, 7, 4]],
  };

  GraphCore.add({
    id: 'matrixplot', title: 'Matrix Plot', types: ['multinumerik'],
    lede: 'Scatter plot untuk <strong>semua pasangan variabel</strong> sekaligus dalam satu matriks, dilengkapi koefisien korelasi Pearson tiap pasangan. Cocok untuk melihat sekilas hubungan antar banyak variabel sebelum regresi berganda.',
    format: 'Tiap kolom = satu variabel numerik (2 sampai 8 variabel), tiap baris = satu pengamatan. Baris yang salah satu selnya kosong hanya dilewati untuk pasangan variabel yang bersangkutan.',
    columns: [{ label: 'X', placeholder: 'X' }, { label: 'Y', placeholder: 'Y' }],
    minRows: 3, defaultRows: 6, sample: [[1, 1], [2, 2], [3, 3]],
    options: [
      { key: 'diag', type: 'select', label: 'Isi diagonal', def: 'nama', choices: [['nama', 'Nama variabel'], ['hist', 'Histogram variabel']] },
      { key: 'tri', type: 'select', label: 'Bagian matriks', def: 'penuh', choices: [['penuh', 'Seluruh matriks'], ['bawah', 'Segitiga bawah saja']] },
      { key: 'line', type: 'checkbox', label: 'Tampilkan garis regresi', def: true },
      { key: 'showR', type: 'checkbox', label: 'Tampilkan nilai r pada tiap sel', def: true },
      { key: 'size', type: 'range', label: 'Ukuran titik', min: 1.5, max: 6, step: 0.5, def: 2.6, unit: ' px' },
    ],
    draw() { throw new Error('Matrix Plot memakai data per variabel (kolom = variabel).'); },
    wide: {
      only: true,
      format: 'Tiap kolom = satu variabel numerik (mis. Jam belajar, Nilai ujian, Jam tidur). Isi <strong>2 sampai 8 kolom</strong>; ubah nama variabel pada judul kolom.',
      namePrefix: 'Variabel', defCols: 4, maxCols: 8, defaultRows: 12, minPerSeries: 3,
      sample: SAMPLE,
      draw(d, o) {
        const k = d.names.length;
        if (k < 2) throw new Error('Matrix Plot membutuhkan minimal 2 variabel. Tambahkan kolom variabel lain.');
        const al = d.aligned || d.series;
        const lower = o.tri === 'bawah';
        const W = 640, ml = 52, mr = 14, mt = 46, mb = 34;
        const cs = (W - ml - mr) / k, H = Math.round(mt + cs * k + mb);
        const L = { W, H, m: { l: ml, r: mr, t: mt, b: mb } };
        const title = o.title || 'Matrix Plot';
        const scales = d.series.map((a) => u.niceTicks(u.min(a), u.max(a), 4));
        const fs = k > 5 ? 10 : 11;
        let s = u.head(L, title);
        const R = [];   /* matriks korelasi */
        for (let i = 0; i < k; i++) {
          R[i] = [];
          for (let j = 0; j < k; j++) {
            const cx0 = ml + j * cs, cy0 = mt + i * cs;
            const diag = i === j;
            if (lower && j > i) { R[i][j] = null; continue; }
            s += `<rect x="${cx0.toFixed(1)}" y="${cy0.toFixed(1)}" width="${cs.toFixed(1)}" height="${cs.toFixed(1)}" fill="none" stroke="${u.AXIS}" stroke-opacity=".55"/>`;
            if (diag) {
              const vals = d.series[i];
              if (o.diag === 'hist') {
                const sc = scales[i], nb = Math.max(4, Math.min(12, Math.ceil(Math.log2(vals.length) + 1)));
                const w = (sc.hi - sc.lo) / nb, cnt = new Array(nb).fill(0);
                vals.forEach((v) => { let b = Math.floor((v - sc.lo) / w); if (b >= nb) b = nb - 1; if (b < 0) b = 0; cnt[b]++; });
                const mx = Math.max.apply(null, cnt), pad = 4, bw = (cs - 2 * pad) / nb;
                cnt.forEach((c, b) => {
                  const h = (cs - 2 * pad - 14) * c / mx;
                  s += `<rect x="${(cx0 + pad + b * bw).toFixed(1)}" y="${(cy0 + cs - pad - h).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${u.ST.c1}" fill-opacity=".7"/>`;
                });
                s += `<text x="${(cx0 + cs / 2).toFixed(1)}" y="${(cy0 + 12).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${u.INK}">${u.esc(clip(d.names[i], cs, fs))}</text>`;
              } else {
                s += `<text x="${(cx0 + cs / 2).toFixed(1)}" y="${(cy0 + cs / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="${fs + 1}" font-weight="700" fill="${u.INK}">${u.esc(clip(d.names[i], cs, fs + 1))}</text>`;
              }
              R[i][j] = 1;
              continue;
            }
            const pr = pairs(al, j, i);   /* x = variabel kolom j, y = variabel baris i */
            const r = pearson(pr.x, pr.y); R[i][j] = r;
            if (pr.x.length < 2) continue;
            const pad = 6, sxs = scales[j], sys = scales[i];
            const px = (v) => cx0 + pad + (v - sxs.lo) / (sxs.hi - sxs.lo) * (cs - 2 * pad);
            const py = (v) => cy0 + cs - pad - (v - sys.lo) / (sys.hi - sys.lo) * (cs - 2 * pad);
            if (o.line && pr.x.length >= 3) {
              const g = u.linreg(pr.x, pr.y);
              if (g.sxx > 0) {
                const cid = u.nextClipId();
                s += `<clipPath id="${cid}"><rect x="${cx0.toFixed(1)}" y="${cy0.toFixed(1)}" width="${cs.toFixed(1)}" height="${cs.toFixed(1)}"/></clipPath>` +
                  `<line clip-path="url(#${cid})" x1="${px(sxs.lo).toFixed(1)}" y1="${py(g.a + g.b * sxs.lo).toFixed(1)}" x2="${px(sxs.hi).toFixed(1)}" y2="${py(g.a + g.b * sxs.hi).toFixed(1)}" stroke="${u.ST.c2}" stroke-width="1.6" stroke-dasharray="5 3"/>`;
              }
            }
            pr.x.forEach((xv, q) => { s += `<circle cx="${px(xv).toFixed(1)}" cy="${py(pr.y[q]).toFixed(1)}" r="${o.size || 2.6}" fill="${u.ST.c1}" fill-opacity=".72" stroke="#fff" stroke-width=".6"/>`; });
            if (o.showR && Number.isFinite(r)) {
              const t = 'r = ' + r.toFixed(2);
              s += `<rect x="${(cx0 + 2).toFixed(1)}" y="${(cy0 + 2).toFixed(1)}" width="${(t.length * 5.6 + 6).toFixed(1)}" height="14" rx="3" fill="#fff" fill-opacity=".85"/>` +
                `<text x="${(cx0 + 5).toFixed(1)}" y="${(cy0 + 12.5).toFixed(1)}" font-size="${fs - 1}" font-weight="700" fill="${u.INK}">${t}</text>`;
            }
          }
        }
        /* skala di tepi: kiri = sumbu Y baris, bawah = sumbu X kolom (nilai minimum & maksimum) */
        for (let i = 0; i < k; i++) {
          const sc = scales[i], cy0 = mt + i * cs;
          if (!(lower && false)) {
            s += `<text x="${ml - 5}" y="${(cy0 + cs - 7).toFixed(1)}" text-anchor="end" font-size="${fs - 1}" fill="${u.SOFT}">${u.esc(u.fmt(sc.lo))}</text>` +
              `<text x="${ml - 5}" y="${(cy0 + 12).toFixed(1)}" text-anchor="end" font-size="${fs - 1}" fill="${u.SOFT}">${u.esc(u.fmt(sc.hi))}</text>`;
          }
        }
        const yb = mt + cs * k;
        for (let j = 0; j < k; j++) {
          const sc = scales[j], cx0 = ml + j * cs;
          s += `<text x="${(cx0 + 4).toFixed(1)}" y="${yb + 14}" text-anchor="start" font-size="${fs - 1}" fill="${u.SOFT}">${u.esc(u.fmt(sc.lo))}</text>` +
            `<text x="${(cx0 + cs - 4).toFixed(1)}" y="${yb + 14}" text-anchor="end" font-size="${fs - 1}" fill="${u.SOFT}">${u.esc(u.fmt(sc.hi))}</text>`;
        }
        s += '</svg>';

        /* ringkasan */
        const rows = d.names.map((nm, i) => [u.esc(nm), d.series[i].length, u.fmt(u.mean(d.series[i])), u.fmt(u.sd(d.series[i])), u.fmt(u.min(d.series[i])), u.fmt(u.max(d.series[i]))]);
        let tbl = u.grid(['Variabel', 'n', 'Rata-rata', 'Simpangan baku', 'Min', 'Maks'], rows, 'Ringkasan variabel');
        const list = [];
        for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) if (Number.isFinite(R[i][j])) list.push({ a: d.names[j], b: d.names[i], r: R[i][j] });
        let interp;
        if (list.length) {
          list.sort((p, q) => Math.abs(q.r) - Math.abs(p.r));
          const top = list[0];
          interp = u.note(`<strong>Interpretasi:</strong> pasangan dengan hubungan linear terkuat adalah <strong>${u.esc(top.a)}</strong> dan <strong>${u.esc(top.b)}</strong> ` +
            `(r = ${u.fmt(top.r)}, ${top.r >= 0 ? 'positif' : 'negatif'} ${kekuatan(top.r)}). Titik yang membentuk pola garis menandakan hubungan linear; pola melengkung menandakan hubungan nonlinear. ` +
            `Korelasi tidak membuktikan sebab-akibat. Lihat matriks korelasi lengkap lewat <em>Heatmap Korelasi</em>.`);
        } else interp = u.note('Korelasi tidak dapat dihitung (data terlalu sedikit atau semua nilai pada pasangan variabel sama).');
        return { svg: s, summary: tbl + interp };
      },
    },
  });

  /* potong nama agar muat di sel */
  function clip(t, cs, fs) {
    const max = Math.max(3, Math.floor((cs - 8) / (fs * 0.58)));
    t = String(t);
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
})();
