import { executeSql } from '../sqlUtils';

export const insertAttendance = async (row) => {
  await executeSql(
    `INSERT INTO attendance (id, assessment_id, team_member_id, type, selfie_path, latitude, longitude, recorded_at, device_metadata_json, local_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      row.id,
      row.assessmentId,
      row.teamMemberId,
      row.type,
      row.selfiePath ?? null,
      row.latitude ?? null,
      row.longitude ?? null,
      row.recordedAt,
      row.deviceMetadata ? JSON.stringify(row.deviceMetadata) : null
    ]
  );
};

export const markAttendanceSynced = async (localId, serverId) => {
  await executeSql(`UPDATE attendance SET local_status = 'synced', server_id = ? WHERE id = ?`, [
    serverId ?? null,
    localId
  ]);
};

// For a punch the assessor discards: the server never received it, so the
// local record must go too or the phone keeps showing a punch that never happened.
export const hardDeleteAttendance = async (localId) => {
  await executeSql(`DELETE FROM attendance WHERE id = ?`, [localId]);
};

// True when this device recorded a punch-in for the assessment after the given
// capture time. The attendance table only ever holds this device's own punches,
// so no team-member scope is needed. recorded_at is an ISO string, which
// compares correctly as text.
export const hasLaterPunchIn = async (assessmentId, afterRecordedAt) => {
  if (!afterRecordedAt) {
    return false;
  }
  const result = await executeSql(
    `SELECT COUNT(*) AS count FROM attendance
     WHERE assessment_id = ? AND type = 'punch_in' AND recorded_at > ?`,
    [assessmentId, afterRecordedAt]
  );
  return (result.rows.item(0)?.count ?? 0) > 0;
};

export const getLatestAttendance = async (assessmentId, teamMemberId) => {
  const result = await executeSql(
    `SELECT * FROM attendance
     WHERE assessment_id = ? AND team_member_id = ?
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [assessmentId, teamMemberId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows.item(0);
};
