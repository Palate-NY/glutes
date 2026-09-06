// @vitest-environment jsdom
// Smoke test: boot the real app against index.html with a v1 (single-file app)
// localStorage blob and check it renders and migrates.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));

const v1 = {
  actuals: {
    W1D3S0: { status: 'done', power: '245', hr: '160', tss: '78' }, // 2026-05-07 (old plan: SS 2x15)
    W2D1S0: { status: 'done', power: '250', hr: '162' },            // 2026-05-12
    W14D5S0: { status: 'done', notes: 'PR day' },                    // 2026-08-08
  },
  statHistory: {
    ftp: [{ date: '2026-05-04', value: 260, note: '' }, { date: '2026-07-10', value: 280, note: 'test' }],
    hrmax: [{ date: '2026-09-01', value: 192, note: '' }],
    lthr: [{ date: '2026-09-01', value: 174, note: '' }],
  },
};

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 9, 10, 0)); // Wed Sep 9 2026: week 1 of the 2027 season
  document.body.innerHTML = body;
  localStorage.clear();
  localStorage.setItem('climb-tracker-state', JSON.stringify(v1));
  await import('../src/main.js');
});

describe('app boot', () => {
  it('migrates the v1 log, keeps a backup, and renders the current week of the 2027 plan', () => {
    const saved = JSON.parse(localStorage.getItem('climb-tracker-state'));
    expect(saved.version).toBe(2);
    expect(Object.keys(saved.actuals).sort()).toEqual(['2026-05-07/0', '2026-05-12/0', '2026-08-08/0']);
    expect(saved.actuals['2026-05-07/0']).toEqual(v1.actuals.W1D3S0);
    expect(JSON.parse(localStorage.getItem('climb-tracker-state.v1-backup'))).toEqual(v1);

    expect(document.getElementById('plan-select').value).toBe('2027-season');
    expect(document.getElementById('wname').textContent).toBe('Week 1 — W1 Prep');
    expect(document.getElementById('wdates').textContent).toBe('Sep 7 — Sep 13');
    expect(document.querySelectorAll('#days .day')).toHaveLength(7);
    expect(document.querySelector('#day-2').classList.contains('today')).toBe(true);
    expect(document.querySelectorAll('#blocks .block')).toHaveLength(2);
    expect(document.getElementById('stat-ftp').textContent).toBe('280W');
    expect(document.getElementById('stat-hrmax').textContent).toBe('192bpm');
    expect(document.getElementById('stat-lthr').textContent).toBe('174bpm');
    expect(document.querySelector('.workout-viz svg text[fill="#c6ff3d"]').textContent).toBe('FTP 280W');
  });

  it('switching to the 2026 plan shows the migrated logs on the right days', () => {
    const sel = document.getElementById('plan-select');
    sel.value = '2026-climb-pr';
    sel.dispatchEvent(new Event('change'));
    // Today (Sep 9) is past the plan, so it clamps to week 14; go to week 1.
    expect(document.getElementById('wname').textContent).toBe('Week 14 — PR Week');
    window.G.goToWeek(1);
    expect(document.getElementById('wdates').textContent).toBe('May 4 — May 10');
    const thu = document.getElementById('day-3');
    expect(thu.querySelector('.dmeta .session').textContent).toBe('Sweet Spot 2×15');
    expect(thu.querySelector('.badge').textContent).toBe('Done');
    expect(thu.querySelector('input[placeholder="—"]').value).toBe('245');
    expect(document.getElementById('actual-tss').textContent).toBe('78');
    expect(JSON.parse(localStorage.getItem('climb-tracker-state')).activePlan).toBe('2026-climb-pr');
  });

  it('logging a session writes a date-keyed entry', () => {
    window.G.goToWeek(2);
    const key = '2026-05-13/0'; // Wed W2 = Z2_60
    window.G.setStatus(key, 'done', 2);
    const saved = JSON.parse(localStorage.getItem('climb-tracker-state'));
    expect(saved.actuals[key]).toEqual({ status: 'done' });
    expect(document.getElementById('day-2').classList.contains('open')).toBe(true);
    window.G.setStatus(key, 'done', 2); // toggle off
    expect(JSON.parse(localStorage.getItem('climb-tracker-state')).actuals[key].status).toBeNull();
  });

  it('next/prev week is bounded by the plan length', () => {
    window.G.goToWeek(14);
    document.getElementById('nextwk').click();
    expect(document.getElementById('wname').textContent).toBe('Week 14 — PR Week');
    document.getElementById('prevwk').click();
    expect(document.getElementById('wname').textContent).toBe('Week 13 — Sharpen');
  });

  it('trends and upcoming render for the active plan', () => {
    document.getElementById('tab-trends').click();
    expect(document.querySelectorAll('#trendsview .chart')).toHaveLength(5);
    document.getElementById('tab-upcoming').click();
    expect(document.querySelectorAll('#upcoming-list .day')).toHaveLength(14);
  });
});
