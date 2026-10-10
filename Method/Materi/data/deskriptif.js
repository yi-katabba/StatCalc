/* Materi: Statistika Deskriptif (terhubung ke Method/Stat/deskriptif.js). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'deskriptif', order: 1, method: 'deskriptif', tone: 'green',
    title: 'Statistika Deskriptif', subtitle: 'Ringkasan Data',
    desc: 'Cara meringkas data dengan angka: pemusatan, penyebaran, kuartil, pencilan, selang kepercayaan, serta kemencengan dan keruncingan.',
    keywords: ['mean', 'rata-rata', 'median', 'modus', 'ragam', 'varians', 'simpangan baku', 'kuartil', 'IQR', 'pencilan', 'outlier', 'skewness', 'kurtosis', 'koefisien variasi', 'galat baku', 'CI'],
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sections: [
      {
        id: 'gambaran', title: 'Gambaran umum',
        html: String.raw`
<p>Statistika deskriptif meringkas sekumpulan data menjadi beberapa angka yang mudah dibaca, tanpa menarik kesimpulan tentang populasi. Ringkasan itu biasanya menjawab tiga pertanyaan:</p>
<ol>
  <li><strong>Di mana pusat data?</strong> (rata-rata, median, modus)</li>
  <li><strong>Seberapa menyebar data?</strong> (jangkauan, ragam, simpangan baku, IQR)</li>
  <li><strong>Seperti apa bentuk sebarannya?</strong> (skewness dan kurtosis, juga pencilan)</li>
</ol>
<div class="mt-box def" data-label="Notasi">
  <p>Data ditulis $x_1, x_2, \dots, x_n$ dengan $n$ banyaknya data. Simbol $\sum$ berarti &ldquo;jumlahkan&rdquo;, sehingga $\sum x = x_1 + x_2 + \dots + x_n$. Data diurutkan dari kecil ke besar menjadi $x_{(1)} \le x_{(2)} \le \dots \le x_{(n)}$.</p>
</div>
<p>Aplikasi ini menghitung semua ukuran di bawah untuk satu atau banyak variabel sekaligus. Satu kolom adalah satu variabel, dan sel kosong diabaikan.</p>`
      },
      {
        id: 'pemusatan', title: 'Ukuran pemusatan',
        html: String.raw`
<h3>Rata-rata (mean)</h3>
<p>Jumlah seluruh data dibagi banyaknya data.</p>
$$\bar{x} = \frac{\sum_{i=1}^{n} x_i}{n}$$
<p>Rata-rata memakai seluruh nilai sehingga <strong>peka terhadap pencilan</strong>: satu nilai yang sangat besar dapat menarik rata-rata ke arahnya.</p>

<h3>Median</h3>
<p>Nilai tengah data yang sudah diurutkan. Jika $n$ ganjil, median adalah data ke-$\frac{n+1}{2}$. Jika $n$ genap, median adalah rata-rata dua data tengah.</p>
$$\text{Med} = \begin{cases} x_{(\frac{n+1}{2})} & n \text{ ganjil} \\[6pt] \dfrac{x_{(\frac{n}{2})} + x_{(\frac{n}{2}+1)}}{2} & n \text{ genap} \end{cases}$$
<p>Median <strong>tahan terhadap pencilan</strong>, sehingga lebih cocok untuk data yang menceng.</p>

<h3>Modus</h3>
<p>Nilai yang paling sering muncul. Data bisa tidak punya modus (semua nilai muncul sekali), atau punya lebih dari satu modus (bimodal, multimodal).</p>

<div class="mt-box key" data-label="Cara membandingkan">
  <ul>
    <li>Mean $\approx$ median: sebaran cenderung simetris.</li>
    <li>Mean $>$ median: ekor kanan lebih panjang (menceng ke kanan).</li>
    <li>Mean $<$ median: ekor kiri lebih panjang (menceng ke kiri).</li>
  </ul>
</div>`
      },
      {
        id: 'penyebaran', title: 'Ukuran penyebaran',
        html: String.raw`
<h3>Jangkauan (range)</h3>
$$R = x_{\max} - x_{\min}$$
<p>Sederhana, tetapi hanya memakai dua nilai ekstrem sehingga sangat dipengaruhi pencilan.</p>

<h3>Ragam (varians)</h3>
<p>Rata-rata kuadrat selisih data terhadap rata-ratanya. Aplikasi memakai pembagi $(n-1)$, sama dengan <code>VAR.S</code> di Excel (ragam sampel).</p>
$$s^2 = \frac{\sum_{i=1}^{n}(x_i - \bar{x})^2}{n-1}$$
<div class="mt-box note" data-label="Mengapa n − 1?">
  <p>Rata-rata $\bar{x}$ dihitung dari data yang sama, sehingga hanya $n-1$ selisih yang bebas bergerak (derajat bebas). Pembagi $n-1$ membuat $s^2$ tidak bias untuk ragam populasi $\sigma^2$.</p>
</div>

<h3>Simpangan baku</h3>
$$s = \sqrt{s^2}$$
<p>Akar dari ragam, sehingga satuannya sama dengan data. Secara kasar, $s$ adalah &ldquo;jarak tipikal&rdquo; data dari rata-ratanya.</p>

<h3>Koefisien variasi (KV)</h3>
$$KV = \frac{s}{|\bar{x}|} \times 100\%$$
<p>Simpangan baku relatif terhadap rata-rata, tanpa satuan, sehingga bisa membandingkan keragaman dua variabel yang satuannya berbeda (misal tinggi badan dalam cm dengan berat badan dalam kg). KV tidak bermakna jika $\bar{x}$ mendekati nol.</p>`
      },
      {
        id: 'kuartil', title: 'Kuartil, IQR, dan pencilan',
        html: String.raw`
<h3>Kuartil</h3>
<p>Kuartil membagi data terurut menjadi empat bagian sama banyak: $Q_1$ (persentil ke-25), $Q_2$ (median), dan $Q_3$ (persentil ke-75). Aplikasi memakai <strong>interpolasi linear</strong>, sama dengan <code>QUARTILE.INC</code> di Excel. Untuk proporsi $p$ (0,25 untuk $Q_1$ dan 0,75 untuk $Q_3$):</p>
$$h = (n-1)\,p,\qquad Q = x_{(\lfloor h \rfloor + 1)} + (h - \lfloor h \rfloor)\,\bigl(x_{(\lfloor h \rfloor + 2)} - x_{(\lfloor h \rfloor + 1)}\bigr)$$

<h3>Jangkauan antarkuartil (IQR)</h3>
$$IQR = Q_3 - Q_1$$
<p>Lebar rentang yang memuat 50% data tengah. Seperti median, IQR tahan terhadap pencilan.</p>

<h3>Pencilan (aturan 1,5 × IQR)</h3>
<p>Data dianggap pencilan jika berada di luar pagar berikut (dasar dari boxplot):</p>
$$\text{Pagar bawah} = Q_1 - 1{,}5\,IQR,\qquad \text{Pagar atas} = Q_3 + 1{,}5\,IQR$$
<div class="mt-box warn" data-label="Hati-hati">
  <p>Pencilan belum tentu salah data. Periksa dulu apakah itu salah ketik, salah ukur, atau memang pengamatan yang ekstrem tetapi sah. Jangan menghapus data hanya karena ia pencilan.</p>
</div>`
      },
      {
        id: 'galat-ci', title: 'Galat baku dan selang kepercayaan 95%',
        html: String.raw`
<p><strong>Galat baku rata-rata</strong> (standard error) menggambarkan seberapa bervariasi rata-rata sampel dari satu sampel ke sampel lain:</p>
$$SE = \frac{s}{\sqrt{n}}$$
<p>Semakin besar $n$, semakin kecil $SE$, yang berarti rata-rata sampel makin akurat menaksir rata-rata populasi.</p>

<p><strong>Selang kepercayaan (CI) 95%</strong> untuk rata-rata populasi $\mu$:</p>
$$\bar{x} \;\pm\; t_{0{,}975;\,n-1} \times \frac{s}{\sqrt{n}}$$
<p>dengan $t_{0{,}975;\,n-1}$ nilai kritis distribusi $t$ dengan derajat bebas $n-1$ (dua sisi, taraf 5%).</p>
<div class="mt-box note" data-label="Cara membaca CI">
  <p>Jika pengambilan sampel diulang berkali-kali dan CI dihitung tiap kali, sekitar 95% selang yang terbentuk akan memuat $\mu$ yang sebenarnya. Ini <em>bukan</em> berarti &ldquo;ada peluang 95% bahwa $\mu$ berada di selang ini&rdquo; untuk satu selang tertentu.</p>
</div>`
      },
      {
        id: 'bentuk', title: 'Skewness dan kurtosis',
        html: String.raw`
<h3>Skewness (kemencengan)</h3>
<p>Mengukur ketidaksimetrisan sebaran. Aplikasi memakai versi sampel terkoreksi (sama dengan <code>SKEW</code> di Excel):</p>
$$G_1 = \frac{n}{(n-1)(n-2)} \sum_{i=1}^{n}\left(\frac{x_i - \bar{x}}{s}\right)^{3}$$
<div class="mt-tw"><table>
<thead><tr><th>Nilai</th><th>Bentuk sebaran</th></tr></thead>
<tbody>
<tr><td>$|G_1| < 0{,}5$</td><td>Hampir simetris</td></tr>
<tr><td>$G_1 > 0$</td><td>Menceng ke kanan (ekor kanan lebih panjang)</td></tr>
<tr><td>$G_1 < 0$</td><td>Menceng ke kiri (ekor kiri lebih panjang)</td></tr>
</tbody></table></div>

<h3>Kurtosis (keruncingan)</h3>
<p>Mengukur ketebalan ekor dibanding distribusi normal. Aplikasi menampilkan <em>excess kurtosis</em> (dikurangi 3, sama dengan <code>KURT</code> di Excel), sehingga distribusi normal bernilai 0:</p>
$$G_2 = \frac{n(n+1)}{(n-1)(n-2)(n-3)} \sum_{i=1}^{n}\left(\frac{x_i - \bar{x}}{s}\right)^{4} - \frac{3(n-1)^2}{(n-2)(n-3)}$$
<div class="mt-tw"><table>
<thead><tr><th>Nilai</th><th>Arti</th></tr></thead>
<tbody>
<tr><td>$G_2 \approx 0$</td><td>Keruncingan mendekati normal</td></tr>
<tr><td>$G_2 > 0$</td><td>Lebih runcing, ekor lebih tebal (lebih banyak nilai ekstrem)</td></tr>
<tr><td>$G_2 < 0$</td><td>Lebih landai, ekor lebih tipis</td></tr>
</tbody></table></div>
<p>Skewness butuh minimal $n>2$ dan kurtosis minimal $n>3$. Pada data sedikit, keduanya sangat tidak stabil, sehingga jangan menafsirkannya terlalu jauh.</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Data nilai kuis 8 siswa: $3,\;5,\;5,\;6,\;7,\;8,\;9,\;17$ (sudah terurut, $n=8$).</p>
</div>
<ol class="mt-steps">
  <li><strong>Rata-rata:</strong> $\bar{x} = \dfrac{3+5+5+6+7+8+9+17}{8} = \dfrac{60}{8} = 7{,}5$.</li>
  <li><strong>Median:</strong> $n$ genap, jadi rata-rata data ke-4 dan ke-5: $\dfrac{6+7}{2} = 6{,}5$. <strong>Modus</strong> = 5 (muncul dua kali).</li>
  <li><strong>Ragam:</strong> $\sum (x-\bar{x})^2 = 128$, sehingga $s^2 = \dfrac{128}{7} \approx 18{,}286$ dan $s = \sqrt{18{,}286} \approx 4{,}276$.</li>
  <li><strong>Kuartil:</strong> untuk $Q_1$, $h = 7 \times 0{,}25 = 1{,}75$, sehingga $Q_1 = 5 + 0{,}75\,(5-5) = 5$. Untuk $Q_3$, $h = 5{,}25$, sehingga $Q_3 = 8 + 0{,}25\,(9-8) = 8{,}25$. Jadi $IQR = 3{,}25$.</li>
  <li><strong>Pagar pencilan:</strong> bawah $= 5 - 1{,}5(3{,}25) = 0{,}125$; atas $= 8{,}25 + 1{,}5(3{,}25) = 13{,}125$. Nilai <strong>17</strong> berada di luar pagar, jadi ia pencilan.</li>
  <li><strong>CI 95%:</strong> $SE = \dfrac{4{,}276}{\sqrt{8}} \approx 1{,}512$ dan $t_{0{,}975;7} = 2{,}365$, sehingga CI $= 7{,}5 \pm 2{,}365(1{,}512) = [3{,}93;\; 11{,}07]$.</li>
  <li><strong>Bentuk:</strong> $G_1 \approx 1{,}79$ (menceng kuat ke kanan) dan $G_2 \approx 3{,}96$ (ekor tebal). Konsisten dengan mean (7,5) $>$ median (6,5) akibat nilai 17.</li>
</ol>
<div class="mt-box key" data-label="Pelajaran">
  <p>Satu pencilan (17) menarik rata-rata ke 7,5 padahal median hanya 6,5, dan membuat $KV = \dfrac{4{,}276}{7{,}5} \times 100\% \approx 57\%$ besar. Pada data seperti ini, laporkan median dan IQR bersama rata-rata dan simpangan baku.</p>
</div>`
      },
      {
        id: 'membaca', title: 'Cara membaca hasil di aplikasi',
        html: String.raw`
<div class="mt-tw"><table>
<thead><tr><th>Keluaran</th><th>Yang perlu diperhatikan</th></tr></thead>
<tbody>
<tr><td>Rata-rata vs median</td><td>Selisih besar menandakan sebaran menceng atau ada pencilan.</td></tr>
<tr><td>Simpangan baku &amp; KV</td><td>KV kecil berarti data seragam; KV besar berarti data sangat beragam.</td></tr>
<tr><td>Q1, Q3, IQR</td><td>Rentang 50% data tengah; dasar untuk boxplot dan pencilan.</td></tr>
<tr><td>Skewness &amp; kurtosis</td><td>Petunjuk awal kenormalan. Untuk uji formal pakai Jarque-Bera, Shapiro-Wilk, atau Kolmogorov-Smirnov (lihat materi Regresi Linear).</td></tr>
<tr><td>CI 95% rata-rata</td><td>Rentang yang masuk akal untuk rata-rata populasi.</td></tr>
<tr><td>Jumlah pencilan</td><td>Periksa kebenaran data sebelum analisis lanjutan.</td></tr>
</tbody></table></div>
<p>Setelah meringkas, langkah wajar berikutnya adalah membandingkan kelompok (lihat <strong>ANOVA</strong>) atau memodelkan hubungan antarvariabel (lihat <strong>Regresi Linear</strong>).</p>`
      }
    ]
  });
})();
