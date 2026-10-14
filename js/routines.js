// Routines engine: daily schedule that announces subjects/reminders while the app is open.
import { store } from './store.js';
import { fx, speak } from './audio.js';

export const DAYS = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
export const ROUTINE_COLORS = ['#B9758E', '#5BA6E3', '#5FB25A', '#9B79D8', '#E3A23A', '#E36D6D', '#3FAF96', '#7676D6'];

export const routines = () => store.get('routines', []);
const minutesOf = (r) => r.hour * 60 + r.minute;

// The most recent routine that has started today = current subject.
export function currentRoutine(now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  const today = routines().filter((r) => r.enabled !== false && r.days.includes(now.getDay()) && minutesOf(r) <= m);
  return today.sort((a, b) => minutesOf(b) - minutesOf(a))[0] || null;
}
export function nextRoutine(now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  const today = routines().filter((r) => r.enabled !== false && r.days.includes(now.getDay()) && minutesOf(r) > m);
  return today.sort((a, b) => minutesOf(a) - minutesOf(b))[0] || null;
}

export function announce(r) {
  fx.play(r.sound || 'chime');
  const text = r.message?.trim() || `It's time for ${r.name}.`;
  setTimeout(() => speak(text), 1500);
  if (r.classId && store.get('classes', []).some((c) => c.id === r.classId)) store.set('currentClassId', r.classId);
  if (r.resetTools) document.dispatchEvent(new CustomEvent('reset-tools'));
  document.dispatchEvent(new CustomEvent('routine', { detail: r }));
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(r.name, { body: text, icon: 'icons/icon-192.png' }); } catch { /* ignore */ }
  }
}

let lastKey = '';
export function startRoutineEngine() {
  const check = () => {
    const now = new Date();
    const key = `${now.toDateString()} ${now.getHours()}:${now.getMinutes()}`;
    if (key === lastKey) return;
    lastKey = key;
    const m = now.getHours() * 60 + now.getMinutes();
    routines().filter((r) => r.enabled !== false && r.days.includes(now.getDay()) && minutesOf(r) === m).forEach(announce);
  };
  setInterval(check, 5000);
  check();
}
