/* Halaman Profil: menu samping (Profil, Perhitungan, Data dan cadangan, Tentang) menggulir ke bagiannya,
   dan bagian yang sedang tampil ditandai di menu. Kontrol (alpha, desimal, cadangan, dll.) memakai id lama,
   jadi perilakunya tetap dari prefs.js / profile-data.js. Dimuat SETELAH profile-data.js. */
(function () {
  'use strict';
  var view = document.getElementById('view-profil'); if (!view) return;
  var items = Array.prototype.slice.call(view.querySelectorAll('.pf-mi'));
  var secs = items.map(function (b) { return document.getElementById(b.dataset.pf); });
  function mark(i) { items.forEach(function (b, k) { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }); }
  function spy() {
    var k = 0, i;
    for (i = 0; i < secs.length; i++) { if (secs[i] && secs[i].getBoundingClientRect().top <= 140) k = i; }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) k = secs.length - 1;
    mark(k);
  }
  items.forEach(function (b, i) {
    b.addEventListener('click', function () {
      var el = secs[i]; if (!el) return;
      mark(i); el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  var raf = 0;
  window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (view.classList.contains('active')) spy(); }); }, { passive: true });
  new MutationObserver(function () {
    var on = view.classList.contains('active');
    document.body.classList.toggle('pf-on', on);
    if (on) { mark(0); }
  }).observe(view, { attributes: true, attributeFilter: ['class'] });
})();
