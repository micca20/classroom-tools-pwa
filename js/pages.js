// Non-tool screens: Routines, Classes, Settings.
import { h, icon, sheet, toast, confirmSheet, settingsForm } from './ui.js';
import { store, uid } from './store.js';
import { SOUNDS, speak, voices, fx, audioCtx, ttsEnabled } from './audio.js';
import { getMic, releaseMic, micPermission, micHelp, MicError } from './mic.js';
import { DAYS, ROUTINE_COLORS, announce, currentRoutine, nextRoutine } from './routines.js';

const fmtClock = (r) => new Date(2000, 0, 1, r.hour, r.minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const routinesPage = {
  id: 'routines', name: 'Routines', icon: 'routines', bg: '#E5C3CF', fg: '#B9758E',
  mount(root) {
    const listEl = h('div', { class: 'list' });
    const now = h('div', { class: 'card pad' });
    const all = () => store.get('routines', []);
    const save = (l) => store.set('routines', l);

    function edit(r) {
      const isNew = !r;
      r = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: 'Reading', days: [1, 2, 3, 4, 5], hour: 8, minute: 0, message: '', sound: 'chime', classId: '', resetTools: false, color: ROUTINE_COLORS[all().length % ROUTINE_COLORS.length], enabled: true };
      sheet(isNew ? 'New routine' : 'Edit routine', (body, close) => {
        const color = r.color;
        const name = h('input', { class: 'routine-name', value: r.name, style: { background: color } });
        const days = h('div', { class: 'day-row' });
        const drawDays = () => {
          days.innerHTML = '';
          [1, 2, 3, 4, 5, 6, 0].forEach((d) => days.append(h('button', { class: 'day' + (r.days.includes(d) ? ' on' : ''), style: r.days.includes(d) ? { background: color } : {},
            onclick: () => { r.days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d]; drawDays(); } }, DAYS[d])));
        };
        drawDays();
        const time = h('input', { type: 'time', class: 'time-big', value: `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}` });
        const msg = h('input', { value: r.message, placeholder: `It's time for ${r.name}.` });
        const sound = h('select', {}, Object.entries(SOUNDS).map(([k, v]) => h('option', { value: k, selected: k === r.sound }, v.name)));
        const cls = h('select', {}, [h('option', { value: '' }, 'Don’t change class'), ...store.get('classes', []).map((c) => h('option', { value: c.id, selected: c.id === r.classId }, c.name))]);
        const reset = h('input', { type: 'checkbox', class: 'switch', checked: r.resetTools });
        const colors = h('div', { class: 'row gap' }, ROUTINE_COLORS.map((c) => h('button', { class: 'swatch', style: { background: c }, onclick: () => { r.color = c; name.style.background = c; drawDays(); } })));
        const collect = () => {
          const [hh, mm] = time.value.split(':').map(Number);
          Object.assign(r, { name: name.value.trim() || 'Routine', hour: hh || 0, minute: mm || 0, message: msg.value, sound: sound.value, classId: cls.value, resetTools: reset.checked });
          return r;
        };
        const f = (l, el, inline) => h('label', { class: 'field' + (inline ? ' inline' : '') }, h('span', { class: 'field-label' }, l), el);
        body.append(name, days, time,
          f('Spoken announcement', msg), f('Sound', sound), f('Change class', cls), f('Reset all tools', reset, true), f('Color', colors),
          h('button', { class: 'btn', style: { background: color, color: '#fff' }, onclick: () => announce(collect()) }, 'Announce Routine'),
          h('div', { class: 'row gap' },
            !isNew && h('button', { class: 'btn danger', onclick: () => { save(all().filter((x) => x.id !== r.id)); close(); render(); } }, icon('trash'), ' Delete'),
            h('button', { class: 'btn primary grow', onclick: () => {
              collect(); save(isNew ? [...all(), r] : all().map((x) => (x.id === r.id ? r : x))); close(); render();
            } }, 'Save')));
      });
    }
    function render() {
      const cur = currentRoutine(); const nx = nextRoutine();
      now.innerHTML = '';
      now.append(h('div', {}, h('span', { class: 'muted' }, 'Now: '), h('b', {}, cur ? cur.name : '—')),
        h('div', {}, h('span', { class: 'muted' }, 'Next: '), h('b', {}, nx ? `${nx.name} at ${fmtClock(nx)}` : '—')));
      listEl.innerHTML = '';
      const sorted = all().slice().sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
      if (!sorted.length) listEl.append(h('div', { class: 'empty' }, 'No routines yet. Add your daily schedule and the app will announce each subject automatically while it’s open.'));
      sorted.forEach((r) => listEl.append(h('div', { class: 'routine-item', style: { borderLeftColor: r.color } },
        h('button', { class: 'grow left', onclick: () => edit(r) },
          h('b', {}, r.name), h('div', { class: 'muted' }, `${fmtClock(r)} · ${[1, 2, 3, 4, 5, 6, 0].filter((d) => r.days.includes(d)).map((d) => DAYS[d]).join(' ')}`)),
        h('input', { type: 'checkbox', class: 'switch', checked: r.enabled !== false, onchange: (e) => { save(all().map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x))); } }))));
    }
    root.append(h('div', { class: 'stack' }, now,
      h('button', { class: 'pill-btn', style: { background: this.fg }, onclick: () => edit(null) }, icon('plus'), ' Add routine'),
      listEl,
      'Notification' in window && Notification.permission !== 'granted'
        ? h('button', { class: 'btn', onclick: () => Notification.requestPermission().then(() => toast('Notifications updated')) }, 'Also show notifications when the app is in the background')
        : null,
      h('p', { class: 'hint' }, 'Routines announce while this app is open (keep it on your classroom device with the screen on).')));
    render();
    const iv = setInterval(render, 30000);
    return { primary: () => { const c = currentRoutine(); if (c) announce(c); }, secondary: () => {}, unmount: () => clearInterval(iv) };
  },
};

