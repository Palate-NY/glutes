import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { workoutText, eventFor, plannedEvents, diffEvents, fmtStepDuration } from '../src/lib/intervals.js';
import { SESSIONS, RAW_SESSIONS } from '../src/lib/sessions.js';
import { planById } from '../src/lib/plan.js';

const rawById = Object.fromEntries(RAW_SESSIONS.map((r) => [r.id, r]));

describe('intervals.icu workout text', () => {
  it('formats durations', () => {
    expect(fmtStepDuration(30)).toBe('30s');
    expect(fmtStepDuration(60)).toBe('1m');
    expect(fmtStepDuration(90)).toBe('1m30s');
    expect(fmtStepDuration(3600)).toBe('1h');
    expect(fmtStepDuration(5400)).toBe('1h30m');
  });

  it('keeps flat repeat groups as Nx blocks and uses absolute watts', () => {
    expect(workoutText(rawById.SS_2x15.blocks)).toBe(
`- Warm-up 15m 160w

3x
- Opener 30s 305w
- Easy 1m 145w

- Sweet Spot 15m 248w
- Recovery 5m 145w
- Sweet Spot 15m 248w
- Cool-down 8m 130w`);
  });

  it('expands nested repeat groups (intervals.icu has no nesting)', () => {
    const text = workoutText(rawById.OU_3x10.blocks);
    expect(text).not.toMatch(/\n\d+x\n[\s\S]*\n\d+x\n/); // no nested markers
    const steps = text.split('\n').filter((l) => l.startsWith('- '));
    expect(steps.length).toBe(SESSIONS.OU_3x10.blocks.length);
  });

  it('never emits a cue that looks like a repeat marker', () => {
    expect(workoutText([{ dur: 60, power: 200, label: '3x fast', kind: 'work' }])).toBe('- 3× fast 1m 200w');
  });
});

describe('events', () => {
  it('rest -> null, strength -> WeightTraining without steps, ride -> Ride with steps', () => {
    expect(eventFor(rawById.REST, SESSIONS.REST, 'p', '2026-09-08', 0)).toBeNull();
    const str = eventFor(rawById.STR_BW, SESSIONS.STR_BW, 'p', '2026-09-08', 1);
    expect(str).toMatchObject({ type: 'WeightTraining', external_id: 'glutes:p:2026-09-08:1', category: 'WORKOUT', start_date_local: '2026-09-08T07:00:00' });
    expect(str.description).not.toMatch(/^- /m);
    expect(str.icu_training_load).toBeUndefined();
    const ride = eventFor(rawById.SS_2x15, SESSIONS.SS_2x15, 'p', '2026-09-08', 0);
    expect(ride).toMatchObject({ type: 'Ride', name: 'Sweet Spot 2×15', moving_time: 3600, icu_training_load: 75 });
    expect(ride.description.startsWith('2 × 15min @ 240-258W (SS), 5min recovery\n\n- Warm-up 15m 160w')).toBe(true);
  });

  it('plannedEvents covers the date window of the active plan, skipping rest days', () => {
    const plan = planById('2027-season');
    const evs = plannedEvents(plan, rawById, '2026-09-07', '2026-09-13');
    const days = plan.weeks[0].days;
    const expected = days.flatMap((ss) => ss.filter((s) => s.type !== 'rest')).length;
    expect(evs).toHaveLength(expected);
    expect(evs.every((e) => e.external_id.startsWith('glutes:2027-season:2026-09-'))).toBe(true);
    expect(plannedEvents(plan, rawById, '2020-01-01', '2020-01-07')).toEqual([]);
  });

  it('diffEvents creates, updates, keeps and deletes by external_id and ignores foreign events', () => {
    const wanted = [
      { external_id: 'glutes:p:2026-09-08:0', name: 'A', description: 'x', type: 'Ride', start_date_local: '2026-09-08T00:00:00', moving_time: 60, icu_training_load: 1, category: 'WORKOUT' },
      { external_id: 'glutes:p:2026-09-09:0', name: 'B', description: 'y', type: 'Ride', start_date_local: '2026-09-09T00:00:00', moving_time: 60, icu_training_load: 1, category: 'WORKOUT' },
    ];
    const existing = [
      { id: 1, ...wanted[0], start_date_local: '2026-09-08T07:00:00' },                 // unchanged
      { id: 2, ...wanted[1], description: 'old' },                                        // changed
      { id: 3, external_id: 'glutes:p:2026-09-10:0', name: 'stale', category: 'WORKOUT' }, // stale
      { id: 4, external_id: 'other-app:1', name: 'not ours', category: 'WORKOUT' },
      { id: 5, name: 'manual', category: 'WORKOUT' },
    ];
    const d = diffEvents(existing, wanted);
    expect(d.create).toEqual([]);
    expect(d.keep.map((e) => e.id)).toEqual([1]);
    expect(d.update.map((e) => e.id)).toEqual([2]);
    expect(d.delete.map((e) => e.id)).toEqual([3]);
  });
});

describe('sync script', () => {
  it('is wired in the workflow and reads the same data files', () => {
    const wf = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/sync-intervals.yml'), 'utf8');
    expect(wf).toContain('scripts/sync-intervals.mjs');
    expect(wf).toContain('INTERVALS_API_KEY');
  });
});
