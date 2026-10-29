/* Layar Hitung (ponsel/tablet): segmen Ilmiah | Matriks dan satuan sudut Derajat/Radian di bagian atas.
   Di desktop lebar (>= 1280px) fungsi ini sudah ada di panel "Alat hitung" (kalkulator-panel.js). Dimuat SETELAH kalkulator-panel.js. */
(function () {
  'use strict';
  var SC = window.StatCalc, C = window.StatCalcCalc;
  var kv = document.getElementById('view-kalkulator'), mv = document.getElementById('view-matriks');
  if (!SC || !kv || !mv) return;
  var deg = document.getElementById('calcDegBtn'), rad = document.getElementById('calcRadBtn');
  var bars = [];
  function make(active) {
    var b = document.createElement('div');
    b.className = 'hs-bar';
    b.innerHTML =
      '<div class="hs-seg" role="tablist" aria-label="Jenis kalkulator">' +
      '<button type="button" role="tab" data-go="kalkulator" aria-selected="' + (active === 'kalkulator') + '"' + (active === 'kalkulator' ? ' class="on"' : '') + '>Ilmiah</button>' +
      '<button type="button" role="tab" data-go="matriks" aria-selected="' + (active === 'matriks') + '"' + (active === 'matriks' ? ' class="on"' : '') + '>Matriks</button></div>' +
      (active === 'kalkulator' ? '<button type="button" class="hs-ang" aria-label="Satuan sudut: ketuk untuk mengganti"></button>' : '');
    return b;
  }
  function mount(view, active) {
    var host = view.querySelector('.chapter-inner') || view, b = make(active);
    host.insertBefore(b, host.firstChild);
    bars.push(b);
    b.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (g) { if (g.dataset.go !== active) SC.navigate(g.dataset.go, { backTo: 'home' }); return; }
      if (e.target.closest('.hs-ang') && deg && rad) { (C && C.getAngle() === 'rad' ? deg : rad).click(); setTimeout(syncAngle, 0); }
    });
  }
  function syncAngle() {
    var t = C && C.getAngle() === 'rad' ? 'Radian' : 'Derajat';
    bars.forEach(function (b) { var a = b.querySelector('.hs-ang'); if (a) a.textContent = t; });
  }
  mount(kv, 'kalkulator'); mount(mv, 'matriks');
  syncAngle();
  [deg, rad].forEach(function (b) { if (b) b.addEventListener('click', function () { setTimeout(syncAngle, 0); }); });
})();
