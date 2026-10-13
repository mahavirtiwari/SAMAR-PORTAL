import { Logger } from '../../../utils/logger';
import { executeSql } from '../sqlUtils';

const isMissingTable = (error) => /no such table/i.test(error?.message || '');

/**
 * Idempotent enqueue keyed by op_key. Re-enqueuing the same logical
 * operation (e.g. the user edits then re-submits a response before sync)
 * replaces the payload + resets retry_count, so the sync engine only
 * uploads the latest version.
 */
export const enqueue = async ({ assessmentId, opType, opKey, payload }) => {
  await executeSql(
    `INSERT INTO outbox (assessment_id, op_type, op_key, payload_json, status, retry_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(op_key) DO UPDATE SET
       payload_json = excluded.payload_json,
       status = 'pending',
       retry_count = 0,
       terminal = 0,
       last_error = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [assessmentId || null, opType, opKey, JSON.stringify(payload || {})]
  );
  // Single choke-point for every offline capture — one consistent line per
  // queued op (site picture, site tour, evidence, meeting, response, basic
  // info, punch, allocation) so the capture→sync lifecycle is traceable.
  Logger.info(`[outbox] queued op=${opType} key=${opKey} assessment=${assessmentId || '-'}`);
};

/**
 * Removes a queued op by its op_key. Used when a not-yet-synced item is
 * deleted offline: its create op never reached the server, so we cancel it
 * outright instead of queuing a delete the server couldn't act on.
 */
export const dequeueByOpKey = async (opKey) => {
  try {
    await executeSql(`DELETE FROM outbox WHERE op_key = ?`, [opKey]);
  } catch (error) {
    if (isMissingTable(error)) {
      return;
    }
    throw error;
  }
};

/**
 * Returns the not-yet-synced outbox row for an op_key (any status except
 * 'synced', including retry-exhausted 'failed' rows), or null. Callers use
 * this to detect a local mutation the server hasn't seen yet, so a fresh
 * server pull doesn't overwrite it.
 */
export const getUnsyncedOpByKey = async (opKey) => {
  let result;
  try {
    result = await executeSql(
      `SELECT * FROM outbox WHERE op_key = ? AND status != 'synced' LIMIT 1`,
      [opKey]
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return null;
    }
    throw error;
  }
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows.item(0);
  return { ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null };
};

// Status of one outbox row ('pending' | 'syncing' | 'failed' | 'synced'), or
// null when the row no longer exists. Lets a capture helper report whether the
// drain it just ran actually landed its row.
export const getOutboxStatusById = async (id) => {
  let result;
  try {
    result = await executeSql(`SELECT status FROM outbox WHERE id = ? LIMIT 1`, [id]);
  } catch (error) {
    if (isMissingTable(error)) {
      return null;
    }
    throw error;
  }
  return result.rows.length === 0 ? null : result.rows.item(0).status;
};

/**
 * Count of an assessment's unsynced rows queued BEFORE a given row id. Backs
 * the punch-out sync fence: punch-out may only reach the server once every
 * item captured before it has, because the backend lets the web submit for QC
 * as soon as all assessors show punched out — any data still queued at that
 * moment would be rejected permanently. Strictly earlier rows only: punch
 * events must replay in capture order, and a row queued AFTER the punch-out
 * (e.g. the next punch-in cycle, or a second queued punch-out) must not hold
 * it back — counting later rows inverts the replay order and deadlocks the
 * queue (the later punch-in is rejected with "already punched in" until this
 * punch-out lands, while this punch-out waits on that punch-in).
 */
export const countUnsyncedForAssessmentBefore = async (assessmentId, beforeId) => {
  let result;
  try {
    result = await executeSql(
      `SELECT COUNT(*) AS count FROM outbox
       WHERE assessment_id = ? AND id < ? AND status != 'synced'`,
      // No anchor id → fence on everything (fail safe: hold the punch-out).
      // Terminal rows (server-rejected, or a lost/empty local photo file) fence
      // too: once punch-out lands, the web side can submit for QC and the server
      // rejects late data for good, so releasing the fence past a stuck row
      // silently ships an assessment with field data missing. The assessor
      // clears the fence deliberately — retry or discard from the stuck-items
      // banner — and only then does punch-out go through.
      [assessmentId, beforeId ?? Number.MAX_SAFE_INTEGER]
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return 0;
    }
    throw error;
  }
  return result.rows.item(0)?.count ?? 0;
};

/**
 * Pending rows ready for upload, oldest first. Rows that have already
 * failed MAX_RETRIES times are excluded — they need human intervention
 * (typically a fix on the server side) before they're worth retrying.
 *
 * 'syncing' rows are also picked up: a row only stays 'syncing' if a prior
 * drain was killed mid-flight (the in-process `draining` flag prevents a
 * genuinely concurrent drain), so re-attempting them here recovers them
 * instead of leaving them orphaned forever.
 */
export const MAX_RETRIES = 5;
// Diagnostic: every unsynced row with its stored failure reason, so a stuck
// item's cause is visible in the logs even when the drain skips it (a terminal /
// retry-exhausted row is not re-attempted, so it otherwise logs nothing).
export const listStuckForLog = async () => {
  try {
    const result = await executeSql(
      `SELECT op_type, status, retry_count, terminal, substr(last_error, 1, 250) AS err
       FROM outbox
       WHERE status != 'synced'
       ORDER BY id ASC`
    );
    const rows = [];
    for (let i = 0; i < result.rows.length; i += 1) {
      rows.push(result.rows.item(i));
    }
    return rows;
  } catch {
    return [];
  }
};

export const peekPending = async (limit = 50) => {
  let result;
  try {
    result = await executeSql(
      `SELECT * FROM outbox
       WHERE status IN ('pending', 'failed', 'syncing')
         AND retry_count < ?
       ORDER BY id ASC
       LIMIT ?`,
      [MAX_RETRIES, limit]
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return [];
    }
    throw error;
  }
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    rows.push({ ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null });
  }
  return rows;
};

/**
 * True when an earlier (lower id), still-unsynced, non-terminal meeting create
 * op exists for this assessment. The comment/participant endpoints are keyed by
 * assessment + type and reject with a real "meeting not found" 4xx if attempted
 * before their parent meeting exists server-side, so the sync engine holds
 * those rows back with this check instead of letting that 4xx retire them
 * terminally. A terminal meeting row doesn't count as blocking: it will never
 * exist server-side either, so the dependent edit is left to fail on its own
 * merits rather than being blocked forever.
 */
export const hasEarlierUnsyncedMeeting = async (assessmentId, meetingOpType, beforeId) => {
  let result;
  try {
    result = await executeSql(
      `SELECT COUNT(*) AS count FROM outbox
       WHERE assessment_id = ? AND op_type = ? AND id < ? AND status != 'synced' AND terminal != 1`,
      [assessmentId, meetingOpType, beforeId ?? Number.MAX_SAFE_INTEGER]
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return false;
    }
    throw error;
  }
  return (result.rows.item(0)?.count ?? 0) > 0;
};

/**
 * Sync status for a set of op_keys, as a Map(op_key -> { status, terminal,
 * retry_count }). Lets a list of local captures resolve each photo's per-image
 * badge (synced / pending / failed) in one query instead of a lookup per row.
 * Missing keys are simply absent from the map (already synced or never queued).
 */
export const getStatusByOpKeys = async (opKeys) => {
  const map = new Map();
  if (!opKeys || opKeys.length === 0) {
    return map;
  }
  const placeholders = opKeys.map(() => '?').join(',');
  let result;
  try {
    result = await executeSql(
      `SELECT op_key, status, terminal, retry_count FROM outbox WHERE op_key IN (${placeholders})`,
      opKeys
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return map;
    }
    throw error;
  }
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    map.set(row.op_key, {
      status: row.status,
      terminal: row.terminal,
      retry_count: row.retry_count
    });
  }
  return map;
};

/**
 * Revert a row the drain marked 'syncing' back to 'pending' without touching
 * retry_count — for deferrals discovered inside a handler (e.g. evidence whose
 * source site-tour picture hasn't synced yet). Not a failure: the row simply
 * waits for a later pass.
 */
export const markPending = async (id) => {
  await executeSql(
    `UPDATE outbox SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'syncing'`,
    [id]
  );
};

export const markSyncing = async (id) => {
  await executeSql(
    `UPDATE outbox SET status = 'syncing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id]
  );
};

