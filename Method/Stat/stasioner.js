/* =========================================================================
   METODE — UJI STASIONERITAS (2 tahap)
   -------------------------------------------------------------------------
   TAHAP 1  Stasioner dalam VARIANS  → transformasi Box-Cox (grafik StDev vs λ,
            estimasi λ, selang kepercayaan 95% dengan batas likelihood, nilai λ bulat).
   TAHAP 2  Stasioner dalam MEAN     → uji akar unit pada data (hasil transformasi) + diferensiasi:
            • Augmented Dickey-Fuller (ADF)   H0: ada akar unit (tidak stasioner)
            • Phillips-Perron (PP)            H0: ada akar unit (koreksi nonparametrik Newey-West)
            • KPSS                            H0: stasioner (kebalikan ADF/PP)
            • atau ketiganya sekaligus untuk dibandingkan.

   Persamaan regresi uji ADF / PP (OLS):
     Δz[t] = α + δ·t + γ·z[t−1] + φ1·Δz[t−1] + ... + φp·Δz[t−p] + e[t]    (PP memakai p = 0)
   Statistik tau = t-hitung γ; nilai kritis & p-value memakai pendekatan MacKinnon
   (bukan distribusi t biasa). Keputusan ADF/PP: statistik < nilai kritis 5% → stasioner.
   KPSS: stasioner bila statistik η < titik kritis 5% (tabel Kwiatkowski dkk. 1992).
   Perhitungan matriks memakai rutin OLS yang sama dengan regresi.js (disalin agar file ini mandiri).
   ========================================================================= */
