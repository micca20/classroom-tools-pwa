import { h, icon, sheet, shuffle, toast, confirmSheet } from '../ui.js';
import { fx } from '../audio.js';
import { store, uid } from '../store.js';

const COLS = 12; const ROWS = 12;
const CIRCLE_COLORS = ['#e05a6a', '#f39c34', '#3aa0e0', '#2bb39a', '#a05ad6', '#f2d33a', '#4cc25a', '#d65aa8'];
const key = (c, r) => `${c},${r}`;
const parse = (k) => k.split(',').map(Number);

function defaultLayout() {
  const desks = [];
  // two columns of paired desks, like the App Store screenshot
  for (const c0 of [2, 7]) for (const r of [1, 2, 4, 6, 7]) for (const dc of [0, 1]) desks.push(key(c0 + dc, r));
  return { id: uid(), name: 'Pairs', desks, assignments: {} };
}

function score(assign, desks, cls, radius) {
  // assign: deskKey -> name
  const pos = {}; for (const [k, n] of Object.entries(assign)) if (n) pos[n] = parse(k);
  const near = (a, b) => { const p = pos[a]; const q = pos[b]; if (!p || !q) return false; return Math.hypot(p[0] - q[0], p[1] - q[1]) <= radius; };
  let s = 0;
  for (const [a, b] of cls.unwanted || []) if (near(a, b)) s += 100;
  for (const [a, b] of cls.wanted || []) if (pos[a] && pos[b] && !near(a, b)) s += 10;
  const rowsUsed = desks.map((k) => parse(k)[1]);
  const minR = Math.min(...rowsUsed); const maxR = Math.max(...rowsUsed); const span = Math.max(1, maxR - minR);
  for (const [n, zone] of Object.entries(cls.zones || {})) {
    const p = pos[n]; if (!p || !zone) continue;
    const t = (p[1] - minR) / span; // 0 = front
    if (zone === 'front' && t > 0.34) s += 20 + t * 10;
    if (zone === 'back' && t < 0.66) s += 20 + (1 - t) * 10;
    if (zone === 'middle' && (t < 0.2 || t > 0.8)) s += 15;
  }
  return s;
}

export function generateSeating(desks, cls, radius) {
  const names = cls.students.slice(0, desks.length);
  let best = null; let bestS = Infinity;
  for (let restart = 0; restart < 40 && bestS > 0; restart++) {
    const order = shuffle(desks);
    const a = {}; shuffle(names).forEach((n, i) => { a[order[i]] = n; });
    let s = score(a, desks, cls, radius);
    for (let it = 0; it < 1500 && s > 0; it++) {
      const k1 = desks[Math.floor(Math.random() * desks.length)]; const k2 = desks[Math.floor(Math.random() * desks.length)];
      if (k1 === k2) continue;
      [a[k1], a[k2]] = [a[k2], a[k1]];
      const s2 = score(a, desks, cls, radius);
      if (s2 <= s) s = s2; else [a[k1], a[k2]] = [a[k2], a[k1]];
    }
    if (s < bestS) { bestS = s; best = { ...a }; }
  }
  return { assign: best || {}, score: bestS };
}

