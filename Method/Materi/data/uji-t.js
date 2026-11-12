/* Materi: Uji t (satu sampel, dua sampel independen, berpasangan). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'uji-t', order: 9, method: 'uji-t', tone: 'gold',
    title: 'Uji t', subtitle: 'Satu, Dua & Berpasangan',
    desc: 'Membandingkan rata-rata: satu kelompok terhadap nilai acuan, dua kelompok independen (Welch atau ragam gabungan), dan dua pengukuran berpasangan, termasuk ukuran efek Cohen\u2019s d.',
    keywords: ['uji t', 't-test', 'rata-rata', 'satu sampel', 'dua sampel', 'berpasangan', 'paired', 'independen', 'Welch', 'ragam gabungan', 'pooled', 'derajat bebas', 'Cohen', 'ukuran efek', 'selang kepercayaan', 'mu0'],
    icon: '<path d="M12 4v16M6 4h12M8 20h8"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dan memilih jenis uji t',
        html: String.raw`
<p>Uji t dipakai untuk menguji <strong>rata-rata</strong> ketika simpangan baku populasi <strong>tidak diketahui</strong> dan harus ditaksir dari sampel ($s$). Karena $s$ ikut berubah dari sampel ke sampel, statistik ujinya mengikuti distribusi $t$ (bukan normal baku). Bentuk umumnya sama dengan statistik uji lain:</p>
$$t = \frac{\text{taksiran} - \text{nilai di } H_0}{\text{galat baku taksiran}}$$
<div class="mt-tw"><table>
<thead><tr><th>Situasi data</th><th>Jenis uji</th><th>Contoh</th></tr></thead>
<tbody>
<tr><td>Satu kelompok dibandingkan dengan nilai acuan $\mu_0$</td><td>Uji t satu sampel</td><td>Apakah rata-rata nilai kelas berbeda dari 70?</td></tr>
<tr><td>Dua kelompok berisi subjek yang <em>berbeda</em></td><td>Uji t dua sampel independen</td><td>Nilai kelas A vs kelas B</td></tr>
<tr><td>Dua pengukuran pada subjek yang <em>sama</em> (atau pasangan terkait)</td><td>Uji t berpasangan</td><td>Nilai sebelum vs sesudah pelatihan</td></tr>
</tbody></table></div>
<div class="mt-box note" data-label="Bila simpangan baku populasi diketahui">
  <p>Gunakan Uji z (lihat materi Uji z). Pada sampel besar, distribusi $t$ hampir sama dengan normal baku sehingga hasilnya hampir identik.</p>
</div>
<div class="mt-box def" data-label="Hipotesis">
  <p>Dua sisi: $H_0: \mu = \mu_0$ lawan $H_1: \mu \ne \mu_0$. Satu sisi: $H_1: \mu \gt \mu_0$ atau $H_1: \mu \lt \mu_0$. Untuk dua sampel, $\mu_0$ diganti selisih $\Delta_0$ (biasanya 0).</p>
</div>`
      },
      {
        id: 'satu-sampel', title: 'Uji t satu sampel',
        html: String.raw`
<p>Membandingkan rata-rata sampel $\bar{x}$ dengan nilai acuan $\mu_0$:</p>
$$t = \frac{\bar{x} - \mu_0}{s/\sqrt{n}}, \qquad db = n - 1$$
<p>dengan $s = \sqrt{\dfrac{\sum (x_i - \bar{x})^2}{n-1}}$ dan galat baku rata-rata $SE = s/\sqrt{n}$.</p>
<p>Selang kepercayaan $(1-\alpha)$ untuk $\mu$:</p>
$$\bar{x} \pm t_{\alpha/2,\,n-1}\cdot \frac{s}{\sqrt{n}}$$
<div class="mt-box key" data-label="Keputusan">
  <p>Tolak $H_0$ bila $|t| \gt t_{\alpha/2,\,db}$ (dua sisi), atau bila $p \lt \alpha$. Bila $\mu_0$ berada di luar selang kepercayaan, hasil dua sisi pasti signifikan.</p>
</div>`
      },
      {
        id: 'dua-sampel', title: 'Uji t dua sampel independen (Welch dan gabungan)',
        html: String.raw`
<p>Membandingkan rata-rata dua kelompok independen, $\bar{x}_1 - \bar{x}_2$ terhadap $\Delta_0$. Ada dua versi, tergantung apakah ragam kedua kelompok dianggap sama.</p>
<h3>Welch (ragam tidak diasumsikan sama)</h3>
$$t = \frac{(\bar{x}_1 - \bar{x}_2) - \Delta_0}{\sqrt{\dfrac{s_1^2}{n_1} + \dfrac{s_2^2}{n_2}}}$$
<p>dengan derajat bebas pendekatan Welch&ndash;Satterthwaite (umumnya bukan bilangan bulat):</p>
$$db = \frac{\left(\dfrac{s_1^2}{n_1} + \dfrac{s_2^2}{n_2}\right)^2}{\dfrac{(s_1^2/n_1)^2}{n_1-1} + \dfrac{(s_2^2/n_2)^2}{n_2-1}}$$
<h3>Ragam gabungan (pooled, ragam diasumsikan sama)</h3>
$$s_p^2 = \frac{(n_1-1)s_1^2 + (n_2-1)s_2^2}{n_1+n_2-2}, \qquad t = \frac{(\bar{x}_1 - \bar{x}_2) - \Delta_0}{s_p\sqrt{\dfrac{1}{n_1}+\dfrac{1}{n_2}}}, \qquad db = n_1 + n_2 - 2$$
<div class="mt-box key" data-label="Mana yang dipilih?">
  <ul>
    <li><strong>Welch</strong> lebih aman sebagai pilihan awal: tetap valid bila ragam berbeda, dan hampir sama dengan versi gabungan bila ragam memang sama.</li>
    <li><strong>Gabungan</strong> hanya bila ada alasan kuat bahwa ragam sama (mis. dari uji kesamaan ragam atau pengetahuan tentang alat ukur).</li>
  </ul>
</div>
<div class="mt-box warn" data-label="Jangan memilih uji setelah melihat p-value">
  <p>Memilih versi uji karena hasilnya &ldquo;lebih signifikan&rdquo; menggelembungkan galat tipe I. Tetapkan pilihan berdasarkan desain dan pengetahuan tentang data.</p>
</div>`
      },
      {
        id: 'berpasangan', title: 'Uji t berpasangan',
        html: String.raw`
<p>Bila tiap subjek diukur dua kali (atau data berpasangan secara alami), hitung <strong>selisih</strong> tiap pasangan $d_i = x_i - y_i$, lalu lakukan uji t satu sampel pada selisih itu terhadap $\mu_d = 0$:</p>
$$t = \frac{\bar{d}}{s_d/\sqrt{n}}, \qquad db = n - 1$$
<p>dengan $\bar{d}$ rata-rata selisih, $s_d$ simpangan baku selisih, dan $n$ banyaknya pasangan.</p>
<div class="mt-box note" data-label="Mengapa lebih kuat dari dua sampel independen?">
  <p>Perbedaan antar subjek (misalnya subjek yang dasarnya memang pintar) hilang saat diambil selisih, sehingga galat bakunya biasanya jauh lebih kecil. Karena itu jangan memakai uji independen untuk data yang sebenarnya berpasangan.</p>
</div>`
      },
      {
        id: 'asumsi', title: 'Asumsi dan ukuran efek',
        html: String.raw`
<h3>Asumsi</h3>
<ul>
  <li><strong>Independensi</strong>: pengamatan saling bebas (kecuali pasangan pada uji berpasangan).</li>
  <li><strong>Normalitas</strong>: data (satu sampel, dua sampel) atau <em>selisih</em> (berpasangan) kira-kira normal. Pada $n$ yang cukup besar uji t cukup tahan terhadap pelanggaran ringan.</li>
  <li><strong>Ragam sama</strong>: hanya dipersyaratkan pada versi gabungan.</li>
</ul>
<p>Bila normalitas jelas terlanggar pada sampel kecil, pertimbangkan alternatif nonparametrik: Wilcoxon (satu sampel atau berpasangan) atau Mann-Whitney (dua sampel independen).</p>
<h3>Ukuran efek: Cohen&rsquo;s d</h3>
<p>Signifikan secara statistik belum tentu bermakna secara praktis. Cohen&rsquo;s $d$ menyatakan selisih dalam satuan simpangan baku:</p>
$$d = \frac{\bar{x}_1 - \bar{x}_2}{s_p} \quad\text{(dua sampel)}, \qquad d = \frac{\bar{x} - \mu_0}{s} \quad\text{(satu sampel)}, \qquad d = \frac{\bar{d}}{s_d} \quad\text{(berpasangan)}$$
<div class="mt-tw"><table>
<thead><tr><th>$|d|$</th><th>Kategori umum</th></tr></thead>
<tbody>
<tr><td>sekitar 0,2</td><td>Kecil</td></tr>
<tr><td>sekitar 0,5</td><td>Sedang</td></tr>
<tr><td>sekitar 0,8 atau lebih</td><td>Besar</td></tr>
</tbody></table></div>
<p>Batas ini hanya pedoman umum; makna praktis bergantung pada bidang penelitian.</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung',
        html: String.raw`
<div class="mt-box ex" data-label="Satu sampel">
  <p>Lima nilai: 12, 15, 14, 10, 13. Uji $H_0: \mu = 10$ (dua sisi, $\alpha = 0{,}05$).</p>
  <ol class="mt-steps">
    <li>$\bar{x} = 12{,}8$; $\sum(x_i-\bar{x})^2 = 14{,}8$ sehingga $s^2 = 3{,}7$ dan $s \approx 1{,}924$.</li>
    <li>$SE = 1{,}924/\sqrt{5} \approx 0{,}860$.</li>
    <li>$t = (12{,}8 - 10)/0{,}860 \approx 3{,}255$ dengan $db = 4$.</li>
    <li>Nilai kritis $t_{0{,}025;4} = 2{,}776$, jadi $|t| \gt 2{,}776$ dan $p \approx 0{,}031$. <strong>Tolak $H_0$</strong>.</li>
  </ol>
</div>
<div class="mt-box ex" data-label="Dua sampel independen">
  <p>Kelompok A: 23, 25, 28, 30, 26, 27 ($\bar{x}_1 = 26{,}5$; $s_1^2 = 5{,}9$). Kelompok B: 20, 22, 24, 21, 23, 19 ($\bar{x}_2 = 21{,}5$; $s_2^2 = 3{,}5$). $H_0: \mu_1 = \mu_2$.</p>
  <ul>
    <li>Welch: $SE = \sqrt{5{,}9/6 + 3{,}5/6} \approx 1{,}252$, $t \approx 3{,}995$, $db \approx 9{,}39$, $p \approx 0{,}0029$.</li>
    <li>Gabungan: $s_p \approx 2{,}168$, $t \approx 3{,}995$, $db = 10$, $p \approx 0{,}0025$.</li>
    <li>$d = 5/2{,}168 \approx 2{,}31$ (efek besar). Kedua versi sama-sama menolak $H_0$.</li>
  </ul>
</div>
<div class="mt-box ex" data-label="Berpasangan">
  <p>Sebelum: 8, 6, 9, 7, 10; sesudah: 6, 5, 8, 7, 7. Selisih: 2, 1, 1, 0, 3.</p>
  <p>$\bar{d} = 1{,}4$; $s_d \approx 1{,}140$; $t = 1{,}4/(1{,}140/\sqrt{5}) \approx 2{,}746$; $db = 4$; $p \approx 0{,}052$. Pada $\alpha = 0{,}05$ <strong>gagal tolak $H_0$</strong> (p sedikit di atas batas), meski rata-rata turun 1,4.</p>
</div>`
      },
      {
        id: 'membaca', title: 'Cara membaca hasil di aplikasi',
        html: String.raw`
<ol class="mt-steps">
  <li>Pilih jenis uji sesuai struktur data (satu kolom, dua kolom independen, atau dua kolom berpasangan) dan, untuk dua sampel, Welch atau gabungan.</li>
  <li>Atur nilai acuan $\mu_0$ (atau $\Delta_0$) dan arah hipotesis (dua sisi atau satu sisi).</li>
  <li>Baca tabel uji: $t$, derajat bebas, $p$-value, dan selang kepercayaan selisih/rata-rata.</li>
  <li>Putuskan dengan $p \lt \alpha$, lalu lihat Cohen&rsquo;s $d$ untuk menilai besarnya efek, bukan hanya signifikansinya.</li>
</ol>
<div class="mt-box key" data-label="Bahasa kesimpulan">
  <p>Tulis dalam konteks: &ldquo;Rata-rata kelompok A berbeda nyata dari B (selisih 5,0; $p = 0{,}003$; $d = 2{,}3$)&rdquo;, bukan hanya &ldquo;tolak $H_0$&rdquo;.</p>
</div>`
      }
    ]
  });
})();
