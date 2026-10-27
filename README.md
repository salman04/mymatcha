# Sejenak — Matcha Studio

Prototipe game browser 3D berdasarkan komposisi yang disetujui: meja keramik abu terang matte, baki kayu di kiri, mangkuk di tengah, teko dan gelas di kanan. Gambar acuan tersimpan di `reference/approved-scene.png`.

## Menjalankan lokal

Jalankan `python3 -m http.server 4173 --directory dist`, lalu buka `http://localhost:4173`.

Tidak memerlukan proses build. Three.js 0.180.0 disertakan secara lokal di `dist/vendor`; lisensi MIT-nya terdapat di `dist/vendor/THREE-LICENSE.txt`. Font mempunyai fallback lokal bila layanan font tidak tersedia.

## Interaksi

- Klik langsung peralatan di meja; Tab/Enter juga tersedia untuk keyboard.
- Klik kaleng, sendok, atau ayakan untuk mengambil dan mengayak satu sendok bubuk dalam satu aksi. Semua bubuk wajib melalui ayakan.
- Klik singkat teko/karton untuk satu takaran, atau tekan-tahan objek untuk menuang dan mengocok lebih lama.
- Seret di mangkuk ketika pengocok dipilih untuk mengarahkannya sendiri.
- Tuang matcha dari chawan ke gelas, tambahkan es atau cloud, lalu sajikan.
- Kontrol zoom, bantuan, dan suara tersedia pada antarmuka.

## Lingkup versi ini

Adegan WebGL nyata dengan geometri peralatan, material prosedural, bayangan, partikel bubuk, permukaan cairan dan busa, serta alur racikan bebas. Tekstur dan geometri dibuat langsung dalam sumber aplikasi; tidak menggunakan layanan aset berbayar. Gambar konsep bukan latar permainan.

Gerakan tuang dan pencampuran merupakan efek terarah. Cairan belum memakai simulasi fisika, tumpahan belum aktif, dan model serta material masih dapat dipoles lebih lanjut terhadap gambar acuan. Tampilan desktop dan tata letak 390 piksel telah diperiksa melalui browser; performa pada perangkat seluler fisik belum diukur.

## Pemeriksaan

Pemeriksaan sintaks semua modul aplikasi lulus. Alur browser diuji: mulai racikan, tambahkan matcha, ayak, tahan tuang air dan susu, kocok hingga berbusa, zoom, serta sajikan. Hasil uji mencapai dialog racikan dengan volume dan karakter busa. Tidak ada kesalahan JavaScript pada alur tersebut.

## Sumber

- `dist/scene.js`: adegan, geometri, kamera, pencahayaan dan animasi.
- `dist/materials.js`: material, tekstur dan busa prosedural.
- `dist/main.js`: status racikan, input, suara dan antarmuka.
- `dist/index.html` dan `dist/style.css`: halaman dan tampilan responsif.

## Pembaruan tampilan hasil dan chawan

Tutup kaleng matcha dihapus. Chawan memiliki dasar lebih lebar, dinding membulat, bibir tebal yang sedikit tidak rata, dan kaki keramik. Ketinggian serta radius cairan mengikuti rongga chawan baru.

Setelah penyajian selesai, layar hasil memperlihatkan gelas 3D dari dekat dengan warna, level isi, dan busa dari racikan yang sebenarnya. Layar memuat ucapan selamat, takaran matcha/air/susu, total volume, karakter busa, serta tombol **Buat Ulang**. Hasil dapat ditutup dan dibuka kembali. Pengujian browser memverifikasi racikan dengan susu, tanpa susu, dengan dan tanpa busa, kembali ke meja, dan reset.


## Latte & Challenge

Isi chawan dan gelas disimpan terpisah. Susu dituang langsung ke gelas sebelum atau sesudah matcha. Shader lapisan menampilkan batas susu–matcha yang tidak rata, busa mengikuti hasil kocokan, es batu memakai geometri transparan, dan cloud menjadi lapisan krim putih. Hot menampilkan uap; Ice menyediakan hingga 12 es batu. Kapasitas gelas mencakup perpindahan volume oleh es.

Menu utama menawarkan **Cozy** tanpa batas waktu dan **Challenge** berisi 10 pesanan berurutan, masing-masing 3 menit. Tiga pesanan awal adalah Ice Matcha Latte, Ice Cloud Matcha Latte, lalu Hot Matcha Latte; pesanan selanjutnya memiliki variasi takaran. Checklist resep memeriksa suhu, matcha, air, susu, hasil kocokan, es, dan cloud. Kesalahan bisa dilengkapi di meja atau dibuat ulang; pesanan yang benar membuka pelanggan berikutnya. Waktu tetap berjalan sampai racikan yang sesuai disajikan. Cloud di versi ini berarti topping krim berbusa.

Jalankan `node tests/recipe.test.mjs` untuk memeriksa tiga resep × dua urutan penuangan, penolakan resep salah, batas kapasitas, perpindahan bahan, serta aturan es dan cloud. Pengujian browser menyelesaikan ketiga pelanggan, termasuk memperbaiki pesanan cloud yang belum lengkap. Tampilan 390 piksel juga diperiksa. Alur dan efek cairan terarah; bukan simulasi dinamika fluida.

## Rating & reaksi pelanggan

Setelah pesanan Challenge disajikan, pelanggan memberi 1–5 bintang, persentase kecocokan, ekspresi, komentar, dan saran berdasarkan racikan di gelas. Bobot kriteria berjumlah 100: suhu 20, matcha/air 25, susu 20, busa 10, es 15, cloud 10. Lima bintang mensyaratkan semua kriteria cocok; empat bintang mulai 80, tiga mulai 60, dua mulai 35, dan satu di bawahnya. Rincian tersedia melalui **Detail racikan & catatan**.

Waktu, urutan tuang, dan banyaknya percobaan tidak mengurangi rating. Pemain dapat kembali melengkapi atau membuat ulang racikan. Pelanggan berikutnya terbuka saat pesanan cocok seluruhnya. Mode Bebas tetap tidak menampilkan penilaian pelanggan.

Jalankan `node tests/rating.test.mjs` untuk tiga resep, kelima tingkat rating, seluruh kombinasi kriteria, saran bahan yang sesuai, serta pemeriksaan bahwa waktu dan urutan tuang tidak memengaruhi hasil.

Pemeriksaan browser untuk pembaruan rating: racikan yang kurang es mendapat 4 bintang (85%), lalu naik ke 5 bintang setelah dilengkapi; membuka hasil kembali tidak menggandakan jumlah pesanan. Reaksi 1 bintang dan perpindahan ke mode Bebas diperiksa pada tampilan 390 × 844 piksel.

## Animasi pencampuran saat disajikan

