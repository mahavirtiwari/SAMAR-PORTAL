import { idFromServer } from '../database/ids';
import { executeSql } from '../database/sqlUtils';

/**
 * The offline-first read rule: between punch-in and punch-out, every read on
 * the assessment screens is served from SQLite ONLY — the app must not even
 * attempt a server read in that window. Connectivity matters for SAVES (the
 * outbox syncs opportunistically); reads come from the data downloaded and
 * captured on this device.
 *
 * The attendance table only ever holds THIS device's punches (server
 * attendance is never mirrored into it), so the device's latest local punch
 * is the authoritative "am I in the on-site window" signal.
 *
 * Errors deliberately resolve to false: if the gate can't be read the thunks
 * fall back to their normal online-with-local-fallback behaviour rather than
 * failing the screen.
 */
export const isPunchedInLocally = async (serverAssessmentId) => {
  if (!serverAssessmentId) {
    return false;
  }
  try {
    const result = await executeSql(
      `SELECT type FROM attendance
       WHERE assessment_id = ?
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [idFromServer(serverAssessmentId)]
    );
    if (result.rows.length === 0) {
      return false;
    }
    return result.rows.item(0).type === 'punch_in';
  } catch {
    return false;
  }
};

/**
 * Variant for reads that aren't assessment-scoped (the Basic Information
 * master-data dropdowns): true when ANY assessment on this device is
 * currently inside its punch-in window.
 */
export const isAnyAssessmentPunchedIn = async () => {
  try {
    const result = await executeSql(
      `SELECT a.type FROM attendance a
       JOIN (
         SELECT assessment_id, MAX(recorded_at) AS latest
         FROM attendance
         GROUP BY assessment_id
       ) m ON a.assessment_id = m.assessment_id AND a.recorded_at = m.latest
       WHERE a.type = 'punch_in'
       LIMIT 1`
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
};
