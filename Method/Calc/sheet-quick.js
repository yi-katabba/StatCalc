/* Analisis cepat - chip pintas di bawah lembar kerja (memakai tombol "Buka & analisis" milik sheet.js) */
(function () {
  'use strict';
  var view = document.getElementById('view-metode-calc'), sh = window.StatCalcSheet;
  if (!view || !sh) return;
  var host = view.querySelector('.chapter-inner') || view;
  var ITEMS = [['regresi', 'Regresi'], ['deskriptif', 'Deskriptif'], ['scatter', 'Scatter'], ['histogram', 'Histogram'], ['smoothing', 'Smoothing']];
  var bar = document.createElement('div');
  bar.className = 'sc-quick';
  bar.innerHTML = '<div class="sq-k">Analisis cepat</div><div class="sq-row">' +
    ITEMS.map(function (it, i) { return '<button type="button" class="sq-chip' + (i === 0 ? ' pri' : '') + '" data-m="' + it[0] + '">' + it[1] + '</button>'; }).join('') +
    '</div><div class="sq-info" id="sqInfo"></div>';
  host.appendChild(bar);
  var info = bar.querySelector('#sqInfo');
  function upd() {
    try { var b = sh.usedBounds(), n = Math.max(0, b.R - (sh.state.header ? 1 : 0)); info.textContent = 'n = ' + n + ' \u00B7 ' + b.C + ' kolom \u00B7 offline'; } catch (e) { info.textContent = 'offline'; }
  }
  upd();
  if (sh.onChange) sh.onChange(upd);
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('.sq-chip'); if (!b) return;
    var sel = document.getElementById('scTarget'), go = document.getElementById('scSend');
    if (!sel || !go) return;
    sel.value = b.dataset.m; go.click();
  });
})();
