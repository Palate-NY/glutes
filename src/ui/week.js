// "This Week" view: week nav, day cards, session forms, training block tiles.

import { app, save, keyFor, ensureActual, daySessions, swapDays, resetWeek, weekHasOverrides, dayIsOverridden, dayHasLog } from '../app.js';
import { fmtDuration, strengthChipLabel } from '../lib/format.js';
import { toast } from './data.js';
import { dateForDay, detectCurrentWeek } from '../lib/plan.js';
import { fmtDate, fmtDayName, isToday, toISODate } from '../lib/dates.js';
import { isHardType } from '../lib/sessions.js';
import { creditedTSS } from '../lib/metrics.js';
import { parseSessionLog } from '../lib/session-log.js';
import { buildZwoFile, zwoFilename } from '../lib/zwo.js';
import { renderWorkoutViz, renderMiniViz } from './viz.js';

// ---- Training blocks ----------------------------------------------------

export function renderBlocks() {
  const el = document.getElementById('blocks');
  const currentBlockId = app.plan.weeks[app.currentWeek - 1].blockId;
  el.innerHTML = app.plan.blocks.map((b) => `
    <div class="block ${b.id === currentBlockId ? 'current' : ''}" onclick="G.expandBlock(${b.id})">
      <div class="b-name">${b.name}</div>
      <div class="b-weeks">${b.focus}</div>
      <div class="b-focus">${b.weeks} · ${b.dateRange}</div>
    </div>`).join('');
  if (app.currentBlockExpanded != null && !app.plan.blocks.some((b) => b.id === app.currentBlockExpanded)) {
    app.currentBlockExpanded = null;
    document.getElementById('blockdetail').classList.remove('show');
  }
}

export function expandBlock(id) {
  const el = document.getElementById('blockdetail');
  if (app.currentBlockExpanded === id) {
    app.currentBlockExpanded = null;
    el.classList.remove('show');
    return;
  }
  app.currentBlockExpanded = id;
  const b = app.plan.blocks.find((x) => x.id === id);
  const weeksInBlock = app.plan.weeks.filter((w) => w.blockId === id);
  let plannedTSS = 0, actualTSS = 0;
  weeksInBlock.forEach((w) => {
    for (let di = 0; di < 7; di++) {
      daySessions(w.week, di).forEach((s, si) => {
        plannedTSS += s.tss || 0;
        actualTSS += creditedTSS(app.state.actuals[keyFor(w.week, di, si)], s.tss);
      });
    }
  });
  el.classList.add('show');
  el.innerHTML = `
    <h3>${b.name} — ${b.focus}</h3>
    <div class="b-purpose">${b.purpose}</div>
    <div class="b-stats">
      <div class="b-stat"><div class="lbl">Weeks</div><div class="vl">${b.weeks}</div></div>
      <div class="b-stat"><div class="lbl">Planned TSS</div><div class="vl">${plannedTSS}</div></div>
      <div class="b-stat"><div class="lbl">Logged TSS</div><div class="vl">${actualTSS}</div></div>
    </div>`;
}

// ---- Week --------------------------------------------------------------

export function weekTitle(w) {
  return `Week ${w.week} — ${w.label.split(' ').slice(1).join(' ')}`;
}

