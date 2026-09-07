import { describe, it, expect } from 'vitest';
import golden from './fixtures/golden-v47.json';
import { RAW_SESSIONS, SESSIONS, validateSession, validateSessionLibrary, expandBlocks, normalizeSession, getSession } from '../src/lib/sessions.js';

describe('session library', () => {
  it('every JSON session is valid', () => {
    expect(validateSessionLibrary()).toEqual([]);
  });

  it('still contains every session from the single-file app (v47); new sessions may be added', () => {
    for (const id of Object.keys(golden.sessions)) expect(SESSIONS[id], id).toBeDefined();
  });

  it('matches the original definitions field by field, blocks fully expanded', () => {
    for (const [id, g] of Object.entries(golden.sessions)) {
      const s = SESSIONS[id];
      expect(s, id).toBeDefined();
      expect({ name: s.name, type: s.type, dur: s.dur, prescribed: s.prescribed, tss: s.tss, targetPower: s.targetPower }, id)
        .toEqual({ name: g.name, type: g.type, dur: g.dur, prescribed: g.prescribed, tss: g.tss, targetPower: g.targetPower });
      expect(s.blocks, id).toEqual(g.blocks);
    }
  });

  it('getSession throws on unknown ids', () => {
    expect(() => getSession('NOPE')).toThrow(/Unknown session/);
  });

  it('block total is in the same ballpark as duration_min', () => {
    for (const raw of RAW_SESSIONS) {
      const total = expandBlocks(raw.blocks).reduce((s, b) => s + b.dur, 0);
      if (raw.duration_min === 0 || raw.blocks.length === 0) continue;
      const ratio = total / (raw.duration_min * 60);
      expect(ratio, `${raw.id}: blocks total ${Math.round(total / 60)}min vs duration_min ${raw.duration_min}`).toBeGreaterThan(0.5);
      expect(ratio, `${raw.id}: blocks total ${Math.round(total / 60)}min vs duration_min ${raw.duration_min}`).toBeLessThan(1.6);
    }
  });
});

describe('expandBlocks', () => {
  it('expands nested repeat groups into fresh block objects', () => {
    const out = expandBlocks([
      { dur: 60, power: 100, label: 'a', kind: 'warm' },
      { repeat: 2, blocks: [{ repeat: 2, blocks: [{ dur: 1, power: 1, label: 'x', kind: 'work' }] }, { dur: 5, power: 5, label: 'r', kind: 'rec' }] },
    ]);
    expect(out.map((b) => b.label).join('')).toBe('axxrxxr');
    expect(out[1]).not.toBe(out[2]);
  });
});

describe('validateSession', () => {
  const ok = { id: 'X', name: 'x', type: 'z2', duration_min: 10, description: '', tss: 5, avg_power: null, blocks: [{ dur: 600, power: 150, label: 'Z2', kind: 'easy' }] };
  it('accepts a valid session', () => expect(validateSession(ok)).toEqual([]));
  it('rejects bad type, bad kind, zero duration, missing repeat blocks', () => {
    expect(validateSession({ ...ok, type: 'tempo' })).toHaveLength(1);
    expect(validateSession({ ...ok, blocks: [{ dur: 600, power: 150, label: 'Z2', kind: 'hard' }] })).toHaveLength(1);
    expect(validateSession({ ...ok, blocks: [{ dur: 0, power: 150, label: 'Z2', kind: 'easy' }] })).toHaveLength(1);
    expect(validateSession({ ...ok, blocks: [{ repeat: 3, blocks: [] }] })).toHaveLength(1);
    expect(validateSession({ ...ok, id: 'bad id' })).toHaveLength(1);
  });
  it('normalizeSession maps JSON names to runtime names', () => {
    const s = normalizeSession(ok);
    expect(s).toMatchObject({ id: 'X', dur: 10, prescribed: '', targetPower: null });
    expect(s.blocks).toHaveLength(1);
  });
});
