// Semua angka yang mungkin perlu disetel ada di sini.

const DEFAULT_STUN = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
];

// Untuk uji dan debug: ?stun=none mematikan STUN, ?stun=stun:host:3478,stun:lain:3478 menggantinya.
function stunFromUrl() {
  try {
    const v = new URLSearchParams(globalThis.location?.search ?? '').get('stun');
    if (v === null) return null;
    if (v === 'none') return [];
    return v.split(',').filter((s) => /^stuns?:/.test(s));
  } catch {
    return null;
  }
}

export const config = {
  stunServers: stunFromUrl() ?? DEFAULT_STUN,

  // Menunggu pengumpulan kandidat jaringan. Selesai lebih awal bila semua kandidat sudah ada.
  gatherTimeoutMs: 4000,
  // Setelah kandidat srflx pertama muncul, beri waktu sebentar untuk kandidat lain.
  gatherGraceMs: 600,
  // Target PRD: tersambung dalam 30 detik setelah scan kedua.
  connectTimeoutMs: 30000,

  chunkSize: 16 * 1024, // aman untuk Chrome, Firefox, dan Safari
  bufferHigh: 1024 * 1024, // jeda kirim bila antrean kirim lebih dari ini
  bufferLow: 256 * 1024, // lanjut kirim bila antrean turun ke sini

  // Batas awal. PRD: tetapkan dari uji di HP kelas menengah, lalu sesuaikan.
  maxFileBytes: 500 * 1024 * 1024,
  // Penerima menyatukan potongan ke Blob tiap sekian byte supaya tidak menumpuk sebagai array kecil.
  receiveFlushBytes: 32 * 1024 * 1024,

  scanIntervalMs: 120,
};

// Jenis file yang bisa menjalankan kode bila dibuka. Hanya dipakai untuk peringatan.
export const RISKY_EXTENSIONS = [
  'apk', 'xapk', 'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'js', 'jar',
  'sh', 'dmg', 'pkg', 'app', 'lnk', 'iso', 'reg', 'hta', 'dll',
];
