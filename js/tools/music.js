import { h, icon, fmtTime } from '../ui.js';
import * as M from '../music.js';

let sleepAt = 0; let sleepIv = null;

export default {
  id: 'music', name: 'Music Box', icon: 'music', bg: '#C8C8F2', fg: '#7676D6',
  settings: [
    { key: 'volume', label: 'Music volume', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.7, format: (v) => `${Math.round(v * 100)}%` },
  ],
  mount(root, api) {
    let mood = api.get('mood', M.current()?.mood || 'calm');
    const list = h('div', { class: 'track-list' });
    const now = h('div', { class: 'now-playing' });
    const playBtn = h('button', { class: 'round-btn lg', onclick: () => toggle() });
    const tabs = h('div', { class: 'chips' }, Object.entries(M.MOODS).map(([k, m]) =>
      h('button', { class: 'chip', 'data-m': k, onclick: () => { mood = k; api.set('mood', k); render(); } }, m.label)));
    const sleepSel = h('select', { onchange: (e) => { const m = Number(e.target.value); sleepAt = m ? Date.now() + m * 60000 : 0; startSleep(); } },
      [[0, 'Off'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '60 min']].map(([v, l]) => h('option', { value: v }, l)));
    const sleepLeft = h('span', { class: 'muted' });
    const tracks = () => M.TRACKS.filter((t) => t.mood === mood);

    function playTrack(t) { M.play(t, { volume: api.get('volume', 0.7) }); api.set('last', t.id); render(); }
    function toggle() {
      if (M.isPlaying()) { M.stop(); render(); return; }
      const t = M.TRACKS.find((x) => x.id === api.get('last')) || tracks()[0];
      playTrack(t);
    }
    function next() {
      const cur = M.current(); const ts = M.TRACKS.filter((t) => t.mood === (cur?.mood || mood));
      const i = ts.findIndex((t) => t.id === cur?.id);
      playTrack(ts[(i + 1) % ts.length]);
    }
    function startSleep() {
      clearInterval(sleepIv);
      if (!sleepAt) { sleepLeft.textContent = ''; return; }
      sleepIv = setInterval(() => {
        const left = (sleepAt - Date.now()) / 1000;
        if (sleepLeft.isConnected) sleepLeft.textContent = fmtTime(left);
        if (left <= 0) { M.stop(3); sleepAt = 0; clearInterval(sleepIv); if (sleepLeft.isConnected) { sleepLeft.textContent = ''; render(); } }
      }, 1000);
    }
    function render() {
      tabs.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.m === mood));
      const cur = M.current();
      list.innerHTML = '';
      tracks().forEach((t, i) => list.append(h('button', { class: 'track' + (cur?.id === t.id ? ' on' : ''), onclick: () => playTrack(t) },
        h('span', { class: 'track-n' }, cur?.id === t.id ? '♪' : i + 1), h('span', {}, t.title), h('span', { class: 'muted' }, M.MOODS[t.mood].label))));
      now.textContent = cur ? `Now playing: ${cur.title} · ${M.MOODS[cur.mood].label}` : 'Not playing';
      playBtn.innerHTML = ''; playBtn.append(icon(M.isPlaying() ? 'pause' : 'play'));
    }
    root.append(h('div', { class: 'stack' },
      h('div', { class: 'row gap center' }, playBtn, h('button', { class: 'pill-btn', style: { background: this.fg }, onclick: next }, 'Next track')),
      now,
      h('div', { class: 'row gap center' }, h('span', {}, 'Sleep timer'), sleepSel, sleepLeft),
      h('div', { class: 'section-label' }, `${M.TRACKS.length} instrumental tracks`), tabs, list));
    render(); startSleep();
    return { primary: toggle, secondary: next };
  },
};
