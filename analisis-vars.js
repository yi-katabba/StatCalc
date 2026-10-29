/* Layar Analisis (ponsel/tablet): kartu "Variabel yang dipakai" (Y, X, Faktor) dan ringkasan n.
   Kartu juga jadi pintu masuk ke Lembar: tombol "Jalankan di Lembar" membuka Lembar dengan metode terpilih.
   Kartu metode di bawahnya selalu membuka halaman metode; data Lembar dimuat lewat tombol "Isi dari Lembar" di halaman itu.
   Sumber: StatCalcVars (Method/Calc/sheet-vars.js), StatCalcSheet.api (sheet.js). Dimuat SETELAH sheet-vars.js. */
(function () {
  'use strict';
  var V = window.StatCalcVars, SC = window.StatCalc;
  if (!V) return;
  var hosts = ['view-metode', 'view-metode-stat', 'view-metode-graph'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if (!hosts.length) return;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function chip(tag, name, dashed) {
    return '<span class="av-role' + (dashed ? ' dashed' : '') + '"><i>' + tag + '</i><span class="av-n">' + esc(name) + '</span></span>';
  }
  var A = (window.StatCalcSheet && window.StatCalcSheet.api) || null;
  function methodSelect() {
    if (!A || !A.methodList) return '';
    var cur = A.getMethod();
    return '<label class="av-meth"><span>Metode</span><select class="av-sel" aria-label="Metode untuk dijalankan di Lembar">' +
      A.methodList().filter(function (m) { return A.canRun(m.id); }).map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === cur ? ' selected' : '') + '>' + esc(m.title) + '</option>';
      }).join('') + '</select></label>';
  }
  function html(graph) {
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
    h += '</div><div class="av-sum">n = ' + s.n + ' \u00B7 ' + s.num + ' variabel numerik' + (s.cat ? ' \u00B7 ' + s.cat + ' kategorik' : '') + '</div>';
    /* pintu masuk: data belum otomatis dipakai oleh halaman metode, jadi jelaskan dua jalannya */
    if (graph) {
      /* layar Graph: grafik dibuat dari tab Grafik di Lembar, atau lewat kartu grafik di bawah (Isi dari Lembar) */
      return h + '<button type="button" class="av-go" data-av="graph">Buat grafik di Lembar</button>' +
        '<button type="button" class="av-link" data-av="sheet">Ubah di Lembar</button>' +
        '<div class="av-hint">Atau pilih grafik di bawah, lalu ketuk <strong>Isi dari Lembar</strong> di halaman grafik itu.</div>';
    }
    h += methodSelect() +
      '<button type="button" class="av-go" data-av="go">Jalankan di Lembar</button>' +
      '<button type="button" class="av-link" data-av="sheet">Ubah di Lembar</button>';
    return h;
  }
  var cards = hosts.map(function (v) {
    var c = document.createElement('section');
    c.className = 'av-card'; c.setAttribute('aria-label', 'Variabel yang dipakai');
    var cover = v.querySelector('.cover');
    if (cover && cover.nextSibling) v.insertBefore(c, cover.nextSibling); else v.appendChild(c);
    var back = v.id === 'view-metode-stat' ? 'metode-stat' : v.id === 'view-metode-graph' ? 'metode-graph' : 'metode';
    c.dataset.graph = v.id === 'view-metode-graph' ? '1' : '';
    c.addEventListener('click', function (e) {
      var b = e.target.closest('[data-av]'); if (!b || !SC || !SC.navigate) return;
      if (b.dataset.av === 'sheet') { SC.navigate('metode-calc', { backTo: back }); return; }
      if (b.dataset.av === 'graph') {
        SC.navigate('metode-calc', { backTo: back });
        if (A && A.openGraphTab) A.openGraphTab();
        return;
      }
      if (b.dataset.av === 'go') {
        /* buka Lembar dengan metode terpilih di tab Statistik; pengguna menekan "Jalankan analisis" sendiri */
        var sel = c.querySelector('.av-sel');
        SC.navigate('metode-calc', { backTo: back });
        if (A) { if (sel && A.canRun(sel.value)) A.pickMethod(sel.value); A.openStatTab(); }
      }
    });
    c.addEventListener('change', function (e) {
      if (e.target.classList.contains('av-sel') && A && A.canRun(e.target.value)) { A.pickMethod(e.target.value); syncSelects(); }
    });
    return c;
  });
  function syncSelects() {
    if (!A || !A.getMethod) return;
    cards.forEach(function (c) { var s = c.querySelector('.av-sel'); if (s) s.value = A.getMethod(); });
  }
  function render() { var h = html(false), g = html(true); cards.forEach(function (c) { c.innerHTML = c.dataset.graph ? g : h; }); }
  render();
  V.onChange(render);
  /* pilihan metode bisa berubah di Lembar: samakan tiap kali layar Analisis ditampilkan */
  hosts.forEach(function (v) { new MutationObserver(function () { if (v.classList.contains('active')) syncSelects(); }).observe(v, { attributes: true, attributeFilter: ['class'] }); });
  window.StatCalcAnalisisVars = { render: render };
})();
