import { describe, it, expect } from 'vitest';
import golden26 from './fixtures/golden-2026-deployed.json';
import { RAW_PLANS, PLANS, planById, planForDate, detectCurrentWeek, dateForDay, validatePlan, loadPlan } from '../src/lib/plan.js';
import { toISODate } from '../src/lib/dates.js';

const goldenIds = (g) => g.plan.map((w) => ({ week: w.week, label: w.label, blockId: w.blockId, days: w.days }));
const idsOf = (plan) => plan.weeks.map((w) => ({ week: w.week, label: w.label, blockId: w.blockId, days: w.days.map((d) => d.map((s) => s.id)) }));

describe('plan JSON', () => {
  it('all plans validate', () => {
    for (const raw of RAW_PLANS) expect(validatePlan(raw), raw.id).toEqual([]);
  });

  // The 2027 season was rebuilt from scratch in Sep 2026 (50 weeks), so it no longer
  // mirrors the v47 PLAN array. golden-v47 stays the migration snapshot for sessions and ZWO.

  it('2026 climb PR matches the PLAN array of the deployed single-file app (what the 2026 log was made against)', () => {
    expect(idsOf(planById('2026-climb-pr'))).toEqual(goldenIds(golden26));
  });

  it('2026 block ranges are computed from the plan data', () => {
    // The old hand-written tiles said Block 2 = W5–W8 / Block 3 = W9–W12, but the
    // PLAN array tagged W9 (Taper + Retest) as block 2. The data wins.
    const p = planById('2026-climb-pr');
    expect(p.blocks.map((b) => [b.weeks, b.dateRange])).toEqual([
      ['W1–W4', 'May 4 – May 31'],
      ['W5–W9', 'Jun 1 – Jul 5'],
      ['W10–W12', 'Jul 6 – Jul 26'],
      ['W13–W14', 'Jul 27 – Aug 9'],
    ]);
    expect(golden26.BLOCKS[0].dateRange).toBe('May 4 – May 31');
  });

  it('2027 season starts Mon Sep 7 2026 and ends after 50 weeks', () => {
    const p = planById('2027-season');
    expect(toISODate(p.start)).toBe('2026-09-07');
    expect(p.weeks).toHaveLength(50);
    expect(toISODate(dateForDay(p, 50, 6))).toBe('2027-08-22');
    expect(p.blocks.map((b) => b.weeks)).toEqual(['W1–W3', 'W4–W16', 'W17–W28', 'W29–W36', 'W37–W42', 'W43', 'W44–W50']);
  });
});

describe('plan selection and week detection', () => {
  it('picks the plan covering today, else the most recent', () => {
    expect(planForDate(new Date(2026, 5, 15)).id).toBe('2026-climb-pr');
    expect(planForDate(new Date(2026, 7, 10)).id).toBe('2026-climb-pr'); // Aug 10: gap, next plan is 4 weeks out
    expect(planForDate(new Date(2026, 8, 6)).id).toBe('2027-season');   // Sep 6: gap, next plan starts tomorrow
    expect(planForDate(new Date(2026, 8, 7)).id).toBe('2027-season');
    expect(planForDate(new Date(2028, 0, 1)).id).toBe('2027-season');
    expect(planForDate(new Date(2020, 0, 1)).id).toBe('2026-climb-pr');
  });

  it('detectCurrentWeek clamps to the plan length (not a hardcoded 14)', () => {
    const p = planById('2027-season');
    expect(detectCurrentWeek(p, new Date(2026, 8, 1))).toBe(1);
    expect(detectCurrentWeek(p, new Date(2026, 8, 13, 23))).toBe(1);
    expect(detectCurrentWeek(p, new Date(2026, 8, 14))).toBe(2);
    expect(detectCurrentWeek(p, new Date(2026, 11, 27))).toBe(16);
    expect(detectCurrentWeek(p, new Date(2027, 2, 1))).toBe(26);
    expect(detectCurrentWeek(p, new Date(2027, 7, 22))).toBe(50);
    expect(detectCurrentWeek(p, new Date(2027, 11, 1))).toBe(50);
  });
});

describe('validatePlan', () => {
  const base = { id: 'p', name: 'P', start: '2026-09-07', blocks: [{ id: 1, name: 'B', focus: 'F', purpose: 'P' }], weeks: [{ week: 1, label: 'W1', block: 1, days: ['REST', 'REST', 'REST', 'REST', 'REST', 'REST', 'REST'] }] };
  it('accepts a minimal plan', () => expect(validatePlan(base)).toEqual([]));
  it('rejects unknown sessions, non-Monday starts, bad week numbers, short weeks', () => {
    expect(validatePlan({ ...base, weeks: [{ ...base.weeks[0], days: ['REST', 'NOPE', 'REST', 'REST', 'REST', 'REST', 'REST'] }] })).toHaveLength(1);
    expect(validatePlan({ ...base, start: '2026-09-08' })).toHaveLength(1);
    expect(validatePlan({ ...base, weeks: [{ ...base.weeks[0], week: 2 }] })).toHaveLength(1);
    expect(validatePlan({ ...base, weeks: [{ ...base.weeks[0], days: ['REST'] }] })).toHaveLength(1);
    expect(() => loadPlan({ ...base, start: 'nope' })).toThrow();
  });
});
