/* Materi: Uji Lanjut ANOVA (Tukey HSD, Bonferroni, Dunnett, BNT/LSD). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'uji-lanjut', order: 21, method: 'uji-lanjut', tone: 'plum',
    title: 'Uji Lanjut ANOVA', subtitle: 'Tukey, Bonferroni, Dunnett & BNT',
    desc: 'Membandingkan pasangan rata-rata setelah ANOVA menolak H0: masalah perbandingan berganda, Tukey HSD, Bonferroni, Dunnett terhadap kontrol, dan BNT (LSD), lengkap dengan huruf notasi.',
    keywords: ['uji lanjut', 'post hoc', 'tukey', 'hsd', 'tukey-kramer', 'bonferroni', 'dunnett', 'bnt', 'lsd', 'fisher lsd', 'perbandingan berganda', 'huruf notasi', 'selang kepercayaan simultan', 'kontrol', 'anova'],
    icon: '<path d="M4 6h16M4 12h10M4 18h6"/><circle cx="18" cy="15" r="3"/><path d="M20 17l2 2"/>',
    sections: [
      {
        id: 'konsep', title: 'Mengapa perlu uji lanjut',
        html: String.raw`
<p>ANOVA yang signifikan hanya menyatakan bahwa <strong>setidaknya satu</strong> rata-rata berbeda. Untuk mengetahui kelompok mana yang berbeda, kita membandingkan pasangan rata-rata $\bar{y}_i$ dan $\bar{y}_j$. Dengan $k$ kelompok terdapat</p>
$$m = \binom{k}{2} = \frac{k(k-1)}{2}$$
<p>perbandingan. Bila setiap perbandingan diuji pada taraf $\alpha$, peluang membuat <em>setidaknya satu</em> kesalahan tipe I membengkak menjadi:</p>
$$\alpha_{\text{total}} = 1 - (1-\alpha)^m$$
<div class="mt-box warn" data-label="Contoh pembengkakan">
  <p>Untuk $k = 4$ ada $m = 6$ perbandingan. Dengan $\alpha = 0{,}05$ per uji, $\alpha_{\text{total}} = 1 - 0{,}95^6 \approx 0{,}26$, jauh di atas 0,05. Uji lanjut menjaga kesalahan keseluruhan tetap sekitar $\alpha$.</p>
</div>
<p>Semua uji lanjut memakai kuadrat tengah galat $KTG$ (MSE) dari ANOVA dengan $db_w = N - k$ derajat bebas, dan menghitung <strong>selisih kritis</strong>: dua rata-rata dinyatakan berbeda bila selisih mutlaknya melampaui nilai itu.</p>`
      },
      {
        id: 'tukey', title: 'Tukey HSD (Tukey-Kramer)',
        html: String.raw`
<p>Tukey HSD membandingkan <strong>semua pasangan</strong> dengan menjaga galat tipe I keseluruhan sebesar $\alpha$, memakai distribusi <em>studentized range</em> $q$. Untuk ukuran kelompok sama ($n$):</p>
$$HSD = q_{\alpha;\,k,\,N-k}\sqrt{\frac{KTG}{n}}$$
<p>Untuk ukuran kelompok tidak sama (Tukey-Kramer):</p>
$$HSD_{ij} = \frac{q_{\alpha;\,k,\,N-k}}{\sqrt{2}}\sqrt{KTG\left(\frac{1}{n_i} + \frac{1}{n_j}\right)}$$
<p>Selang kepercayaan simultan $(1-\alpha)$ untuk $\mu_i - \mu_j$ adalah $(\bar{y}_i - \bar{y}_j) \pm HSD_{ij}$. Selang yang tidak memuat 0 menandakan perbedaan nyata. Tukey adalah pilihan baku bila semua pasangan menarik.</p>`
      },
      {
        id: 'bonferroni', title: 'Bonferroni',
        html: String.raw`
<p>Bonferroni membagi taraf signifikansi sama rata ke setiap perbandingan: tiap uji memakai $\alpha/m$.</p>
$$\text{Selisih kritis} = t_{\alpha/(2m);\,N-k}\sqrt{KTG\left(\frac{1}{n_i} + \frac{1}{n_j}\right)}$$
<p>Metode ini sederhana dan berlaku untuk perbandingan apa saja, tetapi <strong>konservatif</strong> bila $m$ besar: selisih kritisnya lebih besar daripada Tukey, sehingga lebih sulit menemukan perbedaan. Cocok bila hanya sebagian kecil perbandingan yang sudah direncanakan sebelum melihat data.</p>`
      },
      {
        id: 'dunnett', title: 'Dunnett (terhadap kontrol)',
        html: String.raw`
<p>Bila satu kelompok adalah <strong>kontrol</strong> dan hanya perbandingan setiap perlakuan dengan kontrol yang menarik, jumlah perbandingannya hanya $m = k - 1$. Dunnett memanfaatkan hal ini:</p>
$$\text{Selisih kritis} = d_{\alpha;\,k-1,\,N-k}\sqrt{KTG\left(\frac{1}{n_i} + \frac{1}{n_0}\right)}$$
<p>dengan $d$ dari tabel Dunnett dan $n_0$ ukuran kelompok kontrol. Karena perbandingannya lebih sedikit, Dunnett lebih kuat daripada Tukey atau Bonferroni untuk tujuan ini. Selang kepercayaan simultannya berpusat pada $\bar{y}_i - \bar{y}_0$.</p>`
      },
      {
        id: 'bnt', title: 'BNT / Fisher LSD',
        html: String.raw`
<p>Beda Nyata Terkecil (BNT, <em>Least Significant Difference</em>) adalah uji t biasa untuk setiap pasangan <strong>tanpa penyesuaian</strong>:</p>
$$BNT_{ij} = t_{\alpha/2;\,N-k}\sqrt{KTG\left(\frac{1}{n_i} + \frac{1}{n_j}\right)}$$
<div class="mt-box warn" data-label="Gunakan dengan hati-hati">
  <p>BNT tidak mengendalikan galat tipe I keseluruhan. Pakai hanya bila F ANOVA signifikan (<em>protected LSD</em>), jumlah kelompok kecil, dan perbandingan sudah direncanakan. Selebihnya, lebih aman memakai Tukey atau Bonferroni.</p>
</div>`
      },
      {
        id: 'memilih', title: 'Memilih metode dan huruf notasi',
        html: String.raw`
<div class="mt-tw"><table>
<thead><tr><th>Tujuan</th><th>Metode</th><th>Sifat</th></tr></thead>
<tbody>
<tr><td>Semua pasangan</td><td>Tukey HSD</td><td>Kendali galat ketat, kuat; pilihan baku</td></tr>
<tr><td>Beberapa perbandingan terencana</td><td>Bonferroni</td><td>Sederhana, konservatif bila $m$ besar</td></tr>
<tr><td>Setiap perlakuan vs kontrol</td><td>Dunnett</td><td>Paling kuat untuk tujuan ini</td></tr>
<tr><td>Eksplorasi awal, kelompok sedikit</td><td>BNT (LSD)</td><td>Paling mudah berbeda, tanpa kendali galat</td></tr>
</tbody></table></div>
<p><strong>Huruf notasi</strong>: kelompok yang diberi huruf sama tidak berbeda nyata. Contoh: A, AB, B menunjukkan kelompok 1 dan 2 tidak berbeda, 2 dan 3 tidak berbeda, tetapi 1 dan 3 berbeda nyata. Bila ragam atau normalitas sangat dilanggar, hasilnya kurang tepat; pertimbangkan Welch ANOVA atau Kruskal-Wallis.</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Empat pupuk, masing-masing $n = 6$ petak, $KTG = 10$ dengan $db_w = 20$. Selisih kritis tiap metode ($\alpha = 0{,}05$)?</p>
  <ol class="mt-steps">
    <li>$\sqrt{KTG/n} = \sqrt{10/6} = 1{,}291$ dan $\sqrt{KTG(2/n)} = \sqrt{3{,}333} = 1{,}826$.</li>
    <li><strong>Tukey:</strong> $q_{0{,}05;\,4,20} = 3{,}96$, jadi $HSD = 3{,}96 \times 1{,}291 \approx 5{,}11$.</li>
    <li><strong>Bonferroni</strong> ($m = 6$): $t_{0{,}05/12;\,20} \approx 2{,}93$, sehingga selisih kritis $\approx 2{,}93 \times 1{,}826 \approx 5{,}35$.</li>
    <li><strong>BNT:</strong> $t_{0{,}025;\,20} = 2{,}086$, sehingga $BNT \approx 3{,}81$.</li>
  </ol>
  <p>Urutan kritisnya: BNT $\lt$ Tukey $\lt$ Bonferroni. Selisih rata-rata 4,5 dianggap berbeda oleh BNT, tetapi tidak oleh Tukey maupun Bonferroni.</p>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Pilih data dan metode, lalu baca tabel pasangan: selisih, selisih kritis, selang kepercayaan simultan, dan p-value yang sudah disesuaikan. Selang yang tidak memuat 0 berarti beda nyata. Huruf notasi merangkum hasilnya, dan grafik menampilkan boxplot per kelompok.</p>
</div>`
      }
    ]
  });
})();
