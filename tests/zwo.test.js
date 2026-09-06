import { describe, it, expect } from 'vitest';
import golden from './fixtures/golden-v47.json';
import { SESSIONS } from '../src/lib/sessions.js';
import { buildZwoFile, escapeXml, zwoFilename } from '../src/lib/zwo.js';

describe('ZWO export', () => {
  it('produces byte-identical files to the single-file app for every session (FTP 280)', () => {
    for (const [id, expected] of Object.entries(golden.zwo)) {
      expect(buildZwoFile(SESSIONS[id], golden.FTP), id).toBe(expected);
    }
  });

  it('returns null for sessions without blocks', () => {
    expect(buildZwoFile(SESSIONS.REST, 280)).toBeNull();
    expect(buildZwoFile(SESSIONS.STR_GYM, 280)).toBeNull();
  });

  it('requires an FTP', () => {
    expect(() => buildZwoFile(SESSIONS.Z2_60)).toThrow(/ftp/);
  });

  it('expresses power as FTP fractions with 3 decimals and per-kind cadence', () => {
    const xml = buildZwoFile(SESSIONS.SS_2x15, 280);
    expect(xml).toContain('<SteadyState Duration="900" Power="0.886" Cadence="90" pace="0">');
    expect(xml).toContain('<SteadyState Duration="300" Power="0.518" Cadence="85" pace="0">');
    expect(xml).toContain('calibrated to FTP 280W');
  });

  it('escapes XML in names and labels', () => {
    expect(escapeXml(`a<b>&"c'`)).toBe('a&lt;b&gt;&amp;&quot;c&apos;');
    const xml = buildZwoFile({ name: 'Ride & <Test>', prescribed: '', blocks: [{ dur: 60, power: 100, label: 'A & B', kind: 'work' }] }, 200);
    expect(xml).toContain('<name>Ride &amp; &lt;Test&gt;</name>');
    expect(xml).toContain('message="A &amp; B"');
  });

  it('builds the same filename pattern as before', () => {
    expect(zwoFilename(SESSIONS.SS_2x15, '2026-09-10')).toBe('2026-09-10_Sweet_Spot_2_15.zwo');
    expect(zwoFilename(SESSIONS.VO2_30_15, '2026-09-10')).toBe('2026-09-10_VO2_30_15_13.zwo');
  });
});
