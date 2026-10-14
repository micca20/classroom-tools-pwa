// Web Audio synthesized sounds + speech. No audio files needed (works offline).
import { store } from './store.js';

let ctx;
let master;

// iOS: Web Audio is "ambient" by default, so the ring/silent switch mutes it.
// Asking for the "playback" session (iOS 17+) or keeping a silent <audio> element
// playing forces media-style audio that ignores the silent switch.
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }

// While the mic is live iOS needs "play-and-record"; "playback" can make the mic deliver silence.
export function setAudioSession(type) {
  try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* ignore */ }
  if (type === 'playback') setTimeout(() => { startSessionKeeper(); if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }, 300);
}

function silentWavURL() {
  const rate = 8000; const n = rate / 2; // 0.5 s of silence
  const buf = new ArrayBuffer(44 + n); const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
let keepAliveEl = null;
function startSessionKeeper() {
  if (keepAliveEl) { if (keepAliveEl.paused) keepAliveEl.play().catch(() => {}); return; }
  keepAliveEl = document.createElement('audio');
  keepAliveEl.src = silentWavURL();
  keepAliveEl.loop = true;
  keepAliveEl.setAttribute('playsinline', '');
  keepAliveEl.setAttribute('x-webkit-airplay', 'deny');
  keepAliveEl.play().catch(() => {});
}

export function audioCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.connect(ctx.destination);
    ctx.onstatechange = () => document.dispatchEvent(new CustomEvent('audio-state', { detail: ctx.state }));
  }
  // iOS can leave the context "suspended" or "interrupted" (calls, Siri, app switch).
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  master.gain.value = store.get('settings.volume', 0.8);
  return ctx;
}
export function masterOut() { audioCtx(); return master; }
export const audioReady = () => !!ctx && ctx.state === 'running';

// Must run inside a real user gesture (touchend / click / keydown on iOS).
let speechWarmed = false;
export function unlockAudio() {
  startSessionKeeper();
  const c = audioCtx();
  const s = c.createBufferSource();
  s.buffer = c.createBuffer(1, 1, 22050);
  s.connect(master); s.start(0);
  if ('speechSynthesis' in window && !speechWarmed) {
    speechWarmed = true;
    speechSynthesis.getVoices();
    const u = new SpeechSynthesisUtterance(' '); u.volume = 0; // first utterance must come from a gesture on iOS
    speechSynthesis.speak(u);
  }
  return c.state;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
});

function tone({ freq = 440, type = 'sine', start = 0, dur = 1, gain = 0.3, attack = 0.005, glideTo, dest }) {
  const c = audioCtx();
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || master);
  o.start(t); o.stop(t + dur + 0.05);
  return { o, g };
}

function bellPartials(base, start, dur, gain, ratios = [1, 2.0, 2.76, 5.4, 8.93]) {
  ratios.forEach((r, i) => tone({ freq: base * r, start, dur: dur / (1 + i * 0.4), gain: gain / (1 + i * 1.3) }));
}

function noise(start = 0, dur = 0.05, gain = 0.3, filterFreq = 3000) {
  const c = audioCtx();
  const t = c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = filterFreq;
  const g = c.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t);
}

