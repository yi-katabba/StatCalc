/* =========================================================================
     3. METODE — SMOOTHING (SMA & SES) — logika kalkulator
     ========================================================================= */
(function () {
  'use strict';

  const state = { method: 'sma', n: 3, alpha: 0.2, beta: 0.1, gamma: 0.1, L: 4, minRows: 4 };
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const el = {
    methodSel: $('#smMethod'), paramSMA: $('#smParamSMA'), paramSES: $('#smParamSES'),
    paramDMA: $('#smParamDMA'), paramDES: $('#smParamDES'), paramTES: $('#smParamTES'),
    nInput: $('#smN'), alphaInput: $('#smAlpha'), nDMAInput: $('#smNDMA'),
    alphaDESInput: $('#smAlphaDES'), betaDESInput: $('#smBetaDES'),
    alphaTESInput: $('#smAlphaTES'), betaTESInput: $('#smBetaTES'),
    gammaTESInput: $('#smGammaTES'), seasonTESInput: $('#smSeasonTES'),
    buildTableBtn: $('#smBuildTableBtn'), setupError: $('#smSetupError'),
    dataCard: $('#sm-data-card'), minRowsHint: $('#smMinRowsHint'),
    tableBody: $('#smDataTableBody'),
    addRowBtn: $('#smAddRowBtn'), removeRowBtn: $('#smRemoveRowBtn'),
    fillSampleBtn: $('#smFillSampleBtn'), calcBtn: $('#smCalcBtn'), dataError: $('#smDataError'),
    resultsCard: $('#sm-results-card'), tableWrap: $('#smTableWrap'),
    stepsWrap: $('#smStepsWrap'), chartWrap: $('#smChartWrap'),
    evalCard: $('#sm-eval-card'), evalWrap: $('#smEvalWrap'),
  };

  el.methodSel.addEventListener('change', () => {
    state.method = el.methodSel.value;
    el.paramSMA.hidden = state.method !== 'sma';
    el.paramDMA.hidden = state.method !== 'dma';
    el.paramSES.hidden = state.method !== 'ses';
    el.paramDES.hidden = state.method !== 'des';
    el.paramTES.hidden = state.method !== 'tes';
  });

  el.buildTableBtn.addEventListener('click', () => {
    hideError(el.setupError);
    state.method = el.methodSel.value;
    if (state.method === 'sma') {
      const n = parseInt(el.nInput.value, 10);
      if (!Number.isInteger(n) || n < 2 || n > 20) {
        showError(el.setupError, 'Jumlah periode (n) harus bilangan bulat antara 2 dan 20.');
        return;
      }
      state.n = n;
      state.minRows = n + 1;
    } else if (state.method === 'dma') {
      const n = parseInt(el.nDMAInput.value, 10);
      if (!Number.isInteger(n) || n < 2 || n > 20) {
        showError(el.setupError, 'Jumlah periode (n) harus bilangan bulat antara 2 dan 20.');
        return;
      }
      state.n = n;
      state.minRows = 2 * n;
    } else if (state.method === 'ses') {
      const a = parseFloat(el.alphaInput.value);
      if (!Number.isFinite(a) || a <= 0 || a > 1) {
        showError(el.setupError, 'Nilai alpha (\u03B1) harus berupa angka lebih dari 0 dan tidak lebih dari 1 (0 &lt; \u03B1 \u2264 1).');
        return;
      }
      state.alpha = a;
      state.minRows = 2;
    } else if (state.method === 'des') {
      const a = parseFloat(el.alphaDESInput.value);
      const b = parseFloat(el.betaDESInput.value);
      if (!Number.isFinite(a) || a <= 0 || a > 1) {
        showError(el.setupError, 'Nilai alpha (\u03B1) harus berupa angka lebih dari 0 dan tidak lebih dari 1 (0 &lt; \u03B1 \u2264 1).');
        return;
      }
      if (!Number.isFinite(b) || b <= 0 || b > 1) {
        showError(el.setupError, 'Nilai beta (\u03B2) harus berupa angka lebih dari 0 dan tidak lebih dari 1 (0 &lt; \u03B2 \u2264 1).');
        return;
      }
      state.alpha = a; state.beta = b;
      state.minRows = 3;
    } else { // tes
      const a = parseFloat(el.alphaTESInput.value);
      const b = parseFloat(el.betaTESInput.value);
      const g = parseFloat(el.gammaTESInput.value);
      const L = parseInt(el.seasonTESInput.value, 10);
      if (!Number.isFinite(a) || a <= 0 || a > 1) {
        showError(el.setupError, 'Nilai alpha (\u03B1) harus berupa angka lebih dari 0 dan tidak lebih dari 1 (0 &lt; \u03B1 \u2264 1).');
        return;
      }
      if (!Number.isFinite(b) || b <= 0 || b > 1) {
        showError(el.setupError, 'Nilai beta (\u03B2) harus berupa angka lebih dari 0 dan tidak lebih dari 1 (0 &lt; \u03B2 \u2264 1).');
        return;
      }
      if (!Number.isFinite(g) || g <= 0 || g > 1) {
        showError(el.setupError, 'Nilai gamma (\u03B3) harus berupa angka lebih dari 0 dan tidak lebih dari 1 (0 &lt; \u03B3 \u2264 1).');
        return;
      }
      if (!Number.isInteger(L) || L < 2 || L > 12) {
        showError(el.setupError, 'Panjang musim (L) harus bilangan bulat antara 2 dan 12.');
        return;
      }
      state.alpha = a; state.beta = b; state.gamma = g; state.L = L;
      state.minRows = 2 * L;
    }
    el.minRowsHint.textContent = state.minRows;
    buildDataTable(Math.max(state.minRows, 6));
    el.dataCard.hidden = false;
    el.resultsCard.hidden = true;
    el.evalCard.hidden = true;
    el.dataCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function buildDataTable(rowCount) {
    el.tableBody.innerHTML = '';
    for (let i = 0; i < rowCount; i++) addRow();
  }

  function addRow() {
    const idx = el.tableBody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rownum">${idx}</td><td><input type="text" inputmode="decimal" data-role="Y" placeholder="Nilai periode ${idx}"></td>`;
    el.tableBody.appendChild(tr);
  }

  el.addRowBtn.addEventListener('click', () => { addRow(); });
  el.removeRowBtn.addEventListener('click', () => {
    const rows = $$('#smDataTableBody tr');
    if (rows.length <= state.minRows) return;
    rows[rows.length - 1].remove();
  });

  const SAMPLE = [120, 132, 125, 140, 138, 150, 145, 160, 158, 170, 165, 180];
  el.fillSampleBtn.addEventListener('click', () => {
    const rows = $$('#smDataTableBody tr');
    rows.forEach((tr, i) => {
      const inp = tr.querySelector('input[data-role="Y"]');
      inp.value = SAMPLE[i % SAMPLE.length];
      inp.classList.remove('invalid');
    });
  });

  function collectData() {
    const rows = $$('#smDataTableBody tr');
    const Y = [];
    const problems = [];
    $$('#smDataTableBody input').forEach((inp) => inp.classList.remove('invalid'));
    rows.forEach((tr, i) => {
      const inp = tr.querySelector('input[data-role="Y"]');
      const raw = inp.value.trim().replace(',', '.');
      const val = parseFloat(raw);
      if (raw === '' || Number.isNaN(val)) { problems.push(`Baris ${i + 1}: nilai kosong atau bukan angka.`); inp.classList.add('invalid'); }
      Y.push(val);
    });
    if (problems.length) return { error: problems.slice(0, 6).join(' ') + (problems.length > 6 ? ' \u2026' : '') };
    if (Y.length < state.minRows) return { error: `Minimal ${state.minRows} periode data diperlukan untuk parameter yang dipilih.` };
    if (state.method === 'sma' && Y.length <= state.n) return { error: `Jumlah data (n periode data) harus lebih banyak dari parameter n (${state.n}) agar tersedia minimal satu nilai ramalan yang dapat dievaluasi.` };
    if (state.method === 'dma' && Y.length < 2 * state.n) return { error: `Metode DMA memerlukan minimal 2\u00D7n = ${2 * state.n} periode data agar rata-rata bergerak kedua (M'') dapat dihitung.` };
    if (state.method === 'tes' && Y.length < 2 * state.L) return { error: `Metode Winter memerlukan minimal 2\u00D7L = ${2 * state.L} periode data (dua siklus musim penuh) agar indeks musiman awal dapat dihitung.` };
    return { Y };
  }

  /* ---------- Single Moving Average ---------- */
  function computeSMA(Y, n) {
    const N = Y.length;
    const forecast = new Array(N).fill(null);
    for (let i = n; i < N; i++) {
      let sum = 0;
      for (let j = i - n; j < i; j++) sum += Y[j];
      forecast[i] = sum / n;
    }
    let sum = 0;
    for (let j = N - n; j < N; j++) sum += Y[j];
    const nextForecast = sum / n;
    return { forecast, nextForecast, firstIdx: n };
  }

  /* ---------- Double Moving Average (rata-rata bergerak ganda) ---------- */
  function computeDMA(Y, n) {
    const N = Y.length;
    const Mp = new Array(N).fill(null);   // M' - rata-rata bergerak pertama
    for (let i = n - 1; i < N; i++) {
      let s = 0; for (let j = i - n + 1; j <= i; j++) s += Y[j];
      Mp[i] = s / n;
    }
    const Mpp = new Array(N).fill(null);  // M'' - rata-rata bergerak kedua (dari M')
    for (let i = 2 * n - 2; i < N; i++) {
      let s = 0; for (let j = i - n + 1; j <= i; j++) s += Mp[j];
      Mpp[i] = s / n;
    }
    const a = new Array(N).fill(null);
    const b = new Array(N).fill(null);
    for (let i = 2 * n - 2; i < N; i++) {
      a[i] = 2 * Mp[i] - Mpp[i];
      b[i] = (2 / (n - 1)) * (Mp[i] - Mpp[i]);
    }
    const forecast = new Array(N).fill(null);
    for (let i = 2 * n - 1; i < N; i++) forecast[i] = a[i - 1] + b[i - 1] * 1;
    const nextForecast = a[N - 1] + b[N - 1] * 1;
    return { forecast, nextForecast, firstIdx: 2 * n - 1, Mp, Mpp, a, b };
  }

  /* ---------- Single Exponential Smoothing ---------- */
  function computeSES(Y, alpha) {
    const N = Y.length;
    const forecast = new Array(N).fill(null);
    forecast[0] = Y[0];
    for (let i = 1; i < N; i++) forecast[i] = alpha * Y[i - 1] + (1 - alpha) * forecast[i - 1];
    const nextForecast = alpha * Y[N - 1] + (1 - alpha) * forecast[N - 1];
    return { forecast, nextForecast, firstIdx: 1 };
  }

  /* ---------- Double Exponential Smoothing (Holt: level + tren) ---------- */
  function computeDES(Y, alpha, beta) {
    const N = Y.length;
    const level = new Array(N).fill(null);
    const trend = new Array(N).fill(null);
    const forecast = new Array(N).fill(null);
    // Inisialisasi: level periode 1 = data aktual periode 1; tren awal = selisih periode 2 dan 1.
    level[0] = Y[0];
    trend[0] = Y[1] - Y[0];
    for (let i = 1; i < N; i++) {
      forecast[i] = level[i - 1] + trend[i - 1];
      level[i] = alpha * Y[i] + (1 - alpha) * (level[i - 1] + trend[i - 1]);
      trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
    }
    const nextForecast = level[N - 1] + trend[N - 1];
    return { forecast, nextForecast, firstIdx: 1, level, trend };
  }

  /* ---------- Triple Exponential Smoothing (Winter: level + tren + musiman, multiplikatif) ---------- */
  function computeTES(Y, alpha, beta, gamma, L) {
    const N = Y.length;
    const level = new Array(N).fill(null);
    const trend = new Array(N).fill(null);
    const seasonal = new Array(N).fill(null);
    const forecast = new Array(N).fill(null);
    // Inisialisasi level & tren dari rata-rata dua musim pertama, dan indeks musiman awal dari musim pertama.
    let sum1 = 0; for (let i = 0; i < L; i++) sum1 += Y[i];
    const avg1 = sum1 / L;
    let sum2 = 0; for (let i = L; i < 2 * L; i++) sum2 += Y[i];
    const avg2 = sum2 / L;
    const initTrend = (avg2 - avg1) / L;
    for (let i = 0; i < L; i++) seasonal[i] = Y[i] / avg1;
    level[L - 1] = avg1;
    trend[L - 1] = initTrend;
    for (let i = L; i < N; i++) {
      forecast[i] = (level[i - 1] + trend[i - 1]) * seasonal[i - L];
      level[i] = alpha * (Y[i] / seasonal[i - L]) + (1 - alpha) * (level[i - 1] + trend[i - 1]);
      trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
      seasonal[i] = gamma * (Y[i] / level[i]) + (1 - gamma) * seasonal[i - L];
    }
    const nextForecast = (level[N - 1] + trend[N - 1]) * seasonal[N - L];
    return { forecast, nextForecast, firstIdx: L, level, trend, seasonal };
  }

  function evaluateForecast(Y, forecast, firstIdx) {
    const N = Y.length;
    const errors = new Array(N).fill(null);
    const absErrors = new Array(N).fill(null);
    const pctErrors = new Array(N).fill(null);
    let sumSq = 0, sumAbsPct = 0, m = 0, mPct = 0;
    for (let i = firstIdx; i < N; i++) {
      const e = Y[i] - forecast[i];
      errors[i] = e; absErrors[i] = Math.abs(e);
      pctErrors[i] = Y[i] !== 0 ? Math.abs(e / Y[i]) * 100 : null;
      sumSq += e * e; m += 1;
      if (pctErrors[i] !== null) { sumAbsPct += pctErrors[i]; mPct += 1; }
    }
    const mse = m > 0 ? sumSq / m : NaN;
    const mape = mPct > 0 ? sumAbsPct / mPct : NaN;
    return { errors, absErrors, pctErrors, mse, mape, m };
  }

  el.calcBtn.addEventListener('click', () => {
    hideError(el.dataError);
    const data = collectData();
    if (data.error) { showError(el.dataError, data.error); return; }
    const Y = data.Y;
    const sm = state.method === 'sma' ? computeSMA(Y, state.n)
      : state.method === 'dma' ? computeDMA(Y, state.n)
      : state.method === 'ses' ? computeSES(Y, state.alpha)
      : state.method === 'des' ? computeDES(Y, state.alpha, state.beta)
      : computeTES(Y, state.alpha, state.beta, state.gamma, state.L);
    const ev = evaluateForecast(Y, sm.forecast, sm.firstIdx);

    renderTable(Y, sm, ev);
    renderSteps(Y, sm, ev);
    renderChart(Y, sm);
    el.resultsCard.hidden = false;
    $$('#smResultTabs .tab-btn').forEach((b) => b.classList.remove('active'));
    $$('#view-smoothing .tab-panel').forEach((p) => p.classList.remove('active'));
    $('#smResultTabs .tab-btn[data-tab="sm-tab-table"]').classList.add('active');
    $('#sm-tab-table').classList.add('active');

    renderEval(ev, sm);
    el.evalCard.hidden = false;

    el.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
  });

  function methodLabel() {
    if (state.method === 'sma') return `Single Moving Average (n = ${state.n})`;
    if (state.method === 'dma') return `Double Moving Average (n = ${state.n})`;
    if (state.method === 'ses') return `Single Exponential Smoothing (\u03B1 = ${state.alpha})`;
    if (state.method === 'des') return `Double Exponential Smoothing \u2013 Holt (\u03B1 = ${state.alpha}, \u03B2 = ${state.beta})`;
    return `Triple Exponential Smoothing \u2013 Winter (\u03B1 = ${state.alpha}, \u03B2 = ${state.beta}, \u03B3 = ${state.gamma}, L = ${state.L})`;
  }

  function renderTable(Y, sm, ev) {
    const N = Y.length;
    let html = `<table class="result-table"><caption>Tabel Data Aktual vs Hasil Smoothing &mdash; ${methodLabel()}</caption>` +
      `<thead><tr><th>Periode</th><th>Data Aktual (Y)</th><th>Hasil Smoothing (F)</th><th>Error (Y &minus; F)</th><th>|Error|</th><th>Error %</th></tr></thead><tbody>`;
    for (let i = 0; i < N; i++) {
      const f = sm.forecast[i], e = ev.errors[i], ae = ev.absErrors[i], pe = ev.pctErrors[i];
      html += `<tr><td>${i + 1}</td><td>${fmt(Y[i], 2)}</td>` +
        `<td>${f === null ? '&mdash;' : fmt(f, 3)}</td>` +
        `<td>${e === null ? '&mdash;' : fmt(e, 3)}</td>` +
        `<td>${ae === null ? '&mdash;' : fmt(ae, 3)}</td>` +
        `<td>${pe === null ? '&mdash;' : fmt(pe, 2) + '%'}</td></tr>`;
    }
    html += `</tbody><tfoot><tr><td>${N + 1} (Ramalan)</td><td>&mdash;</td><td>${fmt(sm.nextForecast, 3)}</td><td colspan="3">Ramalan untuk periode berikutnya, di luar data historis.</td></tr></tfoot></table>`;
    el.tableWrap.innerHTML = html;
  }

  function renderSteps(Y, sm, ev) {
    const N = Y.length;
    const steps = [];
    if (state.method === 'sma') {
      const n = state.n;
      steps.push({ title: 'Rumus Single Moving Average', formula: `F(t+1) = (Y(t) + Y(t-1) + \u2026 + Y(t-n+1)) / n`, note: `n = ${n} \u2014 banyaknya data terbaru yang dirata-ratakan untuk membentuk satu nilai ramalan.` });
      const i = sm.firstIdx;
      const terms = [];
      for (let j = i - n; j < i; j++) terms.push(fmt(Y[j], 2));
      steps.push({ title: `Contoh perhitungan periode ke-${i + 1}`, formula: `F(${i + 1}) = (${terms.join(' + ')}) / ${n}\n     = ${fmt(sm.forecast[i], 3)}`, note: `Nilai ini dibandingkan dengan data aktual Y(${i + 1}) = ${fmt(Y[i], 2)} untuk mendapatkan error pada periode tersebut.` });
      const nextTerms = [];
      for (let j = N - n; j < N; j++) nextTerms.push(fmt(Y[j], 2));
      steps.push({ title: `Ramalan periode ke-${N + 1} (di luar data)`, formula: `F(${N + 1}) = (${nextTerms.join(' + ')}) / ${n}\n     = ${fmt(sm.nextForecast, 3)}`, note: 'Dihitung dari rata-rata n data aktual paling akhir yang tersedia.' });
    } else if (state.method === 'dma') {
      const n = state.n;
      const i = sm.firstIdx; // indeks periode pertama yang punya nilai forecast (0-indexed)
      const j = i - 1; // indeks a,b yang dipakai untuk forecast periode i+1
      steps.push({ title: 'Rumus Double Moving Average', formula: `M't = (Yt + Yt-1 + \u2026 + Yt-n+1) / n\nM''t = (M't + M't-1 + \u2026 + M't-n+1) / n\nat = 2\u00B7M't \u2212 M''t\nbt = [2 / (n \u2212 1)]\u00B7(M't \u2212 M''t)\nFt+m = at + bt\u00B7m`, note: `n = ${n} \u2014 panjang rata-rata bergerak, dipakai dua kali berturut-turut (M' = rata-rata bergerak pertama, M'' = rata-rata bergerak dari M').` });
      steps.push({ title: `Hitung M' dan M'' pada periode ke-${j + 1}`, formula: `M'(${j + 1}) = ${fmt(sm.Mp[j], 3)}\nM''(${j + 1}) = ${fmt(sm.Mpp[j], 3)}\na(${j + 1}) = 2\u00B7${fmt(sm.Mp[j], 3)} \u2212 ${fmt(sm.Mpp[j], 3)} = ${fmt(sm.a[j], 3)}\nb(${j + 1}) = [2/(${n}\u22121)]\u00B7(${fmt(sm.Mp[j], 3)} \u2212 ${fmt(sm.Mpp[j], 3)}) = ${fmt(sm.b[j], 4)}`, note: 'M\'\' baru bisa dihitung setelah tersedia n nilai M\' berturut-turut, sehingga forecast pertama baru muncul mulai periode ke-2n.' });
      steps.push({ title: `Contoh perhitungan periode ke-${i + 1}`, formula: `F(${i + 1}) = a(${j + 1}) + b(${j + 1})\u00B71\n     = ${fmt(sm.a[j], 3)} + ${fmt(sm.b[j], 4)}\n     = ${fmt(sm.forecast[i], 3)}`, note: `Nilai ini dibandingkan dengan data aktual Y(${i + 1}) = ${fmt(Y[i], 2)} untuk mendapatkan error pada periode tersebut.` });
      steps.push({ title: `Ramalan periode ke-${N + 1} (di luar data)`, formula: `F(${N + 1}) = a(${N}) + b(${N})\u00B71\n     = ${fmt(sm.a[N - 1], 3)} + ${fmt(sm.b[N - 1], 4)}\n     = ${fmt(sm.nextForecast, 3)}`, note: 'a dan b dari periode terakhir yang tersedia dipakai untuk memproyeksikan tren secara linear ke periode berikutnya.' });
    } else if (state.method === 'ses') {
      const a = state.alpha;
      steps.push({ title: 'Inisialisasi nilai smoothing pertama', formula: `F(1) = Y(1) = ${fmt(Y[0], 2)}`, note: 'Konvensi umum: nilai smoothing pada periode pertama diinisialisasi sama dengan data aktual pertama.' });
      steps.push({ title: 'Rumus Single Exponential Smoothing', formula: `F(t) = \u03B1\u00B7Y(t-1) + (1 \u2212 \u03B1)\u00B7F(t-1)`, note: `\u03B1 = ${a} \u2014 bobot pemulusan yang dipilih pada Langkah 1.` });
      if (N > 1) {
        steps.push({ title: 'Contoh perhitungan periode ke-2', formula: `F(2) = ${a}\u00B7Y(1) + (1 \u2212 ${a})\u00B7F(1)\n     = ${a}\u00B7${fmt(Y[0], 2)} + ${fmt(1 - a, 2)}\u00B7${fmt(sm.forecast[0], 2)}\n     = ${fmt(sm.forecast[1], 3)}` });
      }
      steps.push({ title: `Ramalan periode ke-${N + 1} (di luar data)`, formula: `F(${N + 1}) = ${a}\u00B7Y(${N}) + (1 \u2212 ${a})\u00B7F(${N})\n     = ${a}\u00B7${fmt(Y[N - 1], 2)} + ${fmt(1 - a, 2)}\u00B7${fmt(sm.forecast[N - 1], 3)}\n     = ${fmt(sm.nextForecast, 3)}`, note: 'Dihitung berulang (rekursif) dari data aktual dan nilai smoothing periode sebelumnya.' });
    } else if (state.method === 'des') {
      const a = state.alpha, b = state.beta;
      steps.push({ title: 'Inisialisasi level & tren awal (metode Holt)', formula: `L(1) = Y(1) = ${fmt(Y[0], 2)}\nT(1) = Y(2) \u2212 Y(1) = ${fmt(Y[1], 2)} \u2212 ${fmt(Y[0], 2)} = ${fmt(sm.trend[0], 3)}`, note: 'L = komponen level (nilai dasar data), T = komponen tren (kecenderungan naik/turun antar periode).' });
      steps.push({ title: 'Rumus Double Exponential Smoothing \u2013 Holt', formula: `L(t) = \u03B1\u00B7Y(t) + (1 \u2212 \u03B1)\u00B7[L(t-1) + T(t-1)]\nT(t) = \u03B2\u00B7[L(t) \u2212 L(t-1)] + (1 \u2212 \u03B2)\u00B7T(t-1)\nF(t+1) = L(t) + T(t)`, note: `\u03B1 = ${a} (bobot level), \u03B2 = ${b} (bobot tren) \u2014 dipilih pada Langkah 1.` });
      if (N > 1) {
        steps.push({ title: 'Contoh perhitungan periode ke-2', formula: `F(2) = L(1) + T(1) = ${fmt(sm.level[0], 2)} + ${fmt(sm.trend[0], 3)} = ${fmt(sm.forecast[1], 3)}\nL(2) = ${a}\u00B7Y(2) + (1 \u2212 ${a})\u00B7[L(1)+T(1)]\n     = ${a}\u00B7${fmt(Y[1], 2)} + ${fmt(1 - a, 2)}\u00B7${fmt(sm.forecast[1], 3)} = ${fmt(sm.level[1], 3)}\nT(2) = ${b}\u00B7[L(2) \u2212 L(1)] + (1 \u2212 ${b})\u00B7T(1)\n     = ${b}\u00B7${fmt(sm.level[1] - sm.level[0], 3)} + ${fmt(1 - b, 2)}\u00B7${fmt(sm.trend[0], 3)} = ${fmt(sm.trend[1], 3)}` });
      }
      steps.push({ title: `Ramalan periode ke-${N + 1} (di luar data)`, formula: `F(${N + 1}) = L(${N}) + T(${N})\n     = ${fmt(sm.level[N - 1], 3)} + ${fmt(sm.trend[N - 1], 3)}\n     = ${fmt(sm.nextForecast, 3)}`, note: 'Karena ada komponen tren, ramalan ke depan meningkat/menurun secara linear mengikuti T(N).' });
    } else { // tes
      const a = state.alpha, b = state.beta, g = state.gamma, L = state.L;
      const season1 = Y.slice(0, L).map((v) => fmt(v, 2)).join(', ');
      steps.push({ title: 'Inisialisasi level, tren, & indeks musiman awal (metode Winter)', formula: `Rata-rata musim 1 (periode 1\u2013${L}) = ${fmt(sm.level[L - 1], 3)}\nRata-rata musim 2 (periode ${L + 1}\u2013${2 * L}) dipakai untuk T awal\nT(${L}) = (rata2 musim2 \u2212 rata2 musim1) / L = ${fmt(sm.trend[L - 1], 4)}\nS(i) = Y(i) / rata2 musim1, untuk i = 1..${L}: [${season1}] \u2192 indeks musiman awal`, note: 'L = level, T = tren, S = indeks musiman (rasio nilai aktual terhadap rata-rata musim). Indeks musiman awal dihitung dari musim pertama.' });
      steps.push({ title: 'Rumus Triple Exponential Smoothing \u2013 Winter (multiplikatif)', formula: `L(t) = \u03B1\u00B7[Y(t) / S(t-L)] + (1 \u2212 \u03B1)\u00B7[L(t-1) + T(t-1)]\nT(t) = \u03B2\u00B7[L(t) \u2212 L(t-1)] + (1 \u2212 \u03B2)\u00B7T(t-1)\nS(t) = \u03B3\u00B7[Y(t) / L(t)] + (1 \u2212 \u03B3)\u00B7S(t-L)\nF(t+1) = [L(t) + T(t)]\u00B7S(t+1-L)`, note: `\u03B1 = ${a} (level), \u03B2 = ${b} (tren), \u03B3 = ${g} (musiman), L = ${L} (panjang musim) \u2014 dipilih pada Langkah 1.` });
      if (N > L) {
        const i = L;
        steps.push({ title: `Contoh perhitungan periode ke-${i + 1}`, formula: `F(${i + 1}) = [L(${i}) + T(${i})]\u00B7S(${i}-${L}+1)\n     = [${fmt(sm.level[i - 1], 3)} + ${fmt(sm.trend[i - 1], 3)}]\u00B7${fmt(sm.seasonal[i - L], 3)}\n     = ${fmt(sm.forecast[i], 3)}`, note: `Dibandingkan dengan data aktual Y(${i + 1}) = ${fmt(Y[i], 2)} untuk mendapatkan error pada periode tersebut.` });
      }
      steps.push({ title: `Ramalan periode ke-${N + 1} (di luar data)`, formula: `F(${N + 1}) = [L(${N}) + T(${N})]\u00B7S(${N + 1 - L})\n     = [${fmt(sm.level[N - 1], 3)} + ${fmt(sm.trend[N - 1], 3)}]\u00B7${fmt(sm.seasonal[N - L], 3)}\n     = ${fmt(sm.nextForecast, 3)}`, note: 'Indeks musiman dari siklus musim terakhir yang tersedia dipakai kembali untuk meramalkan periode berikutnya.' });
    }
    steps.push({ title: 'Hitung ukuran error (MSE &amp; MAPE)', formula: `MSE = \u03A3(Y \u2212 F)\u00B2 / m = ${fmt(ev.mse)}\nMAPE = \u03A3|((Y \u2212 F)/Y)| \u00D7 100% / m = ${fmt(ev.mape, 2)}%`, note: `m = ${ev.m} \u2014 banyaknya periode yang memiliki nilai ramalan (periode tanpa ramalan tidak diikutsertakan dalam perhitungan error).` });
    el.stepsWrap.innerHTML = steps.map((s, i) => {
      const parts = [`<h4>${escapeHTML(s.title)}</h4>`];
      if (s.formula) parts.push(`<span class="formula">${escapeHTML(s.formula)}</span>`);
      if (s.note) parts.push(`<p>${escapeHTML(s.note)}</p>`);
      return `<div class="step-block" data-step="${i + 1}">${parts.join('')}</div>`;
    }).join('');
  }

  function renderChart(Y, sm) {
    el.chartWrap.innerHTML = '';
    const N = Y.length;
    const periods = Array.from({ length: N + 1 }, (_, i) => i + 1);
    const fullForecast = sm.forecast.concat([sm.nextForecast]);
    const W = 640, H = 380, PAD = 46;
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const allVals = Y.concat(fullForecast.filter((v) => v !== null));
    const minY = Math.min(...allVals), maxY = Math.max(...allVals);
    const padY = (maxY - minY) * 0.15 || 1;
    const yLo = minY - padY, yHi = maxY + padY;
    const sx = (p) => PAD + ((p - 1) / (N)) * (W - PAD - 24);
    const sy = (y) => H - PAD - ((y - yLo) / (yHi - yLo)) * (H - PAD - 30);
    const inkSoft = '#52565F', accent = '#22384A', accent2 = '#BD7E1F';
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#DAD2B8'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, H - PAD); ctx.lineTo(W - 16, H - PAD); ctx.moveTo(PAD, H - PAD); ctx.lineTo(PAD, 16); ctx.stroke();
    ctx.font = '11px IBM Plex Mono, monospace';
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const yv = yLo + (i / ticks) * (yHi - yLo), py = sy(yv);
      ctx.strokeStyle = '#EFEAD9'; ctx.beginPath(); ctx.moveTo(PAD, py); ctx.lineTo(W - 16, py); ctx.stroke();
      ctx.fillStyle = inkSoft; ctx.fillText(fmt(yv, 1), 4, py + 4);
    }
    // garis data aktual
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath();
    Y.forEach((y, i) => { const px = sx(i + 1), py = sy(y); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
    ctx.stroke();
    ctx.fillStyle = accent;
    Y.forEach((y, i) => { ctx.beginPath(); ctx.arc(sx(i + 1), sy(y), 3.5, 0, Math.PI * 2); ctx.fill(); });
    // garis hasil smoothing/ramalan
    ctx.strokeStyle = accent2; ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    fullForecast.forEach((f, i) => {
      if (f === null) return;
      const px = sx(i + 1), py = sy(f);
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.fillStyle = accent2;
    fullForecast.forEach((f, i) => { if (f === null) return; ctx.beginPath(); ctx.arc(sx(i + 1), sy(f), 3.5, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#22252B'; ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('Periode', W - 60, H - PAD - 8); ctx.fillText('Nilai', PAD + 4, 26);
    el.chartWrap.appendChild(canvas);
    const note = document.createElement('p');
    note.className = 'chart-note';
    note.textContent = `Garis biru tua = data aktual. Garis kuning = hasil smoothing/ramalan (${methodLabel()}), termasuk titik ramalan periode ke-${N + 1} di ujung kanan.`;
    el.chartWrap.appendChild(note);
  }

  function mapeLabel(mape) {
    if (!Number.isFinite(mape)) return { text: 'Tidak dapat ditentukan', cls: '' };
    if (mape < 10) return { text: 'Sangat Akurat', cls: 'ok' };
    if (mape < 20) return { text: 'Akurat', cls: 'ok' };
    if (mape < 50) return { text: 'Cukup Akurat', cls: 'bad' };
    return { text: 'Tidak Akurat', cls: 'bad' };
  }

  function renderEval(ev, sm) {
    const verdict = mapeLabel(ev.mape);
    const html = `<div class="test-block">
      <h4>Ringkasan Ukuran Error</h4>
      <p class="test-sub">Dihitung dari selisih antara data aktual dan hasil smoothing pada seluruh periode yang memiliki nilai ramalan (m = ${ev.m} periode).</p>
      <div class="test-stat-row">
        ${statCard('MSE', fmt(ev.mse))}
        ${statCard('MAPE', fmt(ev.mape, 2) + '%')}
        ${statCard('Ramalan Periode Berikutnya', fmt(sm.nextForecast, 3))}
      </div>
      <div class="test-verdict ${verdict.cls}">${verdict.text} (MAPE ${fmt(ev.mape, 2)}%)</div>
      <p class="test-conclusion">Semakin kecil nilai MSE dan MAPE, semakin akurat model smoothing ini dalam mengikuti pola data historis. Berdasarkan MAPE, tingkat akurasi model ${methodLabel()} pada data ini tergolong <strong>${verdict.text.toLowerCase()}</strong>.</p>
      <p class="test-note">Kriteria MAPE yang umum dipakai (Lewis, 1982): &lt;10% sangat akurat, 10&ndash;20% akurat, 20&ndash;50% cukup akurat, &gt;50% tidak akurat. MSE tidak memiliki satuan persen sehingga lebih berguna untuk membandingkan beberapa model pada data yang sama (mis. mencoba beberapa nilai n atau &alpha; lalu memilih yang MSE-nya terkecil).</p>
    </div>`;
    el.evalWrap.innerHTML = html;
  }

  function statCard(label, value) { return `<div class="stat-card"><div class="k">${escapeHTML(label)}</div><div class="v">${escapeHTML(String(value))}</div></div>`; }
  function fmt(x, d = 4) {
    if (x === null || x === undefined || Number.isNaN(x) || !Number.isFinite(x)) return '\u2014';
    return Number(x).toFixed(d);
  }
  function showError(node, msg) { node.textContent = msg; node.hidden = false; }
  function hideError(node) { node.hidden = true; node.textContent = ''; }
  function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
})();