Saat layar hasil dibuka, latte mulai bercampur selama sekitar 15 detik: batas susu dan matcha berputar perlahan, melebar menjadi guratan, lalu merata menjadi hijau latte. Warna akhir mengikuti perbandingan susu dan matcha. Permukaan cairan ikut berubah dengan detail busa; topping cloud tetap terpisah.

Animasi berlaku untuk kedua urutan tuang dan mode Bebas maupun Challenge. Membuka hasil kembali meneruskan keadaan campuran; **Buat Ulang** mengembalikannya ke awal. Susu saja atau matcha saja tidak berubah menjadi latte. Pengaturan pengurangan gerak menonaktifkan pusaran dan mempertahankan perubahan warna perlahan. Animasi hanya mengubah tampilan, bukan volume, bahan, atau rating.

`node tests/mixing.test.mjs` memeriksa waktu transisi, kedua urutan tuang, bahan tunggal, reset, pembukaan ulang, dan keutuhan resep/rating. Efek ini merupakan animasi shader terarah, bukan simulasi fisika cairan.

Pemeriksaan visual browser: awal, pertengahan, dan akhir transisi dilihat untuk latte; urutan tuang terbalik dan topping Cloud juga diperiksa. Alur Challenge nyata memperlihatkan pusaran setelah penyajian dengan rating tetap 5/5.

## Es mengapung

Es di gelas kini jatuh lalu menetap di dasar ketika gelas kosong, naik secara halus mengikuti permukaan saat susu atau matcha dituang, dan bergoyang serta berputar pelan bersama pencampuran. Setiap kubus memiliki fase gerak sendiri, dengan batas dinding gelas dan pemisahan antarkubus. Gerak mereda setelah tuangan berhenti; layar hasil dan meja memakai keadaan gerak yang sama sehingga pembukaan ulang tetap berkesinambungan.

`dist/ice-motion.js` mengatur animasi ringan ini tanpa mesin fisika tambahan. Pengurangan gerak menonaktifkan gerakan dekoratif sambil mempertahankan tinggi es sesuai cairan. **Buat Ulang** mereset es; minuman Hot tidak memunculkan es. Jumlah bahan, penilaian, dan permainan tanpa batas waktu tetap sama.

`node tests/ice-motion.test.mjs` memeriksa dasar gelas kosong, kenaikan permukaan bertahap, gaya apung, gerak saat pencampuran, pemisahan, batas gelas, pengurangan gerak, es yang ditambahkan belakangan, reset, dan keutuhan resep/rating.

Pemeriksaan browser mencakup enam es sebelum tuang susu/matcha, gerakan di hasil penyajian dan setelah kembali ke meja, topping cloud, dan Hot tanpa es. Alur Challenge dengan tiga es diselesaikan sampai rating 5/5; tidak ada kesalahan JavaScript.

## Peningkatan detail seluruh adegan

Permukaan kini memakai peta warna, normal, dan kekasaran yang terpisah. Meja porselen abu terang memiliki pori halus dan sambungan tipis; bidang meja diperluas agar layar tinggi tidak memperlihatkan tepinya. Baki kayu memiliki serat memanjang, variasi lingkar tumbuh, tepi membulat, sambungan inset, dan pasak kecil. UV kayu mengikuti ukuran baki.

Profil teko, wadah susu, dudukan chasen, wadah es, dan gelas diperhalus. Chawan memiliki bekas putaran pembentukan dan variasi warna glasir di bibir. Chasen mendapat detail ikatan, gagang sendok dibulatkan, dan saringan menggunakan kawat 3D yang saling menganyam. Kaleng terbuka mendapat cetakan label serta butiran bubuk berwarna bervariasi yang mengikuti permukaan gundukan.

Busa memakai atlas warna/normal/kekasaran bersama serta kubah gelembung kecil melalui instancing. Tekstur cloud tetap putih krem. Gelas dan es lebih jernih, es memiliki gelembung udara di dalamnya, dan gelas Ice berisi cairan menampilkan embun. Pencahayaan, kontak bayangan, dan warna disesimbangkan; bayangan cincin dari ripple transparan saat diam diperbaiki. Resolusi render dibatasi pada rasio piksel 2. Tidak ada dependensi atau aset eksternal baru.

Pemeriksaan browser mencakup pandangan dekat baki, chawan, bubuk, Ice, Cloud, dan Hot; alur Challenge nyata dari pengayakan sampai penyajian menghasilkan 5/5 dan reset mengosongkan meja. Tampilan 390 × 844 diperiksa. Pemeriksaan sintaks serta pengujian resep, rating, pencampuran, dan gerak es lulus. Performa pada ponsel fisik belum diukur.

## Kamera saat meracik

Kamera mendekat dan bergeser ke chawan saat menuang air atau mengocok, serta ke gelas saat menuang susu, matcha, atau cloud. Bingkai tuang matcha lebih luas agar chawan yang terangkat tetap terlihat. Gerak memakai pegas teredam tanpa pantulan; setelah aksi berhenti, kamera menunggu sebentar lalu kembali perlahan ke pandangan meja dan jarak zoom manual sebelumnya. Memilih alat saja tidak memicu kamera.

Pelepasan tombol, pembatalan pointer, kehilangan fokus, atau berhenti menuang saat wadah penuh menggunakan jalur kembali yang sama. Layar hasil dan racikan baru membersihkan fokus aksi. Pengaturan sistem pengurangan gerak menonaktifkan perpindahan kamera otomatis. Resep, rating, animasi cairan, dan permainan tanpa batas waktu tetap berlaku.

`node tests/camera-motion.test.mjs` memeriksa kelima aksi, pemulihan zoom manual, gerak tanpa lompatan/pantulan, pergantian fokus, aksi singkat berulang, konsistensi 30/120 fps, reset, dan pengurangan gerak. Pemeriksaan browser mencakup air, pengocokan, susu, transfer matcha, cloud, kembali ke meja, layar hasil, serta bingkai 390 × 844. Seluruh pengujian resep, rating, pencampuran, dan es juga lulus.

## Aliran cairan & riak

Aliran kini memakai geometri lengkung yang diperbarui dari posisi dunia mulut teko, ujung wadah susu, atau bibir chawan/cloud. Alat mendekat sebelum cairan mengalir; ujung aliran mengikuti ketinggian isi wadah penerima. Tuangan air dan susu mulai menambah volume setelah aliran mencapai permukaan. Setelah tombol dilepas, ekor aliran jatuh habis dalam sekitar 0,15 detik tanpa mengikuti alat yang kembali ke baki.

