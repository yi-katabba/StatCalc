/* Materi: Regresi Linear (terhubung ke Method/Stat/regresi.js). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'regresi', order: 3, method: 'regresi', tone: 'navy',
    title: 'Regresi Linear', subtitle: 'Sederhana & Berganda',
    desc: 'Model, penaksiran kuadrat terkecil, R², uji F dan uji t, serta uji asumsi klasik (normalitas, multikolinearitas, heteroskedastisitas, autokorelasi).',
    keywords: ['regresi', 'OLS', 'kuadrat terkecil', 'koefisien', 'slope', 'intercept', 'R2', 'determinasi', 'adjusted', 'uji F', 'uji t', 'Jarque-Bera', 'VIF', 'multikolinearitas', 'Glejser', 'heteroskedastisitas', 'Durbin-Watson', 'autokorelasi', 'residual', 'asumsi klasik', 'korelasi'],
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
<p>Uji F dan uji t hanya dapat dipercaya bila asumsi berikut terpenuhi. Aplikasi memeriksa keempatnya di Langkah 4 setelah perhitungan:</p>
<div class="mt-tw"><table>
<thead><tr><th>Asumsi</th><th>Maksud</th><th>Uji di aplikasi</th></tr></thead>
<tbody>
<tr><td>Normalitas</td><td>Residual berdistribusi normal</td><td>Jarque-Bera</td></tr>
<tr><td>Non-multikolinearitas</td><td>Variabel $X$ tidak saling berkorelasi tinggi</td><td>VIF</td></tr>
<tr><td>Homoskedastisitas</td><td>Ragam residual konstan</td><td>Glejser</td></tr>
<tr><td>Non-autokorelasi</td><td>Residual saling bebas</td><td>Durbin-Watson</td></tr>
</tbody></table></div>
<p>Asumsi tambahan yang tidak diuji otomatis: hubungan benar-benar linear dan tidak ada variabel penting yang terlewat. Periksa dengan grafik residual dan scatter plot di tab Grafik.</p>
<div class="mt-box note" data-label="Catatan">
  <p>Multikolinearitas hanya relevan untuk regresi berganda. Autokorelasi paling bermakna bila data berurutan (misal deret waktu). Pada data lintas individu, urutan baris biasanya tidak bermakna.</p>
</div>`
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
  <p>Pada $n$ kecil, uji ini punya daya rendah dan p-value-nya hanya pendekatan asimtotik. Lihat juga Q-Q plot dan histogram residual di tab Grafik. Titik yang mengikuti garis menandakan residual mendekati normal.</p>
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
  <p>Transformasi $Y$ (misal logaritma), regresi terboboti (WLS), atau galat baku robust. Grafik residual yang melebar seperti corong (kipas) adalah tanda visualnya.</p>
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