/**
 * Mark a row synced, only while it is still the row the drain sent. A row set
 * to 'syncing' can be flipped back to 'pending' by a concurrent re-enqueue (the
 * user re-edits a step with a stable op_key while its upload is in flight);
 * guarding on status='syncing' keeps that newer payload for the next drain
 * instead of stamping it synced and silently dropping it.
 */
export const markSynced = async (id) => {
  await executeSql(
    `UPDATE outbox SET status = 'synced', last_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'syncing'`,
    [id]
  );
};

/**
 * Mark a row failed. `terminal` is for server rejections that retrying the
 * same payload can never fix (e.g. a 409 business-rule lock): retry_count is
 * pushed to the cap so peekPending excludes the row from future drains.
 */
export const markFailed = async (
  id,
  errorMessage,
  { terminal = false, countRetry = true } = {}
) => {
  // countRetry=false (transient network/timeout) leaves retry_count untouched
  // so connectivity blips don't burn the cap and silently retire a good row.
  const retryExpr = terminal ? String(MAX_RETRIES) : countRetry ? 'retry_count + 1' : 'retry_count';
  // Never stamped over 'synced': a row this attempt lost can already have been
  // landed by another attempt, and a failure written over that would resurrect
  // a finished upload. Returns whether the failure was actually recorded so the
  // drain does not count a row that stayed synced.
  const result = await executeSql(
    `UPDATE outbox
     SET status = 'failed',
         retry_count = ${retryExpr},
         terminal = ?,
         last_error = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status != 'synced'`,
    [terminal ? 1 : 0, errorMessage?.slice?.(0, 500) || String(errorMessage || ''), id]
  );
  return (result?.rowsAffected ?? 1) > 0;
};

