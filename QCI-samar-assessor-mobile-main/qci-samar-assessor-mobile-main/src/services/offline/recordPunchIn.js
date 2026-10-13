import { Logger } from '../../utils/logger';
import { idFromServer, newId } from '../database/ids';
import { ensureAssessmentRow, resolveTeamMemberId } from '../database/repositories/assessmentsRepo';
import { getLatestAttendance, insertAttendance } from '../database/repositories/attendanceRepo';
import { enqueue } from '../database/repositories/outboxRepo';
import { flushOutbox } from './flushOutbox';
import { isPersistedPhotoPath, persistPhoto } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Records a punch-in offline-first: persists the selfie durably, inserts an
 * `attendance` row, enqueues the outbox op, then hands it to the drain
 * (the only uploader) and returns its synced state.
 */
export const recordPunchIn = async ({
  serverAssessmentId,
  teamMemberId,
  userId,
  selfieUri,
  latitude,
  longitude,
  deviceMetadata
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordPunchIn: missing serverAssessmentId');
  }

  // The UI resolves teamMemberId from redux assessmentData, which is empty
  // offline when the assessment isn't in redux. Backfill from the SQLite
  // mirror (or fall back to userId) so an offline punch never crashes here.
  const resolvedTeamMemberId =
    teamMemberId || (await resolveTeamMemberId(serverAssessmentId, userId));
  if (!resolvedTeamMemberId) {
    throw new Error('recordPunchIn: missing teamMemberId');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);

  // Punch events must alternate. A punch-in while the latest local attendance
  // is already a punch-in is a duplicate capture (stale UI state / double
  // submission) — recording it would queue an op the server can only reject
  // with "already punched in". Reuse the existing punch instead.
  const latest = await getLatestAttendance(localAssessmentId, resolvedTeamMemberId);
  if (latest?.type === 'punch_in') {
    Logger.warn('[offline] punchIn ignored — latest local attendance is already a punch-in');
    return { localId: latest.id, synced: latest.local_status === 'synced' };
  }

  const attendanceId = newId();
  const recordedAt = new Date().toISOString();

  // The attendance row FKs to assessments(id); make sure the parent exists
  // even if the assessment was never downloaded / mirrored yet.
  await ensureAssessmentRow(serverAssessmentId);

  // Already persisted at capture (capturePipeline) → reuse as-is.
  const selfiePath = isPersistedPhotoPath(selfieUri)
    ? selfieUri
    : await persistPhoto({
        uri: selfieUri,
        assessmentId: localAssessmentId,
        bucket: 'attendance',
        name: `selfie_${attendanceId}.jpg`
      });
  // A selfie was captured but couldn't be persisted (empty/missing source) —
  // queuing it uploads a doomed file that fails with a no-status network error
  // and wedges the outbox. Fail loudly so the punch flow asks for a retake.
  if (selfieUri && !selfiePath) {
    Logger.error(`[punchIn] selfie persist failed (empty/missing source) source=${selfieUri}`);
    throw new Error('Could not save the punch-in selfie — the image was empty. Please retake it.');
  }

  await insertAttendance({
    id: attendanceId,
    assessmentId: localAssessmentId,
    teamMemberId: resolvedTeamMemberId,
    type: 'punch_in',
    selfiePath,
    latitude,
    longitude,
    recordedAt,
    deviceMetadata
  });

  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'punchIn',
    opKey: `attendance:punchIn:${attendanceId}`,
    payload: {
      attendanceId,
      serverAssessmentId,
      selfiePath,
      latitude,
      longitude,
      deviceMetadata,
      recordedAt
    }
  });
  const outboxRowId = await findOutboxIdByKey(`attendance:punchIn:${attendanceId}`);

  const synced = await flushOutbox(outboxRowId, 'punchIn');
  return { localId: attendanceId, synced };
};
