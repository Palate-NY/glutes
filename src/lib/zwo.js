// ZWO writer. Generates a Zwift Workout XML (.zwo) file. TrainingPeaks accepts
// .zwo imports for power-based cycling workouts and syncs them to the Wahoo
// Bolt. Power values are FTP fractions (0.95 = 95% FTP); the Bolt resolves to
// watts at ride time using its configured FTP.
//
// The output is covered by a golden test (tests/zwo.test.js) against files
// produced by the original single-file app. Do not change the formatting here
// without regenerating that fixture on purpose.

export function escapeXml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildZwoFile(sess, ftp) {
  if (!sess.blocks || sess.blocks.length === 0) return null;
  if (!ftp) throw new Error('buildZwoFile: ftp required');
  const totalSec = sess.blocks.reduce((sum, b) => sum + b.dur, 0);
  const totalMin = Math.round(totalSec / 60);

  // FTP FRACTIONS: TrainingPeaks multiplies the Power value by its own FTP
  // setting regardless of attribute. Absolute watts would be multiplied again.
  // The user's TP FTP setting must match the FTP value in Glutes.
  const steadyStates = sess.blocks.map((b) => {
    const power = (b.power / ftp).toFixed(3);
    const cadence = b.kind === 'work' ? 90 : (b.kind === 'rec' || b.kind === 'easy' ? 85 : 90);
    return `        <SteadyState Duration="${b.dur}" Power="${power}" Cadence="${cadence}" pace="0">
            <textevent timeoffset="0" message="${escapeXml(b.label)}"/>
        </SteadyState>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Glutes</author>
    <name>${escapeXml(sess.name)}</name>
    <description>${escapeXml(sess.prescribed || '')} (${totalMin} min, calibrated to FTP ${ftp}W — verify your TP FTP matches)</description>
    <sportType>bike</sportType>
    <tags/>
    <workout>
${steadyStates}
    </workout>
</workout_file>`;
}

export function zwoFilename(sess, isoDate) {
  const safeName = sess.name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${isoDate}_${safeName}.zwo`;
}
