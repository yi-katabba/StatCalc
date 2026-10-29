/* Panel Proyek (desktop): daftar isi proyek aktif di kiri layar Lembar, mengikuti rancangan:
   "Lembar 1", "Hasil: Regresi 1", "Grafik: Pencar 1". Mengetuk butir membuka isinya.
   Juga mendaftarkan hasil dan grafik ke penyimpanan proyek (statcalc.proj.x.<id>) dan berkas .scp.
   Dimuat SETELAH projects.js. Bergantung pada StatCalcProjects, StatCalcHasil, StatCalcGraph. */
(function () {
  'use strict';
  var P = window.StatCalcProjects, H = window.StatCalcHasil, G = window.StatCalcGraph, box = document.getElementById('svProj');
  if (!P || !H || !G || !box) return;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function row(kind, id, label, active, removable, title) {
    return '<div class="pp-row' + (active ? ' on' : '') + '" role="button" tabindex="0" data-k="' + kind + '" data-id="' + esc(id) + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' +
      '<span class="pp-n">' + esc(label) + '</span>' +
      (removable ? '<button type="button" class="pp-x" data-del="1" aria-label="Hapus ' + esc(label) + '" title="Hapus">&times;</button>' : '') + '</div>';
  }
  function render() {
    var hs = H.list(), gs = G.list(), hc = H.current(), gc = G.selected(), nm = ($('scFname') && $('scFname').value.trim()) || '';
    var html = '<div class="pp-head"><span class="sv-k">Proyek</span></div>' +
      '<div class="pp-act"><button type="button" class="pp-b" data-a="save" title="Simpan proyek ke berkas .scp (Lembar, hasil, dan grafik)">Simpan .scp</button>' +
      '<button type="button" class="pp-b" data-a="open" title="Buka berkas proyek .scp">Buka .scp</button></div>';
    if (nm) html += '<div class="pp-file" title="' + esc(nm) + '.scp">' + esc(nm) + '.scp</div>';
    html += row('sheet', 'sheet', 'Lembar 1', !hc && !gc, false);
    hs.forEach(function (h) { html += row('h', h.uid, 'Hasil: ' + h.name, hc === h.uid && !gc, true); });
    gs.forEach(function (g) { html += row('g', g.uid, 'Grafik: ' + g.name, gc === g.uid, true, g.err ? 'Grafik ini gagal digambar dari data saat ini' : ''); });
    if (!hs.length && !gs.length) html += '<div class="pp-empty">Hasil analisis dan grafik yang Anda buat tampil di sini dan ikut tersimpan di proyek.</div>';
    box.innerHTML = html;
  }

  box.addEventListener('click', function (e) {
    var b = e.target.closest('.pp-b');
    if (b) { if (b.dataset.a === 'save') P.exportScp(); else P.pickScp(); return; }
    var r = e.target.closest('.pp-row'); if (!r) return;
    var k = r.dataset.k, id = r.dataset.id;
    if (e.target.closest('[data-del]')) {
      if (!window.confirm('Hapus ' + r.querySelector('.pp-n').textContent + ' dari proyek? Tindakan ini tidak bisa dibatalkan.')) return;
      if (k === 'h') H.remove(id); else if (k === 'g') G.remove(id);
      return;
    }
    if (k === 'sheet') { H.hide(); G.deselect(); }
    else if (k === 'h') { G.deselect(); H.show(id); }
    else if (k === 'g') { H.hide(); G.focus(id); }
    render();
  });
  box.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pp-row')) { e.preventDefault(); e.target.click(); }
  });
  if ($('scFname')) $('scFname').addEventListener('input', render);

  render();
  P.registerExtra('hasil', { get: H.exportAll, set: H.importAll });
  P.registerExtra('grafik', { get: G.exportAll, set: G.importAll });
  H.onChange(function () { render(); P.touch(); });
  G.onChange(function () { render(); P.touch(); });
  P.onRefresh(render);
})();
