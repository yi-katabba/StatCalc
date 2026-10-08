# Method/Graph

Folder untuk file JS metode **Graph** (histogram, diagram batang, scatter plot, box plot, dst).

Cara menambah satu metode graph:
1. Buat file, mis. `histogram.js`, di folder ini.
2. Di `index.html`, ubah entri terkait di array `GRAPH_METHODS` dari `status: 'soon'` menjadi `'available'`.
3. Buat `<section class="view" id="view-histogram">` di `index.html`.
4. Tambahkan `<script src="Method/Graph/histogram.js"></script>` di bagian bawah `index.html`.

## Impor data di graph

Modul impor (tempel dari Excel / unggah CSV, XLSX) ada di `Method/Shared/impor-data.js` dan dipakai bersama oleh Stat dan Graph.
Di file graph, setelah tabel input dibuat, daftarkan seperti ini:

```js
window.StatCalcImport.register({
  card:   '#hg-data-card',
  body:   '#hgDataTableBody',
  add:    '#hgAddRowBtn',
  remove: '#hgRemoveRowBtn',
  minHint:'#hgMinRowsHint'
});
```
Karena itu `<script>` graph harus dimuat **setelah** `impor-data.js`.
