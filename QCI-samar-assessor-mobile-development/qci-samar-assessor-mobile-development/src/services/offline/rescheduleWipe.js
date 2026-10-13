import { Logger } from '../../utils/logger';
import { idFromServer } from '../database/ids';
import {
  clearAssessmentLocalData,
  getStoredRescheduleVersion,
  isAssessmentFullyMirrored
} from '../database/repositories/assessmentsRepo';
import { countPendingForAssessment } from '../database/repositories/outboxRepo';
import { downloadAssessmentForOffline } from './downloadAssessment';
import { deletePhotosForAssessment } from './photoStorage';

/**
 * Wipes locally captured assessment data when the backend reports a newer
 * reschedule_version than the device last saw. Ops can only reschedule an
 * assessment before any step has begun, so a bump means the on-site work
 * the device may hold is no longer valid and must be discarded.
 *
 * Returns true when a wipe was performed, false otherwise. A first-time
 * download (no stored version) never wipes — there is nothing to discard
 * and it would be mistaken for a reschedule.
 */
export const wipeIfRescheduled = async (serverAssessment) => {
  if (!serverAssessment?.id) {
    return false;
  }

  const serverVersion = Number(serverAssessment.rescheduleVersion ?? 0);
  const localId = idFromServer(serverAssessment.id);
  const storedVersion = await getStoredRescheduleVersion(localId);

  if (storedVersion === null || serverVersion <= storedVersion) {
    return false;
  }

  // A bare stub row (ensureAssessmentRow's '{}', version defaulting to 0)
  // means this device never actually saw ANY version — same as storedVersion
  // null. Without this check, the first online fetch of an assessment that
  // was rescheduled before this device ever downloaded it wiped the offline
  // captures that created the stub.
  if (!(await isAssessmentFullyMirrored(localId))) {
    return false;
  }

  // Never destroy unsynced captures. The wipe assumes ops can only reschedule
  // before any on-site work exists, but if that invariant is ever violated we
  // would silently delete the assessor's queued work. Skip the wipe while the
  // outbox holds pending rows — the next sync uploads them, after which a
  // later reschedule check can safely refresh.
  const pending = await countPendingForAssessment(localId);
  if (pending > 0) {
    Logger.warn(
      `[reschedule] assessment ${serverAssessment.id} bumped ${storedVersion} -> ${serverVersion}, ` +
        `but ${pending} unsynced item(s) present — skipping wipe to avoid data loss`
    );
    return false;
  }

  Logger.info(
    `[reschedule] assessment ${serverAssessment.id} bumped ${storedVersion} -> ${serverVersion}, wiping local data`
  );

  await clearAssessmentLocalData(localId);
  await deletePhotosForAssessment(localId);

  // Re-hydrate parameters/questions and refresh the assessment row so the
  // device immediately reflects the new schedule. Failures here are not
  // fatal — the next online open will retry the download.
  try {
    await downloadAssessmentForOffline(serverAssessment.id);
  } catch (error) {
    Logger.warn('[reschedule] re-hydrate after wipe failed:', error?.message || error);
  }

  return true;
};
