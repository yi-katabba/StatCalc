# Method/Graph

JS untuk menu **Graph**. Urutan `<script>` di `index.html` harus:
`Method/Shared/impor-data.js` → `Method/Graph/graph-core.js` → file graph lainnya.

| File | Grafik | Jenis data |
|---|---|---|
| `graph-core.js` | modul bersama (halaman, tabel input, impor data, SVG, unduh PNG/SVG) | - |
| `scatter.js` | Scatter Plot | Dua variabel numerik |
| `histogram.js` | Histogram | Numerik 1 variabel |
| `probplot.js` | Probability Plot (Q-Q normal) | Numerik 1 variabel |
| `boxplot.js` | Boxplot | Numerik per kelompok / 1 variabel |
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