Riak kecil muncul di titik benturan, melebar di dalam batas mangkuk/gelas, mengikuti permukaan yang naik, lalu mereda. Es merespons benturan aliran yang sama. Permukaan matcha saat chawan miring tetap mendatar terhadap meja dan terpotong mengikuti rongga chawan; isi berkurang selama penuangan. Topping cloud juga tumbuh bertahap. Gerak ini merupakan animasi terarah, bukan simulasi fluida penuh.

Geometri aliran dan riak digunakan ulang. Tidak ada dependensi tambahan. Pengurangan gerak mematikan denyut aliran dan riak dekoratif; reset serta layar hasil membersihkan seluruh efek tuang.

`node tests/pour-effects.test.mjs` memeriksa sambungan ujung alat saat bergerak/berputar, kurva jatuh, orientasi permukaan geometri, awal/akhir aliran, permukaan yang naik, batas riak, permukaan chawan miring, reset, dan pengurangan gerak. Pemeriksaan browser menggunakan racikan uji untuk air, susu, matcha, cloud, serta tampilan 390 × 844. Penyajian resep Challenge yang sesuai tetap mendapat 5/5. Seluruh pengujian resep, rating, pencampuran, es, dan kamera lulus.

## Efek suara meracik

Tombol speaker mengaktifkan suara air yang gemericik, tuangan susu/matcha/cloud yang lebih lembut, gesekan basah chasen, dan denting es. Suara tuang mengikuti benturan aliran yang terlihat, termasuk ekor tuangan dan aksi otomatis; pengocokan mulai terdengar ketika chasen tiba di chawan. Denting es dipicu sekali saat kelompok berisi tiga kubus mulai mendarat.

Pengocokan dan cloud memakai tekstur audio prosedural lokal dengan variasi kecil, lapisan resonansi, volume lembut, peredaman frekuensi tinggi, serta transisi gain untuk menghindari klik. Air, susu, tuangan matcha, dan es memakai rekaman yang diberikan pengguna, sebagaimana dirinci di bawah. Buffer digunakan ulang dan suara es dibatasi delapan suara bersamaan. Tidak ada dependensi baru. AudioContext dibuka dari interaksi pengguna. Audio mulai setelah interaksi pengguna; musik dan efek memiliki volume serta pilihan mute yang terpisah dan tersimpan di browser.

Efek meracik mereda saat mute, reset, bantuan, atau layar hasil; dampak es yang tertunda dibuang. Musik tetap menemani tampilan yang terlihat. Tab tersembunyi dan kehilangan fokus menjeda seluruh audio. Gangguan perangkat audio ditangani tanpa menghentikan game dan dapat dicoba lagi melalui interaksi berikutnya.

`node tests/sound-textures.test.mjs` memeriksa batas sinyal, perbedaan karakter, variasi, sambungan loop, akhir denting yang hening, serta beberapa sample rate. `node --test tests/soundscape.test.mjs` memeriksa aktivasi dari interaksi, sinkronisasi intensitas, pemakaian ulang node, batas dan pembersihan suara es, mute, interupsi, serta pemulihan perangkat audio.

Pemeriksaan browser menggunakan keluaran AudioContext yang sebenarnya untuk air, susu, tuang chawan/cloud, pengocokan, es kering/basah, mute saat menuang, reset, dan kembali dari hasil. Keluaran terukur kembali hening setelah mute/reset/hasil, tanpa kesalahan JavaScript. Perilaku audio pada perangkat seluler fisik belum diuji.


## Musik latar & volume terpisah

Komposisi orisinal **Senja di Meja Matcha** memakai melodi bernuansa felt piano dan harmoni hangat pada 62 BPM. Frasa sekitar 62 detik berulang dengan ekor nada yang saling bertumpuk. Musik dijadwalkan ringan melalui Web Audio tanpa aset eksternal, drum, atau vokal; jumlah suara aktif dibatasi dan node selesai dibersihkan.

Ikon speaker membuka panel **Suasana suara** dengan volume Musik latar dan Efek suara 0–100%, mute terpisah, serta Senyapkan semua/Pulihkan suara. Nilai awal adalah musik 30% dan efek 70%. Volume serta mute disimpan secara mandiri di browser, dengan fallback aman bila penyimpanan tidak tersedia. Audio dimulai melalui interaksi pengguna, misalnya Mulai meracik atau perubahan pengaturan.

Jalur musik terpisah dari kompresor efek, sehingga pengaturan efek tidak mengubah musik. Musik terus mengalun saat reset, bantuan, atau hasil ditampilkan. Saat musik dimatikan atau halaman kehilangan fokus, musik mereda dan mempertahankan posisi frasa; melanjutkan tidak memutar ulang serangan nada yang tertinggal. Panel bisa ditutup dengan tombol, klik di luar, atau Escape, dan mendukung kontrol keyboard serta layar kecil.

`node tests/music-player.test.mjs` memeriksa komposisi, amplop nada, penjadwalan, jeda/lanjut, pergantian frasa, keterlambatan frame, batas node, dan fallback audio. `node tests/audio-preferences.test.mjs` memeriksa penyimpanan independen, batas volume, data rusak, serta kegagalan penyimpanan. Pengujian soundscape diperluas untuk jalur dan volume independen, musik tanpa efek, efek tanpa musik, mute, serta interupsi.

Pemeriksaan browser memakai keluaran AudioContext yang sebenarnya: musik tanpa efek, efek tanpa musik, dua slider, Senyapkan semua/Pulihkan suara, volume setelah muat ulang, Escape, penyajian dan kembali ke meja, serta panel 390 × 844. Musik dan efek menghasilkan sinyal pada jalur terpisah; keduanya kembali hening saat dimatikan. Perangkat seluler fisik belum diuji.


## Rekaman tuangan pengguna

Rekaman `dist/audio/water-pour.mp3` berasal dari berkas yang diberikan pengguna dan disertakan tanpa perubahan. Rekaman yang sama dipakai saat air menyentuh chawan, susu dituang ke gelas, dan matcha dari chawan masuk ke gelas. Pengocokan, es, cloud, dan musik latar tetap memiliki jalur yang sama. Volume rekaman mengikuti **Efek suara**, terpisah dari musik.

MP3 dimuat dan didekode sekali setelah interaksi pengguna. Buffer mono mengambil bagian aktif sekitar 0,20–4,85 detik, menaikkan amplitudo 6 dB secara konservatif, dan menyambung loop dengan crossfade 80 ms. Tuangan dimulai dari awal buffer pada benturan cairan yang sebenarnya, berulang mulus ketika tuangan panjang, serta mereda ketika aliran berakhir. Sumber dan amplop dibersihkan setelah selesai; frame biasa hanya memperbarui parameter.

