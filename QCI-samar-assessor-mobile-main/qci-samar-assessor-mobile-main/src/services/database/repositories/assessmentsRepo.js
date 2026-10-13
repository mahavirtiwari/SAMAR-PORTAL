import { idFromServer } from '../ids';
import { executeSql } from '../sqlUtils';

/**
 * Upsert an assessment row from a server payload. The full payload is
 * serialised into payload_json so screens can rehydrate without per-field
 * mapping during Phase 2; per-field columns we want to query against
 * (status, scheduled dates) are also pulled out for indexed access.
 */
export const upsertAssessmentFromServer = async (serverAssessment) => {
  if (!serverAssessment?.id) {
    throw new Error('upsertAssessmentFromServer: missing server id');
  }
  const id = idFromServer(serverAssessment.id);
  const payload = JSON.stringify(serverAssessment);
  await executeSql(
    `INSERT INTO assessments (id, server_id, status, scheduled_start_date, scheduled_end_date, reschedule_version, payload_json, downloaded_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       server_id = excluded.server_id,
       status = excluded.status,
       scheduled_start_date = excluded.scheduled_start_date,
       scheduled_end_date = excluded.scheduled_end_date,
       reschedule_version = excluded.reschedule_version,
       payload_json = excluded.payload_json,
       downloaded_at = excluded.downloaded_at,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      serverAssessment.id,
      serverAssessment.status ?? null,
      serverAssessment.scheduledStartDate ?? null,
      serverAssessment.scheduledEndDate ?? null,
      serverAssessment.rescheduleVersion ?? 0,
      payload
    ]
  );
  return id;
};

/**
 * Mirrors one Home-list item into local storage without degrading a richer
 * detail mirror: the list payload is a slim subset of the detail payload
 * (same backend formatter, `detailed=false`), so an already-mirrored row only
 * gets its status and schedule fields patched. reschedule_version is owned by
 * the detail path (wipeIfRescheduled) — taking it from the list would mask a
 * reschedule and skip the local wipe.
 */
export const mirrorAssessmentListItem = async (serverAssessment) => {
  if (!serverAssessment?.id) {
    return null;
  }
  const id = idFromServer(serverAssessment.id);
  if (!(await isAssessmentFullyMirrored(id))) {
    return upsertAssessmentFromServer(serverAssessment);
  }
  const result = await executeSql('SELECT payload_json FROM assessments WHERE id = ?', [id]);
  let payloadJson = null;
  try {
    const payload = JSON.parse(result.rows.item(0).payload_json || '{}');
    payload.status = serverAssessment.status ?? payload.status;
    payload.scheduledStartDate = serverAssessment.scheduledStartDate ?? payload.scheduledStartDate;
    payload.scheduledEndDate = serverAssessment.scheduledEndDate ?? payload.scheduledEndDate;
    payloadJson = JSON.stringify(payload);
  } catch {
    // unparseable payload — patch the indexed columns only
  }
  if (payloadJson != null) {
    await executeSql(
      `UPDATE assessments SET status = ?, scheduled_start_date = ?, scheduled_end_date = ?,
         payload_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        serverAssessment.status ?? null,
        serverAssessment.scheduledStartDate ?? null,
        serverAssessment.scheduledEndDate ?? null,
        payloadJson,
        id
      ]
    );
  } else {
    await executeSql(
      `UPDATE assessments SET status = ?, scheduled_start_date = ?, scheduled_end_date = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        serverAssessment.status ?? null,
        serverAssessment.scheduledStartDate ?? null,
        serverAssessment.scheduledEndDate ?? null,
        id
      ]
    );
  }
  return id;
};

/**
 * Guarantees a parent `assessments` row exists for a server id so that an
 * offline child write (attendance, meeting, response, site picture) can
 * satisfy its `assessment_id` foreign key.
 *
 * On-site capture can begin before the assessment bundle has been mirrored
 * — and getAssessmentByIdAction's mirror is fire-and-forget — so each
 * record path calls this first instead of assuming the row is already there.
 *
 * INSERT OR IGNORE never clobbers a real row (the id PK and server_id UNIQUE
 * both collide); it only materialises a minimal stub when none exists yet.
 * payload_json is NOT NULL, so it is seeded with '{}'; reschedule_version
 * defaults to 0 and a later upsertAssessmentFromServer enriches the same row.
 */
export const ensureAssessmentRow = async (serverAssessmentId) => {
  if (!serverAssessmentId) {
    throw new Error('ensureAssessmentRow: missing server id');
  }
  const id = idFromServer(serverAssessmentId);
  await executeSql(
    `INSERT OR IGNORE INTO assessments (id, server_id, payload_json, updated_at)
     VALUES (?, ?, '{}', CURRENT_TIMESTAMP)`,
    [id, serverAssessmentId]
  );
  return id;
};

/**
 * True only when the assessment row holds a real mirrored server payload.
 * ensureAssessmentRow leaves a '{}' stub (with reschedule_version defaulting
 * to 0) so an offline capture can satisfy its FK — that stub must not be
 * treated as "this device saw version 0", or the first online fetch of an
 * already-rescheduled assessment would wipe the offline captures.
 */
export const isAssessmentFullyMirrored = async (localId) => {
  const result = await executeSql('SELECT payload_json FROM assessments WHERE id = ?', [localId]);
  if (result.rows.length === 0) {
    return false;
  }
  const payload = result.rows.item(0).payload_json;
  return payload != null && payload !== '{}';
};

/**
 * Returns the locally stored reschedule_version for an assessment, or null
 * if the assessment has never been mirrored to this device. Distinguishing
 * null from 0 matters: a first-time download must not be mistaken for a
 * reschedule.
 */
export const getStoredRescheduleVersion = async (localId) => {
  const result = await executeSql('SELECT reschedule_version FROM assessments WHERE id = ?', [
    localId
  ]);
  if (result.rows.length === 0) {
    return null;
  }
  const value = result.rows.item(0).reschedule_version;
  return value == null ? 0 : Number(value);
};

/**
 * Deletes all locally captured data for a single assessment. The child
 * tables that declare ON DELETE CASCADE (meeting_comments,
 * meeting_participants, response_evidence) are cleared via their parents.
 * The assessments row itself is preserved — the caller re-hydrates it.
 */
export const clearAssessmentLocalData = async (localId) => {
  const tables = [
    'outbox',
    'responses',
    'attendance',
    'meetings',
    'site_pictures',
    'site_tour_pictures',
    'basic_information',
    'questions',
    'parameters'
  ];
  for (const table of tables) {
    await executeSql(`DELETE FROM ${table} WHERE assessment_id = ?`, [localId]);
  }
};

/**
 * Mark an assessment's mobile role as finished + cleaned up on this device.
 * The assessments shell row survives clearAssessmentLocalData, so this flag
 * persists after the local capture data is deleted.
 */
export const markMobileRoleDone = async (localId) => {
  await executeSql('UPDATE assessments SET mobile_role_done = 1 WHERE id = ?', [localId]);
};

export const isMobileRoleDone = async (localId) => {
  const result = await executeSql('SELECT mobile_role_done FROM assessments WHERE id = ?', [
    localId
  ]);
  if (result.rows.length === 0) {
    return false;
  }
  return Number(result.rows.item(0).mobile_role_done) === 1;
};

/**
 * Mirrors the server-confirmed "Complete on Mobile" cutover timestamp. Set once
 * the online completion succeeds, before any local data is cleared, so the
 * Delete Data gate and post-cutover UI hold even after going offline.
 */
export const markMobileCompleted = async (localId, iso) => {
  await executeSql('UPDATE assessments SET mobile_completed_at = ? WHERE id = ?', [iso, localId]);
};

/**
 * Clears the two terminal per-device markers so an assessment the server has
 * handed back to this assessor becomes visible and downloadable again.
 *
 * Both markers are deliberately sticky: they survive clearAssessmentLocalData
 * (which only deletes the child tables) so the cleared/completed footer state
 * and the auto-download skip hold across restarts. Nothing else ever cleared
 * them, so an assessment that was completed on this device and later reset or
 * re-assigned server-side stayed invisible here forever — Home filters the row
 * out (listMirroredAssessments) and auto-download skips it — with reinstalling
 * the app the only way back. On the one-phone-per-assessor policy that is a
 * dead end, not an inconvenience.
 *
 * Only the list sync calls this, and only for an assessment the server is
 * actively offering this assessor again while reporting no cutover of their
 * own (myMobileCompletedAt null). The mobile list is fetched with
 * excludeMobileCompleted=1, so the server stops returning an assessment the
 * moment the assessor cuts over — an assessment that reappears has had that
 * cutover cleared server-side, which is exactly the re-assign case.
 */
export const clearMobileTerminalFlags = async (localId) => {
  await executeSql(
    `UPDATE assessments SET mobile_role_done = 0, mobile_completed_at = NULL
     WHERE id = ? AND (COALESCE(mobile_role_done, 0) = 1 OR mobile_completed_at IS NOT NULL)`,
    [localId]
  );
};

export const getMobileCompletedAt = async (localId) => {
  const result = await executeSql('SELECT mobile_completed_at FROM assessments WHERE id = ?', [
    localId
  ]);
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows.item(0).mobile_completed_at ?? null;
};

export const isMobileCompleted = async (localId) => {
  return (await getMobileCompletedAt(localId)) != null;
};

/**
 * Records that a co-assessor has, while online, confirmed the lead's opening
 * meeting is completed and synced on the server. This one-time verification
 * unlocks the co's Site Tour and persists so it stays unlocked offline.
 */
export const markLeadOpeningVerified = async (localId) => {
  await executeSql('UPDATE assessments SET lead_opening_verified = 1 WHERE id = ?', [localId]);
};

export const isLeadOpeningVerified = async (localId) => {
  const result = await executeSql('SELECT lead_opening_verified FROM assessments WHERE id = ?', [
    localId
  ]);
  if (result.rows.length === 0) {
    return false;
  }
  return Number(result.rows.item(0).lead_opening_verified) === 1;
};

/**
 * Mirrors the viewer-scoped step statuses fetched from the server while online
 * into local storage as a { step: status } JSON map (synced_global_steps
 * column), so the offline step-progress computation can reflect steps whose
 * artifacts this device doesn't hold — another assessor's captures, or this
 * assessor's own synced work after a logout wipe.
 */
export const setSyncedServerSteps = async (localId, statusByStep) => {
  await executeSql('UPDATE assessments SET synced_global_steps = ? WHERE id = ?', [
    JSON.stringify(statusByStep || {}),
    localId
  ]);
};

export const getSyncedServerSteps = async (localId) => {
  const result = await executeSql('SELECT synced_global_steps FROM assessments WHERE id = ?', [
    localId
  ]);
  if (result.rows.length === 0) {
    return {};
  }
  try {
    return JSON.parse(result.rows.item(0).synced_global_steps || '{}');
  } catch {
    return {};
  }
};

/**
 * Optimistically updates the locally-mirrored assessment status (both the
 * indexed column and the payload the list/detail read back), so an offline
 * action like "start assessment" reflects immediately and survives a restart.
 */
export const setAssessmentStatus = async (localId, status) => {
  const result = await executeSql('SELECT payload_json FROM assessments WHERE id = ?', [localId]);
  let payloadJson = null;
  if (result.rows.length > 0) {
    try {
      const payload = JSON.parse(result.rows.item(0).payload_json || '{}');
      payload.status = status;
      payloadJson = JSON.stringify(payload);
    } catch {
      // leave the payload untouched if it can't be parsed
    }
  }
  if (payloadJson != null) {
    await executeSql('UPDATE assessments SET status = ?, payload_json = ? WHERE id = ?', [
      status,
      payloadJson,
      localId
    ]);
  } else {
    await executeSql('UPDATE assessments SET status = ? WHERE id = ?', [status, localId]);
  }
};

export const getAssessmentByServerId = async (serverId) => {
  const result = await executeSql('SELECT * FROM assessments WHERE server_id = ?', [serverId]);
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows.item(0);
  return {
    ...row,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null
  };
};

/**
 * Resolves the current assessor's team_member_id for an attendance write.
 * team_member_id is local-only (the server identifies the assessor from the
 * JWT, never from this field) — it exists only to scope "my" attendance on a
 * shared device. So a best-effort resolution is correct: prefer the membership
 * id from the mirrored team, fall back to the userId so an offline punch on a
 * never-downloaded assessment still gets a non-null discriminator instead of
 * crashing the write. readLocalAttendanceStatus already degrades to the most
 * recent row when this can't be matched.
 */
export const resolveTeamMemberId = async (serverAssessmentId, userId) => {
  try {
    const local = await getAssessmentByServerId(serverAssessmentId);
    const members = local?.payload?.teamMembers || [];
    const me = members.find((m) => m?.userId === userId || m?.user?.id === userId);
    const resolved = me?.id ?? me?.teamMemberId ?? userId;
    if (resolved != null) {
      return resolved;
    }
  } catch {
    // fall through to userId — a missing mirror must not block the write
  }
  return userId ?? null;
};

/**
 * Returns the full server payloads for every mirrored assessment, in the same
 * array shape getAllAssessments() yields from the API. This IS the Home list:
 * the device's own mirror decides what's visible, online or offline. The only
 * exclusions are bare stubs (payload '{}') left by ensureAssessmentRow for an
 * offline child write, and rows the user removed via Delete Data
 * (mobile_role_done) — a server-side status change never hides a card.
 * Each payload carries localMobileCompletedAt so the list can keep a
 * cut-over assessment visible regardless of where the server status moves.
 */
export const listMirroredAssessments = async (currentUserId = null) => {
  const result = await executeSql(
    `SELECT payload_json, mobile_completed_at FROM assessments
     WHERE payload_json IS NOT NULL AND payload_json != '{}'
       AND COALESCE(mobile_role_done, 0) = 0
     ORDER BY scheduled_start_date ASC`
  );
  const assessments = [];
  for (let i = 0; i < result.rows.length; i++) {
    try {
      const payload = JSON.parse(result.rows.item(i).payload_json);
      if (!payload?.id) {
        continue;
      }
      // The server scopes the online list to the current assessor; the local
      // mirror is not user-scoped (a shared device accumulates every user's
      // assessments, and logout doesn't wipe it). So mirror that scoping here:
      // only return assessments the current user is a team member of. Without a
      // user id (callers that don't pass one) fall back to returning all.
      if (currentUserId != null) {
        const members = payload.team_members || payload.teamMembers || [];
        const isMember = members.some(
          (m) => String(m.user_id ?? m.userId ?? m.user?.id) === String(currentUserId)
        );
        if (!isMember) {
          continue;
        }
      }
      payload.localMobileCompletedAt = result.rows.item(i).mobile_completed_at ?? null;
      assessments.push(payload);
    } catch {
      // skip an unparseable row rather than failing the whole offline load
    }
  }
  return assessments;
};

/**
 * Reconciles the local mirror against a successful server list fetch, removing
 * rows the server no longer returns for this assessor. Fixes the stale-access
 * bug where a reassigned-away assessment lingered on Home (and stayed openable)
 * until logout, because the list path only upserted and never reconciled, and
 * the membership filter reads the never-refreshed local payload.
 *
 * Only ever runs against a successful fetch (a failed fetch must keep serving
 * the full mirror). A candidate row is KEPT — never removed — when it is:
 *   - a mobile-completed cut-over (server omits it via excludeMobileCompleted,
 *     but it must stay visible locally until Delete Data / auto-clear), or
 *   - carrying unsynced outbox work (never silently destroy local captures), or
 *   - one the current user isn't a member of (another user's row on a shared
 *     device — not this user's to reconcile).
 * Everything else the server dropped is a genuine un-assignment and is removed.
 */
export const reconcileMirrorAgainstServer = async (currentUserId, serverIds) => {
  if (currentUserId == null || !Array.isArray(serverIds)) {
    return;
  }
  const keep = new Set(serverIds.map((id) => String(id)));
  const result = await executeSql(
    `SELECT id, server_id, payload_json, mobile_completed_at FROM assessments
     WHERE payload_json IS NOT NULL AND payload_json != '{}'
       AND COALESCE(mobile_role_done, 0) = 0`
  );
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    if (keep.has(String(row.server_id))) {
      continue;
    }
    if (row.mobile_completed_at != null) {
      continue;
    }
    let isMember = false;
    try {
      const payload = JSON.parse(row.payload_json || '{}');
      const members = payload.team_members || payload.teamMembers || [];
      isMember = members.some(
        (m) => String(m.user_id ?? m.userId ?? m.user?.id) === String(currentUserId)
      );
    } catch {
      continue;
    }
    if (!isMember) {
      continue;
    }
    const pending = await executeSql(
      "SELECT COUNT(*) AS c FROM outbox WHERE assessment_id = ? AND status != 'synced'",
      [row.id]
    );
    if (Number(pending.rows.item(0).c) > 0) {
      continue;
    }
    await clearAssessmentLocalData(row.id);
    await executeSql('DELETE FROM assessments WHERE id = ?', [row.id]);
  }
};

export const listDownloadedAssessments = async () => {
  const result = await executeSql(
    `SELECT id, server_id, status, scheduled_start_date, scheduled_end_date, downloaded_at
     FROM assessments
     ORDER BY scheduled_start_date ASC`
  );
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
};
