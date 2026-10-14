import { h, icon, shuffle, toast } from '../ui.js';
import { fx, speak } from '../audio.js';
import { currentClass } from '../store.js';

export function makeGroups(students, { mode, value, unwanted = [], avoidPrev = [] }) {
  const n = students.length;
  if (!n) return [];
  const groupCount = mode === 'count' ? Math.max(1, Math.min(n, value)) : Math.max(1, Math.round(n / Math.max(1, value)));
  const bad = new Set(unwanted.map(([a, b]) => [a, b].sort().join('|')));
  const prev = new Set(avoidPrev.map(([a, b]) => [a, b].sort().join('|')));
  let best = null; let bestScore = Infinity;
  for (let attempt = 0; attempt < 600 && bestScore > 0; attempt++) {
    const s = shuffle(students);
    const groups = Array.from({ length: groupCount }, () => []);
    s.forEach((name, i) => groups[i % groupCount].push(name));
    let score = 0;
    for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const k = [g[i], g[j]].sort().join('|');
      if (bad.has(k)) score += 100;
      if (prev.has(k)) score += 1;
    }
    if (score < bestScore) { bestScore = score; best = groups; }
  }
  return best;
}

const COLORS = ['#F7B2B2', '#B5DDAE', '#BBDAF5', '#F7EC9B', '#D5C3F0', '#F7CF8A', '#A8DDD0', '#F4B8C8', '#C8C8F2', '#E3CFA3'];

export default {
  id: 'groups', name: 'Groups', icon: 'groups', bg: '#D5C3F0', fg: '#9B79D8',
  settings: [
    { key: 'speak', label: 'Read groups out loud', type: 'toggle', default: true },
    { key: 'avoidRepeat', label: 'Try not to repeat last time’s partners', type: 'toggle', default: true },
  ],
  mount(root, api) {
    const cls = currentClass();
    let absent = new Set(api.get(`absent.${cls?.id}`, []));
    let mode = api.get('mode', 'size');
    let value = api.get('value', 3);
    const out = h('div', { class: 'group-grid' });
    const valEl = h('span', { class: 'stepper-val' });
    const modeSel = h('div', { class: 'seg' },
      h('button', { 'data-m': 'size' }, 'Students per group'),
      h('button', { 'data-m': 'count' }, 'Number of groups'));
    const sync = () => {
      valEl.textContent = value;
      modeSel.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    };
    modeSel.addEventListener('click', (e) => { const m = e.target.closest('button')?.dataset.m; if (m) { mode = m; api.set('mode', m); sync(); } });
    const step = (d) => { value = Math.max(1, Math.min(30, value + d)); api.set('value', value); sync(); };

    const render = (groups) => {
      out.innerHTML = '';
      groups.forEach((g, i) => out.append(h('div', { class: 'group-card', style: { background: COLORS[i % COLORS.length] } },
        h('div', { class: 'group-title' }, `Group ${i + 1}`), g.map((n) => h('div', { class: 'group-name' }, n)))));
    };
    const generate = () => {
      if (!cls?.students.length) { toast('Add students to this class first'); return; }
      const present = cls.students.filter((s) => !absent.has(s));
      const last = api.get(`last.${cls.id}`, []);
      const prevPairs = api.get('avoidRepeat', true) ? last.flatMap((g) => g.flatMap((a, i) => g.slice(i + 1).map((b) => [a, b]))) : [];
      const groups = makeGroups(present, { mode, value, unwanted: cls.unwanted || [], avoidPrev: prevPairs });
      api.set(`last.${cls.id}`, groups);
      render(groups); fx.success();
      if (api.get('speak', true)) speak(groups.map((g, i) => `Group ${i + 1}: ${g.join(', ')}.`).join(' '));
    };
    const absentBox = h('details', { class: 'absent' }, h('summary', {}, 'Mark absent students'),
      h('div', { class: 'chips small' }, (cls?.students || []).map((s) => h('button', {
        class: 'chip' + (absent.has(s) ? ' off' : ''),
        onclick: (e) => { absent.has(s) ? absent.delete(s) : absent.add(s); e.currentTarget.classList.toggle('off'); api.set(`absent.${cls.id}`, [...absent]); },
      }, s))));

    root.append(h('div', { class: 'stack' },
      h('div', { class: 'class-tag' }, cls?.name || 'No class'),
      modeSel,
      h('div', { class: 'row gap center' },
        h('button', { class: 'round-btn', onclick: () => step(-1) }, icon('minus')), valEl,
        h('button', { class: 'round-btn', onclick: () => step(1) }, icon('plus')),
        h('button', { class: 'pill-btn', style: { background: this.fg }, onclick: generate }, 'Make groups')),
      absentBox, out));
    sync();
    const last = api.get(`last.${cls?.id}`, null);
    if (last) render(last);
    return { primary: generate, secondary: () => { const l = api.get(`last.${cls?.id}`, []); speak(l.map((g, i) => `Group ${i + 1}: ${g.join(', ')}.`).join(' ')); } };
  },
};
