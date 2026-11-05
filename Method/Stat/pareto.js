/* =========================================================================
   DIAGRAM PARETO (Quality Tools) - frekuensi kategori terurut + persentase kumulatif, "vital few" (aturan 80/20)
   Input: satu kategori per baris ("nama, jumlah" — pemisah koma, titik koma, titik dua, atau tab).
   Hitungan: quality-core.js (pareto). Halaman otomatis: #view-pareto
   ========================================================================= */
(function () {
  'use strict';
  const QC = window.StatQuality, SV = window.StatSvg, U = window.StatBasicUI;
  if (!QC || !SV || !U || !U.mountPage) return;
  const { esc, fmt } = U;
  const SAMPLE = 'Goresan, 48\nRetak, 31\nWarna tidak sesuai, 22\nDimensi di luar toleransi, 17\nKemasan rusak, 9\nLabel salah, 6\nBau, 3\nLainnya kecil, 2';
  const ui = U.mountPage({
    id: 'pareto', pre: 'pt', title: 'Diagram Pareto', eyebrow: 'Metode Statistik &rsaquo; Quality Tools', step1: 'Masukkan kategori &amp; frekuensi',
    lede: 'Urutkan penyebab (jenis cacat, keluhan, downtime) dari yang paling sering ke yang paling jarang, lengkap dengan persentase kumulatif. Aturan Pareto (80/20) membantu menemukan “sedikit yang vital” (vital few) yang layak diprioritaskan.',
    settings: `
      <label style="grid-column:1/-1">Kategori dan jumlah (satu per baris: <em>nama, jumlah</em>)<textarea id="ptText" class="plain-input" rows="8" spellcheck="false" style="height:auto;min-height:150px;padding:10px;font-family:var(--font-body);line-height:1.45" placeholder="Goresan, 48&#10;Retak, 31&#10;..."></textarea></label>
      <label>Garis batas kumulatif<select id="ptCut" class="select-input"><option value="70">70%</option><option value="80" selected>80% (aturan Pareto)</option><option value="90">90%</option></select></label>
      <label>Gabungkan kategori kecil menjadi “Lainnya”<select id="ptOther" class="select-input"><option value="0" selected>Tidak digabung</option><option value="1">&lt; 1% dari total</option><option value="2">&lt; 2% dari total</option><option value="3">&lt; 3% dari total</option><option value="5">&lt; 5% dari total</option></select></label>`,
    hint: 'Pemisah nama dan jumlah boleh koma, titik koma, titik dua, atau tab (bisa ditempel langsung dari Excel dua kolom). Nama yang sama dijumlahkan. Minimal 2 kategori dengan jumlah &gt; 0.',
    table: null, calcLabel: 'Buat Diagram Pareto', sampleLabel: 'Isi contoh data',
  });
  const q = ui.q; q('ptText').value = '';
  ui.onSample = () => { q('ptText').value = SAMPLE; };
  ui.onCalc = () => {
    const cut = parseFloat(q('ptCut').value), oth = parseFloat(q('ptOther').value), lines = q('ptText').value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), map = new Map(), badL = [];
    if (!lines.length) return ui.err('Isi data kategori dan jumlah terlebih dahulu (satu per baris).');
    lines.forEach((l, i) => { const m = l.match(/^(.*?)[\t;:,]\s*([-+]?\d+(?:[.,]\d+)?)\s*$/); if (!m || !m[1].trim()) { badL.push(i + 1); return; } const v = parseFloat(m[2].replace(',', '.')); if (!(v >= 0)) { badL.push(i + 1); return; } const k = m[1].trim(); map.set(k, (map.get(k) || 0) + v); });
    if (badL.length) return ui.err('Baris tidak dapat dibaca atau jumlah negatif: baris ' + badL.slice(0, 6).join(', ') + (badL.length > 6 ? ' …' : '') + '. Format yang benar: “nama, jumlah”.');
    const items = Array.from(map, ([name, count]) => ({ name, count })).filter((x) => x.count > 0); if (items.length < 2) return ui.err('Dibutuhkan minimal 2 kategori dengan jumlah > 0.');
    const r = QC.pareto(items, { otherPct: oth, cutoff: cut }), rows = r.rows, vital = r.vital, top = rows.slice(0, vital);
    let sum = SV.pareto({ labels: rows.map((x) => x.name), counts: rows.map((x) => x.count), cum: rows.map((x) => x.cum), vital, title: 'Diagram Pareto' }) + `<p class="bs-note" style="text-align:center">Batang gelap = kategori “vital few” (sampai kumulatif ≥ ${cut}%); garis oranye = persentase kumulatif; garis merah putus-putus = ${cut === 80 ? '80%' : 'batas'}${cut !== 80 ? '' : ''}.</p>`;
    sum += `<table class="result-table bs-res"><caption>Tabel Pareto (total = ${fmt(r.total, 2)})</caption><thead><tr><th class="lbl">Peringkat</th><th class="lbl">Kategori</th><th>Jumlah</th><th>Persen</th><th>Kumulatif</th></tr></thead><tbody>` + rows.map((x, i) => `<tr><td class="lbl">${i + 1}</td><td class="lbl">${esc(x.name)}${x.merged ? ' (' + x.merged + ' kategori)' : ''}</td><td>${fmt(x.count, 2)}</td><td>${fmt(x.pct, 2)}%</td><td class="${i < vital ? 'sig' : ''}">${fmt(x.cum, 2)}%</td></tr>`).join('') + '</tbody></table>';
    const st = [{ t: 'Pengurutan', f: `Urutkan ${rows.length} kategori menurun menurut jumlah${oth > 0 ? `\nKategori dengan porsi < ${oth}% digabung menjadi “Lainnya” (diletakkan di akhir)` : ''}`, n: '' },
      { t: 'Persentase & kumulatif', f: `Persen = jumlah / total × 100%,  total = ${fmt(r.total, 2)}\nKumulatif = jumlah persen dari kategori pertama sampai kategori ini\n` + rows.slice(0, 6).map((x) => `${x.name}: ${fmt(x.pct, 2)}% → kumulatif ${fmt(x.cum, 2)}%`).join('\n') + (rows.length > 6 ? '\n…' : ''), n: '' },
      { t: 'Vital few', f: `Kategori sampai kumulatif pertama ≥ ${cut}%: ${vital} dari ${rows.length} kategori (${fmt(vital / rows.length * 100, 1)}% dari jenis) menyumbang ${fmt(rows[vital - 1].cum, 1)}% dari total`, n: 'Aturan Pareto: sekitar 80% dampak berasal dari sekitar 20% penyebab.' }];
    const ip = [`<strong>Vital few:</strong> ${vital} dari ${rows.length} kategori (${top.map((x) => esc(x.name)).join(', ')}) menyumbang <strong>${fmt(rows[vital - 1].cum, 1)}%</strong> dari total ${fmt(r.total, 2)}. Prioritaskan perbaikan pada kategori ini.`,
      `Kategori terbesar, <strong>${esc(rows[0].name)}</strong>, saja menyumbang ${fmt(rows[0].pct, 1)}%.${rows[0].pct < 100 / rows.length * 1.5 ? ' Distribusinya relatif merata (tidak ada satu penyebab yang dominan), sehingga prinsip Pareto kurang tajam.' : ''}`];
    if (vital / rows.length > 0.5) ip.push('Kategori vital mencakup lebih dari separuh jenis: penyebab tersebar luas, pertimbangkan mengelompokkan kategori dengan cara lain.');
    ip.push('<strong>Catatan:</strong> Pareto menunjukkan <em>frekuensi</em>, bukan dampak biaya atau keparahan; bila keparahan berbeda jauh, buat Pareto berbobot (jumlah × biaya) sebagai pelengkap.');
    ui.show({ sum, steps: st, interp: `<div class="bs-var"><h4>Analisis Pareto</h4>${ip.map((p) => `<p>${p}</p>`).join('')}</div>` });
    ui.publish({ meta: [['Metode', 'Diagram Pareto'], ['Kategori', rows.length], ['Total', fmt(r.total, 2)], ['Vital few', vital + ' kategori (' + fmt(rows[vital - 1].cum, 1) + '%)']], data: { head: ['Peringkat', 'Kategori', 'Jumlah', 'Persen', 'Kumulatif'], rows: rows.map((x, i) => [i + 1, x.name, x.count, +x.pct.toFixed(3), +x.cum.toFixed(3)]), caption: 'Tabel Pareto.' } });
  };
})();
