// Pembungkus RTCPeerConnection untuk pertukaran kode manual (tanpa server sinyal).
import { config } from './config.js';
import { encodeSdp, decodeToSdp, CodeError } from './codec.js';

// Alasan gagal yang dipakai UI untuk memilih pesan:
// 'no-candidates' | 'ice' | 'timeout' | 'lost' | 'unsupported'
export class PeerError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'PeerError';
    this.reason = reason;
  }
}

export function webrtcSupported() {
  return typeof RTCPeerConnection === 'function';
}

export class Peer {
  constructor() {
    if (!webrtcSupported()) throw new PeerError('unsupported');
    this.pc = new RTCPeerConnection({
      iceServers: config.stunServers.length ? [{ urls: config.stunServers }] : [],
    });
    this.channel = null;
    this.opened = false;
    this.closed = false;
    this.role = null;
    this.onopen = () => {};
    this.onfail = () => {};
    this._timer = null;

    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc.iceConnectionState;
      if (s === 'failed') this._fail(this.opened ? 'lost' : 'ice');
      else if (s === 'disconnected' && this.opened) {
        // 'disconnected' bisa pulih sendiri; beri waktu sebelum menyerah.
        clearTimeout(this._dc);
        this._dc = setTimeout(() => {
          if (this.pc.iceConnectionState === 'disconnected') this._fail('lost');
        }, 6000);
      }
    };
    this.pc.ondatachannel = (e) => this._attach(e.channel);
  }

  _attach(ch) {
    ch.binaryType = 'arraybuffer';
    ch.bufferedAmountLowThreshold = config.bufferLow;
    this.channel = ch;
    ch.onopen = () => {
      this.opened = true;
      clearTimeout(this._timer);
      this.onopen(ch);
    };
    ch.onclose = () => {
      if (!this.closed) this._fail('lost');
    };
    if (ch.readyState === 'open') ch.onopen();
  }

  _fail(reason) {
    if (this.closed) return;
    clearTimeout(this._timer);
    this.onfail(reason);
  }

  _startConnectTimer() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (!this.opened) this._fail('timeout');
    }, config.connectTimeoutMs);
  }

  // Menunggu kandidat jaringan terkumpul. Non-trickle: semua kandidat masuk ke kode.
  _gather() {
    const pc = this.pc;
    return new Promise((resolve, reject) => {
      let count = 0;
      let done = false;
      let grace = null;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(hard);
        clearTimeout(grace);
        pc.removeEventListener('icecandidate', onCand);
        pc.removeEventListener('icegatheringstatechange', onState);
        count > 0 || /candidate:/.test(pc.localDescription?.sdp ?? '') ? resolve() : reject(new PeerError('no-candidates'));
      };
      const onCand = (e) => {
        if (!e.candidate) return;
        count++;
        if (e.candidate.type === 'srflx' && !grace) grace = setTimeout(finish, config.gatherGraceMs);
      };
      const onState = () => {
        if (pc.iceGatheringState === 'complete') finish();
      };
      const hard = setTimeout(finish, config.gatherTimeoutMs);
      pc.addEventListener('icecandidate', onCand);
      pc.addEventListener('icegatheringstatechange', onState);
      if (pc.iceGatheringState === 'complete') finish();
    });
  }

  // Pengirim, langkah 1: buat kode tawaran.
  async createOffer() {
    this.role = 'sender';
    this._attach(this.pc.createDataChannel('nvanpass', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this._gather();
    return encodeSdp('offer', this.pc.localDescription.sdp);
  }

  // Penerima: terima kode tawaran, hasilkan kode jawaban.
  async acceptOffer(code) {
    this.role = 'receiver';
    const { kind, sdp } = decodeToSdp(code);
    if (kind !== 'offer') throw new CodeError('expected-offer');
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this._gather();
    this._startConnectTimer();
    return encodeSdp('answer', this.pc.localDescription.sdp);
  }

  // Pengirim, langkah 2: terima kode jawaban. Koneksi terbuka setelah ini.
  async acceptAnswer(code) {
    const { kind, sdp } = decodeToSdp(code);
    if (kind !== 'answer') throw new CodeError('expected-answer');
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
    this._startConnectTimer();
  }

  close() {
    this.closed = true;
    clearTimeout(this._timer);
    clearTimeout(this._dc);
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      /* sudah tertutup */
    }
  }
}
