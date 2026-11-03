/* =========================================================================
   UJI CHI-SQUARE - independensi (tabel kontingensi r x c) dan kesesuaian / goodness of fit (Tables)
   Input: tabel frekuensi (baris = kategori variabel baris, kolom = kategori variabel kolom).
   Hitungan: nonpar-core.js (chiInd, chiGof). Halaman otomatis: #view-chi-square
   ========================================================================= */
(function () {
  'use strict';
  const NP = window.StatNonpar, U = window.StatBasicUI, D = window.StatDist;
  if (!NP || !U || !D || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP, pct } = U;
  const IND = ['Kategori 1', 'Kategori 2', 'Kategori 3'], GOF = ['Observasi', 'Harapan (opsional)'];
  const ui = U.mountPage({
    id: 'chi-square', pre: 'cs', title: 'Uji Chi-Square', eyebrow: 'Metode Statistik &rsaquo; Tables', step1: 'Atur uji &amp; masukkan frekuensi',
    lede: 'Uji independensi dua variabel kategorik dari tabel kontingensi (dengan uji rasio kemungkinan, koreksi Yates untuk 2×2, ukuran asosiasi, dan residual terstandar), atau uji kesesuaian (goodness of fit) frekuensi pengamatan terhadap proporsi harapan.',
    settings: `
      <label>Jenis uji<select id="csMode" class="select-input"><option value="ind">Independensi (tabel kontingensi)</option><option value="gof">Kesesuaian (goodness of fit)</option></select></label>
      <label>Tingkat signifikansi (α)<select id="csAlpha" class="select-input"><option value="0.10">0,10</option><option value="0.05" selected>0,05</option><option value="0.01">0,01</option></select></label>`,
    hint: '<span id="csHintLead">Baris = kategori variabel pertama, kolom = kategori variabel kedua (judul kolom dapat diubah). Isi frekuensi (bilangan bulat ≥ 0).</span> Minimal <strong><span id="csMin">2</span> baris</strong>; sel baris yang dipakai tidak boleh kosong (isi 0 bila tidak ada).',
    table: { names: IND, colLabel: 'Kategori', minCols: 1, maxCols: 12, canAddCol: true }, calcLabel: 'Hitung Chi-Square',
  });
  const q = ui.q, tbl = ui.tbl, mode = () => q('csMode').value;
  const isDef = () => tbl.names.join('|') === IND.join('|') || tbl.names.join('|') === GOF.join('|') || tbl.names.every((n) => /^Kategori \d+$/.test(n));
  function applyMode() {
    const m = mode(), was = isDef();
    if (m === 'gof') { tbl.setCols(2); if (was) tbl.names = GOF.slice(); }
    else { if (tbl.names.length < 2) tbl.setCols(3); if (was) tbl.names = tbl.names.map((_, j) => 'Kategori ' + (j + 1)); }
    tbl.buildHead();
    q('csHintLead').textContent = m === 'ind' ? 'Baris = kategori variabel pertama, kolom = kategori variabel kedua (judul kolom dapat diubah). Isi frekuensi (bilangan bulat ≥ 0).' : 'Kolom 1 = frekuensi pengamatan tiap kategori (satu baris per kategori). Kolom 2 (opsional) = proporsi atau frekuensi harapan; kosongkan bila semua kategori diharapkan sama.';
  }
  q('csMode').addEventListener('change', () => { applyMode(); ui.clearErr(); });
  tbl.register((n) => { if (mode() === 'gof') tbl.setCols(Math.min(2, Math.max(1, n))); else tbl.setCols(Math.max(2, n)); });
  ui.onSample = () => {
    if (mode() === 'ind') tbl.fill(['Setuju', 'Netral', 'Tidak setuju'], [[20, 30], [15, 25], [25, 10]]);
    else tbl.fill(['Observasi', 'Harapan (opsional)'], [[18, 22, 30, 30], []]);
  };
  const rowsOf = (cols) => { const n = Math.max.apply(null, cols.map((c) => c.length)), out = []; for (let i = 0; i < n; i++) out.push(cols.map((c) => (c[i] === undefined ? null : c[i]))); return out; };
  const small = (r) => r.pctLow > 0.2 || r.minE < 1;
  const vLabel = (V, dfs) => { const s = Math.sqrt(dfs); return V < 0.1 / s ? 'dapat diabaikan' : V < 0.3 / s ? 'kecil' : V < 0.5 / s ? 'sedang' : 'besar'; };

  ui.onCalc = () => {
    const m = mode(), alpha = parseFloat(q('csAlpha').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    const all = rowsOf(cols).map((r, i) => ({ r, i })).filter((o) => o.r.some((v) => v !== null));
    const names = tbl.names.map((_, j) => tbl.name(j));
    if (m === 'ind') {
      if (cols.length < 2) return ui.err('Uji independensi membutuhkan minimal 2 kolom (kategori).');
      if (all.length < 2) return ui.err('Uji independensi membutuhkan minimal 2 baris (kategori) yang terisi.');
      for (const o of all) for (let j = 0; j < o.r.length; j++) { const v = o.r[j]; if (v === null) return ui.err(`Baris ${o.i + 1} kolom "${names[j]}" masih kosong; isi dengan 0 bila tidak ada pengamatan.`); if (v < 0 || Math.floor(v) !== v) return ui.err(`Frekuensi harus bilangan bulat ≥ 0 (baris ${o.i + 1}, kolom "${names[j]}").`); }
      const O = all.map((o) => o.r), rn = all.map((o) => 'Baris ' + (o.i + 1)), res = NP.chiInd(O);
      if (res.rowT.some((v) => v === 0) || res.colT.some((v) => v === 0)) return ui.err('Ada baris atau kolom yang jumlahnya 0. Hapus kategori tanpa pengamatan.');
      const rej = res.p < alpha, dfs = Math.min(res.r - 1, res.c - 1), is22 = res.r === 2 && res.c === 2;
      const matrix = (cap, f, totals) => {
        let h = `<table class="result-table bs-res"><caption>${cap}</caption><thead><tr><th class="lbl"></th>${names.map((n) => `<th>${esc(n)}</th>`).join('')}${totals ? '<th>Total</th>' : ''}</tr></thead><tbody>`;
        for (let i = 0; i < res.r; i++) h += `<tr><td class="lbl">${rn[i]}</td>${names.map((_, j) => f(i, j)).join('')}${totals ? `<td><strong>${res.rowT[i]}</strong></td>` : ''}</tr>`;
        if (totals) h += `<tr><td class="lbl">Total</td>${res.colT.map((v) => `<td><strong>${v}</strong></td>`).join('')}<td><strong>${res.N}</strong></td></tr>`;
        return h + '</tbody></table>';
      };
      let sum = matrix('Frekuensi pengamatan (O)', (i, j) => `<td>${O[i][j]}</td>`, true) + matrix('Frekuensi harapan (E = total baris × total kolom / N)', (i, j) => `<td class="${res.E[i][j] < 5 ? 'sig' : ''}">${fmt(res.E[i][j], 3)}</td>`, false) +
        matrix('Residual terstandar terkoreksi (|nilai| > 1,96 → sel menyimpang dari independensi)', (i, j) => `<td class="${Math.abs(res.adj[i][j]) > 1.96 ? 'sig' : ''}">${fmt(res.adj[i][j], 3)}</td>`, false);
      sum += `<table class="result-table bs-res"><caption>Hasil uji independensi (H₀: kedua variabel independen)</caption><thead><tr><th class="lbl">Uji</th><th>Statistik</th><th>df</th><th>p-value</th></tr></thead><tbody>
        <tr><td class="lbl">Chi-Square Pearson</td><td>${fmt(res.chi2)}</td><td>${res.df}</td><td class="${rej ? 'sig' : ''}">${fmtP(res.p)}</td></tr>
        <tr><td class="lbl">Rasio kemungkinan (G)</td><td>${fmt(res.G)}</td><td>${res.df}</td><td class="${res.pG < alpha ? 'sig' : ''}">${fmtP(res.pG)}</td></tr>
        ${is22 ? `<tr><td class="lbl">Chi-Square dengan koreksi Yates</td><td>${fmt(res.yates.chi2)}</td><td>1</td><td class="${res.yates.p < alpha ? 'sig' : ''}">${fmtP(res.yates.p)}</td></tr>` : ''}</tbody></table>
        <table class="result-table bs-res"><caption>Ukuran asosiasi</caption><tbody><tr><td class="lbl">Cramér’s V</td><td>${fmt(res.V, 3)} (${vLabel(res.V, dfs)})</td></tr>${is22 ? `<tr><td class="lbl">Koefisien phi (φ)</td><td>${fmt(res.phi, 3)}</td></tr>` : ''}<tr><td class="lbl">Koefisien kontingensi (C)</td><td>${fmt(res.Cc, 3)}</td></tr>
        <tr><td class="lbl">Sel dengan E &lt; 5</td><td>${res.lowCells} dari ${res.r * res.c} (${pct(res.pctLow)}); E terkecil = ${fmt(res.minE, 3)}</td></tr></tbody></table>
        <p class="bs-note">${small(res) ? '<strong>Perhatian:</strong> lebih dari 20% sel memiliki frekuensi harapan &lt; 5 (atau ada yang &lt; 1), sehingga pendekatan chi-square kurang andal. Gabungkan kategori yang berdekatan' + (is22 ? ' atau gunakan uji eksak Fisher.' : '.') : 'Syarat frekuensi harapan terpenuhi (≤ 20% sel dengan E &lt; 5 dan semua E ≥ 1).'} Sel yang frekuensi harapannya &lt; 5 ditebalkan.</p>`;
      const st = [];
      st.push({ t: 'Hipotesis', f: `H₀: kedua variabel independen (tidak ada asosiasi)\nH₁: kedua variabel berasosiasi\nα = ${fmt(alpha, 2)}`, n: '' });
      st.push({ t: 'Frekuensi harapan', f: `E(i,j) = (total baris i × total kolom j) / N\nContoh: E(1,1) = (${res.rowT[0]} × ${res.colT[0]}) / ${res.N} = ${fmt(res.E[0][0], 4)}`, n: '' });
      const terms = []; for (let i = 0; i < res.r; i++) for (let j = 0; j < res.c; j++) terms.push(`(${O[i][j]} − ${fmt(res.E[i][j], 2)})²/${fmt(res.E[i][j], 2)} = ${fmt((O[i][j] - res.E[i][j]) ** 2 / res.E[i][j], 4)}`);
      st.push({ t: 'Statistik Chi-Square', f: 'χ² = Σ (O − E)² / E\n' + (terms.length > 8 ? terms.slice(0, 8).join('\n') + '\n…' : terms.join('\n')) + `\nχ² = ${fmt(res.chi2)}`, n: '' });
      st.push({ t: 'Derajat bebas & p-value', f: `df = (${res.r} − 1)(${res.c} − 1) = ${res.df}\np-value = ${fmtP(res.p)}\nG = 2 Σ O ln(O/E) = ${fmt(res.G)}, p = ${fmtP(res.pG)}${is22 ? `\nKoreksi Yates: χ² = Σ(|O − E| − 0,5)²/E = ${fmt(res.yates.chi2)}, p = ${fmtP(res.yates.p)}` : ''}`, n: '' });
      st.push({ t: 'Ukuran asosiasi', f: `Cramér's V = √[χ² / (N · min(r−1, c−1))] = √[${fmt(res.chi2)} / (${res.N} × ${dfs})] = ${fmt(res.V, 4)}`, n: 'V berkisar 0 (tidak ada asosiasi) hingga 1 (asosiasi sempurna).' });
      st.push({ t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(res.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' });
      const contrib = []; for (let i = 0; i < res.r; i++) for (let j = 0; j < res.c; j++) if (Math.abs(res.adj[i][j]) > 1.96) contrib.push({ i, j, z: res.adj[i][j] });
      contrib.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
      const ip = [`<strong>Keputusan:</strong> χ² = ${fmt(res.chi2)} dengan df = ${res.df}, p-value = <strong>${fmtP(res.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. ${rej ? 'Terdapat bukti yang cukup bahwa kedua variabel <strong>berasosiasi</strong> (tidak independen).' : 'Belum terdapat bukti yang cukup bahwa kedua variabel berasosiasi.'}`,
        `Kekuatan asosiasi: Cramér’s V = ${fmt(res.V, 3)}, tergolong <strong>${vLabel(res.V, dfs)}</strong>.${rej && res.V < 0.1 ? ' Asosiasi signifikan tetapi sangat lemah (lazim pada sampel besar).' : ''}`];
      if (rej && contrib.length) ip.push('Sel yang paling menyimpang dari independensi: ' + contrib.slice(0, 4).map((o) => `${rn[o.i]} × ${esc(names[o.j])} (O = ${O[o.i][o.j]}, E = ${fmt(res.E[o.i][o.j], 1)}, ${o.z > 0 ? 'lebih banyak' : 'lebih sedikit'} dari harapan)`).join('; ') + '.');
      if (small(res)) ip.push('<strong>Peringatan:</strong> frekuensi harapan terlalu kecil pada banyak sel; hasil chi-square kurang dapat dipercaya.');
      ip.push('<strong>Asumsi:</strong> pengamatan saling bebas (tiap subjek hanya masuk satu sel) dan data berupa frekuensi, bukan persentase.');
      ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Uji independensi Chi-Square</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
      ui.publish({ meta: [['Metode', 'Chi-Square independensi'], ['Ukuran tabel', `${res.r} × ${res.c}`], ['N', res.N], ['α', fmt(alpha, 2)]], data: ui.dataExport(names, O[0].map((_, j) => O.map((r) => r[j]))) });
    } else {
      if (cols.length > 2) return ui.err('Uji kesesuaian memakai maksimal 2 kolom (pengamatan dan harapan).');
      const rowsAll = all, k = rowsAll.length;
      if (k < 2) return ui.err('Uji kesesuaian membutuhkan minimal 2 kategori (baris).');
      const O = []; for (const o of rowsAll) { const v = o.r[0]; if (v === null) return ui.err(`Baris ${o.i + 1}: frekuensi pengamatan masih kosong.`); if (v < 0 || Math.floor(v) !== v) return ui.err(`Frekuensi pengamatan harus bilangan bulat ≥ 0 (baris ${o.i + 1}).`); O.push(v); }
      let props = null; const hasExp = cols.length === 2 && rowsAll.some((o) => o.r[1] !== null);
      if (hasExp) { props = []; for (const o of rowsAll) { const v = o.r[1]; if (v === null || !(v > 0)) return ui.err(`Baris ${o.i + 1}: nilai harapan harus > 0 dan terisi di semua baris (atau kosongkan seluruh kolom harapan).`); props.push(v); } }
      if (sumArr(O) === 0) return ui.err('Total frekuensi pengamatan adalah 0.');
      const res = NP.chiGof(O, props), rej = res.p < alpha, cn = rowsAll.map((o) => 'Kategori ' + (o.i + 1));
      let sum = `<table class="result-table bs-res"><caption>Pengamatan vs harapan</caption><thead><tr><th class="lbl">Kategori</th><th>Pengamatan (O)</th><th>Proporsi harapan</th><th>Harapan (E)</th><th>(O − E)² / E</th><th>Residual terstandar</th></tr></thead><tbody>` +
        O.map((o, i) => `<tr><td class="lbl">${cn[i]}</td><td>${o}</td><td>${fmt(res.props[i], 4)}</td><td class="${res.E[i] < 5 ? 'sig' : ''}">${fmt(res.E[i], 3)}</td><td>${fmt((o - res.E[i]) ** 2 / res.E[i], 4)}</td><td class="${Math.abs(res.resid[i]) > 1.96 ? 'sig' : ''}">${fmt(res.resid[i], 3)}</td></tr>`).join('') + `<tr><td class="lbl">Total</td><td><strong>${res.N}</strong></td><td>1</td><td><strong>${fmt(res.N, 2)}</strong></td><td colspan="2"></td></tr></tbody></table>
        <table class="result-table bs-res"><caption>Hasil uji kesesuaian (H₀: frekuensi sesuai dengan proporsi harapan)</caption><tbody><tr><td class="lbl">Chi-Square (χ²)</td><td>${fmt(res.chi2)}</td></tr><tr><td class="lbl">Derajat bebas (df = k − 1)</td><td>${res.df}</td></tr><tr><td class="lbl">p-value</td><td class="${rej ? 'sig' : ''}">${fmtP(res.p)}</td></tr><tr><td class="lbl">α</td><td>${fmt(alpha, 2)}</td></tr><tr><td class="lbl">Keputusan</td><td><span class="bs-dec ${rej ? 'rej' : 'keep'}">${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}</span></td></tr><tr><td class="lbl">Ukuran efek (Cohen’s w)</td><td>${fmt(res.w, 3)} (${res.w < 0.1 ? 'dapat diabaikan' : res.w < 0.3 ? 'kecil' : res.w < 0.5 ? 'sedang' : 'besar'})</td></tr></tbody></table>
        <p class="bs-note">${small(res) ? '<strong>Perhatian:</strong> frekuensi harapan terlalu kecil (&gt; 20% kategori dengan E &lt; 5, atau ada E &lt; 1); gabungkan kategori atau tambah sampel.' : 'Syarat frekuensi harapan terpenuhi.'} ${hasExp ? 'Kolom harapan dinormalkan menjadi proporsi lalu dikalikan N.' : 'Tanpa kolom harapan, semua kategori diharapkan sama (E = N/k).'}</p>`;
      const st = [{ t: 'Hipotesis', f: `H₀: distribusi pengamatan sesuai dengan proporsi harapan\nH₁: distribusi pengamatan berbeda dari harapan\nα = ${fmt(alpha, 2)}`, n: '' },
        { t: 'Frekuensi harapan', f: `E = N × proporsi harapan\n${cn.slice(0, 8).map((c, i) => `${c}: ${fmt(res.N, 2)} × ${fmt(res.props[i], 4)} = ${fmt(res.E[i], 3)}`).join('\n')}${k > 8 ? '\n…' : ''}`, n: '' },
        { t: 'Statistik Chi-Square', f: `χ² = Σ (O − E)² / E\n${O.slice(0, 8).map((o, i) => `(${o} − ${fmt(res.E[i], 2)})² / ${fmt(res.E[i], 2)} = ${fmt((o - res.E[i]) ** 2 / res.E[i], 4)}`).join('\n')}${k > 8 ? '\n…' : ''}\nχ² = ${fmt(res.chi2)}`, n: '' },
        { t: 'Derajat bebas & p-value', f: `df = k − 1 = ${k} − 1 = ${res.df}\np-value = ${fmtP(res.p)}`, n: '' },
        { t: 'Keputusan', f: `p-value ${rej ? '<' : '≥'} α  (${fmtP(res.p)} ${rej ? '<' : '≥'} ${fmt(alpha, 2)})\n→ ${rej ? 'Tolak H₀' : 'Gagal menolak H₀'}`, n: '' }];
      const dev = res.resid.map((z, i) => ({ i, z })).filter((o) => Math.abs(o.z) > 1.96).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
      const ip = [`<strong>Keputusan:</strong> χ² = ${fmt(res.chi2)}, df = ${res.df}, p-value = <strong>${fmtP(res.p)}</strong> ${rej ? '<' : '≥'} α = ${fmt(alpha, 2)}, sehingga H₀ <strong>${rej ? 'ditolak' : 'tidak ditolak'}</strong>. ${rej ? 'Frekuensi pengamatan <strong>tidak sesuai</strong> dengan proporsi harapan.' : 'Frekuensi pengamatan dapat dianggap sesuai dengan proporsi harapan.'}`];
      if (rej && dev.length) ip.push('Kategori yang paling menyimpang: ' + dev.slice(0, 4).map((o) => `${cn[o.i]} (O = ${O[o.i]}, E = ${fmt(res.E[o.i], 1)}, ${o.z > 0 ? 'lebih banyak' : 'lebih sedikit'} dari harapan)`).join('; ') + '.');
      if (small(res)) ip.push('<strong>Peringatan:</strong> frekuensi harapan terlalu kecil; hasil kurang dapat dipercaya.');
      ip.push('<strong>Asumsi:</strong> pengamatan saling bebas dan tiap pengamatan masuk tepat satu kategori.');
      ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Uji kesesuaian Chi-Square</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
      ui.publish({ meta: [['Metode', 'Chi-Square kesesuaian (goodness of fit)'], ['Jumlah kategori', k], ['N', res.N], ['α', fmt(alpha, 2)]], data: ui.dataExport(['Pengamatan', 'Harapan'], [O, props || O.map(() => '')]) });
    }
  };
  function sumArr(a) { return a.reduce((s, v) => s + v, 0); }
})();
