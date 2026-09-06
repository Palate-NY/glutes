// State migrations.
//
// v1 (single-file app): actuals keyed by plan position, "W{week}D{day}S{idx}".
//    That broke as soon as the plan changed: W1D3S0 silently pointed at a
//    different workout.
// v2: actuals keyed by date, "YYYY-MM-DD/{idx}". Logs survive plan edits and
//    plan switches. The v1 plan started 2026-05-04, so every v1 key maps to a
//    unique date.

import { addDays, parseLocalDate, toISODate } from './dates.js';

export const CURRENT_VERSION = 2;
export const LEGACY_PLAN_START = '2026-05-04';
const LEGACY_KEY = /^W(\d+)D(\d)S(\d+)$/;

export function actualKey(isoDate, sessIdx) {
  return `${isoDate}/${sessIdx}`;
}

export function legacyKeyToV2(key, legacyStart = LEGACY_PLAN_START) {
  const m = LEGACY_KEY.exec(key);
  if (!m) return null;
  const week = Number(m[1]), day = Number(m[2]), idx = Number(m[3]);
  const date = addDays(parseLocalDate(legacyStart), (week - 1) * 7 + day);
  return actualKey(toISODate(date), idx);
}

function isEmptyActual(a) {
  return !a || Object.values(a).every((v) => v === null || v === undefined || v === '');
}

/**
 * Returns { state, report }. `state` is always a fresh v2 object; the input is
 * not mutated. report.migrated > 0 means keys were converted.
 */
export function migrateState(raw) {
  const report = { from: 0, migrated: 0, kept: 0, dropped: [], collisions: [] };
  const src = raw && typeof raw === 'object' ? raw : {};
  const version = Number.isInteger(src.version) ? src.version : 1;
  report.from = version;
  const state = {
    ...src,
    version: CURRENT_VERSION,
    actuals: {},
    statHistory: src.statHistory ? JSON.parse(JSON.stringify(src.statHistory)) : undefined,
  };
  if (state.statHistory === undefined) delete state.statHistory;

  for (const [key, val] of Object.entries(src.actuals || {})) {
    if (version >= 2 || !LEGACY_KEY.test(key)) {
      state.actuals[key] = val;
      report.kept++;
      continue;
    }
    const v2 = legacyKeyToV2(key);
    if (state.actuals[v2] && !isEmptyActual(state.actuals[v2])) {
      report.collisions.push({ key, v2 });
      if (isEmptyActual(val)) continue;
    }
    state.actuals[v2] = val;
    report.migrated++;
  }
  if (report.migrated) state.migratedAt = new Date().toISOString();
  return { state, report };
}
