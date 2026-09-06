// Parses a pasted "SESSION LOG" text (the summary produced after a ride) into
// the fields of a logged session: power, hr, tss, rpe.

export function parseSessionLog(text) {
  if (!text || typeof text !== 'string') return null;
  if (!/SESSION LOG/i.test(text)) return null;
  const out = {};
  // Power: "Power: avg 178W" / "avg 178 W" / "avg power 178"
  const powerMatch = text.match(/(?:avg\s*power|power[:\s]+avg|avg)[:\s]+(\d{2,4})\s*w/i);
  if (powerMatch) out.power = parseInt(powerMatch[1]);
  // HR: "HR: avg 158" / "avg HR 158" / "avg 158 bpm"
  const hrMatch = text.match(/(?:avg\s*hr|hr[:\s]+avg|avg)[:\s]+(\d{2,3})(?:\s*bpm|\s*$|\s*[·.\n])/im);
  let hrVal = hrMatch ? parseInt(hrMatch[1]) : null;
  if (!hrVal) {
    const hrAlt = text.match(/hr[:\s]+(\d{2,3})/i);
    if (hrAlt) hrVal = parseInt(hrAlt[1]);
  }
  if (hrVal && hrVal >= 80 && hrVal <= 220) out.hr = hrVal;
  // TSS: "TSS: 92" / "TSS 92"
  const tssMatch = text.match(/tss[:\s]+(\d{1,3})/i);
  if (tssMatch) out.tss = parseInt(tssMatch[1]);
  // RPE: "RPE: 7/10" / "RPE 7"
  const rpeMatch = text.match(/rpe[:\s]+(\d{1,2})(?:\s*\/\s*10)?/i);
  if (rpeMatch) out.rpe = parseInt(rpeMatch[1]);
  if (Object.keys(out).length === 0) return null;
  return out;
}
