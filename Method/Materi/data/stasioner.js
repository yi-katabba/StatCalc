/* Materi: Uji Stasioneritas - Box-Cox (varians) + ADF / Phillips-Perron / KPSS (mean) (terhubung ke Method/Stat/stasioner.js). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'stasioner', order: 6, method: 'stasioner', tone: 'gold',
    title: 'Uji Stasioneritas', subtitle: 'Box-Cox, ADF, Phillips-Perron & KPSS',
    desc: 'Stasioner dalam varians (transformasi Box-Cox) dan dalam mean (uji akar unit ADF, Phillips-Perron, KPSS), nilai kritis MacKinnon, pemilihan lag, dan diferensiasi.',
    keywords: ['stasioner', 'stasioneritas', 'akar unit', 'unit root', 'ADF', 'Phillips-Perron', 'PP', 'KPSS', 'Box-Cox', 'transformasi', 'varians', 'lambda', 'Dickey-Fuller', 'MacKinnon', 'tau', 'diferensiasi', 'differencing', 'random walk', 'lag', 'AIC', 'nilai kritis', 'integrasi', 'deret waktu', 'tren', 'konstanta'],
    icon: '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/><path d="M3 20h18" stroke-dasharray="2 3"/>',
    sections: [
      {
        id: 'konsep', title: 'Apa itu stasioneritas?',
        html: String.raw`
<p>Deret waktu $Y_t$ disebut <strong>stasioner</strong> (secara lemah) bila sifat statistiknya tidak berubah menurut waktu:</p>
<div class="mt-box def" data-label="Syarat stasioner lemah">
  <ol>
    <li>Rata-rata konstan: $E(Y_t) = \mu$ untuk semua $t$.</li>
    <li>Ragam konstan: $\mathrm{Var}(Y_t) = \sigma^2$ untuk semua $t$.</li>
    <li>Kovarians hanya bergantung pada jarak waktu (lag) $k$, bukan pada waktu $t$: $\mathrm{Cov}(Y_t, Y_{t+k}) = \gamma_k$.</li>
  </ol>
</div>
<p>Secara visual, deret stasioner berfluktuasi di sekitar rata-rata tetap dengan lebar sebaran yang kira-kira sama, tanpa tren naik atau turun yang jelas.</p>
<h3>Mengapa penting?</h3>
<ul>
  <li>Banyak model deret waktu (AR, MA, ARIMA) mensyaratkan data stasioner.</li>
  <li>Regresi antara dua deret yang tidak stasioner dapat menghasilkan <strong>regresi lancung</strong> (<em>spurious regression</em>): $R^2$ tinggi dan uji t signifikan padahal kedua variabel tidak berhubungan sama sekali.</li>
  <li>Pada deret tidak stasioner, guncangan bersifat permanen sehingga ramalan jangka panjang tidak punya titik kembali.</li>
</ul>
<div class="mt-box note" data-label="Cek visual dulu">
  <p>Grafik data dan grafik <strong>ACF</strong> (autokorelasi) di tab Grafik membantu. ACF yang meluruh sangat lambat menandakan data belum stasioner, sedangkan ACF yang cepat turun mendekati nol menandakan stasioner. Uji ADF memberi keputusan yang formal.</p>
</div>`
      },
      {
        id: 'dua-tahap', title: 'Stasioner dalam varians dan dalam mean',
        html: String.raw`
<p>Stasioneritas lemah punya dua sisi yang diperiksa dengan alat berbeda, dan urutannya penting:</p>
<div class="mt-tw"><table>
<thead><tr><th>Tahap</th><th>Yang diperiksa</th><th>Alat di aplikasi</th><th>Bila tidak terpenuhi</th></tr></thead>
<tbody>
<tr><td><strong>1</strong></td><td>Varians konstan, $\mathrm{Var}(Y_t)=\sigma^2$</td><td>Grafik &amp; selang kepercayaan Box-Cox</td><td>Transformasi (log, akar kuadrat, kebalikan, dst.)</td></tr>
<tr><td><strong>2</strong></td><td>Rata-rata konstan, $E(Y_t)=\mu$</td><td>Uji akar unit: ADF, Phillips-Perron, KPSS</td><td>Diferensiasi</td></tr>
</tbody></table></div>
<div class="mt-box key" data-label="Mengapa varians dulu?">
  <p>Diferensiasi mengubah skala data (selisih, bukan nilai asli) dan tidak bisa mengambil logaritma dari nilai negatif. Karena itu data distabilkan variansnya terlebih dahulu dengan Box-Cox, baru dibuat stasioner dalam mean dengan diferensiasi.</p>
</div>
<p>Data dinyatakan <strong>stasioner penuh</strong> bila kedua tahap terpenuhi.</p>`
      },
      {
        id: 'boxcox', title: 'Tahap 1: Transformasi Box-Cox (varians)',
        html: String.raw`
<p>Transformasi Box-Cox menstabilkan varians dengan keluarga transformasi berparameter $\lambda$:</p>
$$Y^{(\lambda)} = \begin{cases} \dfrac{Y^{\lambda}-1}{\lambda}, & \lambda \ne 0 \\[2mm] \ln Y, & \lambda = 0 \end{cases}\qquad (Y\gt 0)$$
<div class="mt-tw"><table>
<thead><tr><th>$\lambda$</th><th>Transformasi</th></tr></thead>
<tbody>
<tr><td>$-1$</td><td>Kebalikan, $1/Y$</td></tr>
<tr><td>$-0{,}5$</td><td>Kebalikan akar kuadrat, $1/\sqrt{Y}$</td></tr>
<tr><td>$0$</td><td>Logaritma natural, $\ln Y$</td></tr>
<tr><td>$0{,}5$</td><td>Akar kuadrat, $\sqrt{Y}$</td></tr>
<tr><td>$1$</td><td>Tanpa transformasi (hanya digeser)</td></tr>
<tr><td>$2$</td><td>Kuadrat, $Y^2$</td></tr>
</tbody></table></div>
<h3>Cara membaca grafik Box-Cox</h3>
<p>Aplikasi menghitung simpangan baku data hasil transformasi yang diskalakan dengan rata-rata geometrik $GM$ agar sebanding antar-$\lambda$:</p>
$$W(\lambda)=\frac{Y^{\lambda}-1}{\lambda\,GM^{\lambda-1}}\quad(\lambda\neq 0),\qquad W(0)=GM\cdot\ln Y$$
<ul>
  <li><strong>Sumbu x</strong>: nilai $\lambda$. <strong>Sumbu y</strong>: StDev dari $W(\lambda)$.</li>
  <li><strong>Estimate</strong>: $\hat\lambda$, yaitu $\lambda$ pada titik terendah kurva (meminimalkan StDev sama dengan memaksimalkan likelihood).</li>
  <li><strong>Limit</strong> (garis datar putus-putus): batas selang kepercayaan 95%.
    $$\text{Limit}=SD_{\min}\cdot\exp\!\left(\frac{\chi^2_{0{,}95;1}}{2n}\right),\qquad \chi^2_{0{,}95;1}=3{,}841$$</li>
  <li><strong>Lower CL / Upper CL</strong> (garis tegak putus-putus): $\lambda$ di kiri dan kanan estimasi tempat kurva memotong Limit.</li>
  <li><strong>Rounded value</strong>: $\lambda$ bulat (mis. $-1; -0{,}5; 0; 0{,}5; 1; 2$) yang masih berada dalam selang dan paling dekat dengan estimasi. Nilai ini lebih mudah ditafsirkan.</li>
</ul>
<div class="mt-box key" data-label="Aturan keputusan">
  <p>Bila selang kepercayaan 95% <strong>memuat 1</strong> (kurva di $\lambda=1$ berada di bawah Limit), varians sudah stabil dan data <strong>tidak perlu</strong> ditransformasi. Bila tidak memuat 1, gunakan $\lambda$ bulat.</p>
  <p>Ini setara uji rasio likelihood $H_0:\lambda=1$ dengan statistik $\chi^2 = 2n\ln(SD_{1}/SD_{\min})$, db = 1.</p>
</div>
<div class="mt-box ex" data-label="Contoh membaca">
  <p>Estimasi $\hat\lambda=-0{,}06$, selang $[-1{,}59;\,1{,}23]$, rounded value $0{,}00$. Karena selang memuat 1, varians dianggap stabil. Seandainya selang adalah $[-1{,}59;\,0{,}80]$, selang tidak memuat 1 sehingga data ditransformasi dengan $\lambda=0$, yaitu $\ln Y$.</p>
  <p class="mt-hint-copy">Angka di atas hanya ilustrasi cara membaca grafik.</p>
</div>
<div class="mt-box warn" data-label="Perhatian">
  <ul>
    <li>Box-Cox mensyaratkan data positif. Bila ada nilai $\le 0$, aplikasi menambahkan konstanta ke seluruh data lebih dulu.</li>
    <li>Pada data bertren kuat, tren ikut memengaruhi StDev sehingga $\hat\lambda$ bisa kurang tegas. Periksa juga grafik data asli.</li>
    <li>Selang yang sangat lebar berarti data kurang informatif untuk memilih $\lambda$.</li>
  </ul>
</div>`
      },
      {
        id: 'akar-unit', title: 'Akar unit dan random walk',
        html: String.raw`
<p>Contoh paling sederhana deret tidak stasioner adalah <strong>random walk</strong>, yaitu nilai sekarang sama dengan nilai sebelumnya ditambah guncangan acak. Ia merupakan kasus khusus model autoregresif AR(1):</p>
$$Y_t = \rho\,Y_{t-1} + e_t\qquad e_t \sim \text{galat acak (white noise)}$$
<ul>
  <li>$|\rho| \lt 1$: pengaruh guncangan memudar, sehingga deret <strong>stasioner</strong>.</li>
  <li>$\rho = 1$: guncangan bertahan selamanya (random walk), disebut memiliki <strong>akar unit</strong>, sehingga deret <strong>tidak stasioner</strong>. Ragamnya terus membesar: $\mathrm{Var}(Y_t) = t\sigma^2$.</li>
</ul>
<p>Mengurangkan $Y_{t-1}$ dari kedua ruas menghasilkan bentuk yang dipakai untuk uji:</p>
$$\Delta Y_t = Y_t - Y_{t-1} = (\rho - 1)\,Y_{t-1} + e_t = \gamma\,Y_{t-1} + e_t,\qquad \gamma = \rho - 1$$
<p>Maka menguji akar unit ($\rho = 1$) sama dengan menguji apakah $\gamma = 0$.</p>`
      },
      {
        id: 'adf', title: 'Persamaan dan hipotesis uji ADF',
        html: String.raw`
<p>Uji <em>Dickey-Fuller</em> asli mengasumsikan galat tidak berautokorelasi. Uji <strong>Augmented</strong> Dickey-Fuller (ADF) menambahkan $p$ suku selisih berlag agar galat menjadi acak. Persamaan regresi yang diestimasi aplikasi dengan OLS:</p>
$$\Delta z_t = \alpha + \delta\,t + \gamma\,z_{t-1} + \varphi_1\Delta z_{t-1} + \dots + \varphi_p\Delta z_{t-p} + e_t$$
<p>dengan $z_t$ adalah deret yang diuji (data asli atau hasil diferensiasi). Koefisien yang menjadi pusat uji adalah $\gamma$ pada $z_{t-1}$.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0: \gamma = 0$ (ada akar unit, data <strong>tidak stasioner</strong>)</p>
  <p>$H_1: \gamma \lt 0$ (tidak ada akar unit, data <strong>stasioner</strong>)</p>
</div>
<p>Ini uji <strong>satu sisi (ekor kiri)</strong>. Nilai $\gamma$ positif berarti deret bersifat eksplosif dan tidak termasuk $H_1$.</p>
<h3>Statistik uji</h3>
$$\tau = \frac{\hat{\gamma}}{SE(\hat{\gamma})}$$
<p>Rumusnya sama dengan t hitung biasa, tetapi di bawah $H_0$ ia <strong>tidak mengikuti distribusi t</strong>. Karena deret tidak stasioner, distribusinya bergeser ke kiri dan ekor kirinya lebih panjang, sehingga dipakai distribusi Dickey-Fuller. Memakai tabel t biasa akan terlalu sering menyimpulkan &ldquo;stasioner&rdquo;.</p>`
      },
      {
        id: 'model', title: 'Tiga pilihan model uji',
        html: String.raw`
<p>Pilih model sesuai bentuk data. Kesalahan memilih model dapat memengaruhi hasil.</p>
<div class="mt-tw"><table>
<thead><tr><th>Model di aplikasi</th><th>Persamaan (tanpa lag)</th><th>Pilih bila</th></tr></thead>
<tbody>
<tr><td>Tanpa konstanta &amp; tren (<em>none</em>)</td><td>$\Delta z_t = \gamma z_{t-1} + e_t$</td><td>Data berfluktuasi di sekitar nol (misal hasil diferensiasi atau residual).</td></tr>
<tr><td>Dengan konstanta (<em>constant</em>)</td><td>$\Delta z_t = \alpha + \gamma z_{t-1} + e_t$</td><td>Data berfluktuasi di sekitar rata-rata bukan nol, tanpa tren jelas. <strong>Pilihan paling umum.</strong></td></tr>
<tr><td>Dengan konstanta &amp; tren (<em>trend</em>)</td><td>$\Delta z_t = \alpha + \delta t + \gamma z_{t-1} + e_t$</td><td>Data tampak naik atau turun secara teratur menurut waktu.</td></tr>
</tbody></table></div>
<div class="mt-box note" data-label="Tips">
  <p>Lihat grafik &ldquo;Deret data asli&rdquo; di tab Grafik. Ada tren yang jelas: pilih konstanta &amp; tren. Berfluktuasi di sekitar garis datar tetapi bukan nol: pilih konstanta. Bila ragu, jalankan ketiganya dan lihat apakah kesimpulannya konsisten.</p>
</div>`
      },
      {
        id: 'kritis', title: 'Nilai kritis dan p-value (MacKinnon)',
        html: String.raw`
<p>Karena distribusi $\tau$ khusus, nilai kritis dan p-value diambil dari pendekatan <strong>MacKinnon (2010)</strong>. Nilai kritis bergantung pada model uji dan banyak observasi $N$ yang dipakai di regresi:</p>
$$C(\alpha, N) = \beta_\infty + \frac{\beta_1}{N} + \frac{\beta_2}{N^2} + \frac{\beta_3}{N^3}$$
<p>Untuk sampel besar ($N \to \infty$) nilai kritisnya mendekati:</p>
<div class="mt-tw"><table>
<thead><tr><th>Model</th><th class="c">1%</th><th class="c">5%</th><th class="c">10%</th></tr></thead>
<tbody>
<tr><td>Tanpa konstanta &amp; tren</td><td class="c">$-2{,}56$</td><td class="c">$-1{,}94$</td><td class="c">$-1{,}62$</td></tr>
<tr><td>Dengan konstanta</td><td class="c">$-3{,}43$</td><td class="c">$-2{,}86$</td><td class="c">$-2{,}57$</td></tr>
<tr><td>Dengan konstanta &amp; tren</td><td class="c">$-3{,}96$</td><td class="c">$-3{,}41$</td><td class="c">$-3{,}13$</td></tr>
</tbody></table></div>
<p>Pada sampel kecil, nilai kritis lebih negatif dari angka di atas, dan aplikasi menghitungnya sesuai $N$ Anda.</p>
<div class="mt-box key" data-label="Aturan keputusan (taraf 5%)">
  <p>$$\tau \lt C_{5\%} \;\Rightarrow\; \text{tolak } H_0\ (\text{stasioner}) \qquad\qquad \tau \ge C_{5\%} \;\Rightarrow\; \text{gagal tolak } H_0\ (\text{tidak stasioner})$$</p>
</div>
<p><strong>Ingat:</strong> yang dibandingkan adalah <em>lebih negatif</em>. $\tau = -3{,}8$ lebih kecil dari $-2{,}86$, sehingga stasioner. $\tau = -1{,}5$ tidak lebih kecil dari $-2{,}86$, sehingga tidak stasioner.</p>
<div class="mt-box note" data-label="p-value">
  <p>p-value MacKinnon bersifat asimtotik, sedangkan nilai kritis sudah dikoreksi ukuran sampel. Pada sampel kecil keduanya bisa berbeda tipis di dekat batas 0,05. Aplikasi menjadikan perbandingan dengan nilai kritis sebagai keputusan utama, dan p-value sebagai pendamping.</p>
</div>`
      },
      {
        id: 'pp', title: 'Uji Phillips-Perron (PP)',
        html: String.raw`
<p>Phillips-Perron adalah alternatif ADF dengan hipotesis yang sama. Perbedaannya hanya cara menangani autokorelasi (dan heteroskedastisitas) pada galat:</p>
<ul>
  <li><strong>ADF</strong> menambahkan suku $\Delta z_{t-i}$ ke regresi (parametrik).</li>
  <li><strong>PP</strong> memakai regresi Dickey-Fuller <em>tanpa lag</em>, lalu mengoreksi statistik $\tau$ secara <strong>nonparametrik</strong> memakai ragam jangka panjang Newey-West.</li>
</ul>
<p>Regresinya: $\Delta z_t = \alpha + \delta t + \gamma z_{t-1} + u_t$, dengan $H_0:\gamma=0$ (akar unit) dan $H_1:\gamma\lt 0$ (stasioner).</p>
<h3>Statistik $Z(\tau)$</h3>
$$Z_\tau=\sqrt{\frac{\hat\gamma_0}{\hat\lambda^2}}\;\tau\;-\;\frac12\,\frac{\hat\lambda^2-\hat\gamma_0}{\hat\lambda}\cdot\frac{n\,SE(\hat\gamma)}{s}$$
<p>dengan $\hat\gamma_0=SSE/n$, $s^2=SSE/(n-k)$, dan ragam jangka panjang (bobot Bartlett, bandwidth $l$):</p>
$$\hat\lambda^2=\hat\gamma_0+2\sum_{j=1}^{l}\left(1-\frac{j}{l+1}\right)\hat\gamma_j,\qquad \hat\gamma_j=\frac1n\sum_{t=j+1}^{n}u_t u_{t-j}$$
<p>Aplikasi memakai bandwidth otomatis $l=\lfloor 4\,(n/100)^{1/4}\rfloor$, atau nilai manual 0-12.</p>
<div class="mt-box key" data-label="Keputusan">
  <p>$Z_\tau$ memiliki distribusi asimtotik yang sama dengan $\tau$ Dickey-Fuller, sehingga memakai nilai kritis MacKinnon yang sama: $Z_\tau\lt C_{5\%}\Rightarrow$ tolak $H_0$ (stasioner). Bila galat tidak berautokorelasi ($\hat\lambda^2=\hat\gamma_0$), $Z_\tau=\tau$.</p>
</div>
<h3>ADF atau PP?</h3>
<ul>
  <li>PP tidak perlu memilih jumlah lag, dan tahan terhadap heteroskedastisitas pada galat.</li>
  <li>PP bisa kurang andal pada sampel kecil atau bila ada galat dengan autokorelasi negatif kuat (distorsi ukuran uji). ADF lebih umum dipakai sebagai uji utama.</li>
  <li>Praktik yang baik: jalankan keduanya. Bila keduanya sepakat, kesimpulan lebih meyakinkan.</li>
</ul>`
      },
      {
        id: 'kpss', title: 'Uji KPSS (hipotesis nol stasioner)',
        html: String.raw`
<p>KPSS membalik hipotesis ADF dan PP:</p>
<div class="mt-box def" data-label="Hipotesis KPSS">
  <p>$H_0$: deret <strong>stasioner</strong> (di sekitar level atau tren deterministik).</p>
  <p>$H_1$: deret mengandung akar unit (<strong>tidak stasioner</strong>).</p>
</div>
<p>Langkahnya: regresikan $z_t$ pada konstanta (model <em>level</em>) atau konstanta dan tren, ambil galat $e_t$, lalu hitung jumlah parsialnya $S_t=\sum_{i=1}^{t}e_i$.</p>
$$\eta=\frac{\sum_{t=1}^{n}S_t^{2}}{n^{2}\,\hat\sigma^{2}(l)},\qquad \hat\sigma^{2}(l)=\hat\gamma_0+2\sum_{j=1}^{l}\left(1-\frac{j}{l+1}\right)\hat\gamma_j$$
<p>Bila deret stasioner, $S_t$ tidak menyimpang jauh dari nol sehingga $\eta$ kecil. Pada akar unit, $S_t$ membesar dan $\eta$ besar.</p>
<div class="mt-tw"><table>
<thead><tr><th>Model</th><th class="c">10%</th><th class="c">5%</th><th class="c">2,5%</th><th class="c">1%</th></tr></thead>
<tbody>
<tr><td>Level (konstanta)</td><td class="c">$0{,}347$</td><td class="c">$0{,}463$</td><td class="c">$0{,}574$</td><td class="c">$0{,}739$</td></tr>
<tr><td>Tren (konstanta &amp; tren)</td><td class="c">$0{,}119$</td><td class="c">$0{,}146$</td><td class="c">$0{,}176$</td><td class="c">$0{,}216$</td></tr>
</tbody></table></div>
<div class="mt-box key" data-label="Arah keputusan kebalikan ADF/PP">
  <p>$\eta\lt C_{5\%}\Rightarrow$ gagal tolak $H_0$ (stasioner). $\eta\gt C_{5\%}\Rightarrow$ tolak $H_0$ (tidak stasioner).</p>
</div>
<h3>Menggabungkan ADF/PP dengan KPSS</h3>
<div class="mt-tw"><table>
<thead><tr><th>ADF / PP</th><th>KPSS</th><th>Kesimpulan</th></tr></thead>
<tbody>
<tr><td>Tolak $H_0$</td><td>Gagal tolak $H_0$</td><td>Stasioner (kedua uji sepakat)</td></tr>
<tr><td>Gagal tolak $H_0$</td><td>Tolak $H_0$</td><td>Tidak stasioner (kedua uji sepakat)</td></tr>
<tr><td>Tolak $H_0$</td><td>Tolak $H_0$</td><td>Tidak pasti; mungkin stasioner-tren atau ada perubahan struktural. Coba model tren atau diferensiasi.</td></tr>
<tr><td>Gagal tolak $H_0$</td><td>Gagal tolak $H_0$</td><td>Tidak pasti; data kurang informatif (sampel kecil).</td></tr>
</tbody></table></div>
<p>Pilihan &ldquo;Bandingkan ketiganya&rdquo; di aplikasi menjalankan ADF, PP, dan KPSS sekaligus pada data yang sama.</p>
<p><strong>Catatan:</strong> p-value KPSS diperoleh dengan interpolasi tabel titik kritis, sehingga hanya berkisar 0,01 sampai 0,10.</p>`
      },
      {
        id: 'lag', title: 'Memilih jumlah lag (AIC)',
        html: String.raw`
<p>Suku $\Delta z_{t-i}$ dalam ADF menyerap autokorelasi pada galat. Terlalu sedikit lag membuat galat masih berautokorelasi (uji bias), sedangkan terlalu banyak lag menurunkan daya uji.</p>
<p>Pada mode <strong>otomatis</strong>, aplikasi memilih $p$ dengan kriteria informasi Akaike (AIC), yaitu lag dengan AIC terkecil:</p>
$$AIC = n\,\ln\!\left(\frac{SSE}{n}\right) + 2k$$
<p>dengan $n$ banyaknya observasi di regresi, $SSE$ jumlah kuadrat galat, dan $k$ banyaknya parameter. Suku $2k$ menghukum model yang terlalu rumit.</p>
<h3>Lag maksimum</h3>
<p>Kandidat lag dari 0 hingga lag maksimum. Aturan umum (Schwert) menyarankan:</p>
$$p_{\max} = \left\lceil 12\left(\frac{N}{100}\right)^{1/4}\right\rceil$$
<p>Aplikasi juga membatasinya agar derajat bebas tetap cukup pada data pendek. Semua kandidat lag dibandingkan pada sampel observasi yang sama agar AIC-nya sebanding. Grafik &ldquo;AIC menurut jumlah lag&rdquo; menampilkan hasilnya, dan lag terpilih adalah batang terendah.</p>
<div class="mt-box note" data-label="Mode manual">
  <p>Anda juga dapat menentukan lag sendiri (0 sampai 12). Lag 0 sama dengan uji Dickey-Fuller biasa (tanpa augmentasi).</p>
</div>`
      },
      {
        id: 'diferensiasi', title: 'Diferensiasi dan orde integrasi',
        html: String.raw`
<p>Bila data tidak stasioner, cara umum membuatnya stasioner adalah <strong>diferensiasi</strong>, yaitu mengambil selisih antarperiode:</p>
$$\Delta Y_t = Y_t - Y_{t-1}\qquad\qquad \Delta^2 Y_t = \Delta Y_t - \Delta Y_{t-1}$$
<ul>
  <li>Setiap diferensiasi menghilangkan satu data di awal deret.</li>
  <li>Selisih menghilangkan tren linear (diferensi pertama) atau tren kuadratik (diferensi kedua).</li>
</ul>
<div class="mt-box def" data-label="Orde integrasi">
  <p>Deret dikatakan <strong>terintegrasi orde $d$</strong>, ditulis $I(d)$, bila ia baru stasioner setelah didiferensiasi $d$ kali.</p>
  <ul>
    <li>$I(0)$: sudah stasioner pada level.</li>
    <li>$I(1)$: stasioner setelah diferensi pertama (paling sering).</li>
    <li>$I(2)$: stasioner setelah diferensi kedua (jarang).</li>
  </ul>
</div>
<div class="mt-box warn" data-label="Jangan berlebihan">
  <p>Mendiferensiasi deret yang sudah stasioner (<em>over-differencing</em>) menambah autokorelasi negatif dan membuang informasi. Berhenti pada diferensi terendah yang sudah stasioner.</p>
</div>`
      },
      {
        id: 'langkah', title: 'Langkah pengujian dan cara membaca hasil',
        html: String.raw`
<ol class="mt-steps">
  <li><strong>Lihat grafik</strong> data asli dan ACF. Tentukan apakah ada tren (untuk memilih model).</li>
  <li><strong>Tahap 1, periksa varians</strong> dengan grafik Box-Cox. Bila selang $\lambda$ tidak memuat 1, transformasi data (aplikasi melakukannya otomatis pada mode &ldquo;otomatis&rdquo;).</li>
  <li><strong>Tahap 2, jalankan uji akar unit</strong> (ADF, PP, atau ketiganya) pada level (tanpa diferensiasi) dengan model yang sesuai dan lag otomatis.</li>
  <li>Bandingkan statistik uji dengan nilai kritis 5% (untuk KPSS arahnya kebalikan).
    <ul>
      <li>$\tau \lt C_{5\%}$: stasioner pada level, $I(0)$. Selesai.</li>
      <li>Selain itu: lanjut ke langkah 4.</li>
    </ul></li>
  <li><strong>Diferensiasi satu kali</strong>, lalu ulangi ADF pada data hasil diferensi (biasanya model <em>constant</em> atau <em>none</em>, karena tren sudah hilang).</li>
  <li>Bila masih belum stasioner, diferensiasi kedua. Jarang diperlukan.</li>
</ol>
<div class="mt-box ex" data-label="Contoh membaca hasil">
  <p>Model <em>constant</em>, lag terpilih 1, diperoleh $\tau = -1{,}45$ dengan nilai kritis 5% sebesar $-2{,}90$. Karena $-1{,}45 \ge -2{,}90$, $H_0$ gagal ditolak: data masih memiliki akar unit dan belum stasioner. Setelah diferensiasi satu kali diperoleh $\tau = -4{,}10 \lt -2{,}90$, sehingga $H_0$ ditolak: data stasioner pada diferensi pertama, atau $I(1)$.</p>
  <p class="mt-hint-copy">Angka di atas hanya ilustrasi cara membaca, bukan hasil dari data tertentu.</p>
</div>
<h3>Keterbatasan uji ADF</h3>
<ul>
  <li><strong>Daya rendah</strong> pada sampel kecil atau bila deret hampir akar unit ($\rho$ mendekati 1). Hasil &ldquo;tidak stasioner&rdquo; belum tentu berarti benar-benar punya akar unit.</li>
  <li><strong>Perubahan struktural</strong> (patahan mendadak) dapat membuat deret stasioner tampak seperti punya akar unit.</li>
  <li><strong>$H_0$ adalah tidak stasioner</strong>. Untuk meyakinkan, kombinasikan dengan grafik dan ACF, atau uji pelengkap yang berhipotesis nol stasioner (misal KPSS).</li>
  <li>Pilihan model (konstanta, tren) dan lag memengaruhi hasil, sehingga periksa konsistensinya.</li>
</ul>`
      }
    ]
  });
})();