Pemuatan rekaman tidak memicu pemutaran; reset, mute, bantuan, dan tab tersembunyi tetap menghentikan efek. Jika berkas gagal dimuat, game, musik, dan efek lain tetap berjalan; interaksi pengaktifan berikutnya dapat mencoba lagi. `tests/pour-recording.test.mjs` memeriksa pemrosesan buffer dan kegagalan pemuatan. Pengujian soundscape mencakup penggunaan rekaman untuk ketiga tuangan, pemakaian ulang buffer, loop panjang, awal ulang, serta pemuatan yang selesai setelah mute atau reset.

Pemeriksaan browser memakai rekaman MP3 yang sebenarnya: berhasil didekode menjadi loop mono 4,57 detik, diputar pada tuangan air, susu, dan matcha, lalu kembali hening setelah aliran berakhir. Pengocokan tetap terdengar; mematikan Efek suara menahan rekaman tetap hening sementara volume musik tetap 30%. Tidak ada kesalahan JavaScript pada alur tersebut. Seluruh 51 pengujian otomatis dan pemeriksaan sintaks lulus.


## Suara bubuk & ayakan

Mengambil matcha kini memiliki gesekan bambu yang lembut dan tekstur butiran kering saat bubuk jatuh. Pengayakan memakai butiran yang lebih halus serta denyut ayakan yang teredam. Keduanya dibuat secara prosedural tanpa berkas atau dependensi eksternal, dengan variasi alami dan volume di bawah efek pengocokan.

Intensitas mengikuti fase animasi yang sebenarnya: pengambilan pada awal gerakan, butiran saat bubuk terlihat jatuh, lalu hening ketika alat kembali. Memilih alat saja tidak memicu suara. Kanal `scoop` dan `sift` menggunakan buffer loop yang dibuat sekali bersama audio lainnya; frame biasa memperbarui gain tanpa membuat node baru. Keduanya mengikuti **Efek suara** dan tetap terpisah dari musik.

Reset, bantuan, hasil, mute, tab tersembunyi, dan hilangnya fokus meredakan suara. Pengujian fase suara bubuk memeriksa sinkronisasi pengambilan/pengayakan, batas fase, nilai tidak valid, dan objek keluaran yang dipakai ulang. Pengujian tekstur dan soundscape mencakup karakter kering, sinyal terbatas, loop halus, tumpang tindih kedua kanal, penggunaan ulang buffer, serta mute dan pemulihan.

Pemeriksaan browser memverifikasi keluaran AudioContext nyata saat menyendok dan mengayak, hening saat hanya memilih alat, hening setelah gerakan, efek mute sementara musik tetap 30%, serta reset ketika ayakan sedang bergerak. Kedua suara lebih lembut daripada pengocokan, tanpa kesalahan JavaScript. Seluruh 62 pengujian otomatis dan pemeriksaan sintaks lulus.


## Wadah es besar, tiga es per aksi & rekaman es

Wadah es kini lebih besar dan dalam, dengan bibir tebal serta penjepit logam yang mengikuti ukurannya. Isi es lebih banyak dan disusun dalam lapisan, memakai geometri, material transparan, serta gelembung yang sama dengan kubus di gelas. Letak di kanan tetap berjarak dari teko dan gelas.

Tombol **Tambah 3 es batu** menambahkan satu kelompok utuh berisi tiga kubus; aksi berikutnya menjadi enam. Gelas memiliki batas 12 kubus dan perpindahan volume 10 ml per kubus. Jika ruang kurang dari 30 ml, seluruh kelompok ditolak tanpa mengubah racikan. Hot tetap menolak es. Cozy bebas waktu; Challenge memakai 3 menit per pesanan.

Berkas `dist/audio/ice-cube.mp3` merupakan rekaman pengguna yang disalin tanpa perubahan. Dua bagian denting (.12–1.42 detik dan 2.20–3.86 detik) dibuat menjadi buffer mono dengan tepi lembut 12 ms, tanpa menaikkan level rekaman. Satu bagian diputar sekali pada pendaratan pertama dari kelompok tiga es, bergantian antaraksi, sehingga tidak menumpuk tiga salinan panjang. Kecepatan pemutaran tetap asli. Volume mengikuti **Efek suara**.

Rekaman dimuat/didekode sekali sesudah interaksi pengguna. Pemuatan yang selesai belakangan tidak memutar ulang pendaratan yang terlewat. Mute, reset, hasil, bantuan, kehilangan fokus, dan tab tersembunyi tetap meredakan audio; kegagalan memuat es tidak mengganggu musik maupun suara tuangan. Pengujian mencakup batch utuh dan ruang gelas, cue tunggal per kelompok, pemrosesan rekaman, pemuatan tertunda, pembersihan node, serta volume independen.

Pemeriksaan browser memakai MP3 asli dan memverifikasi 0→3→6 kubus, satu pemutaran per kelompok, penolakan kelompok ketiga tanpa suara, pembatalan sebelum pendaratan melalui reset, Hot tanpa es/suara, serta tampilan desktop dan 390 × 844. Rekaman berhasil didekode menjadi dua bagian 1,30/1,66 detik; keluaran kembali hening dan tidak ada kesalahan JavaScript pada alur tersebut. Seluruh 74 pengujian otomatis dan pemeriksaan sintaks lulus.


## Toko matcha & taman sakura

Konsep yang disetujui tersimpan di `reference/approved-shop.png`. Meja persiapan kini berada di depan jendela kayu dengan dinding plester hangat dan taman kecil berpagar kayu. Sudut pandang peracik lebih rendah sehingga jendela terlihat bersama chawan, baki kiri, dan peralatan kanan. Panel meracik lebih ringkas dan kartu resep awalnya tertutup agar meja tetap terbaca; resep dapat dibuka kapan saja.

Jendela, sambungan kayu, lis meja, dinding, dan kelopak merupakan geometri 3D. Taman menggunakan bidang gambar berlapis di belakang jendela untuk mempertahankan detail konsep tanpa geometri vegetasi berat. Taman adalah gambar buatan untuk proyek ini di `dist/assets/sakura-garden.jpg` (sumber PNG dipertahankan di `reference/sakura-garden-source.png`); bukan gambar seluruh permainan. Meja, peralatan, bahan, es, aliran, riak, dan seluruh interaksi tetap dirender dalam 3D. Tidak ada layanan aset berbayar atau dependensi baru.

Kelopak sakura melayang perlahan hanya di luar jendela melalui instancing. Pengurangan gerak menghentikan gerakan dekoratif dan tab tersembunyi menjedakannya. Latar tidak masuk ke daftar objek yang dapat dipilih. Posisi alat dan target tuangan tidak diubah. Kamera aksi tetap mendekat ke wadah, lalu kembali ke tampilan toko dan zoom manual sebelumnya. Kamera hasil independen tetap menampilkan racikan serta penilaian pelanggan.

