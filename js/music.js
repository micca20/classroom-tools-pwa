// Generative instrumental music engine (Web Audio). Every track is synthesized live, so it works offline.
import { audioCtx, masterOut } from './audio.js';

const NOTE = (m) => 440 * 2 ** ((m - 69) / 12);
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], minPent: [0, 3, 5, 7, 10],
};

export const MOODS = {
  calm:   { label: 'Calm', bpm: 66, scale: 'major', prog: [0, 5, 3, 4], lead: 'piano', pad: true, drums: 0, density: 0.35 },
  focus:  { label: 'Focus', bpm: 80, scale: 'lydian', prog: [0, 1, 0, 4], lead: 'bell', pad: true, drums: 0, density: 0.45 },
  lofi:   { label: 'Lo-fi', bpm: 78, scale: 'dorian', prog: [0, 3, 4, 6], lead: 'piano', pad: true, drums: 1, density: 0.4, swing: 0.18 },
  upbeat: { label: 'Upbeat', bpm: 118, scale: 'major', prog: [0, 4, 5, 3], lead: 'pluck', pad: false, drums: 2, density: 0.6 },
  dreamy: { label: 'Dreamy', bpm: 60, scale: 'pent', prog: [0, 3, 0, 4], lead: 'bell', pad: true, drums: 0, density: 0.25 },
  adventure: { label: 'Adventure', bpm: 100, scale: 'minor', prog: [0, 5, 2, 6], lead: 'pluck', pad: true, drums: 2, density: 0.55 },
  jazzy:  { label: 'Jazzy', bpm: 92, scale: 'dorian', prog: [1, 4, 0, 5], lead: 'piano', pad: false, drums: 1, density: 0.5, swing: 0.3, sevenths: true },
  celebrate: { label: 'Celebrate', bpm: 128, scale: 'major', prog: [0, 3, 4, 4], lead: 'pluck', pad: false, drums: 2, density: 0.7 },
  rain:   { label: 'Rainy Day', bpm: 70, scale: 'minPent', prog: [0, 3, 2, 4], lead: 'piano', pad: true, drums: 0, density: 0.3, rain: true },
  mystery: { label: 'Mystery', bpm: 84, scale: 'minor', prog: [0, 0, 5, 4], lead: 'bell', pad: true, drums: 1, density: 0.35 },
};

const ADJ = ['Sunny', 'Quiet', 'Golden', 'Paper', 'Velvet', 'Morning', 'Maple', 'Cloud', 'River', 'Crayon', 'Lantern', 'Meadow', 'Marble', 'Cocoa', 'Starlit', 'Pebble'];
const NOUN = ['Steps', 'Garden', 'Notebook', 'Breeze', 'Window', 'Library', 'Recess', 'Daydream', 'Puzzle', 'Harbor', 'Orbit', 'Hallway', 'Kite', 'Waves', 'Pencils', 'Clouds'];
export const TRACKS = [];
Object.keys(MOODS).forEach((mood, mi) => {
  for (let v = 0; v < 16; v++) {
    const seed = mi * 100 + v + 1;
    TRACKS.push({ id: `${mood}-${v}`, mood, seed, title: `${ADJ[(seed * 7) % ADJ.length]} ${NOUN[(seed * 11 + v) % NOUN.length]}`, key: (seed * 5) % 12 });
  }
});

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

let P = null; // current player state
export const isPlaying = () => !!P;
export const current = () => P?.track;

