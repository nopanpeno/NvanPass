// QR: menggambar kode ke canvas dan memindai lewat kamera.
// Pustaka qrcode-generator dan jsQR dimuat sebagai skrip klasik (lihat index.html).
import { config } from './config.js';

export function renderQr(canvas, text) {
  const qr = globalThis.qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 3;
  const px = Math.max(4, Math.ceil(320 / (n + quiet * 2)));
  const size = (n + quiet * 2) * px;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#10243a';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
    }
  }
  return n;
}

// Mengembalikan 'denied' | 'no-camera' | 'insecure' | 'error'
export function classifyCameraError(err) {
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) return 'insecure';
  const name = err?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'no-camera';
  return 'error';
}

export class Scanner {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.timer = null;
    this.running = false;
    this.canvas = document.createElement('canvas');
  }

  async start(onText) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error('no mediaDevices');
      e.name = 'SecurityError';
      throw e;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false,
    });
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      const text = this._scanFrame();
      if (text) onText(text);
      this.timer = setTimeout(tick, config.scanIntervalMs);
    };
    tick();
  }

  _scanFrame() {
    const v = this.video;
    if (v.readyState < 2 || !v.videoWidth) return null;
    const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const res = globalThis.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    return res?.data || null;
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}

// Untuk uji: baca QR dari canvas yang sudah digambar.
export function decodeCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return globalThis.jsQR(img.data, img.width, img.height)?.data ?? null;
}
