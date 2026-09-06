// Workout profile chart (SVG bars per block) with hover/tap tooltip, and the
// tiny bar preview used on collapsed day cards.

import { app } from '../app.js';
import { estimateHRFromFTP } from '../lib/metrics.js';
import { isHardType } from '../lib/sessions.js';

// Convert mouse/touch event to SVG-local point and return the rect under it
export function findBlockUnderPointer(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  const rects = svg.querySelectorAll('rect.block-bar');
  for (const r of rects) {
    const x = parseFloat(r.getAttribute('x'));
    const w = parseFloat(r.getAttribute('width'));
    // Whole column is the hit area so users can hover anywhere above a bar
    if (local.x >= x && local.x <= x + w) return r;
  }
  return null;
}

export function showTooltipForBar(rect, tooltipEl, container, clientX, clientY) {
  const label = rect.getAttribute('data-label');
  const dur = rect.getAttribute('data-dur');
  const power = rect.getAttribute('data-power');
  const pctftp = rect.getAttribute('data-pctftp');
  const hr = rect.getAttribute('data-hr');
  const pcthr = rect.getAttribute('data-pcthr');
  const kind = rect.getAttribute('data-kind');
  const kindLabel = { work: 'Work', warm: 'Warm-up', cool: 'Cool-down', rec: 'Recovery', easy: 'Easy' }[kind] || kind;

  tooltipEl.innerHTML = `
    <div class="tt-label">${kindLabel}</div>
    <div class="tt-name">${label}</div>
    <div class="tt-row"><span class="k">Duration</span><span class="v">${dur}</span></div>
    <div class="tt-row"><span class="k">Power</span><span class="v">${power}W <span class="pct">${pctftp}%</span></span></div>
    <div class="tt-row"><span class="k">Est. HR</span><span class="v">${hr} bpm <span class="pct">${pcthr}%</span></span></div>
  `;
  tooltipEl.classList.add('show');

  const containerRect = container.getBoundingClientRect();
  const tipW = tooltipEl.offsetWidth;
  const tipH = tooltipEl.offsetHeight;
  let left = clientX - containerRect.left - tipW / 2;
  let top = clientY - containerRect.top - tipH - 12;
  left = Math.max(8, Math.min(containerRect.width - tipW - 8, left));
  if (top < 4) top = clientY - containerRect.top + 16;
  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
}

export function handleVizHover(event, vizId) {
  const svg = event.currentTarget;
  const tooltipEl = document.getElementById('viz-tooltip-' + vizId);
  if (!tooltipEl) return;
  const container = tooltipEl.parentElement;
  const rect = findBlockUnderPointer(svg, event.clientX, event.clientY);
  if (rect) showTooltipForBar(rect, tooltipEl, container, event.clientX, event.clientY);
  else tooltipEl.classList.remove('show');
}

export function handleVizTap(event, vizId) {
  const svg = event.currentTarget;
  const tooltipEl = document.getElementById('viz-tooltip-' + vizId);
  if (!tooltipEl) return;
  const container = tooltipEl.parentElement;
  const clientX = event.clientX || (event.touches && event.touches[0] && event.touches[0].clientX);
  const clientY = event.clientY || (event.touches && event.touches[0] && event.touches[0].clientY);
  if (clientX == null) return;
  const rect = findBlockUnderPointer(svg, clientX, clientY);
  if (rect) {
    showTooltipForBar(rect, tooltipEl, container, clientX, clientY);
    event.stopPropagation();
  }
}

export function hideVizTooltip(event, vizId) {
  if (vizId) {
    const tooltipEl = document.getElementById('viz-tooltip-' + vizId);
    if (tooltipEl) tooltipEl.classList.remove('show');
  } else {
    document.querySelectorAll('.viz-tooltip.show').forEach((el) => el.classList.remove('show'));
  }
}

