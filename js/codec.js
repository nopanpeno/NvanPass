// Kode koneksi: mengubah SDP WebRTC (sekitar 1 KB teks) menjadi kode pendek
// (sekitar 200 karakter) yang muat di satu QR, lalu membangunnya kembali.
//
// Hanya data yang benar-benar dibutuhkan satu data channel yang dikirim:
// ice-ufrag, ice-pwd, sidik jari DTLS SHA-256, dan kandidat jaringan UDP.
// Modul ini murni (tanpa DOM) supaya bisa diuji di Node.

export const CODE_PREFIX = 'nvp1.';
export const KIND = { offer: 0, answer: 1 };
const VERSION = 1;
const TYPES = ['host', 'srflx', 'prflx', 'relay'];
export const MAX_CANDIDATES = 8;

export class CodeError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'CodeError';
    this.reason = reason; // 'format' | 'checksum' | 'version' | 'unsupported' | 'expected-offer' | 'expected-answer'
  }
}

// ---------- base64url ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toB64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

export function fromB64url(str) {
  const vals = [];
  for (const ch of str) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new CodeError('format');
    vals.push(v);
  }
  if (vals.length % 4 === 1) throw new CodeError('format');
  const out = [];
  for (let i = 0; i < vals.length; i += 4) {
    const n = (vals[i] << 18) | ((vals[i + 1] ?? 0) << 12) | ((vals[i + 2] ?? 0) << 6) | (vals[i + 3] ?? 0);
    out.push((n >> 16) & 255);
    if (i + 2 < vals.length) out.push((n >> 8) & 255);
    if (i + 3 < vals.length) out.push(n & 255);
  }
  return Uint8Array.from(out);
}

// CRC-16/CCITT-FALSE: menangkap kode yang terpotong atau salah salin.
export function crc16(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

// ---------- SDP -> info ----------
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function parseIPv4(s) {
  const p = s.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return Uint8Array.from(p);
}

function parseIPv6(s) {
  if (!/^[0-9a-fA-F:]+$/.test(s) || s.includes(':::')) return null;
  const [head, tail, extra] = s.split('::');
  if (extra !== undefined) return null;
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const missing = 8 - h.length - t.length;
  if (tail === undefined ? h.length !== 8 : missing < 1) return null;
  const groups = tail === undefined ? h : [...h, ...Array(missing).fill('0'), ...t];
  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const v = parseInt(groups[i], 16);
    if (!(v >= 0 && v <= 0xffff)) return null;
    out[i * 2] = v >> 8;
    out[i * 2 + 1] = v & 255;
  }
  return out;
}

function formatIPv6(b) {
  const g = [];
  for (let i = 0; i < 16; i += 2) g.push(((b[i] << 8) | b[i + 1]).toString(16));
  return g.join(':'); // bentuk penuh sah dan tidak ambigu
}

// "candidate:842163049 1 udp 1677729535 1.2.3.4 46154 typ srflx raddr ..."
export function parseCandidate(line) {
  const m = /^(?:a=)?candidate:\S+ (\d+) (\w+) (\d+) (\S+) (\d+) typ (\w+)/.exec(line.trim());
  if (!m) return null;
  const [, component, proto, prio, addr, port, type] = m;
  if (component !== '1' || proto.toLowerCase() !== 'udp') return null;
  const t = TYPES.indexOf(type);
  if (t < 0) return null;
  const c = { type: t, port: Number(port), priority: Number(prio) >>> 0 };
  const mdns = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i.exec(addr);
  if (mdns) {
    c.kind = 'mdns';
    c.addr = hexToBytes(mdns.slice(1).join(''));
  } else if (addr.includes(':')) {
    if (/^fe80:/i.test(addr)) return null; // link-local tidak berguna lintas perangkat
    const b = parseIPv6(addr);
    if (!b) return null;
    c.kind = 'v6';
    c.addr = b;
  } else {
    const b = parseIPv4(addr);
    if (!b) return null;
    c.kind = 'v4';
    c.addr = b;
  }
  return c;
}

export function parseSdp(sdp) {
  const get = (re) => {
    const m = re.exec(sdp);
    return m ? m[1].trim() : null;
  };
  const ufrag = get(/^a=ice-ufrag:(.+)$/m);
  const pwd = get(/^a=ice-pwd:(.+)$/m);
  const fp = /^a=fingerprint:(\S+) ([0-9A-Fa-f:]+)\s*$/m.exec(sdp);
  if (!ufrag || !pwd || !fp) throw new CodeError('format');
  if (fp[1].toLowerCase() !== 'sha-256') throw new CodeError('unsupported');
  const fingerprint = hexToBytes(fp[2].replace(/:/g, ''));
  if (fingerprint.length !== 32) throw new CodeError('format');
  const seen = new Set();
  const candidates = [];
  for (const line of sdp.split(/\r?\n/)) {
    if (!line.includes('candidate:')) continue;
    const c = parseCandidate(line);
    if (!c) continue;
    const key = c.kind + bytesToHex(c.addr) + c.port;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(c);
  }
  candidates.sort((a, b) => b.priority - a.priority);
  return { ufrag, pwd, fingerprint, candidates: candidates.slice(0, MAX_CANDIDATES) };
}