export function renderWeek() {
  const w = app.plan.weeks[app.currentWeek - 1];
  document.getElementById('wname').textContent = weekTitle(w);
  const start = dateForDay(app.plan, w.week, 0);
  const end = dateForDay(app.plan, w.week, 6);
  document.getElementById('wdates').textContent = `${fmtDate(start)} — ${fmtDate(end)}`;
  updateTodayButton();

  let plannedTSS = 0, actualTSS = 0, plannedMin = 0, rideMin = 0;
  const days = [];
  for (let di = 0; di < 7; di++) {
    const sessions = daySessions(w.week, di);
    days.push(sessions);
    sessions.forEach((s, si) => {
      plannedTSS += s.tss || 0;
      plannedMin += s.dur || 0;
      if (s.type !== 'strength' && s.type !== 'rest') rideMin += s.dur || 0;
      actualTSS += creditedTSS(app.state.actuals[keyFor(w.week, di, si)], s.tss);
    });
  }
  document.getElementById('planned-tss').textContent = plannedTSS;
  document.getElementById('actual-tss').textContent = actualTSS;
  document.getElementById('planned-time').textContent = fmtDuration(plannedMin);
  document.getElementById('ride-time').textContent = fmtDuration(rideMin);
  const pct = plannedTSS > 0 ? Math.min(150, (actualTSS / plannedTSS) * 100) : 0;
  document.getElementById('strain-bar').style.width = pct + '%';

  const daysEl = document.getElementById('days');
  daysEl.innerHTML = days.map((sessions, di) => {
    const d = dateForDay(app.plan, w.week, di);
    const todayCls = isToday(d) ? 'today' : '';
    const primarySess = sessions[0];
    const isRestDay = sessions.every((s) => s.type === 'rest');
    const isHardDay = sessions.some((s) => isHardType(s.type));
    const isZ2Day = !isRestDay && !isHardDay && sessions.some((s) => s.type === 'z2');
    const statuses = sessions.map((s, si) => (app.state.actuals[keyFor(w.week, di, si)] || {}).status || 'planned');
    let badge = 'planned';
    if (statuses.every((x) => x === 'done')) badge = 'done';
    else if (statuses.includes('partial') || (statuses.includes('done') && statuses.length > 1)) badge = 'partial';
    else if (statuses.every((x) => x === 'skipped')) badge = 'skipped';
    else if (statuses.includes('skipped')) badge = 'partial';
    const badgeLabel = { planned: 'Planned', done: isRestDay ? 'Rested' : 'Done', partial: 'Partial', skipped: 'Skipped' }[badge];
    let badgeClass = badge;
    if (badge === 'done' && isRestDay) badgeClass = 'done rest-done';
    else if (badge === 'done' && isHardDay) badgeClass = 'done hard-done';
    const dayClasses = [todayCls, isRestDay ? 'is-rest' : '', isHardDay ? 'is-hard' : '', isZ2Day ? 'is-z2' : ''].filter(Boolean).join(' ');
    const dayTSS = sessions.reduce((sum, s) => sum + (s.tss || 0), 0);
    const dayMin = sessions.reduce((sum, s) => sum + (s.dur || 0), 0);
    const strength = sessions.filter((s) => s.type === 'strength');
    const moved = dayIsOverridden(w.week, di);

    // Compact one-line title. Strength shows as a chip, parens like "(heavy)" stripped.
    const bikeSessions = sessions.filter((s) => s.type !== 'strength');
    const titleSessions = bikeSessions.length > 0 ? bikeSessions : sessions;
    const sessionLineCompact = titleSessions.map((s) => s.name.replace(/\s*\([^)]*\)\s*/g, '').trim()).join(' + ');
    return `
      <div class="day ${dayClasses} ${moved ? 'moved' : ''}" id="day-${di}" data-day="${di}">
        <div class="day-head" onclick="G.toggleDay(${di})">
          <div class="dleft">
            <div class="cal-tile" title="Drag to swap with another day">
              <div class="ct-dow">${fmtDayName(di)}</div>
              <div class="ct-day">${d.getDate()}</div>
            </div>
            <div class="dmeta">
              <div class="session">${sessionLineCompact}</div>
              <div>
                ${dayMin > 0 ? `<span class="tss-chip dur-chip">${fmtDuration(dayMin)}</span>` : ''}
                ${dayTSS > 0 ? `<span class="tss-chip">${dayTSS} TSS</span>` : ''}
                ${strength.map((s) => `<span class="tss-chip wrk-chip">+ ${strengthChipLabel(s.name)}</span>`).join('')}
                ${moved ? '<span class="tss-chip moved-chip">moved</span>' : ''}
              </div>
            </div>
          </div>
          <div class="dright">
            ${primarySess.blocks && primarySess.blocks.length > 0 ? renderMiniViz(primarySess) : ''}
            ${badge !== 'planned' ? `<span class="badge ${badgeClass}">${badgeLabel}</span>` : ''}
          </div>
        </div>
        <div class="day-body">
          ${sessions.map((s, si) => renderSessionForm(w.week, di, si, s)).join('<hr style="border:0;border-top:1px solid var(--line);margin:14px 0">')}
        </div>
      </div>`;
  }).join('');

  const note = document.getElementById('week-note');
  if (note) {
    note.hidden = !weekHasOverrides(w.week);
    note.innerHTML = weekHasOverrides(w.week)
      ? 'Week rearranged in this browser. The plan file is unchanged. <button class="link-btn" onclick="G.resetWeek()">Reset to plan</button>'
      : '';
  }
}

