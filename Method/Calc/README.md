# Method/Calc

| File | Isi |
|---|---|
| `sheet.js` | Lembar kerja ala Excel: grid, mesin rumus, impor/ekspor, pita (File, Edit, Data, Fungsi, Grafik, Statistik). |
| `sheet-graph.js` | Tab **Grafik** / **Edit Grafik** (grafik langsung dari data lembar). Dimuat setelah `sheet.js`. |
| `sheet-data.js` | Tab **Data** (merapikan data sebelum analisis). Dimuat setelah `sheet.js`. |
| `sheet-sidebar.js` | Tombol ‹ / › untuk menciutkan panel kiri (Proyek & Variabel) dan kanan (Hasil) menjadi rel sempit; lembar di tengah melebar, dan lebar semula dipulihkan saat dibuka. |
| `ribbon-menu.js` | Mengubah kelompok checkbox di pita menjadi menu dropdown bertanda ✓ (checkbox asli disembunyikan, event `change` tetap dikirim). |
| `sheet-hasil.js` | Panel **Hasil** di dalam Lembar (tab Ringkasan / Tabel / Langkah / Grafik di desktop; segmen Data / Hasil di ponsel). Menyalin hasil dari halaman metode. Dimuat setelah `sheet-graph.js`. |

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

## Zoom (`sheet.js`)

Di pojok kanan bawah lembar kerja ada kontrol zoom: tombol − / +, penggeser (50%–200%, langkah 10%), dan angka persen (klik untuk kembali ke 100%). Ctrl + gulir mouse (atau cubit di trackpad) di atas lembar juga mengubah zoom. Zoom memperbesar/memperkecil **pita, kotak rumus, dan lembar** sekaligus; ukuran area lembar tetap, jadi zoom mengubah jumlah sel yang tampak (seperti Excel). Tingkat zoom diingat (`localStorage`). API: `StatCalcSheet.zoom.get() / set(persen)`.

## Menu dropdown pita (`ribbon-menu.js`)

Setiap kelompok `label.sc-chk` di pita dijadikan satu tombol dropdown (mis. **Judul kolom ▾**, **Nilai hilang ▾**, **Elemen ▾**, **Garis kisi ▾**, **Ukuran ▾**). Item menu bertanda ✓ bila aktif. Checkbox asli tetap ada (tersembunyi) sehingga kode lama yang membaca `.checked` / event `change` tidak berubah. Menu ikut dibangun ulang otomatis saat tab Edit Grafik dirender ulang. Keyboard: Enter / Spasi / ↓ membuka, ↑ ↓ berpindah, Esc menutup.

## Panel samping dapat diciutkan (`sheet-sidebar.js`)

Di layar ≥ 1280 px, panel kiri dan kanan punya tombol ‹ / › di bilah atasnya. Diciutkan = rel 44 px berjudul tegak (klik di mana saja pada rel untuk membuka). Lembar di tengah melebar mengisi ruang untuk kasus: kiri saja, kanan saja, atau keduanya. Lebar custom hasil geseran (`kolom-geser.js`) tidak dihapus, jadi lebar semula kembali persis saat dibuka. Titik biru di rel kanan menandai hasil baru yang masuk saat diciutkan. API: `StatCalcSide.get()` / `StatCalcSide.set({left, right})`. Pilihan tersimpan di `localStorage` (`statcalc.calc.side`).

## Pintu masuk dari layar Analisis (`analisis-vars.js` + `sheet.js`)

Halaman metode tidak membaca data Lembar sendiri, jadi kartu **Variabel yang dipakai** kini menjelaskan dan menyediakan dua jalan:

| Aksi | Hasil |
|---|---|
| **Jalankan di Lembar** (setelah memilih *Metode* di kartu) | Membuka Lembar, tab Statistik aktif, metode terpilih sudah dicentang. Analisis dijalankan lewat *Jalankan analisis*. |
| Ketuk **kartu metode** (Metode Stat) | Selalu membuka halaman metode. Data Lembar dimuat lewat tombol **Isi dari Lembar** di halaman itu. |

API di `StatCalcSheet.api`: `hasData()`, `canRun(id)`, `methodList()`, `getMethod()`, `pickMethod(id)`, `openStatTab()`, `runMethod(id)`. Tombol *Jalankan analisis* di pita memakai `runMethod` yang sama; bila lembar kosong kini muncul pesan galat, bukan panel Hasil yang menggantung pada "Menghitung…".

## Tombol "Isi dari Lembar" di halaman metode & grafik (`Method/Shared/isi-lembar.js`)

Di tiap kartu data halaman Stat dan Graph, tombol **Isi contoh data** kini ditemani **Isi dari Lembar** (ditambahkan otomatis untuk setiap kartu yang terdaftar di `StatCalcImport`).

| Kondisi | Hasil |
|---|---|
| Lembar berisi data | Data dimuat ke tabel halaman itu (jumlah baris/kolom disesuaikan, peran X/Y dari panel Variabel ikut dipakai). Tidak pindah halaman dan tidak langsung menghitung. |
| Lembar kosong | Peringatan "Lembar kerja masih kosong..." di kartu data dan sebagai toast. |
| Kolom data kurang dari kolom tabel | Pesan dari importer (mis. RSM butuh minimal 3 kolom) tetap tampil. |

Graph dengan kolom opsional di ujung (mis. *Kelompok warna* pada Scatter) dilengkapi kolom kosong otomatis. API: `StatCalcSheet.api.fillFromSheet(id, cardSel)`, `StatCalcImport.cards()`, `StatCalcImport.notify(kartu, 'ok'|'err', pesan)`.

## Grafik "Di luar lembar kerja" bisa diciutkan (`sheet-graph.js`)

Tiap grafik di panel hasil punya tombol **Ciutkan / Buka** (atau ketuk judulnya). Saat diciutkan hanya judul dan tombol aksi yang tampil; grafik, catatan, dan ringkasan disembunyikan. Status tersimpan per grafik selama sesi (tidak hilang saat daftar dibangun ulang), dan tombol **Edit grafik** membuka grafik yang sedang diciutkan.

## Pita bisa digeser (`Method/Shared/geser-pita.js`)

Berlaku untuk pita Lembar (`.sc-rbody`) dan pita halaman Stat / "Pengaturan grafik" halaman Graph (`.rb-body`, termasuk pita Warna / Garis kisi pada grafik pendukung hasil; pita yang dibuat belakangan dikenali otomatis). Bila lebar tidak cukup: gulir mouse biasa menggeser ke kiri/kanan (Ctrl + roda tetap zoom; di ujung, halaman bergulir seperti biasa), tahan klik kiri pada bagian kosong lalu tarik (kolom isian dan pilihan tidak ikut menarik), serta panah ‹ › di tepi yang muncul hanya bila masih ada isi di sisi itu. Bilah gulir bawaan disembunyikan; geser sentuh tetap bekerja.
