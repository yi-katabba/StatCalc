# Method/Calc

| File | Isi |
|---|---|
| `sheet.js` | Dataset ala Excel: grid, mesin rumus, impor/ekspor, pita (File, Edit, Data, Fungsi, Grafik, Statistik). |
| `sheet-graph.js` | Tab **Grafik** / **Edit Grafik** (grafik langsung dari data Dataset). Dimuat setelah `sheet.js`. |
| `sheet-data.js` | Tab **Data** (merapikan data sebelum analisis). Dimuat setelah `sheet.js`. |
| `sheet-sidebar.js` | Tombol ‹ / › untuk menciutkan panel kiri (Proyek & Variabel) dan kanan (Hasil) menjadi rel sempit; Dataset di tengah melebar, dan lebar semula dipulihkan saat dibuka. |
| `ribbon-menu.js` | Mengubah kelompok checkbox di pita menjadi menu dropdown bertanda ✓ (checkbox asli disembunyikan, event `change` tetap dikirim). |
| `sheet-hasil.js` | Panel **Hasil** di dalam Dataset (tab Ringkasan / Tabel / Langkah / Grafik di desktop; segmen Data / Hasil di ponsel). Menyalin hasil dari halaman metode. Dimuat setelah `sheet-graph.js`. |

## Tab Data (`sheet-data.js`)

