import { h, icon, fmtTime, toast } from '../ui.js';
import { fx, speak } from '../audio.js';
import { store, currentClass } from '../store.js';

const S = (k, d) => store.get(`tools.hallPass.${k}`, d);
const out = () => store.get('tools.hallPass.out', []); // [{name, place, at}]
let iv = null; let view = null;
function watch() {
  if (iv) return;
  iv = setInterval(() => {
    const limit = S('limit', 5) * 60000;
    const list = out();
    let changed = false;
    for (const o of list) {
      if (limit && !o.warned && Date.now() - o.at > limit) {
        o.warned = true; changed = true;
        fx.warning(); setTimeout(() => speak(`${o.name} has been gone for ${S('limit', 5)} minutes.`), 900);
      }
    }
    if (changed) store.set('tools.hallPass.out', list);
    view?.();
    if (!list.length && !view) { clearInterval(iv); iv = null; }
  }, 1000);
}

export default {
  id: 'hallPass', name: 'Hall Pass', icon: 'hallPass', bg: '#DCD8EC', fg: '#8E86B8',
  settings: [
    { key: 'limit', label: 'Warn after', type: 'select', number: true, default: 5, options: [[0, 'Never'], [2, '2 minutes'], [3, '3 minutes'], [5, '5 minutes'], [8, '8 minutes'], [10, '10 minutes'], [15, '15 minutes']] },
    { key: 'max', label: 'Students out at once', type: 'range', min: 1, max: 5, default: 1 },
    { key: 'places', label: 'Destinations (comma separated)', type: 'text', default: 'Restroom, Water, Nurse, Office, Library' },
  ],
  mount(root) {
    const cls = currentClass();
    let place = S('places', 'Restroom, Water, Nurse, Office, Library').split(',')[0].trim();
    const outList = h('div', { class: 'list' });
    const places = h('div', { class: 'seg wrap' }, S('places', 'Restroom, Water, Nurse, Office, Library').split(',').map((p) => p.trim()).filter(Boolean).map((p) =>
      h('button', { class: p === place ? 'on' : '', onclick: (e) => { place = p; places.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, p)));
    const names = h('div', { class: 'chips' }, (cls?.students || []).map((n) => h('button', { class: 'chip', onclick: () => sign(n) }, n)));
    const logEl = h('div', { class: 'list small' });

    function sign(name) {
      const list = out();
      const existing = list.find((o) => o.name === name);
      if (existing) return back(name);
      if (list.length >= S('max', 1)) { toast(`Only ${S('max', 1)} out at a time`); fx.buzzer(); return; }
      list.push({ name, place, at: Date.now() });
      store.set('tools.hallPass.out', list); fx.click(); speak(`${name}, ${place}`); watch(); render();
    }
    function back(name) {
      const list = out(); const o = list.find((x) => x.name === name);
      if (!o) return;
      store.set('tools.hallPass.out', list.filter((x) => x !== o));
      store.set('hallLog', [{ ...o, back: Date.now(), cls: cls?.name }, ...store.get('hallLog', [])].slice(0, 300));
      fx.heartGain(); render();
    }
    function render() {
      outList.innerHTML = '';
      const list = out();
      if (!list.length) outList.append(h('div', { class: 'empty' }, 'Everyone is in class'));
      for (const o of list) {
        const secs = (Date.now() - o.at) / 1000;
        outList.append(h('div', { class: 'list-item' + (o.warned ? ' warn' : '') },
          h('div', {}, h('b', {}, o.name), h('div', { class: 'muted' }, o.place)),
          h('div', { class: 'mono' }, fmtTime(secs)),
          h('button', { class: 'btn primary', onclick: () => back(o.name) }, 'Back')));
      }
      logEl.innerHTML = '';
      store.get('hallLog', []).slice(0, 15).forEach((l) => logEl.append(h('div', { class: 'list-item' },
        h('span', {}, `${l.name} · ${l.place}`), h('span', { class: 'muted' }, `${new Date(l.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date(l.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${fmtTime((l.back - l.at) / 1000)}`))));
    }
    root.append(h('div', { class: 'stack' },
      h('div', { class: 'section-label' }, 'Out of class'), outList,
      h('div', { class: 'section-label' }, 'Going to'), places,
      h('div', { class: 'section-label' }, `Tap a student (${cls?.name || 'no class'})`), names,
      h('details', {}, h('summary', {}, 'Recent log'), logEl,
        h('button', { class: 'btn', onclick: () => { store.set('hallLog', []); render(); } }, icon('trash'), ' Clear log'))));
    view = render; render(); watch();
    return { primary: () => { const o = out()[0]; if (o) back(o.name); }, secondary: () => {}, unmount: () => { view = null; } };
  },
};
