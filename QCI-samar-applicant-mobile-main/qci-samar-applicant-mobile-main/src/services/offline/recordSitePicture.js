import { checkInternetConnection } from '../../utils/checkInternetConnection';
import { Logger } from '../../utils/logger';
import Api from '../api';
import { newId } from '../database/ids';
import { enqueue, markSynced } from '../database/repositories/outboxRepo';
import { isUploadableFile } from './photoStorage';
import { cacheLocalCapture } from './sitePictureCache';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Offline-first capture of a site interior/exterior photo. The screen has
 * already persisted `uri` to durable storage (imageUtils.prepareCapturedPhoto),
 * so we reuse it as-is: verify it's uploadable, queue the op, then upload inline
 * when online. `localId` is the stable client_uuid the server dedupes on across
 * replays.
 */
export const recordSitePicture = async ({
  serverAssessmentId,
  type, // 'interior' | 'exterior'
  uri,
  latitude,
  longitude,
  capturedAt: capturedAtArg,
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordSitePicture: missing serverAssessmentId');
  }
  if (!['interior', 'exterior'].includes(type)) {
    throw new Error(`recordSitePicture: unknown type ${type}`);
  }

  const localId = newId();
  const capturedAt = capturedAtArg
    ? new Date(capturedAtArg).toISOString()
    : new Date().toISOString();

  // The durable file must still exist at queue time; a missing/empty file would
  // stage a doomed upload that fails terminally at sync — ask for a retake now.
  if (!(await isUploadableFile(uri))) {
    Logger.error(`[sitePicture] file missing/empty at queue time -> ${uri}`);
    throw new Error('Could not save the site picture — the image was empty. Please retake it.');
  }

  // Slot-stable key: interior/exterior are singleton slots, so a re-take
  // REPLACES the slot's pending row instead of queuing a second upload. Keyed
  // per-slot (not per-localId) is what keeps the outbox — and the resulting web
  // uploads — at one picture per slot; the backend does not dedupe applicant
  // uploads across differing client_uuids, so the client must not enqueue two.
  const opKey = `sitePicture:${serverAssessmentId}:${type}`;
  await enqueue({
    assessmentId: String(serverAssessmentId),
    opType: 'sitePicture',
    opKey,
    payload: { localId, serverAssessmentId, type, filePath: uri, latitude, longitude, capturedAt },
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  if (!(await checkInternetConnection())) {
    return { localId, synced: false, queued: true };
  }

  try {
    const result = await Api.SiteApi.addSitePicture({
      assessmentId: serverAssessmentId,
      type,
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
        kind: 'site',
        serverPictureId: created.id,
        localUri: uri,
        title: created.title,
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
    Logger.warn(`[offline] sitePicture queued: ${error?.message}`);
    return { localId, synced: false, queued: true };
  }
};
