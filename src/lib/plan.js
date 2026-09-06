// Training plans. Each plan is a JSON file in src/data/plans/ with a start date
// (a Monday), a list of blocks (phases) and a list of weeks whose days reference
// session ids from the session library.

import climb2026 from '../data/plans/2026-climb-pr.json';
import season2027 from '../data/plans/2027-season.json';
import { SESSIONS } from './sessions.js';
import { addDays, fmtDate, parseLocalDate } from './dates.js';

export const RAW_PLANS = [climb2026, season2027];

export function normalizeDayCell(cell) {
  return Array.isArray(cell) ? cell : [cell];
}

export function validatePlan(raw, sessions = SESSIONS) {
  const errors = [];
  const where = `plan ${(raw && raw.id) || '(no id)'}`;
  if (!raw || typeof raw !== 'object') return [`${where}: not an object`];
  if (typeof raw.id !== 'string' || !/^[a-z0-9-]+$/.test(raw.id)) errors.push(`${where}: id must match [a-z0-9-]+`);
  if (typeof raw.name !== 'string' || !raw.name) errors.push(`${where}: name required`);
  if (typeof raw.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.start)) errors.push(`${where}: start must be YYYY-MM-DD`);
  else if (parseLocalDate(raw.start).getDay() !== 1) errors.push(`${where}: start must be a Monday`);
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) errors.push(`${where}: blocks required`);
  const blockIds = new Set();
  (raw.blocks || []).forEach((b, i) => {
    if (!Number.isInteger(b.id)) errors.push(`${where}.blocks[${i}]: integer id required`);
    if (blockIds.has(b.id)) errors.push(`${where}.blocks[${i}]: duplicate block id ${b.id}`);
    blockIds.add(b.id);
    for (const k of ['name', 'focus', 'purpose']) if (typeof b[k] !== 'string' || !b[k]) errors.push(`${where}.blocks[${i}]: ${k} required`);
  });
  if (!Array.isArray(raw.weeks) || raw.weeks.length === 0) { errors.push(`${where}: weeks required`); return errors; }
  raw.weeks.forEach((w, i) => {
    const p = `${where}.weeks[${i}]`;
    if (w.week !== i + 1) errors.push(`${p}: week numbers must be sequential from 1 (got ${w.week})`);
    if (typeof w.label !== 'string' || !w.label) errors.push(`${p}: label required`);
    if (!blockIds.has(w.block)) errors.push(`${p}: unknown block ${w.block}`);
    if (!Array.isArray(w.days) || w.days.length !== 7) { errors.push(`${p}: days must have 7 entries`); return; }
    w.days.forEach((cell, d) => {
      const ids = normalizeDayCell(cell);
      if (ids.length === 0) errors.push(`${p}.days[${d}]: empty day, use "REST"`);
      for (const id of ids) if (!sessions[id]) errors.push(`${p}.days[${d}]: unknown session "${id}"`);
    });
  });
  return errors;
}

export function dateForDay(plan, week, dayIdx) {
  return addDays(plan.start, (week - 1) * 7 + dayIdx);
}

export function loadPlan(raw, sessions = SESSIONS) {
  const errors = validatePlan(raw, sessions);
  if (errors.length) throw new Error(errors.join('\n'));
  const plan = {
    id: raw.id,
    name: raw.name,
    status: raw.status || 'active',
    goal: raw.goal || '',
    startISO: raw.start,
    start: parseLocalDate(raw.start),
    upcoming: raw.upcoming || [],
    weeks: raw.weeks.map((w) => ({
      week: w.week,
      label: w.label,
      blockId: w.block,
      days: w.days.map((cell) => normalizeDayCell(cell).map((id) => sessions[id])),
    })),
    blocks: [],
  };
  plan.end = addDays(plan.start, plan.weeks.length * 7); // exclusive
  plan.blocks = raw.blocks.map((b) => {
    const weeks = plan.weeks.filter((w) => w.blockId === b.id).map((w) => w.week);
    const first = weeks[0], last = weeks[weeks.length - 1];
    return {
      ...b,
      weekNumbers: weeks,
      weeks: weeks.length ? (first === last ? `W${first}` : `W${first}–W${last}`) : '—',
      dateRange: weeks.length ? `${fmtDate(dateForDay(plan, first, 0))} – ${fmtDate(dateForDay(plan, last, 6))}` : '',
    };
  });
  return plan;
}

export const PLANS = RAW_PLANS.map((raw) => loadPlan(raw));

export function planById(id) {
  return PLANS.find((p) => p.id === id) || null;
}

/** The plan that covers `now`; otherwise the most recently started one. */
export function planForDate(now = new Date(), plans = PLANS) {
  const covering = plans.find((p) => now >= p.start && now < p.end);
  if (covering) return covering;
  const started = plans.filter((p) => p.start <= now).sort((a, b) => b.start - a.start);
  if (started.length) return started[0];
  return plans.slice().sort((a, b) => a.start - b.start)[0];
}

export function detectCurrentWeek(plan, now = new Date()) {
  for (let i = 0; i < plan.weeks.length; i++) {
    const start = addDays(plan.start, i * 7);
    const end = addDays(start, 7);
    if (now >= start && now < end) return i + 1;
  }
  if (now < plan.start) return 1;
  return plan.weeks.length;
}
