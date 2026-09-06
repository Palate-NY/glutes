// Data section: export / import the training log, migration notice, toasts.

import { app, save } from '../app.js';
import { exportJson, parseImport, BACKUP_KEY } from '../lib/storage.js';
import { migrateState } from '../lib/migrate.js';
import { toISODate } from '../lib/dates.js';

let toastTimer = null;
export function toast(msg, ms = 3500) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

export function renderDataNote(extra) {
  const el = document.getElementById('data-note');
  if (!el) return;
  const n = Object.keys(app.state.actuals).length;
  const stats = app.state.statHistory ? Object.values(app.state.statHistory).reduce((s, h) => s + h.length, 0) : 0;
  const parts = [`${n} logged session slots · ${stats} stat entries · stored in this browser only`];
  if (extra) parts.push(extra);
  if (app.state.migratedAt) parts.push(`Log re-keyed by date on ${app.state.migratedAt.slice(0, 10)} (backup kept as "${BACKUP_KEY}")`);
  el.textContent = parts.join(' · ');
}

export function exportData() {
  const json = exportJson(app.state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `glutes-log-${toISODate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens a file picker; on success replaces the whole state and reloads. */
export function importData(onDone) {
  const input = document.getElementById('import-file');
  if (!input) return;
  input.value = '';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const incoming = parseImport(await file.text());
      const n = Object.keys(incoming.actuals || {}).length;
      if (!confirm(`Replace the log in this browser with "${file.name}" (${n} session slots)?`)) return;
      const { state } = migrateState(incoming);
      app.state = state;
      save();
      toast('Log imported');
      if (onDone) onDone();
    } catch (e) {
      alert(`Import failed: ${e.message}`);
    }
  };
  input.click();
}
