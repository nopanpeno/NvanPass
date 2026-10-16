// Protokol kirim file lewat satu RTCDataChannel yang terurut dan andal.
//
//   pengirim                         penerima
//   {t:'offer',id,name,size,mime} ->
//                                 <- {t:'accept',id}  atau {t:'reject',id,reason}
//   potongan biner (16 KiB) ...   ->
//   {t:'end',id}                  ->
//                                 <- {t:'done',id,ok}
//
// Pengirim membaca file per potongan dan menunggu bufferedAmount turun,
// jadi memori tidak terisi seluruh file. Penerima tidak menyimpan apa pun
// sebelum pengguna menekan Terima.
import { config } from './config.js';

export function sanitizeName(name) {
  let n = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/^[.\s]+/, '')
    .trim();
  if (n.length > 150) {
    const dot = n.lastIndexOf('.');
    const ext = dot > 0 && n.length - dot <= 12 ? n.slice(dot) : '';
    n = n.slice(0, 150 - ext.length) + ext;
  }
  return n || 'file';
}

export function extensionOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

const newId = () => Math.random().toString(36).slice(2, 10);

export class Session {
  /**
   * hooks: onIncoming(meta), onAccepted(), onProgress({dir, done, total}), onReceived(meta, blob),
   *        onSent(meta), onRejected(reason), onError(reason), onCancelled(byPeer)
   */
  constructor(channel, hooks) {
    this.ch = channel;
    this.h = hooks;
    this.out = null; // transfer keluar yang sedang berjalan
    this.inc = null; // transfer masuk yang sedang berjalan
    channel.onmessage = (e) => this._onMessage(e.data);
  }

  get busy() {
    return !!(this.out || this.inc);
  }

  _ctl(obj) {
    if (this.ch.readyState === 'open') this.ch.send(JSON.stringify(obj));
  }

  // ---------- pengirim ----------
  sendFile(file) {
    if (this.busy) return Promise.reject(new Error('busy'));
    const meta = { id: newId(), name: file.name, size: file.size, mime: file.type || '' };
    return new Promise((resolve) => {
      this.out = { meta, file, state: 'waiting', cancelled: false, resolve };
      this._ctl({ t: 'offer', id: meta.id, name: meta.name, size: meta.size, mime: meta.mime });
    });
  }

  async _pump() {
    const o = this.out;
    const { file, meta } = o;
    let offset = 0;
    try {
      while (offset < meta.size) {
        if (o.cancelled || this.ch.readyState !== 'open') return;
        if (this.ch.bufferedAmount > config.bufferHigh) {
          await this._waitDrain();
          continue;
        }
        const buf = await file.slice(offset, offset + config.chunkSize).arrayBuffer();
        if (o.cancelled || this.ch.readyState !== 'open') return;
        this.ch.send(buf);
        offset += buf.byteLength;
        this.h.onProgress?.({ dir: 'out', done: Math.max(0, offset - this.ch.bufferedAmount), total: meta.size });
      }
      this._ctl({ t: 'end', id: meta.id });
      o.state = 'finishing';
    } catch {
      this._finishOut('error', 'read');
    }
  }

  _waitDrain() {
    return new Promise((resolve) => {
      const ch = this.ch;
      const done = () => {
        ch.removeEventListener('bufferedamountlow', done);
        ch.removeEventListener('close', done);
        resolve();
      };
      ch.addEventListener('bufferedamountlow', done);
      ch.addEventListener('close', done);
    });
  }

  _finishOut(result, detail) {
    const o = this.out;
    if (!o) return;
    this.out = null;
    o.cancelled = true;
    if (result === 'ok') this.h.onSent?.(o.meta);
    else if (result === 'rejected') this.h.onRejected?.(detail);
    else if (result === 'cancelled') this.h.onCancelled?.(true);
    else this.h.onError?.(detail);
    o.resolve(result);
  }

  // ---------- penerima ----------
  accept() {
    const t = this.inc;
    if (!t || t.state !== 'pending') return;
    t.state = 'receiving';
    this._ctl({ t: 'accept', id: t.meta.id });
  }