`shop-view.js` menghitung proyeksi kamera dan bingkai yang konsisten dengan pemilihan objek. Pengujian mencakup bingkai desktop/portrait, target aksi, transisi dan kembali ke zoom manual, layar pendek, serta input yang tidak valid. Modul lingkungan juga diperiksa untuk batas geometri, pemakaian ulang objek, fallback gambar, jeda gerak, dan pelepasan sumber daya.

Pemeriksaan browser menyelesaikan Challenge nyata dengan klik pada objek 3D: susu, tiga es, dua sendok matcha, air, kocok dan transfer. Pesanan mendapat 5/5 dan 100%, dengan urutan Susu → matcha; kamera tuang/riak serta kembali dari hasil diperiksa. Pada 390 × 844, tampilan taman/jendela, penambahan es, tuang susu, fokus kamera dan layar hasil juga diperiksa. Seluruh 78 pengujian otomatis dan pemeriksaan sintaks lulus. Gambar taman produksi dikemas sebagai JPEG sekitar 1 MB untuk mengurangi muatan awal; sumber konsep tetap tersimpan.

## Gelas tinggi 450 ml

Gelas saji kini memiliki dinding 1,5 kali lebih tinggi dengan dasar dan diameter yang sama. Kapasitas 450 ml dipakai bersama oleh aturan resep dan tampilan cairan; tiga es memakan ruang 30 ml, enam es 60 ml. Level susu, matcha, cloud, embun, batas apung es, ujung tuangan, serta kamera dekat/hasil mengikuti dinding baru. Takaran pesanan pelanggan tetap sama; ruang tambahan tersedia untuk eksperimen bebas.

## Kartu takaran yang mudah dibaca

Dua kartu Chawan dan Gelas ditempatkan di atas ikon alat. Angka utama menggunakan ukuran 20–24 px; kartu Chawan menampilkan sendok, air, dan busa, sedangkan kartu Gelas menampilkan cairan, es/cloud, sisa ruang, dan bar kapasitas 450 ml yang ikut menghitung perpindahan volume oleh es. Sorotan warna bertahan selama takaran berubah, lalu meredup setelah perubahan selesai. Pengurangan gerak menonaktifkan transisi. Pembaca layar menerima ringkasan setelah takaran berhenti berubah. Reset membersihkan sorotan serta pengumuman yang tertunda.

## Menu utama, 10 Challenge, dan 12 es

Menu awal memblokir aksi alat sampai pemain memilih Cozy atau Challenge. Cozy tetap tanpa penilaian pelanggan dan tanpa timer. Challenge memiliki 10 pesanan berurutan: tiga resep klasik, Extra Ice, Hot Cloud, Milky, Hot Strong, Ice Cloud Strong, Ice Cloud Milky, dan Twelve dengan 12 es. Checklist dan petunjuk alat mengikuti takaran pesanan aktif.

`dist/challenge.js` memakai tenggat 180 detik berbasis waktu monotonik, terpisah dari delta animasi. Panduan, panel suara, tab tersembunyi, dan layar hasil yang belum cocok tidak menjeda waktu. Penyajian dengan seluruh kriteria sesuai sebelum tenggat menghentikan timer; membuka hasil ulang tidak menambah progres. Pesanan berikutnya mendapat 3 menit penuh. Saat waktu habis, aksi yang tertunda dibatalkan dan pemain bisa mengulang pesanan itu tanpa kehilangan pesanan sebelumnya. Kembali ke menu mengakhiri sesi; progres tidak disimpan setelah muat ulang. Setelah pesanan kesepuluh tersedia ucapan selesai, main lagi, dan menu utama. Rating tetap berdasarkan racikan, dengan batas waktu sebagai syarat penyelesaian terpisah.

Es ditambahkan tiga sekaligus hingga 12, selama ada ruang 30 ml per aksi. 12 es menyisakan 330 ml untuk cairan. Geometri gelas dan simulasi gerak memakai kumpulan 12 kubus; kubus kering menumpuk dan kubus yang mengapung terbagi dalam dua lapisan. Rekaman es tetap satu per aksi.

Pengujian otomatis mencakup batas tepat 180 detik, waktu terlewat tanpa frame, penyajian salah, timer berhenti setelah berhasil, percobaan ulang dengan progres tetap, akhir 10 pesanan, keutuhan takaran, semua resep dalam kedua urutan tuang, serta gerak 12 es.

Pemeriksaan browser pembaruan ini: menu memblokir pintasan sebelum pilihan mode, Cozy menambahkan 0→3→6→9→12 es dan menolak kelompok kelima, pesanan pertama dengan 12 es memperoleh 5/5, pesanan kedua dimulai pada 03:00, penyajian yang salah tetap menjalankan timer, panduan ditutup otomatis saat tenggat habis, dan ulang mempertahankan progres 1 pesanan serta memberi 3 menit baru. Menu, kartu pesanan, timer, serta dialog kedaluwarsa diperiksa pada 390 × 844. Tidak ada error atau warning JavaScript pada alur tersebut. Seluruh 79 pengujian otomatis dan sintaks 20 modul lulus.

## Rangkuman akhir Challenge

Setelah pesanan ke-10 berhasil disajikan, dialog rangkuman muncul otomatis. Tiga kartu menampilkan skor total dari maksimum 1.000, bintang total dari maksimum 50, dan waktu meracik. Tabel yang dapat digulir memuat nama pesanan, bintang, skor, serta durasi setiap customer. Tombol Main Lagi memulai sesi Challenge kosong dengan 3 menit untuk customer pertama; Menu Utama mengakhiri sesi. Menutup rangkuman dan memilih Lihat hasil membukanya kembali tanpa menggandakan catatan.

Riwayat disimpan oleh `challenge.js` saat penyajian berhasil. Skor/bintang berasal dari rating racikan yang benar-benar disajikan; aturan kelulusan tetap mensyaratkan semua kriteria cocok. Durasi per customer menjumlahkan waktu aktif semua percobaan, termasuk percobaan yang diulang; waktu setelah kedaluwarsa atau sesudah pesanan berhasil tidak dihitung. Setiap percobaan kedaluwarsa menyumbang paling banyak 3 menit. Durasi tampilan dibulatkan ke detik per baris dan dijumlahkan agar total sama dengan sepuluh baris. Data tidak disimpan setelah sesi berakhir atau halaman dimuat ulang.

Pengujian otomatis meliputi sepuluh catatan, skor/bintang aktual, durasi dan pembulatan, percobaan ulang, jeda kedaluwarsa, pembukaan ulang, salinan riwayat yang aman, Main Lagi, serta Menu Utama. Pengujian browser menyelesaikan seluruh sepuluh resep lewat kontrol game, menghasilkan rangkuman 1.000 poin / 50 bintang / 03:48; total waktu cocok dengan seluruh baris. Rangkuman desktop dan 390 × 844 diperiksa, termasuk gulir sampai customer ke-10, pembukaan ulang, Main Lagi ke 03:00 dengan racikan kosong, dan kembali ke menu. Tidak ada error atau warning JavaScript. Seluruh 80 pengujian otomatis lulus.

