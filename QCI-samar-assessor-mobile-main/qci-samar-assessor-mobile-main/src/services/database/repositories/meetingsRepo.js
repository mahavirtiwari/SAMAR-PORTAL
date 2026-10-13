import { newId } from '../ids';
import { executeSql } from '../sqlUtils';

export const upsertMeeting = async ({
  id,
  assessmentId,
  type,
  imagePath,
  latitude,
  longitude,
  conductedAt,
  recordingLinks
}) => {
  const meetingId = id || newId();
  // Recording links are stored JSON-encoded. `undefined` means "not provided"
  // (an image-only re-save) — keep whatever links already exist, mirroring the
  // backend's has()-gated update. An explicit array (even []) overwrites.
  const recordingLinksJson =
    recordingLinks === undefined ? null : JSON.stringify(recordingLinks ?? []);
  await executeSql(
    `INSERT INTO meetings (id, assessment_id, type, image_path, latitude, longitude, conducted_at, recording_links, local_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
     ON CONFLICT(assessment_id, type) DO UPDATE SET
       image_path = COALESCE(excluded.image_path, image_path),
       latitude = excluded.latitude,
       longitude = excluded.longitude,
       conducted_at = excluded.conducted_at,
       recording_links = COALESCE(excluded.recording_links, recording_links),
       local_status = 'pending'`,
    [
      meetingId,
      assessmentId,
      type,
      imagePath ?? null,
      latitude ?? null,
      longitude ?? null,
      conductedAt ?? null,
      recordingLinksJson
    ]
  );
  const result = await executeSql('SELECT id FROM meetings WHERE assessment_id = ? AND type = ?', [
    assessmentId,
    type
  ]);
  return result.rows.item(0)?.id;
};

export const insertMeetingComment = async ({ id, meetingId, teamMemberId, comment, createdAt }) => {
  const commentId = id || newId();
  // Stamp the authored-at time so the comment renders a date offline, mirroring
  // the online payload's createdAt. Caller may pass one; default to now.
  const authoredAt = createdAt || new Date().toISOString();
  await executeSql(
    `INSERT INTO meeting_comments (id, meeting_id, team_member_id, comment, created_at, local_status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [commentId, meetingId, teamMemberId ?? null, comment ?? '', authoredAt]
  );
  return commentId;
};

export const insertMeetingParticipant = async ({ id, meetingId, name, designation }) => {
  const pid = id || newId();
  await executeSql(
    `INSERT INTO meeting_participants (id, meeting_id, name, designation, source, local_status)
     VALUES (?, ?, ?, ?, 'local', 'pending')`,
    [pid, meetingId, name, designation ?? null]
  );
  return pid;
};

export const markMeetingSynced = async (localId, serverId) => {
  await executeSql(`UPDATE meetings SET local_status = 'synced', server_id = ? WHERE id = ?`, [
    serverId ?? null,
    localId
  ]);
};

// --- Comment edit ---------------------------------------------------------
// The comment endpoint is keyed by assessment+type (one comment per meeting),
// so an edit updates the single local comment row in place and re-flags it
// pending for sync.
export const updateMeetingComment = async ({ meetingId, teamMemberId, comment }) => {
  const existing = await executeSql(
    `SELECT id FROM meeting_comments WHERE meeting_id = ? LIMIT 1`,
    [meetingId]
  );
  if (existing.rows.length) {
    const id = existing.rows.item(0).id;
    await executeSql(
      `UPDATE meeting_comments SET comment = ?, local_status = 'pending' WHERE id = ?`,
      [comment ?? '', id]
    );
    return id;
  }
  return insertMeetingComment({ meetingId, teamMemberId, comment });
};

export const markMeetingCommentSynced = async (localId, serverId) => {
  await executeSql(
    `UPDATE meeting_comments SET local_status = 'synced', server_id = ? WHERE id = ?`,
    [serverId ?? null, localId]
  );
};

// --- Participant edit -----------------------------------------------------
export const findParticipantByServerOrLocalId = async (id) => {
  const result = await executeSql(
    `SELECT * FROM meeting_participants WHERE server_id = ? OR id = ? LIMIT 1`,
    [id, id]
  );
  return result.rows.length ? result.rows.item(0) : null;
};

export const markMeetingParticipantSynced = async (localId, serverId) => {
  await executeSql(
    `UPDATE meeting_participants SET local_status = 'synced', server_id = ? WHERE id = ?`,
    [serverId ?? null, localId]
  );
};

export const softDeleteParticipant = async (localId) => {
  await executeSql(`UPDATE meeting_participants SET local_status = 'deleted' WHERE id = ?`, [
    localId
  ]);
};

export const hardDeleteParticipant = async (localId) => {
  await executeSql(`DELETE FROM meeting_participants WHERE id = ?`, [localId]);
};

const collect = (result) => {
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
};

export const getMeetingByType = async (assessmentLocalId, type) => {
  const result = await executeSql(
    `SELECT * FROM meetings WHERE assessment_id = ? AND type = ? LIMIT 1`,
    [assessmentLocalId, type]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows.item(0);
};

export const listMeetingComments = async (meetingId) => {
  const result = await executeSql(
    `SELECT * FROM meeting_comments WHERE meeting_id = ? AND local_status != 'deleted'`,
    [meetingId]
  );
  return collect(result);
};

export const listMeetingParticipants = async (meetingId) => {
  const result = await executeSql(
    `SELECT * FROM meeting_participants WHERE meeting_id = ? AND local_status != 'deleted'`,
    [meetingId]
  );
  return collect(result);
};