export default {
  id: 'seating', name: 'Seating', icon: 'seating', bg: '#EAD9B5', fg: '#B9955A',
  mount(root) {
    let layouts = store.get('seating.layouts', []);
    if (!layouts.length) { layouts = [defaultLayout()]; store.set('seating.layouts', layouts); }
    let layoutId = store.get('seating.current', layouts[0].id);
    let classId = store.get('currentClassId');
    let radius = store.get('seating.radius', 1.5);
    let editing = false; let selected = null; let showCircles = true;
    const layout = () => layouts.find((l) => l.id === layoutId) || layouts[0];
    const cls = () => store.get('classes', []).find((c) => c.id === classId);
    const saveLayouts = () => store.set('seating.layouts', layouts);
    const saveClass = (c) => store.set('classes', store.get('classes', []).map((x) => (x.id === c.id ? c : x)));

    const board = h('div', { class: 'seat-board' });
    const status = h('div', { class: 'hint' });
    const layoutSel = h('select', { onchange: (e) => {
      if (e.target.value === '__new') {
        const l = { id: uid(), name: `Layout ${layouts.length + 1}`, desks: [], assignments: {} };
        layouts.push(l); layoutId = l.id; editing = true; saveLayouts();
      } else layoutId = e.target.value;
      store.set('seating.current', layoutId); draw();
    } });
    const classSel = h('select', { onchange: (e) => { classId = e.target.value; draw(); } });
    const editBtn = h('button', { class: 'btn', onclick: () => { editing = !editing; selected = null; draw(); } });

    function drawSelects() {
      layoutSel.innerHTML = '';
      layouts.forEach((l) => layoutSel.append(h('option', { value: l.id, selected: l.id === layout().id }, l.name)));
      layoutSel.append(h('option', { value: '__new' }, '+ New Layout'));
      classSel.innerHTML = '';
      store.get('classes', []).forEach((c) => classSel.append(h('option', { value: c.id, selected: c.id === classId }, c.name)));
    }

    function draw() {
      drawSelects();
      editBtn.textContent = editing ? 'Done editing desks' : 'Edit desks';
      board.innerHTML = '';
      board.classList.toggle('editing', editing);
      const L = layout(); const assign = L.assignments[classId] || {};
      const pct = 100 / COLS;
      board.append(h('div', { class: 'seat-front' }, 'Front of room'));
      if (editing) {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const k = key(c, r);
          board.append(h('button', { class: 'seat-cell' + (L.desks.includes(k) ? ' desk' : ''), style: { left: `${c * pct}%`, top: `${r * pct}%`, width: `${pct}%`, height: `${pct}%` },
            onclick: () => { L.desks = L.desks.includes(k) ? L.desks.filter((x) => x !== k) : [...L.desks, k]; delete assign[k]; saveLayouts(); draw(); } }));
        }
      } else {
        if (showCircles) L.desks.forEach((k, i) => {
          if (!assign[k]) return;
          const [c, r] = parse(k); const d = radius * 2 * pct;
          board.append(h('div', { class: 'seat-circle', style: { left: `${(c + 0.5) * pct - d / 2}%`, top: `${(r + 0.5) * pct - d / 2}%`, width: `${d}%`, height: `${d}%`, borderColor: CIRCLE_COLORS[i % CIRCLE_COLORS.length], background: `${CIRCLE_COLORS[i % CIRCLE_COLORS.length]}18` } }));
        });
        L.desks.forEach((k) => {
          const [c, r] = parse(k);
          board.append(h('button', { class: 'seat-desk' + (selected === k ? ' sel' : ''), style: { left: `${c * pct}%`, top: `${r * pct}%`, width: `${pct}%`, height: `${pct}%` },
            onclick: () => {
              if (!selected) { selected = k; draw(); return; }
              if (selected !== k) { [assign[selected], assign[k]] = [assign[k], assign[selected]]; L.assignments[classId] = assign; saveLayouts(); fx.click(); }
              selected = null; draw();
            } }, h('span', {}, assign[k] || '')));
        });
      }
      const c = cls();
      const seated = Object.values(assign).filter(Boolean).length;
      status.textContent = editing ? `Tap squares to add/remove desks · ${L.desks.length} desks`
        : `${L.desks.length} desks · ${c?.students.length || 0} students${c && c.students.length > L.desks.length ? ' — add more desks!' : ''}${seated ? ' · tap two desks to swap' : ''}`;
    }

    function generate() {
      const c = cls(); const L = layout();
      if (!c?.students.length) { toast('Pick a class with students'); return; }
      if (!L.desks.length) { toast('Add desks first'); editing = true; draw(); return; }
      const { assign, score: s } = generateSeating(L.desks, c, radius);
      L.assignments[classId] = assign; saveLayouts(); editing = false; draw();
      fx.success();
      toast(s === 0 ? 'All rules satisfied ✓' : s < 100 ? 'Seated! A few soft preferences could not be met' : 'Seated — some unwanted pairs could not be separated');
    }

    function pairEditor(kind) {
      const c = cls(); if (!c) return;
      const title = kind === 'unwanted' ? 'Unwanted Pairs' : 'Wanted Pairs';
      sheet(title, (body) => {
        const listEl = h('div', { class: 'list' });
        const a = h('select', {}, c.students.map((s) => h('option', {}, s)));
        const b = h('select', {}, c.students.map((s, i) => h('option', { selected: i === 1 }, s)));
        const render = () => {
          listEl.innerHTML = '';
          (c[kind] || []).forEach((p, i) => listEl.append(h('div', { class: 'list-item' }, h('span', {}, `${p[0]}  ⟷  ${p[1]}`),
            h('button', { class: 'icon-btn', onclick: () => { c[kind].splice(i, 1); saveClass(c); render(); } }, icon('trash')))));
          if (!(c[kind] || []).length) listEl.append(h('div', { class: 'empty' }, 'No pairs yet'));
        };
        body.append(h('p', { class: 'hint' }, kind === 'unwanted' ? 'These students will be kept outside each other’s radius (also used by Groups).' : 'These students will be seated within each other’s radius.'),
          h('div', { class: 'row gap' }, a, b, h('button', { class: 'btn primary', onclick: () => {
            if (a.value === b.value) return toast('Pick two different students');
            c[kind] = [...(c[kind] || []), [a.value, b.value]]; saveClass(c); render();
          } }, 'Add')), listEl);
        render();
      });
    }
    function zoneEditor() {
      const c = cls(); if (!c) return;
      sheet('Front, Middle, Back', (body) => {
        body.append(h('p', { class: 'hint' }, 'Choose where specific students should sit. Leave as “Any” for no preference.'));
        c.students.forEach((s) => {
          const sel = h('select', { onchange: (e) => { c.zones = { ...(c.zones || {}), [s]: e.target.value }; saveClass(c); } },
            [['', 'Any'], ['front', 'Front'], ['middle', 'Middle'], ['back', 'Back']].map(([v, l]) => h('option', { value: v, selected: (c.zones || {})[s] === v }, l)));
          body.append(h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, s), sel));
        });
      });
    }

    const radiusOut = h('span', { class: 'range-val' }, radius.toFixed(1));
    root.append(h('div', { class: 'stack seating' },
      board, status,
      h('div', { class: 'seat-controls' },
        h('div', { class: 'card pad' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Layout'), layoutSel),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Class'), classSel),
          h('div', { class: 'row gap' }, editBtn,
            h('button', { class: 'icon-btn', title: 'Rename layout', onclick: () => { const n = prompt('Layout name', layout().name); if (n) { layout().name = n; saveLayouts(); draw(); } } }, icon('gear')),
            h('button', { class: 'icon-btn', title: 'Delete layout', onclick: async () => {
              if (layouts.length < 2) return toast('Keep at least one layout');
              if (await confirmSheet(`Delete “${layout().name}”?`, 'Delete')) { layouts = layouts.filter((l) => l.id !== layout().id); layoutId = layouts[0].id; saveLayouts(); draw(); }
            } }, icon('trash')))),
        h('div', { class: 'card pad col' },
          h('button', { class: 'btn', onclick: () => pairEditor('unwanted') }, 'Unwanted Pairs'),
          h('button', { class: 'btn', onclick: () => pairEditor('wanted') }, 'Wanted Pairs'),
          h('button', { class: 'btn', onclick: zoneEditor }, 'Front, Middle, Back'))),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Radius', h('small', {}, 'How close counts as “next to” (in desks)')),
        h('div', { class: 'range-row' }, h('input', { type: 'range', min: 1, max: 4, step: 0.1, value: radius, oninput: (e) => { radius = Number(e.target.value); radiusOut.textContent = radius.toFixed(1); store.set('seating.radius', radius); draw(); } }), radiusOut)),
      h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, 'Show radius circles'), h('input', { type: 'checkbox', class: 'switch', checked: true, onchange: (e) => { showCircles = e.target.checked; draw(); } })),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn primary big grow', onclick: generate }, 'Generate'),
        h('button', { class: 'btn', onclick: () => window.print() }, 'Print'))));
    draw();
    return { primary: generate, secondary: () => {} };
  },
};
