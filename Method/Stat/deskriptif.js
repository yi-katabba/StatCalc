/* =========================================================================
   STATISTIKA DESKRIPTIF — ringkasan data per variabel (Method > Stat)
   -------------------------------------------------------------------------
   Input: satu atau banyak variabel (satu kolom = satu variabel, panjang tiap
   kolom boleh berbeda; sel kosong diabaikan). Bisa diketik, ditempel dari
   Excel, diunggah dari file, atau dikirim dari menu Calc.
   Hasil: tabel ringkasan, langkah perhitungan, dan interpretasi otomatis.
   Muat SETELAH Method/Shared/impor-data.js (memakai StatCalcImport.register).
   Halaman dibuat otomatis (#view-deskriptif).
   ========================================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MAX_VARS = 12, MAX_ROWS = 2000;

  /* ------------------------------ Matematika ------------------------------ */
  const NUMRE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
  function toNum(v) {
    const ci = window.StatCalcImport;
    let s = String(v === undefined || v === null ? '' : v).trim();
    if (s === '') return null;
    if (!NUMRE.test(s) && ci && ci.normNum) { const n = ci.normNum(s); if (n !== null) s = n; }
    if (!NUMRE.test(s)) return NaN;
    return parseFloat(s);
  }
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  function quantile(sorted, p) {   // metode linear (sama dengan QUARTILE.INC / PERCENTILE.INC di Excel)
    const n = sorted.length; if (n === 1) return sorted[0];
    const h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  }
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function tCdf(t, df) { const x = df / (df + t * t), p = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? 1 - p : p; }
  function tCrit(df, conf) {   // dua sisi
    const target = 1 - (1 - conf) / 2; let lo = 0, hi = 1000;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (tCdf(mid, df) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  function describe(x) {
    const n = x.length, s = x.slice().sort((a, b) => a - b);
    const total = sum(x), mean = total / n;
    const ss = sum(x.map((v) => (v - mean) * (v - mean)));
    const variance = n > 1 ? ss / (n - 1) : NaN, sd = Math.sqrt(variance);
    const freq = new Map(); x.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
    let fmax = 0; freq.forEach((f) => { if (f > fmax) fmax = f; });
    const modes = fmax > 1 ? Array.from(freq.keys()).filter((k) => freq.get(k) === fmax).sort((a, b) => a - b) : [];
    const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), med = quantile(s, 0.5), iqr = q3 - q1;
    const se = sd / Math.sqrt(n);
    let ciLo = NaN, ciHi = NaN;
    if (n > 1 && Number.isFinite(se)) { const tc = tCrit(n - 1, 0.95); ciLo = mean - tc * se; ciHi = mean + tc * se; }
    let skew = NaN, kurt = NaN;
    if (n > 2 && sd > 0) skew = n / ((n - 1) * (n - 2)) * sum(x.map((v) => Math.pow((v - mean) / sd, 3)));
    if (n > 3 && sd > 0) kurt = n * (n + 1) / ((n - 1) * (n - 2) * (n - 3)) * sum(x.map((v) => Math.pow((v - mean) / sd, 4))) - 3 * Math.pow(n - 1, 2) / ((n - 2) * (n - 3));
    const lowF = q1 - 1.5 * iqr, upF = q3 + 1.5 * iqr;
    const outliers = x.filter((v) => v < lowF || v > upF).length;
    return { n, total, mean, median: med, modes, fmax, min: s[0], max: s[n - 1], range: s[n - 1] - s[0], q1, q3, iqr, ss, variance, sd, se, cv: mean !== 0 ? sd / Math.abs(mean) * 100 : NaN, skew, kurt, ciLo, ciHi, outliers, lowF, upF, sorted: s };
  }

  function fmt(v, d) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '–';
    d = d === undefined ? 4 : d;
    if (Math.abs(v) >= 1e9 || (v !== 0 && Math.abs(v) < 1e-4)) return v.toExponential(3);
    return String(Number(v.toFixed(d))).replace('.', ',');
  }
  const fmtDot = (v, d) => fmt(v, d).replace(',', '.');

  /* -------------------------------- Gaya --------------------------------- */
  const style = document.createElement('style');
  style.textContent = `
    #view-deskriptif .ds-bar{ display:grid; gap:10px; margin-top:10px; }
    #view-deskriptif .ds-bar.c1{ grid-template-columns:1fr; }
    #view-deskriptif .ds-bar.c2{ grid-template-columns:repeat(2,1fr); }
    #view-deskriptif .ds-bar.c3{ grid-template-columns:repeat(3,1fr); }
    #view-deskriptif .ds-bar .btn-ghost, #view-deskriptif .ds-bar .btn-primary{ width:100%; flex:none; padding-left:6px; padding-right:6px; line-height:1.25; }
    @media (max-width:480px){ #view-deskriptif .ds-bar .btn-ghost{ font-size:13px; } }
    #view-deskriptif .ds-vname{ width:100%; min-width:92px; border:none; background:transparent; text-align:center; font-weight:700; font-size:14px; font-family:var(--font-body); padding:8px 6px; color:var(--ink); min-height:var(--tap); }
    #view-deskriptif .ds-vname:focus{ outline:2px solid var(--accent-2); outline-offset:-2px; background:#fff; }
    #view-deskriptif .ds-res td.lbl, #view-deskriptif .ds-res th.lbl{ text-align:left; font-weight:600; background:var(--paper-2); white-space:nowrap; }
    #view-deskriptif .ds-note{ font-size:13px; color:var(--ink-soft); margin:10px 0 0; text-align:justify; text-justify:inter-word; hyphens:auto; }
    #view-deskriptif .ds-var{ margin:0 0 16px; padding:12px 14px; border:1px solid var(--rule); border-radius:var(--radius); background:#fff; }
    #view-deskriptif .ds-var h4{ margin:0 0 6px; font-size:15px; font-family:var(--font-body); }
    #view-deskriptif .ds-var p{ margin:6px 0 0; font-size:14px; line-height:1.55; text-align:justify; text-justify:inter-word; hyphens:auto; }
    #view-deskriptif .ds-formula{ display:block; font-family:var(--font-mono); font-size:13px; white-space:pre-wrap; background:var(--paper-2); border-radius:var(--radius); padding:10px 12px; margin:6px 0; overflow-x:auto; }
  `;
  document.head.appendChild(style);

  /* --------------------------- Markup halaman ---------------------------- */
  const section = document.createElement('section');
  section.className = 'view';
  section.id = 'view-deskriptif';
  section.innerHTML = `
    <div class="chapter-inner">
      <div class="chapter-head">
        <span class="eyebrow">Metode Statistik</span>
        <h1>Statistika Deskriptif</h1>
        <p class="lede">Ringkas data satu atau banyak variabel sekaligus: rata-rata, median, modus, ragam, simpangan baku, kuartil, kemencengan (skewness), keruncingan (kurtosis), selang kepercayaan rata-rata, dan pencilan, lengkap dengan langkah perhitungan dan interpretasi.</p>
      </div>

      <section class="card step-card" id="ds-data-card">
        <div class="step-tag">Langkah 1</div>
        <h2>Masukkan data</h2>
        <p class="hint">Setiap kolom adalah satu variabel; ubah nama variabel pada judul kolom. Panjang tiap kolom boleh berbeda (sel kosong diabaikan). Minimal <strong><span id="dsMin">2</span> data</strong> per variabel; maksimal ${MAX_VARS} variabel. Data bisa diketik, ditempel dari Excel, diunggah dari file, atau dikirim dari menu Calc.</p>
        <div class="table-scroll">
          <table class="data-table">
            <thead id="dsHead"></thead>
            <tbody id="dsBody"></tbody>
          </table>
        </div>
        <div class="ds-bar c3">
          <button type="button" class="btn-ghost" id="dsAdd">+ Tambah baris</button>
          <button type="button" class="btn-ghost" id="dsRemove">&minus; Hapus baris terakhir</button>
          <button type="button" class="btn-ghost" id="dsClear">Kosongkan</button>
        </div>
        <div class="ds-bar c2">
          <button type="button" class="btn-ghost" id="dsAddCol">+ Tambah variabel</button>
          <button type="button" class="btn-ghost" id="dsRemCol">&minus; Hapus variabel terakhir</button>
        </div>
        <div class="ds-bar c1">
          <button type="button" class="btn-ghost" id="dsSample">Isi contoh data</button>
          <button type="button" class="btn-primary" id="dsCalc">Hitung Statistika Deskriptif &rarr;</button>
        </div>
        <p class="error-msg" id="dsErr" hidden></p>
      </section>

      <section class="card step-card" id="ds-results-card" hidden>
        <div class="step-tag">Langkah 2</div>
        <h2>Hasil Statistika Deskriptif</h2>
        <nav class="tabs" id="dsTabs">
          <button type="button" class="tab-btn active" data-tab="ds-tab-sum">Ringkasan</button>
          <button type="button" class="tab-btn" data-tab="ds-tab-steps">Langkah Perhitungan</button>
          <button type="button" class="tab-btn" data-tab="ds-tab-interp">Interpretasi</button>
        </nav>
        <div class="tab-panel active" id="ds-tab-sum"><div id="dsSumWrap" class="table-scroll"></div></div>
        <div class="tab-panel" id="ds-tab-steps"><div id="dsStepsWrap" class="steps-wrap"></div></div>
        <div class="tab-panel" id="ds-tab-interp"><div id="dsInterpWrap"></div></div>
      </section>
    </div>`;
  document.body.insertBefore(section, $('#profileOverlay'));

  const q = (id) => $('#' + id, section);
  const head = q('dsHead'), body = q('dsBody');
  const state = { names: [] };

  /* ------------------------------ Tabel input ----------------------------- */
  function bodyCols() { return state.names.length; }
  function buildHead() {
    head.innerHTML = '<tr><th>#</th>' + state.names.map((n, j) => `<th><input class="ds-vname" data-j="${j}" value="${esc(n)}" aria-label="Nama variabel ${j + 1}" spellcheck="false"></th>`).join('') + '</tr>';
  }
  function addRow() {
    if (body.rows.length >= MAX_ROWS) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rownum"></td>` + state.names.map(() => '<td><input type="text" inputmode="decimal" placeholder="nilai"></td>').join('');
    body.appendChild(tr); renumber();
  }
  function renumber() { $$('tr', body).forEach((tr, i) => { tr.querySelector('.rownum').textContent = i + 1; }); }
  function build(nCols, nRows) {
    state.names = Array.from({ length: nCols }, (_, j) => state.names[j] || 'Variabel ' + (j + 1));
    buildHead(); body.innerHTML = '';
    for (let i = 0; i < nRows; i++) addRow();
  }
  function addCol() {
    if (state.names.length >= MAX_VARS) return;
    state.names.push('Variabel ' + (state.names.length + 1));
    $$('tr', body).forEach((tr) => { const td = document.createElement('td'); td.innerHTML = '<input type="text" inputmode="decimal" placeholder="nilai">'; tr.appendChild(td); });
    buildHead();
  }
  function remCol() {
    if (state.names.length <= 1) return;
    state.names.pop();
    $$('tr', body).forEach((tr) => tr.removeChild(tr.lastElementChild));
    buildHead();
  }
  head.addEventListener('input', (e) => { const i = e.target.closest('.ds-vname'); if (i) state.names[+i.dataset.j] = i.value; });
  q('dsAdd').addEventListener('click', addRow);
  q('dsRemove').addEventListener('click', () => { if (body.rows.length > 2) { body.deleteRow(body.rows.length - 1); renumber(); } });
  q('dsAddCol').addEventListener('click', addCol);
  q('dsRemCol').addEventListener('click', remCol);
  q('dsClear').addEventListener('click', () => { $$('input', body).forEach((i) => { i.value = ''; i.classList.remove('invalid'); }); hideErr(); });
  const SAMPLE = [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91, 74, 85, 69, 83, 77], [65, 70, 82, 60, 75, 88, 55, 72, 70, 84, 62, 78, 58, 74, 69]];
  q('dsSample').addEventListener('click', () => {
    state.names = ['Kelas A', 'Kelas B']; build(2, SAMPLE[0].length);
    $$('tr', body).forEach((tr, i) => $$('input', tr).forEach((inp, j) => { inp.value = SAMPLE[j][i]; }));
    hideErr();
  });
  state.names = ['Variabel 1']; build(1, 8);

  function showErr(m) { const e = q('dsErr'); e.textContent = m; e.hidden = false; }
  function hideErr() { q('dsErr').hidden = true; }

  /* Impor data (Tempel dari Excel / Unggah file) lewat modul bersama */
  if (window.StatCalcImport && window.StatCalcImport.register) {
    window.StatCalcImport.register({
      card: '#ds-data-card', body: '#dsBody', add: '#dsAdd', remove: '#dsRemove', minHint: '#dsMin', text: [],
      fitCols: (n) => { let g = 0; while (state.names.length < Math.min(n, MAX_VARS) && g++ < 30) addCol(); g = 0; while (state.names.length > Math.max(1, Math.min(n, MAX_VARS)) && g++ < 30) remCol(); },
      onApply: (info) => { (info.names || []).forEach((t, k) => { const j = (info.offset || 0) + k, v = String(t || '').trim(); if (v && j < state.names.length) { state.names[j] = v; const inp = $$('.ds-vname', head)[j]; if (inp) inp.value = v; } }); },
    });
  }

  /* -------------------------------- Hitung -------------------------------- */
  function collect() {
    const nv = bodyCols(), cols = Array.from({ length: nv }, () => []), bad = [];
    $$('input', body).forEach((i) => i.classList.remove('invalid'));
    $$('tr', body).forEach((tr, r) => $$('input', tr).forEach((inp, j) => {
      const v = toNum(inp.value);
      if (v === null) return;
      if (Number.isNaN(v)) { bad.push(`${state.names[j] || 'Variabel ' + (j + 1)} baris ${r + 1}`); inp.classList.add('invalid'); return; }
      cols[j].push(v);
    }));
    return { cols, bad };
  }
  q('dsCalc').addEventListener('click', () => {
    hideErr();
    const { cols, bad } = collect();
    if (bad.length) { showErr('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.'); return; }
    const used = [];
    cols.forEach((c, j) => { if (c.length) used.push({ name: (state.names[j] || 'Variabel ' + (j + 1)).trim() || 'Variabel ' + (j + 1), x: c }); });
    if (!used.length) { showErr('Belum ada data. Isi minimal satu variabel.'); return; }
    const small = used.filter((u) => u.x.length < 2);
    if (small.length) { showErr('Setiap variabel membutuhkan minimal 2 data: ' + small.map((u) => u.name).join(', ') + '.'); return; }
    used.forEach((u) => { u.d = describe(u.x); });
    renderSummary(used); renderSteps(used); renderInterp(used);
    q('ds-results-card').hidden = false;
    $$('#dsTabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'ds-tab-sum'));
    $$('.tab-panel', q('ds-results-card')).forEach((p) => p.classList.toggle('active', p.id === 'ds-tab-sum'));
    publish(used);
    q('ds-results-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
  });
  q('dsTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn'); if (!btn) return;
    $$('#dsTabs .tab-btn').forEach((b) => b.classList.remove('active')); btn.classList.add('active');
    $$('.tab-panel', q('ds-results-card')).forEach((p) => p.classList.remove('active'));
    q(btn.dataset.tab).classList.add('active');
  });

  const ROWS = [
    ['Banyak data (n)', (d) => String(d.n)],
    ['Jumlah (Σx)', (d) => fmt(d.total)],
    ['Rata-rata (mean)', (d) => fmt(d.mean)],
    ['Median', (d) => fmt(d.median)],
    ['Modus', (d) => (d.modes.length ? d.modes.slice(0, 4).map((v) => fmt(v)).join('; ') + (d.modes.length > 4 ? '; …' : '') + ` (${d.fmax}×)` : 'tidak ada')],
    ['Minimum', (d) => fmt(d.min)],
    ['Maksimum', (d) => fmt(d.max)],
    ['Rentang (range)', (d) => fmt(d.range)],
    ['Kuartil 1 (Q1)', (d) => fmt(d.q1)],
    ['Kuartil 3 (Q3)', (d) => fmt(d.q3)],
    ['Jangkauan antarkuartil (IQR)', (d) => fmt(d.iqr)],
    ['Ragam sampel (s²)', (d) => fmt(d.variance)],
    ['Simpangan baku (s)', (d) => fmt(d.sd)],
    ['Galat baku rata-rata (SE)', (d) => fmt(d.se)],
    ['Koefisien variasi (%)', (d) => fmt(d.cv, 2)],
    ['Skewness', (d) => fmt(d.skew)],
    ['Kurtosis (excess)', (d) => fmt(d.kurt)],
    ['Batas bawah CI 95% rata-rata', (d) => fmt(d.ciLo)],
    ['Batas atas CI 95% rata-rata', (d) => fmt(d.ciHi)],
    ['Pencilan (1,5×IQR)', (d) => String(d.outliers)],
  ];
  function renderSummary(used) {
    let h = `<table class="result-table ds-res"><caption>Ringkasan statistik deskriptif</caption><thead><tr><th class="lbl">Statistik</th>${used.map((u) => `<th>${esc(u.name)}</th>`).join('')}</tr></thead><tbody>`;
    ROWS.forEach((r) => { h += `<tr><td class="lbl">${r[0]}</td>${used.map((u) => `<td>${r[1](u.d)}</td>`).join('')}</tr>`; });
    h += '</tbody></table>';
    h += '<p class="ds-note">Ragam dan simpangan baku memakai pembagi (n − 1) seperti VAR.S dan STDEV.S di Excel. Kuartil memakai interpolasi linear (QUARTILE.INC). Skewness dan kurtosis memakai rumus sampel seperti SKEW dan KURT di Excel (kurtosis dinyatakan sebagai excess, normal = 0). Tanda &ldquo;–&rdquo; berarti belum dapat dihitung karena datanya terlalu sedikit.</p>';
    q('dsSumWrap').innerHTML = h;
  }

  function renderSteps(used) {
    const u = used[0], d = u.d, x = u.x;
    const short = (a) => a.length > 12 ? a.slice(0, 12).map((v) => fmt(v, 2)).join(', ') + ', …' : a.map((v) => fmt(v, 2)).join(', ');
    const steps = [];
    steps.push({ t: 'Rumus yang dipakai', f: 'Mean: x̄ = Σx / n\nMedian: nilai tengah data terurut\nModus: nilai yang paling sering muncul\nRagam: s² = Σ(x − x̄)² / (n − 1)\nSimpangan baku: s = √s²\nGalat baku: SE = s / √n\nKoef. variasi: CV = s / |x̄| × 100%\nCI 95%: x̄ ± t(0,975; n−1) · SE\nQ1, Q3: kuantil 25% dan 75% (interpolasi linear)\nPencilan: x < Q1 − 1,5·IQR atau x > Q3 + 1,5·IQR', n: 'Rumus berlaku untuk setiap variabel. Contoh perhitungan di bawah memakai variabel pertama: ' + u.name + '.' });
    steps.push({ t: `Data variabel “${u.name}” (terurut)`, f: `n = ${d.n}\nData terurut: ${short(d.sorted)}`, n: 'Data diurutkan dari terkecil ke terbesar untuk mencari median, kuartil, minimum, dan maksimum.' });
    steps.push({ t: 'Mean', f: `Σx = ${fmt(d.total)}\nx̄ = ${fmt(d.total)} / ${d.n} = ${fmt(d.mean)}`, n: '' });
    const mid = d.n % 2 ? `data ke-${(d.n + 1) / 2}` : `rata-rata data ke-${d.n / 2} dan ke-${d.n / 2 + 1}`;
    steps.push({ t: 'Median & modus', f: `Median = ${mid} = ${fmt(d.median)}\nModus = ${d.modes.length ? d.modes.map((v) => fmt(v)).join('; ') + ` (muncul ${d.fmax} kali)` : 'tidak ada (semua nilai muncul sekali)'}`, n: '' });
    steps.push({ t: 'Ragam & simpangan baku', f: `Σ(x − x̄)² = ${fmt(d.ss)}\ns² = ${fmt(d.ss)} / (${d.n} − 1) = ${fmt(d.variance)}\ns = √${fmt(d.variance)} = ${fmt(d.sd)}`, n: 'Selisih tiap data dari rata-rata dikuadratkan lalu dijumlahkan, kemudian dibagi (n − 1).' });
    steps.push({ t: 'Galat baku, koefisien variasi & CI 95%', f: `SE = ${fmt(d.sd)} / √${d.n} = ${fmt(d.se)}\nCV = ${fmt(d.sd)} / ${fmt(Math.abs(d.mean))} × 100% = ${fmt(d.cv, 2)}%\nt(0,975; ${d.n - 1}) = ${fmt(tCrit(d.n - 1, 0.95), 4)}\nCI 95% = ${fmt(d.mean)} ± ${fmt(tCrit(d.n - 1, 0.95), 4)} × ${fmt(d.se)} = [${fmt(d.ciLo)} ; ${fmt(d.ciHi)}]`, n: '' });
    steps.push({ t: 'Kuartil & pencilan', f: `Q1 = ${fmt(d.q1)}, Q3 = ${fmt(d.q3)}, IQR = ${fmt(d.iqr)}\nBatas pencilan: [${fmt(d.lowF)} ; ${fmt(d.upF)}]\nJumlah pencilan = ${d.outliers}`, n: '' });
    q('dsStepsWrap').innerHTML = steps.map((s, i) => `<div class="step-block" data-step="${i + 1}"><h4>${esc(s.t)}</h4><span class="formula">${esc(s.f)}</span>${s.n ? `<p>${esc(s.n)}</p>` : ''}</div>`).join('');
  }

  function renderInterp(used) {
    const skewTxt = (s) => !Number.isFinite(s) ? null : Math.abs(s) < 0.5 ? 'hampir simetris' : s > 0 ? (Math.abs(s) < 1 ? 'agak menceng ke kanan (ekor kanan lebih panjang)' : 'menceng kuat ke kanan (ekor kanan panjang)') : (Math.abs(s) < 1 ? 'agak menceng ke kiri (ekor kiri lebih panjang)' : 'menceng kuat ke kiri (ekor kiri panjang)');
    const kurtTxt = (k) => !Number.isFinite(k) ? null : Math.abs(k) < 0.5 ? 'keruncingan mendekati distribusi normal' : k > 0 ? 'lebih runcing dari distribusi normal (ekor lebih tebal)' : 'lebih landai dari distribusi normal (ekor lebih tipis)';
    const cvTxt = (c) => !Number.isFinite(c) ? null : c < 10 ? 'sangat homogen' : c < 20 ? 'cukup homogen' : c < 30 ? 'cukup bervariasi' : 'sangat bervariasi';
    let h = used.map((u) => {
      const d = u.d, parts = [];
      parts.push(`Dari <strong>${d.n} data</strong>, rata-rata <strong>${fmt(d.mean)}</strong> dengan simpangan baku <strong>${fmt(d.sd)}</strong>. Nilai tengah (median) ${fmt(d.median)}, nilai terendah ${fmt(d.min)} dan tertinggi ${fmt(d.max)} (rentang ${fmt(d.range)}). Dengan tingkat kepercayaan 95%, rata-rata populasi diperkirakan berada pada selang <strong>${fmt(d.ciLo)} sampai ${fmt(d.ciHi)}</strong>.`);
      const cv = cvTxt(d.cv), sk = skewTxt(d.skew), ku = kurtTxt(d.kurt);
      const bits = [];
      if (cv) bits.push(`Koefisien variasi ${fmt(d.cv, 2)}% menunjukkan data ${cv}`);
      if (sk) bits.push(`sebaran data ${sk} (skewness ${fmt(d.skew, 3)})`);
      if (ku) bits.push(`${ku} (kurtosis ${fmt(d.kurt, 3)})`);
      if (bits.length) parts.push(bits.join('; ') + '.');
      const mm = Math.abs(d.mean - d.median) / (d.sd || 1);
      if (Number.isFinite(mm) && mm >= 0.2) parts.push(`Rata-rata ${d.mean > d.median ? 'lebih besar' : 'lebih kecil'} dari median, tanda data dipengaruhi nilai ${d.mean > d.median ? 'besar' : 'kecil'} yang ekstrem.`);
      parts.push(d.outliers ? `Terdapat <strong>${d.outliers} pencilan</strong> menurut aturan 1,5×IQR (di luar ${fmt(d.lowF)} sampai ${fmt(d.upF)}); periksa apakah itu salah catat atau nilai yang memang wajar.` : 'Tidak ada pencilan menurut aturan 1,5×IQR.');
      return `<div class="ds-var"><h4>${esc(u.name)}</h4>${parts.map((p) => `<p>${p}</p>`).join('')}</div>`;
    }).join('');
    if (used.length > 1) {
      const by = used.slice().sort((a, b) => b.d.mean - a.d.mean);
      h += `<div class="ds-var"><h4>Perbandingan antarvariabel</h4><p>Rata-rata tertinggi: <strong>${esc(by[0].name)}</strong> (${fmt(by[0].d.mean)}); terendah: <strong>${esc(by[by.length - 1].name)}</strong> (${fmt(by[by.length - 1].d.mean)}). Variabel paling bervariasi (simpangan baku terbesar): <strong>${esc(used.slice().sort((a, b) => b.d.sd - a.d.sd)[0].name)}</strong>. Untuk menguji apakah perbedaan rata-rata signifikan secara statistik, lanjutkan dengan ANOVA atau uji t.</p></div>`;
    }
    q('dsInterpWrap').innerHTML = h;
  }

  function publish(used) {
    try {
      const SE = window.StatExport; if (!SE) return;
      const n = Math.max.apply(null, used.map((u) => u.x.length));
      SE.publish({
        id: 'deskriptif', title: 'Statistika Deskriptif', anchor: '#ds-results-card', resultsCard: '#ds-results-card',
        meta: [['Metode', 'Statistika Deskriptif'], ['Jumlah variabel', used.length], ['Variabel', used.map((u) => u.name).join(', ')]],
        sections: [{ heading: 'Ringkasan Statistik', sel: '#dsSumWrap' }, { heading: 'Langkah Perhitungan', sel: '#dsStepsWrap' }, { heading: 'Interpretasi', sel: '#dsInterpWrap' }],
        data: { head: ['#'].concat(used.map((u) => u.name)), rows: Array.from({ length: n }, (_, i) => [i + 1].concat(used.map((u) => (i < u.x.length ? u.x[i] : '')))), caption: 'Data yang dipakai pada perhitungan.' },
        charts: [],
      });
    } catch (e) { /* ekspor opsional */ }
  }

  window.StatCalcDeskriptif = { describe, tCrit };
})();
