import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeSdp, decodeToSdp, decodeCode, parseSdp, extractCode, makeShareLink,
  toB64url, fromB64url, crc16, CodeError, CODE_PREFIX,
} from '../js/codec.js';

const FP = '3A:1F:BC:09:7E:55:A0:12:34:56:78:9A:BC:DE:F0:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:01:02';

// Bentuk SDP data channel seperti yang dihasilkan Chrome, lengkap dengan kandidat.
const chromeOffer = (extra = '') => [
  'v=0', 'o=- 8433790261837467 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
  'a=group:BUNDLE 0', 'a=extmap-allow-mixed', 'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
  'a=candidate:1 1 udp 2113937151 6f1c2b44-9a10-4d35-8c77-0e5a1f3b2d90.local 54321 typ host generation 0 network-cost 999',
  'a=candidate:2 1 udp 1677729535 203.0.113.7 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999',
  'a=candidate:3 1 tcp 1518280447 192.168.1.20 9 typ host tcptype active generation 0',
  'a=candidate:4 1 udp 2113939711 2001:db8:abcd:12::5 50000 typ host generation 0',
  'a=candidate:5 1 udp 2113939711 fe80::1c2b:3dff:fe4a:1 50001 typ host generation 0',
  extra,
  'a=ice-ufrag:AbCd', 'a=ice-pwd:0123456789abcdefghijkl', 'a=ice-options:trickle',
  `a=fingerprint:sha-256 ${FP}`, 'a=setup:actpass', 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144', '',
].filter((l) => l !== undefined).join('\r\n');

test('base64url bolak-balik untuk semua panjang', () => {
  for (let n = 0; n < 40; n++) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 255);
    assert.deepEqual(fromB64url(toB64url(b)), b);
  }
});

test('crc16 sesuai nilai acuan CCITT-FALSE', () => {
  assert.equal(crc16(new TextEncoder().encode('123456789')), 0x29b1);
});

test('SDP -> kode -> SDP menjaga data penting', () => {
  const code = encodeSdp('offer', chromeOffer());
  assert.ok(code.startsWith(CODE_PREFIX));
  const { kind, sdp, info } = decodeToSdp(code);
  assert.equal(kind, 'offer');
  assert.equal(info.ufrag, 'AbCd');
  assert.equal(info.pwd, '0123456789abcdefghijkl');
  assert.match(sdp, new RegExp(`a=fingerprint:sha-256 ${FP}`));
  assert.match(sdp, /a=setup:actpass/);
  assert.match(sdp, /6f1c2b44-9a10-4d35-8c77-0e5a1f3b2d90\.local 54321 typ host/);
  assert.match(sdp, /203\.0\.113\.7 54321 typ srflx raddr 0\.0\.0\.0 rport 0/);
  assert.match(sdp, /2001:db8:abcd:12:0:0:0:5 50000 typ host/);
});

test('kandidat TCP dan IPv6 link-local dibuang', () => {
  const info = parseSdp(chromeOffer());
  assert.equal(info.candidates.length, 3);
  assert.ok(!info.candidates.some((c) => c.port === 9 || c.port === 50001));
});

test('jawaban memakai setup active', () => {
  const code = encodeSdp('answer', chromeOffer());
  const { kind, sdp } = decodeToSdp(code);
  assert.equal(kind, 'answer');
  assert.match(sdp, /a=setup:active/);
});

test('kode cukup pendek untuk satu QR', () => {
  const code = encodeSdp('offer', chromeOffer());
  assert.ok(code.length < 300, `panjang ${code.length}`);
  const link = makeShareLink('https://nopanpeno.github.io/NvanPass/', code);
  assert.ok(link.length < 400);
});

test('maksimal delapan kandidat, prioritas tertinggi dipertahankan', () => {
  const many = Array.from({ length: 12 }, (_, i) => `a=candidate:${i} 1 udp ${1000 + i} 10.0.0.${i + 1} ${40000 + i} typ host`).join('\r\n');
  const base = chromeOffer().split('\r\n').filter((l) => !l.startsWith('a=candidate')).join('\r\n');
  const info = parseSdp(base.replace('a=ice-ufrag', `${many}\r\na=ice-ufrag`));
  assert.equal(info.candidates.length, 8);
  assert.equal(info.candidates[0].priority, 1011);
});

test('kode rusak ditolak dengan alasan yang tepat', () => {
  const code = encodeSdp('offer', chromeOffer());
  const flip = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21);
  assert.throws(() => decodeCode(flip), (e) => e instanceof CodeError && e.reason === 'checksum');
  assert.throws(() => decodeCode(code.slice(0, -6)), (e) => e instanceof CodeError);
  assert.throws(() => decodeCode('halo dunia'), (e) => e.reason === 'format');
  assert.throws(() => decodeCode('nvp1.'), (e) => e.reason === 'format');
  assert.throws(() => decodeCode('nvp1.!!!'), (e) => e.reason === 'format');
});

test('SDP tanpa sha-256 atau tanpa ufrag ditolak', () => {
  assert.throws(() => parseSdp(chromeOffer().replace('sha-256', 'sha-1')), (e) => e.reason === 'unsupported');
  assert.throws(() => parseSdp('v=0\r\n'), (e) => e.reason === 'format');
});

test('extractCode mengambil kode dari tautan atau teks chat', () => {
  const code = encodeSdp('offer', chromeOffer());
  assert.equal(extractCode(`  ${code}  `), code);
  assert.equal(extractCode(makeShareLink('https://x.github.io/NvanPass/?a=1#old', code)), code);
  assert.equal(extractCode(`nih kodenya:\n${code}\nmakasih`), code);
  assert.equal(extractCode('tidak ada apa-apa'), null);
});
