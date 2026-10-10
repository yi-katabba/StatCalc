# Method/Calc

| File | Isi |
|---|---|
| `sheet.js` | Lembar kerja ala Excel: grid, mesin rumus, impor/ekspor, pita (File, Edit, Data, Fungsi, Grafik, Statistik). |
| `sheet-graph.js` | Tab **Grafik** / **Edit Grafik** (grafik langsung dari data lembar). Dimuat setelah `sheet.js`. |
| `sheet-data.js` | Tab **Data** (merapikan data sebelum analisis). Dimuat setelah `sheet.js`. |

## Tab Data (`sheet-data.js`)

| Kelompok | Fungsi |
|---|---|
| Urutkan | Naik / turun menurut satu kolom; seluruh baris ikut berpindah. Angka dulu, lalu teks; sel kosong selalu di bawah. |
| Filter | Syarat: sama dengan, tidak sama, >, >=, <, <=, di antara, mengandung, tidak mengandung, diawali, diakhiri, kosong, tidak kosong, berisi angka, berisi teks. Baris yang tidak cocok **disembunyikan** (dikeluarkan dari lembar, disimpan di memori) sehingga grafik, analisis Stat, dan ekspor hanya memakai baris yang tampil. Filter berikutnya bersifat DAN. "Tampilkan semua" mengembalikan baris ke posisi semula. |
| Duplikat & baris kosong | Duplikat dinilai dari seluruh baris / kolom terpilih (huruf besar-kecil dan spasi tepi diabaikan; kemunculan pertama dipertahankan). Baris kosong: seluruh baris, atau kosong di kolom tertentu. |
| Nilai hilang | Sel kosong (opsional: NA, N/A, #N/A, NaN, null, -, --, ?) diisi rata-rata / median / modus / nilai tertentu / nilai di atasnya, atau barisnya dihapus. Hasil isi berupa nilai tetap. Rata-rata & median hanya untuk kolom angka. |
| Teks ke angka | Membersihkan "Rp 1.250.000", "$ 2.000", "45%" (jadi 0,45), "(1.200)", "7-", spasi, spasi non-break. Format: Otomatis (utamakan Indonesia: titik = ribuan, koma = desimal), Indonesia, atau Internasional. Sel yang tidak dikenali dibiarkan dan dilaporkan. |
| Teks ke kolom | Memecah satu kolom menjadi beberapa kolom baru di kanannya (koma, titik koma, spasi, tab, titik dua, garis tegak, garis miring, tanda hubung, atau pemisah sendiri). Kolom di kanan bergeser; rumus dan grafik ikut menyesuaikan. |

Semua perintah dicatat di riwayat Urungkan/Ulangi (status filter ikut tersimpan di riwayat).

## Kait di `sheet.js` (`StatCalcSheet.api`)

`registerState(get, set)` (status ekstra ikut undo/redo), `setInfoHook`, `onReset` (dipanggil saat data diganti: impor, tabel baru, kosongkan),
`onTab(nama, fn)`, serta `pushUndo`, `invalidate`, `fullRender`, `flash`, `shiftFormula`, `adjustFormula`, `adjustAll`, `normalizeInput`, `ensure`.
