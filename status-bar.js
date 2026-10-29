/* Bilah status desktop: n dan kolom dari lembar kerja, alpha tetap 0,05 */
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
  function upd() {
    var b, n = 0, c = 0;
    try { b = sh.usedBounds(); c = b.C; n = Math.max(0, b.R - (sh.state.header ? 1 : 0)); } catch (e) { /* lembar belum siap */ }
    data.textContent = n > 0 ? 'n = ' + n + ' \u00B7 ' + c + ' kolom' : 'Lembar kosong';
  }
  upd();
  if (sh && sh.onChange) sh.onChange(upd);
  if (sh && sh.onStructure) sh.onStructure(upd);
})();
