/* Interval Plot - rata-rata + selang kepercayaan (atau ±SE / ±SD) per variabel (kolom = variabel) atau per kelompok.
   Mengikuti pola boxplot.js. Dipakai di halaman Graph dan tab Grafik di Dataset (lewat GraphCore.render). */
(function () {
  'use strict';
  const u = GraphCore.u;
  const INKC = '#1C1E24';

  /* ----------------------------- Sebaran t (tanpa pustaka luar) ----------------------------- */
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    let s = 1.000000000190015;
    for (let j = 0; j < 6; j++) s += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  /* Beta tak lengkap teregularisasi I_x(a, b) (pecahan berlanjut, Numerical Recipes) */
  function betai(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    const cf = (xx, aa, bb) => {
      const TINY = 1e-300;
      let qab = aa + bb, qap = aa + 1, qam = aa - 1, c = 1, d = 1 - qab * xx / qap;
      if (Math.abs(d) < TINY) d = TINY;
      d = 1 / d; let h = d;
      for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m;
        let aaa = m * (bb - m) * xx / ((qam + m2) * (aa + m2));
        d = 1 + aaa * d; if (Math.abs(d) < TINY) d = TINY;
        c = 1 + aaa / c; if (Math.abs(c) < TINY) c = TINY;
        d = 1 / d; h *= d * c;
        aaa = -(aa + m) * (qab + m) * xx / ((aa + m2) * (qap + m2));
        d = 1 + aaa * d; if (Math.abs(d) < TINY) d = TINY;
        c = 1 + aaa / c; if (Math.abs(c) < TINY) c = TINY;
        d = 1 / d;
        const del = d * c; h *= del;
        if (Math.abs(del - 1) < 3e-14) break;
      }
      return h;
    };
    return x < (a + 1) / (a + b + 2) ? bt * cf(x, a, b) / a : 1 - bt * cf(1 - x, b, a) / b;
  }
  function tCdf(t, df) {
    const x = df / (df + t * t), p = 0.5 * betai(x, df / 2, 0.5);
    return t > 0 ? 1 - p : p;
  }
  /* Kuantil t (peluang kumulatif p) lewat pencarian biner; akurat untuk semua db >= 1 */
  function tQuantile(p, df) {
    if (!(df >= 1) || !(p > 0 && p < 1)) return NaN;
    if (p === 0.5) return 0;
    if (p < 0.5) return -tQuantile(1 - p, df);
    let lo = 0, hi = 1;
    while (tCdf(hi, df) < p && hi < 1e8) hi *= 2;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (tCdf(mid, df) < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-12 * Math.max(1, hi)) break;
    }
    return (lo + hi) / 2;
  }

  /* ----------------------------- Hitung statistik ----------------------------- */
  /* groups: [{name, vals}]; o: {type: 'ci'|'se'|'sd', level: 90|95|99, pooled} */
  function stats(groups, o) {
    const type = o.type || 'ci', level = (+o.level || 95) / 100;
    const k = groups.length, N = groups.reduce((s, g) => s + g.vals.length, 0);
    groups.forEach((g) => { if (g.vals.length < 2) throw new Error('Setiap variabel/kelompok minimal berisi 2 data (\u201C' + g.name + '\u201D baru ' + g.vals.length + ').'); });
    let sp = NaN, dfp = N - k;
    const pooled = !!o.pooled && type !== 'sd' && k > 1 && dfp >= 1;
    if (pooled) sp = Math.sqrt(groups.reduce((s, g) => s + (g.vals.length - 1) * Math.pow(u.sd(g.vals), 2), 0) / dfp);
    return groups.map((g) => {
      const n = g.vals.length, m = u.mean(g.vals), s = u.sd(g.vals);
      const se = (pooled ? sp : s) / Math.sqrt(n), df = pooled ? dfp : n - 1;
      let half;
      if (type === 'sd') half = s;
      else if (type === 'se') half = se;
      else half = tQuantile(1 - (1 - level) / 2, df) * se;
      return { g: g.name, n, vals: g.vals, mean: m, sd: s, se, df, half, lo: m - half, hi: m + half };
    });
  }

  const typeName = (o) => (o.type === 'sd' ? 'Rata-rata \u00B1 1 simpangan baku' : o.type === 'se' ? 'Rata-rata \u00B1 1 galat baku' : 'Rata-rata \u00B1 selang kepercayaan ' + (+o.level || 95) + '%');

  /* ----------------------------- Gambar SVG ----------------------------- */
  function intervalSvg(groups, o) {
    o = o || {};
    if (groups.length > 12) throw new Error('Maksimal 12 kelompok/variabel. Gabungkan atau kurangi terlebih dahulu.');
    const st = stats(groups, o);
    const names = st.map((x) => x.g);
    const vv = [];
    st.forEach((x) => { vv.push(x.lo, x.hi, x.mean); if (o.pts) x.vals.forEach((v) => vv.push(v)); });
    const grand = u.mean([].concat.apply([], groups.map((g) => g.vals)));
    if (o.grand) vv.push(grand);
    const lo0 = u.min(vv), hi0 = u.max(vv), pad = (hi0 - lo0) * 0.08 || 1;
    const sys = u.niceTicks(lo0 - pad, hi0 + pad);
    const title = o.title || 'Interval Plot', xl = o.xLabel === undefined ? 'Kelompok' : o.xLabel, yl = o.yLabel === undefined ? 'Nilai' : o.yLabel;
    const L = u.layout({ title, ml: u.mlFor(sys.ticks, !!yl), mb: u.catBottom(names, !!xl), H: 400 });
    L.m.t += 18; L.ph -= 18;                       /* ruang legenda di bawah judul */
    const py = u.sy(L, sys);
    const ax = u.axisCat(L, names, xl);
    let s = u.head(L, title) + u.gridY(L, sys, yl) + ax.svg;
    const pal = u.ST.pal, cap = Math.min(12, ax.bw * 0.2);
    if (o.grand) {
      const gy = py(grand).toFixed(1);
      s += `<line x1="${L.m.l}" x2="${L.W - L.m.r}" y1="${gy}" y2="${gy}" stroke="${u.ST.c2}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
    }
    if (o.connect && st.length > 1) {
      s += `<polyline fill="none" stroke="${INKC}" stroke-opacity=".5" stroke-width="1.4" points="${st.map((x, i) => ax.cx(i).toFixed(1) + ',' + py(x.mean).toFixed(1)).join(' ')}"/>`;
    }
    st.forEach((x, i) => {
      const cx = ax.cx(i), col = pal[i % pal.length], X = cx.toFixed(1);
      if (o.pts) x.vals.forEach((v, k) => { const jx = cx + ((k % 7) - 3) * (cap / 3.2) + (cap * 1.4); s += `<circle cx="${jx.toFixed(1)}" cy="${py(v).toFixed(1)}" r="${Math.max(1.5, (o.size || 3) * 0.8)}" fill="${col}" fill-opacity=".38"/>`; });
      s += `<line x1="${X}" x2="${X}" y1="${py(x.lo).toFixed(1)}" y2="${py(x.hi).toFixed(1)}" stroke="${col}" stroke-width="2.2"/>` +
        `<line x1="${(cx - cap).toFixed(1)}" x2="${(cx + cap).toFixed(1)}" y1="${py(x.lo).toFixed(1)}" y2="${py(x.lo).toFixed(1)}" stroke="${col}" stroke-width="2.2"/>` +
        `<line x1="${(cx - cap).toFixed(1)}" x2="${(cx + cap).toFixed(1)}" y1="${py(x.hi).toFixed(1)}" y2="${py(x.hi).toFixed(1)}" stroke="${col}" stroke-width="2.2"/>` +
        `<circle cx="${X}" cy="${py(x.mean).toFixed(1)}" r="${(o.size || 3) + 2.4}" fill="${col}" stroke="#fff" stroke-width="1.4"/>`;
    });
    /* legenda */
    let lx = L.m.l;
    s += `<circle cx="${lx + 9}" cy="43" r="4" fill="${INKC}"/><text x="${lx + 24}" y="46" font-size="11" fill="${u.SOFT}">${u.esc(typeName(o))}${o.pooled && o.type !== 'sd' && st.length > 1 ? ' (galat gabungan)' : ''}</text>`;
    lx += Math.round(typeName(o).length * 6.3) + 52 + (o.pooled && o.type !== 'sd' && st.length > 1 ? 112 : 0);
    if (o.grand) s += `<line x1="${lx}" x2="${lx + 18}" y1="43" y2="43" stroke="${u.ST.c2}" stroke-width="2.2" stroke-dasharray="6 4"/><text x="${lx + 24}" y="46" font-size="11" fill="${u.SOFT}">Rata-rata keseluruhan</text>`;
    s += '</svg>';
    return { svg: s, stats: st, grand };
  }
  u.intervalSvg = intervalSvg;

  /* ----------------------------- Ringkasan ----------------------------- */
  function summaryTable(st, o) {
    const lbl = o.type === 'sd' ? ['Rata-rata \u2212 SD', 'Rata-rata + SD'] : o.type === 'se' ? ['Rata-rata \u2212 SE', 'Rata-rata + SE'] : ['Batas bawah', 'Batas atas'];
    const rows = st.map((x) => [u.esc(x.g), x.n, u.fmt(x.mean), u.fmt(x.sd), u.fmt(x.se), u.fmt(x.lo), u.fmt(x.hi)]);
    return u.grid(['Variabel / Kelompok', 'n', 'Rata-rata', 'S. baku', 'Galat baku', lbl[0], lbl[1]], rows, typeName(o));
  }
  function interpretation(o, multi) {
    const base = '<strong>Cara membaca:</strong> titik = rata-rata sampel, garis vertikal dengan penutup = ';
    if (o.type === 'sd') return u.note(base + 'rata-rata \u00B1 1 simpangan baku, yaitu ukuran sebaran data (bukan ketelitian rata-rata).');
    if (o.type === 'se') return u.note(base + 'rata-rata \u00B1 1 galat baku, yaitu ukuran ketelitian rata-rata sampel.');
    return u.note(base + 'selang kepercayaan ' + (+o.level || 95) + '% bagi rata-rata populasi (sebaran t). ' +
      (multi ? 'Selang yang tidak tumpang tindih mengisyaratkan perbedaan rata-rata yang nyata; selang yang tumpang tindih belum tentu berarti tidak berbeda, jadi pastikan dengan <em>Metode &rsaquo; Stat &rsaquo; ANOVA</em>.' : 'Semakin sempit selang, semakin teliti dugaan rata-ratanya.'));
  }

  const OPTIONS = [
    { key: 'type', type: 'select', label: 'Jenis selang', def: 'ci', choices: [['ci', 'Selang kepercayaan rata-rata'], ['se', 'Rata-rata \u00B1 1 galat baku (SE)'], ['sd', 'Rata-rata \u00B1 1 simpangan baku (SD)']] },
    { key: 'level', type: 'select', label: 'Tingkat kepercayaan', def: '95', choices: [['90', '90%'], ['95', '95%'], ['99', '99%']] },
    { key: 'pooled', type: 'checkbox', label: 'Pakai galat gabungan (pooled, seperti ANOVA)', def: false },
    { key: 'grand', type: 'checkbox', label: 'Garis rata-rata keseluruhan', def: false },
    { key: 'connect', type: 'checkbox', label: 'Hubungkan rata-rata dengan garis', def: false },
    { key: 'pts', type: 'checkbox', label: 'Tampilkan titik data', def: false },
    { key: 'size', type: 'range', label: 'Ukuran titik rata-rata', min: 2, max: 8, step: 0.5, def: 3, unit: ' px' },
  ];

  GraphCore.add({
    id: 'interval', title: 'Interval Plot', types: ['kelompok'],
    lede: 'Bandingkan <strong>rata-rata</strong> beserta <strong>selang kepercayaan</strong> (atau galat baku / simpangan baku) antar <strong>variabel</strong> atau <strong>kelompok</strong>. Cocok untuk melihat perbedaan rata-rata sebelum atau sesudah ANOVA.',
    format: 'Dua kolom: <strong>Kelompok</strong> (teks, mis. Metode A) dan <strong>Nilai</strong> (angka). Tiap kelompok minimal berisi 2 data.',
    columns: [{ label: 'Kelompok', placeholder: 'Kelompok', text: true, optional: true, fallback: 'Data' }, { label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 4, defaultRows: 8,
    sample: [
      ['Metode A', 72], ['Metode A', 75], ['Metode A', 70], ['Metode A', 78], ['Metode A', 74], ['Metode A', 69],
      ['Metode B', 82], ['Metode B', 85], ['Metode B', 79], ['Metode B', 88], ['Metode B', 84], ['Metode B', 81], ['Metode B', 77],
      ['Metode C', 65], ['Metode C', 68], ['Metode C', 71], ['Metode C', 66], ['Metode C', 70], ['Metode C', 64],
    ],
    axes: ['Kelompok', 'Nilai'],
    options: OPTIONS,
    wide: {
      format: 'Tiap kolom = satu variabel (mis. nilai Kelas A, Kelas B, Kelas C). Isi <strong>1 kolom</strong> untuk satu selang, atau beberapa kolom untuk membandingkan. Minimal 2 data per kolom.',
      namePrefix: 'Variabel', defCols: 3, maxCols: 12, defaultRows: 10, minPerSeries: 2,
      sample: {
        names: ['Kelas A', 'Kelas B', 'Kelas C'],
        rows: [[72, 82, 65], [75, 85, 68], [70, 79, 71], [78, 88, 66], [74, 84, 70], [69, 81, 64], [76, 77, 67], [73, 83, ''], [71, '', '']],
      },
      draw(d, o) {
        const groups = d.names.map((nm, i) => ({ name: nm, vals: d.series[i] }));
        const single = groups.length === 1;
        const oo = {
          title: o.title || (single ? 'Interval Plot ' + groups[0].name : 'Interval Plot per variabel'),
          xLabel: o.xLabel === '' || o.xLabel === undefined ? (single ? '' : 'Variabel') : o.xLabel,
          yLabel: o.yLabel === '' || o.yLabel === undefined ? 'Nilai' : o.yLabel,
          type: o.type, level: o.level, pooled: o.pooled, grand: o.grand, connect: o.connect, pts: o.pts, size: o.size,
        };
        const r = intervalSvg(groups, oo);
        return { svg: r.svg, summary: summaryTable(r.stats, oo) + interpretation(oo, !single) };
      },
    },
    draw(d, o) {
      const names = [], map = {};
      d.cols[0].forEach((g, i) => {
        if (!(g in map)) { map[g] = []; names.push(g); }
        map[g].push(d.cols[1][i]);
      });
      const groups = names.map((g) => ({ name: g, vals: map[g] }));
      const oo = {
        title: o.title || 'Interval Plot', xLabel: o.xLabel || 'Kelompok', yLabel: o.yLabel || 'Nilai',
        type: o.type, level: o.level, pooled: o.pooled, grand: o.grand, connect: o.connect, pts: o.pts, size: o.size,
      };
      const r = intervalSvg(groups, oo);
      return { svg: r.svg, summary: summaryTable(r.stats, oo) + interpretation(oo, names.length > 1) };
    },
  });
})();