export function renderWorkoutViz(sess, ftp = app.ftp, hrmax = app.hrmax) {
  if (!sess.blocks || sess.blocks.length === 0) return '';
  const blocks = sess.blocks;
  const totalDur = blocks.reduce((sum, b) => sum + b.dur, 0);
  if (totalDur === 0) return '';

  // Unique id per viz instance so tooltips don't collide
  const vizId = 'v' + Math.random().toString(36).slice(2, 9);

  const W = 800, H = 120, PAD_X = 24, PAD_Y = 16;
  const chartW = W - 2 * PAD_X;
  const chartH = H - 2 * PAD_Y;

  const maxPower = Math.max(330, ...blocks.map((b) => b.power)) * 1.05;
  const minPower = 80;
  const powerRange = maxPower - minPower;

  const isHard = isHardType(sess.type);
  const workColor = isHard ? '#ff8c42' : '#c6ff3d'; // orange for hard, lime for Z2
  const colorFor = (kind) => {
    if (kind === 'work') return workColor;
    if (kind === 'warm' || kind === 'cool') return '#666';
    return '#3a3a3a';
  };

  const workBlocks = blocks.filter((b) => b.kind === 'work');
  const totalWork = workBlocks.reduce((s, b) => s + b.dur, 0);
  const avgWorkPower = workBlocks.length ? Math.round(workBlocks.reduce((s, b) => s + b.power * b.dur, 0) / totalWork) : 0;
  const peakPower = Math.max(...blocks.map((b) => b.power));

  let bars = '';
  let xPos = PAD_X;
  blocks.forEach((b) => {
    const bw = (b.dur / totalDur) * chartW;
    const bh = ((b.power - minPower) / powerRange) * chartH;
    const y = H - PAD_Y - bh;
    const pctFTP = (b.power / ftp) * 100;
    const estHR = estimateHRFromFTP(pctFTP, hrmax);
    const durMin = Math.floor(b.dur / 60);
    const durSec = b.dur % 60;
    const durStr = durMin > 0 ? `${durMin}:${String(durSec).padStart(2, '0')}` : `${durSec}s`;
    bars += `<rect class="block-bar" x="${xPos.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(bw - 0.3, 0.5).toFixed(1)}" height="${bh.toFixed(1)}" fill="${colorFor(b.kind)}" rx="1" data-label="${b.label}" data-dur="${durStr}" data-power="${b.power}" data-pctftp="${pctFTP.toFixed(0)}" data-hr="${estHR.bpm}" data-pcthr="${estHR.pct}" data-kind="${b.kind}"/>`;
    xPos += bw;
  });

  // FTP reference line (was hardcoded to 275W in the single-file app)
  const ftpY = H - PAD_Y - ((ftp - minPower) / powerRange) * chartH;
  const ftpLine = `<line x1="${PAD_X}" y1="${ftpY.toFixed(1)}" x2="${W - PAD_X}" y2="${ftpY.toFixed(1)}" stroke="#c6ff3d" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.4"/>
    <text x="${W - PAD_X}" y="${ftpY - 3}" fill="#c6ff3d" font-size="9" font-family="SF Mono,monospace" text-anchor="end" opacity="0.7">FTP ${ftp}W</text>`;

  const ticks = [];
  for (const p of [150, 200, 250, 300]) {
    const ty = H - PAD_Y - ((p - minPower) / powerRange) * chartH;
    ticks.push(`<text x="${PAD_X - 4}" y="${ty + 3}" fill="#444" font-size="8" font-family="SF Mono,monospace" text-anchor="end">${p}</text>`);
  }

  const totalMin = Math.round(totalDur / 60);
  const workMin = Math.round(totalWork / 60);

  return `
    <div class="workout-viz" onclick="G.hideVizTooltip(event)">
      <div class="viz-tooltip" id="viz-tooltip-${vizId}"></div>
      <div class="viz-header">
        <div class="viz-title">Workout Profile</div>
        <div class="viz-legend">
          <div class="lg-item"><div class="lg-bar" style="background:${workColor}"></div>Work</div>
          <div class="lg-item"><div class="lg-bar" style="background:#666"></div>WU/CD</div>
          <div class="lg-item"><div class="lg-bar" style="background:#3a3a3a"></div>Recovery</div>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" onmousemove="G.handleVizHover(event, '${vizId}')" onmouseleave="G.hideVizTooltip(event, '${vizId}')" onclick="G.handleVizTap(event, '${vizId}')">
        ${ticks.join('')}
        ${bars}
        ${ftpLine}
      </svg>
      <div class="viz-summary">
        <div class="seg"><span>Total</span><span class="v">${totalMin} min</span></div>
        ${workBlocks.length ? `<div class="seg"><span>Work</span><span class="v">${workMin} min</span></div>` : ''}
        ${avgWorkPower ? `<div class="seg"><span>Avg Work</span><span class="v">${avgWorkPower}W</span></div>` : ''}
        ${peakPower > 200 ? `<div class="seg"><span>Peak</span><span class="v">${peakPower}W</span></div>` : ''}
      </div>
    </div>`;
}

export function renderMiniViz(sess) {
  if (!sess.blocks || sess.blocks.length === 0) return '';
  let blocks = sess.blocks;
  const targetBars = 14;
  if (blocks.length > targetBars) {
    const step = blocks.length / targetBars;
    const sampled = [];
    for (let i = 0; i < blocks.length; i += step) sampled.push(blocks[Math.floor(i)]);
    blocks = sampled;
  }
  const maxPower = Math.max(330, ...blocks.map((b) => b.power));
  const minHeight = 2, maxHeight = 24;
  return `<div class="mini-viz ${isHardType(sess.type) ? 'hard' : ''}">
    ${blocks.map((b) => {
      const h = Math.max(minHeight, (b.power / maxPower) * maxHeight);
      return `<div class="mb ${b.kind}" style="height:${h.toFixed(1)}px"></div>`;
    }).join('')}
  </div>`;
}
