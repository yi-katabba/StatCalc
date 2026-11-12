/* =========================================================================
   KORELASI - Pearson, Spearman, Kendall tau-b (Method > Stat > Basic Statistics)
   -------------------------------------------------------------------------
   Input: dua sampai 12 variabel (satu kolom = satu variabel; sel kosong = data hilang, tiap pasangan
   variabel memakai baris yang lengkap di kedua kolom). Hasil: matriks koefisien, matriks p-value,
   tabel pasangan (selang kepercayaan untuk Pearson), langkah perhitungan, interpretasi.
   Hitungan di basic-core.js (diuji terhadap SciPy). Halaman dibuat otomatis (#view-korelasi).
   ========================================================================= */
(function () {
  'use strict';
  const B = window.StatBasic, U = window.StatBasicUI, D = window.StatDist;
  if (!B || !U || !D) return;
  const { esc, toNum, fmt, fmtP, pct, corrStrength } = U;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const MAX_VARS = 12, MAX_ROWS = 2000;
  const METHOD_NAME = { pearson: 'Pearson (r)', spearman: 'Spearman (ρ)', kendall: 'Kendall (tau-b, τ)' };
  const SYM = { pearson: 'r', spearman: 'ρ', kendall: 'τ' };

  const section = document.createElement('section');
  section.className = 'view';
  section.id = 'view-korelasi';
  section.innerHTML = `
    <div class="chapter-inner">
      <div class="chapter-head ch-wide">
        <span class="eyebrow">Metode Statistik &rsaquo; Basic Statistics</span>
        <h1>Korelasi</h1>
        <p class="lede">Ukur kekuatan dan arah hubungan antar variabel numerik dengan korelasi Pearson (linear), Spearman, atau Kendall (berbasis peringkat, tahan pencilan). Hasil berupa matriks koefisien, p-value tiap pasangan, selang kepercayaan (Pearson), langkah perhitungan, dan interpretasi.</p>
      </div>

      <section class="card step-card" id="kr-data-card">
        <div class="step-tag">Langkah 1</div>
        <h2>Atur analisis &amp; masukkan data</h2>
        <div class="bs-set">
          <label>Jenis korelasi
            <select id="krMethod" class="select-input">
              <option value="pearson">Pearson (hubungan linear)</option>
              <option value="spearman">Spearman (peringkat)</option>
              <option value="kendall">Kendall tau-b (peringkat)</option>
            </select>
          </label>
          <label>Tingkat signifikansi (α)
            <select id="krAlpha" class="select-input">
              <option value="0.10">0,10 (CI 90%)</option>
              <option value="0.05" selected>0,05 (CI 95%)</option>
              <option value="0.01">0,01 (CI 99%)</option>
            </select>
          </label>
        </div>
        <p class="hint">Setiap kolom adalah satu variabel; ubah nama variabel pada judul kolom. Minimal 2 variabel dan <strong><span id="krMin">3</span> baris lengkap</strong> per pasangan; maksimal ${MAX_VARS} variabel dan ${MAX_ROWS} baris. Sel kosong diabaikan per pasangan.</p>
        <div class="table-scroll">
          <table class="data-table">
            <thead id="krHead"></thead>
            <tbody id="krBody"></tbody>
          </table>
        </div>
        <div class="bs-bar c5">
          ${window.StatSlateBtn('rowadd', 'Tambah baris', '', 'krAdd')}
          ${window.StatSlateBtn('rowdel', 'Hapus baris terakhir', '', 'krRemove')}
          ${window.StatSlateBtn('clear', 'Kosongkan', '', 'krClear')}
          ${window.StatSlateBtn('coladd', 'Tambah variabel', '', 'krAddCol')}
          ${window.StatSlateBtn('coldel', 'Hapus variabel terakhir', '', 'krRemCol')}
        </div>
        <div class="bs-bar c1">
          <button type="button" class="btn-ghost" id="krSample">Isi contoh data</button>
          <button type="button" class="btn-primary" id="krCalc">Hitung Korelasi &rarr;</button>
        </div>
        <p class="error-msg" id="krErr" hidden></p>
      </section>

      <section class="card step-card" id="kr-results-card" hidden>
        <div class="step-tag">Langkah 2</div>
        <h2>Hasil Korelasi</h2>
        <nav class="tabs" id="krTabs">
          <button type="button" class="tab-btn active" data-tab="kr-tab-sum">Ringkasan</button>
          <button type="button" class="tab-btn" data-tab="kr-tab-steps">Langkah Perhitungan</button>
          <button type="button" class="tab-btn" data-tab="kr-tab-interp">Interpretasi</button>
        </nav>
        <div class="tab-panel active" id="kr-tab-sum"><div id="krSumWrap" class="table-scroll bs-wrap"></div></div>
        <div class="tab-panel" id="kr-tab-steps"><div id="krStepsWrap" class="steps-wrap"></div></div>
        <div class="tab-panel" id="kr-tab-interp"><div id="krInterpWrap"></div></div>
      </section>
    </div>`;
  document.body.insertBefore(section, $('#profileOverlay'));
  if (window.StatRibbon) window.StatRibbon.mount({
    view: '#view-korelasi', key: 'korelasi',
    tabs: [
      { id: 'hasil', label: 'Hasil', groups: [
        { label: 'Tab hasil', cols: 2, items: [
          { type: 'toggle', key: 'sum', label: 'Ringkasan', tab: 'kr-tab-sum' },
          { type: 'toggle', key: 'stp', label: 'Langkah Perhitungan', tab: 'kr-tab-steps' },
          { type: 'toggle', key: 'int', label: 'Interpretasi', tab: 'kr-tab-interp' },
          { type: 'toggle', key: 'gr', label: 'Grafik', tab: 'korelasi-tab-gp' },
        ] },
      ], tip: 'Pengaturan pita hanya menyembunyikan atau menampilkan bagian hasil; perhitungan tidak berubah. Untuk melihat bentuk hubungan, buka Scatter Plot, Matrix Plot, atau Heatmap Korelasi di menu Graph.' },
      { id: 'ekspor', label: 'Ekspor', groups: [
        { label: 'Unduhan', items: [
          { type: 'toggle', key: 'dl', label: 'Panel unduhan (.docx/.zip)', hide: ['.ex-panel', '.ex-bar'] },
        ] },
      ] },
    ],
  });

  const q = (id) => $('#' + id, section);
  const head = q('krHead'), body = q('krBody');
  const state = { names: [] };

  /* ------------------------------ Tabel input ----------------------------- */
  function buildHead() {
    head.innerHTML = '<tr><th>#</th>' + state.names.map((n, j) => `<th><input class="bs-vname" data-j="${j}" value="${esc(n)}" aria-label="Nama variabel ${j + 1}" spellcheck="false"></th>`).join('') + '</tr>';
  }
  function renumber() { $$('tr', body).forEach((tr, i) => { tr.querySelector('.rownum').textContent = i + 1; }); }
  function addRow() {
    if (body.rows.length >= MAX_ROWS) return;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="rownum"></td>' + state.names.map(() => '<td><input type="text" inputmode="decimal" placeholder="nilai"></td>').join('');
    body.appendChild(tr); renumber();
  }
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
    if (state.names.length <= 2) return;
    state.names.pop();
    $$('tr', body).forEach((tr) => tr.removeChild(tr.lastElementChild));
    buildHead();
  }
  head.addEventListener('input', (e) => { const i = e.target.closest('.bs-vname'); if (i) state.names[+i.dataset.j] = i.value; });
  q('krAdd').addEventListener('click', addRow);
  q('krRemove').addEventListener('click', () => { if (body.rows.length > 3) { body.deleteRow(body.rows.length - 1); renumber(); } });
  q('krAddCol').addEventListener('click', addCol);
  q('krRemCol').addEventListener('click', remCol);
  q('krClear').addEventListener('click', () => { $$('input', body).forEach((i) => { i.value = ''; i.classList.remove('invalid'); }); hideErr(); });
  const SAMPLE = {
    names: ['Jam belajar', 'Nilai ujian', 'Jam tidur'],
    cols: [[2, 3, 4, 5, 6, 7, 8, 9, 10, 4, 6, 8], [55, 60, 62, 70, 72, 78, 85, 88, 95, 58, 71, 82], [8, 7, 7, 6, 7, 6, 5, 6, 5, 8, 6, 5]],
  };
  q('krSample').addEventListener('click', () => {
    state.names = SAMPLE.names.slice(); build(3, SAMPLE.cols[0].length);
    $$('tr', body).forEach((tr, i) => $$('input', tr).forEach((inp, j) => { inp.value = SAMPLE.cols[j][i]; }));
    hideErr();
  });
  state.names = ['Variabel 1', 'Variabel 2']; build(2, 8);

  function showErr(m) { const e = q('krErr'); e.textContent = m; e.hidden = false; }
  function hideErr() { q('krErr').hidden = true; }

  if (window.StatCalcImport && window.StatCalcImport.register) {
    window.StatCalcImport.register({
      card: '#kr-data-card', body: '#krBody', add: '#krAdd', remove: '#krRemove', minHint: '#krMin', text: [],
      fitCols: (n) => { let g = 0; while (state.names.length < Math.min(Math.max(n, 2), MAX_VARS) && g++ < 30) addCol(); g = 0; while (state.names.length > Math.max(2, Math.min(n, MAX_VARS)) && g++ < 30) remCol(); },
      onApply: (info) => { (info.names || []).forEach((t, k) => { const j = (info.offset || 0) + k, v = String(t || '').trim(); if (v && j < state.names.length) { state.names[j] = v; const inp = $$('.bs-vname', head)[j]; if (inp) inp.value = v; } }); },
    });
  }

  /* -------------------------------- Hitung -------------------------------- */
  function collect() {
    const nv = state.names.length, cols = Array.from({ length: nv }, () => []), bad = [];
    $$('tr', body).forEach((tr, r) => $$('input', tr).forEach((inp, j) => {
      inp.classList.remove('invalid');
      const v = toNum(inp.value);
      if (Number.isNaN(v)) { bad.push(`${state.names[j] || 'Variabel ' + (j + 1)} baris ${r + 1}`); inp.classList.add('invalid'); cols[j].push(null); } else cols[j].push(v);
    }));
    return { cols, bad };
  }
  function pairData(cols, i, j) {
    const x = [], y = [];
    for (let r = 0; r < cols[i].length; r++) { const a = cols[i][r], b = cols[j][r]; if (a !== null && b !== null) { x.push(a); y.push(b); } }
    return { x, y };
  }
  function run() {
    hideErr();
    const method = q('krMethod').value, alpha = parseFloat(q('krAlpha').value), conf = 1 - alpha;
    const { cols: all, bad } = collect();
    if (bad.length) { showErr('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.'); return; }
    const keep = []; all.forEach((c, j) => { if (c.some((v) => v !== null)) keep.push(j); });
    if (keep.length < 2) { showErr('Isi minimal dua variabel dengan data.'); return; }
    const names = keep.map((j) => (String(state.names[j]).trim() || 'Variabel ' + (j + 1))), cols = keep.map((j) => all[j]);
    const M = B.corrMatrix(cols, method), k = cols.length;
    let ok = 0;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (Number.isFinite(M.R[i][j])) ok++;
    if (!ok) {
      const maxN = Math.max.apply(null, M.N.map((r, i) => Math.max.apply(null, r.map((v, j) => (i === j ? 0 : v)))));
      showErr(maxN < 3 ? 'Tidak ada pasangan variabel dengan minimal 3 baris lengkap.' : 'Korelasi tidak dapat dihitung: salah satu variabel pada tiap pasangan bernilai konstan (tidak bervariasi).');
      return;
    }
    const ctx = { method, alpha, conf, names, cols, M, k };
    renderSummary(ctx); renderSteps(ctx); renderInterp(ctx);
    q('kr-results-card').hidden = false;
    $$('#krTabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'kr-tab-sum'));
    $$('.tab-panel', q('kr-results-card')).forEach((p) => p.classList.toggle('active', p.id === 'kr-tab-sum'));
    publish(ctx);
    q('kr-results-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
  }
  q('krCalc').addEventListener('click', run);
  q('krTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn'); if (!btn) return;
    $$('#krTabs .tab-btn').forEach((b) => b.classList.remove('active')); btn.classList.add('active');
    $$('.tab-panel', q('kr-results-card')).forEach((p) => p.classList.remove('active'));
    q(btn.dataset.tab).classList.add('active');
  });

  /* ------------------------------ Tampilan hasil ------------------------------ */
  function pairs(c) {
    const out = [];
    for (let i = 0; i < c.k; i++) for (let j = i + 1; j < c.k; j++) {
      const r = c.M.R[i][j], p = c.M.P[i][j], n = c.M.N[i][j];
      let stat = NaN, ci = [NaN, NaN];
      if (Number.isFinite(r)) {
        if (c.method === 'kendall') { const { x, y } = pairData(c.cols, i, j); stat = B.kendall(x, y).z; }
        else { stat = B.rTest(r, n).t; if (c.method === 'pearson') ci = B.fisherCI(r, n, c.conf); }
      }
      out.push({ i, j, r, p, n, stat, ci });
    }
    return out;
  }
  function renderSummary(c) {
    const { method, alpha, conf, names, M, k } = c, sy = SYM[method];
    const mat = (cap, f, cls) => {
      let h = `<table class="result-table bs-res"><caption>${cap}</caption><thead><tr><th class="lbl"></th>${names.map((n) => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>`;
      for (let i = 0; i < k; i++) { h += `<tr><td class="lbl">${esc(names[i])}</td>`; for (let j = 0; j < k; j++) h += f(i, j); h += '</tr>'; }
      return h + '</tbody></table>';
    };
    let h = mat(`Matriks koefisien korelasi ${METHOD_NAME[method]}`, (i, j) => {
      if (i === j) return '<td>1</td>';
      const r = M.R[i][j], sig = M.P[i][j] < alpha;
      return `<td class="${sig ? 'sig' : ''}">${Number.isFinite(r) ? fmt(r, 3) + (sig ? '*' : '') : '-'}</td>`;
    });
    h += mat('Matriks p-value (uji H₀: tidak ada korelasi)', (i, j) => (i === j ? '<td>-</td>' : `<td class="${M.P[i][j] < alpha ? 'sig' : ''}">${fmtP(M.P[i][j])}</td>`));
    const ns = new Set(); for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) ns.add(M.N[i][j]);
    if (ns.size > 1) h += mat('Banyak pasangan data (n) tiap pasangan', (i, j) => `<td>${M.N[i][j]}</td>`);
    const P = pairs(c);
    const statHd = method === 'kendall' ? 'z' : 't';
    h += `<table class="result-table bs-res"><caption>Daftar pasangan variabel</caption><thead><tr><th class="lbl">Pasangan</th><th>n</th><th>${sy}</th><th>${statHd}</th><th>p-value</th>${method === 'pearson' ? `<th>CI ${pct(conf)}</th>` : ''}<th>Kekuatan</th><th>Keputusan</th></tr></thead><tbody>`;
    P.forEach((p) => {
      const sig = p.p < alpha, has = Number.isFinite(p.r);
      h += `<tr><td class="lbl">${esc(names[p.i])} — ${esc(names[p.j])}</td><td>${p.n}</td><td>${has ? fmt(p.r, 3) : '-'}</td><td>${has ? fmt(p.stat, 3) : '-'}</td><td class="${sig ? 'sig' : ''}">${has ? fmtP(p.p) : '-'}</td>${method === 'pearson' ? `<td>${Number.isFinite(p.ci[0]) ? '[' + fmt(p.ci[0], 3) + ' ; ' + fmt(p.ci[1], 3) + ']' : '-'}</td>` : ''}<td>${has ? corrStrength(p.r) + (p.r < 0 ? ' (negatif)' : ' (positif)') : '-'}</td><td>${has ? `<span class="bs-dec ${sig ? 'rej' : 'keep'}">${sig ? 'Signifikan' : 'Tidak signifikan'}</span>` : '-'}</td></tr>`;
    });
    h += '</tbody></table>';
    h += `<p class="bs-note">Tanda * pada matriks = signifikan pada α = ${fmt(alpha, 2)}. ${method === 'pearson' ? 'Selang kepercayaan memakai transformasi z Fisher.' : method === 'spearman' ? 'Spearman = korelasi Pearson pada peringkat (nilai kembar diberi peringkat rata-rata); p-value dari distribusi t dengan df = n − 2.' : 'Kendall tau-b memperhitungkan nilai kembar; p-value memakai pendekatan normal dengan koreksi nilai kembar, sehingga untuk n sangat kecil bisa sedikit berbeda dari uji eksak.'} Pasangan dengan data kurang dari 3 baris lengkap atau variabel konstan ditampilkan “-”.</p>`;
    q('krSumWrap').innerHTML = h;
  }

  function renderSteps(c) {
    const { method, alpha, conf, names, cols } = c;
    const P = pairs(c).find((p) => Number.isFinite(p.r));
    const { x, y } = pairData(cols, P.i, P.j), n = x.length, nx = names[P.i], ny = names[P.j];
    const steps = [];
    const hyp = { t: 'Hipotesis', f: `H₀: ${method === 'pearson' ? 'ρ' : method === 'spearman' ? 'ρs' : 'τ'} = 0  (tidak ada hubungan)\nH₁: ${method === 'pearson' ? 'ρ' : method === 'spearman' ? 'ρs' : 'τ'} ≠ 0\nα = ${fmt(alpha, 2)}`, n: '' };
    if (method === 'pearson') {
      const pr = B.pearson(x, y), t = B.rTest(pr.r, n), ci = B.fisherCI(pr.r, n, conf);
      steps.push({ t: 'Rumus yang dipakai', f: 'r = Σ(x − x̄)(y − ȳ) / √[Σ(x − x̄)² · Σ(y − ȳ)²]\nt = r · √(n − 2) / √(1 − r²),  df = n − 2\nCI: z\' = atanh(r),  SE = 1/√(n − 3),  batas = tanh(z\' ± z(1−α/2) · SE)', n: `Contoh dihitung untuk pasangan pertama: ${nx} dan ${ny}. Pasangan lain memakai rumus yang sama.` });
      steps.push(hyp);
      steps.push({ t: 'Jumlah kuadrat & hasil kali', f: `n = ${n}\nx̄ = ${fmt(pr.mx)},  ȳ = ${fmt(pr.my)}\nΣ(x − x̄)² = ${fmt(pr.sxx)}\nΣ(y − ȳ)² = ${fmt(pr.syy)}\nΣ(x − x̄)(y − ȳ) = ${fmt(pr.sxy)}`, n: '' });
      steps.push({ t: 'Koefisien korelasi', f: `r = ${fmt(pr.sxy)} / √(${fmt(pr.sxx)} × ${fmt(pr.syy)}) = ${fmt(pr.r, 4)}\nr² = ${fmt(pr.r * pr.r, 4)}`, n: `r² = ${fmt(pr.r * pr.r * 100, 2)}% variasi salah satu variabel dapat dijelaskan secara linear oleh variabel lainnya.` });
      steps.push({ t: 'Uji signifikansi', f: `t = ${fmt(pr.r, 4)} × √(${n} − 2) / √(1 − ${fmt(pr.r * pr.r, 4)}) = ${fmt(t.t, 4)}\ndf = ${t.df}\np-value = ${fmtP(t.p)}\nKeputusan: ${t.p < alpha ? 'tolak' : 'gagal menolak'} H₀ (α = ${fmt(alpha, 2)})`, n: '' });
      steps.push({ t: `Selang kepercayaan ${pct(conf)}`, f: Number.isFinite(ci[0]) ? `z' = atanh(${fmt(pr.r, 4)}) = ${fmt(Math.atanh(pr.r), 4)}\nSE = 1 / √(${n} − 3) = ${fmt(1 / Math.sqrt(n - 3), 4)}\nCI ρ = [${fmt(ci[0], 4)} ; ${fmt(ci[1], 4)}]` : 'Tidak dapat dihitung (butuh n > 3 dan |r| < 1).', n: '' });
    } else if (method === 'spearman') {
      const rx = B.ranks(x), ry = B.ranks(y), sp = B.spearman(x, y), sh = (a) => (a.length > 12 ? a.slice(0, 12).map((v) => fmt(v, 1)).join(', ') + ', …' : a.map((v) => fmt(v, 1)).join(', '));
      steps.push({ t: 'Rumus yang dipakai', f: 'Ubah tiap variabel menjadi peringkat (nilai kembar → peringkat rata-rata)\nρs = korelasi Pearson antara peringkat x dan peringkat y\nt = ρs · √(n − 2) / √(1 − ρs²),  df = n − 2', n: `Contoh dihitung untuk pasangan pertama: ${nx} dan ${ny}.` });
      steps.push(hyp);
      steps.push({ t: 'Peringkat', f: `n = ${n}\nPeringkat ${nx}: ${sh(rx)}\nPeringkat ${ny}: ${sh(ry)}`, n: '' });
      steps.push({ t: 'Koefisien Spearman', f: `ρs = Pearson(peringkat x, peringkat y) = ${fmt(sp.r, 4)}`, n: '' });
      steps.push({ t: 'Uji signifikansi', f: `t = ${fmt(sp.r, 4)} × √(${n} − 2) / √(1 − ${fmt(sp.r * sp.r, 4)}) = ${fmt(sp.t, 4)}\ndf = ${sp.df}\np-value = ${fmtP(sp.p)}\nKeputusan: ${sp.p < alpha ? 'tolak' : 'gagal menolak'} H₀ (α = ${fmt(alpha, 2)})`, n: 'Pendekatan distribusi t baik untuk n ≥ 10; untuk n sangat kecil p-value hanya perkiraan.' });
    } else {
      const kd = B.kendall(x, y);
      steps.push({ t: 'Rumus yang dipakai', f: 'Untuk tiap pasangan observasi: konkordan (urutan x dan y sama) atau diskordan (berlawanan)\nτb = (C − D) / √[(n₀ − n₁)(n₀ − n₂)],  n₀ = n(n − 1)/2\nn₁, n₂ = Σ t(t − 1)/2 untuk nilai kembar pada x dan y\nz = (C − D) / √Var,  p-value dua sisi dari distribusi normal', n: `Contoh dihitung untuk pasangan pertama: ${nx} dan ${ny}.` });
      steps.push(hyp);
      steps.push({ t: 'Pasangan konkordan & diskordan', f: `n = ${n},  n₀ = ${kd.n0}\nKonkordan (C) = ${kd.con}\nDiskordan (D) = ${kd.dis}\nC − D = ${kd.S}\nn₁ = ${kd.n1},  n₂ = ${kd.n2}  (koreksi nilai kembar)`, n: '' });
      steps.push({ t: 'Koefisien Kendall tau-b', f: `τb = ${kd.S} / √[(${kd.n0} − ${kd.n1})(${kd.n0} − ${kd.n2})] = ${fmt(kd.r, 4)}`, n: '' });
      steps.push({ t: 'Uji signifikansi', f: `z = ${fmt(kd.z, 4)}\np-value = ${fmtP(kd.p)}\nKeputusan: ${kd.p < alpha ? 'tolak' : 'gagal menolak'} H₀ (α = ${fmt(alpha, 2)})`, n: '' });
    }
    q('krStepsWrap').innerHTML = steps.map((s, i) => `<div class="step-block" data-step="${i + 1}"><h4>${esc(s.t)}</h4><span class="formula">${esc(s.f)}</span>${s.n ? `<p>${esc(s.n)}</p>` : ''}</div>`).join('');
  }

  function renderInterp(c) {
    const { method, alpha, names } = c, sy = SYM[method];
    const P = pairs(c).filter((p) => Number.isFinite(p.r)).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const shown = P.slice(0, 15);
    let h = shown.map((p) => {
      const sig = p.p < alpha, dir = p.r > 0 ? 'positif' : 'negatif';
      const meaning = p.r > 0 ? `semakin tinggi ${esc(names[p.i])}, cenderung semakin tinggi ${esc(names[p.j])}` : `semakin tinggi ${esc(names[p.i])}, cenderung semakin rendah ${esc(names[p.j])}`;
      const parts = [`Korelasi <strong>${corrStrength(p.r)}</strong> dan <strong>${dir}</strong> (${sy} = ${fmt(p.r, 3)}, n = ${p.n}). p-value = ${fmtP(p.p)} ${sig ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga hubungan ini <strong>${sig ? 'signifikan' : 'tidak signifikan'}</strong>.`];
      if (sig) parts.push(`Artinya ${meaning}.` + (method === 'pearson' ? ` Sekitar ${fmt(p.r * p.r * 100, 1)}% variasi saling dijelaskan secara linear (r² = ${fmt(p.r * p.r, 3)}).` : ''));
      else parts.push('Belum ada bukti yang cukup bahwa kedua variabel berhubungan' + (p.n < 30 ? '; sampel yang kecil membuat uji kurang kuat.' : '.'));
      return `<div class="bs-var"><h4>${esc(names[p.i])} dan ${esc(names[p.j])}</h4>${parts.map((t) => `<p>${t}</p>`).join('')}</div>`;
    }).join('');
    if (P.length > shown.length) h += `<p class="bs-note">Menampilkan 15 pasangan dengan |${sy}| terbesar dari ${P.length} pasangan; lihat tabel Ringkasan untuk semuanya.</p>`;
    h += `<div class="bs-var"><h4>Catatan penting</h4><p>${method === 'pearson' ? 'Pearson hanya mengukur hubungan <strong>linear</strong> dan peka terhadap pencilan; periksa dengan Scatter Plot sebelum menyimpulkan. ' : 'Korelasi peringkat mengukur hubungan monoton (naik terus atau turun terus), tidak harus lurus, dan lebih tahan pencilan. '}Korelasi menunjukkan keterkaitan, <strong>bukan sebab-akibat</strong>. Bila banyak pasangan diuji sekaligus, beberapa bisa signifikan hanya karena kebetulan; pertimbangkan koreksi (mis. Bonferroni: α dibagi jumlah pasangan).</p></div>`;
    q('krInterpWrap').innerHTML = h;
  }

  /* Heatmap matriks korelasi (SVG sendiri; warna mengikuti pengaturan pita Warna: biru = positif, emas = negatif) */
  function heatSvg(c) {
    const gu = window.GraphCore && window.GraphCore.u, S = (gu && gu.ST) || {}, on = !!S.on;
    const col1 = (on && S.c1) || '#22384A', col2 = (on && S.c2) || '#BD7E1F', bg = (on && S.bg) || '#ffffff';
    const x = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cut = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + '…' : String(t));
    const k = c.k, names = c.names.map((t) => cut(t, 18)), W = 640;
    const maxLen = Math.max.apply(null, names.map((t) => t.length));
    const left = Math.round(maxLen * 6.4) + 16, right = 78, top = 44 + Math.round(maxLen * 4.2) + 8;
    const cell = Math.max(30, Math.min(70, Math.floor((W - left - right) / k)));
    const gw = cell * k, H = top + gw + 40;
    const title = (on && S.title) || 'Matriks Korelasi (' + METHOD_NAME[c.method] + ')';
    let g = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Inter, Arial, sans-serif" role="img" aria-label="${x(title)}">` +
      `<rect width="${W}" height="${H}" fill="${bg}"/>` +
      `<defs><linearGradient id="krhm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col1}"/><stop offset=".5" stop-color="${bg}"/><stop offset="1" stop-color="${col2}"/></linearGradient></defs>` +
      `<text x="${W / 2}" y="26" text-anchor="middle" font-size="16" font-weight="700" fill="#1B2430">${x(title)}</text>`;
    const fsz = Math.max(9, Math.min(13, Math.round(cell / 3.4)));
    for (let i = 0; i < k; i++) {
      g += `<text x="${left - 8}" y="${top + i * cell + cell / 2 + 4}" text-anchor="end" font-size="11" fill="#4A5563">${x(names[i])}</text>`;
      const cx = left + i * cell + cell / 2;
      g += `<text transform="translate(${cx + 4},${top - 8}) rotate(-40)" text-anchor="start" font-size="11" fill="#4A5563">${x(names[i])}</text>`;
      for (let j = 0; j < k; j++) {
        const r = i === j ? 1 : c.M.R[i][j], ok = Number.isFinite(r), px = left + j * cell, py = top + i * cell;
        const op = ok ? Math.min(1, Math.abs(r)) : 0, fill = ok && r < 0 ? col2 : col1;
        g += `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" fill="${bg}" stroke="#E3E6EA"/>`;
        if (ok) g += `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" fill="${fill}" fill-opacity="${op.toFixed(2)}" stroke="#fff"/>`;
        const sig = ok && i !== j && c.M.P[i][j] < c.alpha ? '*' : '';
        g += `<text x="${px + cell / 2}" y="${py + cell / 2 + fsz / 3}" text-anchor="middle" font-size="${fsz}" font-weight="600" fill="${ok && op > 0.55 ? '#ffffff' : '#1B2430'}">${ok ? fmt(r, 2) + sig : '-'}</text>`;
      }
    }
    const lx = left + gw + 22, ly = top, lh = Math.min(gw, 160);
    g += `<rect x="${lx}" y="${ly}" width="14" height="${lh}" fill="url(#krhm)" stroke="#E3E6EA"/>` +
      `<text x="${lx + 20}" y="${ly + 9}" font-size="10" fill="#4A5563">+1</text><text x="${lx + 20}" y="${ly + lh / 2 + 4}" font-size="10" fill="#4A5563">0</text><text x="${lx + 20}" y="${ly + lh}" font-size="10" fill="#4A5563">−1</text>`;
    g += `<text x="${left}" y="${top + gw + 24}" font-size="10.5" fill="#4A5563">* signifikan pada α = ${x(fmt(c.alpha, 2))} (uji dua sisi). Makin pekat warna, makin kuat korelasinya.</text>`;
    return g + '</svg>';
  }

  function publish(c) {
    try {
      const SE = window.StatExport; if (!SE) return;
      const { names, cols, method, alpha } = c, n = Math.max.apply(null, cols.map((a) => a.length));
      const SC = window.StatCharts, charts = [];
      if (SC) {
        if (c.k >= 3) charts.push({ title: 'Heatmap korelasi', caption: 'Setiap kotak = koefisien korelasi sepasang variabel (' + METHOD_NAME[method] + '). Biru = hubungan positif, emas = negatif; tanda * = signifikan pada α = ' + fmt(alpha, 2) + '.', build: () => heatSvg(c) });
        const P = pairs(c).filter((p) => Number.isFinite(p.r)).sort((a, b) => Math.abs(b.r) - Math.abs(a.r)), shown = P.slice(0, 6);
        shown.forEach((p) => {
          const d = pairData(cols, p.i, p.j);
          let fit;
          if (method === 'pearson' && d.x.length > 1) { const mx = d.x.reduce((s, v) => s + v, 0) / d.x.length, my = d.y.reduce((s, v) => s + v, 0) / d.y.length; let sxx = 0, sxy = 0; d.x.forEach((v, i) => { sxx += (v - mx) ** 2; sxy += (v - mx) * (d.y[i] - my); }); if (sxx > 0) fit = { a: my - sxy / sxx * mx, b: sxy / sxx, name: 'Garis regresi linear' }; }
          charts.push({ title: 'Scatter plot ' + names[p.i] + ' dan ' + names[p.j],
            caption: SYM[method] + ' = ' + fmt(p.r, 3) + ', p = ' + fmtP(p.p) + ', n = ' + p.n + '.' + (method === 'pearson' ? ' Periksa apakah pola titik benar-benar linear dan tidak dikendalikan oleh pencilan.' : ''),
            build: () => SC.scatter({ title: names[p.i] + ' vs ' + names[p.j], xLabel: names[p.i], yLabel: names[p.j], x: d.x, y: d.y, fit }) });
        });
      }
      SE.publish({
        id: 'korelasi', title: 'Korelasi', anchor: '#kr-results-card', resultsCard: '#kr-results-card',
        meta: [['Metode', 'Korelasi ' + METHOD_NAME[method]], ['α', fmt(alpha, 2)], ['Jumlah variabel', names.length], ['Variabel', names.join(', ')]].concat(c.k > 4 ? [['Grafik', 'Scatter plot untuk 6 pasangan dengan korelasi terkuat']] : []),
        sections: [{ heading: 'Ringkasan', sel: '#krSumWrap' }, { heading: 'Langkah Perhitungan', sel: '#krStepsWrap' }, { heading: 'Interpretasi', sel: '#krInterpWrap' }],
        data: { head: ['#'].concat(names), rows: Array.from({ length: n }, (_, i) => [i + 1].concat(cols.map((a) => (a[i] === null || a[i] === undefined ? '' : a[i])))), caption: 'Data yang dipakai pada perhitungan.' },
        charts,
      });
    } catch (e) { /* ekspor opsional */ }
  }
})();
