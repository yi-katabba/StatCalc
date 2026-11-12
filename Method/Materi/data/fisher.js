/* Materi: Uji Eksak Fisher (tabel 2 x 2). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'fisher', order: 18, method: 'fisher', tone: 'plum',
    title: 'Uji Eksak Fisher', subtitle: 'Tabel 2 \u00D7 2',
    desc: 'Uji independensi eksak untuk tabel 2 \u00D7 2 pada sampel kecil: distribusi hipergeometrik, p-value satu dan dua sisi, rasio odds dengan selang kepercayaan, serta risiko relatif dan selisih risiko.',
    keywords: ['Fisher', 'eksak', 'tabel 2x2', 'hipergeometrik', 'rasio odds', 'odds ratio', 'risiko relatif', 'selisih risiko', 'sampel kecil', 'independensi', 'Haldane', 'selang kepercayaan', 'tabel kontingensi'],
    icon: '<path d="M5 5h14v14H5z"/><path d="M5 12h14M12 5v14"/><circle cx="8.5" cy="8.5" r="1"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dan kapan dipakai',
        html: String.raw`
<p>Uji eksak Fisher menguji hubungan dua variabel biner pada tabel 2 &times; 2 <strong>tanpa pendekatan chi-kuadrat</strong>. P-value dihitung langsung dari peluang, sehingga sahih untuk sampel kecil.</p>
<div class="mt-tw"><table>
<thead><tr><th></th><th>Hasil &ldquo;ya&rdquo;</th><th>Hasil &ldquo;tidak&rdquo;</th><th>Total</th></tr></thead>
<tbody>
<tr><td>Kelompok 1</td><td>$a$</td><td>$b$</td><td>$a+b$</td></tr>
<tr><td>Kelompok 2</td><td>$c$</td><td>$d$</td><td>$c+d$</td></tr>
<tr><td>Total</td><td>$a+c$</td><td>$b+d$</td><td>$n$</td></tr>
</tbody></table></div>
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0$: kedua variabel independen (rasio odds $= 1$). $H_1$: ada hubungan (rasio odds $\ne 1$; atau $\gt 1$ / $\lt 1$ untuk satu sisi).</p>
</div>
<div class="mt-box note" data-label="Kapan memilih Fisher dibanding chi-kuadrat?">
  <p>Pilih Fisher bila ada sel dengan frekuensi harapan kecil (di bawah sekitar 5) atau $n$ kecil. Pada sampel besar, hasilnya hampir sama dengan chi-kuadrat.</p>
</div>`
      },
      {
        id: 'hipergeometrik', title: 'Distribusi hipergeometrik dan p-value',
        html: String.raw`
<p>Dengan semua total baris dan kolom dianggap tetap, peluang memperoleh tepat $a$ pada sel kiri-atas bila $H_0$ benar mengikuti distribusi hipergeometrik:</p>
$$P(a) = \frac{\dbinom{a+b}{a}\dbinom{c+d}{c}}{\dbinom{n}{a+c}}$$
<ul>
  <li><strong>Satu sisi</strong> ($H_1$: odds $\gt 1$): $p = \sum_{x \ge a} P(x)$. Untuk ($H_1$: odds $\lt 1$): $p = \sum_{x \le a} P(x)$.</li>
  <li><strong>Dua sisi</strong>: jumlahkan peluang semua tabel yang peluangnya <strong>tidak lebih besar</strong> daripada $P(a)$ yang teramati.</li>
</ul>
<p>Tidak ada statistik uji seperti $t$ atau $\chi^2$; p-value langsung berasal dari penjumlahan peluang.</p>`
      },
      {
        id: 'efek', title: 'Rasio odds, risiko relatif, dan selisih risiko',
        html: String.raw`
<h3>Rasio odds</h3>
$$OR = \frac{a/b}{c/d} = \frac{ad}{bc}$$
<p>$OR = 1$ berarti tidak ada hubungan; $OR \gt 1$ berarti odds &ldquo;ya&rdquo; kelompok 1 lebih besar daripada kelompok 2. Selang kepercayaan dihitung pada skala log (metode Woolf):</p>
$$\ln OR \pm z_{\alpha/2}\sqrt{\frac{1}{a}+\frac{1}{b}+\frac{1}{c}+\frac{1}{d}}$$
<p>Bila ada sel yang bernilai 0, ditambahkan 0,5 pada setiap sel (koreksi Haldane) agar selang dapat dihitung.</p>
<h3>Ukuran lain</h3>
<ul>
  <li><strong>Risiko relatif</strong>: $RR = \dfrac{a/(a+b)}{c/(c+d)}$, perbandingan proporsi &ldquo;ya&rdquo; kedua kelompok.</li>
  <li><strong>Selisih risiko</strong>: $RD = \dfrac{a}{a+b} - \dfrac{c}{c+d}$.</li>
</ul>
<div class="mt-box warn" data-label="Odds bukan risiko">
  <p>Rasio odds dan risiko relatif hanya hampir sama bila kejadian jarang. Pada kejadian yang sering, odds ratio berada lebih jauh dari 1 daripada risiko relatif; jangan menafsirkan OR sebagai &ldquo;berapa kali lebih berisiko&rdquo;.</p>
</div>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Uji obat pada 16 pasien. Obat baru: 8 sembuh, 2 tidak ($a = 8$, $b = 2$). Plasebo: 1 sembuh, 5 tidak ($c = 1$, $d = 5$).</p>
  <ol class="mt-steps">
    <li>Proporsi sembuh: obat $8/10 = 0{,}80$, plasebo $1/6 \approx 0{,}17$. Beberapa frekuensi harapan di bawah 5, jadi Fisher lebih tepat daripada chi-kuadrat.</li>
    <li>P-value dua sisi (jumlah peluang tabel yang tidak lebih mungkin daripada tabel teramati): $p \approx 0{,}035$. <strong>Tolak $H_0$</strong> pada $\alpha = 0{,}05$.</li>
    <li>$OR = (8 \times 5)/(2 \times 1) = 20$. Galat baku $\sqrt{1/8 + 1/2 + 1 + 1/5} \approx 1{,}351$, sehingga selang 95%: $[1{,}42;\ 282{,}5]$.</li>
  </ol>
  <p>Selangnya sangat lebar karena sampel kecil: ada efek (selang tidak memuat 1), tetapi besarnya belum dapat ditentukan dengan baik. Selisih risiko $RD \approx 0{,}63$.</p>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Masukkan empat frekuensi sel. Baca p-value (sesuai arah $H_1$), rasio odds beserta selangnya, dan risiko relatif / selisih risiko. Selang yang sangat lebar menandakan ketidakpastian, bukan efek yang sangat besar.</p>
</div>`
      }
    ]
  });
})();