| Kelompok | Fungsi |
|---|---|
| Urutkan | Naik / turun menurut satu kolom; seluruh baris ikut berpindah. Angka dulu, lalu teks; sel kosong selalu di bawah. |
| Filter | Syarat: sama dengan, tidak sama, >, >=, <, <=, di antara, mengandung, tidak mengandung, diawali, diakhiri, kosong, tidak kosong, berisi angka, berisi teks. Baris yang tidak cocok **disembunyikan** (dikeluarkan dari Dataset, disimpan di memori) sehingga grafik, analisis Stat, dan ekspor hanya memakai baris yang tampil. Filter berikutnya bersifat DAN. "Tampilkan semua" mengembalikan baris ke posisi semula. |
| Duplikat & baris kosong | Duplikat dinilai dari seluruh baris / kolom terpilih (huruf besar-kecil dan spasi tepi diabaikan; kemunculan pertama dipertahankan). Baris kosong: seluruh baris, atau kosong di kolom tertentu. |
| Nilai hilang | Sel kosong (opsional: NA, N/A, #N/A, NaN, null, -, --, ?) diisi rata-rata / median / modus / nilai tertentu / nilai di atasnya, atau barisnya dihapus. Hasil isi berupa nilai tetap. Rata-rata & median hanya untuk kolom angka. |
| Teks ke angka | Membersihkan "Rp 1.250.000", "$ 2.000", "45%" (jadi 0,45), "(1.200)", "7-", spasi, spasi non-break. Format: Otomatis (utamakan Indonesia: titik = ribuan, koma = desimal), Indonesia, atau Internasional. Sel yang tidak dikenali dibiarkan dan dilaporkan. |
| Teks ke kolom | Memecah satu kolom menjadi beberapa kolom baru di kanannya (koma, titik koma, spasi, tab, titik dua, garis tegak, garis miring, tanda hubung, atau pemisah sendiri). Kolom di kanan bergeser; rumus dan grafik ikut menyesuaikan. |

Semua perintah dicatat di riwayat Urungkan/Ulangi (status filter ikut tersimpan di riwayat).

## Kait di `sheet.js` (`StatCalcSheet.api`)

`registerState(get, set)` (status ekstra ikut undo/redo), `setInfoHook`, `onReset` (dipanggil saat data diganti: impor, tabel baru, kosongkan),
`onTab(nama, fn)`, serta `pushUndo`, `invalidate`, `fullRender`, `flash`, `shiftFormula`, `adjustFormula`, `adjustAll`, `normalizeInput`, `ensure`.

## Zoom (`sheet.js`)

Di pojok kanan bawah Dataset ada kontrol zoom: tombol − / +, penggeser (50%–200%, langkah 10%), dan angka persen (klik untuk kembali ke 100%). Ctrl + gulir mouse (atau cubit di trackpad) di atas Dataset juga mengubah zoom. Zoom memperbesar/memperkecil **pita, kotak rumus, dan Dataset** sekaligus; ukuran area Dataset tetap, jadi zoom mengubah jumlah sel yang tampak (seperti Excel). Tingkat zoom diingat (`localStorage`). API: `StatCalcSheet.zoom.get() / set(persen)`.

## Menu dropdown pita (`ribbon-menu.js`)

Setiap kelompok `label.sc-chk` di pita dijadikan satu tombol dropdown (mis. **Judul kolom ▾**, **Nilai hilang ▾**, **Elemen ▾**, **Garis kisi ▾**, **Ukuran ▾**). Item menu bertanda ✓ bila aktif. Checkbox asli tetap ada (tersembunyi) sehingga kode lama yang membaca `.checked` / event `change` tidak berubah. Menu ikut dibangun ulang otomatis saat tab Edit Grafik dirender ulang. Keyboard: Enter / Spasi / ↓ membuka, ↑ ↓ berpindah, Esc menutup.

## Panel samping dapat diciutkan (`sheet-sidebar.js`)

Di layar ≥ 1280 px, panel kiri dan kanan punya tombol ‹ / › di bilah atasnya. Diciutkan = rel 44 px berjudul tegak (klik di mana saja pada rel untuk membuka). Dataset di tengah melebar mengisi ruang untuk kasus: kiri saja, kanan saja, atau keduanya. Lebar custom hasil geseran (`kolom-geser.js`) tidak dihapus, jadi lebar semula kembali persis saat dibuka. Titik biru di rel kanan menandai hasil baru yang masuk saat diciutkan. API: `StatCalcSide.get()` / `StatCalcSide.set({left, right})`. Pilihan tersimpan di `localStorage` (`statcalc.calc.side`).

## Pintu masuk dari layar Stat (`analisis-vars.js` + `sheet.js`)

Halaman metode tidak membaca data Dataset sendiri, jadi kartu **Variabel yang dipakai** kini menjelaskan dan menyediakan dua jalan:

| Aksi | Hasil |
|---|---|
| **Jalankan di Dataset** (setelah memilih *Metode* di kartu) | Membuka Dataset, tab Statistik aktif, metode terpilih sudah dicentang. Analisis dijalankan lewat *Jalankan analisis*. |
| Ketuk **kartu metode** (Metode Stat) | Selalu membuka halaman metode. Data dimuat lewat tombol **Isi dari Dataset** di halaman itu. |

API di `StatCalcSheet.api`: `hasData()`, `canRun(id)`, `methodList()`, `getMethod()`, `pickMethod(id)`, `openStatTab()`, `runMethod(id)`. Tombol *Jalankan analisis* di pita memakai `runMethod` yang sama; bila Dataset kosong kini muncul pesan galat, bukan panel Hasil yang menggantung pada "Menghitung…".

## Tombol "Isi dari Dataset" di halaman metode & grafik (`Method/Shared/isi-lembar.js`)

Di tiap kartu data halaman Stat dan Graph, tombol **Isi contoh data** kini ditemani **Isi dari Dataset** (ditambahkan otomatis untuk setiap kartu yang terdaftar di `StatCalcImport`).

| Kondisi | Hasil |
|---|---|
| Dataset berisi data | Data dimuat ke tabel halaman itu (jumlah baris/kolom disesuaikan, peran X/Y dari panel Variabel ikut dipakai). Tidak pindah halaman dan tidak langsung menghitung. |
| Dataset kosong | Peringatan "Dataset masih kosong..." di kartu data dan sebagai toast. |
| Kolom data kurang dari kolom tabel | Pesan dari importer (mis. RSM butuh minimal 3 kolom) tetap tampil. |

Graph dengan kolom opsional di ujung (mis. *Kelompok warna* pada Scatter) dilengkapi kolom kosong otomatis. API: `StatCalcSheet.api.fillFromSheet(id, cardSel)`, `StatCalcImport.cards()`, `StatCalcImport.notify(kartu, 'ok'|'err', pesan)`.

## Grafik "Di luar Dataset" bisa diciutkan (`sheet-graph.js`)

Tiap grafik di panel hasil punya tombol **Ciutkan / Buka** (atau ketuk judulnya). Saat diciutkan hanya judul dan tombol aksi yang tampil; grafik, catatan, dan ringkasan disembunyikan. Status tersimpan per grafik selama sesi (tidak hilang saat daftar dibangun ulang), dan tombol **Edit grafik** membuka grafik yang sedang diciutkan.

## Pita bisa digeser (`Method/Shared/geser-pita.js`)

Berlaku untuk pita Dataset (`.sc-rbody`) dan pita halaman Stat / "Pengaturan grafik" halaman Graph (`.rb-body`, termasuk pita Warna / Garis kisi pada grafik pendukung hasil; pita yang dibuat belakangan dikenali otomatis). Bila lebar tidak cukup: gulir mouse biasa menggeser ke kiri/kanan (Ctrl + roda tetap zoom; di ujung, halaman bergulir seperti biasa), tahan klik kiri pada bagian kosong lalu tarik (kolom isian dan pilihan tidak ikut menarik), serta panah ‹ › di tepi yang muncul hanya bila masih ada isi di sisi itu. Bilah gulir bawaan disembunyikan; geser sentuh tetap bekerja.

## Kategori metode (`Method/Shared/kategori-metode.js`)

> Status: seluruh 11 kategori Minitab yang direncanakan sudah berisi metode (38 metode). Kategori kosong Reliability/Survival dan Equivalence Tests sengaja belum dibuat.

Satu sumber daftar kategori Stat (nama & urutan mengikuti menu Stat Minitab): Basic Statistics, Regression, ANOVA, DOE, Control Charts, Quality Tools, Multivariate, Time Series, Tables, Nonparametrics, Power and Sample Size. Dipakai oleh menu Stat (`index.html`: header per kategori + chip filter), pita **Statistik** di Dataset (grup per kategori), dan dropdown **Metode** di `analisis-vars.js` (`<optgroup>`).

Metode baru: daftarkan kartunya di `METHODS` (`index.html`), petakan id-nya di `OF` pada file kategori, lalu hapus namanya dari `planned` kategori itu. Metode yang masih `planned` tampil sebagai baris "Segera hadir" di menu Stat (tanpa kartu). Pita Statistik di `sheet.js` memakai `katL(id)` untuk label grup; tombol metode baru ditambah manual di grup kategorinya.

## Basic Statistics (Tahap 2)

Metode: Uji t, Korelasi, Uji z, Uji Proporsi, Uji Kesamaan Ragam (F, Levene, Bartlett), Uji Normalitas (Shapiro-Wilk, Anderson-Darling, Jarque-Bera).

- `Method/Shared/stat-dist.js`: distribusi t, normal, chi-square, F (+ kuantil F).
- `Method/Stat/basic-core.js`: semua hitungan, tanpa DOM (bisa diuji di Node).
- `Method/Stat/basic-ui.js`: gaya `.bs-*`, pemformat angka, dan `mountPage(cfg)` yang membuat kerangka halaman (kartu data, hasil 3 tab, pita, tabel data + impor). Halaman baru cukup memanggil `mountPage`, lalu mengisi `onCalc`/`onSample`.
- Halaman: `ujit.js`, `korelasi.js` (kerangka sendiri), `ujiz.js`, `proporsi.js` (tanpa tabel: input ringkasan), `ragam.js`, `normalitas.js` (memakai `mountPage`).

Pengujian terhadap SciPy/statsmodels (galat < 1e-9; Shapiro-Wilk < 1e-5):
`python3 tests/make_ref.py && node tests/basic-core.test.js` dan `python3 tests/make_ref2.py && node tests/basic-core2.test.js` (butuh numpy, scipy, statsmodels).

Menambah metode Basic Statistics baru: tambah fungsi di `basic-core.js` (+ kasus uji), buat halaman dengan `mountPage`, daftarkan kartu di `METHODS` (`index.html`), id di `OF`/`SEQ` (`kategori-metode.js`), `SEND`/`CALC_BTN`/tombol pita (`sheet.js`), dan `M`/`SHORT` (`sheet-hasil.js`), serta `IDS` (`stat-layout.js`) dan `VIEWS` (`penjelasan-judul.js`).

## Tables & Nonparametrics (Tahap 3)

Metode: Chi-Square (independensi + kesesuaian), Uji Eksak Fisher, Mann-Whitney, Wilcoxon (satu sampel / berpasangan), Kruskal-Wallis, Friedman.

- `Method/Stat/nonpar-core.js`: semua hitungan, tanpa DOM. p-value eksak Mann-Whitney (N ≤ 40, tanpa nilai kembar) dan Wilcoxon (n ≤ 50, tanpa nol/kembar) dari distribusi eksak; selain itu pendekatan normal dengan koreksi nilai kembar dan kontinuitas.
- Halaman (semua memakai `StatBasicUI.mountPage`): `chisq.js`, `fisher.js` (input ringkasan, tanpa tabel), `mannwhitney.js`, `wilcoxon.js`, `kruskal.js`, `friedman.js`.
- Chi-Square dan Fisher tidak dikirim dari Dataset (inputnya tabel frekuensi/ringkasan); keempat uji nonparametrik bisa dijalankan dari Dataset.
- Uji: `python3 tests/make_ref3.py && node tests/nonpar-core.test.js` (galat < 1e-9 terhadap SciPy).

## ANOVA & Regression lanjutan (Tahap 4)

Metode: Uji Lanjut ANOVA (Tukey, Bonferroni, Dunnett, BNT), RAL & RAK, ANOVA Pengukuran Berulang, Regresi Polinomial, Stepwise & Best Subsets, Regresi Logistik.

- `Method/Stat/anova-core.js`: rentang terstudentisasi (Tukey) dan t-multivariat (Dunnett) lewat integrasi Gauss-Legendre, RAL/RAK, ANOVA berulang (Mauchly dengan koreksi orde kedua seperti `mauchly.test` R, Greenhouse-Geisser, Huynh-Feldt), huruf notasi.
- `Method/Stat/reg-core.js`: OLS berbasis QR Householder (stabil), polinomial (x dipusatkan), stepwise/forward/backward, best subsets, logistik biner (IRLS).
- Halaman (semua `StatBasicUI.mountPage`): `ujilanjut.js`, `ralrak.js`, `anovaberulang.js`, `polinomial.js` (ada grafik SVG), `stepwise.js`, `logistik.js`. Kolom pertama = Y pada stepwise & logistik.
- Uji: `python3 tests/make_ref4.py && node tests/anova-core.test.js` dan `python3 tests/make_ref5.py && node tests/reg-core.test.js` (butuh numpy, scipy, pandas, statsmodels, pingouin). Dunnett dibandingkan dengan `scipy.stats.dunnett` yang memakai QMC (toleransi ±3e-3).

## Multivariate, Analisis Butir & Dekomposisi (Tahap 5)

Metode: PCA, Analisis Faktor, Analisis Klaster (hierarki + K-means), Analisis Butir (validitas & Cronbach alpha), Dekomposisi deret waktu.

- `Method/Stat/multi-core.js`: nilai eigen (Jacobi), PCA, KMO & Bartlett, varimax (Kaiser, normalisasi baris), analisis faktor (ekstraksi komponen utama + skor regresi), klaster hierarki (single/complete/average/Ward lewat Lance-Williams), K-means (k-means++, multi-awalan, seed tetap sehingga hasil reproducible), silhouette, analisis butir (alpha, CI Feldt, item-total terkoreksi, split-half), dekomposisi klasik (rata-rata bergerak terpusat) + ramalan dari tren linier.
- `Method/Stat/svg-helpers.js`: grafik SVG (garis, pencar, scree, dendrogram) yang mengikuti tema terang/gelap.
- Halaman (semua `StatBasicUI.mountPage`): `pca.js`, `faktor.js`, `klaster.js`, `butir.js`, `dekomposisi.js`.
- Uji: `python3 tests/make_ref6.py && node tests/multi-core.test.js` (butuh numpy, scipy, scikit-learn, factor_analyzer, pingouin, statsmodels; `make_ref6.py` menambal ketidakcocokan factor_analyzer dengan scikit-learn >= 1.6). Rotasi varimax dibandingkan dengan rotasi referensi yang dijalankan sampai konvergen penuh (galat ~5e-8).

## Control Charts, Quality Tools, DOE & Power (Tahap 6)

Metode: Faktorial 2^k, Peta Kendali (X-bar/R, X-bar/S, I-MR, p, np, c, u), Kapabilitas Proses, Diagram Pareto, Power & Ukuran Sampel, Ukuran Sampel Survei (Slovin/Cochran/Lemeshow).

- `Method/Stat/quality-core.js`: konstanta bagan kendali (d2, d3, c4, A2, A3, D3, D4, B3, B4) **dihitung** dari distribusi rentang normal (bukan tabel), bagan kendali + uji kondisi Test 1-6 + hitung ulang batas, kapabilitas (Cp/Cpk/Pp/Ppk/Cpm, PPM, Z bench, CI), Pareto, faktorial 2^k (efek, ANOVA, galat murni, lack-of-fit, Lenth PSE/ME/SME).
- `Method/Stat/power-core.js`: daya uji t via t non-sentral, ANOVA via F non-sentral (deret Poisson), proporsi (pendekatan normal), pencari n / efek, rumus survei.
- `Method/Stat/svg-helpers.js` ditambah: `controlChart`, `hist`, `pareto`, `effectBars`, `mainEffects`.
- Halaman: `faktorial.js`, `petakendali.js`, `kapabilitas.js`, `pareto.js`, `power.js`, `sampel.js`.
- Catatan id: halaman Stat dekomposisi memakai id `dekomposisi-waktu` karena `dekomposisi` sudah dipakai grafik Decomposition Plot di menu Graph (id view harus unik).
- Uji: `python3 tests/make_ref7.py && node tests/quality-core.test.js`, `python3 tests/make_ref8.py && node tests/power-core.test.js`.

### Menjalankan semua uji numerik
```
for t in basic-core basic-core2 nonpar-core anova-core reg-core multi-core quality-core power-core sem-core tar-core; do node tests/$t.test.js | tail -1; done
```
(file acuan *.json dibuat ulang dengan `python3 tests/make_ref*.py`; butuh numpy, scipy, pandas, statsmodels, scikit-learn, factor_analyzer, pingouin)

## SEM: CB-SEM & PLS-SEM (Tahap 11)

Metode: **SEM** (kategori Multivariate), id `sem`, prefiks elemen `sx` (`sm` sudah dipakai Smoothing).

- Model ditulis dengan sintaks mirip lavaan: `F =~ x1 + x2` (reflektif), `F <~ x1 + x2` (formatif, PLS), `Y ~ F + X` (jalur; konstruk atau variabel teramati), `x1 ~~ x2` (kovarians galat), `#` komentar. Nama indikator = judul kolom tabel.
- `Method/Stat/sem-core.js` (tanpa DOM, bisa diuji di Node):
  - `parseModel`: parser + validasi (indikator tidak ada, indikator ganda, nama laten bentrok dengan kolom, dll.).
  - `fitCB`: CB-SEM maximum likelihood, model umum bentuk RAM, Gauss-Newton/Levenberg-Marquardt dengan turunan analitik, SE dari informasi Fisher, solusi terstandar + SE (delta method), efek langsung/tidak langsung/total, kecocokan model (chi-square, RMSEA + CI 90% + p-close, CFI, TLI, NFI, GFI, AGFI, SRMR, AIC, BIC), residual korelasi terbesar, peringatan (Heywood, korelasi > 1, tidak konvergen, tidak teridentifikasi). Konvensi lavaan: S dibagi N, chi2 = N x F_ML. Variabel teramati eksogen: varians/kovarians bebas (db sama dengan lavaan `fixed.x`). Konstruk berindikator tunggal: loading 1 dan galat 0.
  - `fitPLS`: algoritma Lohmoller (skema jalur / centroid / faktorial; mode A dan B), loading, bobot, jalur, R2 (+ adjusted), f2, VIF, Cronbach alpha, rho_A, CR, AVE, Fornell-Larcker, HTMT, cross-loading, efek tidak langsung/total, bootstrap (seed tetap, SE, t, p dengan db n-1, CI persentil 95%, tanda skor diselaraskan).
- `Method/Stat/sem.js`: halaman (`StatBasicUI.mountPage`); pilihan estimator, skala laten (CB), skema bobot dan jumlah bootstrap (PLS). Bisa dijalankan dari Dataset.
  - CB-SEM tambahan: bootstrap resampel kasus (`boot`, SE + CI persentil/BC), modification indices + EPC (uji skor), `compareCB` (uji selisih chi-square antar model bersarang).
  - **Estimator robust MLR** (`fitCB(spec, X, { estimator: 'mlr' })`): estimasi parameter = ML; galat baku sandwich Huber-White `(1/N) A^-1 M A^-1` (A informasi Fisher ekspektasi, M kovarians skor kasus), faktor skala `c = tr(U Gamma)/db` (bentuk Satorra-Bentler, Gamma = kovarians sampel vech(zz'), pembagi N) sehingga chi-square terskala = chi2/c, indeks "terskala" dan "robust" (Brosseau-Liard & Savalei 2014: RMSEA, CFI, TLI + CI RMSEA) berikut faktor skala model independen. Hasil di `out.robust`; `params[].se/z/p` berisi nilai robust dan `params[].seML` SE ML. `compareCB` memakai selisih chi-square terskala Satorra-Bentler (2001) bila kedua model MLR (galat bila estimator berbeda; peringatan bila c_d <= 0). Catatan: memakai informasi ekspektasi (lavaan/Mplus memakai informasi observasi untuk MLR pada beberapa kasus) dan faktor skala bentuk Satorra-Bentler, bukan Yuan-Bentler Mplus persis; selisihnya berorde 1/N. MI, bootstrap, dan chi-square ML tetap berbasis teori normal.
  - **Uji normalitas multivariat Mardia** (`SE.mardia(X, names)`): skewness b1p (statistik n*k*b1p/6, koreksi sampel kecil Mardia 1974) dan kurtosis b2p (z), kurtosis relatif, skewness/kurtosis berlebih per variabel, jarak Mahalanobis maksimum dan jumlah pencilan (p < 0,001). Ditampilkan di keluaran CB-SEM (dengan saran MLR bila menyimpang) dan PLS-SEM (informasi saja).
  - **PLS-SEM: Q² blindfolding** (`fitPLS(spec, ds, { blind: D })` -> `res.blind`): sel (i, k) dihilangkan pada putaran g bila `(i + k) mod D = g` (pola diagonal; tiap sel hilang sekali), diganti rata-rata sel tersisa, model diestimasi ulang, sel hilang diprediksi. Cross-validated communality `x^ = mean + sd*lambda*Y_j` (reflektif multi-indikator) dan redundancy `x^ = mean + sd*lambda*sum(beta*Y_pendahulu)` (endogen reflektif / indikator tunggal); `Q2 = 1 - SSE/SSO`. Konstruk formatif multi-indikator dilewati. Deterministik (tanpa acak).
  - **PLSpredict** (`fitPLS(spec, ds, { predict: { folds, reps, technique: 'direct'|'earliest', seed } })` -> `res.predict`): validasi silang k-lipatan berulang (Shmueli dkk. 2016/2019); RMSE, MAE, Q2predict (benchmark = rata-rata data latih) per indikator endogen, dibandingkan dengan benchmark regresi linear (LM). `direct` (DA) = skor pendahulu langsung dari indikator lipatan uji; `earliest` (EA) = prediksi berantai dari konstruk eksogen saja (LM memakai indikator pendahulu langsung / eksogen leluhur). Ringkasan per konstruk: seluruh / mayoritas / minoritas / tak satu pun indikator dengan RMSE PLS < LM -> tinggi / sedang / rendah / tidak ada (dan Q2predict > 0 diperlukan). Lipatan dibentuk dengan PRNG ber-seed (reproducible).
- Belum ada: model multigrup, mean structure, data kategorik/ordinal (WLSMV), q² (ukuran efek Q²) per jalur, model orde dua, Bollen-Stine, uji selisih terskala "strictly positive" (2010).
- Uji: `python3 tests/make_ref9.py && python3 tests/make_ref10.py && node tests/sem-core.test.js` (make_ref9: numpy, pandas, semopy, plspm; make_ref10: numpy, scipy saja). `make_ref10.py` = acuan MLR + Mardia independen (optimasi scipy, turunan numerik, matriks duplikasi eksplisit; SE ML/robust, c, c baseline, chi-square terskala, Mardia: cocok ~1e-8), ditambah uji Monte Carlo seed tetap (data t5, N = 250: chi-square ML menggelembung, tolak ML ~42% vs terskala ~4%). Belum divalidasi langsung terhadap lavaan/Mplus (R tidak tersedia di lingkungan pengembangan). CB-SEM dibandingkan dengan angka terbit lavaan pada data Political Democracy (chi2 38,125, db 35, RMSEA 0,035, CFI 0,995, SRMR 0,044, dll.) dan semopy (estimasi, terstandar, chi2 galat < 1e-4); PLS-SEM dengan plspm (loading, jalur, R2 galat ~1e-12 untuk ketiga skema; bobot plspm dikali sqrt(n/(n-1))). Catatan: plspm perlu data yang sudah dibakukan dan `scaled=False`; `scaled=True` memakai penskalaan nonmetrik.
- Uji Q² dan PLSpredict: `python3 tests/make_ref11.py && node tests/sem-pls-predict.test.js` (make_ref11 hanya butuh numpy). Acuan = implementasi PLS numpy dari nol (bobot awal 1, LM dengan `lstsq` pada data mentah, lipatan identik lewat port PRNG mulberry32); selisih dengan JS ~1e-12. Ditambah sifat teoretis: data noise murni -> Q2 rata-rata <= 0, efek kuat -> Q2 > 0.

## Pita grafik pendukung di halaman Stat (`Method/Shared/export-hasil.js`)

Grafik pendukung kini berada di tab **Grafik** pada kartu hasil tiap metode (tab dibuat otomatis bila belum ada; `Method/Shared/tab-grafik.js`), lengkap dengan pita dan tombol PNG/SVG/Salin per grafik. Grafik yang dulu ikut di tab Ringkasan (TAR, PCA, Klaster, Peta Kendali, SEM, dst.) juga dipindah ke tab ini. Panel **Ekspor** hanya berisi tombol **Unduh Hasil (.docx)**, **Unduh semua grafik (.zip)**, dan **Bagikan**. Pita grafik pendukung punya lima tab: **Teks** (judul, label sumbu X/Y, tampil/sembunyi judul-label-legenda, ukuran huruf), **Elemen** (ukuran titik, tebal garis, lebar batang, kepekatan, label nilai batang, garis acuan, garis regresi/acuan, kurva normal, penanda garis), **Sumbu** (Y/X minimum-maksimum, tinggi grafik), **Warna**, **Garis kisi**.

- **Satu pita per grafik**: tiap grafik punya bilah (PNG/SVG/Salin + tombol **Edit grafik**) dan pita sendiri, dibuat saat pertama dibuka. **Isi pita mengikuti jenis grafik itu**: pengaturan yang tidak berlaku disembunyikan, termasuk tab yang kosong (mis. histogram tidak punya "Ukuran titik"; boxplot tidak punya tab Elemen). Diagram jalur SEM dan grafik berbentuk gambar jadi tidak punya tombol Edit grafik.
- Jenis grafik dicatat `StatCharts` (`StatCharts.kind.last`); tabel kemampuan per jenis ada di `CAPS` (`export-hasil.js`). Grafik buatan halaman sendiri (bukan lewat `StatCharts`, mis. kontur/3D RSM, ramalan ARIMA) diuji otomatis (`probeCaps`): hanya kontrol yang benar-benar mengubah gambarnya yang ditampilkan. Grafik yang dikirim sebagai `svg` jadi tidak bisa diatur dan pita menjelaskannya.
- Gaya diteruskan lewat `GraphCore.u.ST` (bidang baru: `title, xl, yl, legend, fs, pt, lw, bw, alpha, vals, hl, fit, curve, mk, H, xmin, xmax, ymin, ymax`; nilai bawaan tidak mengubah grafik halaman Graph). Judul/label/tinggi diterapkan terpusat di `u.layout/head/gridY/axisX/axisCat`.
- Menambah jenis grafik baru di `stat-charts.js`: bungkus dengan `wrap('nama', fn, indeksArgumenOpsi)`, baca pengaturan lewat `PS()/LW()/BW()/AL()/ov()`, lalu daftarkan kemampuannya di `CAPS` dan namanya di `KIND_LABEL`.
- Catatan: `svg-helpers.js` (`StatSvg`: scree PCA, dendrogram, peta kendali, dll.) memakai variabel CSS tema dan tidak lewat pita ini; grafik itu tampil di dalam hasil, bukan di panel Grafik Pendukung.

## TAR: TAR Konvensional, SETAR & STAR (Tahap 12)

Metode: **TAR** (kategori Time Series), id `tar`, prefiks elemen `tr`. Satu halaman, tiga model (pilihan *Model*):

| Model | Variabel ambang / peralihan | Rezim |
|---|---|---|
| TAR konvensional (Tong, 1978) | kolom **Z** eksternal, Z(t-d) (kolom ke-2 tabel) | 2 atau 3, orde AR boleh beda per rezim |
| SETAR (self-exciting) | lag Y sendiri, Y(t-d) | 2 atau 3, orde AR boleh beda per rezim |
| STAR | lag Y sendiri, dibakukan dengan simpangan baku sampel | peralihan mulus: LSTAR (logistik) atau ESTAR (eksponensial), otomatis lewat aturan Terasvirta |

- `Method/Stat/tar-core.js` (tanpa DOM, bisa diuji di Node, mengekspor `window.StatTAR`):
  - `fitTAR`: kuadrat terkecil bersyarat. Grid menyeluruh atas nilai ambang teramati (tiap rezim >= trimming x T dan >= k + 2 pengamatan; kandidat dikurangi merata bila > 500 untuk 2 rezim atau > 45 untuk 3 rezim, dengan catatan di hasil). Delay `d` dipilih dengan SSE terkecil bila 0 (sampel efektif sama untuk semua d). Koefisien, SE, t, p per rezim; AIC/BIC (ambang dihitung sebagai parameter); pembanding AR(p maks) linier pada sampel yang sama; profil SSE dan **selang kepercayaan ambang Hansen (1997)** (2 rezim, nilai kritis 7,352); uji **Tsay (1989)** (arranged autoregression, residu prediksi rekursif); uji **sup-F Hansen** dengan bootstrap regresor tetap (AR(p maks) vs TAR 2 rezim, sup atas d bila otomatis, seed tetap); Ljung-Box (residu dan residu kuadrat) dan Jarque-Bera; ramalan skeleton + simulasi bootstrap residu per rezim (rata-rata, selang 95%). Untuk TAR konvensional ramalan dibatasi sampai d langkah karena Z masa depan tidak diketahui.
  - `fitSTAR`: uji linearitas **Terasvirta (1994)** (versi F, hampiran Taylor orde 3, deret H04/H03/H02) untuk tiap delay; delay otomatis = p-value umum terkecil; LSTAR vs ESTAR lewat aturan H03. NLS dengan parameter linier dikonsentrasikan (grid gamma x c, Nelder-Mead dari 3 titik awal, c dibatasi di kuantil 5%-95%); SE dari Jacobian analitik (J'J)^-1 s^2, termasuk SE untuk phi + theta; ramalan skeleton + simulasi.
  - Penetapan `gamma` memakai skala terstandar: G = 1/(1+exp(-gamma (s-c)/sd_s)) (LSTAR), G = 1-exp(-gamma (s-c)^2/sd_s^2) (ESTAR). `c` dilaporkan dalam satuan asli.
- `Method/Stat/tar.js`: halaman (`StatBasicUI.mountPage`) dengan grafik SVG (data/fit/ramalan, deret menurut rezim, profil SSE, fungsi peralihan G, residu), tabel, langkah perhitungan, dan interpretasi. Bisa dijalankan dari Dataset (kolom 1 = Y, kolom 2 = Z untuk TAR konvensional).
- Belum ada: pemilihan orde p otomatis, uji 2 vs 3 rezim, STAR dengan variabel peralihan eksternal atau lebih dari dua rezim (MSTAR), TAR dengan ambang yang melibatkan kombinasi lag, ramalan TAR konvensional dengan Z yang diramalkan.
- Uji: `python3 tests/make_ref12.py && node tests/tar-core.test.js` (acuan independen: brute force `np.linalg.lstsq` atas semua ambang, uji Tsay dengan refit eksplisit, STAR dengan `scipy.optimize.least_squares` multi-start berbatas + Jacobian numerik). Galat SETAR/TAR ~1e-15, STAR ~1e-6 (toleransi optimizer). Selain itu diperiksa secara simulasi: ukuran uji sup-F bootstrap 4,2% pada nominal 5% (120 deret AR(1), n = 150, B = 199) dengan daya 100% pada data SETAR.
