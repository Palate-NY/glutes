// The JSON Schemas in schema/ are what a chat session validates against before
// committing. This test keeps them in agreement with the data and with the
// runtime validators in src/lib.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import sessionSchema from '../schema/session.schema.json';
import planSchema from '../schema/plan.schema.json';
import { validateSession } from '../src/lib/sessions.js';
import { validatePlan } from '../src/lib/plan.js';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validSessionFile = ajv.compile(sessionSchema);
const validPlan = ajv.compile(planSchema);
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), p), 'utf8'));
const list = (dir) => fs.readdirSync(path.resolve(process.cwd(), dir)).filter((f) => f.endsWith('.json')).map((f) => `${dir}/${f}`);

describe('JSON Schemas', () => {
  it('every session file validates', () => {
    for (const f of list('src/data/sessions')) {
      expect(validSessionFile(read(f)), `${f}: ${ajv.errorsText(validSessionFile.errors)}`).toBe(true);
    }
  });
  it('every plan file validates', () => {
    for (const f of list('src/data/plans')) {
      expect(validPlan(read(f)), `${f}: ${ajv.errorsText(validPlan.errors)}`).toBe(true);
    }
  });
  it('schema and runtime validator reject the same broken session', () => {
    const bad = [{ id: 'X', name: 'x', type: 'tempo', duration_min: 10, description: '', tss: 5, avg_power: null, blocks: [{ dur: 0, power: 1, label: 'a', kind: 'work' }] }];
    expect(validSessionFile(bad)).toBe(false);
    expect(validateSession(bad[0]).length).toBeGreaterThan(0);
  });
  it('schema rejects unknown keys and a runtime-only rule still catches non-Monday starts', () => {
    const plan = read('src/data/plans/2027-season.json');
    expect(validPlan({ ...plan, extra: 1 })).toBe(false);
    expect(validPlan({ ...plan, start: '2026-09-08' })).toBe(true); // schema cannot know weekdays
    expect(validatePlan({ ...plan, start: '2026-09-08' })).toHaveLength(1);
  });
});
