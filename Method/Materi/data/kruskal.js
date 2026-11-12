/* Materi: Uji Kruskal-Wallis. Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'kruskal', order: 15, method: 'kruskal', tone: 'gold',
    title: 'Uji Kruskal-Wallis', subtitle: 'Beberapa Kelompok',
    desc: 'Alternatif nonparametrik ANOVA satu arah untuk dua atau lebih kelompok independen: statistik H dengan koreksi nilai kembar, p-value chi-kuadrat, ukuran efek epsilon-kuadrat, dan uji lanjut.',
    keywords: ['Kruskal-Wallis', 'H', 'nonparametrik', 'ANOVA satu arah', 'peringkat', 'kelompok independen', 'median', 'epsilon kuadrat', 'Dunn', 'Bonferroni', 'nilai kembar', 'chi-kuadrat'],
    icon: '<path d="M4 20h16M6 20V10M11 20V5M16 20v-7"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dan kapan dipakai',
        html: String.raw`
<p>Uji Kruskal-Wallis memperluas Mann-Whitney ke <strong>dua kelompok atau lebih</strong>. Ini alternatif nonparametrik untuk ANOVA satu arah, dipakai bila data tidak normal, berskala ordinal, atau banyak pencilan.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0$: semua kelompok berasal dari sebaran yang sama. $H_1$: minimal satu kelompok cenderung bernilai lebih besar atau lebih kecil daripada kelompok lain.</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th>Situasi</th><th>Uji</th></tr></thead>
<tbody>
<tr><td>2 kelompok independen</td><td>Mann-Whitney</td></tr>
<tr><td>3+ kelompok independen</td><td><strong>Kruskal-Wallis</strong> (alternatif ANOVA satu arah)</td></tr>
<tr><td>3+ perlakuan pada subjek/blok yang sama</td><td>Friedman</td></tr>
</tbody></table></div>`
      },
      {
        id: 'statistik', title: 'Statistik H',
        html: String.raw`
<p>Gabungkan semua data, beri peringkat 1 sampai $N$ (nilai kembar mendapat rata-rata peringkat), lalu jumlahkan peringkat tiap kelompok: $R_i$ dengan $n_i$ data.</p>
$$H_0^{*} = \frac{12}{N(N+1)}\sum_{i=1}^{k}\frac{R_i^2}{n_i} - 3(N+1)$$
<p>Bila ada nilai kembar, $H$ dikoreksi:</p>
$$H = \frac{H_0^{*}}{1 - \dfrac{\sum (t^3 - t)}{N^3 - N}}$$
<p>Di bawah $H_0$, $H$ mendekati distribusi chi-kuadrat dengan derajat bebas $k-1$. Tolak $H_0$ bila $H \gt \chi^2_{\alpha,\,k-1}$ atau $p \lt \alpha$.</p>
<div class="mt-box warn" data-label="Syarat pendekatan">
  <p>Pendekatan chi-kuadrat baik bila tiap kelompok berisi minimal sekitar 5 data. Bila ada kelompok yang lebih kecil, p-value kurang akurat.</p>
</div>`
      },
      {
        id: 'efek', title: 'Ukuran efek dan uji lanjut',
        html: String.raw`
<h3>Epsilon-kuadrat</h3>
$$\varepsilon^2 = \frac{H}{N-1}$$
<p>Berkisar 0 sampai 1: proporsi variasi peringkat yang dijelaskan oleh perbedaan kelompok. Makin besar, makin besar perbedaan antar kelompok.</p>
<h3>Uji lanjut</h3>
<p>Kruskal-Wallis hanya menyatakan <em>ada</em> perbedaan, bukan kelompok mana. Untuk mengetahuinya dilakukan uji lanjut, misalnya <strong>uji Dunn</strong> atau Mann-Whitney berpasangan, dengan <strong>koreksi Bonferroni</strong> agar peluang galat tipe I keseluruhan tetap terkendali:</p>
$$\alpha_{\text{per pasangan}} = \frac{\alpha}{m}, \qquad m = \frac{k(k-1)}{2}$$
<div class="mt-box note" data-label="Menafsirkan sebagai median">
  <p>Hasilnya dapat dibaca sebagai perbedaan median bila bentuk sebaran semua kelompok serupa. Bila tidak, yang dibandingkan adalah kecenderungan umum (peringkat) antar kelompok.</p>
</div>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Tiga metode belajar, masing-masing 5 siswa. A: 27, 31, 29, 35, 33. B: 24, 26, 22, 28, 25. C: 30, 36, 34, 38, 32. ($N = 15$, $k = 3$)</p>
  <ol class="mt-steps">
    <li>Jumlah peringkat: $R_A = 45$, $R_B = 16$, $R_C = 59$ (cek: $120 = 15 \cdot 16/2$). Tidak ada nilai kembar.</li>
    <li>$H = \dfrac{12}{15\cdot 16}\left(\dfrac{45^2 + 16^2 + 59^2}{5}\right) - 3(16) = 57{,}62 - 48 = 9{,}62$.</li>
    <li>$db = 2$, $p \approx 0{,}008$. Karena $p \lt 0{,}05$, <strong>tolak $H_0$</strong>.</li>
    <li>$\varepsilon^2 = 9{,}62/14 \approx 0{,}69$: perbedaan metode menjelaskan sebagian besar variasi peringkat. Rata-rata peringkat C (11,8) terbesar dan B (3,2) terkecil; lakukan uji lanjut untuk memastikan pasangan mana yang berbeda.</li>
  </ol>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Lihat rata-rata peringkat dan median tiap kelompok, nilai $H$, $db$, p-value, dan $\varepsilon^2$. Perhatikan peringatan bila ada kelompok dengan kurang dari 5 data.</p>
</div>`
      }
    ]
  });
})();
