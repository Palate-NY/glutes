// Trends view: weekly load bars and HR/W efficiency per session type.

import { app, keyFor } from '../app.js';
import { dateForDay } from '../lib/plan.js';
import { fmtDate } from '../lib/dates.js';
import { creditedTSS } from '../lib/metrics.js';

export function renderTrends() {
  const el = document.getElementById('trendsview');
  const weekTSS = [];
  const z2Eff = [], ssEff = [], thrEff = [], vo2Eff = [];

  app.plan.weeks.forEach((w) => {
    let p = 0, a = 0;
    w.days.forEach((sessions, di) => {
      sessions.forEach((s, si) => {
        p += s.tss || 0;
        const ac = app.state.actuals[keyFor(w.week, di, si)];
        a += creditedTSS(ac, s.tss);
        if (ac && (ac.status === 'done' || ac.status === 'partial') && ac.power && ac.hr) {
          const point = {
            week: w.week,
            date: dateForDay(app.plan, w.week, di),
            power: parseFloat(ac.power),
            hr: parseFloat(ac.hr),
            ratio: parseFloat(ac.hr) / parseFloat(ac.power),
          };
          if (s.type === 'z2') z2Eff.push(point);
          else if (s.type === 'ss') ssEff.push(point);
          else if (s.type === 'thr') thrEff.push(point);
          else if (s.type === 'vo2') vo2Eff.push(point);
        }
      });
    });
    weekTSS.push({ week: w.week, planned: p, actual: a, label: w.label });
  });

  el.innerHTML = `
    <div class="chart">
      <h4>Weekly Load (TSS) <span class="sub">planned vs done</span></h4>
      ${renderBarChart(weekTSS)}
    </div>
    ${renderEfficiencyChart('Z2 Endurance Efficiency', z2Eff, 'lower = aerobic engine improving')}
    ${renderEfficiencyChart('Sweet Spot Efficiency', ssEff, 'lower = handling load better')}
    ${renderEfficiencyChart('Threshold Efficiency', thrEff, 'lower = threshold floor rising')}
    ${renderEfficiencyChart('VO2max Efficiency', vo2Eff, 'lower = ceiling rising')}
  `;
}

export function renderBarChart(data) {
  const W = 800, H = 140, P = 30;
  const maxV = Math.max(...data.map((d) => Math.max(d.planned || 0, d.actual || 0)), 100);
  const bw = (W - 2 * P) / data.length;
  let bars = '';
  data.forEach((d, i) => {
    const x = P + i * bw;
    const ph = (d.planned || 0) / maxV * (H - 2 * P);
    const ah = (d.actual || 0) / maxV * (H - 2 * P);
    bars += `<rect x="${x + bw * 0.1}" y="${H - P - ph}" width="${bw * 0.35}" height="${ph}" fill="#3a3f48" rx="2"/>`;
    bars += `<rect x="${x + bw * 0.5}" y="${H - P - ah}" width="${bw * 0.35}" height="${ah}" fill="#7c9cff" rx="2"/>`;
    bars += `<text x="${x + bw * 0.5}" y="${H - 10}" fill="#6c7280" font-size="9" text-anchor="middle">W${d.week}</text>`;
  });
  return `<svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${bars}
    <text x="${P}" y="${P - 8}" fill="#6c7280" font-size="10">${maxV} TSS</text>
  </svg>`;
}

export function renderEfficiencyChart(title, data, sub) {
  if (data.length < 2) {
    return `
      <div class="chart">
        <h4>${title} <span class="sub">${sub}</span></h4>
        <div style="text-align:center;color:var(--ink-3);padding:30px 0;font-size:12px">Need ≥ 2 logged sessions to show trend</div>
      </div>`;
  }
  const W = 800, H = 140, P = 30;
  const ratios = data.map((d) => d.ratio);
  const minR = Math.min(...ratios) * 0.95;
  const maxR = Math.max(...ratios) * 1.05;
  const range = maxR - minR;
  const stepX = (W - 2 * P) / Math.max(data.length - 1, 1);
  let path = '', dots = '', labels = '';
  data.forEach((d, i) => {
    const x = P + i * stepX;
    const y = H - P - ((d.ratio - minR) / range) * (H - 2 * P);
    path += (i === 0 ? `M${x},${y}` : ` L${x},${y}`);
    dots += `<circle cx="${x}" cy="${y}" r="3.5" fill="#7c9cff" stroke="#0e0f12" stroke-width="1.5"/>`;
    if (i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) {
      labels += `<text x="${x}" y="${H - 10}" fill="#6c7280" font-size="9" text-anchor="middle">${fmtDate(d.date)}</text>`;
    }
  });
  const first = data[0].ratio, last = data[data.length - 1].ratio;
  const direction = last < first ? 'improving' : last > first ? 'declining' : 'stable';
  const change = ((last - first) / first * 100).toFixed(1);

  return `
    <div class="chart">
      <h4>${title}
        <span class="sub" style="color:${direction === 'improving' ? 'var(--ok)' : direction === 'declining' ? 'var(--bad)' : 'var(--ink-3)'}">
          ${direction === 'improving' ? '▼' : direction === 'declining' ? '▲' : '–'} ${Math.abs(change)}%
        </span>
      </h4>
      <svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <path d="${path}" stroke="#7c9cff" stroke-width="2" fill="none"/>
        ${dots}
        ${labels}
        <text x="${P}" y="${P - 8}" fill="#6c7280" font-size="10">HR/W ratio · ${data.length} sessions</text>
      </svg>
    </div>`;
}