export function renderSessionForm(weekN, dayIdx, sessIdx, sess) {
  const key = keyFor(weekN, dayIdx, sessIdx);
  const a = app.state.actuals[key] || {};
  const status = a.status || 'planned';

  if (sess.type === 'rest') {
    return `
      <div class="prescribed">
        <div class="ptitle">${sess.name}</div>
        <div>${sess.prescribed}</div>
      </div>
      <div class="status-row">
        <button class="status-btn rest-done ${status === 'done' ? 'active' : ''}" onclick="G.setStatus('${key}','done',${dayIdx})">Rested</button>
        <button class="status-btn ${status === 'skipped' ? 'active skipped' : ''}" onclick="G.setStatus('${key}','skipped',${dayIdx})">Trained instead</button>
      </div>`;
  }

  const sessIsHard = isHardType(sess.type);
  return `
    <div class="prescribed">
      <div class="ptitle">${sess.name}<span class="dur">${sess.dur}min</span></div>
      <div>${sess.prescribed}</div>
    </div>
    ${sess.blocks && sess.blocks.length > 0 ? renderWorkoutViz(sess) : ''}
    ${sess.blocks && sess.blocks.length > 0 ? `
      <button class="zwo-btn" onclick="G.downloadZwo(${weekN}, ${dayIdx}, ${sessIdx})">
        <span class="zwo-icon">⬇</span> Export .zwo for TrainingPeaks
      </button>` : ''}
    <div class="status-row" style="margin-top:14px">
      <button class="status-btn ${sessIsHard ? 'hard-done' : ''} ${status === 'done' ? 'active done' : ''}" onclick="G.setStatus('${key}','done',${dayIdx})">Done</button>
      <button class="status-btn ${status === 'partial' ? 'active partial' : ''}" onclick="G.setStatus('${key}','partial',${dayIdx})">Partial</button>
      <button class="status-btn ${status === 'skipped' ? 'active skipped' : ''}" onclick="G.setStatus('${key}','skipped',${dayIdx})">Skipped</button>
    </div>
    ${sess.type !== 'strength' ? `
    <div class="form-row">
      <div class="form-field">
        <label>Avg Power (W)</label>
        <input type="number" value="${a.power || ''}" onchange="G.setField('${key}','power',this.value,${dayIdx})" placeholder="—"/>
      </div>
      <div class="form-field">
        <label>Avg HR (bpm)</label>
        <input type="number" value="${a.hr || ''}" onchange="G.setField('${key}','hr',this.value,${dayIdx})" placeholder="—"/>
      </div>
      <div class="form-field">
        <label>RPE 1-10</label>
        <input type="number" min="1" max="10" value="${a.rpe || ''}" onchange="G.setField('${key}','rpe',this.value,${dayIdx})" placeholder="—"/>
      </div>
      <div class="form-field">
        <label>TSS</label>
        <input type="number" value="${a.tss || ''}" onchange="G.setField('${key}','tss',this.value,${dayIdx})" placeholder="${sess.tss}"/>
      </div>
    </div>` : ''}
    <div class="form-field">
      <label>Notes</label>
      <textarea id="notes-${key}" onchange="G.setField('${key}','notes',this.value,${dayIdx});G.refreshParseButton('${key}',${dayIdx})" oninput="G.refreshParseButton('${key}',${dayIdx})" placeholder="Paste session log from chat, or note how it felt, conditions, adjustments...">${a.notes || ''}</textarea>
      ${parseSessionLog(a.notes) ? `
        <button class="parse-btn" onclick="G.parseAndFill('${key}',${dayIdx})">
          <span class="parse-icon">↓</span> Parse log to fields
        </button>` : ''}
    </div>`;
}

