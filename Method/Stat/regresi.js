/* =========================================================================
   2. METODE — REGRESI LINEAR (logika kalkulator)
   ========================================================================= */
(function () {
  'use strict';

  const state = { k: 1, minRows: 3 };
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const el = {
    varCount: $('#varCount'), incVar: $('#incVar'), decVar: $('#decVar'),
    buildTableBtn: $('#buildTableBtn'), setupError: $('#setupError'),
    dataCard: $('#data-card'), minRowsHint: $('#minRowsHint'),
    tableHead: $('#dataTableHead'), tableBody: $('#dataTableBody'),
    addRowBtn: $('#addRowBtn'), removeRowBtn: $('#removeRowBtn'),
    fillSampleBtn: $('#fillSampleBtn'), calcBtn: $('#calcBtn'), dataError: $('#dataError'),
    resultsCard: $('#results-card'), sumsTableWrap: $('#sumsTableWrap'),
    stepsWrap: $('#stepsWrap'), equationWrap: $('#equationWrap'), chartWrap: $('#chartWrap'),
    assumptionsCard: $('#assumptions-card'), assumptionsWrap: $('#assumptionsWrap'),
    conclusionCard: $('#conclusion-card'), conclusionWrap: $('#conclusionWrap'),
  };

  el.incVar.addEventListener('click', () => { el.varCount.value = Math.min(6, (parseInt(el.varCount.value, 10) || 1) + 1); });
  el.decVar.addEventListener('click', () => { el.varCount.value = Math.max(1, (parseInt(el.varCount.value, 10) || 1) - 1); });

  el.buildTableBtn.addEventListener('click', () => {
    const k = parseInt(el.varCount.value, 10);
    hideError(el.setupError);
    if (!Number.isInteger(k) || k < 1 || k > 6) {
      showError(el.setupError, 'Jumlah variabel X harus berupa bilangan bulat antara 1 dan 6.');
      return;
    }
    state.k = k; state.minRows = k + 2;
    el.minRowsHint.textContent = state.minRows;
    buildDataTable(k, Math.max(state.minRows, 4));
    el.dataCard.hidden = false;
    el.resultsCard.hidden = true;
    el.assumptionsCard.hidden = true;
    el.conclusionCard.hidden = true;
    el.dataCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function buildDataTable(k, rowCount) {
    const headRow = document.createElement('tr');
    headRow.innerHTML = '<th>No</th><th>Y</th>' + Array.from({ length: k }, (_, i) => `<th>X${i + 1}</th>`).join('');
    el.tableHead.innerHTML = '';
    el.tableHead.appendChild(headRow);
    el.tableBody.innerHTML = '';
    for (let r = 0; r < rowCount; r++) addRow();
  }

  function addRow() {
    const k = state.k;
    const tr = document.createElement('tr');
    const rowNumTd = document.createElement('td');
    rowNumTd.className = 'rownum';
    tr.appendChild(rowNumTd);
    const yTd = document.createElement('td');
    yTd.innerHTML = `<input type="text" inputmode="decimal" data-role="Y" placeholder="Y">`;
    tr.appendChild(yTd);
    for (let j = 0; j < k; j++) {
      const xTd = document.createElement('td');
      xTd.innerHTML = `<input type="text" inputmode="decimal" data-role="X" data-col="${j}" placeholder="X${j + 1}">`;
      tr.appendChild(xTd);
    }
    el.tableBody.appendChild(tr);
    renumberRows();
  }

  function removeRow() {
    const rows = el.tableBody.rows;
    if (rows.length <= Math.max(state.minRows, 1)) return;
    el.tableBody.deleteRow(rows.length - 1);
    renumberRows();
  }

  function renumberRows() {
    $$('#dataTableBody tr').forEach((tr, i) => { tr.querySelector('.rownum').textContent = i + 1; });
  }

  el.addRowBtn.addEventListener('click', addRow);
  el.removeRowBtn.addEventListener('click', removeRow);

  el.fillSampleBtn.addEventListener('click', () => {
    const k = state.k;
    const sample = generateSampleData(k, Math.max(state.minRows, 6));
    buildDataTable(k, sample.Y.length);
    const rows = $$('#dataTableBody tr');
    rows.forEach((tr, i) => {
      tr.querySelector('input[data-role="Y"]').value = sample.Y[i];
      $$('input[data-role="X"]', tr).forEach((inp, j) => { inp.value = sample.X[i][j]; });
    });
  });

  function generateSampleData(k, n) {
    const X = [], Y = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < k; j++) row.push(Math.round((i + 1) * (2 + j * 0.7) + ((i * (j + 1)) % 3) * 1.3));
      X.push(row);
      let y = 12;
      row.forEach((x, j) => { y += (3 - j * 0.6) * x; });
      y += (i % 2 === 0 ? 2 : -2);
      Y.push(Math.round(y * 10) / 10);
    }
    return { X, Y };
  }

  /* ---------- Fungsi distribusi statistik (untuk uji t, uji F, dan uji asumsi) ---------- */
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
  /* p-value (upper-tail) untuk statistik uji F dengan derajat bebas df1, df2 */
  function fUpperP(F, df1, df2) {
    if (!Number.isFinite(F) || F < 0 || df1 <= 0 || df2 <= 0) return NaN;
    return betai(df2 / (df2 + df1 * F), df2 / 2, df1 / 2);
  }
  /* p-value (upper-tail) chi-square dengan df = 2 -> bentuk tertutup: 1 - CDF = exp(-x/2) */
  function chiSq2UpperP(x) { return Math.exp(-x / 2); }

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
  function matToText(M, d = 4) {
    const strs = M.map((row) => row.map((v) => fmt(v, d)));
    const cols = strs[0].length;
    const widths = [];
    for (let c = 0; c < cols; c++) widths[c] = Math.max(...strs.map((r) => r[c].length));
    return strs.map((r) => '[ ' + r.map((v, c) => v.padStart(widths[c])).join('  ') + ' ]').join('\n');
  }

  function runRegression(Y, X, k) { return k === 1 ? runSimple(Y, X.map((r) => r[0])) : runMultiple(Y, X, k); }

  function runSimple(Y, X) {
    const n = Y.length;
    const sumX = X.reduce((a, b) => a + b, 0), sumY = Y.reduce((a, b) => a + b, 0);
    const sumXY = X.reduce((s, x, i) => s + x * Y[i], 0);
    const sumX2 = X.reduce((s, x) => s + x * x, 0), sumY2 = Y.reduce((s, y) => s + y * y, 0);
    const denomX = n * sumX2 - sumX * sumX;
    if (Math.abs(denomX) < 1e-9) {
      throw new Error('Seluruh nilai X sama (tidak ada variasi), sehingga koefisien regresi tidak dapat dihitung. Pastikan nilai X pada data bervariasi.');
    }
    const b1 = (n * sumXY - sumX * sumY) / denomX;
    const b0 = (sumY - b1 * sumX) / n;
    const rNumerator = n * sumXY - sumX * sumY;
    const rDenominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const r = rDenominator !== 0 ? rNumerator / rDenominator : NaN;
    const Yhat = X.map((x) => b0 + b1 * x);
    const meanY = sumY / n;
    const SST = Y.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const SSE = Y.reduce((s, y, i) => s + (y - Yhat[i]) ** 2, 0);
    const SSR = SST - SSE;
    const R2 = SST !== 0 ? SSR / SST : NaN;
    const df = n - 2;
    const Se = df > 0 ? Math.sqrt(SSE / df) : NaN;
    const adjR2 = df > 0 ? 1 - (1 - R2) * (n - 1) / df : NaN;
    const Sxx = sumX2 - (sumX * sumX) / n;
    const meanX = sumX / n;
    const SEb1 = df > 0 && Sxx > 0 ? Se / Math.sqrt(Sxx) : NaN;
    const SEb0 = df > 0 && Sxx > 0 ? Se * Math.sqrt(1 / n + (meanX * meanX) / Sxx) : NaN;
    const steps = buildSimpleSteps({ n, sumX, sumY, sumXY, sumX2, sumY2, b0, b1, r, R2, SST, SSE, SSR, Se, adjR2, df });
    return { k: 1, n, beta: [b0, b1], SEbeta: [SEb0, SEb1], Yhat, residuals: Y.map((y, i) => y - Yhat[i]), SST, SSE, SSR, R2, adjR2, Se, r, df, sumsTable: { sumX, sumY, sumXY, sumX2, sumY2 }, steps };
  }

  function buildSimpleSteps(v) {
    const steps = [];
    steps.push({ title: 'Hitung jumlah (\u03A3) yang diperlukan', formula: `n = ${v.n},  \u03A3X = ${fmt(v.sumX)},  \u03A3Y = ${fmt(v.sumY)},  \u03A3XY = ${fmt(v.sumXY)},  \u03A3X\u00B2 = ${fmt(v.sumX2)},  \u03A3Y\u00B2 = ${fmt(v.sumY2)}`, note: 'Nilai-nilai ini diambil langsung dari tabel bantu pada tab sebelumnya.' });
    steps.push({ title: 'Hitung koefisien arah (slope) b', formula: `b = (n\u00B7\u03A3XY \u2212 \u03A3X\u00B7\u03A3Y) / (n\u00B7\u03A3X\u00B2 \u2212 (\u03A3X)\u00B2)\n  = (${v.n}\u00B7${fmt(v.sumXY)} \u2212 ${fmt(v.sumX)}\u00B7${fmt(v.sumY)}) / (${v.n}\u00B7${fmt(v.sumX2)} \u2212 (${fmt(v.sumX)})\u00B2)\n  = ${fmt(v.b1)}` });
    steps.push({ title: 'Hitung konstanta (intercept) a', formula: `a = (\u03A3Y \u2212 b\u00B7\u03A3X) / n\n  = (${fmt(v.sumY)} \u2212 ${fmt(v.b1)}\u00B7${fmt(v.sumX)}) / ${v.n}\n  = ${fmt(v.b0)}` });
    steps.push({ title: 'Susun persamaan regresi', formula: `\u0176 = a + bX = ${fmt(v.b0)} ${v.b1 >= 0 ? '+' : '\u2212'} ${fmt(Math.abs(v.b1))}X` });
    steps.push({ title: 'Hitung koefisien korelasi r', formula: `r = (n\u00B7\u03A3XY \u2212 \u03A3X\u00B7\u03A3Y) / \u221A[(n\u00B7\u03A3X\u00B2 \u2212 (\u03A3X)\u00B2)(n\u00B7\u03A3Y\u00B2 \u2212 (\u03A3Y)\u00B2)]\n  = ${fmt(v.r)}`, note: interpretR(v.r) });
    steps.push({ title: 'Hitung koefisien determinasi R\u00B2', formula: `R\u00B2 = r\u00B2 = ${fmt(v.R2)}   (\u2248 ${fmt(v.R2 * 100, 2)}%)`, note: `Artinya sekitar ${fmt(v.R2 * 100, 2)}% variasi Y dapat dijelaskan oleh X, sisanya (${fmt((1 - v.R2) * 100, 2)}%) dijelaskan faktor lain di luar model.` });
    steps.push({ title: 'Hitung galat baku taksiran (Se)', formula: `SSE = \u03A3Y\u00B2 \u2212 a\u00B7\u03A3Y \u2212 b\u00B7\u03A3XY = ${fmt(v.SSE)}\nSe = \u221A[SSE / (n \u2212 2)] = \u221A[${fmt(v.SSE)} / ${v.df}] = ${fmt(v.Se)}` });
    return steps;
  }

  function runMultiple(Y, X, k) {
    const n = Y.length;
    const Xd = X.map((row) => [1, ...row]);
    const Yc = Y.map((y) => [y]);
    const Xt = transpose(Xd);
    const XtX = matMul(Xt, Xd);
    const XtY = matMul(Xt, Yc);
    const XtXinv = invertMatrix(XtX);
    const beta = matMul(XtXinv, XtY).map((r) => r[0]);
    const Yhat = Xd.map((row) => row.reduce((s, x, j) => s + x * beta[j], 0));
    const meanY = Y.reduce((a, b) => a + b, 0) / n;
    const SST = Y.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const SSE = Y.reduce((s, y, i) => s + (y - Yhat[i]) ** 2, 0);
    const SSR = SST - SSE;
    const R2 = SST !== 0 ? SSR / SST : NaN;
    const df = n - k - 1;
    const Se = df > 0 ? Math.sqrt(SSE / df) : NaN;
    const adjR2 = df > 0 ? 1 - (1 - R2) * (n - 1) / df : NaN;
    const SEbeta = df > 0 ? beta.map((b, j) => Se * Math.sqrt(Math.max(XtXinv[j][j], 0))) : beta.map(() => NaN);
    const steps = buildMultipleSteps({ n, k, Xd, Yc, XtX, XtY, XtXinv, beta, R2, SST, SSE, SSR, Se, adjR2, df });
    return { k, n, beta, SEbeta, Yhat, residuals: Y.map((y, i) => y - Yhat[i]), SST, SSE, SSR, R2, adjR2, Se, df, steps };
  }

  function buildMultipleSteps(v) {
    const steps = [];
    steps.push({ title: 'Susun matriks desain X (+ kolom 1 untuk intercept) dan vektor Y', matrix: `X (${v.n}\u00D7${v.k + 1}) =\n${matToText(v.Xd, 2)}\n\nY (${v.n}\u00D71) =\n${matToText(v.Yc, 2)}`, note: 'Kolom pertama matriks X berisi angka 1 untuk mewakili koefisien konstanta (b0).' });
    steps.push({ title: 'Hitung X\u1D40X dan X\u1D40Y', matrix: `X\u1D40X =\n${matToText(v.XtX, 3)}\n\nX\u1D40Y =\n${matToText(v.XtY, 3)}` });
    steps.push({ title: 'Hitung invers (X\u1D40X)\u207B\u00B9 dengan eliminasi Gauss-Jordan', matrix: `(X\u1D40X)\u207B\u00B9 =\n${matToText(v.XtXinv, 5)}`, note: 'Matriks identitas dipasang di sisi kanan X\u1D40X, lalu operasi baris dilakukan hingga sisi kiri menjadi identitas \u2014 sisi kanan yang tersisa adalah inversnya.' });
    steps.push({ title: 'Hitung koefisien \u03B2 = (X\u1D40X)\u207B\u00B9 \u00B7 X\u1D40Y', formula: v.beta.map((b, i) => `b${i} = ${fmt(b, 5)}`).join('\n') });
    steps.push({ title: 'Susun persamaan regresi', formula: buildEquationString(v.beta) });
    steps.push({ title: 'Hitung SST, SSE, SSR, R\u00B2, dan Se', formula: `SST = \u03A3(Y \u2212 \u0232)\u00B2 = ${fmt(v.SST)}\nSSE = \u03A3(Y \u2212 \u0176)\u00B2 = ${fmt(v.SSE)}\nSSR = SST \u2212 SSE = ${fmt(v.SSR)}\nR\u00B2 = SSR / SST = ${fmt(v.R2)}  (\u2248 ${fmt(v.R2 * 100, 2)}%)\nSe = \u221A[SSE / (n \u2212 k \u2212 1)] = \u221A[${fmt(v.SSE)} / ${v.df}] = ${fmt(v.Se)}`, note: `Sekitar ${fmt(v.R2 * 100, 2)}% variasi Y dijelaskan bersama-sama oleh seluruh variabel X dalam model.` });
    return steps;
  }

  function buildEquationString(beta) {
    let eq = `\u0176 = ${fmt(beta[0])}`;
    for (let j = 1; j < beta.length; j++) eq += ` ${beta[j] >= 0 ? '+' : '\u2212'} ${fmt(Math.abs(beta[j]))}X${j}`;
    return eq;
  }

  function interpretR(r) {
    const a = Math.abs(r);
    let strength;
    if (a < 0.2) strength = 'sangat lemah'; else if (a < 0.4) strength = 'lemah'; else if (a < 0.6) strength = 'sedang'; else if (a < 0.8) strength = 'kuat'; else strength = 'sangat kuat';
    const dir = r >= 0 ? 'positif' : 'negatif';
    return `Hubungan antara X dan Y tergolong ${strength} dan ${dir} (r = ${fmt(r)}).`;
  }

  function collectData() {
    const k = state.k;
    const rows = $$('#dataTableBody tr');
    const Y = [], X = [];
    const problems = [];
    $$('#dataTableBody input').forEach((inp) => inp.classList.remove('invalid'));
    rows.forEach((tr, i) => {
      const yInput = tr.querySelector('input[data-role="Y"]');
      const yRaw = yInput.value.trim().replace(',', '.');
      const yVal = parseFloat(yRaw);
      if (yRaw === '' || Number.isNaN(yVal)) { problems.push(`Baris ${i + 1}: nilai Y kosong atau bukan angka.`); yInput.classList.add('invalid'); }
      const xRow = [];
      $$('input[data-role="X"]', tr).forEach((inp, j) => {
        const raw = inp.value.trim().replace(',', '.');
        const val = parseFloat(raw);
        if (raw === '' || Number.isNaN(val)) { problems.push(`Baris ${i + 1}: nilai X${j + 1} kosong atau bukan angka.`); inp.classList.add('invalid'); }
        xRow.push(val);
      });
      Y.push(yVal); X.push(xRow);
    });
    if (problems.length) return { error: problems.slice(0, 6).join(' ') + (problems.length > 6 ? ' \u2026' : '') };
    if (Y.length < state.minRows) return { error: `Minimal ${state.minRows} baris data diperlukan untuk ${k} variabel X (agar derajat bebas tersisa untuk pengujian).` };
    return { Y, X, k };
  }

  el.calcBtn.addEventListener('click', () => {
    hideError(el.dataError);
    const data = collectData();
    if (data.error) { showError(el.dataError, data.error); return; }
    let result;
    try { result = runRegression(data.Y, data.X, data.k); }
    catch (err) { showError(el.dataError, err.message); return; }
    renderResults(result, data);
    el.resultsCard.hidden = false;
    renderAssumptions(result, data);
    el.assumptionsCard.hidden = false;
    renderConclusion(result, data);
    el.conclusionCard.hidden = false;
    exportRegresi(result, data);
    el.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
  });

  function renderResults(res, data) {
    renderSumsTable(res, data);
    renderSteps(res);
    renderEquation(res, data);
    renderChart(res, data);
    $$('.tab-btn', $('#view-regresi')).forEach((b) => b.classList.remove('active'));
    $$('.tab-panel', $('#view-regresi')).forEach((p) => p.classList.remove('active'));
    $('.tab-btn[data-tab="tab-table"]').classList.add('active');
    $('#tab-table').classList.add('active');
  }

  function renderSumsTable(res, data) {
    const { Y, X, k } = data;
    const n = Y.length;
    let html = '';
    if (k === 1) {
      html += `<table class="result-table"><caption>Tabel bantu perhitungan (n = ${n})</caption><thead><tr><th>No</th><th>X</th><th>Y</th><th>X\u00B7Y</th><th>X\u00B2</th><th>Y\u00B2</th></tr></thead><tbody>`;
      X.forEach((row, i) => {
        const x = row[0], y = Y[i];
        html += `<tr><td>${i + 1}</td><td>${fmt(x, 2)}</td><td>${fmt(y, 2)}</td><td>${fmt(x * y, 2)}</td><td>${fmt(x * x, 2)}</td><td>${fmt(y * y, 2)}</td></tr>`;
      });
      const s = res.sumsTable;
      html += `</tbody><tfoot><tr><td>\u03A3</td><td>${fmt(s.sumX, 2)}</td><td>${fmt(s.sumY, 2)}</td><td>${fmt(s.sumXY, 2)}</td><td>${fmt(s.sumX2, 2)}</td><td>${fmt(s.sumY2, 2)}</td></tr></tfoot></table>`;
    } else {
      html += `<table class="result-table"><caption>Data observasi &amp; prediksi (n = ${n})</caption><thead><tr><th>No</th><th>Y</th>${Array.from({ length: k }, (_, j) => `<th>X${j + 1}</th>`).join('')}<th>\u0176</th><th>Y \u2212 \u0176</th></tr></thead><tbody>`;
      Y.forEach((y, i) => { html += `<tr><td>${i + 1}</td><td>${fmt(y, 2)}</td>${X[i].map((x) => `<td>${fmt(x, 2)}</td>`).join('')}<td>${fmt(res.Yhat[i], 3)}</td><td>${fmt(res.residuals[i], 3)}</td></tr>`; });
      html += `</tbody></table>`;
    }
    el.sumsTableWrap.innerHTML = html;
  }

  function renderSteps(res) {
    el.stepsWrap.innerHTML = res.steps.map((s, i) => {
      const parts = [`<h4>${escapeHTML(s.title)}</h4>`];
      if (s.formula) parts.push(`<span class="formula">${escapeHTML(s.formula)}</span>`);
      if (s.matrix) parts.push(`<div class="matrix">${escapeHTML(s.matrix)}</div>`);
      if (s.note) parts.push(`<p>${escapeHTML(s.note)}</p>`);
      return `<div class="step-block" data-step="${i + 1}">${parts.join('')}</div>`;
    }).join('');
  }

  function renderEquation(res, data) {
    const k = res.k;
    const eqStr = k === 1 ? `\u0176 = ${fmt(res.beta[0])} ${res.beta[1] >= 0 ? '+' : '\u2212'} ${fmt(Math.abs(res.beta[1]))}X` : buildEquationString(res.beta);
    let html = `<div class="equation-box"><div class="label">Persamaan Regresi</div><div class="eq">${escapeHTML(eqStr)}</div></div>`;
    html += `<div class="stat-grid">`;
    html += statCard('n (jumlah data)', res.n);
    if (k === 1) html += statCard('r (korelasi)', fmt(res.r));
    else html += statCard('R (korelasi ganda)', fmt(Math.sqrt(Math.max(res.R2, 0))));
    html += statCard('R\u00B2', fmt(res.R2));
    html += statCard('R\u00B2 (%)', fmt(res.R2 * 100, 2) + '%');
    html += statCard('Adjusted R\u00B2', fmt(res.adjR2));
    html += statCard('Se (galat baku)', fmt(res.Se));
    html += statCard('Derajat bebas', res.df);
    html += `</div>`;
    html += `<div class="interpretation">${buildInterpretation(res, data)}</div>`;
    html += renderSignificanceTests(res, data);
    el.equationWrap.innerHTML = html;
  }

  /* ---------- Uji Signifikansi: Uji F (simultan) & Uji t (parsial), lengkap dengan hipotesis ---------- */
  function computeSignificanceTests(res, data) {
    const k = res.k, df = res.df;
    const F = (df > 0 && res.SSE > 0) ? (res.SSR / k) / (res.SSE / df) : NaN;
    const df1 = k, df2 = df;
    const pF = fUpperP(F, df1, df2);
    const fTest = { F, df1, df2, p: pF, significant: Number.isFinite(pF) ? pF < 0.05 : false };

    const varNames = k === 1 ? ['X'] : data.varNames || Array.from({ length: k }, (_, i) => `X${i + 1}`);
    const tTests = res.beta.map((b, j) => {
      const se = res.SEbeta[j];
      const t = se > 0 ? b / se : NaN;
      const p = tTwoTailedP(t, df);
      const name = j === 0 ? (k === 1 ? 'a (konstanta)' : 'b0 (konstanta)') : (k === 1 ? 'b' : `b${j}`) + ` (${varNames[j - 1]})`;
      return { name, b, se, t, p, significant: Number.isFinite(p) ? p < 0.05 : false };
    });
    return { fTest, tTests };
  }

  function renderSignificanceTests(res, data) {
    if (!(res.df > 0)) {
      return `<div class="test-block"><h4>Uji Signifikansi</h4><p class="test-note">Derajat bebas tidak mencukupi untuk melakukan uji signifikansi &mdash; tambahkan lebih banyak data.</p></div>`;
    }
    const { fTest, tTests } = computeSignificanceTests(res, data);
    let html = '';

    // ---- Tabel ANOVA Regresi ----
    const MSR = fTest.df1 > 0 ? res.SSR / fTest.df1 : NaN;
    const MSE = fTest.df2 > 0 ? res.SSE / fTest.df2 : NaN;
    html += `<div class="test-block">
      <h4>Tabel ANOVA Regresi</h4>
      <p class="test-sub">Rincian sumber variasi yang mendasari Uji F di bawah: variasi Y dipecah menjadi variasi yang dijelaskan model (Regresi) dan variasi yang tidak dijelaskan (Residual).</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Sumber Variasi</th><th>JK (SS)</th><th>db (df)</th><th>KT (MS)</th><th>F hitung</th><th>Sig.</th></tr></thead>
        <tbody>
          <tr><td>Regresi</td><td>${fmt(res.SSR)}</td><td>${fTest.df1}</td><td>${fmt(MSR)}</td><td>${fmt(fTest.F)}</td><td>${fmt(fTest.p, 4)}</td></tr>
          <tr><td>Residual</td><td>${fmt(res.SSE)}</td><td>${fTest.df2}</td><td>${fmt(MSE)}</td><td>&mdash;</td><td>&mdash;</td></tr>
          <tr><td>Total</td><td>${fmt(res.SST)}</td><td>${fTest.df1 + fTest.df2}</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>
        </tbody>
      </table></div>
      <p class="test-note">JK Regresi (SSR) = variasi Y yang dijelaskan model; JK Residual (SSE) = variasi Y yang tidak dijelaskan model (galat); JK Total (SST) = SSR + SSE. F hitung = KT Regresi &divide; KT Residual.</p>
    </div>`;

    // ---- Uji F (simultan) ----
    html += `<div class="test-block">
      <h4>Uji F (Simultan)</h4>
      <p class="test-sub">Menguji apakah seluruh variabel X secara bersama-sama berpengaruh signifikan terhadap Y.</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">b1 = b2 = ... = b${res.k} = 0 &mdash; secara bersama-sama, variabel X tidak berpengaruh signifikan terhadap Y.</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">minimal ada satu bj &ne; 0 &mdash; secara bersama-sama, variabel X berpengaruh signifikan terhadap Y.</span></div>
      </div>
      <div class="test-stat-row">
        ${statCard('F hitung', fmt(fTest.F))}
        ${statCard('df1, df2', `${fTest.df1}, ${fTest.df2}`)}
        ${statCard('Sig. (p-value)', fmt(fTest.p, 4))}
      </div>
      <div class="test-verdict ${fTest.significant ? 'ok' : 'bad'}">${fTest.significant ? 'Signifikan (p &lt; 0.05)' : 'Tidak Signifikan (p &ge; 0.05)'}</div>
      <p class="test-conclusion">${fTest.significant
        ? 'Karena nilai signifikansi &lt; 0.05, H0 ditolak. Artinya, secara bersama-sama variabel X berpengaruh signifikan terhadap Y pada taraf signifikansi 5%.'
        : 'Karena nilai signifikansi &ge; 0.05, H0 gagal ditolak. Artinya, secara bersama-sama variabel X belum terbukti berpengaruh signifikan terhadap Y pada taraf signifikansi 5%.'}</p>
    </div>`;

    // ---- Uji t (parsial) ----
    let rows = tTests.map((tt) => `<tr>
        <td>${escapeHTML(tt.name)}</td>
        <td>${fmt(tt.b, 4)}</td>
        <td>${fmt(tt.se, 4)}</td>
        <td>${fmt(tt.t, 4)}</td>
        <td>${fmt(tt.p, 4)}</td>
        <td class="${tt.significant ? 'ok' : 'bad'}">${tt.significant ? 'Signifikan' : 'Tidak Sig.'}</td>
      </tr>`).join('');
    const slopeTests = tTests.slice(1);
    const anySig = slopeTests.some((t) => t.significant);
    html += `<div class="test-block">
      <h4>Uji t (Parsial)</h4>
      <p class="test-sub">Menguji apakah tiap variabel X secara individu (parsial) berpengaruh signifikan terhadap Y, dengan variabel lain dianggap tetap.</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">bj = 0 &mdash; variabel Xj secara parsial tidak berpengaruh signifikan terhadap Y.</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">bj &ne; 0 &mdash; variabel Xj secara parsial berpengaruh signifikan terhadap Y.</span></div>
      </div>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Koefisien</th><th>b</th><th>Se(b)</th><th>t hitung</th><th>Sig.</th><th>Keputusan</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="test-conclusion">${anySig
        ? 'Pada taraf signifikansi 5% (p &lt; 0.05), koefisien dengan status "Signifikan" pada tabel di atas menunjukkan H0 ditolak &mdash; variabel tersebut terbukti berpengaruh secara parsial terhadap Y. Koefisien dengan status "Tidak Sig." berarti H0 gagal ditolak untuk variabel tersebut.'
        : 'Pada taraf signifikansi 5% (p &ge; 0.05), seluruh koefisien memiliki status "Tidak Sig.", sehingga H0 gagal ditolak untuk semua variabel &mdash; belum ada variabel X yang terbukti berpengaruh signifikan secara parsial terhadap Y.'}</p>
      <p class="test-note">Kolom "b" untuk baris konstanta biasanya tidak diinterpretasikan sebagai pengaruh suatu variabel, karena mewakili nilai Y saat seluruh X = 0.</p>
    </div>`;

    return html;
  }


  /* =========================================================================
     EKSPOR .docx + GRAFIK PENDUKUNG (lihat Method/Shared/export-hasil.js)
     ========================================================================= */
  function exportRegresi(res, data) {
    try {
      const SC = window.StatCharts, SE = window.StatExport, GU = window.GraphCore && window.GraphCore.u;
      if (!SC || !SE || !GU) return;
      const k = res.k, n = res.n, Y = data.Y, fit = res.Yhat, e = res.residuals;
      const sdE = GU.sd(e) || 1;
      const std = e.map((v) => v / sdE);
      const charts = [];
      if (k === 1) {
        const X = data.X.map((r) => r[0]);
        charts.push({ title: 'Diagram pencar dan garis regresi', caption: 'Titik = data pengamatan; garis = ' + buildEquationString(res.beta) + '.', build: () => SC.scatter({ title: 'Diagram Pencar & Garis Regresi', xLabel: 'X', yLabel: 'Y', x: X, y: Y, fit: { a: res.beta[0], b: res.beta[1], name: buildEquationString(res.beta) } }) });
      } else {
        charts.push({ title: 'Y aktual vs Y prediksi', caption: 'Titik yang dekat garis diagonal menandakan prediksi model yang akurat (R\u00B2 = ' + fmt(res.R2) + ').', build: () => SC.scatter({ title: 'Y Aktual vs Y Prediksi', xLabel: 'Y prediksi (\u0176)', yLabel: 'Y aktual', x: fit, y: Y, diag: true }) });
        for (let j = 0; j < k; j++) {
          const xj = data.X.map((r) => r[j]), lr = GU.linreg(xj, Y);
          charts.push({ title: 'Y terhadap X' + (j + 1), caption: 'Hubungan bivariat apa adanya (r = ' + fmt(lr.r) + '); belum mengendalikan variabel X lain.', build: () => SC.scatter({ title: 'Y terhadap X' + (j + 1), xLabel: 'X' + (j + 1), yLabel: 'Y', x: xj, y: Y, fit: { a: lr.a, b: lr.b, name: 'Garis tren bivariat' } }) });
        }
      }
      charts.push(
        { title: 'Residual vs nilai prediksi', caption: 'Titik yang tersebar acak di sekitar nol mendukung asumsi linearitas dan homoskedastisitas; pola corong atau lengkung adalah tanda masalah.', build: () => SC.scatter({ title: 'Residual vs Nilai Prediksi', xLabel: 'Nilai prediksi (\u0176)', yLabel: 'Residual', x: fit, y: e, hzero: true }) },
        { title: 'Q-Q plot residual', caption: 'Titik yang mengikuti garis mendukung asumsi residual berdistribusi normal.', build: () => SC.qq(std, { title: 'Q-Q Plot Residual', yLabel: 'Residual terstandar' }) },
        { title: 'Histogram residual', caption: 'Bentuk mendekati kurva normal mendukung asumsi normalitas.', build: () => SC.hist(e, { title: 'Histogram Residual', xLabel: 'Residual' }) },
        { title: 'Residual menurut urutan pengamatan', caption: 'Pola naik-turun yang teratur (bukan acak) mengisyaratkan autokorelasi.', build: () => SC.bars({ title: 'Residual menurut Urutan Pengamatan', xLabel: 'Pengamatan ke-', yLabel: 'Residual', labels: e.map((_, i) => i + 1), values: e, color: '#22384A' }) }
      );
      const head = ['Y'].concat(Array.from({ length: k }, (_, j) => 'X' + (j + 1)));
      SE.publish({
        id: 'regresi', title: k === 1 ? 'Hasil Regresi Linear Sederhana' : 'Hasil Regresi Linear Berganda', anchor: '#conclusion-card', resultsCard: '#results-card',
        meta: [['Jenis analisis', k === 1 ? 'Regresi linear sederhana (1 variabel X)' : 'Regresi linear berganda (' + k + ' variabel X)'], ['Jumlah pengamatan (n)', n], ['Persamaan regresi', buildEquationString(res.beta)],
          ['R\u00B2', fmt(res.R2)], ['R\u00B2 adjusted', fmt(res.adjR2)], ['Galat baku estimasi (Se)', fmt(res.Se)], ['Derajat bebas galat', res.df]],
        sections: [
          { heading: 'Tabel Bantu', sel: '#sumsTableWrap' }, { heading: 'Langkah Perhitungan', sel: '#stepsWrap' },
          { heading: 'Persamaan & Uji Signifikansi', sel: '#equationWrap' }, { heading: 'Uji Asumsi Regresi', sel: '#assumptionsWrap' }, { heading: 'Kesimpulan Model', sel: '#conclusionWrap' },
        ],
        data: { head, rows: Y.map((y, i) => [y].concat(data.X[i])), caption: 'Data pengamatan yang dipakai pada perhitungan.' },
        charts,
      });
    } catch (err) { console.warn('Ekspor Regresi:', err); }
  }

  function statCard(label, value) { return `<div class="stat-card"><div class="k">${escapeHTML(label)}</div><div class="v">${escapeHTML(String(value))}</div></div>`; }

  function buildInterpretation(res, data) {
    const k = res.k;
    const paras = [];
    if (k === 1) {
      const b0 = res.beta[0], b1 = res.beta[1];
      paras.push(`<p><strong>Konstanta (a = ${fmt(b0)})</strong> berarti apabila nilai X sama dengan 0, maka nilai Y yang diprediksi adalah sebesar ${fmt(b0)}.</p>`);
      paras.push(`<p><strong>Koefisien arah (b = ${fmt(b1)})</strong> menunjukkan bahwa setiap kenaikan 1 satuan pada X akan ${b1 >= 0 ? 'menaikkan' : 'menurunkan'} nilai Y rata-rata sebesar ${fmt(Math.abs(b1))} satuan, dengan asumsi faktor lain tetap.</p>`);
      paras.push(`<p>${interpretR(res.r)} Koefisien determinasi R\u00B2 = ${fmt(res.R2)} menunjukkan bahwa ${fmt(res.R2 * 100, 2)}% variasi Y mampu dijelaskan oleh X, sedangkan sisanya ${fmt((1 - res.R2) * 100, 2)}% dijelaskan oleh variabel atau faktor lain di luar model ini.</p>`);
    } else {
      paras.push(`<p><strong>Konstanta (b0 = ${fmt(res.beta[0])})</strong> adalah nilai Y yang diprediksi apabila seluruh variabel X bernilai 0.</p>`);
      for (let j = 1; j < res.beta.length; j++) {
        const b = res.beta[j];
        paras.push(`<p><strong>b${j} = ${fmt(b)}</strong> \u2014 setiap kenaikan 1 satuan pada X${j}, dengan variabel X lainnya dianggap tetap (ceteris paribus), akan ${b >= 0 ? 'menaikkan' : 'menurunkan'} Y rata-rata sebesar ${fmt(Math.abs(b))} satuan.</p>`);
      }
      paras.push(`<p>Koefisien determinasi R\u00B2 = ${fmt(res.R2)} menunjukkan bahwa ${fmt(res.R2 * 100, 2)}% variasi Y dapat dijelaskan secara bersama-sama oleh seluruh variabel X dalam model, sedangkan Adjusted R\u00B2 = ${fmt(res.adjR2)} sudah memperhitungkan jumlah variabel bebas yang digunakan.</p>`);
    }
    return paras.join('');
  }

  /* =========================================================================
     UJI ASUMSI KLASIK (Langkah 4): Normalitas, Multikolinearitas,
     Heteroskedastisitas, Autokorelasi — lengkap dengan hipotesis H0/H1.
     ========================================================================= */

  function computeNormalityTest(res) {
    const e = res.residuals, n = e.length;
    const mean = e.reduce((a, b) => a + b, 0) / n;
    const m2 = e.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const m3 = e.reduce((s, v) => s + (v - mean) ** 3, 0) / n;
    const m4 = e.reduce((s, v) => s + (v - mean) ** 4, 0) / n;
    const sd = Math.sqrt(m2);
    const skew = sd > 0 ? m3 / (sd ** 3) : 0;
    const kurt = sd > 0 ? m4 / (sd ** 4) : 3;
    const JB = (n / 6) * (skew ** 2 + ((kurt - 3) ** 2) / 4);
    const p = chiSq2UpperP(JB);
    return { JB, skew, kurt, p, normal: p >= 0.05 };
  }

  function computeVIF(data, res) {
    const k = res.k;
    if (k < 2) return null;
    const varNames = Array.from({ length: k }, (_, i) => `X${i + 1}`);
    const rows = [];
    for (let j = 0; j < k; j++) {
      const Yj = data.X.map((r) => r[j]);
      const otherX = data.X.map((r) => r.filter((_, idx) => idx !== j));
      let Rj2;
      try {
        const sub = otherX[0].length === 1
          ? runSimple(Yj, otherX.map((r) => r[0]))
          : runMultiple(Yj, otherX, otherX[0].length);
        Rj2 = sub.R2;
      } catch (err) { Rj2 = NaN; }
      const VIF = (Number.isFinite(Rj2) && Rj2 < 1) ? 1 / (1 - Rj2) : Infinity;
      const tolerance = 1 - Rj2;
      rows.push({ name: varNames[j], Rj2, VIF, tolerance, problematic: VIF > 10 });
    }
    return rows;
  }

  function computeHeteroscedasticity(res, data) {
    const absE = res.residuals.map((e) => Math.abs(e));
    let aux;
    try { aux = res.k === 1 ? runSimple(absE, data.X.map((r) => r[0])) : runMultiple(absE, data.X, res.k); }
    catch (err) { return null; }
    const varNames = res.k === 1 ? ['X'] : Array.from({ length: res.k }, (_, i) => `X${i + 1}`);
    const rows = aux.beta.slice(1).map((b, j) => {
      const se = aux.SEbeta[j + 1];
      const t = se > 0 ? b / se : NaN;
      const p = tTwoTailedP(t, aux.df);
      return { name: varNames[j], b, t, p, problematic: Number.isFinite(p) ? p < 0.05 : false };
    });
    const anyProblem = rows.some((r) => r.problematic);
    return { rows, anyProblem, df: aux.df };
  }

  function computeAutocorrelation(res) {
    const e = res.residuals, n = e.length;
    let num = 0, den = 0;
    for (let i = 1; i < n; i++) num += (e[i] - e[i - 1]) ** 2;
    for (let i = 0; i < n; i++) den += e[i] ** 2;
    const DW = den > 0 ? num / den : NaN;
    let verdict;
    if (!Number.isFinite(DW)) verdict = 'unknown';
    else if (DW < 1.5) verdict = 'positive';
    else if (DW > 2.5) verdict = 'negative';
    else verdict = 'none';
    return { DW, verdict };
  }

  function renderAssumptions(res, data) {
    if (!(res.df > 0)) {
      el.assumptionsWrap.innerHTML = `<div class="test-block"><h4>Uji Asumsi Regresi</h4><p class="test-note">Derajat bebas tidak mencukupi untuk melakukan uji asumsi &mdash; tambahkan lebih banyak data.</p></div>`;
      return;
    }
    let html = '';

    // ---- 1. Uji Normalitas Residual (Jarque-Bera) ----
    const norm = computeNormalityTest(res);
    html += `<div class="test-block">
      <h4>1. Uji Normalitas Residual (Jarque-Bera)</h4>
      <p class="test-sub">Menguji apakah residual (galat) model regresi berdistribusi normal &mdash; syarat agar uji t dan uji F valid.</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">Residual berdistribusi normal.</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">Residual tidak berdistribusi normal.</span></div>
      </div>
      <div class="test-stat-row">
        ${statCard('Statistik JB', fmt(norm.JB))}
        ${statCard('Skewness', fmt(norm.skew))}
        ${statCard('Kurtosis', fmt(norm.kurt))}
        ${statCard('Sig. (p-value)', fmt(norm.p, 4))}
      </div>
      <div class="test-verdict ${norm.normal ? 'ok' : 'bad'}">${norm.normal ? 'Normal (p &ge; 0.05)' : 'Tidak Normal (p &lt; 0.05)'}</div>
      <p class="test-conclusion">${norm.normal
        ? 'Karena nilai signifikansi &ge; 0.05, H0 gagal ditolak. Artinya, residual model regresi berdistribusi normal sehingga asumsi normalitas terpenuhi.'
        : 'Karena nilai signifikansi &lt; 0.05, H0 ditolak. Artinya, residual model regresi belum terbukti berdistribusi normal sehingga asumsi normalitas belum terpenuhi &mdash; pertimbangkan menambah data atau mentransformasi variabel.'}</p>
      <p class="test-note">Uji Jarque-Bera mengukur kemencengan (skewness) dan keruncingan (kurtosis) residual dibandingkan distribusi normal (skewness = 0, kurtosis = 3); statistik JB mengikuti distribusi Chi-Square dengan df = 2.</p>
    </div>`;

    // ---- 2. Uji Multikolinearitas (VIF) ----
    const vif = computeVIF(data, res);
    if (vif === null) {
      html += `<div class="test-block">
        <h4>2. Uji Multikolinearitas (VIF)</h4>
        <p class="test-sub">Uji ini hanya berlaku untuk regresi linear berganda (lebih dari 1 variabel X), karena mengukur korelasi antar variabel X.</p>
        <p class="test-note">Model Anda hanya memiliki 1 variabel X (regresi sederhana), sehingga uji multikolinearitas tidak relevan/tidak dapat dihitung.</p>
      </div>`;
    } else {
      const rows = vif.map((v) => `<tr>
          <td>${escapeHTML(v.name)}</td>
          <td>${fmt(v.Rj2, 4)}</td>
          <td>${fmt(v.tolerance, 4)}</td>
          <td class="${v.problematic ? 'bad' : 'ok'}">${Number.isFinite(v.VIF) ? fmt(v.VIF, 3) : '\u221E'}</td>
        </tr>`).join('');
      const anyProblem = vif.some((v) => v.problematic);
      html += `<div class="test-block">
        <h4>2. Uji Multikolinearitas (VIF)</h4>
        <p class="test-sub">Menguji apakah antar variabel X dalam model saling berkorelasi kuat (yang dapat membuat estimasi koefisien tidak stabil).</p>
        <div class="hyp-box">
          <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">Tidak terjadi multikolinearitas antar variabel X (VIF &le; 10).</span></div>
          <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">Terjadi multikolinearitas antar variabel X (VIF &gt; 10).</span></div>
        </div>
        <div class="table-scroll"><table class="mini-table">
          <thead><tr><th>Variabel</th><th>R\u00B2 (thd X lain)</th><th>Tolerance</th><th>VIF</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="test-verdict ${anyProblem ? 'bad' : 'ok'}">${anyProblem ? 'Terjadi Multikolinearitas' : 'Tidak Terjadi Multikolinearitas'}</div>
        <p class="test-conclusion">${anyProblem
          ? 'Ada variabel dengan VIF &gt; 10 (Tolerance &lt; 0.1), sehingga H0 ditolak &mdash; terdapat multikolinearitas yang cukup serius antar variabel X pada model ini.'
          : 'Seluruh variabel memiliki VIF &le; 10 (Tolerance &ge; 0.1), sehingga H0 gagal ditolak &mdash; tidak terjadi multikolinearitas yang serius antar variabel X pada model ini.'}</p>
      </div>`;
    }

    // ---- 3. Uji Heteroskedastisitas (Glejser) ----
    const hetero = computeHeteroscedasticity(res, data);
    if (hetero === null) {
      html += `<div class="test-block">
        <h4>3. Uji Heteroskedastisitas (Glejser)</h4>
        <p class="test-note">Uji ini tidak dapat dihitung untuk data saat ini.</p>
      </div>`;
    } else {
      const rows = hetero.rows.map((r) => `<tr>
          <td>${escapeHTML(r.name)}</td>
          <td>${fmt(r.b, 4)}</td>
          <td>${fmt(r.t, 4)}</td>
          <td>${fmt(r.p, 4)}</td>
          <td class="${r.problematic ? 'bad' : 'ok'}">${r.problematic ? 'Signifikan' : 'Tidak Sig.'}</td>
        </tr>`).join('');
      html += `<div class="test-block">
        <h4>3. Uji Heteroskedastisitas (Glejser)</h4>
        <p class="test-sub">Menguji apakah varians residual bersifat homogen (konstan) di setiap nilai X, dengan meregresikan nilai mutlak residual |e| terhadap tiap variabel X.</p>
        <div class="hyp-box">
          <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">Varians residual homogen (tidak terjadi heteroskedastisitas).</span></div>
          <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">Varians residual tidak homogen (terjadi heteroskedastisitas).</span></div>
        </div>
        <div class="table-scroll"><table class="mini-table">
          <thead><tr><th>Variabel</th><th>Koef. b</th><th>t hitung</th><th>Sig.</th><th>Keputusan</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="test-verdict ${hetero.anyProblem ? 'bad' : 'ok'}">${hetero.anyProblem ? 'Terjadi Heteroskedastisitas' : 'Tidak Terjadi Heteroskedastisitas'}</div>
        <p class="test-conclusion">${hetero.anyProblem
          ? 'Ada variabel yang berpengaruh signifikan terhadap |residual| (p &lt; 0.05), sehingga H0 ditolak &mdash; terindikasi terjadi heteroskedastisitas pada model ini.'
          : 'Tidak ada variabel yang berpengaruh signifikan terhadap |residual| (p &ge; 0.05 untuk semua), sehingga H0 gagal ditolak &mdash; varians residual cenderung homogen (tidak terjadi heteroskedastisitas).'}</p>
      </div>`;
    }

    // ---- 4. Uji Autokorelasi (Durbin-Watson) ----
    const dw = computeAutocorrelation(res);
    const dwLabel = { positive: 'Terindikasi Autokorelasi Positif', negative: 'Terindikasi Autokorelasi Negatif', none: 'Tidak Ada Autokorelasi', unknown: 'Tidak Dapat Ditentukan' }[dw.verdict];
    const dwOk = dw.verdict === 'none';
    html += `<div class="test-block">
      <h4>4. Uji Autokorelasi (Durbin-Watson)</h4>
      <p class="test-sub">Menguji apakah residual pada satu data berkorelasi dengan residual pada data sebelumnya (relevan terutama jika urutan data mengikuti waktu/deret).</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">Tidak ada autokorelasi antar residual.</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">Ada autokorelasi (positif atau negatif) antar residual.</span></div>
      </div>
      <div class="test-stat-row">${statCard('Durbin-Watson (d)', fmt(dw.DW))}</div>
      <div class="test-verdict ${dwOk ? 'ok' : 'bad'}">${dwLabel}</div>
      <p class="test-conclusion">${dwOk
        ? 'Nilai d berada di sekitar 2 (antara 1,5 dan 2,5), sehingga H0 gagal ditolak &mdash; tidak terindikasi autokorelasi antar residual.'
        : dw.verdict === 'positive'
          ? 'Nilai d di bawah 1,5, sehingga H0 ditolak &mdash; terindikasi adanya autokorelasi positif antar residual.'
          : dw.verdict === 'negative'
            ? 'Nilai d di atas 2,5, sehingga H0 ditolak &mdash; terindikasi adanya autokorelasi negatif antar residual.'
            : 'Statistik Durbin-Watson tidak dapat dihitung untuk data ini.'}</p>
      <p class="test-note">Rentang keputusan di atas (&lt;1,5 / 1,5&ndash;2,5 / &gt;2,5) adalah aturan praktis (rule of thumb) yang umum dipakai, karena nilai kritis dL dan dU yang tepat bergantung pada tabel Durbin-Watson khusus (n dan jumlah variabel X). Uji ini paling relevan bila data tersusun berurutan (mis. deret waktu); untuk data cross-section acak, hasilnya dapat diabaikan atau dijadikan pelengkap saja.</p>
    </div>`;

    el.assumptionsWrap.innerHTML = html;
  }

  /* =========================================================================
     KESIMPULAN MODEL (Langkah 5): menggabungkan hasil Uji F/Uji t (kekuatan &
     signifikansi hubungan) dengan hasil keempat uji asumsi klasik, untuk
     memutuskan apakah model regresi baik/layak digunakan.
     ========================================================================= */
  function renderConclusion(res, data) {
    if (!(res.df > 0)) {
      el.conclusionWrap.innerHTML = `<div class="test-block"><h4>Kesimpulan Model</h4><p class="test-note">Derajat bebas tidak mencukupi untuk menarik kesimpulan model &mdash; tambahkan lebih banyak data.</p></div>`;
      return;
    }

    const { fTest } = computeSignificanceTests(res, data);
    const norm = computeNormalityTest(res);
    const vif = computeVIF(data, res);
    const hetero = computeHeteroscedasticity(res, data);
    const dw = computeAutocorrelation(res);

    const multicolOk = vif === null ? null : !vif.some((v) => v.problematic);
    const heteroOk = hetero === null ? null : !hetero.anyProblem;
    const autocorrOk = dw.verdict === 'unknown' ? null : dw.verdict === 'none';

    // ---- checklist (hanya butir yang benar-benar dapat dihitung yang menentukan lulus/tidak) ----
    const items = [
      { label: 'Uji F (model signifikan)', pass: fTest.significant, applicable: true },
      { label: 'Normalitas residual', pass: norm.normal, applicable: true },
      { label: 'Non-multikolinearitas', pass: multicolOk, applicable: multicolOk !== null },
      { label: 'Non-heteroskedastisitas', pass: heteroOk, applicable: heteroOk !== null },
      { label: 'Non-autokorelasi', pass: autocorrOk, applicable: autocorrOk !== null },
    ];
    const applicableItems = items.filter((it) => it.applicable);
    const passedCount = applicableItems.filter((it) => it.pass).length;
    const allPassed = passedCount === applicableItems.length;
    const failedLabels = applicableItems.filter((it) => !it.pass).map((it) => it.label);

    const checklistRows = items.map((it) => {
      const status = !it.applicable ? 'n/a' : (it.pass ? 'ok' : 'bad');
      const statusText = !it.applicable ? 'Tidak berlaku' : (it.pass ? 'Terpenuhi' : 'Tidak Terpenuhi');
      return `<tr><td>${escapeHTML(it.label)}</td><td class="${status === 'n/a' ? '' : status}">${statusText}</td></tr>`;
    }).join('');

    const r2Value = res.k === 1 ? res.R2 : res.R2;
    const r2Pct = fmt(r2Value * 100, 2);
    let r2Strength;
    if (r2Value < 0.2) r2Strength = 'sangat rendah'; else if (r2Value < 0.4) r2Strength = 'rendah'; else if (r2Value < 0.6) r2Strength = 'sedang'; else if (r2Value < 0.8) r2Strength = 'tinggi'; else r2Strength = 'sangat tinggi';

    // ---- verdict akhir: gabungan signifikansi (Uji F) + seluruh asumsi klasik yang berlaku ----
    let verdictClass, verdictLabel, verdictText;
    if (fTest.significant && allPassed) {
      verdictClass = 'ok';
      verdictLabel = 'Model Baik &amp; Layak Digunakan';
      verdictText = `Model regresi ini signifikan secara simultan (Uji F, p ${fmt(fTest.p, 4)} &lt; 0.05) dan seluruh uji asumsi klasik yang berlaku terpenuhi. Daya jelas model tergolong ${r2Strength} (R\u00B2 = ${fmt(r2Value)}, atau sekitar ${r2Pct}% variasi Y dijelaskan oleh model). Dengan demikian, model ini dapat diandalkan untuk menjelaskan hubungan antar variabel maupun untuk keperluan prediksi/inferensi lebih lanjut.`;
    } else if (fTest.significant && !allPassed) {
      verdictClass = 'bad';
      verdictLabel = 'Model Signifikan, Namun Asumsi Belum Terpenuhi Semua';
      verdictText = `Secara simultan model ini signifikan (Uji F, p ${fmt(fTest.p, 4)} &lt; 0.05) dengan daya jelas tergolong ${r2Strength} (R\u00B2 = ${fmt(r2Value)} &asymp; ${r2Pct}%). Akan tetapi, uji asumsi klasik menunjukkan masalah pada: ${escapeHTML(failedLabels.join(', '))}. Selama asumsi ini belum terpenuhi, hasil uji t/F dan interval kepercayaan model berisiko tidak akurat, sehingga sebaiknya model diperbaiki dahulu (mis. transformasi variabel, menambah/mengurangi variabel, atau menambah data) sebelum digunakan untuk kesimpulan yang bersifat final.`;
    } else {
      verdictClass = 'bad';
      verdictLabel = 'Model Belum Layak Digunakan';
      verdictText = `Uji F menunjukkan model ini belum signifikan secara simultan (p ${fmt(fTest.p, 4)} &ge; 0.05), artinya variabel X yang digunakan belum terbukti berpengaruh terhadap Y pada taraf signifikansi 5%.${!allPassed ? ` Selain itu, masih terdapat asumsi klasik yang belum terpenuhi pada: ${escapeHTML(failedLabels.join(', '))}.` : ''} Model dengan kondisi ini sebaiknya tidak digunakan untuk prediksi maupun pengambilan keputusan; pertimbangkan untuk mengganti/menambah variabel X, menambah jumlah data, atau meninjau ulang bentuk hubungan antar variabel.`;
    }

    const html = `<div class="test-block">
      <h4>Ringkasan Kekuatan &amp; Signifikansi Model</h4>
      <div class="test-stat-row">
        ${statCard('R\u00B2', fmt(r2Value))}
        ${statCard('Uji F (Sig.)', fmt(fTest.p, 4))}
        ${statCard('Kekuatan Model', r2Strength.charAt(0).toUpperCase() + r2Strength.slice(1))}
      </div>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Kriteria</th><th>Status</th></tr></thead>
        <tbody>${checklistRows}</tbody>
      </table></div>
      <div class="test-verdict ${verdictClass}">${verdictLabel}</div>
      <p class="test-conclusion">${verdictText}</p>
      <p class="test-note">Kesimpulan ini merangkum hasil Uji F/Uji t pada tab "Persamaan &amp; Uji" dan keempat uji asumsi klasik pada Langkah 4. Kriteria yang berlabel "Tidak berlaku" (mis. multikolinearitas pada regresi sederhana) tidak diikutsertakan dalam penentuan status akhir model.</p>
    </div>`;

    el.conclusionWrap.innerHTML = html;
  }

  function renderChart(res, data) {
    el.chartWrap.innerHTML = '';
    if (res.k !== 1) { renderActualVsPredictedChart(res, data); return; }
    const X = data.X.map((r) => r[0]);
    const Y = data.Y;
    const b0 = res.beta[0], b1 = res.beta[1];
    const W = 620, H = 400, PAD = 50;
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const minX = Math.min(...X), maxX = Math.max(...X);
    const minY = Math.min(...Y, b0 + b1 * minX), maxY = Math.max(...Y, b0 + b1 * maxX);
    const padX = (maxX - minX) * 0.1 || 1, padY = (maxY - minY) * 0.15 || 1;
    const xLo = minX - padX, xHi = maxX + padX, yLo = minY - padY, yHi = maxY + padY;
    const sx = (x) => PAD + ((x - xLo) / (xHi - xLo)) * (W - PAD * 1.5);
    const sy = (y) => H - PAD - ((y - yLo) / (yHi - yLo)) * (H - PAD * 1.6);
    const inkSoft = '#52565F', rule = '#DAD2B8', accent = '#22384A', accent2 = '#BD7E1F';
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, H - PAD); ctx.lineTo(W - 20, H - PAD); ctx.moveTo(PAD, H - PAD); ctx.lineTo(PAD, 20); ctx.stroke();
    ctx.fillStyle = inkSoft; ctx.font = '11px IBM Plex Mono, monospace';
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const xv = xLo + (i / ticks) * (xHi - xLo), px = sx(xv);
      ctx.strokeStyle = '#EFEAD9'; ctx.beginPath(); ctx.moveTo(px, H - PAD); ctx.lineTo(px, 20); ctx.stroke();
      ctx.fillStyle = inkSoft; ctx.fillText(fmt(xv, 1), px - 10, H - PAD + 16);
      const yv = yLo + (i / ticks) * (yHi - yLo), py = sy(yv);
      ctx.strokeStyle = '#EFEAD9'; ctx.beginPath(); ctx.moveTo(PAD, py); ctx.lineTo(W - 20, py); ctx.stroke();
      ctx.fillStyle = inkSoft; ctx.fillText(fmt(yv, 1), 6, py + 4);
    }
    ctx.strokeStyle = accent2; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(sx(xLo), sy(b0 + b1 * xLo)); ctx.lineTo(sx(xHi), sy(b0 + b1 * xHi)); ctx.stroke();
    ctx.fillStyle = accent;
    X.forEach((x, i) => { ctx.beginPath(); ctx.arc(sx(x), sy(Y[i]), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); });
    ctx.fillStyle = '#22252B'; ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('X', W - 24, H - PAD - 8); ctx.fillText('Y', PAD + 6, 26);
    el.chartWrap.appendChild(canvas);
    const note = document.createElement('p');
    note.className = 'chart-note';
    note.textContent = `Titik biru = data pengamatan. Garis kuning = garis regresi \u0176 = ${fmt(b0)} ${b1 >= 0 ? '+' : '\u2212'} ${fmt(Math.abs(b1))}X.`;
    el.chartWrap.appendChild(note);
  }

  /* Untuk regresi berganda (k > 1): scatter plot Y aktual vs Y prediksi (Yhat),
     karena hubungan antar >1 variabel X tidak bisa digambar dalam bidang 2D biasa.
     Titik yang berhimpit dengan garis diagonal 45° menandakan prediksi yang akurat. */
  function renderActualVsPredictedChart(res, data) {
    const Y = res.Yhat.map((yh, i) => yh + res.residuals[i]); // Y aktual
    const Yhat = res.Yhat;
    const W = 620, H = 400, PAD = 50;
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const lo = Math.min(...Y, ...Yhat), hi = Math.max(...Y, ...Yhat);
    const pad = (hi - lo) * 0.12 || 1;
    const vLo = lo - pad, vHi = hi + pad;
    const sx = (v) => PAD + ((v - vLo) / (vHi - vLo)) * (W - PAD * 1.5);
    const sy = (v) => H - PAD - ((v - vLo) / (vHi - vLo)) * (H - PAD * 1.6);
    const inkSoft = '#52565F', rule = '#DAD2B8', accent = '#22384A', accent2 = '#BD7E1F';
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, H - PAD); ctx.lineTo(W - 20, H - PAD); ctx.moveTo(PAD, H - PAD); ctx.lineTo(PAD, 20); ctx.stroke();
    ctx.font = '11px IBM Plex Mono, monospace';
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = vLo + (i / ticks) * (vHi - vLo);
      const px = sx(v), py = sy(v);
      ctx.strokeStyle = '#EFEAD9'; ctx.beginPath(); ctx.moveTo(px, H - PAD); ctx.lineTo(px, 20); ctx.stroke();
      ctx.fillStyle = inkSoft; ctx.fillText(fmt(v, 1), px - 10, H - PAD + 16);
      ctx.strokeStyle = '#EFEAD9'; ctx.beginPath(); ctx.moveTo(PAD, py); ctx.lineTo(W - 20, py); ctx.stroke();
      ctx.fillStyle = inkSoft; ctx.fillText(fmt(v, 1), 6, py + 4);
    }
    // garis diagonal referensi Y = Ŷ (prediksi sempurna)
    ctx.strokeStyle = accent2; ctx.lineWidth = 2.2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(sx(vLo), sy(vLo)); ctx.lineTo(sx(vHi), sy(vHi)); ctx.stroke();
    ctx.setLineDash([]);
    // titik data
    ctx.fillStyle = accent;
    Yhat.forEach((yh, i) => { ctx.beginPath(); ctx.arc(sx(yh), sy(Y[i]), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); });
    ctx.fillStyle = '#22252B'; ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('\u0176 (prediksi)', W - 90, H - PAD - 8); ctx.fillText('Y (aktual)', PAD + 6, 26);
    el.chartWrap.appendChild(canvas);
    const note = document.createElement('p');
    note.className = 'chart-note';
    note.textContent = `Karena regresi ini memiliki ${res.k} variabel X, hubungan antar variabel tidak dapat digambar langsung dalam bidang 2 dimensi. Grafik di atas menunjukkan nilai Y aktual (sumbu vertikal) dibandingkan nilai Y prediksi \u0176 (sumbu horizontal) untuk tiap data. Garis putus-putus kuning adalah garis Y = \u0176 (prediksi sempurna); semakin dekat titik biru ke garis ini, semakin akurat model regresi terhadap data.`;
    el.chartWrap.appendChild(note);

    renderPerVariableScatterGrid(res, data);
  }

  /* Scatter Xj vs Y untuk tiap variabel X secara terpisah (bivariat, belum dikontrol
     variabel X lainnya) — berguna untuk eksplorasi pola tiap variabel terhadap Y,
     namun garis/koefisien di sini BUKAN koefisien regresi berganda (b1..bk) yang
     sudah ceteris paribus; ini murni korelasi sederhana Xj-Y saja. */
  function renderPerVariableScatterGrid(res, data) {
    const heading = document.createElement('p');
    heading.className = 'chart-note';
    heading.style.marginTop = '18px';
    heading.innerHTML = `<strong>Hubungan tiap variabel X terhadap Y (satu per satu)</strong><br>Grafik di bawah menunjukkan pola X\u2C7C terhadap Y secara sendiri-sendiri, <em>belum</em> memperhitungkan pengaruh variabel X lain. Garis pada tiap grafik adalah garis regresi sederhana Xj-Y (bukan koefisien b\u2C7C dari model berganda), jadi hanya untuk melihat kecenderungan pola \u2014 bukan pengaruh ceteris paribus.`;
    el.chartWrap.appendChild(heading);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
    grid.style.gap = '16px';
    grid.style.marginTop = '10px';
    grid.style.width = '100%';

    const Y = res.Yhat.map((yh, i) => yh + res.residuals[i]);
    const k = data.X[0].length;
    for (let j = 0; j < k; j++) {
      const Xj = data.X.map((r) => r[j]);
      const box = document.createElement('div');
      box.style.display = 'flex'; box.style.flexDirection = 'column'; box.style.alignItems = 'center'; box.style.gap = '6px';
      const label = document.createElement('div');
      label.style.fontWeight = '600'; label.style.fontSize = '13px';
      label.textContent = `X${j + 1} vs Y`;
      box.appendChild(label);
      box.appendChild(drawMiniScatter(Xj, Y, `X${j + 1}`, 'Y'));
      grid.appendChild(box);
    }
    el.chartWrap.appendChild(grid);
  }

  function drawMiniScatter(X, Y, xLabel, yLabel) {
    const n = X.length;
    const xbar = X.reduce((s, v) => s + v, 0) / n, ybar = Y.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (X[i] - xbar) * (Y[i] - ybar); sxx += (X[i] - xbar) ** 2; }
    const b1 = sxx === 0 ? 0 : sxy / sxx;
    const b0 = ybar - b1 * xbar;
    const W = 280, H = 220, PAD = 38;
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const minX = Math.min(...X), maxX = Math.max(...X);
    const minY = Math.min(...Y, b0 + b1 * minX), maxY = Math.max(...Y, b0 + b1 * maxX);
    const padX = (maxX - minX) * 0.12 || 1, padY = (maxY - minY) * 0.15 || 1;
    const xLo = minX - padX, xHi = maxX + padX, yLo = minY - padY, yHi = maxY + padY;
    const sx = (x) => PAD + ((x - xLo) / (xHi - xLo)) * (W - PAD * 1.4);
    const sy = (y) => H - PAD - ((y - yLo) / (yHi - yLo)) * (H - PAD * 1.7);
    const inkSoft = '#52565F', rule = '#DAD2B8', accent = '#22384A', accent2 = '#BD7E1F';
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, H - PAD); ctx.lineTo(W - 12, H - PAD); ctx.moveTo(PAD, H - PAD); ctx.lineTo(PAD, 14); ctx.stroke();
    ctx.strokeStyle = accent2; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(sx(xLo), sy(b0 + b1 * xLo)); ctx.lineTo(sx(xHi), sy(b0 + b1 * xHi)); ctx.stroke();
    ctx.fillStyle = accent;
    X.forEach((x, i) => { ctx.beginPath(); ctx.arc(sx(x), sy(Y[i]), 3.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); });
    ctx.fillStyle = '#22252B'; ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText(xLabel, W - 20, H - PAD - 6); ctx.fillText(yLabel, PAD + 4, 20);
    return canvas;
  }

  $$('.tab-btn', $('#view-regresi')).forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab-btn', $('#view-regresi')).forEach((b) => b.classList.remove('active'));
      $$('.tab-panel', $('#view-regresi')).forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $('#' + btn.dataset.tab).classList.add('active');
    });
  });

  function fmt(x, d = 4) {
    if (x === null || x === undefined || Number.isNaN(x) || !Number.isFinite(x)) return '\u2014';
    return Number(x).toFixed(d);
  }
  function showError(node, msg) { node.textContent = msg; node.hidden = false; }
  function hideError(node) { node.hidden = true; node.textContent = ''; }
  function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }

  /* Mesin regresi dibagikan agar metode lain (mis. Uji Stasioneritas / ADF, yang pada
     dasarnya adalah regresi OLS) memakai perhitungan matriks & distribusi yang sama. */
  window.StatCalcReg = { transpose, matMul, invertMatrix, tTwoTailedP, fUpperP, runRegression };
})();
