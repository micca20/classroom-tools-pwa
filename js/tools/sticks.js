import { h, icon, shuffle, toast } from '../ui.js';
import { fx, speak } from '../audio.js';
import { currentClass } from '../store.js';

export default {
  id: 'sticks', name: 'Sticks', icon: 'sticks', bg: '#B5DDAE', fg: '#5FB25A',
  settings: [
    { key: 'noRepeat', label: 'No repeats until everyone is called', type: 'toggle', default: true },
    { key: 'speak', label: 'Say the name out loud', type: 'toggle', default: true },
    { key: 'prefix', label: 'Spoken before the name (optional)', type: 'text', default: '', placeholder: 'e.g. Next up,' },
    { key: 'shuffleAnim', label: 'Shuffle animation', type: 'toggle', default: true },
  ],
  mount(root, api) {
    const cls = currentClass();
    const poolKey = `pool.${cls?.id}`;
    const nameEl = h('div', { class: 'big-name' }, 'Tap to draw');
    const sub = h('div', { class: 'hint' });
    const history = h('div', { class: 'chips small' });
    let busy = false;

    const refreshSub = () => {
      if (!cls?.students.length) { sub.textContent = 'Add students in Classes first.'; return; }
      const pool = api.get(poolKey, null);
      sub.textContent = api.get('noRepeat', true) ? `${pool ? pool.length : cls.students.length} of ${cls.students.length} sticks left in the cup` : `${cls.students.length} students`;
    };
    const renderHistory = () => {
      history.innerHTML = '';
      api.get(`history.${cls?.id}`, []).slice(-12).reverse().forEach((n) => history.append(h('span', { class: 'chip' }, n)));
    };

    const draw = () => {
      if (busy) return;
      if (!cls?.students.length) { toast('Add students to this class first'); return; }
      let pick;
      if (api.get('noRepeat', true)) {
        let pool = api.get(poolKey, null)?.filter((n) => cls.students.includes(n));
        if (!pool || !pool.length) { pool = shuffle(cls.students); if (api.get(poolKey, null)) toast('All sticks used — cup refilled!'); }
        pick = pool.shift();
        api.set(poolKey, pool);
      } else {
        pick = cls.students[Math.floor(Math.random() * cls.students.length)];
      }
      const finish = () => {
        nameEl.textContent = pick;
        nameEl.classList.remove('pop'); void nameEl.offsetWidth; nameEl.classList.add('pop');
        fx.pop();
        if (api.get('speak', true)) speak(`${api.get('prefix', '')} ${pick}`.trim());
        api.set(`history.${cls.id}`, [...api.get(`history.${cls.id}`, []), pick].slice(-50));
        renderHistory(); refreshSub(); busy = false;
      };
      if (api.get('shuffleAnim', true)) {
        busy = true; let i = 0;
        const spin = setInterval(() => {
          nameEl.textContent = cls.students[Math.floor(Math.random() * cls.students.length)];
          fx.click();
          if (++i > 9) { clearInterval(spin); finish(); }
        }, 70);
      } else finish();
    };

    const resetPool = () => { api.set(poolKey, null); api.set(`history.${cls?.id}`, []); nameEl.textContent = 'Tap to draw'; renderHistory(); refreshSub(); toast('Cup refilled'); };

    root.append(h('div', { class: 'center-stack tap-area', onclick: (e) => { if (!e.target.closest('button')) draw(); } },
      h('div', { class: 'class-tag' }, cls?.name || 'No class'),
      nameEl, sub,
      h('div', { class: 'row gap center' },
        h('button', { class: 'pill-btn', style: { background: this.fg }, onclick: draw }, 'Draw a stick'),
        h('button', { class: 'round-btn', title: 'Refill cup', onclick: resetPool }, icon('reset'))),
      h('div', { class: 'section-label' }, 'Recently called'), history));
    refreshSub(); renderHistory();
    return { primary: draw, secondary: resetPool };
  },
};
