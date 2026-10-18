# NvanPass

Kirim file antar perangkat lewat WebRTC, langsung dari browser ke browser. Dua perangkat terhubung dengan dua kali scan QR (atau salin-tempel kode), lalu file mengalir tanpa lewat server mana pun. Situs ini statis dan bisa dihosting gratis di GitHub Pages.

Spesifikasi produk ada di PRD "Kirim File Antar Perangkat Tanpa Server".

## Cara kerja

1. **Pengirim** memilih file dan membuat *kode tawaran* (QR + teks + tautan).
2. **Penerima** memindai QR itu (atau menempel kode / membuka tautan) dan mendapat *kode jawaban*.
3. **Pengirim** memindai atau menempel kode jawaban. Browser mencari jalur langsung, saluran data terbuka.
4. **Penerima** melihat nama, ukuran, dan jenis file, lalu menekan Terima. File dikirim per potongan 16 KiB dengan kontrol antrean (`bufferedAmount`), lalu bisa disimpan lewat tombol Simpan file.

Tidak ada server sinyal. Pertukaran kode itulah sinyalnya. Server STUN publik hanya membantu perangkat menemukan alamat internetnya.

### Kode koneksi

SDP WebRTC asli sekitar 1 KB teks, terlalu besar untuk QR yang nyaman dipindai. `js/codec.js` hanya membawa yang dibutuhkan satu data channel (ice-ufrag, ice-pwd, sidik jari DTLS SHA-256, maksimal 8 kandidat UDP) dalam format biner, ditambah CRC-16, lalu base64url. Hasilnya sekitar 200 karakter dan muat di satu QR. Kode yang terpotong atau salah salin ketahuan lewat CRC.

## Menjalankan

```bash
npm start            # http://localhost:8080, kamera jalan di localhost
npm test             # tes unit: codec dan protokol transfer (Node 20+, tanpa dependensi)
npm install && npm run test:e2e   # dua browser sungguhan lewat Playwright (butuh ffmpeg untuk uji kamera)
```

Parameter debug: `?stun=none` mematikan STUN, `?stun=stun:host:3478,...` menggantinya.

## Deploy ke GitHub Pages

Di repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Setiap push ke `main` menjalankan tes lalu mengunggah situs lewat `.github/workflows/pages.yml`. Alamatnya `https://nopanpeno.github.io/NvanPass/`.

## Struktur

| Berkas | Isi |
| --- | --- |
| `index.html`, `css/style.css` | Satu halaman, semua layar |
| `js/app.js` | Alur layar, kamera, peringatan privasi, Wake Lock |
| `js/rtc.js` | `RTCPeerConnection` dan pertukaran kode manual, deteksi gagal/timeout |
| `js/codec.js` | SDP ⇄ kode ringkas (murni, bisa diuji di Node) |
| `js/transfer.js` | Protokol kirim file, konfirmasi penerima, antrean kirim |
| `js/qr.js` | Menggambar dan memindai QR |
| `js/config.js` | Server STUN, batas ukuran, timeout |
| `js/i18n.js` | Teks Indonesia dan Inggris |
| `vendor/` | qrcode-generator (MIT) dan jsQR (Apache-2.0), tanpa perubahan |

## Lisensi

Kode NvanPass berlisensi [MIT](LICENSE). Pustaka pihak ketiga di `vendor/` memiliki lisensi masing-masing; lihat [vendor/README.md](vendor/README.md).

## Status terhadap PRD

| Fitur | Status |
| --- | --- |
| P0: pilih file, QR tawaran/jawaban, scan kamera, salin-tempel, konfirmasi penerima, progres, pesan error, bagikan lewat link + peringatan privasi | Selesai |
| P1: bahasa Indonesia dan Inggris, Wake Lock | Selesai |
| P1: banyak file sekaligus (antrean), kirim teks atau link, PWA | Belum |
| P2: tulis langsung ke disk, server relay (TURN) | Belum |

Pengirim bisa mengirim file satu per satu selama koneksi masih terbuka.

## Pengujian di perangkat nyata

Uji manual yang dilaporkan berhasil: Android ke Android dan Android ke laptop, baik melalui Wi-Fi yang sama maupun jaringan berbeda. Model perangkat, browser, dan ukuran file belum dicatat, jadi hasil ini belum menjadi validasi kompatibilitas menyeluruh.

Hal yang masih perlu diuji atau dicatat:

- Model perangkat dan versi browser yang dipakai, ukuran file, waktu koneksi, serta apakah file hasil transfer cocok.
- iOS Safari, termasuk pemindaian kamera dan cara menyimpan file. iPhone belum diuji.
- Batas ukuran file (`maxFileBytes` di `js/config.js`, sementara 500 MB) di HP kelas menengah. Penerima menampung file di memori, jadi batas ini perlu divalidasi.
- Perilaku kandidat jaringan: browser modern menyembunyikan IP lokal di balik nama mDNS (`xxxx.local`). Resolusinya antar perangkat di satu Wi-Fi perlu dicek, terutama Android ke iOS.
- Transfer saat layar mati atau tab berpindah, terutama di iOS.
