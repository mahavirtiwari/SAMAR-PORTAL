import { Logger } from '../../utils/logger';
import { idFromServer, newId } from '../database/ids';
import { ensureAssessmentRow, resolveTeamMemberId } from '../database/repositories/assessmentsRepo';
import { getLatestAttendance, insertAttendance } from '../database/repositories/attendanceRepo';
import { enqueue } from '../database/repositories/outboxRepo';
import { flushOutbox } from './flushOutbox';
import { isPersistedPhotoPath, persistPhoto } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Offline-first punch-out. See recordPunchIn for the full pattern; the
 * shape is identical apart from the attendance type and the lack of
 * site exterior photos (only required on punch-in per spec).
 *
 * `knownPunchedIn` is the caller's current attendance status. This device's
 * attendance table only holds punches made here, so after a reinstall a
 * legitimate punch-out has no local punch-in to check against; the caller's
 * status covers that case, and without either signal the punch-out is refused.
 */
export const recordPunchOut = async ({
  serverAssessmentId,
  teamMemberId,
  userId,
  selfieUri,
  latitude,
  longitude,
  deviceMetadata,
  knownPunchedIn = false
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordPunchOut: missing serverAssessmentId');
  }

  // See recordPunchIn: backfill the local-only teamMemberId from the SQLite
  // mirror (or userId) so an offline punch-out never crashes here.
  const resolvedTeamMemberId =
    teamMemberId || (await resolveTeamMemberId(serverAssessmentId, userId));
  if (!resolvedTeamMemberId) {
    throw new Error('recordPunchOut: missing teamMemberId');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);

  // Punch events must alternate — see recordPunchIn. A punch-out while the
  // latest local attendance is already a punch-out is a duplicate capture;
  // reuse the existing punch instead of queuing a doomed op.
  const latest = await getLatestAttendance(localAssessmentId, resolvedTeamMemberId);
  if (latest?.type === 'punch_out') {
    Logger.warn('[offline] punchOut ignored — latest local attendance is already a punch-out');
    return { localId: latest.id, synced: latest.local_status === 'synced' };
  }
  if (!latest && !knownPunchedIn) {
    throw new Error('No punch-in is recorded on this device. Please punch in first.');
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
        name: `selfie_punchout_${attendanceId}.jpg`
      });
  // See recordPunchIn: fail loudly rather than queue a doomed empty upload.
  if (selfieUri && !selfiePath) {
    Logger.error(`[punchOut] selfie persist failed (empty/missing source) source=${selfieUri}`);
    throw new Error('Could not save the punch-out selfie — the image was empty. Please retake it.');
  }

  await insertAttendance({
    id: attendanceId,
    assessmentId: localAssessmentId,
    teamMemberId: resolvedTeamMemberId,
    type: 'punch_out',
    selfiePath,
    latitude,
    longitude,
    recordedAt,
    deviceMetadata
  });

  const opKey = `attendance:punchOut:${attendanceId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'punchOut',
    opKey,
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
  const outboxRowId = await findOutboxIdByKey(opKey);

  // The drain is the only uploader; it also holds the punch-out behind every
  // earlier capture (the sync fence), so `synced` is false while that fence
  // is up and the row goes when the earlier rows have.
  const synced = await flushOutbox(outboxRowId, 'punchOut');
  return { localId: attendanceId, synced };
};
