// "My Music": teacher-imported audio files, stored on-device in IndexedDB and played with an <audio> element.
import { registerSource, claim } from './music.js';
import { isIOS } from './mic.js';

const DB = 'classroomtools-music';
let dbp;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('meta', { keyPath: 'id' });
        r.result.createObjectStore('blobs');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function tx(stores, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(stores, mode);
    const out = fn(t);
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('aborted'));
  });
}

export async function listTracks() {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction('meta').objectStore('meta').getAll();
    r.onsuccess = () => res(r.result.sort((a, b) => (a.order ?? a.addedAt) - (b.order ?? b.addedAt)));
    r.onerror = () => rej(r.error);
  });
}
async function getBlob(id) {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction('blobs').objectStore('blobs').get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

const prettyTitle = (name) => name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').replace(/^\d{1,3}[\s.-]+/, '').trim() || name;

function readDuration(blob) {
  return new Promise((res) => {
    const a = new Audio(); const url = URL.createObjectURL(blob);
    const done = (v) => { URL.revokeObjectURL(url); res(v); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    a.src = url;
  });
}

// Returns { added, skipped: [{name, reason}] }
export async function importFiles(fileList, onProgress) {
  const files = [...fileList];
  const existing = await listTracks();
  let order = existing.length ? Math.max(...existing.map((t) => t.order ?? 0)) + 1 : 0;
  const skipped = []; let added = 0;
  for (const [i, f] of files.entries()) {
    onProgress?.(i + 1, files.length, f.name);
    if (!(f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm|caf|aif|aiff)$/i.test(f.name))) { skipped.push({ name: f.name, reason: 'not an audio file' }); continue; }
    const duration = await readDuration(f);
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const meta = { id, title: prettyTitle(f.name), fileName: f.name, type: f.type, size: f.size, duration, addedAt: Date.now(), order: order++ };
    try {
      await tx(['meta', 'blobs'], 'readwrite', (t) => { t.objectStore('meta').put(meta); t.objectStore('blobs').put(f, id); });
      added++;
    } catch (e) {
      skipped.push({ name: f.name, reason: e?.name === 'QuotaExceededError' ? 'device storage is full' : 'could not be saved' });
      if (e?.name === 'QuotaExceededError') break;
    }
  }
  return { added, skipped };
}

export async function deleteTrack(id) {
  if (state.track?.id === id) stopLibrary();
  await tx(['meta', 'blobs'], 'readwrite', (t) => { t.objectStore('meta').delete(id); t.objectStore('blobs').delete(id); });
}
export async function renameTrack(id, title) {
  const all = await listTracks(); const m = all.find((t) => t.id === id); if (!m) return;
  m.title = title;
  await tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put(m));
}
export async function libraryBytes() { return (await listTracks()).reduce((n, t) => n + (t.size || 0), 0); }

// ---- Player ----
const state = { el: null, url: null, track: null, queue: [], shuffle: false, repeat: true, onchange: null, fadeIv: null };
export const libState = state;
const emit = () => state.onchange?.();

function element() {
  if (!state.el) {
    state.el = new Audio();
    state.el.setAttribute('playsinline', '');
    state.el.addEventListener('ended', () => next(true));
    state.el.addEventListener('play', emit);
    state.el.addEventListener('pause', emit);
    state.el.addEventListener('error', () => { emit(); });
  }
  return state.el;
}

export async function playTrack(track, queue) {
  claim('lib');
  const el = element();
  const blob = await getBlob(track.id);
  if (!blob) throw new Error('missing');
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(blob);
  state.track = track;
  if (queue) state.queue = queue;
  clearInterval(state.fadeIv);
  el.src = state.url;
  el.volume = state.volume ?? 1;
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: 'Classroom Tools · My Music' }); } catch { /* ignore */ }
  }
  await el.play();
  emit();
}

export function isLibPlaying() { return !!state.el && !state.el.paused && !!state.track; }

export function togglePause() {
  const el = element();
  if (!state.track) return false;
  if (el.paused) { claim('lib'); el.play().catch(() => {}); } else el.pause();
  return true;
}

export function next(auto = false) {
  if (!state.track || !state.queue.length) return;
  const q = state.queue;
  let i = q.findIndex((t) => t.id === state.track.id);
  if (state.shuffle && q.length > 1) { let j; do j = Math.floor(Math.random() * q.length); while (j === i); i = j; } else i += 1;
  if (i >= q.length) { if (!state.repeat && auto) { stopLibrary(); return; } i = 0; }
  playTrack(q[i]).catch(() => {});
}
export function prev() {
  if (!state.track) return;
  if (state.el && state.el.currentTime > 4) { state.el.currentTime = 0; return; }
  const q = state.queue; const i = q.findIndex((t) => t.id === state.track.id);
  playTrack(q[(i - 1 + q.length) % q.length]).catch(() => {});
}

export function setLibVolume(v) { state.volume = v; if (state.el) state.el.volume = v; }

// Fade out (where the browser allows volume control — iOS doesn't, so it just stops).
export function stopLibrary(fade = 0) {
  const el = state.el;
  if (!el || !state.track) { state.track = null; return; }
  clearInterval(state.fadeIv);
  const finish = () => { el.pause(); el.removeAttribute('src'); el.load(); if (state.url) URL.revokeObjectURL(state.url); state.url = null; state.track = null; el.volume = state.volume ?? 1; emit(); };
  if (!fade || isIOS) { finish(); return; }
  const start = el.volume; const t0 = performance.now();
  state.fadeIv = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / (fade * 1000));
    el.volume = Math.max(0, start * (1 - k));
    if (k >= 1) { clearInterval(state.fadeIv); finish(); }
  }, 50);
}

registerSource('lib', () => stopLibrary());
