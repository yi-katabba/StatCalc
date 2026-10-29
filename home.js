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

  /* ---------------- Kartu "Lembar aktif" + ilustrasi di banner (desktop) ---------------- */
  var banner = home.querySelector('.sky-banner'), card = null;
  var ART = '<svg width="440" height="270" viewBox="0 0 440 270" aria-hidden="true" focusable="false"><rect x="1" y="1" width="438" height="268" rx="16" fill="rgba(0,0,0,.14)" stroke="rgba(255,255,255,.18)"/>' +
    [60, 100, 140, 180].map(function (y) { return '<line x1="30" y1="' + y + '" x2="420" y2="' + y + '" stroke="#34506A" stroke-dasharray="3 5"/>'; }).join('') +
    '<g stroke="#4A647C"><line x1="30" y1="240" x2="420" y2="240"/><line x1="30" y1="20" x2="30" y2="240"/></g>' +
    '<g fill="#4A647C"><rect x="48" y="196" width="28" height="44"/><rect x="80" y="170" width="28" height="70"/><rect x="112" y="140" width="28" height="100"/><rect x="144" y="160" width="28" height="80"/><rect x="176" y="198" width="28" height="42"/></g>' +
    '<path d="M44 240 C80 240 100 60 150 60 S214 240 250 240 Z" fill="rgba(143,163,181,.18)" stroke="#8FA3B5" stroke-width="2"/>' +
    '<g fill="#E8B867"><circle cx="270" cy="200" r="4.5"/><circle cx="295" cy="170" r="4.5"/><circle cx="320" cy="176" r="4.5"/><circle cx="342" cy="130" r="4.5"/><circle cx="366" cy="118" r="4.5"/><circle cx="392" cy="84" r="4.5"/><circle cx="305" cy="196" r="4.5"/></g>' +
    '<line x1="262" y1="212" x2="402" y2="74" stroke="#fff" stroke-width="2"/></svg>';
  var THUMB = '<svg class="hs-thumb" width="130" height="86" viewBox="0 0 130 86" aria-hidden="true" focusable="false"><g fill="#E8B867"><circle cx="22" cy="62" r="3.5"/><circle cx="38" cy="54" r="3.5"/><circle cx="52" cy="50" r="3.5"/><circle cx="64" cy="38" r="3.5"/><circle cx="82" cy="40" r="3.5"/><circle cx="96" cy="26" r="3.5"/><circle cx="110" cy="20" r="3.5"/></g><line x1="14" y1="68" x2="118" y2="16" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/></svg>';
  function whenTxt(ts) {
    if (!ts) return '';
    var d = new Date(ts), n = new Date(), t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(), dd = Math.floor((t0 - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
    return dd <= 0 ? 'diubah hari ini' : dd === 1 ? 'diubah kemarin' : 'diubah ' + d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()] + ' ' + d.getFullYear();
  }
  function mountSheetCard() {
    if (!banner || card) return;
    var art = document.createElement('div'); art.className = 'hm-art'; art.innerHTML = ART;
    card = document.createElement('section'); card.className = 'hm-sheet'; card.setAttribute('aria-label', 'Lembar aktif');
    banner.appendChild(art); banner.appendChild(card);
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hs]'); if (!b) return;
      var A = window.StatCalcSheet && window.StatCalcSheet.api;
      if (b.dataset.hs === 'import') { var imp = $('pjImport'); if (imp) imp.click(); return; }
      SC.navigate('metode-calc', { backTo: 'home' });
      if (b.dataset.hs === 'run' && A && A.openStatTab) A.openStatTab();
    });
  }
  function renderSheetCard() {
    if (!card) return;
    var V = window.StatCalcVars, P = window.StatCalcProjects, s = V && V.summary ? V.summary() : { n: 0, num: 0, cat: 0, xs: [] };
    var pr = null; try { var id = P && P.current && P.current(); pr = id && P.list ? P.list().filter(function (x) { return x.id === id; })[0] : null; } catch (e) { pr = null; }
    var has = s.n > 0 && (s.num || s.cat), name = pr ? pr.name : 'Belum ada proyek';
    var h = '<div class="hs-top"><span class="hs-k">LEMBAR AKTIF</span><span class="hs-bd' + (has ? '' : ' off') + '">' + (has ? (pr ? 'Tersimpan' : 'Belum disimpan') : 'Kosong') + '</span></div>' +
      '<div class="hs-name">' + esc(name) + '</div>';
    if (!has) {
      h += '<p class="hs-msg">Lembar masih kosong. Impor data Excel atau CSV untuk memulai.</p>' +
        '<div class="hs-act"><button type="button" class="hs-b p" data-hs="import">Impor data</button><button type="button" class="hs-b" data-hs="open">Buka Lembar</button></div>';
    } else {
      var chips = '';
      if (s.y) chips += '<span class="hs-chip"><i class="y">Y</i>' + esc(s.y) + '</span>';
      s.xs.slice(0, 3).forEach(function (x) { chips += '<span class="hs-chip"><i>X</i>' + esc(x) + '</span>'; });
      if (s.xs.length > 3) chips += '<span class="hs-chip">+' + (s.xs.length - 3) + ' lagi</span>';
      if (!chips) chips = '<span class="hs-chip">Belum ada kolom numerik</span>';
      h += '<div class="hs-sub">' + s.n + ' baris \u00B7 ' + s.num + ' variabel numerik' + (s.cat ? ' \u00B7 ' + s.cat + ' kategorik' : '') + (pr && pr.updated ? ' \u00B7 ' + whenTxt(pr.updated) : '') + '</div>' +
        '<div class="hs-mid">' + ((s.y && s.xs.length) ? THUMB : '') + '<div class="hs-chips">' + chips + '</div></div>' +
        '<div class="hs-act"><button type="button" class="hs-b p" data-hs="open">Lanjutkan di Lembar</button><button type="button" class="hs-b" data-hs="run">Jalankan analisis</button></div>';
    }
    card.innerHTML = h;
  }

  function render() { renderLearn(); mountSheetCard(); renderSheetCard(); }
  window.addEventListener('load', function () {
    render();
    if (window.StatCalcMateri && window.StatCalcMateri.onProgress) window.StatCalcMateri.onProgress(function () { if (home.classList.contains('active')) render(); });
  });
  new MutationObserver(function () { if (home.classList.contains('active')) render(); }).observe(home, { attributes: true, attributeFilter: ['class'] });
  if (window.StatCalcVars && window.StatCalcVars.onChange) window.StatCalcVars.onChange(function () { if (home.classList.contains('active')) renderSheetCard(); });
  if (window.StatCalcProjects && window.StatCalcProjects.onRefresh) window.StatCalcProjects.onRefresh(function () { renderSheetCard(); });
  window.StatCalcHome = { render: render };
})();
