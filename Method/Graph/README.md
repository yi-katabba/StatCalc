# Method/Graph

JS untuk menu **Graph**. Urutan `<script>` di `index.html` harus:
`Method/Shared/impor-data.js` → `Method/Graph/graph-core.js` → file graph lainnya.

| File | Grafik | Jenis data |
|---|---|---|
| `graph-core.js` | modul bersama (halaman, tabel input, impor data, SVG, unduh PNG/SVG) | - |
| `scatter.js` | Scatter Plot | Dua variabel numerik |
| `histogram.js` | Histogram | Numerik 1 variabel |
| `probplot.js` | Probability Plot (Q-Q normal) | Numerik 1 variabel |
| `boxplot.js` | Boxplot | Per variabel (kolom = variabel, seperti Excel; 1 atau banyak kolom) / per kelompok |
| `barchart.js` | Bar Chart | Kategorik |
| `piechart.js` | Pie Chart | Kategorik |
| `timeseries.js` | Time Series Plot | Deret waktu |

## Menambah grafik baru

1. Buat file, mis. `Method/Graph/ecdf.js`:

```js
GraphCore.add({
  id: 'ecdf', title: 'Empirical CDF', types: ['numerik1'],   // jenis data (lihat GRAPH_TYPES di index.html)
  lede: 'Penjelasan singkat.', format: 'Format data yang diharapkan.',
  columns: [{ label: 'Nilai' }],                              // tambah text:true untuk kolom teks
  minRows: 3, sample: [[1],[2],[3]],
  axes: ['Nilai', 'Proporsi'],                                // opsional: label sumbu bawaan
  options: [{ key: 'x', type: 'checkbox', label: 'Contoh opsi', def: true }],
  draw(d, o) {                                                // d.cols = kolom data, d.n = jumlah baris
    const u = GraphCore.u;                                    // helper skala, sumbu, statistik
    return { svg: '<svg ...>', summary: '<p>HTML ringkasan</p>' };
  },
});
```

2. Di `index.html`: tambahkan `<script src="Method/Graph/ecdf.js"></script>` dan
   ubah entri `ecdf` di array `GRAPH_METHODS` menjadi `status: 'available'`
   (id entri harus sama dengan `id` di `GraphCore.add`).

Halaman, tabel, impor Excel, dan tombol unduh dibuat otomatis oleh `GraphCore`.

## Mode "per variabel" (kolom = variabel)

Tambahkan properti `wide` pada `GraphCore.add({...})` agar halaman punya pilihan format data
**Per variabel** (tiap kolom = satu variabel, nama kolom bisa diubah, jumlah variabel 1-12, impor Excel
otomatis menyesuaikan jumlah kolom dan memakai judul kolom sebagai nama variabel) dan **Per kelompok**:

```js
wide: { format: 'Teks petunjuk', namePrefix: 'Variabel', defCols: 3, maxCols: 12, minPerSeries: 2,
        sample: { names: ['A','B'], rows: [[1,2],[3,4]] },
        draw(d, o) { /* d.names = nama variabel, d.series = larik angka per variabel */ return { svg, summary }; } }
```

## Ekspor hasil Stat (.docx) + grafik pendukung

| File | Fungsi |
|---|---|
| `Method/Shared/stat-charts.js` | Pustaka grafik SVG: `line`, `scatter`, `qq`, `hist`, `bars`, `gbars`, `intervals`, `strip`, `acf`, `box` |
| `Method/Shared/export-hasil.js` | `StatExport.publish({...})`: panel grafik (unduh PNG/SVG/ZIP) + unduh laporan `.docx` (tanpa pustaka luar) |

Urutan `<script>`: `Method/Graph/*.js` -> `stat-charts.js` -> `export-hasil.js`.
Tiap modul di `Method/Stat/` memanggil `StatExport.publish` setelah perhitungan (fungsi `exportOne`, `exportTwo`,
`exportRegresi`, `exportSmoothing`, `exportStasioner`). Isi laporan diambil dari DOM hasil yang tampil,
jadi tabel/uji/kesimpulan di Word selalu sama dengan di layar.

## Pita (ribbon), warna, dan garis kisi

Setiap halaman Graph otomatis mendapat pita bertab (**Grafik**, **Warna**, **Garis kisi**) lewat
`StatRibbon.mount` (`Method/Shared/ribbon-metode.js`). Setelah grafik digambar, perubahan pita langsung
menggambar ulang. Di file graph, ambil gaya lewat `u.ST` (jangan menulis warna permanen):

- `u.ST.c1` warna data utama, `u.ST.c2` warna garis sorotan, `u.ST.pal[i]` palet, `u.ST.bg` latar, `u.ST.gc` warna kisi.
- Kisi horizontal dikendalikan `gridY`, kisi vertikal oleh `axisX`/`axisCat` (otomatis). Bila membuat sumbu sendiri,
  gambar kisi hanya jika `u.ST.on && u.ST.v` (vertikal) atau `u.ST.on && u.ST.h` (horizontal).
- Atur pemilih yang tampil per grafik di tabel `GRAPH_STYLE` pada `graph-core.js` (atau `style: {...}` di `GraphCore.add`);
  `grid: null` menyembunyikan tab Garis kisi. Opsi `select` boleh punya `gridDef: { nilai: {h, v} }` untuk mengatur bawaan kisi.
