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
let hadSaved = false;
try {
  const raw = localStorage.getItem(KEY);
  hadSaved = !!raw;
  state = { ...defaults(), ...JSON.parse(raw || '{}') };
  state.settings = { ...defaults().settings, ...state.settings };
  state.settings.keys = { ...defaults().settings.keys, ...state.settings.keys };
} catch {
  state = defaults();
}
// meta: { createdAt, lastChangeAt, lastBackupAt, snoozeUntil } — used for backup reminders.
state.meta = { createdAt: Date.now(), ...(state.meta || {}) };
// Data saved before backup tracking existed counts as unsaved work.
if (hadSaved && !state.meta.lastChangeAt) state.meta.lastChangeAt = state.meta.createdAt;

const subs = new Set();
let saveTimer;
function persist(markChange = true) {
  if (markChange) state.meta.lastChangeAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 150);
}
function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {
    document.dispatchEvent(new CustomEvent('storage-error', { detail: e }));
  }
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
    persist(!path.startsWith('meta.')); // bookkeeping doesn't count as "unsaved changes"
    subs.forEach((fn) => fn(path));
  },
  update(path, fn, fallback) {
    this.set(path, fn(this.get(path, fallback)));
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  get state() { return state; },
  exportJSON() { return JSON.stringify({ app: 'classroom-tools', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2); },
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.classes)) throw new Error('Not a Classroom Tools backup');
    delete parsed.app; delete parsed.version; delete parsed.exportedAt;
    state = { ...defaults(), ...parsed };
    state.settings = { ...defaults().settings, ...state.settings };
    const now = Date.now();
    state.meta = { createdAt: now, ...(state.meta || {}), lastBackupAt: now, lastChangeAt: now, snoozeUntil: 0 };
    write();
    subs.forEach((fn) => fn('*'));
  },
  reset() { state = defaults(); state.meta = { createdAt: Date.now() }; write(); subs.forEach((fn) => fn('*')); },
  flush() { clearTimeout(saveTimer); write(); },
  sizeBytes() { return new Blob([JSON.stringify(state)]).size; },
};

export function currentClass() {
  const s = store.state;
  return s.classes.find((c) => c.id === s.currentClassId) || s.classes[0] || null;
}

export function toolSetting(toolId, key, fallback) {
  return store.get(`tools.${toolId}.${key}`, fallback);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
