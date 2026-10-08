/* =========================================================================
   METODE — UJI STASIONERITAS (Augmented Dickey-Fuller / uji akar unit)
   -------------------------------------------------------------------------
   Persamaan uji (regresi OLS):
     Δz[t] = α + δ·t + γ·z[t−1] + φ1·Δz[t−1] + ... + φp·Δz[t−p] + e[t]
   H0: γ = 0 (ada akar unit → data TIDAK stasioner)
   H1: γ < 0 (tidak ada akar unit → data stasioner)
   Statistik uji (tau) = t-hitung γ; nilai kritis & p-value memakai
   pendekatan MacKinnon (bukan distribusi t biasa). Keputusan: tau < nilai kritis 5%.
   Perhitungan matriks memakai mesin regresi dari regresi.js (window.StatCalcReg).
   ========================================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const REG = window.StatCalcReg;

  const el = {
    view: $('#view-stasioner'),
    diff: $('#stDiff'), model: $('#stModel'), lagMode: $('#stLagMode'), lag: $('#stLag'), lagRow: $('#stLagRow'),
    buildBtn: $('#stBuildTableBtn'), setupError: $('#stSetupError'),
    dataCard: $('#st-data-card'), minRowsHint: $('#stMinRowsHint'),
    tableBody: $('#stDataTableBody'),
    addRowBtn: $('#stAddRowBtn'), removeRowBtn: $('#stRemoveRowBtn'), fillSampleBtn: $('#stFillSampleBtn'),
    calcBtn: $('#stCalcBtn'), dataError: $('#stDataError'),
    resultsCard: $('#st-results-card'),
    tableWrap: $('#stTableWrap'), testWrap: $('#stTestWrap'), stepsWrap: $('#stStepsWrap'), chartWrap: $('#stChartWrap'),
    conclusionCard: $('#st-conclusion-card'), conclusionWrap: $('#stConclusionWrap'),
  };
  if (!el.view || !REG) return;

  const state = { d: 0, model: 'c', lagMode: 'auto', lag: 1, minRows: 10 };

  const SAMPLE = [100, 105.5, 106.3, 108.2, 110.9, 110.9, 112.7, 114.5, 112.5, 116.5, 119.6, 120.1, 121.5, 124.4, 125.6,
    126.9, 125.5, 128.5, 130.6, 133, 131.4, 136.9, 139, 139.9, 146.2, 147.9, 146.5, 147.4, 144.2, 148.3];

  const MODEL_LABEL = {
    nc: 'Tanpa konstanta & tren (none)',
    c: 'Dengan konstanta (intercept)',
    ct: 'Dengan konstanta & tren (trend and intercept)',
  };

  /* ------------------------------- Setup ------------------------------- */
  el.lagMode.addEventListener('change', () => { el.lagRow.hidden = el.lagMode.value !== 'manual'; });

  el.buildBtn.addEventListener('click', () => {
    hideError(el.setupError);
    const d = parseInt(el.diff.value, 10);
    const lagMode = el.lagMode.value;
    const lag = parseInt(el.lag.value, 10);
    if (lagMode === 'manual' && (!Number.isInteger(lag) || lag < 0 || lag > 12)) {
      showError(el.setupError, 'Jumlah lag harus bilangan bulat antara 0 dan 12.');
      return;
    }
    state.d = d; state.model = el.model.value; state.lagMode = lagMode; state.lag = lag;
    state.minRows = 10 + d + (lagMode === 'manual' ? lag : 0);
    el.minRowsHint.textContent = state.minRows;
    buildTable(Math.max(state.minRows, 12));
    el.dataCard.hidden = false;
    el.resultsCard.hidden = true;
    el.conclusionCard.hidden = true;
    el.dataCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function buildTable(rowCount) {
    el.tableBody.innerHTML = '';
    for (let i = 0; i < rowCount; i++) addRow();
  }
  function addRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="rownum"></td><td><input type="text" inputmode="decimal" placeholder="Nilai"></td>';
    el.tableBody.appendChild(tr);
    renumber();
  }
  function removeRow() {
    if (el.tableBody.rows.length <= state.minRows) return;
    el.tableBody.deleteRow(el.tableBody.rows.length - 1);
    renumber();
  }
  function renumber() { $$('tr', el.tableBody).forEach((tr, i) => { tr.querySelector('.rownum').textContent = i + 1; }); }

  el.addRowBtn.addEventListener('click', addRow);
  el.removeRowBtn.addEventListener('click', removeRow);
  el.fillSampleBtn.addEventListener('click', () => {
    buildTable(SAMPLE.length);
    $$('input', el.tableBody).forEach((inp, i) => { inp.value = SAMPLE[i]; });
  });

  function collectData() {
    const y = [], problems = [];
    $$('input', el.tableBody).forEach((inp) => inp.classList.remove('invalid'));
    $$('tr', el.tableBody).forEach((tr, i) => {
      const inp = tr.querySelector('input');
      const raw = inp.value.trim().replace(',', '.');
      const v = parseFloat(raw);
      if (raw === '' || Number.isNaN(v)) { problems.push(`Baris ${i + 1}: nilai kosong atau bukan angka.`); inp.classList.add('invalid'); }
      y.push(v);
    });
    if (problems.length) return { error: problems.slice(0, 6).join(' ') + (problems.length > 6 ? ' \u2026' : '') };
    if (y.length < state.minRows) return { error: `Minimal ${state.minRows} periode data diperlukan untuk pengaturan yang dipilih.` };
    if (new Set(y).size === 1) return { error: 'Seluruh nilai data sama (tidak ada variasi), sehingga uji stasioneritas tidak dapat dihitung.' };
    return { y };
  }

  /* ------------------------ Distribusi MacKinnon ------------------------ */
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function normCdf(x) { return 0.5 * erfc(-x / Math.SQRT2); }

  const MK_P = {
    nc: { small: [0.6344, 1.2378, 0.032496], large: [0.4797, 0.93557, -0.06999, 0.033066], star: -1.04, min: -19.04, max: Infinity },
    c: { small: [2.1659, 1.4412, 0.038269], large: [1.7339, 0.93202, -0.12745, -0.010368], star: -1.61, min: -18.83, max: 2.74 },
    ct: { small: [3.2512, 1.6047, 0.049588], large: [2.5261, 0.61654, -0.37956, -0.060285], star: -2.89, min: -16.18, max: 0.7 },
  };
  const MK_CRIT = { // MacKinnon (2010), N = 1; baris = 1%, 5%, 10%; kolom = [a, b, c, d]
    nc: [[-2.56574, -2.2358, -3.627, 0], [-1.941, -0.2686, -3.365, 31.223], [-1.61682, 0.2656, -2.714, 25.364]],
    c: [[-3.43035, -6.5393, -16.786, -79.433], [-2.86154, -2.8903, -4.234, -40.04], [-2.56677, -1.5384, -2.809, 0]],
    ct: [[-3.95877, -9.0531, -28.428, -134.155], [-3.41049, -4.3904, -9.036, -45.374], [-3.12705, -2.5856, -3.925, -22.38]],
  };

  function mackinnonP(tau, model) {
    const m = MK_P[model];
    if (tau > m.max) return 1;
    if (tau < m.min) return 0;
    const coef = tau <= m.star ? m.small : m.large;
    let v = 0;
    for (let i = coef.length - 1; i >= 0; i--) v = v * tau + coef[i];
    return normCdf(v);
  }
  function mackinnonCrit(nobs, model) {
    return MK_CRIT[model].map(([a, b, c, d]) => a + b / nobs + c / (nobs * nobs) + d / (nobs * nobs * nobs));
  }

  /* ------------------------------ Inti ADF ------------------------------ */
  function diffSeries(a) { const r = []; for (let i = 1; i < a.length; i++) r.push(a[i] - a[i - 1]); return r; }

  function olsFit(y, cols) {
    const n = y.length, k = cols.length;
    const X = y.map((_, i) => cols.map((c) => c[i]));
    const Xt = REG.transpose(X);
    const XtX = REG.matMul(Xt, X);
    const inv = REG.invertMatrix(XtX);
    const beta = REG.matMul(inv, REG.matMul(Xt, y.map((v) => [v]))).map((r) => r[0]);
    const resid = y.map((v, i) => v - X[i].reduce((s, x, j) => s + x * beta[j], 0));
    const SSE = resid.reduce((s, e) => s + e * e, 0);
    const df = n - k;
    const s2 = df > 0 ? SSE / df : NaN;
    const se = beta.map((_, j) => Math.sqrt(Math.max(s2 * inv[j][j], 0)));
    return { n, k, beta, se, resid, SSE, df, s2, aic: n * Math.log(SSE / n) + 2 * k };
  }

  /* Susun & estimasi regresi ADF dengan p lag; baris pertama yang dipakai = start (>= p+1) */
  function fitADF(z, p, model, start) {
    const N = z.length, from = Math.max(start, p + 1);
    const y = [], gam = [], cst = [], trd = [], lags = Array.from({ length: p }, () => []);
    for (let t = from; t < N; t++) {
      y.push(z[t] - z[t - 1]);
      gam.push(z[t - 1]);
      cst.push(1);
      trd.push(t);
      for (let i = 1; i <= p; i++) lags[i - 1].push(z[t - i] - z[t - i - 1]);
    }
    const cols = [gam, ...lags], names = ['\u03B3 (z[t\u22121])', ...lags.map((_, i) => `\u03C6${i + 1} (\u0394z[t\u2212${i + 1}])`)];
    if (model === 'c' || model === 'ct') { cols.push(cst); names.push('\u03B1 (konstanta)'); }
    if (model === 'ct') { cols.push(trd); names.push('\u03B4 (tren t)'); }
    const fit = olsFit(y, cols);
    if (!(fit.df >= 1)) throw new Error('Data terlalu sedikit untuk jumlah lag & komponen model yang dipilih (derajat bebas regresi tidak cukup). Tambah data atau kurangi jumlah lag.');
    fit.names = names; fit.p = p; fit.y = y;
    fit.tau = fit.beta[0] / fit.se[0];
    return fit;
  }

  function runADF(raw, cfg) {
    // 1. diferensiasi
    const series = [raw];
    for (let i = 0; i < cfg.d; i++) series.push(diffSeries(series[series.length - 1]));
    const z = series[series.length - 1], N = z.length;
    const ntrend = cfg.model === 'nc' ? 0 : cfg.model === 'c' ? 1 : 2;

    // 2. pemilihan lag
    let p = cfg.lag, aicTable = null, maxlag = null;
    if (cfg.lagMode === 'auto') {
      maxlag = Math.min(Math.floor(N / 2) - ntrend - 1, Math.ceil(12 * Math.pow(N / 100, 0.25)));
      while (maxlag > 0 && (N - 1 - maxlag) - (maxlag + 1 + ntrend) < 1) maxlag--;
      if (maxlag < 0) throw new Error('Data terlalu sedikit untuk memilih lag otomatis. Tambah data.');
      aicTable = [];
      for (let l = 0; l <= maxlag; l++) {
        const f = fitADF(z, l, cfg.model, maxlag + 1);
        aicTable.push({ lag: l, aic: f.aic, tau: f.tau });
      }
      p = aicTable.reduce((b, r) => (r.aic < b.aic ? r : b), aicTable[0]).lag;
    }
    // 3. estimasi akhir pada seluruh sampel yang tersedia
    const fit = fitADF(z, p, cfg.model, p + 1);
    const nobs = fit.n;
    const crit = mackinnonCrit(nobs, cfg.model);
    const pval = mackinnonP(fit.tau, cfg.model);
    return { cfg, series, z, N, p, aicTable, maxlag, fit, nobs, crit, pval, stationary: fit.tau < crit[1] };
  }

  /* ------------------------------ Tombol hitung ------------------------------ */
  el.calcBtn.addEventListener('click', () => {
    hideError(el.dataError);
    const data = collectData();
    if (data.error) { showError(el.dataError, data.error); return; }
    let res;
    try { res = runADF(data.y, state); }
    catch (err) {
      showError(el.dataError, /singular/i.test(err.message)
        ? 'Perhitungan regresi gagal (matriks singular) \u2014 data terlalu seragam/linear untuk model dan jumlah lag ini. Coba kurangi jumlah lag atau ganti model.'
        : err.message);
      return;
    }
    renderTable(res, data.y);
    renderTest(res);
    renderSteps(res);
    renderChart(res, data.y);
    renderConclusion(res);
    $$('.tab-btn', el.view).forEach((b) => b.classList.remove('active'));
    $$('.tab-panel', el.view).forEach((p) => p.classList.remove('active'));
    $('.tab-btn[data-tab="st-tab-test"]').classList.add('active');
    $('#st-tab-test').classList.add('active');
    el.resultsCard.hidden = false;
    el.conclusionCard.hidden = false;
    el.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
  });

  $$('.tab-btn', el.view).forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab-btn', el.view).forEach((b) => b.classList.remove('active'));
      $$('.tab-panel', el.view).forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $('#' + btn.dataset.tab).classList.add('active');
    });
  });

  /* ------------------------------- Tampilan ------------------------------- */
  const dLabel = (d) => (d === 0 ? 'level (data asli)' : d === 1 ? 'diferensi pertama' : 'diferensi kedua');

  function renderTable(res, raw) {
    const d = res.cfg.d, N = res.N;
    let head = '<th>Periode</th><th>Y (asli)</th>';
    if (d >= 1) head += '<th>\u0394Y</th>';
    if (d >= 2) head += '<th>\u0394\u00B2Y</th>';
    head += '<th>z[t] (diuji)</th><th>z[t\u22121]</th><th>\u0394z[t]</th>';
    let body = '';
    for (let i = 0; i < raw.length; i++) {
      let row = `<td>${i + 1}</td><td>${fmt(raw[i], 3)}</td>`;
      for (let k = 1; k <= d; k++) { const v = res.series[k][i - k]; row += `<td>${i - k >= 0 ? fmt(v, 3) : '\u2014'}</td>`; }
      const zi = i - d;
      const zt = zi >= 0 ? res.z[zi] : null;
      row += `<td>${zt === null ? '\u2014' : fmt(zt, 3)}</td>`;
      row += `<td>${zi >= 1 ? fmt(res.z[zi - 1], 3) : '\u2014'}</td>`;
      row += `<td>${zi >= 1 ? fmt(res.z[zi] - res.z[zi - 1], 3) : '\u2014'}</td>`;
      body += `<tr>${row}</tr>`;
    }
    el.tableWrap.innerHTML = `<table class="result-table"><caption>Data asli, diferensiasi, dan variabel regresi ADF (n = ${raw.length}; data yang diuji N = ${N})</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function renderTest(res) {
    const f = res.fit, cfg = res.cfg;
    const levels = ['1%', '5%', '10%'];
    const critRows = res.crit.map((c, i) => `<tr><td>${levels[i]}</td><td>${fmt(c, 4)}</td><td class="${f.tau < c ? 'ok' : 'bad'}">${f.tau < c ? 'Tolak H0' : 'Gagal tolak H0'}</td></tr>`).join('');
    const coefRows = f.names.map((nm, j) => {
      const t = f.beta[j] / f.se[j];
      const isG = j === 0;
      const p = isG ? res.pval : REG.tTwoTailedP(t, f.df);
      return `<tr><td>${escapeHTML(nm)}</td><td>${fmt(f.beta[j], 5)}</td><td>${fmt(f.se[j], 5)}</td><td>${fmt(t, 4)}</td><td>${fmt(p, 4)}${isG ? ' *' : ''}</td></tr>`;
    }).join('');

    let html = `<div class="test-block">
      <h4>Uji Augmented Dickey-Fuller (ADF)</h4>
      <p class="test-sub">Data yang diuji: <strong>${dLabel(cfg.d)}</strong> &middot; Model: ${MODEL_LABEL[cfg.model]} &middot; Lag: ${res.p} (${cfg.lagMode === 'auto' ? 'otomatis, kriteria AIC' : 'manual'}).</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">&gamma; = 0 &mdash; data mengandung akar unit (tidak stasioner).</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">&gamma; &lt; 0 &mdash; data tidak mengandung akar unit (stasioner).</span></div>
      </div>
      <div class="test-stat-row">
        ${statCard('ADF (tau)', fmt(f.tau, 4))}
        ${statCard('p-value (MacKinnon)', fmt(res.pval, 4))}
        ${statCard('Lag (p)', res.p)}
        ${statCard('Observasi (n)', res.nobs)}
      </div>
      <div class="test-verdict ${res.stationary ? 'ok' : 'bad'}">${res.stationary ? 'Stasioner (ADF &lt; nilai kritis 5%)' : 'Tidak Stasioner (ADF &ge; nilai kritis 5%)'}</div>
      <p class="test-conclusion">${res.stationary
        ? `Karena ADF = ${fmt(f.tau, 4)} lebih kecil dari nilai kritis 5% (${fmt(res.crit[1], 4)}), H0 ditolak. Artinya, data (${dLabel(cfg.d)}) tidak mengandung akar unit sehingga <strong>stasioner</strong> pada taraf signifikansi 5%.`
        : `Karena ADF = ${fmt(f.tau, 4)} tidak lebih kecil dari nilai kritis 5% (${fmt(res.crit[1], 4)}), H0 gagal ditolak. Artinya, data (${dLabel(cfg.d)}) masih mengandung akar unit sehingga <strong>belum stasioner</strong> pada taraf signifikansi 5%.`}</p>
      ${disagreeNote(res)}
    </div>`;

    html += `<div class="test-block">
      <h4>Perbandingan dengan Nilai Kritis (MacKinnon)</h4>
      <p class="test-sub">Data stasioner jika nilai ADF (tau) <em>lebih kecil</em> (lebih negatif) daripada nilai kritis.</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Taraf</th><th>Nilai kritis</th><th>Keputusan (ADF = ${fmt(f.tau, 4)})</th></tr></thead>
        <tbody>${critRows}</tbody>
      </table></div>
    </div>`;

    html += `<div class="test-block">
      <h4>Hasil Regresi Uji ADF</h4>
      <p class="test-sub">Regresi OLS: &Delta;z[t] terhadap z[t&minus;1]${res.p > 0 ? `, ${res.p} lag &Delta;z` : ''}${cfg.model !== 'nc' ? ', konstanta' : ''}${cfg.model === 'ct' ? ' dan tren' : ''}. Derajat bebas = ${f.df}.</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Variabel</th><th>Koefisien</th><th>Se</th><th>t hitung</th><th>Sig.</th></tr></thead>
        <tbody>${coefRows}</tbody>
      </table></div>
      <p class="test-note">* Untuk &gamma;, t hitung adalah statistik ADF dan Sig.-nya dihitung dari distribusi MacKinnon (bukan distribusi t biasa). Sig. koefisien lain memakai distribusi t dan hanya sebagai informasi pelengkap.</p>
    </div>`;
    el.testWrap.innerHTML = html;
  }

  /* p-value MacKinnon bersifat asimtotik, sedangkan nilai kritis memakai koreksi ukuran sampel;
     pada sampel kecil keduanya bisa berbeda tipis di sekitar batas 5%. */
  function disagreeNote(res) {
    if ((res.pval < 0.05) === res.stationary) return '';
    return `<p class="test-note">Catatan: p-value (${fmt(res.pval, 4)}) berada di sisi 0.05 yang berbeda dari keputusan nilai kritis. Hal ini wajar pada sampel kecil karena p-value MacKinnon bersifat asimtotik, sedangkan nilai kritis sudah dikoreksi untuk n = ${res.nobs}. Keputusan di atas memakai nilai kritis; hasil berada dekat batas sehingga sebaiknya ditafsirkan hati-hati (mis. tambah data atau bandingkan dengan grafik).</p>`;
  }

  function renderSteps(res) {
    const f = res.fit, cfg = res.cfg, steps = [];
    steps.push({
      title: 'Tentukan data yang diuji (diferensiasi)',
      formula: cfg.d === 0 ? 'z[t] = Y[t]  (tanpa diferensiasi)'
        : cfg.d === 1 ? '\u0394Y[t] = Y[t] \u2212 Y[t\u22121]\nz[t] = \u0394Y[t]'
          : '\u0394Y[t] = Y[t] \u2212 Y[t\u22121]\n\u0394\u00B2Y[t] = \u0394Y[t] \u2212 \u0394Y[t\u22121]\nz[t] = \u0394\u00B2Y[t]',
      note: `Banyak data yang diuji N = ${res.N}.${cfg.d > 0 ? ` Setiap diferensiasi mengurangi 1 data di awal deret.` : ''}`,
    });
    steps.push({
      title: 'Susun persamaan regresi ADF',
      formula: '\u0394z[t] = ' + [cfg.model !== 'nc' ? '\u03B1' : null, cfg.model === 'ct' ? '\u03B4\u00B7t' : null, '\u03B3\u00B7z[t\u22121]',
        ...Array.from({ length: res.p }, (_, i) => `\u03C6${i + 1}\u00B7\u0394z[t\u2212${i + 1}]`), 'e[t]'].filter(Boolean).join(' + '),
      note: 'H0: \u03B3 = 0 (akar unit, tidak stasioner) lawan H1: \u03B3 < 0 (stasioner). Yang diuji adalah koefisien \u03B3 pada z[t\u22121].',
    });
    if (res.aicTable) {
      steps.push({
        title: `Pilih jumlah lag dengan kriteria AIC (lag maks = ${res.maxlag})`,
        matrix: ['lag      AIC', ...res.aicTable.map((r) => `${String(r.lag).padEnd(4)}  ${fmt(r.aic, 4).padStart(10)}${r.lag === res.p ? '   \u2190 terkecil' : ''}`)].join('\n'),
        note: `AIC = n\u00B7ln(SSE/n) + 2k dihitung pada sampel yang sama untuk tiap lag. Lag dengan AIC terkecil, p = ${res.p}, dipilih.`,
      });
    } else {
      steps.push({ title: 'Jumlah lag', formula: `p = ${res.p}  (ditentukan manual)` });
    }
    steps.push({
      title: 'Estimasi regresi OLS dengan matriks (\u03B2 = (X\u1D40X)\u207B\u00B9X\u1D40Y)',
      formula: f.names.map((nm, j) => `${nm} = ${fmt(f.beta[j], 5)},  Se = ${fmt(f.se[j], 5)}`).join('\n'),
      note: `Banyak observasi n = ${f.n}, jumlah parameter k = ${f.k}, derajat bebas = ${f.df}, SSE = ${fmt(f.SSE, 4)}.`,
    });
    steps.push({
      title: 'Hitung statistik ADF (tau)',
      formula: `tau = \u03B3 / Se(\u03B3)\n    = ${fmt(f.beta[0], 5)} / ${fmt(f.se[0], 5)}\n    = ${fmt(f.tau, 4)}`,
      note: 'Statistik ini tidak mengikuti distribusi t biasa karena di bawah H0 data tidak stasioner; digunakan distribusi Dickey-Fuller (MacKinnon).',
    });
    steps.push({
      title: 'Hitung nilai kritis & p-value',
      formula: `Nilai kritis 1% = ${fmt(res.crit[0], 4)}\nNilai kritis 5% = ${fmt(res.crit[1], 4)}\nNilai kritis 10% = ${fmt(res.crit[2], 4)}\np-value = ${fmt(res.pval, 4)}`,
      note: 'Nilai kritis dihitung dari surface regression MacKinnon (2010) sesuai model dan banyak observasi.',
    });
    steps.push({
      title: 'Ambil keputusan',
      formula: `tau = ${fmt(f.tau, 4)}  ${f.tau < res.crit[1] ? '<' : '\u2265'}  ${fmt(res.crit[1], 4)}  (nilai kritis 5%)\np-value (pendamping) = ${fmt(res.pval, 4)}`,
      note: (res.stationary ? 'tau lebih kecil dari nilai kritis 5% \u2192 H0 ditolak \u2192 data stasioner.' : 'tau tidak lebih kecil dari nilai kritis 5% \u2192 H0 gagal ditolak \u2192 data belum stasioner.') + ' Aturan keputusan: tolak H0 bila tau < nilai kritis.',
    });
    el.stepsWrap.innerHTML = steps.map((s, i) => {
      const parts = [`<h4>${escapeHTML(s.title)}</h4>`];
      if (s.formula) parts.push(`<span class="formula">${escapeHTML(s.formula)}</span>`);
      if (s.matrix) parts.push(`<div class="matrix">${escapeHTML(s.matrix)}</div>`);
      if (s.note) parts.push(`<p>${escapeHTML(s.note)}</p>`);
      return `<div class="step-block" data-step="${i + 1}">${parts.join('')}</div>`;
    }).join('');
  }

  function renderChart(res, raw) {
    el.chartWrap.innerHTML = '';
    el.chartWrap.appendChild(lineChart(raw, 'Data asli (Y)', 0, false));
    const n1 = document.createElement('p');
    n1.className = 'chart-note';
    n1.textContent = 'Deret yang stasioner berfluktuasi di sekitar nilai rata-rata yang tetap tanpa tren naik/turun yang jelas.';
    el.chartWrap.appendChild(n1);
    if (res.cfg.d > 0) {
      el.chartWrap.appendChild(lineChart(res.z, `Data yang diuji: ${dLabel(res.cfg.d)}`, res.cfg.d, true));
      const n2 = document.createElement('p');
      n2.className = 'chart-note';
      n2.textContent = 'Garis putus-putus kuning adalah rata-rata deret hasil diferensiasi.';
      el.chartWrap.appendChild(n2);
    }
  }

  function lineChart(vals, title, offset, showMean) {
    const W = 620, H = 300, PAD = 48;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;margin-bottom:6px;';
    const cap = document.createElement('div');
    cap.style.cssText = 'font-weight:600;font-size:13px;margin:8px 0 4px;';
    cap.textContent = title;
    wrap.appendChild(cap);
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = '100%'; canvas.style.maxWidth = W + 'px'; canvas.style.height = 'auto'; canvas.style.aspectRatio = W + '/' + H;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const n = vals.length;
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.12 || 1;
    lo -= pad; hi += pad;
    const sx = (i) => PAD + (n === 1 ? 0 : (i / (n - 1))) * (W - PAD - 18);
    const sy = (v) => H - PAD + 6 - ((v - lo) / (hi - lo)) * (H - PAD - 20);
    const inkSoft = '#52565F', rule = '#DAD2B8', accent = '#22384A', accent2 = '#BD7E1F';
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px IBM Plex Mono, monospace';
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = lo + (i / ticks) * (hi - lo), py = sy(v);
      ctx.strokeStyle = '#EFEAD9'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, py); ctx.lineTo(W - 18, py); ctx.stroke();
      ctx.fillStyle = inkSoft; ctx.fillText(fmt(v, Math.abs(hi - lo) < 10 ? 2 : 1), 4, py + 4);
    }
    const step = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += step) { ctx.fillStyle = inkSoft; ctx.fillText(String(i + 1 + offset), sx(i) - 6, H - PAD + 24); }
    ctx.strokeStyle = rule;
    ctx.beginPath(); ctx.moveTo(PAD, H - PAD + 6); ctx.lineTo(W - 18, H - PAD + 6); ctx.moveTo(PAD, H - PAD + 6); ctx.lineTo(PAD, 14); ctx.stroke();
    if (showMean) {
      const m = vals.reduce((a, b) => a + b, 0) / n;
      ctx.strokeStyle = accent2; ctx.lineWidth = 1.8; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(PAD, sy(m)); ctx.lineTo(W - 18, sy(m)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); vals.forEach((v, i) => { if (i === 0) ctx.moveTo(sx(i), sy(v)); else ctx.lineTo(sx(i), sy(v)); }); ctx.stroke();
    ctx.fillStyle = accent;
    vals.forEach((v, i) => { ctx.beginPath(); ctx.arc(sx(i), sy(v), 3, 0, Math.PI * 2); ctx.fill(); });
    wrap.appendChild(canvas);
    return wrap;
  }

  function renderConclusion(res) {
    const cfg = res.cfg, f = res.fit;
    let verdictClass, label, text;
    if (res.stationary) {
      verdictClass = 'ok';
      if (cfg.d === 0) {
        label = 'Data Stasioner pada Level';
        text = `Hasil uji ADF menunjukkan nilai ADF = ${fmt(f.tau, 4)} lebih kecil dari nilai kritis 5% (${fmt(res.crit[1], 4)}; p-value = ${fmt(res.pval, 4)}), sehingga H0 ditolak. Data sudah <strong>stasioner pada level</strong> (terintegrasi orde 0, I(0)) dan dapat langsung dipakai pada pemodelan yang mensyaratkan stasioneritas, mis. ARMA/regresi deret waktu, tanpa perlu diferensiasi.`;
      } else {
        label = `Data Stasioner setelah Diferensiasi ${cfg.d === 1 ? 'Pertama' : 'Kedua'}`;
        text = `Setelah ${dLabel(cfg.d)}, hasil uji ADF menunjukkan ADF = ${fmt(f.tau, 4)} lebih kecil dari nilai kritis 5% (${fmt(res.crit[1], 4)}; p-value = ${fmt(res.pval, 4)}), sehingga H0 ditolak. Data menjadi <strong>stasioner</strong> pada diferensiasi ke-${cfg.d}, artinya data asli terintegrasi orde ${cfg.d}, I(${cfg.d}). Gunakan d = ${cfg.d} pada model seperti ARIMA(p, ${cfg.d}, q).`;
      }
    } else {
      verdictClass = 'bad';
      label = 'Data Belum Stasioner';
      text = `Hasil uji ADF menunjukkan ADF = ${fmt(f.tau, 4)} tidak lebih kecil dari nilai kritis 5% (${fmt(res.crit[1], 4)}; p-value = ${fmt(res.pval, 4)}), sehingga H0 gagal ditolak: data (${dLabel(cfg.d)}) masih mengandung akar unit. ` +
        (cfg.d < 2
          ? `Langkah selanjutnya: ulangi uji dengan <strong>${cfg.d === 0 ? 'diferensiasi pertama' : 'diferensiasi kedua'}</strong> (kembali ke Langkah 1 dan ubah pengaturan diferensiasi).`
          : 'Data masih belum stasioner setelah diferensiasi kedua; periksa kembali data (outlier, perubahan struktural), pilihan model uji (konstanta/tren), atau pertimbangkan transformasi seperti logaritma.');
    }
    el.conclusionWrap.innerHTML = `<div class="test-block">
      <div class="test-stat-row">
        ${statCard('ADF (tau)', fmt(f.tau, 4))}
        ${statCard('Nilai kritis 5%', fmt(res.crit[1], 4))}
        ${statCard('p-value (MacKinnon)', fmt(res.pval, 4))}
      </div>
      <div class="test-verdict ${verdictClass}">${label}</div>
      <p class="test-conclusion">${text}</p>
      ${disagreeNote(res)}
      <p class="test-note">Uji ADF memiliki daya uji rendah pada data yang sedikit, dan hasilnya dapat berubah menurut pilihan model (konstanta/tren) dan jumlah lag. Disarankan memeriksa juga grafik deret waktu.</p>
    </div>`;
  }

  function statCard(label, value) { return `<div class="stat-card"><div class="k">${escapeHTML(label)}</div><div class="v">${escapeHTML(String(value))}</div></div>`; }
  function fmt(x, d = 4) {
    if (x === null || x === undefined || Number.isNaN(x) || !Number.isFinite(x)) return '\u2014';
    return Number(x).toFixed(d);
  }
  function showError(node, msg) { node.textContent = msg; node.hidden = false; }
  function hideError(node) { node.hidden = true; node.textContent = ''; }
  function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }

  window.StatCalcStasioner = { runADF, mackinnonP, mackinnonCrit }; // untuk pengujian
})();
