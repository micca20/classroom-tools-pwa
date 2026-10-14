import { h, icon } from '../ui.js';
import { fx, speak } from '../audio.js';

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const die = (n) => h('div', { class: 'die' }, Array.from({ length: 9 }, (_, i) => h('span', { class: (PIPS[n] || []).includes(i) ? 'pip' : '' })));

export default {
  id: 'dice', name: 'Coin & Dice', icon: 'dice', bg: '#B4E3D7', fg: '#3FAF96',
  settings: [
    { key: 'speak', label: 'Say the result', type: 'toggle', default: true },
  ],
  mount(root, api) {
    let mode = api.get('mode', 'dice');
    let count = api.get('count', 2);
    const stage = h('div', { class: 'dice-stage' });
    const result = h('div', { class: 'big-name sm' });
    const minI = h('input', { type: 'number', value: api.get('min', 1), onchange: (e) => api.set('min', Number(e.target.value)) });
    const maxI = h('input', { type: 'number', value: api.get('max', 100), onchange: (e) => api.set('max', Number(e.target.value)) });
    const countEl = h('span', { class: 'stepper-val' }, count);
    const opts = h('div', { class: 'row gap center' });
    const seg = h('div', { class: 'seg' }, ['coin', 'dice', 'number'].map((m) =>
      h('button', { 'data-m': m, onclick: () => { mode = m; api.set('mode', m); sync(); } }, m === 'coin' ? 'Coin' : m === 'dice' ? 'Dice' : 'Number')));
    const goBtn = h('button', { class: 'pill-btn', style: { background: this.fg }, onclick: () => go() }, 'Roll');
    const sync = () => {
      goBtn.textContent = mode === 'coin' ? 'Flip' : 'Roll';
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      opts.innerHTML = ''; stage.innerHTML = ''; result.textContent = '';
      if (mode === 'dice') {
        opts.append(h('button', { class: 'round-btn sm', onclick: () => { count = Math.max(1, count - 1); api.set('count', count); countEl.textContent = count; } }, icon('minus')), countEl,
          h('button', { class: 'round-btn sm', onclick: () => { count = Math.min(6, count + 1); api.set('count', count); countEl.textContent = count; } }, icon('plus')), h('span', { class: 'muted' }, 'dice'));
        for (let i = 0; i < count; i++) stage.append(die(i + 1));
      } else if (mode === 'number') {
        opts.append(h('label', { class: 'mini' }, 'From ', minI), h('label', { class: 'mini' }, 'To ', maxI));
      } else stage.append(h('div', { class: 'coin' }, h('div', { class: 'coin-face heads' }, 'H'), h('div', { class: 'coin-face tails' }, 'T')));
    };
    const go = () => {
      if (mode === 'coin') {
        const heads = Math.random() < 0.5;
        const coin = stage.querySelector('.coin');
        coin.style.transition = 'none'; coin.style.transform = 'rotateY(0)'; void coin.offsetWidth;
        coin.style.transition = ''; coin.style.transform = `rotateY(${(heads ? 1800 : 1980)}deg)`;
        fx.coin(); result.textContent = '';
        setTimeout(() => { result.textContent = heads ? 'Heads' : 'Tails'; if (api.get('speak', true)) speak(result.textContent); }, 1100);
      } else if (mode === 'dice') {
        fx.roll(); stage.innerHTML = '';
        const vals = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
        vals.forEach((v) => { const d = die(v); d.classList.add('rolling'); stage.append(d); });
        const total = vals.reduce((a, b) => a + b, 0);
        result.textContent = count > 1 ? `Total: ${total}` : String(total);
        if (api.get('speak', true)) setTimeout(() => speak(count > 1 ? `${vals.join(', ')}. Total ${total}` : String(total)), 500);
      } else {
        const lo = Math.min(Number(minI.value), Number(maxI.value)); const hi = Math.max(Number(minI.value), Number(maxI.value));
        let i = 0; const spin = setInterval(() => {
          result.textContent = lo + Math.floor(Math.random() * (hi - lo + 1)); fx.click();
          if (++i > 10) { clearInterval(spin); fx.success(); if (api.get('speak', true)) speak(result.textContent); }
        }, 60);
      }
    };
    root.append(h('div', { class: 'center-stack tap-area', onclick: (e) => { if (!e.target.closest('button,input,label')) go(); } },
      seg, opts, stage, result, goBtn));
    sync();
    return { primary: go, secondary: () => { mode = mode === 'coin' ? 'dice' : mode === 'dice' ? 'number' : 'coin'; api.set('mode', mode); sync(); } };
  },
};
