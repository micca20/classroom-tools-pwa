import { h, icon, toast } from '../ui.js';
import { audioCtx, fx, speak } from '../audio.js';
import { getMic, releaseMic, micPermission, watchMicPermission, micHelp, MicError } from '../mic.js';

function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

const PERM_LABEL = { granted: '🎙 Mic allowed', denied: '🚫 Mic blocked', prompt: '🎙 Will ask for mic', unknown: '' };

export default {
  id: 'noise', name: 'Noise Meter', icon: 'noise', bg: '#D7EDB0', fg: '#8CBF3F',
  settings: [
    { key: 'sensitivity', label: 'Microphone sensitivity', type: 'range', min: 1, max: 10, default: 5 },
    { key: 'buffer', label: 'Buffer before alarm', hint: 'Must stay loud this long (prevents false alarms)', type: 'select', number: true, default: 2,
      options: [[0.5, '½ second'], [1, '1 second'], [2, '2 seconds'], [3, '3 seconds'], [5, '5 seconds']] },
    { key: 'sound', label: 'Alarm sound', type: 'select', default: 'warning', options: [['warning', 'Warning beeps'], ['buzzer', 'Buzzer'], ['whistle', 'Whistle'], ['chime', 'Chime'], ['none', 'None']] },
    { key: 'message', label: 'Spoken alarm', type: 'text', default: 'It is getting too loud.' },
  ],
  mount(root, api) {
    const fg = this.fg;
    let threshold = api.get('threshold', 70);
    let stream = null; let raf = 0; let level = 0; let loudSince = 0; let cooldownUntil = 0; let alarms = 0;
    let silentFrames = 0; let calibrating = null; let nodes = null;
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'svg');
    g.setAttribute('viewBox', '0 0 200 120'); g.setAttribute('class', 'gauge');
    const seg = (a0, a1, color) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', arc(100, 100, 80, a0, a1)); p.setAttribute('stroke', color); p.setAttribute('stroke-width', '22'); p.setAttribute('fill', 'none'); g.append(p); return p; };
    const A = (pct) => Math.PI + (pct / 100) * Math.PI;
    seg(A(0), A(100), '#e9ecef');
    const fill = seg(A(0), A(0.1), '#8CBF3F');
    const thr = document.createElementNS(NS, 'line'); thr.setAttribute('stroke', '#333'); thr.setAttribute('stroke-width', '3'); g.append(thr);
    const needle = document.createElementNS(NS, 'line');
    Object.entries({ x1: 100, y1: 100, x2: 30, y2: 100, stroke: '#333', 'stroke-width': 5, 'stroke-linecap': 'round' }).forEach(([k, v]) => needle.setAttribute(k, v));
    g.append(needle);
    const hub = document.createElementNS(NS, 'circle'); hub.setAttribute('cx', 100); hub.setAttribute('cy', 100); hub.setAttribute('r', 8); hub.setAttribute('fill', '#333'); g.append(hub);

    const status = h('div', { class: 'noise-status' }, 'Tap Start to listen');
    const permChip = h('span', { class: 'chip perm', hidden: true });
    const count = h('div', { class: 'hint' });
    const helpBox = h('div', { class: 'card pad help-box', hidden: true });
    const startBtn = h('button', { class: 'pill-btn big', style: { background: fg }, onclick: () => (stream ? stop() : start()) });
    const calBtn = h('button', { class: 'btn', onclick: () => calibrate() }, 'Calibrate quiet room');
    const calInfo = h('div', { class: 'hint' });
    const thrInput = h('input', { type: 'range', min: 10, max: 95, value: threshold, oninput: (e) => { threshold = Number(e.target.value); api.set('threshold', threshold); drawThr(); } });
    const drawThr = () => { const a = A(threshold); thr.setAttribute('x1', 100 + 62 * Math.cos(a)); thr.setAttribute('y1', 100 + 62 * Math.sin(a)); thr.setAttribute('x2', 100 + 98 * Math.cos(a)); thr.setAttribute('y2', 100 + 98 * Math.sin(a)); };
    const setStartLabel = () => { startBtn.innerHTML = ''; startBtn.append(icon(stream ? 'pause' : 'mic'), stream ? ' Stop' : ' Start listening'); };
    const showCal = () => { const b = api.get('baseline', null); calInfo.textContent = b == null ? 'Tip: tap Calibrate while the room is quiet for a more accurate meter.' : `Calibrated: quiet room ≈ ${Math.round(b)} dB`; };

    const wrap = h('div', { class: 'center-stack' }, permChip, g, status,
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Alarm level'), thrInput),
      startBtn, helpBox, count,
      h('div', { class: 'row gap center' }, calBtn), calInfo,
      h('p', { class: 'hint' }, 'Listens to the voice range (≈250–3500 Hz). Nothing is recorded or sent anywhere.'));
    root.append(wrap);
    drawThr(); setStartLabel(); showCal();

    async function refreshPerm(state) {
      state = state || await micPermission();
      permChip.textContent = PERM_LABEL[state] || '';
      permChip.hidden = !PERM_LABEL[state];
      permChip.classList.toggle('bad', state === 'denied');
      if (state === 'denied' && !stream) showHelp('denied');
      if (state === 'granted' && !stream) helpBox.hidden = true;
    }
    let unwatch = () => {};
    watchMicPermission((s) => refreshPerm(s)).then((u) => { unwatch = u; });
    refreshPerm();

    function showHelp(code, msg) {
      helpBox.hidden = false; helpBox.innerHTML = '';
      helpBox.append(h('b', {}, msg || (code === 'denied' ? 'Microphone access is blocked.' : 'Microphone problem.')),
        h('ol', { class: 'help-steps' }, micHelp(code).map((s) => h('li', {}, s))),
        h('button', { class: 'btn primary', onclick: () => { stop(true); start(); } }, 'Try again'));
    }

    async function start() {
      if (stream) return;
      // Wake audio while we're still inside the tap — after the permission prompt the gesture may have expired.
      const c = audioCtx();
      status.textContent = 'Starting microphone…'; status.style.color = '';
      try {
        stream = await getMic();
      } catch (e) {
        const code = e instanceof MicError ? e.code : 'unknown';
        status.textContent = code === 'denied' ? 'Microphone blocked' : 'Microphone unavailable';
        status.style.color = '#E36D6D';
        showHelp(code, e.message);
        refreshPerm();
        return;
      }
      helpBox.hidden = true;
      if (c.state !== 'running') c.resume().catch(() => {}); // never await: it can hang until the next tap
      const src = c.createMediaStreamSource(stream);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
      const an = c.createAnalyser(); an.fftSize = 2048;
      src.connect(hp); hp.connect(lp); lp.connect(an);
      nodes = { src };
      const buf = new Float32Array(an.fftSize);
      setStartLabel(); refreshPerm();
      silentFrames = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (c.state !== 'running') {
          status.textContent = 'Tap the screen to start the meter'; status.style.color = '#8a8a93';
          silentFrames = 0; return;
        }
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        const db = 20 * Math.log10(rms + 1e-9);
        if (calibrating) calibrating.push(db);
        // A live mic is never perfectly silent — catch the iOS "mic delivers zeros" case (~3 s of digital silence).
        if (rms === 0) { if (++silentFrames === 180) showHelp('busy', 'The microphone is sending silence.'); } else if (silentFrames) { silentFrames = 0; helpBox.hidden = true; }
        const sens = api.get('sensitivity', 5);
        const base = api.get('baseline', -60);
        const pct = rms === 0 ? 0 : Math.max(0, Math.min(100, 20 + (db - base) * (1.6 + sens * 0.25)));
        level = level * 0.85 + pct * 0.15;
        const a = A(level);
        needle.setAttribute('x2', 100 + 70 * Math.cos(a)); needle.setAttribute('y2', 100 + 70 * Math.sin(a));
        fill.setAttribute('d', arc(100, 100, 80, A(0), A(Math.max(0.5, level))));
        const color = level > threshold ? '#E36D6D' : level > threshold * 0.75 ? '#E8C53A' : '#8CBF3F';
        fill.setAttribute('stroke', color);
        if (!calibrating) {
          status.textContent = level > threshold ? 'Too loud!' : level > threshold * 0.75 ? 'Getting loud…' : 'Nice and quiet';
          status.style.color = color;
        }
        const now = performance.now();
        if (level > threshold && !calibrating) {
          if (!loudSince) loudSince = now;
          if (now - loudSince > api.get('buffer', 2) * 1000 && now > cooldownUntil) {
            alarms++; count.textContent = `Alarms this session: ${alarms}`;
            cooldownUntil = now + 6000; loudSince = 0;
            wrap.classList.remove('flash'); void wrap.offsetWidth; wrap.classList.add('flash');
            const snd = api.get('sound', 'warning');
            if (snd !== 'none') (fx[snd] ? fx[snd]() : fx.play(snd));
            const msg = api.get('message', 'It is getting too loud.');
            if (msg) setTimeout(() => speak(msg), 900);
          }
        } else loudSince = 0;
      };
      loop();
    }

    async function calibrate() {
      if (!stream) await start();
      if (!stream) return;
      calibrating = [];
      calBtn.disabled = true;
      for (let s = 3; s > 0; s--) { status.textContent = `Stay quiet… ${s}`; status.style.color = '#8a8a93'; await new Promise((r) => setTimeout(r, 1000)); }
      const vals = (calibrating || []).filter((v) => v > -150).sort((a, b) => a - b);
      calibrating = null; calBtn.disabled = false;
      if (vals.length < 20) { toast('Couldn’t hear the mic — try again'); return; }
      api.set('baseline', vals[Math.floor(vals.length / 2)]);
      showCal(); fx.success(); toast('Calibrated ✓');
    }

    function stop(silent) {
      cancelAnimationFrame(raf);
      if (nodes) { try { nodes.src.disconnect(); } catch { /* ignore */ } nodes = null; }
      if (stream) releaseMic(stream);
      stream = null; level = 0; calibrating = null; calBtn.disabled = false;
      setStartLabel();
      if (!silent) { status.textContent = 'Paused'; status.style.color = ''; }
    }
    const onEnded = () => { if (stream) { stop(true); status.textContent = 'Microphone turned off'; showHelp('busy', 'The microphone stopped — a call, Siri or another app may have taken it.'); } };
    document.addEventListener('mic-ended', onEnded);
    return {
      primary: () => (stream ? stop() : start()),
      secondary: () => { alarms = 0; count.textContent = ''; },
      unmount: () => { stop(true); unwatch(); document.removeEventListener('mic-ended', onEnded); },
    };
  },
};
