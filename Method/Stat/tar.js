/* =========================================================================
   TAR (THRESHOLD AUTOREGRESSIVE) - TAR konvensional (ambang Z eksternal), SETAR (ambang = lag Y sendiri), STAR (LSTAR / ESTAR) (Time Series)
   Hitungan: tar-core.js. Grafik: svg-helpers.js. Halaman otomatis: #view-tar, awalan elemen "tr"
   ========================================================================= */
(function () {
  'use strict';
  const TC = window.StatTAR, SV = window.StatSvg, U = window.StatBasicUI;
  if (!TC || !SV || !U || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : v === Infinity ? '∞' : v === -Infinity ? '−∞' : String(Number(v.toPrecision(d || 5))).replace('.', ','));
  const sgn = (v) => (v < 0 ? '−' : '+'), SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (k) => String(k).split('').map((c) => SUB[+c]).join('');
  const lag = (k) => 'ₜ₋' + sub(k);
  const NAME = { tar: 'TAR konvensional', setar: 'SETAR', star: 'STAR' };

  const ui = U.mountPage({
    id: 'tar', pre: 'tr', title: 'TAR (Threshold Autoregressive)', eyebrow: 'Metode Statistik &rsaquo; Time Series', step1: 'Pilih model &amp; masukkan data',
    lede: 'Autoregresi yang perilakunya berganti menurut nilai suatu variabel ambang. <strong>TAR konvensional</strong>: rezim ditentukan variabel ambang eksternal (kolom Z). <strong>SETAR</strong> (self-exciting): ambangnya lag deret itu sendiri. <strong>STAR</strong>: peralihan antar rezim mulus (logistik LSTAR atau eksponensial ESTAR), bukan loncatan. Dilengkapi estimasi ambang beserta selang kepercayaan, uji linearitas (Tsay, sup-F bootstrap, Teräsvirta), diagnostik residu, dan ramalan dengan selang simulasi.',
    settings: `
      <label>Model<select id="trType" class="select-input"><option value="setar">SETAR (ambang = lag Y sendiri)</option><option value="tar">TAR konvensional (ambang = kolom Z eksternal)</option><option value="star">STAR (peralihan mulus)</option></select><span class="bs-sub">Kolom 1 = Y. TAR konvensional membutuhkan kolom 2 = Z.</span></label>
      <label data-t="star">Bentuk fungsi peralihan<select id="trForm" class="select-input"><option value="auto">Otomatis (aturan Teräsvirta)</option><option value="lstar">LSTAR (logistik)</option><option value="estar">ESTAR (eksponensial)</option></select><span class="bs-sub">LSTAR: rezim berbeda di kedua sisi ambang. ESTAR: rezim tengah vs tepi.</span></label>
      <label data-t="tar setar">Jumlah rezim<select id="trReg" class="select-input"><option value="2">2 rezim (1 ambang)</option><option value="3">3 rezim (2 ambang)</option></select></label>
      <label>Orde AR (p)<input type="text" id="trP" class="plain-input" value="2" autocomplete="off"><span class="bs-sub" data-t="tar setar">Satu angka (sama di semua rezim) atau satu per rezim, mis. 2,1</span><span class="bs-sub" data-t="star">Satu angka (sama di kedua rezim)</span></label>
      <label>Delay ambang (d)<input type="text" id="trD" class="plain-input" inputmode="numeric" value="0" autocomplete="off"><span class="bs-sub">0 = pilih otomatis dari 1 sampai d maks. Variabel ambang = nilai pada waktu t − d.</span></label>
      <label>d maksimum (bila otomatis)<input type="text" id="trDmax" class="plain-input" inputmode="numeric" value="4" autocomplete="off"></label>
      <label data-t="tar setar">Trimming rezim (%)<input type="text" id="trTrim" class="plain-input" inputmode="decimal" value="15" autocomplete="off"><span class="bs-sub">Tiap rezim minimal persentase ini dari pengamatan (5–40)</span></label>
      <label data-t="tar setar">Bootstrap uji sup-F (B)<input type="text" id="trBoot" class="plain-input" inputmode="numeric" value="200" autocomplete="off"><span class="bs-sub">0 = lewati. Hasil reproducible (seed tetap).</span></label>
      <label>Ramalan ke depan (jumlah periode)<input type="text" id="trH" class="plain-input" inputmode="numeric" value="6" autocomplete="off"></label>`,
    hint: 'Kolom <strong>Y</strong>: deret waktu <strong>urut dari yang paling lama ke terbaru</strong>, tanpa celah. Kolom <strong>Z</strong> (hanya TAR konvensional): variabel ambang eksternal dengan panjang yang sama. Disarankan minimal <strong><span id="trMin">30</span> data</strong> (lebih banyak untuk 3 rezim atau orde besar); maksimal 2000. Deret sebaiknya sudah stasioner dalam varians (lihat Uji Stasioneritas).',
    table: { names: ['Y', 'Z'], colLabel: 'Kolom', minCols: 1, maxCols: 2 }, calcLabel: 'Hitung Model TAR',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();

  /* tampilkan / sembunyikan pengaturan menurut model */
  const applyType = () => {
    const t = q('trType').value;
    ui.section.querySelectorAll('[data-t]').forEach((el) => { el.hidden = el.dataset.t.split(' ').indexOf(t) < 0; });
    if (t === 'tar') tbl.setCols(2); else if (t === 'setar' || t === 'star') { /* kolom Z boleh tetap ada, tidak dipakai */ }
    q('trP').value = t === 'star' ? (/,/.test(q('trP').value) ? q('trP').value.split(',')[0] : q('trP').value) : q('trP').value;
  };
  q('trType').addEventListener('change', applyType); applyType();

  /* ----------------------------- contoh data ----------------------------- */
  ui.onSample = () => {
    const t = q('trType').value; let s = 20261109; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, nrm = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const n = 160, burn = 50, y = [0, 0], z = [0, 0];
    if (t === 'star') {
      for (let i = 2; i < n + burn; i++) { const G = 1 / (1 + Math.exp(-4 * (y[i - 1] - 0.3))); y.push((0.5 + 0.6 * y[i - 1]) * (1 - G) + (-0.7 - 0.7 * y[i - 1]) * G + 0.5 * nrm()); }
      tbl.setCols(1); tbl.fill(['Y'], [y.slice(burn).map((v) => +v.toFixed(3))]); q('trP').value = '1'; q('trD').value = '0'; q('trForm').value = 'auto';
    } else if (t === 'tar') {
      for (let i = 2; i < n + burn; i++) { z.push(0.7 * z[i - 1] + nrm()); y.push(z[i - 1] <= -0.2 ? 1 + 0.7 * y[i - 1] + 0.7 * nrm() : -0.5 + 0.2 * y[i - 1] + 0.3 * y[i - 2] + 0.7 * nrm()); }
      tbl.setCols(2); tbl.fill(['Y', 'Z'], [y.slice(burn).map((v) => +v.toFixed(3)), z.slice(burn).map((v) => +v.toFixed(3))]); q('trP').value = '1,2'; q('trD').value = '0'; q('trReg').value = '2';
    } else {
      for (let i = 2; i < n + burn; i++) y.push(y[i - 2] <= 0.3 ? 0.8 + 0.5 * y[i - 1] - 0.25 * y[i - 2] + 0.8 * nrm() : -1 - 0.6 * y[i - 1] + 0.8 * nrm());
      tbl.setCols(1); tbl.fill(['Y'], [y.slice(burn).map((v) => +v.toFixed(3))]); q('trP').value = '2,1'; q('trD').value = '0'; q('trReg').value = '2';
    }
    q('trDmax').value = '4'; q('trH').value = '6';
  };

  /* ------------------------------- pembantu tampilan ------------------------------- */
  const tab = (cap, head, rows, cls) => `<table class="result-table bs-res${cls ? ' ' + cls : ''}"><caption>${cap}</caption><thead><tr>${head.map((h, i) => `<th${i === 0 ? ' class="lbl"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<td class="lbl">${c}</td>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table>`;
  const kv = (cap, rows) => `<table class="result-table bs-res"><caption>${cap}</caption><tbody>${rows.map((r) => `<tr><td class="lbl">${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table>`;
  const sig = (p) => (Number.isFinite(p) && p < 0.05 ? ' class="sig"' : '');
  const eqn = (coef, nm) => { let s = g(coef[0], 4); for (let i = 1; i < coef.length; i++) s += ` ${sgn(coef[i])} ${g(Math.abs(coef[i]), 4)} ${nm}${lag(i)}`; return `${nm}ₜ = ${s} + εₜ`; };
  const pad = (n, m, arr) => Array.from({ length: n }, (_, i) => (i < m ? NaN : arr[i - m]));
  const strength = (p) => (p < 0.001 ? 'sangat kuat' : p < 0.01 ? 'kuat' : p < 0.05 ? 'cukup kuat' : p < 0.1 ? 'lemah (hanya pada α = 10%)' : 'tidak ada');
  const readP = (s, name, min, max) => { const v = toNum(s); if (v === null || Number.isNaN(v) || Math.floor(v) !== v || v < min || v > max) throw new Error(`${name} harus bilangan bulat antara ${min} dan ${max}.`); return v; };

  /* tabel diagnostik residu bersama */
  function diagTable(r) {
    const d = r.diag, p = r.pmax || r.p;
    return tab('Diagnostik residu', ['Uji', 'Statistik', 'db', 'p-value', 'Kesimpulan (α = 5%)'], [
      [`Ljung-Box (m = ${d.lb.m})`, fmt(d.lb.Q, 3), d.lb.df, `<span${sig(d.lb.p)}>${fmtP(d.lb.p)}</span>`, d.lb.p < 0.05 ? 'Masih ada autokorelasi residu' : 'Tidak ada autokorelasi residu'],
      [`Ljung-Box residu kuadrat (m = ${d.lbSq.m})`, fmt(d.lbSq.Q, 3), d.lbSq.df, `<span${sig(d.lbSq.p)}>${fmtP(d.lbSq.p)}</span>`, d.lbSq.p < 0.05 ? 'Ada efek ARCH (ragam tidak konstan)' : 'Ragam residu relatif konstan'],
      ['Jarque-Bera', fmt(d.jb.JB, 3), 2, `<span${sig(d.jb.p)}>${fmtP(d.jb.p)}</span>`, d.jb.p < 0.05 ? 'Residu tidak normal' : 'Residu mendekati normal']]) +
      `<p class="bs-note">Kemiringan residu = ${fmt(d.jb.skew, 3)}, kurtosis = ${fmt(d.jb.kurt, 3)}. Derajat bebas Ljung-Box dikurangi orde AR (${p}).</p>`;
  }

  /* ======================================================================= */
  ui.onCalc = () => {
    const type = q('trType').value, { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    let nreg, plist, d, dmax, trim, h, B;
    try {
      nreg = type === 'star' ? 2 : +q('trReg').value;
      plist = q('trP').value.split(/[\s,;]+/).filter((x) => x !== '').map((x) => readP(x, 'Orde AR', 1, 12)); if (!plist.length) throw new Error('Isi orde AR (mis. 2 atau 2,1).');
      d = readP(q('trD').value, 'Delay d', 0, 12); dmax = readP(q('trDmax').value, 'd maksimum', 1, 12); h = q('trH').value.trim() === '' ? 0 : readP(q('trH').value, 'Jumlah periode ramalan', 0, 60);
      B = type === 'star' || q('trBoot').value.trim() === '' ? 0 : readP(q('trBoot').value, 'Jumlah bootstrap', 0, 2000);
      const tv = toNum(q('trTrim').value); trim = type === 'star' ? 0.15 : tv; if (type !== 'star' && (tv === null || Number.isNaN(tv) || tv < 5 || tv > 40)) throw new Error('Trimming harus antara 5 dan 40 (persen).'); if (type !== 'star') trim = tv / 100;
      if (type !== 'star' && plist.length !== 1 && plist.length !== nreg) throw new Error(`Orde AR: isi 1 angka atau ${nreg} angka (satu per rezim).`);
    } catch (e) { return ui.err(e.message); }
    const raw = cols[0]; let last = -1; raw.forEach((v, i) => { if (v !== null) last = i; });
    const y = []; for (let i = 0; i <= last; i++) { if (raw[i] === null) return ui.err('Ada sel kosong di kolom Y baris ' + (i + 1) + ' di tengah data. Deret waktu harus tanpa celah.'); y.push(raw[i]); }
    if (y.length < 20) return ui.err(`Dibutuhkan minimal 20 data; sekarang ${y.length}.`);
    if (Math.max.apply(null, y) === Math.min.apply(null, y)) return ui.err('Semua nilai Y sama persis; model tidak dapat diestimasi.');
    let z = null;
    if (type === 'tar') {
      if (tbl.names.length < 2) return ui.err('TAR konvensional membutuhkan kolom Z (variabel ambang) di kolom ke-2.');
      z = []; for (let i = 0; i < y.length; i++) { if (cols[1][i] === null) return ui.err('Kolom Z kosong pada baris ' + (i + 1) + '. Kolom Z harus terisi untuk semua baris data Y.'); z.push(cols[1][i]); }
      for (let i = y.length; i < cols[1].length; i++) if (cols[1][i] !== null) return ui.err('Kolom Z lebih panjang daripada kolom Y (baris ' + (i + 1) + ').');
      if (Math.max.apply(null, z) === Math.min.apply(null, z)) return ui.err('Semua nilai Z sama persis; tidak ada variasi untuk menentukan rezim.');
    }
    const nmY = tbl.name(0), nmZ = type === 'tar' ? tbl.name(1) : null;
    let r;
    try {
      if (type === 'star') r = TC.fitSTAR({ y, p: Math.max.apply(null, plist), d, dmax, form: q('trForm').value, h });
      else r = TC.fitTAR({ y, z, type, nreg, orders: plist.length === 1 ? Array(nreg).fill(plist[0]) : plist, d, dmax, trim, h, bootB: B });
    } catch (e) { return ui.err(e.message); }
    if (type === 'star' && plist.length > 1) r.notes.unshift('STAR memakai satu orde AR; nilai terbesar (' + r.p + ') dipakai.');
    if (type === 'star') showSTAR(r, nmY); else showTAR(r, type, nmY, nmZ);
  };

  /* ================================ TAR / SETAR ================================ */
  function showTAR(r, type, nmY, nmZ) {
    const { n, T, m, d, nreg, thr, regimes, orders } = r, self = type === 'setar', sName = self ? `${nmY}${lag(d)}` : `${nmZ}${lag(d)}`, fc = r.forecast;
    const regLabel = (j) => { const rg = regimes[j]; return j === 0 ? `${sName} ≤ ${g(thr[0], 5)}` : j === nreg - 1 ? `${sName} > ${g(thr[nreg - 2], 5)}` : `${g(thr[j - 1], 5)} < ${sName} ≤ ${g(thr[j], 5)}`; };
    const xs = Array.from({ length: n }, (_, i) => i + 1), xsF = fc ? fc.skeleton.map((_, i) => n + i + 1) : [];
    const NaNs = (k) => Array(k).fill(NaN);
    /* grafik 1: data, nilai fit, ramalan */
    let sum = SV.lines({ title: 'Data, nilai fit, dan ramalan', series: [{ name: 'Data', y: y_(r).concat(NaNs(xsF.length)), dots: n <= 80 }, { name: 'Nilai fit model', y: pad(n, m, r.fitted).concat(NaNs(xsF.length)), dash: '5 3' }].concat(fc ? [{ name: 'Ramalan (skeleton)', y: NaNs(n - 1).concat([r.y[n - 1]]).concat(fc.skeleton), width: 2.4, color: '#c2493d' }, { name: 'Batas bawah 95%', y: NaNs(n).concat(fc.lo), dash: '2 3', color: '#8a8f98' }, { name: 'Batas atas 95%', y: NaNs(n).concat(fc.hi), dash: '2 3', color: '#8a8f98' }] : []), x: xs.concat(xsF), xlabel: 'Periode waktu (t)', ylabel: nmY, w: 640, h: 300 });
    /* grafik 2: deret menurut rezim (titik berwarna) + garis ambang */
    const byReg = Array.from({ length: nreg }, (_, j) => { const a = NaNs(n); r.reg.forEach((rj, i) => { if (rj === j) a[m + i] = r.y[m + i]; }); return { name: `Rezim ${j + 1}`, y: a, dots: true, width: 0.01 }; });
    const sSer = self ? thr.map((v, j) => ({ name: `Ambang ${j + 1}`, y: Array(n).fill(v), dash: '5 4', color: '#5f7385', width: 1.4 })) : [];
    sum += SV.lines({ title: self ? `Deret menurut rezim (garis putus = ambang pada ${nmY})` : 'Deret Y menurut rezim (rezim ditentukan oleh Z)', series: [{ name: nmY, y: r.y.slice(), width: 1, color: '#b4bcc6' }].concat(byReg, self ? sSer : []), x: xs, xlabel: 'Periode waktu (t)', ylabel: nmY, w: 640, h: 260 });
    if (r.profile) sum += SV.lines({ title: 'Profil SSE terhadap ambang (garis putus = batas selang kepercayaan 95%)', series: [{ name: 'SSE(r)', y: r.profile.sse, x: r.profile.x, dots: r.profile.x.length <= 60 }], x: r.profile.x, xlabel: `Nilai ambang r (${sName})`, ylabel: 'SSE', hline: r.critSse, w: 640, h: 230 });
    sum += SV.lines({ title: 'Residu', series: [{ name: 'Residu', y: pad(n, m, r.resid), dots: n <= 80 }], x: xs, xlabel: 'Periode waktu (t)', ylabel: 'Residu', hline: 0, w: 640, h: 200 });
    /* tabel ringkasan */
    const ciTxt = r.ci ? `${g(thr[0], 5)}  (selang 95%: ${g(r.ci.lo, 5)} sampai ${g(r.ci.hi, 5)})` : thr.map((v) => g(v, 5)).join(' ; ');
    sum += kv(`Ringkasan model ${NAME[type]}${nreg === 3 ? ' (3 rezim)' : ' (2 rezim)'}`, [
      ['Variabel ambang', sName + (self ? ' (lag Y sendiri)' : ' (variabel eksternal)')], [`Delay d${r.autoD ? ' (dipilih otomatis)' : ''}`, d], [`Ambang${nreg === 3 ? ' (r₁ ; r₂)' : ' r'}`, ciTxt],
      ['Orde AR per rezim', orders.join(' ; ')], ['Pengamatan efektif (T)', `${T} dari ${n} (awal ${m} data dipakai sebagai nilai lag)`], ['Pengamatan per rezim', regimes.map((x) => `${x.n} (${fmt(x.share * 100, 1)}%)`).join(' ; ')],
      ['SSE', g(r.sse)], ['σ² (SSE / T)', g(r.sigma2)], ['R²', fmt(r.r2, 4)], ['AIC / BIC', `${fmt(r.aic, 3)} / ${fmt(r.bic, 3)}`],
      r.lin ? [`Pembanding AR(${r.pmax}) linier: SSE · AIC`, `${g(r.lin.sse)} · ${fmt(r.lin.aic, 3)}  →  SSE turun ${fmt(r.sseGain * 100, 2)}%, AIC ${r.aic < r.lin.aic ? 'lebih kecil (model ambang lebih baik)' : 'tidak lebih kecil (model linier cukup)'}`] : null].filter(Boolean));
    regimes.forEach((rg, j) => {
      const nm = ['Konstanta'].concat(Array.from({ length: rg.p }, (_, i) => `${nmY}${lag(i + 1)}`));
      sum += tab(`Rezim ${j + 1}: ${regLabel(j)}  (n = ${rg.n}, s² = ${g(rg.s2, 4)})`, ['Suku', 'Koefisien', 'Galat baku', 't', 'p-value'], nm.map((t, i) => [t, g(rg.coef[i], 5), g(rg.se[i], 4), fmt(rg.t[i], 3), `<span${sig(rg.pval[i])}>${fmtP(rg.pval[i])}</span>`]));
    });
    sum += `<table class="result-table bs-res"><caption>Persamaan model</caption><tbody>${regimes.map((rg, j) => `<tr><td class="lbl">Rezim ${j + 1}</td><td style="text-align:left">${esc(regLabel(j))}: ${esc(eqn(rg.coef, nmY))}</td></tr>`).join('')}</tbody></table>`;
    if (r.dTable.length > 1) sum += tab('Pemilihan delay d (SSE terkecil dipilih; sampel efektif sama untuk semua d)', ['d', nreg === 3 ? 'Ambang (r₁ ; r₂)' : 'Ambang r', 'SSE', 'AIC', ''], r.dTable.map((x) => [x.d, x.thr.map((v) => g(v, 5)).join(' ; '), g(x.sse), fmt(x.aic, 3), x.d === d ? '<strong>dipilih</strong>' : '']));
    /* uji linearitas */
    const lin = [[`Tsay (1989), arranged autoregression`, fmt(r.tsay.F, 3), `F(${r.tsay.df1}; ${r.tsay.df2})`, `<span${sig(r.tsay.p)}>${fmtP(r.tsay.p)}</span>`, r.tsay.p < 0.05 ? 'Tolak linieritas' : 'Tidak menolak linieritas']];
    if (r.boot) lin.push([`sup-F Hansen, bootstrap B = ${r.boot.B} (AR(${r.pmax}) vs TAR 2 rezim${r.boot.overD ? ', sup atas d' : ''})`, fmt(r.boot.F, 3), `nilai kritis 5%: ${fmt(r.boot.crit95, 3)}`, `<span${sig(r.boot.p)}>${fmtP(r.boot.p)}</span>`, r.boot.p < 0.05 ? 'Tolak linieritas' : 'Tidak menolak linieritas']);
    sum += tab('Uji linearitas (H₀: AR linier tanpa ambang)', ['Uji', 'Statistik', 'Keterangan', 'p-value', 'Kesimpulan (α = 5%)'], lin);
    sum += diagTable(r);
    if (fc) {
      sum += tab(`Ramalan ${fc.h} periode ke depan`, ['Periode (t)', 'Rezim', 'Ramalan skeleton', 'Rata-rata simulasi', 'Batas bawah 95%', 'Batas atas 95%'], fc.skeleton.map((v, i) => [n + i + 1, fc.regime[i], `<strong>${g(v)}</strong>`, g(fc.mean[i]), g(fc.lo[i]), g(fc.hi[i])]));
      sum += `<p class="bs-note">Skeleton = nilai harapan bersyarat dengan galat masa depan diabaikan (sama dengan ramalan 1 langkah). Rata-rata dan selang 95% berasal dari ${fc.B} lintasan simulasi (galat diambil acak dari residu rezim yang berlaku, seed tetap). ${fc.notes.join(' ')}</p>`;
    }
    sum += tab(`Nilai fit dan residu (${Math.min(T, 60)} baris pertama dari ${T})`, ['t', nmY, self ? `${nmY}${lag(d)}` : `${nmZ}${lag(d)}`, 'Rezim', 'Fit', 'Residu'], r.yEff.slice(0, 60).map((v, i) => [m + i + 1, g(v), g(r.s[i]), r.reg[i] + 1, g(r.fitted[i], 5), g(r.resid[i], 4)]));
    if (r.notes.length) sum += `<p class="bs-note">${r.notes.map(esc).join(' ')}</p>`;
    /* langkah */
    const R1 = regimes[0];
    const st = [
      { t: 'Spesifikasi model', f: `Yₜ = φ₀⁽ʲ⁾ + φ₁⁽ʲ⁾ Yₜ₋₁ + … + φₚ⁽ʲ⁾ Yₜ₋ₚ + εₜ⁽ʲ⁾,   rezim j bila r_{j−1} < ${self ? 'Yₜ₋d' : 'Zₜ₋d'} ≤ r_j\n(r₀ = −∞, r_J = +∞; J = ${nreg} rezim; ambang${nreg === 3 ? ' r₁ < r₂' : ' r'}; delay d = ${d}; orde p = ${orders.join(', ')})`, n: self ? 'SETAR: variabel ambang adalah lag deret itu sendiri (self-exciting).' : 'TAR konvensional: variabel ambang adalah deret Z eksternal; Z masa depan tidak diketahui sehingga ramalan dibatasi sampai d langkah.' },
      { t: 'Sampel efektif', f: `m = maks(p maks, ${r.autoD ? 'd maks' : 'd'}) = ${m}\nT = n − m = ${n} − ${m} = ${T} pengamatan (t = ${m + 1}, …, ${n})`, n: r.autoD ? 'Bila d dipilih otomatis, semua d memakai sampel efektif yang sama agar SSE dan AIC sebanding.' : '' },
      { t: 'Estimasi ambang (kuadrat terkecil bersyarat)', f: `Untuk tiap ambang kandidat r: bagi data menjadi rezim, lalu\nSSE(r) = Σⱼ SSEⱼ(r),   SSEⱼ = Σ (Yₜ − xₜ′φ̂ⱼ)² pada rezim j\nr̂ = argmin SSE(r)   (tiap rezim ≥ ${Math.round(r.trim * 100)}% data dan ≥ k + 2 pengamatan)\n${thr.map((v, j) => `r̂${nreg === 3 ? sub(j + 1) : ''} = ${g(v, 6)}`).join(',   ')},   SSE minimum = ${g(r.sse, 6)}`, n: 'Kandidat ambang adalah nilai teramati variabel ambang; pencarian grid menyeluruh sehingga hasilnya optimum global untuk (d, p) yang diberikan.' },
      { t: 'Koefisien tiap rezim', f: regimes.map((rg, j) => `Rezim ${j + 1} (n = ${rg.n}): φ̂ = (X′X)⁻¹X′y\n  ${eqn(rg.coef, nmY)}\n  SE = √(s²·diag(X′X)⁻¹),  s² = SSE/(n − k) = ${g(rg.s2, 5)}`).join('\n') , n: 'Galat baku dan uji t memperlakukan ambang sebagai tetap (diketahui).' }];
    if (r.ci) st.push({ t: 'Selang kepercayaan ambang (Hansen, 1997)', f: `LR(r) = T·(SSE(r) − SSE(r̂)) / SSE(r̂)\nSelang 95% = { r : LR(r) ≤ ${r.ci.crit} }\n= [${g(r.ci.lo, 6)} ; ${g(r.ci.hi, 6)}]`, n: 'Nilai kritis 7,352 = −2 ln(1 − √0,95) berasal dari distribusi asimtotik LR ambang (galat homoskedastik).' });
    st.push({ t: 'Uji Tsay (1989)', f: `1. Urutkan pengamatan menurut variabel ambang (arranged autoregression).\n2. Hitung residu prediksi rekursif terstandar ê_i = (y_i − x_i′β̂_(i−1)) / √(1 + x_i′(X_(i−1)′X_(i−1))⁻¹x_i).\n3. Regresikan ê_i pada x_i; uji semua koefisien nol:\n   F = [(Σê² − SSE_reg)/${r.tsay.df1}] / [SSE_reg/${r.tsay.df2}] = ${fmt(r.tsay.F, 4)},   p = ${fmtP(r.tsay.p)}`, n: 'Di bawah H₀ (AR linier) residu prediksi tak berkorelasi dengan regresor.' });
    if (r.boot) st.push({ t: 'Uji sup-F Hansen (bootstrap regresor tetap)', f: `F(r, d) = T·(SSE_linier − SSE(r, d)) / SSE(r, d);   statistik = sup atas r${r.boot.overD ? ' dan d' : ''}\nF teramati = ${fmt(r.boot.F, 4)}\nBootstrap: y* = ε̂·η, η ~ N(0,1), regresor tetap; ulangi ${r.boot.B} kali\np = (1 + #{F* ≥ F}) / (B + 1) = ${fmtP(r.boot.p)}   (kuantil 95% bootstrap = ${fmt(r.boot.crit95, 4)})`, n: 'Statistik sup tidak berdistribusi baku karena ambang tidak teridentifikasi di bawah H₀ (masalah Davies), sehingga p-value dihitung dengan bootstrap.' });
    st.push({ t: 'Ukuran kecocokan & diagnostik', f: `σ̂² = SSE/T = ${g(r.sigma2, 6)},   R² = 1 − SSE/SST = ${fmt(r.r2, 4)}\nAIC = T ln(SSE/T) + 2K = ${fmt(r.aic, 3)},   BIC = T ln(SSE/T) + K ln T = ${fmt(r.bic, 3)},   K = ${r.npar} (koefisien + ambang)\nLjung-Box: Q = T(T+2) Σ r̂ₖ²/(T − k) = ${fmt(r.diag.lb.Q, 3)} dengan db = ${r.diag.lb.df}`, n: '' });
    if (fc) st.push({ t: 'Ramalan', f: `Skeleton: Ŷₙ₊ₕ = φ̂₀⁽ʲ⁾ + Σ φ̂ᵢ⁽ʲ⁾ Ŷₙ₊ₕ₋ᵢ, rezim j menurut ${self ? 'Ŷₙ₊ₕ₋d' : 'Zₙ₊ₕ₋d'}\n` + fc.skeleton.slice(0, 4).map((v, i) => `t = ${n + i + 1}: rezim ${fc.regime[i]}, ramalan = ${g(v)}`).join('\n') + (fc.h > 4 ? '\n…' : '') + `\nSelang: ${fc.B} lintasan simulasi dengan galat bootstrap dari residu rezim; kuantil 2,5% dan 97,5%`, n: '' });
    /* interpretasi */
    const ip = [];
    const nlin = Math.min(r.tsay.p, r.boot ? r.boot.p : 1);
    ip.push(`<strong>Nonlinearitas:</strong> uji Tsay p = ${fmtP(r.tsay.p)}${r.boot ? `, sup-F bootstrap p = ${fmtP(r.boot.p)}` : ''} → bukti nonlinearitas ${strength(nlin)}. ${nlin < 0.05 ? 'Model ambang layak dipertimbangkan dibanding AR linier.' : 'Linieritas tidak ditolak, sehingga AR linier (atau ARIMA) mungkin sudah cukup; hasil TAR di bawah sebaiknya dibaca hati-hati.'}`);
    ip.push(`<strong>Ambang:</strong> ${self ? `perilaku ${nmY} berganti menurut nilai ${nmY} ${d} periode sebelumnya` : `perilaku ${nmY} berganti menurut nilai ${nmZ} ${d} periode sebelumnya`}. ${nreg === 2 ? `Ambang terestimasi r̂ = ${g(thr[0], 5)} (selang 95% ${g(r.ci.lo, 4)} sampai ${g(r.ci.hi, 4)}); ${regimes[0].n} pengamatan (${fmt(regimes[0].share * 100, 1)}%) berada di rezim bawah dan ${regimes[1].n} (${fmt(regimes[1].share * 100, 1)}%) di rezim atas.` : `Ambang terestimasi r̂₁ = ${g(thr[0], 5)} dan r̂₂ = ${g(thr[1], 5)}; pengamatan per rezim: ${regimes.map((x) => x.n).join(', ')}.`}${r.ci && (r.ci.hi - r.ci.lo) > 0.5 * (Math.max.apply(null, r.s) - Math.min.apply(null, r.s)) ? ' Selang ambang sangat lebar: ambang kurang tegas teridentifikasi.' : ''}`);
    const dyn = regimes.map((rg, j) => `rezim ${j + 1}: Σφ = ${fmt(rg.sumPhi, 3)} → ${Math.abs(rg.sumPhi) >= 1 ? 'tidak stasioner / sangat persisten' : Math.abs(rg.sumPhi) > 0.8 ? 'sangat persisten' : Math.abs(rg.sumPhi) > 0.4 ? 'persistensi sedang' : 'cepat kembali ke rata-rata'}`);
    ip.push(`<strong>Dinamika tiap rezim:</strong> ${dyn.join('; ')}. Rezim yang berbeda nyata dalam koefisien menunjukkan asimetri (misalnya pemulihan lebih cepat di satu sisi ambang).`);
    ip.push(`<strong>Kecocokan:</strong> SSE turun ${fmt((r.sseGain || 0) * 100, 2)}% terhadap AR(${r.pmax}) linier; AIC ${fmt(r.aic, 2)} vs ${fmt(r.lin.aic, 2)} (linier)${r.aic < r.lin.aic ? ', model ambang lebih disukai menurut AIC' : ', model linier tidak kalah menurut AIC'}. R² = ${fmt(r.r2, 3)}.`);
    ip.push(`<strong>Diagnostik:</strong> ${r.diag.lb.p < 0.05 ? 'residu masih berautokorelasi (naikkan orde AR atau ubah delay). ' : 'tidak ada autokorelasi residu. '}${r.diag.lbSq.p < 0.05 ? 'Ada indikasi ragam tidak konstan (efek ARCH); selang ramalan bisa terlalu sempit/lebar di sebagian periode. ' : ''}${r.diag.jb.p < 0.05 ? 'Residu menyimpang dari normal (selang ramalan memakai bootstrap residu sehingga tidak mengandalkan kenormalan).' : ''}`);
    if (fc) ip.push(`<strong>Ramalan:</strong> ${fc.h} periode ke depan dimulai di rezim ${fc.regime[0]} dengan ramalan ${g(fc.skeleton[0])}${fc.h > 1 ? ` dan ${g(fc.skeleton[fc.h - 1])} pada periode ke-${fc.h}` : ''}. Pada model ambang, ramalan banyak langkah dapat berpindah rezim sehingga tidak sederhana; selang 95% dari simulasi lebih informatif daripada skeleton.${fc.notes.length ? ' ' + fc.notes.join(' ') : ''}`);
    ip.push(`<strong>Asumsi:</strong> galat tak berkorelasi, rezim cukup banyak pengamatan, dan proses stasioner-ergodik (periksa jumlah koefisien AR rezim luar &lt; 1). ${self ? '' : 'Variabel ambang Z dianggap eksogen. '}Ambang dan delay diestimasi dari data sehingga uji t koefisien bersifat bersyarat pada keduanya. ${nreg === 2 ? 'Untuk peralihan bertahap pertimbangkan STAR.' : ''}`);
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${NAME[type]}: ${nreg} rezim, d = ${d}</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', NAME[type] + ` (${nreg} rezim)`], ['n', n], ['Delay d', d], ['Ambang', thr.map((v) => g(v, 5)).join(' ; ')], ['AIC', fmt(r.aic, 2)], ['p Tsay', fmtP(r.tsay.p)]],
      data: { head: ['t', nmY, self ? nmY + ' (t−d)' : nmZ + ' (t−d)', 'Rezim', 'Fit', 'Sisa'], rows: r.yEff.map((v, i) => [m + i + 1, v, r.s[i], r.reg[i] + 1, r.fitted[i], r.resid[i]]), caption: 'Data efektif, rezim, nilai fit, dan residu.' } });
  }
  const y_ = (r) => r.y.slice();

  /* ===================================== STAR ===================================== */
  function showSTAR(r, nmY) {
    const { n, T, m, d, p, k, fit, form } = r, fc = r.forecast, F = form.toUpperCase(), nmS = `${nmY}${lag(d)}`;
    const xs = Array.from({ length: n }, (_, i) => i + 1), xsF = fc ? fc.skeleton.map((_, i) => n + i + 1) : [], NaNs = (z) => Array(z).fill(NaN);
    let sum = SV.lines({ title: 'Data, nilai fit, dan ramalan', series: [{ name: 'Data', y: r.y.slice().concat(NaNs(xsF.length)), dots: n <= 80 }, { name: 'Nilai fit model', y: pad(n, m, r.fitted).concat(NaNs(xsF.length)), dash: '5 3' }].concat(fc ? [{ name: 'Ramalan (skeleton)', y: NaNs(n - 1).concat([r.y[n - 1]]).concat(fc.skeleton), width: 2.4, color: '#c2493d' }, { name: 'Batas bawah 95%', y: NaNs(n).concat(fc.lo), dash: '2 3', color: '#8a8f98' }, { name: 'Batas atas 95%', y: NaNs(n).concat(fc.hi), dash: '2 3', color: '#8a8f98' }] : []), x: xs.concat(xsF), xlabel: 'Periode waktu (t)', ylabel: nmY, w: 640, h: 300 });
    const so = fit.sOrder; sum += SV.lines({ title: `Fungsi peralihan G(${nmS}) — ${F}`, series: [{ name: 'G (bobot rezim kedua)', y: so.map((i) => fit.G[i]), x: so.map((i) => r.s[i]), dots: T <= 200 }], x: so.map((i) => r.s[i]), xlabel: `Variabel peralihan ${nmS}`, ylabel: 'G', hline: 0.5, w: 560, h: 240 });
    sum += SV.lines({ title: 'Bobot rezim kedua G menurut waktu', series: [{ name: 'G(t)', y: pad(n, m, fit.G), dots: n <= 80 }], x: xs, xlabel: 'Periode waktu (t)', ylabel: 'G(t)', hline: 0.5, w: 640, h: 190 });
    sum += SV.lines({ title: 'Residu', series: [{ name: 'Residu', y: pad(n, m, r.resid), dots: n <= 80 }], x: xs, xlabel: 'Periode waktu (t)', ylabel: 'Residu', hline: 0, w: 640, h: 190 });
    sum += kv(`Ringkasan model ${F}`, [
      ['Bentuk fungsi peralihan', form === 'lstar' ? 'LSTAR: G = 1 / (1 + exp(−γ (s − c)/sₛ))' : 'ESTAR: G = 1 − exp(−γ (s − c)²/sₛ²)'], ['Variabel peralihan s', `${nmS}${r.autoD ? '  (delay d = ' + d + ' dipilih otomatis: p-value uji linearitas terkecil)' : ''}`],
      ['Parameter γ (kehalusan, skala terstandar)', `${g(fit.gamma, 5)}  (SE ${g(fit.seGamma, 4)})`], ['Parameter c (lokasi peralihan)', `${g(fit.c, 5)}  (SE ${g(fit.seC, 4)})`], ['Orde AR (p)', p],
      ['Pengamatan efektif (T)', `${T} dari ${n}`], ['Proporsi pengamatan dengan G > 0,5', fmt(r.shareHigh * 100, 1) + '%'], ['Rentang G', `${fmt(Math.min.apply(null, fit.G), 3)} sampai ${fmt(Math.max.apply(null, fit.G), 3)}`],
      ['SSE', g(r.sse)], ['σ² (SSE / T)', g(r.sigma2)], ['R²', fmt(r.r2, 4)], ['AIC / BIC', `${fmt(r.aic, 3)} / ${fmt(r.bic, 3)}`],
      [`Pembanding AR(${p}) linier: SSE · AIC`, `${g(r.lin.sse)} · ${fmt(r.lin.aic, 3)}  →  SSE turun ${fmt(r.sseGain * 100, 2)}%, AIC ${r.aic < r.lin.aic ? 'lebih kecil (STAR lebih baik)' : 'tidak lebih kecil (model linier cukup)'}`]]);
    const nmT = ['Konstanta'].concat(Array.from({ length: p }, (_, i) => `${nmY}${lag(i + 1)}`));
    sum += tab('Koefisien STAR: rezim awal (G = 0), tambahan (G beralih ke 1), dan rezim kedua (G = 1)', ['Suku', 'φ (G = 0)', 'p-value', 'θ (tambahan)', 'p-value', 'φ + θ (G = 1)', 'p-value'], nmT.map((t, i) => [t, g(fit.phi[i], 5), `<span${sig(fit.pPhi[i])}>${fmtP(fit.pPhi[i])}</span>`, g(fit.theta[i], 5), `<span${sig(fit.pTheta[i])}>${fmtP(fit.pTheta[i])}</span>`, g(fit.high[i], 5), `<span${sig(fit.pHigh[i])}>${fmtP(fit.pHigh[i])}</span>`]));
    sum += `<table class="result-table bs-res"><caption>Persamaan model</caption><tbody><tr><td class="lbl">Rezim G = 0</td><td style="text-align:left">${esc(eqn(fit.phi, nmY))}</td></tr><tr><td class="lbl">Rezim G = 1</td><td style="text-align:left">${esc(eqn(fit.high, nmY))}</td></tr></tbody></table><p class="bs-note">Galat baku dari Jacobian nonlinier: SE φ = ${fit.sePhi.map((v) => g(v, 3)).join(', ')}; SE θ = ${fit.seTheta.map((v) => g(v, 3)).join(', ')}. Uji t untuk γ dan c tidak ditampilkan karena tidak berdistribusi t baku (γ = 0 membuat c tidak teridentifikasi).</p>`;
    /* uji Terasvirta */
    sum += tab('Uji linearitas Teräsvirta untuk tiap delay (H₀: AR linier). Sampel efektif sama untuk semua d; d dipilih dengan p-value terkecil.', ['d', 'F umum', 'p-value', 'p H04', 'p H03', 'p H02', 'Saran bentuk'], r.tests.map((t) => [t.d + (t.d === d ? ' ✓' : ''), fmt(t.general.F, 3), `<span${sig(t.general.p)}>${fmtP(t.general.p)}</span>`, fmtP(t.h04.p), fmtP(t.h03.p), fmtP(t.h02.p), t.choice ? t.choice.toUpperCase() : '-']));
    sum += `<p class="bs-note">Urutan uji Teräsvirta (1994): H04: koefisien suku s³ = 0; H03: koefisien s² = 0 | s³ = 0; H02: koefisien s = 0 | s², s³ = 0. Bila H03 paling kuat ditolak (p terkecil) → ESTAR; selain itu LSTAR.</p>`;
    if (Object.keys(r.fits).length > 1) sum += tab('Perbandingan LSTAR vs ESTAR (data dan delay sama)', ['Bentuk', 'γ', 'c', 'SSE', 'AIC', 'BIC', ''], Object.keys(r.fits).map((k2) => { const f2 = r.fits[k2]; return [k2.toUpperCase(), g(f2.gamma, 4), g(f2.c, 4), g(f2.sse, 5), fmt(f2.aic, 3), fmt(f2.bic, 3), k2 === form ? '<strong>dipilih (aturan Teräsvirta)</strong>' : '']; }));
    sum += diagTable(r);
    if (fc) {
      sum += tab(`Ramalan ${fc.h} periode ke depan`, ['Periode (t)', 'G', 'Ramalan skeleton', 'Rata-rata simulasi', 'Batas bawah 95%', 'Batas atas 95%'], fc.skeleton.map((v, i) => [n + i + 1, fmt(fc.G[i], 3), `<strong>${g(v)}</strong>`, g(fc.mean[i]), g(fc.lo[i]), g(fc.hi[i])]));
      sum += `<p class="bs-note">Skeleton = nilai harapan bersyarat tanpa galat masa depan. Rata-rata dan selang 95% dari ${fc.B} lintasan simulasi dengan galat bootstrap dari residu (seed tetap).</p>`;
    }
    sum += tab(`Nilai fit dan residu (${Math.min(T, 60)} baris pertama dari ${T})`, ['t', nmY, nmS, 'G', 'Fit', 'Residu'], r.yEff.slice(0, 60).map((v, i) => [m + i + 1, g(v), g(r.s[i]), fmt(fit.G[i], 4), g(r.fitted[i], 5), g(r.resid[i], 4)]));
    if (r.notes.length) sum += `<p class="bs-note">${r.notes.map(esc).join(' ')}</p>`;
    const st = [
      { t: 'Spesifikasi model STAR', f: `Yₜ = w′ₜφ + w′ₜθ · G(sₜ; γ, c) + εₜ,   wₜ = (1, Yₜ₋₁, …, Yₜ₋ₚ)′,   sₜ = Yₜ₋d\n${form === 'lstar' ? 'LSTAR: G = [1 + exp(−γ (s − c)/σ̂ₛ)]⁻¹' : 'ESTAR: G = 1 − exp(−γ (s − c)²/σ̂ₛ²)'},   γ > 0\nG = 0 → rezim φ;  G = 1 → rezim φ + θ;  nilai antara = campuran mulus`, n: 'Peralihan dibakukan dengan simpangan baku sampel σ̂ₛ sehingga γ tidak bergantung pada satuan data (Teräsvirta, 1994).' },
      { t: 'Sampel efektif', f: `m = maks(p, ${r.autoD ? 'd maks' : 'd'}) = ${m};  T = n − m = ${T}`, n: '' },
      { t: 'Uji linearitas Teräsvirta (tiap delay)', f: `Regresi bantu: Yₜ pada wₜ, wₜ·sₜ, wₜ·sₜ², wₜ·sₜ³ (tanpa konstanta pada suku interaksi)\nF = [(SSE₀ − SSE₃)/(3p)] / [SSE₃/(T − k − 3p)],  k = p + 1\nd terpilih: ${d} (p-value ${fmtP(r.testD.general.p)})`, n: r.autoD ? 'Delay dipilih dengan p-value uji linearitas terkecil.' : 'Delay ditetapkan pengguna.' },
      { t: 'Pemilihan LSTAR / ESTAR', f: `H04: p = ${fmtP(r.testD.h04.p)};  H03: p = ${fmtP(r.testD.h03.p)};  H02: p = ${fmtP(r.testD.h02.p)}\nAturan: H03 paling kuat ditolak → ESTAR; selain itu → LSTAR\nBentuk dipakai: ${F}`, n: '' },
      { t: 'Estimasi kuadrat terkecil nonlinier', f: `Untuk (γ, c) tertentu, φ dan θ diperoleh OLS dari regresi Y pada [w, w·G] (variable projection)\n1. Grid γ ∈ {0,05 … 256} × c ∈ kuantil 10%–90% sₜ (${fit.nGrid} titik valid)\n2. Nelder-Mead pada (ln γ, c) dari 3 titik awal terbaik; c dibatasi di kuantil 5%–95%\nγ̂ = ${g(fit.gamma, 6)},  ĉ = ${g(fit.c, 6)} (terstandar ${g(fit.cStd, 5)}),  SSE = ${g(r.sse, 7)}`, n: '' },
      { t: 'Galat baku', f: `Cov = s²·(J′J)⁻¹,  s² = SSE/(T − ${fit.npar}) = ${g(fit.s2, 5)}\nJ = turunan fitted terhadap (φ, θ, γ, c̃): w, w·G, (w′θ)·∂G/∂γ, (w′θ)·∂G/∂c̃\nSE(γ̂) = ${g(fit.seGamma, 4)},  SE(ĉ) = ${g(fit.seC, 4)}`, n: 'SE(φ + θ) memakai kovarians φ dan θ.' },
      { t: 'Ukuran kecocokan & diagnostik', f: `AIC = T ln(SSE/T) + 2K = ${fmt(r.aic, 3)},  BIC = ${fmt(r.bic, 3)},  K = ${fit.npar} (2(p+1) koefisien + γ + c)\nLjung-Box Q = ${fmt(r.diag.lb.Q, 3)} (db ${r.diag.lb.df}),  p = ${fmtP(r.diag.lb.p)}`, n: '' }];
    if (fc) st.push({ t: 'Ramalan', f: 'Skeleton rekursif: hitung G dari ŝ, lalu Ŷₙ₊ₕ = w′(φ + θG)\n' + fc.skeleton.slice(0, 4).map((v, i) => `t = ${n + i + 1}: G = ${fmt(fc.G[i], 3)}, ramalan = ${g(v)}`).join('\n') + (fc.h > 4 ? '\n…' : '') + `\nSelang: ${fc.B} lintasan simulasi dengan bootstrap residu`, n: '' });
    const ip = [];
    ip.push(`<strong>Nonlinearitas:</strong> uji Teräsvirta pada d = ${d}: F = ${fmt(r.testD.general.F, 3)}, p = ${fmtP(r.testD.general.p)} → bukti nonlinearitas ${strength(r.testD.general.p)}. ${r.testD.general.p < 0.05 ? 'Struktur STAR layak dipertimbangkan.' : 'Linieritas tidak ditolak; model STAR yang terestimasi kemungkinan tidak lebih baik dari AR linier dan parameternya sulit teridentifikasi.'}`);
    ip.push(`<strong>Bentuk peralihan:</strong> ${F}${o_form(r)}. ${form === 'lstar' ? `Perilaku berganti secara asimetris di sekitar c = ${g(fit.c, 4)}: untuk ${nmS} jauh di bawah c pengaruh rezim φ dominan, jauh di atas c rezim φ + θ dominan.` : `Rezim tengah (G ≈ 0, ${nmS} dekat c = ${g(fit.c, 4)}) berbeda dari rezim tepi (G ≈ 1, ${nmS} jauh dari c ke kedua arah); cocok untuk dinamika yang simetris terhadap c, misalnya kembali ke keseimbangan hanya bila simpangan cukup besar.`}`);
    ip.push(`<strong>Kehalusan peralihan:</strong> γ̂ = ${g(fit.gamma, 4)} (terstandar). ${fit.gamma < 1 ? 'Peralihan sangat landai: perubahan rezim bertahap, bentuknya mendekati linier.' : fit.gamma < 10 ? 'Peralihan cukup mulus.' : fit.gamma < 100 ? 'Peralihan cukup tajam (mendekati loncatan).' : 'Peralihan hampir berupa loncatan; SETAR dapat lebih sederhana dan galat baku γ tidak dapat dipercaya.'} ${fmt(r.shareHigh * 100, 1)}% pengamatan lebih dekat ke rezim kedua (G &gt; 0,5).`);
    ip.push(`<strong>Kecocokan:</strong> SSE turun ${fmt(r.sseGain * 100, 2)}% terhadap AR(${p}) linier; AIC ${fmt(r.aic, 2)} vs ${fmt(r.lin.aic, 2)} (linier)${r.aic < r.lin.aic ? ', STAR lebih disukai menurut AIC' : ', model linier tidak kalah menurut AIC'}. R² = ${fmt(r.r2, 3)}.`);
    ip.push(`<strong>Diagnostik:</strong> ${r.diag.lb.p < 0.05 ? 'residu masih berautokorelasi (naikkan orde AR atau ubah delay). ' : 'tidak ada autokorelasi residu. '}${r.diag.lbSq.p < 0.05 ? 'Ada indikasi efek ARCH. ' : ''}${r.diag.jb.p < 0.05 ? 'Residu menyimpang dari normal.' : ''}`);
    if (fc) ip.push(`<strong>Ramalan:</strong> ramalan ${fc.h} periode ke depan berkisar ${g(Math.min.apply(null, fc.skeleton))} sampai ${g(Math.max.apply(null, fc.skeleton))} (skeleton). Selang 95% dari simulasi umumnya lebih lebar pada horizon jauh.`);
    ip.push('<strong>Asumsi &amp; catatan:</strong> galat tak berkorelasi dan ragamnya konstan, proses stasioner-ergodik. Estimasi NLS dapat memiliki beberapa optimum lokal; program memakai grid dan tiga titik awal, namun bila γ hampir 0 atau sangat besar parameter c kurang teridentifikasi dan galat bakunya tidak informatif.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>${F}(${p}), d = ${d}</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', F], ['n', n], ['Delay d', d], ['γ', g(fit.gamma, 5)], ['c', g(fit.c, 5)], ['AIC', fmt(r.aic, 2)], ['p linearitas', fmtP(r.testD.general.p)]],
      data: { head: ['t', nmY, nmS, 'G', 'Fit', 'Sisa'], rows: r.yEff.map((v, i) => [m + i + 1, v, r.s[i], fit.G[i], r.fitted[i], r.resid[i]]), caption: 'Data efektif, bobot peralihan G, nilai fit, dan residu.' } });
  }
  function o_form(r) { return q('trForm').value === 'auto' ? ' (dipilih otomatis oleh aturan Teräsvirta)' : ' (dipilih pengguna)'; }
})();
