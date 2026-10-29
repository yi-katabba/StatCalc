# Response Surface Methodology (RSM)

| File | Isi |
|---|---|
| `rsm-core.js` | Inti hitung tanpa DOM (bisa dites di Node): OLS, ANOVA, lack of fit, R² pred (PRESS), VIF, koefisien terkode & satuan asli, titik stasioner + eigen (Jacobi), optimasi, CI/PI. Divalidasi terhadap numpy/scipy. |
| `rsm.js` | Halaman `#view-rsm`: tabel input, tab hasil (termasuk tab Interpretasi naratif), grafik kontur/3D (SVG, 3D bisa diputar dengan seret/slider), optimasi, diagnostik, ekspor .docx. |

Terhubung ke: `index.html` (halaman, menu METHODS, script), `Shared/impor-data.js` (tempel/unggah),
`Calc/sheet.js` (Kirim ke RSM), `Materi/materi.js` + `Materi/data/rsm.js` (materi & tautan).
Contoh data bawaan: CCD face-centered 3 faktor (Waktu, Konsentrasi, pH) -> Degradasi (%), 20 run.
