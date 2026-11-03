/* =========================================================================
   REGRESI LOGISTIK BINER (Regression) - respon 0/1, prediktor numerik
   Penaksiran maximum likelihood (IRLS/Newton-Raphson): koefisien, uji Wald, odds ratio + CI, uji rasio kemungkinan, R² semu, tabel klasifikasi, AUC.
   Hitungan: reg-core.js (logistic). Halaman otomatis: #view-logistik
   ========================================================================= */
(function () {
  'use strict';
  const RG = window.StatRegX, U = window.StatBasicUI, D = window.StatDist;
  if (!RG || !U || !D || !U.mountPage) return;
  const { esc, toNum, fmt, fmtP, pct } = U;
  const g = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '-' : v === Infinity ? '∞' : String(Number(v.toPrecision(d || 5))).replace('.', ','));
  const ui = U.mountPage({
    id: 'logistik', pre: 'lg', title: 'Regresi Logistik Biner', eyebrow: 'Metode Statistik &rsaquo; Regression', step1: 'Atur model &amp; masukkan data',
    lede: 'Modelkan peluang suatu kejadian (Y = 1) terhadap satu atau lebih prediktor numerik. Hasilnya berupa koefisien logit, uji Wald, odds ratio dengan selang kepercayaan, uji rasio kemungkinan model, R² semu (McFadden, Cox-Snell, Nagelkerke), tabel klasifikasi, dan AUC.',
    settings: `
      <label>Titik potong klasifikasi (cut-off)<input type="text" id="lgCut" class="plain-input" inputmode="decimal" value="0,5" autocomplete="off"></label>
      <label>Tingkat signifikansi (α)<select id="lgAlpha" class="select-input"><option value="0.10">0,10 (CI 90%)</option><option value="0.05" selected>0,05 (CI 95%)</option><option value="0.01">0,01 (CI 99%)</option></select></label>`,
    hint: 'Kolom 1 = Y (hanya <strong>0</strong> dan <strong>1</strong>; 1 = kejadian yang diperhatikan), kolom lain = prediktor numerik X (maksimal 10; variabel kategorik dikodekan 0/1 lebih dulu). Baris yang ada sel kosongnya dibuang. Minimal <strong><span id="lgMin">10</span> baris</strong> lengkap.',
    table: { names: ['Y (0/1)', 'X1', 'X2'], colLabel: 'X', minCols: 2, maxCols: 11, canAddCol: true }, calcLabel: 'Hitung Regresi Logistik',
  });
  const q = ui.q, tbl = ui.tbl; tbl.register();
  ui.onSample = () => {
    const n = 40, X1 = [], X2 = [], Y = []; let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) { const a = +(rnd() * 8 + 1).toFixed(1), b = +(rnd() * 6).toFixed(1), z = -4 + 0.7 * a - 0.5 * b + (rnd() - 0.5) * 3; X1.push(a); X2.push(b); Y.push(1 / (1 + Math.exp(-z)) > rnd() ? 1 : 0); }
    tbl.fill(['Lulus', 'Jam belajar', 'Jam absen'], [Y, X1, X2]);
  };
  ui.onCalc = () => {
    const alpha = parseFloat(q('lgAlpha').value), cut = toNum(q('lgCut').value), { cols, bad } = tbl.collect();
    if (bad.length) return ui.err('Ada sel yang bukan angka: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …' : '') + '. Perbaiki sel yang ditandai merah.');
    if (cut === null || Number.isNaN(cut) || !(cut > 0 && cut < 1)) return ui.err('Titik potong harus di antara 0 dan 1 (mis. 0,5).');
    const nm = tbl.names.map((_, j) => tbl.name(j)), k = cols.length, nr = Math.max.apply(null, cols.map((c) => c.length)), rows = []; let dropped = 0;
    for (let i = 0; i < nr; i++) { const r = cols.map((c) => (c[i] === undefined ? null : c[i])); if (r.every((v) => v === null)) continue; if (r.some((v) => v === null)) { dropped++; continue; } rows.push(r); }
    const n = rows.length, p = k - 1, y = rows.map((r) => r[0]), Xc = []; for (let j = 1; j < k; j++) Xc.push(rows.map((r) => r[j])); const vn = nm.slice(1);
    if (p < 1) return ui.err('Dibutuhkan minimal 1 kolom prediktor selain kolom Y.');
    if (y.some((v) => v !== 0 && v !== 1)) return ui.err('Kolom Y hanya boleh berisi 0 dan 1.');
    const n1 = y.reduce((s, v) => s + v, 0), n0 = n - n1; if (n1 < 1 || n0 < 1) return ui.err('Kolom Y harus memuat kedua nilai (0 dan 1).');
    if (n < p + 5) return ui.err(`Dibutuhkan minimal ${p + 5} baris lengkap untuk ${p} prediktor (sekarang ${n}).`);
    if (Xc.some((c) => Math.max.apply(null, c) === Math.min.apply(null, c))) return ui.err('Ada prediktor yang nilainya konstan; hapus kolom tersebut.');
    let m; try { m = RG.logistic(Xc, y, { cutoff: cut, alpha }); } catch (e) { return ui.err('Model tidak dapat dihitung: ada prediktor yang berkorelasi sempurna (kolinear). Hapus salah satu kolom yang berulang.'); }
    const sigLR = m.pLR < alpha, epv = Math.min(n1, n0) / p, c = m.cls;
    const names = ['Konstanta'].concat(vn);
    let sum = '';
    if (!m.converged || m.separation) sum += `<p class="bs-note" style="color:var(--bad,#a33)"><strong>Peringatan:</strong> ${!m.converged ? 'iterasi tidak konvergen dalam 100 langkah. ' : ''}${m.separation ? 'Terdeteksi <em>pemisahan sempurna / hampir sempurna</em> (prediktor memisahkan Y = 0 dan Y = 1) sehingga koefisien dan galat bakunya sangat besar dan tidak dapat dipercaya. Sederhanakan model atau tambah data.' : ''}</p>`;
    sum += `<table class="result-table bs-res"><caption>Ringkasan model (n = ${n}; Y = 1: ${n1}, Y = 0: ${n0})</caption><tbody>
      <tr><td class="lbl">Log-likelihood model / nol</td><td>${fmt(m.ll, 3)} / ${fmt(m.ll0, 3)}</td></tr><tr><td class="lbl">Deviance model / nol</td><td>${fmt(m.deviance, 3)} / ${fmt(m.nullDeviance, 3)}</td></tr>
      <tr><td class="lbl">Uji rasio kemungkinan (χ², db ${m.dfm})</td><td>${fmt(m.LR, 3)}, p = <span class="${sigLR ? 'sig' : ''}">${fmtP(m.pLR)}</span></td></tr>
      <tr><td class="lbl">R² McFadden / Cox-Snell / Nagelkerke</td><td>${fmt(m.mcfadden, 4)} / ${fmt(m.coxsnell, 4)} / ${fmt(m.nagelkerke, 4)}</td></tr><tr><td class="lbl">AIC / BIC</td><td>${fmt(m.aic, 2)} / ${fmt(m.bic, 2)}</td></tr>
      <tr><td class="lbl">Iterasi</td><td>${m.iter} (${m.converged ? 'konvergen' : 'tidak konvergen'})</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Koefisien &amp; odds ratio (Wald, CI ${pct(1 - alpha)})</caption><thead><tr><th class="lbl">Suku</th><th>Koefisien (B)</th><th>SE</th><th>z</th><th>p-value</th><th>Odds ratio</th><th>CI odds ratio</th></tr></thead><tbody>${m.beta.map((b, i) => `<tr><td class="lbl">${esc(names[i])}</td><td>${g(b)}</td><td>${g(m.se[i])}</td><td>${fmt(m.z[i], 3)}</td><td class="${m.p_z[i] < alpha ? 'sig' : ''}">${fmtP(m.p_z[i])}</td><td>${i === 0 ? '-' : g(m.or[i])}</td><td>${i === 0 ? '-' : '[' + g(m.orLo[i]) + ' ; ' + g(m.orHi[i]) + ']'}</td></tr>`).join('')}</tbody></table>
      <table class="result-table bs-res"><caption>Tabel klasifikasi (cut-off = ${fmt(cut, 2)})</caption><thead><tr><th class="lbl"></th><th>Prediksi 1</th><th>Prediksi 0</th><th>Total</th></tr></thead><tbody><tr><td class="lbl">Aktual 1</td><td>${c.tp}</td><td>${c.fn}</td><td>${n1}</td></tr><tr><td class="lbl">Aktual 0</td><td>${c.fp}</td><td>${c.tn}</td><td>${n0}</td></tr></tbody></table>
      <table class="result-table bs-res"><caption>Ukuran ketepatan klasifikasi</caption><tbody><tr><td class="lbl">Akurasi</td><td>${fmt(c.acc * 100, 2)}%</td></tr><tr><td class="lbl">Sensitivitas (benar 1)</td><td>${fmt(c.sens * 100, 2)}%</td></tr><tr><td class="lbl">Spesifisitas (benar 0)</td><td>${fmt(c.spec * 100, 2)}%</td></tr><tr><td class="lbl">Nilai prediksi positif / negatif</td><td>${fmt(c.ppv * 100, 2)}% / ${fmt(c.npv * 100, 2)}%</td></tr><tr><td class="lbl">AUC (luas di bawah kurva ROC)</td><td>${fmt(m.auc, 4)}</td></tr></tbody></table>
      <p class="bs-note">${dropped ? dropped + ' baris dengan sel kosong dibuang. ' : ''}Odds ratio = exp(B): perubahan odds Y = 1 untuk kenaikan 1 satuan prediktor, dengan prediktor lain tetap. Uji Wald memakai distribusi normal. ${epv < 10 ? '<strong>Perhatian:</strong> jumlah kejadian per prediktor (EPV = ' + fmt(epv, 1) + ') kurang dari 10, sehingga estimasi bisa tidak stabil.' : 'EPV = ' + fmt(epv, 1) + ' (cukup).'}</p>`;
    const st = [{ t: 'Model', f: `logit(P(Y = 1)) = ln[P / (1 − P)] = β₀ + ${vn.map((v, i) => 'β' + (i + 1) + '·' + v).join(' + ')}\nP = 1 / [1 + exp(−(β₀ + Σβⱼxⱼ))]`, n: '' },
      { t: 'Penaksiran (maximum likelihood)', f: `Dihitung iteratif dengan IRLS / Newton-Raphson:\nβ ← β + (XᵀWX)⁻¹ Xᵀ(y − μ),  W = diag[μ(1 − μ)]\nIterasi: ${m.iter}, ${m.converged ? 'konvergen' : 'belum konvergen'}\n${m.beta.map((b, i) => `β̂${i} (${names[i]}) = ${g(b)}`).join('\n')}`, n: 'Galat baku diambil dari akar diagonal (XᵀWX)⁻¹ pada solusi akhir.' },
      { t: 'Log-likelihood & deviance', f: `ln L = Σ[y ln μ + (1 − y) ln(1 − μ)] = ${fmt(m.ll, 4)}\nModel nol (hanya konstanta): ln L₀ = n₁ ln(n₁/n) + n₀ ln(n₀/n) = ${fmt(m.ll0, 4)}\nDeviance = −2 ln L = ${fmt(m.deviance, 3)}`, n: '' },
      { t: 'Uji rasio kemungkinan model', f: `χ² = 2(ln L − ln L₀) = ${fmt(m.LR, 4)},  db = ${m.dfm},  p-value = ${fmtP(m.pLR)}`, n: 'H₀: semua koefisien prediktor = 0.' },
      { t: 'Uji Wald koefisien', f: m.beta.slice(1).map((b, i) => `${vn[i]}: z = B/SE = ${g(b)} / ${g(m.se[i + 1])} = ${fmt(m.z[i + 1], 3)}, p = ${fmtP(m.p_z[i + 1])}\n   OR = exp(${g(b)}) = ${g(m.or[i + 1])}, CI ${pct(1 - alpha)} = [${g(m.orLo[i + 1])} ; ${g(m.orHi[i + 1])}]`).join('\n'), n: 'CI odds ratio = exp(B ± z × SE).' },
      { t: 'R² semu', f: `McFadden = 1 − lnL/lnL₀ = ${fmt(m.mcfadden, 4)}\nCox-Snell = 1 − exp[2(lnL₀ − lnL)/n] = ${fmt(m.coxsnell, 4)}\nNagelkerke = Cox-Snell / [1 − exp(2 lnL₀/n)] = ${fmt(m.nagelkerke, 4)}`, n: 'Nilai McFadden 0,2–0,4 sudah tergolong baik; tidak dapat dibandingkan langsung dengan R² regresi linear.' },
      { t: 'Klasifikasi & AUC', f: `Prediksi 1 bila P ≥ ${fmt(cut, 2)}\nAkurasi = (${c.tp} + ${c.tn}) / ${n} = ${fmt(c.acc * 100, 2)}%\nSensitivitas = ${c.tp}/${n1} = ${fmt(c.sens * 100, 2)}%;  Spesifisitas = ${c.tn}/${n0} = ${fmt(c.spec * 100, 2)}%\nAUC = P(P̂ kasus 1 > P̂ kasus 0) = ${fmt(m.auc, 4)}`, n: '' }];
    const auc = m.auc, aucL = auc >= 0.9 ? 'sangat baik' : auc >= 0.8 ? 'baik' : auc >= 0.7 ? 'cukup' : auc >= 0.6 ? 'lemah' : 'hampir tidak membedakan';
    const ip = [`<strong>Model keseluruhan:</strong> χ² = ${fmt(m.LR, 3)}, db = ${m.dfm}, p-value = <strong>${fmtP(m.pLR)}</strong> ${sigLR ? '<' : '≥'} α = ${fmt(alpha, 2)} → ${sigLR ? 'model dengan prediktor <strong>lebih baik</strong> daripada model tanpa prediktor' : 'model belum lebih baik daripada model tanpa prediktor'}. R² McFadden = ${fmt(m.mcfadden, 3)}.`];
    for (let i = 1; i < m.beta.length; i++) { const sg = m.p_z[i] < alpha, o = m.or[i]; ip.push(`<strong>${esc(names[i])}:</strong> B = ${g(m.beta[i])}, p = ${fmtP(m.p_z[i])} → ${sg ? 'berpengaruh <strong>signifikan</strong>' : 'tidak signifikan'}. Odds ratio = ${g(o)} (CI ${pct(1 - alpha)} [${g(m.orLo[i])} ; ${g(m.orHi[i])}]): setiap kenaikan 1 satuan ${esc(names[i])}, odds ${esc(nm[0])} = 1 ${o > 1 ? 'naik ' + g(o) + ' kali (naik ' + g((o - 1) * 100, 3) + '%)' : o < 1 ? 'turun menjadi ' + g(o) + ' kali (turun ' + g((1 - o) * 100, 3) + '%)' : 'tidak berubah'}, dengan prediktor lain tetap.${m.orLo[i] <= 1 && m.orHi[i] >= 1 ? ' CI memuat 1, konsisten dengan tidak signifikan.' : ''}`); }
    ip.push(`<strong>Ketepatan:</strong> pada cut-off ${fmt(cut, 2)} akurasi ${fmt(c.acc * 100, 1)}% (sensitivitas ${fmt(c.sens * 100, 1)}%, spesifisitas ${fmt(c.spec * 100, 1)}%). AUC = ${fmt(auc, 3)} → daya pembeda <strong>${aucL}</strong>.${Math.abs(n1 - n0) / n > 0.5 ? ' Kelas tidak seimbang; akurasi bisa menyesatkan, perhatikan sensitivitas/spesifisitas dan coba cut-off lain.' : ''}`);
    if (epv < 10) ip.push('<strong>Peringatan:</strong> EPV &lt; 10 — prediktor terlalu banyak untuk jumlah kejadian; kurangi prediktor atau tambah data.');
    ip.push('<strong>Asumsi:</strong> pengamatan saling bebas, hubungan logit–prediktor linear, tidak ada multikolinearitas berat, dan tidak ada pemisahan sempurna. Uji kecocokan (mis. Hosmer-Lemeshow) belum disertakan.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Regresi logistik biner</h4>${ip.map((x) => `<p>${x}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Regresi logistik biner'], ['n', n], ['Y = 1 / Y = 0', n1 + ' / ' + n0], ['α', fmt(alpha, 2)]], data: ui.dataExport(nm, nm.map((_, j) => rows.map((r) => r[j]))) });
  };
})();
