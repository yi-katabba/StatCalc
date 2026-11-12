/* Materi: Uji z (simpangan baku populasi diketahui). Rumus ditulis dengan LaTeX. */
(function () {
  if (!window.StatCalcMateri) return;
  window.StatCalcMateri.register({
    id: 'uji-z', order: 10, method: 'uji-z', tone: 'navy',
    title: 'Uji z', subtitle: '\u03C3 Diketahui',
    desc: 'Menguji rata-rata satu atau dua sampel dengan distribusi normal baku bila simpangan baku populasi (\u03C3) diketahui: statistik z, nilai kritis, p-value, dan selang kepercayaan.',
    keywords: ['uji z', 'z-test', 'normal baku', 'sigma', 'simpangan baku populasi', 'rata-rata', 'satu sampel', 'dua sampel', 'nilai kritis', 'selang kepercayaan', 'galat baku'],
    icon: '<path d="M3 19c3 0 3-14 9-14s6 14 9 14"/><path d="M12 5v14"/>',
    sections: [
      {
        id: 'konsep', title: 'Kapan memakai uji z',
        html: String.raw`
<p>Uji z menguji rata-rata dengan statistik yang berdistribusi <strong>normal baku</strong> $N(0,1)$. Syaratnya, simpangan baku populasi $\sigma$ <strong>diketahui</strong> (misalnya dari spesifikasi alat ukur, data historis yang sangat banyak, atau standar yang sudah mapan), dan data berdistribusi normal atau sampelnya cukup besar.</p>
<div class="mt-box warn" data-label="Awas">
  <p>Dalam praktik $\sigma$ jarang benar-benar diketahui. Jika $\sigma$ hanya ditaksir dari sampel ($s$), gunakan <strong>Uji t</strong>. Memakai $s$ seolah-olah $\sigma$ pada sampel kecil membuat p-value terlalu kecil.</p>
</div>
<div class="mt-tw"><table>
<thead><tr><th></th><th>Uji z</th><th>Uji t</th></tr></thead>
<tbody>
<tr><td>Simpangan baku populasi</td><td>Diketahui ($\sigma$)</td><td>Tidak diketahui (ditaksir $s$)</td></tr>
<tr><td>Distribusi acuan</td><td>Normal baku</td><td>$t$ dengan $db = n-1$</td></tr>
<tr><td>Ekor distribusi</td><td>Lebih ringan</td><td>Lebih tebal pada $n$ kecil</td></tr>
</tbody></table></div>`
      },
      {
        id: 'satu-sampel', title: 'Uji z satu sampel',
        html: String.raw`
<p>Menguji $H_0: \mu = \mu_0$:</p>
$$z = \frac{\bar{x} - \mu_0}{\sigma/\sqrt{n}}$$
<p>Galat baku rata-rata adalah $\sigma/\sqrt{n}$. Selang kepercayaan $(1-\alpha)$ untuk $\mu$:</p>
$$\bar{x} \pm z_{\alpha/2}\cdot\frac{\sigma}{\sqrt{n}}$$`
      },
      {
        id: 'dua-sampel', title: 'Uji z dua sampel',
        html: String.raw`
<p>Untuk dua sampel independen dengan $\sigma_1$ dan $\sigma_2$ diketahui, menguji $H_0: \mu_1 - \mu_2 = \Delta_0$:</p>
$$z = \frac{(\bar{x}_1 - \bar{x}_2) - \Delta_0}{\sqrt{\dfrac{\sigma_1^2}{n_1} + \dfrac{\sigma_2^2}{n_2}}}$$
<p>Selang kepercayaan selisih: $(\bar{x}_1 - \bar{x}_2) \pm z_{\alpha/2}\sqrt{\sigma_1^2/n_1 + \sigma_2^2/n_2}$.</p>`
      },
      {
        id: 'keputusan', title: 'Nilai kritis dan p-value',
        html: String.raw`
<div class="mt-tw"><table>
<thead><tr><th>Taraf $\alpha$</th><th>Satu sisi $z_{\alpha}$</th><th>Dua sisi $z_{\alpha/2}$</th></tr></thead>
<tbody>
<tr><td>0,10</td><td>1,282</td><td>1,645</td></tr>
<tr><td>0,05</td><td>1,645</td><td>1,960</td></tr>
<tr><td>0,01</td><td>2,326</td><td>2,576</td></tr>
</tbody></table></div>
<ul>
  <li><strong>Dua sisi</strong>: $p = 2\,[1 - \Phi(|z|)]$; tolak $H_0$ bila $|z| \gt z_{\alpha/2}$.</li>
  <li><strong>Satu sisi kanan</strong> ($H_1: \mu \gt \mu_0$): $p = 1 - \Phi(z)$.</li>
  <li><strong>Satu sisi kiri</strong> ($H_1: \mu \lt \mu_0$): $p = \Phi(z)$.</li>
</ul>
<p>$\Phi$ adalah fungsi sebaran kumulatif normal baku. Aturan keputusannya sama dengan uji lain: tolak $H_0$ bila $p \lt \alpha$.</p>`
      },
      {
        id: 'contoh', title: 'Contoh hitung dan cara membaca hasil',
        html: String.raw`
<div class="mt-box ex" data-label="Contoh">
  <p>Mesin mengisi botol dengan simpangan baku yang diketahui $\sigma = 4$ ml. Sampel $n = 36$ botol, $\bar{x} = 52$ ml. Apakah rata-rata isi berbeda dari $\mu_0 = 50$ ml ($\alpha = 0{,}05$, dua sisi)?</p>
  <ol class="mt-steps">
    <li>$SE = 4/\sqrt{36} = 0{,}667$.</li>
    <li>$z = (52 - 50)/0{,}667 = 3{,}00$.</li>
    <li>$p = 2\,[1 - \Phi(3{,}00)] \approx 0{,}0027$. Karena $|z| \gt 1{,}96$ dan $p \lt 0{,}05$, <strong>tolak $H_0$</strong>.</li>
    <li>Selang kepercayaan 95%: $52 \pm 1{,}96 \times 0{,}667 = [50{,}69;\ 53{,}31]$. Nilai 50 berada di luar selang, sejalan dengan penolakan $H_0$.</li>
  </ol>
</div>
<div class="mt-box key" data-label="Membaca hasil di aplikasi">
  <p>Isikan $\sigma$ (atau $\sigma_1$ dan $\sigma_2$) yang <em>diketahui</em>, bukan simpangan baku sampel. Baca $z$, $p$-value, dan selang kepercayaan, lalu bandingkan $p$ dengan $\alpha$.</p>
</div>`
      }
    ]
  });
})();
