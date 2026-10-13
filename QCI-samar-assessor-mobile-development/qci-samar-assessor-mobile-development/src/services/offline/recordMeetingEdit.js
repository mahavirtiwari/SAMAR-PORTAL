import { idFromServer } from '../database/ids';
import {
  findParticipantByServerOrLocalId,
  getMeetingByType,
  hardDeleteParticipant,
  insertMeetingParticipant,
  softDeleteParticipant,
  updateMeetingComment
} from '../database/repositories/meetingsRepo';
import { dequeueByOpKey, enqueue } from '../database/repositories/outboxRepo';
import { flushOutbox } from './flushOutbox';
import { findOutboxIdByKey } from './syncHelpers';

// Offline-first edits to an already-created meeting (opening/closing). The
// participant/comment endpoints are keyed by assessment + type, so they sync
// independently of the meeting create (which, when also done offline, is queued
// earlier and therefore drains first under the FIFO outbox order).

/**
 * Adds an external participant offline-first: writes a local participant row
 * (so it shows immediately via hydrateMeetingFromLocal), queues the add, and
 * hands it to the drain.
 */
export const recordParticipantAdd = async ({ serverAssessmentId, type, name, designation }) => {
  if (!serverAssessmentId) {
    throw new Error('recordParticipantAdd: missing serverAssessmentId');
  }
  if (!name || !designation) {
    throw new Error('recordParticipantAdd: name and designation required');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);
  const meeting = await getMeetingByType(localAssessmentId, type);

  // Attach to the local meeting row when present so it renders offline; a
  // server-only meeting (created online, no local mirror) still queues the op.
  const localParticipantId = meeting
    ? await insertMeetingParticipant({ meetingId: meeting.id, name, designation })
    : null;

  const opKey = `meetingParticipantAdd:${localParticipantId ?? `${type}:${name}:${designation}`}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'meetingParticipantAdd',
    opKey,
    payload: { serverAssessmentId, type, name, designation, localParticipantId }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'meetingParticipantAdd');
  return { synced };
};

/**
 * Deletes an external participant offline-first. Unsynced local participants
 * are removed outright (queued add cancelled); synced ones are soft-deleted +
 * queued for a server delete handed to the drain.
 */
export const recordParticipantDelete = async ({ serverAssessmentId, type, participantId }) => {
  if (!serverAssessmentId) {
    throw new Error('recordParticipantDelete: missing serverAssessmentId');
  }
  if (!participantId) {
    throw new Error('recordParticipantDelete: missing participantId');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);
  const row = await findParticipantByServerOrLocalId(participantId);

  if (row && !(row.local_status === 'synced' && row.server_id)) {
    await dequeueByOpKey(`meetingParticipantAdd:${row.id}`);
    await hardDeleteParticipant(row.id);
    return { deleted: true, synced: false, queued: false };
  }

  const serverId = row?.server_id ?? participantId;
  if (row) {
    await softDeleteParticipant(row.id);
  }

  const opKey = `meetingParticipantDelete:${serverId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'meetingParticipantDelete',
    opKey,
    payload: { serverAssessmentId, type, participantId: serverId, localId: row?.id ?? null }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'meetingParticipantDelete');
  return { deleted: true, synced, queued: true };
};

/**
 * Adds/edits the meeting comment offline-first. The comment is singular per
 * meeting (the endpoint is keyed by assessment + type), so this upserts the
 * local comment row, queues a PUT, and hands it to the drain. Re-edits before
 * sync replace the queued op via its stable op_key.
 */
export const recordCommentUpsert = async ({ serverAssessmentId, type, teamMemberId, comment }) => {
  if (!serverAssessmentId) {
    throw new Error('recordCommentUpsert: missing serverAssessmentId');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);
  const meeting = await getMeetingByType(localAssessmentId, type);
  const localCommentId = meeting
    ? await updateMeetingComment({ meetingId: meeting.id, teamMemberId, comment })
    : null;

  const opKey = `meetingComment:${type}:${localAssessmentId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'meetingCommentUpsert',
    opKey,
    payload: { serverAssessmentId, type, comment, localCommentId }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'meetingCommentUpsert');
  return { synced };
};