// ---- Handlers -----------------------------------------------------------

function reopenDay(dayIdx) {
  const el = document.getElementById(`day-${dayIdx}`);
  if (el) el.classList.add('open');
}

export function toggleDay(idx) {
  document.getElementById(`day-${idx}`).classList.toggle('open');
}

export function setStatus(key, status, dayIdx) {
  const a = ensureActual(key);
  a.status = a.status === status ? null : status;
  save();
  renderWeek();
  reopenDay(dayIdx);
}

export function setField(key, field, value, dayIdx) {
  ensureActual(key)[field] = value;
  save();
  renderWeek();
  reopenDay(dayIdx);
}

// Live-update the Parse button as the user types, without a full re-render
// (which would steal focus from the textarea).
export function refreshParseButton(key, dayIdx) {
  const textarea = document.getElementById(`notes-${key}`);
  if (!textarea) return;
  const hasLog = !!parseSessionLog(textarea.value);
  const existingBtn = textarea.parentElement.querySelector('.parse-btn');
  if (hasLog && !existingBtn) {
    const btn = document.createElement('button');
    btn.className = 'parse-btn';
    btn.innerHTML = '<span class="parse-icon">↓</span> Parse log to fields';
    btn.onclick = () => parseAndFill(key, dayIdx);
    textarea.parentElement.appendChild(btn);
  } else if (!hasLog && existingBtn) {
    existingBtn.remove();
  }
}

export function parseAndFill(key, dayIdx) {
  const a = app.state.actuals[key] || {};
  const parsed = parseSessionLog(a.notes);
  if (!parsed) return;
  const target = ensureActual(key);
  // Parse always overwrites: the user explicitly tapped Parse.
  if (parsed.power != null) target.power = parsed.power;
  if (parsed.hr != null) target.hr = parsed.hr;
  if (parsed.tss != null) target.tss = parsed.tss;
  if (parsed.rpe != null) target.rpe = parsed.rpe;
  if (!target.status) target.status = 'done';
  save();
  renderWeek();
  reopenDay(dayIdx);
}

