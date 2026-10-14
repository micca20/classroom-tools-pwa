import { h, icon, sheet, settingsForm, sheetOpen, toast } from './ui.js';
import { store, currentClass } from './store.js';
import { unlockAudio, keepAwake, audioReady, fx } from './audio.js';
import { startRoutineEngine, currentRoutine } from './routines.js';
import { routinesPage, classesPage, settingsPage } from './pages.js';
import { timerStatus } from './tools/timer.js';
import { backupStatus, exportBackup, snooze, lastBackupText, requestPersistence } from './backup.js';

import bell from './tools/bell.js';
import timer from './tools/timer.js';
import sticks from './tools/sticks.js';
import groups from './tools/groups.js';
import tallies from './tools/tallies.js';
import timeLost from './tools/timeLost.js';
import hearts from './tools/hearts.js';
import noise from './tools/noise.js';
import hallPass from './tools/hallPass.js';
import dice from './tools/dice.js';
import transitions from './tools/transitions.js';
import music from './tools/music.js';
import notes from './tools/notes.js';
import brain from './tools/brain.js';
import seating from './tools/seating.js';

export const TOOLS = [bell, timer, sticks, groups, tallies, timeLost, hearts, noise, hallPass, dice, transitions, music, notes, brain, seating];
const PAGES = [routinesPage, classesPage, settingsPage];
const byId = Object.fromEntries([...TOOLS, ...PAGES].map((t) => [t.id, t]));

const app = document.getElementById('app');
let active = null; // { tool, handle }

function toolApi(tool) {
  return {
    get: (k, d) => store.get(`tools.${tool.id}.${k}`, d),
    set: (k, v) => store.set(`tools.${tool.id}.${k}`, v),
    tools: TOOLS,
  };
}

function header(tool, { onSettings } = {}) {
  return h('header', { class: 'tool-head', style: { '--c': tool.fg, '--bg': tool.bg } },
    h('button', { class: 'back-btn', 'aria-label': 'Back', onclick: () => go('') }, icon('back')),
    h('h1', {}, tool.name),
    onSettings ? h('button', { class: 'head-gear', 'aria-label': 'Settings', onclick: onSettings }, icon('gear')) : h('span'),
    h('div', { class: 'wave', html: '<svg viewBox="0 0 400 60" preserveAspectRatio="none"><path d="M0 0H400V14C352 14 345 58 290 58H0Z"/></svg>' }),
    h('div', { class: 'head-badge' }, icon(tool.icon)));
}

function unmountActive() {
  try { active?.handle?.unmount?.(); } catch (e) { console.error(e); }
  active = null;
  keepAwake(false);
}

function renderHome() {
  unmountActive();
  document.title = 'Classroom Tools';
  document.body.style.setProperty('--page-bg', '#F2F2F2');
  const hidden = new Set(store.get('settings.hiddenTools', []));
  const cls = currentClass();
  const clock = h('div', { class: 'home-clock' });
  const status = h('div', { class: 'home-status' });
  const tick = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const r = currentRoutine(); const t = timerStatus();
    status.innerHTML = '';
    if (r) status.append(h('span', { class: 'chip', style: { background: r.color, color: '#fff' } }, r.name));
    if (t.remaining > 0) status.append(h('button', { class: 'chip', onclick: () => go('tool/timer') }, `⏱ ${Math.floor(t.remaining / 60)}:${String(Math.ceil(t.remaining % 60) % 60).padStart(2, '0')}`));
  };
  tick();
  const classBtn = h('button', { class: 'class-switch', onclick: () => pickClass() }, cls?.name || 'Add a class', ' ▾');
  const bs = backupStatus();
  const backupNag = bs.due ? h('div', { class: 'backup-nag' },
    h('div', {}, h('b', {}, '💾 Time to back up'), h('div', { class: 'muted' }, bs.last ? `Last backup ${lastBackupText(bs).toLowerCase()}` : 'Your classes have never been backed up')),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn sm', onclick: () => { snooze(7); renderHome(); } }, 'Later'),
      h('button', { class: 'btn sm primary', style: { '--c': '#5FB25A' }, onclick: async () => { if (await exportBackup()) { toast('Backup saved ✓'); renderHome(); } } }, 'Back up now'))) : null;
  app.replaceChildren(h('div', { class: 'home' },
    h('div', { class: 'home-top' },
      h('div', {}, h('div', { class: 'brand' }, 'Classroom Tools'), classBtn),
      h('div', { class: 'right' }, clock, status)),
    backupNag,
    h('main', { class: 'tile-panel' },
      h('div', { class: 'tiles' }, TOOLS.filter((t) => !hidden.has(t.id)).map((t) =>
        h('button', { class: 'tile', style: { '--bg': t.bg, '--fg': t.fg }, onclick: () => go(`tool/${t.id}`) },
          icon(t.icon, 'tile-ic'), h('span', { class: 'tile-label' }, t.name))))),
    h('nav', { class: 'home-nav' }, PAGES.map((p) =>
      h('button', { class: 'nav-btn', style: { '--fg': p.fg }, onclick: () => go(`tool/${p.id}`) }, icon(p.icon), h('span', {}, p.name))))));
  const iv = setInterval(() => { if (!clock.isConnected) return clearInterval(iv); tick(); }, 1000);
}

