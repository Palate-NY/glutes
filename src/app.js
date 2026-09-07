// Runtime app state shared by the UI modules (single-user, single page).

import { actualKey } from './lib/migrate.js';
import { dateForDay } from './lib/plan.js';
import { toISODate } from './lib/dates.js';
import { saveState } from './lib/storage.js';
import { SESSIONS } from './lib/sessions.js';

export const app = {
  plan: null,            // loaded plan (see lib/plan.js)
  state: { version: 2, actuals: {} },
  currentWeek: 1,
  currentBlockExpanded: null,
  ftp: 280,
  hrmax: 194,
  lastSeenDate: null,
};

export function save() {
  saveState(app.state);
}

export function isoFor(week, dayIdx) {
  return toISODate(dateForDay(app.plan, week, dayIdx));
}

/** Storage key for a session slot: date-based, survives plan edits. */
export function keyFor(week, dayIdx, sessIdx) {
  return actualKey(isoFor(week, dayIdx), sessIdx);
}

export function actualFor(week, dayIdx, sessIdx) {
  return app.state.actuals[keyFor(week, dayIdx, sessIdx)];
}

export function ensureActual(key) {
  if (!app.state.actuals[key]) app.state.actuals[key] = {};
  return app.state.actuals[key];
}

// ---- Local overrides ------------------------------------------------------
// The JSON plan is the source of truth. Dragging a workout to another day in
// this browser stores an override for that date: state.overrides[planId][iso]
// = [sessionId, ...]. Overrides are per browser (they travel with export /
// import) and never modify the plan file.

function overridesFor(planId, create = false) {
  if (!app.state.overrides) {
    if (!create) return null;
    app.state.overrides = {};
  }
  if (!app.state.overrides[planId]) {
    if (!create) return null;
    app.state.overrides[planId] = {};
  }
  return app.state.overrides[planId];
}

/** Session ids the plan file prescribes for a day. */
export function planDayIds(week, dayIdx) {
  return app.plan.weeks[week - 1].days[dayIdx].map((s) => s.id);
}

/** Session ids in effect for a day (override if valid, else the plan). */
export function dayIds(week, dayIdx) {
  const o = overridesFor(app.plan.id);
  const ids = o && o[isoFor(week, dayIdx)];
  if (Array.isArray(ids) && ids.length && ids.every((id) => SESSIONS[id])) return ids;
  return planDayIds(week, dayIdx);
}

/** Sessions in effect for a day. Use this instead of plan.weeks[].days[]. */
export function daySessions(week, dayIdx) {
  return dayIds(week, dayIdx).map((id) => SESSIONS[id]);
}

export function dayIsOverridden(week, dayIdx) {
  return dayIds(week, dayIdx).join() !== planDayIds(week, dayIdx).join();
}

export function weekHasOverrides(week) {
  for (let d = 0; d < 7; d++) if (dayIsOverridden(week, d)) return true;
  return false;
}

export function setDayIds(week, dayIdx, ids) {
  const iso = isoFor(week, dayIdx);
  if (ids.join() === planDayIds(week, dayIdx).join()) {
    const o = overridesFor(app.plan.id);
    if (o) delete o[iso];
  } else {
    overridesFor(app.plan.id, true)[iso] = ids.slice();
  }
}

/** Any logged status on the day (done / partial / skipped)? */
export function dayHasLog(week, dayIdx) {
  return daySessions(week, dayIdx).some((s, si) => {
    const a = actualFor(week, dayIdx, si);
    return a && a.status;
  });
}

/** Swap the workouts of two days in the same week. Logs stay with their dates. */
export function swapDays(week, a, b) {
  if (a === b) return false;
  const idsA = dayIds(week, a), idsB = dayIds(week, b);
  setDayIds(week, a, idsB);
  setDayIds(week, b, idsA);
  save();
  return true;
}

export function resetWeek(week) {
  const o = overridesFor(app.plan.id);
  if (!o) return;
  for (let d = 0; d < 7; d++) delete o[isoFor(week, d)];
  save();
}
