/* Materi: Response Surface Methodology (terhubung ke Method/Stat/rsm.js). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'rsm', order: 8, method: 'rsm', tone: 'green',
    title: 'Response Surface Methodology', subtitle: 'RSM, Kontur & Optimasi',
    desc: 'Memodelkan dan mengoptimalkan respon dengan polinomial orde dua: rancangan CCD/Box-Behnken, pengodean, ANOVA, lack of fit, titik stasioner, dan optimasi.',
    keywords: ['rsm', 'response surface', 'permukaan respon', 'ccd', 'central composite', 'box-behnken', 'kuadratik', 'kontur', 'optimasi', 'lack of fit', 'galat murni', 'titik stasioner', 'kanonik', 'eigen', 'pengodean', 'degradasi', 'kimia', 'adequate precision', 'press', 'prediksi', 'interval prediksi'],
    icon: '<path d="M3 18c3-1 5-6 9-6s6 5 9 6"/><path d="M6 14c2-1 3-4 6-4s4 3 6 4"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dasar RSM',
        html: String.raw`
<p><strong>Response Surface Methodology (RSM)</strong> adalah kumpulan teknik statistik dan matematika untuk memodelkan hubungan antara satu <em>respon</em> $y$ dengan beberapa <em>faktor</em> (prediktor) $x_1, x_2, \dots, x_k$, lalu mencari kombinasi faktor yang menghasilkan respon terbaik (maksimum, minimum, atau mendekati target).</p>
<p>Di bidang kimia, RSM dipakai misalnya untuk mengoptimalkan <strong>persentase degradasi</strong> zat warna (respon) terhadap <strong>waktu kontak</strong>, <strong>konsentrasi</strong> awal, dan <strong>pH</strong> (faktor). Alih-alih mengubah satu faktor sekali waktu (OFAT), RSM mengubah semua faktor sekaligus menurut rancangan percobaan sehingga efek utama, interaksi, dan kelengkungan dapat ditaksir dengan jumlah percobaan yang sedikit.</p>
<div class="mt-box note" data-label="Mengapa orde dua?">
  <p>Dekat titik optimum, respon biasanya melengkung (naik lalu turun), sehingga model linear tidak cukup. Model polinomial orde dua menangkap kelengkungan itu dan cukup fleksibel untuk sebagian besar kasus praktis.</p>
</div>
<div class="mt-box def" data-label="Model orde dua">
  $$y = \beta_0 + \sum_{i=1}^{k}\beta_i x_i + \sum_{i=1}^{k}\beta_{ii}x_i^2 + \sum_{i\lt j}\beta_{ij}x_i x_j + \varepsilon$$
  <p>$\beta_i$: efek linear, $\beta_{ii}$: efek kuadratik (kelengkungan), $\beta_{ij}$: interaksi dua faktor, $\varepsilon$: galat acak.</p>
</div>
<p>Jumlah suku model adalah $p = 1 + 2k + \dfrac{k(k-1)}{2}$. Untuk $k=2,3,4$ berturut-turut $p = 6, 10, 15$, sehingga jumlah percobaan harus lebih besar dari $p$.</p>`
      },
      {
        id: 'rancangan', title: 'Rancangan percobaan (CCD & Box-Behnken)',
        html: String.raw`
<p>Model kuadratik membutuhkan setiap faktor diuji pada <strong>minimal tiga level</strong>. Dua rancangan yang paling umum:</p>
<div class="mt-tw"><table>
<thead><tr><th>Rancangan</th><th>Komposisi titik</th><th>Jumlah run ($k=3$)</th></tr></thead>
<tbody>
<tr><td><strong>Central Composite Design (CCD)</strong></td><td>Titik faktorial $2^k$ + titik aksial $2k$ (pada jarak $\alpha$) + ulangan titik pusat $n_0$</td><td>$8+6+n_0$, mis. 20 dengan $n_0=6$</td></tr>
<tr><td><strong>Box-Behnken (BBD)</strong></td><td>Titik di tengah rusuk kubus + ulangan titik pusat; tanpa titik di sudut</td><td>$12+n_0$, mis. 15 dengan $n_0=3$</td></tr>
</tbody></table></div>
<ul>
  <li><strong>Face-centered CCD</strong> ($\alpha = 1$) hanya memakai 3 level per faktor sehingga praktis di laboratorium.</li>
  <li><strong>Ulangan titik pusat</strong> memberi taksiran galat murni (<em>pure error</em>) yang dibutuhkan uji lack of fit.</li>
  <li>Urutan percobaan sebaiknya diacak untuk menghindari bias akibat waktu atau kondisi lingkungan.</li>
</ul>
<div class="mt-box ex" data-label="Contoh kasus kimia">
  <p>Degradasi zat warna (%) dengan 3 faktor: waktu (30, 60, 90 menit), konsentrasi (10, 20, 30 mg/L), dan pH (3, 6, 9). Face-centered CCD terdiri dari 8 titik faktorial, 6 titik aksial, dan 6 ulangan titik pusat, total 20 percobaan. Tombol <em>Isi contoh data</em> pada halaman RSM memuat data ini.</p>
</div>`
      },
      {
        id: 'pengodean', title: 'Pengodean variabel',
        html: String.raw`
<p>Faktor bersatuan berbeda (menit, mg/L, pH) tidak dapat dibandingkan langsung. Karena itu faktor dikodekan ke skala $-1$ sampai $+1$:</p>
$$x_i = \dfrac{X_i - X_{i,\text{pusat}}}{\Delta_i}, \qquad X_{i,\text{pusat}} = \dfrac{X_{\max}+X_{\min}}{2},\quad \Delta_i = \dfrac{X_{\max}-X_{\min}}{2}$$
<p>Dengan skala ini, koefisien dapat dibandingkan antar faktor, matriks $\mathbf{X}^\top\mathbf{X}$ lebih stabil secara numerik, dan kolinearitas antara suku linear dan kuadrat berkurang. StatCalc mengodekan data otomatis dari nilai minimum dan maksimum tiap faktor, lalu juga menyajikan persamaan akhir dalam satuan asli.</p>
<div class="mt-box warn" data-label="Perhatian">
  <p>Karena pengodean memakai rentang data, nilai minimum dan maksimum yang Anda masukkan menentukan arti kode $\pm1$. Pastikan rentang itu memang daerah percobaan yang Anda rancang.</p>
</div>`
      },
      {
        id: 'estimasi', title: 'Estimasi koefisien',
        html: String.raw`
<p>Koefisien ditaksir dengan kuadrat terkecil biasa (OLS). Dengan $\mathbf{X}$ matriks rancangan ($n \times p$) dan $\mathbf{y}$ vektor respon:</p>
$$\mathbf{b} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}, \qquad \hat{\mathbf{y}} = \mathbf{X}\mathbf{b}$$
$$\operatorname{SE}(b_j) = \sqrt{\text{KTG}\,\big[(\mathbf{X}^\top\mathbf{X})^{-1}\big]_{jj}}, \qquad t_j = \dfrac{b_j}{\operatorname{SE}(b_j)}\sim t_{n-p}$$
<p>Setiap koefisien diuji dengan $H_0:\beta_j = 0$. Untuk membaca hasilnya: koefisien positif berarti menaikkan faktor menaikkan respon, dan koefisien $\beta_{ii}$ negatif berarti respon melengkung ke bawah (ada puncak).</p>
<p>Tabel koefisien juga memuat <strong>VIF</strong> (<em>variance inflation factor</em>) untuk memeriksa kolinearitas antar suku; nilai di atas 10 mengkhawatirkan. Pada rancangan CCD/BBD yang baik, VIF mendekati 1.</p>`
      },
      {
        id: 'anova-rsm', title: 'ANOVA model RSM',
        html: String.raw`
<p>Variasi total respon dipecah menjadi bagian yang dijelaskan model dan galat:</p>
$$\text{JKT} = \text{JKM} + \text{JKG}, \qquad \text{JKT}=\sum (y_i-\bar{y})^2,\quad \text{JKG}=\sum (y_i-\hat{y}_i)^2$$
$$F = \dfrac{\text{KTM}}{\text{KTG}} = \dfrac{\text{JKM}/(p-1)}{\text{JKG}/(n-p)}$$
<div class="mt-box def" data-label="Hipotesis uji model">
  <p>$H_0: \beta_1=\beta_2=\dots=\beta_{ij}=0$ (semua koefisien selain konstanta nol)</p>
  <p>$H_1:$ minimal satu koefisien tidak nol</p>
</div>
<p>Baris <em>Linear</em>, <em>Kuadrat</em>, dan <em>Interaksi</em> pada tabel ANOVA memakai jumlah kuadrat terkoreksi: kenaikan JKG bila seluruh suku kelompok itu dibuang dari model. Cara ini menunjukkan jenis suku mana yang menyumbang paling besar.</p>
<h4>Ukuran kecocokan</h4>
$$R^2 = \dfrac{\text{JKM}}{\text{JKT}},\qquad R^2_{\text{adj}} = 1-\dfrac{\text{JKG}/(n-p)}{\text{JKT}/(n-1)},\qquad R^2_{\text{pred}} = 1-\dfrac{\text{PRESS}}{\text{JKT}}$$
<p>$\text{PRESS}=\sum \big(e_i/(1-h_{ii})\big)^2$ adalah jumlah kuadrat galat prediksi bila tiap pengamatan dikeluarkan satu per satu (<em>leave-one-out</em>); $h_{ii}$ adalah leverage. $R^2_{\text{pred}}$ mengukur kemampuan model memprediksi data baru.</p>
<div class="mt-box key" data-label="Aturan praktis kecukupan">
  <p>Model dianggap memadai bila: model signifikan, lack of fit tidak signifikan, selisih $R^2_{\text{adj}}-R^2_{\text{pred}} \lt 0{,}2$, dan <em>adequate precision</em> $\gt 4$.</p>
</div>
$$\text{Adequate precision} = \dfrac{\max(\hat{y})-\min(\hat{y})}{\sqrt{p\,\text{KTG}/n}}$$
<p>Adequate precision adalah rasio sinyal terhadap derau. Nilai di atas 4 menandakan sinyal cukup untuk menjelajahi ruang rancangan.</p>`
      },
      {
        id: 'lack-of-fit', title: 'Uji lack of fit',
        html: String.raw`
<p>Galat model (JKG) berasal dari dua sumber: variasi acak murni dan ketidaksesuaian bentuk model. Bila ada ulangan pada titik rancangan yang sama (umumnya titik pusat), keduanya dapat dipisah:</p>
$$\text{JKG} = \text{JKGM} + \text{JKLOF}$$
$$\text{JKGM}=\sum_{\text{titik}}\sum (y-\bar{y}_{\text{titik}})^2,\quad \text{db}_{GM}=n-m,\qquad \text{db}_{LOF}=m-p$$
$$F_{LOF} = \dfrac{\text{JKLOF}/(m-p)}{\text{JKGM}/(n-m)}$$
<p>dengan $m$ banyaknya titik rancangan yang berbeda.</p>
<div class="mt-box def" data-label="Hipotesis lack of fit">
  <p>$H_0:$ model sesuai dengan data (tidak ada lack of fit)</p>
  <p>$H_1:$ model tidak sesuai</p>
</div>
<p>Dalam RSM kita <strong>berharap tidak menolak $H_0$</strong> (p-value $\ge 0{,}05$). Lack of fit yang signifikan berarti galat model jauh lebih besar daripada galat acak murni, yaitu model orde dua belum cukup menggambarkan permukaan respon. Solusinya antara lain menambah suku orde lebih tinggi, mentransformasi respon, mempersempit daerah percobaan, atau memeriksa pencilan.</p>
<div class="mt-box warn" data-label="Tanpa ulangan">
  <p>Tanpa ulangan titik pusat, derajat bebas galat murni adalah nol sehingga uji ini tidak dapat dihitung. Selalu sertakan 3 sampai 6 ulangan titik pusat dalam rancangan.</p>
</div>`
      },
      {
        id: 'pemilihan-model', title: 'Memilih orde model',
        html: String.raw`
<p>Sebelum menerima model kuadratik, periksa apakah suku tambahan memang bermanfaat. Cara umumnya adalah uji sekuensial: bandingkan model yang lebih sederhana dengan yang lebih kompleks.</p>
$$F_{\text{seq}} = \dfrac{(\text{JKG}_{\text{sederhana}}-\text{JKG}_{\text{kompleks}})/\Delta p}{\text{KTG}_{\text{kompleks}}}$$
<ol class="mt-steps">
  <li>Mulai dari model linear. Bila R&sup2; kecil dan lack of fit signifikan, tambahkan interaksi.</li>
  <li>Tambahkan suku kuadrat. Bila uji sekuensial signifikan, kelengkungan nyata.</li>
  <li>Pilih model <strong>berorde terendah</strong> yang signifikan secara sekuensial, tanpa lack of fit signifikan, dengan $R^2_{\text{pred}}$ tinggi.</li>
</ol>
<p>Tabel <em>Perbandingan Model</em> di tab Model &amp; ANOVA menyajikan nilai-nilai ini dan menandai model dengan $R^2_{\text{pred}}$ tertinggi.</p>`
      },
      {
        id: 'kanonik', title: 'Titik stasioner & analisis kanonik',
        html: String.raw`
<p>Tulis model kuadratik dalam bentuk matriks: $\hat{y} = b_0 + \mathbf{x}^\top\mathbf{b} + \mathbf{x}^\top\mathbf{B}\,\mathbf{x}$, dengan $\mathbf{b}$ vektor koefisien linear dan $\mathbf{B}$ matriks simetris ($b_{ii}$ di diagonal, $b_{ij}/2$ di luar diagonal).</p>
<div class="mt-box def" data-label="Titik stasioner">
  $$\mathbf{x}_s = -\dfrac{1}{2}\mathbf{B}^{-1}\mathbf{b}, \qquad \hat{y}_s = b_0 + \dfrac{1}{2}\mathbf{x}_s^\top\mathbf{b}$$
</div>
<p>Sifat titik stasioner ditentukan oleh <strong>nilai eigen</strong> $\lambda_1,\dots,\lambda_k$ matriks $\mathbf{B}$:</p>
<div class="mt-tw"><table>
<thead><tr><th>Nilai eigen</th><th>Jenis titik</th><th>Arti</th></tr></thead>
<tbody>
<tr><td>semua $\lambda \lt 0$</td><td>Maksimum</td><td>respon turun ke segala arah dari titik ini</td></tr>
<tr><td>semua $\lambda \gt 0$</td><td>Minimum</td><td>respon naik ke segala arah</td></tr>
<tr><td>tanda berbeda</td><td>Titik pelana</td><td>naik pada satu arah, turun pada arah lain</td></tr>
<tr><td>ada $\lambda \approx 0$</td><td>Punggungan</td><td>respon hampir datar pada satu arah; optimum tidak tunggal</td></tr>
</tbody></table></div>
<p>Bila $\mathbf{x}_s$ jatuh di luar daerah percobaan ($|x_i|\gt 1$ pada CCD face-centered), prediksinya adalah ekstrapolasi dan tidak boleh dipercaya begitu saja; lakukan percobaan lanjutan ke arah itu atau cari optimum terbatas di dalam daerah percobaan.</p>
<p>Bentuk kanonik $\hat{y} = \hat{y}_s + \sum_i \lambda_i w_i^2$ ($w$ = sumbu utama setelah rotasi) menunjukkan seberapa cepat respon turun atau naik pada tiap sumbu: nilai $|\lambda_i|$ besar berarti respon sangat sensitif pada arah itu.</p>`
      },
      {
        id: 'optimasi', title: 'Optimasi & prediksi',
        html: String.raw`
<p>Bila titik stasioner di luar daerah percobaan atau berupa titik pelana, optimum dicari pada <strong>daerah terbatas</strong> (batas bawah dan atas tiap faktor). StatCalc memakai pencarian grid yang dilanjutkan pencarian lokal untuk tiga tujuan:</p>
<ul>
  <li><strong>Maksimalkan</strong> respon (mis. persen degradasi setinggi mungkin).</li>
  <li><strong>Minimalkan</strong> respon (mis. residu atau biaya).</li>
  <li><strong>Target</strong>: meminimalkan $(\hat{y}-T)^2$ agar respon mendekati nilai $T$.</li>
</ul>
<h4>Selang pada titik $\mathbf{x}_0$</h4>
$$\text{CI: } \hat{y}_0 \pm t_{\alpha/2,\,n-p}\sqrt{\text{KTG}\;\mathbf{x}_0^\top(\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{x}_0}$$
$$\text{PI: } \hat{y}_0 \pm t_{\alpha/2,\,n-p}\sqrt{\text{KTG}\;\big(1+\mathbf{x}_0^\top(\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{x}_0\big)}$$
<p><strong>CI</strong> adalah selang kepercayaan untuk <em>rata-rata</em> respon pada kondisi $\mathbf{x}_0$; <strong>PI</strong> adalah selang prediksi untuk <em>satu hasil percobaan baru</em> dan selalu lebih lebar. Nilai observasi pada percobaan konfirmasi sebaiknya jatuh dalam PI.</p>
<div class="mt-box key" data-label="Percobaan konfirmasi">
  <p>Optimum model hanyalah prediksi. Lakukan 2 sampai 3 percobaan konfirmasi pada kondisi optimum dan bandingkan hasilnya dengan prediksi dan PI.</p>
</div>`
      },
      {
        id: 'grafik', title: 'Membaca plot kontur & permukaan 3D',
        html: String.raw`
<p><strong>Plot kontur</strong> memperlihatkan permukaan respon dari atas: garis kontur menghubungkan titik berrespon sama. Dua faktor ditampilkan pada sumbu, faktor lain dipegang tetap (biasanya di nilai pusat atau kondisi optimum).</p>
<ul>
  <li>Kontur berbentuk elips tertutup: ada puncak atau lembah di dalam daerah itu.</li>
  <li>Kontur hampir lurus dan sejajar: respon didominasi efek linear, tidak ada optimum di dalam daerah.</li>
  <li>Kontur berbentuk hiperbola: titik pelana.</li>
  <li>Elips miring terhadap sumbu: ada interaksi antara kedua faktor.</li>
  <li>Kontur yang rapat berarti respon berubah cepat.</li>
</ul>
<p><strong>Permukaan 3D</strong> menyajikan informasi yang sama dalam bentuk tiga dimensi. <strong>Plot perturbasi</strong> membandingkan pengaruh tiap faktor sekaligus bila diubah dari titik acuan: kurva yang curam menandakan faktor yang sangat berpengaruh dan kurva yang melengkung menandakan efek kuadratik.</p>`
      },
      {
        id: 'diagnostik', title: 'Diagnostik residual',
        html: String.raw`
<p>Kesimpulan ANOVA hanya sahih bila asumsi galat terpenuhi: galat independen, berdistribusi normal, dan ragamnya konstan.</p>
<div class="mt-tw"><table>
<thead><tr><th>Pemeriksaan</th><th>Alat</th><th>Yang diharapkan</th></tr></thead>
<tbody>
<tr><td>Normalitas</td><td>Q-Q plot, histogram residual</td><td>titik mengikuti garis lurus</td></tr>
<tr><td>Ragam konstan</td><td>Residual vs prediksi</td><td>sebaran acak, tanpa corong atau lengkung</td></tr>
<tr><td>Independensi</td><td>Residual vs urutan run</td><td>tanpa pola atau tren</td></tr>
<tr><td>Ketepatan prediksi</td><td>Aktual vs prediksi</td><td>titik dekat garis $y=x$</td></tr>
<tr><td>Pencilan &amp; pengaruh</td><td>Residual baku, leverage, Cook&rsquo;s D</td><td>$|r_i|\lt 2$, $h_{ii}\lt 2p/n$, $D_i\lt 1$</td></tr>
</tbody></table></div>
$$r_i = \dfrac{e_i}{\sqrt{\text{KTG}\,(1-h_{ii})}},\qquad D_i = \dfrac{r_i^2}{p}\cdot\dfrac{h_{ii}}{1-h_{ii}}$$
<p>Jika ragam tidak konstan, pertimbangkan transformasi respon (mis. logaritma atau akar kuadrat). Jika ada pencilan, periksa dahulu apakah terjadi kesalahan pencatatan atau percobaan sebelum membuangnya.</p>`
      },
      {
        id: 'langkah', title: 'Alur analisis RSM di StatCalc',
        html: String.raw`
<ol class="mt-steps">
  <li>Pilih jumlah faktor dan bentuk model (disarankan kuadratik penuh), lalu buat tabel.</li>
  <li>Masukkan data percobaan: kolom faktor dalam satuan asli, kolom terakhir respon. Anda juga dapat menempel dari Excel, mengunggah file, atau mengirim dari Dataset.</li>
  <li>Periksa tab <strong>Model &amp; ANOVA</strong>: model signifikan, lack of fit tidak signifikan, $R^2_{\text{pred}}$ wajar.</li>
  <li>Lihat <strong>Koefisien &amp; Persamaan</strong> untuk suku yang berpengaruh.</li>
  <li>Telusuri <strong>Grafik Respon</strong> (kontur, 3D) untuk memahami bentuk permukaan.</li>
  <li>Gunakan <strong>Optimasi</strong> untuk menemukan kondisi terbaik dan memprediksi respon dengan CI/PI.</li>
  <li>Cek <strong>Diagnostik</strong> untuk memastikan asumsi terpenuhi, lalu unduh laporan .docx.</li>
</ol>
<div class="mt-box ex" data-label="Contoh hasil (data contoh)">
  <p>Pada data contoh degradasi (20 percobaan), model kuadratik menghasilkan R&sup2; sekitar 0,998 dan R&sup2; prediksi sekitar 0,987, dengan lack of fit tidak signifikan. Degradasi tertinggi (sekitar 87%) dicapai pada waktu mendekati 78 menit, konsentrasi sekitar 11 mg/L, dan pH sekitar 6,7.</p>
</div>`
      },
    ],
  });
})();
