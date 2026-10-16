import test from 'node:test';
import assert from 'node:assert/strict';
import { Session, sanitizeName, extensionOf } from '../js/transfer.js';
import { config } from '../js/config.js';

// Dua ujung saluran palsu: terurut, andal, dengan antrean kirim yang menyusut bertahap.
function channelPair() {
  const mk = () => ({
    readyState: 'open', bufferedAmount: 0, onmessage: null, peer: null, _l: {},
    addEventListener(n, f) { (this._l[n] ??= new Set()).add(f); },
    removeEventListener(n, f) { this._l[n]?.delete(f); },
    emit(n) { [...(this._l[n] ?? [])].forEach((f) => f()); },
    send(d) {
      const size = typeof d === 'string' ? d.length : d.byteLength;
      this.bufferedAmount += size;
      setTimeout(() => {
        this.bufferedAmount -= size;
        if (this.bufferedAmount <= config.bufferLow) this.emit('bufferedamountlow');
        this.peer.onmessage?.({ data: d });
      }, 0);
    },
  });
  const a = mk(), b = mk();
  a.peer = b; b.peer = a;
  return [a, b];
}

function setup() {
  const [ca, cb] = channelPair();
  const log = { a: [], b: [] };
  const mkHooks = (side, extra = {}) => ({
    onIncoming: (m) => log[side].push(['incoming', m]),
    onAccepted: () => log[side].push(['accepted']),
    onProgress: (p) => log[side].push(['progress', p]),
    onReceived: (m, blob) => log[side].push(['received', m, blob]),
    onSent: (m) => log[side].push(['sent', m]),
    onRejected: (r) => log[side].push(['rejected', r]),
    onCancelled: () => log[side].push(['cancelled']),
    onError: (r) => log[side].push(['error', r]),
    ...extra,
  });
  const sender = new Session(ca, mkHooks('a'));
  const receiver = new Session(cb, mkHooks('b', { onIncoming: (m) => { log.b.push(['incoming', m]); receiver.accept(); } }));
  return { sender, receiver, log, ca, cb };
}
const find = (arr, k) => arr.find((e) => e[0] === k);
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

test('file 300 KB sampai utuh dan antrean kirim dijaga', async () => {
  const { sender, log, ca } = setup();
  const bytes = Uint8Array.from({ length: 300 * 1024 + 123 }, (_, i) => (i * 31) & 255);
  let maxBuf = 0;
  const origSend = ca.send.bind(ca);
  ca.send = (d) => { origSend(d); maxBuf = Math.max(maxBuf, ca.bufferedAmount); };
  const res = await sender.sendFile(new File([bytes], 'foto.jpg', { type: 'image/jpeg' }));
  assert.equal(res, 'ok');
  const got = find(log.b, 'received');
  assert.equal(got[1].name, 'foto.jpg');
  assert.deepEqual(new Uint8Array(await got[2].arrayBuffer()), bytes);
  assert.ok(find(log.a, 'sent'));
  assert.ok(maxBuf <= config.bufferHigh + config.chunkSize, `antrean ${maxBuf}`);
});

test('file kosong tetap terkirim', async () => {
  const { sender, log } = setup();
  assert.equal(await sender.sendFile(new File([], 'kosong.txt')), 'ok');
  assert.equal(find(log.b, 'received')[2].size, 0);
});

test('penerima menolak: pengirim tahu dan tidak ada data terkirim', async () => {
  const { sender, receiver, log } = setup();
  receiver.h.onIncoming = (m) => { log.b.push(['incoming', m]); receiver.reject('declined'); };
  assert.equal(await sender.sendFile(new File(['abc'], 'a.txt')), 'rejected');
  assert.deepEqual(find(log.a, 'rejected'), ['rejected', 'declined']);
  assert.equal(find(log.b, 'received'), undefined);
});

test('file melebihi batas penerima ditolak otomatis', async () => {
  const { sender, log } = setup();
  const old = config.maxFileBytes;
  config.maxFileBytes = 10;
  try {
    assert.equal(await sender.sendFile(new File([new Uint8Array(50)], 'besar.bin')), 'rejected');
    assert.deepEqual(find(log.a, 'rejected'), ['rejected', 'too-big']);
    assert.equal(find(log.b, 'incoming'), undefined);
  } finally { config.maxFileBytes = old; }
});

test('penerima tidak menyimpan data sebelum menekan Terima', async () => {
  const { sender, receiver, log } = setup();
  receiver.h.onIncoming = (m) => log.b.push(['incoming', m]); // tidak accept
  const p = sender.sendFile(new File([new Uint8Array(40000)], 'x.bin'));
  await tick();
  assert.ok(find(log.b, 'incoming'));
  assert.equal(receiver.inc.received, 0);
  receiver.accept();
  assert.equal(await p, 'ok');
});

test('pengirim membatalkan di tengah jalan', async () => {
  const { sender, log } = setup();
  const p = sender.sendFile(new File([new Uint8Array(2 * 1024 * 1024)], 'besar.bin'));
  await tick(5);
  sender.cancel();
  assert.equal(await p, 'cancelled');
  await tick();
  assert.ok(find(log.b, 'cancelled'));
  assert.equal(find(log.b, 'received'), undefined);
});

test('data melebihi ukuran yang dijanjikan menghentikan transfer', async () => {
  const { receiver, log, ca } = setup();
  ca.send(JSON.stringify({ t: 'offer', id: 'z', name: 'a.bin', size: 5, mime: '' }));
  await tick();
  ca.send(new Uint8Array(10).buffer);
  await tick();
  assert.deepEqual(find(log.b, 'error'), ['error', 'overflow']);
  assert.equal(receiver.busy, false);
});

test('koneksi putus saat transfer: abort melaporkan galat', async () => {
  const { sender, receiver, log } = setup();
  sender.sendFile(new File([new Uint8Array(100000)], 'a.bin'));
  await tick(2);
  receiver.abort('lost');
  assert.deepEqual(find(log.b, 'error'), ['error', 'lost']);
});

test('sanitizeName membersihkan nama berbahaya', () => {
  const trav = sanitizeName('../../etc/passwd');
  assert.ok(!/[\\/]/.test(trav) && !trav.startsWith('.'), trav);
  assert.equal(sanitizeName('a/b\\c:d.txt'), 'a_b_c_d.txt');
  assert.equal(sanitizeName('\u0000\u0007.hidden'), 'hidden');
  assert.equal(sanitizeName(''), 'file');
  assert.equal(sanitizeName(null), 'file');
  const long = sanitizeName('x'.repeat(300) + '.pdf');
  assert.ok(long.length <= 150 && long.endsWith('.pdf'));
});

test('extensionOf', () => {
  assert.equal(extensionOf('Foto.JPG'), 'jpg');
  assert.equal(extensionOf('arsip.tar.gz'), 'gz');
  assert.equal(extensionOf('.bashrc'), '');
  assert.equal(extensionOf('polos'), '');
});
