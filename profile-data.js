/* Panel Profil: angka desimal, pemisah desimal, cadangan, pulihkan, hapus semua data */
(function () {
  'use strict';
  var F = window.StatCalcFormat;
  var $ = function (s) { return document.getElementById(s); };
  function toast(m) { if (window.StatCalc && window.StatCalc.showToast) window.StatCalc.showToast(m); }
  function keys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('statcalc') === 0) out.push(k); } } catch (e) { /* abaikan */ }
    return out;
  }

  /* --- angka desimal & pemisah --- */
  var dec = $('profileDec'), sep = $('profileSep');
  if (F && dec && sep) {
    var cur = F.get();
    dec.value = cur.dec === null ? '' : String(cur.dec);
    sep.value = cur.sep;
    dec.addEventListener('change', function () { F.set({ dec: dec.value === '' ? null : dec.value }); toast('Angka desimal diperbarui. Hitung ulang bila hasil belum berubah.'); });
    sep.addEventListener('change', function () { F.set({ sep: sep.value }); toast('Pemisah desimal: ' + (sep.value === ',' ? 'koma' : 'titik') + '.'); });
  }

  /* --- ekspor cadangan --- */
  var bExp = $('btnEksporCadangan');
  if (bExp) bExp.addEventListener('click', function () {
    var data = {}; keys().forEach(function (k) { try { data[k] = localStorage.getItem(k); } catch (e) { /* abaikan */ } });
    var payload = { app: 'StatCalc', versi: 2, diekspor: new Date().toISOString(), data: data };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'), d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    a.href = URL.createObjectURL(blob);
    a.download = 'StatCalc-cadangan-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('Cadangan disimpan (' + Object.keys(data).length + ' pengaturan).');
  });

  /* --- pulihkan --- */
  var bImp = $('btnPulihkan'), file = $('fileCadangan');
  if (bImp && file) {
    bImp.addEventListener('click', function () { file.value = ''; file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onerror = function () { toast('Berkas tidak dapat dibaca.'); };
      rd.onload = function () {
        var obj; try { obj = JSON.parse(String(rd.result)); } catch (e) { obj = null; }
        if (!obj || obj.app !== 'StatCalc' || !obj.data || typeof obj.data !== 'object') { toast('Bukan berkas cadangan StatCalc yang valid.'); return; }
        var ks = Object.keys(obj.data).filter(function (k) { return k.indexOf('statcalc') === 0 && typeof obj.data[k] === 'string'; });
        if (!ks.length) { toast('Berkas cadangan kosong.'); return; }
        if (!window.confirm('Pulihkan ' + ks.length + ' pengaturan dari cadangan? Pengaturan dan profil saat ini akan ditimpa.')) return;
        try { ks.forEach(function (k) { localStorage.setItem(k, obj.data[k]); }); } catch (e) { toast('Penyimpanan perangkat tidak tersedia.'); return; }
        toast('Cadangan dipulihkan. Memuat ulang...');
        setTimeout(function () { location.reload(); }, 700);
      };
      rd.readAsText(f);
    });
  }

  /* --- hapus semua data --- */
  var bDel = $('btnHapusSemua');
  if (bDel) bDel.addEventListener('click', function () {
    if (!window.confirm('Hapus SEMUA data StatCalc di perangkat ini (profil, pengaturan, statistik pemakaian)? Tindakan ini tidak bisa dibatalkan.')) return;
    keys().forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } });
    toast('Semua data dihapus. Memuat ulang...');
    setTimeout(function () { location.reload(); }, 700);
  });
})();
