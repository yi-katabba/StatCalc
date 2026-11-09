/* =========================================================================
   UJI t - satu sampel, dua sampel independen (Welch / ragam gabungan), berpasangan (Method > Stat > Basic Statistics)
   -------------------------------------------------------------------------
   Input: satu atau dua kolom data (bisa diketik, ditempel dari Excel, diunggah, atau dikirim dari Dataset).
   Hasil: statistik sampel, tabel uji (t, df, p, selang kepercayaan, ukuran efek), langkah perhitungan, interpretasi.
   Hitungan ada di basic-core.js (diuji terhadap SciPy). Muat SETELAH stat-dist.js, basic-core.js, basic-ui.js, impor-data.js.
   Halaman dibuat otomatis (#view-uji-t).
   ========================================================================= */
(function () {
  'use strict';
  const B = window.StatBasic, U = window.StatBasicUI, D = window.StatDist;
  if (!B || !U || !D) return;
  const { esc, toNum, fmt, fmtP, fmtCI, pct, effectLabel } = U;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const MAX_ROWS = 2000;
  const DEFAULT_NAMES = { one: ['Sampel'], two: ['Kelompok 1', 'Kelompok 2'], paired: ['Sebelum', 'Sesudah'] };
  const ALT_SYM = { two: '≠', greater: '>', less: '<' };

  const section = document.createElement('section');
  section.className = 'view';
  section.id = 'view-uji-t';
  section.innerHTML = `
    <div class="chapter-inner">
      <div class="chapter-head ch-wide">
        <span class="eyebrow">Metode Statistik &rsaquo; Basic Statistics</span>
        <h1>Uji t</h1>
        <p class="lede">Bandingkan rata-rata dengan uji t: satu sampel terhadap nilai acuan, dua kelompok independen (Welch atau ragam gabungan), atau dua pengukuran berpasangan. Hasil lengkap dengan nilai t, derajat bebas, p-value, selang kepercayaan, ukuran efek (Cohen&rsquo;s d), langkah perhitungan, dan interpretasi.</p>
      </div>

      <section class="card step-card" id="ut-data-card">
        <div class="step-tag">Langkah 1</div>
        <h2>Atur uji &amp; masukkan data</h2>
        <div class="bs-set">
          <label>Jenis uji
            <select id="utMode" class="select-input">
              <option value="one">Satu sampel</option>
              <option value="two">Dua sampel independen</option>
              <option value="paired">Berpasangan (paired)</option>
            </select>
          </label>
          <label><span id="utMuLbl">Nilai hipotesis (μ₀)</span>
            <input type="text" id="utMu" class="plain-input" inputmode="decimal" value="0" autocomplete="off">
          </label>
          <label>Hipotesis alternatif (H₁)
            <select id="utAlt" class="select-input">
              <option value="two">Dua sisi (≠)</option>
              <option value="greater">Lebih besar (&gt;)</option>
              <option value="less">Lebih kecil (&lt;)</option>
            </select>
          </label>
          <label>Tingkat signifikansi (α)
            <select id="utAlpha" class="select-input">
              <option value="0.10">0,10 (CI 90%)</option>
              <option value="0.05" selected>0,05 (CI 95%)</option>
              <option value="0.01">0,01 (CI 99%)</option>
            </select>
          </label>
          <label id="utVarWrap">Asumsi ragam
            <select id="utVar" class="select-input">
              <option value="welch">Ragam tidak sama (Welch)</option>
              <option value="pooled">Ragam sama (gabungan)</option>
            </select>
            <span class="bs-sub">Welch aman dipakai bila ragam belum diperiksa.</span>
          </label>
        </div>
        <p class="hint"><span id="utHintLead">Masukkan data pada kolom di bawah.</span> Minimal <strong><span id="utMin">2</span> data</strong> per kolom; maksimal ${MAX_ROWS} baris. Sel kosong diabaikan<span id="utHintTail"></span>.</p>
        <div class="table-scroll">
          <table class="data-table">
            <thead id="utHead"></thead>
            <tbody id="utBody"></tbody>
          </table>
        </div>
        <div class="bs-bar c5">
          ${window.StatSlateBtn('rowadd', 'Tambah baris', '', 'utAdd')}
          ${window.StatSlateBtn('rowdel', 'Hapus baris terakhir', '', 'utRemove')}
          ${window.StatSlateBtn('clear', 'Kosongkan', '', 'utClear')}
        </div>
        <div class="bs-bar c1">
          <button type="button" class="btn-ghost" id="utSample">Isi contoh data</button>
          <button type="button" class="btn-primary" id="utCalc">Hitung Uji t &rarr;</button>
        </div>
        <p class="error-msg" id="utErr" hidden></p>
      </section>

      <section class="card step-card" id="ut-results-card" hidden>
        <div class="step-tag">Langkah 2</div>
        <h2>Hasil Uji t</h2>
        <nav class="tabs" id="utTabs">
          <button type="button" class="tab-btn active" data-tab="ut-tab-sum">Ringkasan</button>
          <button type="button" class="tab-btn" data-tab="ut-tab-steps">Langkah Perhitungan</button>
          <button type="button" class="tab-btn" data-tab="ut-tab-interp">Interpretasi</button>
        </nav>
        <div class="tab-panel active" id="ut-tab-sum"><div id="utSumWrap" class="table-scroll bs-wrap"></div></div>
        <div class="tab-panel" id="ut-tab-steps"><div id="utStepsWrap" class="steps-wrap"></div></div>
        <div class="tab-panel" id="ut-tab-interp"><div id="utInterpWrap"></div></div>
      </section>
    </div>`;
  document.body.insertBefore(section, $('#profileOverlay'));
  if (window.StatRibbon) window.StatRibbon.mount({
    view: '#view-uji-t', key: 'ujit',
    tabs: [
      { id: 'hasil', label: 'Hasil', groups: [
        { label: 'Tab hasil', cols: 2, items: [
          { type: 'toggle', key: 'sum', label: 'Ringkasan', tab: 'ut-tab-sum' },
          { type: 'toggle', key: 'stp', label: 'Langkah Perhitungan', tab: 'ut-tab-steps' },
          { type: 'toggle', key: 'int', label: 'Interpretasi', tab: 'ut-tab-interp' },
          { type: 'toggle', key: 'gr', label: 'Grafik', tab: 'uji-t-tab-gp' },
        ] },
      ], tip: 'Pengaturan pita hanya menyembunyikan atau menampilkan bagian hasil; perhitungan tidak berubah.' },
      { id: 'ekspor', label: 'Ekspor', groups: [
        { label: 'Unduhan', items: [
          { type: 'toggle', key: 'dl', label: 'Panel unduhan (.docx/.zip)', hide: ['.ex-panel', '.ex-bar'] },
        ] },
      ] },
    ],
  });

  const q = (id) => $('#' + id, section);
  const head = q('utHead'), body = q('utBody');
  const state = { names: DEFAULT_NAMES.one.slice() };
  const mode = () => q('utMode').value;
  const nColsFor = (m) => (m === 'one' ? 1 : 2);

  /* ------------------------------ Tabel input ----------------------------- */
  function buildHead() {
    head.innerHTML = '<tr><th>#</th>' + state.names.map((n, j) => `<th><input class="bs-vname" data-j="${j}" value="${esc(n)}" aria-label="Nama kolom ${j + 1}" spellcheck="false"></th>`).join('') + '</tr>';
  }
  function renumber() { $$('tr', body).forEach((tr, i) => { tr.querySelector('.rownum').textContent = i + 1; }); }
  function addRow() {
    if (body.rows.length >= MAX_ROWS) return;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="rownum"></td>' + state.names.map(() => '<td><input type="text" inputmode="decimal" placeholder="nilai"></td>').join('');
    body.appendChild(tr); renumber();
  }
  function addCol() { state.names.push('Kolom ' + (state.names.length + 1)); $$('tr', body).forEach((tr) => { const td = document.createElement('td'); td.innerHTML = '<input type="text" inputmode="decimal" placeholder="nilai">'; tr.appendChild(td); }); }
  function remCol() { state.names.pop(); $$('tr', body).forEach((tr) => tr.removeChild(tr.lastElementChild)); }
  function isDefaultNames() { return Object.keys(DEFAULT_NAMES).some((m) => DEFAULT_NAMES[m].join('|') === state.names.join('|')) || state.names.every((n) => /^Kolom \d+$/.test(n)); }
  /* atur jumlah kolom & teks sesuai jenis uji */
  function applyMode(keepNames) {
    const m = mode(), want = nColsFor(m), wasDefault = isDefaultNames();
    let g = 0;
    while (state.names.length < want && g++ < 5) addCol();
    while (state.names.length > want && g++ < 10) remCol();
    if (wasDefault && !keepNames) state.names = DEFAULT_NAMES[m].slice();
    buildHead();
    q('utMuLbl').textContent = m === 'one' ? 'Nilai hipotesis (μ₀)' : m === 'two' ? 'Selisih hipotesis μ₁ − μ₂ (δ₀)' : 'Selisih hipotesis rata-rata pasangan (μd)';
    q('utVarWrap').hidden = m !== 'two';
    q('utHintLead').textContent = m === 'one' ? 'Satu kolom data sampel.' : m === 'two' ? 'Dua kolom: satu kolom per kelompok (panjang kolom boleh berbeda).' : 'Dua kolom berpasangan: baris yang sama = subjek yang sama (selisih = kolom 1 − kolom 2).';
    q('utHintTail').textContent = m === 'paired' ? ' (tetapi pasangan harus lengkap)' : '';
  }
  function build(nRows) { body.innerHTML = ''; for (let i = 0; i < nRows; i++) addRow(); }
  head.addEventListener('input', (e) => { const i = e.target.closest('.bs-vname'); if (i) state.names[+i.dataset.j] = i.value; });
  q('utAdd').addEventListener('click', addRow);
  q('utRemove').addEventListener('click', () => { if (body.rows.length > 2) { body.deleteRow(body.rows.length - 1); renumber(); } });
  q('utClear').addEventListener('click', () => { $$('input', body).forEach((i) => { i.value = ''; i.classList.remove('invalid'); }); hideErr(); });
  q('utMode').addEventListener('change', () => { applyMode(false); hideErr(); });

  const SAMPLES = {
    one: { cols: [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91, 74, 85, 69, 83, 77]], mu: '75', note: 'Contoh: apakah rata-rata nilai ujian berbeda dari 75?' },
    two: { cols: [[78, 85, 90, 72, 88, 95, 67, 80, 85, 91, 74, 85, 69, 83, 77], [65, 70, 82, 60, 75, 88, 55, 72, 70, 84, 62, 78, 58, 74, 69]], mu: '0' },
    paired: { cols: [[80, 75, 90, 68, 72, 85, 78, 66, 92, 70], [84, 79, 93, 70, 78, 88, 80, 72, 95, 76]], mu: '0' },
  };
  q('utSample').addEventListener('click', () => {
    const m = mode(), S = SAMPLES[m];
    state.names = DEFAULT_NAMES[m].slice(); applyMode(true);
    build(S.cols[0].length);
    $$('tr', body).forEach((tr, i) => $$('input', tr).forEach((inp, j) => { inp.value = S.cols[j][i]; }));
    q('utMu').value = S.mu; hideErr();
  });
  applyMode(false); build(8);

  function showErr(m) { const e = q('utErr'); e.textContent = m; e.hidden = false; }
  function hideErr() { q('utErr').hidden = true; }

  /* Impor data (Tempel dari Excel / Unggah file / dari Dataset) */
  if (window.StatCalcImport && window.StatCalcImport.register) {
    window.StatCalcImport.register({
      card: '#ut-data-card', body: '#utBody', add: '#utAdd', remove: '#utRemove', minHint: '#utMin', text: [],
      fitCols: (n) => {
        const sel = q('utMode');
        if (n >= 2 && sel.value === 'one') sel.value = 'two';
        else if (n <= 1 && sel.value !== 'one') sel.value = 'one';
        applyMode(true);
      },
      onApply: (info) => { (info.names || []).forEach((t, k) => { const j = (info.offset || 0) + k, v = String(t || '').trim(); if (v && j < state.names.length) { state.names[j] = v; const inp = $$('.bs-vname', head)[j]; if (inp) inp.value = v; } }); },
    });
  }

  /* -------------------------------- Hitung -------------------------------- */
  function collect() {
    const rows = [], bad = [];
    $$('tr', body).forEach((tr, r) => {
      const vals = [];
      $$('input', tr).forEach((inp, j) => {
        inp.classList.remove('invalid');
        const v = toNum(inp.value);
        if (Number.isNaN(v)) { bad.push(`${state.names[j] || 'Kolom ' + (j + 1)} baris ${r + 1}`); inp.classList.add('invalid'); vals.push(null); } else vals.push(v);
      });
      rows.push(vals);
    });
    return { rows, bad };
  }
  function run() {
    hideErr();
    const m = mode(), alt = q('utAlt').value, alpha = parseFloat(q('utAlpha').value), conf = 1 - alpha;
    const mu = toNum(q('utMu').value);
    if (mu === null || Number.isNaN(mu)) { showErr('Nilai hipotesis harus berupa angka (boleh 0).'); return; }
    const { rows, bad } = collect();
    if (bad.length) { showErr('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.'); return; }
    const names = state.names.map((n, j) => (String(n).trim() || 'Kolom ' + (j + 1)));
    let res, used;
    if (m === 'one') {
      const x = rows.map((r) => r[0]).filter((v) => v !== null);
      if (x.length < 2) { showErr('Uji t satu sampel membutuhkan minimal 2 data.'); return; }
      if (B.variance(x) === 0) { showErr('Semua nilai sama persis (simpangan baku = 0), uji t tidak dapat dihitung.'); return; }
      res = B.tOne(x, mu, alt, conf); used = { x };
    } else if (m === 'two') {
      const x = rows.map((r) => r[0]).filter((v) => v !== null), y = rows.map((r) => r[1]).filter((v) => v !== null);
      if (x.length < 2 || y.length < 2) { showErr('Setiap kelompok membutuhkan minimal 2 data (' + names[0] + ': ' + x.length + ', ' + names[1] + ': ' + y.length + ').'); return; }
      const eq = q('utVar').value === 'pooled';
      if (B.variance(x) === 0 && B.variance(y) === 0) { showErr('Kedua kelompok tidak bervariasi (simpangan baku = 0), uji t tidak dapat dihitung.'); return; }
      res = B.tTwo(x, y, mu, alt, conf, eq); used = { x, y };
    } else {
      const x = [], y = [];
      for (let i = 0; i < rows.length; i++) {
        const a = rows[i][0], b = rows[i][1];
        if (a === null && b === null) continue;
        if (a === null || b === null) { showErr('Baris ' + (i + 1) + ' hanya terisi satu sisi. Pada uji berpasangan setiap baris harus berisi dua nilai.'); return; }
        x.push(a); y.push(b);
      }
      if (x.length < 2) { showErr('Uji berpasangan membutuhkan minimal 2 pasang data.'); return; }
      const dv = x.map((v, i) => v - y[i]);
      if (B.variance(dv) === 0) { showErr('Semua selisih pasangan sama persis (simpangan baku selisih = 0), uji t tidak dapat dihitung.'); return; }
      res = B.tPaired(x, y, mu, alt, conf); used = { x, y };
    }
    const ctx = { m, alt, alpha, conf, mu, names, res, used };
    renderSummary(ctx); renderSteps(ctx); renderInterp(ctx);
    q('ut-results-card').hidden = false;
    $$('#utTabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'ut-tab-sum'));
    $$('.tab-panel', q('ut-results-card')).forEach((p) => p.classList.toggle('active', p.id === 'ut-tab-sum'));
    publish(ctx);
    q('ut-results-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
  }
  q('utCalc').addEventListener('click', run);
  q('utTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn'); if (!btn) return;
    $$('#utTabs .tab-btn').forEach((b) => b.classList.remove('active')); btn.classList.add('active');
    $$('.tab-panel', q('ut-results-card')).forEach((p) => p.classList.remove('active'));
    q(btn.dataset.tab).classList.add('active');
  });

  /* ------------------------------ Tampilan hasil ------------------------------ */
  const nm = (s) => esc(s);
  function hypo(c) {
    const { m, alt, mu, names } = c, s = ALT_SYM[alt], v = fmt(mu);
    if (m === 'one') return ['μ = ' + v, 'μ ' + s + ' ' + v, 'μ'];
    if (m === 'two') return ['μ₁ − μ₂ = ' + v, 'μ₁ − μ₂ ' + s + ' ' + v, 'μ₁ − μ₂'];
    return ['μd = ' + v, 'μd ' + s + ' ' + v, 'μd'];
  }
  const testName = (c) => c.m === 'one' ? 'Uji t satu sampel' : c.m === 'two' ? (c.res.type === 'pooled' ? 'Uji t dua sampel independen (ragam gabungan)' : 'Uji t dua sampel independen (Welch)') : 'Uji t berpasangan';
  function renderSummary(c) {
    const { m, res, alpha, conf, names } = c;
    let desc = '<table class="result-table bs-res"><caption>Statistik sampel</caption><thead><tr><th class="lbl">Sampel</th><th>n</th><th>Rata-rata</th><th>Simpangan baku</th><th>Galat baku</th></tr></thead><tbody>';
    const row = (lab, n, mean, sd) => `<tr><td class="lbl">${nm(lab)}</td><td>${n}</td><td>${fmt(mean)}</td><td>${fmt(sd)}</td><td>${fmt(sd / Math.sqrt(n))}</td></tr>`;
    if (m === 'one') desc += row(names[0], res.n, res.mean, res.sd);
    else if (m === 'two') desc += row(names[0], res.n1, res.m1, res.s1) + row(names[1], res.n2, res.m2, res.s2);
    else desc += row(names[0], res.n, res.m1, B.variance(c.used.x) ** 0.5) + row(names[1], res.n, res.m2, B.variance(c.used.y) ** 0.5) + row(names[0] + ' − ' + names[1], res.n, res.mean, res.sd);
    desc += '</tbody></table>';
    const [h0, h1, par] = hypo(c);
    const est = m === 'one' ? res.mean : res.diff, estLab = m === 'one' ? 'Rata-rata sampel (x̄)' : m === 'two' ? 'Selisih rata-rata (x̄₁ − x̄₂)' : 'Rata-rata selisih (d̄)';
    const rej = res.p < alpha;
    const ciLab = (m === 'one' ? 'Selang kepercayaan μ ' : m === 'two' ? 'Selang kepercayaan μ₁ − μ₂ ' : 'Selang kepercayaan μd ') + pct(conf) + (c.alt === 'two' ? '' : ' (satu sisi)');
    const tab = '<table class="result-table bs-res"><caption>' + esc(testName(c)) + '</caption><tbody>' +
      `<tr><td class="lbl">Hipotesis nol (H₀)</td><td>${h0}</td></tr>` +
      `<tr><td class="lbl">Hipotesis alternatif (H₁)</td><td>${h1}</td></tr>` +
      `<tr><td class="lbl">${estLab}</td><td>${fmt(est)}</td></tr>` +
      `<tr><td class="lbl">Galat baku (SE)</td><td>${fmt(res.se)}</td></tr>` +
      `<tr><td class="lbl">${ciLab}</td><td>${fmtCI(res.ci)}</td></tr>` +
      `<tr><td class="lbl">Statistik t</td><td>${fmt(res.t)}</td></tr>` +
      `<tr><td class="lbl">Derajat bebas (df)</td><td>${fmt(res.df, 4)}</td></tr>` +
      `<tr><td class="lbl">p-value</td><td class="${rej ? 'sig' : ''}">${fmtP(res.p)}</td></tr>` +
      `<tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr>` +
      `<tr><td class="lbl">Keputusan</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr>` +
      `<tr><td class="lbl">Ukuran efek (Cohen’s d)</td><td>${fmt(res.d, 3)} (${effectLabel(res.d)})</td></tr>` +
      '</tbody></table>';
    q('utSumWrap').innerHTML = desc + tab + '<p class="bs-note">p-value dihitung dari distribusi t. ' + (m === 'two' && res.type === 'welch' ? 'Uji Welch memakai derajat bebas Satterthwaite sehingga df bisa berupa desimal (sama dengan t.test() di R dan Minitab “tidak mengasumsikan ragam sama”). ' : '') + (m === 'paired' ? 'Selisih dihitung sebagai ' + esc(names[0]) + ' − ' + esc(names[1]) + '. ' : '') + 'Cohen’s d: ' + (m === 'one' ? '(x̄ − μ₀) / s' : m === 'two' ? '(x̄₁ − x̄₂) / sp (simpangan baku gabungan)' : 'd̄ / s selisih') + '.</p>';
  }

  function renderSteps(c) {
    const { m, res, alt, alpha, conf, mu, names } = c, [h0, h1] = hypo(c);
    const steps = [];
    const tcrit = alt === 'two' ? D.tCrit(res.df, 1 - alpha) : D.tCrit(res.df, 1 - 2 * alpha);
    if (m === 'one') {
      steps.push({ t: 'Rumus yang dipakai', f: 'x̄ = Σx / n\ns = √[Σ(x − x̄)² / (n − 1)]\nSE = s / √n\nt = (x̄ − μ₀) / SE\ndf = n − 1', n: 'Uji t satu sampel membandingkan rata-rata sampel dengan nilai acuan μ₀.' });
      steps.push({ t: 'Hipotesis', f: `H₀: ${h0}\nH₁: ${h1}\nα = ${fmt(alpha, 2)}`, n: '' });
      steps.push({ t: 'Statistik sampel', f: `n = ${res.n}\nx̄ = ${fmt(res.mean)}\ns = ${fmt(res.sd)}\nSE = ${fmt(res.sd)} / √${res.n} = ${fmt(res.se)}`, n: '' });
      steps.push({ t: 'Statistik uji', f: `t = (${fmt(res.mean)} − ${fmt(mu)}) / ${fmt(res.se)} = ${fmt(res.t)}\ndf = ${res.n} − 1 = ${res.df}`, n: '' });
    } else if (m === 'two' && res.type === 'welch') {
      steps.push({ t: 'Rumus yang dipakai (Welch)', f: 'SE = √(s₁²/n₁ + s₂²/n₂)\nt = (x̄₁ − x̄₂ − δ₀) / SE\ndf = (s₁²/n₁ + s₂²/n₂)² / [ (s₁²/n₁)²/(n₁−1) + (s₂²/n₂)²/(n₂−1) ]', n: 'Uji Welch tidak mengasumsikan ragam kedua kelompok sama; derajat bebas dihitung dengan pendekatan Satterthwaite.' });
      steps.push({ t: 'Hipotesis', f: `H₀: ${h0}\nH₁: ${h1}\nα = ${fmt(alpha, 2)}`, n: '' });
      steps.push({ t: 'Statistik tiap kelompok', f: `${names[0]}: n₁ = ${res.n1}, x̄₁ = ${fmt(res.m1)}, s₁ = ${fmt(res.s1)}\n${names[1]}: n₂ = ${res.n2}, x̄₂ = ${fmt(res.m2)}, s₂ = ${fmt(res.s2)}\nSelisih x̄₁ − x̄₂ = ${fmt(res.diff)}`, n: '' });
      steps.push({ t: 'Statistik uji', f: `SE = √(${fmt(res.v1)}/${res.n1} + ${fmt(res.v2)}/${res.n2}) = ${fmt(res.se)}\nt = (${fmt(res.diff)} − ${fmt(mu)}) / ${fmt(res.se)} = ${fmt(res.t)}\ndf (Welch) = ${fmt(res.df, 4)}`, n: '' });
    } else if (m === 'two') {
      steps.push({ t: 'Rumus yang dipakai (ragam gabungan)', f: 'sp² = [(n₁−1)s₁² + (n₂−1)s₂²] / (n₁ + n₂ − 2)\nSE = √[sp² (1/n₁ + 1/n₂)]\nt = (x̄₁ − x̄₂ − δ₀) / SE\ndf = n₁ + n₂ − 2', n: 'Dipakai bila kedua kelompok diasumsikan memiliki ragam yang sama.' });
      steps.push({ t: 'Hipotesis', f: `H₀: ${h0}\nH₁: ${h1}\nα = ${fmt(alpha, 2)}`, n: '' });
      steps.push({ t: 'Statistik tiap kelompok', f: `${names[0]}: n₁ = ${res.n1}, x̄₁ = ${fmt(res.m1)}, s₁ = ${fmt(res.s1)}\n${names[1]}: n₂ = ${res.n2}, x̄₂ = ${fmt(res.m2)}, s₂ = ${fmt(res.s2)}\nSelisih x̄₁ − x̄₂ = ${fmt(res.diff)}`, n: '' });
      steps.push({ t: 'Statistik uji', f: `sp² = ${fmt(res.sp * res.sp)}  (sp = ${fmt(res.sp)})\nSE = ${fmt(res.se)}\nt = (${fmt(res.diff)} − ${fmt(mu)}) / ${fmt(res.se)} = ${fmt(res.t)}\ndf = ${res.n1} + ${res.n2} − 2 = ${res.df}`, n: '' });
    } else {
      steps.push({ t: 'Rumus yang dipakai', f: 'dᵢ = xᵢ − yᵢ  (selisih tiap pasangan)\nd̄ = Σd / n\nsd = √[Σ(d − d̄)² / (n − 1)]\nSE = sd / √n\nt = (d̄ − μd₀) / SE\ndf = n − 1', n: 'Uji berpasangan = uji t satu sampel pada selisih tiap pasangan.' });
      steps.push({ t: 'Hipotesis', f: `H₀: ${h0}\nH₁: ${h1}\nα = ${fmt(alpha, 2)}`, n: '' });
      const ds = res.dvals, show = ds.length > 12 ? ds.slice(0, 12).map((v) => fmt(v, 2)).join(', ') + ', …' : ds.map((v) => fmt(v, 2)).join(', ');
      steps.push({ t: 'Selisih pasangan', f: `n = ${res.n} pasang\nd = ${show}\nd̄ = ${fmt(res.mean)}, sd = ${fmt(res.sd)}\nSE = ${fmt(res.sd)} / √${res.n} = ${fmt(res.se)}`, n: `Selisih = ${names[0]} − ${names[1]}.` });
      steps.push({ t: 'Statistik uji', f: `t = (${fmt(res.mean)} − ${fmt(mu)}) / ${fmt(res.se)} = ${fmt(res.t)}\ndf = ${res.n} − 1 = ${res.df}`, n: '' });
    }
    const rej = res.p < alpha;
    steps.push({ t: 'p-value & nilai kritis', f: `Nilai kritis t (${alt === 'two' ? 'dua sisi' : 'satu sisi'}, α = ${fmt(alpha, 2)}, df = ${fmt(res.df, 2)}) = ${alt === 'less' ? '−' : alt === 'two' ? '±' : ''}${fmt(tcrit)}\np-value = ${fmtP(res.p)}`, n: 'p-value adalah peluang memperoleh nilai t sekecil/seekstrem ini bila H₀ benar.' });
    steps.push({ t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(res.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' });
    const est = m === 'one' ? res.mean : res.diff;
    steps.push({ t: `Selang kepercayaan ${pct(conf)}`, f: `${alt === 'two' ? '' : '(satu sisi) '}Batas = ${fmt(est)} ± t × SE\n= ${fmtCI(res.ci)}`, n: '' });
    steps.push({ t: 'Ukuran efek', f: `Cohen's d = ${fmt(res.d, 3)} → efek ${effectLabel(res.d)}`, n: 'Ukuran efek menunjukkan seberapa besar perbedaan dalam satuan simpangan baku, terlepas dari ukuran sampel.' });
    q('utStepsWrap').innerHTML = steps.map((s, i) => `<div class="step-block" data-step="${i + 1}"><h4>${esc(s.t)}</h4><span class="formula">${esc(s.f)}</span>${s.n ? `<p>${esc(s.n)}</p>` : ''}</div>`).join('');
  }

  function renderInterp(c) {
    const { m, res, alt, alpha, conf, mu, names } = c, rej = res.p < alpha, [, , par] = hypo(c);
    const phr = { two: 'berbeda secara signifikan dari', greater: 'secara signifikan lebih besar dari', less: 'secara signifikan lebih kecil dari' }[alt];
    const subj = m === 'one' ? `rata-rata populasi (μ)` : m === 'two' ? `selisih rata-rata populasi ${esc(names[0])} dan ${esc(names[1])} (μ₁ − μ₂)` : `rata-rata selisih pasangan ${esc(names[0])} − ${esc(names[1])} (μd)`;
    const parts = [];
    parts.push(`<strong>Keputusan:</strong> p-value = <strong>${fmtP(res.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. Pada tingkat signifikansi ${pct(alpha)}, ${rej ? 'terdapat bukti yang cukup' : 'belum terdapat bukti yang cukup'} bahwa ${subj} ${phr} ${fmt(mu)}.`);
    const est = m === 'one' ? res.mean : res.diff;
    parts.push(`${m === 'one' ? 'Rata-rata sampel' : m === 'two' ? 'Selisih rata-rata sampel' : 'Rata-rata selisih sampel'} = ${fmt(est)}. Dengan keyakinan ${pct(conf)}${alt === 'two' ? '' : ' (satu sisi)'}, nilai ${m === 'one' ? 'μ' : m === 'two' ? 'μ₁ − μ₂' : 'μd'} berada pada ${fmtCI(res.ci)}${alt === 'two' ? (res.ci[0] <= mu && mu <= res.ci[1] ? `; selang ini memuat ${fmt(mu)}, konsisten dengan H₀ tidak ditolak.` : `; selang ini tidak memuat ${fmt(mu)}, konsisten dengan H₀ ditolak.`) : '.'}`);
    parts.push(`Ukuran efek Cohen’s d = ${fmt(res.d, 3)}, tergolong <strong>${effectLabel(res.d)}</strong>. ${rej && Math.abs(res.d) < 0.2 ? 'Perbedaan signifikan secara statistik tetapi sangat kecil secara praktis (biasanya terjadi pada sampel besar).' : !rej && Math.abs(res.d) >= 0.5 ? 'Efeknya cukup besar tetapi tidak signifikan; sampel kemungkinan terlalu kecil sehingga uji kurang kuat.' : ''}`);
    const n = m === 'two' ? Math.min(res.n1, res.n2) : res.n;
    const asm = [];
    asm.push(m === 'one' ? 'data diambil secara acak dan saling bebas' : m === 'two' ? 'kedua kelompok saling bebas dan diambil acak' : 'pasangan saling bebas antarsubjek');
    asm.push((m === 'paired' ? 'selisih pasangan' : m === 'two' ? 'tiap kelompok' : 'data') + ' berdistribusi mendekati normal' + (n >= 30 ? ' (dengan n ≥ 30, uji t cukup tahan terhadap penyimpangan ringan)' : ' (n kecil, periksa normalitas dan pencilan lebih hati-hati)'));
    if (m === 'two') asm.push(res.type === 'welch' ? 'ragam kedua kelompok boleh berbeda (Welch)' : 'ragam kedua kelompok dianggap sama; bila ragu pilih Welch');
    parts.push(`<strong>Asumsi:</strong> ${asm.join('; ')}.`);
    q('utInterpWrap').innerHTML = `<div class="bs-var"><h4>${esc(testName(c))}</h4>${parts.map((p) => `<p>${p}</p>`).join('')}</div>`;
  }

  function publish(c) {
    try {
      const SE = window.StatExport; if (!SE) return;
      const { m, names, used, res } = c;
      const cols = m === 'one' ? [used.x] : [used.x, used.y], n = Math.max.apply(null, cols.map((a) => a.length));
      SE.publish({
        id: 'uji-t', title: 'Uji t', anchor: '#ut-results-card', resultsCard: '#ut-results-card',
        meta: [['Metode', testName(c)], ['Hipotesis alternatif', hypo(c)[1]], ['α', fmt(c.alpha, 2)], ['Kolom', names.slice(0, cols.length).join(', ')]],
        sections: [{ heading: 'Ringkasan', sel: '#utSumWrap' }, { heading: 'Langkah Perhitungan', sel: '#utStepsWrap' }, { heading: 'Interpretasi', sel: '#utInterpWrap' }],
        data: { head: ['#'].concat(names.slice(0, cols.length)), rows: Array.from({ length: n }, (_, i) => [i + 1].concat(cols.map((a) => (i < a.length ? a[i] : '')))), caption: 'Data yang dipakai pada perhitungan.' },
        charts: [],
      });
    } catch (e) { /* ekspor opsional */ }
  }
})();
