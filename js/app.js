// Alur layar: beranda -> (kirim | terima) -> tersambung -> transfer.
import { initLang, setLang, getLang, t, hasKey, applyI18n, formatBytes } from './i18n.js';
import { config, RISKY_EXTENSIONS } from './config.js';
import { Peer, PeerError, webrtcSupported } from './rtc.js';
import { extractCode, makeShareLink, CodeError } from './codec.js';
import { Session, extensionOf } from './transfer.js';
import { renderQr, Scanner, classifyCameraError } from './qr.js';

const $ = (id) => document.getElementById(id);
const screens = Array.from(document.querySelectorAll('[data-screen]'));

const S = {
  screen: 'home',
  role: null, // 'sender' | 'receiver'
  file: null,
  peer: null,
  session: null,
  scanner: null,
  wake: null,
  saveUrl: null,
  warned: false,
  peerGone: false,
  errReason: null,
};
// Keadaan layar transfer. mode: waitaccept | sending | sent | rejected | cancelled |
//                               waitfile | incoming | receiving | received
let X = { mode: 'waitfile' };

const ACTIVE_MODES = ['waitaccept', 'sending', 'incoming', 'receiving'];
const isActive = () => S.session && ACTIVE_MODES.includes(X.mode);

// ---------- layar ----------
function show(name) {
  S.screen = name;
  for (const s of screens) s.hidden = s.dataset.screen !== name;
  const h = document.querySelector(`[data-screen="${name}"] h1`);
  h?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function setMsg(el, text) {
  el.textContent = text || '';
  el.hidden = !text;
}

function resetAll() {
  closeScanner();
  S.peer?.close();
  S.peer = null;
  S.session = null;
  S.file = null;
  S.role = null;
  S.peerGone = false;
  S.errReason = null;
  if (S.saveUrl) URL.revokeObjectURL(S.saveUrl);
  S.saveUrl = null;
  releaseScreen();
  X = { mode: 'waitfile' };
  $('file-input').value = '';
  $('offer-paste').value = '';
  $('recv-paste').value = '';
  for (const id of ['pick-error', 'offer-error', 'offer-status', 'recv-error', 'offer-share-msg', 'answer-share-msg', 'xfer-note']) setMsg($(id), '');
  for (const id of ['offer-ticket', 'answer-ticket']) $(id).setAttribute('aria-busy', 'true');
  for (const id of ['offer-qr', 'offer-code', 'offer-actions', 'offer-step2', 'answer-qr', 'answer-code', 'answer-actions']) $(id).hidden = true;
  $('offer-loading').hidden = false;
  $('answer-loading').hidden = false;
  $('offer-paste-btn').disabled = false;
  $('offer-scan').disabled = false;
  $('answer-status').textContent = t('answer.waiting');
  renderPick();
  show('home');
}

function fail(reason) {
  closeScanner();
  S.peer?.close();
  S.peer = null;
  S.session = null;
  releaseScreen();
  S.errReason = reason;
  renderError();
  show('error');
}

function renderError() {
  const r = S.errReason;
  if (!r) return;
  const known = hasKey(`err.title.${r}`) ? r : 'ice';
  $('err-title').textContent = t(`err.title.${known}`);
  $('err-body').textContent = t(`err.body.${known}`);
  $('err-tips').hidden = !['ice', 'timeout', 'no-candidates', 'lost'].includes(known);
}

// ---------- bantu ----------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'sr-only';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// Kode memuat alamat IP. Tampilkan peringatan sekali per sesi sebelum kode keluar dari layar.
function confirmShare() {
  if (S.warned) return Promise.resolve(true);
  const d = $('warn-dialog');
  return new Promise((resolve) => {
    const done = (v) => {
      $('warn-ok').onclick = $('warn-cancel').onclick = null;
      d.onclose = null;
      if (d.open) d.close();
      if (v) S.warned = true;
      resolve(v);
    };
    $('warn-ok').onclick = () => done(true);
    $('warn-cancel').onclick = () => done(false);
    d.onclose = () => done(false);
    d.showModal();
  });
}

async function copyWithWarning(text, msgEl) {
  if (!(await confirmShare())) return;
  setMsg(msgEl, (await copyText(text)) ? t('common.copied') : t('share.copyfail'));
}

async function shareWithWarning(payload, copyValue, msgEl) {
  if (!(await confirmShare())) return;
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  setMsg(msgEl, (await copyText(copyValue)) ? t('share.copied') : t('share.copyfail'));
}

function codeErrorText(err) {
  if (err instanceof CodeError) return t(`code.${hasKey(`code.${err.reason}`) ? err.reason : 'format'}`);
  return t('code.invalid');
}

// ---------- pemindai kamera ----------
function closeScanner() {
  S.scanner?.stop();
  S.scanner = null;
  const d = $('scan-dialog');
  if (d.open) d.close();
}

async function openScanner(onCode, errEl) {
  closeScanner();
  setMsg(errEl, '');
  const d = $('scan-dialog');
  setMsg($('scan-msg'), t('scan.starting'));
  d.showModal();
  const scanner = new Scanner($('scan-video'));
  S.scanner = scanner;
  try {
    await scanner.start((text) => {
      const code = extractCode(text);
      if (!code) return setMsg($('scan-msg'), t('scan.notours'));
      closeScanner();
      onCode(code);
    });
    if (S.scanner === scanner) setMsg($('scan-msg'), '');
  } catch (e) {
    if (S.scanner !== scanner) return;
    closeScanner();
    setMsg(errEl, t(`cam.${classifyCameraError(e)}`));
  }
}

// ---------- layar tetap menyala ----------
async function lockScreen() {
  try {
    if (!S.wake || S.wake.released) S.wake = await navigator.wakeLock?.request('screen');
  } catch {
    /* tidak didukung atau ditolak: tidak apa-apa */
  }
}
function releaseScreen() {
  try {
    S.wake?.release();
  } catch {
    /* sudah lepas */
  }
  S.wake = null;
}

// ---------- koneksi ----------
function newPeer() {
  const peer = new Peer();
  peer.onopen = () => onConnected();
  peer.onfail = (reason) => onPeerFail(reason);
  S.peer = peer;
  return peer;
}

function onPeerFail(reason) {
  if (S.screen !== 'transfer') return fail(reason);
  S.peerGone = true;
  releaseScreen();
  if (isActive()) {
    S.session?.abort(reason); // memanggil hooks.onError -> fail
    if (S.screen === 'transfer') fail(reason);
    return;
  }
  renderTransfer();
}

// ---------- pengirim ----------
function renderPick() {
  const f = S.file;
  $('pick-file').hidden = !f;
  if (f) {
    $('pick-name').textContent = f.name;
    $('pick-size').textContent = formatBytes(f.size);
  }
  $('pick-next').disabled = !f;
  $('pick-btn').textContent = t(f ? 'pick.change' : 'pick.button');
  if (S.file) $('offer-file').textContent = `${S.file.name} · ${formatBytes(S.file.size)}`;
}

function checkFile(f, errEl) {
  if (f.size > config.maxFileBytes) {
    setMsg(errEl, t('pick.toobig', { size: formatBytes(f.size), max: formatBytes(config.maxFileBytes) }));
    return false;
  }
  setMsg(errEl, '');
  return true;
}

function setFile(f) {
  if (!f) return;
  if (!checkFile(f, $('pick-error'))) {
    S.file = null;
  } else S.file = f;
  renderPick();
}

async function startSender() {
  show('offer');
  renderPick();
  let peer;
  try {
    peer = newPeer();
  } catch (e) {
    return fail(e.reason || 'unsupported');
  }
  let code;
  try {
    code = await peer.createOffer();
  } catch (e) {
    if (S.peer !== peer) return;
    return fail(e instanceof PeerError ? e.reason : 'ice');
  }
  if (S.peer !== peer) return;
  const link = makeShareLink(location.href, code);
  renderQr($('offer-qr'), link);
  $('offer-code').textContent = code;
  $('offer-ticket').setAttribute('aria-busy', 'false');
  $('offer-loading').hidden = true;
  for (const id of ['offer-qr', 'offer-code', 'offer-actions', 'offer-step2']) $(id).hidden = false;
  $('offer-copy').onclick = () => copyWithWarning(code, $('offer-share-msg'));
  $('offer-share').onclick = () => shareWithWarning({ title: 'NvanPass', url: link }, link, $('offer-share-msg'));
}

async function submitAnswer(code) {
  setMsg($('offer-error'), '');
  if (!code) return setMsg($('offer-error'), t('code.format'));
  if (!S.peer) return;
  try {
    await S.peer.acceptAnswer(code);
  } catch (e) {
    return setMsg($('offer-error'), codeErrorText(e));
  }
  $('offer-paste-btn').disabled = true;
  $('offer-scan').disabled = true;
  setMsg($('offer-status'), t('offer.connecting'));
}

// ---------- penerima ----------
async function startReceiver(code) {
  setMsg($('recv-error'), '');
  show('answer');
  let peer;
  try {
    peer = newPeer();
  } catch (e) {
    return fail(e.reason || 'unsupported');
  }
  S.role = 'receiver';
  let answer;
  try {
    answer = await peer.acceptOffer(code);
  } catch (e) {
    if (S.peer !== peer) return;
    if (e instanceof PeerError) return fail(e.reason);
    peer.close();
    S.peer = null;
    show('recv');
    return setMsg($('recv-error'), codeErrorText(e));
  }
  if (S.peer !== peer) return;
  renderQr($('answer-qr'), answer);
  $('answer-code').textContent = answer;
  $('answer-ticket').setAttribute('aria-busy', 'false');
  $('answer-loading').hidden = true;
  for (const id of ['answer-qr', 'answer-code', 'answer-actions']) $(id).hidden = false;
  $('answer-copy').onclick = () => copyWithWarning(answer, $('answer-share-msg'));
  $('answer-share').onclick = () => shareWithWarning({ title: 'NvanPass', text: answer }, answer, $('answer-share-msg'));
}

// ---------- transfer ----------
function onConnected() {
  const peer = S.peer;
  S.session = new Session(peer.channel, {
    onIncoming: (meta) => {
      if (S.saveUrl) URL.revokeObjectURL(S.saveUrl);
      S.saveUrl = null;
      setX({ mode: 'incoming', meta });
    },
    onAccepted: () => setX({ ...X, mode: 'sending' }),
    onProgress: onProgress,
    onReceived: (meta, blob) => {
      S.saveUrl = URL.createObjectURL(blob);
      setX({ mode: 'received', meta });
    },
    onSent: (meta) => setX({ mode: 'sent', meta }),
    onRejected: (reason) => setX({ mode: 'rejected', reason }),
    onCancelled: () => setX({ mode: S.role === 'sender' ? 'cancelled' : 'waitfile', notice: 'xfer.cancelled' }),
    onError: (reason) => fail(reason),
  });
  S.peerGone = false;
  lockScreen();
  show('transfer');
  if (S.role === 'sender') sendCurrentFile();
  else setX({ mode: 'waitfile' });
}

function sendCurrentFile() {
  setX({ mode: 'waitaccept', meta: { name: S.file.name, size: S.file.size } });
  speed.reset();
  S.session.sendFile(S.file).catch(() => {});
}

function setX(next) {
  X = next;
  speed.reset();
  renderTransfer();
}

const speed = {
  last: null,
  bps: 0,
  reset() {
    this.last = null;
    this.bps = 0;
  },
  sample(done) {
    const now = performance.now();
    if (!this.last) this.last = { t: now, done };
    else if (now - this.last.t >= 700) {
      this.bps = ((done - this.last.done) / (now - this.last.t)) * 1000;
      this.last = { t: now, done };
    }
    return this.bps;
  },
};

let progressFrame = 0;
function onProgress(p) {
  if (progressFrame) {
    X.latest = p;
    return;
  }
  progressFrame = requestAnimationFrame(() => {
    progressFrame = 0;
    drawProgress(X.latest ?? p);
  });
  X.latest = p;
}

function drawProgress({ done, total }) {
  if (X.mode !== 'sending' && X.mode !== 'receiving') return;
  const pct = total ? Math.min(100, Math.floor((done / total) * 100)) : 100;
  $('bar').max = 100;
  $('bar').value = pct;
  const bps = speed.sample(done);
  let text = t('progress.line', { pct: `${pct}%`, done: formatBytes(done), total: formatBytes(total) });
  if (bps > 0) text += ` · ${t('progress.speed', { speed: formatBytes(bps) })}`;
  $('bar-text').textContent = text;
}

function renderTransfer() {
  const m = X.mode;
  const name = X.meta?.name ?? '';
  const panels = { incoming: false, progress: false, done: false };
  let title = '';
  let notice = X.notice ? t(X.notice) : '';
  const sender = S.role === 'sender';

  if (m === 'waitaccept') {
    title = t('xfer.waitaccept', { name });
    panels.progress = true;
    $('bar').removeAttribute('value');
    $('bar-text').textContent = '';
  } else if (m === 'sending' || m === 'receiving') {
    title = t(m === 'sending' ? 'xfer.sending' : 'xfer.receiving', { name });
    panels.progress = true;
    $('bar').value = 0;
    $('bar-text').textContent = '';
    if (X.latest) drawProgress(X.latest);
  } else if (m === 'sent') {
    title = t('xfer.sent', { name });
    panels.done = true;
  } else if (m === 'rejected') {
    title = t(hasKey(`xfer.rejected.${X.reason}`) ? `xfer.rejected.${X.reason}` : 'xfer.rejected.declined');
    panels.done = true;
  } else if (m === 'cancelled') {
    title = t('xfer.cancelled');
    notice = '';
    panels.done = true;
  } else if (m === 'waitfile') {
    title = t('xfer.waitfile');
    panels.done = true;
  } else if (m === 'incoming') {
    title = t('incoming.title');
    panels.incoming = true;
    const ext = extensionOf(name);
    $('in-name').textContent = name;
    $('in-size').textContent = formatBytes(X.meta.size);
    $('in-type').textContent = ext || X.meta.mime ? [ext && `.${ext}`, X.meta.mime && `(${X.meta.mime})`].filter(Boolean).join(' ') : t('incoming.type.none');
    const risky = RISKY_EXTENSIONS.includes(ext);
    setMsg($('in-risky'), risky ? t('incoming.risky', { ext }) : '');
  } else if (m === 'received') {
    title = t('xfer.received');
    panels.done = true;
  }

  if (S.peerGone && !ACTIVE_MODES.includes(m)) notice = t('xfer.peerleft');

  $('xfer-title').textContent = title;
  const tone = m === 'rejected' || m === 'cancelled' ? 'warn' : 'ok';
  document.querySelectorAll('#xfer-done .status-ico').forEach((el) => el.classList.toggle('on', el.dataset.tone === tone));
  $('xfer-incoming').hidden = !panels.incoming;
  $('xfer-progress').hidden = !panels.progress;
  $('xfer-done').hidden = !panels.done;
  setMsg($('xfer-note'), notice);

  const received = m === 'received' && S.saveUrl;
  const save = $('save-link');
  save.hidden = !received;
  $('save-hint').hidden = !received;
  if (received) {
    save.href = S.saveUrl;
    save.download = name;
  }
  $('done-text').hidden = true;
  $('send-another').hidden = !(sender && !S.peerGone && panels.done);
  $('xfer-finish').hidden = !panels.done;
}

// ---------- pasang peristiwa ----------
function bind() {
  $('lang-btn').onclick = () => {
    setLang(getLang() === 'id' ? 'en' : 'id');
    refreshLang();
  };

  $('go-send').onclick = () => {
    if (!webrtcSupported()) return fail('unsupported');
    S.role = 'sender';
    show('pick');
  };
  $('go-recv').onclick = () => {
    if (!webrtcSupported()) return fail('unsupported');
    S.role = 'receiver';
    show('recv');
  };
  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = resetAll));
  $('err-restart').onclick = resetAll;
  $('xfer-finish').onclick = resetAll;

  // pilih file
  $('file-input').onchange = (e) => setFile(e.target.files[0]);
  const drop = $('drop');
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  };
  drop.ondragleave = () => drop.classList.remove('is-over');
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    setFile(e.dataTransfer?.files?.[0]);
  };
  $('pick-next').onclick = () => S.file && startSender();

  // sisi pengirim: jawaban
  $('offer-scan').onclick = () => openScanner(submitAnswer, $('offer-error'));
  $('offer-paste-btn').onclick = () => {
    const raw = $('offer-paste').value.trim();
    if (!raw) return setMsg($('offer-error'), t('code.empty'));
    submitAnswer(extractCode(raw));
  };

  // sisi penerima: tawaran
  $('recv-scan').onclick = () => openScanner(startReceiver, $('recv-error'));
  $('recv-paste-btn').onclick = () => {
    const raw = $('recv-paste').value.trim();
    if (!raw) return setMsg($('recv-error'), t('code.empty'));
    const code = extractCode(raw);
    if (!code) return setMsg($('recv-error'), t('code.format'));
    startReceiver(code);
  };

  // pemindai
  $('scan-close').onclick = closeScanner;
  $('scan-dialog').onclose = () => {
    S.scanner?.stop();
    S.scanner = null;
  };

  // transfer
  $('in-accept').onclick = () => {
    S.session.accept();
    setX({ mode: 'receiving', meta: X.meta });
  };
  $('in-decline').onclick = () => {
    S.session.reject('declined');
    setX({ mode: 'waitfile' });
  };
  $('xfer-cancel').onclick = () => {
    S.session.cancel();
    setX(S.role === 'sender' ? { mode: 'cancelled' } : { mode: 'waitfile' });
  };
  $('send-another').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      if (!checkFile(f, $('xfer-note'))) return;
      S.file = f;
      sendCurrentFile();
    };
    input.click();
  };

  window.addEventListener('beforeunload', (e) => {
    if (isActive()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.session && !S.peerGone) lockScreen();
  });
  window.addEventListener('hashchange', () => {
    if (!S.peer) handleLink();
  });
}

function refreshLang() {
  applyI18n();
  $('lang-btn').textContent = t('lang.switch');
  $('lang-btn').setAttribute('aria-label', t('lang.switch.label'));
  $('lang-btn').lang = getLang() === 'id' ? 'en' : 'id';
  renderPick();
  if (S.screen === 'transfer') renderTransfer();
  if (S.screen === 'error') renderError();
  if (S.screen === 'answer' && S.peer?.opened) $('answer-status').textContent = t('answer.connecting');
  else $('answer-status').textContent = t('answer.waiting');
}

// Tautan tawaran: https://…/#o=nvp1.xxxx
function handleLink() {
  const m = /^#o=(.+)$/.exec(location.hash);
  if (!m) return false;
  const code = extractCode(m[1]);
  history.replaceState(null, '', location.pathname + location.search);
  if (!code) return false;
  if (!webrtcSupported()) {
    fail('unsupported');
    return true;
  }
  startReceiver(code);
  return true;
}

initLang();
bind();
refreshLang();
resetAll();
handleLink();
