import { h, icon, fmtTime } from '../ui.js';
import { fx, speak } from '../audio.js';
import { currentClass } from '../store.js';

export default {
  id: 'hearts', name: 'Hearts', icon: 'hearts', bg: '#F7C6E6', fg: '#E77CC6',
  settings: [
    { key: 'max', label: 'Number of hearts', type: 'range', min: 1, max: 10, default: 5 },
    { key: 'regen', label: 'Refill one heart every', type: 'select', number: true, default: 10,
      options: [[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour']] },
    { key: 'emptyMessage', label: 'Spoken when all hearts are gone', type: 'text', default: 'Oh no, we are out of hearts!' },
  ],
  mount(root, api) {
    const cls = currentClass();
    const k = `state.${cls?.id || 'none'}`;
    const max = () => api.get('max', 5);
    const load = () => {
      const s = api.get(k, { count: max(), since: Date.now() });
      const regen = api.get('regen', 10) * 60000;
      if (regen && s.count < max()) {
        const gained = Math.floor((Date.now() - s.since) / regen);
        if (gained > 0) { s.count = Math.min(max(), s.count + gained); s.since += gained * regen; api.set(k, s); if (mounted) fx.heartGain(); }
      }
      if (s.count >= max()) s.since = Date.now();
      return s;
    };
    let mounted = false;
    const row = h('div', { class: 'hearts-row' });
    const info = h('div', { class: 'hint' });
    const render = () => {
      const s = load();
      row.innerHTML = '';
      for (let i = 0; i < max(); i++) row.append(h('span', { class: 'heart' + (i < s.count ? '' : ' lost') }, icon('hearts')));
      const regen = api.get('regen', 10) * 60000;
      info.textContent = s.count >= max() ? 'All hearts full' : regen ? `Next heart in ${fmtTime((s.since + regen - Date.now()) / 1000)}` : `${s.count} of ${max()} hearts`;
    };
    const lose = () => {
      const s = load();
      if (s.count <= 0) return;
      s.count--; if (s.count === max() - 1) s.since = Date.now();
      api.set(k, s); fx.pop(); render();
      const last = row.children[s.count]; last?.classList.add('breaking');
      if (s.count === 0) setTimeout(() => { fx.fail(); speak(api.get('emptyMessage', 'Oh no, we are out of hearts!')); }, 400);
    };
    const gain = () => { const s = load(); if (s.count < max()) { s.count++; api.set(k, s); fx.heartGain(); render(); } };
    root.append(h('div', { class: 'center-stack tap-area', onclick: (e) => { if (!e.target.closest('button')) lose(); } },
      h('div', { class: 'class-tag' }, cls?.name || ''), row, info,
      h('div', { class: 'row gap center' },
        h('button', { class: 'pill-btn', style: { background: this.fg }, onclick: lose }, 'Lose a heart'),
        h('button', { class: 'round-btn', title: 'Add heart', onclick: gain }, icon('plus')),
        h('button', { class: 'round-btn', title: 'Refill', onclick: () => { api.set(k, { count: max(), since: Date.now() }); render(); fx.heartGain(); } }, icon('reset'))),
      h('p', { class: 'hint' }, 'Tap anywhere or press your clicker to remove a heart')));
    render(); mounted = true;
    const iv = setInterval(render, 1000);
    return { primary: lose, secondary: gain, unmount: () => clearInterval(iv) };
  },
};
