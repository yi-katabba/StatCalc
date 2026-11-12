/* Materi: Uji Mann-Whitney (Wilcoxon rank-sum). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'mann-whitney', order: 13, method: 'mann-whitney', tone: 'navy',
    title: 'Uji Mann-Whitney', subtitle: 'Dua Sampel Independen',
    desc: 'Alternatif nonparametrik uji t dua sampel berdasarkan peringkat: statistik U, p-value eksak atau pendekatan normal dengan koreksi nilai kembar, korelasi rank-biserial, dan probabilitas superioritas.',
    keywords: ['Mann-Whitney', 'Wilcoxon rank-sum', 'rank-sum', 'U', 'peringkat', 'nonparametrik', 'dua sampel', 'independen', 'median', 'nilai kembar', 'ties', 'rank-biserial', 'probabilitas superioritas', 'CLES', 'eksak'],
    icon: '<path d="M4 20V12M9 20V6M15 20v-5M20 20V9"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dan kapan dipakai',
        html: String.raw`
<p>Uji Mann-Whitney membandingkan dua kelompok independen <strong>berdasarkan peringkat</strong>, bukan nilai asli. Ini alternatif nonparametrik untuk uji t dua sampel, dipakai bila:</p>
<ul>
  <li>data tidak normal dan sampel kecil,</li>
  <li>data berskala ordinal (mis. skala kepuasan 1&ndash;5),</li>
  <li>ada pencilan yang ingin tidak dibiarkan mendominasi hasil.</li>
</ul>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0$: kedua kelompok berasal dari sebaran yang sama. $H_1$: sebaran salah satu kelompok bergeser ke nilai yang lebih besar atau lebih kecil. Bila bentuk sebaran kedua kelompok serupa, ini dapat dibaca sebagai perbedaan median.</p>
</div>
<div class="mt-box note" data-label="Uji ini sama dengan Wilcoxon rank-sum">
  <p>Mann-Whitney dan Wilcoxon rank-sum adalah dua nama untuk uji yang sama (statistiknya $U$ dan $W$ hanya berbeda konstanta). Jangan tertukar dengan Wilcoxon <em>signed-rank</em> yang dipakai untuk data berpasangan.</p>
</div>`
      },
      {
        id: 'statistik', title: 'Peringkat dan statistik U',
        html: String.raw`
<ol class="mt-steps">
  <li>Gabungkan kedua kelompok ($N = n_1 + n_2$ data), urutkan dari terkecil, lalu beri peringkat 1 sampai $N$. Nilai kembar mendapat <strong>rata-rata peringkat</strong> yang mereka tempati.</li>
  <li>Jumlahkan peringkat tiap kelompok: $R_1$ dan $R_2$ (selalu $R_1 + R_2 = N(N+1)/2$).</li>
  <li>Hitung statistik $U$ untuk tiap kelompok:</li>
</ol>
$$U_1 = R_1 - \frac{n_1(n_1+1)}{2}, \qquad U_2 = n_1 n_2 - U_1$$
<p>$U_1$ dapat ditafsirkan sebagai banyaknya pasangan $(x_i, y_j)$ dengan $x_i \gt y_j$. Jika kedua kelompok setara, $U_1$ mendekati $n_1 n_2/2$.</p>`
      },
      {
        id: 'pvalue', title: 'p-value: eksak dan pendekatan normal',
        html: String.raw`
<h3>Eksak</h3>
<p>Untuk sampel kecil tanpa nilai kembar, p-value dihitung langsung dari semua kemungkinan susunan peringkat. Aplikasi memakai metode eksak secara otomatis bila $N \le 40$ dan tidak ada nilai kembar.</p>
<h3>Pendekatan normal</h3>
<p>Untuk sampel lebih besar atau ada nilai kembar:</p>
$$\mu_U = \frac{n_1 n_2}{2}, \qquad \sigma_U = \sqrt{\frac{n_1 n_2}{12}\left[(N+1) - \frac{\sum (t^3 - t)}{N(N-1)}\right]}, \qquad z = \frac{U - \mu_U \mp 0{,}5}{\sigma_U}$$
<p>$t$ adalah banyaknya data yang kembar pada tiap kelompok nilai kembar (suku $\sum(t^3-t)$ adalah koreksi nilai kembar), dan $0{,}5$ adalah koreksi kontinuitas.</p>
<div class="mt-box warn" data-label="Nilai kembar">
  <p>Bila banyak nilai kembar (mis. data skala 1&ndash;5), p-value eksak tidak berlaku dan pendekatan normal dengan koreksi dipakai. Data dengan hampir semua nilai kembar mengurangi daya uji.</p>
</div>`
      },
      {
        id: 'efek', title: 'Ukuran efek',
        html: String.raw`
<p>p-value hanya menjawab &ldquo;ada beda atau tidak&rdquo;. Dua ukuran efek melengkapinya:</p>
<ul>
  <li><strong>Korelasi rank-biserial</strong>: $r = \dfrac{U_1 - U_2}{n_1 n_2}$, berkisar $-1$ sampai $1$. Positif berarti kelompok 1 cenderung bernilai lebih besar.</li>
  <li><strong>Probabilitas superioritas</strong>: $P(X \gt Y) = \dfrac{U_1}{n_1 n_2}$, peluang nilai acak dari kelompok 1 lebih besar daripada nilai acak dari kelompok 2 (nilai kembar dihitung setengah). Nilai 0,5 berarti setara.</li>
</ul>
<p>Keduanya terkait: $r = 2\,P(X \gt Y) - 1$.</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Kelompok 1: 19, 22, 16, 29, 24 ($n_1 = 5$). Kelompok 2: 20, 11, 17, 12, 21, 14 ($n_2 = 6$). Uji dua sisi, $\alpha = 0{,}05$.</p>
  <ol class="mt-steps">
    <li>Peringkat gabungan kelompok 1: 6, 9, 4, 11, 10, jadi $R_1 = 40$. Kelompok 2: $R_2 = 26$ (cek: $40 + 26 = 66 = 11 \cdot 12/2$).</li>
    <li>$U_1 = 40 - 15 = 25$ dan $U_2 = 30 - 25 = 5$.</li>
    <li>Tanpa nilai kembar dan $N = 11 \le 40$, jadi p-value eksak: $p \approx 0{,}082$.</li>
    <li>$p \gt 0{,}05$, <strong>gagal tolak $H_0$</strong>. Namun $r = (25-5)/30 \approx 0{,}67$ dan $P(X \gt Y) \approx 0{,}83$: kelompok 1 cenderung lebih tinggi, hanya saja sampelnya terlalu kecil untuk membuktikannya.</li>
  </ol>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Perhatikan rata-rata peringkat dan median tiap kelompok, nilai $U$, p-value (dan apakah eksak atau pendekatan), lalu ukuran efeknya. Laporkan median (bukan rata-rata) untuk menggambarkan kelompok.</p>
</div>`
      }
    ]
  });
})();
