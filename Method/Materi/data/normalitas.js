/* Materi: Uji Normalitas (Shapiro-Wilk, Anderson-Darling, Jarque-Bera). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'normalitas', order: 20, method: 'normalitas', tone: 'green',
    title: 'Uji Normalitas', subtitle: 'Shapiro-Wilk, Anderson-Darling & Jarque-Bera',
    desc: 'Memeriksa apakah data berasal dari distribusi normal: statistik, hipotesis, kelebihan tiap uji, dan cara menggabungkannya dengan plot peluang normal.',
    keywords: ['normalitas', 'uji normalitas', 'distribusi normal', 'shapiro-wilk', 'anderson-darling', 'jarque-bera', 'kemencengan', 'keruncingan', 'skewness', 'kurtosis', 'probability plot', 'plot peluang normal', 'asumsi normal'],
    icon: '<path d="M3 19c3 0 3-14 9-14s6 14 9 14"/><path d="M3 19h18"/>',
    sections: [
      {
        id: 'konsep', title: 'Hipotesis dan arah keputusan',
        html: String.raw`
<p>Banyak metode parametrik (uji t, ANOVA, regresi) mengandaikan data atau galat berdistribusi normal. Uji normalitas menguji:</p>
$$H_0: \text{data berasal dari distribusi normal} \qquad H_1: \text{data tidak berdistribusi normal}$$
<div class="mt-box note" data-label="Arah keputusan">
  <p>Yang diharapkan adalah <strong>gagal menolak</strong> $H_0$. Jika $p \gt \alpha$, tidak ada bukti ketidaknormalan. Jika $p \lt \alpha$, data menyimpang dari normal; pertimbangkan transformasi (misalnya log atau Box-Cox) atau uji nonparametrik.</p>
</div>
<p>Gagal menolak $H_0$ tidak membuktikan data pasti normal, hanya bahwa buktinya tidak cukup untuk menyimpulkan sebaliknya, terutama pada sampel kecil.</p>`
      },
      {
        id: 'shapiro-wilk', title: 'Uji Shapiro-Wilk',
        html: String.raw`
<p>Shapiro-Wilk umumnya uji paling kuat untuk sampel kecil sampai menengah. Statistiknya membandingkan data terurut dengan skor normal yang diharapkan:</p>
$$W = \frac{\left(\sum_{i=1}^{n} a_i\, x_{(i)}\right)^2}{\sum_{i=1}^{n}(x_i - \bar{x})^2}$$
<p>$x_{(i)}$ adalah data terurut dan $a_i$ koefisien yang dihitung dari nilai harapan serta kovarians statistik terurut normal. $W$ berada antara 0 dan 1; nilai mendekati 1 berarti data mendekati normal, dan $W$ yang kecil menolak $H_0$.</p>
<div class="mt-box warn" data-label="Batas ukuran sampel">
  <p>Di aplikasi, Shapiro-Wilk berlaku sampai $n = 5000$. Lebih dari itu, gunakan uji lain dan plot peluang normal.</p>
</div>`
      },
      {
        id: 'anderson-darling', title: 'Uji Anderson-Darling',
        html: String.raw`
<p>Anderson-Darling membandingkan fungsi sebaran empiris dengan fungsi sebaran normal dan memberi bobot lebih besar pada <strong>ekor</strong> distribusi, sehingga peka terhadap pencilan dan ekor yang terlalu tebal. Dengan $z_{(i)} = (x_{(i)} - \bar{x})/s$ dan $\Phi$ fungsi sebaran normal baku:</p>
$$A^2 = -n - \frac{1}{n}\sum_{i=1}^{n}(2i-1)\left[\ln \Phi(z_{(i)}) + \ln\bigl(1 - \Phi(z_{(n+1-i)})\bigr)\right]$$
<p>Karena $\mu$ dan $\sigma$ ditaksir dari data, dipakai koreksi sampel kecil:</p>
$$A^{2*} = A^2\left(1 + \frac{0{,}75}{n} + \frac{2{,}25}{n^2}\right)$$
<p>Semakin besar $A^{2*}$, semakin kuat bukti menolak normalitas. P-value-nya diperoleh dari pendekatan D'Agostino &amp; Stephens. Di aplikasi, uji ini dihitung untuk $n \ge 8$.</p>`
      },
      {
        id: 'jarque-bera', title: 'Uji Jarque-Bera',
        html: String.raw`
<p>Jarque-Bera menguji normalitas lewat dua ukuran bentuk: kemencengan $S$ (normal bernilai 0) dan keruncingan $K$ (normal bernilai 3):</p>
$$JB = \frac{n}{6}\left(S^2 + \frac{(K-3)^2}{4}\right) \;\sim\; \chi^2_2$$
<p>dengan $S = \dfrac{\tfrac{1}{n}\sum (x_i-\bar{x})^3}{\left(\tfrac{1}{n}\sum (x_i-\bar{x})^2\right)^{3/2}}$ dan $K = \dfrac{\tfrac{1}{n}\sum (x_i-\bar{x})^4}{\left(\tfrac{1}{n}\sum (x_i-\bar{x})^2\right)^{2}}$. Tolak $H_0$ bila $JB \gt \chi^2_{\alpha;\,2}$.</p>
<div class="mt-box warn" data-label="Untuk sampel besar">
  <p>Jarque-Bera berlandaskan sifat asimtotik, jadi kurang andal pada sampel kecil ($n \lt 8$ tidak dihitung di aplikasi). Cocok untuk $n$ besar, misalnya galat deret waktu atau residual regresi.</p>
</div>`
      },
      {
        id: 'memilih', title: 'Memilih uji dan membaca plot',
        html: String.raw`
<div class="mt-tw"><table>
<thead><tr><th>Uji</th><th>Peka terhadap</th><th>Cocok untuk</th></tr></thead>
<tbody>
<tr><td>Shapiro-Wilk</td><td>Penyimpangan umum</td><td>$n$ kecil sampai menengah (sampai 5000)</td></tr>
<tr><td>Anderson-Darling</td><td>Ekor distribusi dan pencilan</td><td>$n \ge 8$, bila ekor penting</td></tr>
<tr><td>Jarque-Bera</td><td>Kemencengan dan keruncingan</td><td>$n$ besar</td></tr>
</tbody></table></div>
<ul>
  <li>Bila ketiganya sepakat, kesimpulannya kuat. Bila berbeda, lihat ekor dan bentuk data lewat plot.</li>
  <li><strong>Plot peluang normal:</strong> titik yang mengikuti garis lurus berarti mendekati normal; lengkung berbentuk S menandakan ekor tebal atau tipis, dan lengkung berbentuk busur menandakan kemencengan.</li>
  <li>Pada $n$ sangat besar, penyimpangan kecil yang tidak berarti secara praktis pun bisa membuat $p \lt \alpha$. Pada $n$ sangat kecil, uji hampir tidak pernah menolak. Karena itu, padukan uji dengan plot.</li>
</ul>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh Jarque-Bera">
  <p>Dari $n = 50$ galat, diperoleh kemencengan $S = 0{,}5$ dan keruncingan $K = 3{,}5$. Apakah galat berdistribusi normal ($\alpha = 0{,}05$)?</p>
  <ol class="mt-steps">
    <li>$JB = \dfrac{50}{6}\left(0{,}5^2 + \dfrac{(3{,}5-3)^2}{4}\right) = 8{,}333 \times 0{,}3125 \approx 2{,}60$.</li>
    <li>Untuk $\chi^2_2$, $p = e^{-JB/2} = e^{-1{,}30} \approx 0{,}27$. Nilai kritis $\chi^2_{0{,}05;\,2} = 5{,}99$.</li>
    <li>Karena $2{,}60 \lt 5{,}99$ dan $p \gt 0{,}05$, <strong>gagal menolak $H_0$</strong>: tidak ada bukti ketidaknormalan.</li>
  </ol>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Tabel ringkasan menampilkan statistik dan p-value tiap uji untuk setiap variabel (1 sampai 12 variabel). Baca p-value masing-masing, bandingkan dengan $\alpha$, lalu periksa plot peluang normal sebelum memutuskan memakai uji parametrik.</p>
</div>`
      }
    ]
  });
})();
