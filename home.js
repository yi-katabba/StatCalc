/* Beranda: "Mulai dari metode" (8 metode), "Lanjutkan belajar" (progres Materi), dan "Fungsi cepat".
   Daftar "Proyek terakhir" dibuat projects.js ke dalam #pjSlot. Dimuat SETELAH projects.js. */
(function () {
  'use strict';
  var home = document.getElementById('view-home'), SC = window.StatCalc;
  if (!home || !SC) return;
  var $ = function (id) { return document.getElementById(id); };
  var TITLES = { deskriptif: 'Statistika Deskriptif', regresi: 'Regresi Linear', anova: 'ANOVA Lengkap', rsm: 'Response Surface (RSM)', smoothing: 'Metode Smoothing', stasioner: 'Uji Stasioneritas', arima: 'ARIMA & SARIMA' };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------------- navigasi ---------------- */
  function go(target) {
    SC.navigate(target, { backTo: 'home' });
    if (target === 'kalkulator' && window.StatCalcCalc && window.StatCalcCalc.reset) window.StatCalcCalc.reset();
  }
  home.addEventListener('click', function (e) {
    var m = e.target.closest('#hmMethods [data-m]');
    if (m) {
      var id = m.dataset.m;
      if (id === 'grafik') { SC.navigate('metode-graph', { backTo: 'home' }); return; }
      if (SC.trackMethodUse) SC.trackMethodUse(id);
      SC.goToMethod(id, TITLES[id], 'home'); return;
    }
    var n = e.target.closest('.hm [data-nav]');
    if (n) { go(n.dataset.nav); return; }
    var t = e.target.closest('#hmLearn [data-topic]');
    if (t && window.StatCalcMateri) window.StatCalcMateri.open(t.dataset.topic, t.dataset.sec || null, { backTo: 'home' });
  });

  /* ---------------- Lanjutkan belajar ---------------- */
  function status(p) { return p.done ? 'Selesai' : p.started ? p.read + ' dari ' + p.total + ' bagian' : 'Belum dimulai'; }
  function renderLearn() {
    var box = $('hmLearn'), M = window.StatCalcMateri; if (!box) return;
    var list = M && M.progress ? M.progress() : [];
    if (!list.length) { box.innerHTML = '<p class="hm-empty">Materi belum tersedia.</p>'; return; }
    var cur = list.filter(function (p) { return p.started && !p.done; }).sort(function (a, b) { return b.t - a.t; })[0] || list.filter(function (p) { return !p.done; })[0] || null;
    var html = '';
    if (cur) {
      var pct = cur.total ? Math.round(cur.read / cur.total * 100) : 0;
      html += '<div class="hm-cur"><div class="hm-cur-t">' + esc(cur.title) + '</div>' +
        '<div class="hm-cur-s">' + (cur.started ? 'Bagian ' + (cur.lastIndex + 1) + ' dari ' + cur.total + (cur.lastTitle ? ' \u00B7 ' + esc(cur.lastTitle) : '') : cur.total + ' bagian \u00B7 belum dimulai') + '</div>' +
        '<div class="hm-pg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Progres ' + esc(cur.title) + '"><i style="width:' + pct + '%"></i></div></div>' +
        '<button type="button" class="hm-go" data-topic="' + esc(cur.id) + '"' + (cur.lastId ? ' data-sec="' + esc(cur.lastId) + '"' : '') + '>' + (cur.started ? 'Lanjutkan membaca' : 'Mulai membaca') + '</button>';
    } else {
      html += '<div class="hm-cur"><div class="hm-cur-t">Semua materi selesai</div><div class="hm-cur-s">Buka topik mana pun untuk mengulang.</div></div>';
    }
    var others = list.filter(function (p) { return !cur || p.id !== cur.id; }).slice(0, 4);
    if (others.length) html += '<div class="hm-rows">' + others.map(function (p) {
      return '<button type="button" class="hm-row" data-topic="' + esc(p.id) + '"><span>' + esc(p.title) + '</span><span class="hm-st' + (p.done ? ' done' : '') + '">' + status(p) + '</span></button>';
    }).join('') + '</div>';
    box.innerHTML = html;
  }

  function render() { renderLearn(); }
  window.addEventListener('load', function () {
    render();
    if (window.StatCalcMateri && window.StatCalcMateri.onProgress) window.StatCalcMateri.onProgress(function () { if (home.classList.contains('active')) render(); });
  });
  new MutationObserver(function () { if (home.classList.contains('active')) render(); }).observe(home, { attributes: true, attributeFilter: ['class'] });
  window.StatCalcHome = { render: render };
})();
