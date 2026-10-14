// DOM + UI helpers: element builder, bottom sheets, settings forms, toasts.
import { store } from './store.js';
import { ICONS } from './icons.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
      }
    }
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const icon = (name, cls = 'ic') => h('span', { class: cls, html: ICONS[name] || '' });

export function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

let openSheets = 0;
export const sheetOpen = () => openSheets > 0;

export function sheet(title, build, { onClose, wide } = {}) {
  openSheets++;
  const body = h('div', { class: 'sheet-body' });
  const close = () => {
    if (!wrap.isConnected) return;
    openSheets--;
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 250);
    onClose?.();
  };
  const panel = h('div', { class: 'sheet' + (wide ? ' wide' : '') },
    h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'btn ghost', onclick: close }, 'Done')),
    body);
  const wrap = h('div', { class: 'sheet-wrap', onclick: (e) => { if (e.target === wrap) close(); } }, panel);
  document.body.append(wrap);
  build(body, close);
  requestAnimationFrame(() => wrap.classList.add('show'));
  return close;
}

// Build a settings form from a schema; values persist at `${base}.${key}`.
export function settingsForm(container, base, schema, onChange) {
  for (const f of schema) {
    const path = `${base}.${f.key}`;
    const val = store.get(path, f.default);
    let input;
    const set = (v) => { store.set(path, v); onChange?.(f.key, v); };
    if (f.type === 'toggle') {
      input = h('input', { type: 'checkbox', class: 'switch', checked: !!val, onchange: (e) => set(e.target.checked) });
    } else if (f.type === 'select') {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      input = h('select', { onchange: (e) => set(f.number ? Number(e.target.value) : e.target.value) },
        opts.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return h('option', { value: v, selected: String(v) === String(val) }, l);
        }));
    } else if (f.type === 'range') {
      const out = h('span', { class: 'range-val' }, f.format ? f.format(val) : val);
      input = h('div', { class: 'range-row' },
        h('input', { type: 'range', min: f.min, max: f.max, step: f.step || 1, value: val,
          oninput: (e) => { const v = Number(e.target.value); out.textContent = f.format ? f.format(v) : v; set(v); } }),
        out);
    } else if (f.type === 'number') {
      input = h('input', { type: 'number', min: f.min, max: f.max, step: f.step || 1, value: val, onchange: (e) => set(Number(e.target.value)) });
    } else if (f.type === 'textarea') {
      input = h('textarea', { rows: f.rows || 4, onchange: (e) => set(e.target.value) }, val || '');
    } else if (f.type === 'button') {
      input = h('button', { class: 'btn', onclick: f.onClick }, f.text);
    } else {
      input = h('input', { type: 'text', value: val ?? '', placeholder: f.placeholder || '', onchange: (e) => set(e.target.value) });
    }
    container.append(h('label', { class: 'field' + (f.type === 'toggle' ? ' inline' : '') },
      h('span', { class: 'field-label' }, f.label, f.hint ? h('small', {}, f.hint) : null), input));
  }
}

export function confirmSheet(message, okText = 'OK') {
  return new Promise((resolve) => {
    let answered = false;
    sheet(message, (body, close) => {
      body.append(h('div', { class: 'row gap' },
        h('button', { class: 'btn', onclick: () => { answered = true; resolve(false); close(); } }, 'Cancel'),
        h('button', { class: 'btn primary danger', onclick: () => { answered = true; resolve(true); close(); } }, okText)));
    }, { onClose: () => { if (!answered) resolve(false); } });
  });
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const fmtTime = (secs) => {
  secs = Math.max(0, Math.round(secs));
  const h_ = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h_ ? `${h_}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

export const spokenTime = (secs) => {
  const m = Math.floor(secs / 60); const s = Math.round(secs % 60);
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s) parts.push(`${s} second${s === 1 ? '' : 's'}`);
  return parts.join(' and ') || '0 seconds';
};