export function play(track, { volume = 0.7 } = {}) {
  stop();
  const c = audioCtx();
  const mood = MOODS[track.mood];
  const out = c.createGain(); out.gain.value = 0; out.connect(masterOut());
  out.gain.linearRampToValueAtTime(volume, c.currentTime + 1.5);
  // gentle reverb via feedback delay
  const delay = c.createDelay(); delay.delayTime.value = 0.33;
  const fb = c.createGain(); fb.gain.value = 0.28;
  const wet = c.createGain(); wet.gain.value = 0.25;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(out);
  const bus = c.createGain(); bus.connect(out); bus.connect(delay);
  const r = rng(track.seed);
  const root = 48 + track.key % 12;
  const scale = SCALES[mood.scale];
  const deg = (d, oct = 0) => root + scale[((d % scale.length) + scale.length) % scale.length] + 12 * (oct + Math.floor(d / scale.length));
  const beat = 60 / mood.bpm;
  const step = beat / 2; // eighth notes
  const motif = Array.from({ length: 8 }, () => (r() < mood.density ? Math.floor(r() * 8) : null));
  let n = 0; let t = c.currentTime + 0.1;
  let rainNode = null;
  if (mood.rain) rainNode = rainLoop(c, out);

  const voice = (type, freq, when, dur, gain) => {
    const o = c.createOscillator(); const g = c.createGain();
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    if (type === 'piano') { o.type = 'triangle'; f.frequency.value = 2400; }
    else if (type === 'bell') { o.type = 'sine'; f.frequency.value = 6000; }
    else if (type === 'pluck') { o.type = 'square'; f.frequency.setValueAtTime(3500, when); f.frequency.exponentialRampToValueAtTime(400, when + dur); gain *= 0.5; }
    else if (type === 'bass') { o.type = 'sine'; f.frequency.value = 600; }
    else { o.type = 'sawtooth'; f.frequency.value = 900; }
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    const atk = type === 'pad' ? dur * 0.4 : 0.01;
    g.gain.exponentialRampToValueAtTime(gain, when + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(when); o.stop(when + dur + 0.1);
    if (type === 'bell') { const o2 = c.createOscillator(); const g2 = c.createGain(); o2.frequency.value = freq * 2.76; g2.gain.setValueAtTime(gain * 0.25, when); g2.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.5); o2.connect(g2); g2.connect(bus); o2.start(when); o2.stop(when + dur); }
  };
  const drum = (kind, when) => {
    if (kind === 'kick') { const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(45, when + 0.15); g.gain.setValueAtTime(0.5, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3); o.connect(g); g.connect(out); o.start(when); o.stop(when + 0.35); return; }
    const len = Math.floor(c.sampleRate * (kind === 'hat' ? 0.04 : 0.15));
    const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = c.createGain(); g.gain.value = kind === 'hat' ? 0.12 : 0.3;
    s.connect(f); f.connect(g); g.connect(out); s.start(when);
  };

  const schedule = () => {
    while (t < c.currentTime + 0.3) {
      const bar = Math.floor(n / 8); const pos = n % 8;
      const chordDeg = mood.prog[bar % mood.prog.length];
      const swing = mood.swing && pos % 2 ? step * mood.swing : 0;
      const when = t + swing;
      if (pos === 0) {
        voice('bass', NOTE(deg(chordDeg, -1)), when, beat * 3.5, 0.3);
        if (mood.pad) [0, 2, 4, mood.sevenths ? 6 : null].filter((x) => x != null).forEach((d) => voice('pad', NOTE(deg(chordDeg + d)), when, beat * 4.2, 0.045));
      }
      if (pos === 4 && mood.drums < 2) voice('bass', NOTE(deg(chordDeg + 4, -1)), when, beat * 1.5, 0.18);
      if (!mood.pad && pos % 2 === 0) [0, 2, 4].forEach((d) => voice('piano', NOTE(deg(chordDeg + d)), when, beat * 0.9, 0.05));
      const m = motif[(pos + (bar % 4 === 3 ? 3 : 0)) % 8];
      if (m != null && r() < 0.88) voice(mood.lead, NOTE(deg(chordDeg + m, 1)), when, beat * (mood.lead === 'pluck' ? 0.6 : 1.8), 0.12);
      if (bar % 8 === 7 && pos === 7) for (let i = 0; i < 8; i++) if (r() < 0.25) motif[i] = r() < mood.density ? Math.floor(r() * 8) : null;
      if (mood.drums) {
        if (pos === 0 || (mood.drums === 2 && pos === 4) || (mood.drums === 1 && pos === 5 && bar % 2)) drum('kick', when);
        if (pos === 2 || pos === 6) drum('snare', when);
        if (mood.drums === 2 || pos % 2 === 0) drum('hat', when);
      }
      t += step; n++;
    }
  };
  const iv = setInterval(schedule, 80); schedule();
  P = { track, out, iv, rainNode };
}

function rainLoop(c, out) {
  const len = c.sampleRate * 2; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; s.loop = true;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
  const g = c.createGain(); g.gain.value = 0.06; s.connect(f); f.connect(g); g.connect(out); s.start();
  return s;
}

export function setVolume(v) { if (P) P.out.gain.setTargetAtTime(v, audioCtx().currentTime, 0.2); }

export function stop(fade = 0.8) {
  if (!P) return;
  const c = audioCtx(); const p = P; P = null;
  clearInterval(p.iv);
  p.out.gain.cancelScheduledValues(c.currentTime);
  p.out.gain.setTargetAtTime(0, c.currentTime, fade / 4);
  setTimeout(() => { p.out.disconnect(); p.rainNode?.stop(); }, fade * 1000 + 300);
}
