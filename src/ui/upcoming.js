// Upcoming view: one row per week of the active plan.

import { app, daySessions } from '../app.js';
import { fmtDuration } from '../lib/format.js';
import { dateForDay } from '../lib/plan.js';
import { fmtDate, fmtDayName } from '../lib/dates.js';
import { isHardType } from '../lib/sessions.js';
import { weekTitle } from './week.js';

export function renderUpcoming() {
  const goalEl = document.getElementById('plan-goal');
  if (goalEl) {
    const later = app.plan.upcoming.map((u) => `${u.name} · ${u.focus} · ${u.when}`).join('  /  ');
    goalEl.textContent = [app.plan.goal, later ? `Later: ${later}` : ''].filter(Boolean).join('  ·  ');
  }
  const el = document.getElementById('upcoming-list');
  el.innerHTML = app.plan.weeks.map((w) => {
    const start = dateForDay(app.plan, w.week, 0);
    const end = dateForDay(app.plan, w.week, 6);
    let plannedTSS = 0, plannedMin = 0;
    const qualityDays = [];
    for (let di = 0; di < 7; di++) {
      daySessions(w.week, di).forEach((s) => {
        plannedTSS += s.tss || 0;
        plannedMin += s.dur || 0;
        if (isHardType(s.type)) qualityDays.push(`${fmtDayName(di)}: ${s.name}`);
      });
    }
    const isCur = w.week === app.currentWeek;
    return `
      <div class="day ${isCur ? 'today' : ''}" style="margin-bottom:8px;cursor:pointer" onclick="G.goToWeek(${w.week})">
        <div class="day-head">
          <div class="dleft">
            <div>
              <div class="dname">${weekTitle(w)}</div>
              <div class="session">${fmtDate(start)} – ${fmtDate(end)} · ${fmtDuration(plannedMin)} · ${plannedTSS} TSS · Block ${w.blockId}</div>
              ${qualityDays.length ? `<div class="session" style="margin-top:6px;color:var(--ink-3)">${qualityDays.join(' · ')}</div>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}