export const classesPage = {
  id: 'classes', name: 'Classes', icon: 'classes', bg: '#CFE6CF', fg: '#5E9E64',
  mount(root) {
    const wrap = h('div', { class: 'stack' });
    const classes = () => store.get('classes', []);
    const save = (l) => store.set('classes', l);
    function edit(c) {
      const isNew = !c;
      c = c ? JSON.parse(JSON.stringify(c)) : { id: uid(), name: `Class ${classes().length + 1}`, students: [], unwanted: [], wanted: [], zones: {} };
      sheet(isNew ? 'New class' : 'Edit class', (body, close) => {
        const name = h('input', { value: c.name });
        const roster = h('textarea', { rows: 12, placeholder: 'One student per line (or paste a comma separated list)' }, c.students.join('\n'));
        const count = h('span', { class: 'muted' });
        const upd = () => { count.textContent = `${parse().length} students`; };
        const parse = () => [...new Set(roster.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))];
        roster.addEventListener('input', upd); upd();
        body.append(h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Class name'), name),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Students ', count), roster),
          h('div', { class: 'row gap' },
            h('button', { class: 'btn', onclick: () => { roster.value = parse().sort((a, b) => a.localeCompare(b)).join('\n'); } }, 'Sort A–Z'),
            !isNew && h('button', { class: 'btn danger', onclick: async () => {
              if (classes().length < 2) return toast('Keep at least one class');
              if (await confirmSheet(`Delete ${c.name}?`, 'Delete')) { save(classes().filter((x) => x.id !== c.id)); if (store.get('currentClassId') === c.id) store.set('currentClassId', classes()[0].id); close(); render(); }
            } }, icon('trash'), ' Delete'),
            h('button', { class: 'btn primary grow', onclick: () => {
              c.name = name.value.trim() || 'Class'; c.students = parse();
              const keep = (p) => c.students.includes(p[0]) && c.students.includes(p[1]);
              c.unwanted = (c.unwanted || []).filter(keep); c.wanted = (c.wanted || []).filter(keep);
              save(isNew ? [...classes(), c] : classes().map((x) => (x.id === c.id ? c : x)));
              if (isNew) store.set('currentClassId', c.id);
              close(); render();
            } }, 'Save')));
      });
    }
    function render() {
      wrap.innerHTML = '';
      const cur = store.get('currentClassId');
      wrap.append(h('p', { class: 'hint' }, 'Tap a class to make it active. Sticks, Groups, Tallies, Hearts and Seating use the active class.'));
      classes().forEach((c) => wrap.append(h('div', { class: 'routine-item' + (c.id === cur ? ' active' : '') },
        h('button', { class: 'grow left', onclick: () => { store.set('currentClassId', c.id); render(); toast(`${c.name} is active`); } },
          h('b', {}, c.name, c.id === cur ? ' ✓' : ''), h('div', { class: 'muted' }, `${c.students.length} students · ${(c.unwanted || []).length} unwanted pairs`)),
        h('button', { class: 'icon-btn', onclick: () => edit(c) }, icon('gear')))));
      wrap.append(h('button', { class: 'pill-btn', style: { background: classesPage.fg }, onclick: () => edit(null) }, icon('plus'), ' Add class'));
    }
    root.append(wrap); render();
    return {};
  },
};

