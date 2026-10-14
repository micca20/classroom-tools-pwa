import { h, icon, shuffle, fmtTime } from '../ui.js';
import { fx, speak } from '../audio.js';
import * as M from '../music.js';

const MOVES = ['Jumping jacks', 'Run in place', 'Arm circles', 'Touch your toes', 'Hop on one foot', 'Squats', 'Reach for the sky', 'Twist side to side',
  'March like a soldier', 'Swim like a fish', 'Wiggle everything', 'Skate in place', 'Punch the air', 'Freeze like a statue', 'Frog jumps', 'Flamingo balance'];
const STRETCHES = ['Reach both arms up high', 'Lean to the left', 'Lean to the right', 'Roll your shoulders back', 'Gently roll your neck', 'Shake out your hands',
  'Stretch your arms across your body', 'Clasp your hands and push forward', 'Rise up on your tiptoes'];
const SILLY = ['Simon says: pat your head', 'Simon says: rub your tummy', 'Pretend to be a tree in the wind', 'Make the silliest face you can', 'Act like a dinosaur',
  'Pretend to climb a ladder', 'Move like a robot', 'Pretend you are walking on the moon', 'Air guitar solo!', 'Be a popcorn kernel — pop!'];

const BREAKS = {
  breathe: { label: 'Breathe', emoji: '🫧', build: (n) => Array.from({ length: n }, () => [
    { say: 'Breathe in', secs: 4, anim: 'in' }, { say: 'Hold', secs: 4, anim: 'hold' }, { say: 'Breathe out', secs: 4, anim: 'out' }, { say: '', secs: 2, anim: 'hold-out' },
  ]).flat(), music: 'dreamy', intro: 'Let\'s take some calm breaths together. Sit tall and relax your shoulders.' },
  move: { label: 'Get Moving', emoji: '🏃', build: (n) => shuffle(MOVES).slice(0, n).map((m) => ({ say: m, secs: 20, anim: 'move' })), music: 'upbeat', intro: 'Stand up! Get ready to move!' },
  stretch: { label: 'Stretch', emoji: '🧘', build: (n) => shuffle(STRETCHES).slice(0, n).map((m) => ({ say: m, secs: 15, anim: 'stretch' })), music: 'calm', intro: 'Let\'s stretch. Move slowly and gently.' },
  silly: { label: 'Silly Break', emoji: '🤪', build: (n) => shuffle(SILLY).slice(0, n).map((m) => ({ say: m, secs: 12, anim: 'move' })), music: 'celebrate', intro: 'Time for a silly break!' },
};

export default {
  id: 'brain', name: 'Brain Breaks', icon: 'brain', bg: '#B4E1EC', fg: '#3DB0CC',
  settings: [
    { key: 'rounds', label: 'Rounds / exercises per break', type: 'range', min: 2, max: 10, default: 5 },
    { key: 'music', label: 'Play music during breaks', type: 'toggle', default: true },
  ],
  mount(root, api) {
    const fg = this.fg;
    let run = null;
    const area = h('div', { class: 'stack' });
    function menu() {
      area.innerHTML = '';
      area.append(h('div', { class: 'section-label' }, 'Choose a brain break'),
        h('div', { class: 'break-grid' }, Object.entries(BREAKS).map(([k, b]) =>
          h('button', { class: 'break-card', onclick: () => start(k) }, h('span', { class: 'emoji' }, b.emoji), h('b', {}, b.label)))),
        h('button', { class: 'pill-btn', style: { background: fg }, onclick: () => start(shuffle(Object.keys(BREAKS))[0]) }, 'Surprise me!'));
    }
    function start(kind) {
      stop(true);
      const b = BREAKS[kind];
      const steps = b.build(api.get('rounds', 5));
      run = { kind, steps, i: -1, until: 0 };
      if (api.get('music', true)) M.play(M.TRACKS.find((t) => t.mood === b.music), { volume: 0.35 });
      const bubble = h('div', { class: `breath ${kind}` });
      const say = h('div', { class: 'big-name sm' }, b.label);
      const clock = h('div', { class: 'hint' });
      const prog = h('div', { class: 'hint' });
      area.innerHTML = '';
      area.append(h('div', { class: 'center-stack' }, bubble, say, clock, prog, h('button', { class: 'btn', onclick: () => { stop(); menu(); } }, 'End break')));
      speak(b.intro);
      run.until = Date.now() + 4000;
      run.iv = setInterval(() => {
        if (!run) return;
        const left = (run.until - Date.now()) / 1000;
        clock.textContent = run.i >= 0 && run.steps[run.i]?.secs > 5 ? fmtTime(Math.ceil(left)) : '';
        if (left > 0) return;
        run.i++;
        if (run.i >= run.steps.length) { stop(); fx.success(); speak('Great job! Brain break complete.'); menu(); return; }
        const s = run.steps[run.i];
        say.textContent = s.say || '…';
        prog.textContent = kind === 'breathe' ? `Breath ${Math.floor(run.i / 4) + 1} of ${run.steps.length / 4}` : `${run.i + 1} of ${run.steps.length}`;
        bubble.className = `breath ${kind} ${s.anim}`;
        bubble.style.animationDuration = `${s.secs}s`;
        if (s.say) { if (kind !== 'breathe') fx.click(); speak(s.say); }
        run.until = Date.now() + s.secs * 1000;
      }, 200);
    }
    function stop(silent) {
      if (!run) return;
      clearInterval(run.iv); run = null; M.stop(1);
      if (!silent) speechSynthesis?.cancel?.();
    }
    root.append(area); menu();
    return { primary: () => (run ? (stop(), menu()) : start(shuffle(Object.keys(BREAKS))[0])), secondary: () => { stop(); menu(); }, unmount: () => stop(true) };
  },
};
