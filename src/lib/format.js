/** Minutes -> "45m", "1h", "1h20", "7h05". */
export function fmtDuration(min) {
  const m = Math.round(min || 0);
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60), r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h${String(r).padStart(2, '0')}`;
}

/** "Strength (heavy)" -> "STR heavy"; other names unchanged (parens stripped). */
export function strengthChipLabel(name) {
  const m = /^strength\s*\((.+)\)\s*$/i.exec(name);
  if (m) return `STR ${m[1].toLowerCase()}`;
  return name.replace(/\s*\([^)]*\)\s*/g, '').trim();
}
