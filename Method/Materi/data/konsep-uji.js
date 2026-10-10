/* Materi: Dasar Uji Hipotesis (dipakai oleh Regresi, ANOVA, dan Uji Stasioneritas). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'konsep-uji', order: 2, method: null, tone: 'gold',
    title: 'Dasar Uji Hipotesis', subtitle: 'H0, p-value, taraf signifikansi',
    desc: 'Konsep yang dipakai di hampir semua metode: hipotesis, taraf signifikansi, statistik uji, nilai kritis, p-value, dan distribusi t, F, serta chi-kuadrat.',
    keywords: ['hipotesis', 'H0', 'H1', 'p-value', 'alpha', 'taraf signifikansi', 'galat tipe I', 'galat tipe II', 'derajat bebas', 'distribusi t', 'distribusi F', 'chi-kuadrat', 'nilai kritis', 'tolak H0'],
    icon: '<path d="M12 4v16M6 4h12M8 20h8"/>',
    sections: [
      {
        id: 'hipotesis', title: 'Hipotesis nol dan alternatif',
        html: String.raw`
<p>Uji hipotesis adalah prosedur untuk memutuskan, berdasarkan data sampel, apakah suatu dugaan tentang populasi cukup didukung bukti. Dugaan itu dirumuskan sebagai dua pernyataan yang saling berlawanan:</p>
<div class="mt-box def" data-label="Definisi">
  <ul>
    <li><strong>$H_0$ (hipotesis nol)</strong>: pernyataan &ldquo;tidak ada efek / tidak ada perbedaan / tidak ada hubungan&rdquo;. Ini posisi awal yang dianggap benar sampai terbukti sebaliknya.</li>
    <li><strong>$H_1$ (hipotesis alternatif)</strong>: pernyataan yang ingin dibuktikan oleh peneliti.</li>
  </ul>
</div>
<div class="mt-tw"><table>
<thead><tr><th>Metode</th><th>$H_0$</th><th>$H_1$</th></tr></thead>
<tbody>
<tr><td>Uji F regresi</td><td>$\beta_1 = \beta_2 = \dots = \beta_k = 0$</td><td>Minimal satu $\beta_j \ne 0$</td></tr>
<tr><td>Uji t koefisien</td><td>$\beta_j = 0$</td><td>$\beta_j \ne 0$</td></tr>
<tr><td>ANOVA</td><td>$\mu_1 = \mu_2 = \dots = \mu_k$</td><td>Minimal satu rata-rata berbeda</td></tr>
<tr><td>ADF (stasioneritas)</td><td>$\gamma = 0$ (ada akar unit)</td><td>$\gamma \lt 0$ (stasioner)</td></tr>
<tr><td>Jarque-Bera</td><td>Residual normal</td><td>Residual tidak normal</td></tr>
</tbody></table></div>

<h3>Satu sisi dan dua sisi</h3>
<ul>
  <li><strong>Dua sisi</strong> ($H_1$: $\ne$): menolak $H_0$ jika statistik uji terlalu besar <em>atau</em> terlalu kecil. Contoh: uji t koefisien.</li>
  <li><strong>Satu sisi</strong> ($H_1$: $\lt$ atau $\gt$): menolak $H_0$ hanya di satu ujung. Contoh: ADF (hanya ekor kiri) dan uji F (hanya ekor kanan).</li>
</ul>`
      },
      {
        id: 'galat', title: 'Taraf signifikansi dan jenis galat',
        html: String.raw`
<p>Keputusan uji bisa keliru. Ada dua jenis kekeliruan:</p>
<div class="mt-tw"><table>
<thead><tr><th></th><th>$H_0$ benar</th><th>$H_0$ salah</th></tr></thead>
<tbody>
<tr><td><strong>Tolak $H_0$</strong></td><td>Galat tipe I (peluang $\alpha$)</td><td>Keputusan benar (daya uji $1-\beta$)</td></tr>
<tr><td><strong>Gagal tolak $H_0$</strong></td><td>Keputusan benar</td><td>Galat tipe II (peluang $\beta$)</td></tr>
</tbody></table></div>
<ul>
  <li>$\alpha$ disebut <strong>taraf signifikansi</strong>: batas peluang yang kita terima untuk menolak $H_0$ padahal $H_0$ benar. Nilai yang umum: $\alpha = 0{,}05$ (5%). Aplikasi ini memakai 5%.</li>
  <li><strong>Daya uji</strong> $1-\beta$ adalah peluang mendeteksi efek yang memang ada. Daya naik bila data lebih banyak dan efek lebih besar.</li>
</ul>
<div class="mt-box note" data-label="Catatan">
  <p>Mengecilkan $\alpha$ (misal 1%) mengurangi galat tipe I tetapi menaikkan galat tipe II. Pilih $\alpha$ sebelum melihat hasil, bukan sesudahnya.</p>
</div>`
      },
      {
        id: 'statistik-uji', title: 'Statistik uji dan nilai kritis',
        html: String.raw`
<p><strong>Statistik uji</strong> adalah satu angka yang dihitung dari data untuk mengukur seberapa jauh data menyimpang dari $H_0$. Bentuk umumnya:</p>
$$\text{statistik uji} = \frac{\text{taksiran} - \text{nilai di } H_0}{\text{galat baku taksiran}}$$
<p>Contoh: pada uji t koefisien, $t = \dfrac{\hat{\beta}_j - 0}{SE(\hat{\beta}_j)}$.</p>
<p><strong>Nilai kritis</strong> adalah batas dari tabel distribusi yang memisahkan daerah &ldquo;gagal tolak&rdquo; dan daerah &ldquo;tolak&rdquo; untuk $\alpha$ tertentu.</p>
<div class="mt-box key" data-label="Aturan keputusan">
  <ul>
    <li>Statistik uji jatuh di daerah penolakan (melewati nilai kritis) $\Rightarrow$ <strong>tolak $H_0$</strong>.</li>
    <li>Statistik uji tidak melewati nilai kritis $\Rightarrow$ <strong>gagal tolak $H_0$</strong>.</li>
  </ul>
</div>
<p>Derajat bebas (db atau df) menentukan bentuk distribusi pembanding. Secara umum $db = $ banyaknya data $-$ banyaknya parameter yang ditaksir.</p>`
      },
      {
        id: 'p-value', title: 'p-value',
        html: String.raw`
<div class="mt-box def" data-label="Definisi">
  <p><strong>p-value</strong> adalah peluang memperoleh statistik uji <em>seekstrem atau lebih ekstrem</em> daripada yang teramati, <strong>jika $H_0$ benar</strong>.</p>
</div>
<p>Semakin kecil p-value, semakin sulit data dijelaskan oleh $H_0$.</p>
<div class="mt-box key" data-label="Aturan keputusan">
  <p>$$p \lt \alpha \;\Rightarrow\; \text{tolak } H_0 \qquad\qquad p \ge \alpha \;\Rightarrow\; \text{gagal tolak } H_0$$</p>
</div>
<p>Dengan $\alpha = 0{,}05$: $p = 0{,}003$ berarti tolak $H_0$ (signifikan), sedangkan $p = 0{,}124$ berarti gagal tolak $H_0$ (tidak signifikan).</p>
<div class="mt-box warn" data-label="Salah kaprah yang umum">
  <ul>
    <li>p-value <strong>bukan</strong> peluang $H_0$ benar.</li>
    <li>&ldquo;Gagal tolak $H_0$&rdquo; <strong>bukan</strong> bukti bahwa $H_0$ benar. Bisa jadi data terlalu sedikit untuk mendeteksi efek.</li>
    <li>&ldquo;Signifikan&rdquo; tidak otomatis berarti &ldquo;penting&rdquo;. Dengan data sangat banyak, efek sangat kecil pun bisa signifikan. Lihat juga ukuran efek (misal $R^2$ atau $\eta^2$).</li>
  </ul>
</div>`
      },
      {
        id: 'distribusi', title: 'Distribusi t, F, dan chi-kuadrat',
        html: String.raw`
<div class="mt-tw"><table>
<thead><tr><th>Distribusi</th><th>Parameter</th><th>Dipakai pada</th></tr></thead>
<tbody>
<tr><td><strong>Normal baku</strong> $Z$</td><td>&mdash;</td><td>Dasar teori; pendekatan untuk sampel besar.</td></tr>
<tr><td><strong>$t$</strong></td><td>db $= v$</td><td>Uji koefisien regresi, CI rata-rata. Mirip normal tetapi ekor lebih tebal; mendekati normal bila $v$ besar.</td></tr>
<tr><td><strong>$F$</strong></td><td>db $= (v_1, v_2)$</td><td>Uji F regresi dan ANOVA. Nilainya selalu $\ge 0$ dan menceng kanan; uji selalu satu sisi (ekor kanan).</td></tr>
<tr><td><strong>$\chi^2$</strong></td><td>db $= v$</td><td>Uji Jarque-Bera (db 2), uji kesesuaian dan independensi.</td></tr>
<tr><td><strong>Dickey-Fuller (MacKinnon)</strong></td><td>model uji, $N$</td><td>ADF. Bukan distribusi $t$ biasa; lihat materi Uji Stasioneritas.</td></tr>
</tbody></table></div>
<p>Hubungan yang berguna: untuk satu koefisien, $t^2 = F$ dengan db $(1, v)$. Karena itu uji t dua sisi dan uji F pada regresi sederhana selalu memberi p-value yang sama.</p>`
      },
      {
        id: 'langkah', title: 'Lima langkah uji hipotesis',
        html: String.raw`
<ol class="mt-steps">
  <li><strong>Rumuskan hipotesis</strong> $H_0$ dan $H_1$.</li>
  <li><strong>Tentukan taraf signifikansi</strong> $\alpha$ (di aplikasi: 0,05).</li>
  <li><strong>Hitung statistik uji</strong> dari data (aplikasi menampilkan langkah hitung di tab &ldquo;Langkah Perhitungan&rdquo;).</li>
  <li><strong>Ambil keputusan</strong> dengan membandingkan statistik uji dengan nilai kritis, atau p-value dengan $\alpha$.</li>
  <li><strong>Tulis kesimpulan</strong> dalam bahasa masalahnya, bukan hanya &ldquo;tolak $H_0$&rdquo;. Misalnya: &ldquo;Ada perbedaan rata-rata nilai yang signifikan antar metode mengajar pada taraf 5%.&rdquo;</li>
</ol>
<div class="mt-box ex" data-label="Contoh">
  <p>Uji F regresi menghasilkan $F = 4{,}5$ dengan db $(1,3)$ dan $p = 0{,}124$. Karena $0{,}124 \ge 0{,}05$, $H_0$ gagal ditolak: pada taraf 5% belum cukup bukti bahwa $X$ berpengaruh terhadap $Y$. Dengan $n=5$ saja, daya uji memang rendah.</p>
</div>`
      }
    ]
  });
})();
