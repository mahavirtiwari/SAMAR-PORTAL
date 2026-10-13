import { Logger } from '../../utils/logger';
import Api from '../api';
import { enqueue, markSynced } from '../database/repositories/outboxRepo';
import { removeCachedPicture } from '../database/repositories/sitePictureCacheRepo';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Deletes a site picture offline-first. In this app a delete only ever targets
 * an already-uploaded picture (a fresh, not-yet-saved capture is dropped from
 * screen state without ever reaching the server). Queue a server delete keyed
 * by the server picture id, then attempt it inline; on failure the sync engine
 * retries later, treating a 404 (already gone) as success.
 */
export const recordSitePictureDelete = async ({ serverAssessmentId, pictureId }) => {
  if (!serverAssessmentId) {
    throw new Error('recordSitePictureDelete: missing serverAssessmentId');
  }
  if (!pictureId) {
    throw new Error('recordSitePictureDelete: missing pictureId');
  }

  const opKey = `deleteSitePicture:${pictureId}`;
  await enqueue({
    assessmentId: String(serverAssessmentId),
    opType: 'deleteSitePicture',
    opKey,
    payload: { serverAssessmentId, pictureId },
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  // Invalidate the offline read-cache so the deleted picture can't resurface
  // from a local copy on the next offline visit.
  try {
    await removeCachedPicture(String(serverAssessmentId), 'site', pictureId);
  } catch (cacheError) {
    Logger.warn(
      `[offline] site picture cache invalidation failed: ${cacheError?.message || cacheError}`,
    );
  }

  try {
    await Api.SiteApi.deleteSitePicture({ assessmentId: serverAssessmentId, pictureId });
    if (outboxRowId) {
      await markSynced(outboxRowId);
    }
    Logger.info('[offline] site picture delete synced inline');
    return { deleted: true, synced: true, queued: true };
  } catch (error) {
    if (error?.response?.status === 404) {
      // Already gone on the server — the intent is satisfied.
      if (outboxRowId) {
        await markSynced(outboxRowId);
      }
      return { deleted: true, synced: true, queued: true };
    }
    Logger.warn(`[offline] site picture delete queued for later sync: ${error?.message || error}`);
    return { deleted: true, synced: false, queued: true };
  }
};
