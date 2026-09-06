import { describe, it, expect } from 'vitest';
import { parseSessionLog } from '../src/lib/session-log.js';
import { estimateHRFromFTP, computeTSS, creditedTSS } from '../src/lib/metrics.js';
import { parseLocalDate, toISODate, addDays, fmtDate, isToday } from '../src/lib/dates.js';
import { exportJson, parseImport } from '../src/lib/storage.js';

describe('parseSessionLog', () => {
  it('ignores text without a SESSION LOG marker', () => {
    expect(parseSessionLog('avg 200W tss 50')).toBeNull();
    expect(parseSessionLog('')).toBeNull();
    expect(parseSessionLog(null)).toBeNull();
  });
  it('parses power, HR, TSS and RPE in the usual formats', () => {
    expect(parseSessionLog('SESSION LOG\nPower: avg 178W\nHR: avg 158 bpm\nTSS: 92\nRPE: 7/10')).toEqual({ power: 178, hr: 158, tss: 92, rpe: 7 });
    expect(parseSessionLog('session log · avg power 245 w · avg hr 160 · tss 78 · rpe 8')).toEqual({ power: 245, hr: 160, tss: 78, rpe: 8 });
  });
  it('drops implausible HR and returns null with no fields', () => {
    expect(parseSessionLog('SESSION LOG hr: 30')).toBeNull();
    expect(parseSessionLog('SESSION LOG nothing here')).toBeNull();
  });
});

describe('metrics', () => {
  it('estimateHRFromFTP is monotonic and capped', () => {
    let last = 0;
    for (const p of [20, 40, 60, 80, 90, 100, 110, 120, 200]) {
      const r = estimateHRFromFTP(p, 192);
      expect(r.pct).toBeGreaterThanOrEqual(last);
      expect(r.pct).toBeLessThanOrEqual(99);
      last = r.pct;
    }
    expect(estimateHRFromFTP(20, 192)).toEqual({ bpm: 0, pct: 0 });
    expect(estimateHRFromFTP(100, 192).bpm).toBe(Math.round(192 * 0.905));
  });
  it('computeTSS', () => {
    expect(computeTSS(60, 280, 280)).toBe(100);
    expect(computeTSS(0, 280, 280)).toBeNull();
  });
  it('creditedTSS applies the done/partial rules', () => {
    expect(creditedTSS(undefined, 80)).toBe(0);
    expect(creditedTSS({ status: 'done' }, 80)).toBe(80);
    expect(creditedTSS({ status: 'done', tss: '' }, 80)).toBe(80);
    expect(creditedTSS({ status: 'done', tss: '95' }, 80)).toBe(95);
    expect(creditedTSS({ status: 'partial' }, 80)).toBe(48);
    expect(creditedTSS({ status: 'skipped', tss: '95' }, 80)).toBe(0);
  });
});

describe('dates', () => {
  it('round-trips local ISO dates', () => {
    const d = parseLocalDate('2026-09-07');
    expect(d.getDay()).toBe(1);
    expect(toISODate(d)).toBe('2026-09-07');
    expect(toISODate(addDays(d, 30))).toBe('2026-10-07');
    expect(fmtDate(d)).toBe('Sep 7');
    expect(isToday(d, new Date(2026, 8, 7, 23, 59))).toBe(true);
    expect(() => parseLocalDate('7 Sep')).toThrow();
  });
});

describe('export / import', () => {
  it('round-trips and accepts a bare state object too', () => {
    const state = { version: 2, actuals: { '2026-09-07/0': { status: 'done' } } };
    expect(parseImport(exportJson(state))).toEqual(state);
    expect(parseImport(JSON.stringify(state))).toEqual(state);
    expect(() => parseImport('{"foo":1}')).toThrow(/Not a Glutes/);
  });
});
