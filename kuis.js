/* =========================================================================
   KUIS.JS — Bank soal untuk menu "Kuis Statistika" pada StatCalc
   -------------------------------------------------------------------------
   Setiap soal berupa objek dengan struktur: 
   {
     question:    teks soal (string, boleh mengandung angka/notasi sederhana)
     options:     array 4 pilihan jawaban (string)
     answer:      index (0-3) dari options yang merupakan jawaban benar
     pembahasan:  penjelasan singkat kenapa jawaban tersebut benar
   }

   Untuk menambah soal baru: cukup tambahkan objek baru ke array
   KUIS_STATISTIK di bawah ini, mengikuti struktur yang sama.
   ========================================================================= */
window.KUIS_STATISTIK = [
  {
    question: 'Data: 4, 8, 6, 5, 3, 7, 9. Berapakah mean (rata-rata) dari data tersebut?',
    options: ['5', '6', '7', '8'],
    answer: 1,
    pembahasan: 'Jumlah data = 4+8+6+5+3+7+9 = 42, dibagi banyak data (n=7), sehingga mean = 42/7 = 6.'
  },
  {
    question: 'Data terurut: 2, 4, 4, 6, 8, 9, 12. Berapakah median dari data tersebut?',
    options: ['4', '6', '8', '9'],
    answer: 1,
    pembahasan: 'Karena n=7 (ganjil), median adalah nilai tengah setelah data diurutkan, yaitu data ke-4 = 6.'
  },
  {
    question: 'Data: 3, 5, 5, 5, 7, 8, 8. Berapakah modus dari data tersebut?',
    options: ['5', '7', '8', '3'],
    answer: 0,
    pembahasan: 'Modus adalah nilai yang paling sering muncul. Nilai 5 muncul 3 kali, paling banyak dibanding nilai lain.'
  },
  {
    question: 'Ukuran yang menunjukkan seberapa jauh data tersebar dari nilai rata-ratanya disebut...',
    options: ['Modus', 'Median', 'Simpangan baku', 'Kuartil'],
    answer: 2,
    pembahasan: 'Simpangan baku (standar deviasi) mengukur seberapa jauh sebaran data terhadap rata-ratanya.'
  },
  {
    question: 'Jika varians suatu data adalah 25, maka simpangan bakunya adalah...',
    options: ['5', '25', '625', '12,5'],
    answer: 0,
    pembahasan: 'Simpangan baku adalah akar kuadrat dari varians: \u221A25 = 5.'
  },
  {
    question: 'Koefisien korelasi Pearson (r) memiliki rentang nilai...',
    options: ['0 sampai 1', '-1 sampai 1', '-100 sampai 100', '0 sampai 100'],
    answer: 1,
    pembahasan: 'Koefisien korelasi Pearson berkisar dari -1 (korelasi negatif sempurna) hingga +1 (korelasi positif sempurna).'
  },
  {
    question: 'Jika nilai korelasi antara dua variabel adalah r = -0,85, maka hubungan kedua variabel tersebut...',
    options: ['Positif sangat lemah', 'Negatif sangat kuat', 'Tidak ada hubungan', 'Positif sangat kuat'],
    answer: 1,
    pembahasan: 'Nilai r mendekati -1 menunjukkan hubungan negatif (berlawanan arah) yang sangat kuat antar variabel.'
  },
  {
    question: 'Dalam persamaan regresi linear \u0176 = a + bX, apa yang ditunjukkan oleh koefisien b?',
    options: ['Nilai Y ketika X = 0', 'Rata-rata data Y', 'Besarnya perubahan Y untuk setiap kenaikan 1 satuan X', 'Jumlah data yang digunakan'],
    answer: 2,
    pembahasan: 'Koefisien b (koefisien arah/slope) menunjukkan besar perubahan Y untuk setiap kenaikan 1 satuan X.'
  },
  {
    question: 'Koefisien determinasi R\u00B2 = 0,81 berarti...',
    options: [
      '81% variasi Y dijelaskan oleh variabel X dalam model',
      '81% data bernilai sama',
      'Korelasi antar variabel sebesar 0,81%',
      'Model regresi salah'
    ],
    answer: 0,
    pembahasan: 'R\u00B2 menunjukkan proporsi variasi variabel terikat (Y) yang mampu dijelaskan oleh variabel bebas (X) dalam model, dalam hal ini sebesar 81%.'
  },
  {
    question: 'Distribusi data yang berbentuk simetris seperti lonceng disebut distribusi...',
    options: ['Binomial', 'Normal', 'Poisson', 'Seragam'],
    answer: 1,
    pembahasan: 'Distribusi normal (distribusi Gauss) memiliki bentuk kurva simetris menyerupai lonceng.'
  },
  {
    question: 'Pada pengujian hipotesis, apa yang dimaksud dengan hipotesis nol (H\u2080)?',
    options: [
      'Hipotesis yang selalu benar',
      'Pernyataan yang menyatakan tidak ada perbedaan/pengaruh yang diuji',
      'Hipotesis alternatif yang diajukan peneliti',
      'Kesimpulan akhir penelitian'
    ],
    answer: 1,
    pembahasan: 'H\u2080 (hipotesis nol) adalah pernyataan awal yang menyatakan tidak ada perbedaan atau pengaruh, dan akan diuji apakah ditolak atau tidak berdasarkan data.'
  },
  {
    question: 'Jika nilai signifikansi (p-value) hasil uji lebih kecil dari taraf signifikansi \u03B1 = 0,05, maka keputusannya adalah...',
    options: ['Menerima H\u2080', 'Menolak H\u2080', 'Mengulang penelitian', 'Data tidak valid'],
    answer: 1,
    pembahasan: 'Jika p-value < \u03B1, maka H\u2080 ditolak karena hasil dianggap signifikan secara statistik.'
  },
  {
    question: 'Uji statistik yang digunakan untuk membandingkan rata-rata lebih dari dua kelompok data sekaligus adalah...',
    options: ['Uji t', 'Uji Chi-Square', 'ANOVA', 'Uji korelasi'],
    answer: 2,
    pembahasan: 'ANOVA (Analysis of Variance) digunakan untuk menguji perbedaan rata-rata dari tiga kelompok data atau lebih secara bersamaan.'
  },
  {
    question: 'Uji Chi-Square umumnya digunakan untuk data berskala...',
    options: ['Nominal atau ordinal (kategorik)', 'Interval saja', 'Rasio saja', 'Hanya data kontinu'],
    answer: 0,
    pembahasan: 'Uji Chi-Square dipakai untuk menguji data kategorik (nominal/ordinal), misalnya uji independensi antar dua variabel kategori.'
  },
  {
    question: 'Nilai tengah dari sekumpulan data yang telah diurutkan disebut...',
    options: ['Mean', 'Median', 'Modus', 'Range'],
    answer: 1,
    pembahasan: 'Median adalah nilai tengah data setelah diurutkan dari yang terkecil ke terbesar.'
  },
  {
    question: 'Selisih antara nilai maksimum dan minimum dalam suatu data disebut...',
    options: ['Rentang (range)', 'Varians', 'Standar deviasi', 'Kuartil'],
    answer: 0,
    pembahasan: 'Rentang (range) adalah selisih antara nilai data terbesar dan nilai data terkecil.'
  },
  {
    question: 'Dalam regresi linear berganda, istilah "ceteris paribus" pada interpretasi koefisien berarti...',
    options: [
      'Semua data harus sama',
      'Variabel bebas lainnya dianggap konstan/tetap',
      'Model tidak memiliki konstanta',
      'Data harus berdistribusi normal'
    ],
    answer: 1,
    pembahasan: 'Ceteris paribus berarti "hal-hal lain dianggap tetap" \u2014 variabel bebas lain diasumsikan konstan saat menginterpretasikan pengaruh satu variabel X.'
  },
  {
    question: 'Manakah pasangan variabel yang paling mungkin memiliki korelasi positif kuat?',
    options: [
      'Tinggi badan dan berat badan',
      'Warna baju dan nomor sepatu',
      'Suhu ruangan dan nama hari',
      'Jumlah huruf nama dan golongan darah'
    ],
    answer: 0,
    pembahasan: 'Tinggi badan dan berat badan cenderung meningkat bersama-sama, sehingga secara umum memiliki korelasi positif yang cukup kuat.'
  },
  {
    question: 'Statistik deskriptif digunakan untuk...',
    options: [
      'Menarik kesimpulan tentang populasi dari sampel',
      'Menguji hipotesis penelitian',
      'Meringkas dan menggambarkan karakteristik data yang ada',
      'Meramalkan nilai di masa depan'
    ],
    answer: 2,
    pembahasan: 'Statistik deskriptif berfungsi meringkas, menyajikan, dan menggambarkan karakteristik suatu kumpulan data (mis. mean, median, modus).'
  },
  {
    question: 'Semakin kecil nilai galat baku (standard error) suatu estimasi regresi, maka...',
    options: [
      'Model semakin buruk',
      'Prediksi model semakin tidak akurat',
      'Prediksi model semakin akurat/presisi',
      'Data semakin sedikit'
    ],
    answer: 2,
    pembahasan: 'Galat baku (Se) yang kecil menunjukkan nilai prediksi model semakin dekat dengan data observasi, sehingga model lebih akurat.'
  },
    {
    question: 'Data: 10, 12, 14, 16, 18. Berapakah mean dari data tersebut?',
    options: ['12', '14', '15', '16'],
    answer: 1,
    pembahasan: 'Mean = (10+12+14+16+18)/5 = 70/5 = 14.'
  },
  {
    question: 'Data terurut: 1, 3, 5, 7, 9. Berapakah median?',
    options: ['3', '5', '7', '9'],
    answer: 1,
    pembahasan: 'Median adalah nilai tengah, yaitu data ke-3 = 5.'
  },
  {
    question: 'Jika data memiliki nilai yang sama semua, maka simpangan bakunya adalah...',
    options: ['0', '1', 'Tidak terdefinisi', 'Tak hingga'],
    answer: 0,
    pembahasan: 'Jika semua data sama, tidak ada penyimpangan dari mean, sehingga simpangan baku = 0.'
  },
  {
    question: 'Kuartil kedua (Q2) dalam data sama dengan...',
    options: ['Mean', 'Median', 'Modus', 'Range'],
    answer: 1,
    pembahasan: 'Kuartil kedua (Q2) adalah median dari data.'
  },
  {
    question: 'Jika nilai maksimum 20 dan minimum 5, maka range adalah...',
    options: ['10', '15', '20', '25'],
    answer: 1,
    pembahasan: 'Range = maksimum - minimum = 20 - 5 = 15.'
  },
  {
    question: 'Distribusi Poisson biasanya digunakan untuk...',
    options: [
      'Data kontinu',
      'Jumlah kejadian dalam interval tertentu',
      'Data kategorik',
      'Data berpasangan'
    ],
    answer: 1,
    pembahasan: 'Distribusi Poisson digunakan untuk menghitung jumlah kejadian dalam interval waktu/ruang tertentu.'
  },
  {
    question: 'Jika r = 0, maka hubungan antara dua variabel adalah...',
    options: [
      'Positif sempurna',
      'Negatif sempurna',
      'Tidak ada hubungan linear',
      'Hubungan kuat'
    ],
    answer: 2,
    pembahasan: 'r = 0 menunjukkan tidak ada hubungan linear antara variabel.'
  },
  {
    question: 'Dalam regresi, konstanta (a) menunjukkan...',
    options: [
      'Perubahan Y',
      'Nilai Y saat X = 0',
      'Jumlah data',
      'Koefisien korelasi'
    ],
    answer: 1,
    pembahasan: 'Konstanta a adalah nilai Y ketika X = 0.'
  },
  {
    question: 'Jika R² kecil, maka model regresi...',
    options: [
      'Sangat baik',
      'Tidak menjelaskan variasi data dengan baik',
      'Selalu benar',
      'Tidak memiliki variabel'
    ],
    answer: 1,
    pembahasan: 'R² kecil berarti model tidak mampu menjelaskan variasi Y dengan baik.'
  },
  {
    question: 'Hipotesis alternatif (H1) menyatakan...',
    options: [
      'Tidak ada pengaruh',
      'Ada pengaruh/perbedaan',
      'Data salah',
      'Model sempurna'
    ],
    answer: 1,
    pembahasan: 'H1 menyatakan adanya pengaruh atau perbedaan yang ingin dibuktikan.'
  },
  {
    question: 'Jika p-value > 0,05 maka keputusan yang diambil adalah...',
    options: [
      'Menolak H0',
      'Menerima H0',
      'Menolak data',
      'Mengubah model'
    ],
    answer: 1,
    pembahasan: 'Jika p-value lebih besar dari α, maka H0 tidak ditolak.'
  },
  {
    question: 'Data kategorik biasanya disajikan dalam bentuk...',
    options: [
      'Histogram',
      'Diagram batang',
      'Scatter plot',
      'Boxplot'
    ],
    answer: 1,
    pembahasan: 'Data kategorik lebih tepat disajikan dengan diagram batang.'
  },
  {
    question: 'Jika dua variabel bergerak berlawanan arah, maka korelasinya...',
    options: [
      'Positif',
      'Negatif',
      'Nol',
      'Tidak ada'
    ],
    answer: 1,
    pembahasan: 'Hubungan berlawanan arah menunjukkan korelasi negatif.'
  },
  {
    question: 'Rata-rata tertimbang digunakan jika...',
    options: [
      'Semua data sama penting',
      'Data memiliki bobot berbeda',
      'Data kecil',
      'Data acak'
    ],
    answer: 1,
    pembahasan: 'Mean tertimbang digunakan jika setiap data memiliki bobot berbeda.'
  },
  {
    question: 'Histogram digunakan untuk menampilkan...',
    options: [
      'Data kategorik',
      'Distribusi frekuensi data kontinu',
      'Hubungan dua variabel',
      'Nilai maksimum'
    ],
    answer: 1,
    pembahasan: 'Histogram digunakan untuk menunjukkan distribusi frekuensi data kontinu.'
  },
    {
    question: 'Dalam ANOVA satu arah, hipotesis nol (H0) menyatakan bahwa...',
    options: [
      'Semua rata-rata kelompok berbeda',
      'Minimal satu rata-rata berbeda',
      'Semua rata-rata kelompok sama',
      'Varians semua kelompok berbeda'
    ],
    answer: 2,
    pembahasan: 'H0 pada ANOVA menyatakan bahwa semua rata-rata populasi dari kelompok yang diuji adalah sama.'
  },
  {
    question: 'Jika nilai F hitung > F tabel dalam ANOVA, maka keputusan yang diambil adalah...',
    options: [
      'Menerima H0',
      'Menolak H0',
      'Mengulang data',
      'Data tidak valid'
    ],
    answer: 1,
    pembahasan: 'Jika F hitung lebih besar dari F tabel, maka H0 ditolak, artinya ada perbedaan rata-rata antar kelompok.'
  },
  {
    question: 'Dalam regresi linear sederhana, jika koefisien b bernilai negatif, maka artinya...',
    options: [
      'X dan Y tidak berhubungan',
      'Y meningkat saat X meningkat',
      'Y menurun saat X meningkat',
      'Tidak dapat disimpulkan'
    ],
    answer: 2,
    pembahasan: 'Koefisien b negatif menunjukkan hubungan berlawanan arah: saat X naik, Y turun.'
  },
  {
    question: 'Jika koefisien korelasi r = 0,9, maka nilai R² adalah...',
    options: ['0,81', '0,9', '0,18', '0,45'],
    answer: 0,
    pembahasan: 'R² = r² = (0,9)² = 0,81, artinya 81% variasi Y dijelaskan oleh X.'
  },
  {
    question: 'Distribusi binomial digunakan ketika...',
    options: [
      'Data kontinu',
      'Jumlah kejadian sukses dalam n percobaan dengan probabilitas tetap',
      'Waktu antar kejadian',
      'Data kategorik bebas'
    ],
    answer: 1,
    pembahasan: 'Distribusi binomial digunakan untuk menghitung peluang jumlah sukses dalam percobaan berulang dengan probabilitas tetap.'
  },
  {
    question: 'Jika peluang sukses p = 0,3 dalam distribusi binomial, maka peluang gagal adalah...',
    options: ['0,3', '0,5', '0,7', '1,3'],
    answer: 2,
    pembahasan: 'Peluang gagal = 1 - p = 1 - 0,3 = 0,7.'
  },
  {
    question: 'Dalam distribusi normal, sekitar 68% data berada pada interval...',
    options: [
      'μ ± 1σ',
      'μ ± 2σ',
      'μ ± 3σ',
      'μ ± 4σ'
    ],
    answer: 0,
    pembahasan: 'Aturan empiris menyatakan 68% data berada dalam μ ± 1σ.'
  },
  {
    question: 'Jika Z-score suatu data adalah 2, maka artinya...',
    options: [
      'Data di bawah mean',
      'Data sama dengan mean',
      'Data 2 standar deviasi di atas mean',
      'Data tidak valid'
    ],
    answer: 2,
    pembahasan: 'Z = 2 berarti data berada 2 simpangan baku di atas rata-rata.'
  },
  {
    question: 'Dalam regresi linear berganda, multikolinearitas terjadi ketika...',
    options: [
      'Variabel bebas tidak berkorelasi',
      'Variabel bebas saling berkorelasi tinggi',
      'Variabel dependen tidak ada',
      'Data tidak normal'
    ],
    answer: 1,
    pembahasan: 'Multikolinearitas terjadi jika variabel bebas saling berkorelasi tinggi, sehingga mengganggu estimasi model.'
  },
  {
    question: 'Uji Durbin-Watson digunakan untuk mendeteksi...',
    options: [
      'Normalitas',
      'Multikolinearitas',
      'Autokorelasi residual',
      'Heteroskedastisitas'
    ],
    answer: 2,
    pembahasan: 'Uji Durbin-Watson digunakan untuk mendeteksi adanya autokorelasi dalam residual regresi.'
  },
  {
    question: 'Jika varians residual tidak konstan, maka terjadi...',
    options: [
      'Normalitas',
      'Homoskedastisitas',
      'Heteroskedastisitas',
      'Autokorelasi'
    ],
    answer: 2,
    pembahasan: 'Heteroskedastisitas terjadi ketika varians residual tidak konstan.'
  },
  {
    question: 'Distribusi sampling dari mean akan mendekati normal jika ukuran sampel besar, menurut...',
    options: [
      'Teorema Bayes',
      'Teorema Limit Pusat',
      'Hukum Newton',
      'Teori Relativitas'
    ],
    answer: 1,
    pembahasan: 'Teorema Limit Pusat menyatakan distribusi sampling mean mendekati normal untuk sampel besar.'
  },
  {
    question: 'Dalam uji t, derajat kebebasan (df) untuk satu sampel adalah...',
    options: ['n', 'n-1', 'n+1', '2n'],
    answer: 1,
    pembahasan: 'Derajat kebebasan uji t satu sampel adalah n-1.'
  },
  {
    question: 'Jika nilai probabilitas suatu kejadian = 0, maka kejadian tersebut...',
    options: [
      'Pasti terjadi',
      'Tidak mungkin terjadi',
      'Mungkin terjadi',
      'Sering terjadi'
    ],
    answer: 1,
    pembahasan: 'Probabilitas 0 berarti kejadian mustahil terjadi.'
  },
  {
    question: 'Jika dua kejadian saling bebas (independen), maka berlaku...',
    options: [
      'P(A∩B) = P(A) + P(B)',
      'P(A∩B) = P(A) × P(B)',
      'P(A|B) = 0',
      'P(A) = P(B)'
    ],
    answer: 1,
    pembahasan: 'Untuk kejadian independen, peluang irisan adalah hasil kali peluang masing-masing.'
  }
];
