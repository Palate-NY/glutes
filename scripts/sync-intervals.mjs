#!/usr/bin/env node
// Push the coming days of the active plan to intervals.icu as planned
// workouts. intervals.icu forwards the next 7 days to Wahoo (tick "upload
// workouts" in its Wahoo settings) so they appear on the Bolt.
//
//   INTERVALS_API_KEY=... node scripts/sync-intervals.mjs [--days 14] [--plan id] [--from YYYY-MM-DD] [--dry-run]
//
// Idempotent: events carry external_id "glutes:<plan>:<date>:<idx>"; existing
// ones are updated in place, stale ones in the window are deleted, others on
// the calendar are never touched.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSessionMap, validateSessionLibrary } from '../src/lib/sessions-core.js';
import { loadPlan, planForDateIn } from '../src/lib/plan-core.js';
import { plannedEvents, diffEvents } from '../src/lib/intervals.js';
import { toISODate, addDays } from '../src/lib/dates.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const DRY = args.includes('--dry-run');
const DAYS = Number(opt('--days', 14));
const FROM = opt('--from', toISODate(new Date()));
const PLAN_ID = opt('--plan', null);
const API = process.env.INTERVALS_API_URL || 'https://intervals.icu/api/v1';
const ATHLETE = process.env.INTERVALS_ATHLETE_ID || '0';
const KEY = process.env.INTERVALS_API_KEY;

const readJsonDir = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const rawSessions = readJsonDir(path.join(root, 'src/data/sessions')).flat();
const errors = validateSessionLibrary(rawSessions);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const sessions = buildSessionMap(rawSessions);
const rawById = Object.fromEntries(rawSessions.map((r) => [r.id, r]));
const plans = readJsonDir(path.join(root, 'src/data/plans')).map((raw) => loadPlan(raw, sessions));
const from = new Date(`${FROM}T00:00:00`);
const plan = PLAN_ID ? plans.find((p) => p.id === PLAN_ID) : planForDateIn(plans, from);
if (!plan) { console.error(`No plan ${PLAN_ID ? `"${PLAN_ID}"` : `for ${FROM}`}`); process.exit(1); }
const toISO = toISODate(addDays(from, DAYS - 1));
const wanted = plannedEvents(plan, rawById, FROM, toISO);
console.log(`Plan ${plan.id}: ${wanted.length} planned workouts from ${FROM} to ${toISO}`);

if (!KEY && !DRY) {
  console.log('INTERVALS_API_KEY is not set; nothing pushed. Add it as a repository secret to enable the sync.');
  process.exit(0);
}

const headers = { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`API_KEY:${KEY || 'dry'}`).toString('base64')}` };
async function call(method, url, body) {
  if (DRY) { console.log(`  ${method} ${url}${body ? ` ${JSON.stringify(body).slice(0, 160)}...` : ''}`); return []; }
  const res = await fetch(`${API}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const existing = DRY ? [] : await call('GET', `/athlete/${ATHLETE}/events?oldest=${FROM}&newest=${toISO}&category=WORKOUT`);
const diff = diffEvents(existing, wanted);
console.log(`  create ${diff.create.length}, update ${diff.update.length}, unchanged ${diff.keep.length}, delete ${diff.delete.length}`);
if (DRY) {
  for (const e of wanted) console.log(`\n${e.start_date_local.slice(0, 10)}  ${e.name}  [${e.type}, ${Math.round(e.moving_time / 60)} min, ${e.icu_training_load} TSS]\n${e.description.split('\n').map((l) => '    ' + l).join('\n')}`);
  process.exit(0);
}
if (diff.create.length) await call('POST', `/athlete/${ATHLETE}/events/bulk`, diff.create);
for (const e of diff.update) {
  const { _changed, ...body } = e;
  console.log(`  update ${body.external_id}: ${_changed.map((c) => c.slice(0, 120)).join(' | ')}`);
  await call('PUT', `/athlete/${ATHLETE}/events/${e.id}`, body);
}
if (diff.delete.length) await call('PUT', `/athlete/${ATHLETE}/events/bulk-delete`, diff.delete.map((e) => ({ id: e.id })));
console.log('Done.');
