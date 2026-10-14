import { h, icon } from '../ui.js';
import { SOUNDS, fx, speak } from '../audio.js';

export default {
  id: 'bell', name: 'Bell', icon: 'bell', bg: '#F7EC9B', fg: '#E3C62B',
  settings: [
    { key: 'sound', label: 'Sound', type: 'select', default: 'chime', options: Object.entries(SOUNDS).map(([k, v]) => [k, v.name]) },
    { key: 'altSound', label: 'Second button sound', hint: 'Clicker “back” button', type: 'select', default: 'schoolBell', options: Object.entries(SOUNDS).map(([k, v]) => [k, v.name]) },
    { key: 'message', label: 'Spoken message after bell (optional)', type: 'text', default: '', placeholder: 'e.g. Eyes on me!' },
  ],
  mount(root, api) {
    const ring = (alt) => {
      const s = api.get(alt ? 'altSound' : 'sound', alt ? 'schoolBell' : 'chime');
      fx.play(s);
      big.classList.remove('ringing'); void big.offsetWidth; big.classList.add('ringing');
      const msg = api.get('message', '');
      if (msg) setTimeout(() => speak(msg), 1400);
    };
    const big = h('button', { class: 'bell-big', onclick: () => ring(false), 'aria-label': 'Ring bell' }, icon('bell'));
    const chips = h('div', { class: 'chips' }, Object.entries(SOUNDS).map(([k, v]) =>
      h('button', { class: 'chip' + (api.get('sound', 'chime') === k ? ' on' : ''), onclick: (e) => {
        api.set('sound', k);
        chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
        e.currentTarget.classList.add('on');
        fx.play(k);
      } }, v.name)));
    root.append(h('div', { class: 'center-stack' }, big, h('p', { class: 'hint' }, 'Tap the bell or press your clicker'), chips));
    return { primary: () => ring(false), secondary: () => ring(true) };
  },
};
