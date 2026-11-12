/* Materi: Korelasi (Pearson, Spearman, Kendall tau-b). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'korelasi', order: 12, method: 'korelasi', tone: 'gold',
    title: 'Korelasi', subtitle: 'Pearson, Spearman & Kendall',
    desc: 'Kekuatan dan arah hubungan antar variabel: koefisien Pearson, Spearman, dan Kendall tau-b, uji signifikansi, selang kepercayaan (transformasi z Fisher), dan cara membaca matriks korelasi.',
    keywords: ['korelasi', 'Pearson', 'Spearman', 'Kendall', 'tau-b', 'koefisien korelasi', 'r', 'rho', 'peringkat', 'monotonik', 'linear', 'matriks korelasi', 'z Fisher', 'hubungan', 'kausalitas'],
    icon: '<path d="M4 4v16h16"/><circle cx="8" cy="15" r="1.3"/><circle cx="12" cy="11" r="1.3"/><circle cx="17" cy="7.5" r="1.3"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dan memilih koefisien',
        html: String.raw`
<p>Korelasi mengukur <strong>kekuatan dan arah</strong> hubungan antara dua variabel numerik. Nilainya selalu berada di antara $-1$ dan $+1$:</p>
<ul>
  <li>Tanda <strong>positif</strong>: keduanya naik bersama. Tanda <strong>negatif</strong>: yang satu naik, yang lain turun.</li>
  <li>Mendekati $\pm 1$: hubungan kuat. Mendekati 0: hubungan lemah (untuk Pearson: tidak ada hubungan <em>linear</em>).</li>
</ul>
<div class="mt-tw"><table>
<thead><tr><th>Koefisien</th><th>Mengukur</th><th>Cocok bila</th></tr></thead>
<tbody>
<tr><td><strong>Pearson</strong> ($r$)</td><td>Hubungan <em>linear</em></td><td>Data numerik, kira-kira normal, tanpa pencilan ekstrem</td></tr>
<tr><td><strong>Spearman</strong> ($\rho_s$)</td><td>Hubungan <em>monotonik</em> (berdasarkan peringkat)</td><td>Data ordinal, tidak normal, ada pencilan, atau hubungan melengkung tetapi searah</td></tr>
<tr><td><strong>Kendall</strong> ($\tau_b$)</td><td>Kesesuaian urutan pasangan</td><td>Sampel kecil, banyak nilai kembar (ties); lebih konservatif daripada Spearman</td></tr>
</tbody></table></div>
<div class="mt-box warn" data-label="Korelasi bukan sebab-akibat">
  <p>Korelasi tinggi tidak membuktikan bahwa X menyebabkan Y. Bisa ada variabel ketiga yang memengaruhi keduanya, atau korelasinya kebetulan.</p>
</div>`
      },
      {
        id: 'pearson', title: 'Korelasi Pearson',
        html: String.raw`
$$r = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2}\,\sqrt{\sum (y_i - \bar{y})^2}}$$
<p>Pembilangnya (kovarians) positif bila $x$ dan $y$ cenderung berada di sisi yang sama terhadap rata-ratanya. $r^2$ adalah <strong>koefisien determinasi</strong>: proporsi variasi $y$ yang dijelaskan hubungan linear dengan $x$.</p>
<h3>Uji signifikansi</h3>
<p>$H_0: \rho = 0$ lawan $H_1: \rho \ne 0$:</p>
$$t = \frac{r\sqrt{n-2}}{\sqrt{1-r^2}}, \qquad db = n - 2$$
<h3>Selang kepercayaan: transformasi z Fisher</h3>
<p>Distribusi $r$ condong, sehingga selangnya dihitung pada skala $z$ lalu dikembalikan:</p>
$$z' = \operatorname{arctanh}(r), \quad SE = \frac{1}{\sqrt{n-3}}, \quad \text{selang } \rho: \ \tanh\!\big(z' \pm z_{\alpha/2}\,SE\big)$$
<p>Perhitungan ini memerlukan $n \gt 3$.</p>`
      },
      {
        id: 'spearman-kendall', title: 'Spearman dan Kendall',
        html: String.raw`
<h3>Spearman</h3>
<p>Ubah tiap variabel menjadi <strong>peringkat</strong>, lalu hitung korelasi Pearson pada peringkat. Bila tidak ada nilai kembar:</p>
$$\rho_s = 1 - \frac{6\sum d_i^2}{n(n^2-1)}$$
<p>dengan $d_i$ selisih peringkat $x_i$ dan $y_i$. Karena memakai peringkat, Spearman tidak terpengaruh oleh pencilan ekstrem dan menangkap hubungan monotonik yang tidak lurus.</p>
<h3>Kendall tau-b</h3>
<p>Bandingkan setiap pasangan pengamatan: pasangan <em>konkordan</em> ($C$) bila urutan $x$ dan $y$ searah, <em>diskordan</em> ($D$) bila berlawanan.</p>
$$\tau_b = \frac{C - D}{\sqrt{(C + D + T_x)(C + D + T_y)}}$$
<p>$T_x$ dan $T_y$ adalah pasangan yang kembar hanya pada $x$ atau hanya pada $y$ (koreksi nilai kembar, itulah arti &ldquo;b&rdquo;). Nilai $\tau_b$ biasanya lebih kecil daripada $\rho_s$ untuk data yang sama, jadi jangan membandingkan angkanya langsung antar jenis koefisien.</p>`
      },
      {
        id: 'interpretasi', title: 'Menafsirkan besar korelasi dan jebakan umum',
        html: String.raw`
<div class="mt-tw"><table>
<thead><tr><th>$|r|$</th><th>Pedoman umum</th></tr></thead>
<tbody>
<tr><td>0,00 &ndash; 0,19</td><td>Sangat lemah</td></tr>
<tr><td>0,20 &ndash; 0,39</td><td>Lemah</td></tr>
<tr><td>0,40 &ndash; 0,59</td><td>Sedang</td></tr>
<tr><td>0,60 &ndash; 0,79</td><td>Kuat</td></tr>
<tr><td>0,80 &ndash; 1,00</td><td>Sangat kuat</td></tr>
</tbody></table></div>
<p>Batas ini hanya pedoman; patokan yang dianggap &ldquo;kuat&rdquo; berbeda antar bidang ilmu.</p>
<div class="mt-box warn" data-label="Jebakan umum">
  <ul>
    <li><strong>Pencilan</strong> dapat menaikkan atau menurunkan Pearson secara drastis. Lihat diagram pencar dulu.</li>
    <li><strong>Hubungan melengkung</strong> (mis. berbentuk U) bisa menghasilkan $r$ mendekati 0 padahal hubungannya kuat.</li>
    <li><strong>Sampel kecil</strong>: $r$ yang besar bisa tidak signifikan, dan $r$ yang kecil bisa signifikan pada $n$ sangat besar. Nilai $p$ tidak menunjukkan kuatnya hubungan.</li>
    <li><strong>Banyak pasangan sekaligus</strong>: menguji banyak pasangan variabel meningkatkan peluang menemukan korelasi signifikan secara kebetulan.</li>
  </ul>
</div>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>$x$ = 1, 2, 3, 4, 5 dan $y$ = 2, 4, 5, 4, 5 ($n = 5$).</p>
  <ul>
    <li>Pearson: $r \approx 0{,}775$; $t = 0{,}775\sqrt{3}/\sqrt{1-0{,}775^2} \approx 2{,}12$, $db = 3$, $p \approx 0{,}124$.</li>
    <li>Spearman: $\rho_s \approx 0{,}738$ ($p \approx 0{,}155$).</li>
    <li>Kendall: $\tau_b \approx 0{,}671$ ($p \approx 0{,}117$).</li>
  </ul>
  <p>Korelasi positif cukup kuat, tetapi dengan $n = 5$ belum signifikan pada $\alpha = 0{,}05$. Hasilnya menunjukkan arah hubungan yang menjanjikan, bukan bukti kuat; perlu sampel lebih besar.</p>
</div>
<div class="mt-box key" data-label="Membaca matriks korelasi di aplikasi">
  <ol class="mt-steps">
    <li>Pilih koefisien (Pearson, Spearman, atau Kendall) sesuai jenis dan sebaran data.</li>
    <li>Baca matriks koefisien (diagonal selalu 1) dan matriks $p$-value pasangan variabel.</li>
    <li>Tiap pasangan memakai baris yang lengkap pada kedua variabel itu, sehingga $n$ bisa berbeda antar pasangan.</li>
    <li>Untuk Pearson, lihat selang kepercayaannya, dan selalu cek diagram pencar sebelum menyimpulkan.</li>
  </ol>
</div>`
      }
    ]
  });
})();
