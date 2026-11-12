/* Materi: Uji Kesamaan Ragam (uji F, Levene/Brown-Forsythe, Bartlett). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'ragam', order: 19, method: 'ragam', tone: 'teal',
    title: 'Uji Kesamaan Ragam', subtitle: 'F, Levene & Bartlett',
    desc: 'Menguji apakah ragam (variansi) beberapa kelompok sama: uji F untuk dua kelompok, Levene/Brown-Forsythe yang tahan data tidak normal, dan Bartlett untuk data normal.',
    keywords: ['kesamaan ragam', 'homogenitas', 'homogenitas ragam', 'variansi', 'varians', 'levene', 'brown-forsythe', 'bartlett', 'uji f', 'homoskedastisitas', 'asumsi anova', 'rasio ragam'],
    icon: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    sections: [
      {
        id: 'konsep', title: 'Mengapa ragam perlu diuji',
        html: String.raw`
<p>Banyak uji (uji t dua sampel dengan ragam sama, ANOVA, regresi) mengandaikan <strong>homogenitas ragam</strong>: semua kelompok punya sebaran dengan ragam $\sigma^2$ yang sama. Bila asumsi ini dilanggar, p-value dan selang kepercayaan menjadi kurang tepat, terutama jika ukuran kelompok tidak seimbang.</p>
<p>Hipotesisnya:</p>
$$H_0: \sigma_1^2 = \sigma_2^2 = \cdots = \sigma_k^2 \qquad H_1: \text{paling sedikit satu } \sigma_i^2 \text{ berbeda}$$
<div class="mt-box note" data-label="Arah keputusan">
  <p>Di sini yang diharapkan <strong>gagal ditolak</strong> adalah $H_0$. Jika $p \gt \alpha$, tidak ada bukti ragam berbeda, sehingga asumsi homogenitas masih dapat dipertahankan. Jika $p \lt \alpha$, ragam berbeda nyata; pakai uji yang tidak mengandaikan ragam sama (uji t Welch, Welch ANOVA) atau uji nonparametrik.</p>
</div>`
      },
      {
        id: 'uji-f', title: 'Uji F dua ragam',
        html: String.raw`
<p>Untuk <strong>dua kelompok</strong> normal, statistiknya adalah rasio ragam sampel:</p>
$$F = \frac{s_1^2}{s_2^2}, \qquad db_1 = n_1 - 1,\; db_2 = n_2 - 1$$
<p>Di bawah $H_0$, $F$ mengikuti distribusi $F(n_1-1,\, n_2-1)$. Untuk uji dua sisi, p-value-nya:</p>
$$p = 2\,\min\{P(F_{db_1,db_2} \le f),\; P(F_{db_1,db_2} \ge f)\}$$
<p>Selang kepercayaan $(1-\alpha)$ untuk rasio ragam $\sigma_1^2/\sigma_2^2$:</p>
$$\left[\frac{F}{F_{1-\alpha/2;\,db_1,db_2}},\; \frac{F}{F_{\alpha/2;\,db_1,db_2}}\right]$$
<p>Bila selang ini memuat 1, tidak ada bukti ragam berbeda.</p>
<div class="mt-box warn" data-label="Peka terhadap normalitas">
  <p>Uji F sangat sensitif terhadap penyimpangan dari normal. Pada data yang agak mencong atau berekor tebal, uji ini bisa menolak $H_0$ padahal ragamnya sama. Bila ragu dengan kenormalan, pakai Levene.</p>
</div>`
      },
      {
        id: 'levene', title: 'Uji Levene dan Brown-Forsythe',
        html: String.raw`
<p>Uji Levene bekerja untuk dua kelompok atau lebih dan <strong>tahan</strong> terhadap data yang tidak normal. Idenya: ubah tiap pengamatan menjadi simpangan mutlak dari pusat kelompoknya, lalu uji apakah rata-rata simpangan itu sama antar kelompok.</p>
$$Z_{ij} = \lvert x_{ij} - c_i \rvert$$
<p>dengan $c_i$ adalah pusat kelompok ke-$i$. Statistik ujinya sama dengan statistik ANOVA satu arah pada $Z_{ij}$:</p>
$$W = \frac{N-k}{k-1}\cdot\frac{\sum_{i=1}^{k} n_i\,(\bar{Z}_{i\cdot} - \bar{Z}_{\cdot\cdot})^2}{\sum_{i=1}^{k}\sum_{j=1}^{n_i} (Z_{ij} - \bar{Z}_{i\cdot})^2} \;\sim\; F(k-1,\; N-k)$$
<div class="mt-tw"><table>
<thead><tr><th>Pusat $c_i$</th><th>Nama</th><th>Sifat</th></tr></thead>
<tbody>
<tr><td>Median kelompok</td><td>Brown-Forsythe</td><td>Paling tahan; disarankan untuk umumnya</td></tr>
<tr><td>Rata-rata kelompok</td><td>Levene klasik</td><td>Baik untuk data simetris</td></tr>
</tbody></table></div>`
      },
      {
        id: 'bartlett', title: 'Uji Bartlett',
        html: String.raw`
<p>Uji Bartlett membandingkan $k$ ragam sekaligus dan paling kuat <strong>bila data benar-benar normal</strong>. Dengan ragam gabungan $s_p^2 = \dfrac{\sum (n_i-1)s_i^2}{N-k}$:</p>
$$T = \frac{(N-k)\ln s_p^2 - \sum_{i=1}^{k}(n_i-1)\ln s_i^2}{1 + \dfrac{1}{3(k-1)}\left(\sum_{i=1}^{k}\dfrac{1}{n_i-1} - \dfrac{1}{N-k}\right)} \;\sim\; \chi^2_{k-1}$$
<p>Tolak $H_0$ bila $T \gt \chi^2_{\alpha;\,k-1}$. Seperti uji F, Bartlett sangat peka pada data tidak normal, jadi penolakan $H_0$ bisa saja berasal dari ketidaknormalan, bukan perbedaan ragam.</p>`
      },
      {
        id: 'memilih', title: 'Memilih uji yang tepat',
        html: String.raw`
<div class="mt-tw"><table>
<thead><tr><th>Situasi</th><th>Uji yang disarankan</th></tr></thead>
<tbody>
<tr><td>Dua kelompok, data normal</td><td>Uji F</td></tr>
<tr><td>Dua kelompok atau lebih, data normal</td><td>Bartlett (atau Levene)</td></tr>
<tr><td>Normalitas diragukan, ada pencilan, atau data mencong</td><td>Levene dengan median (Brown-Forsythe)</td></tr>
<tr><td>Tidak yakin</td><td>Levene dengan median; bandingkan dengan Bartlett</td></tr>
</tbody></table></div>
<p>Bila Levene dan Bartlett memberi keputusan berbeda, biasanya penyebabnya adalah data yang tidak normal. Percayai Levene, dan periksa kenormalan dengan menu Uji Normalitas.</p>
<div class="mt-box note" data-label="Rule of thumb">
  <p>Jika ukuran kelompok hampir sama, ANOVA cukup tahan terhadap ragam yang sedikit berbeda. Sebagai patokan kasar, rasio simpangan baku terbesar terhadap terkecil di bawah 2 biasanya tidak menjadi masalah serius.</p>
</div>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh uji F">
  <p>Dua mesin menghasilkan panjang komponen. Mesin A: $n_1 = 11$, $s_1 = 4$; mesin B: $n_2 = 13$, $s_2 = 2$. Apakah ragamnya berbeda ($\alpha = 0{,}05$, dua sisi)?</p>
  <ol class="mt-steps">
    <li>$F = s_1^2/s_2^2 = 16/4 = 4{,}00$ dengan $db = (10, 12)$.</li>
    <li>Nilai kritis atas $F_{0{,}975;\,10,12} \approx 3{,}37$. Karena $4{,}00 \gt 3{,}37$, $H_0$ ditolak; $p$ dua sisi sekitar $0{,}03$.</li>
    <li><strong>Kesimpulan:</strong> ragam mesin A lebih besar daripada mesin B. Untuk membandingkan rata-rata keduanya, gunakan uji t Welch, bukan uji t dengan ragam gabungan.</li>
  </ol>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Pilih pusat Levene (median disarankan). Lihat tabel simpangan baku dan ragam tiap kelompok, lalu baca p-value Levene dan Bartlett. Bila $p \gt \alpha$ pada uji yang sesuai, asumsi homogenitas ragam dapat dipertahankan.</p>
</div>`
      }
    ]
  });
})();
