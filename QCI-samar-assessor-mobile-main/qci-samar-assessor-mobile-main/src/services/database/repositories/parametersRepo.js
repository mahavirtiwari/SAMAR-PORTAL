import { idFromServer } from '../ids';
import { executeSql } from '../sqlUtils';

/**
 * Mirror the freshly-fetched server parameter list into the local table.
 *
 * Upserts in place rather than delete-all + re-insert: parameters cascade to
 * questions, which cascade to responses (ON DELETE CASCADE). Re-inserting
 * with the SAME deterministic ids keeps that chain intact, so a re-download
 * does NOT wipe captured offline responses. Question rows are nested per
 * parameter on the wire and routed separately via questionsRepo.
 */
export const replaceParametersForAssessment = async (
  assessmentLocalId,
  serverAssessmentId,
  serverParameters = []
) => {
  const keepIds = [];
  for (const p of serverParameters) {
    if (!p?.id) {
      continue;
    }
    const id = idFromServer(`${serverAssessmentId}-p-${p.id}`);
    await executeSql(
      `INSERT INTO parameters (id, server_id, assessment_id, is_mandatory, allocated_to_user_id, payload_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         server_id = excluded.server_id,
         is_mandatory = excluded.is_mandatory,
         allocated_to_user_id = excluded.allocated_to_user_id,
         payload_json = excluded.payload_json,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        p.id,
        assessmentLocalId,
        p.isMandatory ? 1 : 0,
        p.allocatedToUserId ?? null,
        JSON.stringify(p)
      ]
    );
    keepIds.push(id);
  }

  // Prune parameters that dropped out of the server set (their questions and
  // responses cascade away with them). Skip pruning when the list is empty —
  // that usually means the fetch failed upstream, and wiping would destroy
  // captured data for no reason.
  if (keepIds.length > 0) {
    const placeholders = keepIds.map(() => '?').join(',');
    await executeSql(
      `DELETE FROM parameters WHERE assessment_id = ? AND id NOT IN (${placeholders})`,
      [assessmentLocalId, ...keepIds]
    );
  }
};

/**
 * True when an assessment has its parameter bundle mirrored locally. Only the
 * explicit offline-download flow (downloadAssessmentForOffline) ever populates
 * the parameters table, so this is a reliable "downloaded for offline" signal
 * that survives an app restart — unlike `assessments.downloaded_at`, which is
 * also stamped by the fire-and-forget view-mirror.
 */
export const isAssessmentDownloaded = async (assessmentLocalId) => {
  const result = await executeSql(
    'SELECT COUNT(*) AS count FROM parameters WHERE assessment_id = ?',
    [assessmentLocalId]
  );
  return (result.rows.item(0)?.count ?? 0) > 0;
};

/**
 * Apply parameter→assessor assignments to the local table so the allocation
 * step reflects offline-made changes immediately and reports complete. Each
 * assignment is { parameterId (server id), teamMemberId }. We set both the
 * allocated_to_user_id column (queried by step-progress) and the payload's
 * assignedToTeamMemberId field (read by the allocation UI), mirroring what a
 * server round-trip would return.
 *
 * teamMembers (the allocation screen's roster, each { id, userId | user.id })
 * lets us also write payload.assignedTeamMember with the assignee's USER id.
 * Without it the my-assignments offline filter can't tell whose parameter an
 * offline allocation is, and every assessor saw (and could answer) all of them.
 */
export const applyLocalAllocations = async (
  assessmentLocalId,
  serverAssessmentId,
  assignments = [],
  teamMembers = []
) => {
  for (const a of assignments) {
    if (a?.parameterId == null || a?.teamMemberId == null) {
      continue;
    }
    const rowId = idFromServer(`${serverAssessmentId}-p-${a.parameterId}`);
    const existing = await executeSql('SELECT payload_json FROM parameters WHERE id = ?', [rowId]);
    if (existing.rows.length === 0) {
      continue;
    }
    let payload = {};
    try {
      payload = JSON.parse(existing.rows.item(0).payload_json || '{}');
    } catch {
      payload = {};
    }
    payload.assignedToTeamMemberId = a.teamMemberId;
    const member = (teamMembers || []).find((m) => String(m?.id) === String(a.teamMemberId));
    const assigneeUserId = member?.user?.id ?? member?.userId;
    if (assigneeUserId != null) {
      payload.assignedTeamMember = {
        id: a.teamMemberId,
        user: { id: assigneeUserId },
        name: member?.name ?? member?.user?.name ?? payload.assignedTeamMember?.name
      };
    }
    await executeSql(
      `UPDATE parameters
       SET allocated_to_user_id = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [assigneeUserId ?? a.teamMemberId, JSON.stringify(payload), rowId]
    );
  }
};

/**
 * Write-through of allocation fields from a fresh ONLINE parameters response
 * onto rows that already exist locally. Unlike replaceParametersForAssessment
 * this never inserts or prunes rows (the local bundle, incl. questions, stays
 * intact), so it is safe to run on every successful online fetch — it keeps
 * the offline mirror's allocations current without a full re-download.
 */
export const updateParameterAllocationsFromServer = async (
  assessmentLocalId,
  serverAssessmentId,
  serverParameters = []
) => {
  for (const p of serverParameters) {
    if (!p?.id) {
      continue;
    }
    const rowId = idFromServer(`${serverAssessmentId}-p-${p.id}`);
    const existing = await executeSql('SELECT payload_json FROM parameters WHERE id = ?', [rowId]);
    if (existing.rows.length === 0) {
      continue;
    }
    let payload = {};
    try {
      payload = JSON.parse(existing.rows.item(0).payload_json || '{}');
    } catch {
      payload = {};
    }
    payload.assignedToTeamMemberId = p.assignedToTeamMemberId ?? null;
    payload.assignedTeamMember = p.assignedTeamMember ?? null;
    await executeSql(
      `UPDATE parameters
       SET allocated_to_user_id = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        p.assignedTeamMember?.user?.id ?? p.assignedToTeamMemberId ?? null,
        JSON.stringify(payload),
        rowId
      ]
    );
  }
};

export const listParametersForAssessment = async (assessmentLocalId) => {
  const result = await executeSql(
    'SELECT * FROM parameters WHERE assessment_id = ? ORDER BY id ASC',
    [assessmentLocalId]
  );
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    rows.push({ ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null });
  }
  return rows;
};