## Fokus kamera saat menambah bubuk dan es

Aksi mengambil bubuk langsung maupun mengayak memfokuskan kamera ke chawan. Menambahkan tiga es memfokuskan kamera ke gelas dengan bingkai yang mencakup jalur jatuh es, bibir gelas, dan isinya. Fokus memakai pegas halus yang sama dengan tuangan/pengocokan, mulai ketika aksi valid berjalan, bertahan sebentar setelahnya, lalu kembali ke zoom meja pilihan pemain. Memilih alat atau aksi yang ditolak tidak memindahkan kamera. Pengurangan gerak tetap mempertahankan pandangan meja.

Pemeriksaan otomatis mencakup durasi asli aksi 1,7 detik untuk bubuk/ayakan dan 1,2 detik untuk es, fokus sebelum bahan mendarat, transisi antarwadah, batch berulang, frame rate, reset, zoom manual, pengurangan gerak, serta bingkai jatuh bahan di atas panel kontrol pada desktop dan ponsel. 13 pemeriksaan terarah lulus. Browser memverifikasi zoom bubuk, ayakan, es di gelas kosong dan berisi susu, kembali ke meja, dan tampilan 390 × 844 tanpa error atau warning JavaScript.

## Kotak susu dan interaksi langsung

Tiga karton 3D Fresh Milk, Almond Milk, dan Oat Milk berjejer di belakang baki kiri, mengikuti konsep `reference/approved-milk-cartons.png`. Karton memakai badan kertas bertekstur, atap lipat, sambungan, tutup beralur, serta cetakan berwarna berbeda. Wadah susu kecil digantikan karton; wadah krim cloud tetap di baki. Saat dituang, karton yang dipilih terangkat dan miring, tutup terbuka, dan aliran berasal dari mulutnya menuju gelas dengan riak serta suara yang sama.

Semua peralatan meracik dapat digunakan langsung: klik kaleng/sendok untuk bubuk, ayakan untuk mengayak, teko untuk air, chasen/dudukannya untuk mengocok, salah satu karton untuk susu, wadah es/penjepit untuk tiga es, dan krim untuk cloud. Klik chawan menuang matcha; klik gelas menyajikan hasil. Klik baki memulihkan jarak pandang awal. Klik singkat teko memberi 30 ml air, karton 40 ml susu, dan chasen menambah sekitar 30% busa; tekan-tahan memberi kendali bebas hingga dilepas. Esc, pembatalan pointer, tab tersembunyi, dan kehilangan fokus menghentikan tuangan. Tab/Enter menyediakan aksi yang sama melalui keyboard.

Panel panduan, ikon alat, dan kartu takaran di bawah dihapus dari halaman. Hot/Ice dan Sajikan menjadi kontrol ringkas di atas. Takaran sementara muncul dekat chawan/gelas selama digunakan, lalu hilang sesudah kamera kembali. Kartu pesanan berada di atas area kerja dan meredup ketika aksi berlangsung agar tidak menutupi tuangan. Area tekan untuk ayakan, sendok, chasen, dan gelas diperluas tanpa menambahkan objek visual.

Sepuluh pelanggan kini memesan varian susu tertentu. Takaran dan jenis susu bersama-sama menentukan kriteria susu berbobot 20 poin. Campuran susu tetap boleh dalam Cozy; Challenge mensyaratkan varian yang diminta. Mengganti pilihan kotak tidak mengganti susu yang sudah dituang. Komposisi setiap varian dicatat hingga hasil penyajian dan direset saat membuat ulang. Rangkuman akhir juga menyertakan nama susu pelanggan.

Validasi: seluruh 84 pengujian otomatis lulus, mencakup sepuluh resep × tiga susu × dua urutan tuang, susu campuran, konservasi kapasitas, reset, dan penilaian. Uji browser menyelesaikan Fresh Milk Challenge melalui objek hingga 5/5 dan 100%, memverifikasi Oat/Almond dituang dari kotaknya, kontrol sekali klik/tekan-tahan, akses Enter, serta tampilan dan tuangan pada 390 × 844 tanpa error atau warning JavaScript. Performa pada perangkat seluler fisik belum diukur.


## Sendok–ayakan dan sorotan objek

Sendok diletakkan bersama ayakan. Klik salah satu, kaleng matcha, atau pintasan penambahan bubuk menjalankan satu animasi yang sama: sendok mengisi ayakan, lalu ayakan bergoyang di atas chawan. Takaran bertambah satu sendok hanya setelah animasi selesai. Reset membatalkan aksi yang belum selesai.

Setiap objek interaktif mendapat sorotan hangat yang meredup saat kursor berpindah, serta keterangan aksi di samping objek. Sendok dan ayakan disorot bersama. Fokus keyboard juga menampilkan sorotan dan teks; label menyesuaikan tepi layar. Sorotan dibersihkan saat aksi, menu, atau hasil penyajian dibuka. Lapisan sorotan memakai material terpisah agar tekstur dan shader minuman tetap utuh, dengan intensitas lebih rendah pada kaca/es dan tanpa transisi jika pengurangan gerak aktif.

Pengujian otomatis mencakup semua jalur penambahan bubuk, material bersama, pengambilan objek dengan raycast, instancing, pemulihan/reset, pengurangan gerak, serta transparansi kaca. Pemeriksaan browser mencakup seluruh objek, takaran per klik, pintasan keyboard, penyajian latte, dan tata letak sempit.


## Takaran saat menyorot wadah

Sorot chawan untuk melihat sendok matcha, air, dan busa. Sorot gelas untuk melihat takaran matcha/air, setiap jenis susu yang benar-benar dituang, busa, jumlah es, cloud, dan total cairan. Bar kapasitas menggunakan ruang terpakai termasuk perpindahan volume oleh es; sisa ruang mengikuti aturan kapasitas resep. Takaran diperbarui setelah setiap aksi, transfer, dan reset. Informasi juga tersedia melalui fokus keyboard, termasuk setelah penyajian ketika kembali ke meja, dan menghilang saat fokus/sorotan berpindah. Tidak ada kartu takaran permanen.


### Ritme Cozy yang lebih tenang

Gerakan memakai tahap angkat, miringkan, gunakan, dan kembali yang lebih lembut. Mengayak berlangsung 4,4 detik, memindahkan matcha 5,6 detik, cloud 4 detik, dan memasukkan tiga es 3,2 detik. Es dibawa dari wadah sebelum dilepas satu per satu; jatuhnya tetap memakai gravitasi semula.

