import { Logger } from '../../utils/logger';
import { idFromServer, newId } from '../database/ids';
import { ensureAssessmentRow } from '../database/repositories/assessmentsRepo';
import { enqueue } from '../database/repositories/outboxRepo';
import { insertSitePicture } from '../database/repositories/sitePicturesRepo';
import { flushOutbox } from './flushOutbox';
import { isPersistedPhotoPath, isUploadableFile, persistPhoto } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Offline-first capture of a site interior or exterior photo (the
 * dedicated Site Pictures step, distinct from the punch-in proof-of-
 * arrival photos and from the Site Tour step).
 */
export const recordSitePicture = async ({
  serverAssessmentId,
  type, // 'interior' | 'exterior'
  uri,
  latitude,
  longitude
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordSitePicture: missing serverAssessmentId');
  }
  if (!['interior', 'exterior'].includes(type)) {
    throw new Error(`recordSitePicture: unknown type ${type}`);
  }
  const localAssessmentId = idFromServer(serverAssessmentId);
  const localId = newId();
  const capturedAt = new Date().toISOString();

  // The site_pictures row FKs to assessments(id); make sure the parent
  // exists even if the assessment was never downloaded / mirrored yet.
  await ensureAssessmentRow(serverAssessmentId);

  // Already persisted at capture (capturePipeline) → reuse as-is; re-running
  // persistPhoto would re-compress an already-compressed image.
  const filePath = isPersistedPhotoPath(uri)
    ? uri
    : await persistPhoto({
        uri,
        assessmentId: localAssessmentId,
        bucket: 'site_pictures',
        name: `${type}_${localId}.jpg`
      });
  // persistPhoto returns null when the source is empty/missing. Queuing it
  // anyway uploads a doomed file that fails with a no-status network error and
  // wedges the outbox. Fail loudly so the screen can ask for a retake.
  if (!filePath) {
    Logger.error(`[sitePicture] persist failed (empty/missing source) source=${uri}`);
    throw new Error('Could not save the site picture — the image was empty. Please retake it.');
  }

  // The reused/persisted file must still exist at queue time. If it was
  // unlinked between capture and save, queuing it would stage a missing-file
  // upload that fails terminally at sync ("needs re-capture") — surface a
  // retake now instead.
  if (!(await isUploadableFile(filePath))) {
    Logger.error(`[sitePicture] persisted file missing/empty at queue time -> ${filePath}`);
    throw new Error('Could not save the site picture — the image was empty. Please retake it.');
  }

  await insertSitePicture({
    id: localId,
    assessmentId: localAssessmentId,
    type,
    filePath,
    latitude,
    longitude,
    capturedAt
  });

  const opKey = `sitePicture:${localId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'sitePicture',
    opKey,
    payload: { localId, serverAssessmentId, type, filePath, latitude, longitude, capturedAt }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'sitePicture');
  return { localId, synced };
};
