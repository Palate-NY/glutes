// Performance stat tiles (FTP / HRmax / LTHR) with history modal.

import { app, save } from '../app.js';

export const STAT_DEFINITIONS = {
  ftp: {
    label: 'FTP',
    unit: 'W',
    full: 'Functional Threshold Power',
    description: 'The highest average power you can sustain for ~1 hour. Drives all training zones.',
    method: 'Half Monty test (75% of MAP), or 95% of 20-min all-out effort.',
  },
  hrmax: {
    label: 'HR Max',
    unit: 'bpm',
    full: 'Maximum Heart Rate',
    description: 'The highest HR you can reach in an all-out effort.',
    method: 'Observed at peak of ramp test, or end of a max 5-min effort with full warmup.',
  },
  lthr: {
    label: 'LTHR',
    unit: 'bpm',
    full: 'Lactate Threshold HR',
    description: 'The HR at which lactate begins to accumulate faster than the body can clear it. The HR zone where threshold work lives.',
    method: 'Average HR during the last 20 minutes of an all-out 1-hour effort, or measured during sustained threshold intervals.',
  },
};

// Only used when there is no saved history (fresh browser). Saved data wins.
export function defaultStatHistory() {
  return {
    ftp: [
      { date: '2026-05-04', value: 260, note: 'First Half Monty test' },
      { date: '2026-05-21', value: 275, note: 'Refined after Thu threshold @ 270W felt easy' },
      { date: '2026-05-30', value: 275, note: 'Retest confirmed (Quarq-adjusted MAP ~360W)' },
      { date: '2026-07-15', value: 280, note: 'Per migration brief (Jul 2026, exact date not recorded)' },
    ],
    hrmax: [
      { date: '2026-05-04', value: 194, note: 'Observed at Half Monty failure' },
      { date: '2026-09-01', value: 192, note: 'Per migration brief (Sep 2026, exact date not recorded)' },
    ],
    lthr: [
      { date: '2026-05-27', value: 172, note: 'Avg HR during 270W threshold (block 1 169, block 2 173)' },
      { date: '2026-09-01', value: 174, note: 'Per migration brief (exact date not recorded)' },
    ],
  };
}

export function getStatHistory(key) {
  if (!app.state.statHistory) app.state.statHistory = defaultStatHistory();
  if (!app.state.statHistory[key]) app.state.statHistory[key] = [];
  return app.state.statHistory[key].slice().sort((a, b) => a.date.localeCompare(b.date));
}

export function currentStatValue(key) {
  const h = getStatHistory(key);
  return h.length ? h[h.length - 1].value : null;
}

/** Keep the runtime FTP/HRmax in sync with the latest history entries. */
export function applyStatsToApp() {
  const ftp = currentStatValue('ftp');
  const hrmax = currentStatValue('hrmax');
  if (ftp) app.ftp = ftp;
  if (hrmax) app.hrmax = hrmax;
}

export function addStatEntry(key, dateStr, value, note) {
  getStatHistory(key);
  app.state.statHistory[key].push({ date: dateStr, value: parseFloat(value), note: note || '' });
  save();
  applyStatsToApp();
  renderStatTiles();
}

export function deleteStatEntry(key, idx) {
  const h = getStatHistory(key);
  const target = h[idx];
  app.state.statHistory[key] = app.state.statHistory[key].filter((e) =>
    !(e.date === target.date && e.value === target.value && e.note === target.note));
  save();
  applyStatsToApp();
  renderStatTiles();
  showStatTrend(key);
}

export function renderStatTiles() {
  const ftp = currentStatValue('ftp');
  const hrmax = currentStatValue('hrmax');
  const lthr = currentStatValue('lthr');
  if (ftp != null) document.getElementById('stat-ftp').innerHTML = `${ftp}<span class="st-unit">W</span>`;
  if (hrmax != null) document.getElementById('stat-hrmax').innerHTML = `${hrmax}<span class="st-unit">bpm</span>`;
  if (lthr != null) document.getElementById('stat-lthr').innerHTML = `${lthr}<span class="st-unit">bpm</span>`;
}

