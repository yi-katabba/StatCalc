/* Panel Variabel (desktop): jenis kolom (123 / Abc) dan peran X / Y yang bisa dipilih.
   Peran memengaruhi urutan kolom saat data dikirim ke Regresi, RSM, dan Scatter. */
(function () {
  'use strict';
  var view = document.getElementById('view-metode-calc'), sh = window.StatCalcSheet;
  if (!view || !sh) return;
  var host = view.querySelector('.chapter-inner') || view;
  var aside = document.createElement('aside');
  aside.className = 'sc-vars';
  aside.setAttribute('aria-label', 'Proyek dan variabel');
  /* aside = Panel Proyek (diisi project-panel.js) + daftar Variabel */
  var projBox = document.createElement('div'); projBox.id = 'svProj'; projBox.className = 'sv-proj'; aside.appendChild(projBox);
  var bodyEl = document.createElement('div'); bodyEl.id = 'svVars'; aside.appendChild(bodyEl);
  host.appendChild(aside);
  var roles = {}, manual = false, cols = [];
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function scan() {
    var b, first, out = [];
    try { b = sh.usedBounds(); first = sh.state.header ? 1 : 0; } catch (e) { return out; }
    if (!b || !b.C || b.R <= first) return out;
    for (var c = 0; c < b.C; c++) {
      var n = 0, tot = 0, r, v;
      for (r = first; r < b.R; r++) { v = sh.cellVal(r, c); if (v === '' || v == null) continue; tot++; if (typeof v === 'number' || !Number.isNaN(sh.parseNum(sh.display(v)))) n++; }
      var name = first ? sh.display(sh.cellVal(0, c)) : '';
      out.push({ c: c, num: tot > 0 && n / tot > 0.8, name: name || ('Kolom ' + (sh.colName ? sh.colName(c) : c + 1)) });
    }
    return out;
  }
  function effective(list) {
    var eff = {}, k = 0;
    list.forEach(function (it) {
      if (!it.num) return;
      if (manual) eff[it.c] = roles[it.c] || '';
      else eff[it.c] = k === 0 ? 'X' : k === 1 ? 'Y' : '';
      k++;
    });
    return eff;
  }
  function render() {
    var list = scan(), eff = effective(list), html = '<div class="sv-k">Variabel</div>';
    cols = list;
    if (!list.length) { bodyEl.innerHTML = html + '<div class="sv-empty">Belum ada data.</div>'; return; }
    list.forEach(function (it) {
      var role = eff[it.c] || '';
      html += '<div class="sv-row"><span class="sv-t' + (it.num ? ' mono' : '') + '">' + (it.num ? '123' : 'Abc') + '</span><span class="sv-n">' + esc(it.name) + '</span>' +
        (it.num ? '<button type="button" class="sv-r' + (role ? ' on' : '') + (manual ? '' : ' auto') + '" data-c="' + it.c + '" title="Ketuk untuk mengganti peran: X, Y, atau tanpa peran">' + (role || '\u2014') + '</button>' : '') + '</div>';
    });
    html += '<div class="sv-hint">Peran menentukan kolom yang dikirim ke Regresi, RSM, dan Scatter.' +
      (manual ? ' <button type="button" class="sv-reset">Atur ulang</button>' : '') + '</div>';
    bodyEl.innerHTML = html;
  }
  aside.addEventListener('click', function (e) {
    var b = e.target.closest('.sv-r'), rs = e.target.closest('.sv-reset');
    if (rs) { manual = false; roles = {}; renderAll(); return; }
    if (!b) return;
    var c = +b.dataset.c, eff = effective(cols);
    if (!manual) { roles = eff; manual = true; }
    var cur = roles[c] || '', nxt = cur === '' ? 'X' : cur === 'X' ? 'Y' : '';
    if (nxt === 'Y') Object.keys(roles).forEach(function (k) { if (roles[k] === 'Y') roles[k] = ''; });
    roles[c] = nxt;
    renderAll();
  });
  /* dipakai sheet.js saat "Buka & analisis": kembalikan {rows, C} bertata ulang, atau null bila tidak berlaku */
  window.StatCalcSheetRoles = function (id, rows) {
    if (!manual || ['regresi', 'rsm', 'scatter'].indexOf(id) === -1) return null;
    var list = scan(), xs = [], y = null;
    list.forEach(function (it) { if (!it.num) return; if (roles[it.c] === 'X') xs.push(it.c); else if (roles[it.c] === 'Y') y = it.c; });
    if (y === null || !xs.length) return null;
    if (id === 'scatter') xs = xs.slice(0, 1);
    var order = id === 'scatter' ? xs.concat([y]) : [y].concat(xs);
    return { rows: rows.map(function (r) { return order.map(function (c) { return r[c] == null ? '' : r[c]; }); }), C: order.length };
  };
  /* ringkasan peran untuk layar Stat di ponsel (analisis-vars.js): Y, X, faktor (kolom kategorik pertama), n */
  var listeners = [];
  window.StatCalcVars = {
    summary: function () {
      var list = scan(), eff = effective(list), out = { n: 0, num: 0, cat: 0, y: null, xs: [], factor: null };
      list.forEach(function (it) {
        if (it.num) {
          out.num++;
          if (eff[it.c] === 'Y') out.y = it.name; else if (eff[it.c] === 'X') out.xs.push(it.name);
        } else {
          out.cat++;
          if (out.factor === null) out.factor = it.name;
        }
      });
      try { out.n = list.length ? Math.max(0, sh.usedBounds().R - (sh.state.header ? 1 : 0)) : 0; } catch (e) { out.n = 0; }
      return out;
    },
    onChange: function (fn) { listeners.push(fn); }
  };
  function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* abaikan */ } }); }
  function renderAll() { render(); notify(); }
  render();
  if (sh.onChange) sh.onChange(renderAll);
  if (sh.onStructure) sh.onStructure(renderAll);
})();
