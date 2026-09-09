// intervals.icu planned-workout builder. Pure functions; the network part lives
// in scripts/sync-intervals.mjs.
//
// Workout text format (intervals.icu "workout builder" syntax):
//   - Warm-up 15m 160w          one step: cue, duration, absolute watts
//   3x                          repeat block, surrounded by blank lines
//   - Opener 30s 305w
//   - Easy 1m 145w
//
// Absolute watts are used on purpose: the Bolt rides in watts and the file
// does not depend on the FTP set on intervals.icu.

export const EXTERNAL_ID_PREFIX = 'glutes:';
// Planned workouts are scheduled at this local time. Midnight sat on the day
// boundary and Wahoo showed everything one day late; a mid-morning time keeps
// the date stable across the intervals.icu -> Wahoo hand-off.
export const WORKOUT_START_TIME = '07:00:00';

export function fmtStepDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h ? `${h}h` : ''}${m ? `${m}m` : ''}${s || (!h && !m) ? `${s}s` : ''}`;
}

/** A label must not look like a repeat marker ("3x") or a duration/target token. */
function cue(label) {
  return String(label || '')
    .replace(/\b(\d+)x\b/gi, '$1×')
    .replace(/\b\d+(?:h|m|s|w|%|rpm)\b/gi, (t) => t.toUpperCase() === t ? t.toLowerCase().replace(/(\d+)/, '$1 ') : t.replace(/(\d+)/, '$1 '))
    .replace(/\s+/g, ' ')
    .trim();
}

function step(b) {
  const c = cue(b.label);
  return `- ${c ? c + ' ' : ''}${fmtStepDuration(b.dur)} ${Math.round(b.power)}w`;
}

function isPlainList(blocks) {
  return blocks.every((b) => b.repeat === undefined);
}

function expandAll(blocks) {
  return blocks.flatMap((b) => (b.repeat !== undefined ? Array.from({ length: b.repeat }, () => expandAll(b.blocks)).flat() : [b]));
}

/**
 * Build the workout text from raw JSON blocks (repeat groups kept as Nx
 * blocks when they are flat; nested groups are expanded).
 */
export function workoutText(rawBlocks) {
  const parts = [];
  let run = [];
  const flush = () => { if (run.length) { parts.push(run.map(step).join('\n')); run = []; } };
  for (const b of rawBlocks) {
    if (b.repeat === undefined) { run.push(b); continue; }
    if (b.repeat === 1 || !isPlainList(b.blocks)) { run.push(...expandAll([b])); continue; }
    flush();
    parts.push(`${b.repeat}x\n${b.blocks.map(step).join('\n')}`);
  }
  flush();
  return parts.join('\n\n');
}

function safeHeader(text) {
  return String(text || '').replace(/\b(\d+)x\b/gi, '$1×').replace(/\s+/g, ' ').trim();
}

/**
 * Planned-workout event for one session slot, or null for rest days.
 * `raw` is the JSON session (with repeat groups), `sess` the normalized one.
 */
export function eventFor(raw, sess, planId, iso, idx) {
  if (sess.type === 'rest') return null;
  const external_id = `${EXTERNAL_ID_PREFIX}${planId}:${iso}:${idx}`;
  const base = {
    category: 'WORKOUT',
    start_date_local: `${iso}T${WORKOUT_START_TIME}`,
    name: sess.name,
    external_id,
    moving_time: Math.round((sess.dur || 0) * 60),
  };
  if (sess.tss > 0) base.icu_training_load = Math.round(sess.tss);
  if (sess.type === 'strength') {
    return { ...base, type: 'WeightTraining', description: safeHeader(sess.prescribed) };
  }
  const header = safeHeader(sess.prescribed);
  const steps = raw.blocks && raw.blocks.length ? workoutText(raw.blocks) : '';
  return {
    ...base,
    type: 'Ride',
    description: [header, steps].filter(Boolean).join('\n\n'),
  };
}

/** Events for every day of `plan` between fromISO and toISO (inclusive). */
export function plannedEvents(plan, rawById, fromISO, toISO) {
  const out = [];
  const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  plan.weeks.forEach((w) => {
    w.days.forEach((sessions, di) => {
      const d = new Date(plan.start);
      d.setDate(d.getDate() + (w.week - 1) * 7 + di);
      const iso = toISODate(d);
      if (iso < fromISO || iso > toISO) return;
      sessions.forEach((sess, idx) => {
        const ev = eventFor(rawById[sess.id], sess, plan.id, iso, idx);
        if (ev) out.push(ev);
      });
    });
  });
  return out;
}

function fieldEqual(k, a, b) {
  if (k === 'icu_training_load' || k === 'moving_time') return (a || 0) === (b || 0);
  if (k === 'start_date_local') return String(a).slice(0, 16) === String(b).slice(0, 16);
  if (k === 'description') return String(a ?? '').replace(/\r\n/g, '\n').trim() === String(b ?? '').replace(/\r\n/g, '\n').trim();
  return (a ?? null) === (b ?? null);
}

const COMPARE = ['name', 'description', 'type', 'start_date_local', 'moving_time', 'icu_training_load', 'category'];

/** Diff wanted events against existing ones (matched on external_id). */
export function diffEvents(existing, wanted) {
  const byId = new Map(existing.filter((e) => e.external_id && e.external_id.startsWith(EXTERNAL_ID_PREFIX)).map((e) => [e.external_id, e]));
  const create = [], update = [], keep = [];
  for (const w of wanted) {
    const e = byId.get(w.external_id);
    if (!e) { create.push(w); continue; }
    byId.delete(w.external_id);
    const changed = COMPARE.filter((k) => !fieldEqual(k, e[k], w[k]));
    if (!changed.length) keep.push(e); else update.push({ ...w, id: e.id, _changed: changed.map((k) => `${k}: ${JSON.stringify(e[k])} -> ${JSON.stringify(w[k])}`) });
  }
  return { create, update, keep, delete: [...byId.values()] };
}
