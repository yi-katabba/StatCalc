/* =========================================================================
     METODE: ANOVA LENGKAP — logika ANOVA satu arah (one-way) & dua arah (two-way)
     ========================================================================= */ 
(function () {
  'use strict';

  const state = { mode: 'one', k: 3, rowsA: 2, colsB: 2, replic: 2 };
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const el = {
    method: $('#anMethod'), paramOne: $('#anParamOne'), paramTwo: $('#anParamTwo'),
    kOne: $('#anKOne'), incK: $('#anIncK'), decK: $('#anDecK'),
    rowsA: $('#anRowsA'), incA: $('#anIncA'), decA: $('#anDecA'),
    colsB: $('#anColsB'), incB: $('#anIncB'), decB: $('#anDecB'),
    replic: $('#anReplic'), incR: $('#anIncR'), decR: $('#anDecR'),
    buildTableBtn: $('#anBuildTableBtn'), setupError: $('#anSetupError'),
    dataCard: $('#an-data-card'), dataHint: $('#anDataHint'),
    tableHead: $('#anDataTableHead'), tableBody: $('#anDataTableBody'),
    rowControls: $('#anRowControls'),
    addRowBtn: $('#anAddRowBtn'), removeRowBtn: $('#anRemoveRowBtn'),
    fillSampleBtn: $('#anFillSampleBtn'), calcBtn: $('#anCalcBtn'), dataError: $('#anDataError'),
    resultsCard: $('#an-results-card'), descWrap: $('#anDescWrap'),
    anovaWrap: $('#anAnovaWrap'), stepsWrap: $('#anStepsWrap'),
    conclusionCard: $('#an-conclusion-card'), conclusionWrap: $('#anConclusionWrap'),
  };

  /* ---------- Setup: pilih jenis ANOVA & jumlah kelompok/faktor ---------- */
  el.method.addEventListener('change', () => {
    state.mode = el.method.value;
    el.paramOne.hidden = state.mode !== 'one';
    el.paramTwo.hidden = state.mode !== 'two';
  });
  el.incK.addEventListener('click', () => { el.kOne.value = Math.min(8, (parseInt(el.kOne.value, 10) || 2) + 1); });
  el.decK.addEventListener('click', () => { el.kOne.value = Math.max(2, (parseInt(el.kOne.value, 10) || 2) - 1); });
  el.incA.addEventListener('click', () => { el.rowsA.value = Math.min(6, (parseInt(el.rowsA.value, 10) || 2) + 1); });
  el.decA.addEventListener('click', () => { el.rowsA.value = Math.max(2, (parseInt(el.rowsA.value, 10) || 2) - 1); });
  el.incB.addEventListener('click', () => { el.colsB.value = Math.min(6, (parseInt(el.colsB.value, 10) || 2) + 1); });
  el.decB.addEventListener('click', () => { el.colsB.value = Math.max(2, (parseInt(el.colsB.value, 10) || 2) - 1); });
  el.incR.addEventListener('click', () => { el.replic.value = Math.min(6, (parseInt(el.replic.value, 10) || 2) + 1); });
  el.decR.addEventListener('click', () => { el.replic.value = Math.max(2, (parseInt(el.replic.value, 10) || 2) - 1); });

  el.buildTableBtn.addEventListener('click', () => {
    hideError(el.setupError);
    if (state.mode === 'one') {
      const k = parseInt(el.kOne.value, 10);
      if (!Number.isInteger(k) || k < 2 || k > 8) {
        showError(el.setupError, 'Jumlah kelompok harus berupa bilangan bulat antara 2 dan 8.');
        return;
      }
      state.k = k;
      buildOneWayTable(k, 5);
      el.dataHint.innerHTML = 'Isi nilai pengamatan tiap kelompok pada kolomnya masing-masing. Sel boleh dikosongkan bila jumlah data antar kelompok berbeda. Minimal <strong>2 data terisi</strong> per kelompok.';
      el.addRowBtn.hidden = false; el.removeRowBtn.hidden = false;
    } else {
      const a = parseInt(el.rowsA.value, 10), b = parseInt(el.colsB.value, 10), r = parseInt(el.replic.value, 10);
      if (!Number.isInteger(a) || a < 2 || a > 6) { showError(el.setupError, 'Jumlah level Faktor A harus bilangan bulat antara 2 dan 6.'); return; }
      if (!Number.isInteger(b) || b < 2 || b > 6) { showError(el.setupError, 'Jumlah level Faktor B harus bilangan bulat antara 2 dan 6.'); return; }
      if (!Number.isInteger(r) || r < 2 || r > 6) { showError(el.setupError, 'Jumlah replikasi per sel harus bilangan bulat antara 2 dan 6.'); return; }
      state.rowsA = a; state.colsB = b; state.replic = r;
      buildTwoWayTable(a, b, r);
      el.dataHint.innerHTML = `Isi nilai pengamatan pada setiap sel kombinasi Faktor A &times; Faktor B. Setiap kombinasi memiliki <strong>${r} baris replikasi</strong> yang harus terisi semua (desain seimbang).`;
      el.addRowBtn.hidden = true; el.removeRowBtn.hidden = true;
    }
    el.dataCard.hidden = false;
    el.resultsCard.hidden = true;
    el.conclusionCard.hidden = true;
    el.dataCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Tabel input: ANOVA satu arah (kolom = kelompok) ---------- */
  function buildOneWayTable(k, rowCount) {
    const headRow = document.createElement('tr');
    headRow.innerHTML = '<th>No</th>' + Array.from({ length: k }, (_, i) => `<th>Kelompok ${i + 1}</th>`).join('');
    el.tableHead.innerHTML = '';
    el.tableHead.appendChild(headRow);
    el.tableBody.innerHTML = '';
    for (let r = 0; r < rowCount; r++) addOneWayRow();
  }
  function addOneWayRow() {
    const k = state.k;
    const tr = document.createElement('tr');
    const rowNumTd = document.createElement('td');
    rowNumTd.className = 'rownum';
    tr.appendChild(rowNumTd);
    for (let j = 0; j < k; j++) {
      const td = document.createElement('td');
      td.innerHTML = `<input type="text" inputmode="decimal" data-role="grp" data-col="${j}" placeholder="&mdash;">`;
      tr.appendChild(td);
    }
    el.tableBody.appendChild(tr);
    renumberRows();
  }
  function removeOneWayRow() {
    const rows = el.tableBody.rows;
    if (rows.length <= 2) return;
    el.tableBody.deleteRow(rows.length - 1);
    renumberRows();
  }
  function renumberRows() {
    $$('#anDataTableBody tr').forEach((tr, i) => { const c = tr.querySelector('.rownum'); if (c) c.textContent = i + 1; });
  }
  el.addRowBtn.addEventListener('click', () => { if (state.mode === 'one') addOneWayRow(); });
  el.removeRowBtn.addEventListener('click', () => { if (state.mode === 'one') removeOneWayRow(); });

  /* ---------- Tabel input: ANOVA dua arah (baris = Faktor A x replikasi, kolom = Faktor B) ---------- */
  function buildTwoWayTable(a, b, r) {
    const headRow = document.createElement('tr');
    headRow.innerHTML = '<th>Faktor A &#92; Faktor B</th>' + Array.from({ length: b }, (_, j) => `<th>B${j + 1}</th>`).join('');
    el.tableHead.innerHTML = '';
    el.tableHead.appendChild(headRow);
    el.tableBody.innerHTML = '';
    for (let i = 0; i < a; i++) {
      for (let rep = 0; rep < r; rep++) {
        const tr = document.createElement('tr');
        if (rep === 0) {
          const labelTd = document.createElement('td');
          labelTd.className = 'rownum';
          labelTd.rowSpan = r;
          labelTd.textContent = `A${i + 1}`;
          tr.appendChild(labelTd);
        }
        for (let j = 0; j < b; j++) {
          const td = document.createElement('td');
          td.innerHTML = `<input type="text" inputmode="decimal" data-role="cell" data-a="${i}" data-b="${j}" data-rep="${rep}" placeholder="ulangan ${rep + 1}">`;
          tr.appendChild(td);
        }
        el.tableBody.appendChild(tr);
      }
    }
  }

  /* ---------- Isi contoh data ---------- */
  el.fillSampleBtn.addEventListener('click', () => {
    if (state.mode === 'one') {
      const k = state.k;
      buildOneWayTable(k, 5);
      const rows = $$('#anDataTableBody tr');
      rows.forEach((tr, i) => {
        $$('input[data-role="grp"]', tr).forEach((inp, j) => {
          inp.value = Math.round(20 + j * 4 + (i * 2 + j) % 5 - (i % 3) + Math.sin(i + j) * 3);
        });
      });
    } else {
      const { rowsA: a, colsB: b, replic: r } = state;
      buildTwoWayTable(a, b, r);
      $$('input[data-role="cell"]').forEach((inp) => {
        const i = +inp.dataset.a, j = +inp.dataset.b, rep = +inp.dataset.rep;
        const val = Math.round(30 + i * 5 + j * 3 + (rep % 2 === 0 ? 1 : -1) * 2 + ((i + j + rep) % 3));
        inp.value = val;
      });
    }
  });

  /* =========================================================================
     FUNGSI DISTRIBUSI STATISTIK (untuk Uji F)
     ========================================================================= */
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
  /* p-value (upper-tail) untuk statistik uji F dengan derajat bebas df1, df2 */
  function fUpperP(F, df1, df2) {
    if (!Number.isFinite(F) || F < 0 || df1 <= 0 || df2 <= 0) return NaN;
    return betai(df2 / (df2 + df1 * F), df2 / 2, df1 / 2);
  }

  /* =========================================================================
     PENGUMPULAN DATA DARI TABEL
     ========================================================================= */
  function parseNum(str) {
    if (str === undefined || str === null) return NaN;
    const s = String(str).trim().replace(',', '.');
    if (s === '') return NaN;
    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  }

  function collectOneWayData() {
    const k = state.k;
    const groups = Array.from({ length: k }, () => []);
    $$('#anDataTableBody tr').forEach((tr) => {
      $$('input[data-role="grp"]', tr).forEach((inp) => {
        const j = +inp.dataset.col;
        const v = parseNum(inp.value);
        if (Number.isFinite(v)) groups[j].push(v);
      });
    });
    return groups;
  }

  function collectTwoWayData() {
    const { rowsA: a, colsB: b, replic: r } = state;
    const cells = Array.from({ length: a }, () => Array.from({ length: b }, () => []));
    let missing = 0;
    $$('input[data-role="cell"]').forEach((inp) => {
      const i = +inp.dataset.a, j = +inp.dataset.b;
      const v = parseNum(inp.value);
      if (Number.isFinite(v)) cells[i][j].push(v); else missing++;
    });
    return { cells, missing, a, b, r };
  }

  /* =========================================================================
     PERHITUNGAN: ANOVA SATU ARAH (ONE-WAY)
     ========================================================================= */
  function computeOneWay(groups) {
    const k = groups.length;
    const ns = groups.map((g) => g.length);
    const N = ns.reduce((s, n) => s + n, 0);
    const sums = groups.map((g) => g.reduce((s, v) => s + v, 0));
    const means = sums.map((s, j) => (ns[j] > 0 ? s / ns[j] : NaN));
    const grandSum = sums.reduce((s, v) => s + v, 0);
    const grandMean = N > 0 ? grandSum / N : NaN;

    const sds = groups.map((g, j) => {
      const m = means[j], n = ns[j];
      if (n < 2) return NaN;
      const ss = g.reduce((s, v) => s + (v - m) ** 2, 0);
      return Math.sqrt(ss / (n - 1));
    });
    const mins = groups.map((g) => (g.length ? Math.min(...g) : NaN));
    const maxs = groups.map((g) => (g.length ? Math.max(...g) : NaN));

    const SSB = ns.reduce((s, n, j) => s + n * (means[j] - grandMean) ** 2, 0);
    let SSW = 0;
    groups.forEach((g, j) => { g.forEach((v) => { SSW += (v - means[j]) ** 2; }); });
    const SST = SSB + SSW;

    const dfB = k - 1, dfW = N - k, dfT = N - 1;
    const MSB = dfB > 0 ? SSB / dfB : NaN;
    const MSW = dfW > 0 ? SSW / dfW : NaN;
    const F = (Number.isFinite(MSW) && MSW > 0) ? MSB / MSW : NaN;
    const p = fUpperP(F, dfB, dfW);
    const significant = Number.isFinite(p) ? p < 0.05 : false;

    return { k, ns, N, means, sds, mins, maxs, grandMean, SSB, SSW, SST, dfB, dfW, dfT, MSB, MSW, F, p, significant };
  }

  /* =========================================================================
     PERHITUNGAN: ANOVA DUA ARAH (TWO-WAY, DESAIN SEIMBANG)
     ========================================================================= */
  function computeTwoWay(cells, a, b, r) {
    const N = a * b * r;
    let grandSum = 0;
    const cellMeans = Array.from({ length: a }, () => new Array(b).fill(NaN));
    for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) {
      const sum = cells[i][j].reduce((s, v) => s + v, 0);
      cellMeans[i][j] = sum / cells[i][j].length;
      grandSum += sum;
    }
    const grandMean = grandSum / N;

    const rowMeans = new Array(a).fill(0);
    for (let i = 0; i < a; i++) {
      let s = 0; for (let j = 0; j < b; j++) s += cellMeans[i][j] * r;
      rowMeans[i] = s / (b * r);
    }
    const colMeans = new Array(b).fill(0);
    for (let j = 0; j < b; j++) {
      let s = 0; for (let i = 0; i < a; i++) s += cellMeans[i][j] * r;
      colMeans[j] = s / (a * r);
    }

    const SS_A = rowMeans.reduce((s, m) => s + b * r * (m - grandMean) ** 2, 0);
    const SS_B = colMeans.reduce((s, m) => s + a * r * (m - grandMean) ** 2, 0);
    let SS_cells = 0;
    for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) SS_cells += r * (cellMeans[i][j] - grandMean) ** 2;
    const SS_AB = SS_cells - SS_A - SS_B;

    let SS_error = 0, SS_total = 0;
    for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) {
      cells[i][j].forEach((v) => {
        SS_error += (v - cellMeans[i][j]) ** 2;
        SS_total += (v - grandMean) ** 2;
      });
    }

    const dfA = a - 1, dfB2 = b - 1, dfAB = (a - 1) * (b - 1), dfE = a * b * (r - 1), dfT = N - 1;
    const MS_A = SS_A / dfA, MS_B = SS_B / dfB2, MS_AB = SS_AB / dfAB, MS_E = SS_error / dfE;
    const F_A = MS_E > 0 ? MS_A / MS_E : NaN;
    const F_B = MS_E > 0 ? MS_B / MS_E : NaN;
    const F_AB = MS_E > 0 ? MS_AB / MS_E : NaN;
    const p_A = fUpperP(F_A, dfA, dfE);
    const p_B = fUpperP(F_B, dfB2, dfE);
    const p_AB = fUpperP(F_AB, dfAB, dfE);

    return {
      a, b, r, N, cellMeans, rowMeans, colMeans, grandMean,
      SS_A, SS_B, SS_AB, SS_error, SS_total,
      dfA, dfB: dfB2, dfAB, dfE, dfT,
      MS_A, MS_B, MS_AB, MS_E,
      F_A, F_B, F_AB, p_A, p_B, p_AB,
      sigA: Number.isFinite(p_A) ? p_A < 0.05 : false,
      sigB: Number.isFinite(p_B) ? p_B < 0.05 : false,
      sigAB: Number.isFinite(p_AB) ? p_AB < 0.05 : false,
    };
  }

  /* =========================================================================
     HITUNG (tombol utama)
     ========================================================================= */
  el.calcBtn.addEventListener('click', () => {
    hideError(el.dataError);
    if (state.mode === 'one') {
      const groups = collectOneWayData();
      const bad = groups.findIndex((g) => g.length < 2);
      if (bad !== -1) {
        showError(el.dataError, `Kelompok ${bad + 1} minimal harus memiliki 2 data terisi. Lengkapi data atau tambah baris.`);
        return;
      }
      const res = computeOneWay(groups);
      renderOneWayResults(res, groups);
    } else {
      const { cells, missing, a, b, r } = collectTwoWayData();
      if (missing > 0) {
        showError(el.dataError, `Masih ada ${missing} sel yang kosong. Lengkapi seluruh sel (desain seimbang) sebelum menghitung.`);
        return;
      }
      const res = computeTwoWay(cells, a, b, r);
      renderTwoWayResults(res, cells);
    }
    el.resultsCard.hidden = false;
    el.conclusionCard.hidden = false;
    $$('.tab-btn', $('#anResultTabs')).forEach((b) => b.classList.remove('active'));
    $$('.tab-panel', el.resultsCard.parentElement).forEach((p) => p.classList.remove('active'));
    $('.tab-btn[data-tab="an-tab-desc"]', $('#anResultTabs')).classList.add('active');
    $('#an-tab-desc').classList.add('active');
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
    el.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Tab switching hasil ---------- */
  $('#anResultTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    $$('.tab-btn', $('#anResultTabs')).forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-panel', btn.closest('.step-card')).forEach((p) => p.classList.remove('active'));
    $('#' + btn.dataset.tab).classList.add('active');
  });

  /* =========================================================================
     RENDER: ANOVA SATU ARAH
     ========================================================================= */
  function renderOneWayResults(res, groups) {
    // ---- Tab: Statistik Kelompok ----
    let rows = groups.map((g, j) => `<tr>
        <td>Kelompok ${j + 1}</td><td>${res.ns[j]}</td><td>${fmt(res.means[j])}</td>
        <td>${fmt(res.sds[j])}</td><td>${fmt(res.mins[j], 2)}</td><td>${fmt(res.maxs[j], 2)}</td>
      </tr>`).join('');
    el.descWrap.innerHTML = `<table class="result-table"><caption>Statistik deskriptif tiap kelompok (N total = ${res.N})</caption>
      <thead><tr><th>Kelompok</th><th>n</th><th>Rata-rata</th><th>S. Baku</th><th>Min</th><th>Maks</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Rata-rata Keseluruhan</td><td>${res.N}</td><td colspan="4">${fmt(res.grandMean)}</td></tr></tfoot>
      </table>`;

    // ---- Tab: Tabel ANOVA ----
    let html = `<div class="test-block">
      <h4>Tabel ANOVA Satu Arah</h4>
      <p class="test-sub">Variasi total data dipecah menjadi variasi antar kelompok (perbedaan rata-rata antar kelompok) dan variasi dalam kelompok (galat/keragaman di dalam tiap kelompok).</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Sumber Variasi</th><th>JK (SS)</th><th>db (df)</th><th>KT (MS)</th><th>F hitung</th><th>Sig.</th></tr></thead>
        <tbody>
          <tr><td>Antar Kelompok</td><td>${fmt(res.SSB)}</td><td>${res.dfB}</td><td>${fmt(res.MSB)}</td><td>${fmt(res.F)}</td><td>${fmt(res.p, 4)}</td></tr>
          <tr><td>Dalam Kelompok</td><td>${fmt(res.SSW)}</td><td>${res.dfW}</td><td>${fmt(res.MSW)}</td><td>&mdash;</td><td>&mdash;</td></tr>
          <tr><td>Total</td><td>${fmt(res.SST)}</td><td>${res.dfT}</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>
        </tbody>
      </table></div>
      <p class="test-note">JK Antar Kelompok (SSB) = variasi karena perbedaan rata-rata antar kelompok; JK Dalam Kelompok (SSW) = variasi acak di dalam tiap kelompok (galat); JK Total (SST) = SSB + SSW. F hitung = KT Antar &divide; KT Dalam.</p>
    </div>`;

    html += `<div class="test-block">
      <h4>Uji F (ANOVA Satu Arah)</h4>
      <p class="test-sub">Menguji apakah terdapat perbedaan rata-rata yang signifikan di antara ${res.k} kelompok data.</p>
      <div class="hyp-box">
        <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">&mu;1 = &mu;2 = ... = &mu;${res.k} &mdash; tidak ada perbedaan rata-rata yang signifikan di antara seluruh kelompok.</span></div>
        <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">minimal ada satu pasang &mu; yang berbeda &mdash; terdapat perbedaan rata-rata yang signifikan di antara kelompok.</span></div>
      </div>
      <div class="test-stat-row">
        ${statCard('F hitung', fmt(res.F))}
        ${statCard('df1, df2', `${res.dfB}, ${res.dfW}`)}
        ${statCard('Sig. (p-value)', fmt(res.p, 4))}
      </div>
      <div class="test-verdict ${res.significant ? 'ok' : 'bad'}">${res.significant ? 'Signifikan (p &lt; 0.05)' : 'Tidak Signifikan (p &ge; 0.05)'}</div>
      <p class="test-conclusion">${res.significant
        ? `Karena nilai signifikansi (${fmt(res.p, 4)}) &lt; 0.05, H0 ditolak. Artinya, pada taraf signifikansi 5% terdapat perbedaan rata-rata yang signifikan di antara minimal sepasang kelompok. Untuk mengetahui kelompok mana saja yang berbeda, dapat dilanjutkan dengan uji lanjut (post hoc) seperti Tukey atau LSD.`
        : `Karena nilai signifikansi (${fmt(res.p, 4)}) &ge; 0.05, H0 gagal ditolak. Artinya, pada taraf signifikansi 5% belum terbukti ada perbedaan rata-rata yang signifikan di antara ke-${res.k} kelompok data.`}</p>
    </div>`;
    el.anovaWrap.innerHTML = html;

    // ---- Tab: Langkah Perhitungan ----
    const stepList = [
      { title: 'Hitung rata-rata tiap kelompok dan rata-rata keseluruhan',
        formula: `x\u0304j = \u03A3xij / nj  ;  x\u0304 = \u03A3\u03A3xij / N`,
        note: `Rata-rata tiap kelompok: ${res.means.map((m, j) => `x\u0304${j + 1} = ${fmt(m)}`).join('; ')}. Rata-rata keseluruhan (grand mean) x\u0304 = ${fmt(res.grandMean)} dengan N = ${res.N}.` },
      { title: 'Hitung Jumlah Kuadrat Antar Kelompok (JKA / SSB)',
        formula: `JKA = \u03A3 nj (x\u0304j \u2212 x\u0304)\u00B2`,
        note: `JKA = ${fmt(res.SSB)}, dengan derajat bebas dbA = k \u2212 1 = ${res.k} \u2212 1 = ${res.dfB}.` },
      { title: 'Hitung Jumlah Kuadrat Dalam Kelompok (JKD / SSW)',
        formula: `JKD = \u03A3\u03A3 (xij \u2212 x\u0304j)\u00B2`,
        note: `JKD = ${fmt(res.SSW)}, dengan derajat bebas dbD = N \u2212 k = ${res.N} \u2212 ${res.k} = ${res.dfW}.` },
      { title: 'Hitung Kuadrat Tengah (Mean Square) & F hitung',
        formula: `KTA = JKA/dbA ;  KTD = JKD/dbD ;  F = KTA/KTD`,
        note: `KTA = ${fmt(res.MSB)}, KTD = ${fmt(res.MSW)}, sehingga F hitung = ${fmt(res.MSB)} \u00F7 ${fmt(res.MSW)} = ${fmt(res.F)}.` },
      { title: 'Bandingkan dengan taraf signifikansi',
        note: `Nilai signifikansi (p-value) dari F hitung = ${fmt(res.p, 4)}. Karena p-value ${res.significant ? '<' : '\u2265'} 0.05, keputusan: ${res.significant ? 'H0 ditolak (signifikan).' : 'H0 gagal ditolak (tidak signifikan).'}` },
    ];
    el.stepsWrap.innerHTML = stepList.map((s, i) => {
      const parts = [`<h4>${escapeHTML(s.title)}</h4>`];
      if (s.formula) parts.push(`<span class="formula">${escapeHTML(s.formula)}</span>`);
      if (s.note) parts.push(`<p>${escapeHTML(s.note)}</p>`);
      return `<div class="step-block" data-step="${i + 1}">${parts.join('')}</div>`;
    }).join('');

    renderOneWayConclusion(res);
  }

  function renderOneWayConclusion(res) {
    let html = `<div class="stat-grid">`;
    html += statCard('Jumlah kelompok (k)', res.k);
    html += statCard('Total data (N)', res.N);
    html += statCard('F hitung', fmt(res.F));
    html += statCard('Sig. (p-value)', fmt(res.p, 4));
    html += `</div>`;
    html += `<p class="test-conclusion">${res.significant
      ? `Berdasarkan hasil ANOVA satu arah, F hitung = ${fmt(res.F)} dengan signifikansi ${fmt(res.p, 4)} &lt; 0.05, sehingga H0 ditolak. Kesimpulannya, <strong>terdapat perbedaan rata-rata yang signifikan</strong> di antara ke-${res.k} kelompok pada taraf kepercayaan 95%. Kelompok dengan rata-rata tertinggi adalah Kelompok ${res.means.indexOf(Math.max(...res.means)) + 1} (${fmt(Math.max(...res.means))}), sedangkan yang terendah adalah Kelompok ${res.means.indexOf(Math.min(...res.means)) + 1} (${fmt(Math.min(...res.means))}).`
      : `Berdasarkan hasil ANOVA satu arah, F hitung = ${fmt(res.F)} dengan signifikansi ${fmt(res.p, 4)} &ge; 0.05, sehingga H0 gagal ditolak. Kesimpulannya, <strong>belum terbukti ada perbedaan rata-rata yang signifikan</strong> di antara ke-${res.k} kelompok pada taraf kepercayaan 95%.`}</p>`;
    el.conclusionWrap.innerHTML = html;
  }

  /* =========================================================================
     RENDER: ANOVA DUA ARAH
     ========================================================================= */
  function renderTwoWayResults(res, cells) {
    // ---- Tab: Statistik Kelompok (rata-rata tiap sel, baris, kolom) ----
    let head = '<tr><th>Faktor A &#92; Faktor B</th>' + Array.from({ length: res.b }, (_, j) => `<th>B${j + 1}</th>`).join('') + '<th>Rata-rata Baris</th></tr>';
    let bodyRows = '';
    for (let i = 0; i < res.a; i++) {
      bodyRows += `<tr><td>A${i + 1}</td>` + Array.from({ length: res.b }, (_, j) => `<td>${fmt(res.cellMeans[i][j])}</td>`).join('') + `<td>${fmt(res.rowMeans[i])}</td></tr>`;
    }
    let footRow = '<tr><td>Rata-rata Kolom</td>' + res.colMeans.map((m) => `<td>${fmt(m)}</td>`).join('') + `<td>${fmt(res.grandMean)}</td></tr>`;
    el.descWrap.innerHTML = `<table class="result-table"><caption>Rata-rata tiap sel, baris (Faktor A), dan kolom (Faktor B) &mdash; N total = ${res.N}, r = ${res.r} replikasi/sel</caption>
      <thead>${head}</thead><tbody>${bodyRows}</tbody><tfoot>${footRow}</tfoot></table>`;

    // ---- Tab: Tabel ANOVA ----
    let html = `<div class="test-block">
      <h4>Tabel ANOVA Dua Arah</h4>
      <p class="test-sub">Variasi total data dipecah menjadi variasi karena Faktor A, Faktor B, interaksi A&times;B, dan galat (error) di dalam sel.</p>
      <div class="table-scroll"><table class="mini-table">
        <thead><tr><th>Sumber Variasi</th><th>JK (SS)</th><th>db (df)</th><th>KT (MS)</th><th>F hitung</th><th>Sig.</th></tr></thead>
        <tbody>
          <tr><td>Faktor A</td><td>${fmt(res.SS_A)}</td><td>${res.dfA}</td><td>${fmt(res.MS_A)}</td><td>${fmt(res.F_A)}</td><td>${fmt(res.p_A, 4)}</td></tr>
          <tr><td>Faktor B</td><td>${fmt(res.SS_B)}</td><td>${res.dfB}</td><td>${fmt(res.MS_B)}</td><td>${fmt(res.F_B)}</td><td>${fmt(res.p_B, 4)}</td></tr>
          <tr><td>Interaksi A&times;B</td><td>${fmt(res.SS_AB)}</td><td>${res.dfAB}</td><td>${fmt(res.MS_AB)}</td><td>${fmt(res.F_AB)}</td><td>${fmt(res.p_AB, 4)}</td></tr>
          <tr><td>Galat (Error)</td><td>${fmt(res.SS_error)}</td><td>${res.dfE}</td><td>${fmt(res.MS_E)}</td><td>&mdash;</td><td>&mdash;</td></tr>
          <tr><td>Total</td><td>${fmt(res.SS_total)}</td><td>${res.dfT}</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>
        </tbody>
      </table></div>
      <p class="test-note">F hitung tiap sumber = KT sumber tersebut &divide; KT Galat. Baris Total (SS_total) seharusnya sama dengan jumlah SS_A + SS_B + SS_AB + SS_error.</p>
    </div>`;

    const tests = [
      { key: 'A', label: 'Faktor A', F: res.F_A, df1: res.dfA, p: res.p_A, sig: res.sigA,
        h0: 'Faktor A tidak berpengaruh signifikan terhadap variabel terikat.', h1: 'Faktor A berpengaruh signifikan terhadap variabel terikat.' },
      { key: 'B', label: 'Faktor B', F: res.F_B, df1: res.dfB, p: res.p_B, sig: res.sigB,
        h0: 'Faktor B tidak berpengaruh signifikan terhadap variabel terikat.', h1: 'Faktor B berpengaruh signifikan terhadap variabel terikat.' },
      { key: 'AB', label: 'Interaksi Faktor A \u00D7 B', F: res.F_AB, df1: res.dfAB, p: res.p_AB, sig: res.sigAB,
        h0: 'Tidak ada interaksi antara Faktor A dan Faktor B.', h1: 'Terdapat interaksi antara Faktor A dan Faktor B.' },
    ];
    tests.forEach((t) => {
      html += `<div class="test-block">
        <h4>Uji F &mdash; ${t.label}</h4>
        <div class="hyp-box">
          <div class="hyp-row"><span class="hyp-tag">H0:</span><span class="hyp-text">${t.h0}</span></div>
          <div class="hyp-row"><span class="hyp-tag">H1:</span><span class="hyp-text">${t.h1}</span></div>
        </div>
        <div class="test-stat-row">
          ${statCard('F hitung', fmt(t.F))}
          ${statCard('df1, df2', `${t.df1}, ${res.dfE}`)}
          ${statCard('Sig. (p-value)', fmt(t.p, 4))}
        </div>
        <div class="test-verdict ${t.sig ? 'ok' : 'bad'}">${t.sig ? 'Signifikan (p &lt; 0.05)' : 'Tidak Signifikan (p &ge; 0.05)'}</div>
        <p class="test-conclusion">${t.sig
          ? `Karena nilai signifikansi (${fmt(t.p, 4)}) &lt; 0.05, H0 ditolak. Artinya, pada taraf signifikansi 5%, ${t.h1.charAt(0).toLowerCase() + t.h1.slice(1)}`
          : `Karena nilai signifikansi (${fmt(t.p, 4)}) &ge; 0.05, H0 gagal ditolak. Artinya, pada taraf signifikansi 5%, belum terbukti bahwa ${t.h1.charAt(0).toLowerCase() + t.h1.slice(1)}`}</p>
      </div>`;
    });
    el.anovaWrap.innerHTML = html;

    // ---- Tab: Langkah Perhitungan ----
    const stepList = [
      { title: 'Hitung rata-rata tiap sel, baris (Faktor A), kolom (Faktor B), dan keseluruhan',
        formula: `x\u0304ij = \u03A3xijk / r  ;  x\u0304i. = \u03A3j x\u0304ij / b  ;  x\u0304.j = \u03A3i x\u0304ij / a  ;  x\u0304 = \u03A3\u03A3\u03A3xijk / N`,
        note: `N = a \u00D7 b \u00D7 r = ${res.a} \u00D7 ${res.b} \u00D7 ${res.r} = ${res.N}. Rata-rata keseluruhan x\u0304 = ${fmt(res.grandMean)}.` },
      { title: 'Hitung Jumlah Kuadrat Faktor A (JKA)',
        formula: `JKA = b\u00B7r \u00D7 \u03A3 (x\u0304i. \u2212 x\u0304)\u00B2`,
        note: `JKA = ${fmt(res.SS_A)}, dbA = a \u2212 1 = ${res.dfA}.` },
      { title: 'Hitung Jumlah Kuadrat Faktor B (JKB)',
        formula: `JKB = a\u00B7r \u00D7 \u03A3 (x\u0304.j \u2212 x\u0304)\u00B2`,
        note: `JKB = ${fmt(res.SS_B)}, dbB = b \u2212 1 = ${res.dfB}.` },
      { title: 'Hitung Jumlah Kuadrat Interaksi A\u00D7B (JKAB)',
        formula: `JKAB = [r \u00D7 \u03A3\u03A3 (x\u0304ij \u2212 x\u0304)\u00B2] \u2212 JKA \u2212 JKB`,
        note: `JKAB = ${fmt(res.SS_AB)}, dbAB = (a \u2212 1)(b \u2212 1) = ${res.dfAB}.` },
      { title: 'Hitung Jumlah Kuadrat Galat (JKG) & Total (JKT)',
        formula: `JKG = \u03A3\u03A3\u03A3 (xijk \u2212 x\u0304ij)\u00B2  ;  JKT = \u03A3\u03A3\u03A3 (xijk \u2212 x\u0304)\u00B2`,
        note: `JKG = ${fmt(res.SS_error)}, dbG = a\u00B7b\u00B7(r \u2212 1) = ${res.dfE}. JKT = ${fmt(res.SS_total)}, dbT = N \u2212 1 = ${res.dfT}.` },
      { title: 'Hitung Kuadrat Tengah (KT) & F hitung tiap sumber',
        formula: `KT = JK/db  ;  F = KTsumber / KTGalat`,
        note: `F Faktor A = ${fmt(res.F_A)} (p = ${fmt(res.p_A, 4)}); F Faktor B = ${fmt(res.F_B)} (p = ${fmt(res.p_B, 4)}); F Interaksi A\u00D7B = ${fmt(res.F_AB)} (p = ${fmt(res.p_AB, 4)}).` },
    ];
    el.stepsWrap.innerHTML = stepList.map((s, i) => {
      const parts = [`<h4>${escapeHTML(s.title)}</h4>`];
      if (s.formula) parts.push(`<span class="formula">${escapeHTML(s.formula)}</span>`);
      if (s.note) parts.push(`<p>${escapeHTML(s.note)}</p>`);
      return `<div class="step-block" data-step="${i + 1}">${parts.join('')}</div>`;
    }).join('');

    renderTwoWayConclusion(res);
  }

  function renderTwoWayConclusion(res) {
    let html = `<div class="stat-grid">`;
    html += statCard('a &times; b &times; r', `${res.a} \u00D7 ${res.b} \u00D7 ${res.r}`);
    html += statCard('Total data (N)', res.N);
    html += statCard('F Faktor A', fmt(res.F_A));
    html += statCard('F Faktor B', fmt(res.F_B));
    html += statCard('F Interaksi A\u00D7B', fmt(res.F_AB));
    html += `</div>`;
    const parts = [];
    parts.push(`Faktor A ${res.sigA ? '<strong>berpengaruh signifikan</strong>' : 'tidak terbukti berpengaruh signifikan'} terhadap variabel terikat (Sig. = ${fmt(res.p_A, 4)}).`);
    parts.push(`Faktor B ${res.sigB ? '<strong>berpengaruh signifikan</strong>' : 'tidak terbukti berpengaruh signifikan'} terhadap variabel terikat (Sig. = ${fmt(res.p_B, 4)}).`);
    parts.push(`Interaksi Faktor A &times; B ${res.sigAB ? '<strong>signifikan</strong>, artinya pengaruh salah satu faktor terhadap variabel terikat bergantung pada level faktor lainnya' : 'tidak terbukti signifikan, artinya kedua faktor cenderung berpengaruh secara independen (tidak saling memengaruhi)'} (Sig. = ${fmt(res.p_AB, 4)}).`);
    html += `<p class="test-conclusion">${parts.join(' ')}</p>`;
    html += `<p class="test-note">Seluruh kesimpulan di atas menggunakan taraf signifikansi 5% (&alpha; = 0.05): H0 ditolak apabila nilai Sig. (p-value) &lt; 0.05.</p>`;
    el.conclusionWrap.innerHTML = html;
  }

  /* ---------- Util ---------- */
  function statCard(label, value) { return `<div class="stat-card"><div class="k">${escapeHTML(label)}</div><div class="v">${escapeHTML(String(value))}</div></div>`; }
  function fmt(x, d = 4) {
    if (x === null || x === undefined || Number.isNaN(x) || !Number.isFinite(x)) return '\u2014';
    return Number(x).toFixed(d);
  }
  function showError(node, msg) { node.textContent = msg; node.hidden = false; }
  function hideError(node) { node.hidden = true; node.textContent = ''; }
  function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
})();
