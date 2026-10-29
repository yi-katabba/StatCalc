/* Panel kiri "Alat hitung" (desktop): pindah Ilmiah/Matriks, satuan sudut, angka desimal */
(function () {
  'use strict';
  var view = document.getElementById('view-kalkulator'), C = window.StatCalcCalc;
  if (!view || !C) return;
  var host = view.querySelector('.chapter-inner') || view;
  var deg = document.getElementById('calcDegBtn'), rad = document.getElementById('calcRadBtn');
  var KEY = 'statcalc.calc.decimals';
  var opts = '<option value="">Otomatis</option>' + [0, 1, 2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
  var a = document.createElement('aside');
  a.className = 'calc-tools';
  a.setAttribute('aria-label', 'Alat hitung');
  a.innerHTML =
    '<div class="ct-k">Alat hitung</div>' +
    '<button type="button" class="ct-row on" data-go="kalkulator"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="2.4"/><path d="M8 7h8M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/></svg>Kalkulator ilmiah</button>' +
    '<button type="button" class="ct-row" data-go="matriks"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H5v16h3M16 4h3v16h-3"/><circle cx="10" cy="9" r=".8"/><circle cx="14" cy="9" r=".8"/><circle cx="10" cy="15" r=".8"/><circle cx="14" cy="15" r=".8"/></svg>Kalkulator matriks</button>' +
    '<div class="ct-k ct-k2">Pengaturan</div>' +
    '<div class="ct-set"><span>Satuan sudut</span><span class="ct-seg" id="ctAngle"><button type="button" data-a="deg">Derajat</button><button type="button" data-a="rad">Radian</button></span></div>' +
    '<div class="ct-set"><label for="ctDec">Angka desimal</label><select id="ctDec" class="select-input">' + opts + '</select></div>';
  host.appendChild(a);
  var dec = a.querySelector('#ctDec'), seg = a.querySelector('#ctAngle');
  function syncAngle() { seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.a === C.getAngle()); }); }
  try { var sv = localStorage.getItem(KEY); if (sv !== null) { dec.value = sv; C.setDecimals(sv === '' ? null : sv); } } catch (e) { /* penyimpanan tidak tersedia */ }
  syncAngle();
  [deg, rad].forEach(function (b) { if (b) b.addEventListener('click', function () { setTimeout(syncAngle, 0); }); });
  seg.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    (b.dataset.a === 'rad' ? rad : deg).click();
  });
  dec.addEventListener('change', function () {
    C.setDecimals(dec.value === '' ? null : dec.value);
    try { localStorage.setItem(KEY, dec.value); } catch (e) { /* abaikan */ }
  });
  a.addEventListener('click', function (e) {
    var r = e.target.closest('.ct-row'); if (!r || r.dataset.go === 'kalkulator') return;
    if (window.StatCalc && window.StatCalc.navigate) window.StatCalc.navigate(r.dataset.go);
  });
})();