Laju air 12 ml/detik, susu 16 ml/detik, dan busa 8,5 poin persentase/detik saat chasen telah mencapai chawan. Satu klik tetap memberikan 30 ml air, 40 ml susu, atau 30 poin busa. Gerakan manual chasen juga dihaluskan. Kamera memperlambat perpindahan dan menunggu sejenak sebelum kembali. Riak, pengapungan es, pencampuran latte (24 detik), uap, dan kelopak bunga bergerak lebih tenang. Audio mengikuti kontak aktual; rekaman pengguna dan musik mempertahankan kecepatan aslinya.

Konstanta ritme berada di `dist/preparation-motion.js`; tidak mengubah resep, rating, kapasitas, atau jam Challenge 3 menit. Pengujian mencakup kontinuitas gerakan, konsistensi frame rate, pembatalan/reset, es bertahap, kontak suara, dan takaran.


### Penjepit es bergerak

Satu klik es kini menjalankan tiga pengambilan satu per satu selama sekitar 9,2 detik. Penjepit terangkat, turun ke es, menutup, membawa es di antara rahangnya, membuka di atas gelas, lalu kembali untuk es berikutnya. Setelah es ketiga, penjepit kembali ke tempat semula. Jalur penjepit dan es memakai posisi genggaman serta waktu yang sama; es baru bergerak bebas setelah dilepas.

Dua belas es yang bisa diambil berasal dari posisi nyata di wadah, dan menghilang dari wadah saat dijepit sehingga tidak terduplikasi. Setiap es berbunyi ketika mendarat. Zoom mencakup jalur wadah hingga gelas. Reset mengembalikan penjepit dan persediaan, sementara pengurangan gerak melewati gerakan penjepit. Jam Challenge tetap berjalan sesuai aturan semula.

`tests/ice-transfer.test.mjs` memeriksa posisi es terhadap titik genggaman model 3D, kontinuitas tiga perjalanan, batas bibir gelas, visibilitas saat pengambilan, bunyi pendaratan, reset, dan pengurangan gerak.

### Riak saat es menyentuh cairan

Setiap es memunculkan dua riak kecil ketika bagian bawahnya pertama kali menyentuh susu atau matcha. Riak kedua muncul sedikit terlambat dan lebih samar; keduanya melebar lalu memudar selama sekitar 1,7 detik, mengikuti ketinggian cairan dan tetap di dalam gelas. Cloud meredam kekuatannya. Gelas kosong, es yang masih dijepit, dan es yang sudah mengapung tidak memicu riak baru.

Efek memakai kembali kumpulan riak yang tersedia tanpa menambah cairan atau mengubah racikan. Berganti alat membiarkan riak selesai memudar; reset dan pengurangan gerak membersihkannya. `tests/ice-ripples.test.mjs` memeriksa kontak nyata, urutan tiga es, gelas kosong, pemudaran, batas gelas, tinggi permukaan, reset, serta pengurangan gerak. Seluruh 91 pengujian otomatis lulus.

### Cloud cair dengan busa ringan

Cloud memakai permukaan krim cair yang berkilau lembut, gelombang rendah yang berubah bentuk, dan batas bawah yang menyatu halus dengan warna minuman. Tekstur busanya lebih jarang, dilengkapi gelembung kecil yang hampir rata di dekat tepi. Tuangan dan masuknya es memberi gerakan ringan yang mereda; pencampuran hasil sajian tetap menggerakkan permukaan cloud perlahan.

Geometri permukaan dan posisi gelembung dipakai bersama oleh tampilan meja dan hasil. Jeda tab menghentikan animasi, pengurangan gerak mempertahankan permukaan tenang, dan reset membersihkan gerak yang tersisa. Volume cloud, batas kapasitas, resep, dan rating tidak berubah. `tests/cloud-layer.test.mjs` memeriksa batas gelas, gelombang rendah, pemudaran gerakan, kontak es, tampilan hasil, jeda, pengurangan gerak, serta reset. Seluruh 92 pengujian otomatis lulus.

### Meja mobile yang lebih dekat

Pada lebar layar hingga 700 px, kamera mulai lebih dekat ke chawan dan gelas. Geser horizontal untuk menjangkau baki, kotak susu, teko, dan es; tombol panah serta tombol Meja menyediakan alternatif. Perpindahan kamera lembut dan dibatasi di kedua sisi. Setelah aksi meracik, kamera kembali ke posisi pandangan terakhir. Tampilan serta framing desktop dipertahankan.

Ketukan singkat memakai takaran per klik yang sama. Geseran dari atas alat memindahkan kamera tanpa meracik; tahan teko, karton, atau chasen selama 360 ms untuk mulai menggunakan alat. Pembatalan sentuhan, kehilangan fokus, dan pergantian layar menghentikan aksi. Fokus keyboard membawa alat ke dalam pandangan pada mobile.

Kontrol atas lebih ringkas dan kartu Challenge menampilkan nama minuman, varian susu, serta timer secara default. Tombol detail membuka resep lengkap. Pengujian browser mencakup layar 320 × 568, 390 × 844, dan desktop 1280 × 720, termasuk geseran dari atas alat, ketukan susu 40 ml, tuangan tahan, dan ayakan. Pengujian otomatis memeriksa pemisahan ketuk/tahan/geser, pembatalan, jangkauan kamera, pengurangan gerak, serta kembalinya kamera. Perangkat seluler fisik belum diuji.

### Pelanggan bernama dan ritual penyajian

Sepuluh pesanan Challenge kini datang dari Haru, Aoi, Ren, Yui, Sora, Hana, Daichi, Mei, Nao, dan Kenta. Masing-masing memiliki potret kecil, pekerjaan/kepribadian, sapaan, dan komentar pribadi. Nama tetap terlihat pada kartu mobile yang diringkas; sapaan tersedia saat detail dibuka. Reaksi menyebut ketidaksesuaian nyata, termasuk varian/takaran susu, kekuatan matcha, air, suhu, busa, es, dan cloud. Potret berubah ekspresi mengikuti rating. Nama yang sama dipakai pada rangkuman. Skor, takaran, dan urutan sepuluh resep tidak berubah.

Menekan Sajikan memulai gerakan 4,8 detik: kamera mendekat, lalu gelas di atas tatakan kayu meluncur perlahan ke arah pelanggan. Isi gelas, es, busa, dan bayangannya ikut bergerak. Pencampuran latte mulai saat penyajian dan berlanjut pada hasil. Menutup hasil mengembalikan gelas selama 2,8 detik ke meja beserta pandangan terakhir. Cozy memakai ritual penyajian yang sama tanpa rating atau pesanan wajib.

