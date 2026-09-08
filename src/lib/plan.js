// Training plans. Each plan is a JSON file in src/data/plans/ with a start date
// (a Monday), a list of blocks (phases) and a list of weeks whose days reference
// session ids from the session library. Pure logic lives in plan-core.js.

import { SESSIONS } from './sessions.js';
import { loadPlan as loadPlanCore, validatePlan as validatePlanCore, planForDateIn } from './plan-core.js';
export { normalizeDayCell, dateForDay, detectCurrentWeek, planForDateIn } from './plan-core.js';

// Every JSON file in src/data/plans/ is loaded; add a file, no JS edit needed.
const files = import.meta.glob('../data/plans/*.json', { eager: true, import: 'default' });

export const RAW_PLANS = Object.keys(files).sort().map((f) => files[f]);

export function validatePlan(raw, sessions = SESSIONS) {
  return validatePlanCore(raw, sessions);
}

export function loadPlan(raw, sessions = SESSIONS) {
  return loadPlanCore(raw, sessions);
}

export const PLANS = RAW_PLANS.map((raw) => loadPlan(raw)).sort((a, b) => a.start - b.start);
{
  const ids = PLANS.map((p) => p.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`duplicate plan id "${dup}"`);
}

export function planById(id) {
  return PLANS.find((p) => p.id === id) || null;
}

/** The plan that covers `now`; in a gap, the next plan if it starts within two weeks. */
export function planForDate(now = new Date(), plans = PLANS) {
  return planForDateIn(plans, now);
}
