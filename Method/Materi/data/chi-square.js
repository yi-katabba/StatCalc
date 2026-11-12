/* Materi: Uji Chi-Square (independensi dan kesesuaian). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'chi-square', order: 17, method: 'chi-square', tone: 'plum',
    title: 'Uji Chi-Square', subtitle: 'Independensi & Kesesuaian',
    desc: 'Uji independensi dua variabel kategorik dari tabel kontingensi dan uji kesesuaian frekuensi terhadap proporsi harapan: frekuensi harapan, koreksi Yates, residu terstandar, Cram\u00E9r\u2019s V, dan syarat sel kecil.',
    keywords: ['chi-square', 'chi-kuadrat', 'independensi', 'kesesuaian', 'goodness of fit', 'tabel kontingensi', 'frekuensi harapan', 'frekuensi amatan', 'Yates', 'Cramér V', 'phi', 'koefisien kontingensi', 'residu', 'kategorik', 'rasio kemungkinan', 'G'],
    icon: '<path d="M6 6h12v12H6z"/><path d="M6 12h12M12 6v12"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep: data kategorik dan dua jenis uji',
        html: String.raw`
<p>Uji chi-kuadrat membandingkan <strong>frekuensi amatan</strong> ($O$) dengan <strong>frekuensi harapan</strong> ($E$) bila $H_0$ benar. Datanya berupa hitungan pada kategori, bukan nilai numerik.</p>
<div class="mt-tw"><table>
<thead><tr><th>Jenis uji</th><th>Pertanyaan</th><th>Data</th></tr></thead>
<tbody>
<tr><td><strong>Independensi</strong></td><td>Apakah dua variabel kategorik saling berhubungan? (mis. jurusan dan preferensi merek)</td><td>Tabel kontingensi $r \times c$</td></tr>
<tr><td><strong>Kesesuaian (goodness of fit)</strong></td><td>Apakah sebaran satu variabel kategorik sesuai proporsi yang dihipotesiskan? (mis. dadu seimbang)</td><td>Satu baris frekuensi</td></tr>
</tbody></table></div>
<div class="mt-box key" data-label="Statistik uji">
  <p>$$\chi^2 = \sum \frac{(O - E)^2}{E}$$</p>
  <p>Semakin jauh amatan dari harapan, semakin besar $\chi^2$. Uji ini selalu <strong>satu sisi (ekor kanan)</strong>.</p>
</div>`
      },
      {
        id: 'independensi', title: 'Uji independensi',
        html: String.raw`
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0$: kedua variabel independen (tidak ada hubungan). $H_1$: kedua variabel berhubungan.</p>
</div>
<p>Frekuensi harapan tiap sel dihitung dari total baris dan kolom:</p>
$$E_{ij} = \frac{(\text{total baris } i)\times(\text{total kolom } j)}{N}, \qquad db = (r-1)(c-1)$$
<p>Aplikasi juga menampilkan <strong>uji rasio kemungkinan</strong> (statistik $G = 2\sum O \ln(O/E)$), yang hasilnya biasanya mirip.</p>
<h3>Koreksi Yates (tabel 2 &times; 2)</h3>
<p>Untuk tabel 2 &times; 2, $\chi^2$ dapat dikoreksi agar distribusi diskret lebih cocok dengan chi-kuadrat yang kontinu:</p>
$$\chi^2_{\text{Yates}} = \sum \frac{\left(|O - E| - 0{,}5\right)^2}{E}$$
<p>Koreksi ini konservatif. Bila sampel kecil, pertimbangkan Uji Eksak Fisher.</p>`
      },
      {
        id: 'kesesuaian', title: 'Uji kesesuaian (goodness of fit)',
        html: String.raw`
<div class="mt-box def" data-label="Hipotesis">
  <p>$H_0$: sebaran populasi mengikuti proporsi $p_1, \dots, p_k$ yang ditentukan. $H_1$: tidak sesuai.</p>
</div>
$$E_i = N\,p_i, \qquad db = k - 1$$
<p>Bila proporsi tidak diisi, aplikasi mengasumsikan semua kategori sama ($p_i = 1/k$). Ukuran efek: $w = \sqrt{\chi^2/N}$.</p>`
      },
      {
        id: 'syarat', title: 'Syarat sel dan residu',
        html: String.raw`
<div class="mt-box warn" data-label="Syarat frekuensi harapan">
  <p>Pendekatan chi-kuadrat baik bila <strong>semua $E \ge 1$</strong> dan <strong>tidak lebih dari 20% sel</strong> memiliki $E \lt 5$. Jika banyak sel harapan kecil, gabungkan kategori yang berdekatan secara logis atau pakai uji eksak.</p>
</div>
<h3>Residu: sel mana yang menyumbang?</h3>
<p>Uji chi-kuadrat yang signifikan hanya menyatakan ada hubungan. Residu terstandar menunjukkan sel mana yang menyimpang:</p>
$$\text{residu} = \frac{O - E}{\sqrt{E}}$$
<p>Residu terstandar terkoreksi (<em>adjusted</em>) memakai pembagi yang memperhitungkan total baris dan kolom, sehingga kira-kira mengikuti normal baku: nilai di atas $|2|$ menandakan sel itu menyimpang nyata dari harapan.</p>`
      },
      {
        id: 'efek', title: 'Ukuran efek: Cram\u00E9r\u2019s V',
        html: String.raw`
<p>$\chi^2$ membesar seiring $N$, sehingga tidak menunjukkan <em>kekuatan</em> hubungan. Cram&eacute;r&rsquo;s $V$ menyatakannya dalam skala 0 sampai 1:</p>
$$V = \sqrt{\frac{\chi^2}{N\,\min(r-1,\,c-1)}}$$
<p>Untuk tabel 2 &times; 2, aplikasi juga menampilkan koefisien $\phi$ dan koefisien kontingensi $C = \sqrt{\chi^2/(\chi^2+N)}$. Patokan umum $V$ untuk tabel kecil: sekitar 0,1 (kecil), 0,3 (sedang), 0,5 (besar).</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Independensi">
  <p>Pilihan jenis kelas (kolom: pagi, siang, malam) menurut kelompok (baris):</p>
  <div class="mt-tw"><table>
  <thead><tr><th></th><th>Pagi</th><th>Siang</th><th>Malam</th><th>Total</th></tr></thead>
  <tbody>
  <tr><td>Kelompok 1</td><td>30</td><td>20</td><td>10</td><td>60</td></tr>
  <tr><td>Kelompok 2</td><td>20</td><td>30</td><td>40</td><td>90</td></tr>
  <tr><td>Total</td><td>50</td><td>50</td><td>50</td><td>150</td></tr>
  </tbody></table></div>
  <ol class="mt-steps">
    <li>$E$ baris 1 = 20, 20, 20 (mis. $60 \times 50/150$); $E$ baris 2 = 30, 30, 30. Semua $E \ge 5$.</li>
    <li>$\chi^2 = \dfrac{10^2}{20} + 0 + \dfrac{10^2}{20} + \dfrac{10^2}{30} + 0 + \dfrac{10^2}{30} \approx 16{,}67$ dengan $db = (2-1)(3-1) = 2$.</li>
    <li>$p \approx 0{,}0002$, <strong>tolak $H_0$</strong>: pilihan jenis kelas berhubungan dengan kelompok.</li>
    <li>$V = \sqrt{16{,}67/(150 \times 1)} \approx 0{,}33$ (hubungan sedang). Residu terbesar terdapat pada kolom pagi dan malam ($\pm 2{,}24$ untuk kelompok 1), sedangkan kolom siang tepat sesuai harapan.</li>
  </ol>
</div>
<div class="mt-box ex" data-label="Kesesuaian">
  <p>Dadu dilempar 60 kali; frekuensi sisi 1&ndash;6: 8, 12, 9, 11, 6, 14. $H_0$: dadu seimbang, sehingga $E = 10$ untuk tiap sisi.</p>
  <p>$\chi^2 = (4+4+1+1+16+16)/10 = 4{,}2$, $db = 5$, $p \approx 0{,}52$. <strong>Gagal tolak $H_0$</strong>: tidak ada bukti dadu tidak seimbang.</p>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Cek dulu peringatan sel dengan $E \lt 5$. Baca $\chi^2$, $db$, $p$ (untuk 2 &times; 2, lihat juga versi Yates), lalu Cram&eacute;r&rsquo;s $V$ dan residu untuk mengetahui sel yang berperan.</p>
</div>`
      }
    ]
  });
})();
