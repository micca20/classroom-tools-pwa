import { h, icon, toast } from '../ui.js';
import { audioCtx, fx, speak } from '../audio.js';

function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

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
    let threshold = api.get('threshold', 70);
    let stream; let raf; let level = 0; let loudSince = 0; let cooldownUntil = 0;
    let alarms = 0;
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'svg');
    g.setAttribute('viewBox', '0 0 200 120'); g.setAttribute('class', 'gauge');
    const seg = (a0, a1, color) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', arc(100, 100, 80, a0, a1)); p.setAttribute('stroke', color); p.setAttribute('stroke-width', '22'); p.setAttribute('fill', 'none'); g.append(p); return p; };
    const A = (pct) => Math.PI + (pct / 100) * Math.PI;
    seg(A(0), A(100), '#e9ecef');
    const fill = seg(A(0), A(0.1), '#8CBF3F');
    const thr = document.createElementNS(NS, 'line'); thr.setAttribute('stroke', '#333'); thr.setAttribute('stroke-width', '3'); g.append(thr);
    const needle = document.createElementNS(NS, 'line'); needle.setAttribute('x1', 100); needle.setAttribute('y1', 100); needle.setAttribute('stroke', '#333'); needle.setAttribute('stroke-width', '5'); needle.setAttribute('stroke-linecap', 'round'); needle.setAttribute('x2', 30); needle.setAttribute('y2', 100); g.append(needle);
    const hub = document.createElementNS(NS, 'circle'); hub.setAttribute('cx', 100); hub.setAttribute('cy', 100); hub.setAttribute('r', 8); hub.setAttribute('fill', '#333'); g.append(hub);

    const status = h('div', { class: 'noise-status' }, 'Tap Start to listen');
    const count = h('div', { class: 'hint' });
    const startBtn = h('button', { class: 'pill-btn big', style: { background: this.fg }, onclick: () => (stream ? stop() : start()) }, icon('mic'), ' Start listening');
    const thrInput = h('input', { type: 'range', min: 10, max: 95, value: threshold, oninput: (e) => { threshold = Number(e.target.value); api.set('threshold', threshold); drawThr(); } });
    const drawThr = () => { const a = A(threshold); thr.setAttribute('x1', 100 + 62 * Math.cos(a)); thr.setAttribute('y1', 100 + 62 * Math.sin(a)); thr.setAttribute('x2', 100 + 98 * Math.cos(a)); thr.setAttribute('y2', 100 + 98 * Math.sin(a)); };
    const wrap = h('div', { class: 'center-stack' }, g, status,
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Alarm level'), thrInput),
      startBtn, count,
      h('p', { class: 'hint' }, 'Listens to the voice range (≈250–3500 Hz). Nothing is recorded.'));
    root.append(wrap);
    drawThr();

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch { toast('Microphone permission is needed'); return; }
      const c = audioCtx();
      const src = c.createMediaStreamSource(stream);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
      const an = c.createAnalyser(); an.fftSize = 2048;
      src.connect(hp); hp.connect(lp); lp.connect(an);
      const buf = new Float32Array(an.fftSize);
      startBtn.innerHTML = ''; startBtn.append(icon('pause'), ' Stop');
      const loop = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        const db = 20 * Math.log10(rms + 1e-8); // ~ -100..0
        const sens = api.get('sensitivity', 5);
        const pct = Math.max(0, Math.min(100, (db + 60 + sens * 3) * 2.2));
        level = level * 0.85 + pct * 0.15;
        const a = A(level);
        needle.setAttribute('x2', 100 + 70 * Math.cos(a)); needle.setAttribute('y2', 100 + 70 * Math.sin(a));
        fill.setAttribute('d', arc(100, 100, 80, A(0), A(Math.max(0.5, level))));
        const color = level > threshold ? '#E36D6D' : level > threshold * 0.75 ? '#E8C53A' : '#8CBF3F';
        fill.setAttribute('stroke', color);
        status.textContent = level > threshold ? 'Too loud!' : level > threshold * 0.75 ? 'Getting loud…' : 'Nice and quiet';
        status.style.color = color;
        const now = performance.now();
        if (level > threshold) {
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
        raf = requestAnimationFrame(loop);
      };
      loop();
    }
    function stop() {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop()); stream = null;
      startBtn.innerHTML = ''; startBtn.append(icon('mic'), ' Start listening');
      status.textContent = 'Paused';
    }
    return { primary: () => (stream ? stop() : start()), secondary: () => { alarms = 0; count.textContent = ''; }, unmount: stop };
  },
};