  reject(reason = 'declined') {
    const t = this.inc;
    if (!t || t.state !== 'pending') return;
    this.inc = null;
    this._ctl({ t: 'reject', id: t.meta.id, reason });
  }

  // ---------- umum ----------
  cancel() {
    if (this.out) {
      this._ctl({ t: 'cancel', id: this.out.meta.id });
      const o = this.out;
      this.out = null;
      o.cancelled = true;
      o.resolve('cancelled');
    } else if (this.inc) {
      this._ctl({ t: 'cancel', id: this.inc.meta.id });
      this.inc = null;
    }
  }

  // Dipanggil saat koneksi putus.
  abort(reason) {
    if (this.out) this._finishOut('error', reason);
    if (this.inc) {
      this.inc = null;
      this.h.onError?.(reason);
    }
  }

  _onMessage(data) {
    if (typeof data === 'string') {
      let m;
      try {
        m = JSON.parse(data);
      } catch {
        return;
      }
      this._onControl(m);
    } else {
      this._onChunk(data);
    }
  }

  _onControl(m) {
    switch (m?.t) {
      case 'offer': {
        if (this.busy) return this._ctl({ t: 'reject', id: m.id, reason: 'busy' });
        const size = m.size;
        if (typeof m.name !== 'string' || !Number.isSafeInteger(size) || size < 0) return;
        const meta = { id: String(m.id), name: sanitizeName(m.name), size, mime: typeof m.mime === 'string' ? m.mime : '' };
        if (size > config.maxFileBytes) return this._ctl({ t: 'reject', id: meta.id, reason: 'too-big' });
        this.inc = { meta, state: 'pending', parts: [], blobs: [], pendingBytes: 0, received: 0 };
        this.h.onIncoming?.(meta);
        break;
      }
      case 'accept':
        if (this.out && this.out.meta.id === m.id && this.out.state === 'waiting') {
          this.out.state = 'sending';
          this.h.onAccepted?.();
          this._pump();
        }
        break;
      case 'reject':
        if (this.out && this.out.meta.id === m.id) this._finishOut('rejected', m.reason || 'declined');
        break;
      case 'end': {
        const t = this.inc;
        if (!t || t.meta.id !== m.id || t.state !== 'receiving') return;
        this.inc = null;
        if (t.received !== t.meta.size) {
          this._ctl({ t: 'done', id: m.id, ok: false });
          return this.h.onError?.('incomplete');
        }
        const blob = new Blob([...t.blobs, ...t.parts], { type: 'application/octet-stream' });
        this._ctl({ t: 'done', id: m.id, ok: true });
        this.h.onProgress?.({ dir: 'in', done: t.meta.size, total: t.meta.size });
        this.h.onReceived?.(t.meta, blob);
        break;
      }
      case 'done':
        if (this.out && this.out.meta.id === m.id) {
          if (m.ok) {
            this.h.onProgress?.({ dir: 'out', done: this.out.meta.size, total: this.out.meta.size });
            this._finishOut('ok');
          } else this._finishOut('error', 'incomplete');
        }
        break;
      case 'cancel':
        if (this.out && this.out.meta.id === m.id) this._finishOut('cancelled');
        else if (this.inc && this.inc.meta.id === m.id) {
          this.inc = null;
          this.h.onCancelled?.(true);
        }
        break;
    }
  }

  _onChunk(data) {
    const t = this.inc;
    if (!t || t.state !== 'receiving') return;
    t.received += data.byteLength;
    if (t.received > t.meta.size) {
      this.inc = null;
      this._ctl({ t: 'cancel', id: t.meta.id });
      return this.h.onError?.('overflow');
    }
    t.parts.push(data);
    t.pendingBytes += data.byteLength;
    if (t.pendingBytes >= config.receiveFlushBytes) {
      t.blobs.push(new Blob(t.parts));
      t.parts = [];
      t.pendingBytes = 0;
    }
    this.h.onProgress?.({ dir: 'in', done: t.received, total: t.meta.size });
  }
}
