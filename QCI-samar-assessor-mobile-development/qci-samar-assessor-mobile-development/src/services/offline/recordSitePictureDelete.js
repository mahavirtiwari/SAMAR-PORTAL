import { idFromServer } from '../database/ids';
import { dequeueByOpKey, enqueue } from '../database/repositories/outboxRepo';
import {
  findSitePictureByServerOrLocalId,
  hardDeleteSitePicture,
  softDeleteSitePicture
} from '../database/repositories/sitePicturesRepo';
import { flushOutbox } from './flushOutbox';
import { deletePhotoFile } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Deletes a site picture offline-first.
 *
 *   - Unsynced local capture (no server_id): the server never saw it, so we
 *     just cancel its queued create, unlink the image, and drop the row.
 *   - Synced row (has server_id): soft-delete it (hidden from the local list
 *     immediately), enqueue a server delete keyed by server_id, then hand it
 *     to the drain, which hard-deletes the row once the server confirms.
 *
 * `pictureId` may be a server id (synced rows surface server_id as their id) or
 * a local id (unsynced captures); findSitePictureByServerOrLocalId resolves both.
 */
export const recordSitePictureDelete = async ({ serverAssessmentId, pictureId }) => {
  if (!serverAssessmentId) {
    throw new Error('recordSitePictureDelete: missing serverAssessmentId');
  }
  if (!pictureId) {
    throw new Error('recordSitePictureDelete: missing pictureId');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);
  const row = await findSitePictureByServerOrLocalId(pictureId);

  // Unsynced local-only capture — remove outright, nothing to sync.
  if (row && !(row.local_status === 'synced' && row.server_id)) {
    await dequeueByOpKey(`sitePicture:${row.id}`);
    await deletePhotoFile(row.file_path);
    await hardDeleteSitePicture(row.id);
    return { deleted: true, synced: false, queued: false };
  }

  const serverId = row?.server_id ?? pictureId;
  if (row) {
    await softDeleteSitePicture(row.id);
  }

  const opKey = `sitePictureDelete:${serverId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'sitePictureDelete',
    opKey,
    payload: { serverAssessmentId, pictureId: serverId, localId: row?.id ?? null }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'sitePictureDelete');
  return { deleted: true, synced, queued: true };
};
