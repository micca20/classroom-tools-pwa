import { h, icon, fmtTime, spokenTime } from '../ui.js';
import { fx, speak } from '../audio.js';
import { store } from '../store.js';

// Timer engine lives at module level so it keeps running (and announcing) when you leave the tool.
const T = { endAt: 0, remaining: 0, total: 0, running: false, announced: new Set(), view: null, interval: null };
const S = (k, d) => store.get(`tools.timer.${k}`, d);

function remaining() { return T.running ? Math.max(0, (T.endAt - Date.now()) / 1000) : T.remaining; }

function ensureLoop() {
  if (T.interval) return;
  T.interval = setInterval(tick, 250);
}
function tick() {
  const r = remaining();
  if (T.running) {
    const whole = Math.ceil(r);
    const marks = [300, 120, 60, 30, 10];
    if (S('announce', true)) {
      for (const m of marks) {
        if (whole === m && !T.announced.has(m) && T.total > m + 1) {
          T.announced.add(m);
          speak(`${spokenTime(m)} remaining`);
        }
      }
    }
    if (S('countdown', true) && whole <= 5 && whole > 0 && !T.announced.has('c' + whole)) {
      T.announced.add('c' + whole); fx.tick();
    }
    if (r <= 0) {
      T.running = false; T.remaining = 0;
      fx.play(S('endSound', 'schoolBell'));
      const msg = S('endMessage', "Time's up!");
      if (msg) setTimeout(() => speak(msg), 1200);
      document.dispatchEvent(new CustomEvent('timer-done'));
    }
  }
  T.view?.();
  if (!T.running && !T.view) { clearInterval(T.interval); T.interval = null; }
}

export function addTime(secs) {
  if (T.running) { T.endAt += secs * 1000; T.total += secs; } else { T.remaining += secs; T.total = Math.max(T.total, T.remaining); }
  if (!T.running && S('autoStart', true)) start();
  for (const m of [...T.announced]) if (typeof m === 'number' && m < remaining()) T.announced.delete(m);
  ensureLoop(); tick();
}
function start() { if (T.remaining <= 0) return; T.endAt = Date.now() + T.remaining * 1000; T.running = true; ensureLoop(); }
function pause() { T.remaining = remaining(); T.running = false; }
function reset() { T.running = false; T.remaining = 0; T.total = 0; T.announced.clear(); tick(); }
export const timerStatus = () => ({ running: T.running, remaining: remaining() });

export default {
  id: 'timer', name: 'Timer', icon: 'timer', bg: '#BBDAF5', fg: '#5BA6E3',
  settings: [
    { key: 'increment', label: 'Each press adds', type: 'select', number: true, default: 60,
      options: [[10, '10 seconds'], [15, '15 seconds'], [30, '30 seconds'], [60, '1 minute'], [120, '2 minutes'], [300, '5 minutes']] },
    { key: 'autoStart', label: 'Start automatically after adding time', type: 'toggle', default: true },
    { key: 'announce', label: 'Announce time remaining', hint: '5 min, 2 min, 1 min, 30 s, 10 s', type: 'toggle', default: true },
    { key: 'countdown', label: 'Tick on the last 5 seconds', type: 'toggle', default: true },
    { key: 'endSound', label: 'End sound', type: 'select', default: 'schoolBell',
      options: [['schoolBell', 'School Bell'], ['chime', 'Chime'], ['doorbell', 'Ding Dong'], ['gong', 'Gong'], ['xylophone', 'Xylophone'], ['airhorn', 'Air Horn'], ['whistle', 'Whistle']] },
    { key: 'endMessage', label: 'Spoken at the end', type: 'text', default: "Time's up!" },
  ],
  mount(root, api) {
    const display = h('div', { class: 'big-num' }, '0:00');
    const bar = h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: { background: this.fg } }));
    const playBtn = h('button', { class: 'round-btn', onclick: () => { T.running ? pause() : start(); tick(); } }, icon('play'));
    const inc = () => api.get('increment', 60);
    const incLabel = () => (inc() >= 60 ? `+${inc() / 60} min` : `+${inc()} s`);
    const addBtn = h('button', { class: 'pill-btn', style: { background: this.fg }, onclick: () => addTime(inc()) }, incLabel());
    const presets = h('div', { class: 'chips' }, [1, 2, 3, 5, 10, 15, 20].map((m) =>
      h('button', { class: 'chip', onclick: () => { reset(); addTime(m * 60); } }, `${m} min`)));
    root.append(h('div', { class: 'center-stack' },
      h('div', { class: 'card big-card' }, display, bar),
      h('div', { class: 'row gap center' },
        h('button', { class: 'round-btn', onclick: () => { T.remaining = Math.max(0, remaining() - inc()); if (T.running) T.endAt = Date.now() + T.remaining * 1000; tick(); } }, icon('minus')),
        addBtn, playBtn,
        h('button', { class: 'round-btn', onclick: reset }, icon('reset'))),
      presets,
      h('p', { class: 'hint' }, 'Clicker: main button adds time · second button pauses')));
    T.view = () => {
      const r = remaining();
      display.textContent = fmtTime(Math.ceil(r));
      display.classList.toggle('urgent', T.running && r <= 10);
      bar.firstChild.style.width = `${T.total ? (r / T.total) * 100 : 0}%`;
      playBtn.innerHTML = '';
      playBtn.append(icon(T.running ? 'pause' : 'play'));
      addBtn.textContent = incLabel();
    };
    ensureLoop(); tick();
    return {
      primary: () => addTime(inc()),
      secondary: () => { T.running ? pause() : start(); tick(); },
      unmount: () => { T.view = null; },
    };
  },
};
