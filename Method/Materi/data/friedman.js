/* Materi: Uji Friedman. Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'friedman', order: 16, method: 'friedman', tone: 'green',
    title: 'Uji Friedman', subtitle: 'Blok & Perlakuan',
    desc: 'Alternatif nonparametrik ANOVA pengukuran berulang atau acak kelompok: peringkat dalam tiap blok, statistik chi-kuadrat Friedman dengan koreksi nilai kembar, koefisien konkordansi Kendall (W), dan uji lanjut.',
    keywords: ['Friedman', 'blok', 'perlakuan', 'pengukuran berulang', 'acak kelompok', 'nonparametrik', 'peringkat dalam blok', 'Kendall W', 'konkordansi', 'chi-kuadrat', 'Nemenyi', 'Wilcoxon berpasangan', 'Bonferroni'],
    icon: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.3"/><circle cx="14" cy="12" r="1.3"/><circle cx="10" cy="18" r="1.3"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dan kapan dipakai',
        html: String.raw`
<p>Uji Friedman membandingkan <strong>tiga perlakuan atau lebih</strong> yang diterapkan pada blok atau subjek yang sama. Ini alternatif nonparametrik untuk ANOVA acak kelompok atau ANOVA pengukuran berulang, dan perpanjangan dari uji Wilcoxon berpasangan untuk lebih dari dua kondisi.</p>
<div class="mt-box def" data-label="Struktur data">
  <p>Baris = blok (subjek), kolom = perlakuan atau waktu pengukuran. Baris harus <strong>lengkap</strong> (tiap blok punya nilai untuk semua perlakuan).</p>
</div>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0$: semua perlakuan setara (peringkat tiap perlakuan di dalam blok tidak berbeda secara sistematis). $H_1$: minimal satu perlakuan cenderung menghasilkan nilai lebih besar atau lebih kecil.</p>
</div>`
      },
      {
        id: 'statistik', title: 'Peringkat dalam blok dan statistik uji',
        html: String.raw`
<ol class="mt-steps">
  <li>Dalam <strong>setiap blok</strong> (baris), beri peringkat 1 sampai $k$ pada $k$ perlakuan (nilai kembar mendapat rata-rata peringkat).</li>
  <li>Jumlahkan peringkat tiap perlakuan di seluruh $n$ blok: $R_j$.</li>
</ol>
$$\chi^2_{0} = \frac{12}{n\,k\,(k+1)}\sum_{j=1}^{k} R_j^2 - 3\,n\,(k+1)$$
<p>Dengan nilai kembar dalam blok, statistik dikoreksi dengan membagi $\chi^2_0$ dengan $1 - \dfrac{\sum (t^3-t)}{n\,k\,(k^2-1)}$. Di bawah $H_0$, statistiknya mendekati chi-kuadrat dengan $db = k-1$.</p>
<div class="mt-box warn" data-label="Syarat pendekatan">
  <p>Pendekatan chi-kuadrat kurang akurat bila blok kurang dari sekitar 5 atau perlakuan hanya 2. Untuk dua perlakuan gunakan Wilcoxon berpasangan.</p>
</div>`
      },
      {
        id: 'kendall', title: 'Koefisien konkordansi Kendall (W)',
        html: String.raw`
<p>Ukuran efek untuk uji Friedman, sekaligus ukuran seberapa seragam &ldquo;juri&rdquo; (blok) mengurutkan perlakuan:</p>
$$W = \frac{\chi^2_F}{n\,(k-1)}$$
<ul>
  <li>$W = 1$: semua blok memberi urutan perlakuan yang persis sama (konkordansi sempurna).</li>
  <li>$W = 0$: urutan di tiap blok tidak konsisten (tidak ada kesepakatan).</li>
</ul>
<p>Pedoman kasar: $W \lt 0{,}3$ lemah, $0{,}3$&ndash;$0{,}6$ sedang, $\gt 0{,}6$ kuat.</p>
<h3>Uji lanjut</h3>
<p>Bila $H_0$ ditolak, pasangan perlakuan yang berbeda diperiksa dengan <strong>Wilcoxon berpasangan dengan koreksi Bonferroni</strong> atau <strong>uji Nemenyi</strong>.</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Enam subjek menilai tiga produk (skor lebih tinggi = lebih baik). Baris = subjek; kolom = produk A, B, C:</p>
  <div class="mt-tw"><table>
  <thead><tr><th>Subjek</th><th>A</th><th>B</th><th>C</th></tr></thead>
  <tbody>
  <tr><td>1</td><td>8</td><td>6</td><td>4</td></tr>
  <tr><td>2</td><td>9</td><td>7</td><td>5</td></tr>
  <tr><td>3</td><td>7</td><td>8</td><td>5</td></tr>
  <tr><td>4</td><td>10</td><td>6</td><td>4</td></tr>
  <tr><td>5</td><td>9</td><td>8</td><td>7</td></tr>
  <tr><td>6</td><td>8</td><td>5</td><td>6</td></tr>
  </tbody></table></div>
  <ol class="mt-steps">
    <li>Peringkat dalam tiap baris (3 = tertinggi), lalu dijumlah: $R_A = 17$, $R_B = 12$, $R_C = 7$ (cek: $36 = 6 \cdot 3 \cdot 4/2$). Tidak ada nilai kembar.</li>
    <li>$\chi^2_F = \dfrac{12}{6\cdot 3\cdot 4}(17^2 + 12^2 + 7^2) - 3\cdot 6\cdot 4 = \dfrac{12}{72}(482) - 72 \approx 8{,}33$.</li>
    <li>$db = 2$, $p \approx 0{,}016$. Karena $p \lt 0{,}05$, <strong>tolak $H_0$</strong>: ada perbedaan antar produk.</li>
    <li>$W = 8{,}33/(6 \cdot 2) \approx 0{,}69$ (kesepakatan kuat bahwa A $\gt$ B $\gt$ C). Lanjutkan dengan uji lanjut untuk menentukan pasangan yang berbeda.</li>
  </ol>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Periksa bahwa tidak ada baris yang tidak lengkap. Baca rata-rata peringkat tiap perlakuan, $\chi^2$, $db$, p-value, dan $W$.</p>
</div>`
      }
    ]
  });
})();
