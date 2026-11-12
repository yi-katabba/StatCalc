/* Materi: Uji Proporsi (satu dan dua proporsi). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'proporsi', order: 11, method: 'proporsi', tone: 'green',
    title: 'Uji Proporsi', subtitle: 'Satu & Dua Proporsi',
    desc: 'Menguji proporsi sukses: uji z dan uji binomial eksak untuk satu proporsi, uji z untuk dua proporsi, selang kepercayaan Wilson, syarat sampel, dan Cohen\u2019s h.',
    keywords: ['proporsi', 'persentase', 'binomial', 'eksak', 'uji z proporsi', 'satu proporsi', 'dua proporsi', 'sukses', 'gagal', 'Wilson', 'Cohen h', 'proporsi gabungan', 'p topi'],
    icon: '<circle cx="12" cy="12" r="8"/><path d="M12 12V4M12 12l6 4"/>',
    sections: [
      {
        id: 'konsep', title: 'Konsep proporsi',
        html: String.raw`
<p>Proporsi digunakan untuk data biner (sukses/gagal, ya/tidak, lulus/tidak). Bila dari $n$ pengamatan ada $x$ sukses, proporsi sampel adalah:</p>
$$\hat{p} = \frac{x}{n}$$
<p>Dalam aplikasi, data cukup berupa <strong>ringkasan</strong> ($x$ dan $n$), bukan tabel data mentah. Contoh pertanyaan:</p>
<ul>
  <li><strong>Satu proporsi</strong>: apakah proporsi pemilih yang setuju berbeda dari 50%?</li>
  <li><strong>Dua proporsi</strong>: apakah proporsi lulus metode A berbeda dari metode B?</li>
</ul>
<div class="mt-box note" data-label="Galat baku">
  <p>Untuk $\hat{p}$, galat bakunya $\sqrt{p(1-p)/n}$. Semakin dekat $p$ ke 0,5 dan semakin kecil $n$, semakin tidak pasti $\hat{p}$.</p>
</div>`
      },
      {
        id: 'satu', title: 'Uji satu proporsi (z dan binomial eksak)',
        html: String.raw`
<p>Menguji $H_0: p = p_0$. Dua cara:</p>
<h3>Uji z (pendekatan normal)</h3>
$$z = \frac{\hat{p} - p_0}{\sqrt{p_0(1-p_0)/n}}$$
<p>Galat baku memakai $p_0$ (bukan $\hat{p}$) karena perhitungan dilakukan di bawah $H_0$.</p>
<div class="mt-box warn" data-label="Syarat pendekatan normal">
  <p>Pendekatan ini baik bila $np_0$ dan $n(1-p_0)$ sama-sama cukup besar (umumnya $\ge 10$). Bila tidak terpenuhi, gunakan uji eksak.</p>
</div>
<h3>Uji binomial eksak</h3>
<p>Di bawah $H_0$, banyaknya sukses $X \sim \text{Binomial}(n, p_0)$. P-value dihitung langsung dari peluang binomial, tanpa pendekatan, sehingga sahih untuk sampel kecil.</p>
<h3>Selang kepercayaan Wilson</h3>
$$\frac{\hat{p} + \dfrac{z^2}{2n} \pm z\sqrt{\dfrac{\hat{p}(1-\hat{p})}{n} + \dfrac{z^2}{4n^2}}}{1 + \dfrac{z^2}{n}}$$
<p>Selang Wilson lebih akurat daripada selang Wald biasa ($\hat{p} \pm z\sqrt{\hat{p}(1-\hat{p})/n}$), terutama untuk $n$ kecil atau $\hat{p}$ dekat 0 atau 1.</p>`
      },
      {
        id: 'dua', title: 'Uji dua proporsi',
        html: String.raw`
<p>Membandingkan $\hat{p}_1 = x_1/n_1$ dengan $\hat{p}_2 = x_2/n_2$. Untuk $H_0: p_1 = p_2$ dipakai proporsi gabungan:</p>
$$\hat{p} = \frac{x_1 + x_2}{n_1 + n_2}, \qquad z = \frac{\hat{p}_1 - \hat{p}_2}{\sqrt{\hat{p}(1-\hat{p})\left(\dfrac{1}{n_1} + \dfrac{1}{n_2}\right)}}$$
<p>Alasan memakai $\hat{p}$ gabungan: di bawah $H_0$ kedua kelompok memiliki proporsi yang sama, sehingga estimasi terbaik adalah menggabungkan seluruh data.</p>
<div class="mt-box note" data-label="Sampel kecil">
  <p>Bila ada sel dengan jumlah sukses/gagal yang sangat kecil (di bawah sekitar 5), uji z kurang tepat. Pakai Uji Eksak Fisher pada tabel 2 &times; 2, yang setara dengan menguji dua proporsi.</p>
</div>`
      },
      {
        id: 'efek', title: 'Ukuran efek: Cohen\u2019s h',
        html: String.raw`
<p>Selisih proporsi sulit dibandingkan antar situasi (selisih 0,45 vs 0,55 berbeda makna daripada 0,05 vs 0,15). Cohen&rsquo;s $h$ menstabilkan proporsi dengan transformasi arcsin:</p>
$$h = 2\arcsin\sqrt{\hat{p}_1} - 2\arcsin\sqrt{\hat{p}_2}$$
<p>Untuk uji satu proporsi, $\hat{p}_2$ diganti $p_0$. Patokan umum $|h|$: sekitar 0,2 (kecil), 0,5 (sedang), 0,8 (besar).</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Satu proporsi">
  <p>Dari $n = 100$ pelanggan, $x = 60$ puas. Uji $H_0: p = 0{,}5$ (dua sisi).</p>
  <ul>
    <li>$\hat{p} = 0{,}60$; galat baku di bawah $H_0$ = $\sqrt{0{,}5 \times 0{,}5/100} = 0{,}05$.</li>
    <li>$z = (0{,}60 - 0{,}50)/0{,}05 = 2{,}00$, $p \approx 0{,}0455$.</li>
    <li>Uji binomial eksak memberi $p \approx 0{,}0569$.</li>
  </ul>
  <p>Kedua uji berbeda tipis: pada $\alpha = 0{,}05$ uji z menolak $H_0$ sedangkan uji eksak gagal menolak. Hasil yang berada di perbatasan seperti ini sebaiknya dilaporkan apa adanya (dengan selang kepercayaan), bukan dipaksakan menjadi satu kesimpulan tegas.</p>
</div>
<div class="mt-box ex" data-label="Dua proporsi">
  <p>Metode A: 45 lulus dari 100. Metode B: 30 lulus dari 100.</p>
  <ol class="mt-steps">
    <li>$\hat{p}_1 = 0{,}45$, $\hat{p}_2 = 0{,}30$, $\hat{p} = 75/200 = 0{,}375$.</li>
    <li>$SE = \sqrt{0{,}375 \times 0{,}625 \times (1/100 + 1/100)} \approx 0{,}0685$.</li>
    <li>$z = 0{,}15/0{,}0685 \approx 2{,}19$ dan $p \approx 0{,}028$. <strong>Tolak $H_0$</strong>: proporsi kelulusan kedua metode berbeda.</li>
  </ol>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Masukkan jumlah sukses dan ukuran sampel. Periksa syarat sampel besar, bandingkan $p$ dengan $\alpha$, lihat selang kepercayaannya, dan nilai besar efek dari Cohen&rsquo;s $h$.</p>
</div>`
      }
    ]
  });
})();
