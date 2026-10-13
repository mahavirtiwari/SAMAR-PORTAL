import { Logger } from '../../utils/logger';
import { hardDeleteAttendance } from '../database/repositories/attendanceRepo';
import { hardDeleteParticipant } from '../database/repositories/meetingsRepo';
import { discardOutboxItem } from '../database/repositories/outboxRepo';
import { hardDeleteEvidence } from '../database/repositories/responsesRepo';
import {
  hardDeleteSitePicture,
  hardDeleteSiteTourPicture
} from '../database/repositories/sitePicturesRepo';
import { deletePhotoFile } from './photoStorage';

// Per op type: remove the local capture the discarded outbox row was going to
// upload, so the phone stops showing data the server will never hold. Ops with
// no local artefact of their own (deletes, meeting records, text-only rows)
// need nothing beyond dropping the outbox row.
const discardPunch = async (payload) => {
  await deletePhotoFile(payload?.selfiePath);
  if (payload?.attendanceId) {
    await hardDeleteAttendance(payload.attendanceId);
  }
};

const localCleanup = {
  punchIn: discardPunch,
  punchOut: discardPunch,
  sitePicture: async (payload) => {
    await deletePhotoFile(payload?.filePath);
    if (payload?.localId) {
      await hardDeleteSitePicture(payload.localId);
    }
  },
  siteTourPicture: async (payload) => {
    await deletePhotoFile(payload?.filePath);
    if (payload?.localId) {
      await hardDeleteSiteTourPicture(payload.localId);
    }
  },
  responseEvidence: async (payload) => {
    await deletePhotoFile(payload?.filePath);
    if (payload?.evidenceId) {
      await hardDeleteEvidence(payload.evidenceId);
    }
  },
  meetingParticipantAdd: async (payload) => {
    if (payload?.localParticipantId) {
      await hardDeleteParticipant(payload.localParticipantId);
    }
  }
};

/**
 * Discard a stuck outbox row the assessor has given up on, together with the
 * local capture it belonged to. Discard is the only way to release a punch-out
 * held behind a permanently failed item, so it must leave the device consistent
 * with the server rather than an orphaned photo that looks captured.
 *
 * `row` is an item from listUnsyncedForAssessment (id, op_type, payload); a bare
 * `{ id }` falls back to dropping just the outbox row.
 */
export const discardStuckCapture = async (row) => {
  const cleanup = row?.op_type ? localCleanup[row.op_type] : null;
  if (cleanup) {
    try {
      await cleanup(row.payload);
    } catch (error) {
      Logger.warn(
        `[discard] local cleanup failed for ${row.op_type} id=${row.id}: ${error?.message || error}`
      );
    }
  }
  await discardOutboxItem(row.id);
  Logger.info(`[discard] dropped ${row?.op_type ?? 'outbox row'} id=${row.id}`);
};
