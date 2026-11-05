/* =========================================================================
   UKURAN SAMPEL SURVEI (Power and Sample Size) - Slovin, Cochran, Lemeshow, estimasi rata-rata
   Hitungan: power-core.js (survey). Halaman otomatis: #view-sampel-survei
   ========================================================================= */
(function () {
  'use strict';
  const PW = window.StatPower, U = window.StatBasicUI, D = window.StatDist;
  if (!PW || !U || !U.mountPage) return;
  const { esc, toNum, fmt, pct } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : String(Number(v.toPrecision(d || 6))).replace('.', ','));
  const ui = U.mountPage({
    id: 'sampel-survei', pre: 'sv', title: 'Ukuran Sampel Survei', eyebrow: 'Metode Statistik &rsaquo; Power and Sample Size', step1: 'Isi parameter survei',
    lede: 'Hitung jumlah responden yang dibutuhkan untuk survei: rumus Slovin (populasi terbatas), Cochran (proporsi, dengan koreksi populasi hingga), Lemeshow (proporsi populasi diketahui atau tidak diketahui), dan estimasi rata-rata. Dapat disesuaikan dengan design effect dan tingkat respons yang diharapkan.',
    settings: `
      <label>Ukuran populasi (N), kosongkan bila tidak diketahui<input type="text" id="svN" class="plain-input" inputmode="numeric" autocomplete="off" placeholder="mis. 5000"></label>
      <label>Tingkat kepercayaan<select id="svConf" class="select-input"><option value="0.90">90% (z = 1,645)</option><option value="0.95" selected>95% (z = 1,960)</option><option value="0.99">99% (z = 2,576)</option></select></label>
      <label>Margin of error / presisi (e), dalam %<input type="text" id="svE" class="plain-input" inputmode="decimal" value="5" autocomplete="off"></label>
      <label>Proporsi populasi (p), dalam % (50 = paling konservatif)<input type="text" id="svP" class="plain-input" inputmode="decimal" value="50" autocomplete="off"></label>
      <label>Simpangan baku populasi (σ) untuk estimasi rata-rata<input type="text" id="svSd" class="plain-input" inputmode="decimal" autocomplete="off" placeholder="mis. 12"></label>
      <label>Kesalahan absolut yang ditoleransi (E) untuk rata-rata<input type="text" id="svAbs" class="plain-input" inputmode="decimal" autocomplete="off" placeholder="mis. 2"></label>
      <label>Design effect (deff)<input type="text" id="svDeff" class="plain-input" inputmode="decimal" value="1" autocomplete="off"></label>
      <label>Tingkat respons yang diharapkan (%)<input type="text" id="svRr" class="plain-input" inputmode="decimal" value="100" autocomplete="off"></label>`,
    hint: 'Hasil dibulatkan <strong>ke atas</strong>. Slovin hanya memakai N dan e; Cochran/Lemeshow memakai tingkat kepercayaan dan proporsi; estimasi rata-rata memakai σ dan E. Design effect &gt; 1 dipakai pada sampling bergerombol (cluster); respons &lt; 100% menaikkan jumlah yang harus dihubungi.',
    table: null, calcLabel: 'Hitung Ukuran Sampel', sampleLabel: null,
  });
  const q = ui.q, num = (id) => { const v = q(id).value.trim(); return v === '' ? NaN : toNum(v); };
  ui.onCalc = () => {
    const N = num('svN'), conf = parseFloat(q('svConf').value), e = num('svE') / 100, p = num('svP') / 100, sd = num('svSd'), E = num('svAbs'), deff = num('svDeff'), rr = num('svRr') / 100;
    if (q('svN').value.trim() !== '' && !(N >= 2 && Math.floor(N) === N)) return ui.err('Ukuran populasi harus bilangan bulat ≥ 2 (atau kosongkan).');
    if (!(e > 0 && e < 1)) return ui.err('Margin of error (e) harus antara 0 dan 100 (%), mis. 5.'); if (!(p > 0 && p < 1)) return ui.err('Proporsi p harus di antara 0 dan 100 (%), tidak termasuk 0 dan 100.');
    if (!(deff >= 1)) return ui.err('Design effect harus ≥ 1.'); if (!(rr > 0 && rr <= 1)) return ui.err('Tingkat respons harus di antara 0 dan 100 (%).');
    const hasN = Number.isFinite(N), z = PW.zOf(conf), adj = (n) => Math.ceil(n * deff / rr), up = (n) => Math.ceil(n - 1e-9);
    const rows = [];
    if (hasN) { const n = PW.survey.slovin(N, e); rows.push({ k: 'Slovin', n, f: `n = N / (1 + N e²) = ${N} / (1 + ${N} × ${g(e * e)}) = ${g(n)}`, note: 'Tidak memakai tingkat kepercayaan maupun proporsi; mengandaikan populasi terbatas yang diketahui.' }); }
    const co = PW.survey.cochran(conf, p, e, hasN ? N : 0); rows.push({ k: 'Cochran', n: co.n, f: `n₀ = z² p (1 − p) / e² = ${g(z * z)} × ${g(p * (1 - p))} / ${g(e * e)} = ${g(co.n0)}` + (hasN ? `\nKoreksi populasi hingga: n = n₀ / [1 + (n₀ − 1)/N] = ${g(co.n0)} / [1 + (${g(co.n0 - 1)})/${N}] = ${g(co.n)}` : ''), note: 'Standar untuk estimasi proporsi; p = 50% memberi sampel terbesar (aman).' });
    const lm = PW.survey.lemeshow(conf, p, e, hasN ? N : 0); rows.push({ k: 'Lemeshow', n: lm, f: hasN ? `n = N z² p(1 − p) / [d²(N − 1) + z² p(1 − p)] = ${N} × ${g(z * z * p * (1 - p))} / [${g(e * e)} × ${N - 1} + ${g(z * z * p * (1 - p))}] = ${g(lm)}` : `n = z² p(1 − p) / d² = ${g(z * z * p * (1 - p))} / ${g(e * e)} = ${g(lm)}`, note: 'Untuk populasi tidak diketahui memberi hasil sama dengan n₀ Cochran; dengan N diketahui sama dengan koreksi populasi hingga.' });
    let hasMean = false; if (Number.isFinite(sd) && Number.isFinite(E)) { if (!(sd > 0 && E > 0)) return ui.err('σ dan E harus > 0.'); const mn = PW.survey.mean(conf, sd, E, hasN ? N : 0); hasMean = true; rows.push({ k: 'Estimasi rata-rata', n: mn.n, f: `n₀ = (z σ / E)² = (${g(z)} × ${g(sd)} / ${g(E)})² = ${g(mn.n0)}` + (hasN ? `\nKoreksi populasi hingga: n = ${g(mn.n)}` : ''), note: 'Untuk menaksir rata-rata populasi dengan kesalahan absolut maksimum E.' }); }
    let sum = `<table class="result-table bs-res"><caption>Ukuran sampel menurut metode (kepercayaan ${pct(conf)}, e = ${fmt(e * 100, 2)}%, p = ${fmt(p * 100, 1)}%${hasN ? ', N = ' + N : ', populasi tak diketahui'})</caption><thead><tr><th class="lbl">Metode</th><th>n (belum disesuaikan)</th><th>Dibulatkan ke atas</th><th>Setelah deff &amp; respons</th></tr></thead><tbody>` +
      rows.map((r) => `<tr><td class="lbl">${esc(r.k)}</td><td>${fmt(r.n, 3)}</td><td><strong>${up(r.n)}</strong></td><td class="sig">${adj(r.n)}</td></tr>`).join('') + `</tbody></table><p class="bs-note">Kolom terakhir = n × deff / tingkat respons${deff === 1 && rr === 1 ? ' (tidak ada penyesuaian karena deff = 1 dan respons 100%)' : ` = n × ${g(deff)} / ${g(rr)}`}, yaitu jumlah responden yang perlu <em>dihubungi</em>.${hasN && co.n >= N * 0.95 ? ' <strong>Perhatian:</strong> ukuran sampel mendekati ukuran populasi; pertimbangkan sensus.' : ''}</p>`;
    const st = [{ t: 'Parameter', f: `Tingkat kepercayaan ${pct(conf)} → z = ${g(z, 5)}\nMargin of error e = ${fmt(e * 100, 2)}%;  proporsi p = ${fmt(p * 100, 1)}%${hasN ? `;  populasi N = ${N}` : ''}\nDesign effect = ${g(deff)};  tingkat respons = ${fmt(rr * 100, 1)}%`, n: '' }].concat(rows.map((r) => ({ t: r.k, f: r.f + `\n→ dibulatkan ke atas: ${up(r.n)}`, n: r.note })));
    const lead = rows.find((r) => r.k === 'Cochran');
    const ip = [`<strong>Ringkasan:</strong> untuk survei proporsi dengan kepercayaan ${pct(conf)} dan margin of error ±${fmt(e * 100, 2)}%, Cochran${hasN ? ' (dengan koreksi populasi)' : ''} menghasilkan <strong>${up(lead.n)} responden</strong>${hasN ? ` dari populasi ${N}` : ''}; Lemeshow ${up(lm)}${hasN ? `, Slovin ${up(rows[0].n)}` : ''}.`];
    if (hasN) ip.push(`<strong>Slovin vs Cochran/Lemeshow:</strong> Slovin (${up(rows[0].n)}) tidak mempertimbangkan tingkat kepercayaan maupun variasi populasi, sehingga hasilnya bisa lebih kecil atau lebih besar daripada Cochran (${up(co.n)}). Untuk karya ilmiah, jelaskan alasan memilih rumus dan asumsinya.`);
    if (deff > 1 || rr < 1) ip.push(`Dengan design effect ${g(deff)} dan respons ${fmt(rr * 100, 0)}%, jumlah yang perlu dihubungi menjadi <strong>${adj(lead.n)}</strong>.`);
    if (p === 0.5) ip.push('p = 50% adalah asumsi paling konservatif (menghasilkan sampel terbesar); bila ada studi pendahuluan, memakai p sebenarnya dapat menghemat sampel.'); 
    ip.push('<strong>Catatan:</strong> rumus-rumus ini mengandaikan sampling acak sederhana. Pada sampling bertingkat atau bergerombol kalikan dengan design effect, dan untuk analisis subkelompok (mis. per wilayah) hitung ukuran sampel tiap subkelompok. Untuk membandingkan dua kelompok atau menguji hipotesis, gunakan perhitungan Power & Ukuran Sampel.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Ukuran sampel survei</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Ukuran sampel survei (Slovin / Cochran / Lemeshow)'], ['Kepercayaan', pct(conf)], ['e', fmt(e * 100, 2) + '%'], ['Cochran', up(lead.n)], ['Lemeshow', up(lm)]] });
  };
})();
