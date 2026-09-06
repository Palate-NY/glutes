// Physiology helpers.

/**
 * Estimate HR from %FTP using a piecewise linear mapping calibrated to the
 * athlete's data. Reference points: Z2 ~75% HRmax @ 65% FTP, SS ~87% @ 90% FTP,
 * threshold ~92% @ 100% FTP, VO2 ~96% @ 112% FTP.
 */
export function estimateHRFromFTP(pctFTP, hrmax) {
  if (!pctFTP || pctFTP < 30) return { bpm: 0, pct: 0 }; // recovery / not pedaling
  let pctHR;
  if (pctFTP < 55) pctHR = 60 + (pctFTP - 30) * 0.32;        // Z1: 60-68%
  else if (pctFTP < 75) pctHR = 68 + (pctFTP - 55) * 0.40;   // Z2: 68-76%
  else if (pctFTP < 88) pctHR = 76 + (pctFTP - 75) * 0.69;   // Z3: 76-85%
  else if (pctFTP < 95) pctHR = 85 + (pctFTP - 88) * 0.43;   // SS: 85-88%
  else if (pctFTP < 105) pctHR = 88 + (pctFTP - 95) * 0.50;  // Threshold: 88-93%
  else if (pctFTP < 115) pctHR = 93 + (pctFTP - 105) * 0.30; // VO2 sustained: 93-96%
  else pctHR = 96 + Math.min((pctFTP - 115) * 0.15, 3);      // Above VO2: cap ~99%
  pctHR = Math.min(Math.max(pctHR, 50), 99);
  return { bpm: Math.round(hrmax * pctHR / 100), pct: Math.round(pctHR) };
}

export function computeTSS(durMin, npOrAvg, ftp) {
  if (!durMin || !npOrAvg) return null;
  const IF = npOrAvg / ftp;
  return Math.round((durMin / 60) * IF * IF * 100);
}

/** Planned-vs-logged TSS credit for one session, same rules as the original app. */
export function creditedTSS(actual, plannedTSS) {
  if (!actual) return 0;
  const logged = actual.tss != null && actual.tss !== '' ? parseInt(actual.tss) : null;
  if (actual.status === 'done') return logged != null ? logged : plannedTSS;
  if (actual.status === 'partial') return logged != null ? logged : Math.round(plannedTSS * 0.6);
  return 0;
}