export function downloadZwo(weekN, dayIdx, sessIdx) {
  const sess = daySessions(weekN, dayIdx)[sessIdx];
  if (!sess) return;
  const xml = buildZwoFile(sess, app.ftp);
  if (!xml) return;
  const filename = zwoFilename(sess, toISODate(dateForDay(app.plan, weekN, dayIdx)));
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function goToWeek(w) {
  app.currentWeek = w;
  document.getElementById('tab-week').click();
  renderBlocks();
  renderWeek();
}

export function jumpToToday() {
  const todayWeek = detectCurrentWeek(app.plan);
  app.currentWeek = todayWeek;
  document.getElementById('tab-week').click();
  renderBlocks();
  renderWeek();
  // Auto-expand today's card and scroll to it
  setTimeout(() => {
    const now = new Date();
    const start = dateForDay(app.plan, todayWeek, 0);
    const dayIdx = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    if (dayIdx >= 0 && dayIdx < 7) {
      const dayEl = document.getElementById(`day-${dayIdx}`);
      if (dayEl) {
        dayEl.classList.add('open');
        dayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, 50);
}

export function updateTodayButton() {
  const btn = document.getElementById('today-btn');
  if (!btn) return;
  btn.classList.toggle('show', app.currentWeek !== detectCurrentWeek(app.plan));
}

function stepWeek(delta) {
  const next = app.currentWeek + delta;
  if (next < 1 || next > app.plan.weeks.length) return;
  app.currentWeek = next;
  renderBlocks();
  renderWeek();
}

export function resetCurrentWeek() {
  resetWeek(app.currentWeek);
  renderWeek();
  toast('Week reset to plan');
}

/** Swap two days of the current week (also used by the drag handler). */
export function swapCurrentWeekDays(a, b) {
  if (a === b) return;
  if (dayHasLog(app.currentWeek, a) || dayHasLog(app.currentWeek, b)) {
    toast('Logged days stay put');
    return;
  }
  swapDays(app.currentWeek, a, b);
  renderWeek();
}

// Drag a day's calendar tile onto another day to swap the two workouts.
// Pointer events so it works with mouse and touch; the tile has
// touch-action:none so a drag does not scroll the page.
export function initDayDrag() {
  const daysEl = document.getElementById('days');
  if (!daysEl) return;
  const THRESHOLD = 8;
  let drag = null; // { from, x, y, active, ghost, over }

  const dayAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const day = el && el.closest('#days .day');
    return day ? Number(day.dataset.day) : null;
  };
  const clearOver = () => {
    daysEl.querySelectorAll('.day.drag-over').forEach((d) => d.classList.remove('drag-over'));
  };
  const endDrag = () => {
    if (!drag) return;
    const { from, active, ghost, over } = drag;
    drag = null;
    clearOver();
    daysEl.querySelectorAll('.day.dragging').forEach((d) => d.classList.remove('dragging'));
    document.body.classList.remove('is-dragging');
    if (ghost) ghost.remove();
    if (active) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (over != null && over !== from) swapCurrentWeekDays(from, over);
    }
  };

  let suppressClick = false;
  daysEl.addEventListener('click', (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  daysEl.addEventListener('pointerdown', (e) => {
    const tile = e.target.closest('.cal-tile');
    if (!tile || e.button !== 0) return;
    const day = tile.closest('.day');
    drag = { from: Number(day.dataset.day), x: e.clientX, y: e.clientY, active: false, ghost: null, over: null, pointerId: e.pointerId };
    tile.setPointerCapture(e.pointerId);
  });

  daysEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < THRESHOLD) return;
      drag.active = true;
      const src = daysEl.querySelector(`.day[data-day="${drag.from}"]`);
      src.classList.add('dragging');
      document.body.classList.add('is-dragging');
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = src.querySelector('.dmeta .session').textContent;
      document.body.appendChild(ghost);
      drag.ghost = ghost;
    }
    drag.ghost.style.transform = `translate(${e.clientX + 14}px, ${e.clientY - 18}px)`;
    const over = dayAt(e.clientX, e.clientY);
    if (over !== drag.over) {
      clearOver();
      drag.over = over;
      if (over != null && over !== drag.from) {
        daysEl.querySelector(`.day[data-day="${over}"]`).classList.add('drag-over');
      }
    }
    e.preventDefault();
  });

  daysEl.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.pointerId) endDrag(); });
  daysEl.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.pointerId) { drag.over = null; endDrag(); } });
}

export function initWeekNav() {
  document.getElementById('prevwk').onclick = () => stepWeek(-1);
  document.getElementById('nextwk').onclick = () => stepWeek(1);

  // Swipe on the week nav strip
  const weeknav = document.querySelector('.weeknav');
  if (!weeknav) return;
  let startX = 0, startY = 0, startTime = 0, tracking = false;
  const MIN_DISTANCE = 50;   // min horizontal travel (px) to count as a swipe
  const MAX_OFF_AXIS = 40;   // max vertical drift before we treat it as a scroll
  const MAX_DURATION = 600;  // ms; slower is a hold, not a swipe

  weeknav.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    tracking = true;
  }, { passive: true });

  weeknav.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const dt = Date.now() - startTime;
    if (dt > MAX_DURATION) return;
    if (Math.abs(dy) > MAX_OFF_AXIS) return;
    if (Math.abs(dx) < MIN_DISTANCE) return;
    if (e.target && e.target.closest('button')) return;
    if (dx < 0) stepWeek(1);
    else stepWeek(-1);
  }, { passive: true });

  weeknav.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });
}
