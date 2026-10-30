/* Multiple Time Series - beberapa deret waktu pada sumbu waktu yang sama (kolom Periode + satu kolom per deret) */
(function () {
  'use strict';
  const u = GraphCore.u;

  const SAMPLE = {
    names: ['Produk A', 'Produk B', 'Produk C'],
    labels: ['Jan 2023', 'Feb 2023', 'Mar 2023', 'Apr 2023', 'Mei 2023', 'Jun 2023', 'Jul 2023', 'Agu 2023', 'Sep 2023', 'Okt 2023', 'Nov 2023', 'Des 2023', 'Jan 2024', 'Feb 2024', 'Mar 2024', 'Apr 2024', 'Mei 2024', 'Jun 2024', 'Jul 2024', 'Agu 2024', 'Sep 2024', 'Okt 2024', 'Nov 2024', 'Des 2024'],
    rows: [[119, 65, 301], [129, 68, 299], [137, 74, 292], [138, 82, 288], [142, 91, 286], [143, 96, 283], [139, 96, 288], [137, 95, 291], [135, 90, 286], [141, 86, 287], [143, 77, 284], [149, 74, 277],
      [161, 74, 274], [167, 74, 273], [172, 81, 267], [179, 90, 260], [181, 95, 265], [177, 101, 265], [178, 103, 260], [176, 102, 266], [175, 100, 263], [176, 94, 258], [183, 85, 256], [187, 81, 253]],
  };

  /* garis dipecah di sel kosong (null) */
  const segs = (xs, ys) => {
    const out = []; let cur = [];
    ys.forEach((v, i) => { if (v !== null && Number.isFinite(v)) cur.push(xs[i].toFixed(1) + ',' + v.toFixed(1)); else { if (cur.length > 1) out.push(cur); cur = []; } });
    if (cur.length > 1) out.push(cur);
    return out;
  };

  GraphCore.add({
    id: 'multitimeseries', title: 'Multiple Time Series', types: ['waktu'],
    lede: 'Tampilkan <strong>beberapa deret waktu sekaligus</strong> pada sumbu waktu yang sama untuk membandingkan tren, musiman, dan lonjakan antar deret. Bisa digabung dalam satu panel atau dipisah per panel, dengan pilihan skala asli, indeks, atau standardisasi bila satuannya berbeda.',
    format: 'Kolom pertama <strong>Periode</strong> (teks/tanggal, boleh dikosongkan bila hanya ingin nomor urut), lalu satu kolom angka untuk tiap deret. Urutkan dari periode paling awal.',
    columns: [{ label: 'Periode', placeholder: 'Periode', text: true }, { label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 3, defaultRows: 6, sample: [['a', 1], ['b', 2], ['c', 3]],
    axes: ['Periode', 'Nilai'],
    options: [
      { key: 'layout', type: 'select', label: 'Tata letak', def: 'overlay', choices: [['overlay', 'Satu panel (garis ditumpuk)'], ['panels', 'Panel terpisah per deret']] },
      { key: 'scale', type: 'select', label: 'Skala nilai', def: 'raw', choices: [['raw', 'Nilai asli'], ['index', 'Indeks (periode pertama = 100)'], ['z', 'Standardisasi (z-score)']] },
      { key: 'points', type: 'checkbox', label: 'Tampilkan titik data', def: false },
      { key: 'size', type: 'range', label: 'Ukuran titik', min: 2, max: 8, step: 0.5, def: 3, unit: ' px' },
      { key: 'zero', type: 'checkbox', label: 'Mulai sumbu Y dari 0 (nilai asli, satu panel)', def: false },
    ],
    draw() { throw new Error('Multiple Time Series memakai data per variabel (kolom Periode + satu kolom per deret).'); },
    wide: {
      only: true, labels: true, labelName: 'Periode',
      format: 'Kolom <strong>Periode</strong> (label waktu) diikuti <strong>2 sampai 8 kolom deret</strong>; ubah nama deret pada judul kolom. Sel kosong pada sebuah deret digambar sebagai celah.',
      namePrefix: 'Deret', defCols: 3, maxCols: 8, defaultRows: 12, minPerSeries: 3,
      sample: SAMPLE,
      draw(d, o) {
        const k = d.names.length;
        if (k < 2) throw new Error('Multiple Time Series membutuhkan minimal 2 deret. Tambahkan kolom deret lain (atau gunakan Time Series Plot untuk satu deret).');
        const raw = (d.aligned || d.series).map((a) => a.slice());
        const n = Math.max.apply(null, raw.map((a) => a.length));
        const lab = d.labels && d.labels.length >= n ? d.labels.slice(0, n) : Array.from({ length: n }, (_, i) => String(i + 1));
        raw.forEach((a) => { while (a.length < n) a.push(null); });
        const have = (a) => a.filter((v) => v !== null && v !== undefined && Number.isFinite(v));

        /* ---- skala ---- */
        const sc = o.scale === 'index' || o.scale === 'z' ? o.scale : 'raw';
        const ser = raw.map((a, j) => {
          const f = have(a);
          if (sc === 'index') {
            const b0 = f[0];
            if (b0 === 0) throw new Error(`Skala indeks tidak dapat dihitung: nilai pertama deret \u201C${d.names[j]}\u201D adalah 0. Pilih skala lain.`);
            return a.map((v) => (v === null || v === undefined ? null : v / b0 * 100));
          }
          if (sc === 'z') { const m = u.mean(f), s = u.sd(f); return a.map((v) => (v === null || v === undefined ? null : (s > 0 ? (v - m) / s : 0))); }
          return a;
        });
        const allV = [].concat.apply([], ser.map(have));
        const yDef = sc === 'index' ? 'Indeks (periode pertama = 100)' : sc === 'z' ? 'Nilai standar (z)' : 'Nilai';
        const yl = o.yLabel || yDef, xl = o.xLabel || 'Periode';
        const title = o.title || 'Multiple Time Series';

        /* ---- sumbu waktu ---- */
        const W = 640, mr = 22, pad = 14;
        const maxLen = Math.min(14, Math.max.apply(null, lab.map((l) => l.length)));
        const slots = Math.max(2, Math.floor(540 / (maxLen * 6.4 + 14))), step = Math.max(1, Math.ceil(n / slots));
        const rot = lab.some((l, i) => i % step === 0 && l.length > 5);
        const mb = rot ? Math.min(100, 34 + maxLen * 4.4 + 20) : 58;
        const col = (j) => u.ST.pal[j % u.ST.pal.length];
        const panels = o.layout === 'panels';

        /* legenda (hanya satu panel) membungkus baris */
        let mt = 46, legend = '';
        const ml0 = 56;
        if (!panels) {
          let x = ml0, y = 46;
          d.names.forEach((nm, j) => {
            const t = nm.length > 22 ? nm.slice(0, 21) + '\u2026' : nm, w = 30 + t.length * 6.3 + 12;
            if (x + w > W - mr && x > ml0) { x = ml0; y += 17; }
            legend += `<line x1="${x}" x2="${x + 20}" y1="${y}" y2="${y}" stroke="${col(j)}" stroke-width="2.6" stroke-linecap="round"/><text x="${x + 25}" y="${y + 4}" font-size="11.5" fill="${u.INK}">${u.esc(t)}</text>`;
            x += w;
          });
          mt = y + 16;
        }

        let s, H, ml, pw, px;
        const sub = (i) => (n === 1 ? ml + pw / 2 : ml + pad + i * (pw - 2 * pad) / (n - 1));
        const xAxis = (yb) => {
          let t = `<line x1="${ml}" y1="${yb}" x2="${W - mr}" y2="${yb}" stroke="${u.AXIS}"/>`;
          lab.forEach((l, i) => {
            if (i % step !== 0) return;
            const x = px(i), tx = l.length > 14 ? l.slice(0, 13) + '\u2026' : l;
            t += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yb}" y2="${yb + 4}" stroke="${u.AXIS}"/>`;
            t += rot ? `<text transform="translate(${x.toFixed(1)} ${yb + 16}) rotate(-40)" text-anchor="end" font-size="11" fill="${u.SOFT}">${u.esc(tx)}</text>`
              : `<text x="${x.toFixed(1)}" y="${yb + 17}" text-anchor="middle" font-size="11" fill="${u.SOFT}">${u.esc(tx)}</text>`;
          });
          return t + `<text x="${(ml + pw / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="${u.INK}">${u.esc(xl)}</text>`;
        };
        const vgrid = (top, bot) => (u.ST.on && u.ST.v ? lab.map((_, i) => (i % step === 0 ? `<line x1="${px(i).toFixed(1)}" x2="${px(i).toFixed(1)}" y1="${top}" y2="${bot}" stroke="${u.ST.gc}"/>` : '')).join('') : '');
        const drawSeries = (j, py) => {
          const xs = ser[j].map((_, i) => px(i)), ys = ser[j].map((v) => (v === null || v === undefined ? null : py(v)));
          let t = '';
          segs(xs, ys).forEach((sg) => { t += `<polyline fill="none" stroke="${col(j)}" stroke-width="2.2" stroke-linejoin="round" points="${sg.join(' ')}"/>`; });
          if (o.points) ys.forEach((yv, i) => { if (yv !== null) t += `<circle cx="${xs[i].toFixed(1)}" cy="${yv.toFixed(1)}" r="${o.size || 3}" fill="${col(j)}" stroke="#fff" stroke-width="1"/>`; });
          return t;
        };

        if (!panels) {
          const lo = sc === 'raw' && o.zero ? Math.min(0, u.min(allV)) : u.min(allV), sys = u.niceTicks(lo, u.max(allV));
          ml = u.mlFor(sys.ticks, true); pw = W - ml - mr; H = 400 + (mt - 46);
          const ph = H - mt - mb, L = { W, H, m: { l: ml, r: mr, t: mt, b: mb }, pw, ph };
          px = sub;
          s = u.head(L, title) + legend + u.gridY(L, sys, yl) + vgrid(mt, mt + ph) + xAxis(mt + ph);
          const py = u.sy(L, sys);
          if (sc === 'z' || sc === 'index') { const ref = sc === 'z' ? 0 : 100; if (ref > sys.lo && ref < sys.hi) s += `<line x1="${ml}" x2="${W - mr}" y1="${py(ref).toFixed(1)}" y2="${py(ref).toFixed(1)}" stroke="${u.SOFT}" stroke-width="1" stroke-dasharray="4 3"/>`; }
          for (let j = 0; j < k; j++) s += drawSeries(j, py);
          s += '</svg>';
        } else {
          const ph = Math.max(62, Math.min(130, Math.floor(430 / k))), gap = 18;
          const sets = ser.map((a) => u.niceTicks(u.min(have(a)), u.max(have(a)), ph < 90 ? 3 : 4));
          ml = Math.max.apply(null, sets.map((t) => u.mlFor(t.ticks, false))); pw = W - ml - mr;
          H = Math.round(mt + k * ph + (k - 1) * gap + mb);
          px = sub;
          s = u.head({ W, H }, title);
          const bot = mt + k * ph + (k - 1) * gap;
          for (let j = 0; j < k; j++) {
            const top = mt + j * (ph + gap), Lp = { W, H, m: { l: ml, r: mr, t: top, b: 0 }, pw, ph }, py = u.sy(Lp, sets[j]);
            s += u.gridY(Lp, sets[j], j === Math.floor((k - 1) / 2) ? yl : '') + vgrid(top, top + ph);
            s += `<line x1="${ml}" y1="${top + ph}" x2="${W - mr}" y2="${top + ph}" stroke="${u.AXIS}"/>`;
            if (sc === 'z' || sc === 'index') { const ref = sc === 'z' ? 0 : 100; if (ref > sets[j].lo && ref < sets[j].hi) s += `<line x1="${ml}" x2="${W - mr}" y1="${py(ref).toFixed(1)}" y2="${py(ref).toFixed(1)}" stroke="${u.SOFT}" stroke-width="1" stroke-dasharray="4 3"/>`; }
            s += drawSeries(j, py);
            const t = d.names[j].length > 28 ? d.names[j].slice(0, 27) + '\u2026' : d.names[j];
            s += `<rect x="${ml + 5}" y="${top + 3}" width="${(t.length * 6.6 + 12).toFixed(1)}" height="17" rx="3" fill="#fff" fill-opacity=".85"/><text x="${ml + 11}" y="${top + 15.5}" font-size="12" font-weight="700" fill="${col(j)}">${u.esc(t)}</text>`;
          }
          s += xAxis(bot) + '</svg>';
        }

        /* ---- ringkasan (nilai asli, bukan yang diskalakan) ---- */
        const rows = d.names.map((nm, j) => {
          const f = have(raw[j]), idx = []; raw[j].forEach((v, i) => { if (v !== null && v !== undefined) idx.push(i + 1); });
          const g = f.length >= 3 ? u.linreg(idx, f) : null, iHi = raw[j].indexOf(u.max(f)), iLo = raw[j].indexOf(u.min(f));
          return [`<strong style="color:${col(j)}">${u.esc(nm)}</strong>`, f.length, u.fmt(u.mean(f)), u.fmt(u.sd(f)),
            `${u.fmt(u.min(f))} (${u.esc(lab[iLo])})`, `${u.fmt(u.max(f))} (${u.esc(lab[iHi])})`, g && g.sxx > 0 ? u.fmt(g.b) : '-'];
        });
        const tbl = u.grid(['Deret', 'n', 'Rata-rata', 'Simpangan baku', 'Terendah', 'Tertinggi', 'Tren per periode'], rows, 'Ringkasan tiap deret');

        const notes = [];
        const trends = d.names.map((nm, j) => {
          const f = have(raw[j]), idx = []; raw[j].forEach((v, i) => { if (v !== null && v !== undefined) idx.push(i + 1); });
          if (f.length < 3) return null;
          const g = u.linreg(idx, f); return g.sxx > 0 && Number.isFinite(g.r) ? { nm, r: g.r, b: g.b } : null;
        });
        const up = trends.filter((t) => t && t.r >= 0.3 && t.b > 0).map((t) => u.esc(t.nm)), down = trends.filter((t) => t && t.r <= -0.3 && t.b < 0).map((t) => u.esc(t.nm));
        if (up.length || down.length) notes.push('Kecenderungan linear: ' + [up.length ? `<strong>naik</strong> pada ${up.join(', ')}` : '', down.length ? `<strong>turun</strong> pada ${down.join(', ')}` : ''].filter(Boolean).join('; ') + '; deret lain tidak menunjukkan tren linear yang jelas.');
        else notes.push('Tidak ada deret yang menunjukkan tren linear yang jelas.');
        const means = raw.map((a) => Math.abs(u.mean(have(a)))).filter((v) => v > 0);
        if (sc === 'raw' && !panels && means.length > 1 && Math.max.apply(null, means) / Math.min.apply(null, means) > 5) notes.push('Skala antar deret berbeda jauh sehingga deret bernilai kecil tampak hampir datar; gunakan skala <em>Indeks</em> atau <em>Standardisasi</em>, atau tata letak <em>Panel terpisah</em>.');
        let best = null;
        for (let a = 0; a < k; a++) for (let b2 = a + 1; b2 < k; b2++) {
          const xa = [], xb = [];
          raw[a].forEach((v, i) => { const w = raw[b2][i]; if (v !== null && v !== undefined && w !== null && w !== undefined) { xa.push(v); xb.push(w); } });
          if (xa.length < 4) continue;
          const g = u.linreg(xa, xb);
          if (Number.isFinite(g.r) && (!best || Math.abs(g.r) > Math.abs(best.r))) best = { a, b: b2, r: g.r, n: xa.length };
        }
        if (best) notes.push(`Pasangan deret yang paling sejalan: <strong>${u.esc(d.names[best.a])}</strong> dan <strong>${u.esc(d.names[best.b])}</strong> (r = ${u.fmt(best.r)}, n = ${best.n}). Hati-hati: dua deret yang sama-sama bertren hampir selalu berkorelasi tinggi walau tidak berhubungan (korelasi semu); periksa dulu setelah differencing.`);
        notes.push('Untuk melihat tren, musiman, dan sisa tiap deret, gunakan <em>Decomposition Plot</em>; untuk memilih orde model, gunakan <em>ACF / PACF</em>.');
        return { svg: s, summary: tbl + u.note('<strong>Interpretasi:</strong> ' + notes.join(' ')) };
      },
    },
  });
})();
