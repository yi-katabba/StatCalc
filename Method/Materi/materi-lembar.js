/* "Coba di lembar" - kartu data contoh di halaman baca Materi; memuat data ke Lembar kerja Calc */
(function () {
  'use strict';
  var T = ['Hari', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  function ts(h, v) { return [[h[0], h[1]]].concat(v.map(function (x, i) { return [i + 1, x]; })); }
  var BELAJAR = [['Jam_Belajar', 'Nilai', 'Kelas'], [2, 55, 'A'], [3, 60, 'A'], [4, 64, 'A'], [5, 70, 'A'], [6, 72, 'B'], [7, 79, 'B'], [8, 83, 'B'], [9, 88, 'B']];
  var DATA = {
    regresi: { t: 'Jam_Belajar vs Nilai', rows: BELAJAR },
    deskriptif: { t: 'Jam_Belajar vs Nilai', rows: BELAJAR },
    anova: { t: 'Nilai tiga metode mengajar', rows: [['Metode', 'Nilai'], ['A', 72], ['A', 75], ['A', 70], ['B', 80], ['B', 78], ['B', 83], ['C', 65], ['C', 68], ['C', 70]] },
    smoothing: { t: 'Penjualan bulanan', rows: ts(['Bulan', 'Penjualan'], [120, 132, 128, 141, 150, 147, 160, 171, 168, 180, 192, 188]) },
    stasioner: { t: 'Penjualan bulanan', rows: ts(['Bulan', 'Penjualan'], [120, 132, 128, 141, 150, 147, 160, 171, 168, 180, 192, 188]) },
    arima: { t: 'Penjualan bulanan', rows: ts(['Bulan', 'Penjualan'], [120, 132, 128, 141, 150, 147, 160, 171, 168, 180, 192, 188]) }
  };
  var view = document.getElementById('view-materi-detail');
  if (!view) return;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function add() {
    var M = window.StatCalcMateri, id = M && M.currentId && M.currentId(), d = id && DATA[id];
    var head = view.querySelector('.mt-head');
    if (!d || !head || view.querySelector('.mt-try')) return;
    var shown = d.rows.slice(0, 5), more = d.rows.length - 5;
    var card = document.createElement('section');
    card.className = 'mt-try';
    card.innerHTML = '<h3>Coba di lembar</h3><p>Buka data contoh ini di lembar kerja, lalu jalankan analisisnya sendiri.</p>' +
      '<div class="mt-try-tbl"><table><thead><tr>' + shown[0].map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      shown.slice(1).map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') +
      (more > 0 ? '<tr><td colspan="' + shown[0].length + '" class="more">\u2026 ' + (d.rows.length - 1) + ' baris</td></tr>' : '') + '</tbody></table></div>' +
      '<button type="button" class="mt-try-go">Buka di Lembar</button>';
    head.insertAdjacentElement('afterend', card);
    card.querySelector('.mt-try-go').addEventListener('click', function () {
      var S = window.StatCalcSheet, A = window.StatCalc;
      if (!S || !A || !A.navigate) return;
      A.navigate('metode-calc', { backTo: 'materi' });
      S.loadGrid(d.rows.map(function (r) { return r.slice(); }));
    });
  }
  new MutationObserver(add).observe(view, { childList: true, subtree: true });
  add();
})();
