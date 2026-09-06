// localStorage wrapper. The key is unchanged from the single-file app so the
// existing training log is picked up as-is (and migrated, see migrate.js).

export const STORAGE_KEY = 'climb-tracker-state';
export const BACKUP_KEY = 'climb-tracker-state.v1-backup';

function store(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function loadRaw(storage) {
  const s = store(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Glutes: could not read saved state', e);
    return null;
  }
}

export function saveState(state, storage) {
  const s = store(storage);
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Save failed:', e);
  }
}

/** Keep a one-time copy of the pre-migration state. Never overwritten. */
export function backupLegacy(rawJson, storage) {
  const s = store(storage);
  if (!s) return false;
  try {
    if (s.getItem(BACKUP_KEY)) return false;
    s.setItem(BACKUP_KEY, rawJson);
    return true;
  } catch (e) {
    console.error('Backup failed:', e);
    return false;
  }
}

export function exportJson(state) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'glutes', state }, null, 2);
}

/** Accepts either a raw state object or an export file ({ app, state }). */
export function parseImport(text) {
  const obj = JSON.parse(text);
  if (obj && obj.app === 'glutes' && obj.state) return obj.state;
  if (obj && typeof obj === 'object' && ('actuals' in obj || 'statHistory' in obj)) return obj;
  throw new Error('Not a Glutes data file');
}