Challenge menerima racikan pada saat Sajikan ditekan sebelum batas waktu; animasi penyajian tidak mengurangi waktu meracik. Hasil yang belum sesuai melanjutkan waktu tersisa setelah animasi, sedangkan pesanan yang cocok dicatat sekali. Pelanggan terakhir menampilkan reaksinya terlebih dahulu, lalu tombol Lihat rangkuman. Menu atau reset membatalkan penyajian tanpa callback tertinggal. Tab tersembunyi menjeda animasi; pengurangan gerak memakai transisi singkat.

Pengujian otomatis mencakup identitas dan reaksi pelanggan, batas deadline saat penyajian, penghitungan waktu, pembatalan, penyajian berulang, lintasan gelas, gerakan kamera, serta tampilan nama di recap. Pemeriksaan browser mencakup Haru dengan es yang belum lengkap (4 bintang), perbaikan racikan menjadi 5 bintang, pergantian ke Aoi, dan kartu pelanggan pada 390 × 844 serta 320 × 568. Perangkat seluler fisik belum diuji.

### Meja lapang, pesanan lewat ikon, dan suhu otomatis

Pesanan Challenge muncul di kanan atas saat memulai atau mengulang pesanan, lalu menutup setelah delapan detik terlihat atau segera ketika pemain mulai memakai alat. Ikon nota di kanan atas membuka detail lengkap kapan saja; panel yang dibuka secara sengaja tetap terbuka sampai ditutup, Esc, atau kembali meracik. Fokus keyboard pada panel menjeda penutupan otomatis. Timer lengkap berada di panel; label ikon menyertakan waktu tersisa dan sorotan halus menandai menit terakhir. Tidak ada kartu pesanan atau kontrol Hot/Ice permanen di tengah meja.

Racikan tanpa es menjadi Hot; menambahkan satu batch tiga es menjadikannya Ice. Evaluasi pelanggan, judul hasil, uap/kondensasi, dan takaran mengikuti keadaan tersebut. Menambahkan es tetap tunduk pada kapasitas dan batas 12 es; batch yang ditolak tidak mengubah suhu atau bahan. Persyaratan suhu dan jumlah es tetap dinilai dengan bobot yang ada, tetapi kini keduanya berasal dari isi gelas.

Sajikan muncul di samping gelas setelah matcha dari chawan benar-benar masuk. Tombol mengikuti posisi gelas dan berganti sisi ketika ruang layar terbatas; menghilang saat gelas di luar pandangan, aksi berlangsung, atau dialog/pesanan terbuka. Gelas berisi susu saja belum dapat disajikan. Setelah penyajian berhasil, tombol menjadi Lihat hasil. Pengujian mencakup penutupan/pembukaan pesanan, lima persyaratan resep independen, Hot/Ice dari es, serta posisi tombol desktop/mobile. Seluruh 111 pengujian otomatis lulus.

### Suasana kedai dan penyajian dengan jeda

- Sisa waktu Challenge tetap terlihat sebagai angka kecil di samping ikon pesanan, termasuk saat kartu ditutup. Angka mengikuti deadline yang sama; selama penyajian, reaksi pelanggan, dan kamera kembali, waktu meracik dibekukan.
- Ikon suasana dan tombol di menu utama membuka pilihan Pagi cerah, Sore hangat, Malam tenang, dan Hujan malam. Pilihan tersimpan lokal. Cahaya 3D, warna taman, intensitas pantulan, dan lentera beralih perlahan; hujan dirender di luar jendela. Reduced motion menghentikan rintik dan mempercepat pergantian cahaya.
- Gelas diangkat sedikit lalu diletakkan di tatakan sebelum bergeser ke pelanggan. Kamera mengikuti perjalanan, potret serta bintang pelanggan bereaksi selama lima detik, kemudian kamera kembali ke posisi meja yang disimpan. Racikan yang diterima tetap di depan pelanggan; racikan yang perlu diperbaiki kembali ke posisi kerja.
- Setelah kamera kembali, tombol ringkas menyediakan Detail racikan dan Pelanggan berikutnya / Lihat rangkuman / Lanjut meracik. Mode Cozy menyediakan Buat Ulang. Detail hasil tetap tersedia tanpa membuka dialog otomatis yang menutup meja.

### Ambience mengikuti suasana

Pagi cerah memakai kicau burung dan angin lembut; sore menghadirkan burung yang lebih jarang serta gemerisik daun; malam tenang memakai jangkrik jauh dan angin; Hujan malam menghadirkan rintik di luar jendela. Semua lapisan alam disintesis secara lokal, dengan stereo sempit, volume awal 28%, sambungan loop halus, dan perpindahan suasana sekitar tiga detik. Tidak ada rekaman atau dependensi eksternal baru.

Panel Suasana suara memiliki volume serta mute terpisah untuk Musik latar, Ambience kedai, dan Efek suara. Nama ambience mengikuti suasana aktif. Preferensi tersimpan lokal, termasuk menghormati pengaturan senyap dari versi lama. Senyapkan semua/Pulihkan suara mempertahankan campuran sebelumnya. Audio baru dimulai setelah interaksi pemain, mereda ketika tab kehilangan fokus, dan kembali lembut saat aktif. Ambience tetap berjalan saat penyajian, hasil, dan bantuan dibuka.

`dist/ambience-textures.js` membentuk empat loop stereo; `dist/ambience-player.js` mengatur transisi dan volume melalui jalur tersendiri. Buffer hanya dibuat untuk suasana yang dikunjungi, maksimal empat, lalu dipakai kembali ketika berpindah atau mute. Pengujian meliputi batas amplitudo, sambungan loop, perbedaan suasana, kemandirian volume, perubahan cepat, mute, jeda, pemulihan konteks, dan migrasi preferensi. Seluruh 121 pengujian otomatis lulus. Panel diperiksa di browser desktop dan 320 × 568; preferensi dan pemulihan tiga kanal diverifikasi melalui kontrol nyata.

### Warna susu dan tuangan dari samping

Fresh Milk berwarna putih bersih, Oat Milk krem pucat, dan Almond Milk krem lebih hangat. Warna berlaku pada aliran tuang, sisi serta permukaan cairan, hasil pencampuran latte, dan batas cairan di bawah cloud. Campuran beberapa susu memakai perbandingan volume susu yang benar-benar masuk; memilih karton lain tidak mengubah warna isi gelas sebelumnya.

Saat menuang, karton berada di kanan gelas dan miring ke dalam, dengan mulut tetap terhubung ke aliran susu. Kamera aksi membingkai gelas dan karton dari samping; pandangan meja tetap sama. Ketiga jenis susu serta pandangan desktop dan 390 × 844 diperiksa melalui browser. Tujuh pemeriksaan terkait varian susu, aliran/riak, kamera, cloud, dan pencampuran lulus.