// Counts everything not yet on the server — INCLUDING rows that exhausted
// MAX_RETRIES or were rejected (terminal). We must never report "all synced"
// while a capture is still unsaved: the badge has to keep surfacing it, and the
// reschedule wipe gates on this count, so a stuck-but-unsynced row must not look
// absent (that would silently delete the assessor's work). Auto-drain retry-
// capping lives in peekPending — visibility and retry are deliberately decoupled.
export const countPendingForAssessment = async (assessmentId) => {
  let result;
  try {
    result = await executeSql(
      `SELECT COUNT(*) AS pending FROM outbox
       WHERE assessment_id = ?
         AND status != 'synced'`,
      [assessmentId]
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return 0;
    }
    throw error;
  }
  return result.rows.item(0)?.pending ?? 0;
};

// Everything not yet on the server across every assessment. Backs the logout
// notices: a forced logout PRESERVES this data (it uploads on the next same-user
// login), while a manual logout wipes it — either way the user is told the
// count. Counts terminal/retry-exhausted rows too — same reason as
// countPendingForAssessment: a stuck row is still unsynced work.
export const countAllUnsynced = async () => {
  let result;
  try {
    result = await executeSql(`SELECT COUNT(*) AS count FROM outbox WHERE status != 'synced'`);
  } catch (error) {
    if (isMissingTable(error)) {
      return 0;
    }
    throw error;
  }
  return result.rows.item(0)?.count ?? 0;
};

