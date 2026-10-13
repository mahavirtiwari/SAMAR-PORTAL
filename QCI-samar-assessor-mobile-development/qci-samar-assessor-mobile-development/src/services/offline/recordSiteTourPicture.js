import { Logger } from '../../utils/logger';
import { idFromServer, newId } from '../database/ids';
import { ensureAssessmentRow } from '../database/repositories/assessmentsRepo';
import { enqueue } from '../database/repositories/outboxRepo';
import { insertSiteTourPicture } from '../database/repositories/sitePicturesRepo';
import { flushOutbox } from './flushOutbox';
import { isPersistedPhotoPath, persistPhoto } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Offline-first capture of a single site tour photo. Each photo is its
 * own row (up to 25 allowed per spec). API contract:
 *   POST /application-assessments/{id}/site-tour-pictures (multipart)
 */
export const recordSiteTourPicture = async ({
  serverAssessmentId,
  ownerUserId,
  title,
  uri,
  latitude,
  longitude,
  capturedAt: capturedAtArg
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordSiteTourPicture: missing serverAssessmentId');
  }
  const localAssessmentId = idFromServer(serverAssessmentId);
  const localId = newId();
  // Prefer the real capture time passed from the screen; fall back to now for
  // callers that don't supply one. Stamping at save time would collapse the
  // capture order, since photos are saved in parallel.
  const capturedAt = capturedAtArg || new Date().toISOString();

  // The site_tour_pictures row FKs to assessments(id); make sure the parent
  // exists even if the assessment was never downloaded / mirrored yet.
  await ensureAssessmentRow(serverAssessmentId);

  // Already persisted at capture (capturePipeline) → reuse as-is.
  const filePath = isPersistedPhotoPath(uri)
    ? uri
    : await persistPhoto({
        uri,
        assessmentId: localAssessmentId,
        bucket: 'site_tour',
        name: `tour_${localId}.jpg`
      });
  // persistPhoto returns null on an empty/missing source — see recordResponse:
  // queuing it uploads a doomed file that wedges the outbox. Fail loudly.
  if (!filePath) {
    Logger.error(`[siteTourPicture] persist failed (empty/missing source) source=${uri}`);
    throw new Error('Could not save the site tour photo — the image was empty. Please retake it.');
  }

  await insertSiteTourPicture({
    id: localId,
    assessmentId: localAssessmentId,
    ownerUserId,
    title,
    filePath,
    latitude,
    longitude,
    capturedAt
  });
  Logger.info('[DIAG] siteTour capture saved locally', {
    localId,
    assessmentId: localAssessmentId,
    filePath
  });

  const opKey = `siteTourPicture:${localId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'siteTourPicture',
    opKey,
    payload: { localId, serverAssessmentId, title, filePath, latitude, longitude, capturedAt }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'siteTourPicture');
  return { localId, synced };
};