export function showStatTrend(key) {
  const def = STAT_DEFINITIONS[key];
  const history = getStatHistory(key);
  document.getElementById('modal-title').textContent = `${def.label} — History`;

  let tableRows = '';
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const date = new Date(entry.date + 'T00:00:00');
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    const isCurrent = (i === history.length - 1);
    let deltaStr = '', deltaClass = '';
    if (i > 0) {
      const delta = entry.value - history[i - 1].value;
      if (delta > 0) { deltaStr = `+${delta}`; deltaClass = 'up'; }
      else if (delta < 0) { deltaStr = `${delta}`; deltaClass = 'down'; }
      else { deltaStr = '—'; }
    }
    tableRows += `
      <tr>
        <td class="date">${dateStr}</td>
        <td class="val ${isCurrent ? 'current' : ''}">${entry.value} ${def.unit}</td>
        <td class="delta ${deltaClass}">${deltaStr}</td>
      </tr>`;
    if (entry.note) {
      tableRows += `<tr><td colspan="3" style="padding:0 0 10px;border-bottom:1px solid var(--line);color:var(--ink-3);font-size:11px;text-transform:none;letter-spacing:0">${entry.note}</td></tr>`;
    }
  }

  let chartHtml = '';
  if (history.length >= 2) {
    const W = 800, H = 100, P = 24;
    const values = history.map((h) => h.value);
    const spread = Math.max(...values) - Math.min(...values);
    const minV = Math.min(...values) - spread * 0.1 - 1;
    const maxV = Math.max(...values) + spread * 0.1 + 1;
    const range = Math.max(maxV - minV, 1);
    const stepX = (W - 2 * P) / Math.max(history.length - 1, 1);
    let path = '', dots = '';
    history.forEach((h, i) => {
      const x = P + i * stepX;
      const y = H - P - ((h.value - minV) / range) * (H - 2 * P);
      path += (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`);
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#c6ff3d" stroke="#0a0a0a" stroke-width="2"/>`;
      dots += `<text x="${x.toFixed(1)}" y="${(y - 10).toFixed(1)}" fill="#f5f5f5" font-size="10" font-family="SF Mono,monospace" text-anchor="middle">${h.value}</text>`;
    });
    chartHtml = `
      <div class="chart" style="margin-bottom:14px">
        <h4>Trend <span class="sub">${history.length} data points</span></h4>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:120px">
          <path d="${path}" stroke="#c6ff3d" stroke-width="2" fill="none"/>
          ${dots}
        </svg>
      </div>`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const placeholderVal = currentStatValue(key) || '';

  document.getElementById('modal-body').innerHTML = `
    ${chartHtml}
    <div class="stat-history">
      <div class="sh-title">All entries</div>
      ${history.length > 0 ? `<table>${tableRows}</table>` : '<div style="color:var(--ink-3);font-size:12px;padding:10px 0">No history yet.</div>'}
    </div>

    <div class="stat-history" style="margin-bottom:14px">
      <div class="sh-title">Add new entry</div>
      <div class="form-row">
        <div class="form-field">
          <label>Date</label>
          <input type="date" id="new-stat-date" value="${today}"/>
        </div>
        <div class="form-field">
          <label>${def.label} (${def.unit})</label>
          <input type="number" id="new-stat-val" placeholder="${placeholderVal}"/>
        </div>
      </div>
      <div class="form-field" style="margin-bottom:10px">
        <label>Note (optional)</label>
        <input type="text" id="new-stat-note" placeholder="e.g., post-test, refined estimate..."/>
      </div>
      <button class="status-btn active done" style="width:100%" onclick="G.saveNewStat('${key}')">Add Entry</button>
    </div>

    <div class="stat-note">
      <span class="nt">About ${def.label}</span>
      <strong>${def.full}.</strong> ${def.description}
      <div style="margin-top:8px;color:var(--ink-3);font-size:12px">
        <strong style="color:var(--ink-2)">How it's measured:</strong> ${def.method}
      </div>
    </div>
  `;
  document.getElementById('stat-modal').classList.add('show');
}

export function saveNewStat(key) {
  const date = document.getElementById('new-stat-date').value;
  const val = document.getElementById('new-stat-val').value;
  const note = document.getElementById('new-stat-note').value;
  if (!date || !val) {
    alert('Date and value required');
    return;
  }
  addStatEntry(key, date, val, note);
  showStatTrend(key);
}

export function closeStatModal(event) {
  if (event && event.target.id !== 'stat-modal') return;
  document.getElementById('stat-modal').classList.remove('show');
}
