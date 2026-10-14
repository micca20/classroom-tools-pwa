import { h, icon, fmtTime } from '../ui.js';
import { fx, speak } from '../audio.js';
import { store, currentClass } from '../store.js';

const S = (k, d) => store.get(`tools.timeLost.${k}`, d);
const E = { startedAt: 0, running: false, view: null, iv: null, lastTick: 0 };
const key = () => `tools.timeLost.total.${currentClass()?.id || 'none'}.${new Date().toDateString()}`;
const total = () => store.get(key(), 0) + (E.running ? (Date.now() - E.startedAt) / 1000 : 0);

function loop() {
  if (E.iv) return;
  E.iv = setInterval(() => {
    if (E.running && S('tick', true)) { const s = Math.floor(total()); if (s !== E.lastTick) { E.lastTick = s; s % 2 ? fx.tock() : fx.tick(); } }
    E.view?.();
    if (!E.running && !E.view) { clearInterval(E.iv); E.iv = null; }
  }, 100);
}
function toggle() {
  if (E.running) {
    store.set(key(), store.get(key(), 0) + (Date.now() - E.startedAt) / 1000);
    E.running = false;
    fx.click();
  } else {
    E.startedAt = Date.now(); E.running = true;
    if (S('warn', true)) fx.warning();
    const msg = S('message', 'We are losing time.');
    if (msg) setTimeout(() => speak(msg), 900);
    loop();
  }
  E.view?.();
}

export default {
  id: 'timeLost', name: 'Time Lost', icon: 'timeLost', bg: '#F7C1C1', fg: '#E36D6D',
  settings: [
    { key: 'warn', label: 'Warning sound when starting', type: 'toggle', default: true },
    { key: 'tick', label: 'Clock tick while running', type: 'toggle', default: true },
    { key: 'message', label: 'Spoken when starting', type: 'text', default: 'We are losing time.' },
    { key: 'multiplier', label: 'Time owed multiplier', hint: 'e.g. 2× = students owe double', type: 'select', number: true, default: 1, options: [[1, '1×'], [2, '2×'], [3, '3×']] },
  ],
  mount(root, api) {
    const disp = h('div', { class: 'big-num' });
    const owed = h('div', { class: 'hint' });
    const btn = h('button', { class: 'pill-btn big', style: { background: this.fg }, onclick: toggle });
    root.append(h('div', { class: 'center-stack' },
      h('div', { class: 'class-tag' }, `${currentClass()?.name || ''} · Today`),
      h('div', { class: 'card big-card' }, disp, owed),
      btn,
      h('button', { class: 'btn', onclick: () => { E.running = false; store.set(key(), 0); E.view?.(); } }, icon('reset'), ' Reset today'),
      h('p', { class: 'hint' }, 'Clicker: main button starts/stops the clock')));
    E.view = () => {
      const t = total();
      disp.textContent = fmtTime(t);
      disp.classList.toggle('urgent', E.running);
      owed.textContent = `Time owed: ${fmtTime(t * api.get('multiplier', 1))}`;
      btn.textContent = E.running ? 'Stop the clock' : 'Start losing time';
    };
    loop(); E.view();
    return { primary: toggle, secondary: toggle, unmount: () => { E.view = null; } };
  },
};