export const settingsPage = {
  id: 'settings', name: 'Settings', icon: 'gear', bg: '#DDE3EA', fg: '#6F7F91',
  mount(root, api) {
    const general = h('div', { class: 'card pad' });
    settingsForm(general, 'settings', [
      { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, default: 0.8, format: (v) => `${Math.round(v * 100)}%` },
      { key: 'tts', label: 'Spoken announcements (text-to-speech)', hint: 'Off = no spoken names, timer callouts, routine or alarm messages. Bells and sounds still play.', type: 'toggle', default: true },
    ], (key, on) => {
      if (key !== 'tts') return;
      voiceBox.hidden = !on;
      if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
      toast(on ? 'Spoken announcements on' : 'Spoken announcements off');
    });
    const voiceBox = h('div', { class: 'col', hidden: !ttsEnabled() });
    settingsForm(voiceBox, 'settings', [
      { key: 'voice', label: 'Voice', type: 'select', default: '', options: () => [['', 'System default'], ...voices().map((v) => [v.name, `${v.name} (${v.lang})`])] },
      { key: 'voiceRate', label: 'Speaking speed', type: 'range', min: 0.6, max: 1.4, step: 0.05, default: 1, format: (v) => `${v.toFixed(2)}×` },
      { key: 'button', type: 'button', label: 'Test', text: 'Test voice', onClick: () => speak('Good morning class! Let’s have a great day.') },
    ]);
    general.append(voiceBox);
    settingsForm(general, 'settings', [
      { key: 'button2', type: 'button', label: 'No sound?', hint: 'On iPhone/iPad: flip the ring/silent switch off (or turn off Silent Mode in Control Center), turn the volume up, and check Bluetooth isn’t sending audio elsewhere.', text: 'Test sound', onClick: () => fx.play('chime') },
    ]);

    // Clicker / keyboard mapping
    const keys = h('div', { class: 'card pad' });
    const drawKeys = () => {
      keys.innerHTML = '';
      keys.append(h('h3', {}, icon('remote'), ' Bluetooth clicker & keyboard'),
        h('p', { class: 'hint' }, 'Most Bluetooth clickers/page-turners send keyboard keys. Press “Learn” then press a button on your clicker. Inside a tool, the main button runs the tool’s main action and the second button its alternate action.'));
      for (const [k, label] of [['primary', 'Main button'], ['secondary', 'Second button'], ['back', 'Back to home']]) {
        const cur = store.get(`settings.keys.${k}`, []);
        keys.append(h('div', { class: 'list-item' }, h('div', {}, h('b', {}, label), h('div', { class: 'muted mono' }, cur.map((x) => (x === ' ' ? 'Space' : x)).join(' · ') || '—')),
          h('button', { class: 'btn', onclick: (e) => learn(e.currentTarget, (key) => { store.set(`settings.keys.${k}`, [...new Set([key, ...cur])]); drawKeys(); }) }, 'Learn')));
      }
      keys.append(h('div', { class: 'section-label' }, 'Home screen shortcuts'),
        h('p', { class: 'hint' }, 'Assign a clicker button to jump straight into a tool from the home screen.'));
      const qk = store.get('settings.quickKeys', {});
      for (const t of api.tools) {
        const assigned = Object.entries(qk).filter(([, id]) => id === t.id).map(([k]) => k);
        keys.append(h('div', { class: 'list-item' }, h('span', {}, t.name), h('span', { class: 'muted mono' }, assigned.join(' · ')),
          h('div', { class: 'row' },
            h('button', { class: 'btn sm', onclick: (e) => learn(e.currentTarget, (key) => { const q = store.get('settings.quickKeys', {}); q[key] = t.id; store.set('settings.quickKeys', q); drawKeys(); }) }, 'Learn'),
            assigned.length ? h('button', { class: 'icon-btn', onclick: () => { const q = store.get('settings.quickKeys', {}); assigned.forEach((k) => delete q[k]); store.set('settings.quickKeys', q); drawKeys(); } }, icon('trash')) : null)));
      }
      keys.append(h('button', { class: 'btn', onclick: () => { store.set('settings.keys', { primary: [' ', 'Enter', 'ArrowRight', 'ArrowDown', 'PageDown', 'MediaTrackNext'], secondary: ['ArrowLeft', 'ArrowUp', 'PageUp', 'MediaTrackPrevious'], back: ['Escape', 'Backspace'] }); drawKeys(); } }, 'Restore default keys'));
    };
    function learn(btn, done) {
      btn.textContent = 'Press a button…';
      const handler = (e) => { e.preventDefault(); e.stopImmediatePropagation(); window.removeEventListener('keydown', handler, true); done(e.key); fx.click(); };
      window.addEventListener('keydown', handler, true);
    }
    drawKeys();

    // Microphone
    const micCard = h('div', { class: 'card pad' });
    const drawMic = async (msg) => {
      const state = await micPermission();
      micCard.innerHTML = '';
      const label = { granted: '✅ Allowed', denied: '🚫 Blocked', prompt: '❔ Not asked yet', unknown: '❔ Unknown (tap Test to check)' }[state];
      micCard.append(...[h('h3', {}, icon('mic'), ' Microphone'),
        h('p', { class: 'hint' }, 'Used only by the Noise Meter and Notes dictation. Audio never leaves this device.'),
        h('div', { class: 'list-item' }, h('b', {}, 'Permission'), h('span', {}, label)),
        msg ? h('div', { class: 'list-item' }, h('span', {}, msg)) : null,
        h('button', { class: 'btn', onclick: testMic }, 'Test microphone')].filter(Boolean));
      if (state === 'denied' || msg?.startsWith('🚫')) micCard.append(h('ol', { class: 'help-steps' }, micHelp('denied').map((s) => h('li', {}, s))));
    };
    async function testMic() {
      const c0 = audioCtx();
      try {
        const s = await getMic();
        const c = c0; if (c.state !== 'running') c.resume().catch(() => {});
        const an = c.createAnalyser(); const src = c.createMediaStreamSource(s); src.connect(an);
        const buf = new Float32Array(2048); let peak = 0;
        const t0 = performance.now();
        await new Promise((res) => { const f = () => { an.getFloatTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v)); performance.now() - t0 < 1500 ? requestAnimationFrame(f) : res(); }; f(); });
        src.disconnect(); releaseMic(s);
        if (c.state !== 'running') { drawMic('✅ Permission OK — tap Test again to check the sound level.'); return; }
        drawMic(peak > 0 ? `🎙 Working — heard sound (peak ${Math.round(20 * Math.log10(peak))} dB)` : '⚠️ Mic opened but heard only silence — another app may be using it.');
      } catch (e) {
        drawMic(`🚫 ${e.message}`);
        if (!(e instanceof MicError) || e.code !== 'denied') micCard.append(h('ol', { class: 'help-steps' }, micHelp(e.code).map((x) => h('li', {}, x))));
      }
    }
    drawMic();

    // Tiles
    const tiles = h('div', { class: 'card pad' }, h('h3', {}, 'Home screen tools'));
    const hidden = new Set(store.get('settings.hiddenTools', []));
    api.tools.forEach((t) => tiles.append(h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, t.name),
      h('input', { type: 'checkbox', class: 'switch', checked: !hidden.has(t.id), onchange: (e) => { e.target.checked ? hidden.delete(t.id) : hidden.add(t.id); store.set('settings.hiddenTools', [...hidden]); } }))));

    // Backup
    const data = h('div', { class: 'card pad' }, h('h3', {}, 'Backup'),
      h('p', { class: 'hint' }, 'Everything is stored on this device only. Export a backup to move it to another device.'),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn', onclick: () => { store.flush(); h('a', { href: URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' })), download: `classroom-tools-backup-${new Date().toISOString().slice(0, 10)}.json` }).click(); } }, 'Export backup'),
        h('button', { class: 'btn', onclick: () => {
          const inp = h('input', { type: 'file', accept: 'application/json,.json', onchange: async () => { try { store.importJSON(await inp.files[0].text()); toast('Backup restored'); location.reload(); } catch { toast('That file is not a valid backup'); } } });
          inp.click();
        } }, 'Import backup'),
        h('button', { class: 'btn danger', onclick: async () => { if (await confirmSheet('Erase all data on this device?', 'Erase')) { store.reset(); location.reload(); } } }, 'Erase all')));

    root.append(h('div', { class: 'stack' }, general, micCard, keys, tiles, data,
      h('p', { class: 'hint center' }, 'Classroom Tools · an open-source PWA inspired by myClassroom')));
    return {};
  },
};

export { SOUNDS };
