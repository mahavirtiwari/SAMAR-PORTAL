import { executeSql } from '../sqlUtils';

/**
 * Persist the assessor's saved Basic Information form locally. One row per
 * assessment (assessment_id PK), so a re-save updates in place. The payload
 * is stored verbatim in the GET-shaped form the screen reads back.
 */
export const upsertBasicInformation = async ({ assessmentLocalId, payload }) => {
  await executeSql(
    `INSERT INTO basic_information (assessment_id, payload_json, local_status, updated_at)
     VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
     ON CONFLICT(assessment_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       local_status = 'pending',
       updated_at = CURRENT_TIMESTAMP`,
    [assessmentLocalId, JSON.stringify(payload || {})]
  );
};

export const getBasicInformation = async (assessmentLocalId) => {
  const result = await executeSql(
    'SELECT * FROM basic_information WHERE assessment_id = ? LIMIT 1',
    [assessmentLocalId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows.item(0);
  return { ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null };
};

export const markBasicInformationSynced = async (assessmentLocalId, serverId) => {
  await executeSql(
    `UPDATE basic_information SET local_status = 'synced', server_id = ? WHERE assessment_id = ?`,
    [serverId ?? null, assessmentLocalId]
  );
};
