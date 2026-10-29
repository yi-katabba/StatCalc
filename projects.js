/* Proyek: simpan otomatis isi Lembar ke perangkat, daftar "Proyek terakhir" di Beranda,
   proyek baru / impor, nama proyek di bilah status, jumlah proyek di Profil.
   Penyimpanan: statcalc.proj.index (daftar), statcalc.proj.d.<id> (isi Lembar), statcalc.proj.x.<id> (hasil + grafik),
   statcalc.proj.cur (aktif). Berkas proyek .scp (JSON) memuat Lembar, hasil, dan grafik sekaligus.
   Ikut dalam ekspor cadangan dan "Hapus semua data" karena berawalan "statcalc". */
(function () {
  'use strict';
  var sh = window.StatCalcSheet, SC = window.StatCalc;
  if (!sh || !sh.api || !sh.api.exportState || !SC) return;
  var K_IDX = 'statcalc.proj.index', K_D = 'statcalc.proj.d.', K_X = 'statcalc.proj.x.', K_CUR = 'statcalc.proj.cur';
  /* Bagian ekstra proyek (hasil, grafik) didaftarkan modul lain: { get(): data, set(data) } */
  var extras = {}, warnedX = false, refreshHooks = [];
  function readExtras(id) { try { var o = JSON.parse(rd(K_X + id) || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function collectExtras() { var o = {}; Object.keys(extras).forEach(function (k) { try { o[k] = extras[k].get(); } catch (e) { /* abaikan */ } }); return o; }
  function applyExtras(o) { o = o || {}; Object.keys(extras).forEach(function (k) { try { extras[k].set(o[k]); } catch (e) { /* abaikan */ } }); }
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = { regresi: 'Regresi Linear', smoothing: 'Smoothing', anova: 'ANOVA', rsm: 'RSM', stasioner: 'Stasioneritas', arima: 'ARIMA', deskriptif: 'Deskriptif',
    scatter: 'Pencar', histogram: 'Histogram', boxplot: 'Boxplot', probplot: 'Prob. plot', barchart: 'Batang', piechart: 'Pie', timeseries: 'Deret waktu' };

  function rd(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rm(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  function toast(m) { if (SC.showToast) SC.showToast(m); }
  function index() { try { var a = JSON.parse(rd(K_IDX) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveIndex(a) { return wr(K_IDX, JSON.stringify(a)); }
  function cur() { return rd(K_CUR); }
  function find(id) { return index().filter(function (p) { return p.id === id; })[0]; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function uniqueName(base) {
    var names = index().map(function (p) { return p.name; }), n = base, i = 2;
    while (names.indexOf(n) !== -1) n = base + ' ' + (i++);
    return n;
  }
  function dims() {
    try { var b = sh.usedBounds(); return { rows: Math.max(0, b.R - (sh.state.header ? 1 : 0)), cols: b.C }; } catch (e) { return { rows: 0, cols: 0 }; }
  }

  /* ---------------- simpan ---------------- */
  var loading = false, timer = null, warned = false;
  function save() {
    timer = null; if (loading) return;
    var id = cur(), d = dims(), nm = ($('scFname') && $('scFname').value.trim()) || 'data-calc';
    if (!id) { if (d.rows === 0) return; id = newId(); wr(K_CUR, id); }
    var snap = sh.api.exportState(), xs = JSON.stringify(collectExtras()), idx = index(), p = idx.filter(function (x) { return x.id === id; })[0];
    if (p && rd(K_D + id) === snap && rd(K_X + id) === xs && p.name === nm) return;
    if (!wr(K_D + id, snap)) { if (!warned) { warned = true; toast('Penyimpanan perangkat penuh atau tidak tersedia: proyek tidak tersimpan.'); } return; }
    if (!wr(K_X + id, xs) && !warnedX) { warnedX = true; toast('Hasil dan grafik terlalu besar untuk disimpan otomatis. Gunakan Simpan .scp untuk menyimpan ke berkas.'); }
    var now = Date.now();
    if (!p) { p = { id: id, opened: now }; idx.push(p); }
    p.name = nm; p.rows = d.rows; p.cols = d.cols; p.updated = now;
    saveIndex(idx); refresh();
  }
  function queue() { if (loading) return; clearTimeout(timer); timer = setTimeout(save, 900); }
  if (sh.onChange) sh.onChange(queue);
  if (sh.onStructure) sh.onStructure(queue);
  if ($('scFname')) $('scFname').addEventListener('input', queue);
  window.addEventListener('pagehide', function () { if (timer) { clearTimeout(timer); save(); } });

  /* metode terakhir yang dipakai pada proyek aktif */
  var origTrack = SC.trackCalc;
  SC.trackCalc = function () {
    var r = origTrack ? origTrack.apply(this, arguments) : undefined;
    try {
      var v = document.querySelector('.view.active'), key = v && v.id.replace(/^view-/, ''), id = cur();
      if (id && key && NAMES[key]) { var idx = index(), p = idx.filter(function (x) { return x.id === id; })[0]; if (p) { p.method = NAMES[key]; saveIndex(idx); refresh(); } }
    } catch (e) { /* abaikan */ }
    return r;
  };

  /* ---------------- buka / baru / hapus ---------------- */
  function open(id) {
    var p = find(id), snap = rd(K_D + id);
    if (!p || !snap) { toast('Isi proyek tidak ditemukan.'); return false; }
    save();                                  /* simpan proyek yang sedang terbuka lebih dulu */
    loading = true;
    try { sh.api.importState(snap, p.name); } catch (e) { loading = false; toast('Proyek tidak dapat dibuka.'); return false; }
    applyExtras(readExtras(id));
    wr(K_CUR, id);
    var idx = index(); idx.forEach(function (x) { if (x.id === id) x.opened = Date.now(); }); saveIndex(idx);
    setTimeout(function () { loading = false; queue(); refresh(); }, 400);
    return true;
  }
  function create(name) {
    save();
    var id = newId(), snap = sh.api.blankState(), nm = uniqueName(name || 'Proyek baru'), now = Date.now(), idx = index();
    if (!wr(K_D + id, snap)) { toast('Penyimpanan perangkat penuh atau tidak tersedia.'); return null; }
    idx.push({ id: id, name: nm, rows: 0, cols: 0, opened: now, updated: now }); saveIndex(idx);
    wr(K_CUR, id); loading = true;
    sh.api.importState(snap, nm); applyExtras({});
    setTimeout(function () { loading = false; queue(); refresh(); }, 400);
    return id;
  }
  function remove(id) {
    var p = find(id); if (!p) return;
    if (!window.confirm('Hapus proyek "' + p.name + '"? Tindakan ini tidak bisa dibatalkan.')) return;
    rm(K_D + id); rm(K_X + id); saveIndex(index().filter(function (x) { return x.id !== id; }));
    if (cur() === id) rm(K_CUR);
    refresh(); toast('Proyek dihapus.');
  }

  /* ---------------- tampilan Beranda ---------------- */
  var home = $('view-home'), list, countEl;
  function when(ts) {
    if (!ts) return '';
    var d = new Date(ts), n = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    var t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(), dd = Math.floor((t0 - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
    if (dd === 0) return 'Hari ini, ' + p(d.getHours()) + '.' + p(d.getMinutes());
    if (dd === 1) return 'Kemarin';
    return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()] + ' ' + d.getFullYear();
  }
  function build() {
    if (!home || $('pjSection')) return;
    var sec = document.createElement('section'); sec.id = 'pjSection'; sec.className = 'pj-section hm-sec';
    sec.innerHTML =
      '<div class=\"hm-lab\"><h2>Proyek terakhir</h2><span class=\"count\" id=\"pjCount\"></span></div>' +
      '<div class="pj-actions"><button type="button" class="btn-primary" id="pjNew">Proyek baru</button><button type="button" class="btn-ghost" id="pjImport">Impor CSV / XLSX</button><button type=\"button\" class=\"btn-ghost\" id=\"pjScp\">Buka .scp</button></div>' +
      '<div class="pj-list" id="pjList" role="list"></div>';
    var slot = $('pjSlot'), first = home.querySelector('.toc-section'), anchor = first || $('hubGrid');
    if (slot) slot.appendChild(sec); else if (anchor) anchor.parentNode.insertBefore(sec, anchor); else home.appendChild(sec);
    list = $('pjList'); countEl = $('pjCount');
    $('pjNew').addEventListener('click', function () { if (create()) SC.navigate('metode-calc', { backTo: 'home' }); });
    $('pjImport').addEventListener('click', function () {
      if (!create('Proyek impor')) return;
      SC.navigate('metode-calc', { backTo: 'home' });
      var f = $('scFile'); if (f) { f.value = ''; f.click(); }
    });
    $('pjScp').addEventListener('click', function () { pickScp(function () { SC.navigate('metode-calc', { backTo: 'home' }); }); });
    list.addEventListener('click', function (e) {
      var del = e.target.closest('.pj-del'), row = e.target.closest('.pj-row'); if (!row) return;
      if (del) { e.stopPropagation(); remove(row.dataset.id); return; }
      if (open(row.dataset.id)) SC.navigate('metode-calc', { backTo: 'home' });
    });
  }
  /* nama proyek di tengah bilah atas; ikut berubah saat nama file diketik */
  function showName(nm) {
    var el = $('navProj'); if (!el) return;
    nm = (nm || '').trim(); el.textContent = nm; el.title = nm; el.hidden = !nm;
  }
  if ($('scFname')) $('scFname').addEventListener('input', function () { if (cur()) showName($('scFname').value); });
  function refresh() {
    var idx = index().sort(function (a, b) { return (b.opened || 0) - (a.opened || 0); });
    if (list) {
      var shown = idx.slice(0, 6);
      list.innerHTML = shown.length
        ? '<div class="pj-head" aria-hidden="true"><span>Nama</span><span>Baris</span><span>Analisis terakhir</span><span>Dibuka</span><span></span></div>' + shown.map(function (p) {
          return '<div class="pj-row' + (p.id === cur() ? ' on' : '') + '" role="listitem" tabindex="0" data-id="' + esc(p.id) + '">' +
            '<span class="pj-name">' + esc(p.name) + '</span><span class="pj-n">' + (p.rows || 0) + '<i> baris</i></span>' +
            '<span class="pj-m">' + esc(p.method || '-') + '</span><span class="pj-t">' + esc(when(p.opened)) + '</span>' +
            '<button type="button" class="pj-del" aria-label="Hapus proyek ' + esc(p.name) + '" title="Hapus">&times;</button></div>';
        }).join('')
        : '<p class="pj-empty">Belum ada proyek. Buat proyek baru atau impor data Excel/CSV; isi Lembar tersimpan otomatis di perangkat ini.</p>';
    }
    if (countEl) countEl.textContent = idx.length ? idx.length + ' proyek' : '';
    var pr = $('profileStatProj'); if (pr) pr.textContent = idx.length;
    var sb = $('sbProj'), p = find(cur());
    if (sb) sb.textContent = p ? p.name + ' \u00B7 tersimpan' : '';
    showName(p ? p.name : '');
    refreshHooks.forEach(function (f) { try { f(); } catch (e) { /* abaikan */ } });
  }
  if (list === undefined && home) {
    build();
    /* kartu "Proyek" di Profil */
    var row = document.querySelector('.profile-stat-row');
    if (row && !$('profileStatProj')) { var c = document.createElement('div'); c.className = 'profile-stat'; c.innerHTML = '<div class="p-k">Proyek</div><div class="p-v" id="profileStatProj">0</div>'; row.appendChild(c); }
    /* nama proyek di bilah status */
    var bar = $('statusBar'), sp = bar && bar.querySelector('.sb-sp');
    if (bar && sp && !$('sbProj')) { var s = document.createElement('span'); s.id = 'sbProj'; bar.insertBefore(s, sp); }
    new MutationObserver(function () { if (home.classList.contains('active')) refresh(); }).observe(home, { attributes: true, attributeFilter: ['class'] });
  }
  list = $('pjList'); countEl = $('pjCount');
  /* pulihkan proyek aktif ke Lembar saat aplikasi dibuka */
  var id0 = cur();
  if (id0 && find(id0)) { var snap0 = rd(K_D + id0); if (snap0) { loading = true; try { sh.api.importState(snap0, find(id0).name); applyExtras(readExtras(id0)); } catch (e) { /* abaikan */ } setTimeout(function () { loading = false; queue(); refresh(); }, 600); } }
  refresh();
  /* ---------------- berkas proyek .scp ---------------- */
  function safeName(n) { return (String(n || 'proyek').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'proyek'); }
  function exportScp() {
    save();
    var nm = ($('scFname') && $('scFname').value.trim()) || 'data-calc', sheet;
    try { sheet = JSON.parse(sh.api.exportState()); } catch (e) { toast('Proyek tidak dapat disimpan ke berkas.'); return false; }
    var obj = { app: 'StatCalc', format: 'scp', version: 1, name: nm, saved: new Date().toISOString(), sheet: sheet, extras: collectExtras() };
    var blob = new Blob([JSON.stringify(obj)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = safeName(nm) + '.scp'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Proyek disimpan sebagai ' + a.download + '.');
    return true;
  }
  function cleanSheet(sd) {
    var A = sh.api, R = sd && +sd.R, C = sd && +sd.C;
    if (!sd || !(R >= 1 && R <= A.MAX_R) || !(C >= 1 && C <= A.MAX_C) || !Array.isArray(sd.cells)) return null;
    var cells = [], r, c;
    for (r = 0; r < R; r++) {
      var src = Array.isArray(sd.cells[r]) ? sd.cells[r] : [], row = [];
      for (c = 0; c < C; c++) { var v = src[c]; row.push(typeof v === 'string' ? v.slice(0, 20000) : (typeof v === 'number' && isFinite(v) ? v : '')); }
      cells.push(row);
    }
    var out = { R: R, C: C, header: sd.header !== false, cells: cells };
    if (sd.x !== undefined) out.x = sd.x;
    return out;
  }
  function importScp(text) {
    var o; try { o = JSON.parse(text); } catch (e) { toast('Berkas .scp tidak dapat dibaca (bukan format proyek StatCalc).'); return null; }
    if (!o || o.app !== 'StatCalc' || o.format !== 'scp' || !o.sheet) { toast('Berkas ini bukan proyek StatCalc.'); return null; }
    if (+o.version > 1) { toast('Berkas .scp dibuat oleh versi StatCalc yang lebih baru.'); return null; }
    var sd = cleanSheet(o.sheet); if (!sd) { toast('Isi Lembar pada berkas .scp tidak valid.'); return null; }
    save();
    var id = newId(), snap = JSON.stringify(sd), nm = uniqueName(String(o.name || 'Proyek impor').slice(0, 80)), now = Date.now(), idx = index(),
      xs = JSON.stringify(o.extras && typeof o.extras === 'object' ? o.extras : {});
    if (!wr(K_D + id, snap)) { toast('Penyimpanan perangkat penuh atau tidak tersedia.'); return null; }
    wr(K_X + id, xs);
    idx.push({ id: id, name: nm, rows: 0, cols: 0, opened: now, updated: now }); saveIndex(idx);
    wr(K_CUR, id); loading = true;
    try { sh.api.importState(snap, nm); applyExtras(readExtras(id)); } catch (e) { /* abaikan */ }
    var d = dims(), idx2 = index(); idx2.forEach(function (x) { if (x.id === id) { x.rows = d.rows; x.cols = d.cols; } }); saveIndex(idx2);
    setTimeout(function () { loading = false; queue(); refresh(); }, 400);
    toast('Proyek \u201C' + nm + '\u201D dibuka.');
    return id;
  }
  var scpIn = null, scpDone = null;
  function pickScp(done) {
    scpDone = done || null;
    if (!scpIn) {
      scpIn = document.createElement('input'); scpIn.type = 'file'; scpIn.accept = '.scp,application/json'; scpIn.hidden = true;
      scpIn.addEventListener('change', function () {
        var f = scpIn.files && scpIn.files[0]; scpIn.value = ''; if (!f) return;
        if (f.size > 15 * 1024 * 1024) { toast('Berkas .scp terlalu besar (maksimum 15 MB).'); return; }
        var rdr = new FileReader();
        rdr.onload = function () { var id = importScp(String(rdr.result || '')); if (id && scpDone) scpDone(id); };
        rdr.onerror = function () { toast('Berkas tidak dapat dibaca.'); };
        rdr.readAsText(f);
      });
      document.body.appendChild(scpIn);
    }
    scpIn.click();
  }

  window.StatCalcProjects = {
    list: index, open: open, create: create, remove: remove, current: cur,
    exportScp: exportScp, importScp: importScp, pickScp: pickScp,
    /* modul lain mendaftarkan bagian yang ikut tersimpan; touch() = minta simpan otomatis */
    registerExtra: function (name, api) {
      extras[name] = api;
      var id = cur(); if (id && find(id)) { try { api.set(readExtras(id)[name]); } catch (e) { /* abaikan */ } }
    },
    touch: queue, onRefresh: function (fn) { refreshHooks.push(fn); },
  };

})();
