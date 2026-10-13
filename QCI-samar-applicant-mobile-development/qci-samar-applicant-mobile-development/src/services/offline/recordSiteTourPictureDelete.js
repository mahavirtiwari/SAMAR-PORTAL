import { Logger } from '../../utils/logger';
import Api from '../api';
import { enqueue, markSynced } from '../database/repositories/outboxRepo';
import { removeCachedPicture } from '../database/repositories/sitePictureCacheRepo';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Deletes a site-tour picture offline-first. Mirrors recordSitePictureDelete:
 * targets an already-uploaded picture only, queues a server delete keyed by the
 * server picture id, attempts it inline, and treats a 404 as success.
 */
export const recordSiteTourPictureDelete = async ({ serverAssessmentId, pictureId }) => {
  if (!serverAssessmentId) {
    throw new Error('recordSiteTourPictureDelete: missing serverAssessmentId');
  }
  if (!pictureId) {
    throw new Error('recordSiteTourPictureDelete: missing pictureId');
  }

  const opKey = `deleteSiteTourPicture:${pictureId}`;
  await enqueue({
    assessmentId: String(serverAssessmentId),
    opType: 'deleteSiteTourPicture',
    opKey,
    payload: { serverAssessmentId, pictureId },
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  // Invalidate the offline read-cache so the deleted photo can't resurface from
  // a local copy on the next offline visit.
  try {
    await removeCachedPicture(String(serverAssessmentId), 'tour', pictureId);
  } catch (cacheError) {
    Logger.warn(
      `[offline] site tour picture cache invalidation failed: ${cacheError?.message || cacheError}`,
    );
  }

  try {
    await Api.SiteApi.deleteSiteTourPicture({ assessmentId: serverAssessmentId, pictureId });
    if (outboxRowId) {
      await markSynced(outboxRowId);
    }
    Logger.info('[offline] site tour picture delete synced inline');
    return { deleted: true, synced: true, queued: true };
  } catch (error) {
    if (error?.response?.status === 404) {
      if (outboxRowId) {
        await markSynced(outboxRowId);
      }
      return { deleted: true, synced: true, queued: true };
    }
    Logger.warn(
      `[offline] site tour picture delete queued for later sync: ${error?.message || error}`,
    );
    return { deleted: true, synced: false, queued: true };
  }
};
