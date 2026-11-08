/* =========================================================================
   KATEGORI METODE STAT - satu sumber daftar kategori (nama & urutan mengikuti menu Stat Minitab)
   -------------------------------------------------------------------------
   Dipakai oleh: menu Stat (index.html), pita Statistik di Dataset (Method/Calc/sheet.js),
   dan dropdown Metode (analisis-vars.js). Muat SEBELUM ketiganya.

   Menambah metode baru:
     1. daftarkan kartunya di METHODS (index.html) seperti biasa;
     2. petakan id-nya ke kategori di `of` di bawah;
     3. bila sebelumnya tercantum di `planned` kategori itu, hapus dari sana.
   `planned` = nama metode yang direncanakan (tampil sebagai baris "Segera hadir" di menu Stat,
   tanpa kartu & tanpa halaman). Kategori Minitab tanpa isi (Reliability/Survival, Equivalence Tests)
   sengaja belum dimasukkan.

   API: StatCalcKategori.cats, .catOf(id), .label(id), .order(ids) -> [{cat, ids}]
   ========================================================================= */
(function () {
  'use strict';
  var CATS = [
    { id: 'basic',    label: 'Basic Statistics',      planned: [] },
    { id: 'regresi',  label: 'Regression',            planned: [] },
    { id: 'anova',    label: 'ANOVA',                 planned: [] },
    { id: 'doe',      label: 'DOE',                   planned: [] },
    { id: 'control',  label: 'Control Charts',        planned: [] },
    { id: 'quality',  label: 'Quality Tools',         planned: [] },
    { id: 'multivar', label: 'Multivariate',          planned: [] },
    { id: 'waktu',    label: 'Time Series',           planned: [] },
    { id: 'tabel',    label: 'Tables',                planned: [] },
    { id: 'nonparam', label: 'Nonparametrics',        planned: [] },
    { id: 'power',    label: 'Power and Sample Size', planned: [] }
  ];
  /* id metode -> id kategori */
  var OF = {
    deskriptif: 'basic', 'uji-t': 'basic', korelasi: 'basic', 'uji-z': 'basic', proporsi: 'basic', ragam: 'basic', normalitas: 'basic',
    regresi: 'regresi',
    anova: 'anova',
    rsm: 'doe',
    smoothing: 'waktu', stasioner: 'waktu', arima: 'waktu',
    'chi-square': 'tabel', fisher: 'tabel', 'mann-whitney': 'nonparam', wilcoxon: 'nonparam', kruskal: 'nonparam', friedman: 'nonparam', 'uji-lanjut': 'anova', 'ral-rak': 'anova', 'anova-berulang': 'anova', polinomial: 'regresi', stepwise: 'regresi', logistik: 'regresi', pca: 'multivar', faktor: 'multivar', klaster: 'multivar', butir: 'multivar', sem: 'multivar', 'dekomposisi-waktu': 'waktu', faktorial: 'doe', 'peta-kendali': 'control', kapabilitas: 'quality', pareto: 'quality', power: 'power', 'sampel-survei': 'power'
  };
  /* urutan tampil dalam satu kategori (id yang tidak tercantum di sini ditaruh di akhir) */
  var SEQ = ['deskriptif', 'normalitas', 'korelasi', 'uji-z', 'uji-t', 'proporsi', 'ragam', 'rsm', 'faktorial', 'peta-kendali', 'kapabilitas', 'pareto', 'power', 'sampel-survei', 'regresi', 'polinomial', 'stepwise', 'logistik', 'anova', 'uji-lanjut', 'ral-rak', 'anova-berulang', 'rsm', 'smoothing', 'stasioner', 'arima', 'dekomposisi-waktu', 'pca', 'faktor', 'klaster', 'butir', 'sem', 'chi-square', 'fisher', 'mann-whitney', 'wilcoxon', 'kruskal', 'friedman'];
  function seq(id) { var i = SEQ.indexOf(id); return i < 0 ? 999 : i; }
  function catOf(id) { return OF[id] || null; }
  function label(catId) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === catId) return CATS[i].label;
    return '';
  }
  /* kelompokkan daftar id menurut urutan kategori; id tanpa kategori masuk ke akhir (cat: null) */
  function order(ids) {
    var out = [], used = {};
    CATS.forEach(function (c) {
      var g = ids.filter(function (id) { return OF[id] === c.id; });
      g.sort(function (a, b) { return seq(a) - seq(b); });
      g.forEach(function (id) { used[id] = 1; });
      if (g.length) out.push({ cat: c, ids: g });
    });
    var rest = ids.filter(function (id) { return !used[id]; });
    if (rest.length) out.push({ cat: null, ids: rest });
    return out;
  }
  window.StatCalcKategori = { cats: CATS, of: OF, catOf: catOf, label: label, order: order };
})();
