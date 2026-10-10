# Materi Statistik

Menu utama **Materi** (penjelasan konsep + rumus LaTeX untuk metode di menu Stat).

## Struktur
- `materi.js` - mesin halaman (daftar, pencarian, halaman baca, tautan "Lihat materi untuk pemahaman").
- `data/*.js` - isi materi, satu file per topik.
- `katex/` - KaTeX 0.16.11 lokal (tanpa internet), lisensi MIT.

## Menambah / mengubah materi
Edit file di `data/`, atau buat file baru lalu muat di `index.html` **setelah** `materi.js`:

```js
window.StatCalcMateri.register({
  id: 'uji-t', order: 7, method: null,          // method = id halaman kalkulator (mis. 'regresi') atau null
  title: 'Uji t', subtitle: 'Satu & Dua Sampel',
  desc: 'Ringkasan satu kalimat untuk kartu daftar.',
  keywords: ['t-test', 'rata-rata'],             // ikut dicari di kolom pencarian
  tone: 'gold',                                  // navy | gold | green | plum | teal | rust
  icon: '<path d="M12 4v16M6 4h12"/>',          // isi <svg viewBox="0 0 24 24"> bergaya garis
  sections: [
    { id: 'konsep', title: 'Konsep', html: String.raw`<p>Teks dengan rumus $t = \dfrac{\bar{x}-\mu_0}{s/\sqrt{n}}$</p>` },
  ],
});
```

## Menulis rumus
- Inline: `$ ... $` atau `\( ... \)`. Blok tengah: `$$ ... $$` atau `\[ ... \]`.
- Pakai `String.raw` + backtick supaya `\frac`, `\sum` tidak perlu digandakan backslash-nya.
- Di dalam isi HTML, tulis `<` dan `>` pada rumus sebagai `\lt` / `\gt` (atau `&lt;` / `&gt;`) agar tidak dibaca sebagai tag.
- Jangan menulis `${` di dalam template (dibaca sebagai interpolasi JS); beri spasi atau pakai `\{`.
- Kotak penjelasan: `<div class="mt-box def|note|warn|ex|key" data-label="Judul">...</div>`.
- Langkah bernomor: `<ol class="mt-steps">`. Tabel otomatis bisa digeser samping: `<div class="mt-tw"><table>...</table></div>`.
- Ketuk rumus di halaman Materi untuk menyalin kode LaTeX-nya.

## Tautan dari halaman metode
`materi.js` menempelkan banner **Lihat materi untuk pemahaman** di bawah judul halaman metode
(`METHOD_LINKS`) dan tombol kecil di bawah judul hasil uji tertentu (`H4_LINKS`, dicocokkan lewat teks `<h4>`).
Untuk metode baru, tambahkan barisnya di kedua tabel itu dan sesuaikan `id` bagian di `data/`.

Dari kode lain: `StatCalcMateri.open('stasioner', 'adf', { from: 'stasioner' })`.
