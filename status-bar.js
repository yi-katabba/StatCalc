/* Bilah status desktop: n, variabel numerik/kategorik, data hilang, dan alpha aktif */
(function () {
  'use strict';
  var bar = document.getElementById('statusBar'); if (!bar) return;
  var sh = window.StatCalcSheet;
  var data = document.createElement('span'), alpha = document.createElement('span');
  data.id = 'sbData'; alpha.id = 'sbAlpha';
  function ua() { alpha.textContent = '\u03B1 = ' + String(window.statAlpha ? window.statAlpha() : 0.05).replace('.', ','); }
  ua();
  if (window.StatCalcPrefs) window.StatCalcPrefs.onAlpha(ua);
  alpha.title = 'Taraf signifikansi (ubah di Profil)';
  var sp = bar.querySelector('.sb-sp');
  bar.insertBefore(data, sp); bar.insertBefore(alpha, sp);
  /* n, variabel numerik/kategorik, dan data hilang (sel kosong di dalam area data) */
  function stats() {
    var b = sh.usedBounds(), first = sh.state.header ? 1 : 0, n = Math.max(0, b.R - first), num = 0, cat = 0, miss = 0, c, r, v, tot, k;
    for (c = 0; c < b.C; c++) {
      tot = 0; k = 0;
      for (r = first; r < b.R; r++) {
        v = sh.cellVal(r, c);
        if (v === '' || v == null) { miss++; continue; }
        tot++; if (typeof v === 'number' || !Number.isNaN(sh.parseNum(sh.display(v)))) k++;
      }
      if (tot > 0) { if (k / tot > 0.8) num++; else cat++; }
    }
    return { n: n, num: num, cat: cat, miss: miss };
  }
  var tm = null;
  function upd() {
    var t;
    try { t = stats(); } catch (e) { t = null; }
    data.textContent = t && t.n > 0
      ? 'n = ' + t.n + ' \u00B7 ' + t.num + ' variabel numerik' + (t.cat ? ' \u00B7 ' + t.cat + ' kategorik' : '') + ' \u00B7 ' + t.miss + ' data hilang'
      : 'Dataset kosong';
  }
  function updSoon() { clearTimeout(tm); tm = setTimeout(upd, 150); }
  upd();
  if (sh && sh.onChange) sh.onChange(updSoon);
  if (sh && sh.onStructure) sh.onStructure(updSoon);
})();
