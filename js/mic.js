// Microphone access: permission state, iOS audio-session handling, friendly errors + recovery help.
import { setAudioSession } from './audio.js';

const ua = navigator.userAgent;
export const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const isAndroid = /Android/.test(ua);

export function micSupported() {
  if (!window.isSecureContext) return { ok: false, reason: 'insecure' };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'unsupported' };
  return { ok: true };
}

// 'granted' | 'denied' | 'prompt' | 'unknown'
export async function micPermission() {
  try {
    const p = await navigator.permissions.query({ name: 'microphone' });
    return p.state;
  } catch { return 'unknown'; }
}
export async function watchMicPermission(cb) {
  try {
    const p = await navigator.permissions.query({ name: 'microphone' });
    p.onchange = () => cb(p.state);
    return () => { p.onchange = null; };
  } catch { return () => {}; }
}

export class MicError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

let shared = null; // { stream, users }

// Must be called from a tap on iOS for the permission prompt to appear reliably.
export async function getMic() {
  const sup = micSupported();
  if (!sup.ok) throw new MicError(sup.reason, sup.reason === 'insecure' ? 'The microphone only works over https.' : 'This browser can’t use the microphone.');
  if (shared && shared.stream.getAudioTracks().some((t) => t.readyState === 'live')) { shared.users++; return shared.stream; }
  setAudioSession('play-and-record');
  const raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: raw });
  } catch (e) {
    if (e.name === 'OverconstrainedError' || e.name === 'TypeError') {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e2) { setAudioSession('playback'); throw mapError(e2); }
    } else { setAudioSession('playback'); throw mapError(e); }
  }
  shared = { stream, users: 1 };
  stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => document.dispatchEvent(new CustomEvent('mic-ended'))));
  return stream;
}

export function releaseMic(stream) {
  if (!shared || shared.stream !== stream) { stream?.getTracks().forEach((t) => t.stop()); return; }
  shared.users--;
  if (shared.users <= 0) {
    shared.stream.getTracks().forEach((t) => t.stop());
    shared = null;
    setAudioSession('playback');
  }
}

function mapError(e) {
  switch (e.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new MicError('denied', 'Microphone access is blocked.');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new MicError('nodevice', 'No microphone was found.');
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new MicError('busy', 'The microphone is busy — another app (FaceTime, a call, voice memos, dictation) may be using it.');
    default:
      return new MicError('unknown', e.message || 'Could not start the microphone.');
  }
}

// Platform-specific steps to un-block the mic.
export function micHelp(code) {
  if (code === 'insecure') return ['Open the app from its https:// address (GitHub Pages), not a local file.'];
  if (code === 'unsupported') return isIOS ? ['Update to iOS 14.3 or newer, then open the app in Safari or from the Home Screen.'] : ['Use a current version of Chrome, Edge or Safari.'];
  if (code === 'nodevice') return ['Plug in or enable a microphone, then tap Try again.'];
  if (code === 'busy') return ['End any call or recording, close apps that use the mic, then tap Try again.', 'Restarting the device fixes a stuck mic.'];
  if (code === 'denied') {
    if (isIOS && isStandalone) return [
      'Open the iPhone/iPad Settings app → Apps → Safari → Microphone → set to “Ask” or “Allow”.',
      'Also check Settings → Privacy & Security → Microphone (and Screen Time → Content & Privacy → Microphone → Allow Changes).',
      'Close Classroom Tools completely (swipe it away) and reopen it, then tap Try again and choose Allow.',
      'Note: iOS Home Screen apps may ask again each time they launch — that’s an Apple limit.',
    ];
    if (isIOS) return [
      'In Safari, tap the “aA” (or page menu) button in the address bar → Website Settings → Microphone → Allow.',
      'Or: Settings app → Apps → Safari → Microphone → “Ask” or “Allow”.',
      'Reload the page and tap Try again.',
    ];
    if (isAndroid) return [
      'Tap the lock/tune icon next to the address → Permissions → Microphone → Allow.',
      'If installed as an app: long-press the icon → App info → Permissions → Microphone → Allow.',
    ];
    return ['Click the lock/tune icon in the address bar → Microphone → Allow, then reload.', 'On a Mac also check System Settings → Privacy & Security → Microphone for your browser.'];
  }
  return ['Close and reopen the app, then tap Try again.'];
}
