// Teks antarmuka. Bahasa Indonesia adalah bawaan, Inggris tersedia lewat tombol bahasa.

const STR = {
  id: {
    'app.name': 'NvanPass',
    'lang.switch': 'English',
    'lang.switch.label': 'Switch to English',
    'common.back': 'Kembali',
    'common.cancel': 'Batal',
    'common.copy': 'Salin kode',
    'common.copied': 'Tersalin',
    'common.restart': 'Mulai lagi',
    'noscript': 'NvanPass butuh JavaScript untuk menghubungkan dua perangkat.',

    'home.title': 'Kirim file antar perangkat, tanpa kabel dan tanpa akun',
    'home.lead': 'Hubungkan dua perangkat dengan QR, lalu kirim. File berpindah langsung dari browser ke browser dan tidak pernah lewat server kami.',
    'home.send': 'Kirim file',
    'home.send.sub': 'Pilih file, lalu tunjukkan QR ke perangkat lain',
    'home.receive': 'Terima file',
    'home.receive.sub': 'Pindai QR dari pengirim atau tempel kodenya',
    'home.note': 'Kedua perangkat harus tetap membuka halaman ini selama transfer.',
    'footer.privacy': 'Soal privasi',
    'footer.tag': 'Tanpa akun, tanpa pelacak.',

    'pick.title': 'Pilih file yang mau dikirim',
    'pick.button': 'Pilih file',
    'pick.drop': 'atau seret file ke sini',
    'pick.change': 'Ganti file',
    'pick.next': 'Buat kode koneksi',
    'pick.toobig': 'File ini {size}, melebihi batas {max}. Pilih file yang lebih kecil.',

    'offer.step1': 'Langkah 1 dari 2',
    'offer.title1': 'Tunjukkan QR ini ke penerima',
    'offer.hint': 'Di perangkat penerima, buka halaman ini, pilih Terima file, lalu pindai QR. Kamera bawaan HP juga bisa membuka tautannya.',
    'offer.ticket': 'Kode tawaran',
    'offer.preparing': 'Menyiapkan koneksi…',
    'offer.share': 'Bagikan tautan',
    'offer.qr.alt': 'QR kode tawaran',
    'offer.step2': 'Langkah 2 dari 2',
    'offer.title2': 'Masukkan jawaban dari penerima',
    'offer.scan': 'Buka kamera',
    'offer.paste.label': 'Atau tempel kode jawaban',
    'offer.paste.btn': 'Sambungkan',
    'offer.connecting': 'Menyambungkan… biasanya kurang dari 30 detik.',

    'recv.title': 'Terima file',
    'recv.scan': 'Pindai QR dari pengirim',
    'recv.paste.label': 'Atau tempel kode atau tautan dari pengirim',
    'recv.paste.btn': 'Lanjut',

    'answer.title': 'Tunjukkan QR ini ke pengirim',
    'answer.hint': 'Di perangkat pengirim, tekan Buka kamera lalu pindai QR ini. Koneksi terbuka otomatis setelahnya.',
    'answer.ticket': 'Kode jawaban',
    'answer.preparing': 'Menyiapkan jawaban…',
    'answer.share': 'Bagikan kode',
    'answer.qr.alt': 'QR kode jawaban',
    'answer.waiting': 'Menunggu pengirim memindai. Tetap buka halaman ini.',
    'answer.connecting': 'Menyambungkan…',

    'scan.title': 'Arahkan kamera ke QR',
    'scan.close': 'Tutup kamera',
    'scan.notours': 'QR itu bukan dari NvanPass. Coba QR yang lain.',
    'scan.starting': 'Membuka kamera…',
    'cam.denied': 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau tempel kodenya.',
    'cam.none': 'Kamera tidak ditemukan. Tempel kodenya sebagai gantinya.',
    'cam.insecure': 'Kamera hanya bisa dipakai di halaman HTTPS. Tempel kodenya sebagai gantinya.',
    'cam.error': 'Kamera tidak bisa dibuka. Tempel kodenya sebagai gantinya.',

    'code.empty': 'Tempel kodenya dulu.',
    'code.format': 'Kode tidak dikenali. Pastikan kode disalin utuh, dimulai dengan nvp1.',
    'code.checksum': 'Kode ada yang terpotong atau salah salin. Salin ulang seluruhnya.',
    'code.version': 'Kode berasal dari versi NvanPass yang berbeda. Muat ulang halaman di kedua perangkat.',
    'code.unsupported': 'Browser di perangkat lawan memakai pengamanan yang belum didukung.',
    'code.expected-answer': 'Ini kode tawaran. Di sini dibutuhkan kode jawaban dari penerima.',
    'code.expected-offer': 'Ini kode jawaban. Penerima perlu memakai kode tawaran dari pengirim.',
    'code.invalid': 'Kode ini tidak bisa dipakai. Mulai lagi dari awal di kedua perangkat.',

    'warn.title': 'Kode ini berisi alamat IP jaringanmu',
    'warn.body': 'Siapa pun yang menerima kode atau tautan ini bisa melihat alamat IP perangkatmu. Bagikan hanya ke orang yang kamu kenal. Untuk perangkat yang berdekatan, QR lebih aman.',
    'warn.ok': 'Paham, bagikan',
    'share.copied': 'Tersalin. Tempel di chat.',
    'share.copyfail': 'Tidak bisa menyalin otomatis. Salin kode secara manual.',

    'xfer.connected': 'Tersambung',
    'xfer.keep': 'Biarkan layar menyala dan tetap di halaman ini sampai selesai.',
    'xfer.waitaccept': 'Menunggu penerima menyetujui {name}…',
    'xfer.sending': 'Mengirim {name}',
    'xfer.sent': 'Terkirim: {name}',
    'xfer.another': 'Kirim file lain',
    'xfer.finish': 'Selesai',
    'xfer.cancel': 'Batalkan',
    'xfer.rejected.declined': 'Penerima menolak file ini.',
    'xfer.rejected.too-big': 'File terlalu besar untuk perangkat penerima.',
    'xfer.rejected.busy': 'Penerima masih mengurus file lain.',
    'xfer.cancelled': 'Transfer dibatalkan.',
    'xfer.peerleft': 'Perangkat lain menutup koneksi.',
    'xfer.waitfile': 'Menunggu pengirim memilih file…',
    'incoming.title': 'Ada file masuk',
    'incoming.name': 'Nama',
    'incoming.size': 'Ukuran',
    'incoming.type': 'Jenis',
    'incoming.type.none': 'Tidak diketahui',
    'incoming.accept': 'Terima',
    'incoming.decline': 'Tolak',
    'incoming.hint': 'File belum diunduh. Kamu yang memutuskan.',
    'incoming.risky': 'File .{ext} bisa menjalankan program di perangkatmu. Terima hanya bila kamu kenal pengirimnya dan memang menunggu file ini.',
    'xfer.receiving': 'Menerima {name}',
    'xfer.received': 'File diterima',
    'xfer.save': 'Simpan file',
    'xfer.received.hint': 'File tidak dibuka otomatis. Periksa dulu sebelum membukanya.',
    'progress.line': '{pct} · {done} dari {total}',
    'progress.speed': '{speed}/dtk',

    'err.title.no-candidates': 'Tidak ada jalur jaringan',
    'err.body.no-candidates': 'Browser tidak menemukan alamat jaringan untuk dipakai. Biasanya karena perangkat tidak terhubung ke internet atau jaringan memblokir koneksi langsung.',
    'err.title.ice': 'Dua perangkat tidak bisa saling terhubung',
    'err.body.ice': 'Jaringan memblokir koneksi langsung antar perangkat. Ini sering terjadi di data seluler, Wi-Fi kantor atau kampus, atau saat VPN menyala. Kami tidak memakai server perantara, jadi file tidak pernah singgah di server.',
    'err.title.timeout': 'Koneksi tidak terbentuk dalam 30 detik',
    'err.body.timeout': 'Kode mungkin belum dimasukkan di perangkat lain, atau jaringan menahan koneksi langsung.',
    'err.title.lost': 'Koneksi terputus',
    'err.body.lost': 'Layar mati, pindah tab, atau sinyal hilang bisa memutus transfer. File yang sedang dikirim tidak tersimpan di penerima.',
    'err.title.unsupported': 'Browser ini belum didukung',
    'err.body.unsupported': 'NvanPass butuh WebRTC. Pakai Chrome atau Safari versi terbaru.',
    'err.title.incomplete': 'File tidak lengkap',
    'err.body.incomplete': 'Jumlah data yang sampai tidak sama dengan ukuran file. Kirim ulang filenya.',
    'err.title.overflow': 'Data tidak cocok dengan ukuran file',
    'err.body.overflow': 'Perangkat lawan mengirim lebih banyak data dari yang dijanjikan, jadi transfer dihentikan.',
    'err.title.read': 'File tidak bisa dibaca',
    'err.body.read': 'File mungkin dipindah atau diubah saat dikirim. Pilih ulang filenya.',
    'err.tips.title': 'Yang bisa dicoba',
    'err.tip.1': 'Sambungkan kedua perangkat ke Wi-Fi yang sama.',
    'err.tip.2': 'Atau nyalakan hotspot di salah satu HP dan sambungkan perangkat lain ke sana.',
    'err.tip.3': 'Matikan VPN di kedua perangkat.',
    'err.tip.4': 'Mulai lagi dari awal. Kode yang lama tidak bisa dipakai ulang.',
  },

  en: {
    'app.name': 'NvanPass',
    'lang.switch': 'Bahasa Indonesia',
    'lang.switch.label': 'Ganti ke Bahasa Indonesia',
    'common.back': 'Back',
    'common.cancel': 'Cancel',
    'common.copy': 'Copy code',
    'common.copied': 'Copied',
    'common.restart': 'Start over',
    'noscript': 'NvanPass needs JavaScript to connect two devices.',

    'home.title': 'Send files between devices, no cable and no account',
    'home.lead': 'Link two devices with a QR code, then send. Files travel straight from browser to browser and never pass through our servers.',
    'home.send': 'Send a file',
    'home.send.sub': 'Pick a file, then show the QR to the other device',
    'home.receive': 'Receive a file',
    'home.receive.sub': 'Scan the sender’s QR or paste their code',
    'home.note': 'Both devices must keep this page open during the transfer.',
    'footer.privacy': 'About privacy',
    'footer.tag': 'No account, no trackers.',

    'pick.title': 'Choose the file to send',
    'pick.button': 'Choose file',
    'pick.drop': 'or drag a file here',
    'pick.change': 'Change file',
    'pick.next': 'Create connection code',
    'pick.toobig': 'This file is {size}, over the {max} limit. Choose a smaller file.',

    'offer.step1': 'Step 1 of 2',
    'offer.title1': 'Show this QR to the receiver',
    'offer.hint': 'On the receiving device, open this page, choose Receive a file, then scan the QR. A phone’s built-in camera can also open the link.',
    'offer.ticket': 'Offer code',
    'offer.preparing': 'Preparing the connection…',
    'offer.share': 'Share link',
    'offer.qr.alt': 'QR of the offer code',
    'offer.step2': 'Step 2 of 2',
    'offer.title2': 'Enter the receiver’s reply',
    'offer.scan': 'Open camera',
    'offer.paste.label': 'Or paste the reply code',
    'offer.paste.btn': 'Connect',
    'offer.connecting': 'Connecting… usually under 30 seconds.',

    'recv.title': 'Receive a file',
    'recv.scan': 'Scan the sender’s QR',
    'recv.paste.label': 'Or paste the code or link from the sender',
    'recv.paste.btn': 'Continue',

    'answer.title': 'Show this QR to the sender',
    'answer.hint': 'On the sender’s device, tap Open camera and scan this QR. The connection opens by itself afterwards.',
    'answer.ticket': 'Reply code',
    'answer.preparing': 'Preparing the reply…',
    'answer.share': 'Share code',
    'answer.qr.alt': 'QR of the reply code',
    'answer.waiting': 'Waiting for the sender to scan. Keep this page open.',
    'answer.connecting': 'Connecting…',

    'scan.title': 'Point the camera at the QR',
    'scan.close': 'Close camera',
    'scan.notours': 'That QR is not from NvanPass. Try another one.',
    'scan.starting': 'Opening camera…',
    'cam.denied': 'Camera permission was denied. Allow the camera in browser settings, or paste the code.',
    'cam.none': 'No camera found. Paste the code instead.',
    'cam.insecure': 'The camera only works on HTTPS pages. Paste the code instead.',
    'cam.error': 'The camera could not be opened. Paste the code instead.',

    'code.empty': 'Paste the code first.',
    'code.format': 'Code not recognised. Make sure it was copied in full and starts with nvp1.',
    'code.checksum': 'Part of the code is missing or mistyped. Copy the whole code again.',
    'code.version': 'The code comes from a different NvanPass version. Reload the page on both devices.',
    'code.unsupported': 'The other device’s browser uses a security setting that is not supported yet.',
    'code.expected-answer': 'This is an offer code. A reply code from the receiver is needed here.',
    'code.expected-offer': 'This is a reply code. The receiver needs the sender’s offer code.',
    'code.invalid': 'This code cannot be used. Start over on both devices.',

    'warn.title': 'This code contains your network’s IP address',
    'warn.body': 'Anyone who gets this code or link can see your device’s IP address. Share it only with people you know. For devices that are close together, the QR is safer.',
    'warn.ok': 'Got it, share',
    'share.copied': 'Copied. Paste it in a chat.',
    'share.copyfail': 'Could not copy automatically. Copy the code by hand.',

    'xfer.connected': 'Connected',
    'xfer.keep': 'Keep the screen on and stay on this page until it finishes.',
    'xfer.waitaccept': 'Waiting for the receiver to accept {name}…',
    'xfer.sending': 'Sending {name}',
    'xfer.sent': 'Sent: {name}',
    'xfer.another': 'Send another file',
    'xfer.finish': 'Done',
    'xfer.cancel': 'Cancel',
    'xfer.rejected.declined': 'The receiver declined this file.',
    'xfer.rejected.too-big': 'The file is too large for the receiving device.',
    'xfer.rejected.busy': 'The receiver is still handling another file.',
    'xfer.cancelled': 'The transfer was cancelled.',
    'xfer.peerleft': 'The other device closed the connection.',
    'xfer.waitfile': 'Waiting for the sender to pick a file…',
    'incoming.title': 'Incoming file',
    'incoming.name': 'Name',
    'incoming.size': 'Size',
    'incoming.type': 'Type',
    'incoming.type.none': 'Unknown',
    'incoming.accept': 'Accept',
    'incoming.decline': 'Decline',
    'incoming.hint': 'Nothing has been downloaded yet. You decide.',
    'incoming.risky': 'A .{ext} file can run programs on your device. Accept it only if you know the sender and were expecting this file.',
    'xfer.receiving': 'Receiving {name}',
    'xfer.received': 'File received',
    'xfer.save': 'Save file',
    'xfer.received.hint': 'The file is not opened automatically. Check it before you open it.',
    'progress.line': '{pct} · {done} of {total}',
    'progress.speed': '{speed}/s',

    'err.title.no-candidates': 'No network route found',
    'err.body.no-candidates': 'The browser found no network address to use. Usually the device is offline or the network blocks direct connections.',
    'err.title.ice': 'The two devices could not connect',
    'err.body.ice': 'The network blocks direct connections between devices. This is common on mobile data, office or campus Wi-Fi, or with a VPN on. We use no relay server, so your file never stops at a server.',
    'err.title.timeout': 'No connection within 30 seconds',
    'err.body.timeout': 'The code may not have been entered on the other device yet, or the network is holding back direct connections.',
    'err.title.lost': 'Connection lost',
    'err.body.lost': 'A screen turning off, switching tabs, or losing signal can break a transfer. A file that was in progress is not kept on the receiver.',
    'err.title.unsupported': 'This browser is not supported',
    'err.body.unsupported': 'NvanPass needs WebRTC. Use a recent Chrome or Safari.',
    'err.title.incomplete': 'The file is incomplete',
    'err.body.incomplete': 'The amount of data that arrived does not match the file size. Send the file again.',
    'err.title.overflow': 'Data does not match the file size',
    'err.body.overflow': 'The other device sent more data than it promised, so the transfer was stopped.',
    'err.title.read': 'The file could not be read',
    'err.body.read': 'The file may have been moved or changed while sending. Choose it again.',
    'err.tips.title': 'What to try',
    'err.tip.1': 'Put both devices on the same Wi-Fi.',
    'err.tip.2': 'Or turn on a hotspot on one phone and join it from the other device.',
    'err.tip.3': 'Turn off any VPN on both devices.',
    'err.tip.4': 'Start over from the beginning. An old code cannot be reused.',
  },
};

let lang = 'id';

export function initLang() {
  let saved = null;
  try {
    saved = localStorage.getItem('nvanpass.lang');
  } catch {
    /* penyimpanan diblokir */
  }
  const guess = (navigator.language || 'id').toLowerCase().startsWith('id') ? 'id' : 'en';
  lang = saved === 'en' || saved === 'id' ? saved : guess;
  document.documentElement.lang = lang;
  return lang;
}

export function getLang() {
  return lang;
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'id';
  document.documentElement.lang = lang;
  try {
    localStorage.setItem('nvanpass.lang', lang);
  } catch {
    /* penyimpanan diblokir */
  }
}

export function t(key, vars = {}) {
  const s = STR[lang][key] ?? STR.id[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

export function hasKey(key) {
  return key in STR.id;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-alt]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAlt)));
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
}

export function formatBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : v < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)} ${units[i]}`;
}
