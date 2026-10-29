/* Format angka global (Profil): jumlah desimal dan pemisah desimal pada tabel & hasil.
   Hanya mengubah TAMPILAN teks di area hasil metode Stat/Graph; perhitungan tidak berubah.
   Dimuat setelah prefs.js. API: StatCalcFormat.get()/set({dec, sep})/onChange(fn). */
(function () {
  'use strict';
  var K_DEC = 'statcalc.dec', K_SEP = 'statcalc.sep';
  var st = { dec: null, sep: ',' }, subs = [];
  try {
    var d = localStorage.getItem(K_DEC); if (d !== null && d !== '') { d = parseInt(d, 10); if (d >= 1 && d <= 8) st.dec = d; }
    var s = localStorage.getItem(K_SEP); if (s === '.' || s === ',') st.sep = s;
  } catch (e) { /* penyimpanan tidak tersedia */ }

  /* area yang dirapikan: hasil metode, bukan kalkulator / lembar / materi / rumus KaTeX */
  var SCOPE = '.equation-wrap,.table-scroll,.steps-wrap,.stat-card,.chart-wrap,.test-note,.rs-plot-wrap';
  var SKIP = '.katex,.calc-card,.calc-hist-card,.sc-main,.sc-quick,.sc-vars,.chapter-head,#view-materi-detail,#view-materi,#view-matriks,#view-kalkulator';
  var TOKEN = /(\d+)\.(\d+)(e[+-]?\d+)?/gi;
  var orig = new WeakMap(); /* simpul teks -> {o: teks asli, r: teks hasil kami} */
  var busy = false, timer = null;

  function conv(text) {
    return text.replace(TOKEN, function (m, ip, fp, ex, off, str) {
      var prev = off > 0 ? str.charAt(off - 1) : '';
      if (/[\w.]/.test(prev)) return m;                         /* bagian dari kode/versi/angka lain */
      var out = m;
      if (!ex && st.dec !== null && fp.length > st.dec) {
        var v = parseFloat(m), r = v.toFixed(st.dec);
        out = (parseFloat(r) === 0 && v !== 0) ? m : r;         /* jangan ubah nilai kecil jadi 0 */
      }
      return st.sep === ',' ? out.replace('.', ',') : out;
    });
  }

  function apply(root) {
    if (st.dec === null && st.sep === '.' && !hasTouched()) return;
    busy = true;
    try {
      var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode; if (!p || p.nodeType !== 1) return NodeFilter.FILTER_REJECT;
          var t = p.nodeName; if (t === 'SCRIPT' || t === 'STYLE' || t === 'TEXTAREA' || t === 'OPTION' || t === 'TITLE') return NodeFilter.FILTER_REJECT;
          if (!orig.has(n) && !/\d\.\d/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          if (p.closest(SKIP) || !p.closest(SCOPE)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      var nodes = [], n; while ((n = w.nextNode())) nodes.push(n);
      nodes.forEach(function (t) {
        var rec = orig.get(t), o;
        /* bila aplikasi menulis ulang simpul ini, nilai barunya menjadi "asli" */
        o = (rec && t.nodeValue === rec.r) ? rec.o : t.nodeValue;
        var r = conv(o);
        if (r !== o) orig.set(t, { o: o, r: r }); else if (rec) orig.delete(t);
        if (r !== t.nodeValue) t.nodeValue = r;
      });
    } finally { busy = false; }
  }
  var touched = false; function hasTouched() { return touched; }

  function schedule() { if (timer) return; timer = setTimeout(function () { timer = null; apply(); }, 120); }
  new MutationObserver(function () { if (!busy) schedule(); })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.StatCalcFormat = {
    get: function () { return { dec: st.dec, sep: st.sep }; },
    set: function (o) {
      if (o.dec !== undefined) { st.dec = (o.dec === null || o.dec === '') ? null : Math.max(1, Math.min(8, parseInt(o.dec, 10) || 3)); try { localStorage.setItem(K_DEC, st.dec === null ? '' : String(st.dec)); } catch (e) { /* abaikan */ } }
      if (o.sep === '.' || o.sep === ',') { st.sep = o.sep; try { localStorage.setItem(K_SEP, st.sep); } catch (e) { /* abaikan */ } }
      touched = true; apply();
      subs.forEach(function (f) { try { f(window.StatCalcFormat.get()); } catch (e) { /* abaikan */ } });
    },
    onChange: function (f) { subs.push(f); },
    format: conv,
    refresh: function () { touched = true; apply(); },
  };
  touched = (st.sep === ','); /* bawaan koma: terapkan sejak awal */
  schedule();
})();