(function () {
  'use strict';

  /* Pita pengaturan tampilan hasil */
  if (window.StatRibbon) window.StatRibbon.mount({
    view: '#view-stasioner', key: 'stasioner',
    tabs: [
      { id: 'hasil', label: 'Hasil', groups: [
        { label: 'Tab hasil', cols: 2, items: [
          { type: 'toggle', key: 'var', label: 'Tahap 1: Varians (Box-Cox)', tab: 'st-tab-var' },
          { type: 'toggle', key: 'test', label: 'Tahap 2: Mean (Uji Akar Unit)', tab: 'st-tab-test' },
          { type: 'toggle', key: 'tbl', label: 'Tabel Data', tab: 'st-tab-table' },
          { type: 'toggle', key: 'stp', label: 'Langkah Perhitungan', tab: 'st-tab-steps' },
        ] },
        { label: 'Bagian lain', items: [
          { type: 'toggle', key: 'concl', label: 'Langkah 4 Kesimpulan', hide: ['#st-conclusion-card'] },
        ] },
      ], tip: 'Pengaturan pita hanya menyembunyikan atau menampilkan bagian hasil; perhitungan dan langkah-langkah tidak berubah.' },
      { id: 'grafik', label: 'Grafik & Ekspor', groups: [
        { label: 'Grafik', items: [
          { type: 'toggle', key: 'chart', label: 'Tab Grafik', tab: 'st-tab-chart' },
          { type: 'toggle', key: 'figs', label: 'Grafik pendukung', hide: ['.ex-grid', '.ex-bar a'] },
        ] },
        { label: 'Unduhan', items: [
          { type: 'toggle', key: 'dl', label: 'Panel unduhan (.docx/.zip)', hide: ['.ex-panel', '.ex-bar'] },
        ] },
      ] },
    ],
  });

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* Mesin matriks & distribusi t (salinan dari regresi.js) — file ini mandiri,
     tidak bergantung pada urutan/versi regresi.js. */
  function logGamma(x) {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function betacf(x, a, b) {
    const MAXIT = 200, EPS = 3e-9, FPMIN = 1e-30;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function betai(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
    return 1 - bt * betacf(1 - x, b, a) / b;
  }
  /* p-value dua-arah untuk statistik uji t dengan derajat bebas df */
  function tTwoTailedP(t, df) {
    if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return NaN;
    return betai(df / (df + t * t), df / 2, 0.5);
  }
  function transpose(M) {
    const rows = M.length, cols = M[0].length;
    const T = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) T[j][i] = M[i][j];
    return T;
  }
  function matMul(A, B) {
    const r = A.length, c = B[0].length, inner = B.length;
    const R = Array.from({ length: r }, () => new Array(c).fill(0));
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) { let s = 0; for (let m = 0; m < inner; m++) s += A[i][m] * B[m][j]; R[i][j] = s; }
    return R;
  }
  function invertMatrix(M) {
    const n = M.length;
    const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivotRow][col])) pivotRow = r;
      if (Math.abs(A[pivotRow][col]) < 1e-9) {
        throw new Error('Matriks (X\u1D40X) bersifat singular \u2014 kemungkinan ada variabel X yang saling berkorelasi sempurna (multikolinearitas total) atau jumlah data terlalu sedikit.');
      }
      if (pivotRow !== col) [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
      const pivot = A[col][col];
      for (let c = 0; c < 2 * n; c++) A[col][c] /= pivot;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = A[r][col];
        if (factor === 0) continue;
        for (let c = 0; c < 2 * n; c++) A[r][c] -= factor * A[col][c];
      }
    }
    return A.map((row) => row.slice(n));
  }
  const REG = { transpose, matMul, invertMatrix, tTwoTailedP };

  const el = {
    view: $('#view-stasioner'),
    boxMode: $('#stBoxMode'), sigmaMode: $('#stSigmaMode'), lambdaRow: $('#stLambdaRow'), lambda: $('#stLambda'),
    test: $('#stTest'),
    diff: $('#stDiff'), model: $('#stModel'), lagMode: $('#stLagMode'), lag: $('#stLag'), lagRow: $('#stLagRow'),
    buildBtn: $('#stBuildTableBtn'), setupError: $('#stSetupError'),
    dataCard: $('#st-data-card'), minRowsHint: $('#stMinRowsHint'),
    tableBody: $('#stDataTableBody'),
    clearBtn: $('#stClearBtn'), addRowBtn: $('#stAddRowBtn'), removeRowBtn: $('#stRemoveRowBtn'), fillSampleBtn: $('#stFillSampleBtn'),
    calcBtn: $('#stCalcBtn'), dataError: $('#stDataError'),
    resultsCard: $('#st-results-card'),
    varChartWrap: $('#stVarChartWrap'), varWrap: $('#stVarWrap'),
    tableWrap: $('#stTableWrap'), testWrap: $('#stTestWrap'), stepsWrap: $('#stStepsWrap'), chartWrap: $('#stChartWrap'),
    conclusionCard: $('#st-conclusion-card'), conclusionWrap: $('#stConclusionWrap'),
  };
  if (!el.view) { console.error('Uji Stasioneritas: elemen #view-stasioner tidak ditemukan di index.html.'); return; }

  const state = { d: 0, model: 'c', lagMode: 'auto', lag: 1, minRows: 10, test: 'adf', boxMode: 'auto', lambda: 0, sigma: 'sd' };

  let lastR = null; // hasil perhitungan terakhir (untuk menggambar ulang grafik Box-Cox saat tampilan diubah)

  const SAMPLE = [100, 105.5, 106.3, 108.2, 110.9, 110.9, 112.7, 114.5, 112.5, 116.5, 119.6, 120.1, 121.5, 124.4, 125.6,
    126.9, 125.5, 128.5, 130.6, 133, 131.4, 136.9, 139, 139.9, 146.2, 147.9, 146.5, 147.4, 144.2, 148.3];

  const MODEL_LABEL = {
    nc: 'Tanpa konstanta & tren (none)',
    c: 'Dengan konstanta (intercept)',
    ct: 'Dengan konstanta & tren (trend and intercept)',
  };
  const TEST_LABEL = { adf: 'Augmented Dickey-Fuller (ADF)', pp: 'Phillips-Perron (PP)', kpss: 'KPSS' };
  const TEST_SHORT = { adf: 'ADF', pp: 'PP', kpss: 'KPSS' };

  /* ------------------------------- Setup ------------------------------- */
  el.lagMode.addEventListener('change', () => { el.lagRow.hidden = el.lagMode.value !== 'manual'; });
  el.boxMode.addEventListener('change', () => { el.lambdaRow.hidden = el.boxMode.value !== 'manual'; });

  el.buildBtn.addEventListener('click', () => {
    hideError(el.setupError);
    const d = parseInt(el.diff.value, 10);
    const lagMode = el.lagMode.value;
    const lag = parseInt(el.lag.value, 10);
    const boxMode = el.boxMode.value;
    const lambda = parseFloat(String(el.lambda.value).replace(',', '.'));
    if (boxMode === 'manual' && !(Number.isFinite(lambda) && lambda >= -5 && lambda <= 5)) {
      showError(el.setupError, 'Nilai \u03BB manual harus berupa angka antara \u22125 dan 5.');
      return;
    }
    if (lagMode === 'manual' && (!Number.isInteger(lag) || lag < 0 || lag > 12)) {
      showError(el.setupError, 'Jumlah lag harus bilangan bulat antara 0 dan 12.');
      return;
    }
    state.d = d; state.model = el.model.value; state.lagMode = lagMode; state.lag = lag;
    state.test = el.test.value; state.boxMode = boxMode; state.lambda = lambda;
    state.sigma = el.sigmaMode && el.sigmaMode.value === 'mr' ? 'mr' : 'sd';
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

  el.clearBtn.addEventListener('click', () => {
    $$('input', el.tableBody).forEach((inp) => { inp.value = ''; inp.classList.remove('invalid'); });
  });
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

  /* ====================== TAHAP 1: Box-Cox (stasioner dalam varians) ====================== */
  const CHI2_95 = 3.841458820694124; // kuantil 95% chi-kuadrat, db = 1
  const BC_MIN = -5, BC_MAX = 5;
  const BC_ROUND = [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3]; // kandidat \u03BB "mudah ditafsirkan"
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const sdSample = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };

  /* Estimator \u03C3 untuk grafik Box-Cox:
     'sd' = simpangan baku sampel biasa (seluruh data; tren ikut dihitung sebagai variasi).
     'mr' = sigma within dari moving range, MR\u0304 / 1,128 (untuk data individual / subgroup size 1);
            hanya melihat selisih antar data berurutan, sehingga pengaruh tren diminimalkan. */
  const MR_D2 = 1.128;
  function sigmaMR(a) {
    let s = 0;
    for (let i = 1; i < a.length; i++) s += Math.abs(a[i] - a[i - 1]);
    return (s / (a.length - 1)) / MR_D2;
  }
  const SIGMA_FN = { sd: sdSample, mr: sigmaMR };

  /* Transformasi Box-Cox: (Y^\u03BB \u2212 1)/\u03BB, atau ln Y bila \u03BB = 0. shift = konstanta penggeser agar Y > 0. */
  function bcTransform(raw, lam, shift) {
    return raw.map((v) => { const y = v + shift; return Math.abs(lam) < 1e-9 ? Math.log(y) : (Math.pow(y, lam) - 1) / lam; });
  }
  function lamName(l) {
    if (l === null || l === undefined) return 'tanpa transformasi';
    if (Math.abs(l) < 1e-9) return 'logaritma natural, ln(Y)';
    if (Math.abs(l - 0.5) < 1e-9) return 'akar kuadrat, \u221AY';
    if (Math.abs(l + 0.5) < 1e-9) return 'kebalikan akar kuadrat, 1/\u221AY';
    if (Math.abs(l + 1) < 1e-9) return 'kebalikan, 1/Y';
    if (Math.abs(l - 1) < 1e-9) return 'tanpa transformasi (\u03BB = 1)';
    if (Math.abs(l - 2) < 1e-9) return 'kuadrat, Y\u00B2';
    return 'pangkat Y^' + String(+l.toFixed(3));
  }

  function boxcox(raw, sigmaMode) {
    const sigma = sigmaMode === 'mr' ? 'mr' : 'sd', sigmaFn = SIGMA_FN[sigma];
    const n = raw.length;
    const mn = Math.min.apply(null, raw);
    const shift = mn > 0 ? 0 : Math.abs(mn) + 1;
    const y = raw.map((v) => v + shift);
    const lny = y.map(Math.log);
    const gm = Math.exp(mean(lny));
    /* StDev data hasil transformasi yang diskalakan dengan rata-rata geometrik (GM) sehingga
       nilai untuk \u03BB berbeda sebanding; meminimalkan StDev ini = memaksimalkan likelihood Box-Cox. */
    const sdAt = (l) => {
      const w = Math.abs(l) < 1e-9 ? lny.map((v) => gm * v) : y.map((v) => Math.pow(v, l) / (l * Math.pow(gm, l - 1)));
      return sigmaFn(w);
    };
    let bi = 0, bv = Infinity;
    const STEP = 0.01, M = Math.round((BC_MAX - BC_MIN) / STEP);
    for (let i = 0; i <= M; i++) { const v = sdAt(BC_MIN + i * STEP); if (v < bv) { bv = v; bi = i; } }
    let a = Math.max(BC_MIN, BC_MIN + (bi - 1) * STEP), b = Math.min(BC_MAX, BC_MIN + (bi + 1) * STEP);
    for (let k = 0; k < 70; k++) { // pencarian rasio emas / ternary
      const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
      if (sdAt(m1) < sdAt(m2)) b = m2; else a = m1;
    }
    const est = (a + b) / 2, sdMin = sdAt(est);
    const limit = sdMin * Math.exp(CHI2_95 / (2 * n)); // batas selang kepercayaan 95% (likelihood)

    const cross = (dir) => {
      const bound = dir < 0 ? BC_MIN : BC_MAX;
      let l = est;
      for (;;) {
        const nxt = l + dir * 0.005;
        if (dir < 0 ? nxt < bound : nxt > bound) return { v: bound, open: sdAt(bound) <= limit };
        if (sdAt(nxt) > limit) {
          let inn = l, out = nxt;
          for (let i = 0; i < 50; i++) { const m = (inn + out) / 2; if (sdAt(m) <= limit) inn = m; else out = m; }
          return { v: (inn + out) / 2, open: false };
        }
        l = nxt;
      }
    };
    const lo = cross(-1), hi = cross(1);
    let rounded = null, best = Infinity;
    BC_ROUND.forEach((c) => {
      if (c >= lo.v - 1e-9 && c <= hi.v + 1e-9) { const dd = Math.abs(c - est); if (dd < best - 1e-12) { best = dd; rounded = c; } }
    });
    if (rounded === null) rounded = Math.round(est * 100) / 100;

    const sd1 = sdAt(1);
    const chi = Math.max(0, 2 * n * Math.log(sd1 / sdMin)); // uji rasio likelihood H0: \u03BB = 1
    const pLR = erfc(Math.sqrt(chi / 2));
    const curve = [];
    for (let l = BC_MIN; l <= BC_MAX + 1e-9; l += 0.05) curve.push({ l: +l.toFixed(2), sd: sdAt(l) });
    const marks = [-5, -2.5, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2.5, 5].map((l) => ({ l, sd: sdAt(l) }));
    const table = [-2, -1, -0.5, 0, 0.5, 1, 2].map((l) => ({ l, sd: sdAt(l) }));
    return {
      n, sigma, shift, gm, est, sdMin, limit, lo: lo.v, hi: hi.v, loOpen: lo.open, hiOpen: hi.open, rounded, sd1, chi, pLR,
      needTransform: chi > CHI2_95, curve, marks, table, sdAt,
    };
  }

  /* Pengaturan tampilan grafik Box-Cox (dipakai grafik di halaman DAN grafik di panel ekspor/.docx).
     style: 'smooth' = kurva halus; 'line' = garis lurus antar titik \u03BB.
     clip: true = sumbu Y dipotong agar bagian sekitar minimum terbaca; false = skala penuh tanpa pemotongan.
     c1 = warna kurva & titik; c2 = warna titik \u03BB estimasi; bg/gc/cc = warna latar / garis kisi / garis batas.
     gridH, gridV, showCL, showLimit, showPts, showEst, showSum = tampil/sembunyi tiap elemen.
     Pita Warna & Garis kisi di panel ekspor (bila diubah) menimpa warna, latar, dan garis kisi. */
  const BC_VIEW_DEF = {
    style: 'smooth', clip: true, c1: '#0B5CA5', c2: '#BD7E1F',
    bg: '#ffffff', gc: '#E4E4E4', cc: '#8C8C8C', // latar, garis kisi, garis batas (CL & Limit)
    gridH: true, gridV: true, showCL: true, showLimit: true, showPts: true, showEst: true, showSum: true,
  };
  const bcView = Object.assign({}, BC_VIEW_DEF);

  /* Grafik Box-Cox: StDev (y) terhadap \u03BB (x), garis batas, CL bawah/atas, ringkasan di kanan. */
  function boxcoxSvg(bc, name, opt) {
    const V = Object.assign({}, bcView, opt || {});
    const GST = window.GraphCore && window.GraphCore.u && window.GraphCore.u.ST;
    const useST = !!(GST && GST.on);
    const COL1 = useST ? GST.c1 : V.c1, COL2 = useST ? GST.c2 : V.c2;
    const BG = useST ? GST.bg : V.bg, GRIDC = useST ? GST.gc : V.gc, CLC = V.cc;
    const gridH = useST ? !!GST.h : V.gridH, gridV = useST ? (GST.v === null ? V.gridV : !!GST.v) : V.gridV;
    const W = 720, H = 470, L = 84, T = 84, PW = 432, PH = 316, X0 = L, Y0 = T;
    const xs = (l) => X0 + (l - BC_MIN) / (BC_MAX - BC_MIN) * PW;
    const all = bc.curve.map((p) => p.sd).concat([bc.limit]);
    let lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    /* Bila ujung kurva (\u03BB = \u00B15) jauh melampaui Limit, potong sumbu y agar bagian di sekitar minimum tetap terbaca
       (grafik acuan dengan rasio ujung/Limit < 8 tidak terpotong). */
    const cap = bc.limit * 8, clipped = V.clip && hi > cap;
    if (clipped) hi = cap;
    lo = Math.max(0, lo - (hi - lo) * 0.06); hi += (hi - lo) * 0.03;
    const raw = (hi - lo) / 7, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    const stp = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
    const yMin = Math.floor(lo / stp) * stp, yMax = Math.ceil(hi / stp) * stp;
    const ys = (v) => Y0 + PH - (v - yMin) / (yMax - yMin) * PH;
    const INK = '#1C1E24', SOFT = '#52565F', BLUE = COL1;
    const f2 = (v) => (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2));
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Inter, Arial, sans-serif"><rect width="${W}" height="${H}" fill="${BG}"/>`;
    s += `<defs><clipPath id="bcclip"><rect x="${X0}" y="${Y0}" width="${PW}" height="${PH}"/></clipPath></defs>`;
    s += `<text x="${X0 + PW / 2}" y="34" text-anchor="middle" font-size="19" font-weight="600" fill="${INK}">${esc('Box-Cox Plot of ' + name)}</text>`;
    for (let v = yMin; v <= yMax + stp / 2; v += stp) {
      const py = ys(v);
      if (gridH) s += `<line x1="${X0}" x2="${X0 + PW}" y1="${py.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${GRIDC}"/>`;
      s += `<text x="${X0 - 8}" y="${(py + 4).toFixed(1)}" text-anchor="end" font-size="12" font-weight="600" fill="${INK}">${+v.toFixed(6)}</text>`;
    }
    [-5, -2.5, 0, 2.5, 5].forEach((l) => {
      if (gridV) s += `<line x1="${xs(l)}" x2="${xs(l)}" y1="${Y0}" y2="${Y0 + PH}" stroke="${GRIDC}"/>`;
      s += `<text x="${xs(l)}" y="${Y0 + PH + 18}" text-anchor="middle" font-size="12" font-weight="600" fill="${INK}">${l.toFixed(1)}</text>`;
    });
    s += `<rect x="${X0}" y="${Y0}" width="${PW}" height="${PH}" fill="none" stroke="#9A9A9A"/>`;
    /* garis CL */
    const xLo = xs(Math.min(BC_MAX, Math.max(BC_MIN, bc.lo))), xHi = xs(Math.min(BC_MAX, Math.max(BC_MIN, bc.hi)));
    const near = xHi - xLo < 96; // selang sempit: label dipisah ke kiri/kanan agar tidak bertumpuk
    if (V.showCL) [[xLo, 'Lower CL', near ? 'end' : 'middle', near ? 4 : 0], [xHi, 'Upper CL', near ? 'start' : 'middle', near ? -4 : 0]].forEach(([x, lb, anc, dx]) => {
      s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y0}" y2="${Y0 + PH}" stroke="${CLC}" stroke-dasharray="6 4"/>`;
      s += `<text x="${(x + dx).toFixed(1)}" y="${Y0 - 8}" text-anchor="${anc}" font-size="12.5" font-weight="600" fill="${SOFT}">${lb}</text>`;
    });
    const ly = ys(bc.limit);
    if (V.showLimit) {
      s += `<line x1="${X0}" x2="${X0 + PW + 6}" y1="${ly.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${CLC}" stroke-dasharray="6 4"/>`;
      s += `<text x="${X0 + PW + 10}" y="${(ly + 4).toFixed(1)}" font-size="12.5" font-weight="600" fill="${SOFT}">Limit</text>`;
    }
    /* kurva & titik. 'line' = garis lurus antar titik \u03BB (rapat di sekitar optimum); 'smooth' = kurva halus */
    let pts;
    if (V.style === 'line') {
      const set = [-5, -2.5, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2.5, 5, bc.est];
      if (!bc.loOpen) set.push(bc.lo);
      if (!bc.hiOpen) set.push(bc.hi);
      set.push((bc.lo + bc.est) / 2, (bc.est + bc.hi) / 2);
      pts = set.filter((l) => l >= BC_MIN - 1e-9 && l <= BC_MAX + 1e-9).sort((a, b) => a - b)
        .filter((l, i, arr) => i === 0 || l - arr[i - 1] > 1e-6).map((l) => ({ l, sd: bc.sdAt(l) }));
    } else pts = bc.curve;
    s += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + xs(p.l).toFixed(1) + ' ' + ys(p.sd).toFixed(1)).join(' ')}" fill="none" stroke="${BLUE}" stroke-width="1.3" stroke-linejoin="round" clip-path="url(#bcclip)"/>`;
    if (V.showPts) (V.style === 'line' ? pts : bc.marks).forEach((p) => { if (p.sd > yMax) return; s += `<circle cx="${xs(p.l).toFixed(1)}" cy="${ys(p.sd).toFixed(1)}" r="4.2" fill="${BLUE}"/>`; });
    const ex = xs(bc.est), ey = ys(bc.sdMin);
    if (V.showEst) s += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="5.2" fill="${COL2}" stroke="#fff" stroke-width="1.2"/>`;
    s += `<text x="${(X0 - 66)}" y="${Y0 + PH / 2}" transform="rotate(-90 ${X0 - 66} ${Y0 + PH / 2})" text-anchor="middle" font-size="14" font-weight="600" fill="${INK}">StDev</text>`;
    s += `<text x="${X0 + PW / 2}" y="${H - 22}" text-anchor="middle" font-size="19" fill="${INK}">\u03BB</text>`;
    /* panel ringkasan kanan */
    const px = 540, pr = 712, cx = (px + pr) / 2 + 4;
    if (!V.showSum) return s + '</svg>';
    s += `<text x="${cx}" y="106" text-anchor="middle" font-size="15" font-weight="600" fill="${INK}">\u03BB</text>`;
    s += `<text x="${cx}" y="126" text-anchor="middle" font-size="11" fill="${INK}">(using 95.0% confidence)</text>`;
    const rows = [['Estimate', f2(bc.est)], ['Lower CL', (bc.loOpen ? '\u2264 ' : '') + f2(bc.lo)], ['Upper CL', (bc.hiOpen ? '\u2265 ' : '') + f2(bc.hi)], ['Rounded Value', f2(bc.rounded)]];
    const yy = [152, 180, 198, 226];
    rows.forEach(([k, v], i) => {
      s += `<text x="${px + 4}" y="${yy[i]}" font-size="12" font-weight="600" fill="${INK}">${k}</text><text x="${pr}" y="${yy[i]}" text-anchor="end" font-size="12" font-weight="600" fill="${INK}">${v}</text>`;
    });
    if (clipped) s += `<text x="${px + 4}" y="262" font-size="10.5" fill="${SOFT}">Sumbu y dipotong agar bagian</text><text x="${px + 4}" y="276" font-size="10.5" fill="${SOFT}">sekitar minimum terbaca.</text>`;
    return s + '</svg>';
  }

  /* ====================== TAHAP 2: uji akar unit / stasioner dalam mean ====================== */
  function prepare(raw, d) {
    const series = [raw];
    for (let i = 0; i < d; i++) series.push(diffSeries(series[series.length - 1]));
    const z = series[series.length - 1];
    return { series, z, N: z.length };
  }

  function runADF(raw, cfg) {
    const { series, z, N } = prepare(raw, cfg.d);
    const ntrend = cfg.model === 'nc' ? 0 : cfg.model === 'c' ? 1 : 2;

    // pemilihan lag
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
    // estimasi akhir pada seluruh sampel yang tersedia
    const fit = fitADF(z, p, cfg.model, p + 1);
    const nobs = fit.n;
    const crit = mackinnonCrit(nobs, cfg.model);
    const pval = mackinnonP(fit.tau, cfg.model);
    return { kind: 'adf', cfg, series, z, N, p, aicTable, maxlag, fit, nobs, crit, pval, stat: fit.tau, stationary: fit.tau < crit[1] };
  }

  /* Ragam jangka panjang Newey-West (bobot Bartlett): \u03BB\u00B2 = \u03B3\u2080 + 2\u03A3(1 \u2212 j/(l+1))\u03B3\u2c7c, \u03B3\u2c7c = (1/n)\u03A3 u[t]u[t\u2212j] */
  function neweyWest(u, l) {
    const n = u.length;
    const g = (j) => { let s = 0; for (let t = j; t < n; t++) s += u[t] * u[t - j]; return s / n; };
    const g0 = g(0), gs = [];
    let lam2 = g0;
    for (let j = 1; j <= l; j++) { const gj = g(j), w = 1 - j / (l + 1); gs.push({ j, gj, w }); lam2 += 2 * w * gj; }
    return { g0, gs, lam2: Math.max(lam2, 1e-12) };
  }
  const autoBandwidth = (n) => Math.max(0, Math.floor(4 * Math.pow(n / 100, 0.25)));

  /* Phillips-Perron (statistik Z-tau, Hamilton 1994 pers. 17.6.12): koreksi nonparametrik pada tau Dickey-Fuller. */
  function runPP(raw, cfg) {
    const { series, z, N } = prepare(raw, cfg.d);
    const fit = fitADF(z, 0, cfg.model, 1);
    const n = fit.n;
    const l = Math.min(cfg.lagMode === 'auto' ? autoBandwidth(n) : cfg.lag, n - 1);
    const nw = neweyWest(fit.resid, l);
    const lam = Math.sqrt(nw.lam2), s = Math.sqrt(fit.s2);
    const corr = 0.5 * (nw.lam2 - nw.g0) / lam * (n * fit.se[0] / s);
    const stat = Math.sqrt(nw.g0 / nw.lam2) * fit.tau - corr;
    const crit = mackinnonCrit(n, cfg.model);
    const pval = mackinnonP(stat, cfg.model);
    return { kind: 'pp', cfg, series, z, N, l, fit, nw, corr, nobs: n, crit, pval, stat, tauDF: fit.tau, stationary: stat < crit[1] };
  }

  /* KPSS: H0 deret stasioner (di sekitar level atau tren deterministik). */
  const KPSS_TABLE = {
    c: { p: [0.10, 0.05, 0.025, 0.01], v: [0.347, 0.463, 0.574, 0.739] },
    ct: { p: [0.10, 0.05, 0.025, 0.01], v: [0.119, 0.146, 0.176, 0.216] },
  };
  function kpssP(eta, model) {
    const { p, v } = KPSS_TABLE[model];
    if (eta <= v[0]) return { p: 0.10, edge: 'gt' };
    if (eta >= v[3]) return { p: 0.01, edge: 'lt' };
    for (let i = 0; i < 3; i++) {
      if (eta >= v[i] && eta <= v[i + 1]) return { p: p[i] + (eta - v[i]) / (v[i + 1] - v[i]) * (p[i + 1] - p[i]), edge: null };
    }
    return { p: NaN, edge: null };
  }
  function runKPSS(raw, cfg) {
    const { series, z, N } = prepare(raw, cfg.d);
    const model = cfg.model === 'ct' ? 'ct' : 'c';
    const ones = z.map(() => 1), trend = z.map((_, i) => i + 1);
    const fit = olsFit(z, model === 'ct' ? [ones, trend] : [ones]);
    const e = fit.resid;
    let acc = 0; const S = e.map((v) => (acc += v));
    const sumS2 = S.reduce((a, v) => a + v * v, 0);
    const l = Math.min(cfg.lagMode === 'auto' ? autoBandwidth(N) : cfg.lag, N - 1);
    const nw = neweyWest(e, l);
    const stat = sumS2 / (N * N * nw.lam2);
    const tb = KPSS_TABLE[model];
    const pv = kpssP(stat, model);
    return { kind: 'kpss', cfg, series, z, N, l, model, fit, e, S, sumS2, nw, nobs: N, crit: tb.v, critP: tb.p, pval: pv.p, pEdge: pv.edge, stat, stationary: stat < tb.v[1] };
  }

  /* ----------------------------- Orkestrasi dua tahap ----------------------------- */
  function runAll(raw, cfg) {
    const bc = boxcox(raw, cfg.sigma);
    let lam = null;
    if (cfg.boxMode === 'auto') lam = bc.needTransform ? bc.rounded : null;
    else if (cfg.boxMode === 'manual') lam = cfg.lambda;
    if (lam !== null && Math.abs(lam - 1) < 1e-9) lam = null;
    const base = lam === null ? raw.slice() : bcTransform(raw, lam, bc.shift);
    const want = cfg.test === 'all' ? ['adf', 'pp', 'kpss'] : [cfg.test];
    const tests = want.map((t) => (t === 'adf' ? runADF(base, cfg) : t === 'pp' ? runPP(base, cfg) : runKPSS(base, cfg)));
    let varStatus;
    if (lam !== null) varStatus = 'fixed';           // transformasi diterapkan (otomatis atau manual)
    else varStatus = bc.needTransform ? 'bad' : 'ok';
    const nStat = tests.filter((t) => t.stationary).length;
    const meanStatus = nStat === tests.length ? 'ok' : nStat === 0 ? 'bad' : 'mixed';
    return { raw, cfg, bc, lam, base, tests, varStatus, meanStatus, overall: (varStatus !== 'bad') && meanStatus === 'ok' };
  }

  /* ------------------------------ Tombol hitung ------------------------------ */
  el.calcBtn.addEventListener('click', () => {
    hideError(el.dataError);
    const data = collectData();
    if (data.error) { showError(el.dataError, data.error); return; }
    let R;
    try { R = runAll(data.y, state); }
    catch (err) {
      showError(el.dataError, /singular/i.test(err.message)
        ? 'Perhitungan regresi gagal (matriks singular) \u2014 data terlalu seragam/linear untuk model dan jumlah lag ini. Coba kurangi jumlah lag atau ganti model.'
        : err.message);
      return;
    }
    renderVar(R);
    renderTable(R);
    renderTest(R);
    renderSteps(R);
    renderChart(R);
    renderConclusion(R);
    exportStasioner(R);
    $$('.tab-btn', el.view).forEach((b) => b.classList.remove('active'));
    $$('.tab-panel', el.view).forEach((p) => p.classList.remove('active'));
    $('.tab-btn[data-tab="st-tab-var"]').classList.add('active');
    $('#st-tab-var').classList.add('active');
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
  const lamTxt = (l) => String(+Number(l).toFixed(2));
  const baseLabel = (R) => (R.lam === null ? 'data asli' : `data hasil transformasi Box-Cox (\u03BB = ${lamTxt(R.lam)}, ${lamName(R.lam)})`);
  const levels3 = ['1%', '5%', '10%'];

  /* ---------- Tahap 1: Box-Cox ---------- */
  /* Kontrol tampilan grafik Box-Cox (gaya garis, sumbu Y, warna). Dibuat sekali, diletakkan di atas grafik. */
  function drawBoxcoxChart() {
    if (!lastR) return;
    el.varChartWrap.innerHTML = boxcoxSvg(lastR.bc, 'Y');
    const svg = el.varChartWrap.querySelector('svg');
    if (svg) { svg.style.cssText = 'width:100%;height:auto;max-width:720px;display:block;margin:0 auto 12px;'; }
  }
  function mountBoxcoxControls() {
    if (document.getElementById('stBcCtl')) return;
    const box = document.createElement('div');
    box.id = 'stBcCtl';
    box.style.cssText = 'margin:0 0 12px;padding:10px 12px;border:1px solid var(--rule,#E6E0CC);border-radius:10px;background:var(--paper,#FAF8F1);';
    const fld = 'display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:600;color:var(--ink-soft,#52565F);';
    const row = 'display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end;';
    const head = 'font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--accent,#22384A);margin:0 0 6px;';
    const clr = 'width:54px;height:32px;padding:0;border:1px solid #ccc;border-radius:6px;background:none;';
    const chk = 'display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--ink,#1C1E24);cursor:pointer;';
    const color = (id, label) => `<label style="${fld}">${label}<input type="color" id="${id}" style="${clr}"></label>`;
    const check = (id, label) => `<label style="${chk}"><input type="checkbox" id="${id}"> ${label}</label>`;
    box.innerHTML = `
      <div style="${head}">Garis &amp; sumbu</div>
      <div style="${row}">
        <label style="${fld}">Gaya garis
          <select id="stBcStyle" class="select-input">
            <option value="smooth">Kurva halus</option>
            <option value="line">Garis lurus antar titik</option>
          </select></label>
        <label style="${fld}">Sumbu Y
          <select id="stBcClip" class="select-input">
            <option value="clip">Dipotong (fokus ke minimum)</option>
            <option value="full">Skala penuh (tanpa pemotongan)</option>
          </select></label>
      </div>
      <div style="${head};margin-top:12px">Warna</div>
      <div style="${row}">
        ${color('stBcC1', 'Kurva &amp; titik')}
        ${color('stBcC2', 'Titik &lambda; estimasi')}
        ${color('stBcCC', 'Garis batas (CL &amp; Limit)')}
        ${color('stBcGC', 'Garis kisi')}
        ${color('stBcBG', 'Latar grafik')}
      </div>
      <div style="${head};margin-top:12px">Tampilkan / sembunyikan</div>
      <div style="${row}gap:8px 18px;">
        ${check('stBcGridH', 'Kisi horizontal')}
        ${check('stBcGridV', 'Kisi vertikal')}
        ${check('stBcShowCL', 'Garis Lower/Upper CL')}
        ${check('stBcShowLimit', 'Garis Limit')}
        ${check('stBcShowPts', 'Titik pada kurva')}
        ${check('stBcShowEst', 'Titik &lambda; estimasi')}
        ${check('stBcShowSum', 'Panel ringkasan')}
      </div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:12px;">
        <button type="button" class="btn-ghost" id="stBcReset" style="height:34px;padding:0 14px;">Setel ulang</button>
        <span style="flex:1 1 260px;font-size:12px;color:var(--ink-soft,#52565F);">Pengaturan ini juga dipakai pada grafik di panel unduhan dan berkas .docx. Pita Warna &amp; Garis kisi di panel unduhan, bila diubah, menimpa warna, latar, dan kisi di sini.</span>
      </div>`;
    el.varChartWrap.parentNode.insertBefore(box, el.varChartWrap);

    const MAP = [ // [id, kunci bcView, jenis]
      ['stBcC1', 'c1', 'color'], ['stBcC2', 'c2', 'color'], ['stBcCC', 'cc', 'color'], ['stBcGC', 'gc', 'color'], ['stBcBG', 'bg', 'color'],
      ['stBcGridH', 'gridH', 'check'], ['stBcGridV', 'gridV', 'check'], ['stBcShowCL', 'showCL', 'check'],
      ['stBcShowLimit', 'showLimit', 'check'], ['stBcShowPts', 'showPts', 'check'], ['stBcShowEst', 'showEst', 'check'], ['stBcShowSum', 'showSum', 'check'],
    ];
    const syncUI = () => {
      $('#stBcStyle').value = bcView.style;
      $('#stBcClip').value = bcView.clip ? 'clip' : 'full';
      MAP.forEach(([id, k, t]) => { const e = $('#' + id); if (t === 'color') e.value = bcView[k]; else e.checked = !!bcView[k]; });
    };
    const apply = () => {
      bcView.style = $('#stBcStyle').value;
      bcView.clip = $('#stBcClip').value === 'clip';
      MAP.forEach(([id, k, t]) => { const e = $('#' + id); bcView[k] = t === 'color' ? e.value : e.checked; });
      drawBoxcoxChart();
      if (lastR) exportStasioner(lastR);
    };
    syncUI();
    ['stBcStyle', 'stBcClip'].concat(MAP.map((m) => m[0])).forEach((id) => $('#' + id).addEventListener('input', apply));
    $('#stBcReset').addEventListener('click', () => { Object.assign(bcView, BC_VIEW_DEF); syncUI(); apply(); });
  }

  function renderVar(R) {
    const bc = R.bc;
    lastR = R;
    mountBoxcoxControls();
    drawBoxcoxChart();

    const loTxt = (bc.loOpen ? '\u2264 ' : '') + fmt(bc.lo, 3), hiTxt = (bc.hiOpen ? '\u2265 ' : '') + fmt(bc.hi, 3);
    const verdictCls = bc.needTransform ? 'bad' : 'ok';
    const verdict = bc.needTransform
      ? 'Belum stasioner dalam varians (selang \u03BB tidak memuat 1)'
      : 'Stasioner dalam varians (selang \u03BB memuat 1)';
    const used = R.lam === null
      ? (bc.needTransform
        ? 'Transformasi <strong>tidak diterapkan</strong> (pengaturan: tanpa transformasi), sehingga Tahap 2 memakai data asli.'
        : 'Tidak diperlukan transformasi, sehingga Tahap 2 memakai <strong>data asli</strong>.')
      : `Tahap 2 memakai data hasil transformasi <strong>\u03BB = ${lamTxt(R.lam)}</strong> (${escapeHTML(lamName(R.lam))})${R.cfg.boxMode === 'manual' ? ', \u03BB ditentukan manual' : ''}.`;
    const shiftNote = bc.shift > 0
      ? `<p class="test-note">Catatan: Box-Cox hanya berlaku untuk data positif. Ada nilai \u2264 0, sehingga seluruh data ditambah konstanta ${fmt(bc.shift, 4)} sebelum dihitung.</p>` : '';
    const edgeNote = (bc.loOpen || bc.hiOpen)
      ? '<p class="test-note">Salah satu batas selang melebihi rentang pencarian (\u22125 sampai 5), sehingga ditampilkan sebagai batas rentang. Selang sangat lebar menandakan data kurang informatif untuk memilih \u03BB.</p>' : '';

    const rows = bc.table.map((r) => `<tr><td>${lamTxt(r.l)}</td><td>${escapeHTML(lamName(r.l))}</td><td>${fmt(r.sd, 4)}</td><td class="${r.sd <= bc.limit ? 'ok' : 'bad'}">${r.sd <= bc.limit ? 'Dalam selang' : 'Di luar selang'}</td></tr>`).join('');

    el.varWrap.innerHTML = `<div class="test-block">
      <h4>Tahap 1 &mdash; Stasioner dalam Varians (Transformasi Box-Cox)</h4>
      <p class="test-sub">Grafik di atas memplot ${R.bc.sigma === 'mr' ? 'sigma within (moving range, MR\u0304/1,128)' : 'simpangan baku (StDev)'} data hasil transformasi untuk berbagai \u03BB. \u03BB terbaik adalah titik terendah kurva; garis putus-putus menandai selang kepercayaan 95%.</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">\u03BB = 1 &mdash; ragam sudah stabil, tidak perlu transformasi.</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">\u03BB &ne; 1 &mdash; ragam tidak stabil, data perlu ditransformasi.</span></div>
      </div>
      <div class="test-stat-row">
        ${statCard('\u03BB estimasi', fmt(bc.est, 3))}
        ${statCard('Batas bawah (CL)', loTxt)}
        ${statCard('Batas atas (CL)', hiTxt)}
        ${statCard('\u03BB pembulatan', lamTxt(bc.rounded))}
      </div>
      <div class="test-verdict ${verdictCls}">${verdict}</div>
      <p class="test-conclusion">${bc.needTransform
        ? `Selang kepercayaan 95% untuk \u03BB adalah [${fmt(bc.lo, 3)}; ${fmt(bc.hi, 3)}] dan <strong>tidak memuat 1</strong> (uji rasio likelihood \u03BB = 1: \u03C7\u00B2 = ${fmt(bc.chi, 3)}, p = ${fmt(bc.pLR, 4)}). H0 ditolak: varians data belum stabil. Nilai \u03BB bulat yang disarankan adalah <strong>${lamTxt(bc.rounded)}</strong> &rarr; ${escapeHTML(lamName(bc.rounded))}.`
        : `Selang kepercayaan 95% untuk \u03BB adalah [${fmt(bc.lo, 3)}; ${fmt(bc.hi, 3)}] dan <strong>memuat 1</strong> (uji rasio likelihood \u03BB = 1: \u03C7\u00B2 = ${fmt(bc.chi, 3)}, p = ${fmt(bc.pLR, 4)}). H0 gagal ditolak: varians data dapat dianggap <strong>stabil</strong>, sehingga data tidak perlu ditransformasi.`}</p>
      <p class="test-conclusion" style="margin-top:8px;">${used}</p>
      ${shiftNote}${edgeNote}
    </div>
    <div class="test-block">
      <h4>Nilai StDev pada beberapa \u03BB</h4>
      <p class="test-sub">Batas (Limit) selang kepercayaan = ${fmt(bc.limit, 4)}. \u03BB berada dalam selang bila StDev-nya tidak melebihi batas ini.</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>\u03BB</th><th>Transformasi</th><th>StDev</th><th>Status</th></tr></thead>
        <tbody>${rows}
          <tr><td><strong>${fmt(bc.est, 3)}</strong></td><td>\u03BB estimasi (StDev minimum)</td><td>${fmt(bc.sdMin, 4)}</td><td class="ok">Dalam selang</td></tr>
        </tbody>
      </table></div>
      <p class="test-note">${bc.sigma === 'mr'
        ? 'Estimator: moving range, \u03C3 = MR\u0304 / 1,128 (untuk data individual). Estimator ini hanya melihat selisih antar data berurutan, sehingga pengaruh tren diminimalkan. Selang kepercayaan memakai rumus likelihood yang sama dengan opsi StDev biasa, sehingga batasnya bisa sedikit berbeda dari hasil perangkat lunak statistik lain.'
        : 'Estimator: simpangan baku sampel biasa. Bila data memiliki tren yang kuat, tren ikut memengaruhi StDev; pilih estimator moving range untuk mengurangi pengaruh tren, dan periksa juga grafik data asli di tab Grafik.'}</p>
    </div>`;
  }

  /* ---------- Tabel data ---------- */
  function renderTable(R) {
    const t0 = R.tests[0], d = R.cfg.d, N = t0.N, raw = R.raw;
    const tr = R.lam !== null;
    let head = '<th>Periode</th><th>Y (asli)</th>';
    if (tr) head += '<th>Y (transformasi)</th>';
    if (d >= 1) head += '<th>\u0394Y</th>';
    if (d >= 2) head += '<th>\u0394\u00B2Y</th>';
    head += '<th>z[t] (diuji)</th><th>z[t\u22121]</th><th>\u0394z[t]</th>';
    let body = '';
    for (let i = 0; i < raw.length; i++) {
      let row = `<td>${i + 1}</td><td>${fmt(raw[i], 3)}</td>`;
      if (tr) row += `<td>${fmt(R.base[i], 4)}</td>`;
      for (let k = 1; k <= d; k++) { const v = t0.series[k][i - k]; row += `<td>${i - k >= 0 ? fmt(v, 3) : '\u2014'}</td>`; }
      const zi = i - d;
      row += `<td>${zi >= 0 ? fmt(t0.z[zi], 3) : '\u2014'}</td>`;
      row += `<td>${zi >= 1 ? fmt(t0.z[zi - 1], 3) : '\u2014'}</td>`;
      row += `<td>${zi >= 1 ? fmt(t0.z[zi] - t0.z[zi - 1], 3) : '\u2014'}</td>`;
      body += `<tr>${row}</tr>`;
    }
    el.tableWrap.innerHTML = `<table class="result-table"><caption>Data asli${tr ? ', hasil transformasi Box-Cox' : ''}, diferensiasi, dan variabel regresi (n = ${raw.length}; data yang diuji N = ${N})</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  /* ---------- Tahap 2: hasil uji ---------- */
  function critTable(res, labels, kpss) {
    const f = res.stat;
    return res.crit.map((c, i) => {
      const reject = kpss ? f > c : f < c;
      return `<tr><td>${labels[i]}</td><td>${fmt(c, 4)}</td><td class="${(kpss ? !reject : reject) ? 'ok' : 'bad'}">${reject ? 'Tolak H0' : 'Gagal tolak H0'}</td></tr>`;
    }).join('');
  }

  function regTable(res) {
    const f = res.fit;
    return f.names.map((nm, j) => {
      const t = f.beta[j] / f.se[j];
      const isG = j === 0;
      const p = isG ? res.pval : REG.tTwoTailedP(t, f.df);
      return `<tr><td>${escapeHTML(nm)}</td><td>${fmt(f.beta[j], 5)}</td><td>${fmt(f.se[j], 5)}</td><td>${fmt(t, 4)}</td><td>${fmt(p, 4)}${isG ? ' *' : ''}</td></tr>`;
    }).join('');
  }

  function unitRootBlock(res, R) {
    const cfg = res.cfg, isPP = res.kind === 'pp';
    const nm = isPP ? 'Phillips-Perron (PP)' : 'Augmented Dickey-Fuller (ADF)';
    const sh = isPP ? 'PP' : 'ADF';
    const stLabel = isPP ? 'Z(tau)' : 'ADF (tau)';
    const lagInfo = isPP
      ? `Bandwidth Newey-West: ${res.l} (${cfg.lagMode === 'auto' ? 'otomatis, 4(n/100)^\u00BC' : 'manual'})`
      : `Lag: ${res.p} (${cfg.lagMode === 'auto' ? 'otomatis, kriteria AIC' : 'manual'})`;
    const regSub = isPP
      ? `Regresi Dickey-Fuller (tanpa lag): &Delta;z[t] terhadap z[t&minus;1]${cfg.model !== 'nc' ? ', konstanta' : ''}${cfg.model === 'ct' ? ' dan tren' : ''}. Derajat bebas = ${res.fit.df}.`
      : `Regresi OLS: &Delta;z[t] terhadap z[t&minus;1]${res.p > 0 ? `, ${res.p} lag &Delta;z` : ''}${cfg.model !== 'nc' ? ', konstanta' : ''}${cfg.model === 'ct' ? ' dan tren' : ''}. Derajat bebas = ${res.fit.df}.`;
    const regNote = isPP
      ? `* tau pada baris &gamma; adalah statistik Dickey-Fuller <em>sebelum</em> koreksi PP. Statistik uji PP adalah Z(tau) di atas, yang dibandingkan dengan nilai kritis MacKinnon.`
      : `* Untuk &gamma;, t hitung adalah statistik ADF dan Sig.-nya dihitung dari distribusi MacKinnon (bukan distribusi t biasa). Sig. koefisien lain memakai distribusi t dan hanya sebagai informasi pelengkap.`;
    const cards = isPP
      ? statCard(stLabel, fmt(res.stat, 4)) + statCard('p-value (MacKinnon)', fmt(res.pval, 4)) + statCard('tau DF (sebelum koreksi)', fmt(res.tauDF, 4)) + statCard('Observasi (n)', res.nobs)
      : statCard(stLabel, fmt(res.stat, 4)) + statCard('p-value (MacKinnon)', fmt(res.pval, 4)) + statCard('Lag (p)', res.p) + statCard('Observasi (n)', res.nobs);

    let html = `<div class="test-block">
      <h4>Uji ${nm}</h4>
      <p class="test-sub">Data yang diuji: <strong>${dLabel(cfg.d)}</strong> dari ${escapeHTML(baseLabel(R))} &middot; Model: ${MODEL_LABEL[cfg.model]} &middot; ${lagInfo}.</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">&gamma; = 0 &mdash; data mengandung akar unit (tidak stasioner dalam mean).</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">&gamma; &lt; 0 &mdash; data tidak mengandung akar unit (stasioner dalam mean).</span></div>
      </div>
      <div class="test-stat-row">${cards}</div>
      <div class="test-verdict ${res.stationary ? 'ok' : 'bad'}">${res.stationary ? `Stasioner (${sh} &lt; nilai kritis 5%)` : `Tidak Stasioner (${sh} &ge; nilai kritis 5%)`}</div>
      <p class="test-conclusion">${res.stationary
        ? `Karena ${sh} = ${fmt(res.stat, 4)} lebih kecil dari nilai kritis 5% (${fmt(res.crit[1], 4)}), H0 ditolak. Artinya, data (${dLabel(cfg.d)}) tidak mengandung akar unit sehingga <strong>stasioner dalam mean</strong> pada taraf signifikansi 5%.`
        : `Karena ${sh} = ${fmt(res.stat, 4)} tidak lebih kecil dari nilai kritis 5% (${fmt(res.crit[1], 4)}), H0 gagal ditolak. Artinya, data (${dLabel(cfg.d)}) masih mengandung akar unit sehingga <strong>belum stasioner dalam mean</strong> pada taraf signifikansi 5%.`}</p>
      ${disagreeNote(res)}
    </div>`;

    html += `<div class="test-block">
      <h4>Perbandingan dengan Nilai Kritis (MacKinnon) &mdash; ${sh}</h4>
      <p class="test-sub">Data stasioner jika statistik ${sh} <em>lebih kecil</em> (lebih negatif) daripada nilai kritis.</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Taraf</th><th>Nilai kritis</th><th>Keputusan (${sh} = ${fmt(res.stat, 4)})</th></tr></thead>
        <tbody>${critTable(res, levels3, false)}</tbody>
      </table></div>
    </div>`;

    html += `<div class="test-block">
      <h4>Hasil Regresi Uji ${isPP ? 'Phillips-Perron' : 'ADF'}</h4>
      <p class="test-sub">${regSub}</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Variabel</th><th>Koefisien</th><th>Se</th><th>t hitung</th><th>Sig.</th></tr></thead>
        <tbody>${regTable(res)}</tbody>
      </table></div>
      <p class="test-note">${regNote}</p>
    </div>`;

    if (isPP) {
      html += `<div class="test-block">
        <h4>Koreksi Phillips-Perron (ragam jangka panjang)</h4>
        <p class="test-sub">Alih-alih menambah lag &Delta;z seperti ADF, PP mengoreksi statistik tau memakai estimator Newey-West agar tahan terhadap autokorelasi dan heteroskedastisitas pada galat.</p>
        <div class="table-scroll"><table class="mini-table">
          <thead><tr><th>Besaran</th><th>Nilai</th></tr></thead>
          <tbody>
            <tr><td>&gamma;&#8320; = SSE / n (ragam galat)</td><td>${fmt(res.nw.g0, 6)}</td></tr>
            <tr><td>&lambda;&sup2; (ragam jangka panjang, l = ${res.l})</td><td>${fmt(res.nw.lam2, 6)}</td></tr>
            <tr><td>Suku koreksi</td><td>${fmt(res.corr, 4)}</td></tr>
            <tr><td>Z(tau)</td><td>${fmt(res.stat, 4)}</td></tr>
          </tbody>
        </table></div>
      </div>`;
    } else if (res.aicTable) {
      /* ringkasan AIC dipindah ke Langkah Perhitungan; tidak ditambah di sini */
    }
    return html;
  }

  function kpssBlock(res, R) {
    const cfg = res.cfg;
    const lv = ['10%', '5%', '2.5%', '1%'];
    const critRows = res.crit.map((c, i) => `<tr><td>${lv[i]}</td><td>${fmt(c, 3)}</td><td class="${res.stat > c ? 'bad' : 'ok'}">${res.stat > c ? 'Tolak H0 (tidak stasioner)' : 'Gagal tolak H0 (stasioner)'}</td></tr>`).join('');
    const pTxt = res.pEdge === 'gt' ? '> 0.10' : res.pEdge === 'lt' ? '< 0.01' : fmt(res.pval, 4);
    const modelNote = (cfg.model === 'nc')
      ? '<p class="test-note">KPSS tidak memiliki model tanpa konstanta, sehingga dipakai model <em>level</em> (dengan konstanta).</p>' : '';
    return `<div class="test-block">
      <h4>Uji KPSS (Kwiatkowski-Phillips-Schmidt-Shin)</h4>
      <p class="test-sub">Data yang diuji: <strong>${dLabel(cfg.d)}</strong> dari ${escapeHTML(baseLabel(R))} &middot; Model: ${res.model === 'ct' ? 'stasioner di sekitar tren (konstanta &amp; tren)' : 'stasioner di sekitar level (konstanta)'} &middot; Bandwidth Newey-West: ${res.l} (${cfg.lagMode === 'auto' ? 'otomatis, 4(n/100)^\u00BC' : 'manual'}).</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">Data <strong>stasioner</strong> (di sekitar ${res.model === 'ct' ? 'tren deterministik' : 'rata-rata tetap'}).</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">Data mengandung akar unit (tidak stasioner).</span></div>
      </div>
      <div class="test-stat-row">
        ${statCard('KPSS (\u03B7)', fmt(res.stat, 4))}
        ${statCard('Titik kritis 5%', fmt(res.crit[1], 3))}
        ${statCard('p-value (interpolasi)', pTxt)}
        ${statCard('Observasi (n)', res.nobs)}
      </div>
      <div class="test-verdict ${res.stationary ? 'ok' : 'bad'}">${res.stationary ? 'Stasioner (KPSS &lt; titik kritis 5%)' : 'Tidak Stasioner (KPSS &ge; titik kritis 5%)'}</div>
      <p class="test-conclusion">${res.stationary
        ? `Karena KPSS = ${fmt(res.stat, 4)} lebih kecil dari titik kritis 5% (${fmt(res.crit[1], 3)}), H0 (stasioner) gagal ditolak. Data (${dLabel(cfg.d)}) dapat dianggap <strong>stasioner dalam mean</strong> pada taraf 5%.`
        : `Karena KPSS = ${fmt(res.stat, 4)} lebih besar dari titik kritis 5% (${fmt(res.crit[1], 3)}), H0 (stasioner) ditolak. Data (${dLabel(cfg.d)}) <strong>belum stasioner dalam mean</strong> pada taraf 5%.`}</p>
      ${modelNote}
    </div>
    <div class="test-block">
      <h4>Perbandingan dengan Titik Kritis KPSS</h4>
      <p class="test-sub">Arah keputusan <em>kebalikan</em> ADF/PP: data tidak stasioner jika KPSS <em>lebih besar</em> daripada titik kritis.</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Taraf</th><th>Titik kritis</th><th>Keputusan (KPSS = ${fmt(res.stat, 4)})</th></tr></thead>
        <tbody>${critRows}</tbody>
      </table></div>
      <p class="test-note">p-value diperoleh dengan interpolasi linear pada tabel titik kritis KPSS sehingga hanya berkisar 0.01&ndash;0.10; di luar rentang itu ditampilkan sebagai batas (&gt; 0.10 atau &lt; 0.01).</p>
    </div>`;
  }

  function renderTest(R) {
    const mix = R.tests.length > 1;
    let html = `<div class="test-block"><h4>Tahap 2 &mdash; Stasioner dalam Mean (Uji Akar Unit)</h4>
      <p class="test-sub">Data diuji: <strong>${dLabel(R.cfg.d)}</strong> dari ${escapeHTML(baseLabel(R))}. ${mix ? 'Tiga uji dijalankan bersamaan agar hasilnya dapat dibandingkan.' : `Uji yang dipakai: ${TEST_LABEL[R.tests[0].kind]}.`}</p>`;
    if (mix) {
      const rows = R.tests.map((t) => `<tr><td>${TEST_LABEL[t.kind]}</td><td>${t.kind === 'kpss' ? 'Stasioner' : 'Ada akar unit'}</td><td>${fmt(t.stat, 4)}</td><td>${fmt(t.crit[1], 4)}</td><td class="${t.stationary ? 'ok' : 'bad'}">${t.stationary ? 'Stasioner' : 'Tidak stasioner'}</td></tr>`).join('');
      html += `<div class="table-scroll"><table class="mini-table"><thead><tr><th>Uji</th><th>H0</th><th>Statistik</th><th>Nilai kritis 5%</th><th>Kesimpulan</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    html += '</div>';
    R.tests.forEach((t) => { html += t.kind === 'kpss' ? kpssBlock(t, R) : unitRootBlock(t, R); });
    el.testWrap.innerHTML = html;
  }

  /* p-value MacKinnon bersifat asimtotik, sedangkan nilai kritis memakai koreksi ukuran sampel;
     pada sampel kecil keduanya bisa berbeda tipis di sekitar batas 5%. */
  function disagreeNote(res) {
    if ((res.pval < 0.05) === res.stationary) return '';
    return `<p class="test-note">Catatan: p-value (${fmt(res.pval, 4)}) berada di sisi 0.05 yang berbeda dari keputusan nilai kritis. Hal ini wajar pada sampel kecil karena p-value MacKinnon bersifat asimtotik, sedangkan nilai kritis sudah dikoreksi untuk n = ${res.nobs}. Keputusan di atas memakai nilai kritis; hasil berada dekat batas sehingga sebaiknya ditafsirkan hati-hati (mis. tambah data atau bandingkan dengan grafik).</p>`;
  }

  /* ---------- Langkah perhitungan ---------- */
  function diffStep(res) {
    const cfg = res.cfg;
    return {
      title: 'Tentukan data yang diuji (diferensiasi)',
      formula: cfg.d === 0 ? 'z[t] = Y[t]  (tanpa diferensiasi)'
        : cfg.d === 1 ? '\u0394Y[t] = Y[t] \u2212 Y[t\u22121]\nz[t] = \u0394Y[t]'
          : '\u0394Y[t] = Y[t] \u2212 Y[t\u22121]\n\u0394\u00B2Y[t] = \u0394Y[t] \u2212 \u0394Y[t\u22121]\nz[t] = \u0394\u00B2Y[t]',
      note: `Banyak data yang diuji N = ${res.N}.${cfg.d > 0 ? ' Setiap diferensiasi mengurangi 1 data di awal deret.' : ''}`,
    };
  }
  function eqStep(res, p) {
    const cfg = res.cfg;
    return '\u0394z[t] = ' + [cfg.model !== 'nc' ? '\u03B1' : null, cfg.model === 'ct' ? '\u03B4\u00B7t' : null, '\u03B3\u00B7z[t\u22121]',
      ...Array.from({ length: p }, (_, i) => `\u03C6${i + 1}\u00B7\u0394z[t\u2212${i + 1}]`), 'e[t]'].filter(Boolean).join(' + ');
  }
  function coefStep(res) {
    const f = res.fit;
    return {
      title: 'Estimasi regresi OLS dengan matriks (\u03B2 = (X\u1D40X)\u207B\u00B9X\u1D40Y)',
      formula: f.names.map((nm, j) => `${nm} = ${fmt(f.beta[j], 5)},  Se = ${fmt(f.se[j], 5)}`).join('\n'),
      note: `Banyak observasi n = ${f.n}, jumlah parameter k = ${f.k}, derajat bebas = ${f.df}, SSE = ${fmt(f.SSE, 4)}.`,
    };
  }
  function decisionStep(res, nm) {
    return {
      title: 'Ambil keputusan',
      formula: `${nm} = ${fmt(res.stat, 4)}  ${res.stat < res.crit[1] ? '<' : '\u2265'}  ${fmt(res.crit[1], 4)}  (nilai kritis 5%)\np-value (pendamping) = ${fmt(res.pval, 4)}`,
      note: (res.stationary ? `${nm} lebih kecil dari nilai kritis 5% \u2192 H0 ditolak \u2192 data stasioner dalam mean.` : `${nm} tidak lebih kecil dari nilai kritis 5% \u2192 H0 gagal ditolak \u2192 data belum stasioner dalam mean.`) + ' Aturan keputusan: tolak H0 bila statistik < nilai kritis.',
    };
  }

  function stepsBoxCox(R) {
    const bc = R.bc, st = [];
    st.push({
      title: 'Siapkan data (Box-Cox mensyaratkan data positif)',
      formula: `n = ${bc.n}\nKonstanta penggeser = ${fmt(bc.shift, 4)}${bc.shift > 0 ? '  (ada nilai \u2264 0)' : '  (tidak diperlukan)'}\nRata-rata geometrik GM = exp( \u03A3 ln Y / n ) = ${fmt(bc.gm, 4)}`,
      note: 'GM dipakai untuk menskalakan data hasil transformasi agar StDev untuk \u03BB yang berbeda dapat dibandingkan langsung.',
    });
    st.push({
      title: 'Transformasi Box-Cox terskala untuk setiap \u03BB',
      formula: 'W(\u03BB) = (Y^\u03BB \u2212 1) / (\u03BB \u00B7 GM^(\u03BB\u22121))      untuk \u03BB \u2260 0\nW(0) = GM \u00B7 ln(Y)                          untuk \u03BB = 0',
      note: bc.sigma === 'mr'
        ? 'Untuk setiap \u03BB di rentang \u22125 sampai 5, hitung sigma within W(\u03BB) dengan moving range: \u03C3 = MR\u0304 / 1,128, di mana MR\u0304 = rata-rata |W[t] \u2212 W[t\u22121]|. Hasilnya adalah kurva StDev terhadap \u03BB pada grafik.'
        : 'Untuk setiap \u03BB di rentang \u22125 sampai 5, hitung simpangan baku W(\u03BB). Hasilnya adalah kurva StDev terhadap \u03BB pada grafik.',
    });
    st.push({
      title: 'Cari \u03BB dengan StDev minimum',
      matrix: ['\u03BB          StDev', ...bc.table.map((r) => `${lamTxt(r.l).padEnd(6)}  ${fmt(r.sd, 4).padStart(10)}`), `${fmt(bc.est, 3).padEnd(6)}  ${fmt(bc.sdMin, 4).padStart(10)}   \u2190 minimum`].join('\n'),
      note: `StDev terkecil terjadi pada \u03BB = ${fmt(bc.est, 4)} (StDev = ${fmt(bc.sdMin, 4)}). ${bc.sigma === 'mr' ? 'Estimator moving range meminimalkan sigma within, bukan likelihood normal biasa.' : 'Meminimalkan StDev ini sama dengan memaksimalkan likelihood Box-Cox.'}`,
    });
    st.push({
      title: 'Hitung selang kepercayaan 95% untuk \u03BB',
      formula: `Limit = StDev_min \u00B7 exp( \u03C7\u00B2(0.95; 1) / (2n) )\n      = ${fmt(bc.sdMin, 4)} \u00B7 exp( ${fmt(CHI2_95, 4)} / ${2 * bc.n} )\n      = ${fmt(bc.limit, 4)}\nBatas bawah (Lower CL) = ${fmt(bc.lo, 4)}\nBatas atas  (Upper CL) = ${fmt(bc.hi, 4)}`,
      note: 'Selang berisi semua \u03BB yang StDev-nya tidak melebihi Limit (kurva berada di bawah garis putus-putus horizontal).',
    });
    st.push({
      title: 'Bulatkan \u03BB dan ambil keputusan',
      formula: `\u03BB pembulatan = ${lamTxt(bc.rounded)}  (${lamName(bc.rounded)})\n1 ${bc.needTransform ? 'tidak berada' : 'berada'} dalam [${fmt(bc.lo, 3)}; ${fmt(bc.hi, 3)}]\nUji rasio likelihood \u03BB = 1:  \u03C7\u00B2 = ${fmt(bc.chi, 3)},  p = ${fmt(bc.pLR, 4)}`,
      note: bc.needTransform
        ? `Selang tidak memuat 1 \u2192 varians belum stabil \u2192 transformasi dengan \u03BB = ${lamTxt(bc.rounded)}. \u03BB dibulatkan ke nilai yang mudah ditafsirkan (\u22123, \u22122, \u22121, \u22120.5, 0, 0.5, 1, 2, 3) yang masih berada dalam selang dan paling dekat ke estimasi.`
        : 'Selang memuat 1 \u2192 varians sudah stabil \u2192 tidak perlu transformasi. \u03BB bulat tetap ditampilkan sebagai informasi.',
    });
    return st;
  }

  function stepsADF(res) {
    const f = res.fit, cfg = res.cfg, st = [];
    st.push(diffStep(res));
    st.push({
      title: 'ADF: susun persamaan regresi',
      formula: eqStep(res, res.p),
      note: 'H0: \u03B3 = 0 (akar unit, tidak stasioner) lawan H1: \u03B3 < 0 (stasioner). Yang diuji adalah koefisien \u03B3 pada z[t\u22121].',
    });
    if (res.aicTable) {
      st.push({
        title: `ADF: pilih jumlah lag dengan kriteria AIC (lag maks = ${res.maxlag})`,
        matrix: ['lag      AIC', ...res.aicTable.map((r) => `${String(r.lag).padEnd(4)}  ${fmt(r.aic, 4).padStart(10)}${r.lag === res.p ? '   \u2190 terkecil' : ''}`)].join('\n'),
        note: `AIC = n\u00B7ln(SSE/n) + 2k dihitung pada sampel yang sama untuk tiap lag. Lag dengan AIC terkecil, p = ${res.p}, dipilih.`,
      });
    } else st.push({ title: 'ADF: jumlah lag', formula: `p = ${res.p}  (ditentukan manual)` });
    st.push(coefStep(res));
    st.push({
      title: 'ADF: hitung statistik tau',
      formula: `tau = \u03B3 / Se(\u03B3)\n    = ${fmt(f.beta[0], 5)} / ${fmt(f.se[0], 5)}\n    = ${fmt(f.tau, 4)}`,
      note: 'Statistik ini tidak mengikuti distribusi t biasa karena di bawah H0 data tidak stasioner; digunakan distribusi Dickey-Fuller (MacKinnon).',
    });
    st.push({
      title: 'ADF: hitung nilai kritis & p-value',
      formula: `Nilai kritis 1% = ${fmt(res.crit[0], 4)}\nNilai kritis 5% = ${fmt(res.crit[1], 4)}\nNilai kritis 10% = ${fmt(res.crit[2], 4)}\np-value = ${fmt(res.pval, 4)}`,
      note: 'Nilai kritis dihitung dari surface regression MacKinnon (2010) sesuai model dan banyak observasi.',
    });
    st.push(decisionStep(res, 'ADF'));
    return st;
  }

  function stepsPP(res) {
    const f = res.fit, nw = res.nw, st = [];
    st.push(diffStep(res));
    st.push({
      title: 'PP: regresi Dickey-Fuller tanpa lag',
      formula: eqStep(res, 0),
      note: 'PP tidak menambah lag \u0394z. Autokorelasi pada galat ditangani dengan koreksi nonparametrik pada statistik tau.',
    });
    st.push(coefStep(res));
    st.push({
      title: 'PP: hitung tau Dickey-Fuller (sebelum koreksi)',
      formula: `tau = \u03B3 / Se(\u03B3) = ${fmt(f.beta[0], 5)} / ${fmt(f.se[0], 5)} = ${fmt(res.tauDF, 4)}`,
    });
    st.push({
      title: `PP: ragam jangka panjang Newey-West (bandwidth l = ${res.l})`,
      formula: `\u03B3\u2c7c = (1/n) \u03A3 u[t]\u00B7u[t\u2212j]\n\u03B3\u2080 = ${fmt(nw.g0, 6)}\n${nw.gs.map((g) => `\u03B3${g.j} = ${fmt(g.gj, 6)},  bobot Bartlett = ${fmt(g.w, 3)}`).join('\n')}${nw.gs.length ? '\n' : ''}\u03BB\u00B2 = \u03B3\u2080 + 2\u03A3(1 \u2212 j/(l+1))\u03B3\u2c7c = ${fmt(nw.lam2, 6)}`,
      note: 'u[t] adalah galat (residual) regresi pada langkah sebelumnya.',
    });
    st.push({
      title: 'PP: koreksi statistik tau menjadi Z(tau)',
      formula: `Z(tau) = \u221A(\u03B3\u2080/\u03BB\u00B2)\u00B7tau \u2212 \u00BD\u00B7((\u03BB\u00B2 \u2212 \u03B3\u2080)/\u03BB)\u00B7(n\u00B7Se(\u03B3)/s)\n       = ${fmt(Math.sqrt(nw.g0 / nw.lam2), 4)} \u00B7 ${fmt(res.tauDF, 4)} \u2212 ${fmt(res.corr, 4)}\n       = ${fmt(res.stat, 4)}`,
      note: `Dengan n = ${res.nobs} dan s = \u221A(SSE/(n\u2212k)) = ${fmt(Math.sqrt(f.s2), 5)}. Bila tidak ada autokorelasi (\u03BB\u00B2 = \u03B3\u2080) maka Z(tau) = tau.`,
    });
    st.push({
      title: 'PP: hitung nilai kritis & p-value',
      formula: `Nilai kritis 1% = ${fmt(res.crit[0], 4)}\nNilai kritis 5% = ${fmt(res.crit[1], 4)}\nNilai kritis 10% = ${fmt(res.crit[2], 4)}\np-value = ${fmt(res.pval, 4)}`,
      note: 'Z(tau) memiliki distribusi asimtotik yang sama dengan tau Dickey-Fuller, sehingga memakai nilai kritis MacKinnon.',
    });
    st.push(decisionStep(res, 'Z(tau)'));
    return st;
  }

  function stepsKPSS(res) {
    const st = [];
    st.push(diffStep(res));
    st.push({
      title: 'KPSS: regresi komponen deterministik',
      formula: res.model === 'ct' ? 'z[t] = \u03B1 + \u03B4\u00B7t + e[t]' : 'z[t] = \u03B1 + e[t]',
      note: `Koefisien: ${res.fit.beta.map((b, j) => (j === 0 ? '\u03B1' : '\u03B4') + ' = ' + fmt(b, 5)).join(', ')}. Galat e[t] adalah selisih data dengan komponen deterministik tersebut.`,
    });
    st.push({
      title: 'KPSS: jumlah parsial galat',
      formula: `S[t] = e[1] + e[2] + ... + e[t]\n\u03A3 S[t]\u00B2 = ${fmt(res.sumS2, 4)}`,
      note: 'Bila deret stasioner, S[t] tidak melenceng jauh dari nol; pada akar unit, S[t] membesar.',
    });
    st.push({
      title: `KPSS: ragam jangka panjang Newey-West (bandwidth l = ${res.l})`,
      formula: `\u03C3\u0302\u00B2(l) = \u03B3\u2080 + 2\u03A3(1 \u2212 j/(l+1))\u03B3\u2c7c\n      = ${fmt(res.nw.lam2, 6)}`,
    });
    st.push({
      title: 'KPSS: hitung statistik \u03B7',
      formula: `\u03B7 = \u03A3 S[t]\u00B2 / ( n\u00B2 \u00B7 \u03C3\u0302\u00B2(l) )\n  = ${fmt(res.sumS2, 4)} / ( ${res.N}\u00B2 \u00B7 ${fmt(res.nw.lam2, 6)} )\n  = ${fmt(res.stat, 4)}`,
    });
    st.push({
      title: 'KPSS: bandingkan dengan titik kritis & ambil keputusan',
      formula: `Titik kritis 10% = ${fmt(res.crit[0], 3)}\nTitik kritis 5%  = ${fmt(res.crit[1], 3)}\nTitik kritis 2.5% = ${fmt(res.crit[2], 3)}\nTitik kritis 1%  = ${fmt(res.crit[3], 3)}\n\u03B7 = ${fmt(res.stat, 4)}  ${res.stat < res.crit[1] ? '<' : '\u2265'}  ${fmt(res.crit[1], 3)}`,
      note: res.stationary ? '\u03B7 lebih kecil dari titik kritis 5% \u2192 H0 (stasioner) gagal ditolak \u2192 data stasioner dalam mean.' : '\u03B7 tidak lebih kecil dari titik kritis 5% \u2192 H0 (stasioner) ditolak \u2192 data belum stasioner dalam mean. Aturan keputusan KPSS: tolak H0 bila \u03B7 > titik kritis.',
    });
    return st;
  }

  function renderSteps(R) {
    let steps = [];
    steps.push({ section: 'Tahap 1 \u2014 Stasioner dalam Varians (Box-Cox)' });
    steps = steps.concat(stepsBoxCox(R));
    R.tests.forEach((t) => {
      steps.push({ section: `Tahap 2 \u2014 Stasioner dalam Mean: uji ${TEST_SHORT[t.kind]}` });
      if (R.lam !== null && t === R.tests[0]) {
        steps.push({
          title: 'Terapkan transformasi Box-Cox pada data',
          formula: `Z[t] = ( (Y[t]${R.bc.shift > 0 ? ' + ' + fmt(R.bc.shift, 4) : ''})^\u03BB \u2212 1 ) / \u03BB ,  \u03BB = ${lamTxt(R.lam)}`,
          note: 'Deret hasil transformasi inilah yang diuji pada tahap 2 (bila \u03BB = 0 dipakai ln Y).',
        });
      }
      steps = steps.concat(t.kind === 'adf' ? stepsADF(t) : t.kind === 'pp' ? stepsPP(t) : stepsKPSS(t));
    });
    let n = 0;
    el.stepsWrap.innerHTML = steps.map((s) => {
      if (s.section) return `<h3 class="step-section" style="margin:18px 0 8px;font-size:15px;">${escapeHTML(s.section)}</h3>`;
      n++;
      const parts = [`<h4>${escapeHTML(s.title)}</h4>`];
      if (s.formula) parts.push(`<span class="formula">${escapeHTML(s.formula)}</span>`);
      if (s.matrix) parts.push(`<div class="matrix">${escapeHTML(s.matrix)}</div>`);
      if (s.note) parts.push(`<p>${escapeHTML(s.note)}</p>`);
      return `<div class="step-block" data-step="${n}">${parts.join('')}</div>`;
    }).join('');
  }

  /* ---------- Grafik ---------- */
  function renderChart(R) {
    const t0 = R.tests[0];
    el.chartWrap.innerHTML = '';
    const add = (node, note) => {
      el.chartWrap.appendChild(node);
      if (note) { const p = document.createElement('p'); p.className = 'chart-note'; p.textContent = note; el.chartWrap.appendChild(p); }
    };
    add(lineChart(R.raw, 'Data asli (Y)', 0, false), 'Deret yang stasioner berfluktuasi di sekitar nilai rata-rata yang tetap, dengan lebar sebaran yang kira-kira sama, tanpa tren naik/turun yang jelas.');
    if (R.lam !== null) add(lineChart(R.base, `Data setelah transformasi Box-Cox (\u03BB = ${lamTxt(R.lam)})`, 0, false), 'Transformasi bertujuan menstabilkan varians: lebar sebaran deret menjadi lebih seragam sepanjang waktu.');
    if (R.cfg.d > 0) add(lineChart(t0.z, `Data yang diuji: ${dLabel(R.cfg.d)}`, R.cfg.d, true), 'Garis putus-putus kuning adalah rata-rata deret hasil diferensiasi.');
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

  /* ---------- Kesimpulan ---------- */
  function renderConclusion(R) {
    const cfg = R.cfg, bc = R.bc;
    const vOk = R.varStatus !== 'bad';
    const varLabel = R.varStatus === 'ok' ? 'Stasioner dalam varians (tanpa transformasi)'
      : R.varStatus === 'fixed' ? `Stasioner dalam varians setelah transformasi Box-Cox (\u03BB = ${lamTxt(R.lam)})`
        : 'Belum stasioner dalam varians';
    const meanLabel = R.meanStatus === 'ok' ? 'Stasioner dalam mean'
      : R.meanStatus === 'bad' ? 'Belum stasioner dalam mean' : 'Hasil uji tidak seragam (mean)';
    const finalCls = R.overall ? 'ok' : 'bad';
    const finalLabel = R.overall ? 'Data Stasioner (varians & mean)'
      : (!vOk ? 'Data Belum Stasioner dalam Varians' : R.meanStatus === 'mixed' ? 'Kesimpulan Mean Belum Pasti' : 'Data Belum Stasioner dalam Mean');

    const testsTxt = R.tests.map((t) => {
      const nm = TEST_SHORT[t.kind];
      return t.kind === 'kpss'
        ? `${nm} = ${fmt(t.stat, 4)} ${t.stationary ? '<' : '>'} titik kritis 5% ${fmt(t.crit[1], 3)} \u2192 ${t.stationary ? 'stasioner' : 'tidak stasioner'}`
        : `${nm} = ${fmt(t.stat, 4)} ${t.stationary ? '<' : '\u2265'} nilai kritis 5% ${fmt(t.crit[1], 4)} (p = ${fmt(t.pval, 4)}) \u2192 ${t.stationary ? 'stasioner' : 'tidak stasioner'}`;
    }).join('; ');

    const parts = [];
    parts.push(`<strong>Varians.</strong> Selang kepercayaan 95% \u03BB = [${fmt(bc.lo, 3)}; ${fmt(bc.hi, 3)}]. ` + (R.varStatus === 'ok'
      ? 'Selang memuat 1, sehingga varians stabil dan data tidak perlu ditransformasi.'
      : R.varStatus === 'fixed'
        ? `Selang tidak memuat 1, sehingga varians belum stabil. Data ditransformasi dengan \u03BB = ${lamTxt(R.lam)} (${escapeHTML(lamName(R.lam))}) sebelum diuji pada tahap mean.`
        : `Selang tidak memuat 1 (\u03BB bulat yang disarankan = ${lamTxt(bc.rounded)}), tetapi transformasi tidak diterapkan. Ulangi dengan pengaturan Box-Cox \u201Cikuti hasil\u201D agar varians distabilkan lebih dulu.`));
    parts.push(`<strong>Mean.</strong> Pada ${dLabel(cfg.d)}: ${testsTxt}. ` + meanAdvice(R));
    if (R.overall) {
      parts.push(cfg.d === 0
        ? 'Dengan demikian data sudah <strong>stasioner pada level</strong>, I(0), dan dapat langsung dipakai pada model yang mensyaratkan stasioneritas (mis. ARMA).'
        : `Dengan demikian data stasioner pada diferensiasi ke-${cfg.d}, artinya data terintegrasi orde ${cfg.d}, I(${cfg.d}). Gunakan d = ${cfg.d} pada model seperti ARIMA(p, ${cfg.d}, q)${R.lam !== null ? `, dan simpan transformasi Box-Cox (\u03BB = ${lamTxt(R.lam)}) sebagai langkah pra-pemrosesan` : ''}.`);
    }
    el.conclusionWrap.innerHTML = `<div class="test-block">
      <div class="test-stat-row">
        ${statCard('\u03BB Box-Cox', `${fmt(bc.est, 3)} [${fmt(bc.lo, 2)}; ${fmt(bc.hi, 2)}]`)}
        ${R.tests.map((t) => statCard(TEST_SHORT[t.kind], fmt(t.stat, 4))).join('')}
      </div>
      <div class="test-stat-row" style="margin-bottom:6px;">
        <div class="test-verdict ${vOk ? 'ok' : 'bad'}">${varLabel}</div>
        <div class="test-verdict ${R.meanStatus === 'ok' ? 'ok' : 'bad'}">${meanLabel}</div>
      </div>
      <div class="test-verdict ${finalCls}">${finalLabel}</div>
      ${parts.map((p) => `<p class="test-conclusion" style="margin-bottom:8px;">${p}</p>`).join('')}
      ${R.tests.filter((t) => t.kind !== 'kpss').map((t) => disagreeNote(t)).join('')}
      <p class="test-note">Uji akar unit memiliki daya uji rendah pada data yang sedikit, dan hasilnya dapat berubah menurut pilihan model (konstanta/tren) dan jumlah lag. Disarankan memeriksa juga grafik deret waktu dan membandingkan beberapa uji.</p>
    </div>`;
  }

  function meanAdvice(R) {
    const cfg = R.cfg;
    if (R.meanStatus === 'ok') return R.tests.length > 1 ? 'Semua uji sepakat bahwa data stasioner dalam mean.' : 'H0 ditolak/tidak ditolak sesuai arah masing-masing uji sehingga data stasioner dalam mean.';
    if (R.meanStatus === 'mixed') {
      return 'Uji-uji tidak sepakat. Ini umum terjadi: ADF/PP berhipotesis nol \u201Ctidak stasioner\u201D, sedangkan KPSS berhipotesis nol \u201Cstasioner\u201D. Bila ADF/PP menolak H0 tetapi KPSS juga menolak, deret mungkin <em>stasioner-tren</em> atau mengandung perubahan struktural; coba model konstanta &amp; tren atau lakukan diferensiasi.';
    }
    return cfg.d < 2
      ? `Langkah selanjutnya: ulangi uji dengan <strong>${cfg.d === 0 ? 'diferensiasi pertama' : 'diferensiasi kedua'}</strong> (kembali ke Langkah 1 dan ubah pengaturan diferensiasi).`
      : 'Data masih belum stasioner setelah diferensiasi kedua; periksa kembali data (outlier, perubahan struktural) atau pilihan model uji (konstanta/tren).';
  }


  /* =========================================================================
     EKSPOR .docx + GRAFIK PENDUKUNG (lihat Method/Shared/export-hasil.js)
     ========================================================================= */
  function exportStasioner(R) {
    try {
      const SC = window.StatCharts, SE = window.StatExport;
      if (!SC || !SE) return;
      const cfg = R.cfg, d = cfg.d, bc = R.bc, t0 = R.tests[0], z = t0.z;
      const mean0 = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      const charts = [
        { title: 'Box-Cox Plot (stasioner dalam varians)', caption: 'StDev data hasil transformasi menurut \u03BB. Titik berwarna sorotan = \u03BB estimasi; garis putus-putus tegak = batas bawah/atas selang 95%; garis datar = Limit. Bila selang memuat 1, varians dianggap stabil.', build: () => boxcoxSvg(bc, 'Y') },
        { title: 'Deret data asli', caption: 'Deret stasioner berfluktuasi di sekitar rata-rata tetap tanpa tren naik/turun yang jelas. Garis putus-putus = rata-rata.', build: () => SC.line({ title: 'Data Asli (Y)', xLabel: 'Periode', yLabel: 'Nilai', labels: R.raw.map((_, i) => i + 1), series: [{ name: 'Data asli', values: R.raw }], hlines: [{ y: mean0(R.raw), label: 'rata-rata', color: '#BD7E1F' }] }) },
      ];
      if (R.lam !== null) charts.push({ title: 'Data setelah transformasi Box-Cox', caption: 'Deret setelah transformasi \u03BB = ' + lamTxt(R.lam) + '. Sebaran yang lebih seragam menandakan varians lebih stabil.', build: () => SC.line({ title: 'Data Hasil Transformasi (\u03BB = ' + lamTxt(R.lam) + ')', xLabel: 'Periode', yLabel: 'Nilai', labels: R.base.map((_, i) => i + 1), series: [{ name: 'Transformasi', values: R.base }], hlines: [{ y: mean0(R.base), label: 'rata-rata', color: '#BD7E1F' }] }) });
      if (d > 0) charts.push({ title: 'Deret yang diuji: ' + dLabel(d), caption: 'Deret hasil diferensiasi yang dimasukkan ke uji akar unit. Garis putus-putus = rata-rata.', build: () => SC.line({ title: 'Data yang Diuji: ' + dLabel(d), xLabel: 'Periode', yLabel: 'Nilai', labels: z.map((_, i) => i + 1 + d), series: [{ name: dLabel(d), values: z }], hlines: [{ y: mean0(z), label: 'rata-rata', color: '#BD7E1F' }] }) });
      charts.push({ title: 'Autokorelasi (ACF) deret yang diuji', caption: 'Batang yang melewati garis \u00B11,96/\u221An (merah) bermakna secara statistik. ACF yang meluruh sangat lambat menandakan deret belum stasioner dalam mean.', build: () => SC.acf(z, { title: 'ACF Data yang Diuji' }) });
      R.tests.forEach((t) => {
        if (t.kind === 'adf' && t.aicTable && t.aicTable.length > 1) charts.push({ title: 'AIC menurut jumlah lag (ADF)', caption: 'Lag terpilih (' + t.p + ') adalah yang AIC-nya terkecil.', build: () => SC.bars({ title: 'AIC menurut Jumlah Lag', xLabel: 'Jumlah lag', yLabel: 'AIC', labels: t.aicTable.map((r) => r.lag), values: t.aicTable.map((r) => r.aic), colors: t.aicTable.map((r) => (r.lag === t.p ? '#BD7E1F' : '#22384A')), valueLabels: true }) });
        if (t.kind === 'kpss') charts.push({ title: 'Statistik KPSS vs titik kritis', caption: 'Data stasioner bila KPSS (\u03B7) lebih KECIL daripada titik kritis (kebalikan ADF/PP). Saat ini \u03B7 = ' + fmt(t.stat, 4) + ' dan titik kritis 5% = ' + fmt(t.crit[1], 3) + '.', build: () => SC.bars({ title: 'KPSS (\u03B7) vs Titik Kritis', yLabel: 'Nilai', labels: ['KPSS (\u03B7)', 'Kritis 10%', 'Kritis 5%', 'Kritis 2.5%', 'Kritis 1%'], values: [t.stat].concat(t.crit), colors: [t.stationary ? '#4E7F3A' : '#B5532F', '#948C77', '#948C77', '#948C77', '#948C77'], valueLabels: true }) });
        else charts.push({ title: 'Statistik ' + TEST_SHORT[t.kind] + ' vs nilai kritis', caption: 'Data stasioner bila statistik lebih kecil (lebih negatif) daripada nilai kritis. Saat ini ' + TEST_SHORT[t.kind] + ' = ' + fmt(t.stat, 4) + ' dan nilai kritis 5% = ' + fmt(t.crit[1], 4) + '.', build: () => SC.bars({ title: TEST_SHORT[t.kind] + ' vs Nilai Kritis MacKinnon', yLabel: 'Nilai', labels: [TEST_SHORT[t.kind], 'Kritis 1%', 'Kritis 5%', 'Kritis 10%'], values: [t.stat, t.crit[0], t.crit[1], t.crit[2]], colors: [t.stationary ? '#4E7F3A' : '#B5532F', '#948C77', '#948C77', '#948C77'], valueLabels: true }) });
      });
      const meta = [
        ['Jenis analisis', 'Uji stasioneritas dua tahap (varians: Box-Cox; mean: ' + R.tests.map((t) => TEST_SHORT[t.kind]).join(' + ') + ')'],
        ['Estimator StDev Box-Cox', bc.sigma === 'mr' ? 'Moving range (MR\u0304/1,128)' : 'Simpangan baku sampel'],
        ['\u03BB Box-Cox (estimasi)', fmt(bc.est, 4)],
        ['Selang kepercayaan 95% \u03BB', '[' + fmt(bc.lo, 3) + '; ' + fmt(bc.hi, 3) + ']'],
        ['\u03BB pembulatan', lamTxt(bc.rounded)],
        ['Stasioner dalam varians', R.varStatus === 'ok' ? 'Ya (selang memuat 1)' : R.varStatus === 'fixed' ? 'Ya, setelah transformasi \u03BB = ' + lamTxt(R.lam) : 'Belum'],
        ['Data yang diuji (mean)', dLabel(d) + ' dari ' + baseLabel(R)],
        ['Model', MODEL_LABEL[cfg.model]],
      ];
      R.tests.forEach((t) => {
        meta.push([TEST_SHORT[t.kind] + ' \u2014 statistik', fmt(t.stat, 4)]);
        meta.push([TEST_SHORT[t.kind] + ' \u2014 nilai kritis 5%', fmt(t.crit[1], 4)]);
        meta.push([TEST_SHORT[t.kind] + ' \u2014 keputusan', t.stationary ? 'Stasioner' : 'Tidak stasioner']);
      });
      meta.push(['Kesimpulan akhir', R.overall ? 'Data stasioner (varians & mean)' : 'Data belum stasioner penuh']);
      SE.publish({
        id: 'stasioner', title: 'Hasil Uji Stasioneritas (Varians & Mean)', anchor: '#st-conclusion-card', resultsCard: '#st-results-card',
        meta,
        sections: [{ heading: 'Tahap 1: Stasioner dalam Varians (Box-Cox)', sel: '#stVarWrap' }, { heading: 'Tahap 2: Stasioner dalam Mean', sel: '#stTestWrap' }, { heading: 'Tabel Data & Variabel Regresi', sel: '#stTableWrap' }, { heading: 'Langkah Perhitungan', sel: '#stStepsWrap' }, { heading: 'Kesimpulan', sel: '#stConclusionWrap' }],
        data: { head: ['Periode', 'Nilai'], rows: R.raw.map((v, i) => [i + 1, v]), caption: 'Data deret waktu yang diuji (urut dari periode terlama).' },
        charts,
      });
    } catch (err) { console.warn('Ekspor Stasioneritas:', err); }
  }

  function statCard(label, value) { return `<div class="stat-card"><div class="k">${escapeHTML(label)}</div><div class="v">${escapeHTML(String(value))}</div></div>`; }
  function fmt(x, d = 4) {
    if (x === null || x === undefined || Number.isNaN(x) || !Number.isFinite(x)) return '\u2014';
    return Number(x).toFixed(d);
  }
  function showError(node, msg) { node.textContent = msg; node.hidden = false; }
  function hideError(node) { node.hidden = true; node.textContent = ''; }
  function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
  function esc(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  window.StatCalcStasioner = { runADF, runPP, runKPSS, runAll, boxcox, boxcoxSvg, mackinnonP, mackinnonCrit }; // untuk pengujian
})();
