import { checkInternetConnection } from '../../utils/checkInternetConnection';
import { Logger } from '../../utils/logger';
import Api from '../api';
import { newId } from '../database/ids';
import { enqueue, markSynced } from '../database/repositories/outboxRepo';
import { isUploadableFile } from './photoStorage';
import { cacheLocalCapture } from './sitePictureCache';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Offline-first capture of a single site-tour photo. Each photo is its own op.
 * The screen has already persisted `uri` to durable storage, so we reuse it:
 * verify it's uploadable, queue, then upload inline when online. `localId` is
 * the stable client_uuid the server dedupes on across replays.
 */
export const recordSiteTourPicture = async ({
  serverAssessmentId,
  title,
  uri,
  latitude,
  longitude,
  capturedAt: capturedAtArg,
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordSiteTourPicture: missing serverAssessmentId');
  }

  const localId = newId();
  const capturedAt = capturedAtArg
    ? new Date(capturedAtArg).toISOString()
    : new Date().toISOString();

  if (!(await isUploadableFile(uri))) {
    Logger.error(`[siteTourPicture] file missing/empty at queue time -> ${uri}`);
    throw new Error('Could not save the site tour photo — the image was empty. Please retake it.');
  }

  const opKey = `siteTourPicture:${localId}`;
  await enqueue({
    assessmentId: String(serverAssessmentId),
    opType: 'siteTourPicture',
    opKey,
    payload: { localId, serverAssessmentId, title, filePath: uri, latitude, longitude, capturedAt },
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  if (!(await checkInternetConnection())) {
    return { localId, synced: false, queued: true };
  }

  try {
    const result = await Api.SiteApi.addSiteTourPicture({
      assessmentId: serverAssessmentId,
      title,
      uri,
      latitude,
      longitude,
      capturedAt,
      clientUuid: localId,
    });
    // Write-through so an offline revisit after this upload still renders it.
    const created = result?.data?.picture;
    if (created?.id != null) {
      await cacheLocalCapture({
        assessmentId: serverAssessmentId,
        kind: 'tour',
        serverPictureId: created.id,
        localUri: uri,
        title: created.title ?? title,
        latitude: created.latitude ?? latitude,
        longitude: created.longitude ?? longitude,
        capturedAt: created.capturedAt ?? capturedAt,
        downloadUrl: created.downloadUrl,
      });
    }
    if (outboxRowId) {
      await markSynced(outboxRowId);
    }
    return { localId, synced: true, queued: true };
  } catch (error) {
    Logger.warn(`[offline] siteTourPicture queued: ${error?.message}`);
    return { localId, synced: false, queued: true };
  }
};
