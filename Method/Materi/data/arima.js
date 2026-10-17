/* Materi: ARIMA & SARIMA (Box-Jenkins) (terhubung ke Method/Stat/arima.js). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'arima', order: 7, method: 'arima', tone: 'rust',
    title: 'ARIMA & SARIMA', subtitle: 'Peramalan Box-Jenkins',
    desc: 'Model autoregresif terintegrasi rata-rata bergerak untuk data tanpa pola musiman (ARIMA) dan dengan pola musiman (SARIMA): identifikasi lewat ACF/PACF, estimasi, diagnostik Ljung-Box, ramalan, dan selang kepercayaan.',
    keywords: ['ARIMA', 'SARIMA', 'Box-Jenkins', 'autoregresif', 'AR', 'MA', 'moving average', 'diferensiasi', 'differencing', 'integrasi', 'musiman', 'seasonal', 'ACF', 'PACF', 'korelogram', 'Ljung-Box', 'white noise', 'residu', 'AIC', 'BIC', 'peramalan', 'forecast', 'deret waktu', 'time series', 'CSS', 'stasioner', 'invertibel', 'operator mundur', 'backshift', 'drift'],
    icon: '<path d="M3 15c2-4 3-7 5-7s2 6 4 6 3-8 5-8 2 6 4 6"/><path d="M15 17h6M18 14v6" />',
    sections: [
      {
        id: 'konsep', title: 'Konsep ARIMA dan kapan memakai SARIMA',
        html: String.raw`
<p>ARIMA (<em>AutoRegressive Integrated Moving Average</em>) meramalkan nilai deret waktu dari <strong>nilai-nilai masa lalunya sendiri</strong> dan <strong>galat peramalan masa lalu</strong>. Modelnya ditulis $\text{ARIMA}(p,d,q)$ dengan tiga orde:</p>
<ul>
  <li>$p$: orde <strong>AR</strong> (autoregresif), banyaknya lag nilai data yang dipakai.</li>
  <li>$d$: orde <strong>I</strong> (<em>integrated</em>), berapa kali data dibedakan agar stasioner.</li>
  <li>$q$: orde <strong>MA</strong> (rata-rata bergerak), banyaknya lag galat yang dipakai.</li>
</ul>
<p>Bila data memiliki <strong>pola musiman</strong> (naik-turun berulang tiap $s$ periode), ARIMA diperluas menjadi $\text{SARIMA}(p,d,q)(P,D,Q)_s$ dengan komponen AR, diferensiasi, dan MA tambahan yang bekerja pada lag kelipatan $s$.</p>
<div class="mt-box key" data-label="ARIMA atau SARIMA?">
  <div class="mt-tw"><table>
  <thead><tr><th>Ciri data</th><th>Model</th></tr></thead>
  <tbody>
  <tr><td>Hanya tren atau fluktuasi acak, tanpa pola yang berulang</td><td>ARIMA$(p,d,q)$</td></tr>
  <tr><td>Ada pola berulang tiap $s$ periode (bulanan $s=12$, triwulanan $s=4$, harian-mingguan $s=7$)</td><td>SARIMA$(p,d,q)(P,D,Q)_s$</td></tr>
  </tbody></table></div>
</div>
<p>Cara memeriksa musiman: (1) lihat grafik data, apakah bentuknya berulang; (2) lihat ACF, apakah ada puncak pada lag $s, 2s, 3s,\dots$. Aplikasi memberi petunjuk otomatis pada tab <em>Identifikasi</em>.</p>
<div class="mt-box note" data-label="SARIMA tidak selalu lebih baik">
  <p>SARIMA memiliki lebih banyak parameter. Bila data tidak berpola musiman, komponen musiman hanya menambah parameter yang tidak perlu dan dapat menurunkan kualitas model. Pakai ARIMA bila tidak ada musiman.</p>
</div>`
      },
      {
        id: 'komponen', title: 'Komponen AR, I, dan MA',
        html: String.raw`
<p>Gunakan operator mundur $B$ dengan $B\,Y_t = Y_{t-1}$ dan $B^k Y_t = Y_{t-k}$.</p>
<h3>AR($p$): autoregresif</h3>
$$Y_t = c + \phi_1 Y_{t-1} + \phi_2 Y_{t-2} + \dots + \phi_p Y_{t-p} + e_t$$
<p>Nilai sekarang bergantung pada $p$ nilai sebelumnya. Syarat <strong>stasioner</strong>: semua akar $1-\phi_1 z-\dots-\phi_p z^p = 0$ berada di luar lingkaran satuan. Untuk AR(1): $|\phi_1| \lt 1$.</p>
<h3>MA($q$): rata-rata bergerak galat</h3>
$$Y_t = c + e_t + \theta_1 e_{t-1} + \dots + \theta_q e_{t-q}$$
<p>Nilai sekarang dipengaruhi $q$ galat masa lalu. Syarat <strong>invertibel</strong>: akar $1+\theta_1 z+\dots+\theta_q z^q = 0$ berada di luar lingkaran satuan. Untuk MA(1): $|\theta_1| \lt 1$. Galat $e_t$ diasumsikan <em>white noise</em>: rata-rata nol, varians tetap, tidak berkorelasi.</p>
<h3>I($d$): diferensiasi</h3>
$$\nabla Y_t = (1-B)Y_t = Y_t - Y_{t-1}\qquad \nabla^2 Y_t = (1-B)^2 Y_t$$
<p>Diferensiasi pertama menghilangkan tren linear; kedua menghilangkan tren kuadratik. Pilih $d$ sekecil mungkin yang membuat data stasioner (biasanya 0, 1, atau 2). Gunakan menu <em>Uji Stasioneritas</em> untuk memastikan. Diferensiasi berlebihan membuat model tidak invertibel dan varians membesar.</p>
<h3>Model ARIMA lengkap</h3>
$$\phi(B)\,(1-B)^d\,(Y_t-\mu) = \theta(B)\,e_t$$
$$\phi(B)=1-\phi_1B-\dots-\phi_pB^p,\qquad \theta(B)=1+\theta_1B+\dots+\theta_qB^q$$
<div class="mt-box note" data-label="Konstanta">
  <p>Bila $d=0$, konstanta berarti rata-rata deret $\mu$. Bila ada diferensiasi, konstanta berarti <strong>drift</strong>: kecenderungan naik atau turun tetap tiap periode. Aktifkan hanya bila data bertren linear.</p>
</div>`
      },
      {
        id: 'sarima', title: 'SARIMA: menambahkan komponen musiman',
        html: String.raw`
<p>Misalkan musim berpanjang $s$. Komponen musiman bekerja pada lag $s, 2s, \dots$ lewat operator $B^s$:</p>
$$\phi(B)\,\Phi(B^s)\,(1-B)^d\,(1-B^s)^D\,(Y_t-\mu) = \theta(B)\,\Theta(B^s)\,e_t$$
$$\Phi(B^s)=1-\Phi_1B^s-\dots-\Phi_PB^{sP},\qquad \Theta(B^s)=1+\Theta_1B^s+\dots+\Theta_QB^{sQ}$$
<ul>
  <li>$P$: orde AR musiman, $Q$: orde MA musiman.</li>
  <li>$D$: diferensiasi musiman, $(1-B^s)Y_t = Y_t - Y_{t-s}$ (membandingkan dengan periode yang sama pada musim sebelumnya).</li>
  <li>$s$: panjang musim.</li>
</ul>
<p>Ketika $P=D=Q=0$, SARIMA sama dengan ARIMA. Karena itu aplikasi memakai satu mesin perhitungan yang sama untuk keduanya.</p>
<div class="mt-box ex" data-label="Contoh: model 'airline'">
  <p>$\text{SARIMA}(0,1,1)(0,1,1)_{12}$ untuk data bulanan: $(1-B)(1-B^{12})Y_t = (1+\theta_1B)(1+\Theta_1B^{12})e_t$. Model sederhana ini sering cukup baik untuk data bulanan bertren dan berpola musiman, sehingga bagus sebagai titik awal.</p>
</div>
<p>Perkalian faktor non-musiman dan musiman menimbulkan suku interaksi. Misalnya $(1-\phi_1B)(1-\Phi_1B^{s}) = 1-\phi_1B-\Phi_1B^{s}+\phi_1\Phi_1B^{s+1}$. Lihat tab <em>Langkah Perhitungan</em> untuk polinomial gabungan dari model Anda.</p>`
      },
      {
        id: 'identifikasi', title: 'Identifikasi orde dengan ACF dan PACF',
        html: String.raw`
<p>Setelah data dibuat stasioner (diferensiasi $d$ dan $D$), orde ditentukan dari pola <strong>ACF</strong> (autokorelasi) dan <strong>PACF</strong> (autokorelasi parsial):</p>
<div class="mt-tw"><table>
<thead><tr><th>Model</th><th>ACF</th><th>PACF</th></tr></thead>
<tbody>
<tr><td>AR($p$)</td><td>Meluruh perlahan (eksponensial atau bergelombang)</td><td><strong>Terpotong</strong> setelah lag $p$</td></tr>
<tr><td>MA($q$)</td><td><strong>Terpotong</strong> setelah lag $q$</td><td>Meluruh perlahan</td></tr>
<tr><td>ARMA($p,q$)</td><td>Meluruh perlahan</td><td>Meluruh perlahan</td></tr>
</tbody></table></div>
<p>&ldquo;Terpotong&rdquo; berarti batang di dalam batas $\pm 1{,}96/\sqrt{n}$ (garis putus-putus) mulai lag tertentu. Pada data musiman, lihat <strong>lag kelipatan $s$</strong> (batang kuning di aplikasi) untuk menentukan $P$ dan $Q$:</p>
<ul>
  <li>ACF terpotong di lag $s$ (hanya lag $s$ signifikan di antara kelipatan $s$): $Q=1$.</li>
  <li>PACF terpotong di lag $s$: $P=1$.</li>
  <li>ACF data asli meluruh sangat lambat: butuh diferensiasi ($d \ge 1$). ACF berpuncak berulang tiap $s$ dan meluruh lambat: butuh diferensiasi musiman ($D=1$).</li>
</ul>
<p>Penentuan visual bersifat subjektif. Gunakan tab <em>Bandingkan Model</em> untuk mencoba beberapa orde sekaligus dan memilih dengan AIC.</p>
<div class="mt-box warn" data-label="Hati-hati">
  <p>Jangan menggabungkan $d + D$ terlalu besar (umumnya $d+D \le 2$). Diferensiasi berlebihan menambah derau dan sering muncul sebagai koefisien MA mendekati $-1$.</p>
</div>`
      },
      {
        id: 'estimasi', title: 'Estimasi parameter (CSS)',
        html: String.raw`
<p>Aplikasi memakai <strong>Conditional Sum of Squares</strong> (jumlah kuadrat galat bersyarat). Setelah diferensiasi menjadi $w_t$, galat dihitung berulang:</p>
$$e_t = \sum_{i=0}^{p^*} A_i\,(w_{t-i}-c) - \sum_{j=1}^{q^*} M_j\,e_{t-j}$$
<p>dengan $A(B)=\phi(B)\Phi(B^s)$ dan $M(B)=\theta(B)\Theta(B^s)$ hasil kali polinomial AR dan MA, serta $e_t=0$ untuk $t$ sebelum data pertama yang dapat dihitung. Parameter dipilih untuk meminimumkan</p>
$$\text{CSS}=\sum_t e_t^2$$
<p>memakai algoritma Levenberg-Marquardt, dibatasi pada daerah stasioner dan invertibel. Lalu:</p>
$$\hat\sigma^2 = \frac{\text{CSS}}{n_{\text{eff}}},\qquad \widehat{\text{Var}}(\hat\beta)=\hat\sigma^2\,(J^\top J)^{-1}$$
<p>$J$ adalah turunan galat terhadap parameter. Uji parameter memakai $z=\hat\beta/\text{SE}(\hat\beta)$ dengan $H_0:\beta=0$. Parameter dengan $p \gt 0{,}05$ dapat dipertimbangkan untuk dibuang.</p>
<p>Kriteria informasi untuk membandingkan model:</p>
$$\text{AIC}=-2\ln L + 2(k+1),\qquad \text{BIC}=-2\ln L + (k+1)\ln n_{\text{eff}}$$
<p>Nilai lebih kecil lebih baik; BIC menghukum parameter lebih berat. Karena CSS memotong sejumlah data awal yang berbeda tergantung orde, AIC/BIC di aplikasi adalah <strong>pendekatan</strong>; selisih kecil (&lt; 2) jangan dianggap meyakinkan.</p>`
      },
      {
        id: 'diagnostik', title: 'Diagnostik residu',
        html: String.raw`
<p>Model yang memadai menangkap seluruh pola, sehingga residunya hanya <em>white noise</em>.</p>
<h3>Uji Ljung-Box</h3>
<p>$H_0$: residu tidak berautokorelasi sampai lag $m$.</p>
$$Q = n(n+2)\sum_{k=1}^{m}\frac{r_k^2}{n-k}\ \sim\ \chi^2_{\,m-(p+q+P+Q)}$$
<ul>
  <li>$p \gt 0{,}05$: $H_0$ tidak ditolak, residu white noise, model memadai (<strong>hasil yang diharapkan</strong>).</li>
  <li>$p \le 0{,}05$: masih ada autokorelasi, tambah orde AR/MA (atau komponen musiman).</li>
</ul>
<p>Aplikasi memakai $m=10$ (atau $m=2s$ untuk SARIMA, dibatasi oleh banyaknya data).</p>
<h3>Uji Jarque-Bera</h3>
<p>Menguji kenormalan residu lewat skewness dan kurtosis: $JB=\frac{n}{6}\left(S^2+\frac{(K-3)^2}{4}\right)\sim\chi^2_2$. Kenormalan dibutuhkan agar selang kepercayaan ramalan akurat.</p>
<p>Periksa pula <strong>grafik residu</strong> (acak di sekitar nol, tanpa pola atau pencilan) dan <strong>ACF residu</strong> (semua batang di dalam batas).</p>`
      },
      {
        id: 'ramalan', title: 'Ramalan dan selang kepercayaan',
        html: String.raw`
<p>Ramalan dihitung rekursif: nilai masa depan dihitung dari model dengan galat masa depan diganti nol, dan ramalan sebelumnya dipakai sebagai masukan untuk langkah berikutnya. Setelah itu deret hasil diferensiasi dikembalikan ke skala data asli.</p>
<p>Galat baku ramalan $h$ langkah memakai bobot $\psi$ dari representasi MA tak hingga model ($\psi_0=1$):</p>
$$\text{Var}(h)=\hat\sigma^2\sum_{j=0}^{h-1}\psi_j^2,\qquad \text{Selang 95\%}: \hat Y_{n+h}\pm 1{,}96\sqrt{\text{Var}(h)}$$
<ul>
  <li>Selang <strong>melebar</strong> seiring $h$: makin jauh makin tidak pasti.</li>
  <li>Pada model dengan diferensiasi, selang melebar lebih cepat karena ketidakpastian menumpuk.</li>
  <li>Ramalan SARIMA mengulang pola musiman dari data terakhir, sedangkan ARIMA tanpa musiman cenderung mendatar atau mengikuti tren/drift.</li>
</ul>
<div class="mt-box warn" data-label="Batasan">
  <p>Selang kepercayaan mengasumsikan model benar dan residu normal, serta tidak memperhitungkan ketidakpastian estimasi parameter. Ramalan jauh ke depan sebaiknya diperlakukan hati-hati.</p>
</div>`
      },
      {
        id: 'langkah', title: 'Alur penggunaan dan cara membaca hasil',
        html: String.raw`
<ol class="mt-steps">
  <li><strong>Plot data</strong> dan periksa tren serta pola musiman.</li>
  <li><strong>Tentukan $d$ (dan $D$)</strong> agar stasioner, misalnya dengan Uji Stasioneritas (ADF/KPSS). Bila ada pola berulang tiap $s$ periode, pilih <strong>SARIMA</strong> dan isi $s$; bila tidak, pilih <strong>ARIMA</strong>.</li>
  <li><strong>Lihat ACF/PACF</strong> deret hasil diferensiasi untuk menentukan $p,q$ (dan $P,Q$).</li>
  <li><strong>Estimasi</strong> beberapa model kandidat, bandingkan AIC/BIC (tab <em>Bandingkan Model</em>).</li>
  <li><strong>Periksa diagnostik</strong>: Ljung-Box $p \gt 0{,}05$, residu acak, parameter signifikan, model stasioner dan invertibel.</li>
  <li><strong>Ramalkan</strong> dan evaluasi dengan MAPE/RMSE. Bila memungkinkan, uji pada data yang disisihkan (tidak dipakai saat estimasi).</li>
</ol>
<div class="mt-box ex" data-label="Contoh membaca hasil">
  <p>Misal diperoleh $\hat\phi_1=0{,}47$ dengan $p=0{,}001$ (signifikan), Ljung-Box $p=0{,}41$, dan MAPE $=0{,}8\%$. Artinya model AR(1) pada deret yang dibedakan memadai: residu white noise dan akurasi sangat baik.</p>
  <p class="mt-hint-copy">Angka di atas hanya ilustrasi cara membaca, bukan hasil dari data tertentu.</p>
</div>
<h3>Keterbatasan</h3>
<ul>
  <li>Bersifat linear, jadi kurang cocok untuk data dengan perubahan struktural mendadak atau varians yang berubah (pertimbangkan transformasi Box-Cox atau logaritma terlebih dahulu).</li>
  <li>Membutuhkan data yang cukup: sebagai pedoman minimal 50 pengamatan, dan untuk SARIMA minimal 3 sampai 4 siklus musim penuh.</li>
  <li>Satu pola musiman saja. Untuk beberapa musiman sekaligus (misal harian dan mingguan) butuh model lain.</li>
</ul>`
      }
    ]
  });
})();
