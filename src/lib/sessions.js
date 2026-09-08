// Session library. Sessions are defined as JSON in src/data/sessions/*.json and
// loaded here. A session's "blocks" may contain repeat groups
// ({ "repeat": n, "blocks": [...] }) which are expanded to a flat list.
// Pure logic lives in sessions-core.js.

import { buildSessionMap, validateSessionLibrary as validateLib } from './sessions-core.js';
export * from './sessions-core.js';

// Every JSON file in src/data/sessions/ is loaded; add a file, no JS edit needed.
const files = import.meta.glob('../data/sessions/*.json', { eager: true, import: 'default' });

export const SESSION_FILES = Object.keys(files).sort();
export const RAW_SESSIONS = SESSION_FILES.flatMap((f) => {
  const list = files[f];
  if (!Array.isArray(list)) throw new Error(`${f}: must be a JSON array of sessions`);
  return list.map((raw) => ({ ...raw, _file: f.replace('../data/sessions/', '') }));
});

export function validateSessionLibrary(raws = RAW_SESSIONS) {
  return validateLib(raws);
}

export const SESSIONS = buildSessionMap(RAW_SESSIONS);

export function getSession(id) {
  const s = SESSIONS[id];
  if (!s) throw new Error(`Unknown session id "${id}"`);
  return s;
}
