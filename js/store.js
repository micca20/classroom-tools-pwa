// Tiny persistent store backed by localStorage.
const KEY = 'classroomtools.v1';

const defaults = () => ({
  classes: [
    {
      id: 'demo',
      name: 'Demo Class',
      color: '#7BC47F',
      students: ['Abigail', 'Benjamin', 'Charlotte', 'Daniel', 'Emma', 'Felix', 'Grace', 'Henry',
        'Isla', 'Jack', 'Kaylee', 'Liam', 'Mia', 'Noah', 'Olivia', 'Parker', 'Quinn', 'Ruby',
        'Samuel', 'Wyatt'],
      unwanted: [],   // [[nameA, nameB], ...]
      wanted: [],
      zones: {},      // name -> 'front' | 'middle' | 'back'
    },
  ],
  currentClassId: 'demo',
  settings: {
    voice: '',
    voiceRate: 1,
    volume: 0.8,
    speakNames: true,
    keys: {
      primary: [' ', 'Enter', 'ArrowRight', 'ArrowDown', 'PageDown', 'MediaTrackNext'],
      secondary: ['ArrowLeft', 'ArrowUp', 'PageUp', 'MediaTrackPrevious'],
      back: ['Escape', 'Backspace'],
    },
    quickKeys: {}, // key -> toolId (home screen shortcuts)
    hiddenTools: [],
    order: [],
  },
  tools: {},       // per-tool settings & state
  notes: [],
  routines: [],
  seating: { layouts: [] },
  hallLog: [],
});

let state;
try {
  state = { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  state.settings = { ...defaults().settings, ...state.settings };
  state.settings.keys = { ...defaults().settings.keys, ...state.settings.keys };
} catch {
  state = defaults();
}

const subs = new Set();
let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(state)), 150);
}

function walk(path, create) {
  const parts = path.split('.');
  let o = state;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] == null) {
      if (!create) return [undefined, parts.at(-1)];
      o[parts[i]] = {};
    }
    o = o[parts[i]];
  }
  return [o, parts.at(-1)];
}

export const store = {
  get(path, fallback) {
    const [o, k] = walk(path, false);
    const v = o?.[k];
    return v === undefined ? fallback : v;
  },
  set(path, value) {
    const [o, k] = walk(path, true);
    o[k] = value;
    persist();
    subs.forEach((fn) => fn(path));
  },
  update(path, fn, fallback) {
    this.set(path, fn(this.get(path, fallback)));
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  get state() { return state; },
  exportJSON() { return JSON.stringify(state, null, 2); },
  importJSON(text) {
    const parsed = JSON.parse(text);
    state = { ...defaults(), ...parsed };
    localStorage.setItem(KEY, JSON.stringify(state));
    subs.forEach((fn) => fn('*'));
  },
  reset() { state = defaults(); localStorage.setItem(KEY, JSON.stringify(state)); subs.forEach((fn) => fn('*')); },
  flush() { clearTimeout(saveTimer); localStorage.setItem(KEY, JSON.stringify(state)); },
};

export function currentClass() {
  const s = store.state;
  return s.classes.find((c) => c.id === s.currentClassId) || s.classes[0] || null;
}

export function toolSetting(toolId, key, fallback) {
  return store.get(`tools.${toolId}.${key}`, fallback);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