// Rows the auto-drain has given up on — retry-exhausted or server-rejected
// (terminal) — across every assessment. Exactly the complement of peekPending:
// a header sync tap will never pick these up, so the drain reports "nothing
// processed" while they sit unsynced. The header uses this to tell the truth
// ("N need attention, open the assessment to retry/discard") instead of a false
// "All clear" when the only remaining work is a stuck row.
export const countStuckUnsynced = async () => {
  let result;
  try {
    result = await executeSql(
      `SELECT COUNT(*) AS count FROM outbox WHERE status != 'synced' AND retry_count >= ?`,
      [MAX_RETRIES]
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return 0;
    }
    throw error;
  }
  return result.rows.item(0)?.count ?? 0;
};

/**
 * Unsynced summary split into rows the engine will still auto-retry (pending)
 * and rows that have stopped on their own and need user action (failed =
 * retry-exhausted or server-rejected). Powers a "N pending • M failed" badge.
 */
export const getUnsyncedSummaryForAssessment = async (assessmentId) => {
  let result;
  try {
    result = await executeSql(
      `SELECT
         SUM(CASE WHEN retry_count < ? THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN retry_count >= ? THEN 1 ELSE 0 END) AS failed
       FROM outbox
       WHERE assessment_id = ? AND status != 'synced'`,
      [MAX_RETRIES, MAX_RETRIES, assessmentId]
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return { pending: 0, failed: 0 };
    }
    throw error;
  }
  const row = result.rows.item(0) || {};
  return { pending: row.pending ?? 0, failed: row.failed ?? 0 };
};

/**
 * Every not-yet-synced operation for an assessment, with enough detail for the
 * UI to show what's stuck and why. `blocked` marks rows the auto-drain has given
 * up on (retry-exhausted or terminal) — the ones a user must Retry or Discard;
 * `terminal` flags a server rejection that a plain retry won't fix (re-capture
 * is the real fix).
 */
export const listUnsyncedForAssessment = async (assessmentId) => {
  let result;
  try {
    result = await executeSql(
      `SELECT id, op_type, op_key, status, retry_count, terminal, last_error,
              created_at, updated_at, payload_json
       FROM outbox
       WHERE assessment_id = ? AND status != 'synced'
       ORDER BY id ASC`,
      [assessmentId]
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return [];
    }
    throw error;
  }
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    rows.push({
      ...row,
      blocked: (row.retry_count ?? 0) >= MAX_RETRIES,
      terminal: row.terminal === 1,
      payload: row.payload_json ? JSON.parse(row.payload_json) : null
    });
  }
  return rows;
};

/**
 * Force a re-attempt: clears the retry cap + terminal flag so the next drain
 * picks the row(s) up again. For an explicit user "Retry"/"Sync now" — a
 * deliberate action, distinct from the background auto-drain that honours the
 * cap. Scope to one row (id) or the whole assessment (assessmentId).
 */
export const resetForRetry = async ({ id, assessmentId } = {}) => {
  const setClause = `SET status = 'pending', retry_count = 0, terminal = 0,
                         last_error = NULL, updated_at = CURRENT_TIMESTAMP`;
  try {
    if (id != null) {
      await executeSql(`UPDATE outbox ${setClause} WHERE id = ? AND status != 'synced'`, [id]);
    } else if (assessmentId != null) {
      await executeSql(
        `UPDATE outbox ${setClause} WHERE assessment_id = ? AND status != 'synced'`,
        [assessmentId]
      );
    }
  } catch (error) {
    if (isMissingTable(error)) {
      return;
    }
    throw error;
  }
};

/**
 * Discard a single stuck operation the user has chosen to give up on. Removes
 * the outbox row only — the caller is responsible for any matching local
 * capture/photo cleanup, which is op_type-specific and lives with the UI.
 */
export const discardOutboxItem = async (id) => {
  try {
    await executeSql(`DELETE FROM outbox WHERE id = ?`, [id]);
  } catch (error) {
    if (isMissingTable(error)) {
      return;
    }
    throw error;
  }
};
