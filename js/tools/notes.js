import { h, icon, toast } from '../ui.js';
import { fx } from '../audio.js';
import { store, uid, currentClass } from '../store.js';
import { currentRoutine } from '../routines.js';

export default {
  id: 'notes', name: 'Notes', icon: 'notes', bg: '#F9D79A', fg: '#EFA23A',
  mount(root) {
    const listEl = h('div', { class: 'notes-list' });
    const notes = () => store.get('notes', []);
    const save = (n) => store.set('notes', n);
    let filter = '';

    function quickNote() {
      const r = currentRoutine();
      const n = { id: uid(), at: Date.now(), subject: r?.name || currentClass()?.name || 'General', text: '' };
      save([n, ...notes()]); fx.click(); toast(`Note saved · ${n.subject}`); render(n.id);
    }
    function dictate(n, ta) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { toast('Dictation isn’t available here — tap the text box and use the 🎤 key on your keyboard', 4000); ta.focus(); return; }
      const rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = false;
      rec.onresult = (e) => { ta.value = `${ta.value} ${e.results[0][0].transcript}`.trim(); n.text = ta.value; save(notes().map((x) => (x.id === n.id ? { ...x, text: n.text } : x))); };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          toast('Microphone/Speech Recognition is blocked — see Settings → Microphone. Or use the 🎤 key on your keyboard.', 5000);
        } else if (e.error === 'no-speech') toast('Didn’t hear anything');
        else if (e.error === 'audio-capture') toast('No microphone available');
        else toast('Dictation stopped — try the 🎤 key on your keyboard');
      };
      try { rec.start(); toast('Listening…'); } catch { toast('Dictation is already running'); }
    }
    function render(focusId) {
      listEl.innerHTML = '';
      const q = filter.toLowerCase();
      const items = notes().filter((n) => !q || n.text.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q));
      if (!items.length) listEl.append(h('div', { class: 'empty' }, 'No notes yet. Press the clicker or the button to drop a time-stamped note.'));
      let lastDay = '';
      for (const n of items) {
        const d = new Date(n.at);
        const day = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
        if (day !== lastDay) { listEl.append(h('div', { class: 'section-label' }, day)); lastDay = day; }
        const ta = h('textarea', { rows: 2, placeholder: 'Add details later…', oninput: (e) => { save(notes().map((x) => (x.id === n.id ? { ...x, text: e.target.value } : x))); } }, n.text);
        listEl.append(h('div', { class: 'note' },
          h('div', { class: 'note-head' },
            h('span', { class: 'note-subj' }, n.subject),
            h('span', { class: 'muted' }, d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })),
            h('button', { class: 'icon-btn', title: 'Dictate', onclick: () => dictate(n, ta) }, icon('mic')),
            h('button', { class: 'icon-btn', title: 'Delete', onclick: () => { save(notes().filter((x) => x.id !== n.id)); render(); } }, icon('trash'))),
          ta));
        if (n.id === focusId) setTimeout(() => ta.focus({ preventScroll: true }), 50);
      }
    }
    function exportTxt() {
      const txt = notes().map((n) => `${new Date(n.at).toLocaleString()} — ${n.subject}\n${n.text || '(no text)'}\n`).join('\n');
      const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })), download: `classroom-notes-${new Date().toISOString().slice(0, 10)}.txt` });
      a.click();
    }
    root.append(h('div', { class: 'stack' },
      h('div', { class: 'row gap center' },
        h('button', { class: 'pill-btn big', style: { background: this.fg }, onclick: quickNote }, icon('plus'), ' Quick note'),
        h('button', { class: 'btn', onclick: exportTxt }, 'Export')),
      h('input', { type: 'search', placeholder: 'Search notes…', oninput: (e) => { filter = e.target.value; render(); } }),
      listEl));
    render();
    return { primary: quickNote, secondary: () => {} };
  },
};