function pickClass() {
  sheet('Choose class', (body, close) => {
    const cur = store.get('currentClassId');
    store.get('classes', []).forEach((c) => body.append(h('button', { class: 'list-item btnlike' + (c.id === cur ? ' active' : ''), onclick: () => { store.set('currentClassId', c.id); close(); render(); } },
      h('b', {}, c.name), h('span', { class: 'muted' }, `${c.students.length} students`))));
    body.append(h('button', { class: 'btn', onclick: () => { close(); go('tool/classes'); } }, 'Manage classes'));
  });
}

function renderTool(id) {
  const tool = byId[id];
  if (!tool) return go('');
  unmountActive();
  document.title = `${tool.name} · Classroom Tools`;
  document.body.style.setProperty('--c', tool.fg);
  document.body.style.setProperty('--page-bg', `color-mix(in srgb, ${tool.bg} 35%, #fff)`);
  const api = toolApi(tool);
  const body = h('div', { class: 'tool-body' });
  const remount = () => renderTool(id);
  const onSettings = tool.settings ? () => sheet(`${tool.name} settings`, (b) => settingsForm(b, `tools.${tool.id}`, tool.settings), { onClose: remount }) : null;
  app.replaceChildren(h('div', { class: 'tool', style: { '--c': tool.fg, '--bg': tool.bg } }, header(tool, { onSettings }), body));
  let handle = {};
  try { handle = tool.mount(body, api) || {}; } catch (e) { console.error(e); body.append(h('p', { class: 'hint' }, `Something went wrong: ${e.message}`)); }
  active = { tool, handle };
  keepAwake(true);
}

function render() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [kind, id] = hash.split('/');
  if (kind === 'tool' && id) renderTool(id); else renderHome();
}

export function go(path) {
  const target = `#/${path}`;
  if (location.hash === target) render(); else location.hash = target;
}

// ---- Clicker / keyboard ----
window.addEventListener('keydown', (e) => {
  if (sheetOpen()) return;
  const tag = document.activeElement?.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !e.key.startsWith('Media')) return;
  const k = store.get('settings.keys', {});
  const has = (list) => (list || []).includes(e.key);
  if (active) {
    if (has(k.back)) { e.preventDefault(); go(''); return; }
    if (has(k.primary)) { e.preventDefault(); active.handle.primary?.(); return; }
    if (has(k.secondary)) { e.preventDefault(); active.handle.secondary?.(); return; }
  } else {
    const q = store.get('settings.quickKeys', {});
    if (q[e.key]) { e.preventDefault(); go(`tool/${q[e.key]}`); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 9) { const t = TOOLS.filter((x) => !store.get('settings.hiddenTools', []).includes(x.id))[n - 1]; if (t) go(`tool/${t.id}`); }
  }
});

// Media Session: some Bluetooth remotes/headphones send play/next/prev media actions.
if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('nexttrack', () => active?.handle.primary?.());
    navigator.mediaSession.setActionHandler('previoustrack', () => active?.handle.secondary?.());
  } catch { /* unsupported */ }
}

document.addEventListener('reset-tools', () => {
  const c = currentClass(); if (!c) return;
  store.set(`tools.tallies.counts.${c.id}`, { pos: 0, neg: 0 });
  store.set(`tools.hearts.state.${c.id}`, null);
  store.set(`tools.sticks.pool.${c.id}`, null);
  if (active) renderTool(active.tool.id);
});
document.addEventListener('routine', (e) => { toast(`⏰ ${e.detail.name}`, 4000); if (!active) renderHome(); });

// Every gesture re-arms audio (iOS only accepts touchend/click/keydown, and can interrupt the context any time).
const unlock = () => { unlockAudio(); updateSoundBanner(); };
['touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));

const soundBanner = h('button', { class: 'sound-banner', onclick: () => { unlock(); fx.click(); } }, '🔇 Tap to turn on sound');
document.body.append(soundBanner);
function updateSoundBanner() { setTimeout(() => soundBanner.classList.toggle('show', !audioReady()), 400); }
document.addEventListener('audio-state', updateSoundBanner);
document.addEventListener('visibilitychange', updateSoundBanner);
updateSoundBanner();

window.addEventListener('hashchange', render);
render();
startRoutineEngine();

// Ask the browser to keep our data safe from automatic cleanup (silently; some browsers want a gesture first).
requestPersistence();
window.addEventListener('click', () => requestPersistence(), { once: true, capture: true });
document.addEventListener('storage-error', () => toast('⚠️ Couldn’t save — device storage is full or blocked. Export a backup in Settings!', 6000));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // When an updated service worker takes over, reload once so the new code runs right away.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
