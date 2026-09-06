// Session library. Sessions are defined as JSON in src/data/sessions/*.json and
// loaded here. A session's "blocks" may contain repeat groups
// ({ "repeat": n, "blocks": [...] }) which are expanded to a flat list.

// Every JSON file in src/data/sessions/ is loaded; add a file, no JS edit needed.
const files = import.meta.glob('../data/sessions/*.json', { eager: true, import: 'default' });

export const SESSION_TYPES = ['rest', 'z2', 'ss', 'thr', 'vo2', 'strength'];
export const BLOCK_KINDS = ['warm', 'work', 'rec', 'easy', 'cool'];
export const HARD_TYPES = ['vo2', 'thr', 'ss'];

export const SESSION_FILES = Object.keys(files).sort();
export const RAW_SESSIONS = SESSION_FILES.flatMap((f) => {
  const list = files[f];
  if (!Array.isArray(list)) throw new Error(`${f}: must be a JSON array of sessions`);
  return list.map((raw) => ({ ...raw, _file: f.replace('../data/sessions/', '') }));
});

export function isHardType(type) {
  return HARD_TYPES.includes(type);
}

/** Flatten repeat groups into a plain list of blocks (fresh objects). */
export function expandBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.repeat !== undefined) {
      for (let i = 0; i < b.repeat; i++) out.push(...expandBlocks(b.blocks));
    } else {
      out.push({ dur: b.dur, power: b.power, label: b.label, kind: b.kind });
    }
  }
  return out;
}

function validateBlocks(blocks, path, errors) {
  if (!Array.isArray(blocks)) { errors.push(`${path}: blocks must be an array`); return; }
  blocks.forEach((b, i) => {
    const p = `${path}[${i}]`;
    if (b === null || typeof b !== 'object') { errors.push(`${p}: not an object`); return; }
    if (b.repeat !== undefined) {
      if (!Number.isInteger(b.repeat) || b.repeat < 1) errors.push(`${p}: repeat must be a positive integer`);
      if (!Array.isArray(b.blocks) || b.blocks.length === 0) errors.push(`${p}: repeat group needs a non-empty blocks array`);
      else validateBlocks(b.blocks, p + '.blocks', errors);
      return;
    }
    if (!Number.isInteger(b.dur) || b.dur <= 0) errors.push(`${p}: dur must be a positive integer (seconds)`);
    if (typeof b.power !== 'number' || b.power < 0) errors.push(`${p}: power must be a number (watts)`);
    if (typeof b.label !== 'string' || !b.label) errors.push(`${p}: label required`);
    if (!BLOCK_KINDS.includes(b.kind)) errors.push(`${p}: kind must be one of ${BLOCK_KINDS.join('|')}`);
  });
}

/** Returns a list of problems with a raw JSON session (empty list = valid). */
export function validateSession(raw) {
  const errors = [];
  const id = raw && raw.id;
  const where = `session ${id || '(no id)'}`;
  if (!raw || typeof raw !== 'object') return [`${where}: not an object`];
  if (typeof id !== 'string' || !/^[A-Za-z0-9_]+$/.test(id)) errors.push(`${where}: id must match [A-Za-z0-9_]+`);
  if (typeof raw.name !== 'string' || !raw.name) errors.push(`${where}: name required`);
  if (!SESSION_TYPES.includes(raw.type)) errors.push(`${where}: type must be one of ${SESSION_TYPES.join('|')}`);
  if (typeof raw.duration_min !== 'number' || raw.duration_min < 0) errors.push(`${where}: duration_min must be a number >= 0`);
  if (typeof raw.description !== 'string') errors.push(`${where}: description must be a string`);
  if (typeof raw.tss !== 'number' || raw.tss < 0) errors.push(`${where}: tss must be a number >= 0`);
  if (raw.avg_power !== null && (typeof raw.avg_power !== 'number' || raw.avg_power < 0)) errors.push(`${where}: avg_power must be a number or null`);
  if (raw.notes !== undefined && typeof raw.notes !== 'string') errors.push(`${where}: notes must be a string`);
  validateBlocks(raw.blocks, `${where}.blocks`, errors);
  return errors;
}

/** Raw JSON -> the runtime shape used by the UI (blocks expanded). */
export function normalizeSession(raw) {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    dur: raw.duration_min,
    prescribed: raw.description,
    tss: raw.tss,
    targetPower: raw.avg_power,
    notes: raw.notes || '',
    file: raw._file || null,
    blocks: expandBlocks(raw.blocks),
  };
}

export function validateSessionLibrary(raws = RAW_SESSIONS) {
  const errors = raws.flatMap(validateSession);
  const seen = new Set();
  for (const r of raws) {
    if (seen.has(r.id)) errors.push(`duplicate session id ${r.id}`);
    seen.add(r.id);
  }
  return errors;
}

export const SESSIONS = Object.freeze(Object.fromEntries(RAW_SESSIONS.map((r) => [r.id, normalizeSession(r)])));

export function getSession(id) {
  const s = SESSIONS[id];
  if (!s) throw new Error(`Unknown session id "${id}"`);
  return s;
}

export function totalDuration(sess) {
  return sess.blocks.reduce((sum, b) => sum + b.dur, 0);
}
