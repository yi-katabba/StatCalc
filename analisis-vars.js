/* Layar Analisis (ponsel/tablet): kartu "Variabel yang dipakai" (Y, X, Faktor) dan ringkasan n.
   Sumber: StatCalcVars (Method/Calc/sheet-vars.js). Dimuat SETELAH sheet-vars.js. */
(function () {
  'use strict';
  var V = window.StatCalcVars, SC = window.StatCalc;
  if (!V) return;
  var hosts = ['view-metode', 'view-metode-stat'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if (!hosts.length) return;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function chip(tag, name, dashed) {
    return '<span class="av-role' + (dashed ? ' dashed' : '') + '"><i>' + tag + '</i><span class="av-n">' + esc(name) + '</span></span>';
  }
  function html() {
    var s = V.summary(), h = '<div class="av-k">Variabel yang dipakai</div>';
    if (!s.n || !(s.num || s.cat)) {
      return h + '<div class="av-empty">Belum ada data. Isi atau impor data di Lembar, lalu variabel muncul di sini.</div>' +
        '<button type="button" class="av-link" data-av="sheet">Buka Lembar</button>';
    }
    h += '<div class="av-chips">';
    if (s.y) h += chip('Y', s.y);
    s.xs.forEach(function (x) { h += chip('X', x); });
    if (s.factor) h += chip('Faktor', s.factor, true);
    if (!s.y && !s.xs.length && !s.factor) h += '<span class="av-none">Belum ada kolom numerik.</span>';
    h += '</div><div class="av-sum">n = ' + s.n + ' \u00B7 ' + s.num + ' variabel numerik' + (s.cat ? ' \u00B7 ' + s.cat + ' kategorik' : '') + '</div>' +
      '<button type="button" class="av-link" data-av="sheet">Ubah di Lembar</button>';
    return h;
  }
  var cards = hosts.map(function (v) {
    var c = document.createElement('section');
    c.className = 'av-card'; c.setAttribute('aria-label', 'Variabel yang dipakai');
    var cover = v.querySelector('.cover');
    if (cover && cover.nextSibling) v.insertBefore(c, cover.nextSibling); else v.appendChild(c);
    c.addEventListener('click', function (e) {
      if (e.target.closest('[data-av="sheet"]') && SC && SC.navigate) SC.navigate('metode-calc', { backTo: 'metode' });
    });
    return c;
  });
  function render() { var h = html(); cards.forEach(function (c) { c.innerHTML = h; }); }
  render();
  V.onChange(render);
  window.StatCalcAnalisisVars = { render: render };
})();
