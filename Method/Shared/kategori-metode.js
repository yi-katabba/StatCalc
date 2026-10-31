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
    { id: 'basic',    label: 'Basic Statistics',      planned: ['Uji z', 'Uji proporsi', 'Uji kesamaan ragam (F, Levene)', 'Korelasi (Pearson, Spearman)', 'Uji normalitas'] },
    { id: 'regresi',  label: 'Regression',            planned: ['Regresi Polinomial', 'Stepwise & Best Subsets', 'Regresi Logistik'] },
    { id: 'anova',    label: 'ANOVA',                 planned: ['Uji lanjut (Tukey, Bonferroni, Dunnett)', 'RAL & RAK', 'ANOVA pengukuran berulang'] },
    { id: 'doe',      label: 'DOE',                   planned: ['Faktorial 2^k'] },
    { id: 'control',  label: 'Control Charts',        planned: ['Peta kendali variabel (X-bar/R, I-MR)', 'Peta kendali atribut (p, np, c, u)'] },
    { id: 'quality',  label: 'Quality Tools',         planned: ['Kapabilitas proses (Cp, Cpk)', 'Diagram Pareto'] },
    { id: 'multivar', label: 'Multivariate',          planned: ['PCA', 'Analisis Faktor', 'Klaster (hierarki, k-means)', 'Analisis Butir (validitas, Cronbach\u2019s alpha)'] },
    { id: 'waktu',    label: 'Time Series',           planned: ['Dekomposisi'] },
    { id: 'tabel',    label: 'Tables',                planned: ['Fisher exact'] },
    { id: 'nonparam', label: 'Nonparametrics',        planned: ['Mann-Whitney', 'Wilcoxon', 'Kruskal-Wallis', 'Friedman'] },
    { id: 'power',    label: 'Power and Sample Size', planned: ['Power & ukuran sampel', 'Slovin, Cochran, Lemeshow'] }
  ];
  /* id metode -> id kategori */
  var OF = {
    deskriptif: 'basic', 'uji-t': 'basic',
    regresi: 'regresi',
    anova: 'anova',
    rsm: 'doe',
    smoothing: 'waktu', stasioner: 'waktu', arima: 'waktu',
    'chi-square': 'tabel'
  };
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
      g.forEach(function (id) { used[id] = 1; });
      if (g.length) out.push({ cat: c, ids: g });
    });
    var rest = ids.filter(function (id) { return !used[id]; });
    if (rest.length) out.push({ cat: null, ids: rest });
    return out;
  }
  window.StatCalcKategori = { cats: CATS, of: OF, catOf: catOf, label: label, order: order };
})();