export const SOUNDS = {
  chime: { name: 'Chime', play() { bellPartials(1046.5, 0, 2.2, 0.35); bellPartials(784, 0.35, 2.6, 0.3); } },
  schoolBell: {
    name: 'School Bell',
    play() {
      const c = audioCtx();
      const t = c.currentTime;
      const out = c.createGain();
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = 22; lfoGain.gain.value = 0.5;
      out.gain.value = 0.5;
      lfo.connect(lfoGain); lfoGain.connect(out.gain);
      out.connect(master);
      [1, 2.76, 5.4].forEach((r, i) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.type = i ? 'sine' : 'triangle'; o.frequency.value = 1400 * r;
        g.gain.setValueAtTime(0.18 / (i + 1), t);
        g.gain.setValueAtTime(0.18 / (i + 1), t + 1.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 2.3);
      });
      lfo.start(t); lfo.stop(t + 2.3);
    },
  },
  doorbell: { name: 'Ding Dong', play() { bellPartials(659.25, 0, 1.4, 0.4, [1, 2, 3]); bellPartials(523.25, 0.55, 2, 0.4, [1, 2, 3]); } },
  triangle: { name: 'Triangle', play() { [0, 0.18, 0.36].forEach((s) => bellPartials(2350, s, 2.5, 0.12, [1, 1.47, 2.09, 2.56])); } },
  gong: {
    name: 'Gong',
    play() { bellPartials(98, 0, 5, 0.5, [1, 1.52, 2.04, 2.67, 3.1, 4.2]); noise(0, 0.15, 0.2, 400); },
  },
  xylophone: {
    name: 'Xylophone',
    play() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone({ freq: f, start: i * 0.14, dur: 0.6, gain: 0.35 }); tone({ freq: f * 4, start: i * 0.14, dur: 0.12, gain: 0.08 }); }); },
  },
  whistle: {
    name: 'Whistle',
    play() {
      [0, 0.5].forEach((s) => {
        const { o } = tone({ freq: 2600, start: s, dur: 0.35, gain: 0.25, attack: 0.02 });
        const c = audioCtx(); const l = c.createOscillator(); const lg = c.createGain();
        l.frequency.value = 40; lg.gain.value = 90; l.connect(lg); lg.connect(o.frequency);
        l.start(c.currentTime + s); l.stop(c.currentTime + s + 0.4);
        noise(s, 0.35, 0.06, 2600);
      });
    },
  },
  harp: { name: 'Harp Glissando', play() { [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880, 1046.5].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.06, dur: 1.4, gain: 0.18 })); } },
  marimba: { name: 'Attention (Marimba)', play() { [[784, 0], [659.3, 0.22], [523.3, 0.44], [659.3, 0.66], [784, 0.88]].forEach(([f, s]) => tone({ freq: f, start: s, dur: 0.5, gain: 0.35 })); } },
  airhorn: {
    name: 'Air Horn',
    play() { [233, 294, 349].forEach((f) => tone({ freq: f, type: 'sawtooth', dur: 1.1, gain: 0.12, attack: 0.02 })); },
  },
};

export const fx = {
  tick() { noise(0, 0.02, 0.5, 4500); },
  tock() { noise(0, 0.02, 0.4, 2500); },
  pop() { tone({ freq: 900, glideTo: 200, dur: 0.25, gain: 0.35 }); },
  success() { [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.09, dur: 0.5, gain: 0.25 })); },
  fail() { [392, 330, 262].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.18, dur: 0.5, gain: 0.25 })); },
  warning() { [0, 0.3, 0.6].forEach((s) => { tone({ freq: 880, type: 'square', start: s, dur: 0.15, gain: 0.12 }); tone({ freq: 660, type: 'square', start: s + 0.15, dur: 0.15, gain: 0.12 }); }); },
  buzzer() { tone({ freq: 150, type: 'square', dur: 0.9, gain: 0.2 }); tone({ freq: 155, type: 'sawtooth', dur: 0.9, gain: 0.12 }); },
  click() { tone({ freq: 1200, dur: 0.04, gain: 0.15 }); },
  coin() { tone({ freq: 988, type: 'square', dur: 0.08, gain: 0.1 }); tone({ freq: 1319, type: 'square', start: 0.08, dur: 0.35, gain: 0.1 }); },
  roll() { for (let i = 0; i < 8; i++) noise(i * 0.06, 0.03, 0.4, 1500 + Math.random() * 2000); },
  heartGain() { [659.3, 880].forEach((f, i) => tone({ freq: f, start: i * 0.1, dur: 0.4, gain: 0.25 })); },
  play(name) { (SOUNDS[name] || SOUNDS.chime).play(); },
};

// ---- Speech ----
export function voices() {
  return 'speechSynthesis' in window ? speechSynthesis.getVoices().filter((v) => v.lang?.startsWith('en') || true) : [];
}

export const ttsEnabled = () => store.get('settings.tts', true) !== false;

export function speak(text, { interrupt = true, rate } = {}) {
  if (!('speechSynthesis' in window) || !text || !ttsEnabled()) return Promise.resolve();
  return new Promise((resolve) => {
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const name = store.get('settings.voice', '');
    const v = speechSynthesis.getVoices().find((x) => x.name === name);
    if (v) u.voice = v;
    u.rate = rate || store.get('settings.voiceRate', 1);
    u.volume = Math.min(1, store.get('settings.volume', 0.8) + 0.2);
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
    setTimeout(resolve, 15000);
  });
}

// ---- Wake lock (keep the screen on while a tool is open) ----
let wakeLock = null;
export async function keepAwake(on = true) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not allowed – ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wakeLock === null) keepAwake(true); });
