import { h, icon } from '../ui.js';
import { fx, speak } from '../audio.js';
import { currentClass } from '../store.js';

export default {
  id: 'tallies', name: 'Tallies', icon: 'tallies', bg: '#EFE0B0', fg: '#C9A945',
  settings: [
    { key: 'posLabel', label: 'Positive label', type: 'text', default: 'Class Points' },
    { key: 'negLabel', label: 'Negative label', type: 'text', default: 'Teacher Points' },
    { key: 'goal', label: 'Goal (celebrate when reached, 0 = off)', type: 'number', default: 10, min: 0 },
    { key: 'speak', label: 'Announce the score', type: 'toggle', default: false },
  ],
  mount(root, api) {
    const cls = currentClass();
    const k = `counts.${cls?.id || 'none'}`;
    const get = () => api.get(k, { pos: 0, neg: 0 });
    const posN = h('div', { class: 'tally-num' });
    const negN = h('div', { class: 'tally-num' });
    const marks = (n) => '𝍸'.repeat(Math.floor(n / 5)) + '|'.repeat(n % 5);
    const posM = h('div', { class: 'tally-marks' });
    const negM = h('div', { class: 'tally-marks' });
    const render = () => { const c = get(); posN.textContent = c.pos; negN.textContent = c.neg; posM.textContent = marks(Math.min(c.pos, 60)); negM.textContent = marks(Math.min(c.neg, 60)); };
    const bump = (which, d) => {
      const c = get(); c[which] = Math.max(0, c[which] + d); api.set(k, c); render();
      if (d > 0) {
        which === 'pos' ? fx.coin() : fx.buzzer();
        const goal = api.get('goal', 10);
        if (which === 'pos' && goal && c.pos === goal) { setTimeout(() => { fx.success(); speak(`Goal reached! ${goal} ${api.get('posLabel', 'Class Points')}!`); }, 300); }
        else if (api.get('speak', false)) speak(`${c.pos} to ${c.neg}`);
      }
    };
    const panel = (which, label, numEl, markEl, cls_) => h('div', { class: `tally-panel ${cls_}` },
      h('div', { class: 'tally-label' }, label),
      h('button', { class: 'tally-hit', onclick: () => bump(which, 1) }, numEl, markEl),
      h('div', { class: 'row gap center' },
        h('button', { class: 'round-btn sm', onclick: () => bump(which, -1) }, icon('minus')),
        h('button', { class: 'round-btn sm', onclick: () => bump(which, 1) }, icon('plus'))));
    root.append(h('div', { class: 'stack' },
      h('div', { class: 'class-tag' }, cls?.name || ''),
      h('div', { class: 'tally-wrap' },
        panel('pos', api.get('posLabel', 'Class Points'), posN, posM, 'pos'),
        panel('neg', api.get('negLabel', 'Teacher Points'), negN, negM, 'neg')),
      h('button', { class: 'btn', onclick: () => { api.set(k, { pos: 0, neg: 0 }); render(); } }, icon('reset'), ' Reset')));
    render();
    return { primary: () => bump('pos', 1), secondary: () => bump('neg', 1) };
  },
};
