/* Panel Variabel (desktop) di samping lembar kerja: daftar kolom, jenis (123 / Abc), dan peran X / Y */
(function () {
  'use strict';
  var view = document.getElementById('view-metode-calc'), sh = window.StatCalcSheet;
  if (!view || !sh) return;
  var host = view.querySelector('.chapter-inner') || view;
  var aside = document.createElement('aside');
  aside.className = 'sc-vars';
  aside.setAttribute('aria-label', 'Variabel');
  host.appendChild(aside);
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function render() {
    var b, h, first, html = '', num = 0;
    try { b = sh.usedBounds(); h = !!sh.state.header; first = h ? 1 : 0; } catch (e) { return; }
    html += '<div class="sv-k">Variabel</div>';
    if (!b || !b.C || b.R <= first) { aside.innerHTML = html + '<div class="sv-empty">Belum ada data.</div>'; return; }
    for (var c = 0; c < b.C; c++) {
      var n = 0, tot = 0, r, v;
      for (r = first; r < b.R; r++) { v = sh.cellVal(r, c); if (v === '' || v == null) continue; tot++; if (typeof v === 'number' || !Number.isNaN(sh.parseNum(sh.display(v)))) n++; }
      var isNum = tot > 0 && n / tot > 0.8;
      var name = h ? sh.display(sh.cellVal(0, c)) : '';
      name = name || ('Kolom ' + (sh.colName ? sh.colName(c) : c + 1));
      var role = isNum ? (num === 0 ? 'X' : num === 1 ? 'Y' : '') : '';
      if (isNum) num++;
      html += '<div class="sv-row"><span class="sv-t' + (isNum ? ' mono' : '') + '">' + (isNum ? '123' : 'Abc') + '</span><span class="sv-n">' + esc(name) + '</span>' + (role ? '<span class="sv-r">' + role + '</span>' : '') + '</div>';
    }
    aside.innerHTML = html;
  }
  render();
  if (sh.onChange) sh.onChange(render);
  if (sh.onStructure) sh.onStructure(render);
})();
