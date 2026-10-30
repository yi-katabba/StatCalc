/* ACF / PACF Plot - autokorelasi dan autokorelasi parsial deret waktu (identifikasi model ARIMA) */
(function () {
  'use strict';
  const u = GraphCore.u;

  /* ------------------------------ Perhitungan ------------------------------ */
  /* ACF lag 1..K (penaksir standar: pembagi c0 total, sama dengan acf() di R) */
  function acfOf(x, K) {
    const n = x.length, m = u.mean(x);
    let c0 = 0; x.forEach((v) => { c0 += (v - m) * (v - m); });
    const r = [];
    for (let k = 1; k <= K; k++) {
      let c = 0; for (let t = k; t < n; t++) c += (x[t] - m) * (x[t - k] - m);
      r.push(c0 > 0 ? c / c0 : NaN);
    }
    return r;
  }
  /* PACF lewat rekursi Durbin-Levinson dari ACF */
  function pacfFrom(r) {
    const out = [], phi = [];
    for (let k = 1; k <= r.length; k++) {
      let num = r[k - 1], den = 1;
      for (let j = 1; j < k; j++) { num -= phi[k - 2][j - 1] * r[k - j - 1]; den -= phi[k - 2][j - 1] * r[j - 1]; }
      const a = den === 0 ? NaN : num / den;
      const row = [];
      for (let j = 1; j < k; j++) row.push(phi[k - 2][j - 1] - a * phi[k - 2][k - j - 1]);
      row.push(a); phi.push(row); out.push(a);
    }
    return out;
  }
  const diff = (x, lag) => { const o = []; for (let i = lag; i < x.length; i++) o.push(x[i] - x[i - lag]); return o; };

  /* Peluang ekor atas chi-kuadrat (gamma tak lengkap teregularisasi) untuk uji Ljung-Box */
  const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(z) {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1;
    let x = LG[0]; for (let i = 1; i < 9; i++) x += LG[i] / (z + i);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    const gln = lgamma(a);
    if (x < a + 1) {
      let ap = a, sum = 1 / a, del = sum;
      for (let i = 0; i < 500; i++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
      return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - gln));
    }
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.min(1, Math.exp(-x + a * Math.log(x) - gln) * h);
  }
  const chiP = (Q, df) => gammaQ(df / 2, Q / 2);

  /* ------------------------------ Interpretasi ------------------------------ */
  /* Pola terpotong (cut-off) bila semua lag signifikan ada di lag kecil (<= 5), dengan toleransi satu lag acak di luar itu */
  function cutKind(vals, b) {
    const main = [], beyond = [];
    vals.forEach((v, i) => { if (Math.abs(v) > b) (i + 1 <= 5 ? main : beyond).push(i + 1); });
    if (!main.length && !beyond.length) return { t: 'none' };
    if (main.length && beyond.length <= 1) return { t: 'cut', q: Math.max.apply(null, main) };
    return { t: 'tail' };
  }
  function interpret(r, p, b, dOrd, sv, K) {
    const nA = r.filter((v) => Math.abs(v) > b).length, nP = p.filter((v) => Math.abs(v) > b).length;
    if (!nA && !nP) {
      return u.note('<strong>Interpretasi:</strong> tidak ada lag yang melewati batas signifikansi pada ACF maupun PACF, sehingga data menyerupai <strong>white noise</strong> (tidak ada autokorelasi yang berarti). ' +
        (dOrd || sv ? 'Bila ini hasil differencing, data sudah cukup stasioner.' : 'Bila data ini adalah residu model, berarti model sudah menangkap pola autokorelasi dengan baik.'));
    }
    const parts = [];
    let run = 0; while (run < K && r[run] > b) run++;
    const slow = run >= Math.min(4, K) && r[0] > 0.5;
    if (slow) {
      parts.push('ACF <strong>turun perlahan</strong> dan lag-lag awalnya signifikan positif. Ini ciri data bertren / <strong>tidak stasioner</strong>; coba <em>differencing</em> orde 1 (atur opsi Differencing) lalu periksa lagi, atau gunakan <em>Uji Stasioneritas</em>.');
    }
    /* puncak lokal ACF = indikasi musiman */
    let best = null;
    for (let k = 3; k <= K - 1; k++) {
      const v = r[k - 1];
      if (v > b && v >= 0.25 && v > r[k - 2] && v >= r[k] && (!best || v > best.v)) best = { k, v };
    }
    if (best) parts.push(`Ada puncak ACF di <strong>lag ${best.k}</strong> (r = ${u.fmt(best.v)}), tanda kemungkinan <strong>pola musiman berperiode sekitar ${best.k}</strong>. Pertimbangkan differencing musiman lag ${best.k} atau model ARIMA musiman.`);
    if (!slow) {
      const ka = cutKind(r, b), kp = cutKind(p, b);
      let pat = '';
      if (ka.t === 'cut' && kp.t !== 'cut') pat = `ACF terpotong setelah lag ${ka.q} sedangkan PACF menurun bertahap: mengarah ke model <strong>MA(${ka.q})</strong> (ARIMA(0,d,${ka.q})).`;
      else if (kp.t === 'cut' && ka.t !== 'cut') pat = `PACF terpotong setelah lag ${kp.q} sedangkan ACF menurun bertahap: mengarah ke model <strong>AR(${kp.q})</strong> (ARIMA(${kp.q},d,0)).`;
      else if (ka.t === 'cut' && kp.t === 'cut') pat = `ACF terpotong setelah lag ${ka.q} dan PACF setelah lag ${kp.q}: pola sederhana; bandingkan AR(${kp.q}) dan MA(${ka.q}) lewat AIC.`;
      else if (ka.t === 'tail' && kp.t === 'tail') pat = 'ACF dan PACF sama-sama menurun bertahap: mengarah ke model campuran <strong>ARMA(p,q)</strong>, atau masih ada tren/musiman yang perlu dihilangkan lebih dulu.';
      else if (ka.t === 'none') pat = `Hanya PACF yang punya lag signifikan (${nP} lag).`;
      else if (kp.t === 'none') pat = `Hanya ACF yang punya lag signifikan (${nA} lag).`;
      if (pat) parts.push(pat);
    }
    return u.note('<strong>Interpretasi:</strong> ' + parts.join(' ') + ' Ini hanya petunjuk awal. Tentukan model akhir lewat <em>Metode &rsaquo; Stat &rsaquo; ARIMA</em> (AIC dan uji residu). Batas signifikansi ±z/&radic;n bersifat pendekatan; sekitar 5% lag bisa melewatinya hanya karena kebetulan.');
  }

  /* ------------------------------ Data contoh ------------------------------ */
  const SAMPLE = [87, 93, 106, 112, 124, 128, 129, 124, 117, 113, 113, 108, 113, 124, 136, 148, 155, 157, 157, 155, 146, 144, 141, 143, 142, 152, 164, 175, 178, 182, 188, 179, 178, 169, 168, 168];

  GraphCore.add({
    id: 'acfpacf', title: 'ACF / PACF Plot', types: ['waktu'],
    lede: 'Grafik <strong>autokorelasi (ACF)</strong> dan <strong>autokorelasi parsial (PACF)</strong> beserta batas signifikansinya. Dipakai pada tahap identifikasi model: apakah data masih bertren, adakah pola musiman, dan berapa orde AR atau MA yang masuk akal sebelum masuk ke ARIMA.',
    format: 'Satu kolom <strong>Nilai</strong> (angka) deret waktu, diurutkan dari periode paling awal ke paling akhir. Minimal 8 data; makin banyak data, makin andal pola ACF/PACF.',
    columns: [{ label: 'Nilai', placeholder: 'Nilai' }],
    minRows: 8, defaultRows: 12, sample: SAMPLE.map((v) => [v]),
    options: [
      { key: 'show', type: 'select', label: 'Tampilkan', def: 'both', choices: [['both', 'ACF dan PACF'], ['acf', 'ACF saja'], ['pacf', 'PACF saja']] },
      { key: 'maxLag', type: 'range', label: 'Lag maksimum', min: 5, max: 40, step: 1, def: 20 },
      { key: 'conf', type: 'select', label: 'Tingkat kepercayaan batas', def: '95', choices: [['90', '90%'], ['95', '95%'], ['99', '99%']] },
      { key: 'diff', type: 'select', label: 'Differencing biasa', def: '0', choices: [['0', 'Tanpa (data asli)'], ['1', 'Orde 1 (selisih berurutan)'], ['2', 'Orde 2']] },
      { key: 'sdiff', type: 'number', label: 'Differencing musiman (lag)', placeholder: 'kosong = tanpa; mis. 12' },
    ],
    draw(d, o) {
      const x0 = d.cols[0], n0 = x0.length;
      const dOrd = parseInt(o.diff, 10) || 0;
      const sv = Number.isFinite(o.sdiff) ? Math.round(o.sdiff) : 0;
      if (sv !== 0 && (sv < 2 || sv > n0 / 2)) throw new Error(`Lag differencing musiman harus bilangan bulat antara 2 dan ${Math.floor(n0 / 2)} (setengah dari banyak data). Kosongkan bila tidak diperlukan.`);
      let x = x0.slice();
      if (sv) x = diff(x, sv);
      for (let i = 0; i < dOrd; i++) x = diff(x, 1);
      const n = x.length;
      if (n < 8) throw new Error(`Setelah differencing hanya tersisa ${n} data; ACF/PACF membutuhkan minimal 8. Kurangi differencing atau tambah data.`);
      if (!(u.sd(x) > 0)) throw new Error('Semua nilai data sama (tidak ada variasi), sehingga autokorelasi tidak dapat dihitung.');
      const K = Math.min(Math.round(o.maxLag) || 20, Math.floor(n / 2) - 1);
      if (K < 2) throw new Error('Data terlalu sedikit untuk menghitung autokorelasi beberapa lag.');
      const r = acfOf(x, K), p = pacfFrom(r);
      const cl = parseFloat(o.conf) || 95, z = u.invNorm(1 - (1 - cl / 100) / 2), b = z / Math.sqrt(n);

      const desc = [];
      if (sv) desc.push('musiman lag ' + sv);
      if (dOrd) desc.push('biasa orde ' + dOrd);
      const dtxt = desc.length ? desc.join(' + ') : 'tanpa';

      /* ---- gambar ---- */
      const W = 640, ml = 58, mr = 20, mt = 46, pw = W - ml - mr;
      const panels = o.show === 'acf' ? ['acf'] : o.show === 'pacf' ? ['pacf'] : ['acf', 'pacf'];
      const ph = panels.length === 2 ? 128 : 230, blk = 20 + ph + 38, H = mt + panels.length * blk + 6;
      const title = o.title || (o.show === 'acf' ? 'Autokorelasi (ACF)' : o.show === 'pacf' ? 'Autokorelasi Parsial (PACF)' : 'ACF dan PACF') + (desc.length ? ' - setelah differencing' : '');
      let s = u.head({ W, H }, title);
      const slot = pw / K, step = Math.max(1, Math.ceil(24 / slot));
      panels.forEach((kind, i) => {
        const vals = kind === 'acf' ? r : p, top = mt + i * blk + 20, yb = top + ph;
        const fin = vals.filter(Number.isFinite);
        const sc = u.niceTicks(Math.max(-1, Math.min(-b * 1.25, Math.min.apply(null, fin))), Math.min(1, Math.max(b * 1.25, Math.max.apply(null, fin))), 5);
        const Lp = { W, H, m: { l: ml, r: mr, t: top, b: 0 }, pw, ph }, py = u.sy(Lp, sc);
        s += `<text x="${ml}" y="${top - 7}" font-size="12.5" font-weight="700" fill="${u.INK}">${kind === 'acf' ? 'ACF (autokorelasi)' : 'PACF (autokorelasi parsial)'}</text>` +
          `<text x="${W - mr}" y="${top - 7}" text-anchor="end" font-size="11" fill="${u.SOFT}">batas &plusmn;${b.toFixed(3)} (${cl}%)</text>`;
        s += u.gridY(Lp, sc, kind === 'acf' ? 'ACF' : 'PACF');
        s += `<rect x="${ml}" y="${py(b).toFixed(1)}" width="${pw}" height="${(py(-b) - py(b)).toFixed(1)}" fill="${u.ST.c1}" fill-opacity=".07"/>` +
          [b, -b].map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${py(v).toFixed(1)}" y2="${py(v).toFixed(1)}" stroke="${u.SOFT}" stroke-width="1.2" stroke-dasharray="5 4"/>`).join('') +
          `<line x1="${ml}" x2="${W - mr}" y1="${py(0).toFixed(1)}" y2="${py(0).toFixed(1)}" stroke="${u.AXIS}"/>`;
        const sw = Math.min(4, Math.max(1.6, slot * 0.28)), rad = Math.min(3.6, Math.max(2, slot * 0.18));
        for (let k = 1; k <= K; k++) {
          const v = vals[k - 1]; if (!Number.isFinite(v)) continue;
          const x = ml + (k - 0.5) * slot, col = Math.abs(v) > b ? u.ST.c2 : u.ST.c1;
          s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${py(0).toFixed(1)}" y2="${py(v).toFixed(1)}" stroke="${col}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>` +
            `<circle cx="${x.toFixed(1)}" cy="${py(v).toFixed(1)}" r="${rad.toFixed(1)}" fill="${col}" stroke="#fff" stroke-width=".8"/>`;
        }
        s += `<line x1="${ml}" y1="${yb}" x2="${W - mr}" y2="${yb}" stroke="${u.AXIS}"/>`;
        for (let k = 1; k <= K; k += step) {
          const x = ml + (k - 0.5) * slot;
          if (u.ST.on && u.ST.v) s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${top}" y2="${yb}" stroke="${u.ST.gc}"/>`;
          s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yb}" y2="${yb + 4}" stroke="${u.AXIS}"/><text x="${x.toFixed(1)}" y="${yb + 17}" text-anchor="middle" font-size="11" fill="${u.SOFT}">${k}</text>`;
        }
        s += `<text x="${(ml + pw / 2).toFixed(1)}" y="${yb + 33}" text-anchor="middle" font-size="12" fill="${u.INK}">Lag</text>`;
      });
      s += '</svg>';

      /* ---- ringkasan ---- */
      const sigList = (v) => { const l = []; v.forEach((a, i) => { if (Math.abs(a) > b) l.push(i + 1); }); return l.length ? l.join(', ') : 'tidak ada'; };
      const h = Math.max(1, Math.min(K, 10, Math.floor(n / 5)));
      let Q = 0; for (let k = 1; k <= h; k++) Q += r[k - 1] * r[k - 1] / (n - k);
      Q *= n * (n + 2);
      const pLB = chiP(Q, h);
      const rows = [
        ['Banyak data (n)', n0 + (n !== n0 ? ` (setelah differencing: ${n})` : '')],
        ['Differencing', dtxt],
        ['Lag yang dihitung', K],
        [`Batas signifikansi (${cl}%)`, '&plusmn;' + b.toFixed(4)],
        ['Lag ACF signifikan', sigList(r)],
        ['Lag PACF signifikan', sigList(p)],
        [`Uji Ljung-Box (lag 1&ndash;${h})`, `Q = ${u.fmt(Q)}, p = ${u.fmt(pLB)} &rarr; ${pLB < 0.05 ? 'ada autokorelasi (data bukan white noise)' : 'tidak ada bukti autokorelasi'}`],
      ];
      const show = Math.min(K, 24);
      const tb = u.grid(['Lag', 'ACF', 'PACF', 'Signifikan'], r.slice(0, show).map((v, i) => [i + 1, u.fmt(v), u.fmt(p[i]), (Math.abs(v) > b ? 'ACF ' : '') + (Math.abs(p[i]) > b ? 'PACF' : '') || '-']),
        show < K ? `Nilai ACF dan PACF (${show} lag pertama dari ${K})` : 'Nilai ACF dan PACF');
      return { svg: s, summary: u.kv(rows, 'Ringkasan') + tb + interpret(r, p, b, dOrd, sv, K) };
    },
  });
})();
