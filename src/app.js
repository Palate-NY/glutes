// Runtime app state shared by the UI modules (single-user, single page).

import { actualKey } from './lib/migrate.js';
import { dateForDay } from './lib/plan.js';
import { toISODate } from './lib/dates.js';
import { saveState } from './lib/storage.js';

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

/** Storage key for a session slot: date-based, survives plan edits. */
export function keyFor(week, dayIdx, sessIdx) {
  return actualKey(toISODate(dateForDay(app.plan, week, dayIdx)), sessIdx);
}

export function actualFor(week, dayIdx, sessIdx) {
  return app.state.actuals[keyFor(week, dayIdx, sessIdx)];
}

export function ensureActual(key) {
  if (!app.state.actuals[key]) app.state.actuals[key] = {};
  return app.state.actuals[key];
}
