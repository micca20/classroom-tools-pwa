import { h, icon, fmtTime, toast, confirmSheet } from '../ui.js';
import * as M from '../music.js';
import * as L from '../library.js';
import * as Y from '../youtube.js';
import { fmtBytes } from '../backup.js';
import { isIOS } from '../mic.js';

let sleepAt = 0; let sleepIv = null;
let lastImportNote = '';
const SEARCHES = [
  ['Piano pop covers', 'piano pop covers playlist'],
  ['Lo-fi pop covers', 'lofi pop covers playlist'],
  ['String quartet pop', 'string quartet pop covers playlist'],
  ['Clean instrumental pop for class', 'clean instrumental pop songs for classroom playlist'],
];

export default {
  id: 'music', name: 'Music Box', icon: 'music', bg: '#C8C8F2', fg: '#7676D6',
  settings: [
    { key: 'volume', label: 'Built-in music volume', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.7, format: (v) => `${Math.round(v * 100)}%` },
  ],
  mount(root, api) {
    const fg = this.fg;
    let tab = api.get('tab', 'builtin');
    let mood = api.get('mood', M.current()?.mood || 'pop');
    let alive = true;

    // ---------- shared header ----------
    const now = h('div', { class: 'now-playing' });
    const playBtn = h('button', { class: 'round-btn lg', 'aria-label': 'Play or pause', onclick: () => toggle() });
    const prevBtn = h('button', { class: 'round-btn', 'aria-label': 'Previous', onclick: () => prev() }, icon('prev'));
    const nextBtn = h('button', { class: 'round-btn', 'aria-label': 'Next', onclick: () => next() }, icon('next'));
    const seg = h('div', { class: 'seg' }, [['builtin', 'Built-in'], ['mine', 'My Music'], ['yt', 'YouTube']].map(([k, l]) =>
      h('button', { 'data-t': k, onclick: () => { tab = k; api.set('tab', k); renderTab(); } }, l)));
    const sleepSel = h('select', { onchange: (e) => { const m = Number(e.target.value); sleepAt = m ? Date.now() + m * 60000 : 0; startSleep(); } },
      [[0, 'Off'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '60 min']].map(([v, l]) => h('option', { value: v }, l)));
    const sleepLeft = h('span', { class: 'muted' });
    const body = h('div', { class: 'stack' });

    const playingSource = () => (M.isPlaying() ? 'builtin' : L.isLibPlaying() ? 'mine' : Y.ytPlaying() ? 'yt' : null);

    function toggle() {
      const src = playingSource();
      if (src === 'builtin') { M.stop(); return refresh(); }
      if (src === 'mine') { L.togglePause(); return refresh(); }
      if (src === 'yt') { Y.ytToggle(); return refresh(); }
      // Nothing playing: resume/start whatever the current tab shows.
      if (tab === 'mine') { if (!L.togglePause()) playFirstLib(); }
      else if (tab === 'yt') { if (!Y.ytToggle()) { const first = ytList()[0]; if (first) playYt(first); else toast('Add a YouTube link first'); } }
      else { const t = M.TRACKS.find((x) => x.id === api.get('last')) || M.TRACKS.find((x) => x.mood === mood); playGen(t); }
      refresh();
    }
    function next() {
      const src = playingSource() || tab;
      if (src === 'mine') L.next(); else if (src === 'yt') Y.ytNext();
      else {
        const cur = M.current(); const ts = M.TRACKS.filter((t) => t.mood === (cur?.mood || mood));
        playGen(ts[(ts.findIndex((t) => t.id === cur?.id) + 1) % ts.length]);
      }
      refresh();
    }
    function prev() {
      const src = playingSource() || tab;
      if (src === 'mine') L.prev(); else if (src === 'yt') Y.ytPrev();
      else {
        const cur = M.current(); const ts = M.TRACKS.filter((t) => t.mood === (cur?.mood || mood));
        playGen(ts[(ts.findIndex((t) => t.id === cur?.id) - 1 + ts.length) % ts.length]);
      }
      refresh();
    }
    function startSleep() {
      clearInterval(sleepIv);
      if (!sleepAt) { sleepLeft.textContent = ''; return; }
      sleepIv = setInterval(() => {
        const left = (sleepAt - Date.now()) / 1000;
        if (sleepLeft.isConnected) sleepLeft.textContent = fmtTime(left);
        if (left <= 0) {
          M.stop(3); L.stopLibrary(3); Y.stopYouTube();
          sleepAt = 0; clearInterval(sleepIv);
          if (sleepLeft.isConnected) { sleepLeft.textContent = ''; sleepSel.value = '0'; refresh(); }
        }
      }, 1000);
    }

    function refresh() {
      if (!alive) return;
      const src = playingSource();
      const paused = !src && (L.libState.track || Y.ytState.item);
      let text = 'Not playing';
      if (src === 'builtin') { const c = M.current(); text = `♪ ${c.title} · ${M.MOODS[c.mood].label}`; }
      else if (src === 'mine' || (!src && L.libState.track)) text = `${src ? '♪' : '⏸'} ${L.libState.track.title}`;
      else if (src === 'yt' || (!src && Y.ytState.item)) text = `${src ? '♪' : '⏸'} ${Y.ytTitle() || Y.ytState.item?.title || 'YouTube'}`;
      now.textContent = paused && !L.libState.track && !Y.ytState.item ? 'Not playing' : text;
      playBtn.innerHTML = ''; playBtn.append(icon(src ? 'pause' : 'play'));
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
      body.querySelectorAll('[data-track]').forEach((el) => {
        const id = el.dataset.track;
        const on = (M.current()?.id === id) || (L.libState.track?.id === id) || (Y.ytState.item?.id === id);
        el.classList.toggle('on', !!on);
      });
    }

    // ---------- Built-in ----------
    function playGen(t) { if (!t) return; M.play(t, { volume: api.get('volume', 0.7) }); api.set('last', t.id); refresh(); }
    function renderBuiltin() {
      const chips = h('div', { class: 'chips' }, M.MOOD_ORDER.map((k) =>
        h('button', { class: 'chip' + (k === mood ? ' on' : ''), onclick: () => { mood = k; api.set('mood', k); renderTab(); } }, M.MOODS[k].label, M.MOODS[k].isNew ? h('span', { class: 'new-dot' }, 'NEW') : null)));
      const list = h('div', { class: 'track-list' }, M.TRACKS.filter((t) => t.mood === mood).map((t, i) =>
        h('button', { class: 'track', 'data-track': t.id, onclick: () => playGen(t) },
          h('span', { class: 'track-n' }, i + 1), h('span', {}, t.title), h('span', { class: 'muted' }, M.MOODS[t.mood].label))));
      body.append(h('p', { class: 'hint' }, `${M.TRACKS.length} original instrumental tracks, generated on the device — works offline.`), chips, list);
    }

    // ---------- My Music ----------
    async function playFirstLib() {
      const all = await L.listTracks();
      if (!all.length) { toast('Import some music first'); return; }
      const t = all.find((x) => x.id === api.get('lastLib')) || all[0];
      playLib(t, all);
    }
    async function playLib(t, all) {
      try { await L.playTrack(t, all || await L.listTracks()); api.set('lastLib', t.id); } catch (e) {
        toast(e?.name === 'NotAllowedError' ? 'Tap play again to start' : 'That file can’t be played on this device');
      }
      refresh();
    }
    async function renderMine() {
      const progress = h('div', { class: 'hint' }, lastImportNote);
      lastImportNote = '';
      const input = h('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus', multiple: true, hidden: true, onchange: async () => {
        if (!input.files.length) return;
        const { added, skipped } = await L.importFiles(input.files, (i, n, name) => { progress.textContent = `Importing ${i} of ${n}: ${name}`; });
        progress.textContent = '';
        toast(`Added ${added} song${added === 1 ? '' : 's'}${skipped.length ? ` · skipped ${skipped.length}` : ''}`, 3500);
        if (skipped.length) lastImportNote = `Skipped: ${skipped.slice(0, 4).map((s) => `${s.name} (${s.reason})`).join(', ')}${skipped.length > 4 ? '…' : ''}`;
        input.value = '';
        renderTab();
      } });
      const tracks = await L.listTracks();
      if (!alive || tab !== 'mine') return;
      const bytes = tracks.reduce((n, t) => n + (t.size || 0), 0);
      const shuffleChip = h('button', { class: 'chip' + (L.libState.shuffle ? ' on' : ''), onclick: (e) => { L.libState.shuffle = !L.libState.shuffle; api.set('libShuffle', L.libState.shuffle); e.currentTarget.classList.toggle('on'); } }, '🔀 Shuffle');
      const repeatChip = h('button', { class: 'chip' + (L.libState.repeat ? ' on' : ''), onclick: (e) => { L.libState.repeat = !L.libState.repeat; api.set('libRepeat', L.libState.repeat); e.currentTarget.classList.toggle('on'); } }, '🔁 Repeat');
      body.append(...[
        h('div', { class: 'row gap center' }, h('button', { class: 'pill-btn', style: { background: fg }, onclick: () => input.click() }, icon('plus'), ' Import music'), input),
        progress,
        tracks.length ? h('div', { class: 'chips' }, shuffleChip, repeatChip) : null,
        h('div', { class: 'track-list' }, tracks.length ? tracks.map((t, i) => h('div', { class: 'track', 'data-track': t.id },
          h('button', { class: 'track-n', onclick: () => playLib(t, tracks) }, i + 1),
          h('button', { class: 'track-main', onclick: () => playLib(t, tracks) }, t.title),
          h('span', { class: 'muted' }, t.duration ? fmtTime(t.duration) : ''),
          h('button', { class: 'icon-btn', title: 'Rename', onclick: async () => { const n = prompt('Song name', t.title); if (n && n.trim()) { await L.renameTrack(t.id, n.trim()); renderTab(); } } }, icon('gear')),
          h('button', { class: 'icon-btn', title: 'Delete', onclick: async () => { if (await confirmSheet(`Remove “${t.title}”?`, 'Remove')) { await L.deleteTrack(t.id); renderTab(); refresh(); } } }, icon('trash'))))
          : [h('div', { class: 'empty' }, 'No music yet. Import MP3 or M4A files — for example instrumental albums you’ve bought (piano, string-quartet or lo-fi covers of current hits).')]),
        h('p', { class: 'hint' }, `${tracks.length} song${tracks.length === 1 ? '' : 's'} · ${fmtBytes(bytes)} on this device. Music files stay on this device and aren’t included in backups.`
          + (isIOS ? ' Songs from the Apple Music app can’t be imported (they’re copy-protected) — use files in the Files app.' : '')),
      ].filter(Boolean));
      refresh();
    }

    // ---------- YouTube ----------
    const ytList = () => api.get('yt', []);
    async function playYt(item) {
      if (!navigator.onLine) { toast('YouTube needs an internet connection'); return; }
      try { await Y.playYouTube(item); }
      catch (e) { const code = Number(String(e.message).replace('yt-', '')); toast(Y.YT_ERRORS[code] || (e.message === 'offline' || e.message === 'timeout' ? 'Couldn’t reach YouTube — check the internet or the school filter' : 'Couldn’t play that link'), 4500); }
      refresh();
    }
    function renderYt() {
      const slot = h('div', { class: 'yt-slot' + (Y.ytState.item ? '' : ' empty') }, Y.ytState.item ? '' : 'Pick a playlist below — the YouTube player appears here.');
      const url = h('input', { type: 'url', placeholder: 'Paste a YouTube playlist or video link', inputmode: 'url' });
      const name = h('input', { type: 'text', placeholder: 'Name (optional), e.g. “Piano pop covers”' });
      const add = () => {
        const p = Y.parseYouTube(url.value);
        if (!p) { toast('That doesn’t look like a YouTube link'); return; }
        const item = { id: `yt-${p.list || p.video}`, ...p, title: name.value.trim() || (p.list ? 'YouTube playlist' : 'YouTube video'), url: url.value.trim() };
        api.set('yt', [item, ...ytList().filter((x) => x.id !== item.id)]);
        url.value = ''; name.value = '';
        renderTab(); playYt(item);
      };
      const vol = h('input', { type: 'range', min: 0, max: 100, value: Y.ytState.volume, oninput: (e) => Y.ytVolume(Number(e.target.value)) });
      body.append(
        slot,
        h('div', { class: 'card pad' },
          url, name,
          h('button', { class: 'btn primary', style: { '--c': fg }, onclick: add }, icon('plus'), ' Add & play')),
        h('div', { class: 'track-list' }, ytList().length ? ytList().map((it) => h('div', { class: 'track', 'data-track': it.id },
          h('span', { class: 'track-n' }, it.list ? '☰' : '▶'),
          h('button', { class: 'track-main', onclick: () => playYt(it) }, it.title),
          h('span', { class: 'muted' }, it.list ? 'Playlist' : 'Video'),
          h('button', { class: 'icon-btn', title: 'Rename', onclick: () => { const n = prompt('Name', it.title); if (n && n.trim()) { api.set('yt', ytList().map((x) => (x.id === it.id ? { ...x, title: n.trim() } : x))); renderTab(); } } }, icon('gear')),
          h('button', { class: 'icon-btn', title: 'Remove', onclick: () => { api.set('yt', ytList().filter((x) => x.id !== it.id)); if (Y.ytState.item?.id === it.id) Y.stopYouTube(); renderTab(); } }, icon('trash'))))
          : [h('div', { class: 'empty' }, 'No saved links yet. Find a playlist on YouTube, tap Share → Copy link, and paste it above.')]),
        h('div', { class: 'section-label' }, 'Find playlists on YouTube'),
        h('div', { class: 'chips' }, SEARCHES.map(([label, q]) => h('a', { class: 'chip', href: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAw%253D%253D`, target: '_blank', rel: 'noopener' }, label))),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'YouTube volume', isIOS ? h('small', {}, 'On iPhone/iPad use the device volume buttons') : null), vol),
        h('p', { class: 'hint' }, 'Plays through YouTube’s official player (privacy-enhanced mode). Needs internet; YouTube may show ads; some school filters block YouTube. Keeps playing in a mini player when you open other tools.'),
      );
      Y.dockPlayer(slot);
    }

    function renderTab() {
      if (!alive) return;
      body.innerHTML = '';
      Y.dockPlayer(null);
      if (tab === 'mine') renderMine(); else if (tab === 'yt') renderYt(); else renderBuiltin();
      refresh();
    }

    L.libState.shuffle = api.get('libShuffle', false);
    L.libState.repeat = api.get('libRepeat', true);
    L.libState.onchange = refresh;
    Y.ytState.onchange = () => { if (tab === 'yt' && body.querySelector('.yt-slot.empty') && Y.ytState.item) renderTab(); else refresh(); };

    root.append(h('div', { class: 'stack' },
      h('div', { class: 'row gap center' }, prevBtn, playBtn, nextBtn),
      now,
      seg,
      h('div', { class: 'row gap center' }, h('span', {}, 'Sleep timer'), sleepSel, sleepLeft),
      body));
    renderTab(); startSleep();
    const iv = setInterval(refresh, 1000);
    return {
      primary: toggle,
      secondary: next,
      unmount: () => { alive = false; clearInterval(iv); Y.dockPlayer(null); L.libState.onchange = null; Y.ytState.onchange = null; },
    };
  },
};
