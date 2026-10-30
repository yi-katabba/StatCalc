/* Decomposition Plot - dekomposisi klasik deret waktu: data = tren + musiman + sisa (aditif) atau tren x musiman x sisa (multiplikatif) */
(function () {
  'use strict';
  const u = GraphCore.u;

  /* ------------------------------ Perhitungan ------------------------------ */
  /* tren = rata-rata bergerak terpusat orde m (m genap: 2 x m MA); ujung deret = NaN */
  function centeredMA(y, m) {
    const n = y.length, T = new Array(n).fill(NaN), h = Math.floor(m / 2);
    for (let i = h; i < n - h; i++) {
      let sum = 0;
      if (m % 2) { for (let j = i - h; j <= i + h; j++) sum += y[j]; T[i] = sum / m; }
      else { sum = 0.5 * y[i - h] + 0.5 * y[i + h]; for (let j = i - h + 1; j <= i + h - 1; j++) sum += y[j]; T[i] = sum / m; }
    }
    return T;
  }
  const fin = (a) => a.filter(Number.isFinite);
  const variance = (a) => { const f = fin(a); if (f.length < 2) return NaN; const m = u.mean(f); return u.sum(f.map((v) => (v - m) * (v - m))) / f.length; };

  /* periode musiman otomatis: puncak lokal ACF tertinggi setelah tren linear dibuang */
  function detectPeriod(y) {
    const n = y.length, idx = y.map((_, i) => i), g = u.linreg(idx, y), e = y.map((v, i) => v - (g.a + g.b * i));
    const mean = u.mean(e); let c0 = 0; e.forEach((v) => { c0 += (v - mean) * (v - mean); });
    if (!(c0 > 0)) return null;
    const L = Math.min(Math.floor(n / 2), 60), r = [0];
    for (let k = 1; k <= L + 1; k++) { let c = 0; for (let t = k; t < n; t++) c += (e[t] - mean) * (e[t - k] - mean); r.push(c / c0); }
    let best = null;
    for (let k = 2; k <= L; k++) if (r[k] > r[k - 1] && r[k] >= r[k + 1] && r[k] >= 0.3 && (!best || r[k] > best.v)) best = { k, v: r[k] };
    return best ? best.k : null;
  }

  function decompose(y, m, mult) {
    const n = y.length, T = centeredMA(y, m), D = y.map((v, i) => (Number.isFinite(T[i]) ? (mult ? v / T[i] : v - T[i]) : NaN));
    const fig = [];
    for (let p = 0; p < m; p++) { const v = []; for (let i = p; i < n; i += m) if (Number.isFinite(D[i])) v.push(D[i]); fig.push(v.length ? u.mean(v) : NaN); }
    const c = u.mean(fin(fig));
    const figC = fig.map((v) => (mult ? v / c : v - c));
    const S = y.map((_, i) => figC[i % m]);
    const R = y.map((v, i) => (Number.isFinite(T[i]) ? (mult ? v / (T[i] * S[i]) : v - T[i] - S[i]) : NaN));
    return { T, S, R, fig: figC };
  }

  /* ------------------------------ Gambar ------------------------------ */
  const segs = (xs, ys) => {   /* pecah garis di titik tak terhingga (ujung tren) */
    const out = []; let cur = [];
    ys.forEach((v, i) => { if (Number.isFinite(v)) cur.push(xs[i].toFixed(1) + ',' + v.toFixed(1)); else { if (cur.length > 1) out.push(cur); cur = []; } });
    if (cur.length > 1) out.push(cur);
    return out;
  };
  const kuat = (f) => (!Number.isFinite(f) ? '-' : f < 0.3 ? 'lemah' : f < 0.6 ? 'sedang' : 'kuat');

  /* ------------------------------ Data contoh ------------------------------ */
  const V = [87, 93, 106, 112, 124, 128, 129, 124, 117, 113, 113, 108, 113, 124, 136, 148, 155, 157, 157, 155, 146, 144, 141, 143, 142, 152, 164, 175, 178, 182, 188, 179, 178, 169, 168, 168];
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const SAMPLE = V.map((v, i) => [BLN[i % 12] + ' ' + (23 + Math.floor(i / 12)), v]);

  GraphCore.add({
    id: 'dekomposisi', title: 'Decomposition Plot', types: ['waktu'],
    lede: 'Pisahkan deret waktu menjadi <strong>tren</strong>, <strong>pola musiman</strong>, dan <strong>sisa (acak)</strong>. Menjawab pertanyaan paling umum pada data berkala: apakah data bertren dan apakah ada musiman, serta seberapa kuat keduanya.',
    format: 'Dua kolom: <strong>Periode</strong> (teks/tanggal, mis. Jan 23) dan <strong>Nilai</strong> (angka), urut dari periode paling awal. Dibutuhkan minimal <strong>dua siklus penuh</strong> (mis. 24 bulan untuk data bulanan).',
    columns: [{ label: 'Periode', placeholder: 'Periode', text: true }, { label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 6, defaultRows: 12, sample: SAMPLE,
    axes: ['Periode', 'Nilai'],
    options: [
      { key: 'model', type: 'select', label: 'Model dekomposisi', def: 'add', choices: [['add', 'Aditif (data = T + S + R)'], ['mult', 'Multiplikatif (data = T x S x R)']] },
      { key: 'period', type: 'number', label: 'Periode musiman (banyak data per siklus)', def: 12, placeholder: '12 = bulanan, 4 = kuartalan; kosong = otomatis' },
      { key: 'points', type: 'checkbox', label: 'Tampilkan titik pada data asli', def: false },
    ],
    draw(d, o) {
      const lab = d.cols[0], y = d.cols[1], n = y.length, mult = o.model === 'mult';
      if (mult && y.some((v) => !(v > 0))) throw new Error('Model multiplikatif membutuhkan semua nilai lebih dari 0. Gunakan model aditif untuk data yang memuat nol atau negatif.');
      let m = Number.isFinite(o.period) ? Math.round(o.period) : null, auto = false;
      if (m === null) {
        m = detectPeriod(y); auto = true;
        if (!m) throw new Error('Periode musiman tidak dapat dideteksi otomatis. Isi kolom "Periode musiman" secara manual (mis. 12 untuk data bulanan).');
      }
      if (m < 2) throw new Error('Periode musiman minimal 2 (banyak data dalam satu siklus).');
      if (n < 2 * m) throw new Error(`Dekomposisi membutuhkan minimal dua siklus penuh: dengan periode ${m} diperlukan ${2 * m} data, sedangkan data baru ${n}. Perkecil periode musiman atau tambah data.`);
      const { T, S, R, fig } = decompose(y, m, mult);

      /* ---- panel ---- */
      const W = 640, mr = 22, mt = 46, ph = 100, gap = 20, pad = 14;
      const base = mult ? 1 : 0;
      const yl = (o.yLabel || 'Data').length > 14 ? (o.yLabel || 'Data').slice(0, 13) + '\u2026' : (o.yLabel || 'Data');
      const rSpan = Math.max.apply(null, fin(R).map((v) => Math.abs(v - base))) || 1;
      const specs = [
        { name: yl, v: y, sc: u.niceTicks(u.min(y), u.max(y), 4), col: u.ST.c1, kind: 'line' },
        { name: 'Tren', v: T, sc: u.niceTicks(u.min(fin(T)), u.max(fin(T)), 4), col: u.ST.c2, kind: 'line' },
        { name: 'Musiman', v: S, sc: u.niceTicks(u.min(S), u.max(S), 4), col: u.ST.pal[2] || u.ST.c1, kind: 'line', ref: base },
        { name: 'Sisa', v: R, sc: u.niceTicks(base - rSpan * 1.1, base + rSpan * 1.1, 4), col: u.ST.pal[3] || u.ST.c1, kind: 'stem', ref: base },
      ];
      const ml = Math.max.apply(null, specs.map((p) => u.mlFor(p.sc.ticks, true)));
      const maxLen = Math.min(14, Math.max.apply(null, lab.map((l) => l.length)));
      const slots = Math.max(2, Math.floor(540 / (maxLen * 6.4 + 14))), step = Math.max(1, Math.ceil(n / slots));
      const rot = lab.some((l, i) => i % step === 0 && l.length > 5);
      const mb = rot ? Math.min(100, 34 + maxLen * 4.4 + 20) : 58;
      const H = Math.round(mt + 4 * ph + 3 * gap + mb), pw = W - ml - mr;
      const px = (i) => ml + pad + i * (pw - 2 * pad) / (n - 1);
      const title = o.title || 'Dekomposisi ' + (mult ? 'Multiplikatif' : 'Aditif');
      let s = u.head({ W, H }, title);
      specs.forEach((p, k) => {
        const top = mt + k * (ph + gap), Lp = { W, H, m: { l: ml, r: mr, t: top, b: 0 }, pw, ph }, py = u.sy(Lp, p.sc), yb = top + ph;
        s += u.gridY(Lp, p.sc, p.name);
        s += `<line x1="${ml}" y1="${yb}" x2="${W - mr}" y2="${yb}" stroke="${u.AXIS}"/>`;
        if (u.ST.on && u.ST.v) lab.forEach((_, i) => { if (i % step === 0) s += `<line x1="${px(i).toFixed(1)}" x2="${px(i).toFixed(1)}" y1="${top}" y2="${yb}" stroke="${u.ST.gc}"/>`; });
        if (p.ref !== undefined) s += `<line x1="${ml}" x2="${W - mr}" y1="${py(p.ref).toFixed(1)}" y2="${py(p.ref).toFixed(1)}" stroke="${u.SOFT}" stroke-width="1" stroke-dasharray="4 3"/>`;
        const xs = p.v.map((_, i) => px(i)), ys = p.v.map((v) => (Number.isFinite(v) ? py(v) : NaN));
        if (p.kind === 'stem') {
          p.v.forEach((v, i) => { if (Number.isFinite(v)) s += `<line x1="${xs[i].toFixed(1)}" x2="${xs[i].toFixed(1)}" y1="${py(p.ref).toFixed(1)}" y2="${ys[i].toFixed(1)}" stroke="${p.col}" stroke-width="2" stroke-linecap="round"/>`; });
        } else {
          segs(xs, ys).forEach((sg) => { s += `<polyline fill="none" stroke="${p.col}" stroke-width="2.2" stroke-linejoin="round" points="${sg.join(' ')}"/>`; });
          if (k === 0 && o.points) p.v.forEach((v, i) => { s += `<circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="3" fill="${p.col}" stroke="#fff" stroke-width="1"/>`; });
        }
      });
      const yb = mt + 4 * ph + 3 * gap;
      lab.forEach((l, i) => {
        if (i % step !== 0) return;
        const x = px(i), t = l.length > 14 ? l.slice(0, 13) + '\u2026' : l;
        s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yb}" y2="${yb + 4}" stroke="${u.AXIS}"/>`;
        s += rot ? `<text transform="translate(${x.toFixed(1)} ${yb + 16}) rotate(-40)" text-anchor="end" font-size="11" fill="${u.SOFT}">${u.esc(t)}</text>`
          : `<text x="${x.toFixed(1)}" y="${yb + 17}" text-anchor="middle" font-size="11" fill="${u.SOFT}">${u.esc(t)}</text>`;
      });
      s += `<text x="${(ml + pw / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="${u.INK}">${u.esc(o.xLabel || 'Periode')}</text></svg>`;

      /* ---- kekuatan tren & musiman (Wang-Smith-Hyndman; skala log untuk model multiplikatif) ---- */
      const ok = T.map((v) => Number.isFinite(v)), tf = (a) => a.filter((_, i) => ok[i]).map((v) => (mult ? Math.log(v) : v));
      const t2 = tf(T), s2 = tf(S), r2 = tf(R), vr = variance(r2);
      const Ft = Math.max(0, 1 - vr / variance(t2.map((v, i) => v + r2[i])));
      const Fs = Math.max(0, 1 - vr / variance(s2.map((v, i) => v + r2[i])));

      const iT = ok.indexOf(true), iL = ok.lastIndexOf(true);
      const tChg = T[iL] - T[iT], tPer = tChg / (iL - iT);
      const pct = T[iT] !== 0 ? tChg / Math.abs(T[iT]) * 100 : NaN;
      const fl = (i) => lab[i] !== undefined ? lab[i] : String(i + 1);
      const iHi = fig.indexOf(u.max(fig)), iLo = fig.indexOf(u.min(fig));
      const eff = (v) => (mult ? (v >= 1 ? '+' : '') + u.fmt((v - 1) * 100) + '%' : (v >= 0 ? '+' : '') + u.fmt(v));
      const rows = [
        ['Model', mult ? 'Multiplikatif' : 'Aditif'], ['Periode musiman', m + (auto ? ' (terdeteksi otomatis)' : '')],
        ['Banyak data / siklus penuh', `${n} / ${Math.floor(n / m)}`],
        ['Kekuatan tren (0-1)', `${u.fmt(Ft)} (${kuat(Ft)})`], ['Kekuatan musiman (0-1)', `${u.fmt(Fs)} (${kuat(Fs)})`],
        ['Perubahan tren (' + u.esc(fl(iT)) + ' &rarr; ' + u.esc(fl(iL)) + ')', `${u.fmt(tChg)} (${u.fmt(tPer)} per periode${Number.isFinite(pct) ? ', ' + (pct >= 0 ? '+' : '') + u.fmt(pct) + '%' : ''})`],
        ['Posisi musiman tertinggi', `${u.esc(fl(iHi))} (${eff(fig[iHi])})`], ['Posisi musiman terendah', `${u.esc(fl(iLo))} (${eff(fig[iLo])})`],
      ];
      const figTbl = u.grid(['Posisi dalam siklus', 'Contoh periode', 'Indeks musiman', 'Pengaruh'], fig.map((v, i) => [i + 1, u.esc(fl(i)), u.fmt(v), eff(v)]), 'Pola musiman (satu siklus)');
      const maxR = 48;
      const compTbl = u.grid(['Periode', 'Data', 'Tren', 'Musiman', 'Sisa'], y.slice(0, maxR).map((v, i) => [u.esc(lab[i]), u.fmt(v), u.fmt(T[i]), u.fmt(S[i]), u.fmt(R[i])]),
        n > maxR ? `Komponen tiap periode (${maxR} periode pertama dari ${n})` : 'Komponen tiap periode');
      const trendTxt = Ft < 0.3 ? 'tidak menunjukkan tren yang jelas' : `memiliki tren <strong>${tChg >= 0 ? 'naik' : 'turun'}</strong> yang ${kuat(Ft)}`;
      const seasTxt = Fs < 0.3 ? 'pola musimannya lemah' : `memiliki pola musiman yang <strong>${kuat(Fs)}</strong> (tertinggi di <strong>${u.esc(fl(iHi))}</strong>, terendah di <strong>${u.esc(fl(iLo))}</strong>)`;
      const interp = u.note(`<strong>Interpretasi:</strong> data ${trendTxt} dan ${seasTxt}. Kekuatan mendekati 1 berarti komponen itu mendominasi variasi data; mendekati 0 berarti sebagian besar variasi berasal dari sisa acak (aturan praktis: &lt; 0,3 lemah, 0,3&ndash;0,6 sedang, &gt; 0,6 kuat). ` +
        `Bila amplitudo musiman membesar seiring naiknya tren, coba model <em>multiplikatif</em>. Sisa yang masih berpola menandakan masih ada struktur yang belum tertangkap; lanjutkan dengan <em>ACF / PACF</em> atau <em>ARIMA</em>. Tren diukur dengan rata-rata bergerak sehingga ${Math.floor(m / 2)} data di tiap ujung tidak memiliki nilai tren.`);
      return { svg: s, summary: u.kv(rows, 'Ringkasan') + figTbl + compTbl + interp };
    },
  });
})();
