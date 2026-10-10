/* Materi: Regresi Linear (terhubung ke Method/Stat/regresi.js). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'regresi', order: 3, method: 'regresi', tone: 'navy',
    title: 'Regresi Linear', subtitle: 'Sederhana & Berganda',
    desc: 'Model, penaksiran kuadrat terkecil, R², uji F dan uji t, serta uji asumsi klasik: normalitas (Jarque-Bera, Shapiro-Wilk, Kolmogorov-Smirnov), multikolinearitas (VIF, korelasi antar X, Condition Index), heteroskedastisitas (Glejser, Breusch-Pagan, White), dan autokorelasi (Durbin-Watson, Breusch-Godfrey, Runs).',
    keywords: ['regresi', 'OLS', 'kuadrat terkecil', 'koefisien', 'slope', 'intercept', 'R2', 'determinasi', 'adjusted', 'uji F', 'uji t', 'Jarque-Bera', 'Shapiro-Wilk', 'Kolmogorov-Smirnov', 'Lilliefors', 'normalitas', 'Breusch-Pagan', 'White', 'uji White', 'homoskedastisitas', 'VIF', 'multikolinearitas', 'Glejser', 'heteroskedastisitas', 'Durbin-Watson', 'Breusch-Godfrey', 'Runs', 'Condition Index', 'korelasi antar X', 'autokorelasi', 'residual', 'asumsi klasik', 'korelasi'],
    icon: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dan model',
        html: String.raw`
<p>Regresi linear memodelkan hubungan antara satu variabel terikat $Y$ (yang dijelaskan) dengan satu atau lebih variabel bebas $X$ (penjelas), lalu memakai model itu untuk menjelaskan dan memprediksi.</p>
<div class="mt-box def" data-label="Model">
  <p><strong>Regresi linear sederhana</strong> (satu $X$):</p>
  $$Y_i = \beta_0 + \beta_1 X_i + \varepsilon_i$$
  <p><strong>Regresi linear berganda</strong> ($k$ variabel $X$):</p>
  $$Y_i = \beta_0 + \beta_1 X_{1i} + \beta_2 X_{2i} + \dots + \beta_k X_{ki} + \varepsilon_i$$
</div>
<ul>
  <li>$\beta_0$ adalah <strong>konstanta (intercept)</strong>, yaitu nilai $Y$ ketika semua $X = 0$.</li>
  <li>$\beta_j$ adalah <strong>koefisien regresi</strong>: perubahan rata-rata $Y$ bila $X_j$ naik satu satuan dan variabel lain dijaga tetap.</li>
  <li>$\varepsilon_i$ adalah <strong>galat</strong> (error), yaitu bagian $Y$ yang tidak dijelaskan model.</li>
</ul>
<p>Dari data kita menaksir $\beta$ dengan $b$ (di aplikasi, regresi sederhana memakai $a$ dan $b$), sehingga diperoleh persamaan taksiran dan <strong>residual</strong>:</p>
$$\hat{Y}_i = b_0 + b_1 X_{1i} + \dots + b_k X_{ki},\qquad e_i = Y_i - \hat{Y}_i$$
<div class="mt-box note" data-label="Syarat jumlah data">
  <p>Agar semua koefisien bisa ditaksir dan diuji, dibutuhkan $n \ge k + 2$ data (derajat bebas galat $n-k-1 \ge 1$). Aplikasi menampilkan batas minimal ini di Langkah 2.</p>
</div>`
      },
      {
        id: 'ols-sederhana', title: 'Penaksiran regresi sederhana',
        html: String.raw`
<p>Metode <strong>kuadrat terkecil</strong> (<em>ordinary least squares</em>, OLS) memilih garis yang meminimalkan jumlah kuadrat residual $\sum e_i^2$. Untuk satu variabel $X$, hasilnya (sesuai tabel bantu di aplikasi):</p>
$$b = \frac{n\sum XY - \sum X \sum Y}{n\sum X^2 - \left(\sum X\right)^2},\qquad a = \frac{\sum Y - b\sum X}{n}$$
<p>Bentuk setara memakai jumlah kuadrat terkoreksi:</p>
$$b = \frac{S_{XY}}{S_{XX}},\qquad S_{XY} = \sum (X-\bar{X})(Y-\bar{Y}),\quad S_{XX} = \sum (X-\bar{X})^2$$
<p>dan $a = \bar{Y} - b\bar{X}$, sehingga garis regresi selalu melewati titik $(\bar{X}, \bar{Y})$.</p>
<div class="mt-box key" data-label="Tafsir">
  <p>$b$ adalah perubahan rata-rata $Y$ untuk setiap kenaikan 1 satuan $X$. Jika $b = 0{,}6$, setiap tambahan 1 satuan $X$ diikuti kenaikan rata-rata $Y$ sebesar 0,6 satuan. Tanda $b$ menunjukkan arah hubungan.</p>
</div>`
      },
      {
        id: 'ols-berganda', title: 'Penaksiran regresi berganda (matriks)',
        html: String.raw`
<p>Untuk banyak variabel $X$, model ditulis dalam bentuk matriks $\mathbf{Y} = \mathbf{X}\boldsymbol{\beta} + \boldsymbol{\varepsilon}$. Matriks $\mathbf{X}$ berukuran $n \times (k+1)$ dengan kolom pertama berisi angka 1 untuk konstanta:</p>
$$\mathbf{X} = \begin{bmatrix} 1 & X_{11} & \cdots & X_{k1} \\ 1 & X_{12} & \cdots & X_{k2} \\ \vdots & \vdots & & \vdots \\ 1 & X_{1n} & \cdots & X_{kn} \end{bmatrix}$$
<p>Taksiran OLS meminimalkan $\mathbf{e}^{\top}\mathbf{e}$ dan memenuhi <em>persamaan normal</em> $(\mathbf{X}^{\top}\mathbf{X})\,\mathbf{b} = \mathbf{X}^{\top}\mathbf{Y}$, sehingga:</p>
$$\mathbf{b} = (\mathbf{X}^{\top}\mathbf{X})^{-1}\,\mathbf{X}^{\top}\mathbf{Y}$$
<p>Ragam dan galat baku koefisien:</p>
$$s^2 = \frac{SSE}{n-k-1},\qquad \widehat{\mathrm{Var}}(\mathbf{b}) = s^2(\mathbf{X}^{\top}\mathbf{X})^{-1},\qquad SE(b_j) = \sqrt{s^2\,\bigl[(\mathbf{X}^{\top}\mathbf{X})^{-1}\bigr]_{jj}}$$
<div class="mt-box warn" data-label="Matriks singular">
  <p>Jika $\mathbf{X}^{\top}\mathbf{X}$ tidak punya invers (singular), ada variabel $X$ yang merupakan kombinasi linear sempurna dari variabel lain (multikolinearitas sempurna). Aplikasi akan menampilkan pesan galat. Hapus salah satu variabel yang berulang.</p>
</div>
<p>Anda dapat mencoba perhitungan matriks ini langsung di menu <strong>Kalkulator Matriks</strong> (operasi regresi OLS).</p>`
      },
      {
        id: 'determinasi', title: 'Korelasi, R², dan galat baku taksiran',
        html: String.raw`
<h3>Penguraian jumlah kuadrat</h3>
<p>Variasi total $Y$ terbagi menjadi bagian yang dijelaskan model dan bagian sisa:</p>
$$\underbrace{\sum (Y_i - \bar{Y})^2}_{SST} = \underbrace{\sum (\hat{Y}_i - \bar{Y})^2}_{SSR} + \underbrace{\sum (Y_i - \hat{Y}_i)^2}_{SSE}$$

<h3>Koefisien determinasi</h3>
$$R^2 = \frac{SSR}{SST} = 1 - \frac{SSE}{SST}$$
<p>$R^2$ adalah proporsi variasi $Y$ yang dijelaskan oleh model, dengan nilai antara 0 dan 1. Contoh $R^2 = 0{,}60$ berarti 60% variasi $Y$ dijelaskan $X$, dan 40% oleh faktor lain.</p>
<p>Pada regresi sederhana, $R^2 = r^2$ dengan $r$ koefisien korelasi Pearson:</p>
$$r = \frac{n\sum XY - \sum X\sum Y}{\sqrt{\bigl[n\sum X^2 - (\sum X)^2\bigr]\bigl[n\sum Y^2 - (\sum Y)^2\bigr]}}$$
<p>Tanda $r$ sama dengan tanda $b$. Pada regresi berganda aplikasi menampilkan korelasi ganda $R = \sqrt{R^2}$.</p>

<h3>Adjusted R²</h3>
<p>$R^2$ tidak pernah turun jika variabel ditambahkan, walau variabel itu tidak berguna. Adjusted $R^2$ menghukum penambahan variabel:</p>
$$R^2_{adj} = 1 - (1 - R^2)\,\frac{n-1}{n-k-1}$$
<p>Gunakan adjusted $R^2$ untuk membandingkan model dengan jumlah variabel berbeda.</p>

<h3>Galat baku taksiran</h3>
$$S_e = \sqrt{\frac{SSE}{n-k-1}}$$
<p>Ukuran &ldquo;simpangan rata-rata&rdquo; titik data dari garis regresi, dalam satuan $Y$. Semakin kecil, semakin dekat prediksi dengan data.</p>

<div class="mt-tw"><table>
<thead><tr><th>$|r|$</th><th>Kekuatan hubungan (pedoman umum)</th></tr></thead>
<tbody>
<tr><td>0,00 &ndash; 0,19</td><td>Sangat lemah</td></tr>
<tr><td>0,20 &ndash; 0,39</td><td>Lemah</td></tr>
<tr><td>0,40 &ndash; 0,59</td><td>Sedang</td></tr>
<tr><td>0,60 &ndash; 0,79</td><td>Kuat</td></tr>
<tr><td>0,80 &ndash; 1,00</td><td>Sangat kuat</td></tr>
</tbody></table></div>
<div class="mt-box warn" data-label="Korelasi bukan sebab-akibat">
  <p>$R^2$ yang tinggi hanya menunjukkan hubungan statistik yang kuat, bukan bukti bahwa $X$ menyebabkan $Y$.</p>
</div>`
      },
      {
        id: 'uji-f', title: 'Uji F (uji simultan)',
        html: String.raw`
<p>Uji F menguji apakah <strong>model secara keseluruhan</strong> berguna, yaitu apakah minimal satu variabel $X$ berpengaruh terhadap $Y$.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0: \beta_1 = \beta_2 = \dots = \beta_k = 0$ (tidak ada variabel yang berpengaruh)</p>
  <p>$H_1:$ minimal satu $\beta_j \ne 0$</p>
</div>
<p>Hasilnya diringkas dalam <strong>tabel ANOVA regresi</strong>:</p>
<div class="mt-tw"><table>
<thead><tr><th>Sumber</th><th>JK</th><th>db</th><th>KT</th><th>F</th></tr></thead>
<tbody>
<tr><td>Regresi</td><td>$SSR$</td><td>$k$</td><td>$MSR = \dfrac{SSR}{k}$</td><td>$F = \dfrac{MSR}{MSE}$</td></tr>
<tr><td>Residual</td><td>$SSE$</td><td>$n-k-1$</td><td>$MSE = \dfrac{SSE}{n-k-1}$</td><td></td></tr>
<tr><td>Total</td><td>$SST$</td><td>$n-1$</td><td></td><td></td></tr>
</tbody></table></div>
$$F = \frac{SSR/k}{SSE/(n-k-1)} = \frac{R^2/k}{(1-R^2)/(n-k-1)}\;\sim\; F_{(k,\;n-k-1)}$$
<p><strong>Keputusan:</strong> tolak $H_0$ bila $p \lt 0{,}05$ (setara $F$ hitung $>$ $F$ tabel). Bila ditolak, model secara simultan signifikan.</p>`
      },
      {
        id: 'uji-t', title: 'Uji t (uji parsial)',
        html: String.raw`
<p>Uji t menguji <strong>tiap koefisien</strong> satu per satu: apakah variabel $X_j$ berpengaruh nyata terhadap $Y$ setelah variabel lain dikontrol.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0: \beta_j = 0$ &nbsp;&nbsp; lawan &nbsp;&nbsp; $H_1: \beta_j \ne 0$ (dua sisi)</p>
</div>
$$t_j = \frac{b_j}{SE(b_j)}\;\sim\; t_{(n-k-1)}$$
<p>Untuk regresi sederhana, galat baku koefisien:</p>
$$SE(b) = \frac{S_e}{\sqrt{S_{XX}}},\qquad SE(a) = S_e\sqrt{\frac{1}{n} + \frac{\bar{X}^2}{S_{XX}}}$$
<p><strong>Keputusan:</strong> tolak $H_0$ bila $p \lt 0{,}05$, yaitu $|t_j|$ melebihi nilai kritis $t_{0{,}975;\,n-k-1}$.</p>
<div class="mt-box note" data-label="F signifikan, t tidak?">
  <p>Hal ini wajar pada regresi berganda bila variabel $X$ saling berkorelasi (multikolinearitas): model secara bersama berguna, tetapi sumbangan tiap variabel sulit dipisahkan. Periksa nilai VIF.</p>
</div>`
      },
      {
        id: 'asumsi', title: 'Asumsi klasik regresi',
        html: String.raw`
<p>Uji F dan uji t hanya dapat dipercaya bila asumsi berikut terpenuhi. Aplikasi memeriksa keempatnya di Langkah 4 setelah perhitungan. Untuk keempat asumsi ini tersedia beberapa uji yang bisa dipilih lewat menu di Langkah 4 (lihat <strong>Memilih uji</strong>):</p>
<div class="mt-tw"><table>
<thead><tr><th>Asumsi</th><th>Maksud</th><th>Uji di aplikasi</th></tr></thead>
<tbody>
<tr><td>Normalitas</td><td>Residual berdistribusi normal</td><td>Jarque-Bera, Shapiro-Wilk, atau Kolmogorov-Smirnov (Lilliefors)</td></tr>
<tr><td>Non-multikolinearitas</td><td>Variabel $X$ tidak saling berkorelasi tinggi</td><td>VIF, Korelasi antar $X$, atau Condition Index</td></tr>
<tr><td>Homoskedastisitas</td><td>Ragam residual konstan</td><td>Glejser, Breusch-Pagan, atau White</td></tr>
<tr><td>Non-autokorelasi</td><td>Residual saling bebas</td><td>Durbin-Watson, Breusch-Godfrey, atau Runs</td></tr>
</tbody></table></div>
<p>Asumsi tambahan yang tidak diuji otomatis: hubungan benar-benar linear dan tidak ada variabel penting yang terlewat. Periksa dengan grafik residual dan scatter plot di tab Grafik.</p>
<div class="mt-box note" data-label="Catatan">
  <p>Multikolinearitas hanya relevan untuk regresi berganda. Autokorelasi paling bermakna bila data berurutan (misal deret waktu). Pada data lintas individu, urutan baris biasanya tidak bermakna.</p>
</div>`
      },
      {
        id: 'pilih-uji', title: 'Memilih uji asumsi',
        html: String.raw`
<p>Di Langkah 4 kalkulator Regresi Linear tersedia beberapa uji untuk satu asumsi yang sama. Pilihlah lewat menu <strong>Uji normalitas residual</strong>, <strong>Uji heteroskedastisitas</strong>, <strong>Uji multikolinearitas</strong>, dan <strong>Uji autokorelasi</strong>; hasil Langkah 4, Kesimpulan Model, dan berkas ekspor langsung mengikuti pilihan itu tanpa menghitung ulang regresi.</p>
<div class="mt-tw"><table>
<thead><tr><th>Asumsi</th><th>Uji</th><th>Ide dasar</th><th>Cocok bila</th></tr></thead>
<tbody>
<tr><td rowspan="3">Normalitas residual</td><td>Jarque-Bera</td><td>Skewness dan kurtosis</td><td>Sampel besar (ratusan data)</td></tr>
<tr><td>Shapiro-Wilk</td><td>Korelasi dengan nilai normal teoretis</td><td>Sampel kecil sampai sedang; umumnya paling kuat</td></tr>
<tr><td>Kolmogorov-Smirnov (Lilliefors)</td><td>Jarak terjauh antar sebaran kumulatif</td><td>Dipakai bila format laporan meminta K-S</td></tr>
<tr><td rowspan="3">Heteroskedastisitas</td><td>Glejser</td><td>Regresi $|e|$ terhadap $X$</td><td>Pemeriksaan cepat, tafsir per variabel</td></tr>
<tr><td>Breusch-Pagan</td><td>Regresi $e^2$ terhadap $X$</td><td>Ragam diduga berubah linear terhadap $X$</td></tr>
<tr><td>White</td><td>Regresi $e^2$ terhadap $X$, $X^2$, silang</td><td>Bentuk ragam tidak diketahui; data cukup banyak</td></tr>
<tr><td rowspan="3">Multikolinearitas</td><td>VIF</td><td>Regresi tiap $X_j$ terhadap $X$ lain</td><td>Pilihan standar; menangkap hubungan banyak variabel</td></tr>
<tr><td>Korelasi antar $X$</td><td>Korelasi Pearson tiap pasangan $X$</td><td>Pemeriksaan cepat dan mudah dibaca</td></tr>
<tr><td>Condition Index</td><td>Nilai eigen matriks korelasi $X$</td><td>Mendeteksi ketergantungan linear gabungan</td></tr>
<tr><td rowspan="3">Autokorelasi</td><td>Durbin-Watson</td><td>Selisih residual berurutan</td><td>Data deret waktu, orde 1, ada konstanta</td></tr>
<tr><td>Breusch-Godfrey</td><td>Regresi $e_t$ terhadap $X$ dan $e_{t-1}$</td><td>Uji formal ber-$p$-value; berlaku untuk model berganda</td></tr>
<tr><td>Runs</td><td>Banyaknya pergantian tanda residual</td><td>Pemeriksaan sederhana tanpa asumsi model</td></tr>
</tbody></table></div>
<div class="mt-box key" data-label="Saran praktis">
  <p>Jika data sedikit (di bawah sekitar 50), pakai <strong>Shapiro-Wilk</strong> untuk normalitas. Jika model punya banyak variabel $X$ dan data terbatas, pilih <strong>Breusch-Pagan</strong> karena regresi bantunya paling hemat derajat bebas; White bisa kehilangan daya karena banyak suku tambahan.</p>
  <p>Untuk multikolinearitas, <strong>VIF</strong> adalah pilihan utama; tambahkan <strong>Condition Index</strong> bila ingin memeriksa ketergantungan gabungan. Untuk autokorelasi, <strong>Breusch-Godfrey</strong> memberi $p$-value formal, sedangkan Durbin-Watson cukup sebagai pemeriksaan cepat.</p>
</div>
<div class="mt-box warn" data-label="Jangan memilih-milih hasil">
  <p>Pilih uji <em>sebelum</em> melihat hasilnya, lalu laporkan uji yang dipilih. Berganti-ganti uji sampai memperoleh kesimpulan yang diinginkan membuat peluang salah menyimpulkan membesar. Bila beberapa uji berbeda hasil, lihat juga grafik (Q-Q plot, histogram, residual terhadap nilai prediksi) dan bahas perbedaannya secara jujur.</p>
</div>
<p>Semua uji memakai taraf signifikansi $\alpha = 0{,}05$. Ingat arah keputusan: pada uji asumsi kita <em>berharap tidak menolak</em> $H_0$ (residual normal, ragam konstan).</p>`
      },
      {
        id: 'jarque-bera', title: 'Uji normalitas: Jarque-Bera',
        html: String.raw`
<p>Menguji apakah residual berdistribusi normal, syarat agar uji t dan uji F valid, terutama pada sampel kecil.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0:$ residual berdistribusi normal &nbsp;&nbsp; $H_1:$ residual tidak normal</p>
</div>
<p>Uji ini membandingkan skewness $S$ dan kurtosis $K$ residual dengan nilai distribusi normal ($S=0$, $K=3$):</p>
$$JB = \frac{n}{6}\left(S^2 + \frac{(K-3)^2}{4}\right),\qquad S = \frac{m_3}{m_2^{3/2}},\quad K = \frac{m_4}{m_2^{2}},\quad m_r = \frac{1}{n}\sum e_i^{\,r}$$
<p>Di bawah $H_0$, $JB \sim \chi^2$ dengan db 2, sehingga p-value $= e^{-JB/2}$.</p>
<div class="mt-box key" data-label="Keputusan">
  <p>$p \ge 0{,}05$: gagal tolak $H_0$, residual dianggap normal (asumsi terpenuhi).<br>$p \lt 0{,}05$: tolak $H_0$, residual tidak normal.</p>
</div>
<div class="mt-box warn" data-label="Hati-hati">
  <p>Pada $n$ kecil, uji ini punya daya rendah dan p-value-nya hanya pendekatan asimtotik. Lihat juga Q-Q plot dan histogram residual di tab Grafik. Titik yang mengikuti garis menandakan residual mendekati normal. Untuk sampel kecil, pertimbangkan <strong>Shapiro-Wilk</strong> (bagian berikutnya).</p>
</div>`
      },
      {
        id: 'shapiro-wilk', title: 'Uji normalitas: Shapiro-Wilk',
        html: String.raw`
<p>Uji Shapiro-Wilk menilai seberapa lurus titik-titik pada Q-Q plot, yaitu seberapa kuat residual terurut berkorelasi dengan nilai harapan sebaran normal. Uji ini banyak dipakai untuk sampel kecil sampai sedang ($3 \le n \le 5000$) karena dayanya baik.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0:$ residual berdistribusi normal &nbsp;&nbsp; $H_1:$ residual tidak berdistribusi normal</p>
</div>
<h3>Statistik uji</h3>
<p>Urutkan residual dari kecil ke besar: $e_{(1)} \le e_{(2)} \le \dots \le e_{(n)}$. Statistik $W$ adalah</p>
$$W = \frac{\left(\sum_{i=1}^{n} a_i\, e_{(i)}\right)^2}{\sum_{i=1}^{n} (e_i - \bar{e})^2}$$
<p>Koefisien $a_i$ berasal dari nilai harapan dan kovarians statistik terurut sebaran normal baku $(a_1,\dots,a_n) = \dfrac{\mathbf{m}^{\top}\mathbf{V}^{-1}}{\sqrt{\mathbf{m}^{\top}\mathbf{V}^{-1}\mathbf{V}^{-1}\mathbf{m}}}$, bersifat antisimetris ($a_i = -a_{n+1-i}$). Bila $n$ genap, penjumlahan itu dapat ditulis sebagai</p>
$$b = \sum_{i=1}^{n/2} a_{n+1-i}\,\bigl(e_{(n+1-i)} - e_{(i)}\bigr),\qquad W = \frac{b^2}{SS},\quad SS = \sum (e_i - \bar{e})^2$$
<p>(untuk $n$ ganjil, residual tengah tidak ikut karena $a_{(n+1)/2} = 0$). Nilai $0 \lt W \le 1$.</p>
<div class="mt-box key" data-label="Cara membaca W">
  <p>$W$ mendekati 1: residual sangat mirip sebaran normal. $W$ kecil: menyimpang dari normal. Pada regresi OLS dengan konstanta, $\bar{e}=0$, sehingga penyebut sama dengan $SSE$.</p>
</div>
<h3>P-value</h3>
<p>Nilai kritis $W$ bergantung pada $n$. Aplikasi memakai aproksimasi Royston (1992, algoritma AS R94): untuk $n \ge 12$ transformasi $\ln(1-W)$ dianggap menyebar normal, $z = \dfrac{\ln(1-W) - \mu_n}{\sigma_n}$, dan $p = P(Z \gt z)$; $\mu_n$ dan $\sigma_n$ adalah polinomial dalam $\ln n$. Untuk $n$ kecil dipakai polinomial dalam $n$, dan untuk $n = 3$ ada rumus eksak. Hasilnya sama dengan fungsi <code>shapiro.test()</code> di R.</p>
<div class="mt-box key" data-label="Keputusan">
  <p>$p \ge 0{,}05$: gagal tolak $H_0$, residual dianggap normal (asumsi terpenuhi).<br>$p \lt 0{,}05$: tolak $H_0$, residual tidak normal.</p>
</div>
<div class="mt-box ex" data-label="Contoh hitung">
  <p>Dari materi <em>Contoh hitung</em> (regresi $\hat{Y} = 2{,}2 + 0{,}6X$), residual $e = (-0{,}8;\ 0{,}6;\ 1{,}0;\ -0{,}6;\ -0{,}2)$. Terurut: $-0{,}8;\ -0{,}6;\ -0{,}2;\ 0{,}6;\ 1{,}0$.</p>
</div>
<ol class="mt-steps">
  <li><strong>Koefisien</strong> untuk $n=5$: $a_5 = 0{,}6646$ dan $a_4 = 0{,}2413$ (tabel Shapiro-Wilk).</li>
  <li><strong>Pembilang:</strong> $b = 0{,}6646\,(1{,}0 - (-0{,}8)) + 0{,}2413\,(0{,}6 - (-0{,}6)) = 1{,}1963 + 0{,}2896 = 1{,}4858$.</li>
  <li><strong>Penyebut:</strong> $SS = \sum e_i^2 = 2{,}4$ (karena $\bar{e} = 0$, sama dengan $SSE$).</li>
  <li><strong>Statistik:</strong> $W = \dfrac{1{,}4858^2}{2{,}4} = \dfrac{2{,}2077}{2{,}4} = 0{,}920$.</li>
  <li><strong>Keputusan:</strong> $p \approx 0{,}530 \ge 0{,}05$, gagal tolak $H_0$. Residual tidak menunjukkan penyimpangan dari normal. Dengan $n=5$ daya uji sangat rendah, jadi kesimpulan ini lemah.</li>
</ol>
<div class="mt-box warn" data-label="Hati-hati">
  <p>Pada $n$ sangat besar, penyimpangan kecil yang tidak berarti pun bisa memberi $p \lt 0{,}05$; pada $n$ sangat kecil, hampir semua data lolos. Selalu pasangkan dengan Q-Q plot. Shapiro-Wilk juga peka terhadap nilai residual yang berulang (banyak nilai kembar).</p>
</div>`
      },
      {
        id: 'kolmogorov-smirnov', title: 'Uji normalitas: Kolmogorov-Smirnov (Lilliefors)',
        html: String.raw`
<p>Uji Kolmogorov-Smirnov (K-S) membandingkan <strong>fungsi sebaran kumulatif empiris</strong> residual dengan fungsi sebaran kumulatif normal. Jika kedua kurva berjauhan di suatu titik, residual diragukan normal.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0:$ residual berdistribusi normal &nbsp;&nbsp; $H_1:$ residual tidak berdistribusi normal</p>
</div>
<h3>Statistik uji</h3>
<p>Standarkan residual terurut memakai rata-rata dan simpangan baku <em>yang ditaksir dari residual itu sendiri</em>, lalu hitung peluang normal bakunya $F_i = \Phi(z_i)$:</p>
$$z_{(i)} = \frac{e_{(i)} - \bar{e}}{s},\qquad s = \sqrt{\frac{\sum (e_i - \bar{e})^2}{n-1}},\qquad F_i = \Phi\bigl(z_{(i)}\bigr)$$
$$D^{+} = \max_i \left(\frac{i}{n} - F_i\right),\qquad D^{-} = \max_i \left(F_i - \frac{i-1}{n}\right),\qquad D = \max(D^{+}, D^{-})$$
<div class="mt-box note" data-label="Mengapa Lilliefors">
  <p>Tabel K-S klasik hanya sah bila rata-rata dan simpangan baku sebaran normal <em>diketahui</em> lebih dulu. Pada residual regresi, keduanya ditaksir dari data, sehingga $D$ cenderung lebih kecil dan uji klasik terlalu sulit menolak $H_0$. Koreksi <strong>Lilliefors</strong> memakai nilai kritis yang lebih ketat. Kolom &ldquo;Kolmogorov-Smirnov&rdquo; dengan koreksi ini yang dilaporkan SPSS untuk uji normalitas residual.</p>
</div>
<h3>Nilai kritis dan p-value</h3>
<p>Tolak $H_0$ bila $D$ melebihi nilai kritis Lilliefors. Untuk $\alpha = 0{,}05$ nilai kritisnya kira-kira $\dfrac{0{,}886}{\sqrt{n}}$ bagi $n \gt 30$ (untuk $n=5$ tabelnya 0,337). Aplikasi menghitung p-value dengan pendekatan Dallal &amp; Wilkinson (1986), seperti fungsi <code>lillie.test()</code> di R. Nilainya berupa pendekatan, terutama pada $n$ kecil.</p>
<div class="mt-box key" data-label="Keputusan">
  <p>$p \ge 0{,}05$ (atau $D \le D_{kritis}$): gagal tolak $H_0$, residual dianggap normal.<br>$p \lt 0{,}05$ (atau $D \gt D_{kritis}$): tolak $H_0$, residual tidak normal.</p>
</div>
<div class="mt-box ex" data-label="Contoh hitung">
  <p>Residual terurut dari <em>Contoh hitung</em>: $-0{,}8;\ -0{,}6;\ -0{,}2;\ 0{,}6;\ 1{,}0$ dengan $\bar{e} = 0$ dan $s = \sqrt{2{,}4/4} = 0{,}7746$.</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th class="c">$i$</th><th class="c">$e_{(i)}$</th><th class="c">$z_{(i)}$</th><th class="c">$F_i = \Phi(z)$</th><th class="c">$i/n - F_i$</th><th class="c">$F_i - (i-1)/n$</th></tr></thead>
<tbody>
<tr><td class="c">1</td><td class="c">-0,8</td><td class="c">-1,033</td><td class="c">0,1508</td><td class="c">0,0492</td><td class="c">0,1508</td></tr>
<tr><td class="c">2</td><td class="c">-0,6</td><td class="c">-0,775</td><td class="c">0,2193</td><td class="c">0,1807</td><td class="c">0,0193</td></tr>
<tr><td class="c">3</td><td class="c">-0,2</td><td class="c">-0,258</td><td class="c">0,3981</td><td class="c">0,2019</td><td class="c">-0,0019</td></tr>
<tr><td class="c">4</td><td class="c">0,6</td><td class="c">0,775</td><td class="c">0,7807</td><td class="c">0,0193</td><td class="c">0,1807</td></tr>
<tr><td class="c">5</td><td class="c">1,0</td><td class="c">1,291</td><td class="c">0,9016</td><td class="c">0,0984</td><td class="c">0,1016</td></tr>
</tbody></table></div>
<ol class="mt-steps">
  <li>$D^{+} = 0{,}2019$ dan $D^{-} = 0{,}1807$, sehingga $D = 0{,}2019$.</li>
  <li>Nilai kritis Lilliefors untuk $n=5$, $\alpha = 0{,}05$ adalah $0{,}337$. Karena $0{,}2019 \lt 0{,}337$ (p-value $\approx 0{,}72$), $H_0$ gagal ditolak: residual dianggap normal.</li>
</ol>
<div class="mt-box warn" data-label="Hati-hati">
  <p>K-S/Lilliefors umumnya <strong>kurang kuat</strong> daripada Shapiro-Wilk, terutama pada sampel kecil, dan lebih peka terhadap bagian tengah sebaran daripada ekornya. Bila kedua uji tersedia dan berbeda, Shapiro-Wilk biasanya lebih dapat dipercaya. Aplikasi memerlukan minimal 4 data untuk uji ini.</p>
</div>`
      },
      {
        id: 'vif', title: 'Uji multikolinearitas: VIF',
        html: String.raw`
<p>Multikolinearitas adalah keadaan ketika variabel $X$ saling berkorelasi kuat. Akibatnya, koefisien menjadi tidak stabil dan galat bakunya membesar, walau $R^2$ tetap tinggi.</p>
<p>Untuk tiap $X_j$, regresikan $X_j$ terhadap semua $X$ lainnya dan ambil $R_j^2$-nya. Lalu:</p>
$$VIF_j = \frac{1}{1 - R_j^2},\qquad \text{Tolerance}_j = \frac{1}{VIF_j} = 1 - R_j^2$$
<div class="mt-box def" data-label="Hipotesis di aplikasi">
  <p>$H_0:$ tidak ada multikolinearitas ($VIF \le 10$) &nbsp;&nbsp; $H_1:$ ada multikolinearitas ($VIF > 10$)</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th>VIF</th><th>Tolerance</th><th>Tafsir</th></tr></thead>
<tbody>
<tr><td>$\approx 1$</td><td>$\approx 1$</td><td>Tidak ada korelasi dengan $X$ lain</td></tr>
<tr><td>$\le 10$</td><td>$\ge 0{,}1$</td><td>Aman (batas yang dipakai aplikasi)</td></tr>
<tr><td>$> 10$</td><td>$\lt 0{,}1$</td><td>Multikolinearitas serius</td></tr>
</tbody></table></div>
<p><strong>Penanganan:</strong> hapus salah satu variabel yang berkorelasi tinggi, gabungkan variabel yang mengukur hal yang sama, atau tambah data. Sebagian buku memakai batas yang lebih ketat (VIF $>5$).</p>`
      },
      {
        id: 'korelasi-x', title: 'Uji multikolinearitas: Korelasi antar X',
        html: String.raw`
<p>Cara paling sederhana memeriksa multikolinearitas adalah melihat korelasi Pearson tiap pasangan variabel $X$:</p>
$$r_{ab} = \frac{\sum (X_a - \bar{X}_a)(X_b - \bar{X}_b)}{\sqrt{\sum (X_a - \bar{X}_a)^2 \sum (X_b - \bar{X}_b)^2}}$$
<div class="mt-box def" data-label="Hipotesis di aplikasi">
  <p>$H_0:$ semua pasangan $|r| \le 0{,}8$ (tidak ada multikolinearitas) &nbsp;&nbsp; $H_1:$ ada pasangan dengan $|r| > 0{,}8$</p>
</div>
<p>Aplikasi juga menampilkan $p$-value uji $t$ untuk tiap korelasi, $t = r\sqrt{\dfrac{n-2}{1-r^2}}$, sebagai informasi tambahan. Keputusan memakai batas $|r|$, bukan $p$-value, karena korelasi kecil pun bisa signifikan pada $n$ besar.</p>
<div class="mt-box warn" data-label="Keterbatasan">
  <p>Uji ini hanya melihat hubungan <em>berpasangan</em>. Tiga variabel bisa saling terkait kuat (mis. $X_3 \approx X_1 + X_2$) walau tidak ada pasangan yang berkorelasi di atas 0,8. Karena itu gunakan VIF atau Condition Index sebagai pelengkap. Sebagian buku memakai batas 0,9 yang lebih longgar.</p>
</div>`
      },
      {
        id: 'condition-index', title: 'Uji multikolinearitas: Condition Index',
        html: String.raw`
<p>Condition Index (CI) memeriksa ketergantungan linear lewat nilai eigen $\lambda_1 \ge \lambda_2 \ge \dots \ge \lambda_k$ dari matriks korelasi variabel $X$. Bila ada $\lambda$ yang mendekati nol, variabel $X$ hampir bergantung linear.</p>
$$CI_i = \sqrt{\frac{\lambda_{\max}}{\lambda_i}}$$
<div class="mt-box def" data-label="Hipotesis di aplikasi">
  <p>$H_0:$ CI maksimum $\le 30$ (tidak ada multikolinearitas serius) &nbsp;&nbsp; $H_1:$ CI maksimum $> 30$</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th>CI</th><th>Tafsir</th></tr></thead>
<tbody>
<tr><td>$\lt 10$</td><td>Aman</td></tr>
<tr><td>$10$ sampai $30$</td><td>Multikolinearitas sedang</td></tr>
<tr><td>$> 30$</td><td>Multikolinearitas serius</td></tr>
</tbody></table></div>
<div class="mt-box note" data-label="Catatan">
  <p>Aplikasi memakai matriks korelasi $X$ (variabel dibakukan, tanpa konstanta), sehingga jumlah nilai eigen sama dengan $k$ dan nilai CI dapat berbeda dari keluaran SPSS yang memasukkan konstanta. Kesimpulan umumnya serupa.</p>
</div>`
      },
      {
        id: 'glejser', title: 'Uji heteroskedastisitas: Glejser',
        html: String.raw`
<p>Homoskedastisitas berarti ragam residual sama di semua nilai $X$. Bila tidak (heteroskedastisitas), taksiran koefisien tetap tidak bias tetapi galat baku keliru, sehingga uji t dan F menyesatkan.</p>
<p>Uji Glejser meregresikan <strong>nilai mutlak residual</strong> terhadap tiap variabel $X$:</p>
$$|e_i| = \alpha + \gamma_1 X_{1i} + \dots + \gamma_k X_{ki} + v_i$$
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0: \gamma_j = 0$ (ragam residual homogen) &nbsp;&nbsp; $H_1: \gamma_j \ne 0$ (terjadi heteroskedastisitas)</p>
</div>
<p>Setiap $\gamma_j$ diuji dengan uji t. Jika ada variabel dengan $p \lt 0{,}05$, ada indikasi heteroskedastisitas. Jika semua $p \ge 0{,}05$, asumsi terpenuhi.</p>
<div class="mt-box note" data-label="Penanganan">
  <p>Transformasi $Y$ (misal logaritma), regresi terboboti (WLS), atau galat baku robust. Grafik residual yang melebar seperti corong (kipas) adalah tanda visualnya. Alternatif uji formal yang lebih baku: <strong>Breusch-Pagan</strong> dan <strong>White</strong>.</p>
</div>`
      },
      {
        id: 'breusch-pagan', title: 'Uji heteroskedastisitas: Breusch-Pagan',
        html: String.raw`
<p>Uji Breusch-Pagan memeriksa apakah ragam residual berkaitan dengan variabel $X$. Idenya: bila ragam konstan, kuadrat residual $e^2$ <em>tidak</em> bisa dijelaskan oleh $X$.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0: \mathrm{Var}(\varepsilon_i) = \sigma^2$ (konstan, homoskedastisitas)<br>$H_1:$ ragam residual berubah mengikuti $X$ (heteroskedastisitas)</p>
</div>
<h3>Langkah uji</h3>
<ol class="mt-steps">
  <li>Taksir model asli dengan OLS dan simpan residual $e_i$.</li>
  <li>Bentuk kuadrat residual $e_i^2$, lalu lakukan <strong>regresi bantu</strong>:
  $$e_i^2 = \delta_0 + \delta_1 X_{1i} + \dots + \delta_k X_{ki} + v_i$$</li>
  <li>Ambil $R^2$ dari regresi bantu itu dan hitung statistik <em>Lagrange Multiplier</em> (LM):
  $$LM = n\,R^2_{\text{bantu}} \;\sim\; \chi^2_{(k)}\quad\text{di bawah } H_0$$</li>
  <li>Bandingkan dengan $\chi^2_{(k)}$ pada $\alpha = 0{,}05$, atau pakai p-value $= P(\chi^2_{(k)} \gt LM)$.</li>
</ol>
<p>Selain LM, aplikasi menampilkan statistik $F$ regresi bantu sebagai pembanding:</p>
$$F = \frac{R^2_{\text{bantu}}/k}{(1 - R^2_{\text{bantu}})/(n-k-1)} \;\sim\; F_{(k,\;n-k-1)}$$
<div class="mt-box note" data-label="Versi yang dipakai">
  <p>Uji Breusch-Pagan asli membagi $e_i^2$ dengan $\hat{\sigma}^2 = SSE/n$ dan memakai setengah jumlah kuadrat regresi bantu, serta mengandaikan galat normal. Aplikasi memakai <strong>versi Koenker (<em>studentized</em>)</strong>, $LM = nR^2$, yang tidak memerlukan kenormalan galat dan sama dengan hasil <code>bptest()</code> di R, <code>het_breuschpagan</code> di Python, dan &ldquo;Breusch-Pagan-Godfrey&rdquo; (Obs*R-squared) di EViews.</p>
</div>
<div class="mt-box key" data-label="Keputusan">
  <p>$p \ge 0{,}05$ (atau $LM \le \chi^2_{kritis}$): gagal tolak $H_0$, ragam residual konstan.<br>$p \lt 0{,}05$ (atau $LM \gt \chi^2_{kritis}$): tolak $H_0$, terjadi heteroskedastisitas.</p>
</div>
<div class="mt-box ex" data-label="Contoh hitung">
  <p>Residual <em>Contoh hitung</em>: $e = (-0{,}8;\ 0{,}6;\ 1{,}0;\ -0{,}6;\ -0{,}2)$ sehingga $e^2 = (0{,}64;\ 0{,}36;\ 1{,}00;\ 0{,}36;\ 0{,}04)$ dan $X = 1,2,3,4,5$.</p>
</div>
<ol class="mt-steps">
  <li><strong>Regresi bantu</strong> $e^2$ terhadap $X$: $\bar{e^2} = 0{,}48$, $S_{Xe^2} = -1{,}2$, $S_{XX} = 10$, $S_{e^2e^2} = 0{,}5184$.</li>
  <li><strong>$R^2$ bantu:</strong> $R^2 = \dfrac{(-1{,}2)^2}{10 \times 0{,}5184} = \dfrac{1{,}44}{5{,}184} = 0{,}2778$.</li>
  <li><strong>Statistik:</strong> $LM = 5 \times 0{,}2778 = 1{,}389$ dengan db $=1$.</li>
  <li><strong>Keputusan:</strong> nilai kritis $\chi^2_{(1)} = 3{,}841$. Karena $1{,}389 \lt 3{,}841$ ($p = 0{,}239$), $H_0$ gagal ditolak: tidak ada bukti heteroskedastisitas.</li>
</ol>
<div class="mt-box note" data-label="Penanganan">
  <p>Jika heteroskedastisitas terdeteksi: transformasi $Y$ (misal $\ln Y$), regresi terboboti (WLS), atau galat baku <em>robust</em> (White/HC). Kekuatan uji ini bagus bila ragam memang berubah <em>linear</em> terhadap $X$; bila bentuknya lebih rumit (misal kuadratik), uji White lebih tepat.</p>
</div>`
      },
      {
        id: 'white', title: 'Uji heteroskedastisitas: White',
        html: String.raw`
<p>Uji White adalah perluasan Breusch-Pagan yang <strong>tidak mengandaikan bentuk</strong> hubungan antara ragam dan $X$. Regresi bantunya memuat variabel $X$, kuadratnya, dan hasil kali silang antar variabel, sehingga dapat menangkap ragam yang melengkung atau bergantung pada interaksi.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0:$ ragam residual konstan (homoskedastisitas)<br>$H_1:$ ragam residual tidak konstan (heteroskedastisitas)</p>
</div>
<h3>Regresi bantu</h3>
<p><strong>Satu variabel $X$:</strong></p>
$$e_i^2 = \delta_0 + \delta_1 X_i + \delta_2 X_i^2 + v_i$$
<p><strong>Dua variabel $X_1, X_2$:</strong></p>
$$e_i^2 = \delta_0 + \delta_1 X_{1i} + \delta_2 X_{2i} + \delta_3 X_{1i}^2 + \delta_4 X_{2i}^2 + \delta_5 X_{1i}X_{2i} + v_i$$
<p>Untuk $k$ variabel $X$, banyak regresor bantu (di luar konstanta) adalah $q = k + k + \dfrac{k(k-1)}{2} = \dfrac{k(k+3)}{2}$, yaitu 2, 5, 9, 14, 20, 27 untuk $k = 1,\dots,6$. Statistiknya</p>
$$LM = n\,R^2_{\text{bantu}} \;\sim\; \chi^2_{(q)}\quad\text{di bawah } H_0$$
<p>dan aplikasi menampilkan juga $F = \dfrac{R^2/q}{(1-R^2)/(n-q-1)}$ sebagai pembanding.</p>
<div class="mt-box warn" data-label="Syarat jumlah data">
  <p>Regresi bantu butuh $n \ge q + 2$. Bila data tidak cukup untuk memuat hasil kali silang, aplikasi otomatis memakai $X$ dan $X^2$ saja (tanpa suku silang) dan menuliskannya pada catatan hasil. Kolom bantu yang identik atau kolinear (misal $X^2 = X$ pada variabel biner) dibuang otomatis, dan db disesuaikan.</p>
</div>
<div class="mt-box key" data-label="Keputusan">
  <p>$p \ge 0{,}05$ (atau $LM \le \chi^2_{kritis}$): gagal tolak $H_0$, ragam residual konstan.<br>$p \lt 0{,}05$ (atau $LM \gt \chi^2_{kritis}$): tolak $H_0$, terjadi heteroskedastisitas.</p>
</div>
<div class="mt-box ex" data-label="Contoh hitung">
  <p>Residual <em>Contoh hitung</em>: $e^2 = (0{,}64;\ 0{,}36;\ 1{,}00;\ 0{,}36;\ 0{,}04)$ dan $X = 1,2,3,4,5$ (satu variabel, jadi $q=2$).</p>
</div>
<ol class="mt-steps">
  <li><strong>Regresi bantu</strong> $e^2$ terhadap $X$ dan $X^2$ menghasilkan $\hat{e^2} = 0{,}16 + 0{,}4629X - 0{,}0971X^2$.</li>
  <li><strong>$R^2$ bantu</strong> $= 0{,}5326$.</li>
  <li><strong>Statistik:</strong> $LM = 5 \times 0{,}5326 = 2{,}663$ dengan db $=2$.</li>
  <li><strong>Keputusan:</strong> nilai kritis $\chi^2_{(2)} = 5{,}991$. Karena $2{,}663 \lt 5{,}991$ ($p = 0{,}264$), $H_0$ gagal ditolak: tidak ada bukti heteroskedastisitas.</li>
</ol>
<div class="mt-box note" data-label="Kelebihan dan keterbatasan">
  <p><strong>Kelebihan:</strong> fleksibel terhadap bentuk heteroskedastisitas dan tidak mengandaikan galat normal.<br><strong>Keterbatasan:</strong> memakai banyak derajat bebas sehingga dayanya turun pada data sedikit; hasil &ldquo;signifikan&rdquo; juga bisa muncul karena <em>salah spesifikasi</em> model (misal variabel penting terlewat atau bentuk fungsi keliru), bukan hanya karena heteroskedastisitas. Karena itu tinjau juga grafik residual terhadap nilai prediksi.</p>
</div>`
      },
      {
        id: 'durbin-watson', title: 'Uji autokorelasi: Durbin-Watson',
        html: String.raw`
<p>Autokorelasi adalah keadaan ketika residual yang berdekatan saling berkaitan, umum pada data deret waktu. Akibatnya galat baku diremehkan dan uji menjadi terlalu mudah signifikan.</p>
$$d = \frac{\sum_{t=2}^{n}(e_t - e_{t-1})^2}{\sum_{t=1}^{n} e_t^2} \;\approx\; 2\,(1 - \hat{\rho})$$
<p>dengan $\hat{\rho}$ korelasi antara residual berurutan. Nilai $d$ berkisar 0 sampai 4:</p>
<div class="mt-tw"><table>
<thead><tr><th>Nilai $d$</th><th>Tafsir</th></tr></thead>
<tbody>
<tr><td>$d \lt 1{,}5$</td><td>Indikasi autokorelasi positif</td></tr>
<tr><td>$1{,}5 \le d \le 2{,}5$</td><td>Tidak ada autokorelasi</td></tr>
<tr><td>$d > 2{,}5$</td><td>Indikasi autokorelasi negatif</td></tr>
</tbody></table></div>
<div class="mt-box note" data-label="Aturan praktis">
  <p>Rentang 1,5&ndash;2,5 di atas adalah aturan praktis. Uji formal memakai tabel batas bawah $d_L$ dan batas atas $d_U$ yang bergantung pada $n$ dan $k$, dengan daerah ragu-ragu di antaranya. Untuk data deret waktu yang jelas bermasalah, lihat materi <strong>Uji Stasioneritas</strong>.</p>
</div>`
      },
      {
        id: 'breusch-godfrey', title: 'Uji autokorelasi: Breusch-Godfrey',
        html: String.raw`
<p>Uji Breusch-Godfrey (uji LM) memeriksa autokorelasi dengan meregresikan residual $e_t$ terhadap seluruh variabel $X$ dan residual periode sebelumnya:</p>
$$e_t = \alpha_0 + \alpha_1 X_{1t} + \dots + \alpha_k X_{kt} + \rho\, e_{t-1} + u_t$$
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0: \rho = 0$ (tidak ada autokorelasi) &nbsp;&nbsp; $H_1: \rho \ne 0$ (ada autokorelasi)</p>
</div>
<p>Statistik ujinya $LM = n \cdot R^2_{bantu}$ yang mengikuti $\chi^2$ dengan db sama dengan orde (di aplikasi orde 1, jadi db $=1$). Bila $p \lt 0{,}05$, $H_0$ ditolak. Nilai $e_0$ diisi 0.</p>
<div class="mt-box key" data-label="Kelebihan">
  <p>Memberi $p$-value yang jelas (tanpa tabel $d_L$/$d_U$) dan tetap sahih untuk model berganda. Aplikasi memakai orde 1; untuk pola musiman diperlukan orde lebih tinggi.</p>
</div>`
      },
      {
        id: 'runs-test', title: 'Uji autokorelasi: Runs',
        html: String.raw`
<p>Uji Runs (Wald-Wolfowitz) hanya melihat tanda residual (+ atau &minus;). Satu <em>run</em> adalah deretan tanda sejenis yang berurutan. Misal tanda $+ + - - - + -$ memiliki 4 run.</p>
<p>Dengan $n_1$ residual positif, $n_2$ negatif, $n = n_1 + n_2$, dan $R$ banyaknya run:</p>
$$\mu_R = \frac{2 n_1 n_2}{n} + 1,\qquad \sigma_R^2 = \frac{2 n_1 n_2 (2 n_1 n_2 - n)}{n^2 (n-1)},\qquad Z = \frac{R - \mu_R}{\sigma_R}$$
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0:$ urutan residual acak (tidak ada autokorelasi) &nbsp;&nbsp; $H_1:$ urutan residual tidak acak</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th>Hasil</th><th>Tafsir</th></tr></thead>
<tbody>
<tr><td>$R$ jauh di bawah $\mu_R$</td><td>Tanda sejenis bergerombol: autokorelasi positif</td></tr>
<tr><td>$R$ jauh di atas $\mu_R$</td><td>Tanda sering berganti: autokorelasi negatif</td></tr>
</tbody></table></div>
<p>$p$-value dua arah dihitung dari sebaran normal baku, $p = 2\,P(Z > |z|)$. Residual yang tepat nol dibuang.</p>
<div class="mt-box warn" data-label="Keterbatasan">
  <p>Aproksimasi normal kurang akurat bila $n$ kecil (di bawah sekitar 20), dan uji ini hanya mengukur keacakan tanda, bukan besar korelasi residual. Pasangkan dengan Durbin-Watson atau Breusch-Godfrey.</p>
</div>`
      },
      {
        id: 'contoh', title: 'Contoh hitung',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Data $n=5$: $X = 1,2,3,4,5$ dan $Y = 2,4,5,4,5$.</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th class="c">$X$</th><th class="c">$Y$</th><th class="c">$XY$</th><th class="c">$X^2$</th><th class="c">$Y^2$</th></tr></thead>
<tbody>
<tr><td class="c">1</td><td class="c">2</td><td class="c">2</td><td class="c">1</td><td class="c">4</td></tr>
<tr><td class="c">2</td><td class="c">4</td><td class="c">8</td><td class="c">4</td><td class="c">16</td></tr>
<tr><td class="c">3</td><td class="c">5</td><td class="c">15</td><td class="c">9</td><td class="c">25</td></tr>
<tr><td class="c">4</td><td class="c">4</td><td class="c">16</td><td class="c">16</td><td class="c">16</td></tr>
<tr><td class="c">5</td><td class="c">5</td><td class="c">25</td><td class="c">25</td><td class="c">25</td></tr>
<tr><td class="c"><strong>15</strong></td><td class="c"><strong>20</strong></td><td class="c"><strong>66</strong></td><td class="c"><strong>55</strong></td><td class="c"><strong>86</strong></td></tr>
</tbody></table></div>
<ol class="mt-steps">
  <li><strong>Slope:</strong> $b = \dfrac{5(66) - 15(20)}{5(55) - 15^2} = \dfrac{30}{50} = 0{,}6$.</li>
  <li><strong>Konstanta:</strong> $a = \dfrac{20 - 0{,}6(15)}{5} = 2{,}2$. Persamaan: $\hat{Y} = 2{,}2 + 0{,}6X$.</li>
  <li><strong>Korelasi:</strong> $r = \dfrac{30}{\sqrt{50 \times 30}} = 0{,}775$ (kuat). $R^2 = 0{,}60$, jadi 60% variasi $Y$ dijelaskan $X$. $R^2_{adj} = 1 - 0{,}4\cdot\dfrac{4}{3} = 0{,}467$.</li>
  <li><strong>Galat:</strong> $SSE = 86 - 2{,}2(20) - 0{,}6(66) = 2{,}4$ dan $S_e = \sqrt{2{,}4/3} = 0{,}894$. Selain itu $SST = 6$ dan $SSR = 3{,}6$.</li>
  <li><strong>Uji F:</strong> $F = \dfrac{3{,}6/1}{2{,}4/3} = 4{,}5$ dengan db $(1,3)$, $p = 0{,}124$. Karena $p \ge 0{,}05$, model <em>belum</em> signifikan pada taraf 5%.</li>
  <li><strong>Uji t slope:</strong> $SE(b) = \dfrac{0{,}894}{\sqrt{10}} = 0{,}283$ dan $t = \dfrac{0{,}6}{0{,}283} = 2{,}12$. Perhatikan $t^2 = 4{,}5 = F$, sehingga $p$ sama (0,124).</li>
</ol>
<div class="mt-box key" data-label="Kesimpulan contoh">
  <p>Hubungan positif dan cukup kuat terlihat pada sampel, tetapi dengan hanya 5 data belum cukup bukti untuk menyimpulkan adanya pengaruh pada populasi. Menambah data akan meningkatkan daya uji. Anda dapat mengetik data ini sendiri di kalkulator Regresi Linear untuk mencocokkan hasilnya.</p>
</div>`
      }
    ]
  });
})();
