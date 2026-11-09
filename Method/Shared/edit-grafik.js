/* =========================================================================
   EDIT-GRAFIK.JS - pita edit + tombol unduh untuk SEMUA grafik SVG di halaman Stat
   -------------------------------------------------------------------------
   Sebagian grafik di halaman Stat digambar langsung oleh modul metodenya (Polinomial, PCA, Faktor, Klaster, TAR,
   Dekomposisi, Faktorial 2^k, Kapabilitas, Power, RSM, Box-Cox / ACF / ramalan ARIMA, Smoothing, ...), bukan lewat
   StatExport.publish. Modul ini memantau halaman Stat dan memasang di bawah tiap grafik semacam itu:
     - tombol Unduh PNG / Unduh SVG / Salin gambar;
     - pita "Edit grafik" (Teks, Warna, Garis kisi, Elemen) lewat StatRibbon.mount.

   Cara kerja (tanpa mengubah modul asal): gambar asli disimpan (pristine); tiap perubahan pita menggambar ulang
   salinan SVG itu: warna (rangking warna data), palet, latar, garis kisi, judul, label sumbu, ukuran huruf, tebal garis,
   ukuran titik. Bila modul menggambar ulang grafiknya (mis. memutar grafik 3D), gambar baru otomatis diberi
   pengaturan yang sama. Tidak ada perubahan tampilan sampai pita disentuh.

   Dilewati: grafik yang sudah punya pita (.ex-fig di tab Grafik, diagram jalur SEM #sxDiag), ikon kecil, tabel, tombol.
   Dimuat SETELAH ribbon-metode.js, ikon-tombol.js, graph-core.js dan export-hasil.js.
   API (window.StatNativeEdit): scan() - pindai ulang sekarang; count() - jumlah grafik yang sudah dipasangi.
   ========================================================================= */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var SKIP_IN = '.rb-main, .ex-fig, .ex-rib, #sxDiag, .ne-bar, button, label, .ib, .tabs, table, .stx-bar, .hlp-btn, .sr-body, .sc-res, nav, .gr-view, .rs-rot';
  var ROOTS = '.st-main, [id$="results-card"]';
  var uid = 0, CACHE = {}, STATES = [];

  var css = document.createElement('style');
  css.textContent =
    '.ne-unit{display:block;}' +
    '.ne-bar{margin:14px 0 6px;border:1px solid var(--rule);border-radius:var(--radius,10px);background:var(--accent-soft);overflow:hidden;}' +
    '.ne-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:8px 12px;}' +
    '.ne-head .ib-row{flex:0 0 auto;}' +
    '.ne-head .ib{flex:0 0 auto !important;width:44px !important;min-width:44px;}' +
    '.ne-tog{margin-left:auto;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid var(--rule-strong);border-radius:10px;background:#fff;color:var(--accent);font:700 13.5px var(--font-body,system-ui,sans-serif);cursor:pointer;}' +
    '.ne-tog:hover{background:var(--paper-2);}' +
    '.ne-tog svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}' +
    '.ne-tog[aria-expanded="true"] .ne-car{transform:rotate(180deg);}' +
    '.ne-edit{border-top:1px solid var(--rule);background:#fff;}' +
    '.ne-edit[hidden]{display:none;}' +
    '.ne-edit .rb-main{box-shadow:none;border:0;border-radius:0;margin:0;}' +
    '.ne-msg{margin:0;padding:0 14px 8px;font-size:13px;}' +
    '.ne-msg[hidden]{display:none;}';
  document.head.appendChild(css);

  /* ------------------------------ warna ------------------------------ */
  var cv = document.createElement('canvas').getContext('2d');
  function resolveVars(t) {
    var cs = getComputedStyle(document.documentElement);
    return String(t).replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, function (m, n, fb) {
      var v = cs.getPropertyValue(n).trim();
      return (v || (fb ? fb.trim() : '#000000')).replace(/"/g, "'");
    });
  }
  function hexOf(c) {
    if (c === null || c === undefined) return null;
    c = resolveVars(c).trim().toLowerCase();
    if (!c || c === 'none' || c === 'transparent' || c === 'currentcolor' || c === 'inherit' || c.indexOf('url(') === 0) return null;
    cv.fillStyle = '#fe01fd';
    cv.fillStyle = c;
    var out = cv.fillStyle;
    if (out === '#fe01fd' && c !== '#fe01fd') return null;
    return /^#[0-9a-f]{6}$/.test(out) ? out : null;
  }
  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function sat(h) { var c = rgb(h); return (Math.max.apply(null, c) - Math.min.apply(null, c)) / 255; }
  function lum(h) { var c = rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  var neutral = function (h) { return sat(h) < 0.14; };

  /* ------------------------- baca / tulis properti SVG ------------------------- */
  function getProp(el, prop) {
    var st = el.getAttribute('style');
    if (st) { var m = st.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)')); if (m) return m[1].trim(); }
    var a = el.getAttribute(prop);
    return a === null ? null : a;
  }
  function setProp(el, prop, val) {
    var st = el.getAttribute('style') || '', re = new RegExp('((?:^|;)\\s*)' + prop + '\\s*:\\s*[^;]+');
    if (re.test(st)) el.setAttribute('style', st.replace(re, function (m, p) { return p + prop + ':' + val; }));
    else if (el.hasAttribute(prop)) el.setAttribute(prop, val);
    else el.setAttribute('style', (st ? st.replace(/;?\s*$/, ';') : '') + prop + ':' + val);
  }
  var num = function (s) { var n = parseFloat(s); return Number.isFinite(n) ? n : null; };

  /* ------------------------- pemindaian struktur grafik ------------------------- */
  function vbox(r) {
    var m = (r.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (m.length === 4 && m.every(Number.isFinite)) return { x: m[0], y: m[1], w: m[2], h: m[3] };
    var w = num(r.getAttribute('width')), h = num(r.getAttribute('height'));
    return w && h ? { x: 0, y: 0, w: w, h: h } : null;
  }
  function lineKind(l) {                                      /* garis kisi: garis lurus sejajar sumbu berwarna terang & tipis */
    var x1 = num(l.getAttribute('x1')), x2 = num(l.getAttribute('x2')), y1 = num(l.getAttribute('y1')), y2 = num(l.getAttribute('y2'));
    if ([x1, x2, y1, y2].some(function (v) { return v === null; })) return null;
    var col = hexOf(getProp(l, 'stroke'));
    if (!col || lum(col) < 0.72 || sat(col) > 0.3) return null;
    var sw = num(getProp(l, 'stroke-width'));
    if (sw !== null && sw > 1.6) return null;
    if (getProp(l, 'stroke-dasharray')) return null;
    if (Math.abs(y1 - y2) < 0.01 && Math.abs(x2 - x1) > 20) return 'h';
    if (Math.abs(x1 - x2) < 0.01 && Math.abs(y2 - y1) > 20) return 'v';
    return null;
  }
  function labelNodes(r) {                                    /* label sumbu: teks tegak (Y) dan teks tengah paling bawah (X) */
    var vb = vbox(r) || { w: 600, h: 300 }, out = { x: null, y: null };
    var texts = $$('text', r);
    texts.forEach(function (t) {
      var tr = t.getAttribute('transform') || '';
      if (/rotate\(\s*-90/.test(tr) && !out.y && (getProp(t, 'text-anchor') || '') === 'middle' && t.textContent.trim().length > 1) out.y = t;
    });
    var best = null, by = -1;
    texts.forEach(function (t) {
      if (t.getAttribute('transform')) return;
      if ((getProp(t, 'text-anchor') || '') !== 'middle') return;
      var y = num(t.getAttribute('y')); if (y === null || y < vb.h - 14 || t.textContent.trim().length < 2) return;
      if (y > by) { by = y; best = t; }
    });
    out.x = best;
    return out;
  }
  function scan(r) {
    var cnt = {}, info = { colors: [], many: false, h: 0, v: 0, circles: 0, strokes: 0, lab: labelNodes(r) };
    $$('*', r).forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      if (tag === 'text' || tag === 'defs' || tag === 'clippath' || tag === 'style' || tag === 'title') return;
      if (tag === 'circle') info.circles++;
      var sw = getProp(el, 'stroke-width'); if (sw !== null && tag !== 'rect') info.strokes++;
      if (tag === 'line') { var k = lineKind(el); if (k === 'h') info.h++; else if (k === 'v') info.v++; }
      ['fill', 'stroke'].forEach(function (p) {
        var h = hexOf(getProp(el, p)); if (!h || neutral(h)) return;
        if (tag === 'line' && lineKind(el)) return;
        cnt[h] = (cnt[h] || 0) + 1;
      });
    });
    info.colors = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    info.many = info.colors.length > 10;                       /* peta warna (kontur / gradien): jangan diganti per warna */
    return info;
  }
  function recolor(r, map) {
    $$('*', r).forEach(function (el) {
      ['fill', 'stroke'].forEach(function (p) {
        var raw = getProp(el, p); if (raw === null) return;
        var h = hexOf(raw); if (h && map[h]) setProp(el, p, map[h]);
      });
    });
  }

  /* ------------------------- gaya & pembuatan SVG ------------------------- */
  function defStyle() { return { c1: '#22384a', c2: '#bd7e1f', pal: 'bawaan', bg: '#ffffff', gh: 'on', gv: 'on', gc: '#e6e0cc', title: '', xl: '', yl: '', fs: 100, lw: 100, pt: 100, touched: {} }; }

  function transform(pristine, S, info) {
    var any = Object.keys(S.touched).length;
    var box = document.createElement('div'); box.innerHTML = pristine;
    var r = box.querySelector('svg'); if (!r) return pristine;
    r.setAttribute('data-ne', '1');
    if (!any) return box.innerHTML;
    var T = S.touched, gu = window.GraphCore && window.GraphCore.u;
    /* 1. warna data */
    if (!info.many) {
      var map = {};
      if (T.pal && gu && gu.PALETTES[S.pal]) { var P = gu.PALETTES[S.pal]; info.colors.forEach(function (c, i) { var n = hexOf(P[i % P.length]); if (n) map[c] = n; }); }
      if (T.c1 && info.colors[0]) map[info.colors[0]] = S.c1;
      if (T.c2 && info.colors[1]) map[info.colors[1]] = S.c2;
      if (Object.keys(map).length) recolor(r, map);
    }
    /* 2. garis kisi */
    if (T.gh || T.gv || T.gc) {
      $$('line', r).forEach(function (l) {
        var k = lineKind(l); if (!k) return;
        if ((k === 'h' && T.gh && S.gh === 'off') || (k === 'v' && T.gv && S.gv === 'off')) { l.remove(); return; }
        if (T.gc) setProp(l, 'stroke', S.gc);
      });
    }
    /* 3. label sumbu */
    if (T.xl || T.yl) {
      var lab = labelNodes(r);
      if (T.xl && S.xl && lab.x) lab.x.textContent = S.xl;
      if (T.yl && S.yl && lab.y) lab.y.textContent = S.yl;
    }
    /* 4. ukuran huruf, tebal garis, ukuran titik */
    if (T.fs && S.fs !== 100) $$('*', r).concat([r]).forEach(function (el) {
      var raw = getProp(el, 'font-size'); if (raw === null) return;
      var m = String(raw).match(/^([\d.]+)(px)?$/); if (m) setProp(el, 'font-size', (parseFloat(m[1]) * S.fs / 100).toFixed(2) + (m[2] || ''));
    });
    if (T.lw && S.lw !== 100) $$('*', r).forEach(function (el) {
      if (el.tagName.toLowerCase() === 'text') return;
      var raw = getProp(el, 'stroke-width'), n = raw === null ? null : num(raw);
      if (n !== null) setProp(el, 'stroke-width', (n * S.lw / 100).toFixed(2));
    });
    if (T.pt && S.pt !== 100) $$('circle', r).forEach(function (c) { var n = num(c.getAttribute('r')); if (n !== null) c.setAttribute('r', (n * S.pt / 100).toFixed(2)); });
    /* 5. latar */
    var vb = vbox(r);
    if (T.bg && vb) {
      var first = null;
      $$('rect', r).some(function (rc) { var w = num(rc.getAttribute('width')), h = num(rc.getAttribute('height')); if (w !== null && h !== null && w >= vb.w * 0.98 && h >= vb.h * 0.98) { first = rc; return true; } return false; });
      if (first) setProp(first, 'fill', S.bg);
      else { var bgr = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); bgr.setAttribute('x', vb.x); bgr.setAttribute('y', vb.y); bgr.setAttribute('width', vb.w); bgr.setAttribute('height', vb.h); bgr.setAttribute('fill', S.bg); bgr.setAttribute('data-ne-bg', '1'); r.insertBefore(bgr, r.firstChild); }
    }
    /* 6. judul: tambah ruang di atas */
    if (T.title && S.title && vb && r.getAttribute('viewBox')) {
      var TH = 36, NS = 'http://www.w3.org/2000/svg', g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', 'translate(0,' + TH + ')');
      var kids = Array.prototype.slice.call(r.childNodes).filter(function (n) { return !(n.nodeType === 1 && n.getAttribute('data-ne-bg')); });
      kids.forEach(function (n) { if (!(n.nodeType === 1 && /^(defs|style)$/i.test(n.tagName))) g.appendChild(n); });
      r.appendChild(g);
      r.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + (vb.h + TH));
      var bgEl = r.querySelector('[data-ne-bg]'); if (bgEl) bgEl.setAttribute('height', vb.h + TH);
      var tx = document.createElementNS(NS, 'text');
      tx.setAttribute('x', vb.x + vb.w / 2); tx.setAttribute('y', vb.y + 24); tx.setAttribute('text-anchor', 'middle');
      tx.setAttribute('style', 'font-size:' + (16 * (T.fs ? S.fs / 100 : 1)).toFixed(1) + 'px;font-weight:700;fill:var(--ink,#1B2430)');
      tx.textContent = S.title; r.appendChild(tx);
    }
    return box.innerHTML;
  }
  /* untuk berkas: variabel CSS diganti nilainya, ukuran tegas, tanpa gaya tata letak halaman */
  function standalone(svg) {
    var box = document.createElement('div'); box.innerHTML = resolveVars(svg);
    var r = box.querySelector('svg'); if (!r) return svg;
    r.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    var st = (r.getAttribute('style') || '').replace(/(?:^|;)\s*(width|max-width|height|margin|display)\s*:[^;]*/g, '').replace(/^;/, '');
    if (st.trim()) r.setAttribute('style', st); else r.removeAttribute('style');
    r.removeAttribute('data-ne'); r.removeAttribute('role');
    var vb = vbox(r);
    if (vb) { r.setAttribute('viewBox', '0 0 ' + vb.w + ' ' + vb.h); r.setAttribute('width', vb.w); r.setAttribute('height', vb.h); }
    if (!r.getAttribute('font-family') && !/font-family/.test(st)) r.setAttribute('font-family', 'Inter, Arial, Helvetica, sans-serif');
    var hasBg = false;
    if (vb) $$('rect', r).some(function (rc) { var w = num(rc.getAttribute('width')), h = num(rc.getAttribute('height')); if (w !== null && h !== null && w >= vb.w * 0.98 && h >= vb.h * 0.98 && hexOf(getProp(rc, 'fill'))) { hasBg = true; return true; } return false; });
    if (!hasBg && vb) { var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); bg.setAttribute('width', vb.w); bg.setAttribute('height', vb.h); bg.setAttribute('fill', '#ffffff'); r.insertBefore(bg, r.firstChild); }
    return box.innerHTML;
  }

  /* ------------------------------ unduhan ------------------------------ */
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }
  function toPng(svg) {
    var m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), w = m ? +m[1] : 640, h = m ? +m[2] : 400, sc = 2;
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('png')); };
      img.src = url;
    });
  }
  function slug(s) { return String(s || 'grafik').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'grafik'; }
  function msg(S, text, bad) {
    var p = S.bar.querySelector('.ne-msg'); if (!p) return;
    p.textContent = text; p.hidden = !text; p.className = 'ne-msg ' + (bad ? 'error-msg' : 'imp-ok');
    clearTimeout(S.mt); if (text) S.mt = setTimeout(function () { p.hidden = true; }, 5000);
  }
  function download(S, kind) {
    var cur = S.unit.querySelector('svg'), svg = standalone(cur ? cur.outerHTML : S.pristine), nm = 'StatCalc-' + S.view + '-' + slug(S.name);
    if (kind === 'svg') { saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), nm + '.svg'); return; }
    if (kind === 'copy') {
      if (!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem)) { msg(S, 'Peramban ini tidak mendukung salin gambar. Gunakan Unduh PNG.', true); return; }
      toPng(svg).then(function (b) { return navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); })
        .then(function () { msg(S, 'Gambar disalin ke clipboard.'); }, function () { msg(S, 'Gambar tidak dapat disalin (izin clipboard ditolak). Gunakan Unduh PNG.', true); });
      return;
    }
    toPng(svg).then(function (b) { saveBlob(b, nm + '.png'); }, function () { msg(S, 'Peramban ini tidak dapat membuat PNG. Gunakan Unduh SVG.', true); });
  }

  /* ------------------------------ pita ------------------------------ */
  var CARET = '<svg class="ne-car" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
  var sid = function (S, k) { return 'ne' + S.id + '-' + k; };
  function mountRibbon(S) {
    var gu = window.GraphCore && window.GraphCore.u, I = S.info, st = S.st;
    var T = function (k, label, ph) { return { type: 'text', id: sid(S, k), label: label, placeholder: ph || 'Bawaan grafik', def: st[k] }; };
    var R = function (k, label, min, max, step) { return { type: 'range', id: sid(S, k), label: label, min: min, max: max, step: step, def: st[k], unit: '%' }; };
    var Sel = function (k, label, options) { return { type: 'select', id: sid(S, k), label: label, options: options, selected: String(st[k]) }; };
    var reset = function (act) { return { label: 'Setel ulang', cols: 1, items: [{ type: 'button', act: act, icon: 'reset', label: 'Setel ulang' }] }; };
    var tabs = [];
    tabs.push({ id: 'teks', label: 'Teks', groups: [
      { label: 'Judul & label', cols: 1, items: [T('title', 'Judul grafik'), T('xl', 'Label sumbu X'), T('yl', 'Label sumbu Y')] },
      { label: 'Huruf', cols: 1, items: [R('fs', 'Ukuran huruf', 70, 160, 5)] },
      reset('teks')], tip: 'Kosongkan kolom teks untuk kembali ke bawaan grafik. Label sumbu hanya berubah bila grafik memilikinya.' });
    var warna = [
      { label: 'Warna data', cols: 1, items: [{ type: 'color', id: sid(S, 'c1'), label: 'Warna utama', def: st.c1 }, { type: 'color', id: sid(S, 'c2'), label: 'Warna kedua', def: st.c2 }] },
      { label: 'Palet warna', cols: 1, items: [gu ? Sel('pal', 'Palet (urut menurut pemakaian)', Object.keys(gu.PALETTES).map(function (k) { return [k, gu.PALETTE_LABEL[k]]; })) : { type: 'check', id: sid(S, 'nopal'), label: 'Palet', def: false }] },
      { label: 'Latar', cols: 1, items: [{ type: 'color', id: sid(S, 'bg'), label: 'Warna latar grafik', def: st.bg }] },
      reset('warna')];
    tabs.push({ id: 'warna', label: 'Warna', groups: warna, tip: 'Warna utama dan kedua mengganti dua warna data yang paling banyak dipakai pada grafik. Warna status (merah/hijau) dan peta warna kontur tidak diganti.' });
    tabs.push({ id: 'kisi', label: 'Garis kisi', groups: [
      { label: 'Tampilkan', cols: 1, items: [Sel('gh', 'Garis horizontal', [['on', 'Tampil'], ['off', 'Sembunyi']]), Sel('gv', 'Garis vertikal', [['on', 'Tampil'], ['off', 'Sembunyi']])] },
      { label: 'Gaya', cols: 1, items: [{ type: 'color', id: sid(S, 'gc'), label: 'Warna garis kisi', def: st.gc }] },
      reset('kisi')], tip: 'Hanya garis kisi yang ada pada grafik ini yang dapat diatur.' });
    tabs.push({ id: 'elemen', label: 'Elemen', groups: [
      { label: 'Ukuran', cols: 1, items: [R('lw', 'Tebal garis', 50, 300, 10), R('pt', 'Ukuran titik', 50, 250, 10)] },
      reset('elemen')], tip: 'Pengaturan yang tidak berlaku untuk grafik ini tidak berpengaruh.' });
    window.StatRibbon.mount({
      view: '#' + sid(S, 'edit'), key: 'ne' + S.id, host: $('#' + sid(S, 'edit')), tabs: tabs,
      onChange: function (e) { onRibbon(S, e); },
      onAction: function (act) { resetPart(S, act); },
    });
    applyCaps(S);
  }
  function applyCaps(S) {
    var I = S.info, hide = function (k, yes) { var el = document.getElementById(sid(S, k)); if (!el) return; var box = el.closest('.rb-fld, .rb-color, .rb-chk') || el; box.style.display = yes ? 'none' : ''; };
    ['c1', 'c2', 'pal'].forEach(function (k) { hide(k, I.many || !I.colors.length); });
    if (I.colors.length < 2) hide('c2', true);
    hide('gh', !I.h); hide('gv', !I.v); hide('gc', !I.h && !I.v);
    hide('xl', !I.lab.x); hide('yl', !I.lab.y);
    hide('pt', !I.circles); hide('lw', !I.strokes);
    $$('.rb-grp', $('#' + sid(S, 'edit'))).forEach(function (g) {
      var kids = $$('.rb-gbody > *', g), vis = kids.filter(function (c) { return c.style.display !== 'none'; });
      if (kids.length && !vis.length) g.style.display = 'none';
    });
    $$('.rb-tab', $('#' + sid(S, 'edit'))).forEach(function (t) {
      var p = $('.rb-panel[data-rbpanel="' + t.dataset.rbtab + '"]', $('#' + sid(S, 'edit')));
      var any = p && $$('.rb-grp', p).some(function (g) { return g.style.display !== 'none' && !(g.querySelector('[data-rb-act]') && $$('.rb-gbody > *', g).length === 1); });
      t.style.display = any ? '' : 'none';
    });
    var first = $$('.rb-tab', $('#' + sid(S, 'edit'))).filter(function (t) { return t.style.display !== 'none'; })[0];
    var act = $('.rb-tab[aria-selected="true"]', $('#' + sid(S, 'edit')));
    if (first && (!act || act.style.display === 'none')) first.click();
  }
  var FIELDS = [['c1', 'v'], ['c2', 'v'], ['pal', 'v'], ['bg', 'v'], ['gh', 'v'], ['gv', 'v'], ['gc', 'v'], ['title', 'v'], ['xl', 'v'], ['yl', 'v'], ['fs', 'n'], ['lw', 'n'], ['pt', 'n']];
  function onRibbon(S, e) {
    clearTimeout(S.rt);
    S.rt = setTimeout(function () {
      FIELDS.forEach(function (f) {
        var el = document.getElementById(sid(S, f[0])); if (!el) return;
        var v = f[1] === 'n' ? +el.value : el.value;
        if (f[0] === 'c1' || f[0] === 'c2' || f[0] === 'bg' || f[0] === 'gc') v = String(v).toLowerCase();
        if (v !== S.st[f[0]]) { S.st[f[0]] = v; S.st.touched[f[0]] = true; }
      });
      redraw(S);
    }, 40);
  }
  function resetPart(S, part) {
    var D = defStyle(), keys = { teks: ['title', 'xl', 'yl', 'fs'], warna: ['c1', 'c2', 'pal', 'bg'], kisi: ['gh', 'gv', 'gc'], elemen: ['lw', 'pt'] }[part] || [];
    keys.forEach(function (k) {
      S.st[k] = D[k]; delete S.st.touched[k];
      var el = document.getElementById(sid(S, k)); if (el) { el.value = D[k]; var lab = document.getElementById(el.id + '-v'); if (lab) lab.textContent = el.value + (el.dataset.unit || ''); }
    });
    if (part === 'warna') { /* nilai pemilih warna kembali ke warna asli grafik */
      [['c1', S.info.colors[0]], ['c2', S.info.colors[1]]].forEach(function (p) { if (!p[1]) return; S.st[p[0]] = p[1]; var el = document.getElementById(sid(S, p[0])); if (el) el.value = p[1]; });
    }
    redraw(S);
  }
  function redraw(S) {
    var cur = S.unit.querySelector('svg'); if (!cur) return;
    S.busy = true;
    var html = transform(S.pristine, S.st, S.info), tpl = document.createElement('div'); tpl.innerHTML = html;
    var ns = tpl.querySelector('svg'); if (ns) cur.replaceWith(ns);
    setTimeout(function () { S.busy = false; }, 0);
  }

  /* ------------------------------ pemasangan ------------------------------ */
  function eligible(svg) {
    if (svg.getAttribute('data-ne') || svg.closest(SKIP_IN)) return false;
    var vb = vbox(svg); if (!vb || vb.w < 280 || vb.h < 110) return false;
    return true;
  }
  function viewOf(svg) { var v = svg.closest('.view'); return v ? v.id.replace(/^view-/, '') : 'stat'; }
  function nameOf(svg) {
    var n = svg.getAttribute('aria-label'); if (n) return n;
    var p = svg.closest('.rs-fig, .ne-unit, div'); var cap = p && p.previousElementSibling && p.previousElementSibling.textContent;
    return (cap && cap.trim().slice(0, 50)) || 'grafik';
  }
  function adopt(svg, idxKey) {
    var parent = svg.parentElement, unit, S;
    if (parent && parent.__ne) {                              /* modul menggambar ulang di wadah yang sama (mis. putar 3D) */
      S = parent.__ne; unit = parent;
    } else {
      if (parent && parent.children.length === 1 && !parent.classList.contains('tab-panel') && !parent.matches('.st-main, .card, section')) unit = parent;
      else { unit = document.createElement('div'); unit.className = 'ne-unit'; svg.replaceWith(unit); unit.appendChild(svg); }
      S = { id: ++uid, unit: unit, view: viewOf(svg), name: nameOf(svg), st: null, info: null, pristine: '', bar: null, busy: false };
      unit.__ne = S; STATES.push(S);
    }
    var key = S.view + '|' + (svg.getAttribute('aria-label') || '') + '|' + idxKey;
    S.key = key;
    S.pristine = svg.outerHTML;
    S.info = scan(svg);
    S.name = nameOf(svg);
    var first = !S.bar;
    if (first) {
      S.st = CACHE[key] || defStyle();
      if (!CACHE[key]) { if (S.info.colors[0]) S.st.c1 = S.info.colors[0]; if (S.info.colors[1]) S.st.c2 = S.info.colors[1]; }
      CACHE[key] = S.st;
      var bar = document.createElement('div'); bar.className = 'ne-bar'; bar.id = 'ne-bar-' + S.id;
      bar.innerHTML =
        '<div class="ne-head"><span class="ib-row">' + window.StatIconBtn('png', 'Unduh PNG', 'data-ne="png"') + window.StatIconBtn('svg', 'Unduh SVG', 'data-ne="svg"') + window.StatIconBtn('copy', 'Salin gambar', 'data-ne="copy"') + '</span>' +
        '<button type="button" class="ne-tog" data-ne="tog" aria-expanded="false" aria-controls="' + sid(S, 'edit') + '">' + PEN + 'Edit grafik' + CARET + '</button></div>' +
        '<p class="ne-msg" hidden></p><div class="ne-edit" id="' + sid(S, 'edit') + '" hidden></div>';
      unit.insertAdjacentElement('beforebegin', bar);
      S.bar = bar;
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ne]'); if (!b) return;
        var k = b.dataset.ne;
        if (k === 'tog') {
          var ed = $('#' + sid(S, 'edit'), bar), open = ed.hidden;
          if (open && !ed.__mounted) { ed.__mounted = true; ed.hidden = false; mountRibbon(S); }
          ed.hidden = !open; b.setAttribute('aria-expanded', String(open));
        } else download(S, k);
      });
    }
    svg.setAttribute('data-ne', '1');
    if (Object.keys(S.st.touched).length) redraw(S);          /* gambar baru dari modul: pakai lagi pengaturan yang sudah dipilih */
    S.svg = unit.querySelector('svg');
  }
  var pending = false;
  function run() {
    pending = false;
    var seen = new Set(), idx = {};
    $$(ROOTS).forEach(function (root) {
      $$('svg', root).forEach(function (svg) {
        if (seen.has(svg)) return; seen.add(svg);
        if (!eligible(svg)) return;
        var panel = svg.closest('.tab-panel'), pk = (panel && panel.id) || '', a = viewOf(svg) + '|' + pk;
        idx[a] = (idx[a] || 0) + 1;
        try { adopt(svg, pk + '#' + idx[a]); } catch (e) { console.warn('Edit grafik:', e); }
      });
    });
    STATES = STATES.filter(function (S) { return document.contains(S.unit); });
  }
  function schedule() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(run); }
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i]; if (m.type !== 'childList' || !m.addedNodes.length) continue;
      if (m.target.closest && m.target.closest('.ne-bar, .rb-main')) continue;
      for (var j = 0; j < m.addedNodes.length; j++) { var n = m.addedNodes[j]; if (n.nodeType === 1 && (n.tagName === 'svg' || n.tagName === 'SVG' || n.querySelector('svg'))) { schedule(); return; } }
    }
  }).observe(document.body, { childList: true, subtree: true });
  window.StatNativeEdit = { scan: run, count: function () { return STATES.length; } };
  schedule();
})();
