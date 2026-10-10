/* Materi: ANOVA satu arah & dua arah (terhubung ke Method/Stat/anova.js). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'anova', order: 4, method: 'anova', tone: 'plum',
    title: 'ANOVA', subtitle: 'Satu Arah & Dua Arah',
    desc: 'Membandingkan rata-rata lebih dari dua kelompok: jumlah kuadrat, kuadrat tengah, uji F, interaksi dua faktor, asumsi, dan uji lanjut.',
    keywords: ['anova', 'analisis ragam', 'F', 'JKA', 'JKD', 'JKG', 'jumlah kuadrat', 'kuadrat tengah', 'interaksi', 'faktor', 'perlakuan', 'kelompok', 'Tukey', 'post hoc', 'eta kuadrat', 'homogenitas'],
    icon: '<path d="M4 20V10M10 20V4M16 20v-7M4 20h16"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep dasar ANOVA',
        html: String.raw`
<p><strong>ANOVA</strong> (<em>analysis of variance</em>, analisis ragam) menguji apakah rata-rata beberapa kelompok sama. Walaupun yang dibandingkan adalah rata-rata, uji ini bekerja dengan membandingkan <strong>dua macam ragam</strong>:</p>
<ul>
  <li><strong>Ragam antar kelompok</strong>: seberapa jauh rata-rata kelompok berbeda satu sama lain.</li>
  <li><strong>Ragam dalam kelompok</strong>: seberapa bervariasi data di dalam kelompok yang sama (variasi acak atau galat).</li>
</ul>
<p>Jika perbedaan antar kelompok jauh lebih besar daripada variasi acak di dalam kelompok, rata-rata kelompok dianggap berbeda.</p>
<div class="mt-box note" data-label="Mengapa tidak uji t berulang?">
  <p>Membandingkan 3 kelompok dengan 3 uji t berpasangan menaikkan peluang galat tipe I jauh di atas 5% (sekitar $1-0{,}95^3 \approx 14{,}3\%$). ANOVA menguji semua kelompok sekaligus dengan galat tipe I tetap $\alpha$.</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th>Jenis</th><th>Faktor</th><th>Contoh</th></tr></thead>
<tbody>
<tr><td><strong>Satu arah</strong> (one-way)</td><td>1 faktor, $k$ level</td><td>Nilai ujian menurut 3 metode mengajar</td></tr>
<tr><td><strong>Dua arah</strong> (two-way)</td><td>2 faktor A dan B, dengan interaksi</td><td>Hasil panen menurut jenis pupuk (A) dan varietas (B)</td></tr>
</tbody></table></div>`
      },
      {
        id: 'asumsi', title: 'Hipotesis dan asumsi',
        html: String.raw`
<div class="mt-box def" data-label="Hipotesis (satu arah)">
  <p>$H_0: \mu_1 = \mu_2 = \dots = \mu_k$ (semua rata-rata kelompok sama)</p>
  <p>$H_1:$ minimal satu rata-rata berbeda</p>
</div>
<p>ANOVA mensyaratkan:</p>
<ol>
  <li><strong>Independen</strong>: pengamatan saling bebas, baik di dalam maupun antar kelompok.</li>
  <li><strong>Normalitas</strong>: galat (residual, yaitu data dikurangi rata-rata kelompoknya) berdistribusi normal. Periksa dengan Q-Q plot dan histogram residual di tab Grafik.</li>
  <li><strong>Homogenitas ragam</strong>: ragam tiap kelompok kurang lebih sama. Aturan praktis: ragam terbesar tidak lebih dari sekitar 4 kali ragam terkecil, dan ukuran kelompok mirip. Bandingkan lebar boxplot antar kelompok.</li>
</ol>
<div class="mt-box note" data-label="Ketahanan">
  <p>ANOVA cukup tahan terhadap pelanggaran ringan normalitas bila ukuran kelompok sama dan tidak terlalu kecil. Pelanggaran homogenitas lebih berbahaya bila ukuran kelompok sangat berbeda.</p>
</div>`
      },
      {
        id: 'satu-arah', title: 'ANOVA satu arah',
        html: String.raw`
<p>Notasi: $k$ kelompok, kelompok ke-$j$ berisi $n_j$ data, total $N = \sum n_j$. $x_{ij}$ adalah data ke-$i$ pada kelompok ke-$j$.</p>
<h3>Rata-rata</h3>
$$\bar{x}_j = \frac{\sum_i x_{ij}}{n_j},\qquad \bar{x} = \frac{\sum_j\sum_i x_{ij}}{N}$$
<h3>Jumlah kuadrat (JK)</h3>
$$JKA = \sum_{j=1}^{k} n_j\,(\bar{x}_j - \bar{x})^2\quad\text{(antar kelompok / SSB)}$$
$$JKD = \sum_{j=1}^{k}\sum_{i=1}^{n_j} (x_{ij} - \bar{x}_j)^2\quad\text{(dalam kelompok / SSW)}$$
$$JKT = \sum_{j}\sum_{i} (x_{ij} - \bar{x})^2 = JKA + JKD$$
<h3>Kuadrat tengah (KT) dan statistik F</h3>
<p>Kuadrat tengah adalah jumlah kuadrat dibagi derajat bebasnya:</p>
$$KTA = \frac{JKA}{k-1},\qquad KTD = \frac{JKD}{N-k},\qquad F = \frac{KTA}{KTD}\;\sim\; F_{(k-1,\;N-k)}$$
<div class="mt-tw"><table>
<thead><tr><th>Sumber</th><th>JK</th><th>db</th><th>KT</th><th>F</th></tr></thead>
<tbody>
<tr><td>Antar kelompok</td><td>$JKA$</td><td>$k-1$</td><td>$KTA$</td><td>$KTA/KTD$</td></tr>
<tr><td>Dalam kelompok</td><td>$JKD$</td><td>$N-k$</td><td>$KTD$</td><td></td></tr>
<tr><td>Total</td><td>$JKT$</td><td>$N-1$</td><td></td><td></td></tr>
</tbody></table></div>
<div class="mt-box key" data-label="Keputusan">
  <p>Tolak $H_0$ bila $p \lt 0{,}05$ (setara $F$ hitung $>$ $F$ tabel). Berarti minimal ada satu pasang kelompok dengan rata-rata berbeda. ANOVA tidak menunjukkan <em>kelompok mana</em> yang berbeda (lihat bagian uji lanjut).</p>
</div>
<h3>Ukuran efek</h3>
$$\eta^2 = \frac{JKA}{JKT}$$
<p>Proporsi variasi total yang berasal dari perbedaan antar kelompok. Di aplikasi, porsi ini ditunjukkan pada grafik komponen variasi. Pedoman umum: 0,01 kecil, 0,06 sedang, 0,14 besar.</p>`
      },
      {
        id: 'contoh-satu', title: 'Contoh hitung satu arah',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Nilai tiga kelompok (masing-masing $n_j = 3$, $N = 9$, $k = 3$):</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th>Kelompok</th><th class="c">Data</th><th class="c">$\bar{x}_j$</th><th class="c">$\sum(x - \bar{x}_j)^2$</th></tr></thead>
<tbody>
<tr><td>A</td><td class="c">5, 6, 7</td><td class="c">6</td><td class="c">2</td></tr>
<tr><td>B</td><td class="c">8, 9, 10</td><td class="c">9</td><td class="c">2</td></tr>
<tr><td>C</td><td class="c">4, 5, 6</td><td class="c">5</td><td class="c">2</td></tr>
</tbody></table></div>
<ol class="mt-steps">
  <li><strong>Rata-rata keseluruhan:</strong> $\bar{x} = \dfrac{18+27+15}{9} = \dfrac{60}{9} = 6{,}667$.</li>
  <li><strong>JKA:</strong> $3\bigl[(6-6{,}667)^2 + (9-6{,}667)^2 + (5-6{,}667)^2\bigr] = 3(0{,}444 + 5{,}444 + 2{,}778) = 26$.</li>
  <li><strong>JKD:</strong> $2 + 2 + 2 = 6$. Maka $JKT = 26 + 6 = 32$.</li>
  <li><strong>KT:</strong> $KTA = \dfrac{26}{2} = 13$ dan $KTD = \dfrac{6}{6} = 1$.</li>
  <li><strong>F:</strong> $F = \dfrac{13}{1} = 13$ dengan db $(2, 6)$, sehingga $p \approx 0{,}0066$.</li>
  <li><strong>Keputusan:</strong> $p \lt 0{,}05$, jadi $H_0$ ditolak. Ada perbedaan rata-rata yang signifikan antar kelompok. Ukuran efek $\eta^2 = 26/32 = 0{,}81$ (besar).</li>
</ol>`
      },
      {
        id: 'dua-arah', title: 'ANOVA dua arah',
        html: String.raw`
<p>ANOVA dua arah menganalisis dua faktor sekaligus: faktor A dengan $a$ level dan faktor B dengan $b$ level. Aplikasi mengasumsikan <strong>replikasi sama</strong> di tiap sel (kombinasi level), yaitu $r$ pengamatan per sel, sehingga $N = a\,b\,r$.</p>
<div class="mt-box def" data-label="Model">
  $$x_{ijk} = \mu + \alpha_i + \beta_j + (\alpha\beta)_{ij} + \varepsilon_{ijk}$$
  <p>$\alpha_i$ efek utama A, $\beta_j$ efek utama B, $(\alpha\beta)_{ij}$ efek interaksi A$\times$B, dan $\varepsilon_{ijk}$ galat.</p>
</div>
<h3>Rata-rata</h3>
$$\bar{x}_{ij} = \frac{\sum_k x_{ijk}}{r},\quad \bar{x}_{i\cdot} = \frac{\sum_j \bar{x}_{ij}}{b},\quad \bar{x}_{\cdot j} = \frac{\sum_i \bar{x}_{ij}}{a},\quad \bar{x} = \frac{\sum x_{ijk}}{N}$$
<h3>Jumlah kuadrat</h3>
$$JKA = b\,r\sum_{i}(\bar{x}_{i\cdot} - \bar{x})^2,\qquad JKB = a\,r\sum_{j}(\bar{x}_{\cdot j} - \bar{x})^2$$
$$JKAB = r\sum_{i}\sum_{j}(\bar{x}_{ij} - \bar{x})^2 - JKA - JKB$$
$$JKG = \sum_{i}\sum_{j}\sum_{k}(x_{ijk} - \bar{x}_{ij})^2,\qquad JKT = \sum (x_{ijk} - \bar{x})^2$$
<h3>Tabel ANOVA dua arah</h3>
<div class="mt-tw"><table>
<thead><tr><th>Sumber</th><th>JK</th><th>db</th><th>KT</th><th>F</th></tr></thead>
<tbody>
<tr><td>Faktor A</td><td>$JKA$</td><td>$a-1$</td><td>$KTA$</td><td>$KTA/KTG$</td></tr>
<tr><td>Faktor B</td><td>$JKB$</td><td>$b-1$</td><td>$KTB$</td><td>$KTB/KTG$</td></tr>
<tr><td>Interaksi A$\times$B</td><td>$JKAB$</td><td>$(a-1)(b-1)$</td><td>$KTAB$</td><td>$KTAB/KTG$</td></tr>
<tr><td>Galat</td><td>$JKG$</td><td>$a\,b\,(r-1)$</td><td>$KTG$</td><td></td></tr>
<tr><td>Total</td><td>$JKT$</td><td>$a\,b\,r-1$</td><td></td><td></td></tr>
</tbody></table></div>
<p>Dengan $KT = JK/db$ dan masing-masing $F$ dibandingkan dengan $F_{(db\ \text{sumber},\ db\ \text{galat})}$. Tiga uji dilakukan terpisah:</p>
<ul>
  <li>$H_0$ untuk A: semua $\alpha_i = 0$ (A tidak berpengaruh).</li>
  <li>$H_0$ untuk B: semua $\beta_j = 0$ (B tidak berpengaruh).</li>
  <li>$H_0$ untuk A$\times$B: semua $(\alpha\beta)_{ij} = 0$ (tidak ada interaksi).</li>
</ul>
<div class="mt-box note" data-label="Mengapa harus ada replikasi?">
  <p>Galat $JKG$ hanya bisa dihitung bila tiap sel punya lebih dari satu pengamatan ($r \ge 2$). Tanpa replikasi, interaksi dan galat tidak dapat dipisahkan.</p>
</div>`
      },
      {
        id: 'interaksi', title: 'Membaca interaksi',
        html: String.raw`
<p><strong>Interaksi</strong> berarti pengaruh satu faktor bergantung pada level faktor lain. Misalnya pupuk X unggul pada varietas 1 tetapi pupuk Y unggul pada varietas 2.</p>
<div class="mt-box key" data-label="Urutan membaca hasil">
  <ol>
    <li>Periksa <strong>interaksi A×B</strong> lebih dulu.</li>
    <li>Jika interaksi <strong>tidak signifikan</strong>: tafsirkan efek utama A dan B masing-masing.</li>
    <li>Jika interaksi <strong>signifikan</strong>: efek utama tidak bisa ditafsirkan terpisah. Bandingkan rata-rata sel (kombinasi A×B).</li>
  </ol>
</div>
<p>Grafik <strong>plot interaksi</strong> di aplikasi membantu membacanya:</p>
<div class="mt-tw"><table>
<thead><tr><th>Bentuk garis</th><th>Arti</th></tr></thead>
<tbody>
<tr><td>Garis kurang lebih sejajar</td><td>Tidak ada interaksi</td></tr>
<tr><td>Garis tidak sejajar atau melebar</td><td>Ada interaksi (pengaruh A bergantung B)</td></tr>
<tr><td>Garis berpotongan</td><td>Interaksi kuat (urutan terbaik berubah)</td></tr>
</tbody></table></div>`
      },
      {
        id: 'lanjutan', title: 'Setelah ANOVA: uji lanjut',
        html: String.raw`
<p>Jika $H_0$ ditolak, kita tahu ada perbedaan, tetapi belum tahu <strong>kelompok mana</strong> yang berbeda. Langkah berikutnya adalah <strong>uji lanjut (post hoc)</strong>, yang membandingkan pasangan kelompok dengan menjaga galat tipe I keseluruhan tetap $\alpha$. Fitur ini belum ada di aplikasi, tetapi berikut dasarnya.</p>
<h3>Uji Tukey HSD</h3>
<p>Dua rata-rata dianggap berbeda bila selisih absolutnya melebihi:</p>
$$HSD = q_{\alpha;\,k,\,N-k}\sqrt{\frac{KTD}{n}}$$
<p>dengan $q$ nilai dari tabel <em>studentized range</em> dan $n$ ukuran tiap kelompok (bila sama).</p>
<h3>Cara cepat dengan data yang ada</h3>
<ul>
  <li>Lihat grafik <strong>rata-rata dengan CI 95%</strong>: selang yang tidak tumpang tindih mengisyaratkan perbedaan.</li>
  <li>Lihat boxplot per kelompok untuk membandingkan median dan sebaran.</li>
</ul>
<div class="mt-box warn" data-label="Jangan lakukan">
  <p>Jangan langsung melakukan banyak uji t tanpa koreksi setelah ANOVA, karena galat tipe I akan membengkak (lihat materi Dasar Uji Hipotesis). Bila asumsi homogenitas ragam sangat dilanggar, pertimbangkan uji alternatif seperti Welch ANOVA atau Kruskal-Wallis.</p>
</div>`
      }
    ]
  });
})();
