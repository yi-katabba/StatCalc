/* Materi: Metode Smoothing SMA, DMA, SES, DES, TES (terhubung ke Method/Stat/smoothing.js). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'smoothing', order: 5, method: 'smoothing', tone: 'teal',
    title: 'Metode Smoothing', subtitle: 'SMA, DMA, SES, DES & TES',
    desc: 'Peramalan deret waktu dengan rata-rata bergerak dan pemulusan eksponensial (Holt dan Winter), serta ukuran akurasi MSE dan MAPE.',
    keywords: ['smoothing', 'peramalan', 'forecast', 'deret waktu', 'time series', 'moving average', 'rata-rata bergerak', 'SMA', 'DMA', 'SES', 'DES', 'TES', 'Holt', 'Winter', 'eksponensial', 'alpha', 'beta', 'gamma', 'musiman', 'tren', 'MSE', 'MAPE', 'galat'],
    icon: '<path d="M4 19 10 9l4 5 6-10"/><circle cx="10" cy="9" r="1.4" fill="currentColor" stroke="none"/><circle cx="14" cy="14" r="1.4" fill="currentColor" stroke="none"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep smoothing dan peramalan',
        html: String.raw`
<p>Data deret waktu $Y_1, Y_2, \dots, Y_N$ (data berurutan menurut waktu) biasanya mengandung <strong>gangguan acak</strong> yang menutupi pola sebenarnya. Metode smoothing &ldquo;memulus&rdquo; data dengan merata-ratakan nilai-nilai terdekat, lalu memakai hasilnya sebagai <strong>ramalan</strong> $F_t$ untuk periode berikutnya.</p>
<p>Data deret waktu umumnya tersusun dari komponen:</p>
<ul>
  <li><strong>Level</strong>: tingkat dasar data.</li>
  <li><strong>Tren</strong>: kecenderungan naik atau turun jangka panjang.</li>
  <li><strong>Musiman</strong>: pola berulang pada periode tetap (misal tiap 4 kuartal atau 12 bulan).</li>
  <li><strong>Acak</strong>: gangguan yang tidak bisa diramalkan.</li>
</ul>
<div class="mt-box key" data-label="Ringkasan lima metode di aplikasi">
  <div class="mt-tw"><table>
  <thead><tr><th>Metode</th><th>Singkatan</th><th>Cocok untuk pola</th><th>Parameter</th></tr></thead>
  <tbody>
  <tr><td>Single Moving Average</td><td>SMA</td><td>Datar, tanpa tren</td><td>$n$</td></tr>
  <tr><td>Double Moving Average</td><td>DMA</td><td>Ada tren</td><td>$n$</td></tr>
  <tr><td>Single Exponential Smoothing</td><td>SES</td><td>Datar, tanpa tren</td><td>$\alpha$</td></tr>
  <tr><td>Double Exponential Smoothing (Holt)</td><td>DES</td><td>Ada tren</td><td>$\alpha, \beta$</td></tr>
  <tr><td>Triple Exponential Smoothing (Winter)</td><td>TES</td><td>Tren dan musiman</td><td>$\alpha, \beta, \gamma, L$</td></tr>
  </tbody></table></div>
</div>
<p>Notasi: $Y_t$ data aktual periode $t$, $F_t$ ramalan untuk periode $t$, $N$ banyaknya data. Periode ke-$(N+1)$ adalah ramalan di luar data.</p>`
      },
      {
        id: 'sma', title: 'Single Moving Average (SMA)',
        html: String.raw`
<p>Ramalan periode berikutnya adalah rata-rata dari $n$ data terbaru:</p>
$$F_{t+1} = \frac{Y_t + Y_{t-1} + \dots + Y_{t-n+1}}{n}$$
<ul>
  <li>$n$ <strong>besar</strong>: hasil lebih mulus, tetapi lambat mengikuti perubahan.</li>
  <li>$n$ <strong>kecil</strong>: lebih responsif, tetapi masih membawa banyak gangguan acak.</li>
  <li>Ramalan pertama baru tersedia setelah $n$ data terkumpul.</li>
</ul>
<div class="mt-box warn" data-label="Keterbatasan">
  <p>SMA tidak cocok untuk data bertren. Ramalannya selalu tertinggal di belakang data yang naik atau turun terus-menerus karena merata-ratakan nilai lama.</p>
</div>`
      },
      {
        id: 'dma', title: 'Double Moving Average (DMA)',
        html: String.raw`
<p>DMA merata-ratakan <em>hasil</em> rata-rata bergerak sekali lagi, lalu memakai selisihnya untuk menaksir tren dan mengoreksi ketertinggalan SMA.</p>
$$M'_t = \frac{Y_t + Y_{t-1} + \dots + Y_{t-n+1}}{n}\qquad M''_t = \frac{M'_t + M'_{t-1} + \dots + M'_{t-n+1}}{n}$$
$$a_t = 2M'_t - M''_t\qquad b_t = \frac{2}{n-1}\bigl(M'_t - M''_t\bigr)$$
$$F_{t+m} = a_t + b_t\,m$$
<ul>
  <li>$a_t$ adalah taksiran level terkini, dan $b_t$ adalah taksiran tren (pertambahan per periode).</li>
  <li>$m$ adalah berapa periode ke depan yang diramal. Untuk ramalan satu periode, $m=1$ sehingga $F_{t+1} = a_t + b_t$.</li>
  <li>$M''$ baru tersedia setelah ada $n$ nilai $M'$, jadi ramalan pertama muncul setelah sekitar $2n-1$ data.</li>
</ul>`
      },
      {
        id: 'ses', title: 'Single Exponential Smoothing (SES)',
        html: String.raw`
<p>SES memberi bobot yang <strong>menurun secara eksponensial</strong> pada data lama. Data terbaru paling berpengaruh. Hanya satu parameter, yaitu $\alpha$ ($0 \lt \alpha \lt 1$).</p>
$$F_{t+1} = \alpha\,Y_t + (1-\alpha)\,F_t\qquad\text{dengan inisialisasi } F_1 = Y_1$$
<p>Jika diuraikan, bobot data $k$ periode lalu adalah $\alpha(1-\alpha)^k$:</p>
$$F_{t+1} = \alpha Y_t + \alpha(1-\alpha)Y_{t-1} + \alpha(1-\alpha)^2 Y_{t-2} + \dots$$
<div class="mt-tw"><table>
<thead><tr><th>$\alpha$</th><th>Efek</th></tr></thead>
<tbody>
<tr><td>Mendekati 1</td><td>Sangat responsif pada data terbaru, ramalan kurang mulus.</td></tr>
<tr><td>Mendekati 0</td><td>Sangat mulus, tetapi lambat mengikuti perubahan.</td></tr>
</tbody></table></div>
<p>Nilai $\alpha$ umumnya dipilih dengan mencoba beberapa nilai (misal 0,1-0,9) dan memilih yang MSE atau MAPE-nya terkecil. Seperti SMA, SES tidak cocok untuk data bertren.</p>`
      },
      {
        id: 'des', title: 'Double Exponential Smoothing (Holt)',
        html: String.raw`
<p>Metode Holt menambahkan komponen <strong>tren</strong> pada SES, dengan dua parameter: $\alpha$ untuk level dan $\beta$ untuk tren.</p>
$$L_t = \alpha\,Y_t + (1-\alpha)\,(L_{t-1} + T_{t-1})$$
$$T_t = \beta\,(L_t - L_{t-1}) + (1-\beta)\,T_{t-1}$$
$$F_{t+1} = L_t + T_t$$
<p><strong>Inisialisasi</strong> (sesuai aplikasi): $L_1 = Y_1$ dan $T_1 = Y_2 - Y_1$.</p>
<ul>
  <li>$L_t$ memperbarui level dengan memadukan data baru $Y_t$ dan prediksi level $(L_{t-1}+T_{t-1})$.</li>
  <li>$T_t$ memperbarui tren dengan memadukan perubahan level terbaru dan tren sebelumnya.</li>
  <li>Karena ada tren, ramalan ke depan naik atau turun secara linear: $F_{t+m} = L_t + m\,T_t$.</li>
</ul>`
      },
      {
        id: 'tes', title: 'Triple Exponential Smoothing (Winter)',
        html: String.raw`
<p>Metode Winter menambahkan komponen <strong>musiman</strong>. Aplikasi memakai versi <strong>multiplikatif</strong>, yaitu pola musiman berupa faktor pengali (cocok bila fluktuasi musiman membesar seiring level). Parameternya $\alpha$ (level), $\beta$ (tren), $\gamma$ (musiman), dan panjang musim $L$ (misal $L = 4$ untuk data kuartalan).</p>
$$L_t = \alpha\,\frac{Y_t}{S_{t-L}} + (1-\alpha)\,(L_{t-1} + T_{t-1})$$
$$T_t = \beta\,(L_t - L_{t-1}) + (1-\beta)\,T_{t-1}$$
$$S_t = \gamma\,\frac{Y_t}{L_t} + (1-\gamma)\,S_{t-L}$$
$$F_{t+1} = (L_t + T_t)\,S_{t+1-L}$$
<h3>Inisialisasi (sesuai aplikasi)</h3>
<ol class="mt-steps">
  <li>Level awal $L_L$ = rata-rata musim pertama (periode $1$ sampai $L$).</li>
  <li>Tren awal $T_L = \dfrac{\bar{Y}_{\text{musim 2}} - \bar{Y}_{\text{musim 1}}}{L}$, dari selisih rata-rata musim kedua dan pertama.</li>
  <li>Indeks musiman awal $S_i = \dfrac{Y_i}{\bar{Y}_{\text{musim 1}}}$ untuk $i = 1, \dots, L$.</li>
</ol>
<div class="mt-box note" data-label="Syarat data">
  <p>Dibutuhkan minimal <strong>dua musim penuh</strong> data ($N \ge 2L$) agar level, tren, dan indeks musiman awal dapat ditaksir. Indeks musiman bernilai sekitar 1: $S = 1{,}2$ berarti periode itu 20% di atas rata-rata, dan $S = 0{,}8$ berarti 20% di bawahnya.</p>
</div>`
      },
      {
        id: 'error', title: 'Mengukur akurasi: MSE dan MAPE',
        html: String.raw`
<p>Galat ramalan periode $t$ adalah $e_t = Y_t - F_t$. Aplikasi merangkumnya dalam dua ukuran, dihitung hanya pada periode yang punya ramalan (sebanyak $m$ periode):</p>
$$MSE = \frac{\sum_{t}(Y_t - F_t)^2}{m}\qquad\qquad MAPE = \frac{\sum_{t}\left|\dfrac{Y_t - F_t}{Y_t}\right|}{m}\times 100\%$$
<ul>
  <li><strong>MSE</strong> (<em>mean squared error</em>): rata-rata kuadrat galat. Menghukum galat besar dengan berat, dan satuannya kuadrat dari satuan data.</li>
  <li><strong>MAPE</strong> (<em>mean absolute percentage error</em>): rata-rata galat dalam persen, tanpa satuan sehingga mudah dibandingkan antar data. Tidak dapat dihitung untuk periode dengan $Y_t = 0$.</li>
</ul>
<h3>Kriteria MAPE (Lewis, 1982)</h3>
<div class="mt-tw"><table>
<thead><tr><th>MAPE</th><th>Kemampuan peramalan</th></tr></thead>
<tbody>
<tr><td>$\lt 10\%$</td><td>Sangat akurat</td></tr>
<tr><td>$10\%$ - $20\%$</td><td>Akurat</td></tr>
<tr><td>$20\%$ - $50\%$</td><td>Cukup akurat</td></tr>
<tr><td>$> 50\%$</td><td>Tidak akurat</td></tr>
</tbody></table></div>
<div class="mt-box key" data-label="Memilih metode dan parameter">
  <ol>
    <li>Lihat grafik data: apakah datar, bertren, atau ada pola musiman? Pilih metode sesuai tabel di bagian pertama.</li>
    <li>Coba beberapa parameter ($n$ atau $\alpha$, $\beta$, $\gamma$).</li>
    <li>Pilih yang MSE dan MAPE-nya terkecil. Bandingkan antar metode dengan MAPE.</li>
    <li>Periksa grafik galat: galat yang selalu positif atau selalu negatif menandakan metode belum menangkap pola data.</li>
  </ol>
</div>`
      },
      {
        id: 'contoh', title: 'Contoh hitung',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Data $Y = 10,\,12,\,13,\,12,\,15,\,16$ (enam periode).</p>
</div>
<h3>SMA dengan $n = 3$</h3>
<ul>
  <li>$F_4 = \dfrac{10+12+13}{3} = 11{,}667$, galat $12 - 11{,}667 = 0{,}333$.</li>
  <li>$F_5 = \dfrac{12+13+12}{3} = 12{,}333$, galat $15 - 12{,}333 = 2{,}667$.</li>
  <li>$F_6 = \dfrac{13+12+15}{3} = 13{,}333$, galat $16 - 13{,}333 = 2{,}667$.</li>
  <li>Ramalan periode 7: $F_7 = \dfrac{12+15+16}{3} = 14{,}333$.</li>
  <li>$MSE = \dfrac{0{,}111 + 7{,}111 + 7{,}111}{3} = 4{,}778$ dan $MAPE = \dfrac{2{,}78\% + 17{,}78\% + 16{,}67\%}{3} = 12{,}41\%$ (kategori akurat).</li>
</ul>
<h3>SES dengan $\alpha = 0{,}3$</h3>
<div class="mt-tw"><table>
<thead><tr><th class="c">$t$</th><th class="c">1</th><th class="c">2</th><th class="c">3</th><th class="c">4</th><th class="c">5</th><th class="c">6</th><th class="c">7</th></tr></thead>
<tbody>
<tr><td class="c">$Y_t$</td><td class="c">10</td><td class="c">12</td><td class="c">13</td><td class="c">12</td><td class="c">15</td><td class="c">16</td><td class="c">-</td></tr>
<tr><td class="c">$F_t$</td><td class="c">10</td><td class="c">10</td><td class="c">10,6</td><td class="c">11,32</td><td class="c">11,524</td><td class="c">12,567</td><td class="c">13,597</td></tr>
</tbody></table></div>
<p>Contoh: $F_3 = 0{,}3(12) + 0{,}7(10) = 10{,}6$ dan $F_4 = 0{,}3(13) + 0{,}7(10{,}6) = 11{,}32$. Ramalan periode 7 adalah $13{,}597$. Perhatikan SES selalu tertinggal dari data yang naik.</p>
<h3>Holt dengan $\alpha = 0{,}5$ dan $\beta = 0{,}3$</h3>
<ol class="mt-steps">
  <li><strong>Inisialisasi:</strong> $L_1 = 10$ dan $T_1 = 12 - 10 = 2$.</li>
  <li><strong>Periode 2:</strong> $F_2 = L_1 + T_1 = 12$. $L_2 = 0{,}5(12) + 0{,}5(12) = 12$ dan $T_2 = 0{,}3(12-10) + 0{,}7(2) = 2$.</li>
  <li><strong>Periode 3:</strong> $F_3 = 12 + 2 = 14$. $L_3 = 0{,}5(13) + 0{,}5(14) = 13{,}5$ dan $T_3 = 0{,}3(1{,}5) + 0{,}7(2) = 1{,}85$.</li>
  <li><strong>Periode 4:</strong> $F_4 = 13{,}5 + 1{,}85 = 15{,}35$. Data sebenarnya 12, jadi ramalan terlalu tinggi dan komponen tren akan turun pada langkah berikutnya.</li>
</ol>
<p>Coba ketik data ini di kalkulator dan bandingkan hasilnya dengan perhitungan di atas.</p>`
      }
    ]
  });
})();
