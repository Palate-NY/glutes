// App entry: load state (migrating if needed), pick the plan, render, wire events.

import './styles.css';
import { app, save } from './app.js';
import { PLANS, planById, planForDate, detectCurrentWeek } from './lib/plan.js';
import { loadRaw, backupLegacy, STORAGE_KEY } from './lib/storage.js';
import { migrateState } from './lib/migrate.js';
import * as week from './ui/week.js';
import * as viz from './ui/viz.js';
import * as stats from './ui/stats.js';
import * as data from './ui/data.js';
import { renderTrends } from './ui/trends.js';
import { renderUpcoming } from './ui/upcoming.js';

// Inline handlers in templates call G.<fn>(...)
window.G = {
  toggleDay: week.toggleDay,
  setStatus: week.setStatus,
  setField: week.setField,
  refreshParseButton: week.refreshParseButton,
  parseAndFill: week.parseAndFill,
  downloadZwo: week.downloadZwo,
  expandBlock: week.expandBlock,
  goToWeek: week.goToWeek,
  jumpToToday: week.jumpToToday,
  handleVizHover: viz.handleVizHover,
  handleVizTap: viz.handleVizTap,
  hideVizTooltip: viz.hideVizTooltip,
  showStatTrend: stats.showStatTrend,
  saveNewStat: stats.saveNewStat,
  deleteStatEntry: stats.deleteStatEntry,
  closeStatModal: stats.closeStatModal,
  exportData: data.exportData,
  importData: () => data.importData(() => { stats.applyStatsToApp(); renderAll(); }),
};

function activeView() {
  const t = document.querySelector('.tab.active');
  return t ? t.dataset.tab : 'week';
}

function renderAll() {
  stats.renderStatTiles();
  week.renderBlocks();
  week.renderWeek();
  const view = activeView();
  if (view === 'trends') renderTrends();
  if (view === 'upcoming') renderUpcoming();
  data.renderDataNote();
}

function setPlan(plan, { persist = true } = {}) {
  app.plan = plan;
  app.currentWeek = detectCurrentWeek(plan);
  app.currentBlockExpanded = null;
  document.getElementById('blockdetail').classList.remove('show');
  const sel = document.getElementById('plan-select');
  if (sel) sel.value = plan.id;
  if (persist) {
    app.state.activePlan = plan.id;
    save();
  }
}

function initPlanSelect() {
  const sel = document.getElementById('plan-select');
  if (!sel) return;
  sel.innerHTML = PLANS.map((p) => `<option value="${p.id}">${p.name}${p.status === 'completed' ? ' ✓' : ''}</option>`).join('');
  sel.onchange = () => {
    const plan = planById(sel.value);
    if (!plan) return;
    setPlan(plan);
    renderAll();
  };
}

function initTabs() {
  document.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const view = t.dataset.tab;
      document.getElementById('weekview').style.display = view === 'week' ? 'block' : 'none';
      document.getElementById('trendsview').style.display = view === 'trends' ? 'block' : 'none';
      document.getElementById('upcomingview').style.display = view === 'upcoming' ? 'block' : 'none';
      if (view === 'upcoming') renderUpcoming();
      if (view === 'trends') renderTrends();
    };
  });
}

function checkDateChanged() {
  const today = new Date().toDateString();
  if (app.lastSeenDate && app.lastSeenDate !== today) {
    // Date rolled over while backgrounded: jump to today's week, re-render.
    app.lastSeenDate = today;
    const todayWeek = detectCurrentWeek(app.plan);
    if (app.currentWeek !== todayWeek) {
      app.currentWeek = todayWeek;
      week.renderBlocks();
    }
    week.renderWeek();
  }
  app.lastSeenDate = today;
}

function loadState() {
  const raw = loadRaw();
  const { state, report } = migrateState(raw);
  app.state = state;
  if (report.migrated > 0) {
    // Keep the untouched v1 blob for safety, then persist the migrated state.
    backupLegacy(localStorage.getItem(STORAGE_KEY));
    save();
    console.info(`Glutes: migrated ${report.migrated} logged sessions to date-keyed storage`, report);
    return `${report.migrated} logged sessions re-keyed by date`;
  }
  if (report.collisions.length) console.warn('Glutes: migration collisions', report.collisions);
  return '';
}

export function init() {
  const migrationMsg = loadState();
  stats.applyStatsToApp();
  initPlanSelect();
  initTabs();
  week.initWeekNav();
  setPlan(planById(app.state.activePlan) || planForDate(new Date()), { persist: false });
  app.lastSeenDate = new Date().toDateString();
  renderAll();
  if (migrationMsg) data.toast(migrationMsg, 6000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkDateChanged();
  });
  window.addEventListener('focus', checkDateChanged);
  window.addEventListener('pageshow', checkDateChanged);
}

init();
