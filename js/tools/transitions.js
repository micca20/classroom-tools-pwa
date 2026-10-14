import { h, icon, fmtTime, sheet } from '../ui.js';
import { fx, speak } from '../audio.js';
import { uid } from '../store.js';
import * as M from '../music.js';

const DEFAULTS = [
  { id: 't1', name: 'Clean Up', seconds: 120, mood: 'upbeat', start: 'Time to clean up! Put your materials away.', end: 'Clean up time is over. Thank you!' },
  { id: 't2', name: 'Line Up', seconds: 60, mood: 'celebrate', start: 'Please quietly line up at the door.', end: 'Everyone should be in line now.' },
  { id: 't3', name: 'Get Materials', seconds: 90, mood: 'focus', start: 'Grab your materials and get ready.', end: 'Materials time is over. Eyes up front.' },
  { id: 't4', name: 'Back to Seats', seconds: 45, mood: 'adventure', start: 'Head back to your seats.', end: 'Everyone in their seats. Thank you!' },
];
let run = null; // { t, endAt, iv }

export default {
  id: 'transitions', name: 'Transitions', icon: 'transitions', bg: '#F6C4D2', fg: '#E07A9A',
  mount(root, api) {
    const fg = this.fg;
    const list = () => api.get('list', DEFAULTS);
    const area = h('div', { class: 'stack' });
    const disp = h('div', { class: 'big-num' });
    const label = h('div', { class: 'big-name sm' });

    function begin(t) {
      end(true);
      speak(t.start);
      M.play(M.TRACKS.find((x) => x.mood === t.mood) || M.TRACKS[0], { volume: 0.5 });
      run = { t, endAt: Date.now() + t.seconds * 1000 };
      run.iv = setInterval(() => { if (run && Date.now() >= run.endAt) end(); }, 250);
      draw();
    }
    function end(silent) {
      if (!run) return;
      clearInterval(run.iv); M.stop(1.5);
      const t = run.t; run = null;
      if (!silent) { fx.play('chime'); setTimeout(() => speak(t.end), 1300); }
      draw();
    }
    function edit(t) {
      const isNew = !t; t = t ? { ...t } : { id: uid(), name: 'New Transition', seconds: 60, mood: 'upbeat', start: '', end: '' };
      sheet(isNew ? 'New transition' : 'Edit transition', (body, close) => {
        const f = (lbl, el) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, lbl), el);
        const name = h('input', { value: t.name });
        const secs = h('input', { type: 'number', min: 5, value: t.seconds });
        const mood = h('select', {}, Object.entries(M.MOODS).map(([k, m]) => h('option', { value: k, selected: k === t.mood }, m.label)));
        const st = h('input', { value: t.start }); const en = h('input', { value: t.end });
        body.append(f('Name', name), f('Length (seconds)', secs), f('Music', mood), f('Say at start', st), f('Say at end', en),
          h('div', { class: 'row gap' },
            !isNew && h('button', { class: 'btn danger', onclick: () => { api.set('list', list().filter((x) => x.id !== t.id)); close(); draw(); } }, icon('trash'), ' Delete'),
            h('button', { class: 'btn primary', onclick: () => {
              Object.assign(t, { name: name.value, seconds: Number(secs.value) || 60, mood: mood.value, start: st.value, end: en.value });
              api.set('list', isNew ? [...list(), t] : list().map((x) => (x.id === t.id ? t : x))); close(); draw();
            } }, 'Save')));
      });
    }
    function draw() {
      if (!area.isConnected && area.childNodes.length) return;
      area.innerHTML = '';
      if (run) {
        disp.textContent = fmtTime((run.endAt - Date.now()) / 1000);
        label.textContent = run.t.name;
        area.append(h('div', { class: 'card big-card' }, label, disp),
          h('div', { class: 'row gap center' },
            h('button', { class: 'pill-btn', style: { background: fg }, onclick: () => { run.endAt += 30000; draw(); } }, '+30 s'),
            h('button', { class: 'btn', onclick: () => end() }, 'Finish now')));
      } else {
        area.append(h('div', { class: 'section-label' }, 'Pick a transition'),
          h('div', { class: 'trans-grid' }, list().map((t) => h('div', { class: 'trans-card' },
            h('button', { class: 'trans-go', onclick: () => begin(t) }, h('b', {}, t.name), h('span', { class: 'muted' }, `${fmtTime(t.seconds)} · ${M.MOODS[t.mood]?.label || ''}`)),
            h('button', { class: 'icon-btn', onclick: () => edit(t) }, icon('gear'))))),
          h('button', { class: 'btn', onclick: () => edit(null) }, icon('plus'), ' Add transition'));
      }
    }
    root.append(area); draw();
    const liveIv = setInterval(() => run && draw(), 500);
    return { primary: () => (run ? end() : list()[0] && begin(list()[0])), secondary: () => end(), unmount: () => clearInterval(liveIv) };
  },
};
