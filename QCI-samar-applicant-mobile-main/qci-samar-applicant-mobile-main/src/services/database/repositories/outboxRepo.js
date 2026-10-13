import { Logger } from '../../../utils/logger';
import { executeSql } from '../sqlUtils';

const isMissingTable = error => /no such table/i.test(error?.message || '');

/**
 * Idempotent enqueue keyed by op_key. Re-enqueuing the same logical operation
 * replaces the payload + resets retry_count, so the sync engine only uploads
 * the latest version.
 */
export const enqueue = async ({ assessmentId, opType, opKey, payload }) => {
  await executeSql(
    `INSERT INTO outbox (assessment_id, op_type, op_key, payload_json, status, retry_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(op_key) DO UPDATE SET
       payload_json = excluded.payload_json,
       status = 'pending',
       retry_count = 0,
       last_error = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [assessmentId || null, opType, opKey, JSON.stringify(payload || {})],
  );
  // Single choke-point for every offline capture — one consistent line per
  // queued op so the capture -> sync lifecycle is traceable.
  Logger.info(`[outbox] queued op=${opType} key=${opKey} assessment=${assessmentId || '-'}`);
};

/**
 * Removes a queued op by its op_key. Used when a not-yet-synced item is deleted
 * offline: its create op never reached the server, so we cancel it outright
 * instead of queuing a delete the server couldn't act on.
 */
export const dequeueByOpKey = async opKey => {
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
 * 'synced'), or null.
 */
export const getUnsyncedOpByKey = async opKey => {
  let result;
  try {
    result = await executeSql(
      `SELECT * FROM outbox WHERE op_key = ? AND status != 'synced' LIMIT 1`,
      [opKey],
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

/**
 * Pending rows ready for upload, oldest first. Rows that have already failed
 * MAX_RETRIES times are excluded — they need intervention before a retry.
 *
 * 'syncing' rows are also picked up: a row only stays 'syncing' if a prior
 * drain was killed mid-flight, so re-attempting them here recovers them.
 */
export const MAX_RETRIES = 5;
export const peekPending = async (limit = 50) => {
  let result;
  try {
    result = await executeSql(
      `SELECT * FROM outbox
       WHERE status IN ('pending', 'failed', 'syncing')
         AND retry_count < ?
       ORDER BY id ASC
       LIMIT ?`,
      [MAX_RETRIES, limit],
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
 * Un-synced rows of one op_type for an assessment, oldest first. Backs the
 * capture screens' "show what's still queued" overlay: a photo captured offline
 * lives only here until it drains, so the screen reads it back from the outbox
 * (the single source of truth for pending uploads) to rehydrate on revisit.
 */
export const listUnsyncedByType = async (assessmentId, opType) => {
  let result;
  try {
    result = await executeSql(
      `SELECT * FROM outbox
       WHERE assessment_id = ? AND op_type = ? AND status != 'synced'
       ORDER BY id ASC`,
      [String(assessmentId), opType],
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

export const markSyncing = async id => {
  await executeSql(
    `UPDATE outbox SET status = 'syncing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id],
  );
};

/**
 * Mark a row synced. The drain loop passes onlyIfSyncing: a row it set to
 * 'syncing' can be flipped back to 'pending' by a concurrent re-enqueue, so
 * guarding on status='syncing' keeps that re-enqueued row's newer payload for
 * the next drain instead of silently dropping it. The inline record* path marks
 * its own freshly-enqueued ('pending') row, so it leaves the guard off.
 */
export const markSynced = async (id, { onlyIfSyncing = false } = {}) => {
  const guard = onlyIfSyncing ? `AND status = 'syncing'` : '';
  await executeSql(
    `UPDATE outbox SET status = 'synced', last_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? ${guard}`,
    [id],
  );
};

/**
 * Mark a row failed. `terminal` is for server rejections a retry can never fix:
 * retry_count is pushed to the cap so peekPending excludes the row.
 */
export const markFailed = async (
  id,
  errorMessage,
  { terminal = false, countRetry = true } = {},
) => {
  // countRetry=false (transient network/timeout) leaves retry_count untouched
  // so connectivity blips don't burn the cap and silently retire a good row.
  const retryExpr = terminal ? String(MAX_RETRIES) : countRetry ? 'retry_count + 1' : 'retry_count';
  await executeSql(
    `UPDATE outbox
     SET status = 'failed',
         retry_count = ${retryExpr},
         terminal = ?,
         last_error = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [terminal ? 1 : 0, errorMessage?.slice?.(0, 500) || String(errorMessage || ''), id],
  );
};

// Counts everything not yet on the server — INCLUDING rows that exhausted
// MAX_RETRIES or were rejected (terminal). We must never report "all synced"
// while a capture is still unsaved: the badge has to keep surfacing it.
export const countPendingForAssessment = async assessmentId => {
  let result;
  try {
    result = await executeSql(
      `SELECT COUNT(*) AS pending FROM outbox
       WHERE assessment_id = ?
         AND status != 'synced'`,
      [assessmentId],
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return 0;
    }
    throw error;
  }
  return result.rows.item(0)?.pending ?? 0;
};

// Everything not yet on the server across every assessment. Backs the header
// badge. Counts terminal/retry-exhausted rows too — a stuck row is still work.
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

// Rows the auto-drain has given up on — retry-exhausted or server-rejected —
// across every assessment. The complement of peekPending: a manual sync tap
// never picks these up, so the header can tell the truth ("N need attention")
// instead of a false "All clear" when the only remaining work is stuck.
export const countStuckUnsynced = async () => {
  let result;
  try {
    result = await executeSql(
      `SELECT COUNT(*) AS count FROM outbox WHERE status != 'synced' AND retry_count >= ?`,
      [MAX_RETRIES],
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
 * Force a re-attempt: clears the retry cap + terminal flag so the next drain
 * picks the row(s) up again. For an explicit user "Retry"/"Sync now".
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
        [assessmentId],
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
 * the outbox row only — the caller handles any matching local photo cleanup.
 */
export const discardOutboxItem = async id => {
  try {
    await executeSql(`DELETE FROM outbox WHERE id = ?`, [id]);
  } catch (error) {
    if (isMissingTable(error)) {
      return;
    }
    throw error;
  }
};
