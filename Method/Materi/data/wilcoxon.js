/* Materi: Uji Wilcoxon signed-rank (satu sampel dan berpasangan). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'wilcoxon', order: 14, method: 'wilcoxon', tone: 'teal',
    title: 'Uji Wilcoxon', subtitle: 'Satu Sampel & Berpasangan',
    desc: 'Uji peringkat bertanda (signed-rank): alternatif nonparametrik uji t satu sampel dan berpasangan, dengan statistik T+ dan T-, p-value eksak atau pendekatan normal, dan korelasi rank-biserial.',
    keywords: ['Wilcoxon', 'signed-rank', 'peringkat bertanda', 'berpasangan', 'satu sampel', 'median', 'selisih', 'T plus', 'nonparametrik', 'nilai nol', 'nilai kembar', 'rank-biserial', 'eksak', 'simetris'],
    icon: '<path d="M4 12h16M8 8v8M12 5v14M16 9v6"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dan kapan dipakai',
        html: String.raw`
<p>Uji peringkat bertanda Wilcoxon adalah alternatif nonparametrik untuk:</p>
<ul>
  <li><strong>Uji t satu sampel</strong>: apakah median suatu kelompok berbeda dari nilai acuan $m_0$.</li>
  <li><strong>Uji t berpasangan</strong>: apakah median selisih dua pengukuran pada subjek yang sama berbeda dari 0.</li>
</ul>
<p>Berbeda dengan uji tanda yang hanya melihat arah selisih, uji ini juga memakai <strong>besar</strong> selisih lewat peringkatnya, sehingga lebih peka.</p>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0$: median selisih sama dengan 0 (sebaran selisih simetris di sekitar 0). $H_1$: median selisih tidak sama dengan 0 (atau lebih besar / lebih kecil untuk uji satu sisi).</p>
</div>
<div class="mt-box warn" data-label="Asumsi">
  <p>Tidak perlu normal, tetapi sebaran <em>selisih</em> diasumsikan kira-kira <strong>simetris</strong>. Bila sangat menceng, hasilnya kurang tepat dibaca sebagai uji median.</p>
</div>`
      },
      {
        id: 'langkah', title: 'Langkah perhitungan',
        html: String.raw`
<ol class="mt-steps">
  <li>Hitung selisih $d_i = x_i - y_i$ (berpasangan) atau $d_i = x_i - m_0$ (satu sampel).</li>
  <li><strong>Buang</strong> selisih yang bernilai 0. Banyak data yang tersisa dinamai $n$.</li>
  <li>Beri peringkat pada $|d_i|$ dari terkecil (nilai kembar mendapat rata-rata peringkat).</li>
  <li>Jumlahkan peringkat selisih positif ($T^+$) dan selisih negatif ($T^-$).</li>
</ol>
$$T^+ + T^- = \frac{n(n+1)}{2}$$
<p>Bila $H_0$ benar, $T^+$ dan $T^-$ kira-kira sama. Salah satu yang sangat kecil menandakan hampir semua selisih berarah sama.</p>`
      },
      {
        id: 'pvalue', title: 'p-value: eksak dan pendekatan normal',
        html: String.raw`
<h3>Eksak</h3>
<p>Di bawah $H_0$, setiap selisih bertanda $+$ atau $-$ dengan peluang sama, sehingga ada $2^n$ susunan tanda yang sama mungkin. P-value dihitung dengan menghitung proporsi susunan yang menghasilkan $T^+$ sekurang-kurangnya seekstrem yang teramati. Dipakai otomatis bila tidak ada nilai kembar maupun selisih nol, dan $n \le 50$.</p>
<h3>Pendekatan normal</h3>
$$\mu_T = \frac{n(n+1)}{4}, \qquad \sigma_T = \sqrt{\frac{n(n+1)(2n+1)}{24} - \frac{\sum (t^3 - t)}{48}}, \qquad z = \frac{|T^+ - \mu_T| - 0{,}5}{\sigma_T}$$
<p>Suku $\sum(t^3-t)/48$ adalah koreksi nilai kembar, dan $0{,}5$ adalah koreksi kontinuitas.</p>
<div class="mt-box note" data-label="Daya uji pada n kecil">
  <p>Dengan $n$ sangat kecil, p-value terkecil yang mungkin sudah terbatas. Misalnya dengan $n = 6$ pengamatan, nilai p dua sisi terkecil adalah $2/64 \approx 0{,}031$, sehingga hanya susunan paling ekstrem yang bisa signifikan.</p>
</div>`
      },
      {
        id: 'efek', title: 'Ukuran efek',
        html: String.raw`
<p>Korelasi rank-biserial untuk uji signed-rank:</p>
$$r = \frac{T^+ - T^-}{T^+ + T^-}$$
<p>Nilainya dari $-1$ (semua selisih negatif) sampai $+1$ (semua selisih positif). Nilai di sekitar 0 berarti selisih positif dan negatif seimbang.</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh (berpasangan)">
  <p>Tekanan darah sebelum: 126, 130, 118, 140, 135, 128; sesudah: 120, 127, 119, 132, 130, 126.</p>
  <ol class="mt-steps">
    <li>Selisih $d$: 6, 3, $-1$, 8, 5, 2. Tidak ada yang nol sehingga $n = 6$.</li>
    <li>Peringkat $|d|$: 5, 3, 1, 6, 4, 2. Peringkat bertanda $+$: $5+3+6+4+2 = 20$, bertanda $-$: $1$.</li>
    <li>$T^+ = 20$, $T^- = 1$ (cek: $21 = 6 \cdot 7/2$). Tidak ada nilai kembar dan $n \le 50$, jadi p-value eksak dua sisi $= 0{,}0625$.</li>
    <li>$p \gt 0{,}05$, <strong>gagal tolak $H_0$</strong>, padahal 5 dari 6 subjek turun. Dengan $n = 6$ daya uji terbatas. Korelasi rank-biserial $r = 19/21 \approx 0{,}90$ menunjukkan efek yang besar.</li>
  </ol>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Pilih jenis uji (satu sampel dengan median acuan, atau berpasangan). Perhatikan jumlah selisih nol yang dibuang, nilai $T^+$ dan $T^-$, apakah p-value eksak atau pendekatan, dan ukuran efeknya.</p>
</div>`
      }
    ]
  });
})();
