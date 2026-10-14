// Backups + storage protection.
import { store } from './store.js';
import { isIOS, isStandalone } from './mic.js';

const DAY = 86400000;

// Ask the browser not to evict our data under storage pressure / inactivity cleanup.
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

export async function storageInfo() {
  const info = { persisted: null, usage: null, quota: null, appBytes: store.sizeBytes() };
  try { if (navigator.storage?.persisted) info.persisted = await navigator.storage.persisted(); } catch { /* ignore */ }
  try { if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); info.usage = e.usage; info.quota = e.quota; } } catch { /* ignore */ }
  return info;
}

export const backupFileName = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `classroom-tools-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
};

// Returns true if the backup was (very likely) saved.
export async function exportBackup() {
  store.flush();
  const json = store.exportJSON();
  const name = backupFileName();
  // iOS/iPadOS: the share sheet lets the teacher "Save to Files" → iCloud Drive, AirDrop, or email it.
  if (isIOS && navigator.canShare) {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Classroom Tools backup' });
        markBackedUp(); return true;
      } catch (e) {
        if (e.name === 'AbortError') return false; // user closed the share sheet
        // fall through to a download
      }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  markBackedUp();
  return true;
}

export function markBackedUp() {
  store.set('meta.lastBackupAt', Date.now());
  store.set('meta.snoozeUntil', 0);
}

export const reminderDays = () => store.get('settings.backupReminderDays', 30);

export function backupStatus(now = Date.now()) {
  const m = store.get('meta', {});
  const last = m.lastBackupAt || 0;
  const changed = m.lastChangeAt || 0; // 0 = nothing ever entered on this device
  const unsaved = changed > last + 5000;
  const days = reminderDays();
  // First reminder after a week of use (or sooner if the interval is shorter); afterwards every `days`.
  const ref = last || (m.createdAt || now);
  const wait = (last ? days : Math.min(days, 7)) * DAY;
  const due = days > 0 && unsaved && now - ref > wait && now > (m.snoozeUntil || 0);
  return { last, unsaved, due, daysSince: last ? Math.floor((now - last) / DAY) : null };
}

export function snooze(days = 7) { store.set('meta.snoozeUntil', Date.now() + days * DAY); }

export const lastBackupText = (s = backupStatus()) => (s.last == null || !s.last ? 'Never'
  : s.daysSince === 0 ? 'Today' : s.daysSince === 1 ? 'Yesterday' : `${s.daysSince} days ago`);

export const inSafariTab = isIOS && !isStandalone;

export function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}
