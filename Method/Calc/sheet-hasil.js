/* =========================================================================
   CALC > HASIL DI DALAM LEMBAR (Method/Calc/sheet-hasil.js)
   -------------------------------------------------------------------------
   Hasil metode Stat tampil di panel kanan layar Lembar, bukan di halaman
   metode terpisah:
   - Desktop (>= 1280px): panel kanan dengan tab Ringkasan | Tabel | Langkah | Grafik.
   - Ponsel / tablet: segmen Data | Hasil di atas lembar.
   Cara kerja: sheet.js mengirim data ke halaman metode (tanpa berpindah halaman)
   dan menekan tombol hitungnya; modul ini menunggu hasil muncul di halaman metode
   lalu menyalin tampilannya ke panel. Interaksi lanjutan (pilihan uji asumsi,
   parameter model) tetap di halaman lengkap lewat tombol "Buka halaman lengkap".
   Dimuat SETELAH Method/Calc/sheet.js.
   ========================================================================= */
(function () {
  'use strict';
  var view = document.getElementById('view-metode-calc'), sh = window.StatCalcSheet;
  if (!view || !sh) return;
  var host = view.querySelector('.chapter-inner') || view;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* rc = kartu hasil; extra = kartu tambahan [selektor, tab tujuan]; err = elemen pesan galat */
  var M = {
    deskriptif: { title: 'Statistika Deskriptif', rc: '#ds-results-card', extra: [], err: '#dsErr' },
    regresi: { title: 'Regresi Linear', rc: '#results-card', extra: [['#conclusion-card', 'ringkasan'], ['#assumptions-card', 'tabel']], err: '#dataError' },
    anova: { title: 'ANOVA Satu Arah', rc: '#an-results-card', extra: [['#an-conclusion-card', 'ringkasan']], err: '#anDataError' },
    rsm: { title: 'Response Surface (RSM)', rc: '#rs-results-card', extra: [['#rs-conclusion-card', 'ringkasan']], err: '#rsDataError' },
    smoothing: { title: 'Metode Smoothing', rc: '#sm-results-card', extra: [['#sm-eval-card', 'ringkasan']], err: '#smDataError' },
    stasioner: { title: 'Uji Stasioneritas', rc: '#st-results-card', extra: [['#st-conclusion-card', 'ringkasan']], err: '#stDataError' },
    arima: { title: 'ARIMA & SARIMA', rc: '#ar-results-card', extra: [['#ar-eval-card', 'ringkasan']], err: '#arDataError' },
  };
  var TABS = [['ringkasan', 'Ringkasan'], ['tabel', 'Tabel'], ['langkah', 'Langkah'], ['grafik', 'Grafik']];
  function kind(label) {
    var t = String(label).toLowerCase();
    if (/langkah/.test(t)) return 'langkah';
    if (/grafik|plot/.test(t)) return 'grafik';
    if (/kesimpulan|ringkasan|interpretasi|identifikasi/.test(t)) return 'ringkasan';
    return 'tabel';
  }

  /* ------------------------------ kerangka panel ------------------------------ */
  var seg = document.createElement('div');
  seg.className = 'sc-seg'; seg.setAttribute('role', 'tablist'); seg.setAttribute('aria-label', 'Tampilan Lembar');
  seg.innerHTML = '<button type="button" role="tab" data-s="data" aria-selected="true">Data</button><button type="button" role="tab" data-s="hasil" aria-selected="false">Hasil</button>';
  var head = $('.chapter-head', host);
  if (head && head.nextSibling) host.insertBefore(seg, head.nextSibling); else host.insertBefore(seg, host.firstChild);
  host.setAttribute('data-seg', 'data');

  var panel = document.createElement('aside');
  panel.className = 'sc-res'; panel.setAttribute('aria-label', 'Hasil analisis');
  panel.innerHTML =
    '<div class="sr-top"><div><div class="sr-title" id="srTitle">Hasil analisis</div><div class="sr-sub" id="srSub"></div></div>' +
    '<button type="button" class="sr-x" id="srClose" aria-label="Tutup panel hasil" title="Tutup">&times;</button></div>' +
    '<div class="sr-tabs" role="tablist">' + TABS.map(function (t, i) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (i === 0) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
    '<div class="sr-body" id="srBody"></div>' +
    '<div class="sr-foot"><button type="button" class="btn-ghost" id="srOpen">Buka halaman lengkap</button></div>';
  host.appendChild(panel);

  var state = { id: null, tab: 'ringkasan', parts: null, status: 'idle', uid: null };
  /* daftar hasil proyek: tiap analisis yang selesai dicatat (maks. 12), dipakai Panel Proyek */
  var results = [], listeners = [], MAXR = 12, SHORT = { deskriptif: 'Deskriptif', regresi: 'Regresi', anova: 'ANOVA', rsm: 'RSM', smoothing: 'Smoothing', stasioner: 'Stasioner', arima: 'ARIMA' };
  function notify() { listeners.forEach(function (f) { try { f(); } catch (e) { /* abaikan */ } }); }
  function newUid() { return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  /* HTML hasil yang dipulihkan dari berkas dibersihkan: tanpa skrip, penangan on*, atau tautan javascript: */
  function clean(html) {
    var t = document.createElement('template'); t.innerHTML = String(html || '');
    $$('script,iframe,object,embed,link,meta,style,base,form,foreignObject', t.content).forEach(function (n) { n.remove(); });
    $$('*', t.content).forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var nm = a.name.toLowerCase(), v = String(a.value).replace(/[\s\u0000-\u001f]+/g, '').toLowerCase();
        if (nm.indexOf('on') === 0 || nm === 'srcdoc') n.removeAttribute(a.name);
        else if ((nm === 'href' || nm === 'src' || nm === 'xlink:href' || nm === 'action') && /^(javascript:|vbscript:|data:(?!image\/(png|jpe?g|gif|webp);))/.test(v)) n.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }
  var body = $('#srBody', panel);

  function setSeg(s) {
    host.setAttribute('data-seg', s);
    $$('button', seg).forEach(function (b) { b.setAttribute('aria-selected', b.dataset.s === s ? 'true' : 'false'); });
  }
  function setTab(t) {
    state.tab = t;
    $$('.sr-tabs button', panel).forEach(function (b) { b.setAttribute('aria-selected', b.dataset.t === t ? 'true' : 'false'); });
    paint();
  }
  function paint() {
    if (state.status === 'loading') { body.innerHTML = '<p class="sr-msg">Menghitung…</p>'; return; }
    if (state.status === 'error') { body.innerHTML = '<p class="sr-msg err" role="alert">' + esc(state.error || 'Analisis gagal dijalankan.') + '</p><p class="sr-msg">Periksa data di Lembar, atau buka halaman lengkap untuk mengatur parameter metode.</p>'; return; }
    var h = state.parts && state.parts[state.tab];
    body.innerHTML = h || '<p class="sr-msg">Tidak ada isi untuk tab ini pada metode ' + esc(M[state.id] ? M[state.id].title : '') + '.</p>';
  }
  /* Hasil muncul di kanan ATAS: gulir halaman ke atas agar panel sejajar dengan bagian atas lembar
     (tombol Analisis cepat ada di bawah lembar, jadi halaman biasanya sedang tergulir ke bawah) */
  function toTop() {
    try {
      for (var n = host.parentNode; n && n !== document.body; n = n.parentNode) if (n.scrollTop) n.scrollTop = 0;
      window.scrollTo(0, 0);
    } catch (e) { /* abaikan */ }
  }
  function showPanel() { host.classList.add('has-res'); toTop(); }

  seg.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var s = b.dataset.s; setSeg(s);
  });
  $('.sr-tabs', panel).addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setTab(b.dataset.t); });
  function hidePanel() { host.classList.remove('has-res'); setSeg('data'); notify(); }
  $('#srClose', panel).addEventListener('click', hidePanel);
  $('#srOpen', panel).addEventListener('click', function () {
    var m = M[state.id]; if (!m || !window.StatCalc) return;
    window.StatCalc.goToMethod(state.id, m.title, 'metode-calc');
  });

  /* ------------------------------- salin hasil ------------------------------- */
  /* Hapus id biasa (hindari id ganda); id di dalam SVG diberi akhiran agar rujukan url(#id) tetap benar */
  function htmlOf(node) {
    var c = node.cloneNode(true), ids = [];
    /* kanvas tidak ikut tersalin: ganti dengan gambar dari isi kanvas asal */
    var src = $$('canvas', node), dst = $$('canvas', c);
    dst.forEach(function (cv, i) {
      try {
        var im = document.createElement('img'); im.src = src[i].toDataURL('image/png'); im.alt = 'Grafik hasil analisis';
        im.style.maxWidth = '100%'; im.style.height = 'auto'; cv.parentNode.replaceChild(im, cv);
      } catch (e) { /* kanvas tidak dapat dibaca: dibiarkan */ }
    });
    $$('[id]', c).forEach(function (e) { if (e.closest && e.closest('svg')) ids.push(e.id); else e.removeAttribute('id'); });
    var h = c.innerHTML;
    ids.forEach(function (id) {
      h = h.split('id="' + id + '"').join('id="' + id + '-h"').split('url(#' + id + ')').join('url(#' + id + '-h)').split('href="#' + id + '"').join('href="#' + id + '-h"');
    });
    return h;
  }
  function section(title, html) { return '<section class="sr-sec">' + (title ? '<h4 class="sr-h">' + esc(title) + '</h4>' : '') + html + '</section>'; }

  function build(id) {
    var m = M[id], rc = $(m.rc); if (!rc) return null;
    var parts = { ringkasan: [], tabel: [], langkah: [], grafik: [] }, labels = { ringkasan: [], tabel: [], langkah: [], grafik: [] };
    var firstGrid = null;
    var btns = $$('.tabs .tab-btn', rc);
    btns.forEach(function (b) {
      b.click();                                           /* sebagian grafik baru digambar saat tabnya dibuka */
      var p = document.getElementById(b.dataset.tab); if (!p) return;
      var k = kind(b.textContent), g = $('.stat-grid', p);
      if (g && !firstGrid) firstGrid = g;
      parts[k].push([b.textContent.trim(), htmlOf(p)]);
    });
    if (btns[0]) btns[0].click();
    var out = { ringkasan: '', tabel: '', langkah: '', grafik: '' };
    var multi = {};
    /* ubin ringkas (R², p, ...) dari tab pertama yang memilikinya */
    var tiles = firstGrid ? '<div class="stat-grid">' + htmlOf(firstGrid) + '</div>' : '';
    m.extra.forEach(function (x) {
      var c = $(x[0]); if (!c || c.hidden) return;
      var h2 = $('h2', c), w = $('[id$="Wrap"]', c);
      parts[x[1]].push([h2 ? h2.textContent.trim() : '', w ? htmlOf(w) : htmlOf(c)]);
    });
    /* Ringkasan: ubin + isi bertanda ringkasan; bila kosong pakai tab tabel pertama */
    if (!parts.ringkasan.length && parts.tabel.length) parts.ringkasan.push(parts.tabel[0]);
    Object.keys(parts).forEach(function (k) {
      multi[k] = parts[k].length > 1;
      out[k] = parts[k].map(function (x) { return section(multi[k] ? x[0] : '', x[1]); }).join('');
    });
    out.ringkasan = tiles + out.ringkasan;
    return out;
  }

  /* --------------------------------- API ------------------------------------ */
  var timer = null;
  function dims() {
    try { var b = sh.usedBounds(); return Math.max(0, b.R - (sh.state.header ? 1 : 0)); } catch (e) { return 0; }
  }
  function sub(id) { return 'n = ' + dims() + ' · dari data Lembar'; }

  function record(id, parts) {
    var n = 1; results.forEach(function (r) { if (r.id === id && r.n >= n) n = r.n + 1; });
    var r = { uid: newUid(), id: id, n: n, title: M[id].title, sub: $('#srSub', panel).textContent, parts: parts, t: Date.now() };
    results.push(r); if (results.length > MAXR) results.shift();
    state.uid = r.uid; notify();
  }
  function showResult(uid) {
    var r = results.filter(function (x) { return x.uid === uid; })[0]; if (!r || !M[r.id]) return false;
    clearTimeout(timer);
    state.id = r.id; state.uid = r.uid; state.status = 'ready'; state.parts = r.parts; state.error = '';
    $('#srTitle', panel).textContent = r.title; $('#srSub', panel).textContent = r.sub || '';
    showPanel(); setSeg('hasil'); setTab('ringkasan'); notify(); return true;
  }
  function removeResult(uid) {
    results = results.filter(function (x) { return x.uid !== uid; });
    if (state.uid === uid) { state.uid = null; if (host.classList.contains('has-res')) hidePanel(); }
    notify();
  }
  function exportResults() { return JSON.parse(JSON.stringify(results)); }
  function importResults(arr) {
    clearTimeout(timer);
    results = [];
    (Array.isArray(arr) ? arr : []).slice(0, MAXR).forEach(function (r) {
      if (!r || !M[r.id] || !r.parts || typeof r.parts !== 'object') return;
      var parts = {}; ['ringkasan', 'tabel', 'langkah', 'grafik'].forEach(function (k) { parts[k] = clean(r.parts[k]); });
      results.push({ uid: newUid(), id: r.id, n: r.n > 0 ? Math.floor(r.n) : 1, title: String(r.title || M[r.id].title), sub: String(r.sub || ''), parts: parts, t: +r.t || Date.now() });
    });
    state.id = null; state.uid = null; state.status = 'idle'; state.parts = null;
    host.classList.remove('has-res'); setSeg('data'); body.innerHTML = '';
    notify();
  }

  window.StatCalcHasil = {
    list: function () {
      return results.map(function (r) { return { uid: r.uid, id: r.id, name: (SHORT[r.id] || r.title) + ' ' + r.n, t: r.t }; });
    },
    current: function () { return host.classList.contains('has-res') ? state.uid : null; },
    show: showResult, hide: hidePanel, remove: removeResult,
    exportAll: exportResults, importAll: importResults,
    onChange: function (fn) { listeners.push(fn); },
    start: function (id) {
      var m = M[id]; if (!m) return;
      clearTimeout(timer);
      var rc = $(m.rc); if (rc) rc.hidden = true;          /* agar hasil baru dapat dikenali */
      var er = $(m.err); if (er) er.hidden = true;
      state.id = id; state.status = 'loading'; state.parts = null; state.uid = null;
      $('#srTitle', panel).textContent = m.title; $('#srSub', panel).textContent = sub(id);
      showPanel(); setSeg('hasil'); setTab('ringkasan');
    },
    fail: function (id, msg) { clearTimeout(timer); state.status = 'error'; state.error = msg; paint(); },
    collect: function (id) {
      var m = M[id], tries = 0;
      clearTimeout(timer);
      (function poll() {
        var rc = $(m.rc), er = $(m.err);
        if (rc && !rc.hidden) {
          var parts = null;
          try { parts = build(id); } catch (e) { parts = null; }
          if (!parts) { state.status = 'error'; state.error = 'Hasil tidak dapat ditampilkan di sini. Buka halaman lengkap.'; } else { state.status = 'ready'; state.parts = parts; record(id, parts); }
          paint(); return;
        }
        if (er && !er.hidden && er.textContent.trim()) { state.status = 'error'; state.error = er.textContent.trim(); paint(); return; }
        if (++tries > 20) { state.status = 'error'; state.error = 'Analisis belum selesai atau gagal. Buka halaman lengkap untuk melihat penyebabnya.'; paint(); return; }
        timer = setTimeout(poll, 150);
      })();
    },
  };
})();
