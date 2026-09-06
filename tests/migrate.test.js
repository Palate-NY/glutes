import { describe, it, expect } from 'vitest';
import { migrateState, legacyKeyToV2, actualKey, CURRENT_VERSION } from '../src/lib/migrate.js';

const v1 = {
  actuals: {
    W1D0S0: { status: 'done' },                       // Mon May 4
    W1D3S0: { status: 'done', power: '245', hr: '160', tss: '78', notes: 'SESSION LOG ...' },
    W3D1S1: { status: 'done' },                       // Tue May 19, second session (strength)
    W8D3S0: { status: 'partial', tss: '150' },        // Cannes, Thu Jun 25
    W14D5S0: { status: 'done', notes: 'PR day' },     // Sat Aug 8
    W14D6S0: {},                                      // empty slot
  },
  statHistory: { ftp: [{ date: '2026-05-04', value: 260, note: '' }] },
};

describe('legacy key mapping', () => {
  it('maps W{week}D{day}S{idx} to a date from the 2026-05-04 start', () => {
    expect(legacyKeyToV2('W1D0S0')).toBe('2026-05-04/0');
    expect(legacyKeyToV2('W1D3S0')).toBe('2026-05-07/0');
    expect(legacyKeyToV2('W3D1S1')).toBe('2026-05-19/1');
    expect(legacyKeyToV2('W8D3S0')).toBe('2026-06-25/0');
    expect(legacyKeyToV2('W14D5S0')).toBe('2026-08-08/0');
    expect(legacyKeyToV2('2026-08-08/0')).toBeNull();
  });
  it('actualKey formats date/idx', () => expect(actualKey('2026-09-07', 1)).toBe('2026-09-07/1'));
});

describe('migrateState', () => {
  it('converts every v1 key, keeps every value, keeps stat history, does not mutate input', () => {
    const before = JSON.stringify(v1);
    const { state, report } = migrateState(v1);
    expect(JSON.stringify(v1)).toBe(before);
    expect(state.version).toBe(CURRENT_VERSION);
    expect(report).toMatchObject({ from: 1, migrated: 6, kept: 0, collisions: [] });
    expect(Object.keys(state.actuals).sort()).toEqual(['2026-05-04/0', '2026-05-07/0', '2026-05-19/1', '2026-06-25/0', '2026-08-08/0', '2026-08-09/0']);
    expect(state.actuals['2026-05-07/0']).toEqual(v1.actuals.W1D3S0);
    expect(state.statHistory).toEqual(v1.statHistory);
    expect(state.migratedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is idempotent on v2 state', () => {
    const first = migrateState(v1).state;
    const { state, report } = migrateState(first);
    expect(report.migrated).toBe(0);
    expect(state.actuals).toEqual(first.actuals);
  });

  it('handles empty / missing state', () => {
    expect(migrateState(null).state).toEqual({ version: 2, actuals: {} });
    expect(migrateState({}).report.migrated).toBe(0);
  });

  it('keeps a non-empty entry when an empty legacy one collides', () => {
    const { state, report } = migrateState({ actuals: { W1D0S0: {}, 'X': { status: 'done' } } });
    expect(state.actuals.X).toEqual({ status: 'done' });
    expect(report.kept).toBe(1);
    expect(report.migrated).toBe(1);
  });
});
