// Uji end-to-end: dua browser sungguhan, saling terhubung lewat kode, lalu kirim file.
// Jalankan: npm run test:e2e   (butuh Chromium milik Playwright dan ffmpeg untuk uji kamera)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    const file = join(root, path === '/' ? 'index.html' : path);
    if (!file.startsWith(root)) throw new Error('keluar root');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/?stun=none`;

const ARGS = ['--disable-features=WebRtcHideLocalIpsWithMdns', '--use-fake-ui-for-media-stream'];
const launch = (extra = []) => chromium.launch({ args: [...ARGS, ...extra] });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    console.error(`  GAGAL ${name}\n${e.stack}`);
    process.exitCode = 1;
    throw e;
  }
}

const visible = (page, sel, timeout = 15000) => page.locator(sel).waitFor({ state: 'visible', timeout });
const text = (page, sel) => page.locator(sel).innerText();

async function newPage(browser, errors) {
  const ctx = await browser.newContext({ locale: 'id-ID', acceptDownloads: true, viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  return page;
}

async function startSending(page, file) {
  await page.click('#go-send');
  await page.setInputFiles('#file-input', file);
  await page.click('#pick-next');
  await visible(page, '#offer-code');
  return (await text(page, '#offer-code')).trim();
}

const errors = [];
const browser = await launch();
let cameraBrowser;
try {
  const payload = randomBytes(1_500_000 + 77);
  let A, B, offer, answer;

  await step('beranda tampil dalam bahasa Indonesia', async () => {
    A = await newPage(browser, errors);
    await visible(A, '#go-send');
    assert.match(await text(A, 'h1:visible'), /Kirim file antar perangkat/);
  });

  await step('pengirim membuat kode tawaran dan QR yang bisa dibaca ulang', async () => {
    offer = await startSending(A, { name: 'foto-liburan.jpg', mimeType: 'image/jpeg', buffer: payload });
    assert.match(offer, /^nvp1\./);
    assert.ok(offer.length < 320, `kode ${offer.length} karakter`);
    const decoded = await A.evaluate(async () => {
      const { decodeCanvas } = await import('./js/qr.js');
      return decodeCanvas(document.getElementById('offer-qr'));
    });
    assert.ok(decoded.includes(`#o=${offer}`), 'QR tawaran harus berisi tautan dengan kode yang sama');
  });

  await step('penerima menempel kode lalu mendapat kode jawaban', async () => {
    B = await newPage(browser, errors);
    await B.click('#go-recv');
    await B.fill('#recv-paste', `Nih kodenya bro:\n${offer}`);
    await B.click('#recv-paste-btn');
    await visible(B, '#answer-code');
    answer = (await text(B, '#answer-code')).trim();
    assert.match(answer, /^nvp1\./);
  });

  await step('kode yang salah ditolak dengan pesan jelas', async () => {
    await A.fill('#offer-paste', offer); // kode tawaran, bukan jawaban
    await A.click('#offer-paste-btn');
    await visible(A, '#offer-error');
    assert.match(await text(A, '#offer-error'), /kode tawaran/i);
    await A.fill('#offer-paste', answer.slice(0, -4) + 'AAAA');
    await A.click('#offer-paste-btn');
    assert.match(await text(A, '#offer-error'), /terpotong|salah salin|tidak dikenali/i);
  });

  const t0 = Date.now();
  await step('pengirim menempel jawaban, kedua sisi tersambung', async () => {
    await A.fill('#offer-paste', answer);
    await A.click('#offer-paste-btn');
    await visible(A, '.badge');
    await visible(B, '.badge');
    console.log(`       tersambung ${Date.now() - t0} ms setelah jawaban dimasukkan`);
  });

  await step('penerima melihat konfirmasi (nama, ukuran, jenis) sebelum unduh', async () => {
    await visible(B, '#xfer-incoming');
    assert.equal(await text(B, '#in-name'), 'foto-liburan.jpg');
    assert.match(await text(B, '#in-size'), /1,4 MB|1\.4 MB/);
    assert.match(await text(B, '#in-type'), /\.jpg/);
    assert.ok(await B.locator('#save-link').isHidden());
    assert.ok(await B.locator('#in-risky').isHidden());
  });

  await step('terima: file sampai utuh (hash sama) dan tidak diunduh otomatis', async () => {
    await B.click('#in-accept');
    await visible(B, '#save-link');
    const [dl] = await Promise.all([B.waitForEvent('download'), B.click('#save-link')]);
    assert.equal(dl.suggestedFilename(), 'foto-liburan.jpg');
    const got = await readFile(await dl.path());
    assert.equal(got.length, payload.length);
    assert.equal(sha(got), sha(payload));
    await A.getByText('Terkirim: foto-liburan.jpg').waitFor({ timeout: 10000 });
  });

  await step('kirim file kedua: .apk memunculkan peringatan, tolak membuat pengirim tahu', async () => {
    const [chooser] = await Promise.all([A.waitForEvent('filechooser'), A.click('#send-another')]);
    await chooser.setFiles({ name: 'update.apk', mimeType: 'application/vnd.android.package-archive', buffer: Buffer.from('PK-bukan-apk') });
    await visible(B, '#xfer-incoming');
    await visible(B, '#in-risky');
    assert.match(await text(B, '#in-risky'), /\.apk/);
    await B.click('#in-decline');
    await A.getByText('Penerima menolak file ini.').waitFor({ timeout: 10000 });
    assert.ok(await A.locator('#send-another').isVisible());
  });

  await step('pengirim keluar: penerima tetap bisa menyimpan file yang sudah diterima', async () => {
    const [chooser] = await Promise.all([A.waitForEvent('filechooser'), A.click('#send-another')]);
    await chooser.setFiles({ name: 'catatan.txt', buffer: Buffer.from('halo dari HP') });
    await visible(B, '#xfer-incoming');
    await B.click('#in-accept');
    await visible(B, '#save-link');
    await A.click('#xfer-finish');
    await B.getByText('Perangkat lain menutup koneksi.').waitFor({ timeout: 15000 });
    assert.ok(await B.locator('#save-link').isVisible(), 'tombol simpan harus tetap ada');
    assert.ok(await B.locator('[data-screen="error"]').isHidden());
  });

  await step('tautan #o= langsung membuka alur penerima', async () => {
    const A2 = await newPage(browser, errors);
    const code = await startSending(A2, { name: 'a.txt', buffer: Buffer.from('x') });
    const C = await newPage(browser, errors);
    await C.goto(`${BASE}#o=${code}`);
    await visible(C, '#answer-code');
    assert.ok(!C.url().includes('#o='), 'kode dibersihkan dari URL');
    await C.context().close();
    await A2.context().close();
  });

  await step('bahasa Inggris bisa dipilih dan layar memperbarui teksnya', async () => {
    const P = await newPage(browser, errors);
    await P.click('#lang-btn');
    assert.match(await text(P, 'h1:visible'), /Send files between devices/);
    await P.reload();
    assert.match(await text(P, 'h1:visible'), /Send files between devices/, 'pilihan bahasa tersimpan');
    await P.context().close();
  });

  await step('kode kosong dan kode ngawur menampilkan pesan, bukan diam', async () => {
    const P = await newPage(browser, errors);
    await P.click('#go-recv');
    await P.click('#recv-paste-btn');
    assert.match(await text(P, '#recv-error'), /Tempel kodenya/);
    await P.fill('#recv-paste', 'hello world');
    await P.click('#recv-paste-btn');
    assert.match(await text(P, '#recv-error'), /tidak dikenali/);
    await P.context().close();
  });

  await step('kamera: penerima memindai QR tawaran lewat video kamera palsu', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nvanpass-'));
    const P0 = await newPage(browser, errors);
    const code = await startSending(P0, { name: 'kamera.txt', buffer: Buffer.from('lewat kamera') });
    const png = join(dir, 'qr.png');
    await writeFile(png, await P0.locator('#offer-qr').screenshot());
    const y4m = join(dir, 'qr.y4m');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-i', png, '-t', '2', '-r', '10',
      '-vf', 'scale=460:460:flags=neighbor,pad=640:480:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p', y4m]);
    cameraBrowser = await launch(['--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`]);
    const R = await newPage(cameraBrowser, errors);
    await R.click('#go-recv');
    await R.click('#recv-scan');
    await visible(R, '#answer-code', 20000);
    const ans = (await text(R, '#answer-code')).trim();
    await P0.fill('#offer-paste', ans);
    await P0.click('#offer-paste-btn');
    await visible(R, '#xfer-incoming');
    await R.click('#in-accept');
    await visible(R, '#save-link');
    await P0.context().close();
  });

  await step('izin kamera ditolak: pesan jelas dan jalur tempel kode tetap ada', async () => {
    const noCam = await browser.newContext({ locale: 'id-ID' });
    await noCam.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    });
    const P = await noCam.newPage();
    await P.goto(BASE);
    await P.click('#go-recv');
    await P.click('#recv-scan');
    await visible(P, '#recv-error');
    assert.match(await text(P, '#recv-error'), /Izin kamera ditolak/);
    assert.ok(await P.locator('#recv-paste').isVisible());
    await noCam.close();
  });

  await step('tanpa galat JavaScript di konsol', async () => {
    assert.deepEqual(errors.filter((e) => !/Failed to load resource/.test(e)), []);
  });
  console.log(`\n${passed} langkah lolos`);
} finally {
  await browser.close();
  await cameraBrowser?.close();
  server.close();
}