// ---------- info -> kode ----------
export function encodeInfo(kind, info) {
  const enc = new TextEncoder();
  const ufrag = enc.encode(info.ufrag);
  const pwd = enc.encode(info.pwd);
  if (ufrag.length > 255 || pwd.length > 255) throw new CodeError('format');
  const parts = [Uint8Array.of((VERSION << 4) | KIND[kind]), Uint8Array.of(ufrag.length), ufrag, Uint8Array.of(pwd.length), pwd, info.fingerprint, Uint8Array.of(info.candidates.length)];
  for (const c of info.candidates) {
    const flags = c.type | (c.kind === 'v6' ? 4 : 0) | (c.kind === 'mdns' ? 8 : 0);
    const tail = new Uint8Array(6);
    new DataView(tail.buffer).setUint16(0, c.port);
    new DataView(tail.buffer).setUint32(2, c.priority);
    parts.push(Uint8Array.of(flags), c.addr, tail);
  }
  const body = concat(parts);
  const crc = crc16(body);
  return CODE_PREFIX + toB64url(concat([body, Uint8Array.of(crc >> 8, crc & 255)]));
}

export function encodeSdp(kind, sdp) {
  return encodeInfo(kind, parseSdp(sdp));
}

function concat(arrs) {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

// ---------- kode -> info ----------
export function decodeCode(code) {
  const text = String(code).trim();
  if (!text.startsWith(CODE_PREFIX)) throw new CodeError('format');
  const bytes = fromB64url(text.slice(CODE_PREFIX.length));
  if (bytes.length < 40) throw new CodeError('format');
  const body = bytes.subarray(0, bytes.length - 2);
  if (crc16(body) !== ((bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1])) throw new CodeError('checksum');
  if (body[0] >> 4 !== VERSION) throw new CodeError('version');
  const kind = (body[0] & 15) === KIND.answer ? 'answer' : 'offer';
  const dec = new TextDecoder();
  let p = 1;
  const need = (n) => {
    if (p + n > body.length) throw new CodeError('format');
  };
  need(1);
  const ul = body[p++];
  need(ul);
  const ufrag = dec.decode(body.subarray(p, p + ul));
  p += ul;
  need(1);
  const pl = body[p++];
  need(pl);
  const pwd = dec.decode(body.subarray(p, p + pl));
  p += pl;
  need(33);
  const fingerprint = body.slice(p, p + 32);
  p += 32;
  const n = body[p++];
  const candidates = [];
  for (let i = 0; i < n; i++) {
    need(1);
    const flags = body[p++];
    const kindC = flags & 8 ? 'mdns' : flags & 4 ? 'v6' : 'v4';
    const len = kindC === 'v4' ? 4 : 16;
    need(len + 6);
    const addr = body.slice(p, p + len);
    p += len;
    const dv = new DataView(body.buffer, body.byteOffset + p, 6);
    candidates.push({ type: flags & 3, kind: kindC, addr, port: dv.getUint16(0), priority: dv.getUint32(2) });
    p += 6;
  }
  if (p !== body.length) throw new CodeError('format');
  return { kind, ufrag, pwd, fingerprint, candidates };
}

function addrString(c) {
  if (c.kind === 'v4') return Array.from(c.addr).join('.');
  if (c.kind === 'v6') return formatIPv6(c.addr);
  const h = bytesToHex(c.addr);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`;
}

// ---------- info -> SDP ----------
export function buildSdp(info) {
  const fp = Array.from(info.fingerprint, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const lines = [
    'v=0',
    'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    ...info.candidates.map((c, i) => {
      const base = `a=candidate:${i + 1} 1 udp ${c.priority} ${addrString(c)} ${c.port} typ ${TYPES[c.type]}`;
      return c.type === 0 ? base : `${base} raddr 0.0.0.0 rport 0`;
    }),
    'a=end-of-candidates',
    `a=ice-ufrag:${info.ufrag}`,
    `a=ice-pwd:${info.pwd}`,
    `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${info.kind === 'offer' ? 'actpass' : 'active'}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function decodeToSdp(code) {
  const info = decodeCode(code);
  return { kind: info.kind, sdp: buildSdp(info), info };
}

// ---------- tautan & tempel ----------
// Menerima kode mentah, tautan (…#o=kode) atau teks chat berisi keduanya.
export function extractCode(text) {
  const m = /nvp1\.[A-Za-z0-9_-]+/.exec(String(text));
  return m ? m[0] : null;
}

export function makeShareLink(baseUrl, code) {
  return `${baseUrl.split('#')[0]}#o=${code}`;
}
