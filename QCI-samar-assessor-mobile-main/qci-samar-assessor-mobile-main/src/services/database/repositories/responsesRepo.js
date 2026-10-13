import { executeSql } from '../sqlUtils';

export const upsertResponse = async ({
  id,
  assessmentId,
  questionId,
  optionId,
  remarks,
  latitude,
  longitude,
  capturedAt
}) => {
  await executeSql(
    `INSERT INTO responses (id, assessment_id, question_id, option_id, remarks, latitude, longitude, captured_at, local_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       option_id = excluded.option_id,
       remarks = excluded.remarks,
       latitude = excluded.latitude,
       longitude = excluded.longitude,
       captured_at = excluded.captured_at,
       local_status = 'pending',
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      assessmentId,
      questionId,
      optionId ?? null,
      remarks ?? null,
      latitude ?? null,
      longitude ?? null,
      capturedAt ?? null
    ]
  );
};

export const insertResponseEvidence = async ({
  id,
  responseId,
  filePath,
  thumbPath,
  latitude,
  longitude,
  capturedAt,
  description,
  sourceSiteTourPictureId
}) => {
  await executeSql(
    `INSERT INTO response_evidence (id, response_id, file_path, thumb_path, latitude, longitude, captured_at, description, source_site_tour_picture_id, local_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      responseId,
      filePath,
      thumbPath ?? null,
      latitude ?? null,
      longitude ?? null,
      capturedAt ?? null,
      description ?? null,
      sourceSiteTourPictureId ?? null
    ]
  );
};

/**
 * Mirrors a server-saved answer into the local responses table after a
 * download, so the parameter screens prefill and the local step computation
 * counts it — e.g. on the first download after the logout wipe. Keyed by the
 * same deterministic id recordResponse uses, so later edits update the row in
 * place. The DO UPDATE is guarded on local_status = 'synced': an unsynced
 * local edit (pending/failed) is by definition newer than anything the server
 * returned and must never be overwritten.
 */
export const upsertSyncedResponseFromServer = async ({
  id,
  serverId,
  assessmentId,
  questionId,
  optionId,
  remarks,
  capturedAt,
  assessorUserId,
  assessorName,
  assessorRole
}) => {
  await executeSql(
    `INSERT INTO responses (id, server_id, assessment_id, question_id, option_id, remarks, captured_at, assessor_user_id, assessor_name, assessor_role, local_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       server_id = excluded.server_id,
       option_id = excluded.option_id,
       remarks = excluded.remarks,
       captured_at = excluded.captured_at,
       assessor_user_id = excluded.assessor_user_id,
       assessor_name = excluded.assessor_name,
       assessor_role = excluded.assessor_role,
       local_status = 'synced',
       updated_at = CURRENT_TIMESTAMP
     WHERE responses.local_status = 'synced'`,
    [
      id,
      serverId ?? null,
      assessmentId,
      questionId,
      optionId ?? null,
      remarks ?? null,
      capturedAt ?? null,
      assessorUserId ?? null,
      assessorName ?? null,
      assessorRole ?? null
    ]
  );
};

export const markResponseSynced = async (localId, serverId) => {
  await executeSql(`UPDATE responses SET local_status = 'synced', server_id = ? WHERE id = ?`, [
    serverId ?? null,
    localId
  ]);
};

export const markResponseEvidenceSynced = async (localId, serverId) => {
  await executeSql(
    `UPDATE response_evidence SET local_status = 'synced', server_id = ? WHERE id = ?`,
    [serverId ?? null, localId]
  );
};

export const findEvidenceByServerOrLocalId = async (id) => {
  const result = await executeSql(
    `SELECT * FROM response_evidence WHERE server_id = ? OR id = ? LIMIT 1`,
    [id, id]
  );
  return result.rows.length ? result.rows.item(0) : null;
};

export const softDeleteEvidence = async (localId) => {
  await executeSql(`UPDATE response_evidence SET local_status = 'deleted' WHERE id = ?`, [localId]);
};

export const hardDeleteEvidence = async (localId) => {
  await executeSql(`DELETE FROM response_evidence WHERE id = ?`, [localId]);
};

const collect = (result) => {
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
};

export const listResponses = async (assessmentLocalId) => {
  const result = await executeSql(
    `SELECT * FROM responses WHERE assessment_id = ? ORDER BY updated_at DESC`,
    [assessmentLocalId]
  );
  return collect(result);
};

export const listEvidenceForAssessment = async (assessmentLocalId) => {
  const result = await executeSql(
    `SELECT e.* FROM response_evidence e
     JOIN responses r ON e.response_id = r.id
     WHERE r.assessment_id = ? AND e.local_status != 'deleted'`,
    [assessmentLocalId]
  );
  return collect(result);
};

export const listEvidenceForResponse = async (responseLocalId) => {
  const result = await executeSql(
    `SELECT * FROM response_evidence WHERE response_id = ? AND local_status != 'deleted'`,
    [responseLocalId]
  );
  return collect(result);
};
